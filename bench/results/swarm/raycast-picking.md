# Swarm report: raycasting and picking

Branch `swarm/raycast-picking`. Benchmark: `node bench/raycast.mjs` (pure node, no browser; `--quick` for a smoke run, `--json --out=file` for raw data).
Raw data: `raycast-baseline-{1,2}.json` (before) and `raycast-after-{1,2}.json` (after) in this directory.

## Benchmark

Each scenario is built identically with three.js r186 and jrs from seeded data, the same rays are cast through
`Raycaster.intersectObjects` / `intersectObject`, the **complete hit lists are compared** (object, order, face index,
instanceId, distance within 1e-5 relative; jrs stores matrices as float32, three.js as doubles, the largest difference
seen is 7e-7) and the median of 5 repetitions is reported. The run exits non-zero on any mismatch.

| id | scene | rays |
|---|---|---|
| a | 10 000 small meshes (box / low-poly sphere / cylinder / icosahedron, mixed Front/Back/Double side, random transforms) | 1 000 via `intersectObjects(scene.children, true)` |
| b | one `SphereGeometry(708, 708)` mesh, 1 001 112 triangles | 1 000 via `intersectObject` (three.js is brute force: it is timed on 20 rays and scaled to 1 000) |
| c | 2 000 meshes whose transforms change every frame (position, rotation, scale), 10 frames; `updateMatrixWorld` excluded from the timing | 200 per frame |
| c2 | 200 moving groups x 10 child meshes (hierarchy: children inherit parent motion), 10 frames | 200 per frame |
| d | `InstancedMesh`, 1 000 sphere instances | 1 000 via `intersectObject` |

SkinnedMesh is not implemented in jrs (README: "skinning not implemented"), so it is skipped.

### ms per 1 000 rays (best of two full runs of the benchmark; lower is better)

The sandbox is slow and noisy (a trivial JS loop runs at ~2.6 ns/iteration, three.js numbers vary +-30% between runs), so compare ratios within one run.

| scenario | three.js | jrs before | jrs after | after vs three.js | after vs before |
|---|---:|---:|---:|---:|---:|
| a 10 000 meshes | 1 751 | 2 408 (run 1: 3 471) | **1 012** | 1.7-1.8x faster | 2.4x |
| b 1M triangles | ~106 000 (scaled from 20 rays) | 21.0 | **17.0** | ~6 000x | 1.2x |
| c 2 000 moving meshes | 274 | 236 | **150** | 1.7-1.8x | 1.6x |
| c2 hierarchy | 256 | 231 | **186** | 1.4-1.7x | 1.2x |
| d InstancedMesh | 203 | 229 | **134** | 1.4-1.6x | 1.7x |

Before this work jrs was not faster than three.js on a, c2 and d (0.84x-1.0x); all five scenarios now win.
Per-object cost of the world-sphere rejection (profile of scenario a): `Sphere.applyMatrix4` + `Sphere.copy` + `Ray.intersectsSphere`
took ~575 ns/object before, the scalar version ~60 ns/object here.

### BVH build time (jrs only; three.js has no BVH)

| triangles | before (mid-point split) | after (binned SAH) |
|---:|---:|---:|
| 99 904 | 59-68 ms | 72-79 ms |
| 1 001 112 | 682-772 ms | 778-816 ms |

Build time did not improve (it is within noise/slightly slower); the SAH tree has 3% fewer nodes. The build still happens once, lazily, on the first raycast of a geometry with > 64 triangles.
Position changes (`position.needsUpdate = true`) now **refit** the tree in O(nodes + triangles) instead of leaving it stale.

## What changed

* `src/core/RaycastUtils.js` (new): `rayMissesWorldSphere` replays, with scalars, exactly what three.js does
  (`sphere.copy(boundingSphere).applyMatrix4(matrixWorld)`, `radius += pad`, `ray.intersectsSphere`) reading the world matrix
  straight from the transform slab. No Sphere/Vector3 calls, no allocation, affine matrices skip the perspective divide,
  a decisive squared-distance test skips the `sqrt`; only a ray within 1e-9 of the sphere surface takes the exact comparison, so accept/reject decisions equal three.js's.
  For meshes it also prunes by `near`/`far` (hit distance lies in `[|c-o|-R, |c-o|+R]`, with a relative safety margin).
  *Design note:* I did not cache the sphere per `_worldVersion`. Recomputing from the matrix costs about the same as validating a cache and cannot go stale when someone edits `matrixWorld` directly (three.js reads the matrix as-is on every cast).
* `Mesh.raycast`: inverse world matrix cached per mesh and validated against a 16-float snapshot of the matrix (correct for any way the matrix changed, including direct edits without a version bump); local ray built with scratch objects.
* `Mesh._computeIntersections`: a scalar copy of `Ray.intersectTriangle` (same operations, same order, hence the same decision) rejects misses without touching a `Vector3`; only real hits build the intersection record via the original code. No closure per BVH query: `MeshBVH.collect()` fills a reusable `Uint32Array`.
* **Parity fixes found while testing** (the old code differed from three.js here, and the new tests fail on the old code):
  1. With the BVH, hits were pushed in tree order; three.js pushes in index order, so equal-distance ties could be ordered differently. Candidates are now sorted (insertion sort / typed-array sort) before testing.
  2. With array materials the BVH path tested triangles outside every group using `material[0]` and ignored group order/overlap; three.js skips them and visits group by group. Now identical.
  3. The BVH path skipped triangles with `i + 2 >= end` and assumed 3-aligned draw ranges; three.js uses `i < end` from `drawRange.start`. The BVH is now only used when the draw range / group starts are 3-aligned, otherwise the plain loop runs.
  4. A geometry whose `position` was edited in place (`needsUpdate = true`) kept a stale BVH and returned wrong hits. `MeshBVH.validate()` refits on a version change and rebuilds if the index / position array was replaced.
* `MeshBVH`: binned SAH build (16 bins, longest axis; child bounds come from the bins, so there is one binning pass and one partition pass per node), triangle bounds permuted with the ids for sequential access, bounds padded by 1e-6 of the root extent so rounding in the slab test can never drop an edge hit, Float64 bounds when the position array is not exactly representable in float32, `collect()`/`refit()`/`validate()`. Interleaved or normalised position attributes and morph targets fall back to the plain loop.
* `InstancedMesh.raycast`: per-instance scalar sphere rejection before the temporary mesh is touched (1.6x).
* `Raycaster`: layer mask hoisted and tested inline (identical to `Layers.test`), no per-call work beyond the result array. `params`, `layers`, `near`/`far` and stable ascending sort are unchanged.
* Tests: `test/raycast-fast.test.js` (14 cases, comparing full ordered hit lists against three.js): shuffled indexed/non-indexed layered meshes x Front/Back/Double side, Float64 positions with tiny leaves, 24 draw-range/group combinations (aligned, misaligned, gaps, overlap, out of order, range + groups), moving meshes with direct `matrixWorld` edits, refit / index replacement / position-array replacement, near/far windows over 40 meshes, InstancedMesh with a moving parent, Points + Line + LineSegments + Sprite with random transforms and thresholds, layers.

## Validation

`npm test` 114/114; `node bench/conformance.mjs` no FAIL; `node bench/addons.mjs` and `node bench/smoke.mjs` run clean; `node bench/run.mjs --compare --frames=60` pixel diffs unchanged (0.347/8, 0.346/9, 0.134/33, 0.121/31, all others 0/0); `node bench/raycast.mjs` identical on all five scenarios. `build/*.js` were rebuilt locally for the addons check but **not committed** (the integrator regenerates bundles; `bench/addons.mjs` uses the bundle, the rest use `src/`).

## Risks

* A BVH (and its cached bounds) is still keyed on version counters. An in-place edit of `position.array` **without** `needsUpdate` is invisible to the tree (three.js would see it). Same caveat as every BVH library; documented behaviour in ARCHITECTURE §8 already.
* Near/far pruning is based on `geometry.boundingSphere` containing the mesh, an assumption three.js already makes for its sphere test. A hand-edited, too-small bounding sphere is rejected by both libraries identically at the sphere test; the prune only adds the distance window with a 1e-4 relative margin.
* Tie ordering: for exactly equal distances jrs now matches three.js's order only as far as float32-vs-double arithmetic allows (the tests compare clusters of near-equal distances as sets).
* The padded BVH bounds make traversal visit slightly more nodes (1e-6 of the root extent), negligible.

## Follow-up ideas

* Per-object cost is now dominated by pointer chasing to reach the object's fields (layers, geometry, slab page: ~6 cache lines per object). A scene-level SoA broadphase (flat `Float64Array` of world spheres + layer masks, rebuilt when a global world-matrix epoch changes) would cut scenario a by another ~5-10x, but needs invalidation hooks in `Object3D.add/remove`, `layers`, geometry swaps and `_worldVersion` bumps, which touch files other workers are editing, so I left it.
* Cap `maxT` of the BVH traversal using `raycaster.far` converted to local space (needs a conservative singular-value bound of the world matrix).
* Early-out first-hit mode (`intersectObject` with a `firstHitOnly` flag as in three-mesh-bvh) using ordered traversal.
* Faster BVH build for > 1M triangles: parallelise the top levels (workers), or build from sorted Morton codes.
* Skinning / morph-target raycasting once jrs implements skinning (currently morph targets use the plain per-vertex path, as in three.js).
