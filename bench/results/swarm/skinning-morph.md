# Skinning, morph targets and the animation system

Branch `swarm/skinning-morph`. Environment: headless Chromium (Playwright build 1194) on ANGLE/SwiftShader, 4 cores.

## What is implemented

**Objects** (`src/objects/Bone.js`, `Skeleton.js`, `SkinnedMesh.js`), three.js r186 API:

* `Bone`; `Skeleton` with `bones`, `boneInverses`, `boneMatrices`, `boneTexture`, `init`, `calculateInverses`,
  `pose`, `update`, `clone`, `computeBoneTexture` (same size rule and texel layout as three), `getBoneByName`,
  `dispose`, `fromJSON` / `toJSON`.
* `SkinnedMesh` with `bindMode` (`AttachedBindMode` / `DetachedBindMode`), `bindMatrix`, `bindMatrixInverse`,
  `bind`, `pose`, `normalizeSkinWeights`, `applyBoneTransform`, `getVertexPosition`, skinned `computeBoundingBox` /
  `computeBoundingSphere`, `raycast` (deformed triangles, no BVH), `copy` / `clone`, `updateMatrixWorld` (and
  `updateWorldMatrix`) refreshing `bindMatrixInverse`.
* Frustum culling uses the mesh's own `boundingSphere` for `SkinnedMesh` (and `InstancedMesh`), the three.js
  `Frustum.intersectsObject` rule.

**Rendering** (`src/renderers/shaders/ShaderLib.js`, `webgl/WebGLPrograms.js`, `webgl/WebGLBindingStates.js`,
`webgl/WebGLTextures.js`, `webgl/WebGLMorphtargets.js`, `WebGLRenderer.js`):

* The built-in vertex shader includes three's `skinning_pars_vertex`, `skinbase_vertex`, `skinnormal_vertex`,
  `skinning_vertex`, `morphtarget_pars_vertex`, `morphtarget_vertex`, `morphnormal_vertex` chunks verbatim
  (`USE_SKINNING`, `USE_MORPHTARGETS`, `USE_MORPHNORMALS`, `USE_MORPHCOLORS`, `MORPHTARGETS_COUNT`,
  `MORPHTARGETS_TEXTURE_STRIDE`), and the morph-colour code on jrs's vec4 `vColor`. Every built-in material,
  the depth-only shadow program and `MeshDepthMaterial` / `MeshNormalMaterial` go through it, so skinned and
  morphed meshes cast shadows.
* `skinIndex` / `skinWeight` are fixed attribute locations 6 / 7 (shared VAOs stay shared); `boneTexture` is
  texture unit 16 and `morphTargetsTexture` unit 17 in `TEXTURE_UNITS` (vertex samplers above the 16 fragment
  units; WebGL2 guarantees 32 combined units, so no fragment sampler is displaced).
* Program parameters carry `skinning`, `morphTargets`, `morphNormals`, `morphColors`, `morphTargetsCount`
  (capped at 255) and `morphTextureStride`; the renderer's per-material variant encodes them too, so a material
  shared by a skinned mesh, a morphed mesh and a plain mesh resolves three programs correctly within one frame.
* `bindMatrix` / `bindMatrixInverse` are uploaded through the per-location value cache (sent only when they
  differ from the last upload on that program); `morphTargetBaseInfluence`, `morphTargetInfluences[]`,
  `morphTargetsTextureSize` likewise.
* Morph textures: one RGBA32F `DataArrayTexture` per geometry (three's exact layout: one layer per target,
  position / normal / colour texels per vertex), built once, rebuilt when the morph attributes or vertex count
  change, dropped on geometry dispose.
* Bone textures: `Skeleton.computeBoneTexture()` creates the RGBA float `DataTexture`; it is marked as streamed
  and `WebGLTextures` uploads it with `texImage2D` (one call per skeleton per frame it changed, parameters set
  once) instead of `texStorage2D` + `texSubImage2D`, per the stall-hunter finding.
* `Skeleton.update()` writes `bone.matrixWorld * boneInverse` straight into `boneMatrices` (inlined 4x4
  multiply over the slab-resident world matrix, no temporaries) and skips everything, including the texture
  re-flag, when no bone's `_worldVersion` changed and the inverses are the same. It runs once per `render()`
  call (shadow pass included) from the render-list build.
* Pixel-store unpack state (`UNPACK_FLIP_Y_WEBGL`, `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, `UNPACK_ALIGNMENT`) is now
  cached in `WebGLState.setUnpack`, so the 200 bone-texture uploads of the crowd scene cost 200 GL calls, not 1000.
  The batcher's matrix texture now explicitly uploads with premultiply off (it previously inherited whatever the
  last texture upload left, a latent bug).
* Skinned and morphed meshes are excluded from instanced batching and multi-draw (they already were by the
  `isSkinnedMesh` / `morphTargetInfluences` checks in `_isBatchable`); they draw one call each.
* `ShaderMaterial` / `RawShaderMaterial`: the prefix gets the same `USE_SKINNING` / `USE_MORPH*` /
  `MORPHTARGETS_*` defines as three's, the `skinIndex` / `skinWeight` attributes were already declared, and
  the renderer uploads `bindMatrix`, `bindMatrixInverse`, `boneTexture`, `morphTarget*` to any program that
  declares them (custom programs get sequential units as before). A custom shader that includes the three chunks
  renders identically to three.js (conformance check).

**Animation** (`src/animation/`, `src/math/Interpolant.js`, `src/math/interpolants/`): `AnimationMixer`,
`AnimationAction`, `AnimationClip`, `AnimationObjectGroup`, `AnimationUtils`, `KeyframeTrack`,
`Boolean/Color/Number/Quaternion/String/VectorKeyframeTrack`, `PropertyBinding`, `PropertyMixer`, `Interpolant`,
`Linear/Discrete/Cubic/Bezier/QuaternionLinearInterpolant`: the three.js r186 sources with the doc comments
stripped and `utils.js` replaced by console wrappers. Constants added: `Interpolate*`, `*Ending`,
`*AnimationBlendMode`, `AttachedBindMode`, `DetachedBindMode`. All exported from `src/index.js`.

**Other fixes made on the way**

* `Mesh._computeIntersections` no longer builds / uses the static BVH for skinned meshes (it already skipped it
  for morph targets).
* `renderer.compile()` resolves the full object variant (instancing, skinning, morphs) instead of instancing only.

## What is not implemented (precisely)

* `InstancedMesh.morphTexture` / `USE_INSTANCING_MORPH` (per-instance morph influences): the chunk is in
  `ShaderChunk` but the renderer never defines `USE_INSTANCING_MORPH`; `InstancedMesh` has no `morphTexture`
  property or `getMorphAt` / `setMorphAt`.
* `SkeletonHelper` (an addon-free helper was out of scope; nothing else is exported).
* Morph target counts above 255 share a program key (the shader is compiled with the first count seen). three.js
  has no such cap, but 255 uniform floats is already past what most devices allow for the influences array.
* `Skeleton.update()` skips its work when no bone moved. Mutating a `boneInverses[i]` matrix in place after
  binding (rather than calling `calculateInverses()` / `init()` or replacing the array) is not detected until a
  bone moves; three.js recomputes unconditionally. Loaders build the inverses once, so this has not been seen,
  but it is the one behavioural gap of the fast path.
* three.js r186 cannot compile `USE_MORPHCOLORS` with RGB (itemSize 3) vertex colours (its chunk adds a vec3
  to its vec4 `vColor`); jrs renders that case. The conformance check therefore uses RGBA vertex colours, which
  both libraries render.
* Morph targets on `Line` / `Points` go through the same shared vertex shader and `updateMorphTargets()` as
  meshes, but no conformance check covers them (meshes only).
* Animation-driven material / morph properties work through `PropertyBinding`; `AnimationLoader` and
  `ObjectLoader` skeleton deserialisation are not ported (loaders remain out of scope).

## Conformance (`node bench/conformance.mjs`, 28 checks, all PASS)

The device page now loads three.js (local copy, else CDN) into a second renderer and compares pixels for the
new checks:

| check | result |
|---|---|
| SkinnedMesh: cylinder bent by two bones | bind pose vs plain mesh max diff 0; vs three.js mean 0.000, max 0; 1 draw call; raycast on the bent part hits |
| Morph targets: position / normal / colour, absolute and relative | vs three.js mean 0.000, max 0 (before and after changing influences); zero influences equal the base geometry (max diff 0) |
| Skinned mesh animated by AnimationMixer | vs three.js mean 0.000, max 0; `.rotation[y]` number track lands on the expected value |
| Skinned mesh casting and receiving a directional shadow | vs three.js mean 0.063, max 52, 0.14 % of pixels differ by > 16 (PCF edge rounding, same class as the existing `shadows` scenario); shadowed floor 87 vs lit 248 |
| ShaderMaterial with skinning and morph target chunks | vs three.js mean 0.000, max 0; GL error 0 |

Unit tests (`npm test`): 113 pass (13 new in `test/animation.test.js`): skeleton inverses / bone matrices / bone
texture size, change-detected `update()`, skinned vertex positions and bounds, detached bind mode, skinned raycast
hits (distance, point, face) vs three, `normalizeSkinWeights` / `pose()` / clone, morph dictionary and
`getVertexPosition`, mixer sampling (40 steps x 6 bones x 16 floats), loop modes / time scale / clamp / reverse /
events, crossfade / halt / warp / additive, every track type and interpolation mode with ending modes, track and
clip utilities and JSON, PropertyBinding paths (bones by name, material, morph influences by name, `visible`),
morph-sequence clip creation, `AnimationObjectGroup`.

`node bench/smoke.mjs`: GL error 0. `node bench/addons.mjs`: unchanged (OrbitControls / BufferGeometryUtils ok).

## Benchmark: `skinned-crowd`

200 `SkinnedMesh`es sharing one 20-segment tapered tube geometry (1 320 vertices, 4 weights per vertex over a
20-bone chain), 8 Lambert materials, each mesh with its own `AnimationMixer` playing a shared 20-track quaternion
clip at its own phase, `mixer.update(1/60)` every frame. 4 000 bones move every frame.

`node bench/run.mjs skinned-crowd --compare --frames=60` (two full runs of the suite, the merged tree; medians of
60 timed frames after 10 warm-up frames, 320x240):

| run | three.js r186 median | jrs median | three mean / worst | jrs mean / worst |
|---|---:|---:|---|---|
| 1 | 5.0 ms | 3.4 ms | 4.74 / 7.0 ms | 3.70 / 7.3 ms |
| 2 | 6.4 ms | 3.0 ms | 6.59 / 9.4 ms | 3.03 / 4.4 ms |

Better medians: **three.js 5.0 ms, jrs 3.0 ms (1.7x)**. A single-scenario run before the integration merge gave
4.3 / 3.4 ms. Pixel comparison: **meanAbsDiff 0.000, maxDiff 2, 3 differing pixels** of 76 800 (threshold
0.5 / 33). GL calls per frame: three 2 209 (808 `uniform*`, 200 `bindTexture`, 200 draws, 1 000 `pixelStorei`
and `texParameteri` in the rest), jrs 1 413 (800 `uniform*`: model, normal, bind and inverse bind matrix per
mesh; 200 `bindTexture`; 200 draws; 200 `texImage2D`).

Where the jrs frame goes (node-side measurement of the CPU part, 200 rigs, 4 000 bones): `mixer.update` ~1.0 ms,
`scene.updateMatrixWorld` ~0.75 ms, `skeleton.update` ~0.4 ms; three.js measures the same within noise for the
first two (same code / same amount of work) and ~0.45 ms for the skeleton. The remaining gain is on the GL side
(no per-upload pixel-store and sampler-parameter calls, fewer uniform uploads, cached state).

The rest of the suite is unchanged within noise and every scenario's `compare` numbers are identical to the
committed baseline (shared-static 0.347 / 8, shared-animated 0.346 / 9, shadows 0.134 / 33, shadows-animated
0.121 / 31, everything else 0 / 0).

## Risks

* Texture units 16 / 17: a device with `MAX_COMBINED_TEXTURE_IMAGE_UNITS` < 18 would fail to bind the bone or
  morph texture. WebGL2 mandates at least 32, so none exists; the conformance page reports the limit.
* The `Skeleton.update()` skip (above) is the one place jrs trusts its version counters more than three does.
* The program key gained 14 bits (skinning, morph flags, stride, count); it stays below 2^53 (material type < 16),
  but it is now close to the limit. The next feature bit should move the key to a pair of integers.
* `WebGLState.setUnpack` assumes nothing else touches `pixelStorei` on the context. Code that shares the
  context with jrs and sets unpack state itself must call `renderer.resetState()` afterwards (as with the rest of
  the state cache).

## Follow-up ideas

* `InstancedMesh.morphTexture` (`USE_INSTANCING_MORPH`) and `SkeletonHelper`.
* Batching skinned meshes that share a skeleton (crowds instanced from one rig): the bone texture is per
  skeleton, so instances of one skeleton could go through the instanced path with the bone texture bound once.
* Pack all skeletons of a frame into one bone texture (like the batcher's matrix texture) to cut the
  per-mesh `texImage2D` + `bindTexture` to one upload per frame.
* `AnimationMixer`: the mixer is the three.js code; a flat-array binding for `.quaternion` / `.position` tracks
  targeting bones (writing straight into the slab snapshot) would remove the per-bone `fromArray` + change check.
