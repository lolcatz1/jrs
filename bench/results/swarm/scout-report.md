# Scout report: where jrs spends its frame, and what to build next

Branch `swarm/scout`, measured on this container (4 cores, 16 GB, headless Chromium 1194 / ANGLE
SwiftShader, node 22) at commit `9074c4e`. Nothing under `src/` was changed. Scripts added under `bench/`
reproduce every number here:

| script | what it measures |
|---|---|
| `node bench/profile-cpu.mjs <scenario\|all> --lib=jrs\|three\|both` | CDP sampling CPU profile (50 µs) of 120 frames: phase shares, top self/inclusive functions, native-GL time per call and per caller, sampling heap profile (bytes/frame per allocation site), unprofiled timing in three modes (plain, `gl.finish()` per frame, draw calls stubbed to no-ops), worst frames with heap deltas and expensive GL calls. Summaries: `profiles/<scenario>-<lib>.json`; raw `.cpuprofile` next to them (git-ignored); `--reanalyze` re-reads them. Text dump: `profile-sweep-1-reanalyzed.txt`. |
| `node bench/profile-report.mjs` | renders those JSONs as markdown (`profile-tables.md`: every scenario, both libraries, phases side by side, top functions, allocations, stalls) |
| `node bench/glcalls-diff.mjs [scenario]` | per-GL-function call counts for one whole frame, three vs jrs (`glcalls-diff.txt/.json`) |
| `node bench/warmup-series.mjs <scenario>` | frame-time series from frame 0 for both libraries (`warmup-series.txt`) |
| `node bench/stall-trace.mjs <scenario> --lib=` | Chrome trace of renderer + GPU process around 120 frames; what every process did during the slowest frames (`stall-trace-*.txt/.json`) |
| `node --expose-gc bench/micro/updateMatrix-megamorphic.mjs mixed\|meshes-only`, `bench/micro/updateMatrix-snapshot-prototype.mjs original\|snaponly\|perclass` | node-only microbenchmarks isolating finding #1 |

Two `npm run bench` runs are in `baseline-bench-1.txt` / `baseline-bench-2.txt`.

## 0. Read this first: what the harness actually measures here

1. **The GPU process is a CPU competitor, not a free accelerator.** SwiftShader rasterises in the GPU
   process on ~3 of the 4 cores (`ps`: 300 % CPU while a scene runs). The bench loop never yields, so
   when the JS thread outruns the GPU process, the command buffer fills and the *next GL call blocks*.
   That blocking is what the profiles show as "native GL time" inside `uniformMatrix4fv`,
   `texSubImage2D`, `drawElements`: it is waiting, not work. Consequences:
   * `shader-client-static` is **not a CPU benchmark on this machine**. jrs: 60 ms/frame with draws,
     **0.7 ms** with draw calls stubbed; three: 60 ms vs 1.5 ms. 99 % of the number is SwiftShader
     drawing ~250 k triangles into three targets per frame. No CPU-side change can move it here; the
     only lever is sending less raster work (which must not change pixels), or measuring it on a GPU.
     The jrs/three ratio on it (1.2x–1.5x) is noise around 1.0.
   * `shader-client` (the moving one) is half GPU-bound for jrs: plain 3.5–4.2 ms, `gl.finish()` after
     every frame 1.8 ms, draws stubbed **1.2 ms**. three: 5.5 / 4.9 / ~5–6 ms. In CPU terms jrs is already
     3–4x faster than three on it; the bench shows 1.4x because the flow-control floor hides it.
   * `shadows/three` (92 ms) and three's 5 000–10 000-draw scenes are the same story on three's side.
   * The columns to optimise against are **"draws stubbed"** (pure renderer CPU) and the profile's
     steady-state JS phases, both below. Expect any CPU win to show up at 30–60 % strength in
     `npm run bench` medians for the half-GPU-bound scenes, and not at all in `shader-client-static`.
2. **The one-to-two-second stalls are GPU-process stalls.** Every multi-hundred-ms frame in every
   run, for both libraries, is a single native GL call that did not return (12–15 s inside
   `uniformMatrix4fv` / `texSubImage2D` / `drawElementsInstanced` happened in the profiled runs). JS
   heap did not move during them (heap delta 0 KB, no GC). They cluster in the first ~20 frames after a
   pause (JIT/first-use work in the GPU process) and recur sporadically. Section 6 has the trace.
3. **Noise.** Medians move 10–20 % between runs on this box (the GPU process steals cores from the
   renderer unpredictably). Treat < 15 % as noise, not 5 %. The profiler itself (50 µs sampling) makes
   frames ~1.5–1.8x slower; phase *shares* are what to read, scaled onto the unprofiled "draws stubbed"
   time.
4. **Warm-up.** The harness warms 10 frames. Section 5 shows how long each library really takes to
   settle (V8 tiering + SwiftShader pipeline JIT).

## 1. Per-scenario profiles

Overview (medians over 120 frames; "profiled steady" excludes stall frames and the profiler's frame
markers; allocations from the sampling heap profiler at 512 B):

| scenario | lib | plain median ms | p90 | +gl.finish/frame | draws stubbed (pure CPU) | profiled steady ms | of which native GL | stall frames (ms total) | alloc bytes/frame |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| shared-static | three | 14.9 | 19.4 | 15.4 | 13.9 | 28.50 | 4.79 | 3 (14361.5) | 314,893 |
| shared-static | jrs | 4.8 | 7.7 | 4.6 | 4.2 | 8.26 | 0.08 | 1 (31.3) | **1,300,432** |
| shared-animated | three | 19.1 | 31.2 | 18.1 | 18.1 | 34.90 | 5.47 | 0 (0) | 435,391 |
| shared-animated | jrs | 7.8 | 13.4 | 11.5 | 7.9 | 14.03 | 0.47 | 4 (27738.1) | 698,188 |
| many-materials | three | 12.9 | 19.3 | 13.2 | 10.8 | 21.02 | 2.96 | 1 (10137.3) | 248,698 |
| many-materials | jrs | 6.1 | 9.1 | 4.5 | 4.2 | 8.52 | 0.47 | 2 (11670.2) | 658,394 |
| unique-geometries | three | 4.9 | 9.3 | 4.8 | 4.8 | 11.39 | 2.16 | 2 (3321.8) | 52,601 |
| unique-geometries | jrs | 1.2 | 1.9 | 1.2 | 1.1 | 2.27 | 0.07 | 2 (18.9) | 267,284 |
| hierarchy-animated | three | 24.7 | 26.5 | 24.5 | 21.9 | 40.56 | 3.06 | 2 (10959.3) | 1,074,387 |
| hierarchy-animated | jrs | 5.2 | 9.6 | 7.4 | 5.5 | 9.17 | 0.36 | 2 (11851.2) | 1,078,807 |
| instanced-100k | three | 0.1 | 0.1 | 0.1 | 0.0 | 0.28 | 0.01 | 2 (10.1) | 1,143 |
| instanced-100k | jrs | 0.0 | 0.1 | 0.1 | 0.0 | 0.35 | 0.03 | 1 (3.3) | 2,056 |
| shader-client | three | 5.5 | 8.2 | 4.9 | 6.7 | 9.51 | 1.45 | 2 (12570.9) | 131,854 |
| shader-client | jrs | 4.2 | 6.4 | 1.8 | **1.2** | 4.45 | 0.98 | 4 (12179.7) | 17,983 |
| shader-client-static | three | 59.8 | 82.5 | 58.0 | 1.5 | 113.93 | 107.42 | 3 (2728.6) | 53,895 |
| shader-client-static | jrs | 60.3 | 86.5 | 55.6 | **0.7** | 82.76 | 80.21 | 8 (5230.9) | 104,945 |
| shadows | three | 92.2 | 121.4 | 101.1 | 7.2 | 109.03 | 89.09 | 10 (9583.4) | 159,352 |
| shadows | jrs | 1.8 | 2.5 | 1.6 | 1.4 | 3.48 | 0.07 | 0 (0) | 268,050 |

Phase shares per scenario, jrs, steady state, as % of the profiled JS frame (ms/frame in brackets; the
phase names map to functions as listed in `bench/profile-cpu.mjs` `phaseOf`). "native GL" is the part
of the phase inside WebGL binding calls.

| scenario | scene graph update | project + cull | sort | program resolve | draw-list build | batch tex upload | per-draw state | uniform upload | texture bind | geometry bind | draw issue | GC | app/other |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| shared-static (8.26) | **34 %** (2.30) | **21 %** (1.42) | 2 % (0.19) | 2 % (0.18) | **34 %** (2.29) | 0 | 0 | 0 | 0 | 0 | 0 | 0.5 % | 5 % |
| shared-animated (14.03) | **26 %** (3.57) | **19 %** (2.60) | 1.5 % | 1.5 % | **20 %** (2.85) | 3 % (0.39, texSubImage2D) | 0 | 0 | 0 | 0 | 3 % (0.41 computeNormalMatrix) | 1.7 % | 24 % (3.3 = the scenario's own `rotation.y` writes: Euler → quaternion) |
| many-materials (8.52) | 17 % (1.45) | 13 % (1.13) | 8 % (0.71) | 3 % | **40 %** (3.44) | 0 | 1 % | 1 % | 0 | 2 % (0.18) | 6 % (0.50) | 2.7 % | 5 % |
| unique-geometries (2.27) | 20 % (0.45) | 14 % (0.32) | 10 % (0.23) | 2 % | **42 %** (0.94) | 0 | 0 | 0 | 0 | 0 | 2 % | 0.5 % | 9 % |
| hierarchy-animated (9.17) | **32 %** (2.96) | **25 %** (2.30) | 2 % | 2 % | **22 %** (2.04) | 3 % (0.26) | 0 | 0 | 0 | 0 | 4 % (0.35) | 3.5 % | 7 % |
| shader-client (4.45) | 3 % (0.12) | 5 % (0.24) | 4 % (0.18) | 1 % | 3 % (0.14) | – | 3 % (0.15) | **32 %** (1.44) | 4 % (0.19) | **17 %** (0.75) | **20 %** (0.91) | 0.3 % | 8 % |
| shader-client-static (82.8, of which 80.2 is GL waiting) | 0.1 | 0.4 (0.33) | 0.1 | 0.2 (0.20) | 0.1 | – | 1.7 (1.42, 1.26 waiting) | 1.2 (0.99) | 1.1 (0.94) | 4.4 (3.65, 3.24 waiting) | 90 (74.7 waiting) | 0 | 0.3 |
| shadows (3.48) | 19 % (0.65) | 13 % (0.46) | 1 % | 1 % | 20 % (0.71) | 0 | 0 | 0 | 0 | 0 | 0 | 0.6 % | 37 % shadow pass (1.28: `_drawList` + `_collect` + `_pushItem` + cull again for the light) + 8 % |

The full side-by-side tables with three.js, the top-25 self-time functions, top inclusive, native GL by
call and caller, allocation sites and the stall frames of every run are in
[`profile-tables.md`](./profile-tables.md). The top self-time functions that matter, jrs:

| function | shared-static | shared-animated | many-materials | hierarchy | unique | shadows | shader-client |
|---|---:|---:|---:|---:|---:|---:|---:|
| `_drawList` (WebGLRenderer.js:765) self | 1.91 | 2.33 | **2.70** | 1.64 | 0.41 | 1.13 | 0.14 |
| `updateMatrixWorld` (Object3D.js:295) | 1.23 | 1.22 | 0.74 | 1.29 | 0.30 | 0.43 | 0.05 |
| `updateMatrix` (Object3D.js:267) | 1.07 | 1.40 | 0.71 | 0.99 | 0.15 | 0.22 | 0.07 |
| `_projectObject` (:510) + `_cullTest` (:484) | 0.77+0.47 | 1.36+0.95 | 0.71+0.26 | 1.37+0.66 | 0.14+0.12 | 0.16+0.24 | 0.14+0.04 |
| `_update` (WebGLMegaBuffers.js:158) (+`ensure`) | 0.38 | 0.52 | 0.64 | 0.39 | 0.29+0.25 | 0.29 | – |
| `finish` (WebGLRenderLists.js:73) = key build + sort | 0.19 | 0.21 | 0.71 | 0.18 | 0.23 | 0.11 | 0.18 |
| `_resolvePrograms` (:574) | 0.18 | 0.20 | 0.19 | 0.17 | 0.04 | 0.11 | 0.04 |
| `multiplyMatrices` (Matrix4.js:133) | – | 0.94 | – | 0.68 | – | – | – |
| `computeNormalMatrix` (TransformSlab.js:79) | – | 0.38 | – | 0.33 | – | – | – |
| `setUniformValueImpl` (:1174) + `_uploadShaderMaterialUniforms` (:1045) | – | – | – | – | – | – | **0.69 + 0.61** |
| `bind` (WebGLBindingStates.js:47) + native `bindVertexArray` | – | – | 0.04+0.13 | – | – | – | **0.33 + 0.38** |
| `_renderItem` (:958) + `_draw` (:1012) + native `drawElements` | – | – | – | – | – | – | 0.35 + 0.13 + 0.21 |

### 1b. three.js on the two client scenarios, function by function

`shader-client`, steady state, three 9.51 ms vs jrs 4.45 ms profiled (5.5 vs 1.2 ms unprofiled CPU):

| phase | jrs | three | where three spends it |
|---|---:|---:|---|
| geometry bind | 0.75 | **4.38** | `WebGLBindingStates.setup` 1.61 self + `needsUpdate` 1.19 (per-draw attribute comparison of every attribute against cached state: 7 custom attributes × 1313 draws) + `WebGLObjects.update` 0.46 + native `bindVertexArray` 0.69 (1248 calls vs jrs 763: three rebinds the VAO whenever the *program* changes even if the geometry did not). |
| per-draw state | 0.15 | 1.14 | `setProgram` 0.74 self (materialProperties lookups, `needsLights`, fog/env checks per draw) + `WebGLState.setMaterial` 0.36 |
| uniform upload | **1.44** | 0.83 | three: `setValueM4` 0.24 + `uniformMatrix4fv` 0.32 native + `setValueV3f`… (`WebGLUniforms.upload` iterates a precomputed `seq` of setters). jrs: `for (const name in uniforms)` over all 34 uniforms per material switch, string lookup + type switch each → 0.61 + 0.69 self. **This is the one phase where jrs is slower than three per draw.** |
| draw issue | 0.91 | 0.76 | jrs `_renderItem` 0.35 (incl. 16-float modelMatrix compare per draw) + `_draw` 0.13 + `drawElements` 0.21 native; three `renderBufferDirect` 0.58 + `drawElements` 0.28 |
| sort | 0.18 | 0.35 | three `painterSortStable` comparator sort |
| scene graph update | 0.12 | 0.29 | |
| project + cull | 0.24 | 0.36 | |
| frame setup/other | 0.04 | 0.70 | three `renderScene`/`render` self, `WebGLRenderStates`, `WebGLBackground` |

`shader-client-static`: both libraries are ≥ 97 % GL waiting. The JS left over (jrs 2.5 ms, three 6.5 ms
profiled; 0.7 vs 1.5 ms unprofiled) splits the same way as above per pass; the per-pass GL call counts
are identical except `bindVertexArray` 382 vs 643 and jrs's six extra `bufferSubData` (section 3).

## 2. Ranked optimisation opportunities

Savings are estimated on the **unprofiled pure-CPU** ("draws stubbed") frame; multiply by the
profiler ratio (~0.55) when reading them off the profiled tables. "parity risk" is the risk of changing
pixels.

### Cheap and safe (one worker, one day, no shader changes)

| # | what | scenarios | est. saving | evidence | where | parity risk |
|---|---|---|---|---|---|---|
| 1 | **Stop boxing in `Object3D.updateMatrix`: keep the TRS snapshot (and the version counters) in a typed array, not as double fields on `this`.** The method is called on every object class (Mesh, Scene, Group, lights, light targets, cameras): with ≥ 5 receiver maps the `this._px…_sz` loads are megamorphic, and V8's generic load of a double field allocates a HeapNumber. 10 loads × 12 B × 10 000 objects = the **1.2 MB/frame** garbage of a fully static scene, plus the generic-IC cost. | all; every 10 k scene | −0.7 to −1.0 ms (shared-static 4.2 → ~3.3), −0.3 shadows/unique, 1.2 MB/frame → 0 | heap profile: `updateMatrix ← updateMatrixWorld` 1,202,825 B/frame (92 %) in shared-static, 600 KB many-materials, 480 KB shared-animated, 242 KB shadows; node microbench `bench/micro/updateMatrix-megamorphic.mjs`: 10 000 meshes alone 0.64 ms/frame & 0.7 KB; the same plus one each of AmbientLight/DirectionalLight/Group/PerspectiveCamera **2.79 ms & 115 KB**/frame; `updateMatrix-snapshot-prototype.mjs snaponly` (snapshot in a per-object `Float64Array(10)`) 2.8 → 2.0 ms and 0 allocation. Per-class method copies (`perclass`) gave nothing extra. | `src/core/Object3D.js` `updateMatrix`/`updateMatrixWorld`/`updateWorldMatrix`; put the 10 doubles in a second slab (`Float64Array`, 16/object) in `TransformSlab.js` so no per-object allocation is added | none |
| 2 | **Call `megaBuffers.ensure()` once per geometry per frame, not once per item.** `_isMultiDrawable(item)` runs `ensure → _update`, which loops over the layout's attributes comparing versions, for every item and every `next` scanned, i.e. 5 000 times for 3 geometries. | all batched scenes | −0.3 to −0.6 ms | `_update` self: 0.38 shared-static, 0.52 shared-animated, **0.64** many-materials, 0.39 hierarchy, 0.29 (+0.25 `ensure`) unique, 0.29 shadows | `src/renderers/webgl/WebGLMegaBuffers.js` `ensure` (stamp `rec.frameStamp = renderer._frameId`), `WebGLRenderer.js` `_isMultiDrawable` | none (versions are still checked once per frame) |
| 3 | **Make `_drawList`'s scan O(1) per item.** Precompute a per-item `batchFlags` (batchable / multi-drawable / mdRecord) in `_pushItem` where the object and material are already in hand, keep an `Int32Array` of item indices produced by `finish()` instead of `itemFromKey(key)` (`key % 2^20` on a double per access, 2–3 times per item), and don't re-test `next` with `_isBatchable` when its flags are known. | all batched scenes | −0.8 to −1.3 ms (loop is 1.6–2.7 ms self) | `_drawList` self 1.91 / 2.33 / 2.70 / 1.64 / 1.13 ms (shared-static / animated / many-materials / hierarchy / shadows); `_isMultiDrawable` 0.10 and `_isBatchable` inlined | `WebGLRenderer.js` `_drawList`, `_pushItem`; `WebGLRenderLists.js` `finish` | none |
| 4 | **Skip the opaque (and transparent) sort when the key array is identical to last frame's.** Compare before sorting: 10 k compares cost 0.10 ms, the native sort 0.48 ms (already sorted) to 0.81 ms (random). Keys include the per-frame dense ids, which are stable when traversal order is stable. | static-ish scenes: shared-static, many-materials (0.71 ms in `finish`), unique, shader-client(-static), shadows | −0.1 to −0.6 ms | `finish` self 0.19 / 0.71 / 0.23 / 0.18 ms; microbench in this report's log | `WebGLRenderLists.js` `finish` (keep `lastKeys`, `lastSorted`) | none (identical order) |
| 5 | **Don't copy 28 floats per object into the matrix texture when the object did not move.** `addTex` copies world + normal matrix for every batched object every frame, then the hash says "unchanged, skip upload". Record `(texSlot, _worldVersion)` per object and copy only when either differs. | shared-static, many-materials, unique, shadows, hierarchy (partially) | −0.3 to −0.6 ms on 10 k static objects | `addTex` is inlined into `_drawList`'s 1.9 ms self in shared-static; `batch matrix upload` 0.005 ms (upload is already skipped) | `WebGLBatcher.js` `addTex` | none |
| 6 | **Precompute the ShaderMaterial uniform list per (program, material).** Build once an array of `{uniformRecord, uniformObject, setter}` for the uniforms the program actually has (34 names → ~34 records, no `for…in`, no string lookup, no 20-way `switch` per value) and walk it on material switch; keep reading `.value` live so shared uniform objects still work; rebuild when `material.uniforms` identity or `material.version` changes. This is what three's `WebGLUniforms.upload` does and why three's uniform phase is 0.83 ms vs jrs 1.44 ms on `shader-client`. | shader-client (biggest single CPU item), shader-client-static | −0.4 to −0.6 ms of 1.2 ms pure CPU on shader-client (~35 %) | `setUniformValueImpl` 0.69 + `_uploadShaderMaterialUniforms` 0.61 self = 1.30 ms of 4.45; ~176 material switches/frame (26 opaque + ~150 depth-sorted transparent alternating 4 materials) × 34 uniforms | `WebGLRenderer.js` `_uploadShaderMaterialUniforms`, `_uploadUniform`, `setUniformValueImpl`; `WebGLPrograms.js` (store the list on the program keyed by material id) | none if the cache compares exactly what it does today |
| 7 | **Store the per-frame program resolution on the material instead of a WeakMap lookup per item.** `_resolvePrograms` → `_getProgram` → `_materialProps` does `WeakMap.get` for every item (10 000/frame). `material._resolveStamp/_resolveVariant/_resolveProgram` fields make it two compares. | all | −0.1 to −0.15 ms | `_resolvePrograms` self 0.17–0.20 ms in the 10 k scenes | `WebGLRenderer.js` `_getProgram`, `_resolvePrograms` | none |
| 8 | **Stop boxing `z`.** `_projectObject` passes the double `z` to the non-inlined `_pushItem` → one HeapNumber per visible object per frame (12 B × visible: 96 KB shared-static, 16 KB shader-client). Write `z` into the list's `Float32Array` directly or pass it through a scratch typed array. | all | tiny time (< 0.05 ms), removes the second-largest allocation site | heap profile `_projectObject ← _projectObject` 96,554 B (shared-static), 16,067 B (shader-client), 24 KB shadows | `WebGLRenderer.js` `_projectObject` / `_pushItem` / `WebGLRenderLists.push` | none |
| 9 | **Upload the Frame and Lights uniform blocks only when they changed.** Every `render()` does 2 × (`bindBuffer` + `bufferSubData`) unconditionally: 6 `bufferSubData` per frame in the 3-pass static scene, 0 in three. Compare the 64 floats of the frame block (camera/fog/viewport) and use `lights.version` + light transform versions for the lights block. | all (GL-call parity), static multi-pass | ~0.02–0.05 ms, −6 GL calls/frame on the static client scene | `glcalls-diff.txt`: `bufferSubData` 0 → 6, `bindBuffer` 0 → 6, `bindBufferRange` 0 → 3 on shader-client-static | `WebGLRenderer.js` `render`, `_uploadFrameBlock` | none |
| 10 | **Skip the 16-float `cacheSlab` compare when the location's last object is a different object.** For ShaderMaterial scenes every consecutive draw uses a different object, so the compare always fails and is pure overhead before the upload. Track `mu.lastObject`/`mu.lastWorldVersion` and compare 2 fields. | shader-client(-static) | −0.05 to −0.1 ms | `_renderItem` self 0.35 ms for 1313 draws; `uniformMatrix4fv` count identical to three (871) | `WebGLRenderer.js` `_renderItem`, `cacheSlab` | none |
| 11 | **Cheaper VAO validation.** `bindingStates.bind` sums the `version` of every attribute on every draw (7 attributes × 1313 draws in shader-client = 0.33 ms self). Cache the sum per geometry and only recompute when `geometry._layoutVersion` changed or a `needsUpdate` was seen since (e.g. keep the per-attribute versions in a small `Int32Array` and compare that in one pass, or have `BufferAttribute.needsUpdate` bump a global counter that gates the check). | shader-client(-static) | −0.15 to −0.25 ms | `bind` self 0.33 ms + 0.40 ms in the static scene; three spends 2.8 ms on the same job | `WebGLBindingStates.js` `bind` | none |
| 12 | **Shadow pass: don't re-collect and re-cull casters per light when nothing moved.** `_collect` + `_pushItem` (0.29 ms, not inlined in this path) + `_cullTest` + `_resolvePrograms` + `finish` run per light per frame; cache the caster list per light keyed on (scene traversal version, light frustum). | shadows | −0.4 to −0.6 ms of 1.4 ms | shadow pass 1.28 ms of 3.48 profiled: `_drawList` 1.13 (both lists), `_pushItem` 0.29, `_update` 0.29, `_cullTest` 0.24, `_collect` 0.10 | `WebGLShadowMap.js` `render`/`_collect` | none if invalidation is keyed on `_worldVersion` changes (a traversal-wide "any world version changed" flag is needed; see #15) |

Expected total of #1–#5 + #7 on `shared-static`: 4.2 ms pure CPU → roughly 1.8–2.2 ms. On `shader-client` #6 + #10 + #11:
1.2 ms → ~0.6–0.7 ms (the bench median will move less, see section 0).

### Big and risky (design work, shader or traversal changes, needs the compare harness on every run)

| # | what | scenarios | est. saving | evidence | where | parity risk |
|---|---|---|---|---|---|---|
| 13 | **Material index per instance instead of `bindBufferRange` per material.** many-materials issues 600 instanced draws + 600 `uniform1i` + 601 `bindVertexArray` + 200 `bindBufferRange` for 200 materials × 3 geometries. Put the material block slot into the spare texel of the matrix texture (or an `int` per instance) and index a `Material[]` UBO array in the shader: one multi-draw per program. | many-materials, any scene with many built-in materials | −1.0 to −1.5 ms of 4.2 ms (draw issue 0.50 + geometry bind 0.18 + per-draw state 0.10 + the command loop) | `glcalls-diff.txt` many-materials; `drawElementsInstanced`/`uniform1i`/`bindVertexArray` ≈ 0.4 ms native | `ShaderLib.js` (block becomes an array, `MATERIAL_BLOCK_SIZE` × N), `WebGLRenderer.js` `_drawList` cost model, `WebGLBatcher.js` | medium: same arithmetic, but std140 array indexing with a dynamic index and 1024-entry UBOs hit driver limits (`MAX_UNIFORM_BLOCK_SIZE` 16 KB on some mobile GPUs → 128 materials per bind); keep a fallback |
| 14 | **Flat scene-graph update + projection.** Replace the recursive `updateMatrixWorld` / `_projectObject` walks (two traversals, every property load megamorphic: `children`, `visible`, `layers`, `matrixAutoUpdate`, `parent`…) with a flat, parent-before-child array maintained on `add`/`remove`, with versions/flags in typed arrays, and project in the same pass. three's `updateMatrixWorld` + `projectObject` cost it 7.2 + 9.5 ms on hierarchy; jrs 3.0 + 2.3. | all 10 k scenes | −1.5 to −2.5 ms on 10 k objects (scene update + project + cull are 55 % of shared-static, 57 % of hierarchy) | phases table above; `updateMatrixWorld` self 1.2–1.3 ms is mostly call overhead and megamorphic loads (10 compares should be ~0.1 ms) | `src/core/Object3D.js`, `Scene.js`, `WebGLRenderer.js` `_projectObject` | low for pixels, high for semantics (user `traverse`/`onBeforeRender` order, hierarchy mutations during render, `matrixWorldAutoUpdate = false` objects); do it behind a flag and run `npm test` |
| 15 | **"Nothing changed" fast path for static frames.** If no world version changed, the camera is unchanged, no material/light/texture version changed and the lists' keys are identical, replay last frame's command list: skip projection, sort, program resolution and draw-list build. Needs a cheap global "scene dirty" signal: a counter bumped by every `_worldVersion++`, `material.version` change, `Texture.needsUpdate`, light property set. `position.x = …` writes are not observable without `updateMatrix`, so the traversal in #1 still has to run (cheaply) to detect them; the win is skipping everything after it. | shared-static (4.2 → ~1.0), shader-client-static (0.7 → ~0.2), many-materials, unique, shadows | up to −3 ms on 10 k static objects; nothing on animated scenes | project + cull + sort + draw-list build + resolve = 4.1 of 8.26 profiled ms in shared-static | `WebGLRenderer.js` `render`/`_drawList`, `WebGLRenderLists.js` | medium: any missed invalidation is a visible bug (stale object), and `onBeforeRender` hooks, `renderOrder` changes, `visible` toggles, `layers` edits, `frustumCulled` edits all have to feed the dirty signal |
| 16 | **Matrix texture: upload only the dirty row range, and avoid the per-frame GPU-process sync.** shared-animated/hierarchy upload the whole RGBA32F texture every frame (1.28 MB / 1.0 MB): 0.37 / 0.25 ms steady, and it is the call that absorbs the 12–15 s stalls. Track `[minDirty, maxDirty]` object index while filling; alternate between two textures so the upload never waits for the draw that reads the previous one. | shared-animated, hierarchy, any moving batched scene | −0.2 to −0.3 ms steady; fewer/shorter stalls (unquantified) | `texSubImage2D ← uploadTexture` 0.374 ms; stall frames 15 134 / 12 488 ms inside `texSubImage2D` | `WebGLBatcher.js` `uploadTexture`/`addTex` | none for dirty ranges; a shader-derived normal matrix (halving the texture) is **not** parity-safe for non-uniform scale |
| 17 | **Skip `_cullTest` for static objects under a static frustum.** Cache the frustum's 24 floats' version; if `object._cullVersion === object._worldVersion` and the frustum version matches, reuse the previous visibility bit (1 byte per object) instead of 6 plane dot products + the sort depth. | shared-static, shader-client-static, shadows (light frustum is static) | −0.3 to −0.5 ms on 10 k objects | `_cullTest` 0.47 (shared-static), 0.95 (animated, recomputing spheres), 0.66 (hierarchy) | `WebGLRenderer.js` `_cullTest`, `Frustum.js` (version counter) | low (exact-compare the planes) |
| 18 | **Transparent list: group by material inside equal-depth buckets.** ~150 transparent draws alternate among 4 materials in shader-client (depth-sorted), causing ~150 material switches with full uniform re-walks. Three does the same, so this is not a parity-with-three item; it is a real scene win only when #6 is not enough. | shader-client | −0.1 to −0.2 ms after #6 | material switches ≈ 176/frame vs 13 program switches | `WebGLRenderLists.js` `finish` (transparent key) | **high**: changes draw order of overlapping transparent surfaces → different pixels; only within exactly-equal quantised depth |
| 19 | **Per-pass work in multi-pass frames.** Each `render()` re-runs `_updateEnv` (string key concat), `lights.begin/end/fill` (sorts, 1.1 KB block), `_renderOrderReset`, the two block uploads (#9) and `bindShadowMaps`. For the 3-pass static client this is 3× per frame for identical input. | shader-client-static, any shadow-RT pipeline | −0.05 to −0.1 ms per extra pass | `frame setup/other renderer` 0.128 ms; `_updateEnv` allocates 118–122 B/frame (string key) | `WebGLRenderer.js` `render`, `_updateEnv`, `WebGLLights.js` | none |

## 3. GL-call deltas vs three.js

One whole frame, all `render()` calls, from `bench/glcalls-diff.mjs` (full per-function tables in
`glcalls-diff.txt`). Calls jrs still makes **more** of than three:

| scenario | total three → jrs | jrs above three | note |
|---|---|---|---|
| shared-static | 30 002 → 9 | `bindBuffer` +2, `bufferSubData` +2, `bindVertexArray` +2, `drawElementsInstanced` +1 | the 2+2 are the Frame/Lights block uploads (#9); 1 batched draw replaces 10 000 draws + 20 000 uniform calls |
| shared-animated | 30 002 → 12 | as above + `pixelStorei` +2, `texSubImage2D` +1 | `pixelStorei` is set every upload; could be set once |
| many-materials | 14 397 → 2 007 | `uniform1i` +600, `drawElementsInstanced` +600, `bindBufferRange` +200, `bindBuffer`/`bufferSubData` +2 | `bindVertexArray` 4 195 → 601, `uniformMatrix4fv` 5 000 → 0; #13 would take this to ~10 |
| unique-geometries | 6 002 → 9 | `bindBuffer` +2, `bufferSubData` +2, `multiDrawElementsWEBGL` +1 | |
| hierarchy-animated | 16 002 → 12 | as shared-animated | |
| instanced-100k | 3 → 9 | `bindBuffer` +2, `bufferSubData` +2, `bindVertexArray` +2 | fixed per-frame cost only; #9 removes 4 of the 6 |
| shader-client | 3 805 → 3 325 | `uniform1f` +2, `bindBuffer` +2, `bufferSubData` +2 | `bindVertexArray` 1 248 → 763; `useProgram` 13 = 13, `bindTexture` 171 = 171, `uniformMatrix4fv` 871 = 871, `drawElements` 1 313 = 1 313. `renderer.debug.traceUniforms` for the frame: `modelMatrix` 871, `reflectance` 170, `lamp0Dir` 12, `opacity` 2 — the +2 is `opacity` flipping between the transparent (0.6) and opaque (1.0) instance of a program; three's count differs by two, not worth chasing |
| shader-client-static | 1 870 → 1 626 | `bindBuffer` +6, `bufferSubData` +6, `bindBufferRange` +3, `uniform1f` +2, `uniformMatrix4fv` +1 | `bindVertexArray` 643 → 382, `useProgram` 17 → 16; per pass (three → jrs): shadow RT `uniform*` 147 → 147 (jrs: `modelViewMatrix` 146 + `projectionMatrix` 1), near RT 147 → 147, main 184 → 187 (jrs: `modelMatrix` 143, `reflectance` 42, `opacity` 2); `bindTexture` 44 → 44 |
| shadows | 10 027 → 29 | `bindBuffer` +3, `bufferSubData` +3, `drawElementsInstanced` +2, `bindBufferRange` +2, `useProgram` +1, `bindVertexArray` +1 | 4 001 draws → 3 |

Everything jrs is above three on is either the per-render block upload (#9, constant) or a batching
draw that replaces thousands of calls. There is no per-object GL call left in any built-in-material
scene, and in the ShaderMaterial scenes jrs makes exactly three's draw, program, texture and matrix
uploads with 40 % fewer VAO binds.

## 4. Suspicious things

**Per-frame allocation (sampling heap profiler, bytes/frame, jrs):**

| scenario | total | sites |
|---|---:|---|
| shared-static | 1,300,432 | `updateMatrix` 1,202,825 (#1) · `_projectObject` 96,554 (#8) · `_uploadFrameBlock` 600 · `_updateEnv` 122 (string key) · `subarray` in `finish` 109 |
| shared-animated | 698,188 | `updateMatrix` 480,152 · harness `update` 119,305 (the scenario's `rotation.y =` boxing, identical for three) · `_projectObject` 97,211 |
| hierarchy-animated | 1,078,807 | same pattern |
| many-materials | 658,394 | `updateMatrix` 600,048 · `_projectObject` 56,784 |
| shadows | 268,050 | `updateMatrix` 242,090 · `_projectObject` 23,980 |
| shader-client | 17,983 | `_projectObject` 16,067 · `_uploadFrameBlock` 600 · `setUniformValueImpl` 371 |
| shader-client-static | 104,945 | `_projectObject` 3 passes (+ `_collect`-style overhead) |

GC itself is cheap (0.01–0.32 ms/frame) because it is all young-generation garbage, but 1.3 MB/frame
means a scavenge every ~10 frames, and those are the 8–10 ms frames in jrs's otherwise 4.6 ms
shared-static run (worst 8.2 ms, p90 7.7 vs median 4.8). After #1 and #8 the renderer allocates
< 2 KB/frame (the instanced-100k row shows the floor: `_uploadFrameBlock` 561 B — `Vector4` round-trips
in `setRenderTarget`/viewport maths — and `_noteRenderOrder` 172 B).

**Redundant work per frame (all confirmed in the profiles):**
* `megaBuffers.ensure/_update` per item instead of per geometry (#2).
* `addTex` copies 28 floats per object into the texture even when the hash will say "unchanged" (#5).
* `_isBatchable`/`_isMultiDrawable` evaluated 2–3× per item (`item` and as `next`) (#3).
* Frame + Lights UBO uploaded on every `render()` regardless of change (#9); `pixelStorei` ×2 per
  texture upload.
* Opaque key array fully re-sorted every frame even when identical (#4).
* `_resolvePrograms`: WeakMap lookup per item (#7).
* Shadow pass re-collects, re-culls, re-resolves per light (#12).
* `_cullTest` recomputed for static objects under a static camera (#17).

**Not a problem (checked):** uniform caches hold (0 modelMatrix uploads in the static scene, identical
`uniform*` counts to three); `bindTexture` counts identical; no `getError`/`getParameter`/`finish` in
the frame; program resolution is 0.04 ms (cached per material per frame); `_getProgramSlow` key
building does not run in steady state.

**Harness:** `performance.now()` inside the frame loop is 0.1–0.14 ms/frame of the measured time (3 %
of shader-client); 10 warm-up frames are too few (section 5); the "worst frame" column is a GPU-process
artefact on this machine (section 6).

## 5. Warm-up (first 240 frames, both libraries, `warmup-series.txt`)

Medians of 20-frame windows, ms:

| window | shader-client three | shader-client jrs | shader-client-static three | shader-client-static jrs | shared-static three | shared-static jrs | many-materials three | many-materials jrs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| frame 0 | 279 | 211 | 291 | 241 | 155 | 126 | 106 | 102 |
| 1–9 | 9.6 6.8 4.3 4.3 4.9 6.7 4.3 4.4 4.9 | 6.8 5.1 5.6 2.6 3.7 3.3 2.6 3.3 2.6 | 9.0 8.0 2.1 3.0 1.8 2.7 2.5 3.8 2.6 | 12 4.8 5.9 4.5 3.6 2.6 1.7 1.4 1.5 | 28 23 18 16 16 21 17 16 16 | 23 10 8.8 12 5.4 5.5 5.7 7.1 9.2 | 29 15 277 16 13 13 24 31 19 | 16 9.6 6.5 5.8 6.0 8.2 5.4 4.8 4.7 |
| 0–19 | 5.0 | 2.8 | 3.2 | 2.3 | 15.8 | 6.0 | 15.1 | 5.0 |
| 20–39 | 5.8 | 4.3 | 3.3 | 2.8 | 20.5 | 5.1 | 10.5 | 5.4 |
| 40–59 | 4.9 | 5.1 | **61.2** | **62.6** | 15.0 | 5.0 | 9.9 | 4.5 |
| 60–79 | 6.5 | 5.7 | 58.8 | 64.0 | 14.5 | 7.8 | 10.8 | 7.6 |
| 80–99 | 5.5 | 5.0 | 67.3 | 63.0 | 13.8 | 9.2 | 10.7 | 4.0 |
| 100–139 | 5.7 / 6.2 | 4.9 / 4.4 | 61.5 / 67.0 | 58.9 / 60.8 | 16.4 / 15.7 | 7.7 / 7.9 | 10.4 / 11.1 | 3.8 / 3.8 |
| 140–239 | 4.5 … 3.7 (then 25 with a 1.7 s stall) | 4.5 … 4.5 | 58–66 | 58–64 | 13–20 | 5.4 … | 9.5–16 | 3.7–4.3 |

What this shows:

* **JS warm-up is short**: both libraries are within noise of steady state after ~10 frames (frame 0 is
  shader compilation + first uploads, 100–290 ms; frames 1–5 are V8 tiering). The harness's 10 warm-up
  frames are fine for the JS side.
* **The GPU backlog is not**: `shader-client-static` costs 2–3 ms/frame for the first ~40 frames in both
  libraries and 60 ms/frame afterwards. The command buffer lets the renderer queue ~40 frames (~2.4 s of
  SwiftShader work) before flow control bites; the bench's frames 11–71 straddle that edge, which is
  why `npm run bench` reports 22–34 ms (README) or 25–30 ms (run 1) or 60 ms (profile run) for the same
  scene. **The number is the queue position, not the renderer.** The same edge is visible at smaller
  scale in `shader-client` jrs (2.8 ms in frames 0–19, 4.3–5.7 afterwards; three 5.0 → 5.8/6.5) and
  `shared-static` jrs (5.0 → 7.8–9.2 in frames 60–139 while the GPU process catches up on the queued
  10 000-instance draws, then back to 5.4).
* Why free-running frames cost *more* than `gl.finish()`-per-frame frames (shader-client jrs: 4.2 vs
  1.8 ms): with a full queue the renderer thread spins/wakes in `WaitForGetOffset` and competes with
  SwiftShader's worker threads for the 4 cores; when it waits in `finish()` SwiftShader gets all cores.
  A CPU-side win in jrs therefore shows up twice on this machine (less JS and less contention).
* Recommendation for the harness (not `src/`): report a second column measured with `gl.finish()` after
  each frame (GPU-synced: JS + GPU per frame, no queue effects), keep the canvas out of the DOM during
  timing (see section 6), and warm up until the GPU-synced time is stable rather than a fixed 10 frames.
  `bench/profile-cpu.mjs` already prints both modes plus the draws-stubbed CPU-only time.

## 6. Stalls (`stall-trace-*.txt/.json`)

Chrome traces around 120 frames, renderer and GPU process together, slowest frames annotated:

| run | frame | ms | renderer main thread was in | GPU process main thread was in |
|---|---|---:|---|---|
| shader-client / jrs | #9 | 2 477 | `CommandBufferHelper::WaitForAvailableEntries` → `CommandBufferProxyImpl::WaitForGetOffset` 2 418 ms (the GL call that happened to need ring space: `uniformMatrix4fv` in the CPU profiles) | `SkiaOutputSurfaceImplOnGpu::SwapBuffers` → `FramebufferVk::readPixelsImpl – CPU Readback` → `ContextVk::finishImpl` **2 403 ms**: the headless compositor presents the page by reading the frame back on the CPU, which is a full GPU finish of everything queued |
| shared-static / three | #0 | 2 221 | `WaitForGetOffset` 2 162 ms | same `SwapBuffers` → `readPixelsImpl` → `finishImpl` 2 168 ms |
| shared-animated / jrs | #116 | 12 025 | `CommandBufferProxyImpl::WaitForToken` 12 017 ms (texSubImage2D of the 1.28 MB matrix texture) | `CommandBufferService:PutChanged` → `ContextVk::onCopyUpdate` → `flushAndSubmitOutsideRenderPassCommands` **12 089 ms**: the texture-staging copy forces a submit that waits for the queued frames to finish |
| shared-static / three | #108, #50 | 296, 267 | `WaitForGetOffset` 270 / 236 ms | `SharedImageStub::OnDestroySharedImage` / a 1 s-delayed `gr_cache` purge task → `ContextVk::flushAndSubmitCommands` → `SecondaryCommandBuffer::executeCommands` 298 / 254 ms (SwiftShader executing a backlog of draws) |
| shader-client / jrs | #10, #105, #52 | 8–12 | `WaitForGetOffset` 2.8–5.5 ms | `CommandBufferStub::PerformWork` / `OnAsyncFlush` 2–5 ms (ordinary flow control) |
| shared-animated / jrs | #0 | 15 (GC 49 ms on workers) | JS | – (V8 concurrent marking on worker threads, the only GC-related worst frame found) |

So every multi-hundred-millisecond frame, in both libraries, is the **renderer blocked on the GPU process
draining a backlog at a synchronisation point**: the compositor's swap (a CPU readback that finishes the
whole queue), a texture-upload staging flush, a shared-image destroy, or Skia's periodic cache purge. The
backlog exists because the bench loop never yields and the JS side is faster than SwiftShader; the
faster the JS, the longer the queue and the longer the eventual drain. That is why the README saw
"one-to-two-second stalls in jrs that three did not": it is a symptom of jrs being faster, not of a
jrs bug, and the worst-frame column should be read that way until the harness syncs.

What jrs can still do about it (ranked):
1. Harness: time with `gl.finish()` per frame or a `fenceSync` wait every N frames, and keep the canvas
   detached from the document while timing (no `SwapBuffers` readback at all).
2. #16 (dirty-range matrix-texture upload, double-buffered textures): the upload is the sync point in
   the animated scenes; smaller staging copies drain faster and double-buffering avoids waiting on the
   draw that reads the previous texture.
3. Nothing in `src/` can remove the compositor readback; a real GPU does not do it.

No GC-caused stall was observed (heap deltas 0 KB in all worst frames; GC phase ≤ 0.32 ms/frame).
The ordinary 8–14 ms "worst" frames in the jrs 10 k scenes are scavenges of the 1.2 MB/frame garbage
(#1, #8) plus flow-control waits of a few ms.

## 7. Run-to-run noise

_pending: `baseline-bench-2.txt` vs `baseline-bench-1.txt`_
