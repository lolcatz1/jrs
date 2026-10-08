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
mismatches attributable to the flat pass** (one verify mismatch in the shadows run at "hook removes itself" is
reported by the recursive reference renderer too, i.e. a pre-existing list-reuse issue; the check classifies it as
such). The run shows 70 merged / 50 split passes, 6 rebuilds and 42 patches per world.

## Results

RESULTS_PLACEHOLDER

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
  per skeleton, not per renderer), and a `verifyListReuse` mismatch occurs in the shadows run when an
  `onBeforeRender` hook removes its own object. Both reproduce with `flatSceneUpdate = false`.
* Bundles in `build/` were not rebuilt (run `npm run build` at integration).

## Follow-up ideas

FOLLOWUP_PLACEHOLDER
