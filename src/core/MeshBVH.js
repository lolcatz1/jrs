/**
 * MeshBVH: a compact bounding volume hierarchy over a BufferGeometry's
 * triangles. three.js tests every triangle on raycast; here Mesh.raycast
 * builds this tree lazily on first use and then visits O(log n) nodes.
 *
 * Layout (struct-of-arrays, no per-node objects):
 *   bounds: Float32Array, 6 floats per node (minx,miny,minz,maxx,maxy,maxz), padded outwards
 *           by 1e-6 of the root extent so rounding in the slab test can never drop an edge hit
 *           (Float64Array when the position array is not exactly representable in float32)
 *   meta:   Int32Array,   2 ints per node
 *             interior: [leftChild, rightChild]
 *             leaf:     [triOffset, triCount]
 *   isLeaf: Uint8Array
 *   tris:   Uint32Array of triangle indices (into the index buffer / 3)
 *
 * Build: binned surface-area heuristic (16 bins on the longest centroid axis). Triangle bounds
 * are permuted together with the triangle ids, so every pass over a node's range is sequential
 * in memory. Children always have larger node indices than their parent, which is what makes
 * `refit()` a single backwards sweep.
 *
 * The tree remembers the version of the position attribute and the index it was built from;
 * `Mesh.raycast` calls `validate()` before using it, which refits (position changed, same
 * topology) or tells the caller to rebuild (index/attribute replaced).
 */
const BIN_COUNT = 16;

function rangeBounds(tb, start, end, out, o) {
	let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
	for (let b = start * 6, e = end * 6; b < e; b += 6) {
		if (tb[b] < minx) minx = tb[b]; if (tb[b + 1] < miny) miny = tb[b + 1]; if (tb[b + 2] < minz) minz = tb[b + 2];
		if (tb[b + 3] > maxx) maxx = tb[b + 3]; if (tb[b + 4] > maxy) maxy = tb[b + 4]; if (tb[b + 5] > maxz) maxz = tb[b + 5];
	}
	out[o] = minx; out[o + 1] = miny; out[o + 2] = minz; out[o + 3] = maxx; out[o + 4] = maxy; out[o + 5] = maxz;
}

class MeshBVH {
	constructor(geometry, options = {}) {
		this.maxLeafTris = options.maxLeafTris !== undefined ? options.maxLeafTris : 8;
		this.geometry = geometry;
		this._hits = new Uint32Array(64);
		this._stack = new Int32Array(128);
		this._build(geometry);
	}

	_build(geometry) {
		const position = geometry.attributes.position;
		const index = geometry.index;
		const pos = position.array, stride = position.itemSize;
		const triCount = index !== null ? (index.count / 3) | 0 : (position.count / 3) | 0;
		const idx = index !== null ? index.array : null;
		const maxLeafTris = this.maxLeafTris;

		this._positionArray = pos; this._positionVersion = position.version;
		this._indexArray = idx; this._indexVersion = index !== null ? index.version : 0; this._triCount = triCount;
		this._exactFloat32 = pos instanceof Float32Array || pos instanceof Int8Array || pos instanceof Int16Array || pos instanceof Uint8Array || pos instanceof Uint16Array;

		this.triCount = triCount;
		const tris = new Uint32Array(triCount);
		const tb = this._exactFloat32 ? new Float32Array(triCount * 6) : new Float64Array(triCount * 6); // permuted together with `tris`
		this._fillTriangleBounds(tb, tris, pos, stride, idx, triCount);

		let capacity = Math.max(3, 2 * Math.ceil(triCount / Math.max(1, maxLeafTris / 2)) + 1);
		let bounds = this._exactFloat32 ? new Float32Array(capacity * 6) : new Float64Array(capacity * 6);
		let meta = new Int32Array(capacity * 2);
		let isLeaf = new Uint8Array(capacity);
		let nodeCount = 1;

		const bins = new Float64Array(BIN_COUNT * 6); // per-bin bounds
		const binCount = new Int32Array(BIN_COUNT);
		const rightB = new Float64Array(BIN_COUNT * 6); // bounds of everything right of split plane k
		const rightArea = new Float64Array(BIN_COUNT);
		const rightCountArr = new Int32Array(BIN_COUNT);
		let work = new Int32Array(3 * 128);
		let wp = 0;

		// root bounds from the triangle bounds (children get theirs from the SAH bins: no extra pass)
		{
			let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
			for (let b = 0, e = triCount * 6; b < e; b += 6) {
				if (tb[b] < minx) minx = tb[b]; if (tb[b + 1] < miny) miny = tb[b + 1]; if (tb[b + 2] < minz) minz = tb[b + 2];
				if (tb[b + 3] > maxx) maxx = tb[b + 3]; if (tb[b + 4] > maxy) maxy = tb[b + 4]; if (tb[b + 5] > maxz) maxz = tb[b + 5];
			}
			if (triCount === 0) minx = miny = minz = maxx = maxy = maxz = 0;
			bounds[0] = minx; bounds[1] = miny; bounds[2] = minz; bounds[3] = maxx; bounds[4] = maxy; bounds[5] = maxz;
		}
		work[wp++] = 0; work[wp++] = 0; work[wp++] = triCount;

		while (wp > 0) {
			const end = work[--wp], start = work[--wp], node = work[--wp];
			if (nodeCount + 2 >= capacity) {
				capacity *= 2;
				const nb = this._exactFloat32 ? new Float32Array(capacity * 6) : new Float64Array(capacity * 6); nb.set(bounds); bounds = nb;
				const nm = new Int32Array(capacity * 2); nm.set(meta); meta = nm;
				const nl = new Uint8Array(capacity); nl.set(isLeaf); isLeaf = nl;
			}
			const count = end - start;
			if (count <= maxLeafTris) { isLeaf[node] = 1; meta[node * 2] = start; meta[node * 2 + 1] = count; continue; }

			const o = node * 6;
			const minx = bounds[o], miny = bounds[o + 1], minz = bounds[o + 2];
			const ex = bounds[o + 3] - minx, ey = bounds[o + 4] - miny, ez = bounds[o + 5] - minz;
			let axis = 0, nmin2 = minx * 2, extent2 = ex * 2;
			if (ey > ex) { axis = 1; nmin2 = miny * 2; extent2 = ey * 2; }
			if (ez > (axis === 0 ? ex : ey)) { axis = 2; nmin2 = minz * 2; extent2 = ez * 2; }

			let mid = -1, haveBounds = false;
			if (extent2 > 0) {
				const scale = BIN_COUNT / extent2;
				for (let k = 0; k < BIN_COUNT; k++) {
					binCount[k] = 0;
					const q = k * 6;
					bins[q] = bins[q + 1] = bins[q + 2] = Infinity; bins[q + 3] = bins[q + 4] = bins[q + 5] = -Infinity;
				}
				for (let i = start, b = start * 6; i < end; i++, b += 6) {
					let k = ((tb[b + axis] + tb[b + 3 + axis] - nmin2) * scale) | 0;
					if (k >= BIN_COUNT) k = BIN_COUNT - 1; else if (k < 0) k = 0;
					binCount[k]++;
					const q = k * 6;
					if (tb[b] < bins[q]) bins[q] = tb[b]; if (tb[b + 1] < bins[q + 1]) bins[q + 1] = tb[b + 1]; if (tb[b + 2] < bins[q + 2]) bins[q + 2] = tb[b + 2];
					if (tb[b + 3] > bins[q + 3]) bins[q + 3] = tb[b + 3]; if (tb[b + 4] > bins[q + 4]) bins[q + 4] = tb[b + 4]; if (tb[b + 5] > bins[q + 5]) bins[q + 5] = tb[b + 5];
				}
				// sweep from the right: bounds, area and count of everything right of each split plane
				let rx0 = Infinity, ry0 = Infinity, rz0 = Infinity, rx1 = -Infinity, ry1 = -Infinity, rz1 = -Infinity, rc = 0;
				for (let k = BIN_COUNT - 1; k > 0; k--) {
					const q = k * 6;
					if (binCount[k] > 0) {
						if (bins[q] < rx0) rx0 = bins[q]; if (bins[q + 1] < ry0) ry0 = bins[q + 1]; if (bins[q + 2] < rz0) rz0 = bins[q + 2];
						if (bins[q + 3] > rx1) rx1 = bins[q + 3]; if (bins[q + 4] > ry1) ry1 = bins[q + 4]; if (bins[q + 5] > rz1) rz1 = bins[q + 5];
						rc += binCount[k];
					}
					rightB[q] = rx0; rightB[q + 1] = ry0; rightB[q + 2] = rz0; rightB[q + 3] = rx1; rightB[q + 4] = ry1; rightB[q + 5] = rz1;
					const dx = rx1 - rx0, dy = ry1 - ry0, dz = rz1 - rz0;
					rightArea[k] = rc > 0 ? dx * dy + dy * dz + dz * dx : 0;
					rightCountArr[k] = rc;
				}
				let lx0 = Infinity, ly0 = Infinity, lz0 = Infinity, lx1 = -Infinity, ly1 = -Infinity, lz1 = -Infinity, lc = 0;
				let bestCost = Infinity, bestSplit = -1;
				let blx0 = 0, bly0 = 0, blz0 = 0, blx1 = 0, bly1 = 0, blz1 = 0;
				for (let k = 0; k < BIN_COUNT - 1; k++) {
					const q = k * 6;
					if (binCount[k] > 0) {
						if (bins[q] < lx0) lx0 = bins[q]; if (bins[q + 1] < ly0) ly0 = bins[q + 1]; if (bins[q + 2] < lz0) lz0 = bins[q + 2];
						if (bins[q + 3] > lx1) lx1 = bins[q + 3]; if (bins[q + 4] > ly1) ly1 = bins[q + 4]; if (bins[q + 5] > lz1) lz1 = bins[q + 5];
						lc += binCount[k];
					}
					const rcount = rightCountArr[k + 1];
					if (lc === 0 || rcount === 0) continue;
					const dx = lx1 - lx0, dy = ly1 - ly0, dz = lz1 - lz0;
					const cost = (dx * dy + dy * dz + dz * dx) * lc + rightArea[k + 1] * rcount;
					if (cost < bestCost) {
						bestCost = cost; bestSplit = k;
						blx0 = lx0; bly0 = ly0; blz0 = lz0; blx1 = lx1; bly1 = ly1; blz1 = lz1;
					}
				}
				if (bestSplit >= 0) {
					// partition by bin index (same bin function as above)
					let i = start, j = end - 1;
					while (i <= j) {
						while (i <= j && ((((tb[i * 6 + axis] + tb[i * 6 + 3 + axis] - nmin2) * scale) | 0) <= bestSplit)) i++;
						while (i <= j && ((((tb[j * 6 + axis] + tb[j * 6 + 3 + axis] - nmin2) * scale) | 0) > bestSplit)) j--;
						if (i < j) {
							const t = tris[i]; tris[i] = tris[j]; tris[j] = t;
							const a = i * 6, c = j * 6;
							for (let m = 0; m < 6; m++) { const v = tb[a + m]; tb[a + m] = tb[c + m]; tb[c + m] = v; }
							i++; j--;
						}
					}
					if (i !== start && i !== end) {
						mid = i;
						const left = nodeCount, right = nodeCount + 1, q = (bestSplit + 1) * 6;
						bounds[left * 6] = blx0; bounds[left * 6 + 1] = bly0; bounds[left * 6 + 2] = blz0; bounds[left * 6 + 3] = blx1; bounds[left * 6 + 4] = bly1; bounds[left * 6 + 5] = blz1;
						bounds[right * 6] = rightB[q]; bounds[right * 6 + 1] = rightB[q + 1]; bounds[right * 6 + 2] = rightB[q + 2]; bounds[right * 6 + 3] = rightB[q + 3]; bounds[right * 6 + 4] = rightB[q + 4]; bounds[right * 6 + 5] = rightB[q + 5];
						haveBounds = true;
					}
				}
			}
			if (mid < 0) mid = (start + end) >> 1; // degenerate (coincident or clamped bins): split by index

			const left = nodeCount++, right = nodeCount++;
			if (!haveBounds) { rangeBounds(tb, start, mid, bounds, left * 6); rangeBounds(tb, mid, end, bounds, right * 6); }
			isLeaf[node] = 0; meta[node * 2] = left; meta[node * 2 + 1] = right;
			if (wp + 6 > work.length) { const nw = new Int32Array(work.length * 2); nw.set(work); work = nw; }
			work[wp++] = right; work[wp++] = mid; work[wp++] = end;
			work[wp++] = left; work[wp++] = start; work[wp++] = mid;
		}

		this.nodeCount = nodeCount;
		this.bounds = bounds.subarray(0, nodeCount * 6);
		this.meta = meta.subarray(0, nodeCount * 2);
		this.isLeaf = isLeaf.subarray(0, nodeCount);
		this.tris = tris;
		this._pad(bounds, nodeCount);
	}

	_fillTriangleBounds(tb, tris, pos, stride, idx, triCount) {
		for (let t = 0; t < triCount; t++) {
			tris[t] = t;
			let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
			for (let k = 0; k < 3; k++) {
				const v = idx !== null ? idx[t * 3 + k] : t * 3 + k;
				const o = v * stride;
				const x = pos[o], y = pos[o + 1], z = pos[o + 2];
				if (x < minx) minx = x; if (x > maxx) maxx = x;
				if (y < miny) miny = y; if (y > maxy) maxy = y;
				if (z < minz) minz = z; if (z > maxz) maxz = z;
			}
			const b = t * 6;
			tb[b] = minx; tb[b + 1] = miny; tb[b + 2] = minz; tb[b + 3] = maxx; tb[b + 4] = maxy; tb[b + 5] = maxz;
		}
	}

	/** Pads all node bounds outwards by 1e-6 of the root extent (see header). */
	_pad(bounds, nodeCount) {
		const ex = bounds[3] - bounds[0], ey = bounds[4] - bounds[1], ez = bounds[5] - bounds[2];
		let pad = 1e-6 * Math.max(ex, ey, ez);
		if (!(pad > 0) || !Number.isFinite(pad)) pad = 0;
		this._padding = pad;
		if (pad === 0) return;
		for (let n = 0; n < nodeCount; n++) {
			const o = n * 6;
			bounds[o] -= pad; bounds[o + 1] -= pad; bounds[o + 2] -= pad;
			bounds[o + 3] += pad; bounds[o + 4] += pad; bounds[o + 5] += pad;
		}
	}

	/**
	 * Returns true when the tree still matches the geometry. If only the vertex positions changed
	 * (`position.needsUpdate`, same array, same index) the node bounds are refitted in O(nodes + triangles);
	 * if the index or the position array was replaced the tree is stale and the caller must rebuild.
	 */
	validate(geometry) {
		const position = geometry.attributes.position, index = geometry.index;
		if (position === undefined || position.array !== this._positionArray) return false;
		if ((index !== null ? index.array : null) !== this._indexArray) return false;
		if (index !== null && (index.version !== this._indexVersion || ((index.count / 3) | 0) !== this._triCount)) return false;
		if (index === null && ((position.count / 3) | 0) !== this._triCount) return false;
		if (position.version !== this._positionVersion) this.refit(geometry);
		return true;
	}

	refit(geometry) {
		const position = geometry.attributes.position, index = geometry.index;
		const pos = position.array, stride = position.itemSize, idx = index !== null ? index.array : null;
		const bounds = this.bounds, meta = this.meta, isLeaf = this.isLeaf, tris = this.tris, pad = this._padding;
		for (let n = this.nodeCount - 1; n >= 0; n--) {
			const o = n * 6;
			let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
			if (isLeaf[n] === 1) {
				const s = meta[n * 2], e = s + meta[n * 2 + 1];
				for (let i = s; i < e; i++) {
					const t = tris[i] * 3;
					for (let k = 0; k < 3; k++) {
						const v = (idx !== null ? idx[t + k] : t + k) * stride;
						const x = pos[v], y = pos[v + 1], z = pos[v + 2];
						if (x < minx) minx = x; if (x > maxx) maxx = x;
						if (y < miny) miny = y; if (y > maxy) maxy = y;
						if (z < minz) minz = z; if (z > maxz) maxz = z;
					}
				}
				minx -= pad; miny -= pad; minz -= pad; maxx += pad; maxy += pad; maxz += pad;
			} else {
				const l = meta[n * 2] * 6, r = meta[n * 2 + 1] * 6;
				minx = Math.min(bounds[l], bounds[r]); miny = Math.min(bounds[l + 1], bounds[r + 1]); minz = Math.min(bounds[l + 2], bounds[r + 2]);
				maxx = Math.max(bounds[l + 3], bounds[r + 3]); maxy = Math.max(bounds[l + 4], bounds[r + 4]); maxz = Math.max(bounds[l + 5], bounds[r + 5]);
			}
			bounds[o] = minx; bounds[o + 1] = miny; bounds[o + 2] = minz; bounds[o + 3] = maxx; bounds[o + 4] = maxy; bounds[o + 5] = maxz;
		}
		this._positionVersion = position.version;
	}

	/**
	 * Collects the triangles of every leaf the ray enters into `this._hits` (no callback, no
	 * allocation in the steady state) and returns how many. Candidates are in tree order; callers
	 * that need triangle order sort `this._hits.subarray(0, n)`.
	 */
	collect(ox, oy, oz, dx, dy, dz, maxT) {
		const bounds = this.bounds, meta = this.meta, isLeaf = this.isLeaf, tris = this.tris;
		const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
		let stack = this._stack, hits = this._hits, sp = 0, n = 0;
		stack[sp++] = 0;
		while (sp > 0) {
			const node = stack[--sp];
			const o = node * 6;
			let t1 = (bounds[o] - ox) * idx, t2 = (bounds[o + 3] - ox) * idx;
			let tmin = t1 < t2 ? t1 : t2, tmax = t1 < t2 ? t2 : t1;
			t1 = (bounds[o + 1] - oy) * idy; t2 = (bounds[o + 4] - oy) * idy;
			let lo = t1 < t2 ? t1 : t2, hi = t1 < t2 ? t2 : t1;
			if (lo > tmin) tmin = lo; if (hi < tmax) tmax = hi;
			t1 = (bounds[o + 2] - oz) * idz; t2 = (bounds[o + 5] - oz) * idz;
			lo = t1 < t2 ? t1 : t2; hi = t1 < t2 ? t2 : t1;
			if (lo > tmin) tmin = lo; if (hi < tmax) tmax = hi;
			if (tmax < 0 || tmin > tmax || tmin > maxT) continue;
			if (isLeaf[node] === 1) {
				const start = meta[node * 2], count = meta[node * 2 + 1];
				if (n + count > hits.length) { const nh = new Uint32Array(Math.max(hits.length * 2, n + count)); nh.set(hits); hits = this._hits = nh; }
				for (let i = start, e = start + count; i < e; i++) hits[n++] = tris[i];
			} else {
				if (sp + 2 > stack.length) { const ns = new Int32Array(stack.length * 2); ns.set(stack); stack = this._stack = ns; }
				stack[sp++] = meta[node * 2];
				stack[sp++] = meta[node * 2 + 1];
			}
		}
		return n;
	}

	/**
	 * Visit every triangle whose node bounds the ray enters. `onTriangle(triIndex)`
	 * is called for each; the ray is given by origin (ox,oy,oz) and direction (dx,dy,dz).
	 */
	raycast(ox, oy, oz, dx, dy, dz, maxT, onTriangle) {
		const n = this.collect(ox, oy, oz, dx, dy, dz, maxT), hits = this._hits;
		for (let i = 0; i < n; i++) onTriangle(hits[i]);
	}
}

export { MeshBVH };
