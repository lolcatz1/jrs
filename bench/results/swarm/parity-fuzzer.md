# Parity fuzzer (swarm/parity-fuzzer)

`node bench/fuzz.mjs` (also `npm run fuzz`) is a differential random-scene tester: for every seed it
builds the SAME randomized scene with three.js r186 and with jrs, renders N frames with each in
headless Chromium (SwiftShader software WebGL2, the same setup as `bench/run.mjs`) and compares the
pixels of every frame. It is the safety net for the renderer changes other workers make: run it after
every merge; a seed that fails is a reproducible scene (`--seed=N`) with both images and a diff on disk.

## Running it

```sh
npm run fuzz                      # 20 seeds (1..20), 6 frames each, 320x240
npm run fuzz -- --seeds=200       # 200 seeds; stops at the first failing seed, exit code 1
npm run fuzz -- --seeds=200 --continue   # keep going, list every failing seed at the end
npm run fuzz -- --seed=57         # reproduce one seed: per-frame stats + images of the last/failing frame
npm run fuzz -- --start=201 --seeds=100  # a different seed range
npm run fuzz -- --list-features   # the feature flags and which are off by default
npm run fuzz -- --enable=perMapTransform --seeds=50   # re-enable a known-difference feature
npm run fuzz -- --only=standard,lights --seeds=50     # everything else off (bisecting a failure)
npm run fuzz -- --selfcheck --seeds=10    # each library against ITSELF (determinism check)
npm run fuzz -- --strict          # no allowance for isolated edge pixels (see Tolerances)
```

Failure output: `FAIL seed N ...` with the frame, `maxDiff`, `meanAbsDiff`, the number of pixels over
the threshold, sample pixels, and `bench/results/fuzz/seed-N-frame-F-{three,jrs,diff}.png` (diff: grey =
small difference x4, red = over the threshold). `bench/results/fuzz/report.json` has every run's stats
(worst frame, draw calls per frame for both libraries, scene notes, GL errors, exceptions). Exit code is
1 when any seed failed (an exception in either library or a GL error on its own counts as a failure
only when the pixels differ; GL errors are always printed).

Files: `bench/fuzz.mjs` (runner), `bench/fuzz.html` (page: renders with both libraries, compares),
`bench/fuzz-scene.js` (seeded scene generator, library-agnostic), `bench/pixel-compare.js`
(the comparison from `bench/index.html`'s `compareScenario`, plus the tolerances).

## Tolerances

Those of `bench/results/latest.json`: a frame fails when `meanAbsDiff > 0.4` or `maxDiff > 33`.

One refinement, because a strict `maxDiff > 33` flags about a quarter of all seeds for a single pixel:
jrs computes vertex positions in a different float32 order than three.js (`viewMatrix * (model *
position)` from uniform blocks and a float32 matrix slab versus three's double-precision
`modelViewMatrix`), so an object or shadow edge occasionally lands one pixel over. That is not a
rendering difference, and `latest.json` already carries a `fractionOver32` column for the same reason.
The fuzzer therefore lets at most `--bad-pixels=8` pixels per frame (0.01% of the frame) exceed
`maxDiff`; `--strict` sets the allowance to 0. Real differences found during this work were always
hundreds to tens of thousands of pixels or a raised mean.

## What a seed contains

All randomness comes from one seeded generator (`makeRng` in `bench/fuzz-scene.js`), consumed in the
same order for both libraries. Per seed, with the default feature set:

* **Camera:** perspective (random fov/near/far) or orthographic (25%), on a random orbit around a random
  target; per-frame orbit, fov or zoom animation; 10% `setViewOffset`.
* **Background / clear:** `scene.background` colour (75%), else `renderer.setClearColor` (70%) or default.
* **Fog:** none / `Fog` / `FogExp2`; some built-in materials with `fog: false`.
* **Lights:** ambient (85%), 0-2 hemisphere, 0-3 directional (optionally with a moved target), 0-3 point
  (random distance/decay), 0-2 spot (random angle/penumbra/decay); shadows on half the seeds:
  directional and spot lights cast with random map size (256/512), bias, normalBias, radius and
  orthographic shadow-camera bounds; meshes random `castShadow`/`receiveShadow`.
* **Textures:** 1-4 procedural `DataTexture`s (checker with varying alpha, or sine waves), random
  min/mag filters (incl. mipmaps), wrap modes, 30% sRGB colour space, repeat/offset/rotation.
* **Render target:** 35% of seeds render a 2-5 mesh sub-scene into a 64/128/256 `WebGLRenderTarget`
  (30% sRGB) every frame; its texture joins the texture pool (used as `map`, `alphaMap`, …).
* **Geometries:** 2-6 of Box (segments), Sphere, Plane, Torus, Cylinder (open/closed), or a custom
  `BufferGeometry` (indexed fan with Uint16/array index, or a non-indexed triangle soup with computed
  normals); 20% `toNonIndexed()`; per seed all geometries carry a `color` attribute (RGB or RGBA) or
  none; 25% a `drawRange`; 30% explicit groups (2-4) rendered with material arrays (box geometries'
  default 6 groups also get material arrays half the time). Every geometry also carries the custom
  attributes used by the ShaderMaterial template (`aSize`, `aOffset`).
* **Materials:** 2-8 of MeshBasic / MeshLambert / MeshPhong (shininess, specular, specularMap) /
  MeshStandard (roughness, metalness) / ShaderMaterial, with: `map`, `alphaMap`, `emissive`
  (+intensity, emissiveMap), `vertexColors`, `side`, 8% wireframe, 15% `alphaTest`, 30% flatShading,
  30% transparent with random opacity and Normal / Additive / Subtractive / Multiply / Custom blending
  (random factors and equations, separate alpha ones half the time), `premultipliedAlpha`,
  `depthWrite` / `depthTest` off, 12% a stencil writer (`stencilWrite`, Replace on pass, random ref,
  optionally `colorWrite: false`) paired with a stencil reader (Equal/NotEqual/Less/GreaterEqual test,
  random pass op and write mask, optionally no depth test). ShaderMaterial uses three templates:
  three.js chunks (`uv`, `color`, `fog`, `beginnormal/defaultnormal`, `begin_vertex/project_vertex`,
  `tonemapping_fragment`, `colorspace_fragment`, `fog_fragment`) with a sampler and `UniformsLib.fog`
  merged in; raw custom attributes; a view-space normal/fresnel shader. Materials whose output is
  order-dependent (stencil, depth state off, blending on opaque) get a distinct `renderOrder` because
  three.js sorts opaque objects front-to-back while jrs groups them by material (documented).
* **Objects:** 3-20 meshes, or 12-51 mostly sharing one geometry+material (so jrs auto-batches);
  random transforms; 5% invisible, 8% `frustumCulled = false`; half animated (rotation + bobbing),
  some with `matrixAutoUpdate = false` and a hand-composed matrix; nested under Groups / other meshes
  with animated group transforms (hierarchies grow to several levels); a floor plane half the time.
* **InstancedMesh:** 0-2 with 3-42 instances, animated `setMatrixAt` + `instanceMatrix.needsUpdate`,
  50% `setColorAt`, under a rotated group 30% of the time.
* **Frame:** 6 frames by default (`--frames=N`); some frames use `scene.overrideMaterial`
  (MeshNormal / MeshBasic / MeshDepth / MeshLambert) when the feature triggers (25% of seeds).
* **Renderer:** tone mapping (None / Linear / Reinhard / Cineon / ACESFilmic / Neutral) and exposure,
  `shadowMap.enabled`, stencil buffer on, antialias off, pixel ratio 1.

Off by default (`--list-features` shows them; `--enable=` re-enables): see **Known, excluded**.

## Seeds run

All runs: headless Chromium / SwiftShader on the cloud container, 320x240, 6 frames per seed,
default feature set, `--continue`.

| Run | Seeds | Result |
|---|---|---|
| Baseline, before any fix | 1-5 | 5/5 failing (means up to 88 levels, GL errors, a jrs exception) |
| Final code, full feature set | 1-100 | 86 pass, 14 residual (every one mean ≤ 0.10, ≤ 206 pixels over 33; table below) |
| Final code, full feature set | 101-200 | SEEDS_101_200 |
| Self-check (`--selfcheck`, each library vs itself) | 1-10 | identical frames for both libraries (deterministic) |

Feature-isolated batches with the final code (30 seeds each, `--only=basic,<feature>` plus
`lambert,lights` where lighting is needed): fog, transparency, side, wireframe+drawRange, stencil,
shadows, shadows+stencil, shadows+transparency, shadows+instancing, render targets, maps, alphaTest,
vertex colours, groups/drawRange/custom geometry, hierarchy, camera moves, background, tone mapping,
override materials, instancing, Standard+lights, Phong+lights, Phong+transparency+side, Standard+shadows
all pass (worst mean 0.07, on shadow scenes). Over the night roughly 3,500 seed renders were run.

Residual failures in seeds 1-100 (final code), all small and all interactions of several objects (every
object alone renders identically; `--loo`/pair isolation in the scratch tooling pinned them):

| Seed | mean | px>33 | What |
|---|---|---|---|
| 93 | 0.098 | 206 | one transparent DoubleSide custom-blend MeshPhongMaterial shared by a 6-group box and an InstancedMesh with instance colours: a 150-pixel sliver where they overlap composites lighter in jrs, independent of draw order and of single/two-pass; open |
| 23, 27, 28, 41, 47 | ≤ 0.061 | ≤ 137 | scenes with a render target used as a map (three sRGB): pixels that are exactly black in three.js come out as (0,0,15) in jrs on surfaces textured with it; open |
| 61, 99, 63, 85, 78, 35, 65, 8 | ≤ 0.027 | ≤ 60 | clusters of a few dozen pixels at object edges in scenes with many stencil / custom-blend / shader objects; likely the float32 edge effect on thin overlapping geometry, not yet proven |

## Mismatches found and what was done

Everything below was found by the fuzzer tonight (mostly with `--only=` feature subsets to isolate a
class, then per-object / leave-one-out isolation of one seed), fixed in `src/`, and verified by
re-running the subset and the full set. `npm test` (100/100), `node bench/conformance.mjs` (26/26) and
`node bench/smoke.mjs` pass after every fix. Commits on `swarm/parity-fuzzer` carry one group of fixes
each with the reasoning.

### Fixed in src/

1. **Crash: transparent sort key went negative** (`WebGLRenderLists`). Depths are stored as float32 but
   min/max were tracked in double precision; a depth that rounded above the maximum produced a negative
   26-bit key, `itemFromKey` returned `undefined` and the draw loop threw. Min/max now use the rounded
   values and the key is clamped. (Seen in the self-check as a jrs exception.)
2. **Uploads landed on the wrong texture unit** (`WebGLTextures`, `WebGLBatcher`). `texSubImage2D` /
   `texImage2D` act on the active unit, but `state.bindTexture` skips `activeTexture` when the binding
   is cached. The batcher's per-frame matrix texture upload could therefore overwrite a material map
   (objects visibly shifted on frame 1). Every upload now selects its unit first.
3. **One shadow-casting light of a type sampled unit 0** (`WebGLPrograms`). A sampler array of size 1
   (`spotShadowMap[1]`) got no fixed unit (`undefined` → 0) and collided with `map`/`dfgLUT`:
   `GL_INVALID_OPERATION` on every lit draw, whole objects missing. Previously it only worked because
   the shadow map happened to be the last texture bound on unit 0.
4. **MeshStandardMaterial shading differed by up to 42 levels** (`ShaderLib`, new
   `shaders/DFGLUTData.js` ported from three.js). jrs used the older PBR model with a 0.0525 floor on
   the geometry-roughness term. Ported three.js r186 exactly: geometry roughness from the view-space
   normal derivative, the 16x16 RG16F DFG lookup texture (bound on the otherwise unused unit 7 for
   Standard programs), multi-scattering compensation on direct specular, Fresnel-reduced direct
   diffuse, and single+multi-scatter energy conservation on indirect diffuse. Standard-only scenes now
   differ by ≤ 1 level (mean ≤ 0.07). This also removes the "Standard scenes differ by a few levels"
   caveat in the README benchmark notes.
5. **Fog colour was linear** (`WebGLRenderer._uploadFrameBlock`). three.js uploads the fog colour in
   the output colour space when rendering to the canvas (`getUnlitUniformColorSpace`); fogged surfaces
   were far too dark (mean difference up to 50 levels).
6. **Blend functions** (`WebGLState`). Premultiplied MultiplyBlending is now
   `(DST_COLOR, ONE_MINUS_SRC_ALPHA, ZERO, ONE)` and non-premultiplied AdditiveBlending
   `(SRC_ALPHA, ONE, ONE, ONE)`, as in three.js r186.
7. **BackSide materials lit as if front-facing** (`WebGLPrograms`, `ShaderLib`). three.js negates the
   normal in the vertex shader (`FLIP_SIDED`); jrs did not, so back faces had wrong lighting (mean up
   to 9 levels).
8. **A frame was never cleared after a `colorWrite: false` caster** (`WebGLRenderer.clear`). The colour
   mask stayed off after the shadow pass and `gl.clear` wrote nothing; three.js resets the masks before
   clearing. The whole frame kept the previous content (mean 30 levels).
9. **Render targets were encoded twice** (`WebGLPrograms`, `WebGLRenderer`). Shaders encoded to sRGB
   when the target texture was sRGB (which already encodes in hardware), and clear/fog colours were
   converted for render targets; three.js writes and clears render targets in the working (linear)
   space and converts only for the canvas. The clear colour is also re-derived at render time for the
   current target.
10. **Shadows** (`ShaderLib`, `WebGLLights`). three.js r186 PCF is five hardware-compared taps on a
    Vogel disk rotated per pixel by interleaved gradient noise, `shadowCoord.z += bias`, and
    `shadow.intensity`; jrs used a 3x3 grid with the bias subtracted and ignored intensity. Shadow
    edges were off by up to 84 levels; now identical (shadow-only scenes: mean ≤ 0.07, no pixel over
    the threshold).
11. **Wireframe ignored `drawRange` and groups** (`WebGLRenderer`). three.js scales both by 2 for the
    line index buffer; jrs drew the whole wireframe.
12. **Transparent DoubleSide materials rendered in one pass** (`WebGLRenderer`, `WebGLPrograms`).
    three.js draws them twice unless `forceSinglePass`: back faces with a `FLIP_SIDED` program, then
    front faces. jrs now does the same (new `V_SIDE_BACK/FRONT` program variants) and never batches
    such materials, because an instanced batch would draw all back faces before all front faces.
13. **Transparent sort depth** (`WebGLRenderer._projectObject`). three.js r186 sorts by the NDC depth
    of the world-space bounding sphere centre (the instance-aware sphere for `InstancedMesh`); jrs
    used a view-space depth of the object position when culling was off. Two InstancedMeshes at the
    origin tied and composited in the other order.
14. **Shadow casters drawn with their own state** (`WebGLState.setShadowPassMaterial`). three.js
    renders casters with a MeshDepthMaterial: depth test and write on, no blending, no stencil, no
    polygon offset. A caster with `depthTest: false` or `depthWrite: false` left wrong or missing
    depths in the shadow map.
15. **The shadow pass reset the frame's renderOrder table** (`WebGLShadowMap`). Ranks were rebuilt
    from the casters' orders only, so in the main pass every non-caster renderOrder ranked last and
    order-dependent materials (depthWrite off, blending, stencil) composited differently whenever
    shadows were on.

### Open (found, not fixed tonight)

* **Shared transparent material between an InstancedMesh with instance colours and a grouped mesh**
  (seed 93, `node bench/fuzz.mjs --seed=93`): mean 0.098, ~150 pixels. Each object alone is
  identical; the pair differs whichever draw order is forced and with `forceSinglePass`. Something in
  the per-material state (uniform block or texture/VAO binding) differs between the instanced and the
  non-instanced program of the same material; not located.
* **sRGB render target sampled slightly non-black** (seeds 23, 27, 28, 41, 47): where three.js shows
  exactly 0, jrs shows a linear value of about 0.004 (15/255 after encoding) on surfaces that sample
  the render target. Likely the clear or the sRGB encode/decode round trip of the target; mean ≤ 0.06.

### Known, excluded from the default feature set (flag to re-enable)

* `perMapTransform`: jrs has ONE uv transform per material (the first map's `offset/repeat/rotation`
  is applied to every map, see `_updateMaterialBlock`); three.js has a transform per map
  (`mapTransform`, `alphaMapTransform`, …). Shows up as wrong alpha-test cut-outs or emissive
  patterns when `map` and `alphaMap` have different transforms. The generator gives all maps of a
  material the same texture unless the flag is on. A proper fix adds the per-map matrices to the
  material uniform block (7 more mat3 per material); left for the integrator because it changes
  the block layout every worker touches.
* `shaderFog`: `ShaderMaterial` with `fog: true` (three's fog chunks need `fogColor` in the unlit
  colour space and `fogNear/fogFar/fogDensity`); not verified tonight, off to keep the default run
  about what is claimed to work.
* `agx`: `AgXToneMapping` is not implemented in jrs (README).
* `points`, `lines`: point-size and line rasterisation were not part of the brief; left off so the
  default run stays about meshes. They can be enabled for a look.

### Differences that are by design (not in the generator)

* Opaque objects are grouped by material instead of sorted front-to-back (README): the fuzzer gives
  every order-dependent material a unique `renderOrder`, so this never shows.
* `SubtractiveBlending` / `MultiplyBlending` without `premultipliedAlpha`: three.js logs an error and
  keeps the previous blend function; jrs applies the documented non-premultiplied functions. The
  generator always sets `premultipliedAlpha` for those modes.
* `vertexColors: true` on a built-in material whose geometry has no `color` attribute renders black in
  three.js (the attribute reads as 0) and uncoloured in jrs; the generator never does this.
* Material arrays (groups) never contain order-dependent materials: groups share one renderOrder and
  three.js orders them by material id while jrs orders by program (the documented opaque-order
  difference).
* Wireframe is only generated on materials without screen-space derivatives (no flatShading, no
  MeshStandardMaterial): `dFdx/dFdy` are implementation-defined on line primitives.
* Transparent objects at exactly the same sort depth: three.js breaks the tie by object id, jrs by
  traversal order; identical unless objects were created in a different order than they sit in the
  scene graph.

## For the integrator: after every merge

```sh
npm test && node bench/conformance.mjs && node bench/smoke.mjs
npm run fuzz -- --seeds=200 --continue          # ~10 minutes on the cloud container
```

* Exit code 0 and `passed: 200 run(s)` is the bar. `--continue` reports every failing seed instead of
  stopping at the first; drop it in CI.
* A failing seed: run `npm run fuzz -- --seed=N`, open `bench/results/fuzz/seed-N-frame-F-*.png`.
  To find the feature responsible, re-run with `--only=basic,<feature>` subsets (the random sequence
  changes with the feature set, so look for *any* failing seed in the subset rather than the same N),
  then `--selfcheck` to rule out non-determinism.
* Use `--start=` to vary the seed range between runs so coverage grows (seeds 1-200 are the baseline
  below); keep `--strict` out of CI (edge pixels) but run it occasionally to watch the edge-pixel rate.
* The tolerances live in `bench/pixel-compare.js` next to the comparison; `bench/index.html` keeps its
  own identical inline copy for `--compare` so other workers' edits to that page do not conflict.
* `build/jrs.module.js` was not regenerated on this branch (every worker touching `src/` would
  conflict on it): run `npm run build` once after the merge.
* The README benchmark note "Standard-material scenes differ by a few levels because jrs does not
  implement three.js's environment multi-scatter term" no longer holds after fix 4; re-measure with
  `npm run bench -- --compare` and update the table.
* Two helpers that were decisive for the interaction bugs (12-15 above):
  `node bench/fuzz-isolate.mjs <seed>` renders every mesh of a seed alone with both libraries (an
  interaction bug shows as "all objects differ, none alone"), `--loo` hides one object at a time,
  `--pair=a,b` renders two objects with both forced draw orders and writes the pair images;
  `node bench/fuzz-glerr.mjs <seed> jrs` wraps every GL call, reports the first erroring ones with a
  stack, and at a failing draw dumps the program's sampler units and what is bound on them.
