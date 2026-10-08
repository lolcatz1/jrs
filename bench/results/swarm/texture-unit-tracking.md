# swarm/texture-unit-tracking

## Result: no measurable gain; GL call counts were already at or below three.js

Baseline (before any change) already had everything the task asked for in points 1, 2 and 4:

- Texture binding is tracked per unit (`WebGLState.bindTexture` compares target + texture per slot, `activeTexture` only on a real change).
- `texParameteri` is only issued from `_setTextureParameters` on upload (version change) or when creating placeholders, never per bind.
- `bindVertexArray` is guarded by `state.currentVAO`; `WebGLBindingStates` fast path re-binds through that guard; `Page` construction and VAO rebuilds reset `currentVAO` correctly.
- The feedback-loop guard (`bindEmpty` for render-target textures) and null-sampler placeholders are untouched.

## What changed

Only point 3: `WebGLState.setMaterial` computes a packed integer word (side, flip, effective blending, premultiplied alpha,
depth func/test/write, colour write, alpha-to-coverage) and returns immediately if it equals the word the previous
`setMaterial` applied. Materials with custom blending, polygon offset, stencil, or out-of-range enum values always take the
old full path (word = -1). The word is invalidated by `reset()` and by the public setters that other code calls directly
(`setFlipSided`, `setDepthTest`, `setDepthMask`, `setColorMask`, `setStencilMask`). Rendering output is unchanged.

## GL calls per frame (jrs, before -> after): identical

The individual setters were already de-duplicating, so the word only saves JS compares, not GL calls.

| scenario | bindTexture | useProgram | bindVAO | state | three bindTexture / state |
|---|---|---|---|---|---|
| shader-client | 171 -> 171 | 13 -> 13 | 763 -> 763 | 5 -> 5 | 171 / 5 |
| shader-client-static | 44 -> 44 | 16 -> 16 | 382 -> 382 | 33 -> 33 | 44 / 33 |
| shadows | 0 -> 0 | 3 -> 3 | 4 -> 4 | 8 -> 8 | 0 / 10 |
| many-materials | 0 | 0 | 601 -> 601 | 1 | 0 / 1 |
| others (batched) | 0 | 0 | 2 | 1 | 0 / 1 |

bindTexture and state counts are at or below three.js on every scenario (target met before and after).

## Medians (jrs ms, `--frames=60`)

| scenario | baseline | after (best of runs) | note |
|---|---|---|---|
| shared-static | 8.9 | 8.9 | |
| shared-animated | 12.5 | 13.4 | noise |
| many-materials | 8.7 | 10.1 | A/B below: neutral |
| unique-geometries | 4.3 | 1.7 | |
| hierarchy-animated | 19.6 | 9.2 | |
| instanced-100k | 0 | 0 | |
| shader-client | 9.0 | 6.2 (8.4 in a later run) | |
| shader-client-static | 45.7 | 49.3 (52.6 later) | three.js itself ranged 61-72 ms |
| shadows | 2.3 | 2.4 | |

The machine is noisy: three.js's own medians moved up to 2x between runs (shared-static 24-51 ms). Differences between the
baseline run and later runs, in either direction, should not be attributed to this change; the large "improvements" on
unique-geometries / hierarchy-animated take a code path where `setMaterial` is called a handful of times per frame and are
almost certainly run-to-run noise. Direct A/B (old vs new `WebGLState.js`, alternating, 3 rounds, jrs ms):
many-materials old 10 / 9.4 / 10.3, new 9.9 / 9.8 / 10.6; shared-static old 9.9 / 9.8 / 11.9, new 8.7 / 14.9 / 8.8. No difference.

## Validation

`npm test` 100/100; `bench/conformance.mjs`, `bench/addons.mjs`, `bench/smoke.mjs` pass. `run.mjs --compare`: meanAbsDiff/maxDiff
identical to baseline on every scenario (shared-static 0.347/8, shared-animated 0.346/9, shadows 0.134/33, rest 0/0).
Caveats: one full `--compare` run completed; a second full run died with a Playwright TimeoutError at shader-client, so
shader-client, shader-client-static and shadows were re-run separately. `bench/results/latest.json` was not committed.

## Risks

- A new setter on `WebGLState` that changes depth/blend/cull/colour-mask state must also clear `currentMaterialWord`, or the fast path could skip a needed call. External GL code calling `resetState()` is covered (`reset()` clears it).

## Follow-up ideas

- The remaining per-frame cost in shader-client is uniform uploads (1055) and VAO binds (763), not texture/state calls; sorting ShaderMaterial draws by geometry within a program would cut VAO binds.
- The trailing `bindVertexArray(null)` at the end of every `render` costs one call per pass; it exists to protect element-buffer updates and could be dropped if those are always done under an explicit VAO.
- Use a quieter machine or more frames/interleaved runs for A/B decisions; single-run medians swing more than the effect sizes here.
