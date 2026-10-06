/**
 * MeshBVH: a compact bounding volume hierarchy over a BufferGeometry's
 * triangles. three.js tests every triangle on raycast; here Mesh.raycast
 * builds this tree lazily on first use and then visits O(log n) nodes.
 *
 * Layout (struct-of-arrays, no per-node objects):
 *   bounds: Float32Array, 6 floats per node (minx,miny,minz,maxx,maxy,maxz)
 *   meta:   Int32Array,   2 ints per node
 *             interior: [leftChild, rightChild]  (count = -1 flag in a third array)
 *             leaf:     [triOffset, triCount]
 *   isLeaf: Uint8Array
 *   tris:   Uint32Array of triangle indices (into the index buffer / 3)
 */
class MeshBVH {
	constructor(geometry, options = {}) {
		this.maxLeafTris = options.maxLeafTris !== undefined ? options.maxLeafTris : 8;
		this.geometry = geometry;
		this._build(geometry);
	}

	_build(geometry) {
		const position = geometry.attributes.position;
		const index = geometry.index;
		const pos = position.array, stride = position.itemSize;
		const triCount = index !== null ? (index.count / 3) | 0 : (position.count / 3) | 0;
		const idx = index !== null ? index.array : null;

		this.triCount = triCount;
		const tris = new Uint32Array(triCount);
		const centroids = new Float32Array(triCount * 3);
		const triBounds = new Float32Array(triCount * 6);
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
			triBounds[b] = minx; triBounds[b + 1] = miny; triBounds[b + 2] = minz;
			triBounds[b + 3] = maxx; triBounds[b + 4] = maxy; triBounds[b + 5] = maxz;
			const c = t * 3;
			centroids[c] = (minx + maxx) * 0.5; centroids[c + 1] = (miny + maxy) * 0.5; centroids[c + 2] = (minz + maxz) * 0.5;
		}

		const maxNodes = Math.max(1, 2 * Math.ceil(triCount / Math.max(1, this.maxLeafTris / 2)) + 1);
		let bounds = new Float32Array(maxNodes * 6);
		let meta = new Int32Array(maxNodes * 2);
		let isLeaf = new Uint8Array(maxNodes);
		let nodeCount = 0;
		const maxLeafTris = this.maxLeafTris;

		function grow() {
			const nb = new Float32Array(bounds.length * 2); nb.set(bounds); bounds = nb;
			const nm = new Int32Array(meta.length * 2); nm.set(meta); meta = nm;
			const nl = new Uint8Array(isLeaf.length * 2); nl.set(isLeaf); isLeaf = nl;
		}

		function computeBounds(node, start, end) {
			let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
			for (let i = start; i < end; i++) {
				const b = tris[i] * 6;
				if (triBounds[b] < minx) minx = triBounds[b];
				if (triBounds[b + 1] < miny) miny = triBounds[b + 1];
				if (triBounds[b + 2] < minz) minz = triBounds[b + 2];
				if (triBounds[b + 3] > maxx) maxx = triBounds[b + 3];
				if (triBounds[b + 4] > maxy) maxy = triBounds[b + 4];
				if (triBounds[b + 5] > maxz) maxz = triBounds[b + 5];
			}
			const o = node * 6;
			bounds[o] = minx; bounds[o + 1] = miny; bounds[o + 2] = minz; bounds[o + 3] = maxx; bounds[o + 4] = maxy; bounds[o + 5] = maxz;
		}

		// Hoare-style partition of tris[start,end) by centroid[axis] < split
		function partition(start, end, axis, split) {
			let i = start, j = end - 1;
			while (i <= j) {
				while (i <= j && centroids[tris[i] * 3 + axis] < split) i++;
				while (i <= j && centroids[tris[j] * 3 + axis] >= split) j--;
				if (i < j) { const tmp = tris[i]; tris[i] = tris[j]; tris[j] = tmp; i++; j--; }
			}
			return i;
		}

		// iterative build with an explicit work stack
		const stack = [];
		const root = nodeCount++;
		stack.push(root, 0, triCount);
		while (stack.length > 0) {
			const end = stack.pop(), start = stack.pop(), node = stack.pop();
			if (nodeCount + 2 >= isLeaf.length) grow();
			computeBounds(node, start, end);
			const count = end - start;
			if (count <= maxLeafTris) {
				isLeaf[node] = 1; meta[node * 2] = start; meta[node * 2 + 1] = count;
				continue;
			}
			// centroid bounds pick the split axis
			let cminx = Infinity, cminy = Infinity, cminz = Infinity, cmaxx = -Infinity, cmaxy = -Infinity, cmaxz = -Infinity;
			for (let i = start; i < end; i++) {
				const c = tris[i] * 3;
				const x = centroids[c], y = centroids[c + 1], z = centroids[c + 2];
				if (x < cminx) cminx = x; if (x > cmaxx) cmaxx = x;
				if (y < cminy) cminy = y; if (y > cmaxy) cmaxy = y;
				if (z < cminz) cminz = z; if (z > cmaxz) cmaxz = z;
			}
			const ex = cmaxx - cminx, ey = cmaxy - cminy, ez = cmaxz - cminz;
			let axis = 0, split = (cminx + cmaxx) * 0.5;
			if (ey > ex && ey >= ez) { axis = 1; split = (cminy + cmaxy) * 0.5; }
			else if (ez > ex && ez > ey) { axis = 2; split = (cminz + cmaxz) * 0.5; }
			let mid = partition(start, end, axis, split);
			if (mid === start || mid === end) {
				// degenerate: fall back to a median split by index
				mid = (start + end) >> 1;
			}
			const left = nodeCount++, right = nodeCount++;
			isLeaf[node] = 0; meta[node * 2] = left; meta[node * 2 + 1] = right;
			stack.push(left, start, mid);
			stack.push(right, mid, end);
		}

		this.nodeCount = nodeCount;
		this.bounds = bounds.subarray(0, nodeCount * 6);
		this.meta = meta.subarray(0, nodeCount * 2);
		this.isLeaf = isLeaf.subarray(0, nodeCount);
		this.tris = tris;
		this._stack = new Int32Array(128);
	}

	/**
	 * Visit every triangle whose node bounds the ray enters. `onTriangle(triIndex)`
	 * is called for each; the ray is given by origin (ox,oy,oz) and direction (dx,dy,dz).
	 * Returns nothing; collect results in the callback.
	 */
	raycast(ox, oy, oz, dx, dy, dz, maxT, onTriangle) {
		const bounds = this.bounds, meta = this.meta, isLeaf = this.isLeaf, tris = this.tris;
		const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
		let stack = this._stack, sp = 0;
		stack[sp++] = 0;
		while (sp > 0) {
			const node = stack[--sp];
			const o = node * 6;
			// slab test
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
				for (let i = start, e = start + count; i < e; i++) onTriangle(tris[i]);
			} else {
				if (sp + 2 > stack.length) { const ns = new Int32Array(stack.length * 2); ns.set(stack); stack = this._stack = ns; }
				stack[sp++] = meta[node * 2];
				stack[sp++] = meta[node * 2 + 1];
			}
		}
	}
}

export { MeshBVH };
