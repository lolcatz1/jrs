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
* **Point-light shadows** (`pointShadows`, with `shadows`): 40% of point lights cast, with random map
  size, near/far, bias, normal bias and radius.
* **Environment maps** (`envMaps`, on by default, half the seeds): a procedural equirectangular
  `DataTexture` (sky/ground gradient, horizon band, sun blob, stripes; 32x16 or 64x32, half sRGB) in
  two copies (reflection and refraction mapping): 60% `scene.environment` (with `environmentIntensity`,
  `environmentRotation` sometimes; PMREM for MeshStandard, irradiance for Lambert / Phong), 40% a
  textured `scene.background` (`backgroundBlurriness`, `backgroundIntensity`, `backgroundRotation`),
  and half the built-in materials get `envMap` with `combine` (Multiply / Mix / Add), `reflectivity`,
  `refractionRatio`, `envMapIntensity` (Standard) and `envMapRotation`.
* **Mutations (per frame, on by default):** on random frames after the first, 1-3 of: hide/show or
  remove a mesh, add a mesh (pool geometry + order-insensitive material, optionally under a group),
  change a material's colour / opacity / `transparent` (with `needsUpdate`) / `flatShading` (with
  `needsUpdate`) / `map`, change a light's intensity, colour and position or add a point light,
  change a mesh's `renderOrder`, set a geometry's `drawRange`, scale a geometry's position attribute
  (`needsUpdate`, `computeBoundingSphere`), change fog near/far/density or add fog, change the
  background colour or the tone-mapping exposure, change an InstancedMesh's `count`, rescale a mesh.
  This is what catches renderers that reuse render lists or draw commands across frames (found fix 19
  and exposed fix 18).
* **Renderer:** tone mapping (None / Linear / Reinhard / Cineon / ACESFilmic / Neutral) and exposure,
  `shadowMap.enabled`, stencil buffer on, antialias off, pixel ratio 1.

Off by default (`--list-features` shows them; `--enable=` re-enables): see **Known, excluded**.

## Seeds run

All runs: headless Chromium / SwiftShader on the cloud container, 320x240, 6 frames per seed,
default feature set, `--continue`.

| Run | Seeds | Result |
|---|---|---|
| Baseline, before any fix | 1-5 | 5/5 failing (means up to 88 levels, GL errors, a jrs exception) |
| Final code, full feature set | 1-200 | 182 pass, 18 residual (every one mean ≤ 0.16, ≤ 230 pixels over 33; table below) |
| Self-check (`--selfcheck`, each library vs itself) | 1-10 | identical frames for both libraries (deterministic) |
| Tip 6858f51, point shadows + mutations on (generator before `envMaps`) | 401-500 | 87 pass, 13 failing (run cut short at the summary, every seed rendered): 413 (0.847, 1032 px, logged under Open), 434 (0.439, 120 px: fix 21 below takes it to 0.036) and 11 of the small kinds (mean ≤ 0.064, 10-86 px over 33; 404, 415, 421, 433, 441, 459, 465, 467, 477, 480, 495). Reproduce with `--disable=envMaps` now that the generator has the feature |
| `--only=envMaps,standard,lambert,phong,basic,lights,background` (tip d38333a) | 1-12 | 12/12 identical (PMREM environment, refraction, textured backgrounds, blur/intensity/rotation) |
| envMaps with shadows, maps, transparency, side, fog, tone mapping, instancing, hierarchy, camera, flat shading, alphaTest, mutations | 1-40 | 38 pass; seed 1 was a generator false positive (map swap left `alphaMap` on the old texture: the perMapTransform limitation), seed 12 found fix 21 (0.192 → 0.004) |
| Tip d38333a, full default set with `envMaps` (before fixes 22, 23) | 1-100 | 89 pass; 19, 53, 65, 87, 90 (means 50-96: fix 22), 65 / 75 / 94 (fix 23), 12, 14, 97 (Open) |
| Tip d38333a + fixes 21-23 (final code of this cycle) | 1-100 | **97 pass**; residuals 12 (0.125), 14 (0.06), 97 (0.062), see Open |

Feature-isolated batches with the final code (30 seeds each, `--only=basic,<feature>` plus
`lambert,lights` where lighting is needed): fog, transparency, side, wireframe+drawRange, stencil,
shadows, shadows+stencil, shadows+transparency, shadows+instancing, render targets, maps, alphaTest,
vertex colours, groups/drawRange/custom geometry, hierarchy, camera moves, background, tone mapping,
override materials, instancing, Standard+lights, Phong+lights, Phong+transparency+side, Standard+shadows
all pass (worst mean 0.07, on shadow scenes). Over the night roughly 3,500 seed renders were run.

Residual failures in seeds 1-200 (final code), all small; `bench/fuzz-isolate.mjs` shows every object
alone renders identically in each of them, so they are interactions of several objects:

| Seed | mean | px>33 | What |
|---|---|---|---|
| 145 | 0.154 | 55 | chunk-based ShaderMaterials (BackSide, RGBA vertex colours) are ~12% darker in jrs from the first non-override frame on, in a scene whose frame 0 used a Lambert `overrideMaterial`; the matrices handed to the shader are identical, every feature subset passes alone; open |
| 93 | 0.098 | 206 | one transparent DoubleSide custom-blend MeshPhongMaterial shared by a 6-group box and an InstancedMesh with instance colours: a 150-pixel sliver where they overlap composites lighter in jrs, independent of draw order and of single/two-pass; open |
| 23, 27, 28, 142, 160, 192 | ≤ 0.10 | ≤ 230 | scenes with a render target used as a map: small clusters on surfaces textured with it (e.g. (0,0,0) in three.js vs (0,0,15) in jrs); a direct test of linear and sRGB render-target round trips is now pixel-identical, so what remains is specific to these scenes; open |
| 8, 35, 61, 63, 65, 78, 85, 99, 112, 170 | ≤ 0.04 | ≤ 60 | a few dozen pixels at object edges in scenes with many stencil / custom-blend / shader objects; likely the float32 edge effect on thin overlapping geometry, not proven |

### After merging the integration tip (69aa8f7 / 2c03d79)

`swarm/parity-fuzzer` now contains the integration branch (zero-alloc frame, stall hunter, uniform dirty
tracking, texture-unit tracking, shadow pass, scene-graph traversal, 32-bit radix-sort render lists,
ShaderMaterial uniform plan, raycast picking). Every parity fix survived the merge (four conflict hunks,
see the merge commit). Post-merge validation on this branch: `npm test` 117/117, conformance 27/27
(one new dirty-tracking test needed a fog colour distinct from the background, see the merge commit),
smoke and addons pass, and `node bench/run.mjs --compare --frames=60` is now **pixel-identical on every
benchmark scene** (shared-static was 0.347 mean / 8 max and shadows 0.134 / 33 before the Standard and
shadow fixes; all rows are 0 / 0 now, shared-animated 0 / 1). The post-merge fuzz run is in the table
below.

| Run | Seeds | Result |
|---|---|---|
| Merged branch (integration tip 2c03d79 + all parity fixes) | 1-100 | 88 pass; the 12 residuals are exactly the same seeds with the same means as before the merge (93, 23, 28, 61, 27, 99, 63, 85, 78, 35, 65, 8; worst mean 0.098) → the merged hot paths introduced no new mismatch |

Merge log (the branch keeps absorbing the integration tip; each row is one merge + validation):

| Integration tip | Merged at | npm test / conformance / smoke / addons | bench --compare | fuzz 1-100 | New findings |
|---|---|---|---|---|---|
| 2c03d79 | 87e7aaf | 117/117, 27/27, ok, ok | all scenes 0 / 0 (shared-animated 0 / 1) | 88 pass, 12 known residuals | none |
| 646caba | ad397c3 | 130/130, 33/33, ok, ok | all 12 scenes 0 mean (max 0; shared-animated 1 px, skinned-crowd 3 px ≤ 2) | 89 pass with the new mutation feature on; the 11 residuals are a subset of the known set (seed 78 now passes) | two real regressions/bugs, fixed in 8716722 (fixes 18, 19): material-array batches left their record window bound for the next plain batch of the same material (frame 0 of about 1 in 15 scenes with shared materials), and multi-draw ignored a drawRange set after the record was built (only reachable with the new per-frame mutations) |
| 6858f51 | fc9e2b7 | 139/139, 34/34, ok, ok | all 17 scenes 0 mean (max ≤ 2 on ≤ 5 px; the three new point-shadow scenes 0 / 0, 0 / 0, 1 on 5 px) | 87 pass (point shadows + mutations on, so seeds no longer map to the earlier set); 11 residuals of the known kinds plus seed 2 (0.467) and seed 14 (0.05), both logged under Open | one compile failure (fix 20, d8f1052); point-light shadows added to the generator and pixel-identical |
| d38333a (ShaderMaterial batching, envmaps/PMREM/CubeCamera/textured backgrounds, flat scene update, draw-list build, page VAOs) | fast-forward (this branch was already merged into the tip) | 152/152, 44/44, ok, ok | all 18 scenes 0 mean (max ≤ 2 on ≤ 5 px; the new pbr-envmap scene 0 / 0; instanced-100k 0 / 0 when its compare page loads: on this container that page times out at `page.goto` about every other run, on the untouched tip as well, so the row has to be re-run alone) | first run (envMaps on) 89 pass, 11 failing: the 5 ortho-background seeds (fix 22), 65 / 75 / 94 (fix 23), 12 / 14 / 97 (Open) → after fixes 21-23: **97 pass**, residuals 12 (0.125), 14 (0.06), 97 (0.062), all logged under Open | no merge regression: every parity fix is in place (fix 19's drawRange check now lives at push time as `ITEM_MULTIDRAWABLE`); the generator gained `envMaps` for the new environment code (identical on every seed tried); fix 21 (shadow-pass alpha test, 0c1706c) is a pre-existing mismatch the new subset exposed |

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
16. **ShaderMaterial ignored instance colours** (`ShaderLib`). three.js defines `USE_COLOR` in the
    fragment prefix when the object is an InstancedMesh with instance colours; jrs only did so for
    `vertexColors`, so chunk-based shaders (`color_fragment`-style code) dropped the per-instance tint.
17. **sRGB render targets encoded twice** (`WebGLPrograms`; the edit meant for fix 9 had been lost):
    content drawn into an sRGB render target was 2x encoded (e.g. (203,89,149) expected, (231,160,201)
    drawn); now identical to three.js for linear and sRGB targets.
18. **Freshly linked programs skipped material setup** (`WebGLRenderer._setupMaterial`, found after
    merging the material-index batching): a program linked during the draw loop is left current in GL by
    its sampler-unit setup, so the GL-level "program changed" test was false for its first draw and the
    material block, state and textures were not (re)bound. A single-material batch following a
    material-array batch of the same material drew with the record window still bound, so every instance
    took record 0's colour (first frame, and any frame that introduces a new program). The renderer now
    tracks its own current program and syncs the state cache after linking.
19. **Multi-draw ignored a drawRange set after the mega-buffer record was built** (`_isMultiDrawable`):
    the range is only checked when the record is created; a later `setDrawRange` was drawn in full. Found
    by the new mutation feature; the eligibility test now reads the live drawRange.
20. **Lit programs with a 2D shadow and a point shadow failed to compile** (`ShaderLib`, after merging
    point-light shadows): the merged point-shadow code carried a second copy of the PCF helpers
    (`interleavedGradientNoise`, `vogelDiskSample`), so any directional/spot + point shadow combination
    linked no program and those objects vanished (7 of 30 shadow seeds, means up to 180). The helpers now
    live in one block shared by both samplers. Point-light shadows themselves match three.js on every seed
    tried (new `pointShadows` feature, on by default).
21. **Alpha-tested shadow casters tested opacity × vertex colour × map alpha** (`ShaderLib`, 0c1706c):
    the shadow depth program started from `diffuse.a` (the material opacity) and multiplied by `vColor`
    before `alphaTest`; three.js's shadow depth material tests `map.a * alphaMap.g` alone. A transparent
    caster with `alphaTest` (opacity 0.48, test 0.5) therefore cast almost no shadow in jrs (seed 12 of
    the envMaps subset, mean 0.192 on the lit floor; seed 434 of 401-500, 0.439 → 0.036). The shadow
    program now defines `SHADOW_PASS` and starts its alpha at 1.0; `MeshDepthMaterial` in the colour
    pass still uses opacity.
22. **Clear colour re-applied every frame; three.js's is sticky** (`WebGLRenderer`, `WebGLShadowMap`,
    8df22ee): three.js sets the GL clear colour only for a null background (its clear colour) or
    a colour background (that colour, which then stays set); a texture background clears with whatever
    is current, and `WebGLShadowMap` sets white (1,1,1,1) before rendering shadow maps. Where a textured
    background does not cover the frame (the background cube box seen through an orthographic camera),
    three.js shows white after a shadow pass and jrs showed its own clear colour: seeds 19, 53, 65, 87,
    90 of the first envMaps run, means 50-96 (the largest mismatches of the night). jrs now mirrors the
    three.js state sequence exactly.
23. **Opaque materials wrote `map.a * opacity` as alpha; three.js writes 1.0** (`ShaderLib`,
    `WebGLPrograms`, 8df22ee): three.js's `OPAQUE` define (`transparent === false`, NormalBlending,
    no alphaToCoverage) forces alpha 1.0 in every built-in mesh / line / points / sprite program and in
    the ShaderMaterial prefix (jrs keyed the prefix define on `transparent` alone). The framebuffer alpha
    only shows through blend factors that read the destination alpha (`DstAlpha`, `OneMinusDstAlpha`),
    which turned out to be the whole "custom-blend composite of 3+ objects" residual class: seeds 2
    (0.467), 413 (0.847) and 93 (0.098) of the earlier generator and 65 (0.79 after fix 22), 75, 94 of
    the current one are identical now. `opaque` is a program key bit; material-array batches share it
    because their group signature already has transparent + blending.

### Open (found, not fixed tonight)

* ~~Shared transparent material between an InstancedMesh and a grouped mesh (seed 93, 0.098)~~,
  ~~seed 2 (0.467, transparent BackSide custom-blend spheres over a lit floor)~~ and ~~seed 413 of
  401-500 (0.847)~~: all three were the destination-alpha blend class, fixed by fix 23 (identical now;
  reproduce the old scenes with `--disable=envMaps`).
* **Render-target-textured surfaces in a few scenes** (seeds 23, 27, 28, 142, 160, 192): small clusters
  where three.js shows exactly 0 and jrs about 0.004 linear (15/255 encoded), or similar; the plain
  linear/sRGB round trip is identical in a direct test, so it depends on something else in those
  scenes (fog, tone mapping, camera view offset are common to several of them); mean ≤ 0.10.
* **Seed 145** (see the table): ShaderMaterials ~12% darker after a frame rendered with an
  `overrideMaterial`; not located.
* **Seed 97 (envMaps generator, 0.062 at frame 0 rising to 0.155 at frame 5)**: a bright spot on a
  `MeshStandardMaterial` floor under `scene.environment` (rotated PMREM), with 4 shadow lights, that moves
  with the animation; the floor alone is identical, `--noshadow` and `--singlepass` change nothing, the
  floor + the grouped transparent object over it is identical as a pair, and no single removal clears it.
  The same seed also has the render-target-textured class (a `map(sRGB)(RT)` Lambert alone, 0.04).
* **Seed 14 (envMaps generator, 0.06 at frame 0 / 0.099 at frame 1)**: `scene.environment` + blurred
  textured background + refraction env maps + a render target; small clusters, not isolated yet.
  When seeds 1-13 ran before it on the same page, jrs also reports GL error 1282 (INVALID_OPERATION)
  for this seed (`--start=12`, `--start=13` and the seed alone do not reproduce it;
  `bench/fuzz-glerr.mjs 14 jrs` finds no erroring call alone): something a previous renderer on the page
  leaves behind in a module-level object. Open.
* **Seed 12 (envMaps generator, 0.125)**: the render-target-textured class, now down to a per-object
  case: a flat DoubleSide `MeshPhongMaterial` stencil writer with the (linear) render target as both
  `map` and `specularMap` is about 10% brighter in jrs alone (0.024, 53 px); the other RT-textured
  objects of the seed show the same. Locatable with a direct test (Phong + RT map + specularMap).
* **Seed 145 of the earlier generator** (`--seed=145 --disable=envMaps`): still 0.165 after fixes 21-23.
* **Seed 14 (0.05)**: `MeshPhongMaterial` wireframe lines textured with a render target sample about
  25% darker in jrs; wireframe batches with Phong/maps otherwise show only the line-endpoint edge class.
* Line primitives (wireframe) flip single endpoint pixels more often than triangle edges do; the 8-pixel
  allowance is tight for them (3 of 60 wireframe seeds trip it with ≤ 28 pixels, mean ≤ 0.02).

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
* `node bench/run.mjs --compare` occasionally dies with `page.goto: Timeout 30000ms exceeded` on a
  fresh page (seen three times tonight, always recovered by re-running alone); it is a load/flake of
  the bench harness, not a renderer failure: every scenario passes when run on its own. Since the
  fourth merge the full run dies this way right after `instanced-100k` most of the time (the compare
  page never loads; the same on the untouched tip); `node bench/run.mjs <scene> --compare` per scene
  is reliable, and `instanced-100k` alone passes about every other attempt (0 / 0 when it does).
* After a merge, check that every parity fix is still in `src/` with
  `for m in vogelDiskSample "takes the '<name>0' slot" "_currentProgram !== program" "ITEM_MULTIDRAWABLE" RE_Direct_Standard setShadowPassMaterial "sRGBOutput = currentRenderTarget === null" isTwoPass ndcDepth dfgLUT FLIP_SIDED "setColorMask(true)" "_sideVariant()" "USE_COLOR' : '', // three.js defines" SHADOW_PASS; do printf "%-45s %s\n" "$m" "$(grep -rF -- "$m" src | wc -l)"; done`
  (every count must be > 0); a fix can legitimately move (fix 19 became the push-time
  `ITEM_MULTIDRAWABLE` flag in the draw-list rewrite), so a zero means "find where it went", not
  necessarily "lost".
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
