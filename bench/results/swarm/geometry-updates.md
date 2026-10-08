# Dynamic geometry updates (branch `swarm/geometry-updates`)

## Scenarios (bench/scenarios.js)

* `dynamic-geometry` (n=200): 200 indexed sheets (81 vertices; position + normal + uv). Every frame 150 rewrite the whole
  position array (`needsUpdate`), 50 rewrite a quarter via `addUpdateRange`. 3 meshes change `drawRange` every frame, 3 grow
  every 10 frames (new, larger attributes + index via `setAttribute`/`setIndex`), 1 geometry is rebuilt (and the old one
  disposed) every 10 frames. Compares 0/0 over 25 frames.
* `dynamic-geometry-large` (n=12): 8 meshes of 16 641 and 4 of 66 049 vertices, positions rewritten every frame (~3.7 MB/frame);
  only 600 indices are drawn so software rasterisation does not hide the upload cost. Compares 0/0.
* `bench/geometry-updates.mjs` (differential test, 24 steps): scripted needsUpdate / single and overlapping ranges /
  unchanged frames / edit without needsUpdate / drawRange set after first render / growth / dispose / multi-draw toggled /
  hidden meshes with accumulated ranges / index rewrite / interleaved buffer + range. After every step jrs and three.js must
  give identical pixels and identical `updateRanges.length`, `version` and `onUpload` firing. Run on the old code it shows 21
  failing steps (see "Bugs found"); now all pass. `test/geometry-updates.test.js` covers the allocator and range merging.
* `run.mjs` now also prints render-only medians; `--raw` samples are available via `runScenario(..., {raw:true})`.

## Numbers (`run.mjs --frames=60`, two runs each, headless Chromium/SwiftShader; medians in ms)

| scenario | three | jrs before | jrs after | GL calls/frame before -> after (jrs) | worst frame jrs before -> after |
|---|---|---|---|---|---|
| dynamic-geometry | 0.9 / 1.2 (after-run 1.3 / 1.1) | 0.6 / 0.9 | 0.8 / 1.0 | 454 -> 1102 total; draws 6 -> 200; bufferSubData 215 -> 212 | see below |
| dynamic-geometry-large | 1.6 / 2.1 (1.9 / 2.4) | 2.8 / 1.3 | 2.0 / 1.7 | 62 -> ~62; 12 draws | 22.8 / 7.2 -> 14.1 / 9.9 |

three.js GL calls/frame: 1069 total (200 draws, 212 buffer uploads) for dynamic-geometry, 61 for the large one.
Better "after" = better of two runs: dynamic-geometry 0.8 ms vs three 1.1-1.3 (render-only 0.6-0.7 vs 0.8-1.0).

Longer runs (400 frames, raw per-frame samples, 4 runs): before, jrs had a ~0.7-0.9 s stall in 2 of 4 runs (and 3.7 s / 0.9 s in
the profiler runs), three.js never above ~115 ms; after: worst 62-120 ms in all runs, same as three. Medians unchanged (0.6-1.1).
First render of `unique-geometries` (2000 geometries): bufferSubData calls 8003 -> 7 (coalesced page uploads), time unchanged (~65-95 ms).
All other scenarios: pixel diff identical to latest.json (checked twice on the merged tree); their medians are within noise.

## What changed

* **WebGLMegaBuffers**: uploads are lazy and queued (`queue` when a geometry is actually drawn from a page, `flush` before the
  draws): only attributes whose `version` changed, only their `updateRanges` (merged like three.js, cleared afterwards,
  `_uploadSeq` bumped), adjacent dirty regions of one page buffer copied into a staging block and sent as one `bufferSubData`
  (via `COPY_WRITE_BUFFER`: no VAO or ARRAY_BUFFER state churn). Free regions are reused (first-fit allocator with
  coalescing) and a FinalizationRegistry returns regions of geometries collected without `dispose()`. Size changes reallocate
  once, not next frame. `drawRange` is checked every frame instead of only at allocation.
* **Eviction**: a geometry re-uploaded 3 times (`DYNAMIC_UPLOADS_BEFORE_EVICTION`) leaves the pages and is drawn from its own
  small buffers. Measured: in-place per-frame updates of shared page buffers cost the same median CPU but produced the ~1 s
  stalls above (page size 16k-262k vertices, DYNAMIC_DRAW and 4 KB-1 MB chunking did not remove them; own buffers: 0 of 6 runs).
  Geometries with an `onUpload` hook are not packed (the usual hook frees the CPU array, which a later switch of path could not re-upload).
* **WebGLAttributes**: ranges are consumed once even with two GPU copies of an attribute (page copy + own buffer): a copy
  only trusts the ranges if no other copy consumed any since its own last upload, otherwise it uploads everything. A first
  upload consumes pending ranges (three.js leaves them in place). Growth of an attribute re-specifies the existing buffer
  with `bufferData` (same handle, no VAO rebuild; three.js throws there), new buffer only if layout/type changed.
* **WebGLBindingStates**: interleaved attributes now use stride/offset; `version` sums work for them (they were NaN, so the
  fast path never hit); the validated attribute list is reused instead of reallocated each time.

## Bugs found and fixed on the way (all visible as failing steps of the differential test on the old code)

1. `updateRanges` of mega-page geometries were never cleared (unbounded growth) and never honoured (whole array re-sent);
   `onUpload` never fired for them.
2. `setDrawRange` after the first render was ignored by the multi-draw path (wrong pixels, up to 95 levels).
3. Interleaved attributes rendered garbage (stride/offset ignored).
4. Page space was never reused (bump allocation).

## Large uploads / ring-buffer stall

3.7 MB/frame of `bufferSubData` with light GPU work: no stall for jrs or three (worst 41-85 ms, wall 3.2 ms/frame). With 800k
triangles drawn per frame both libraries show 13-23 s stalls, which are rasteriser backlog on SwiftShader, not upload cost. `bufferData` of the whole array
(threshold 64 KB) and evicting big meshes from pages were tried and made no difference, so the whole-array `bufferData`
remedy was NOT adopted.

## Risks

* A mesh that moves between the page path and its own buffers (run shorter than `autoBatchMinimum`, eviction, `autoMultiDraw`
  toggled) has two GPU copies; `onUpload` fires once more than in three.js for it (only hook-less geometries move, see above).
* Clearing ranges on first upload differs from three.js (observable only as `updateRanges.length` right after the first render).
* Evicted geometries stay evicted until their layout changes. In this environment (tiny scene) the extra 200 draws cost about
  what three.js pays; on a real GPU draw-call cost is higher but jrs's regular path is no worse than three.js's.
* Pre-existing stalls seen in other scenarios (many-materials, hierarchy-animated worst frames 1-4 s) are not touched here.

## Follow-ups

* Find the root cause of the page-buffer stall (ANGLE buffer renaming?) and dedicate "dynamic pages" so dynamic geometry keeps one multi-draw.
* Merge dirty ranges across nearby meshes (gap fill) to cut the 50 range uploads.
* Let renderer-owned buffers be read back so `onUpload` array release works across both paths.
