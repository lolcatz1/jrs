/**
 * Render list with packed numeric sort keys.
 *
 * three.js sorts an array of item objects with a JS comparator. Here every
 * item gets a 32-bit sort key (the high part of the old 52-bit key); ties are
 * broken by insertion order, which is exactly what the 20-bit item index in the
 * low bits used to do. The list is ordered without a comparator and without
 * per-frame allocation once the arrays have grown to size:
 *
 *   1. If the previous frame's order still has the same item count, it is
 *      verified with an insertion-sort pass under a small shift budget (n/16). A frame
 *      where nothing (or almost nothing) moved costs one linear pass. Measured on an
 *      orbiting 10k grid the budget is always exhausted, so the cost stays bounded.
 *   2. Otherwise (or when the budget runs out) a stable LSD radix sort on the
 *      32-bit key (11+11+10 bit digits; digits that are constant across the list
 *      are skipped). The input is in ascending item order, so stability gives the
 *      same order as the index tie-break.
 *
 * Opaque key:      [renderOrder rank:6][program:6][material:10][indexed:1][geometry:9]
 * Transparent key: [renderOrder rank:6][depth back-to-front:26]
 *
 * The "material" field is a per-frame dense id of the item's material *batch group*: built-in
 * materials whose draws can share one batch (same GL state, same textures, records in one
 * window of the material buffer) share a group, so geometry runs span materials; every other
 * material is its own group.
 */
import { RenderListCache } from './WebGLRenderListCache.js';

const INDEX_BITS = 20;
const INDEX_RANGE = 1 << INDEX_BITS; // 1,048,576 items per list
const MAX_LISTS_PER_SLOT = 8; // cameras remembered per (scene, call depth)
const MAX_KEY = 4294967295;

// Scratch shared by every list (sorting is synchronous, so one set is enough).
let scratchCap = 0;
let keyA = new Uint32Array(0), posA = new Uint32Array(0), keyB = new Uint32Array(0), posB = new Uint32Array(0), iota = new Uint32Array(0);
const hist = new Uint32Array(3 * 2048);

function ensureScratch(n) {
	if (n <= scratchCap) return;
	let cap = Math.max(1024, scratchCap);
	while (cap < n) cap *= 2;
	keyA = new Uint32Array(cap); posA = new Uint32Array(cap); keyB = new Uint32Array(cap); posB = new Uint32Array(cap);
	iota = new Uint32Array(cap);
	for (let i = 0; i < cap; i++) iota[i] = i;
	scratchCap = cap;
}

/** One sortable half of a list (opaque or transparent). Positions are indices into `ids` / `hi`. */
class SortSlot {
	constructor(capacity) {
		this.n = 0;
		this.ids = new Uint32Array(capacity);    // item index per position, insertion order
		this.hi = new Uint32Array(capacity);     // 32-bit sort key per position
		this.order = new Uint32Array(capacity);  // positions in sorted order; carried across frames
		this.orderN = 0;                         // number of valid entries in `order` (0 = none)
		this.sorted = new Uint32Array(capacity); // item indices in sorted order (what the renderer reads)
		this.view = null;
	}
	grow() {
		const cap = this.ids.length * 2;
		const ids = new Uint32Array(cap); ids.set(this.ids); this.ids = ids;
		const hi = new Uint32Array(cap); hi.set(this.hi); this.hi = hi;
		const order = new Uint32Array(cap); order.set(this.order); this.order = order;
		this.sorted = new Uint32Array(cap);
		this.view = null;
	}
	/** Order positions by (hi, position) and publish the item indices; returns the sorted view. */
	finish(sortObjects) {
		const n = this.n, ids = this.ids, sorted = this.sorted;
		if (sortObjects && n > 1) {
			if (this.orderN !== n || !repairOrder(this.order, this.hi, n, n >> 4)) {
				radixOrder(this.order, this.hi, n);
				this.orderN = n;
			}
			const order = this.order;
			for (let i = 0; i < n; i++) sorted[i] = ids[order[i]];
		} else {
			for (let i = 0; i < n; i++) sorted[i] = ids[i];
			this.orderN = 0;
		}
		if (this.view === null || this.view.length !== n) this.view = sorted.subarray(0, n);
		return this.view;
	}
}

/**
 * Insertion sort of an existing permutation, giving up after `budget` shifts.
 * Returns true when `order` is now sorted by (hi, position). On false `order` is still a
 * valid permutation but not necessarily sorted.
 */
function repairOrder(order, hi, n, budget) {
	let prev = order[0], hp = hi[prev];
	for (let i = 1; i < n; i++) {
		const v = order[i], hv = hi[v];
		if (hv > hp || (hv === hp && v > prev)) { prev = v; hp = hv; continue; }
		let j = i - 1;
		while (j >= 0) {
			const u = order[j], hu = hi[u];
			if (hu > hv || (hu === hv && u > v)) {
				if (--budget < 0) { order[j + 1] = v; return false; }
				order[j + 1] = u; j--;
			} else break;
		}
		order[j + 1] = v;
		prev = order[i]; hp = hi[prev];
	}
	return true;
}

/** Stable LSD radix sort of positions 0..n-1 by hi[position] into `order`. */
function radixOrder(order, hi, n) {
	if (n <= 24) { // tiny lists: plain insertion sort from the identity
		for (let i = 0; i < n; i++) order[i] = i;
		repairOrder(order, hi, n, Infinity);
		return;
	}
	ensureScratch(n);
	hist.fill(0);
	for (let i = 0; i < n; i++) {
		const k = hi[i];
		hist[k & 2047]++; hist[2048 + ((k >>> 11) & 2047)]++; hist[4096 + (k >>> 22)]++;
	}
	const first = hi[0];
	let srcK = hi, srcP = iota, dstK = keyA, dstP = posA, passes = 0;
	for (let pass = 0; pass < 3; pass++) {
		const off = pass * 2048, shift = pass * 11;
		if (hist[off + ((first >>> shift) & 2047)] === n) continue; // every key shares this digit
		let sum = 0;
		for (let b = 0; b < 2048; b++) { const c = hist[off + b]; hist[off + b] = sum; sum += c; }
		for (let i = 0; i < n; i++) {
			const k = srcK[i];
			const d = off + ((k >>> shift) & 2047);
			const at = hist[d]++;
			dstK[at] = k; dstP[at] = srcP[i];
		}
		passes++;
		srcK = dstK; srcP = dstP;
		if (dstK === keyA) { dstK = keyB; dstP = posB; } else { dstK = keyA; dstP = posA; }
	}
	if (passes === 0) { for (let i = 0; i < n; i++) order[i] = i; return; }
	for (let i = 0; i < n; i++) order[i] = srcP[i];
}

class WebGLRenderList {
	constructor() {
		this.items = [];          // pooled item objects, index = insertion order
		this.count = 0;
		this.flags = new Uint8Array(1024); // per item index: batching eligibility bits (BATCHABLE / MULTIDRAWABLE), computed once in WebGLRenderer._pushItem
		this.opaque = new SortSlot(1024);
		this.transparent = new SortSlot(256);
		this.opaqueCount = 0;
		this.transparentCount = 0;
		this.transparentDepth = new Float32Array(256);
		this.opaqueSorted = null;      // Uint32Array of item indices after finish()
		this.transparentSorted = null;
		this.minDepth = Infinity; this.maxDepth = -Infinity;
		this.opaqueVersion = 0; this.transparentVersion = 0; // bumped whenever the sorted keys are rebuilt (draw-command caches compare them)
		this.camera = null;        // set by WebGLRenderLists.get: one list per (scene, call depth, camera)
		this.cache = new RenderListCache();
		this.texSlotOpaque = null; this.texSlotTransparent = null; // this list's own matrix textures (WebGLBatcher slots), created on first batch
		// view-space depth of the item about to be pushed. Passed through a typed array instead of an
		// argument: a double crossing a non-inlined call boundary is boxed into a HeapNumber per call.
		this.zScratch = new Float64Array(1);
	}
	init() {
		this.count = 0; this.opaqueCount = 0; this.transparentCount = 0;
		this.opaque.n = 0; this.transparent.n = 0;
		this.minDepth = Infinity; this.maxDepth = -Infinity;
	}
	_getItem(object, geometry, material, group, variant) {
		let item = this.items[this.count];
		if (item === undefined) {
			item = { id: object.id, object, geometry, material, program: null, group, renderOrder: object.renderOrder, materialRid: 0, geometryRid: 0, variant, mdRecord: null, batchGroup: null };
			this.items[this.count] = item;
		} else {
			item.id = object.id; item.object = object; item.geometry = geometry; item.material = material; item.program = null;
			item.group = group; item.renderOrder = object.renderOrder; item.variant = variant;
		}
		this.count++;
		return item;
	}
	/**
	 * Adds an item. `item.program` is resolved later by the renderer (once the frame's lights are known).
	 */
	push(object, geometry, material, group, materialRid, geometryRid, variant, batchGroup, flags = 0) {
		if (this.count >= INDEX_RANGE) return; // list full; ignore extra items rather than corrupt keys
		const item = this._getItem(object, geometry, material, group, variant);
		item.materialRid = materialRid; item.geometryRid = geometryRid; item.batchGroup = batchGroup;
		const index = this.count - 1;
		if (index >= this.flags.length) { const nf = new Uint8Array(this.flags.length * 2); nf.set(this.flags); this.flags = nf; }
		this.flags[index] = flags;
		if (material.transparent === true) {
			const slot = this.transparent;
			if (slot.n === slot.ids.length) {
				slot.grow();
				const nd = new Float32Array(this.transparentDepth.length * 2); nd.set(this.transparentDepth); this.transparentDepth = nd;
			}
			const z = this.zScratch[0];
			this.transparentDepth[slot.n] = z; // depth key resolved in finish()
			const zf = this.transparentDepth[slot.n]; // the float32-rounded value: min/max must bound what finish() reads back
			slot.ids[slot.n++] = index;
			if (zf < this.minDepth) this.minDepth = zf;
			if (zf > this.maxDepth) this.maxDepth = zf;
			this.transparentCount++;
		} else {
			const slot = this.opaque;
			if (slot.n === slot.ids.length) slot.grow();
			slot.ids[slot.n++] = index;
			this.opaqueCount++;
		}
	}
	/**
	 * Build keys and sort. `rankOf(renderOrder)` maps a renderOrder value to 0..63.
	 */
	finish(sortObjects, rankOf) {
		const singleRank = rankOf(this.count > 0 ? this.items[0].renderOrder : 0) === 0 && rankOf(Infinity) === 0; // ranker reports a single render order
		this._finishOpaque(sortObjects, rankOf, singleRank);
		this._finishTransparent(sortObjects, rankOf, singleRank);
	}
	_finishOpaque(sortObjects, rankOf, singleRank) {
		const items = this.items;
		const os = this.opaque, oids = os.ids, ohi = os.hi, on = os.n;
		for (let i = 0; i < on; i++) {
			const item = items[oids[i]];
			const rank = singleRank ? 0 : rankOf(item.renderOrder);
			const program = item.program._frameRid & 63;
			const mat = item.materialRid & 1023;
			const geo = item.geometryRid & 511;
			const indexed = item.geometry.index !== null ? 1 : 0; // keeps geometries of one mega-buffer layout adjacent
			ohi[i] = (((rank * 64 + program) * 1024 + mat) * 2 + indexed) * 512 + geo;
		}
		this.opaqueSorted = os.finish(sortObjects);
		this.opaqueVersion++;
	}
	_finishTransparent(sortObjects, rankOf, singleRank) {
		const items = this.items;
		const ts = this.transparent, tids = ts.ids, thi = ts.hi, tn = ts.n, td = this.transparentDepth;
		const range = this.maxDepth - this.minDepth;
		const scale = range > 0 ? 67108863 / range : 0; // 26 bits
		for (let i = 0; i < tn; i++) {
			const item = items[tids[i]];
			const rank = singleRank ? 0 : rankOf(item.renderOrder);
			// larger z (farther) first -> smaller key
			const depthKey = Math.round((this.maxDepth - td[i]) * scale);
			const key = rank * 67108864 + depthKey;
			// float32 depth can overshoot the [min, max] range by a hair; keep the key inside 32 bits
			thi[i] = key < 0 ? 0 : key > MAX_KEY ? MAX_KEY : key;
		}
		this.transparentSorted = ts.finish(sortObjects);
		this.transparentVersion++;
	}
	/**
	 * Camera moved but the item set did not: recompute the transparent depth keys from fresh depths (`itemZ[item index]`)
	 * and re-order (the previous order is repaired in place). Identical to what a full rebuild produces.
	 */
	resortTransparent(sortObjects, rankOf, itemZ) {
		const ts = this.transparent, tids = ts.ids, tn = ts.n, td = this.transparentDepth;
		let min = Infinity, max = -Infinity;
		for (let i = 0; i < tn; i++) {
			const z = itemZ[tids[i]];
			td[i] = z;
			if (z < min) min = z;
			if (z > max) max = z;
		}
		this.minDepth = min; this.maxDepth = max;
		const singleRank = rankOf(this.count > 0 ? this.items[0].renderOrder : 0) === 0 && rankOf(Infinity) === 0;
		this._finishTransparent(sortObjects, rankOf, singleRank);
	}
	/** Item for a sorted entry (an item index). */
	itemFromKey(key) { return this.items[key]; }
}

class WebGLRenderLists {
	constructor() { this.lists = new WeakMap(); }
	/** One list per (scene, render call depth, camera) so alternating cameras each keep their own cached list. */
	get(scene, renderCallDepth, camera = null) {
		let byDepth = this.lists.get(scene);
		if (byDepth === undefined) { byDepth = []; this.lists.set(scene, byDepth); }
		let slot = byDepth[renderCallDepth];
		if (slot === undefined) { slot = []; byDepth[renderCallDepth] = slot; }
		for (let i = 0; i < slot.length; i++) if (slot[i].camera === camera) return slot[i];
		const list = new WebGLRenderList();
		list.camera = camera;
		if (slot.length >= MAX_LISTS_PER_SLOT) slot.shift(); // least recently created camera loses its list
		slot.push(list);
		return list;
	}
	dispose() { this.lists = new WeakMap(); }
}

export { WebGLRenderLists, WebGLRenderList, INDEX_RANGE };
