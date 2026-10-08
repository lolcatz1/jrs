# Swarm: sorting and render-list build (branch `swarm/transparent-sort`)

## What changed
* `src/renderers/webgl/WebGLRenderLists.js`
  * Keys are now 32-bit (`Uint32Array`) instead of 52-bit Float64. The 20-bit item index in the low bits only served as a tie-break; ties are now broken by insertion position, which gives the identical order.
  * Ordering: (1) if the previous frame had the same item count, its order is verified/repaired with an insertion-sort pass under a shift budget of n/16, so an unchanged frame costs one linear pass; (2) otherwise a stable LSD radix sort (11+11+10 bit digits, constant digits skipped) with module-level reusable scratch buffers. Input is in ascending item order, so stability reproduces the old index tie-break exactly.
  * `opaqueSorted` / `transparentSorted` are now `Uint32Array` views of item indices (cached while the count is unchanged); `itemFromKey` returns `items[key]`. The renderer and shadow map needed no change.
* Fixed a crash: with Float32 depths the transparent depth key can go slightly negative (depth overshoots the min/max range), and the old code then did `items[negative]` and threw during an orbiting-camera frame. Keys are now clamped into 0..2^32-1.
* Bench: new `transparent-sort` scenario (10k transparent boxes, camera orbits 0.01 rad/frame) in the timing and pixel comparison; `bench/sortcost.mjs` + `window.sortCost` measure time inside `finish()`.
* `test/renderlists.test.js`: compares the order with a reference implementation of the old key across sizes, ties, render orders, unchanged / slowly moving / scrambled / resized frames.

## Time in `WebGLRenderList.finish` (key build + sort), microseconds per frame, best of 3
| scenario | before | after |
|---|---|---|
| shared-static (10k opaque) | 197 | 133 |
| many-materials (5k) | 488 | 89 |
| transparent-sort (10k, orbit) | 1058* | 481 |

*The original code crashes on this scenario; the "before" number is the original with a one-line `Math.max(0, ...)` clamp added.
Timing uses `performance.now()` (coarse in Chromium), averaged over 150 frames.

## Frame medians (ms, jrs, same machine, headless SwiftShader)
Absolute numbers on this machine are ~2x the stored `latest.json` (different host), so the comparison is original code vs this branch run on the same machine (original x2, branch x3, best of each):
shared-static 8.4 -> 7.9, shared-animated 12.9 -> 12.4, many-materials 11.3 -> 8.1, unique-geometries 2.2 -> 1.7, transparent-sort 14.2 -> 12.1, hierarchy-animated 9.6 -> 8.5, shader-client 6.4 -> 6.3, shadows 2.3 -> 2.2, instanced-100k 0 -> 0. shader-client-static looked +20% in one pass, but is dominated by run-to-run noise (original 43.7-66.8, branch 46.6-70 over repeated runs). Sorting is a small share of total frame time (GL submission dominates), so frame-level gains are modest.

## Pixel comparison
meanAbsDiff/maxDiff are identical to `latest.json` in every scenario (shared-static 0.347/8, shared-animated 0.346/9, shadows 0.134/33, others 0/0); new transparent-sort is 0/0 against three.js.
`latest.json` here is the original file plus the new transparent-sort row (timings from the slower host were not overwritten).

## Findings / decisions
* Skip-if-unchanged is subsumed by the order-verification pass (it also handles "keys changed but order did not").
* On an orbiting 10k grid the repair pass never succeeds: the number of inversions per frame is large because the 26-bit key is renormalised to the per-frame depth range, and many neighbours swap. Larger budgets (2n, 8n, 32n) were slower (676-1000 us) than going straight to radix (~415-590 us), so the budget is small (n/16) to bound wasted work. Insertion sort therefore does not beat radix for the moving-camera case; it only pays off for static or nearly static frames.
* Most of the remaining ~480 us in transparent-sort is the key-building loop (item lookup, `Math.round`), not the sort.

## Risks
* Keys clamped to 32 bits: differs from the old code only for rank-63 items whose depth overshoots, and for rank-0 negative keys (old code crashed there).
* `opaqueSorted`/`transparentSorted` changed type (key -> item index). Anything outside the repo that read the 52-bit key would break (nothing in-tree does).
* Module-level radix scratch is shared; safe because sorting is synchronous, not safe if `finish` were ever called re-entrantly.

## Follow-ups
* Cache the transparent depth key between frames when the camera and object matrices did not move (skip the key loop entirely).
* Compute depth keys from a flat Float32 array of view-space z written during `_projectObject` to avoid the per-item `items[...]` lookup in `finish`.
* Use a fixed (not per-frame normalised) depth quantisation so keys stay stable between frames and the repair pass can succeed for slowly moving cameras.
