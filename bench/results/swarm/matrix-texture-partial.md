# matrix-texture-partial

## What changed
- `WebGLBatcher`: the whole-frame FNV hash is gone. The batcher keeps a CPU mirror of the matrix texture plus, per **stream position**, the `(object.id, _worldVersion)` it holds. An object at the same position with the same version is not rewritten (no slab copy, no normal-matrix work). Each row records the generation at which it last changed, and `uploadTexture` issues `texSubImage2D` only for rows changed since *that texture* was last written. Dirty runs are merged across gaps of up to 2 clean rows.
- All draw lists of a frame (opaque, transparent, shadow passes) append to one stream (`beginFrame()` from `render()` at call depth 0; `begin()` per list). Before, every list overwrote the texture from position 0, so multi-pass frames re-uploaded every pass.
- Optional double buffering (`batcher.doubleBuffer`, **off by default**). Each texture catches up on rows it missed. `bench/run.mjs` honours `JRS_DB=1` to measure it.
- `bench/index.html` reports `matrixBytesPerFrame`. `test/batcher.test.js` covers dirty rows and double-buffer catch-up with a fake GL.

## Deviation from the brief: positions instead of id-keyed slots
Id-keyed slots with a free list cannot give contiguous ranges for `drawBase + gl_InstanceID` in sorted order. That would need an index texture (or an instance attribute, which README says stalls). It would add a texel fetch per vertex on every batched draw, including shared-static. I kept the shader unchanged and keyed slots by sort position. Sort keys end in the item index, so the order is stable frame to frame for opaque lists. Transparent lists that reorder with the camera rewrite the moved positions. I did not build or measure the index-texture variant, so there are no numbers for it. It is the follow-up if reordering turns out to matter.

## Results (SwiftShader, 60 frames, jrs medians, ms)
Machine noise is about ±1.5 ms between identical runs. Baseline = original code.

| scenario | baseline | after | worst before -> after |
|---|---|---|---|
| shared-static | 3.7 | 2.9 / 3.4 | 5.5 -> 7.6 / 4.2 |
| shared-animated | 5.1 (A/B: 5.6, 7.0, 6.2) | full runs 7.6, 7.6; interleaved A/B 5.7, 5.9, 5.3 | 9.1 -> 12.7 / 10.1 |
| hierarchy-animated | 4.5 | 5.4 / 4.7 | 1524* -> 1517* / 1512* |
| many-materials | 4.2 | 3.4 / 4.1 | |
| unique-geometries | 1.7 | 1.3 / 1.2 | |
| shadows | 1.9 | 1.2 / 1.1 | |

\* The ~1.5 s worst frame appears in both builds and in random scenarios, so it is environmental rather than caused by this change.

**Unresolved:** in the two full `--compare` runs shared-animated read 7.6 ms against a 5.1 ms baseline. Interleaved A/B on that scenario alone shows parity or slightly better (new 5.3–5.9 vs base 5.6–7.0). I could not reproduce the regression in isolation and put it down to noise, but I did not run the full suite on the baseline in the same session, so this is not proven. Rerun it before merging.

The target "animated medians drop" was **not demonstrated**: no significant change on SwiftShader.

## Bytes uploaded per frame
Analytic for these scenarios; the `matrixBytesPerFrame` counter is added but I did not record its output.
- shared-static: 0 -> 0.
- shared-animated and hierarchy-animated (every object moves): about 323 KB (10 000 objects) -> same, since every row is dirty.
- Partially animated scenes: only dirty rows go up. The unit test moves 2 of 2 560 objects and uploads 2 rows (8 KB) instead of 20 rows.
- Multi-pass frames (shadows): no longer re-upload the matrices once per pass.

## Double buffering
No measurable benefit on SwiftShader. Medians were within noise (shared-animated 5.4–6.1 vs 4.8–7.4 single buffered). It is off by default. A real GPU may behave differently.

## Validation
- `npm test` passes (102 tests); the conformance and addons runs report no FAIL/fail lines; `bench/smoke.mjs` ran with no GL errors.
- `--compare`: meanAbsDiff/maxDiff are identical to the baseline for every scenario (shared-static 0.347/8, shared-animated 0.346/9, shadows 0.134/33, others 0/0).
- The comparison was against the values in the checked-out `latest.json`; I did not commit regenerated bench result files.

## Risks
- Memory: the stream is the sum of all lists in a frame rather than the max, so 128 B per object per list. Shadow-heavy scenes with 100k+ objects need a larger texture.
- Correctness depends, as before, on `_worldVersion` changing whenever the world matrix changes.
- A nested `render()` (render targets) continues the same stream. This is safe because each list fills, uploads and draws before the next one.

## Follow-up ideas
- Id-keyed slots with a small per-batch index texture, measured on a scene with a heavily reordering transparent list.
- Skip walking unchanged subtrees entirely using a scene-level "nothing moved" flag.
- Measure double buffering on a real GPU.
