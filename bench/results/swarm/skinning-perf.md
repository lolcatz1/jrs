# Skinning / animation CPU performance

Branch `swarm/skinning-perf`, merged with the integration tip (flat scene-graph pass included). Headless Chromium on
ANGLE/SwiftShader, 4 shared cores, 320x240. The machine is noisy: three.js's own median on the same scene ranged
2.4-3.3 ms between runs, so numbers are best-of-N medians and ratios are quoted as ranges.

## Result

| scenario | three.js median | jrs before | jrs now | now vs three.js |
|---|---:|---:|---:|---:|
| skinned-crowd (200 x 20 bones) | 2.6-2.9 ms | 2.4-2.5 ms | 1.3-1.5 ms | **1.7-2.2x** (best runs 2.1-2.8x) |
| skinned-crowd-large (1000 x 40 bones) | 24-26 ms | 21.7-26.6 ms | 8.4-9.2 ms | **2.7-2.9x** |
| morph-crowd (500 meshes, 8 targets) | 0.7-0.8 ms | 0.4-0.5 ms | 0.4-0.5 ms | ~1.8-2.0x (unchanged) |

("before" = integration commit 6858f51, three runs each in alternation with "now"; three.js numbers are from the
same runs.) The 2x goal on skinned-crowd is met only by the better runs; the typical run is 1.7-2.0x. The large rig is
comfortably above 2x. After the final merge a quick re-check gave jrs 1.5-1.6 ms vs three 2.6-2.9 ms on skinned-crowd;
the unmodified integration tip measures 2.1 ms on the same machine/time.

CPU-only parts (node, no GL; `node bench/micro/skinned-cpu.mjs [scenario] [--lib=jrs|three]`, medians of 300 frames):

| skinned-crowd, ms/frame | mixer.update | scene.updateMatrixWorld | Skeleton.update x200 | total |
|---|---:|---:|---:|---:|
| three.js | 0.87 | 0.59 | 0.50 | 1.94 |
| jrs before | 0.91 | 0.70 | 0.46 | 2.06 |
| jrs now | 0.29 | 0.30 | 0.25 | 0.87 |

| skinned-crowd-large | mixer | matrixWorld | Skeleton.update | total |
|---|---:|---:|---:|---:|
| three.js | 10.2 | 5.9 | 3.7 | 19.9 |
| jrs before | 10.0 | 6.8 | 3.7 | 20.5 |
| jrs now | 2.4 | 2.5 | 2.1 | 6.9 |

GL calls per frame (skinned-crowd): three 2209 total (808 uniform, 200 bindTexture, 200 draws, ~1000 pixelStorei /
texParameteri in the rest); jrs before 1605; jrs now **1214** (1000 uniform: model, normal, bindMatrix, bindMatrixInverse,
boneBase per mesh; 0 bindTexture; 200 draws; 8 material-block binds, was 200; one `texImage2D` for all bones, was 200).
Large: three 11009 -> jrs 6014. morph-crowd: three 1500, jrs 1504 (994 uniform, 497 draws).

Heap allocation per frame (`bench/alloc.mjs`): skinned-crowd three 294 KB, jrs before ~172 KB, jrs now **35 KB**
(remaining: render-side `_cullTest` / `_itemDepth` doubles, `AnimationAction._updateTime`). Large 118 KB, morph-crowd 74 KB.

CPU profile (`node bench/profile-cpu.mjs skinned-crowd`, profiler-inflated ms/frame, steady state): before app update
(mixer) 0.95, scene graph 0.76, project+cull 0.74 (0.36 of it `Skeleton.update`), texture bind 0.32, uniform upload
0.13; after 0.52 / 0.44 / 0.46 (0.34 skeleton) / 0.06 / 0.10.

Pixels: skinned-crowd meanAbsDiff 0 / maxDiff 2 (3 differing pixels, same as before), skinned-crowd-large 0 / 10,
morph-crowd 0 / 1. Every other scenario's compare values are at or below `bench/results/latest.json` (full run below).
Tests: `npm test` 161 pass (new `test/bone-rig.test.js`: 9 tests), conformance 35/35, smoke and addons ok.
`node bench/fuzz.mjs --seeds=50`: seeds 2, 8, 12, 14, 23, 27, 35 fail, identically on the unmodified integration tip
(no skinned content in the fuzzer; not caused by this branch).

## Where the time went (profile findings)

* The arithmetic is cheap (a flat-array model of compose + world product + skin product costs ~0.09 ms for 4000
  bones). What cost ~2 ms was memory: per bone ~10 scattered heap objects (Bone, Vector3 x2, Quaternion, Euler and a
  HeapNumber per component, laid out in breadth-first GC order) touched every frame, ~25 ns per touched object.
* Mixer: the `quaternion -> Euler` conversion ran eagerly on every quaternion write (0.3 ms), the generic `Interpolant.evaluate`
  boxed doubles per call (96 + 51 KB/frame), and the slerp's sqrt/atan2 repeated every frame.
* Render side: one `texImage2D` + bind per skeleton, a material-block rebind per draw (the batch-group sort key
  interleaved the 8 materials of unbatchable meshes), a full traversal of 4000 bone objects in the render projection.

## What changed

1. **Lazy Euler** (`Euler._stale`, `Object3D`): a quaternion write only flags `rotation`; angles are recomputed on first read.
2. **Slab-resident bone transform** (`core/SlabTransform.js`, `objects/Bone.js`): `position` / `quaternion` / `scale` /
   `rotation` of a Bone are `Vector3` / `Quaternion` / `Euler` subclasses over the object's transform-slab record
   (snapshot page now 16 doubles per object), with write versions; the bone's `_worldVersion`, `_parentWorldVersion` and
   `matrixAutoUpdate`-family flags live in the same record (accessors). `Bone.updateMatrix` is a version compare.
3. **Rig update plans** (`objects/RigPlan.js`): the root bone updates its whole hierarchy in one loop over flat arrays
   (same semantics as `Object3D.updateMatrixWorld`, incl. `force`, `matrixAutoUpdate`, `matrixWorldAutoUpdate`, non-bone
   children, affine 3x4 product). Dropped per root by add/remove/attach involving a bone; Bone subclasses use the generic path.
4. **PropertyBinding fast path**: bone TRS tracks write the record directly. `QuaternionLinearInterpolant.evaluate` has an
   in-interval fast path (no boxed doubles) with a memoised slerp angle (bit-identical results); `PropertyMixer` buffers share chunks.
5. **`Skeleton.update`** from flat arrays (bone world versions and matrices from records/slab) with one shared flat
   `Float32Array` of inverse bind matrices per `boneInverses` array (Matrix4.elements are slices of it); affine product;
   object fallback for skeletons containing non-Bones.
6. **Bone atlas** (`renderers/webgl/WebGLBoneAtlas.js`): one RGBA32F texture for all skeletons drawn with built-in materials,
   `boneBase` uniform added to the bone index (ShaderMaterial keeps three's chunk and per-skeleton texture),
   one `texImage2D` per frame. `skeleton.boneTexture` is created on demand if read.
7. Renderer: skinned/morphed meshes sort by their own material (one material-block bind per material); render traversal
   skips subtrees made only of bones; `_uploadTexture` activates the unit before streaming (also fixed upstream).
8. Scenarios `skinned-crowd-large` and `morph-crowd`, `bench/micro/skinned-cpu.mjs`, ARCHITECTURE.md section 11.

## Risks

* Bone `position` / `scale` / `quaternion` / `rotation` are accessor-backed subclasses: `instanceof` and the API hold, JSON
  of the vectors is kept (`toJSON`), but code that reads internals (`quaternion._x` works; own-property enumeration differs)
  or hot generic math fed with bone vectors sees a second hidden class.
* `Skeleton.boneInverses[i].elements` is re-pointed to a slice of shared storage. Edits in place and replacing a matrix or
  the list are honoured; reassigning `matrix.elements` to a new array is not. Matrices shared by two different arrays
  alias the last skeleton that flattened them.
* Bone scene-graph state is in the record (`_worldVersion` etc. are accessors on Bone); rig plans bypass overridden
  methods only for exact `Bone` instances.
* Records grew from 14 to 16 doubles per object (+16 B per Object3D).
* A skeleton drawn by two renderers alternately re-allocates its atlas slots each time.
* Reused render lists do not call `skeleton.update()` (as before): in-place `boneInverses` edits with no bone movement need `init()`/`calculateInverses()`.
* Timings on this machine vary +-20% between runs; the 2x on skinned-crowd is not guaranteed on every run.
* `build/` bundles were not rebuilt.

## Follow-up ideas

* Fuse the rig pass with the skin product (bone world is in registers) and write `boneMatrices` directly.
* Play single-action weight-1 clips from a flat per-clip loop (no PropertyMixer/interpolant objects), writing records directly;
  the three remaining ~90 ns/track are interpolant + accumulate + apply call chains plus two `Math.sin`.
* Instance skinned meshes that share geometry and material through the atlas (per-instance `boneBase`): 200 draws -> ~8.
* Move bindMatrix/bindMatrixInverse into the atlas or a UBO (2 of 5 per-draw uniform calls).
* Pack bone TRS+world tighter for the 1000-rig case (cache pressure makes per-bone cost ~1.5x higher than at 200 rigs).
