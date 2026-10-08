# `_drawList` build: flags in `_pushItem`, one `ensure` per geometry per frame, `addTex` skips unchanged objects (`swarm/drawlist-build`)

## What changed

| file | change |
|---|---|
| `src/renderers/WebGLRenderer.js` | `_pushItem` computes `ITEM_BATCHABLE` / `ITEM_MULTIDRAWABLE` once (object, effective material and group are in hand) into `list.flags`. `_isBatchable` / `_isMultiDrawable` are gone; the run loop reads `flags[itemIndex]` and each item is loaded once (`items[keys[i]]`, no `itemFromKey` calls). New `_mdRecordOf(geometry)` calls `megaBuffers.ensure` once per geometry per frame (stamp `geometry._mdFrame`, result in `geometry._mdRec`; re-resolved if the record's `layoutVersion` no longer matches the geometry) and notes the geometry in the touch map once per command build (`_buildSeq` stamp). `item.mdRecord` is written only for the run leader (what `_renderMultiDraw` reads); sub-draws read `geometry._mdRec`. The touch `Map` is reused instead of allocated per build. |
| `src/renderers/webgl/WebGLRenderLists.js` | `list.flags` (`Uint8Array`, grown with the item list); `push(..., batchGroup, flags = 0)`. |
| `src/renderers/webgl/WebGLBatcher.js` | `addTex` remembers `(object.id, _worldVersion)` per stream position (`texIds` Int32Array, `texVersions` Float64Array, grown with `texData`) and skips the 32-float fill and normal-matrix work when id, version and the material index already in texel 8 are unchanged. The hash mix and the single `texImage2D` of the used rows are untouched. |
| `src/core/BufferGeometry.js` | `_mdFrame`, `_mdRec`, `_mdTouch` fields (declared in the constructor to keep the shape stable). |
| `bench/drawlist-build.mjs` (new) | Build-only timer: `_drawList` time minus `_executeCommands` minus `uploadTexture`. (`bench/profile.mjs` wraps `_drawList` including command execution, so its `drawList` number is mostly GL.) |

Run semantics are unchanged: same conditions in the same order (material / batch group, program, renderOrder, then multi-drawable, page, indexed), same cost model, same command arrays, same `ensure` call set (just deduplicated per frame).

## Numbers (headless Chromium / SwiftShader, noisy box)

Build phase, ms/frame, merged tree before -> after (two runs each):

| scenario | `bench/drawlist-build.mjs` median (build only) | `profile-cpu` "draw-list build" phase (profiled) |
|---|---|---|
| shared-animated | 1.0 / 1.1 -> 0.8 / 0.9 | 1.46 -> 1.14 / 1.23 |
| hierarchy-animated | 0.8 / 1.0 -> 0.7 / 0.7 | 0.99 -> 0.90 / 0.95 |

`_drawList` self time in the CPU profile (run detection proper): 2.3 ms (scout report) -> 0.17-0.21 ms. But most of that time had been inlined `addTex` and is now attributed to `addTex` (0.8-1.0 ms self) and `computeNormalMatrix` (0.4 ms).

**The "phase at least halved" target was not met**: the measured phase drops by about 20-25 %. Reason: in `shared-animated` and `hierarchy-animated` every batched object moves every frame, so the `addTex` skip never fires there; the fill (32 floats) and `computeNormalMatrix` are real work for a moved object. The run-detection part did shrink about 10x, but it was already a smaller share than the scout report's inclusive number suggested (the integration tip had also moved on since the scout).

`node bench/run.mjs ... --frames=60`, jrs median ms, best of two, baseline = integration tip `6858f51` in a separate worktree, run alternately:

| scenario | before | after |
|---|---|---|
| shared-animated | 6.1 | 6.1 |
| hierarchy-animated | 5.9 | 4.6 |
| many-materials | 0.7 | 0.6 |
| shadows-point-multi | 0.3 | 0.3 |
| shader-client | 3.6 | 3.3 |

All inside run-to-run noise except hierarchy-animated (probably noise too: the baseline's own two runs were 5.9 and 9.4). No regressions.

Allocation (`node bench/alloc.mjs shared-animated hierarchy-animated`): jrs 6.6 KB and 8.8 KB per frame, nothing from this path (the `Map` per recorded build is gone; the remaining sampled sites are `_pushItem` 69 B, lights `push` 64 B).

The `addTex` skip pays off where objects are static but their command list is rebuilt anyway: a camera-only change that flips a cull result, a single object moving in a large scene, or two lists sharing the texture (shadow pass then main pass: positions differ, so the second pass recopies; same as before).

## Validation

`npm test` 139/139, `node bench/conformance.mjs` no FAIL, `node bench/addons.mjs`, `node bench/smoke.mjs` (glError 0), `node bench/reuse-check.mjs` (602 frame pairs identical, 0 verify mismatches), `node bench/run.mjs --compare --frames=60`: meanAbsDiff / maxDiff not above the committed `latest.json` for any scenario (new scenarios from the merge: shadows-point 0/0, shadows-point-animated 0/0, shadows-point-multi 0.193/41, same on the integration tip). `bench/fuzz.mjs` does not exist in this tree. Merged `origin/claude/threejs-performance-fork-vfqpcw` (6858f51) before pushing and re-ran all of the above.

## Risks

* `addTex` trusts `(id, _worldVersion)` as the identity of the world-matrix content, exactly as the upload-skip hash always did. Code that writes `matrixWorld.elements` directly without bumping `_worldVersion` used to be picked up whenever any other object in the frame changed (because the whole texture was refilled); now it is not. The same code was already invisible on a fully static frame.
* Flags are fixed at push time. `onBeforeRender` assigned, `morphTargetInfluences` added or `wireframe` toggled between the push and the build of the same render call would be seen one frame late; all of those happen outside the traversal (and a reused list is invalidated by the epochs / dependency snapshot).
* `geometry._mdRec` is per geometry per frame, shared by every list in that frame (shadow pass, main pass). A geometry whose attributes are resized between two lists of the same frame is only noticed through `layoutVersion`.

## Follow-up ideas

* The remaining cost of animated frames is the per-object slab -> texture copy (32 floats) plus `computeNormalMatrix`. Computing the normal matrix in the vertex shader (or only for non-uniformly scaled objects) would halve the bytes uploaded and remove 0.4 ms, but changes the shader (parity risk).
* `texImage2D` of the used rows is 0.7-0.8 ms/frame here, the largest piece of "build" left; only a partial upload (`texSubImage2D` on changed rows) could cut it, which the swarm rejected for the stall behaviour.
* The run scan still chases `items[...]` objects for `program`, `renderOrder`, `material`; packing them into typed arrays parallel to `flags` (program ids exist after `_resolvePrograms`) would make the scan pure typed-array reads.
