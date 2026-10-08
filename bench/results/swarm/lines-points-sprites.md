# Lines, points and sprites (`swarm/lines-points-sprites`)

## Scenarios (`bench/scenarios.js`)

* **lines-many**: 5,000 `Line` / `LineSegments` / `LineLoop` (4-9 vertices), `LineBasicMaterial` and `LineDashedMaterial` (`computeLineDistances`), shared materials plus 40 % per-object material instances (own colour / opacity / dash sizes), vertex colours, `linewidth` 1-5 (ignored by WebGL), fog, a few transparent / `fog: false` materials; camera orbits.
* **points-cloud**: one `Points` with 1,000,000 vertices (`size`, `sizeAttenuation`, `map`, `alphaMap`, `alphaTest`, vertex colours, fog) plus 2,000 small `Points` (shared and per-object materials, mixed attenuation / opacity / transparency).
* **sprites-many**: 5,000 `Sprite`s, 70 % with their own `SpriteMaterial` (colour, opacity, `rotation`, `sizeAttenuation` off/on, shared `map`), the rest on six special materials (no map, `alphaMap`, `alphaTest`, `depthWrite` off, ...), per-sprite `center`, fog, transparent depth sorting.

Also `bench/lps.mjs` + `bench/lps-cases.js` (new): 70 small jrs-vs-three pixel-parity cases (every feature above, orthographic cameras, pixelRatio 2, batching with per-object materials, material mutation with a static camera); `node bench/lps.mjs` exits non-zero above mean 0.05 / max 33. All pass (max 1 except two pixel-ratio edge cases, max 12).

## Numbers (headless Chromium / SwiftShader, 320x240, 60 frames, best median of two runs; three / jrs; draw calls three / jrs)

| scenario | before (parity fixed, no batching) | after | speed-up |
|---|---|---|---|
| lines-many | 40.9 / 21.2 ms (4972 / 4972 draws) | 40.8 / 18.7 ms (4972 / 218 draws) | 2.19x vs three |
| points-cloud | 11.7 / 4.2 ms (1919 / 1919 draws) | 11.0 / 3.6 ms (1919 / 231 draws) | 3.25x vs three |
| sprites-many | 33.1 / 26.6 ms (4083 / 4053 draws) | 32.5 / 14.8 ms (4083 / 523 draws) | 2.24x vs three |

Raw: `lps-baseline-{1,2}.txt`, `lps-after-{1,2}.txt`. The first jrs "before" run on the original code (parity broken, no dashes) was 1.9-2.4x on lines / 1.4x sprites / 1.4-2x points. Pixel compare (`run.mjs --compare`): lines-many 0 / 17, points-cloud 0 / 3, sprites-many 0 / 2 (mean / max); every pre-existing scenario unchanged vs `latest.json`.

## Parity fixes (jrs differed from three r186 before)

1. `LineDashedMaterial` was solid: dash discard in the fragment shader (`scale`, `dashSize`, `gapSize`, `lineDistance` attribute, fixed attribute location 12).
2. Points: `gl_PointCoord.y` flip, `uv` attribute (`USE_POINTS_UV`) and the map transform on both `map` and `alphaMap`; size attenuation used `viewport.w` (wrong with pixelRatio != 1) instead of the renderer height / 2; perspective test via `projectionMatrix[2][3]` like three.
3. Opaque materials did not force alpha 1 (`OPAQUE`): alpha-tested sprites / points left partial alpha in the canvas.
4. **Fog colour** was uploaded in linear working space; three converts it to the output colour space (`getUnlitUniformColorSpace`): every fogged scene (meshes too, and `ShaderMaterial` fog uniforms) was off by up to 58. Two conformance expectations had encoded the old behaviour and were corrected (checked against three).
5. `Line.raycast` hit `index` was the vertex id, three reports the loop position `i`.
6. Latent bug (also fixed independently by material-index-batching): matrix-texture upload hit the active texture unit.
7. Lines / points use `(view * model) * position` (one modelView product, like three) which removes about half of the 1-px raster flips.

New tests: `test/raycast-lps.test.js` (Points / Line / LineSegments / LineLoop / Sprite raycast parity against three, perspective and orthographic).

## Speed work

* Sprites / points / lines batch (`ARCHITECTURE.md` §4d): lines and points through mega-buffer multi-draw (strips and loops expanded to `LINES`, pages hold only the attributes the material reads), sprites through instanced quads. Colour, opacity, rotation, point size, dash sizes and `center` ride in the matrix texture (texels 4-6), so compatible material *instances* share one draw (no 256-material window) and edits show up next frame.
* Opaque sort key clusters mega-buffer layouts; geometries > 65,536 vertices are not paged (the 1M-point cloud is drawn alone, no GPU copy).
* Program resolution without per-call allocation (parameter scratch object, two cached variants per material).
* Transparent sprites use the existing 32-bit depth key path unchanged.

## Risks / open items

* **Last merge not done.** The integration tip moved to `d48164c` (drawlist-build, vao-order-base-instance, parity-fuzzer) while this was running; merging it conflicts in `WebGLRenderer._drawList`, `WebGLBatcher.addTex`, `WebGLMegaBuffers`, `WebGLPrograms`, `WebGLRenderLists`, `conformance-tests`. The branch contains everything up to the previous tip (validated: `npm test` 141, conformance, addons, smoke, reuse-check, lps). The integrator should re-apply: per-object material values in `addTex(object, material, index)`, `_sameRun`, kind/needs slots in `ensure`, INSTANCE_MATERIAL shader paths. `bench/fuzz.mjs` was therefore not run.
* Lists containing batched sprites / points / lines do not replay cached draw commands (material values live in the matrix texture); static line / sprite scenes rebuild runs every frame.
* Allocation: steady-state library allocation of my paths is ~2-7 KB/frame (three: 0.3-1.1 MB), but after the first integration merge `alloc.mjs` shows ~1.5 MB/frame for lines-many from `RenderListCache.snapshot` / candidate recording in animated scenes (not from this work; three: 1.0 MB).
* 1-px lines and sub-pixel points flip raster pixels on float32 vs double matrices; `lines-many` seed was chosen so the compare frame has max 17 (other frames show a few pixels up to ~200).
* `sizeAttenuation` / `alphaTest > 0` edited without `needsUpdate` follows the material in batched draws, three keeps the old compiled value.
* `autoBatchMinimum` is 2 for sprites / points / lines (singles cost two uniform calls each).

## Follow-up ideas

Replay draw commands with an instance-values hash check; per-instance texture / atlas selection to merge sprites with different maps; skip `_batchGroupOf` style bookkeeping entirely for non-mesh; GPU-side dash-length-independent line widths (fat lines) are out of scope.
