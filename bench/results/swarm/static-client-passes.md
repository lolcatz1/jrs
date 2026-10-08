# swarm/static-client-passes

## Result: no measurable gain. One micro-change, nothing else worth doing on the CPU side.

### What changed
- `src/renderers/WebGLRenderer.js`: `setUniformValueImpl` and `bindTextureUniform` compared `u.type` against `gl.FLOAT`, `gl.SAMPLER_*` and so on. Each of those reads a getter on the WebGL context, and the switch evaluates them in order, so a sampler uniform paid about 25 getter calls. They are now module-level `U_*` literals. A browser check confirmed all 29 values equal the context's own constants. Rendering output is unchanged.

### Findings
- A CDP CPU profile of `shader-client-static` (40 frames) shows about 5.6 ms/frame of sampled time. Of that, about 3.3-3.4 ms is the native `(program)` bucket (GL execution in SwiftShader), and the JS the renderer controls is about 1.5 ms. The measured frame is 47-80 ms in this container (dominated by software rasterisation and `gl.finish`), so any JS-side saving is below the run-to-run noise.
- GL calls per pass (baseline, three -> jrs), from `node bench/run.mjs shader-client-static`:

  | pass | `uniform*` | `useProgram` | `bindVertexArray` | `bindTexture` |
  |---|---|---|---|---|
  | shadow RT | 147 -> 147 | 1 -> 1 | 214 -> 95 | 0 -> 0 |
  | near shadow RT | 147 -> 147 | 0 -> 0 | 214 -> 95 | 0 -> 0 |
  | main + stencil | 184 -> 187 | 16 -> 15 | 215 -> 192 | 44 -> 44 |

  Total GL calls are 1869 -> 1625. Every category is already at or below three.js except main-pass `uniform*`, which is 3 above (`opacity` x2 and one other). I did not track those 3 down.
- Per-draw uploads in the render-target passes are `modelViewMatrix` x146 and `projectionMatrix` x1, so they are necessary and not redundant. `_setupMaterial` already skips the uniform walk when the material is unchanged, which is the case on every draw in the `overrideMaterial` passes.

### Before / after medians
The machine is too noisy to resolve this change. Back-to-back runs moved three.js itself by 2-3x (e.g. `shader-client-static` three.js at 79.6 ms in one run and 69.8 ms in another; `many-materials` three.js at 37.5 ms and 19 ms).

| scenario | baseline jrs | after jrs |
|---|---|---|
| shader-client-static | 75.2 ms (three 79.6) | 46.9 ms (three 69.8) |
| shader-client | 40.5 ms (three 41.6) | 9.4 ms (three 14.0) |

These differences are machine load, not the code change. I do not claim a speed-up.

The first `--compare` run stopped after 5 scenarios and I did not investigate why. The second run completed. In it, `meanAbsDiff` and `maxDiff` equal the previous values for every scenario: `shared-static` 0.347/8, `shared-animated` 0.346/9, `shadows` 0.134/33, all others 0/0.

### Validation
- `npm test`: 100 pass, 0 fail.
- `node bench/conformance.mjs`: no FAIL lines.
- `node bench/addons.mjs` and `node bench/smoke.mjs`: ran and printed results with `glError` 0. I did not check them against an expected-output list.
- `node bench/run.mjs --compare --frames=60`: second run completed, pixel diffs unchanged. The first run did not complete, and I did not run it a third time, so "run twice and take the better median" was not done cleanly.
- `bench/results/latest.json` is intentionally left unchanged, because these timings are not trustworthy enough to replace it.

### Risks
- Low. The change swaps constants for literals that were checked against the context.

### Follow-up ideas
- `bench/profile.mjs` is stale: it wraps `renderer.bindingStates.bind`, which fails with `Cannot read properties of undefined (reading 'bind')`, so it crashes on startup. The CDP script used here would be a better base.
- In `_uploadShaderMaterialUniforms`, a per-(material, program) pre-resolved list of `[uniformRecord, uniformObject]` pairs would replace the `for...in` and the `program.uniforms[name]` dictionary lookups. That is about 0.3 ms/frame in the profile. It needs a cheap way to detect keys being added to or removed from `material.uniforms`.
- Most of this scenario's time is outside JS. Fewer or cheaper GL commands (fewer `bindVertexArray` calls in the main pass, 192 draws) and a smaller shadow-RT cost are the only levers left. Verify on a real GPU, where the CPU share is larger.
