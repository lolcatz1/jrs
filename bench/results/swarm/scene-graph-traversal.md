# Scene-graph traversal / matrix update / culling

Branch: `swarm/scene-graph-traversal`, rebased by merge onto integration commit 137051f.

**Result against the new base: no measurable gain.** The one change that moved the numbers (the TRS change-detection snapshot in a Float64 slab: static `updateMatrixWorld` 1.3 -> 0.7 ms per 10k objects, shared-static 3.8 -> 3.2 ms) was independently delivered by `swarm/zero-alloc-frame`; on the merge I kept that branch's layout (`page.snapshot`, `_snapData/_snapOffset`) and dropped mine.

## What this branch still adds on top of the base
1. **Cull-cache doubles in the snapshot record**: `_cullRadius/_cullCx/Cy/Cz` (four boxed fields on each Object3D) now live at `snapshot[+10..+13]` (`SNAPSHOT_SIZE` 10 -> 14, `CULL_SNAPSHOT_OFFSET`). `_cullTest` also reads the sphere centre/radius once into locals.
2. **`_projectObject`**: mesh/line/points tested first (the `is*` flags are disjoint, so behaviour is identical); camera layer mask read once per render (`_cameraLayerMask`) instead of `layers.test()` per object.
3. **`bench/profile.mjs`** fixes: it crashed on a method that no longer exists (`batcher.upload`); recursive wrappers double-counted; the no-batch pass polluted the phase timers; added a `scene.updateMatrixWorld` phase. This is the part worth merging on its own.

## Measurements (branch vs base 137051f, interleaved A/B x3, in-page median ms per call, 10k objects, timer resolution ~0.1 ms)
| scenario | updateMatrixWorld base / mine | _projectObject base / mine | render() base / mine |
|---|---|---|---|
| shared-static | 0.70-0.72 / 0.71-0.73 | 0.63-0.67 / 0.64-0.66 | 3.1-3.2 / 3.2-3.3 |
| shared-animated | 0.75-0.80 / 0.74-0.99 | 0.65-0.66 / 0.62-0.69 | 3.8-4.1 / 3.7-5.0 |
| hierarchy-animated | 0.74-0.96 / 0.77-0.80 | 0.78-1.16 / 0.79-1.16 | 3.5-4.1 / 3.5-3.8 |

All within run-to-run noise; **delta of the remaining changes is not measurable.** `run.mjs` medians (full `--compare --frames=60` plus two repeat runs of hierarchy-animated / shader-client / shared-static, best of runs): shared-static 3.1-3.3, shared-animated 5.4, hierarchy-animated 3.9 (base 4.2), many-materials 3.8, unique-geometries 1.1, instanced-100k 0, shader-client 2.9-4.5 (noisy). No regression beyond noise; instanced-100k has a ~0 ms CPU median (one object), so there is nothing to gain there.

## Validation
`npm test` 100/100; conformance + addons PASS (27 passes), smoke, 0 FAIL; `run.mjs --compare`: meanAbsDiff/maxDiff identical to the base's `latest.json` on every scenario that has a stored baseline (shadows-animated has none in the base file; it reports 0.121 / 31, in line with `shadows`). `bench/results/latest.json` left untouched.

## Profile finding
Stubbing `_pushItem` out leaves `_projectObject` at ~0.65 ms / 10k objects, so the ~65 ns/object left is traversal + cull reads, i.e. cache misses over scattered heap objects (Object3D, its `children` array, `layers`, geometry, slab record) rather than arithmetic or list pushes.

## API-compatibility risks
- Private `_cullRadius/_cullCx/Cy/Cz` no longer exist (nothing in `src/` reads them).
- No traversal structure is cached, so direct `children` mutation, `object.matrix` edits, `matrixAutoUpdate=false` and `matrixWorldAutoUpdate` semantics are untouched.
- Recycled slab slots: cull-cache doubles are stale on reuse, but `_cullVersion = -1` in the constructor forces a recompute before they are read.

## Not done, and why
- Flat per-scene renderable list, skipping unchanged objects, caching cull results per frustum epoch: `visible`, `layers`, `material`, `geometry`, `frustumCulled`, `children` and `position` are plain mutable properties; any cache needs a visit per object to validate, and making them accessors is a broad, risky change for ~0.5 ms at 10k objects. Iterative traversal: recursion is not the cost (scenes here are flat or 40 deep).

## Follow-up ideas
- Put `visible`, `layers.mask`, `frustumCulled` and the geometry/material refs behind slab-backed accessors so the project loop touches one record per object (and a static frame could validate a cached render list with one version check).
