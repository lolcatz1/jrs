# uniform-dirty-tracking

## What changed
`src/renderers/WebGLRenderer.js`: the **Lights** and **Frame** UBO uploads are skipped when the freshly built
std140 image is bit-identical to the copy last uploaded (`_lightsUploaded`, `_frameUploaded`; a float compare of
~160 and 64 floats). The images are still rebuilt every frame, so nothing is detected by *notification*; it is
detected by *value*. This is deliberately not a version-counter scheme (see risks). `_blocksValid` forces an upload
on the first frame and after a context restore. Nested renders (shadow pass, render targets) are handled because
the compare is against what the GPU buffer holds, not against the previous render() call.

`bench/conformance-tests.js`: new test "Unchanged Frame/Lights blocks are skipped, direct mutations still upload"
(static frame twice is identical; then `light.intensity`, `light.color.r`, fog creation, `fog.near/far`, camera
position are each mutated directly with no `needsUpdate`, and each must change the pixels).

## Not changed, and why
* **Material slots** still do the 32-float compare every frame. Profiling many-materials (`_syncMaterialBlock`
  wrapped in a timer) shows it is ~1% of the frame (2.5 ms of 271 ms over the profile run); drawList/setupMaterial
  and `project` dominate. Skipping it needs change notification on `color.r`, `opacity`, `roughness`, ... which are
  plain public fields users mutate directly. Making `Color.r/g/b` accessors would touch every Color in the engine
  for a ~1% gain, and a *scheduled* fallback compare would let a direct mutation show up frames late, which breaks
  the "a changed value must be uploaded that frame" rule. So I left it exact.
* **Light version counters / per-frame hash**: same reasoning. `light.intensity = x` and `light.color.r = x` are
  plain writes. A value compare of the built image is both exact and cheap (Lights fill is ≤18 lights).

## Results (headless Chromium / SwiftShader, 60 frames, best of 2 medians; machine is noisy, ±1 ms run to run)
| scenario | jrs median before → after (ms) | GL calls/frame before → after |
|---|---|---|
| shared-static | 3.7 → 3.8 | total 8 → 4, buffer uploads 2 → 0 |
| shared-animated | 4.9 → 5.4 (3 reruns each: new 5.3–6.5, old 5.6–7.8) | total 11 → 7, uploads 2 → 0 |
| many-materials | 3.8 → 5.5 first pass; 3 reruns each: new 3.7/3.7/7.4, old 4.9/4.6/5.0 | total 2006 → 2002, uploads 2 → 0, uniform* 600 → 600 |
| unique-geometries | 1.5 → 1.4 | total 7 → 3 |
| hierarchy-animated | 4.1 → 4.1 | total 11 → 7 |
| instanced-100k | 0 → 0 | total 8 → 4 |
| shader-client | 3.2 → 2.9 | total 3324 → 3320, uploads 2 → 0 |
| shader-client-static | 25.4 → 27.7 (noisy, ~±3) | total 1625 → 1619, uploads 6 → 3 |
| shadows | 1.5 → 1.6 | total 28 → 26, uploads 3 → 2 |

Honest summary: the GL-call counts drop as intended (2 `bufferSubData` per render removed on static scenes), but
the CPU medians are within noise. **The task's target of dropping many-materials / shared-static / shadows medians
was not met**; those scenarios are already ~1.5–4 ms and the removed work is a couple of driver calls.
`uniform*` per frame is unchanged because it comes from per-batch `drawBase` and ShaderMaterial uniforms, not the blocks.

Correctness: `bench/run.mjs --compare` meanAbsDiff/maxDiff identical to `bench/results/latest.json` in every
scenario (shadows 0.134/33, shared-static 0.347/8, shared-animated 0.346/9, rest 0/0). `npm test` 100/100,
conformance (incl. new test), addons, smoke all pass. `latest.json` was restored to the reference, not overwritten.

## Risks
* Direct mutation of light/camera/fog/exposure values: covered because detection is by value on the built image.
  Covered by the new conformance test.
* A NaN in the image compares unequal and simply re-uploads every frame (safe).
* Anything else that writes into the Frame/Lights buffers outside `render()` would desync the cache; nothing in
  the repo does (only these two call sites call `bufferSubData` on them).

## Follow-up ideas
* The real remaining cost in many-materials is `setupMaterial` (~1/3 of drawList) and `project`, not uniforms.
* If Color/Vector2 ever gain versioned storage for another reason, material slot sync can be gated on it for free.
* Skip `Lights.fill()` itself when no light's `matrixWorld` version/intensity/colour moved (needs the same notification story).
* `bench/profile.mjs` is stale (wraps `batcher.upload` / `bindingStates.bind`, which no longer exist) and throws.
