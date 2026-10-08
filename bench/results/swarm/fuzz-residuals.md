# Fuzz residuals (swarm/fuzz-residuals)

Follow-up to `bench/results/swarm/parity-fuzzer.md`: the differential fuzzer (`node bench/fuzz.mjs`, same
random scene with three.js r186 and jrs, pixels compared per frame) still had 12 slightly differing seeds
in 1-200 after that night's 17 fixes. This branch root-caused the three open classes, found two more
real renderer differences on the way, implemented the double-precision modelViewMatrix evaluation the
report asked for, and swept seeds 1-600.

Branch: `swarm/fuzz-residuals` = integration tip `6858f51` + `origin/swarm/parity-fuzzer` (merged here,
four conflict hunks resolved; see the merge commit) + the commits below, then the integration tip merged
three times more (round 4 `7cb3b47`; round 5 `03b5251`: flat scene update, ShaderMaterial batching,
environment maps, texture formats; round 6 `9290f22`: lines / points / sprites, skinning-perf). In the
round-6 merge, batched lines and points keep the integration's `( viewMatrix * model ) * position`, per-object
lines and points take this branch's CPU modelViewMatrix (`bench/lps.mjs`: all cases within tolerance), the
diffuseColor block keeps `IS_SHADOW_PASS` / `IS_DEPTH`, `INSTANCE_MATERIAL` and `pointUv`, both alpha-test
forms are kept, and `getParameters` assigns `alphaTest` / `alphaTestHalf` on the reusable parameters object. Round 5 and this branch both grew the material record: the merged record is 28
vec4 (the env-map fields, then the 16 vec4 of per-map transforms); round 5 had also made the same
render-target tone-mapping and OPAQUE fixes as fixes 1-2 here, so those hunks took the integration's
text. One merge slip (a lost `#endif` between the per-map varyings and `vHighPrecisionZW`) broke every
program and was caught by conformance / the fuzzer before the push; see the merge-fix commit.

## Root causes fixed (one commit each, seeds in the message)

1. **Opaque materials wrote the mapped alpha into the framebuffer** (seed 23; also seeds 93 and the rest
   of the "render-target-textured surfaces" group that was really this). three.js's `opaque_fragment`
   chunk forces `diffuseColor.a = 1.0` when the material is opaque (`transparent === false`,
   `NormalBlending`, no `alphaToCoverage`), so an opaque surface with a checker map whose alpha is 0.5
   leaves alpha 1 in the canvas. jrs wrote the map's alpha. Nothing shows until a later transparent draw
   reads `DST_ALPHA`: seed 23's custom blend (`ReverseSubtract`, `DstAlpha` / `OneMinusDstAlpha`) gives
   exactly black in three.js (alpha 1) and a faint colour in jrs (alpha 0.54). The per-draw pixel trace
   found it in one shot: after the opaque Phong draw three.js's pixel was `83,158,130,255`, jrs's
   `83,158,130,138`. Fix: an `opaque` program parameter with three's condition (`WebGLPrograms`),
   `#ifdef OPAQUE diffuseColor.a = 1.0` before the colour is written (`ShaderLib`, lit/unlit and
   MeshNormalMaterial); the depth materials write the opacity like three's depth shader; the
   ShaderMaterial `OPAQUE` define now uses the same condition instead of `transparent === false` alone.
   Why the old isolation missed it: hiding objects with `visible = false` also hides nested child
   meshes, and the custom-blend draw only reads what an opaque draw left behind.
2. **Tone mapping was applied when rendering into a render target** (seeds 28, 142, 192). three.js
   tone-maps only when drawing to the canvas (or an XR target); jrs tone-mapped every draw, so the
   fuzzer's sub-scene rendered into a `WebGLRenderTarget` came out scaled by the exposure (2x brighter at
   exposure 2.17, 2x darker at 0.49), and every surface textured with it differed by up to 138 levels.
   The "render target" seeds were two different bugs (this one and the alpha one above); reading the
   render target back with `readRenderTargetPixels` in both libraries separated them.
3. **Shadow casters with alphaTest and vertex colours had holes in their shadow** (seed 160). three.js
   draws casters with a `MeshDepthMaterial` that copies only `map`, `alphaMap` and `alphaTest` (0.5 for
   `alphaToCoverage`) from the caster; its depth shader has no vertex-colour chunk and ignores opacity.
   jrs's alpha-tested shadow program multiplied the caster's RGBA vertex colours in, so vertex alphas
   below the alphaTest discarded depth fragments. The shadow program now starts from alpha 1 and applies
   map / alphaMap / alphaTest only; a caster without a map to test shares the lean depth program
   (`leanShadow` no longer depends on alphaTest alone); `MeshDepthMaterial` and `MeshNormalMaterial`
   skip vertex colours (and alphaTest for the normal material) like three's shaders. Found by
   perturbation: the same mesh cast a correct shadow with its ShaderMaterial group and a wrong one with
   the Standard material, and the only GL-state difference between the two shadow-pass draws was the
   program's `USE_COLOR` / `USE_ALPHATEST`.
4. **Per-object draws now use a CPU double-precision modelViewMatrix** (seeds 27, 145; the `--strict`
   edge-pixel class, see the next section). Wireframe lines drawn by a ShaderMaterial (three's
   `projectionMatrix * modelViewMatrix` path, which jrs already used for custom shaders) over the same
   edges drawn by a built-in material (`viewMatrix * (modelMatrix * position)` in float32 on the GPU)
   got depths a few ULP apart, and the `LEQUAL` test picked a different winner than in three.js: whole
   line segments appeared or vanished (seed 27: 19 pixels; seed 145: the overlapping lines of a
   wireframe box, 55 pixels, mean 0.154).

5. **One uv transform per map** (seed 93 once the integration branch's per-frame mutations were merged;
   the fuzzer's `perMapTransform` feature, excluded by the parity-fuzzer report). three.js has
   `mapTransform`, `alphaMapTransform`, ... per map; jrs applied the first map's offset / repeat /
   rotation to every map. The new "map" mutation assigns another pool texture as `map` while the
   `alphaMap` keeps its own transform, so the instanced Phong of seed 93 sampled its alpha through the
   wrong transform from frame 4 on (mean 0.38; RGB right, alpha wrong, visible through the custom blend).
   The material block now carries one 2D affine per map (two vec4 each in `MAP_KEYS` order; the record
   grows from 8 to 24 vec4 = 384 bytes and the stride is rounded up to the UBO alignment instead of
   `max(size, alignment)`, which would have mis-aligned a 384-byte record on a 256-byte alignment), the
   vertex shader writes one varying per map in use (`vAlphaMapUv`, `vNormalMapUv`, `vEmissiveMapUv`,
   `vRoughnessMapUv`, `vMetalnessMapUv`, `vAoMapUv`, `vSpecularMapUv`; `map` keeps `vUv`), points apply
   the alphaMap transform in the fragment shader. The record sync compares only the maps the material
   has (a bitmask of present maps; a material without maps never touches the new 64 floats): the
   many-materials CPU frame (5000 materials) is unchanged on `bench/cpu-stubbed.mjs` (first version
   without the mask cost 10%). `perMapTransform` is on by default in the fuzzer now: 97 of seeds 1-100
   pass with it (the three failures are the edge-pixel seeds 63, 65, 85).

Seed 93 (shared transparent material between an InstancedMesh and a grouped mesh) passes after fix 1;
it was the `DST_ALPHA`-dependent blend again. Seeds 23 and the "overrideMaterial" theory for 145/27
were wrong leads: suppressing the override frames changed nothing (the probe has an experiment for it).


## Fuzz results, seeds 1-600 (6 frames, 320x240, default feature set, `--continue`)

All runs: 6 frames per seed, 320x240, default feature set, `--continue`. "Generator A" is the fuzzer as
merged from `swarm/parity-fuzzer`; "generator B" is the integration branch's round-4 fuzzer with
per-frame mutations (meshes hidden / added, colours, maps, fog, exposure, ... changed between frames),
which draws different scenes for the same seed.

| Code | Generator | 1-300 | 301-600 | Total failing |
|---|---|---|---|---|
| merge of parity-fuzzer into integration 6858f51 (before this branch) | A | 29 | 30 | 59 / 600 |
| + fixes 1-4 | A | 7 | 11 | 18 / 600 |
| + merge of integration round 4 (7cb3b47) | B | 8 | 10 | 18 / 600 (seed 93 is fix 5's case) |
| + fix 5, `perMapTransform` on | B | 3 of 1-100 (63 65 85) | not re-run | see the 1-100 row | | |

Failing seeds with fixes 1-4, generator A: 63 65 85 198 226 248 264 | 311 325 340 348 369 433 441 455
459 480 534. Generator B: 63 65 85 93 198 226 248 264 | 311 340 348 369 421 441 455 459 480 534. Every
one of them except 93 is in the table of the next-but-one section (edge pixels and lines); 93 is fixed.

`--enable=perMapTransform`, seeds 1-100, fix 5: 97 pass, 63 65 85 fail (edge pixels). Before fix 5 the
feature was off by default and documented as a known gap.


## The float32 edge-pixel class and the double-precision modelViewMatrix

`--strict` (no allowance for isolated edge pixels) failed 23 of seeds 1-100 before this branch: single
pixels along object, line and shadow edges where jrs's clip-space position differs from three's in the
last float32 bits. The parity-fuzzer report blamed the GPU multiply order (`viewMatrix * (modelMatrix *
position)` versus three's `modelViewMatrix` built in doubles and rounded once) and asked whether a CPU
double-precision modelViewMatrix for non-batched draws is affordable.

What was implemented (commit "Per-object draws use a CPU double-precision modelViewMatrix"):

* `_renderItem` builds `view * world` in doubles (`multiplyViewWorld`, same operation order as
  `Matrix4.multiplyMatrices`) into a Float32Array scratch and uploads it as `modelViewMatrix`, behind the
  existing uniform cache: the product is skipped when the same object is drawn again in the same list
  (groups, two-pass DoubleSide; `_viewStamp` bumps per `_drawList`), and `cacheArray` compares before the
  GL call, so a static frame uploads nothing new. The built-in vertex shader computes
  `modelViewMatrix * ( instanceMatrix * position )` (InstancedMesh) or `modelViewMatrix * position`;
  batched draws (matrix texture, `USE_OBJECT_TEXTURE`) keep `viewMatrix * worldPosition`. Sprites use
  `modelViewMatrix` for their anchor like three's sprite shader. The lean shadow program no longer
  needs `modelMatrix` at all (the compiler drops it), so the shadow pass swaps one upload for another.
* Camera precision, found while measuring: the camera's `matrixWorldInverse` differed from three's in 8
  of 16 float32 elements. `Object3D.lookAt` built its rotation in a float32 scratch matrix and read the
  world position from the float32 world matrix; it now uses a double-precision scratch and the
  double-precision `position` when the object is at the root or under an untransformed Scene. The
  camera composes its inverse in doubles under an untransformed Scene too (not only when parentless),
  keeps the unrounded inverse (`_viewInverse64`) for the renderer's product, and falls back to the
  float32 elements when an app wrote `matrixWorldInverse` itself (16 `fround` compares per list).

What it buys, seeds 1-100 with `--strict` (6 frames each):

| Code | strict failures |
|---|---|
| before (merge of parity-fuzzer, fixes 1-3 applied) | 23 |
| + CPU modelViewMatrix | 20 |
| + camera / lookAt precision | 17 |

Seeds 27 and 145 pass in the default mode (145 pixel-identical, 27 down to 2 edge pixels). The class
is reduced, not removed, and cannot be removed this way: jrs stores every world matrix (and the camera's
local matrix) in a float32 slab, so `view * world` is `fl(view64 * world32)` against three's
`fl(view64 * world64)`; the probe (`expmv`) shows 3 of 16 modelViewMatrix elements still differing by one
float32 ULP for a root-level object, which is enough to move a line or edge by one pixel somewhere in a
few percent of frames. Batched draws (most "mostly shared geometry+material" seeds) never took the CPU
path and keep the old GPU order. Every remaining strict failure in 1-100 is a swap of two neighbouring
colours at an edge or along a line (seeds 3, 8, 9, 12, 15, 27, 35, 37, 63, 65, 68, 78, 80, 82, 85, 87, 99
after the change).

What it costs: nothing measurable. The GPU-side benchmark on this container was too noisy to resolve it
(three.js's own medians moved 30-60% between identical runs), so the cost was measured with
`bench/cpu-stubbed.mjs` (draw calls stubbed, CPU time per frame), A/B interleaved twice, the no-modelView
tree in a separate git worktree:

| scenario (cpu ms/frame, median; best) | without, run 1 | with, run 1 | without, run 2 | with, run 2 |
|---|---|---|---|---|
| dynamic-geometry (200 per-object draws) | 1.69; 1.01 | 1.28; 0.86 | 1.28; 0.88 | 1.35; 0.99 |
| hierarchy-animated | 6.00; 4.71 | 6.21; 4.78 | 6.02; 4.61 | 5.65; 4.54 |
| skinned-crowd (200 per-object skinned draws) | 5.16; 3.06 | 4.94; 3.92 | 4.96; 3.23 | 5.39; 3.47 |
| shader-client | 1.49; 0.88 | 1.38; 0.92 | 1.25; 0.86 | 1.58; 0.87 |
| unique-geometries | 0.46; 0.42 | 0.51; 0.46 | 0.53; 0.44 | 0.57; 0.44 |

The arithmetic is 64 multiply-adds and a 16-element compare per non-batched draw whose object or camera
moved (about 50 ns); per-object draws also carry one more `uniformMatrix4fv` (modelViewMatrix next to
modelMatrix and normalMatrix, the three uploads three.js makes) when the object moved. Static frames
upload nothing new, as before (`shader-client-static` is unchanged in the GL-call counts).


## Remaining open seeds

Every remaining failure in 1-600 was traced to its draw. All of them are the float32 class, made visible
by wireframe lines or by two surfaces meeting at an edge; none is a renderer-state difference:

| Seeds | What the trace shows |
|---|---|
| 63, 226, 248, 264, 441, 455, 459, 480, 534 | wireframe lines (`drawElements(LINES)`): two groups of one mesh draw the same edge in opposite directions, or lines of different groups / instances cross; at a shared pixel the depth test (`LEQUAL`) or the coverage of the diamond-exit rule is decided by the last ULP of the interpolated depth, and with Subtractive / Additive / Multiply blending (248: 26 instances of a transparent wireframe, 986 pixels at ≤ 43 levels) every extra or missing overlap shows as a small shade difference |
| 65, 85, 198, 311, 325, 340, 348, 369, 433 | adjacent pixels swap between the two neighbouring surfaces' colours (an object edge, mostly batched draws and InstancedMesh with instance colours) |

They fail the default tolerance only because more than 8 pixels per frame are involved (10-70). A caster
or receiver that is pixel-identical in isolation stays identical in the scene; the "interaction"
explanation of the earlier report does not hold for any of them.

Before this branch 18 of 200 seeds failed (parity-fuzzer report) and 59 of 600 with the same code; after
it 18 of 600 fail, all of the class above. The fuzzer's `--bad-pixels` allowance is the honest knob for
them; raising it to 80 would make 1-600 pass, which the report does not recommend, because it would
also hide the next real one-draw bug of that size.


## Validation

On the commit before the round-5 merge (integration round 4 + fixes 1-5), this container (headless
Chromium / SwiftShader):

* `npm test`: 139 / 139.
* `node bench/conformance.mjs`: 35 / 35 (`node bench/conformance.mjs` of the integration tip: 35 / 35).
* `node bench/smoke.mjs`, `node bench/addons.mjs` (after `npm run build`): pass, GL error 0.
* `node bench/fuzz.mjs --seeds=100 --continue`: 97 pass, 3 failing (63 65 85: edge pixels, see "Remaining open seeds"); `--enable=perMapTransform` is now the default, so this run also covers per-map transforms.
* `node bench/run.mjs --compare --frames=60` (pixel columns against `bench/results/latest.json` of the
  integration tip; every row at or below the baseline, skinned-crowd's max 2 -> 1):

  | scenario | three ms (file / this run) | jrs ms (file / this run) | mean / max diff (file) | mean / max diff (this run) |
  |---|---|---|---|---|
  | dynamic-geometry-large | 2.9 / 1.8 | 2.3 / 2.7 | 0 / 0 | 0 / 0 |
  | dynamic-geometry | 1.3 / 1.7 | 1.6 / 1.9 | 0 / 0 | 0 / 0 |
  | shared-static | 11.3 / 18.7 | 1.3 / 0.9 | 0 / 0 | 0 / 0 |
  | shared-animated | 11.6 / 30.5 | 4.8 / 6.4 | 0 / 1 | 0 / 1 |
  | many-materials | 9.6 / 11.3 | 0.7 / 0.7 | 0 / 0 | 0 / 0 |
  | unique-geometries | 4.5 / 5.4 | 0.5 / 0.6 | 0 / 0 | 0 / 0 |
  | transparent-sort | 11.7 / 24.6 | 3.2 / 3.8 | 0 / 0 | 0 / 0 |
  | hierarchy-animated | 13.7 / 38.5 | 3.5 / 5.2 | 0 / 0 | 0 / 0 |
  | instanced-100k | 0.1 / 0.1 | 0 / 0 | 0 / 0 | 0 / 0 |
  | shader-client | 3.9 / 5.4 | 2.4 / 2 | 0 / 0 | 0 / 0 |
  | shader-client-static | 31.9 / 49.8 | 25.4 / 51.6 | 0 / 0 | 0 / 0 |
  | skinned-crowd | 3.3 / 4.6 | 4.8 / 4.1 | 0 / 2 | 0 / 1 |
  | shadows | 69 / 83.2 | 0.5 / 0.4 | 0 / 0 | 0 / 0 |
  | shadows-animated | 65.4 / 94.4 | 1.1 / 1.4 | 0 / 0 | 0 / 0 |
  | shadows-point | 77.5 / 82.1 | 0.3 / 0.6 | 0 / 0 | 0 / 0 |
  | shadows-point-animated | 71.1 / 80.1 | 1.5 / 2.9 | 0 / 0 | 0 / 0 |
  | shadows-point-multi | 46.1 / 59 | 0.4 / 0.3 | 0 / 1 | 0 / 1 |

  Medians: this container ran about 2x slower than when the baseline file was recorded (three.js's own
  medians: shared-static 11.3 -> 18-20 ms, hierarchy-animated 13.7 -> 28-39 ms, shadows 69 -> 86-90 ms),
  so the "no median regresses beyond 5%" rule was checked by A/B instead of against the file:

  - GPU-side, integration tip (`origin/claude/threejs-performance-fork-vfqpcw` in a worktree) vs this
    branch (fixes 1-4), two interleaved rounds of `bench/run.mjs <scenarios> --compare --frames=60`:

    | scenario (jrs median ms) | tip 1 | branch 1 | tip 2 | branch 2 |
    |---|---|---|---|---|
    | hierarchy-animated | 4.8 | 6.4 | 8.5 | 7.4 |
    | shared-animated | 10.5 | 8.6 | 7.8 | 8.7 |
    | shader-client-static | 47.4 | 48.5 | 38.7 | 43.2 |
    | skinned-crowd | 4.4 | 7.8 | 4.6 | 4.7 |
    | dynamic-geometry | 2.0 | 1.4 | 1.4 | 1.3 |
    | transparent-sort | 5.5 | 7.1 | 5.2 | 5.5 |
    | shader-client | 2.5 | 3.1 | 3.3 | 2.2 |

    three.js's medians in the same runs moved by the same amounts (hierarchy-animated 27.5 / 29.7 / 31.6 /
    29.5), so none of this is resolvable; nothing is consistently slower.
  - CPU-side (`bench/cpu-stubbed.mjs`, draws stubbed), the measurement that can resolve a per-draw
    cost: the modelViewMatrix table in the section above (five scenarios, within noise) and the
    per-map-transform check (many-materials, 5000 materials, three interleaved rounds: without 0.512 /
    0.480 / 0.512 ms best, with 0.484 / 0.496 / 0.504 ms).

After the round-5 merge (final pushed state): `npm test` 168 / 168, `node bench/conformance.mjs` 44 / 44, smoke and addons pass, seeds 23, 27, 28, 93, 142,
145, 160, 192 pass, `node bench/fuzz.mjs --seeds=100 --continue` 96 pass / 4 failing (63 85: edge pixels; 12 78:
edge-class seeds that also fail on the integration tip `03b5251` itself, with more pixels there, 39 / 20 vs
25 / 14 here), `node bench/run.mjs --compare --frames=60`: all 18 scenes (now including pbr-envmap) at or
below the round-5 baseline's mean / max diff (skinned-crowd 2 -> 1); medians within this container's
noise band against the baseline file (three.js's own medians move 10-30% between the two runs).

After the round-6 merge (final pushed state): `npm test` 179 / 179, conformance 44 / 44, smoke and addons
pass, `node bench/lps.mjs` all cases within tolerance, `node bench/flat-check.mjs` 328 frame pairs
pixel-identical with the two "list was never reused (same=0)" failures that the integration tip `9290f22`
reports as well (pre-existing, not this branch's), seeds 23 27 28 93 142 145 160 192 pass, fuzz 1-100: 96
pass (12 63 78 85 as before; the tip fails 8 12 27 in 1-30), fuzz 1-30 with `--enable=points,lines`: 9 12
14 27 fail here and on the tip (tip worse or equal: seed 14 mean 0.215 there, 0.144 here; the lines /
points feature's own residuals). `node bench/run.mjs --compare --frames=60`: all 23 scenes at or below
the round-6 baseline's mean / max diff (skinned-crowd 2 -> 1, morph-crowd 1 -> 0). skinned-crowd's jrs
median looked slow in that run (5.1 ms vs the baseline file's 1.6), so it was A/B'd against the tip on
this container: tip 2.1 / 3.1 ms, this branch 2.4 / 2.4 ms (skinned-crowd-large 28.4 / 25.8 vs 27.4 /
28.6; CPU-stubbed 3.19 vs 3.29 ms): noise, no regression.

Note for the integrator: `origin/swarm/per-map-transform` implements the same feature as fix 5 in
parallel; whichever lands second needs a merge of the material-record layout (this branch: 16 vec4
`mapUv[16]` after the env-map fields, synced by `syncMapUv` in `_syncMaterialBlock`, read through
`applyMapUv` and one varying per map).

`bench/results/latest.json` is left as the integration tip's file (the numbers from this container
would only record the slower machine); `build/` is not committed.


## Risks

* Fix 1 (`OPAQUE`) changes what every opaque built-in material writes into the alpha channel: 1.0
  instead of the mapped / vertex alpha. That is three.js's behaviour and matters for apps reading the
  canvas or a render target's alpha, and for custom blends that use `DST_ALPHA`; `premultipliedAlpha`
  canvases now composite opaque surfaces like three.js. A material with `blending` other than
  `NormalBlending` or with `alphaToCoverage` keeps writing its real alpha (same as three.js).
* Fix 2 removes tone mapping inside render targets. Apps that relied on jrs tone-mapping a post-process
  chain written into a render target now get linear values there, exactly like three.js (which expects
  the final pass to tone-map).
* Fix 3 narrows the shadow program's inputs. A caster with vertex-colour alpha and alphaTest no longer
  cuts its shadow with the vertex alpha. Point-light (distance) shadow casters go through the same
  parameters; the fuzzer's point-shadow seeds pass, but the distance pass was not probed separately.
* The modelViewMatrix change adds a 16-float uniform upload per moved per-object draw (not for batched
  draws) and a 64-multiply product per such draw. Measured as noise on the CPU-stubbed benchmark; the
  GPU-side benchmark on this container could not resolve it either way (see Validation). `Camera.
  _updateInverse` now composes the inverse from the TRS when the camera sits under an untransformed
  Scene, which is where three.js's and jrs's values differed; a camera whose parent chain carries a
  transform still takes the float32 world matrix (unchanged behaviour).
* `Object3D.lookAt` reads the double-precision `position` for root / untransformed-scene objects. If an
  app sets `matrix` by hand with `matrixAutoUpdate = true` and expects `lookAt` to use the matrix's
  translation, it gets the position instead (three.js uses the world matrix, which for such an object
  three computes from the position anyway, so this follows three.js).
* The material record is now 28 vec4 (448 bytes; 512 with a 256-byte UBO alignment) instead of the 8 vec4
  this night started with (round 5 added 4 for environment maps, fix 5 added 16). The material-array
  batching window (`MAX_UNIFORM_BLOCK_SIZE / stride`) shrinks accordingly: with 65536 / 512 it is 128
  records (was 256, capped), with the 16384 minimum it is 32. A material-array batch spanning more
  distinct materials than the window splits into more draws; `many-materials` (5000 materials) still
  renders in 0.7 ms here. If that window matters more than exact per-map transforms, the transforms
  could move to a 2D float texture fetched in the vertex shader (no record growth).
* The merge with the integration tip resolved three hunks (`V_SIDE` comment, `_itemDepth` comment and
  bounding-sphere branch, `WebGLPrograms` imports / tone-mapping line); the integration's version was
  taken for the renderer hunks, this branch's for the tone-mapping fix.
* `build/` is not committed on this branch (rebuilt locally for `bench/addons.mjs`); run `npm run
  build` after merging, as the parity-fuzzer report also asks.


## Follow-up ideas

* **Double-precision world matrices for per-object draws** would close the strict class for
  non-batched draws: 128 bytes per object kept next to the float32 slab, written by `updateMatrixWorld`
  (a second multiply per object per frame in the hot traversal). Measure before doing it; the slab
  worker's numbers are the baseline. Batched draws would still differ (their matrices come from the
  float32 matrix texture).
* **Batched draws could multiply `viewMatrix * model` on the GPU before applying it to the position**
  (one mat4 product per vertex): not bit-identical to three either, but the same rounding structure.
  Not done because it is not obviously closer and costs vertex work on the largest draws.
* **Opaque draw order**: three.js sorts opaque items by material id then by depth; jrs groups by
  program / material in first-seen order. Depth-equal fragments (wireframe over its own solid faces,
  coplanar decals without polygonOffset) resolve differently. The fuzzer gives order-dependent
  materials unique renderOrders and so does not see it; an app that draws a wireframe overlay over
  the same mesh does. A per-frame rank by `material.id` inside the opaque key would match three.js at
  no batching cost (it only changes the order of material runs); worth a look if a user hits it.
* `perMapTransform` (per-map `offset/repeat/rotation`) and `shaderFog` stay off in the fuzzer
  (parity-fuzzer report); still the two largest known feature gaps.
* The probe scripts (per-draw pixel trace, greedy minimal object set with fresh scenes per test,
  GL-state snapshot at a draw, render-target readback comparison) would make a good
  `bench/fuzz-trace.mjs`; they were kept out of the branch to avoid conflicts with the
  parity-fuzzer's `fuzz-isolate.mjs`, which the integration branch has since changed.


## Tooling added on this branch (scratch, not committed)

The probe used for every root cause here is worth keeping in mind for the next worker: a page that builds
the same seed with both libraries, hides objects by `layers` (not `visible`, which also hides nested child
meshes and made the earlier "every object alone is identical" conclusions wrong), rebuilds fresh scenes per
experiment (the generator's animation accumulates, so a second render of "frame 0" is not frame 0), and
wraps the GL draw calls to read one pixel back after every draw in both libraries. The per-draw pixel trace
turned each residual into a single draw with the GL state (blend, cull, depth, masks) printed next to it.
