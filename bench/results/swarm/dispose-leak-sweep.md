# dispose-leak-sweep: resource lifetime and leaks

Harness: `node bench/leaks.mjs [--cycles=20]` (page module `bench/leaks-case.js`, `bench/leaks.html`). Each cycle builds a varied scene (unique and shared
geometries/materials/textures, instanced mesh with colours, skinned mesh, morph targets, ShaderMaterial, points/line/sprite, directional + spot + point
shadows, colour+depth render target, cube render target, second camera), renders it, disposes it the three.js way (geometry/material/texture/render
target/skeleton/light/InstancedMesh dispose, `scene.remove`), then renders an empty scene for 32 frames (grace period of the page reclaim below) and
measures after `gc()`. GL object counts come from wrapping `create*/delete*` on `WebGL2RenderingContext.prototype`. Pass/fail: no jrs counter above its
cycle-5 value at the end (JS heap: slack 1 MB), context restore pixel-identical, `renderer.dispose()` leaves 0 live GL objects.

## Per-cycle tables (20 cycles)

### jrs BEFORE (integration tip 9c8bf94 minus this branch)
| cycle | geometries | textures | programs | buffer | texture | vertexarray | program | framebuffer | heapKB | megaPages | batcherTexRows | matSlots | batchGroups | programCache | envKeys |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 4643 | 0 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1 | 1 | 0 | 12 | 2 | 2 | 0 | 0 | 5936 | 1 | 1 | 0 | 10 | 0 | 2 |
| 2 | 1 | 1 | 0 | 14 | 2 | 2 | 0 | 0 | 6078 | 1 | 1 | 0 | 18 | 0 | 2 |
| 5 | 1 | 1 | 0 | 20 | 2 | 2 | 0 | 0 | 6282 | 1 | 1 | 0 | 42 | 0 | 2 |
| 10 | 1 | 1 | 0 | 30 | 2 | 2 | 0 | 0 | 6457 | 1 | 1 | 0 | 82 | 0 | 2 |
| 15 | 1 | 1 | 0 | 40 | 2 | 2 | 0 | 0 | 6531 | 1 | 1 | 0 | 122 | 0 | 2 |

Leaks: GL buffers +2 per cycle, batch groups +8 per cycle (and the one mega-buffer page, ~16 MB of GPU memory, was never given back).

### jrs AFTER (after merging the integration tip incl. per-list matrix texture slots)
| cycle | geometries | textures | programs | buffer | texture | vertexarray | program | framebuffer | heapKB | megaPages | batcherTexRows | matSlots | batchGroups | programCache | envKeys |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| base | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 4998 | 0 | 0 | 0 | 0 | 0 | 1 |
| 1 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 6503 | 0 | 0 | 0 | 0 | 0 | 2 |
| 2 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 6647 | 0 | 0 | 0 | 0 | 0 | 2 |
| 5 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 6896 | 0 | 0 | 0 | 0 | 0 | 2 |
| 10 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 7072 | 0 | 0 | 0 | 0 | 0 | 2 |
| 15 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 7136 | 0 | 0 | 0 | 0 | 0 | 2 |
| 20 | 1 | 1 | 0 | 6 | 1 | 1 | 0 | 0 | 7222 | 0 | 0 | 0 | 0 | 0 | 2 |

### three.js r186 (reference)
| cycle | geometries | textures | programs | buffer | texture | vertexarray | program | framebuffer | heapKB |
|---|---|---|---|---|---|---|---|---|---|
| base | 0 | 0 | 0 | 0 | 4 | 0 | 0 | 3 | 6219 |
| 1 | 1 | 1 | 8 | 2 | 6 | 0 | 8 | 3 | 7670 |
| 2 | 1 | 1 | 8 | 2 | 7 | 0 | 8 | 3 | 7788 |
| 5 | 1 | 1 | 8 | 2 | 10 | 0 | 8 | 3 | 7937 |
| 10 | 1 | 1 | 8 | 2 | 15 | 0 | 8 | 3 | 8116 |
| 15 | 1 | 1 | 8 | 2 | 20 | 0 | 8 | 3 | 8159 |
| 20 | 1 | 1 | 8 | 2 | 25 | 0 | 8 | 3 | 8213 |
three.js itself keeps 8 linked programs (shadow depth/distance variants), grows by one GL texture per cycle (a depth texture it does not delete) and
holds the sprite geometry/index; those are three.js behaviours, not goals. jrs is at or below three on every column. JS heap creeps by a few hundred
KB over 20 cycles in both libraries (JIT/IC warm-up, same slope); no per-cycle growth.

## Leaks found and fixed
1. **InstancedMesh GPU buffers** (`WebGLBindingStates`): `instanceMatrix` / `instanceColor` buffers and the instanced VAO were never deleted; three.js
   removes them on the mesh's `dispose` event. Now hooked (`_onInstancedMeshDispose`), VAO and `instancedFor` released too.
2. **`_batchGroups` Map grew forever** (`WebGLRenderer`): one entry per distinct (state, textures, slot-page) signature, never removed. Now reference
   counted by materials (`_setBatchGroup` / `_releaseGroup`), released on `material.dispose()`.
3. **Per-render-list matrix textures** (added by another worker's `MatrixTextureSlot`, found when merging): a slot's GL texture was never deleted. Now a
   finalizer deletes it with the slot and `renderer.dispose()` drains the live ones (`WebGLBatcher.live`).
4. **Material-buffer slots / batch groups of materials collected without `dispose()`**: a `FinalizationRegistry` returns them (epoch-guarded so a
   restored context ignores stale callbacks). Verified by `runNoDispose` (matSlots, batchGroups, programCache constant after GC).
5. **Empty mega-buffer pages** never freed: `WebGLMegaBuffers.sweep()` (once per outermost `render`) deletes a page empty for 30 renders (reused if a new
   level allocates within the grace period).
6. **`renderer.dispose()` released only programs/UBOs/matrix texture/pages.** Now also deletes every attribute buffer, VAO, texture, framebuffer,
   renderbuffer and placeholder texture, tracked weakly (`LiveSet`, so undisposed-and-collected objects are still collected by the GC). `info.memory`
   resets. Like three.js the renderer stays usable: the next `render()` re-creates its GL objects (`_ensureGL`).
7. **Context restore was incomplete**: only programs/material props were reset; UBOs, mega pages, matrix texture, attribute buffers, VAOs, textures,
   render targets and shadow maps all pointed at dead objects. `_onContextRestore` now releases references (delete calls suppressed to avoid
   "object does not belong to this context" warnings) and rebuilds via `_initGLContext()` (the constructor's GL part, extracted); `shadowMap.enabled/type`,
   `info` and user-visible state survive.

## Context loss / dispose results (`node bench/leaks.mjs`)
| check | jrs | three |
|---|---|---|
| render while lost | no throw | no throw |
| pixels after loss+restore vs before (maxDiff / differing px) | 0 / 0 | 0 / 0 |
| second loss with a scene edit in between, edit reverted | 0 / 0 | 0 / 0 |
| live GL objects after `renderer.dispose()` with assets still alive | 0 (of 100) | 194 (of 311); three.js does not delete buffers/textures here |
| render after `dispose()` vs before | maxDiff 0 | maxDiff 0 |

## Validation
`npm test` 168/168; `bench/smoke.mjs`, `conformance.mjs` (0 FAIL), `addons.mjs` clean; `leaks.mjs` flat after 20 cycles.
`bench/run.mjs --compare --frames=60`: meanAbsDiff/maxDiff identical to the integration tip for every scenario (max 2 on skinned-crowd, as before).
Two A/B runs per tree, medians within run-to-run noise (best-of equal; shader-client-static and shared-animated each had one noisy outlier on either side).
`fuzz.mjs --seeds=30 --continue`: failing seeds are 8 12 27, **identical on the unmodified integration tip**. Seed 12 is outside the allowed set (8, 23, 27, 28) but
fails without this branch too (introduced by a recent merge).

## Risks
- Context restore is now a full re-init; code that held `renderer.state/textures/capabilities/extensions` across a restore sees new objects (three.js does the same).
- Empty-page reclaim: a scene torn down and rebuilt more than 30 renders later re-allocates a 262k-vertex page (one bufferData of ~16 MB).
- Dead 'dispose' listeners of the old generation stay on scene objects after a restore (tiny; they self-remove when the object is disposed).
- `_releaseGL(true)` temporarily shadows `gl.delete*` with own no-ops on the context object.

## Follow-ups
- Batcher CPU arrays (`texData`) only grow; shrink after a long quiet period.
- `CubeCamera` is not exported by jrs (harness renders cube faces manually).
- `samples:` (MSAA render targets) is accepted but ignored by jrs.
- Seeds 2/12/14 regression on the integration branch needs an owner.
