# Texture compatibility sweep against three.js r186

Branch `swarm/texture-formats`. Environment: headless Chromium (Playwright build 1194) on ANGLE/SwiftShader, which exposes
`WEBGL_compressed_texture_s3tc` (+ `_s3tc_srgb`), `_etc`, `_etc1`, `_astc`, `EXT_texture_compression_bptc`, `EXT_texture_compression_rgtc`,
`EXT_texture_filter_anisotropic`, `OES_texture_float_linear`, `EXT_color_buffer_float` (no PVRTC, no `EXT_texture_norm16`).

## What was built

`node bench/textures.mjs` (`npm run textures`) renders **349 cases** with jrs and with three.js r186 in the same headless Chromium,
on identical scenes, and compares

* the pixels (exact, unless a case states a tolerance),
* the GL errors raised by the case (same codes, same order),
* the warnings / errors logged (presence),
* exceptions (a case that throws on one side only fails),
* optionally the sequence of `texStorage*`, `texImage*`, `texSubImage*`, `compressedTex*`, `copyTexSubImage*`, `generateMipmap`, `blitFramebuffer` calls
  (`callsMatch`) and probe data (`info.memory.textures`, number of uploads, deleted textures, `userData`, ...).

Files: `bench/textures.mjs` (driver), `bench/textures.html` (runs the cases, compares), `bench/textures-cases.js` and `bench/textures-cases2.js`
(the cases). Options: `--only=<substring>`, `--group=<g1,g2>`, `--quiet` (hide PASS), `--json=<file>`, `--dump=<substring> --dump-dir=<dir>`
(write the two images of matching cases as PNG). Exit code 1 when a case FAILs.

Case statuses: **PASS** (identical), **FAIL**, **SKIP** (the extension is missing, or a *known gap* that is documented in the case: the case still
runs, a difference is reported as `KNOWN GAP (...) - measured: ...`, and when jrs catches up the case prints "known gap now closed" and passes).
A few cases compare *pixels advisory only* (cube faces of different size: the unwritten part of the storage is uninitialised GPU memory whose
content depends on earlier allocations; the GL errors and call sequences are still compared). About 50 passing results are a single colour on purpose
(three.js raises GL errors for the combination and samples black, or the case only probes `info.memory` / upload counts; jrs must do exactly the same); the table marks them.

Plus `test/textures.test.js` (16 tests in `npm test`, no browser): constants / classes / `TextureUtils` / `DataUtils` against three, and the
`WebGLTextures` decisions (upload path per class, Source sharing, dispose, `layerUpdates`, `updateRanges`, compressed mip upload, unpack-state
caching) against a recording fake GL context.

## Result

**349 cases: 337 PASS, 0 FAIL, 12 SKIP** (4 PVRTC cases: extension not exposed here; 2 context-loss cases, 4 map-slot cases, 2 `envMap` cases: known gaps, see below; the
table at the end lists every case).

The first run of the first 138 cases (wrap, filter, anisotropy, upload state, colour space, format x type, internalFormat) had 94 PASS, 43 FAIL and 1 SKIP; the remaining
cases were written afterwards (jrs had no `CompressedTexture`, `VideoTexture`, `FramebufferTexture`, `copyTextureToTexture`, `initTexture`, ...).

## Fixes (all in jrs, each one verified by the cases named)

1. **Opaque materials wrote the texture alpha into the drawing buffer** (`OPAQUE`). three forces `gl_FragColor.a = 1` for materials with
   `transparent === false`, normal blending and no alpha-to-coverage; jrs wrote `diffuseColor.a`, so a canvas created with `alpha: true` (jrs always
   creates its context with alpha) showed the page through every transparent texel of an opaque textured mesh. New program parameter `opaque`
   (in the program key), `#define OPAQUE` in the built-in shader, MeshNormalMaterial too; `ShaderMaterial`'s define now also requires normal blending and
   no alpha-to-coverage. (every `format-type`, `internal-format`, `wrap`, canvas case that has transparent texels.)
2. **`WebGLTextures` follows three r186's `WebGLTextures`** instead of its own simplified paths:
   * `WebGLUtils.convert` (new, three's file) for formats / types, including all compressed formats and their sRGB variants; `getInternalFormat`
     (RGB, RG, integer formats, packed types, `EXT_texture_norm16`, `internalFormat` overrides with the "non-existing internal format" warning),
     `getInternalDepthFormat` (depth, depth+stencil, 16/24/32F), `getMipLevels`. RGB data textures are therefore as invalid as in three (`texStorage2D` rejects the
     unsized format: GL errors and black; the old jrs silently uploaded RGB8).
   * **GL textures are shared per `Source`**: cache key of the parameters that are baked into the GL object, `usedTimes`, deletion with the last user, new GL texture and
     forced upload when such a parameter changes, `info.memory.textures` counts GL objects (`Source sharing`, `dispose`, `userData` cases).
   * Upload paths per class: `texStorage2D/3D` + `texSubImage*` (images, canvases, data, array, 3D, cube), `compressedTexSubImage2D/3D` per mipmap for
     `CompressedTexture` / `CompressedArrayTexture` / `CompressedCubeTexture` (no `generateMipmaps`; note that r186 uses `compressedTexSubImage*` into `texStorage`
     storage, `compressedTexImage*` only for the mutable video path), `layerUpdates` (also for compressed arrays, and, as in three, only the listed layers when they are registered before
     the first upload), `updateRanges`, user `mipmaps[]` chains (2D and cube), `FramebufferTexture`, `VideoTexture`, ImageBitmap (no flipY / premultiply), images above `MAX_TEXTURE_SIZE`
     resized on a canvas, `DepthTexture` allocation, `texture.onUpdate`.
   * `setTextureParameters`: anisotropy only with a magFilter other than Nearest and a mip-linear minFilter (jrs applied it for every filter), `__currentAnisotropy` reset rule,
     float-linear warning. sRGB colour space with a format other than RGBA/UnsignedByte warns.
   * A texture that has nothing to upload (no image, version 0, incomplete image) is bound as *nothing* and samples black (older jrs bound a white 1x1 placeholder).
   * `state.activeTexture(slot)` after the cached `bindTexture` before every upload (a cached binding does not select the unit; the upload went into whatever unit was active).
   * `WebGLState.texImage2D/3D`, `texSubImage*`, `texStorage*`, `compressedTex*` wrappers log with `console.error` instead of throwing, as three's do; the pixel-store cache is shared by
     all callers (`pixelStorei`, `getParameter`).
3. **Large data textures keep the mapped-memory path** (`bench/results/swarm/stall-hunter.md`): a `DataTexture` with >= 256 KB of data and no user mipmaps, and the streamed bone
   texture, are defined with `texImage2D` (with `TEXTURE_MAX_LEVEL = 0` when they do not generate mipmaps, so the texture is complete exactly as the one-level
   immutable storage three allocates) instead of `texStorage2D` + `texSubImage2D`; `updateRanges` still use `texSubImage2D`. Measured here with a bare GL page, per upload of client data:
   1024^2: 1-3 ms both; 2048^2: 7 ms (`texSubImage2D`) vs 3 ms (`texImage2D`); 4096^2: ~50 ms (first upload 530 ms) vs ~7 ms (with occasional 180-330 ms driver spikes). Smaller
   textures use three's storage path so that invalid combinations fail identically (`large` cases, plus a unit test of the decision).
4. **Missing classes and API**: `CompressedTexture`, `CompressedArrayTexture`, `CompressedCubeTexture`, `FramebufferTexture`, `VideoTexture`, `VideoFrameTexture`, `TextureSource` (alias of `Source`),
   `Texture.normalized`, `Box2`, `TextureUtils`, `DataUtils`, the compressed-format / `*Compare` / `LinearTransfer` / `SRGBTransfer` / `UnsignedInt5999Type` /
   `UnsignedInt101111Type` / `RGBIntegerFormat` constants, `CubeTextureLoader`, `CompressedTextureLoader`, `DataTextureLoader`, `ImageBitmapLoader` (three's files).
   `renderer.copyTextureToTexture` (r186 has one method for 2D, 2D array, 3D, compressed, render-target and depth sources; `copyTextureToTexture3D` no longer exists in r186),
   `initTexture`, `initRenderTarget`, `copyFramebufferToTexture(texture, position, level)`.
5. **`MeshDepthMaterial.depthPacking`** (RGBA / RGB / RG) was ignored; the depth now comes from the interpolated clip-space `z / w` like three's `depth_frag` (new `vHighPrecisionZW`
   varying) and the alpha is the material opacity.
6. **`PointsMaterial.map` / `alphaMap`** sampled `gl_PointCoord` without the flip: textures were upside down, and `alphaMap` ignored the map's uv transform. Now three's
   `map_particle_fragment` (`(uvTransform * vec3(x, 1 - y, 1)).xy` for both maps).
7. **Render targets are written in the working (linear) space**: tone mapping and the sRGB output encoding only apply when drawing to the canvas, clear and background colours
   are not converted for render targets (an sRGB render target encodes in hardware; jrs encoded twice and tone-mapped into render targets). The same bug was fixed independently on the integration branch
   by the parity fuzzer (merged cleanly; my `_updateEnv` key also drops tone mapping for render targets). With these two fixes fuzz seeds 23 and 28 pass.
8. Small ones: `DepthTexture` default `type` is `UnsignedIntType` for both depth formats (as three; jrs used `UnsignedInt248Type` for depth+stencil), `Source.getSize` returned a
   `VideoFrame`'s width and height swapped, `Texture.copy` copies `normalized`.

## Deliberate differences from three.js

* Large / streamed `DataTexture`s use `texImage2D` (item 3): same pixels, different GL calls (and different error codes for invalid format combinations of *large* textures).
* `VideoTexture` replaces the pixels with `texSubImage2D` when the frame size is unchanged; three redefines the level with `texImage2D` for every frame (same pixels).
* A cube texture may use plain `{ data, width, height }` objects as faces (three needs `DataTexture` faces; with plain objects three throws a TypeError that its state wrapper logs).
* `WebGLTextures.glInternalFormat` keeps jrs's argument order (`normalized` last) so call sites of other branches keep working.

## Remaining gaps (exact)

| gap | where it shows | notes |
|---|---|---|
| Environment maps / IBL (`material.envMap`, `scene.environment`, `CubeUVReflectionMapping`, PMREM) | `colorspace` group, 2 cases | ignored; branch `swarm/envmaps-pmrem` is working on it. `Scene.background` textures likewise. |
| `lightMap`, `bumpMap`, `displacementMap` | `maps` group, 3 cases | not in the built-in shader (map slots: map, alphaMap, normalMap, emissiveMap, roughnessMap, metalnessMap, aoMap, specularMap) |
| `Texture.channel` (a map reading `uv1`) | `maps`, 1 case | the map always uses `uv`; per-map transforms / channels belong to `swarm/per-map-transform` |
| context restore | `lifecycle`, 2 cases | after `webglcontextrestored` jrs keeps stale buffers, VAOs, UBOs, programs and textures where three re-initialises everything; not specific to textures (an untextured mesh fails the same way) |
| PVRTC | `compressed`, 4 cases skipped | `WEBGL_compressed_texture_pvrtc` is not exposed by SwiftShader; the code path is the same `compressedTexSubImage2D` call as for the other formats (and `RGB_ETC1_Format`, which maps to the ETC2 internal format, is tested) |
| `Texture.normalized` / `EXT_texture_norm16` | no case | implemented as in three (`R16_EXT`, `RG16_EXT`, ...), the extension is absent here |
| `ExternalTexture`, `HTMLTexture` | no case | not implemented |
| `readRenderTargetPixels(..., activeCubeFaceIndex, textureIndex)`, multiple render targets, `WebGLArrayRenderTarget` / `WebGL3DRenderTarget` | no case | not implemented (outside this sweep) |
| `DisplayP3` colour space | no case | `ColorManagement` knows sRGB and linear only |
| Big 3D / array uploads | `3d` group | still `texStorage3D` + `texSubImage3D` like three; measured 27 MB: 25 ms vs 10 ms with `texImage3D`, no stall seen, left alone |

## Findings outside the texture code

* **Lighting.** Before the integration branch got the parity fuzzer's "r186 Standard shading" fix, `MeshStandardMaterial` differed from three on metals (no multiscattering GGX) and on curved
  surfaces (`geometryRoughness` from `normal.z` only): up to 37/255 on a sphere. The merged fix closes the baselines I added (`maps` group, 10 no-texture baselines are now identical).
* **Fuzz.** `node bench/fuzz.mjs --seeds=50 --continue`: the integration tip fails seeds 8, 23, 27, 28, 35; this branch fails 8, 27, 35 (documented by the fuzzer's report as a few dozen
  edge pixels in many-object scenes). No seed got worse.
* Chromium delivers `webglcontextrestored` only if the restore is requested a few hundred ms after the loss event.

## Risks

* `WebGLTextures` is now much closer to three, which also means three's failure modes: a canvas that is resized after its first upload keeps its storage (GL error, as in three; old jrs re-uploaded with
  `texImage2D`), a *small* `DataTexture` whose `image` is replaced by a different size fails like in three (large ones are redefined with `texImage2D` and keep working), changing a parameter without
  `needsUpdate` has no effect. Anything in jrs that relied on the old leniency would break; nothing in `src` does (bone / morph / matrix textures are created fresh).
* The branch edits the render-target section of `WebGLTextures.js` (call signatures, `activeTexture`, `glInternalDepthFormat`) and `ShaderLib` / `WebGLPrograms` in places the envmaps / per-map-transform /
  lines-points-sprites branches also touch; `git merge` of those will conflict in a few hunks (mechanical).
* `opaque` and `depthPacking` extend the program key (one more factor each); the key product stays below 2^53 (the base part is interned).
* Cases that compare error codes depend on this driver (ANGLE / SwiftShader); on another GPU the same combination may raise a different (but equal-between-libraries) error.

## Follow-up ideas

* Property-based sweep: random combinations of texture parameters x classes x filters through the same comparison (the table here is hand-picked; the fuzzer's scene generator could draw textures).
* `lightMap`, `bumpMap`, `displacementMap`, `Texture.channel` for the built-in shader (after per-map transforms land), `ExternalTexture`.
* Context restore for the whole renderer (rebuild every GL object), then turn the two `context loss` cases into hard checks.
* Run the sweep on real GPUs (ASTC / ETC2 / BC availability differs, PVRTC on Apple, `EXT_texture_norm16`); the page is `bench/textures.html` and the same code runs on a phone.
* `Source`-level dirty ranges for canvases (`texSubImage2D` of a sub-rectangle) — three does not have it, but jrs could.
* Use `texImage3D` for large `Data3DTexture` / `DataArrayTexture` data if a stall shows up there.

## Validation (this branch, after merging the integration tip `ecf0290`)

| check | result |
|---|---|
| `npm test` | 155 / 155 pass (16 new tests in `test/textures.test.js`) |
| `node bench/conformance.mjs` | 34 / 34 PASS |
| `node bench/addons.mjs` | runs, no errors (uses the rebuilt `build/jrs.module.js`, which now also exports the new texture classes) |
| `node bench/smoke.mjs` | `glError: 0`, all probes as before |
| `node bench/textures.mjs` | 349 cases: 337 PASS, 0 FAIL, 12 SKIP (documented above); two consecutive runs give identical results except the advisory pixel diff of the "cube faces of different sizes" case |
| `node bench/run.mjs --compare --frames=60` | every scenario at or below the `bench/results/latest.json` values of the integration tip (meanAbsDiff / maxDiff: shared-animated 0 / 1, skinned-crowd 0 / 2, shadows-point-multi 0 / 1, all others 0 / 0); `latest.json` and the images in `bench/results` were restored, this branch does not touch them |
| `node bench/fuzz.mjs --seeds=50 --continue` | seeds 8, 27, 35 fail; the integration tip alone fails 8, 23, 27, 28, 35 (checked in a clean worktree), so no regression and two seeds fixed. 8 / 27 / 35 are listed as residual by `bench/results/swarm/parity-fuzzer.md` |


## All cases

349 cases: 337 PASS, 0 FAIL, 12 SKIP

### Wrap modes (10: 10 PASS)

| result | case | note |
|---|---|---|
| PASS | wrapS=repeat wrapT=repeat (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=repeat wrapT=clamp (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=repeat wrapT=mirror (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=clamp wrapT=repeat (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=clamp wrapT=clamp (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=clamp wrapT=mirror (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=mirror wrapT=repeat (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=mirror wrapT=clamp (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrapS=mirror wrapT=mirror (DataTexture, nearest, uv outside 0..1) |  |
| PASS | wrap modes with linear filtering and mipmaps (canvas, mirror/repeat) |  |

### Filters and mipmap modes (26: 26 PASS)

| result | case | note |
|---|---|---|
| PASS | magFilter=Nearest minFilter=Nearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=NearestMipmapNearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=NearestMipmapLinear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=Linear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=LinearMipmapNearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=LinearMipmapLinear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=Nearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=NearestMipmapNearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=NearestMipmapLinear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=Linear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=LinearMipmapNearest generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=LinearMipmapLinear generateMipmaps=true (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=Nearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=NearestMipmapNearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=NearestMipmapLinear generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=Linear generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=LinearMipmapNearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Nearest minFilter=LinearMipmapLinear generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=Nearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=NearestMipmapNearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=NearestMipmapLinear generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=Linear generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=LinearMipmapNearest generateMipmaps=false (magnified and minified) |  |
| PASS | magFilter=Linear minFilter=LinearMipmapLinear generateMipmaps=false (magnified and minified) |  |
| PASS | generateMipmaps=true with LinearFilter min (three allocates a full chain; no visual change) |  jrs: createTexture×1 texStorage2D×1 texSubImage2D×1 generateMipmap×1 \| three: createTexture×1 texStorage2D×1 texSubImage2D×1 generateMipmap×1 |
| PASS | minFilter mip mode on a non-power-of-two image (canvas 37x23) |  |

### Anisotropy (13: 13 PASS)

| result | case | note |
|---|---|---|
| PASS | anisotropy=1 minFilter=LinearMipmapLinear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=1 minFilter=LinearMipmapNearest at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=1 minFilter=Linear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=2 minFilter=LinearMipmapLinear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=2 minFilter=LinearMipmapNearest at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=2 minFilter=Linear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=8 minFilter=LinearMipmapLinear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=8 minFilter=LinearMipmapNearest at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=8 minFilter=Linear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=16 minFilter=LinearMipmapLinear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=16 minFilter=LinearMipmapNearest at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy=16 minFilter=Linear at a grazing angle | max diff 0, mean 0.000 \| jrs: maxAnisotropy=16 |
| PASS | anisotropy set after first render (texParameter re-applied through needsUpdate) |  |

### flipY / premultiplyAlpha / unpackAlignment (17: 17 PASS)

| result | case | note |
|---|---|---|
| PASS | CanvasTexture flipY=true premultiplyAlpha=false (half-transparent canvas) |  |
| PASS | DataTexture flipY=true premultiplyAlpha=false |  |
| PASS | CanvasTexture flipY=true premultiplyAlpha=true (half-transparent canvas) |  |
| PASS | DataTexture flipY=true premultiplyAlpha=true |  |
| PASS | CanvasTexture flipY=false premultiplyAlpha=false (half-transparent canvas) |  |
| PASS | DataTexture flipY=false premultiplyAlpha=false |  |
| PASS | CanvasTexture flipY=false premultiplyAlpha=true (half-transparent canvas) |  |
| PASS | DataTexture flipY=false premultiplyAlpha=true |  |
| PASS | unpackAlignment=1 Red/UnsignedByte, width 5 (row-padded data) |  |
| PASS | unpackAlignment=1 RGB/UnsignedByte, width 5 (row-padded data) | single-colour result |
| PASS | unpackAlignment=2 Red/UnsignedByte, width 5 (row-padded data) |  |
| PASS | unpackAlignment=2 RGB/UnsignedByte, width 5 (row-padded data) | single-colour result |
| PASS | unpackAlignment=4 Red/UnsignedByte, width 5 (row-padded data) |  |
| PASS | unpackAlignment=4 RGB/UnsignedByte, width 5 (row-padded data) | single-colour result |
| PASS | unpackAlignment=8 Red/UnsignedByte, width 5 (row-padded data) |  |
| PASS | unpackAlignment=8 RGB/UnsignedByte, width 5 (row-padded data) | single-colour result |
| PASS | unpackAlignment=1/2/4/8 RG x UnsignedByte, width 3 (row-padded data) |  |

### Colour spaces (21: 19 PASS, 2 SKIP)

| result | case | note |
|---|---|---|
| PASS | map colorSpace=srgb (RGBA8 DataTexture, MeshBasicMaterial) |  |
| PASS | map colorSpace=srgb (RGB8 DataTexture) | both warn (1); single-colour result |
| PASS | map colorSpace=srgb (CanvasTexture) |  |
| PASS | emissiveMap colorSpace=srgb (MeshLambertMaterial, black base colour) |  |
| PASS | emissiveMap colorSpace=srgb (MeshStandardMaterial, black base colour) |  |
| PASS | map colorSpace=srgb-linear (RGBA8 DataTexture, MeshBasicMaterial) |  |
| PASS | map colorSpace=srgb-linear (RGB8 DataTexture) | single-colour result |
| PASS | map colorSpace=srgb-linear (CanvasTexture) |  |
| PASS | emissiveMap colorSpace=srgb-linear (MeshLambertMaterial, black base colour) |  |
| PASS | emissiveMap colorSpace=srgb-linear (MeshStandardMaterial, black base colour) |  |
| PASS | map colorSpace=NoColorSpace (RGBA8 DataTexture, MeshBasicMaterial) |  |
| PASS | map colorSpace=NoColorSpace (RGB8 DataTexture) | single-colour result |
| PASS | map colorSpace=NoColorSpace (CanvasTexture) |  |
| PASS | emissiveMap colorSpace=NoColorSpace (MeshLambertMaterial, black base colour) |  |
| PASS | emissiveMap colorSpace=NoColorSpace (MeshStandardMaterial, black base colour) |  |
| PASS | data texture Float RGBA with colorSpace=srgb (no hardware decode, as in three) | both warn (1) |
| PASS | data texture Float RGBA with colorSpace=srgb-linear (no hardware decode, as in three) |  |
| PASS | data texture HalfFloat RGBA with colorSpace=srgb (no hardware decode, as in three) | both warn (1) |
| PASS | data texture HalfFloat RGBA with colorSpace=srgb-linear (no hardware decode, as in three) |  |
| SKIP | envMap (CubeTexture, sRGB) on MeshBasicMaterial | KNOWN GAP (environment maps / image-based lighting are not implemented (ARCHITECTURE.md "intentionally not there"); material.envMap is ignored) - measured: pixels differ: max 255, 23.54% > 16, tolerance 0; centre jrs [255,255,255,255] three [0,252,252,255]; max diff 255, mean 21.378 |
| SKIP | envMap (CubeTexture) on MeshPhongMaterial with reflectivity | KNOWN GAP (environment maps / image-based lighting are not implemented; material.envMap is ignored) - measured: pixels differ: max 243, 23.54% > 16, tolerance 0; centre jrs [0,0,0,255] three [0,241,241,255]; max diff 243, mean 36.828 |

### Format x type pairs (35: 35 PASS)

| result | case | note |
|---|---|---|
| PASS | DataTexture RGBA x UnsignedByte |  |
| PASS | DataTexture RGBA x HalfFloat |  |
| PASS | DataTexture RGBA x Float |  |
| PASS | DataTexture RGBA x UnsignedShort | single-colour result |
| PASS | DataTexture RGBA x UnsignedInt | single-colour result |
| PASS | DataTexture RGB x UnsignedByte | single-colour result |
| PASS | DataTexture RGB x HalfFloat | single-colour result |
| PASS | DataTexture RGB x Float | single-colour result |
| PASS | DataTexture RGB x UnsignedShort | single-colour result |
| PASS | DataTexture RGB x UnsignedInt | single-colour result |
| PASS | DataTexture Red x UnsignedByte |  |
| PASS | DataTexture Red x HalfFloat |  |
| PASS | DataTexture Red x Float |  |
| PASS | DataTexture Red x UnsignedShort | single-colour result |
| PASS | DataTexture Red x UnsignedInt | single-colour result |
| PASS | DataTexture RG x UnsignedByte |  |
| PASS | DataTexture RG x HalfFloat |  |
| PASS | DataTexture RG x Float |  |
| PASS | DataTexture RG x UnsignedShort | single-colour result |
| PASS | DataTexture RG x UnsignedInt | single-colour result |
| PASS | DataTexture RGBA x UnsignedByte with LinearFilter and mipmaps |  |
| PASS | DataTexture RGBA x HalfFloat with LinearFilter and mipmaps |  |
| PASS | DataTexture RGBA x Float with LinearFilter and mipmaps |  |
| PASS | DataTexture RGB x UnsignedByte with LinearFilter and mipmaps | single-colour result |
| PASS | DataTexture RGB x HalfFloat with LinearFilter and mipmaps | single-colour result |
| PASS | DataTexture RGB x Float with LinearFilter and mipmaps | single-colour result |
| PASS | DataTexture Red x UnsignedByte with LinearFilter and mipmaps |  |
| PASS | DataTexture Red x HalfFloat with LinearFilter and mipmaps |  |
| PASS | DataTexture Red x Float with LinearFilter and mipmaps |  |
| PASS | DataTexture RG x UnsignedByte with LinearFilter and mipmaps |  |
| PASS | DataTexture RG x HalfFloat with LinearFilter and mipmaps |  |
| PASS | DataTexture RG x Float with LinearFilter and mipmaps |  |
| PASS | DataTexture RGBA x UnsignedShort4444 |  |
| PASS | DataTexture RGBA x UnsignedShort5551 |  |
| PASS | DataTexture AlphaFormat / LuminanceFormat (removed in WebGL2 three: same GL errors) | single-colour result |

### internalFormat overrides (17: 17 PASS)

| result | case | note |
|---|---|---|
| PASS | internalFormat=RGBA8 with RGBA x UnsignedByte |  |
| PASS | internalFormat=SRGB8_ALPHA8 with RGBA x UnsignedByte |  |
| PASS | internalFormat=RGBA4 with RGBA x UnsignedByte |  |
| PASS | internalFormat=RGB5_A1 with RGBA x UnsignedByte |  |
| PASS | internalFormat=RGBA16F with RGBA x Float |  |
| PASS | internalFormat=RGBA16F with RGBA x HalfFloat |  |
| PASS | internalFormat=RGBA32F with RGBA x Float |  |
| PASS | internalFormat=R11F_G11F_B10F with RGB x Float |  |
| PASS | internalFormat=RGB9_E5 with RGB x Float |  |
| PASS | internalFormat=RGB8 with RGB x UnsignedByte |  |
| PASS | internalFormat=SRGB8 with RGB x UnsignedByte |  |
| PASS | internalFormat=R8 with Red x UnsignedByte |  |
| PASS | internalFormat=R16F with Red x Float |  |
| PASS | internalFormat=RG16F with RG x Float |  |
| PASS | internalFormat=RG8 with RG x UnsignedByte |  |
| PASS | internalFormat=RGB10_A2 with RGBA x UnsignedByte | single-colour result |
| PASS | internalFormat=NOT_A_FORMAT with RGBA x UnsignedByte | both warn (1) |

### Depth textures and depth packing (13: 13 PASS)

| result | case | note |
|---|---|---|
| PASS | DepthTexture DepthFormat x UnsignedShort as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthFormat x UnsignedInt as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthFormat x Float as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthStencilFormat x UnsignedInt as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthStencilFormat x UnsignedInt248 as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthStencilFormat x Float as render target depth, sampled through sampler2D |  |
| PASS | DepthTexture DepthStencilFormat x UnsignedShort as render target depth, sampled through sampler2D | both warn (1) |
| PASS | DepthTexture compareFunction=LessEqualCompare sampled through sampler2DShadow |  |
| PASS | DepthTexture compareFunction=GreaterCompare sampled through sampler2DShadow |  |
| PASS | DepthTexture compareFunction=AlwaysCompare sampled through sampler2DShadow | single-colour result |
| PASS | DepthTexture / CubeDepthTexture / texture class defaults match (type, format, filters, flags, image) | single-colour result |
| PASS | MeshDepthMaterial depthPacking=BasicDepthPacking rendered to screen and into an RGBA8 target |  |
| PASS | MeshDepthMaterial depthPacking=RGBADepthPacking rendered to screen and into an RGBA8 target |  |

### Compressed textures (54: 50 PASS, 4 SKIP)

| result | case | note |
|---|---|---|
| PASS | CompressedTexture RGB_S3TC_DXT1: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_S3TC_DXT1 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT1: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT1 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT3: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT3 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT5: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_S3TC_DXT5 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_ETC1: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_ETC1 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_ETC2: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_ETC2 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ETC2_EAC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ETC2_EAC (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture R11_EAC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture SIGNED_R11_EAC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RG11_EAC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture SIGNED_RG11_EAC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_4x4: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_4x4 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_5x4: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_5x4 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_6x6: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_6x6 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_8x8: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_8x8 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_10x5: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_10x5 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_12x12: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_ASTC_12x12 (sRGB): 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGBA_BPTC: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_BPTC_SIGNED: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RGB_BPTC_UNSIGNED: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RED_RGTC1: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture SIGNED_RED_RGTC1: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture RED_GREEN_RGTC2: 5 mip levels, upload path per mipmap |  |
| PASS | CompressedTexture SIGNED_RED_GREEN_RGTC2: 5 mip levels, upload path per mipmap |  |
| SKIP | CompressedTexture RGB_PVRTC_4BPPV1: 5 mip levels, upload path per mipmap | WEBGL_compressed_texture_pvrtc not exposed by this GPU/driver (headless SwiftShader); the code path is the same compressedTexSubImage2D call exercised by the other formats |
| SKIP | CompressedTexture RGB_PVRTC_4BPPV1 (sRGB): 5 mip levels, upload path per mipmap | WEBGL_compressed_texture_pvrtc not exposed by this GPU/driver (headless SwiftShader); the code path is the same compressedTexSubImage2D call exercised by the other formats |
| SKIP | CompressedTexture RGBA_PVRTC_2BPPV1: 5 mip levels, upload path per mipmap | WEBGL_compressed_texture_pvrtc not exposed by this GPU/driver (headless SwiftShader); the code path is the same compressedTexSubImage2D call exercised by the other formats |
| SKIP | CompressedTexture RGBA_PVRTC_2BPPV1 (sRGB): 5 mip levels, upload path per mipmap | WEBGL_compressed_texture_pvrtc not exposed by this GPU/driver (headless SwiftShader); the code path is the same compressedTexSubImage2D call exercised by the other formats |
| PASS | CompressedTexture with RGBAFormat (uncompressed mip chain in mipmaps[]) |  |
| PASS | CompressedTexture re-upload keeps storage (needsUpdate twice: no second texStorage2D) |  |
| PASS | CompressedArrayTexture RGBA_S3TC_DXT5: 3 layers, layer 1 and 2 sampled |  |
| PASS | CompressedArrayTexture RGBA_ETC2_EAC: 3 layers, layer 1 and 2 sampled |  |
| PASS | CompressedArrayTexture RGBA_ASTC_4x4: 3 layers, layer 1 and 2 sampled |  |
| PASS | CompressedArrayTexture RGBA_BPTC: 3 layers, layer 1 and 2 sampled |  |
| PASS | CompressedArrayTexture RED_GREEN_RGTC2: 3 layers, layer 1 and 2 sampled |  |
| PASS | CompressedArrayTexture layerUpdates (one layer re-uploaded with compressedTexSubImage3D) |  |
| PASS | CompressedArrayTexture with RGBAFormat (uncompressed layers) |  |
| PASS | CompressedCubeTexture RGBA_S3TC_DXT5: six faces with mip chains |  |
| PASS | CompressedCubeTexture RGBA_ETC2_EAC: six faces with mip chains |  |
| PASS | CompressedCubeTexture RGBA_ASTC_4x4: six faces with mip chains |  |
| PASS | CompressedCubeTexture RGBA_BPTC: six faces with mip chains |  |

### Canvas / video / framebuffer / data updates (13: 13 PASS)

| result | case | note |
|---|---|---|
| PASS | CanvasTexture needsUpdate every frame (3 frames, same size): texSubImage2D only after the first upload |  |
| PASS | CanvasTexture resized canvas then needsUpdate (three.js keeps its storage: fails the same way) | single-colour result |
| PASS | FramebufferTexture + copyFramebufferToTexture (copies the screen into a texture, then samples it) |  |
| PASS | FramebufferTexture with mip filter (levels allocated, copy into level 1) |  |
| PASS | VideoTexture: needsUpdate every frame; jrs replaces pixels with texSubImage2D when the size is unchanged | max diff 0, mean 0.000 \| jrs: uploads after first: ["texSubImage2D","texSubImage2D"] \| three: uploads after first: ["texImage2D","texImage2D"]; jrs: createTexture×1 texImage2D×1 texSubImage2D×2 deleteTexture×1 \| three: createTexture×1 texImage2D×3 deleteTextur |
| PASS | DataTexture re-upload (needsUpdate) after changing the data |  |
| PASS | DataTexture updateRanges (partial re-upload of two rows) |  |
| PASS | DataTexture whose data is replaced by a differently sized image (image object swapped, needsUpdate) |  |
| PASS | DataTexture with null data (allocated only) then sampled | single-colour result |
| PASS | Texture marked for update without image data (loading texture): binds nothing, samples black | both warn (1); single-colour result |
| PASS | Texture never marked for update (version 0): binds nothing, samples black | single-colour result |
| PASS | Re-upload one map while another unit was the active texture unit (map + emissiveMap on a lit material) |  |
| PASS | image object with complete=false: warns and keeps sampling black | both warn (1); single-colour result |

### copyTextureToTexture / initRenderTarget (10: 10 PASS)

| result | case | note |
|---|---|---|
| PASS | copyTextureToTexture DataTexture -> DataTexture (whole image) |  |
| PASS | copyTextureToTexture with srcRegion (Box2) and dstPosition (Vector2) |  |
| PASS | copyTextureToTexture CanvasTexture -> DataTexture |  |
| PASS | copyTextureToTexture into mip level 1 (dstLevel) of a mipmapped DataTexture |  |
| PASS | copyTextureToTexture from a render target texture (framebuffer blit path) |  |
| PASS | copyTextureToTexture DataArrayTexture layers with a Box3 region and dstPosition (Vector3) |  |
| PASS | copyTextureToTexture Data3DTexture -> Data3DTexture (whole volume) |  |
| PASS | copyTextureToTexture compressed -> compressed (S3TC DXT5) |  |
| PASS | copyTextureToTexture between the depth textures of two render targets (blitFramebuffer on the depth buffer) |  |
| PASS | renderer.initRenderTarget then copyTextureToTexture into its texture |  |

### initTexture / dispose / Source sharing / userData (15: 13 PASS, 2 SKIP)

| result | case | note |
|---|---|---|
| PASS | renderer.initTexture uploads immediately (no upload during the later render) |  |
| PASS | renderer.initTexture(canvas) creates and fills the GL texture | single-colour result |
| PASS | renderer.initTexture(cube) creates and fills the GL texture | single-colour result |
| PASS | renderer.initTexture(3d) creates and fills the GL texture | single-colour result |
| PASS | renderer.initTexture(array) creates and fills the GL texture | single-colour result |
| PASS | renderer.initTexture(compressed) creates and fills the GL texture | single-colour result |
| PASS | texture.dispose() frees the GL texture and decrements info.memory.textures |  |
| SKIP | context loss and restore: a texture is uploaded again into the new context | KNOWN GAP (context restore is not supported: after webglcontextrestored jrs keeps its stale GL objects (buffers, VAOs, uniform blocks, programs, textures) where three.js re-initialises every sub-system; not specific to textures) - measured: pixels differ: max 204, 100.00% > 16, tolerance 0; centre jrs [51,102,153,255] three [213… |
| SKIP | context loss and restore: an untextured mesh (baseline for the texture case above) | KNOWN GAP (context restore is not supported: after webglcontextrestored jrs keeps its stale GL objects (buffers, VAOs, uniform blocks, programs, textures) where three.js re-initialises every sub-system; not specific to textures) - measured: pixels differ: max 204, 100.00% > 16, tolerance 0; centre jrs [51,102,153,255] three [255… |
| PASS | texture.userData / uuid / name / id are untouched by upload, dispose and re-upload |  |
| PASS | Source sharing: a clone with the same parameters shares one GL texture (one upload) |  |
| PASS | Source sharing: different parameters (wrapS) need their own GL texture, and dispose releases them one by one |  |
| PASS | Source sharing: changing a parameter after upload moves the texture to a new GL texture and frees the old one |  |
| PASS | Two textures with the same Source but one flipY=false: two GL textures, both render |  |
| PASS | texture.needsUpdate on a Source shared by two textures re-uploads once per GL texture |  |

### User mipmap chains (8: 8 PASS)

| result | case | note |
|---|---|---|
| PASS | DataTexture mipmaps[] chain 32..1, one colour per level, minFilter=LinearMipmapLinear |  |
| PASS | DataTexture mipmaps[] chain 32..1, one colour per level, minFilter=NearestMipmapNearest |  |
| PASS | DataTexture mipmaps[] chain 32..1, one colour per level, minFilter=LinearMipmapNearest |  |
| PASS | DataTexture with a partial mipmaps[] chain (32, 16, 8 only): complete because storage has 3 levels |  |
| PASS | DataTexture base level only with a mipmap minFilter and generateMipmaps=false (complete, samples the base) |  |
| PASS | Texture mipmaps[] of canvases (image + canvas chain) |  |
| PASS | CubeTexture with canvas faces and generateMipmaps (LinearMipmapLinear) |  |
| PASS | CubeTexture with user mipmaps (cube chain: base from image, mips from mipmaps[].image) |  |

### Texture transforms (8: 8 PASS)

| result | case | note |
|---|---|---|
| PASS | map.offset |  |
| PASS | map.repeat |  |
| PASS | map.rotation about the origin |  |
| PASS | map.rotation about center (0.5, 0.5) |  |
| PASS | map offset + repeat + rotation + center combined |  |
| PASS | map.matrixAutoUpdate=false with a hand-written matrix |  |
| PASS | texture transform changes between frames are picked up (offset animated, no needsUpdate) |  |
| PASS | matrixAutoUpdate=false: the matrix is used as is even after offset changes |  |

### 3D and array textures (12: 12 PASS)

| result | case | note |
|---|---|---|
| PASS | Data3DTexture RGBA8 minFilter=Nearest generateMipmaps=false |  |
| PASS | Data3DTexture RGBA8 minFilter=Linear generateMipmaps=false |  |
| PASS | Data3DTexture RGBA8 minFilter=LinearMipmapLinear generateMipmaps=true |  |
| PASS | Data3DTexture Red x UnsignedByte |  |
| PASS | Data3DTexture RG x Float |  |
| PASS | Data3DTexture RGBA x HalfFloat |  |
| PASS | Data3DTexture Red x Float |  |
| PASS | Data3DTexture wrapR=repeat sampled outside 0..1 |  |
| PASS | DataArrayTexture layerUpdates after the first upload (one layer) |  |
| PASS | DataArrayTexture layerUpdates registered before the very first upload (three.js uploads only the listed layers) |  |
| PASS | DataArrayTexture with several layerUpdates and generateMipmaps |  |
| PASS | DataArrayTexture Float RG layers |  |

### Cube textures (7: 7 PASS)

| result | case | note |
|---|---|---|
| PASS | CubeTexture of six canvases, flipY=false, mipmaps generated |  |
| PASS | CubeTexture flipY=true (three.js ignores nothing here: uploads flipped) |  |
| PASS | CubeTexture of DataTextures (Float RGBA) |  |
| PASS | CubeTexture with six images of different sizes (16, 8, 16, 16, 4, 16): fails like three.js | max diff 49, mean 1.344 \| jrs: self-diff after re-creating the GL texture: 0; pixels advisory only (the cube storage is only partly written, the rest is uninitialised GPU memory whose content depends on earlier allocations) |
| PASS | CubeTexture of DataTextures with different sizes: fails like three.js |  pixels advisory only (the cube storage is only partly written, the rest is uninitialised GPU memory) |
| PASS | CubeTexture with fewer than six images: nothing uploaded, samples black |  |
| PASS | CubeTexture re-upload after changing one face (needsUpdate) |  |

### Image elements, ImageBitmap, oversize images (3: 3 PASS)

| result | case | note |
|---|---|---|
| PASS | HTMLImageElement (data URL) texture through the TextureLoader-style path |  |
| PASS | ImageBitmap texture (flipY / premultiplyAlpha ignored by the browser for bitmaps) |  |
| PASS | texture larger than MAX_TEXTURE_SIZE is resized on a canvas (warns) | both warn (1); max diff 0, mean 0.000 \| jrs: max=8192 |

### Other material maps and objects (30: 26 PASS, 4 SKIP)

| result | case | note |
|---|---|---|
| PASS | baseline: MeshStandardMaterial roughness=0 metalness=0 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.3 metalness=0 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.6 metalness=0 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=1 metalness=0 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.3 metalness=1 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.8 metalness=1 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.5 metalness=0.5 on a plane, no textures | single-colour result |
| PASS | baseline: MeshStandardMaterial roughness=0.1 on a sphere (geometry roughness from the normal derivatives), no textures |  |
| PASS | baseline: MeshStandardMaterial roughness=0.4 on a sphere (geometry roughness from the normal derivatives), no textures |  |
| PASS | baseline: MeshStandardMaterial roughness=0.9 on a sphere (geometry roughness from the normal derivatives), no textures |  |
| PASS | normalMap identity (flat), constant over the plane (MeshStandardMaterial, roughness 0.7, flat quad) | single-colour result |
| PASS | normalMap uniform tilt +x, constant over the plane (MeshStandardMaterial, roughness 0.7, flat quad) | single-colour result |
| PASS | normalMap uniform tilt +y, constant over the plane (MeshStandardMaterial, roughness 0.7, flat quad) | single-colour result |
| PASS | normalMap strong tilt, constant over the plane (MeshStandardMaterial, roughness 0.7, flat quad) | single-colour result |
| PASS | alphaMap on a lit MeshStandardMaterial (data texture, colorSpace none) |  |
| PASS | aoMap on a lit MeshStandardMaterial (data texture, colorSpace none) |  |
| PASS | normalMap on a lit MeshStandardMaterial (data texture, colorSpace none) |  |
| PASS | roughnessMap on MeshStandardMaterial (metalness 0) |  |
| PASS | metalnessMap (blue channel) equals the same uniform metalness within the library | max diff 0, mean 0.000 \| jrs: self diff max 0; single-colour result |
| PASS | roughnessMap (green channel) equals the same uniform roughness within the library | max diff 0, mean 0.000 \| jrs: self diff max 0; single-colour result |
| PASS | specularMap on MeshPhongMaterial |  |
| SKIP | lightMap on a lit material | KNOWN GAP (lightMap is not implemented by jrs's built-in shader (map keys: map, alphaMap, normalMap, emissiveMap, roughnessMap, metalnessMap, aoMap, specularMap)) - measured: pixels differ: max 29, 40.53% > 16, tolerance 2; centre jrs [184,184,184,255] three [202,202,189,255]; max diff 29, mean 6.987 |
| SKIP | bumpMap on a lit material | KNOWN GAP (bumpMap is not implemented by jrs's built-in shader (map keys: map, alphaMap, normalMap, emissiveMap, roughnessMap, metalnessMap, aoMap, specularMap)) - measured: pixels differ: max 24, 5.20% > 16, tolerance 2; centre jrs [184,184,184,255] three [184,184,184,255]; max diff 24, mean 1.261 |
| SKIP | displacementMap on a lit material | KNOWN GAP (displacementMap is not implemented by jrs's built-in shader (map keys: map, alphaMap, normalMap, emissiveMap, roughnessMap, metalnessMap, aoMap, specularMap)) - measured: pixels differ: max 135, 17.19% > 16, tolerance 2; centre jrs [184,184,184,255] three [184,184,184,255]; max diff 135, mean 14.205 |
| SKIP | map.channel = 1 (uses the uv1 attribute) | KNOWN GAP (Texture.channel is not honoured: the map always uses the uv attribute) - measured: pixels differ: max 255, 87.50% > 16, tolerance 0; centre jrs [199,199,110,255] three [199,199,110,255]; max diff 255, mean 56.167 |
| PASS | Sprite map (colorSpace sRGB, canvas) |  |
| PASS | PointsMaterial map with sizeAttenuation=false |  |
| PASS | map with alphaTest on an opaque material (discard uses texture alpha, output alpha forced to 1) |  |
| PASS | map shared by a lit and an unlit material and a ShaderMaterial (same texture object, three programs) |  |
| PASS | PointsMaterial with alphaMap, map rotation and repeat (point coordinate transform) |  |

### Large textures and streaming (7: 7 PASS)

| result | case | note |
|---|---|---|
| PASS | DataTexture 1024x1024 RGBA8: upload, render, and a second upload | max diff 0, mean 0.000 \| jrs: first upload+render 6 ms, second 33 ms  |
| PASS | DataTexture 2048x2048 RGBA8: upload, render, and a second upload | max diff 0, mean 0.000 \| jrs: first upload+render 8 ms, second 113 ms  |
| PASS | DataTexture 4096x4096 RGBA8: upload, render, and a second upload | max diff 0, mean 0.000 \| jrs: first upload+render 41 ms, second 410 ms  |
| PASS | DataTexture 2048x2048 Float RGBA32F (64 MB) is uploaded and sampled |  |
| PASS | DataTexture streamed every frame (1 MB per frame, 6 frames): texImage2D path, same pixels | max diff 0, mean 0.000 \| jrs: 6 frames in 38 ms |
| PASS | large DataTexture: jrs defines it with texImage2D (mapped-memory upload path), three.js uses texStorage2D + texSubImage2D | max diff 0, mean 0.000 \| jrs: texImage2D,texImage2D \| three: texStorage2D,texSubImage2D,texSubImage2D; jrs: createTexture×1 texImage2D×2 \| three: createTexture×1 texStorage2D×1 texSubImage2D×2 |
| PASS | small DataTexture keeps three.js storage path (texStorage2D + texSubImage2D) |  |

### Integer formats (11: 11 PASS)

| result | case | note |
|---|---|---|
| PASS | DataTexture RedInteger x UnsignedByte sampled with usampler2D |  |
| PASS | DataTexture RGInteger x UnsignedByte sampled with usampler2D |  |
| PASS | DataTexture RGBAInteger x UnsignedByte sampled with usampler2D |  |
| PASS | DataTexture RedInteger x UnsignedShort sampled with usampler2D |  |
| PASS | DataTexture RGBAInteger x UnsignedShort sampled with usampler2D |  |
| PASS | DataTexture RedInteger x UnsignedInt sampled with usampler2D |  |
| PASS | DataTexture RGBAInteger x UnsignedInt sampled with usampler2D |  |
| PASS | DataTexture RedInteger x Byte sampled with isampler2D |  |
| PASS | DataTexture RGInteger x Short sampled with isampler2D |  |
| PASS | DataTexture RGBAInteger x Int sampled with isampler2D |  |
| PASS | DataTexture RGBInteger x UnsignedByte sampled with usampler2D | single-colour result |

### Render target textures (8: 8 PASS)

| result | case | note |
|---|---|---|
| PASS | render target texture with generateMipmaps and a mipmap minFilter used as a map (minified) |  |
| PASS | render target type=HalfFloat: render then sample |  |
| PASS | render target type=Float: render then sample |  |
| PASS | render target type=UnsignedByte sRGB: render then sample |  |
| PASS | tone mapping (ACESFilmic) applies to the screen only: render target contents are untouched |  |
| PASS | tone mapping (Reinhard) applies to the screen only: render target contents are untouched |  |
| PASS | sRGB render target: clear colour, background colour and a ShaderMaterial with colorspace_fragment | both warn (1) |
| PASS | Texture.dispose on a render target texture then render target dispose does not double-free | single-colour result |

### Textures in batched draws (3: 3 PASS)

| result | case | note |
|---|---|---|
| PASS | twelve meshes of one geometry with four different textures (two share a Source), batched like three draws them |  |
| PASS | a texture swapped on a material between frames (same program, different map) |  |
| PASS | texture removed from a material between frames (map = null, needsUpdate) |  |

### state (8: 8 PASS)

| result | case | note |
|---|---|---|
| PASS | sampler parameters changed after the first upload without needsUpdate are ignored (wrap, filter) |  |
| PASS | sampler parameters changed with needsUpdate are applied |  |
| PASS | the same texture object in two map slots of one material (map and emissiveMap) |  |
| PASS | InstancedMesh with a map and instance colours (not batched, own draw) |  |
| PASS | material.transparent toggled without needsUpdate on a texture with alpha < 1 (OPAQUE define follows the program cache) |  |
| PASS | material.transparent toggled with needsUpdate on a texture with alpha < 1 (OPAQUE define follows the program cache) |  |
| PASS | a map assigned to a material after its program was built (map was null at first render) |  |
| PASS | a texture re-used after dispose is uploaded again and keeps userData |  |

