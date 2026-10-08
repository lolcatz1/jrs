# swarm/shadermaterial-uniform-list

## What changed (`src/renderers/WebGLRenderer.js`)
- `_uploadShaderMaterialUniforms` now walks a cached **uniform plan** (`material._uniformPlan`) of parallel arrays
  `{names, records (program uniform record), objects (material uniform objects)}`. Only uniforms the program has are
  listed; names resolving to structs / arrays-of-structs / flattened arrays get a `null` record and still go through
  `_uploadUniform` (same recursion, same sampler/placeholder/feedback-loop logic). `.value` is read live from the held
  uniform object, so uniform objects shared between materials still work.
- Plan is rebuilt when the program, `material.uniforms` identity, `material.version` (`needsUpdate`) or
  `Object.keys(uniforms).length` changes.
- `setUniformValueImpl`'s ~20-way switch is split into per-type functions (`setFloat`, `setVec3`, `setMat4`, `setSampler`, ...)
  chosen once per uniform record (`u.setter`, via `pickSetter`). Bodies are unchanged, so the cache semantics,
  trace counting (`traceCounter`) and `uniformTrace` counts are identical.
- Item 10: in `_renderItem` the 16-float `cacheSlab` compare of `modelMatrix` is skipped when the uniform record's last
  object and `_worldVersion` match (`mu._lastObject/_lastVersion`); the identity-matrix paths in the batch/multi-draw
  renderers reset `_lastObject` since they overwrite that cache.

## Results (software GL; noisy)
Full `bench/run.mjs --compare --frames=60` after merging origin: shader-client jrs 6.3 ms (baseline run 23.6 / 6.2-8.4 in
other runs), shader-client-static jrs 66.4 ms (baseline 63.4; 31-61 across runs). Whole-frame medians vary by >2x between
identical runs on this machine, so they cannot resolve the change. A targeted timer around
`_uploadShaderMaterialUniforms` (60 frames, 2-3 runs each): shader-client 0.89-1.10 ms new vs 1.00-1.09 ms base;
shader-client-static 0.21-0.38 ms new vs 0.40 ms base. i.e. a small gain at best (the phase is dominated by
`bindTexture` GL calls and cache compares, not the loop).

GL counts (unchanged): shader-client uniform* 1055, bindTexture 171, useProgram 13;
shader-client-static passes 147 / 147 / 187 (baseline 147/147/187). Compare: all meanAbsDiff/maxDiff equal to previous latest.json.
Validation: `npm test` 100/100, conformance, addons, smoke (glError 0) pass. `bench/fuzz.mjs` does not exist.

## Risks
- Replacing a uniform *object* under an existing key (`m.uniforms.foo = {value}`) with the same key count is not detected
  until `material.needsUpdate = true` (or the uniforms object is replaced). Mutating `.value` is fine.
- Uniform names present in the material but absent from the program with primitive values are dropped from the plan; if such
  a value later turns into a struct/array without `needsUpdate`, it is not uploaded.
- Item 10 trusts `_worldVersion`; writing `matrixWorld.elements` directly (without `matrixWorld = ` / update) is no longer
  caught by the compare on repeated draws of the same object (same trust the cull/normal-matrix caches already place in it).
- `Object.keys(uniforms).length` allocates per material switch; a cheaper key-change signal would help.

## Follow-ups
- Per-material "dirty" signal for uniform objects (Proxy-free) so unchanged materials skip the walk entirely.
- Sampler binding (`bindTexture`/`bindEmpty`) is the dominant cost left in the upload phase.
- `bench/profile.mjs` is stale (`bind` of undefined); `profile-cpu.mjs` from origin may replace it.
