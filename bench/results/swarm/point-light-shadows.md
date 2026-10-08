# swarm/point-light-shadows

Point-light shadows with output identical to three.js r186 (the installed `three@0.186.1`).

## Important difference from the task text

The task describes three's point shadows as a 4x2 "cube in a 2D map" with a `MeshDistanceMaterial` RGBA distance pass. That is
no longer what r186 does (`node_modules/three/src/renderers/webgl/WebGLShadowMap.js`, `shadowmap_pars_fragment.glsl.js`):
a point light gets a `WebGLCubeRenderTarget` with a `CubeDepthTexture` (DEPTH_COMPONENT24, LinearFilter + `LessEqualCompare`
for PCF, Nearest and no compare for Basic), the six faces are rendered by the normal shadow pass, and the main pass samples it
with `samplerCubeShadow` (`getPointShadow`: viewSpaceZ -> perspective depth `dp`, five Vogel-disk taps rotated by interleaved
gradient noise). `PointLightShadow` is just a 90 degree `PerspectiveCamera`. I implemented what r186 does, since the
goal is pixel identity with r186. There is no distance-RGBA program: the hardware depth of a 90 degree perspective face is
exactly the value three compares against, so a depth-only caster program (the existing lean one) is used for all six faces.

## Implemented

* `CubeDepthTexture`, `WebGLCubeRenderTarget` (exported, three's names; `renderer.setRenderTarget(target, face)`,
  `getActiveCubeFace()`), cube framebuffer set-up and per-face attachment in `WebGLTextures`.
* Six-face pass in `WebGLShadowMap` (`_ensurePointMap`, `_poseFace`, `_renderPointFaces`): three's `_cubeDirections`/`_cubeUps`,
  `far = light.distance || camera.far`, `shadow.matrix = translation(-lightPos)`. Casters are gathered once per light
  (visible, layers, castShadow) and culled against each face's frustum; every face goes through the existing sort + batch + matrix
  texture path. The per-light signature skip of swarm/shadow-caster-cache applies to the whole cube (static scene: zero cost).
* Sampling code in the built-in fragment shader: `getPointShadow` for `PCFShadowMap` (ported verbatim) and `BasicShadowMap`
  (manual `step`), honouring `shadow.bias`, `normalBias` (vertex shader), `radius`, `mapSize`, `intensity`, camera `near/far`.
  The vertex shader outputs the light-to-fragment vector (same arithmetic as three's translation matrix), so no per-light matrix
  is stored.
* Lights block: `pointShadowParams[4]` (bias, normalBias, radius, intensity) and `pointShadowInfo[4]` (mapSize, near, far).
  Point lights are sorted shadow-casting first (like directional/spot). Shadow count is a compile-time constant of the program
  (like the others), so toggling `castShadow` recompiles once; adding point lights does not.
* `renderer.shadowMap.type` is part of the environment key and of the program key (switching Basic <-> PCF rebuilds the cube map
  and recompiles).
* Fix of a latent bug exposed by this work: `WebGLBatcher.uploadTexture` did `state.bindTexture(...)` and then `texImage2D`,
  but on a state-cache hit `bindTexture` does not activate the unit, so the matrix upload could land on whichever unit was
  active (here: INVALID_OPERATION and stale matrices, visible as garbage shadows as soon as two faces upload one after another).
  It now calls `state.activeTexture(unit)` first.
* Tests: `test/point-shadows.test.js` (unit), a conformance check in `bench/conformance-tests.js`, scenarios `shadows-point`,
  `shadows-point-animated`, `shadows-point-multi` in `bench/scenarios.js`; `bench/alloc.mjs` now enables shadows for every
  `shadows*` scenario.

## Cap (documented in README and ARCHITECTURE §10)

* At most **4** point lights cast shadows (`MAX_POINT_SHADOWS`); further `castShadow` point lights are lit without shadows.
* Each cube map needs a texture unit; they use the units of 8-14 left free by directional (8..) and spot (12..) shadow maps
  (`pointShadowUnit`). With 4 directional + 3 spot shadows none are left. Units 8-14 because unit 15 is the multi-draw matrix
  texture. three has no fixed cap, it is limited by `MAX_TEXTURE_IMAGE_UNITS`.

## Not implemented / differences

* `VSMShadowMap` for point lights: unsupported, the light renders without a shadow (three also warns and skips point lights in VSM).
* `BasicShadowMap` is implemented for point lights only; directional/spot lights still always use hardware PCF (pre-existing).
* Changing `shadow.mapSize` after the first render recreates the cube map (three keeps the old size until `dispose()`).
* three evaluates `shadowCameraFar` for the lights uniform before its shadow pass has applied `light.distance`, so on the very
  first frame it uses 500; jrs uses the applied value from the first frame.
* No `shadow.autoUpdate=false` special handling beyond what directional/spot have; `MeshDistanceMaterial`/`customDistanceMaterial`
  and `onBeforeShadow`/`onAfterShadow` hooks are not used by the shadow pass (same as the existing passes).
* `bench/fuzz.mjs` does not exist on the integration branch (it lives on the unmerged swarm/parity-fuzzer), so it was not run.

## Validation (all run on this branch after merging origin/claude/threejs-performance-fork-vfqpcw)

* `npm test`: 123 pass (6 new). `node bench/conformance.mjs`, `node bench/addons.mjs`, `node bench/smoke.mjs`: exit 0.
* Conformance "Point light shadow map (cube depth, PCF and BasicShadowMap)": PCF and Basic shadow under a box on a floor
  `[87,87,87]` vs lit `[255,255,255]`, wall shadow `[87,87,87]` vs lit `[245,245,245]`, second casting light keeps its own map; no GL errors.
* Pixel comparison against three (`node bench/run.mjs --compare --frames=60`), all existing scenarios unchanged
  (shared-static 0.347/8, shared-animated 0.346/9, shadows 0.134/33, shadows-animated 0.121/31, all others 0/0):

  | scenario | meanAbsDiff / maxDiff |
  |---|---|
  | shadows-point (2 000 casters, one point light) | **0 / 0** |
  | shadows-point-animated (a third of the casters move) | **0 / 0** |
  | shadows-point-multi (directional + spot + two point shadows + one unshadowed point light) | 0.193 / 41 |

  `shadows-point-multi` is not required to meet the 0.5 / 33 budget; its residual comes from the directional and spot shadows
  (existing 3x3 PCF vs three's Vogel kernel): with only point shadow lights the scene is 0 / 0, with the added spot 0.038 / 27,
  with the added sun 0.017 / 11. Asymmetric ad-hoc scenes with the light on each of the six sides (not committed) were within 1/255 of three.

## shadows-point medians (ms per frame, software WebGL2 in headless Chromium, 60 frames, two runs)

| | three | jrs |
|---|---|---|
| shadows-point, run 1 | 90.6 | 0.9 |
| shadows-point, run 2 | 94.4 | 0.9 |
| shadows-point-animated | 88.0 / 83.5 | 1.9 / 2.9 |
| shadows-point-multi | 66.2 / 63.9 | 0.6 / 0.6 |
| shadows-point, final run after the last integration merge (skinning/morph, render-list reuse) | 85.1 | 0.4 |
| shadows-point-animated, same run | 77.5 | 2.3 |

The software-GL timer is noisy (the static scene measured 0.4-1.5 ms across runs); the best medians are 85.1 ms (three) and 0.4 ms (jrs).

Draw calls 4001 -> 2 (3 animated). The static scene skips the whole six-face pass via the signature, so 0.9 ms is the main pass; the
animated scene (with the light above the grid, so nearly all casters fall in the -Y face and the other faces cull to a few) is the
pass actually running: 1.9-2.9 ms. Allocation (`bench/alloc.mjs shadows-point-animated --lib=jrs`): 28 KB/frame, of which 14 KB is
`Matrix4.invert` boxing doubles in cold code (six face cameras per frame); my own code allocates nothing per frame after the caster
array is warm (the first version allocated 34 KB/frame through `array.length = 0`, fixed).

## Program key

The integer program key (`WebGLPrograms.getParameters`) reached 2^53 on the integration branch already (skinning + morph fields) and
my point-shadow fields made it ~2^57, which would silently merge programs that differ only in their low bits (morph target count).
The base part of the key (material type ... `leanShadow`, ~39 bits) is now interned to a small id (`_baseKeyIds`), and the remaining
fields are packed under it; lookups are still `Map.get(number)`.

## Risks

* Scenes where many casters fall in several faces pay six culling passes plus up to six matrix-texture uploads per frame
  (static scenes skip the pass entirely). The per-object frustum cull cache is keyed on frustum version, which changes on every
  face, so it does not help the six-face loop (it is correct, just recomputed).
* Texture-unit sharing: a program compiled with N dir / M spot / K point shadows assumes that layout; counts are renderer-wide so
  they are consistent, but a custom `ShaderMaterial` that hard-codes units 8-14 would collide (as it already could with dir/spot maps).
* Float32 matrices (jrs) vs doubles (three) can flip pixels right at a shadow edge; not seen in any committed scene (0 / 0).

## Follow-up ideas

* Per-face dirty tracking (skip faces whose casters did not change) and a light-bounding-sphere prefilter in `_gather`.
* Compute the six face view matrices analytically (rigid transform) instead of six generic inversions.
* Directional/spot Vogel-disk PCF and `BasicShadowMap` to close the 0.134 mean gap and finish the shadow-type matrix.
* Support more than 4 point shadows via a cube-map array texture (`samplerCubeArrayShadow` is not in WebGL2, so this needs an atlas).
