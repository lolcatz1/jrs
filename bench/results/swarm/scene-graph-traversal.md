# Scene-graph traversal / matrix update / culling

Branch: `swarm/scene-graph-traversal`. Result: **small gain (~5-15% on the static and hierarchy scenarios), well inside bench noise for the animated ones.** The larger ideas in the brief were investigated but not implemented; reasons below.

## What changed
1. **Transform change-detection snapshot moved into a Float64 slab** (`TransformSlab.js`, `Object3D.js`). The ten `_px.._sz` boxed-double fields are now 10 doubles in a per-page `Float64Array` (stride 16, indexed by the object's slab slot). The per-object `updateMatrix()` check for a static object now reads one contiguous run instead of ~10 separate heap numbers. Semantics are unchanged (`NaN` in slot 0 still forces a recompose; `applyMatrix4`, `copy`, slot recycling all go through the same record).
2. **Cull-cache doubles** (`_cullRadius`, `_cullCx/Cy/Cz`) live in the same record (+10..+13) instead of boxed fields on the object.
3. **`_projectObject`**: mesh/line/points branch tested first; camera layer mask read once per render instead of `layers.test()` per object. Disjoint `is*` flags, so behaviour is identical.
4. `bench/profile.mjs`: wrappers for methods that no longer exist crashed it; the no-batch pass polluted the phase timers; recursive wrappers double-counted. Fixed (skip missing, re-entrancy guard, snapshot timers before the no-batch pass).

## Profile (10k objects, in-page microbench, median ms/call; timer resolution ~0.1 ms)
| | updateMatrixWorld | _projectObject | whole `render()` |
|---|---|---|---|
| shared-static before | 1.3 | 0.7 | 3.8 |
| shared-static after | 0.7 | 0.7 | 3.1-3.3 |
| hierarchy-animated before | 1.5 | 0.8 | 3.8 |
| hierarchy-animated after | 0.75 | 0.8 | 3.3-3.6 |

Stubbing `_pushItem` out leaves `_projectObject` unchanged at ~0.7 ms, so the remaining cost (~70 ns/object) is traversal + cull reads, i.e. cache misses over scattered heap objects (Object3D, `children` array, `layers`, geometry, slab record), not arithmetic.

## Benchmark medians (ms, `run.mjs --nocount`, best of two runs; noise is roughly +/-1 ms on this box)
| scenario | before | after |
|---|---|---|
| shared-static | 3.8 | 3.2 |
| shared-animated | 5.2 | 5.0 |
| hierarchy-animated | 4.3 | 3.8-4.0 |
| many-materials | 4.1 | 3.8 |
| instanced-100k | 0 | 0 |

`instanced-100k` has a ~0 ms CPU median (one object; nothing to traverse), so there was nothing to gain there. Full `--compare` run: every scenario's meanAbsDiff/maxDiff is identical to `latest.json`. `bench/results/latest.json` was restored (not committed) to avoid noise.

## Validation
`npm test` 100/100; `conformance.mjs`, `addons.mjs`, `smoke.mjs` all PASS (0 FAIL); compare diffs unchanged.

## API-compatibility risks
- `object._px/_qx/_sx/_cullRadius/...` private fields no longer exist; nothing in `src/` reads them. External code poking at underscore fields would break (unlikely).
- Direct `object.matrix` / `position` mutation, `matrixAutoUpdate=false`, `children` push/splice: untouched, since no traversal structure was cached. That is why the flat-list idea was not done (below).
- Each Object3D now owns a Float64 record (+128 B/object in slab pages; 16 doubles incl. 6 spare).

## Not done, and why
- **Flat per-scene renderable list / skipping unchanged objects**: `visible`, `layers`, `material`, `geometry`, `frustumCulled`, `children` and `position` are plain properties users mutate without notification, so a cached list or cull result cannot be trusted without visiting each object. Making them accessors would be a broad, risky change for a ~0.5 ms win at 10k objects.
- **Iterative traversal**: recursion is not the cost (flat scene = one level); expected gain nil.
- **Cull-result caching per frustum epoch**: tests are ~12 flops on L1-hot data; the object touch dominates.

## Follow-up ideas
- Move `visible`/`layers.mask`/`frustumCulled`/geometry+material refs into a slab-backed accessor layout so the project loop touches one record per object.
- Share one frozen empty children sentinel is NOT possible (public mutable array); instead lazily allocate `children`... also API-visible. Probably leave.
- Cache the whole render list when a global "anything changed" epoch (world versions + structure) is unchanged, if `visible`/material become tracked.
