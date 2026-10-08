# Render-list reuse across frames (`swarm/render-list-reuse`)

## What changed

| file | change |
|------|--------|
| `src/core/epochs.js` (new) | Global `structure` / `world` change counters and `trackRenderProperty()` (accessor that bumps `structure` when a value changes). |
| `src/core/Object3D.js` | `visible`, `renderOrder`, `frustumCulled`, `receiveShadow` are tracked accessors; `add` / `remove` / `attach` bump `structure`; every `_worldVersion++` bumps `world` (except cameras, `_countsWorld = false`, so a moving camera is not a moving scene); `onBeforeRender` / `onAfterRender` are prototype accessors whose first assignment bumps `structure` (then become ordinary own properties; subclass methods shadow them as before). |
| `src/core/Layers.js` | `mask` is an accessor that bumps `structure`. |
| `src/objects/{Mesh,Line,Points,Sprite}.js` | `geometry` / `material` tracked. |
| `src/cameras/Camera.js` | `_countsWorld = false`. |
| `src/renderers/webgl/WebGLRenderListCache.js` (new) | `RenderListCache`: build signature (epochs, sortObjects, overrideMaterial, camera view / view-projection / layers), recorded dependencies (geometries, materials, instanced meshes, (material, variant, program) pairs, lights, cull candidates with their cull result and item index), `CommandCache` for draw commands. |
| `src/renderers/webgl/WebGLRenderLists.js` | One list per (scene, call depth, **camera**) (max 8 cameras per slot) so alternating cameras each keep their cache; `finish()` split into opaque / transparent halves with `opaqueVersion` / `transparentVersion`; `resortTransparent()`; **bug fix**: transparent depth key clamped to `[0, 2^26)`. |
| `src/renderers/WebGLRenderer.js` | `_prepareList` / `_reuseLevel` / `_recull` / `_programsUnchanged` / `_replayFrameState` / `_buildList` / `_verifyReuse`; `_projectObject` records dependencies when `_rec` is set (and uses the shared `_itemDepth`); `_drawList` split into build / `_saveCommands` / `_replayCommands` / `_executeCommands`; `renderer.reuseRenderLists`, `renderer.debug.verifyListReuse`, `renderer.debug.listReuse` counters. |
| `bench/reuse-check.mjs` (new) | Twin-scene pixel-equality + verify-mode script (see below). |
| `ARCHITECTURE.md` | New §3b. |

How a frame decides (per list): `cache.ready` (dependencies were recorded on the previous build) and structure/world epochs, `sortObjects`, `overrideMaterial`, camera layers / coordinate system unchanged, then dependency snapshot valid:
* camera matrices identical -> **level 0**: keep everything;
* camera moved -> **level 1**: re-test the cull of every candidate (flat array, no tree walk); if none flips, keep the opaque keys, refresh `item.z` and rebuild only the transparent keys (identical to what a full rebuild produces);
* otherwise (or if any program changed) -> normal rebuild. A rebuild that follows an unchanged frame also records dependencies, so animated scenes (every frame different) never record and pay only for the signature copy.

Level 0 / 1 replay the frame state a rebuild leaves behind (lights `begin/push/end`, render-order rank map, dense material / geometry / program ids and counters) so the shadow pass and later code see exactly the same state.

Draw commands (the output of `_drawList`'s run detection) are cached per list and replayed when the sorted keys are the same version, the batching settings are unchanged, every mega-buffer record is the same (`megaBuffers.ensure()` is still called, so changed vertex data is still uploaded) **and the matrix texture still holds this list's matrices** (batcher hash). Replay skips command building and the per-object matrix fill.

## Results (headless Chromium / SwiftShader, `node bench/run.mjs --compare --frames=60`, jrs median ms, best of two runs each; this machine is noisy: three's own numbers vary 8-26 ms between runs)

| scenario | before (run 1 / 2) | after (run 1 / 2) | best before -> after |
|----------|-------------------:|------------------:|---------------------:|
| shared-static (10k) | 3.6 / 5.6 | 1.4 / 1.8 | **3.6 -> 1.4** |
| many-materials (5k) | 6.0 / 3.9 | 1.7 / 1.7 | **3.9 -> 1.7** |
| unique-geometries (2k) | 1.3 / 1.1 | 1.0 / 1.0 | **1.1 -> 1.0** |
| shader-client-static | 29.3 / 33.8 | 25.2 / 24.4 | 29.3 -> 24.4 (see below: not caused by this change) |
| shared-animated | 7.5 / 5.5 | 5.6 / 5.1 | 5.5 -> 5.1 (noise) |
| hierarchy-animated | 4.5 / 5.8 | 4.5 / 5.1 | 4.5 -> 4.5 |
| shader-client | 3.2 / 2.8 | 3.0 / 2.8 | 2.8 -> 2.8 |
| shadows | 1.5 / 1.4 | 1.4 / 0.9 | 1.4 -> 0.9 |
| instanced-100k | 0 / 0 | 0 / 0 | - |

No scenario regressed (animated ones, which never reuse, are within noise: the accessors and signature copy cost is not measurable).

Phase profile (one run, ms/frame, instrumented): shared-static project 1.24 + resolvePrograms 0.21 + finish 0.16 + drawList 2.44 -> all ~0 + drawList 0.02; the remaining 1.2 ms is `scene.updateMatrixWorld()`. many-materials: 0.69 + 0.12 + 0.57 + 3.06 -> drawList 0.49 (the 600 real GL draws).

**shader-client-static did not improve because of this change**: its frame is 27-33 ms in `_drawList`'s *execution* (217 draws with stencil / render-target passes rasterised by SwiftShader); list building, sorting and command building together are ~0.5 ms there. The 29 -> 24 ms difference is run-to-run noise (base runs were 29.3 and 33.8). Reuse can only remove the ~0.5 ms.

Pixel comparison vs three.js (`--compare`): identical to `bench/results/latest.json` for every scenario (shared-static 0.347 / 8, shared-animated 0.346 / 9, shadows 0.134 / 33, all others 0 / 0). `bench/results/latest.json` was not committed (run output only).

GL calls per frame: unchanged in every scenario (`total`, draw, bindTexture, bindBuffer, bufferData identical to latest.json, e.g. shared-static 8, many-materials 2006, shader-client 3324). Reuse only removes CPU work; it issues exactly the same GL stream.

Validation run: `npm test` (100 pass), `node bench/conformance.mjs` (all PASS), `node bench/addons.mjs`, `node bench/smoke.mjs` (glError 0), `node bench/run.mjs --compare --frames=60` twice.

## Edge cases tested (`node bench/reuse-check.mjs`, 528 frame pairs, reuse renderer vs reuse-disabled renderer, byte-identical pixels, plus verify mode rebuilding every reused list)

Run twice: plain and with a shadow-casting directional light. Steps: static, 8 small camera orbits (level 1 with transparent re-sort), camera far / near (cull flips), fov change, alternating cameras (perspective A / B / orthographic) every frame, add / remove mesh, `visible` on mesh and parent group, moving an opaque / transparent object, material colour change, material swap, `transparent` / `visible` / `wireframe` toggles, `needsUpdate`, geometry swap, bounding-sphere change, geometry moved off screen and back, `renderOrder` (shadow on: rank map), `frustumCulled = false`, object and camera layers, `scene.overrideMaterial` on / off, `sortObjects` off / on, assigning `onBeforeRender`, light intensity / move / add / remove, `castShadow` toggle, InstancedMesh colour / matrix change, vertex-data update (`needsUpdate`, mega-buffer upload on replay), material arrays (never reused), Sprite incl. orbit and material invisible, `autoBatch` / `autoBatchMinimum` / `autoMultiDraw` toggles, an `onBeforeRender` hook that adds / removes an object mid-frame, interleaved render-target renders of the same scene and camera. It also renders the bench scenarios (1500 objects) with verify on. All identical; `listReuse` counters show reuse actually happened (e.g. plain: 54 level-0 reuses, 9 camera-only, 93 command replays).

## Risks / notes for the integrator

* **Global epochs, not per scene**: any `visible` / `add` / ... anywhere invalidates every scene's cache. Correct but conservative; an app that toggles something unrelated every frame gets no reuse (and pays ~nothing).
* **Property changes that do not go through an accessor are not seen**: in-place edits of material arrays (`mesh.material[i] = m`; such meshes are never reused), `geometry.groups` / `drawRange` edits, `morphTargetInfluences` assigned after the first frame (morph targets are unsupported anyway), `object.children.push(...)` bypassing `add`, manual edits of `matrixWorld.elements` with `matrixWorldAutoUpdate = false` (already not noticed by the batcher hash). `LOD` objects mark the list non-reusable.
* **Object3D property accessors** replace plain fields (`visible`, `renderOrder`, `frustumCulled`, `receiveShadow`, `layers.mask`, mesh `geometry` / `material`, `onBeforeRender`): enumerable on the prototype, no longer own data properties (e.g. `Object.keys(mesh)` no longer lists them, `_visible` etc. appear instead). `Object3D.prototype.onBeforeRender` is now an accessor returning the shared no-op.
* Dense per-frame ids and counters are replayed so the shadow pass is bit-for-bit what a rebuild would see.
* Draw-command replay needs the batcher texture to hold the same list's matrices. A frame that draws both an opaque and a transparent batched list (or a shadow pass) ping-pongs the single matrix texture, so those frames still rebuild commands (they keep the list reuse). 
* Pre-existing bug fixed (separate from reuse): the transparent depth key could come out negative (float32 `transparentDepth` vs double min / max), giving `items[negative]` -> `TypeError` in `_drawList`. Reproduces on the previous code with a camera orbit over transparent boxes. The clamp changes no valid key.
* Pre-existing quirk left alone: `list.finish()` runs after the shadow pass, whose `_renderOrderReset()` replaced the render-order rank map, so with shadows and several distinct `renderOrder` values the main list is ranked with the casters' map. Reuse reproduces whatever the rebuild did.
* Bundles in `build/` were not rebuilt (run `npm run build` at integration).

## Follow-up ideas

* `scene.updateMatrixWorld()` is now ~85 % of a static frame (1.2 of 1.4 ms for 10k objects): a global "nothing dirty" fast path (e.g. skip the traversal when no `position` / `quaternion` / `scale` / `matrixWorldNeedsUpdate` setter ran, via a dirty epoch) would remove it.
* Give opaque and transparent batched lists separate regions of the matrix texture (or one texture per pass) so draw-command replay also works when both exist, and in shadow scenes.
* Per-scene epochs (walk `parent` in the setters) so unrelated scenes do not invalidate each other.
* Partial invalidation for animated scenes: track which objects' world versions changed and patch only their sort keys / matrix-texture rows instead of a full rebuild (shared-animated / hierarchy-animated).
* Reuse the shadow-pass lists (per light) with the same dependency scheme.
