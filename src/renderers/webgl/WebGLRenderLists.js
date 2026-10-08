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
 * Opaque key:      [renderOrder rank:6][program:6][material:10][indexed:1][geometry:9]  (lines / points / sprites: [layout class:4][geometry:6])
 * Transparent key: [renderOrder rank:6][depth back-to-front:26]
 */
const INDEX_BITS = 20;
const INDEX_RANGE = 1 << INDEX_BITS; // 1,048,576 items per list
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
		this.opaque = new SortSlot(1024);
		this.transparent = new SortSlot(256);
		this.opaqueCount = 0;
		this.transparentCount = 0;
		this.transparentDepth = new Float32Array(256);
		this.opaqueSorted = null;      // Uint32Array of item indices after finish()
		this.transparentSorted = null;
		this.minDepth = Infinity; this.maxDepth = -Infinity;
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
			item = { id: object.id, object, geometry, material, program: null, group, renderOrder: object.renderOrder, materialRid: 0, geometryRid: 0, variant, mdRecord: null, layoutClass: -1 };
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
	push(object, geometry, material, group, materialRid, geometryRid, variant, layoutClass = -1) {
		if (this.count >= INDEX_RANGE) return; // list full; ignore extra items rather than corrupt keys
		const item = this._getItem(object, geometry, material, group, variant);
		item.materialRid = materialRid; item.geometryRid = geometryRid; item.layoutClass = layoutClass;
		const index = this.count - 1;
		if (material.transparent === true) {
			const slot = this.transparent;
			if (slot.n === slot.ids.length) {
				slot.grow();
				const nd = new Float32Array(this.transparentDepth.length * 2); nd.set(this.transparentDepth); this.transparentDepth = nd;
			}
			const z = this.zScratch[0];
			this.transparentDepth[slot.n] = z; // depth key resolved in finish()
			slot.ids[slot.n++] = index;
			if (z < this.minDepth) this.minDepth = z;
			if (z > this.maxDepth) this.maxDepth = z;
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
		const items = this.items;
		const singleRank = rankOf(this.count > 0 ? items[0].renderOrder : 0) === 0 && rankOf(Infinity) === 0; // ranker reports a single render order
		// opaque
		const os = this.opaque, oids = os.ids, ohi = os.hi, on = os.n;
		for (let i = 0; i < on; i++) {
			const item = items[oids[i]];
			const rank = singleRank ? 0 : rankOf(item.renderOrder);
			const program = item.program._frameRid & 63;
			const mat = item.materialRid & 1023;
			// low 10 bits keep geometries of one mega-buffer layout adjacent: meshes by indexed + geometry, lines / points / sprites by attribute layout class + geometry
			const low = item.layoutClass < 0 ? (item.geometry.index !== null ? 512 : 0) + (item.geometryRid & 511) : item.layoutClass * 64 + (item.geometryRid & 63);
			ohi[i] = ((rank * 64 + program) * 1024 + mat) * 1024 + low;
		}
		this.opaqueSorted = os.finish(sortObjects);
		// transparent: back to front
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
	}
	/** Item for a sorted entry (an item index). */
	itemFromKey(key) { return this.items[key]; }
}

class WebGLRenderLists {
	constructor() { this.lists = new WeakMap(); }
	get(scene, renderCallDepth) {
		const listArray = this.lists.get(scene);
		let list;
		if (listArray === undefined) {
			list = new WebGLRenderList();
			this.lists.set(scene, [list]);
		} else {
			if (renderCallDepth >= listArray.length) { list = new WebGLRenderList(); listArray.push(list); }
			else list = listArray[renderCallDepth];
		}
		return list;
	}
	dispose() { this.lists = new WeakMap(); }
}

export { WebGLRenderLists, WebGLRenderList, INDEX_RANGE };
