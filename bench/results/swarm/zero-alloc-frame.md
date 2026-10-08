# Zero-allocation steady-state frame

## Measurement method

`node bench/alloc.mjs [scenario ...] [--frames=100] [--lib=jrs|three] [--jrs-sites] [--callers] [--json=path]`

For every scenario and library a fresh page, renderer and scene are created, built and warmed up (20 frames).
Then, over 100 measured frames:

* **Bytes/frame**: the CDP sampling heap profiler (`HeapProfiler.startSampling`, 512 B interval,
  `includeObjectsCollectedByMajorGC/MinorGC` on, so objects that die young are counted). The sum of all node
  `selfSize`s divided by frames. It is a statistical estimate (about +-1 KB at this interval); `--jrs-sites`
  / `--callers` print the top allocation sites with their callers.
* **GC count / pause**: Chromium tracing category `v8.gc` recorded around the same frames; scavenges ("minor")
  and mark-compacts ("major") are counted per 100 frames. The constant "major 2" in every row comes from the
  explicit `HeapProfiler.collectGarbage` and tracing start, not from the frames. Pause ms is the summed event duration.
* Tracing and the profiler slow frames down, so use the medians/worst frames of `bench/run.mjs` for timing, not this tool.

## Results: bytes allocated per frame, minor GCs per 100 frames

Before = this branch's parent commit, after = this branch. Three.js is unchanged (same code, measured in both runs; the after-run
numbers are shown). GC pause column: three / jrs before / jrs after, ms per 100 frames.

| Scenario | three B/frame | jrs before | jrs after | three minor GC | jrs before | jrs after | GC pause ms/100f (three / before / after) |
|---|---:|---:|---:|---:|---:|---:|---|
| shared-static | 326,483 | 1,306,133 | 4,832 | 66 | 124 | 0 | 56.45 / 110.81 / 38.21 |
| shared-animated | 328,599 | 586,194 | 5,375 | 66 | 102 | 0 | 53.6 / 79.62 / 31.03 |
| many-materials | 256,451 | 663,721 | 3,892 | 50 | 126 | 0 | 54.01 / 89.43 / 28.87 |
| unique-geometries | 60,492 | 271,424 | 5,106 | 6 | 26 | 0 | 40 / 36.11 / 23.92 |
| hierarchy-animated | 1,177,633 | 1,103,618 | 32,145 | 116 | 182 | 4 | 102.97 / 137.21 / 41.73 |
| instanced-100k | 22,093 | 9,888 | 9,261 | 4 | 2 | 2 | 10.92 / 8.83 / 10.31 |
| shader-client | 114,150 | 20,585 | 4,898 | 16 | 4 | 0 | 45.28 / 21.65 / 19.88 |
| shader-client-static | 72,828 | 111,869 | 9,367 | 12 | 20 | 0 | 30.49 / 27.58 / 17.8 |
| shadows | 211,016 | 275,749 | 9,280 | 40 | 52 | 2 | 35.19 / 34.82 / 16.57 |

Every jrs scenario is now below three.js. Static and animated scenes allocate 4-10 KB/frame (profiler noise floor plus a few
boxed doubles in light/frustum setup), versus 1.3 MB/frame before in `shared-static`. `hierarchy-animated` shows 7-32 KB between
runs; part of it is the benchmark's own `update()` closure.

## Timing (`node bench/run.mjs`, medians, alternating A/B runs of base and branch on the same machine)

The machine is noisy (three.js medians move 20-40% between runs), so base and branch were run back to back, twice or three times.
Best jrs median per scenario, base -> branch (ms): shared-static 5.1 -> 4.4, shared-animated 11.0 -> 7.6, many-materials 5.6 -> 4.7,
unique-geometries 1.8 -> 1.1, hierarchy-animated 5.1 -> 5.0 (equal within noise on repeated runs), shader-client 4.2 -> 3.6
(repeat runs 4.2-4.3 base vs 3.6-4.2 branch), shader-client-static 32.4 -> 28.5, shadows 2.6 -> 1.4. Worst frames: jrs worst in the
static scenarios 8-11 ms before and after; unique-geometries 7-9 -> 2.6; shadows 6 -> 2-3 ms. The occasional one-to-several-second
worst frames (many-materials 1.6 s in one run, shader-client 150-570 ms in some runs) occur in both base and branch and in three.js
with the profiler/tracing on; they look like SwiftShader/driver stalls and were not reproduced consistently.
`--compare`: meanAbsDiff/maxDiff identical to `bench/results/latest.json` in every scenario (shared-static 0.347/8, shared-animated
0.346/9, shadows 0.134/33, everything else 0/0). `npm test` 100/100, `bench/conformance.mjs`, `bench/addons.mjs`, `bench/smoke.mjs` all pass
(smoke logs one 404 in the browser console; it is also present on the base commit).

## What allocated, and what changed

The CDP profile showed the real sources, which were not the ones in the brief (no closures or string keys in the main loop):

1. **`Object3D.updateMatrix` (1.2 MB/frame, 93% of the static-scene total).** The ten TRS snapshot values were double fields on
   the object. `updateMatrix` is called on Scenes, lights, cameras and Meshes, so the receiver is megamorphic and each
   double-field load boxed a HeapNumber (10 loads x 12 B x 10 000 objects). The snapshot now lives in a `Float64Array` page next to the
   transform slab (`TransformSlab` page `.snapshot`, `Object3D._snapData/_snapOffset`). Typed-array loads do not box, and the
   comparison semantics are identical (NaN in slot 0 still forces the first compose). This also made the static frame ~2x faster.
2. **View-space depth `z` passed through `_pushItem` -> `RenderList.push` (~100 KB/frame at 10 000 objects).** A double crossing a non-inlined call
   is boxed. It now travels through `list.zScratch` (Float64Array(1)); `_pushItem`/`push` lost their `z` parameter and the unused `item.z` field is gone.
3. **`_updateEnv` built a string key (`toneMapping|colorSpace|shadows|fog`) on every `render()`**, and the environment version changed
   whenever a render target and the screen alternated, so every ShaderMaterial re-ran `getParameters` and rebuilt `customProgramKey`
   (a concatenation of both shader sources) plus a `Map.get` by that string, every pass (~100 KB/frame, plus the CPU for hashing).
   The key is now a packed integer, the env version is `lightsEpoch * 65536 + interned id` (revisiting a state revisits its version),
   and each program-cache entry keeps a second (alternate) program slot so render-target <-> screen alternation hits the cache. The
   alternate is released with the entry. `shader-client-static`: 105 KB -> 9 KB/frame.
4. **`_noteRenderOrder` re-sorted a list with an arrow comparator and rebuilt a `Map` each frame** when a render order was seen. It
   is now a sorted array with hand insertion and binary-search rank lookup (`_rankOf`), no Map, no closure.
5. **`RenderList.finish` made two `subarray` views per frame.** The views are reused while the count and buffer are unchanged.

## Follow-up ideas

* Residual 3-5 KB/frame in every scene: `Frustum.setFromProjectionMatrix` default parameters / boxed locals, `_syncMaterialBlock` and
  `_uploadFrameBlock` (double-valued locals passed across calls), `WebGLLights.fill/push` (`Color`/`Vector3` field math on `ambient`).
  Staging those through scratch typed arrays would remove the last few hundred bytes per call site.
* The same megamorphic double-field pattern is likely elsewhere for classes with many subclass shapes (`Light`, `Material` numeric
  fields read in `_syncMaterialBlock`); a per-material `Float64Array` mirror would fix it.
* `alloc.mjs` could assert a budget (e.g. < 16 KB/frame for jrs) and run in CI.
* In `shader-client-static` the remaining 28 ms is dominated by SwiftShader raster, not CPU.
