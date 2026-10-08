# per-draw-overhead: VAO validation, program resolution, per-pass lights upload

Branch `swarm/per-draw-overhead`. Container: 4 cores, headless Chromium/SwiftShader. Scout items 11, 7 and (the safe part of) 19.

## Merge note

While this branch was in flight the integration branch gained its own skip of identical lights/frame-block uploads and an allocation-free `_updateEnv` (interned env key ids). On merging I kept theirs and dropped my duplicate (c) code, so after the merge this branch contains only items 11 and 7 plus the bench tooling. The (c) rows and the "before/after" numbers below were measured on my pre-merge tree (before = `9074c4e`); post-merge cpu-stubbed on the merged tree: shader-client 0.936 / 0.860, shader-client-static 0.268 / 0.284 ms.

## Changes

| item | change | where |
|---|---|---|
| 11 VAO validation | `BufferAttribute.needsUpdate = true` bumps a module-level `attributeEpoch` (new internal file `src/core/attributeEpoch.js`, not exported from `index.js`). `WebGLBindingStates.bind` stamps the epoch (and the mode, since mode 1 adds the instance attributes to the sum) when it validates a geometry, and while the epoch is unchanged it skips the 7-attribute version sum and goes straight to the cached VAO. When the epoch moved it does the old sum and re-stamps if nothing changed for this geometry. | `WebGLBindingStates.js`, `BufferAttribute.js` |
| 7 program resolution | `_getProgram` reads `material._resolveStamp/_resolveVariant/_resolveProgram` (declared in `Material`) instead of `_materialProps()` (WeakMap.get) per item. Because a material can be rendered by several renderers, the frame id is now drawn from a module-level counter (`_frameId = ++_frameCounter`) so stamps from different renderers cannot collide. | `WebGLRenderer.js`, `Material.js` |
| 19 per-pass work | (1) `_updateEnv` compares four cached fields instead of building a `tone|cs|shadow|fog` string every pass (no allocation, same env-version bumps). (2) The lights UBO image is compared (280 words, as `Int32Array`) with the last uploaded image; identical images skip `bindBuffer` + `bufferSubData`. Values reaching the GPU are unchanged; the snapshot is invalidated on context restore. | `WebGLRenderer.js` |

Not done in (19): `lights.begin/end` and `_renderOrderReset` are fed by the `_projectObject` traversal of each pass (lights are collected while walking the scene, render orders while pushing items), so they cannot be skipped without skipping the traversal itself, which is the "nothing changed" fast path (scout #15, design work). `bindShadowMaps` is already a no-op without shadow lights and otherwise goes through the texture-state cache. The frame block differs per camera, so a compare-and-skip there only pays across frames; left for scout #9.

Tooling: `bench/profile.mjs` skips wrappers whose target no longer exists (it crashed on `batcher.upload`; the wrapper timings are inflated by `performance.now()` overhead per call, so they are only useful for relative shares). New `bench/cpu-stubbed.mjs` measures pure renderer CPU with draw calls stubbed, timing chunks of 25 frames because `performance.now()` here has 0.1 ms resolution and the per-frame medians of `profile-cpu.mjs` (0.1 ms steps) cannot show sub-0.1 ms changes.

## Numbers

Pure CPU, draws stubbed (`node bench/cpu-stubbed.mjs`, median of 40 chunks x 25 frames, 3 interleaved runs each, ms/frame):

| scenario | before | after |
|---|---|---|
| shader-client | 0.876, 0.884, 0.936 | 0.832, 0.848, 0.896 |
| shader-client-static (3 passes) | 0.404, 0.316, 0.352 | 0.328, 0.308, 0.352 |

So roughly -0.04 ms (-4 to -5 %) on shader-client and within noise on shader-client-static. That is less than the scout's estimate (-0.15 to -0.25 ms for 11, -0.1 for 7): V8 had already inlined most of the old loop, and the dominant CPU in these scenes is ShaderMaterial uniform upload (scout #6), not touched here.

`node bench/run.mjs` (wall medians, GPU-dominated on SwiftShader, two runs each, ms): shader-client before 2.8 / 3.1, after 2.9 / 3.3; shader-client-static before 42.4 / 42.4, after 42.3 / 37.3. No change beyond noise (these include GPU process time).

GL calls per frame, shader-client-static: total 1625 -> 1619, `bindBuffer` 9 -> 6, `bufferSubData` 6 -> 3 (the lights block is uploaded once per frame instead of per pass); everything else identical. shader-client unchanged (1313 draws, same counts).

## Validation

`npm test` 100/100; `node bench/conformance.mjs` 0 FAIL; `node bench/addons.mjs`, `node bench/smoke.mjs` clean; `node bench/run.mjs --compare --frames=60`: meanAbsDiff/maxDiff identical to `bench/results/latest.json` for all scenarios (shared-static 0.347/8, shared-animated 0.346/9, shadows 0.134/33, rest 0/0). `bench/fuzz.mjs` does not exist on this branch.

## Risks

* VAO epoch: code that writes `attribute.version` / `version++` directly instead of `needsUpdate = true` is no longer noticed on the fast path (three.js documents `needsUpdate` as the API; jrs's own code only bumps through it). `InterleavedBuffer` is not drawn by the renderer, so it does not feed the epoch.
* Unique frame ids: any future code that assumes `_frameId` counts this renderer's frames would be wrong (nothing in `src/` does today).
* Lights skip compares raw 32-bit words, so NaN payloads compare by bits, not by value; a different NaN bit pattern just re-uploads.

## Follow-ups

* Scout #6 (ShaderMaterial uniform list per program) is the real CPU lever for shader-client (~1.3 of ~4.5 profiled ms); #10 and #9 are also still open.
* Scout #15 (skip projection when nothing changed) is what would make the multi-pass lights/render-order work skippable.
* The wall-clock medians in this harness cannot resolve these gains; use `bench/cpu-stubbed.mjs`.
