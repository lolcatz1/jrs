/**
 * TransformSlab: contiguous Float32 storage for every Object3D's matrices.
 *
 * Each object owns one record of RECORD_SIZE floats inside a large page:
 *
 *   [ 0..16)  local matrix          (Object3D.matrix.elements)
 *   [16..32)  world matrix          (Object3D.matrixWorld.elements)
 *   [32..41)  world normal matrix   (mat3, lazily refreshed by the renderer)
 *   [41..45)  world bounding sphere (cx, cy, cz, r; lazily refreshed)
 *   [45..48)  padding
 *
 * Why: sibling objects end up adjacent in memory, so scene-graph updates and
 * render traversal walk cache lines instead of chasing pointers between
 * sixteen-element arrays scattered over the heap. The renderer uploads
 * matrices straight out of the page with the WebGL2 srcOffset overloads, so
 * no per-draw copy or allocation happens.
 *
 * Records are recycled through a FinalizationRegistry when their Object3D is
 * garbage collected, so slots are never leaked by apps that churn objects.
 */

export const RECORD_SIZE = 48;
export const LOCAL_OFFSET = 0;
export const WORLD_OFFSET = 16;
export const NORMAL_OFFSET = 32;
export const SPHERE_OFFSET = 41;
/** Doubles per record in the page's snapshot: change detection (px py pz qx qy qz qw sx sy sz) + cull cache (radius, cx, cy, cz); a Bone keeps its live TRS and scene-graph state here (core/SlabTransform.js). */
export const SNAPSHOT_SIZE = 16;
export const CULL_SNAPSHOT_OFFSET = 10;

const PAGE_RECORDS = 1024;

class Page {
	constructor() {
		this.data = new Float32Array(RECORD_SIZE * PAGE_RECORDS);
		// TRS snapshot used by Object3D.updateMatrix(). Kept in a typed array rather than in object
		// fields: double fields read from receivers of many different shapes (Scene, lights, cameras,
		// meshes) go megamorphic and box a HeapNumber per load, which was ~120 B per object per frame.
		this.snapshot = new Float64Array(SNAPSHOT_SIZE * PAGE_RECORDS);
		this.used = 0;
	}
}

class TransformSlab {
	constructor() {
		this.pages = [];
		this.free = []; // [{page, offset}]
		this.live = 0;
		this.registry = (typeof FinalizationRegistry !== 'undefined')
			? new FinalizationRegistry((slot) => { this.free.push(slot); this.live--; })
			: null;
	}

	/**
	 * Returns a slot {page, offset, data} for `owner`. `data` is a Float32Array
	 * view over the record; `page.data` with `offset` gives zero-copy access for
	 * srcOffset-style uploads.
	 */
	allocate(owner) {
		let slot = this.free.pop();
		if (slot === undefined) {
			let page = this.pages[this.pages.length - 1];
			if (page === undefined || page.used === PAGE_RECORDS) {
				page = new Page();
				this.pages.push(page);
			}
			slot = { page, offset: page.used * RECORD_SIZE, snapshotOffset: page.used * SNAPSHOT_SIZE };
			page.used++;
		}
		const d = slot.page.data, o = slot.offset;
		// identity local + world, zero the rest
		for (let i = 0; i < RECORD_SIZE; i++) d[o + i] = 0;
		d[o] = 1; d[o + 5] = 1; d[o + 10] = 1; d[o + 15] = 1;
		d[o + 16] = 1; d[o + 21] = 1; d[o + 26] = 1; d[o + 31] = 1;
		slot.page.snapshot[slot.snapshotOffset] = NaN; // NaN position snapshot forces the first compose
		this.live++;
		if (this.registry !== null) this.registry.register(owner, slot);
		return slot;
	}

	get pageCount() { return this.pages.length; }
}

export const transformSlab = new TransformSlab();

/** Inverse-transpose of the upper 3x3 of the world matrix at slab[o+16..32) -> slab[o+32..41) (column-major mat3). */
export function computeNormalMatrix(s, o) {
	const e = o + 16;
	const n11 = s[e], n21 = s[e + 1], n31 = s[e + 2], n12 = s[e + 4], n22 = s[e + 5], n32 = s[e + 6], n13 = s[e + 8], n23 = s[e + 9], n33 = s[e + 10];
	const t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13;
	const det = n11 * t11 + n21 * t12 + n31 * t13;
	const m = o + 32;
	if (det === 0) { for (let i = 0; i < 9; i++) s[m + i] = 0; return; }
	const detInv = 1 / det;
	const i0 = t11 * detInv, i1 = (n31 * n23 - n33 * n21) * detInv, i2 = (n32 * n21 - n31 * n22) * detInv;
	const i3 = t12 * detInv, i4 = (n33 * n11 - n31 * n13) * detInv, i5 = (n31 * n12 - n32 * n11) * detInv;
	const i6 = t13 * detInv, i7 = (n21 * n13 - n23 * n11) * detInv, i8 = (n22 * n11 - n21 * n12) * detInv;
	s[m] = i0; s[m + 1] = i3; s[m + 2] = i6;
	s[m + 3] = i1; s[m + 4] = i4; s[m + 5] = i7;
	s[m + 6] = i2; s[m + 7] = i5; s[m + 8] = i8;
}
