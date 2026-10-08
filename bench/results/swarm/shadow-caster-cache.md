# Swarm report: shadow caster cache + cull result cache

## What changed
- **Shadow map skip (`WebGLShadowMap.js`, scout item 12).** Per light, each frame walks the casters *without* culling, pushing, resolving, sorting or drawing, and builds a signature: shadow-camera projection and view matrices, map size, shadow-camera layer mask, renderer env version, shadow type, and per caster `(id, _worldVersion, material digest, geometry digest, frustumCulled, instanceMatrix version/count/radius)`. If it is bit-identical to the signature the map was last rendered from (same map object, same GL context epoch), the whole shadow pass for that light is skipped: no clear, no collect, no cull, no program resolve, no sort, no matrix-texture fill, no draws, no render-target switch. The depth map stays valid. Comparison is exact (typed-array equality, early exit on first difference); only the per-material / per-geometry digests are 32-bit hashes (computed once per material/geometry per frame).
  - Material digest: id, version, visible, side, shadowSide, wireframe, transparent, depthWrite, depthTest, colorWrite, blending, polygonOffset (+factor, units). Geometry digest: id, layout version, position version/count, index version/count, drawRange, instanceCount, bounding sphere.
  - **Uncacheable** (always render, re-probed every 30 frames): alpha-tested casters, `ShaderMaterial` casters, material arrays, non-Mesh casters (Line/Points), `onBeforeRender`/`onAfterRender` overrides.
  - **Back-off for animated casters:** on a mismatch the walk stops at the first changed caster; after two consecutive mismatches the signature is not computed for the next 3 frames. A scene that becomes static is detected a few frames late, then skips. Animated scenes pay ~nothing extra.
  - `shadow.needsUpdate = true` / `renderer.shadowMap.needsUpdate = true` force a render. Context restore bumps an epoch that invalidates all signatures.
- **Cull result cache (`Frustum.js`, `WebGLRenderer._cullTest`, scout item 17).** `Frustum.version` is a globally unique number taken whenever one of the 24 plane floats changes (`_syncFlat` exact-compares before writing). Each object stores the frustum version and result of its last test for two slots (camera pass, shadow pass). Same frustum version and unchanged world sphere gives the stored bit instead of six dot products. Re-computing the world sphere clears both slots.
- **Render-order table isolation.** The shadow pass reset and refilled the renderer's renderOrder rank table, which the main pass reads afterwards in `list.finish`. The shadow pass now uses its own table and restores the main one. Output is identical for scenes with a single `renderOrder` (every benchmark); a scene whose main-pass renderOrders differ from its casters' no longer takes ranks from the shadow pass (it was a latent bug, and it would otherwise alternate between skip and render frames).
- `bench/shadow-cache.mjs`: invalidation test (cached renderer vs the same renderer with a forced shadow render, pixel-exact).

## Numbers (headless Chromium / SwiftShader, noisy machine, JS-side ms)
Baseline (merged shadow-pass branch, before my changes) vs after; `run.mjs --compare --frames=60`, better of two:

| scenario | before | after |
|---|---|---|
| shadows | 1.9 | 1.0 |
| shadows-animated | 1.6 | 1.9 (noise: see below) |
| shared-static | 4.0 | 3.7 |
| shared-animated | 5.5 | 5.3 |
| many-materials | 4.8 | 4.4 |
| unique-geometries | 1.1 | 1.1 |
| hierarchy-animated | 4.3 | 5.0 |
| shader-client | 2.9 | 2.6 |
| shader-client-static | 22.9 | 20.1 |

Direct timing of `shadowMap.render` (200 frames, trimmed mean/median): shadows **0.5 ms to 0.08 ms**, frame 1.3 to 0.9 ms. shadows-animated shadow pass 0.6-0.8 before vs 0.6-0.9 after across repeats (within noise; a third of the casters move, so every frame re-renders). The target of 0.5 ms total was not reached: the remaining ~0.9 ms is scene-graph update (0.65) and main-pass project/cull/draw-list. The per-frame hierarchy-animated/shared-animated numbers swing 20% between identical runs on this machine.
Pixel comparison: all scenarios have meanAbsDiff/maxDiff equal to baseline (shadows 0.134 / 33, shadows-animated 0.121 / 31, shared-static 0.347 / 8).

## Validation
`npm test` 100/100; conformance, addons, smoke pass (smoke logs one 404 resource load, unrelated); `bench/fuzz.mjs` does not exist on this branch; `bench/shadow-cache.mjs` 21/21.
Edge cases tested (all pixel-exact vs forced render, and map re-rendered exactly when it should be): static (skipped), main camera moved (skipped), caster moved, light moved, light target moved, caster hidden/shown, removed/added, `castShadow` toggled, new caster, material `side`, geometry attribute edited, geometry replaced, caster reparented under moved group, map size changed, shadow-camera frustum edited, alpha-tested caster (always renders).

## Risks
- Anything that changes the depth output but is not in the signature would leave a stale map. Not covered: in-place edits of `matrixWorld.elements` without `_worldVersion` (same assumption the batcher already makes), position data mutated without `needsUpdate`, `material.alphaTest` is handled (uncacheable) but custom code relying on `onBeforeShadow` is not called by this renderer anyway.
- `info.render.calls/triangles` no longer include the shadow pass on skipped frames.
- The signature walk is a full recursive traversal of the scene per shadow light per frame (megamorphic loads); it is cheap but not free.

## Follow-up ideas
- Skip the walk itself: a global "any world version / structure changed" counter (scout #15) needs dirty signals for `visible`, `castShadow`, material fields.
- For animated shadows, keep the sorted caster list and only patch moved objects; reuse the main pass's traversal to build the signature.
- Share the matrix texture between shadow and main passes.
