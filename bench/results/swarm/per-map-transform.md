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

| | before | after |
|--|--|--|
| size | 128 B (8 vec4) | 256 B (16 vec4) |
| 0..79 | diffuse, emissive, specular, params, params2 | unchanged |
| 80..127 | uvTransform0..2 (one mat3, 3 vec4) | uvT[0..11) : 7 transforms x 6 floats, 2 floats spare |

`MATERIAL_BLOCK_SIZE`, the scratch / `blockData` arrays, `MaterialRecord` (+ `mPad`), the stride
(`max(size, UNIFORM_BUFFER_OFFSET_ALIGNMENT)`) and the `bindBufferRange` windows all derive from that constant.
On devices with 256 B alignment the stride was already 256, so nothing changes there. With a 16 KB uniform block limit a
material window drops from 128 to 64 records (64 KB: capped at 256 either way).

## Validation

* `npm test`: 139/139. `node bench/conformance.mjs`: all pass, including the new check
  *"Per-map uv transforms and channels: map, alphaMap, emissiveMap, aoMap on one material (matches three.js)"*
  (map and alphaMap with different offset/repeat/rotation/center, alphaMap and aoMap on `channel: 1`, a second material with the
  same textures on channel 0; max diff 0 vs three.js; it fails on the old code with mean 19 / max 212).
* Fuzzer: `perMapTransform` is now on by default. The generator gives maps independent texture clones (own transform, wrap and
  channel) and adds normal / ao / roughness / metalness maps from a separate rng stream, plus a `uv1` attribute on every
  geometry (derived from positions). Wireframe materials get no extra maps (1 px lines make LOD / derivative-based sampling
  rasteriser-dependent).
  `node bench/fuzz.mjs --seeds=100 --continue`: before the fixes 27 seeds failed; with the feature off the same seeds give
  12 failures that are unrelated to maps (8 23 27 28 35 61 63 65 78 85 93 99). After this branch, with the feature on:
  11 failures, all of them in that baseline set. Every seed that failed only because of per-map transforms now passes.
  `--seeds=50` without `--continue` stops at seed 8, a baseline failure.
* Benchmarks: see below.

## Benchmarks

The shared machine was very noisy (the same scenario varies 2x between runs on both the integration tip and this branch), so
the 5% criterion could not be decided from the committed `latest.json` numbers. A/B runs alternating the integration tip and
this branch on the same machine: `many-materials` 0.9-1.2 ms vs 1.0-1.2 ms, still 3 draws and 11 GL calls per frame;
`shared-static` 1.3-2.6 ms vs 1.4-3.2 ms (overlapping ranges, same draw count). Image comparison against three.js is at or
below `latest.json` in every scenario (meanAbsDiff/maxDiff). `bench/results/latest.json` is not modified by this branch.

## Risks

* Block growth halves the material window on GPUs with a 16 KB uniform block limit (more material pages per scene).
* `texture.channel` >= 2 is treated as a constant (0, 0): jrs has no `uv2` / `uv3` attributes.
* The program key is a number for materials without maps and a string for those with maps. The integer key was already close
  to 2^53 (55 bits of flags); worth rebuilding as a structured key.
* bump, light and displacement maps are not implemented in jrs, so they have no transform slot.

## Follow-up ideas

* Dedupe varyings at compile time when several maps are the same texture object with the same matrix.
* Skip the per-frame texture-matrix refresh for materials whose textures are `matrixAutoUpdate = false` and unchanged.
