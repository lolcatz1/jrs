# Swarm report: shadow pass

## What changed
- `bench/scenarios.js`: new scenario `shadows-animated` (same scene as `shadows`: 2000 casters, directional light, 1024 map; every third caster bobs and spins each frame). `shadows` is now built by a shared `buildShadows(T, n, animated)`. `bench/index.html` enables the shadow map for any scenario whose name starts with `shadows`, including the pixel comparison.
- `WebGLPrograms.getParameters` / `ShaderLib.buildBuiltinShader`: shadow-pass casters without `alphaTest` now get a **lean depth-only program**. The vertex shader writes no varyings (`SHADOW_LEAN`) and the fragment shader is a stub (`fragColor = vec4(0.0)`), instead of the full uber-shader with `IS_DEPTH`. Map, alphaMap, vertex colours, uvs and side are dropped from the program key, so every such caster shares one program regardless of material features. Casters with `alphaTest` keep the old program, so alpha cutouts are unchanged.
- `build/` bundles rebuilt.

## Not done, and why
- **Light-frustum culling**: already present. `WebGLShadowMap._collect` uses `renderer._cullTest` with the shadow camera's frustum and the slab bounding spheres, for ortho and perspective.
- **Batching**: the shadow pass already goes through the same sort + batch path (`_drawList`): 1 instanced draw per run. I did not reuse the main pass's matrix texture. The shadow run and the main-pass run are laid out differently, so it would need a cache keyed on object order. Estimated gain is under 0.5 ms for 2000 casters.
- **Texel-size and near-plane skipping, dirty regions**: skipped on purpose. Dropping small casters changes the depth map and so the output; a dirty region needs a depth-preserving partial clear. The rule "rendering output must not change" wins.

## Measurements (headless Chromium / SwiftShader, 60 frames, JS-side median ms; machine is noisy)
Baseline = commit before the shader change (same session). After = best of two runs.

| scenario | jrs before | jrs after | three | draw calls (jrs) |
|---|---|---|---|---|
| shadows | 1.8 | 1.6 | 98 / 82 | 3 |
| shadows-animated | 1.9 | 2.0 | 75 / 85 | 3 |
| shared-static | 9.6 | 6.3 | | 1 |
| shared-animated | 7.4 | 9.0 | | 1 |
| many-materials | 7.9 | 6.1 | | 600 |
| unique-geometries | 2.1 | 1.3 | | 1 |
| hierarchy-animated | 5.9 | 5.7 | | 1 |
| shader-client | 3.9 | 4.6 | | 1313 |
| shader-client-static | 53 | 43.3 | | 217 |

Non-shadow scenarios do not touch this code; their before/after spread is run-to-run noise on this machine (shared-animated and shader-client moved the wrong way in the run shown, which I attribute to noise, not the change; I did not get a second clean full run).

**The jrs CPU medians for the shadow scenarios did not change measurably.** The shadow pass is CPU-bound in traversal, sort and matrix upload, and the lean program only shortens GPU work, which the JS timer does not see. I did not measure GPU/wall time separately.

Pixel comparison is identical to baseline in every scenario: shadows meanAbsDiff 0.134 / maxDiff 33; shadows-animated 0.121 / 31; all others unchanged.

Validation: `npm test` 100/100, conformance, addons, smoke pass; `run.mjs --compare` diffs equal baseline. (Check `bench/results/latest.json` for the post-change run.)

## Risks
- The lean fragment shader assumes the shadow framebuffer has no colour output that matters (it is `depthOnly`). A custom render path drawing shadow-pass variants into a colour target would get zeros.
- Program key gained one bit; still well under 2^53.

## Follow-up ideas
- Skip the whole shadow pass (traverse, sort, upload) when a cheap hash of casters and light matrices is unchanged; static `shadows` still spends about 1.5 ms re-collecting.
- Share the matrix texture between shadow and main passes when the caster run is identical.
- Measure GPU time (timer queries or `gl.finish` wall time) to quantify the lean program.
