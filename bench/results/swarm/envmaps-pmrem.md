# swarm/envmaps-pmrem: environment maps and image-based lighting

Branch `swarm/envmaps-pmrem`. Goal: `scene.environment`, `material.envMap`, `PMREMGenerator`,
`WebGLCubeRenderTarget`, `CubeCamera` and `scene.background` textures with output identical to
three.js r186, through the built-in programs and the existing render-target code.

## What is implemented

**Materials**

* `MeshStandardMaterial` / `MeshPhysicalMaterial`: `scene.environment` and `material.envMap` through
  the PMREM path (cube or equirect source converted to the CubeUV layout, or a CubeUV texture assigned
  directly), `envMapIntensity`, `envMapRotation`, `scene.environmentIntensity` /
  `scene.environmentRotation` (three.js's rule: the scene's rotation and intensity apply when the
  environment comes from the scene). `envMap` on these materials is sampled through
  `cube_uv_reflection_fragment` with `CUBEUV_TEXEL_WIDTH` / `CUBEUV_TEXEL_HEIGHT` / `CUBEUV_MAX_MIP`
  generated exactly as three's `generateCubeUVSize` does.
* The r186 physical model (DFG lookup table, multi-scattering compensation, Fresnel-weighted direct
  diffuse, view-space geometric roughness) was ported here and, independently, by the parity-fuzzer
  branch; after the merge the integration branch's version is the base and this branch adds on top of
  it the environment terms of `RE_IndirectSpecular_Physical` (radiance and irradiance through the
  single / multi-scatter split, dielectric and metallic paths mixed by metalness) and
  `computeSpecularOcclusion` with `aoMap`.
* `MeshBasicMaterial` / `MeshLambertMaterial` / `MeshPhongMaterial`: `envMap` with `combine`
  Multiply / Mix / Add, `reflectivity`, `refractionRatio`, `envMapRotation`, `specularMap` as the
  reflection strength, and the mapping modes `CubeReflectionMapping`, `CubeRefractionMapping`,
  `EquirectangularReflectionMapping`, `EquirectangularRefractionMapping` (equirect sources are
  converted to a cube render target of the image height, as three does) and `CubeUVReflectionMapping`.
  `MeshBasicMaterial` computes its reflection vector per vertex and interpolates it, like three's
  `envmap_vertex`; Lambert / Phong compute it per fragment (`ENV_WORLDPOS`). `scene.environment` on
  Lambert / Phong adds the PMREM irradiance to the indirect term, as in r186. `envMapIntensity` was
  added to Lambert / Phong (three has it).
* `FLIP_SIDED` (BackSide normal flip) in the built-in vertex shader and the ShaderMaterial prefix,
  which three has and jrs lacked; `USE_ENVMAP` / `ENVMAP_TYPE_*` / `ENVMAP_MODE_*` /
  `ENVMAP_BLENDING_*` / `CUBEUV_*` defines for `ShaderMaterial`s that carry an `envMap` property, so
  custom shaders built from the envmap chunks get the same prefix as in three.

**Textures / targets / helpers**

* `PMREMGenerator`: `fromScene`, `fromEquirectangular`, `fromCubemap`, `compileCubemapShader`,
  `compileEquirectangularShader`, `dispose`; verbatim port (GGX VNDF prefilter, spherical Gaussian
  blur for `fromScene` sigma, same LOD planes and viewport layout, half-float targets), minus the
  reversed-depth branch jrs does not have.
* `WebGLCubeRenderTarget` with `fromEquirectangularTexture` and `clear`; `CubeCamera` (six cameras,
  `update(renderer, scene)`, `needsPMREMUpdate` on the target texture); `renderer.setRenderTarget(target,
  activeCubeFace, activeMipmapLevel)`, `getActiveCubeFace` / `getActiveMipmapLevel`,
  `renderer.coordinateSystem`. Cube targets get one framebuffer per face sharing one depth
  renderbuffer; mipmaps are regenerated on the cube map after a render when the texture asks for them.
* `WebGLEnvironments` (port of three's): per-source-texture cache of the equirect -> cube and PMREM
  conversions, redone when `pmremVersion` changes, released on texture dispose.
* `scene.background` textures: cube map or PMREM (`backgroundBlurriness > 0`) on a camera-centred
  BackSide box with `backgroundIntensity` / `backgroundRotation`, 2D textures on a screen plane; both
  through three's own `backgroundCube` / `background` shaders via the ShaderMaterial path, drawn
  first without depth writes. Tone mapping follows three's rule (skipped for sRGB textures).
* `CubeUVReflectionMapping`, `LinearTransfer`, `SRGBTransfer` constants; `CubeCamera`,
  `WebGLCubeRenderTarget`, `PMREMGenerator` exported.

**Renderer plumbing**

* The environment a material samples is resolved once per material per frame
  (`_refreshEnvironment`), the program key carries env-map type / mode / blending / CubeUV size and
  the resolved texture is part of the cached-program check, so changing `material.envMap` or
  `scene.environment` re-resolves without `needsUpdate`; a texture whose image is not ready is retried
  next frame.
* Per-material environment data (`envMapIntensity`, `reflectivity`, `refractionRatio`, `ior`, the
  inverse rotation with three's px/nx flip for non-render-target cube textures) lives in the material
  record (block grows from 128 to 192 bytes; the record stride was 256 already), so the
  multi-material batches from the integration branch keep working; materials sampling different
  environment textures are kept in separate batches (one env sampler per draw).
* Texture units: `envMap` on 15, the DFG table on 7 (the integration branch already keeps it there),
  the vertex-only matrix texture moved to 18 above the bone / morph textures (16 / 17). Shadow-casting
  spot lights stay capped at 3 (12-14); point-shadow cube maps keep using the free units of 8-14.
* Conversion renders (PMREM, equirect -> cube) can run while a frame is in flight (a material seen
  for the first time during program resolution); `_beginNestedRender` / `_endNestedRender` park the
  frame's lights, render-order ranks, dense-id counters, trace state and render target around them.
  Frame ids keep advancing, so every per-frame cache simply misses once afterwards.
* `renderer.render(mesh, camera)` with a non-Scene root works (PMREM and the cube conversion use it).
* No per-frame allocations in the new paths: the rotation matrix, the record scratch, the background
  item and the nested-state records are preallocated; `bench/alloc.mjs pbr-envmap` shows the same
  bytes/frame as `shared-static` (sampling noise, 5-15 KB/frame from the bench harness itself).

**Validation**

* `bench/conformance-tests.js`: eight env-map checks, each rendering the same scene with jrs and with
  three.js r186 (the conformance page now loads three locally when served from the repo, CDN
  otherwise) and comparing every pixel (limits: mean <= 0.1, max <= 8):
  `scene.environment` equirect `DataTexture` on Standard spheres (metal / dielectric / rough,
  `environmentIntensity`, `environmentRotation`, `envMapIntensity`); `material.envMap` on Standard
  (cube texture, `fromCubemap` / `fromEquirectangular` outputs, Physical, `envMapRotation`);
  MeshBasicMaterial cube `envMap` with Multiply / Mix / Add, `reflectivity`, refraction,
  `envMapRotation`; Lambert / Phong equirect `envMap` with `specularMap` and `scene.environment`
  irradiance; `scene.background` equirect sharp and blurred with intensity and rotation; cube
  background + cube environment on a torus knot and a 2D background plane; `CubeCamera` +
  `WebGLCubeRenderTarget` as Basic `envMap` and as Standard `envMap` (PMREM of the render target);
  `PMREMGenerator.fromScene` as `scene.environment`.
* Benchmark scenario `pbr-envmap`: 2 000 `MeshStandardMaterial` spheres (8 materials, roughness
  0..1, metal and dielectric) under a procedural equirect `scene.environment` plus a directional light.

## Conformance results (headless Chromium / SwiftShader, 256x256)

All 43 checks pass. The eight env-map checks against three.js r186:

| check | mean abs diff | max | differing pixels |
|---|---:|---:|---:|
| scene.environment (equirect, PMREM) on MeshStandardMaterial | 0 | 0 | 0 |
| material.envMap on Standard: cube texture, fromCubemap, fromEquirectangular, Physical | 0 | 0 | 0 |
| MeshBasicMaterial envMap: Multiply / Mix / Add, reflectivity, refraction, rotation | 0 | 0 | 0 |
| MeshLambertMaterial / MeshPhongMaterial equirect envMap, specularMap, scene.environment | 0 | 0 | 0 |
| scene.background equirect: sharp / blurred, intensity, rotation | 0.001 / 0 | 1 / 1 | 133 / 1 |
| scene.background cube texture + cube environment; 2D background plane | 0 / 0 | 1 / 0 | 2 / 0 |
| CubeCamera + WebGLCubeRenderTarget (Basic envMap, Standard through PMREM) | 0 | 0 | 0 |
| PMREMGenerator.fromScene as scene.environment | 0 | 0 | 0 |

The handful of 1-level differences in the background checks come from the cube-camera view
matrices (float32 in jrs, built in doubles in three) on the equirect -> cube conversion; the
PMREM path, which samples through the same conversion, lands on identical pixels.

Existing scenarios keep their pixel diffs or improve: `shared-static` / `shared-animated`
0.347 / 8 -> 0 / 0 (the r186 physical model), all others unchanged (`shadows*` keep their
shadow-filter difference, which this branch does not touch).

## pbr-envmap benchmark

Headless Chromium / SwiftShader, 320x240, 60 frames after 10 warm-up frames, better median of two
full runs (`node bench/run.mjs --compare --frames=60`, data in `bench/results/latest.json`):

| | three.js r186 | jrs |
|---|---:|---:|
| median frame (ms) | 4.4 | 0.3 |
| mean frame (ms) | 4.65 | 0.31 |
| worst frame (ms) | 9.6 | 0.6 |
| draw calls per frame | 2000 | 1 |
| GL calls per frame | 6019 | 4 |
| pixel diff vs three (mean / max, 0-255) | | 0 / 0 |

Speed-up 14.7x on the median. The 2 000 spheres share one geometry and 8 materials with one program,
so the integration branch's multi-material batching draws them as a single instanced call with the
environment map bound once; the per-frame cost is the IBL fragment work, which is the same in both
libraries. Measured after the merge with the integration tip d48164c.

All 17 other scenarios keep exactly the pixel diffs of the integration tip (`bench/results/latest.json`).
`node bench/fuzz.mjs --seeds=30 --continue` fails only on seeds 8, 23, 27 and 28, the ones that fail on the tip.

## Not implemented (precisely)

* `MeshPhysicalMaterial`'s extra layers: `ior` / `specularIntensity` / `specularColor` (the material
  still shades with the 0.04 dielectric F0), clearcoat, sheen, iridescence, transmission, anisotropy,
  dispersion. The `ior` value is already in the material record for a follow-up.
* `lightMap` and `bumpMap` on the built-in materials (three adds `lightMap` irradiance next to the
  environment irradiance).
* Rendering into mip levels of a render target (`setRenderTarget(target, face, level > 0)` renders
  level 0); `CubeCamera.activeMipmapLevel` is accepted but ignored.
* `scene.environment` on `ShaderMaterial` (three does not do it either); `envMap` on a
  `ShaderMaterial` only emits the prefix defines, the sampler is the user's uniform.
* Video / compressed equirect sources (they would go through the same cube conversion; untested).
* `WebGLRenderer.copyTextureToTexture` for cube maps, `readRenderTargetPixels` on a cube face.
* `renderer.state.buffers.depth.getReversed()`: the PMREM and CubeCamera ports drop the
  reversed-depth branch (jrs has no reversed depth buffer).

## Risks

* The program cache key: the integration branch interns the base key and packs the remaining fields
  under it; the env-map fields (type, mode, blending, CubeUV size) are packed there too. An earlier
  version of this branch had appended them to a key that was already past 2^53, which silently merged
  every env-map variant into the first compiled program.
* Nested conversion renders inside a frame are new ground: they park and restore the frame state,
  but a conversion triggered from inside a user `onBeforeRender` callback (i.e. inside `_drawList`)
  is not supported (`_inDrawList` defers it to the next frame).
* The material record grew to 192 bytes; the 256-byte std140 stride on common GPUs absorbs it, on a
  GPU with a 64-byte alignment the stride grows from 128 to 192 bytes (more uniform-buffer traffic).
* The DFG texture is RG16F with linear filtering (filterable in ES 3.0 / WebGL2, as three relies on).

## Follow-up ideas

* `MeshPhysicalMaterial` layers on top of the r186 model (clearcoat / sheen / iridescence /
  transmission), reusing the record fields.
* Point-light shadows now that cube render targets exist.
* `lightMap` (one more sampler; unit 7 is the only free one for Standard, so a unit re-plan or a
  texture array of material maps would be needed).
* Batch the PMREM `_applyGGXFilter` ping-pong copies (two renders per LOD) into one pass; three's
  layout is kept for parity, but the copy pass is pure overhead.
