# Stall hunter: the sporadic 1–17 s frames in the batched scenes

Branch `swarm/stall-hunter`. Environment: headless Chromium (Playwright build 1194) on ANGLE/SwiftShader, 16 GB container.

## What was measured

`node bench/run.mjs` only keeps the sorted per-frame samples, so a separate harness
(`scratchpad/stall.mjs`, not committed) ran the scenarios with the raw per-frame times kept,
`performance.memory` deltas around every long frame, optional `gl.finish()` after each frame
("sync" mode, which makes the JS time include the GPU time), and optional wrappers that time every
suspect GL call (`texSubImage2D`, `texImage2D`, `bufferSubData`, `bufferData`, `bindVertexArray`,
`linkProgram`, `compileShader`, draws, `finish`). A Chrome trace (`gpu`, `gpu.angle`, `toplevel`,
`mojom` categories) was captured around a stall. Runs were 300–600 frames; the stall rarely shows in
60 frames, which is why `npm run bench` only "sometimes" catches it.

## Reproduction (original code, shared-animated, 10 000 objects, 300 frames)

| run | median | worst frame | frames > 200 ms | wall avg |
|---|---:|---:|---:|---:|
| 0 | 5.3 ms | 16 801 ms | 4 | 138 ms |
| 1 | 5.2 ms | 12 554 ms | 5 | 153 ms |
| 2 | 5.2 ms | 13 271 ms | 5 | 155 ms |

Runs 1 and 2 stalled at exactly the same frame indices (13, 19, 134, 146, 261, 286), so this is a
deterministic driver/command-buffer state machine, not garbage collection. `performance.memory`
showed no heap growth before the long frames (deltas of 0 to 3 MB; heap 30–47 MB throughout).
`shared-static` (same scene, nothing moving, so no per-frame matrix upload) never stalled: worst 8–29 ms.
jrs with `renderer.autoBatch = false` (10 000 individual draws, matrices sent as uniforms) did not
stall either: worst 328 ms in 100 synced frames, the same noise level as three.js (94–1 046 ms worst).

## Attribution

1. **The time is inside one GL call, whichever is the first upload of the frame.** With the wrappers on,
   a 17 472 ms frame was 17 467 ms inside `texSubImage2D` of the matrix texture; a 6 350 ms frame
   was 6 341 ms inside the 2.3 KB `bufferSubData` of the Lights uniform block that precedes it. Shader
   compile/link, VAO binds and draws were 0.0–0.2 ms in every long frame. So the JS thread is blocked
   waiting for the GPU process, not doing work.
2. **It is not GPU work.** In sync mode the draw plus `gl.finish()` costs 4–9 ms per frame before and
   after the stall. After the first stall every later frame costs 150–200 ms, and all of it is inside the
   `texSubImage2D` call (`finish` 0 ms). With 5 000 objects the post-stall cost is ~87 ms per frame, with
   10 000 it is ~175 ms: proportional to the bytes uploaded (640 KB vs 1.28 MB). With 1 000 or 3 000
   objects (128–384 KB per frame) no stall appeared in 100 frames.
3. **Trace.** Renderer process: `CommandBufferProxyImpl::WaitForToken` / `GpuChannel::WaitForTokenInRange`
   1 475 ms and 374 ms (58 waits totalling 11.2 s in 120 frames). GPU process: one
   `ContextVk::flushAndSubmitCommands` of 1 621 ms, then `CommandQueue::queueSubmitLocked` ~200 ms for
   each of the following 123 submits (10.2 s total). `WaitForToken` is what `RingBuffer::Alloc` calls
   when the client's transfer ring buffer has no free block.
4. **Why `texSubImage2D` and not three.js.** Chromium's client (`gpu/command_buffer/client/gles2_implementation.cc`):
   `TexSubImage2D` with client data always goes through the ring *transfer buffer* (`ScopedTransferBufferPtr` +
   `TexSubImage2DImpl`), which splits an upload that does not fit into row chunks and, per chunk, waits for the
   GPU process to free the previous one (`RingBuffer::Alloc` → `FreeOldestBlock` → `WaitForToken`). The buffer
   starts at 64 KB (`SharedMemoryLimits`: start/min 64 KB, max 16 MB) and is resized by a heuristic in
   `TransferBuffer::ShrinkOrExpandRingBufferIfNecessary` (shrink after `120 × high-water-mark` bytes, grow only
   when nothing is in flight). A 1.28 MB client upload per frame drives it into the chunked mode and each chunk
   then costs a round trip plus a ~200 ms SwiftShader submit. `TexImage2D`, by contrast, falls back to
   *mapped memory* (`ScopedMappedMemoryPtr`, limit RAM/20) for uploads larger than the transfer buffer and sends
   the whole image in one piece. three.js uploads 10 000 small `uniformMatrix4fv`s through the command ring
   itself and never puts a large client array through the transfer buffer, so it is immune; so is jrs with
   batching off.

## Candidate fixes tried (shared-animated, 200 frames, original condition)

| upload variant | median | worst | frames > 200 ms | wall avg |
|---|---:|---:|---:|---:|
| `texSubImage2D`, whole texture (original) | 5.0 | 11 440 | 3 | 159 |
| `texSubImage2D` in 4-row (64 KB) chunks | 5.6 | 16 439 | 1 | 89 |
| `texSubImage2D` in 16-row chunks | 5.7 | 7 458 | 3 | 111 |
| 4-row chunks + `flush()` after each | 5.3 | 9 749 | 2 | 90 |
| whole upload + `flush()` | 7.2 | 1 838 | 65 | 133 |
| PBO: `bufferData(STREAM_DRAW)` + `texSubImage2D` from it | 5.2 | 2 769 | 3 | 38 |
| PBO: `bufferSubData` into a pre-sized PBO | 5.3 | 6 199 | 2 | 45 |
| ring of 3 textures (double/triple buffering) | 5.3 | 14 469 | 3 | 122 |
| **`texImage2D` redefinition each upload** | **5.1–5.3** | **61–82** | **0** | **6.1–8.6** |

Double buffering does nothing (the texture being in use by the GPU was never the problem), splitting rows
does nothing (every chunk still goes through the ring buffer), orphaning a PBO helps a little but still stalls.
Only the `texImage2D` path, which takes Chromium's mapped-memory route, removes the stall: 2 × 600 frames
with no frame above 64 ms, and in sync mode its per-frame cost equals the pre-stall `texSubImage2D` cost
(5.3 vs 5.4 ms median).

## The change (`src/renderers/webgl/WebGLBatcher.js`)

The matrix texture is no longer immutable (`texStorage2D`); it is defined with `texImage2D(RGBA32F, 1024 × rows)`
on every upload, with the same data, same format and same hash-based skip as before. Bytes uploaded per frame are
unchanged (exactly `rows` rows, as before). Nothing else changed: the shader, the texel layout, the sort, the batch
building and the draw calls are identical, so output is pixel-identical (confirmed by the compare run below).

The experiment harness (`stall.mjs`, `trace.mjs`) lives only in the session scratchpad; it is a copy of the
`runScenario` loop from `bench/index.html` with raw per-frame samples, so it can be re-created from that file.

## Before / after: raw per-frame harness, 300 frames per run (jrs only, batched scenes)

| scenario | before: median / worst / frames > 200 ms (per run) | after: median / worst / frames > 200 ms (per run) |
|---|---|---|
| shared-static (no per-frame upload) | 5.3 / 8.3 / 0; 4.2 / 7.7 / 0; 4.0 / 29.4 / 0 | 5.4 / 9.0 / 0; 3.7 / 5.9 / 0; 3.9 / 7.7 / 0 |
| shared-animated | 5.3 / 16 801 / 4; 5.2 / 12 554 / 5; 5.2 / 13 271 / 5 | 5.4 / 13.7 / 0; 5.1 / 10.9 / 0; 5.3 / 160.5 / 0 (+ 2 × 600 frames: worst 61, 64) |
| hierarchy-animated | 4.2 / 12 630 / 3; 4.4 / 10 863 / 2 | 4.3 / 8.3 / 0; 4.8 / 1 307 / 2; 4.7 / 56.5 / 0 |
| unique-geometries (static after frame 1) | 1.1 / 3.8 / 0; 1.2 / 2.9 / 0 | 1.7 / 6.2 / 0; 1.1 / 4.9 / 0; 1.2 / 7.2 / 0 |
| many-materials (static, 600 batches) | 4.7 / 19.2 / 0; 4.7 / 964 / 1 | 3.9 / 217 / 1; 4.0 / 740 / 1; 4.0 / 1 149 / 1 |

Wall-clock average per frame (which includes the stalls) for shared-animated: 138–155 ms before, 5.5–6.6 ms after.

## Before / after: `node bench/run.mjs --frames=60`, two runs each, medians and worst frames

Baseline = original code, this container, same session. "Better of two" medians per the task rules.

| scenario | three median (ms) | jrs median before (run 1 / run 2) | jrs median after (run 1 / run 2) | jrs worst before (run 1 / run 2) | jrs worst after (run 1 / run 2) |
|---|---:|---:|---:|---:|---:|
| shared-static | 12.7–15.9 | 3.9 / 3.9 | 4.1 / 4.0 | 6.9 / 7.1 | 6.8 / 6.9 |
| shared-animated | 13.0–18.4 | 8.9 / 5.4 | 5.6 / 8.8 | 10.7 / 9.3 | 10.1 / 1 687.7 |
| many-materials | 8.4–10.2 | 4.9 / 4.4 | 4.5 / 4.1 | 911.3 / 1 398.1 | 1 133.9 / 1 225.3 |
| unique-geometries | 3.7–6.1 | 1.7 / 1.3 | 1.4 / 1.7 | 2.7 / 5.5 | 5.5 / 4.0 |
| hierarchy-animated | 13.7–16.0 | 5.0 / 4.4 | 4.8 / 4.5 | 8.3 / 8.3 | 10.1 / 7.8 |
| instanced-100k | 0.0 | 0.0 / 0.0 | 0.0 / 0.0 | — | 0.9 / 0.3 |
| shader-client | 4.2–5.6 | 3.3 / 3.3 | 2.6 / 3.1 | 78.2 / 147.4 | 211 / 46 |
| shader-client-static | 34.7–37.9 | 23.9 / 21.7 | 23.3 / 37.9 | 619.4 / 655.8 | 631.5 / 731.3 |
| shadows | 72.9–81.4 | 1.8 / 1.6 | 1.5 / 1.8 | 4.0 / 3.1 | 5.7 / 2.6 |

Medians are unchanged within noise. Two extra samples of the scenarios whose "better of two" moved most, all
after the fix: shader-client-static 21.1 and 22.7 ms (it has no batching and swings 21–38 ms run to run),
unique-geometries 1.3 and 1.4 ms, shared-animated 5.9 and 7.8 ms with worst frames 8.3 and 13.3 ms.
(The 60-frame bench is too short to catch the multi-second stall reliably in either direction; the 300-frame
harness table above is the meaningful before/after for the worst frame.)

Pixel comparison after the change (`--compare`) is identical to the committed `bench/results/latest.json`:
shared-static 0.347 / 8, shared-animated 0.346 / 9, shadows 0.134 / 33, every other scenario 0 / 0.
`npm test` 100/100, `bench/conformance.mjs` all PASS, `bench/addons.mjs` and `bench/smoke.mjs` exit 0 (GL error 0).
`build/` bundles were rebuilt with `npm run build` (the only change in them is the batcher).
The `bench/results/latest.json` reference was left as committed; the README's worst-frame column (2 120 / 1 128 / 1 173 ms
for the three batched scenes) should be re-measured by the integrator after merging.

## What is left: the ~1 s hiccups

After the fix a different, much rarer stall remains: about one frame of 0.2–2 s per 300–1 000 frames. It is not the
same mechanism:

* it also happens in `many-materials`, a static scene whose matrix texture is never re-uploaded (hash skip), with the
  blocked call being an ordinary `drawElementsInstanced` (1 233 ms spread over the frame's 600 draws) or the 2.3 KB
  Lights `bufferSubData`, i.e. the client simply waiting on the GPU process;
* three.js shows the same thing here: worst frames of 537, 920 and 1 046 ms in the baseline runs (shared-static,
  shader-client, shared-static sync), 150–210 ms typically;
* two 300-frame traces of the post-fix scenes caught no GPU-side event longer than 58 ms, so I could not name the
  GPU-process event; the earlier trace (original code) showed a single 1.6 s `ContextVk::flushAndSubmitCommands` with
  no sub-event, which points at SwiftShader/ANGLE internals (pipeline warm-up or memory housekeeping) rather than
  anything the renderer issues.

So the 10 000-object scenes no longer have a jrs-specific stall; what remains is environment noise at the same
rate and size as three.js's.

## Risks

* `texImage2D` redefinition relies on the driver keeping the storage when size and format are unchanged. On ANGLE
  (Chrome, Edge, and Firefox on Windows) and on native GL drivers this is the usual "respecify" path and measured
  free here; on a driver that reallocates on every `texImage2D` the cost would be one 1–2 MB allocation per frame,
  which is still far cheaper than the stall it replaces, and only for scenes that change every frame.
* The texture is no longer immutable, so a future `texSubImage2D` partial update (per-row dirty tracking) would still
  be legal; the texture height now equals the row count exactly, so the hash/count skip must stay keyed on both.
* The row count changes when the number of batched objects crosses a multiple of 128; each such change is a real
  reallocation (texture redefined with a new height). Scenes whose visible count flickers across a row boundary every
  frame would reallocate every frame; ANGLE allocates lazily and the old image is garbage-collected, so this is a few
  hundred microseconds, but it is a new cost that did not exist with the power-of-two immutable storage.
* Chromium's mapped-memory path flushes the command buffer after each upload (`SetFlushAfterRelease`), so a renderer
  doing many `render()` calls per frame with large batches issues one extra flush per call. Not measurable here.
* Nothing changes for `autoBatch = false`, for the shader-client scenes (no batching) or for `InstancedMesh`.
