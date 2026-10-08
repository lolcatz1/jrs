# Per-map uv transforms and texture channels

Branch `swarm/per-map-transform`. jrs used to apply the first map's `offset/repeat/rotation/center` to every map of a
material and to read `aoMap` from `uv1` whenever the geometry had one. It now follows three.js r186: one transform and one
uv channel per map.

## What changed

* **Material block** (`ShaderLib.js`, `_syncMaterialBlock` in `WebGLRenderer.js`): the three `uvTransform` vec4s are replaced
  by `vec4 uvT[11]` holding one affine transform per map slot (6 floats: m0 m1 m3 m4 m6 m7 of `Texture.matrix`; the last
  row is always 0 0 1, so a mat3 is rebuilt in the shader with `UV_TRANSFORM( slot )`). Slots: 0 map, 1 alphaMap,
  2 emissiveMap, 3 normalMap, 4 aoMap, 5 roughnessMap / specularMap (never on the same material type), 6 metalnessMap.
  `Texture.updateMatrix()` runs when `matrixAutoUpdate`, as in `refreshTransformUniform`.
* **Varyings**: `vMapUv`, `vAlphaMapUv`, `vEmissiveMapUv`, `vNormalMapUv`, `vAoMapUv`, `vRoughnessMapUv`,
  `vMetalnessMapUv`, `vSpecularMapUv`, declared only for maps the material has (`USE_<MAP>_UV`). The vertex shader computes
  `( transform * vec3( <MAP>_UV, 1 ) ).xy` like three's `uv_vertex`; `<MAP>_UV` is a define resolving to `uv`, `uv1`, or
  `vec2( 0.0 )`. Points sample map and alphaMap with the map's transform (three's `uvTransform`).
* **Channels** (`WebGLPrograms.getParameters`): `texture.channel` 0 selects `uv`, 1 selects `uv1`. A missing attribute reads as
  (0, 0) like a disabled attribute in three. The program key gets the per-map source code appended (`key + ':' + code`) only
  for materials with maps. The batch-group signature includes the channel, so materials that differ only in channel never
  share a batched draw.
* Normal maps on `BackSide` materials flip the tangent frame the way three does (found by the fuzzer with this feature on); only
  `DoubleSide` uses `faceDirection`.
* Only the used prefix of a record (20 floats + 6 per highest used slot) is compared and uploaded.

### Block layout

| | before (this branch's first version) | integration tip (envmaps) | after (this branch, merged) |
|--|--|--|--|
| size | 128 B (8 vec4) | 192 B (12 vec4) | 320 B (20 vec4) |
| 0..79 | diffuse, emissive, specular, params, params2 | unchanged | unchanged |
| 80..143 | uvTransform0..2 (one mat3) | uvTransform0..2 + envParams + envMapRotation (mat3) | envParams + envMapRotation (floats 20..35) |
| 144..319 | - | - | `uvT[11]`: 7 transforms x 6 floats (floats 36..77), 2 spare |

The environment-map fields keep their meaning (envMap has no uv transform in three.js); the single `uvTransform` mat3 is
replaced by the per-map transforms. 7 slots + env + base do not fit 256 B, so the record is 320 B.

Stride handling (`WebGLRenderer`): the record size is no longer padded into the stride with `max( size, alignment )`
(wrong once the size exceeds the alignment, it gave unaligned `bindBufferRange` offsets and GL_INVALID_VALUE). Records are
kept in two buffers, both written when a record changes:

* `_materialBuffer`: stride = size rounded up to `UNIFORM_BUFFER_OFFSET_ALIGNMENT` (512 B where the alignment is 256), used
  for single-material binds at `slot * stride`.
* `_materialTight`: records back to back (`MaterialRecord` has no `mPad`, `_materialPad` = 0), used for material-index
  windows. A window holds `min( 256, MAX_UNIFORM_BLOCK_SIZE / 320 )` records rounded down to a multiple of
  `alignment / gcd( 320, alignment )` so that each window starts at an aligned offset: 204 records with a 64 KB block limit and
  256 B alignment (48 with 16 KB). Padding the records instead would have halved the window to 128 and turned the
  200-material `many-materials` scenario from 3 into 6 draws.

## Validation

* `npm test`: 152/152. `node bench/conformance.mjs`: all pass, including the new check
  *"Per-map uv transforms and channels: map, alphaMap, emissiveMap, aoMap on one material (matches three.js)"*
  (map and alphaMap with different offset/repeat/rotation/center, alphaMap and aoMap on `channel: 1`, a second material with the
  same textures on channel 0; max diff 0 vs three.js; it fails on the old code with mean 19 / max 212).
* Fuzzer: `perMapTransform` is now on by default. The generator gives maps independent texture clones (own transform, wrap and
  channel) and adds normal / ao / roughness / metalness maps from a separate rng stream, plus a `uv1` attribute on every
  geometry (derived from positions). Wireframe materials get no extra maps (1 px lines make LOD / derivative-based sampling
  rasteriser-dependent).
  `node bench/fuzz.mjs --seeds=100 --continue`: before the fixes 27 seeds failed; with the feature off the same seeds give
  12 failures that are unrelated to maps (8 23 27 28 35 61 63 65 78 85 93 99). After this branch, with the feature on:
  all failures are in the baseline set; every seed that failed only because of per-map transforms now passes.
  After the final merge with the envmap tip: `node bench/fuzz.mjs --seeds=30 --continue --enable=perMapTransform` fails
  2 8 12 14 23 27, exactly the integration tip's list; `--seeds=100` additionally 35 61 63 78 85 93 99 (the earlier baseline).
  The generator never gives an independent extra map a render target texture (the RT's content differs slightly between the
  libraries and alpha tests / emissive amplify it). A 700-material scene (buffer growth, 4 windows) renders identically to three.js.
* Benchmarks: see below.

## Benchmarks

The shared machine was very noisy (the same scenario varies 2x between runs on both the integration tip and this branch), so
the 5% criterion could not be decided from the committed `latest.json` numbers. A/B runs alternating the integration tip and
this branch on the same machine: `many-materials` 0.9-1.2 ms vs 1.0-1.2 ms, still 3 draws and 11 GL calls per frame;
`shared-static` 1.3-2.6 ms vs 1.4-3.2 ms (overlapping ranges, same draw count). Image comparison against three.js is at or
below `latest.json` in every scenario (meanAbsDiff/maxDiff). `bench/results/latest.json` is not modified by this branch.
Final `node bench/run.mjs --compare --frames=60` after the envmap merge: meanAbsDiff / maxDiff equal to `latest.json` in all 17
existing scenarios (none worse; `pbr-envmap` 0 / 0), draw counts unchanged (`many-materials` 3). Medians on this box were
1.3-2x the committed ones in every scenario, including ones that do not touch materials or maps (`shader-client-static`
25 -> 49 ms, a ShaderMaterial scene), so that run measures machine load, not this change; the interleaved A/B runs above are
the comparison to trust.

## Risks

* Two copies of every material record (aligned + tight): one extra `bufferSubData` per changed record and about 60% more
  material buffer memory. Windows hold 204 records (64 KB block limit) or 48 (16 KB).
* `texture.channel` >= 2 is treated as a constant (0, 0): jrs has no `uv2` / `uv3` attributes.
* The program key is a number for materials without maps and a string for those with maps. The integer key was already close
  to 2^53 (55 bits of flags); worth rebuilding as a structured key.
* bump, light and displacement maps are not implemented in jrs, so they have no transform slot.

## Follow-up ideas

* Dedupe varyings at compile time when several maps are the same texture object with the same matrix.
* Skip the per-frame texture-matrix refresh for materials whose textures are `matrixAutoUpdate = false` and unchanged.

## Merge with lines / points / sprites and skinning-perf (tip 9290f22)

* `_syncMaterialBlock` keeps the dash sizes (`s[12..14]`) and the points height (`s[19]`) next to the per-map transform loop.
* Points: `pointsUv` (points with a `uv` attribute and a map or alphaMap) adds a `vPointUv` varying = the map's transform (slot 0,
  identity without a map) x `uv`; without the attribute the fragment shader transforms `gl_PointCoord` with the same slot.
  The alphaMap shares that uv, as in three.js. `texture.channel` is ignored for points (three.js: USE_POINTS_UV).
* `getParameters` assigns `mapUv ... specularMapUv` and `pointsUv` onto the reusable `this._params`; the key keeps the appended code.
* Validation on the merged tree: `npm test` 179/179, conformance 0 failures, `node bench/lps.mjs` all within tolerance,
  `node bench/fuzz.mjs --seeds=30 --continue --enable=perMapTransform` fails only 8 12 27 (the tip's list), `smoke.mjs`
  glError 0, `addons.mjs` no failures; points with map / alphaMap, with and without `uv`, and transformed textures match three.js (max diff 0).
  Full `node bench/run.mjs --compare --frames=60`: no scenario's meanAbsDiff / maxDiff above `latest.json` (23 scenarios).
  Medians were again 1.5-3x the committed ones on this loaded machine. Interleaved A/B against the tip (3 pairs, ms):
  many-materials tip 1 / 0.9 / 0.9 vs branch 1.5 / 1.1 / 1.0, shared-static 1.1 / 1.7 / 0.9 vs 0.9 / 1.6 / 0.9,
  hierarchy-animated 9.8 / 9.3 / 11.4 vs 7 / 7.8 / 8.5. many-materials is the one scenario where the branch looks up to
  ~10% slower at the 0.1 ms resolution of the timer (one extra `bufferSubData` per changed record and 7 transform reads per
  material per frame when the scene's materials are rewritten); it is within the run-to-run spread, so treat it as a
  possible small cost, not a measured one.
