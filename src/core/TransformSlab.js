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

const PAGE_RECORDS = 1024;

class Page {
	constructor() {
		this.data = new Float32Array(RECORD_SIZE * PAGE_RECORDS);
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
			slot = { page, offset: page.used * RECORD_SIZE };
			page.used++;
		}
		const d = slot.page.data, o = slot.offset;
		// identity local + world, zero the rest
		for (let i = 0; i < RECORD_SIZE; i++) d[o + i] = 0;
		d[o] = 1; d[o + 5] = 1; d[o + 10] = 1; d[o + 15] = 1;
		d[o + 16] = 1; d[o + 21] = 1; d[o + 26] = 1; d[o + 31] = 1;
		this.live++;
		if (this.registry !== null) this.registry.register(owner, slot);
		return slot;
	}

	get pageCount() { return this.pages.length; }
}

export const transformSlab = new TransformSlab();
