# Flat scene update (`swarm/flat-scene-update`)

One flat, parent-before-child loop replaces the two recursive walks (`scene.updateMatrixWorld()` and
`_projectObject`) that were the CPU floor of the animated 10k-object scenes. Behind `renderer.flatSceneUpdate`
(default `true`; `false` restores the recursive walks, kept as the fallback for one release).

## What changed

| file | change |
|------|--------|
| `src/core/FlatGraph.js` (new) | `FlatGraph`: per-scene array of objects in `traverse` order with `parent`, `end` (subtree end), `childCount`, `kind` (K_* bits) in typed arrays, per-frame scratch (`wv` world version seen, `dirty` "descendants recompute", `vis` effective visibility). `rebuild()` (iterative, explicit stack), `onAdd` / `onRemove` (splice patches), `kindOf`. |
| `src/core/Object3D.js` | `add` / `remove` / `attach` notify the graphs rooted at the node or an ancestor (`notifyAdd` / `notifyRemove`); fields `_flat`, `_flatIndex`, `_flatGraph`; prototype markers `_flatUMW` (the `updateMatrixWorld` the pass replaces) and `_flatPostUpdate` (null). **Behaviour fix**: `updateMatrixWorld` now notes the parent's world version for a `matrixWorldAutoUpdate = false` object too, so its children are recomputed when the parent moves or `matrixWorldNeedsUpdate` is set, not on every frame (which also kept `epochs.world` moving and blocked render-list reuse for any scene containing such an object). |
| `src/cameras/Camera.js`, `src/objects/SkinnedMesh.js` | `_flatUMW` = their own `updateMatrixWorld`, `_flatPostUpdate` = `_updateInverse` / `_updateBindMatrixInverse`, so the pass treats them as known classes and runs the hook after a recompute. |
| `src/renderers/WebGLRenderer.js` | `flatSceneUpdate` flag, `_flatGraphFor`, `_flatPass` (the loop), merged / split mode selection in `render()`, `_buildList` merged path and rebuild-and-rerun on a `children.length` mismatch, `_pushItem` defers `skeleton.update()` during a merged pass (`_deferSkeletons` / `_skinnedPending`), `debug.flatUpdate` counters. |
| `src/renderers/webgl/WebGLRenderListCache.js` | `flatChanged`: the last pass of this list's scene recomputed a world matrix. |
| `WebGLRenderer.render` (verify mode) | A level-0 reused list is now verified right after `_prepareList`, before the shadow pass: `_renderItem` runs `onBeforeRender` hooks in the shadow pass too, and a hook that edits the scene there made the fresh build differ from *any* list built at that point of the frame (the mismatch `flat-check` used to report at "hook removes itself" with shadows on; it reproduced with the recursive renderer as the first instance). The mismatch message now says what differs (counts, first differing item, first order difference). |
| `bench/profile.mjs` | Fixed: recursive wrappers were counted once per nesting level (`_projectObject` reported 590 ms in an 11 ms frame) and the no-batch pass at the end added to the already-averaged phase timers; new phases `flatPass(update+project)`, `scene.updateMatrixWorld`, `list.finish(sort)`, `batcher.uploadTexture`, `gl.texImage2D`. |
| `bench/flat-check.mjs` (new) | Twin scenes, flat vs recursive renderer (plus a second pair at a 1-in-3 cadence for the two-renderers case), 328 frame pairs of mutations; requires byte-identical pixels and identical `onBeforeRender` / `onAfterRender` order; also runs 7 bench scenarios flat vs recursive. |
| `test/flat-scene-update.test.js` (new) | 13 node tests driving `_flatPass` with a GL-free fake renderer against the recursive reference. |
| `ARCHITECTURE.md` §1b, `README.md` | Documentation. |

## Design

**The array.** Built on the first render of a scene (`scene._flatGraph`) by an iterative pre-order traversal. Entry
`i` holds `objects[i]`, `parent[i]` (index, -1 for the root), `end[i]` (one past the last descendant: subtrees are
contiguous), `childCount[i]` and `kind[i]`:

| bit | meaning |
|---|---|
| `K_RENDERABLE` | Mesh / Line / Points |
| `K_SPRITE`, `K_LIGHT`, `K_LOD` | the other `_projectObject` branches |
| `K_CUSTOM` | `object.updateMatrixWorld !== object._flatUMW`: a subclass override (three addons such as `TransformControls`, `SkeletonHelper`, `PositionalAudio` do this). The pass calls `object.updateMatrixWorld(force)` for it, which updates its whole subtree recursively. |
| `K_INSUB` | inside a `K_CUSTOM` subtree: the pass skips the matrix step (projection still runs per object) |
| `K_POST` | `_flatPostUpdate` to call after the pass handled the object (Camera: view inverse; SkinnedMesh: bind matrix inverse) |
| `K_NOCOUNT` | `_countsWorld === false` (cameras): a recompute does not move `epochs.world` |

**The loop** (`_flatPass(graph, scene, camera, list, doUpdate, project, sortObjects)`), per entry:

1. `children.length !== childCount[i]` → stop, mark the graph invalid; the caller rebuilds it and reruns the pass
   (the matrix part is idempotent, the list / lights / render-order state is re-initialised).
2. Matrix update (`doUpdate`): inlined `updateMatrix` (ten compares against the slab snapshot, recompose on change),
   then `need = matrixWorldNeedsUpdate || changed || dirty[parent] || wv[parent] !== _parentWorldVersion`; when
   needed and `matrixWorldAutoUpdate`, the world matrix is written straight into the slab with the same expression
   order as `Matrix4.multiplyMatrices` (bit-identical results), `_worldVersion++`, and `dirty[i] = 1` so
   descendants recompute (three's `force`). `wv[i] = _worldVersion` is written for every entry so children read
   the parent's final version. The graph root with a parent of its own (`render(group)`) goes through
   `updateWorldMatrix(false, false)`.
3. Projection (`project`): `vis[i] = vis[parent] & visible`; an invisible entry and its subtree push nothing but
   keep step 2 (three updates invisible subtrees too). Then layers, and the same per-kind code as
   `_projectObject`, including dependency recording for the render-list cache (`_rec`). An object whose world
   matrix was just written gets its slab sphere, frustum test and depth inline (same arithmetic as `_cullTest`,
   which keeps serving objects that did not move, with its `frustum.version` result cache), and its normal
   matrix is computed while the record is hot (the batcher and the per-object path find it current).
4. Afterwards `epochs.world` moves by the number of counted recomputes, `graph.changed` records whether anything
   moved, and deferred skeleton updates run (a `SkinnedMesh` is usually visited before its bones).

**Two modes per `render()`.** The render-list cache needs the epochs *after* the update to decide reuse, but a
merged loop only knows at the end whether anything moved. So: if the list cannot be reused anyway (no signature
yet, epochs moved since it was built, `reuseRenderLists` off, or the previous pass of this list recomputed a world
matrix, i.e. the scene is animating: `cache.flatChanged`) the pass runs **merged** (update + project, no dependency
recording) and the cache signature is taken afterwards. Otherwise an **update-only** loop runs first, then
`_prepareList` reuses the list at level 0 / 1 or builds it with a project-only pass (with recording, as before). A
transition animated → static costs one extra build frame; static → animated costs one frame with two loops.

**Camera first.** The frustum needs the camera's final world matrix before the loop: a parentless camera updates
itself as before; a camera inside the scene is updated with its ancestor chain (`camera.updateWorldMatrix(true,
false)`), and the pass then finds that chain up to date (version compares) while the ancestors' other children
still recompute.

## Invalidation rules

| event | effect on the graph |
|---|---|
| `parent.add(child)` (and `attach`) | `onAdd`: the child's subtree is filled in pre-order at `end[parent]`, later entries shift up (`copyWithin` on the typed arrays, `_flatIndex` fixed on the shifted objects), `end` of every ancestor grows. Appending to the scene root is an append with no shifting. |
| `parent.remove(child)` | `onRemove`: the subtree range `[i, end[i])` is spliced out, later entries shift down. Removed objects keep a stale index that `indexOf` rejects (`objects[idx] !== object`). |
| parent not in this graph (or stale), child index inconsistent, more than 16 patches since the last frame | graph marked invalid → `rebuild()` on the next render |
| `children.length` differs from `childCount[i]` during the pass (direct `children.push` / `splice` / `length = 0` / replaced array) | rebuild and rerun |
| direct `children` edits that keep the length (in-place `sort`) | **not detected** (documented limitation; three's own list reuse already does not see direct edits) |
| `updateMatrixWorld` assigned on an *instance* after the graph was built | not detected until the next rebuild (class overrides are detected at build / patch time) |
| nested scenes (`outer.add(inner)`, both rendered) | each root keeps its own graph; `notifyAdd` / `notifyRemove` walk up the ancestors and patch every graph on the way; objects remember the index of the graph that filled them last, the other graph falls back to a rebuild when it needs to locate them |
| two renderers, one scene | one graph; the second renderer's pass finds nothing to update and projects for its own camera |

The structure epoch is still bumped by `add` / `remove` / `attach` as before (render-list cache); the graph
itself does not need it.

## Semantics tests

`test/flat-scene-update.test.js` (node, no GL: `_flatPass` is called on a fake renderer that records pushes,
lights and hooks and passes every cull test) builds the same hierarchy twice (meshes, groups, a light, a camera on a
rig, a sprite, an invisible subtree) and compares the recursive reference with the flat pass:

1. graph is `traverse` order, parent before child, subtree ends / child counts / indices correct;
2. world matrices and `_worldVersion`s identical over 6 frames of hierarchy animation, including the camera's inverse;
3. items in `traverseVisible` order, lights collected, invisible subtree matrices still updated, invisible scene;
4. layers on objects and camera (a group on another layer still projects its children);
5. `matrixAutoUpdate = false` (user-written `matrix`, position ignored, flag picks the new matrix up);
6. `matrixWorldAutoUpdate = false` (user-written `matrixWorld`; children follow only when flagged or the parent moves);
7. `updateMatrixWorld(force)` / `updateWorldMatrix(parents, children)` / app-side `scene.updateMatrixWorld()` between frames;
8. `add` / `remove` / `attach` / reparent patch the array (no rebuild), direct `children.push` triggers a rebuild, moving an object to another scene keeps both graphs consistent;
9. objects reparented or removed "during onBeforeRender" are seen next frame with correct matrices;
10. a subclass overriding `updateMatrixWorld` is called recursively for its subtree (`K_CUSTOM` / `K_INSUB`), cameras use the post hook;
11. scene with `matrixWorldAutoUpdate = false`: not updated, still projected;
12. nested scenes rendered alternately and the same scene seen by two passes;
13. `epochs.world` moves exactly when a non-camera world matrix was recomputed.

`bench/flat-check.mjs` (headless Chromium, pixels): twin worlds with 6 chains of nested meshes, loose and
transparent meshes, hooked meshes (hook order logged), a camera on a moving rig that is rendered from, a
directional light whose target follows it in traversal order, a skinned mesh whose bones are its children, a
sprite, a frozen-local-matrix mesh, a user-owned world matrix with a child, a custom `updateMatrixWorld` subclass
with a mesh inside, a nested scene also rendered on its own, with and without shadows. 50 steps: animation,
rig camera, orbit, light / target moves, hidden subtree moved / shown / hidden, chain middle hidden, frozen
matrix rewritten, owned world matrix rewritten with and without the flag, user matrix updates between frames,
layers, `frustumCulled` off, `renderOrder`, add / remove / `attach` / reparent, hooks that reparent and remove
during the draw, 24 adds (rebuild path), direct `children` push / splice, `scene.matrixWorldAutoUpdate` off / on,
scene invisible, nested scene alternated and mutated, sprite move, `reuseRenderLists` off / on. Plus seven bench
scenarios (1 500 objects) flat vs recursive. **328 frame pairs, all byte-identical, hook order identical, 0 verify
mismatches** (both renderers at 0; `node bench/flat-check.mjs main=recursive` runs the recursive walk on both sides). The run shows 70 merged / 50 split passes, 6 rebuilds and 42 patches per world.

## Results

All numbers: headless Chromium / SwiftShader on this (noisy) box; "paired" = `renderer.flatSceneUpdate` off vs on in
the same harness, median frame over 60 frames after 30 warm-up, best of three fresh pages each (timer resolution
0.1 ms). "frame" includes the scenario's own `update()` (shared-animated: 10k Euler → quaternion conversions, ~0.7 ms,
the same work three.js does).

| scenario | recursive walks: render / frame | flat pass: render / frame | frame delta |
|---|---:|---:|---:|
| shared-animated (10k, every object rotating) | 3.4 / 4.3 ms | 3.0 / 3.8 ms | **-12 %** (render -12 %) |
| hierarchy-animated (200 chains × 40, roots rotating) | 3.6 / 3.7 ms | 2.9 / 3.0 ms | **-19 %** (render -19 %) |
| shared-static (10k) | 0.8 / 0.8 ms | 0.5 / 0.5 ms | **-37 %** |

`node bench/run.mjs shared-animated hierarchy-animated shared-static --frames=60`, medians, best of two runs
(bench harness; three.js in the same runs 12.8-14.8 ms for the 10k scenes):

| scenario | before (run 1 / 2) | after, pre-merge (run 1 / 2) | after, on the integration tip |
|---|---:|---:|---:|
| shared-animated | 4.2 / 4.9 | 4.0 / 4.2 | 4.0 |
| hierarchy-animated | 4.2 / 3.8 | 3.1 / 3.5 | 3.3 |
| shared-static | 0.9 / 0.9 | 0.6 / 0.6 | 0.6 |

The 30 % target is met for the static scene and missed for the animated ones (-12 % / -19 % paired). Phase profile
(`node bench/profile.mjs`, means over 30 frames, so a single upload stall inflates `drawList`):

| scenario | before: `scene.updateMatrixWorld` + `_projectObject` | after: `flatPass` (now also computes the normal matrices the batcher used to) | `drawList` before → after | total before → after |
|---|---:|---:|---:|---:|
| shared-animated | 1.30 + 1.25 = 2.55 ms | 2.0 ms | 1.45 → 1.3 ms (1.9 in the post-merge run: one texImage2D stall) | 5.0 → 4.2 ms (4.9 with the stall) |
| hierarchy-animated | 1.13 + 1.44 = 2.57 ms | 2.2 ms | ~1.2 → 1.0 ms | 5.9 (stall) → 3.5 ms |
| shared-static | 0.75 ms | 0.51 ms (update-only loop, list reused) | 0.03 → 0.04 ms | 0.84 → 0.66 ms |

Why the animated gain is smaller than hoped: with the two walks gone the loop still touches, per object, the
`Object3D`, its `position` / `quaternion` / `scale` objects, the slab record, the snapshot and the render item, and
reads ~25 polymorphic properties (`matrixAutoUpdate`, `matrixWorldNeedsUpdate`, `_worldVersion`, `geometry`,
`material`, `frustumCulled`, ...); the update-only loop over 10k *unchanged* objects already costs 0.5 ms (50
ns/object), i.e. the floor is loads and cache misses, not arithmetic or calls. Variants tried and dropped:
keeping slab page / offsets per entry in typed arrays instead of reading them off the object (within noise,
slightly slower), skipping the per-entry `children.length` check (≤ 0.1 ms). The CPU profile of the animated
frame now splits as flat pass ~2.0, draw-list build + matrix-texture fill 0.9, texture upload 0.35-0.4, sort
0.1, program resolve 0.05, app update 0.7 (shared-animated).

Allocation (`node bench/alloc.mjs`, sampled bytes per frame): shared-static 7.3 KB → 12.5 KB, shared-animated 9.1 →
13.2 KB, hierarchy-animated 9.5 → 12.7 KB. The whole difference is one site, `Matrix4.multiplyMatrices` (~3.4 KB /
frame): it was called 10 000 times per frame by the recursive walk and therefore JIT-optimised; now it runs a handful
of times per frame (camera / projection matrices) and stays in the interpreter, where `Float32Array` reads box
doubles. Nothing in the pass allocates (no site in `_flatPass` / `FlatGraph` appears; an earlier 92 KB reading for
shared-static was a one-off of the sampling profiler, two later runs gave 12.5 and 12.1 KB).

Validation on the merged branch (integration tip ecf0290 merged in; the only conflict was `bench/results/latest.json`,
taken from the integration branch): `npm test` 152 / 152; `node bench/conformance.mjs` 34 PASS, 0 FAIL;
`node bench/addons.mjs` clean; `node bench/smoke.mjs` glError 0; `node bench/run.mjs --compare --frames=60`:
meanAbsDiff / maxDiff equal to the integration tip's `latest.json` for all 17 scenarios (shared-animated 0 / 1,
skinned-crowd 0 / 2, shadows-point-multi 0 / 1, all others 0 / 0), no median regressed beyond noise
(shader-client 3.1-4.2 vs 3.2-4.5 three-side swings, shader-client-static 23.7-35 both libraries, dynamic-geometry
1.1-2.0 ms on a 200-object scene whose three.js median swings the same way); `node bench/reuse-check.mjs` 602 frame
pairs identical, 0 verify mismatches; `node bench/flat-check.mjs` 328 frame pairs identical, hook order identical;
`node bench/fuzz.mjs --seeds=50 --continue`: seeds 8 23 27 28 35 fail **identically on the integration tip** (same
worst meanAbsDiff 0.061 / maxDiff 167), i.e. pre-existing parity gaps unrelated to this branch.

The one `verifyListReuse` mismatch `flat-check.mjs` reported earlier (shadows run, step "hook removes itself") was
traced with a per-frame trace of reuse decisions: the first renderer reused its list at level 0 with equal epochs,
then the *shadow pass* ran the `onBeforeRender` hook (`_renderItem` calls it in the shadow pass too) which removed
the object and moved the structure epoch, and only then did the verify build its fresh list, 3 items short. The
second renderer never hit it because by its turn the global epoch had moved and it rebuilt. The reused list was
the correct one (a rebuild that frame is also built before the hooks run); the verification ran at the wrong
point of the frame. Fix: level-0 verification now runs right after `_prepareList`. Both renderers report 0.

Second merge (integration tip d48164c: drawlist-build, vao-order-base-instance, point-light-shadows, parity fixes;
no conflicts): VALIDATION2_PLACEHOLDER

## Risks / notes for the integrator

* **Behaviour fix in `Object3D.updateMatrixWorld`** (parent version noted for `matrixWorldAutoUpdate = false`
  objects): fewer recomputes, same matrices, and such scenes can now reuse render lists. Any code that relied on
  the children of a user-owned world matrix being recomputed every frame *without* setting
  `matrixWorldNeedsUpdate` (three.js does not recompute them either) sees three's behaviour now.
* `_flatUMW` / `_flatPostUpdate` on `Object3D.prototype` and the two subclasses; `_flat`, `_flatIndex`,
  `_flatGraph` own fields on every `Object3D` (three pointers per object).
* Direct `children` edits that keep the length (in-place sort) and instance-level `updateMatrixWorld`
  assignments after the first render are not seen until the next rebuild (any `add` / `remove` elsewhere, or
  `scene._flatGraph.valid = false`).
* The pass reads `_visible`, `_frustumCulled` and `layers.mask` directly (same values the accessors return).
* The merged / split decision is per render list (per scene, call depth, camera). A scene whose only moving
  object is a group around the camera stays in merged mode (the group counts), so it rebuilds its list every
  frame where the camera-only reuse (level 1) would have sufficed; correct, just not reused.
* `bench/profile.mjs` numbers from before this branch were wrong for recursive phases (double counting) and
  for the whole table after the no-batch pass; the fixed script reports e.g. shared-static `scene.updateMatrixWorld`
  0.75 ms, not 43 ms.
* Pre-existing, found by `flat-check.mjs` and unchanged here: with two renderers drawing one scene that contains a
  skinned mesh, the second renderer shows a stale pose after animation (the skeleton's "no bone moved" check is
  per skeleton, not per renderer). Reproduces with `flatSceneUpdate = false`.
* Bundles in `build/` were not rebuilt (run `npm run build` at integration).

## Follow-up ideas

* **Precomputed per-item batch flags** (scout #3): `_drawList` + `addTex` are now ~0.9 ms of the 3.0 ms animated
  render; the item scan re-tests `_isBatchable` / `_isMultiDrawable` per item and copies 28 floats per object into
  the matrix texture.
* **Upload the slab instead of copying into the matrix texture**: make the matrix texture the slab pages
  themselves (12 texels per record, world + normal matrix already adjacent) and give instances a slab-record index;
  the per-frame fill (28 floats × 10k) and the hash disappear, uploads become per-page dirty ranges set by the pass.
* **Dirty-range matrix-texture upload** (scout #16): the pass knows the first / last entry whose world matrix changed.
* **Per-entry flags in typed arrays synced by the setters** (`visible`, `frustumCulled`, `layers.mask`,
  `renderOrder` are accessors already): would remove 4 polymorphic loads per object from the projection half; the
  update half would need `matrixAutoUpdate` / `matrixWorldAutoUpdate` / `matrixWorldNeedsUpdate` as accessors too.
* **TRS in the slab**: the real floor of the update loop is the four heap objects per `Object3D`; storing
  `position` / `quaternion` / `scale` components in the snapshot page (Vector3 views over it) would make the
  change detection a contiguous compare, but changes `Vector3` storage for every object.
* **Flatten the shadow pass** (`WebGLShadowMap._collect` / `_sigWalk` still recurse) over the same graph.
* **Camera-only reuse under merged mode**: a scene whose only moving object is a group around the camera rebuilds
  its list every frame; track "non-camera recompute" separately so level-1 reuse still applies.
* `Matrix4.multiplyMatrices` boxing in the interpreter (3 KB / frame): a camera-specific unrolled path, or simply
  accept it.
* Pre-existing, found by `flat-check.mjs` and left alone: with two renderers drawing one scene that contains a
  skinned mesh, the second renderer shows a stale pose after animation (the skeleton's "no bone moved" check is per
  skeleton, not per renderer). Also `onBeforeRender` runs in the shadow pass (three.js calls `onBeforeShadow` there).
