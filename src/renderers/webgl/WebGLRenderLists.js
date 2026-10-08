/**
 * Render list with packed numeric sort keys.
 *
 * three.js sorts an array of item objects with a JS comparator. Here every
 * item gets a 52-bit integer key stored in a Float64Array; the list is sorted
 * with the native comparator-less TypedArray sort and the item index is
 * recovered from the key's low 20 bits. No closures, no comparator calls,
 * no per-frame allocation once the arrays have grown to size.
 *
 * Opaque key:      [renderOrder rank:6][program:6][material:10][indexed:1][geometry:9][index:20]
 * Transparent key: [renderOrder rank:6][depth back-to-front:26][index:20]
 */
const INDEX_BITS = 20;
const INDEX_RANGE = 1 << INDEX_BITS; // 1,048,576 items per list

class WebGLRenderList {
	constructor() {
		this.items = [];          // pooled item objects, index = insertion order
		this.count = 0;
		this.opaqueKeys = new Float64Array(1024);
		this.transparentKeys = new Float64Array(256);
		this.opaqueCount = 0;
		this.transparentCount = 0;
		this.transparentDepth = new Float32Array(256);
		this.opaqueSorted = null;      // Float64Array view after sort
		this.transparentSorted = null;
		this.minDepth = Infinity; this.maxDepth = -Infinity;
		// view-space depth of the item about to be pushed. Passed through a typed array instead of an
		// argument: a double crossing a non-inlined call boundary is boxed into a HeapNumber per call.
		this.zScratch = new Float64Array(1);
	}
	init() {
		this.count = 0; this.opaqueCount = 0; this.transparentCount = 0;
		this.minDepth = Infinity; this.maxDepth = -Infinity;
	}
	_getItem(object, geometry, material, group, variant) {
		let item = this.items[this.count];
		if (item === undefined) {
			item = { id: object.id, object, geometry, material, program: null, group, renderOrder: object.renderOrder, materialRid: 0, geometryRid: 0, variant, mdRecord: null };
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
	push(object, geometry, material, group, materialRid, geometryRid, variant) {
		if (this.count >= INDEX_RANGE) return; // list full; ignore extra items rather than corrupt keys
		const item = this._getItem(object, geometry, material, group, variant);
		item.materialRid = materialRid; item.geometryRid = geometryRid;
		const index = this.count - 1;
		if (material.transparent === true) {
			if (this.transparentCount === this.transparentKeys.length) {
				const nk = new Float64Array(this.transparentKeys.length * 2); nk.set(this.transparentKeys); this.transparentKeys = nk;
				const nd = new Float32Array(this.transparentDepth.length * 2); nd.set(this.transparentDepth); this.transparentDepth = nd;
			}
			const z = this.zScratch[0];
			this.transparentKeys[this.transparentCount] = index; // depth resolved in finish()
			this.transparentDepth[this.transparentCount] = z;
			if (z < this.minDepth) this.minDepth = z;
			if (z > this.maxDepth) this.maxDepth = z;
			this.transparentCount++;
		} else {
			if (this.opaqueCount === this.opaqueKeys.length) {
				const nk = new Float64Array(this.opaqueKeys.length * 2); nk.set(this.opaqueKeys); this.opaqueKeys = nk;
			}
			this.opaqueKeys[this.opaqueCount++] = index;
		}
	}
	/**
	 * Build keys and sort. `rankOf(renderOrder)` maps a renderOrder value to 0..63.
	 */
	finish(sortObjects, rankOf) {
		const items = this.items;
		const singleRank = rankOf(this.count > 0 ? items[0].renderOrder : 0) === 0 && rankOf(Infinity) === 0; // ranker reports a single render order
		// opaque
		const ok = this.opaqueKeys, on = this.opaqueCount;
		for (let i = 0; i < on; i++) {
			const index = ok[i];
			const item = items[index];
			const rank = singleRank ? 0 : rankOf(item.renderOrder);
			const program = item.program._frameRid & 63;
			const mat = item.materialRid & 1023;
			const geo = item.geometryRid & 511;
			const indexed = item.geometry.index !== null ? 1 : 0; // keeps geometries of one mega-buffer layout adjacent
			// (((((rank*64 + program)*1024 + mat)*2 + indexed)*512 + geo) * 2^20 + index
			ok[i] = (((((rank * 64 + program) * 1024 + mat) * 2 + indexed) * 512 + geo) * INDEX_RANGE) + index;
		}
		// sorted views are reused while the count and backing buffer are unchanged (static scenes allocate nothing)
		let os = this.opaqueSorted;
		if (os === null || os.length !== on || os.buffer !== ok.buffer) os = this.opaqueSorted = ok.subarray(0, on);
		if (sortObjects && on > 1) os.sort();
		// transparent: back to front
		const tk = this.transparentKeys, tn = this.transparentCount, td = this.transparentDepth;
		const range = this.maxDepth - this.minDepth;
		const scale = range > 0 ? 67108863 / range : 0; // 26 bits
		for (let i = 0; i < tn; i++) {
			const index = tk[i];
			const item = items[index];
			const rank = singleRank ? 0 : rankOf(item.renderOrder);
			// larger z (farther) first -> smaller key
			const depthKey = Math.round((this.maxDepth - td[i]) * scale);
			tk[i] = ((rank * 67108864 + depthKey) * INDEX_RANGE) + index;
		}
		let ts = this.transparentSorted;
		if (ts === null || ts.length !== tn || ts.buffer !== tk.buffer) ts = this.transparentSorted = tk.subarray(0, tn);
		if (sortObjects && tn > 1) ts.sort();
	}
	/** Item for a sorted key. */
	itemFromKey(key) { return this.items[key % INDEX_RANGE]; }
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
