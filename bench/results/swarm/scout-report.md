# Scout report: where jrs spends its frame, and what to build next

Branch `swarm/scout`. Everything here was measured on this container (4 cores, 16 GB, headless Chromium
1194 / ANGLE SwiftShader, node 22) on commit `9074c4e`. Scripts added under `bench/` reproduce every table:

| script | what it measures |
|---|---|
| `node bench/profile-cpu.mjs <scenario\|all> --lib=jrs\|three\|both` | CDP sampling CPU profile (50 µs) of 120 frames: phase shares, top self/inclusive functions, native-GL time per call, sampling heap profile (bytes/frame per function), unprofiled timing in three modes (plain, `gl.finish()` per frame, draw calls stubbed), worst frames with heap deltas and expensive GL calls. Raw `.cpuprofile` files and JSON summaries in `bench/results/swarm/profiles/`; `--reanalyze` re-reads them. |
| `node bench/glcalls-diff.mjs [scenario]` | per-GL-function call counts for one whole frame, three vs jrs, with deltas (`glcalls-diff.json`) |
| `node bench/warmup-series.mjs <scenario>` | frame-time series from frame 0, both libraries, to see when each settles |
| `node bench/stall-trace.mjs <scenario> --lib=` | Chrome trace (renderer + GPU process) around 120 frames; lists what every process was doing during the slowest frames |
| `node --expose-gc bench/micro/updateMatrix-megamorphic.mjs mixed\|meshes-only`, `bench/micro/updateMatrix-snapshot-prototype.mjs original\|snaponly\|perclass` | node-only microbenchmarks that isolate the scene-graph-update finding below |

Noise: `npm run bench` medians move by 10–20 % run to run on this box (the GPU process uses ~3 of the 4 cores
when SwiftShader is busy), so treat anything under ~15 % as noise here, not 5 %.

(sections below are filled in as the sweep completes)
