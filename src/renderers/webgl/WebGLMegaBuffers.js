/**
 * Mega-buffers: geometries that share an attribute layout are sub-allocated into large shared
 * vertex/index buffers ("pages"), one VAO per page. A run of draws with the same material but
 * DIFFERENT geometries can then be issued as a single multiDrawElementsWEBGL call, with each
 * sub-draw reading its object matrix from a per-frame matrix texture via gl_DrawID.
 *
 * Only attributes with fixed locations (position, normal, uv, color, uv1) are packed; indices are
 * rebased to the page's vertex base at upload time (no base-vertex extension needed).
 *
 * Dynamic geometry: uploads are queued (`queue`) when a geometry is actually drawn through a page and
 * executed together (`flush`) before the draws. Only attributes whose `version` changed are queued, and
 * only their `updateRanges` when set (three.js semantics: ranges are cleared once uploaded, `onUpload`
 * fires after). Dirty regions that are adjacent in the page buffer are copied into one staging block
 * and uploaded with a single bufferSubData. Freed regions are reused (first fit), so a geometry that
 * is rebuilt or resized does not consume page space for ever. A geometry re-uploaded more than
 * DYNAMIC_UPLOADS_BEFORE_EVICTION times leaves the pages and is drawn individually (see the constant).
 * Geometries whose attributes carry an `onUpload` hook are not packed: the usual hook releases the CPU
 * array, which a later switch to the regular per-geometry buffers could not re-upload.
 */
import { ATTRIBUTE_LOCATIONS } from './WebGLBindingStates.js';
import { mergeUpdateRanges } from './WebGLAttributes.js';
import { BufferAttribute } from '../../core/BufferAttribute.js';

const NO_HOOK = BufferAttribute.prototype.onUploadCallback;

const PAGE_VERTICES = 1 << 18; // 262,144 vertices per page per layout
const PAGE_INDEX_RATIO = 4;
const MAX_STAGE_BYTES = 1 << 20; // longest run merged into one upload
// A geometry that keeps changing is drawn from its own buffers instead of a page: measured on ANGLE/SwiftShader,
// per-frame bufferSubData into a shared page buffer stalls the main thread for ~1 s every few hundred frames
// (own small buffers never do), while the CPU cost of the extra draw calls is about the same.
const DYNAMIC_UPLOADS_BEFORE_EVICTION = 3;

function glTypeOf(gl, array) {
	if (array instanceof Float32Array) return gl.FLOAT;
	if (array instanceof Uint16Array) return gl.UNSIGNED_SHORT;
	if (array instanceof Int16Array) return gl.SHORT;
	if (array instanceof Uint32Array) return gl.UNSIGNED_INT;
	if (array instanceof Int32Array) return gl.INT;
	if (array instanceof Int8Array) return gl.BYTE;
	if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) return gl.UNSIGNED_BYTE;
	return 0;
}

let bufferIdCounter = 0;

/** First-fit allocator over [0, capacity) with coalescing free list. */
class RangeAllocator {
	constructor(capacity) { this.starts = [0]; this.sizes = [capacity]; }
	alloc(size) {
		const starts = this.starts, sizes = this.sizes;
		for (let i = 0; i < starts.length; i++) {
			if (sizes[i] >= size) {
				const start = starts[i];
				if (sizes[i] === size) { starts.splice(i, 1); sizes.splice(i, 1); } else { starts[i] += size; sizes[i] -= size; }
				return start;
			}
		}
		return -1;
	}
	release(start, size) {
		if (size === 0) return;
		const starts = this.starts, sizes = this.sizes;
		let i = 0;
		while (i < starts.length && starts[i] < start) i++;
		const mergePrev = i > 0 && starts[i - 1] + sizes[i - 1] === start;
		const mergeNext = i < starts.length && start + size === starts[i];
		if (mergePrev && mergeNext) { sizes[i - 1] += size + sizes[i]; starts.splice(i, 1); sizes.splice(i, 1); }
		else if (mergePrev) sizes[i - 1] += size;
		else if (mergeNext) { starts[i] = start; sizes[i] += size; }
		else { starts.splice(i, 0, start); sizes.splice(i, 0, size); }
	}
}

class Page {
	constructor(gl, layout, capacity, indexCapacity) {
		this.gl = gl;
		this.layout = layout;
		this.capacity = capacity;
		this.indexCapacity = indexCapacity;
		this.vertexAlloc = new RangeAllocator(capacity);
		this.indexAlloc = new RangeAllocator(indexCapacity);
		this.buffers = {};
		this.bufferIds = {};
		this.indexBufferId = ++bufferIdCounter;
		this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		for (const a of layout.attributes) {
			const buffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, capacity * a.itemSize * a.bytes, gl.STATIC_DRAW);
			gl.enableVertexAttribArray(a.location);
			if ((a.glType === gl.INT || a.glType === gl.UNSIGNED_INT) && !a.normalized) gl.vertexAttribIPointer(a.location, a.itemSize, a.glType, 0, 0);
			else gl.vertexAttribPointer(a.location, a.itemSize, a.glType, a.normalized, 0, 0);
			this.buffers[a.name] = buffer;
			this.bufferIds[a.name] = ++bufferIdCounter;
		}
		this.indexBuffer = null;
		if (layout.indexed) {
			this.indexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexCapacity * 4, gl.STATIC_DRAW);
		}
		gl.bindVertexArray(null);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
	}
	dispose() {
		const gl = this.gl;
		gl.deleteVertexArray(this.vao);
		for (const name in this.buffers) gl.deleteBuffer(this.buffers[name]);
		if (this.indexBuffer) gl.deleteBuffer(this.indexBuffer);
	}
}

const NO_PAGE_RECORD = (layoutVersion) => ({ page: null, layoutVersion });

function compareSegments(a, b) { return a.bufferId - b.bufferId || a.byteOffset - b.byteOffset; }

class WebGLMegaBuffers {
	constructor(gl, state, info) {
		this.gl = gl;
		this.state = state;
		this.info = info;
		this.layouts = new Map(); // signature -> { signature, attributes:[{name,itemSize,glType,bytes,normalized,location}], indexed, pages: [] }
		this.records = new WeakMap(); // geometry -> allocation record (page === null: not eligible for this layout version)
		this._onGeometryDispose = this._onGeometryDispose.bind(this);
		// regions of geometries that are collected without dispose() go back to their page
		this._registry = typeof FinalizationRegistry !== 'undefined' ? new FinalizationRegistry((rec) => this._free(rec)) : null;
		// queued uploads (see queue/flush)
		this._segs = []; this._segPool = [];
		this._notify = [];
		this._stage = new Uint8Array(1 << 16);
		this._stageF32 = new Float32Array(this._stage.buffer);
		this._idxStage = new Uint32Array(1 << 12); this._idxStageN = 0;
	}

	/** Returns the allocation record for a geometry (allocating/reallocating as needed), or null if it must use the regular path. */
	ensure(geometry) {
		const drawRange = geometry.drawRange;
		if (drawRange.start !== 0 || drawRange.count !== Infinity) return null; // honoured by the regular path; checked every frame
		let rec = this.records.get(geometry);
		if (rec !== undefined) {
			if (rec.layoutVersion === geometry._layoutVersion) {
				if (rec.page === null) return null;
				if (rec.dynamic === true) { // keeps changing: leave the pages (this frame's draw already used the page copy)
					this._free(rec);
					this.records.set(geometry, NO_PAGE_RECORD(geometry._layoutVersion));
					return null;
				}
				const position = geometry.attributes.position, index = geometry.index;
				if (position.count === rec.vertexCount && (rec.indexed ? index !== null && index.count === rec.indexCount : index === null)) return rec;
			}
			this._free(rec); // layout changed or an array was replaced by one of another size: reallocate once
		}
		rec = this._allocate(geometry);
		this.records.set(geometry, rec);
		if (rec.page !== null) geometry.addEventListener('dispose', this._onGeometryDispose);
		return rec.page !== null ? rec : null;
	}

	_onGeometryDispose(event) {
		const geometry = event.target;
		geometry.removeEventListener('dispose', this._onGeometryDispose);
		const rec = this.records.get(geometry);
		if (rec) this._free(rec);
		this.records.delete(geometry);
	}

	_free(rec) {
		const page = rec.page;
		if (page === null) return;
		page.vertexAlloc.release(rec.baseVertex, rec.vertexCount);
		page.indexAlloc.release(rec.indexStart, rec.indexCount);
		rec.page = null;
	}

	_layoutOf(geometry) {
		const attributes = geometry.attributes;
		if (attributes.position === undefined || attributes.position.isInterleavedBufferAttribute) return null;
		const list = [];
		for (const name in attributes) {
			const location = ATTRIBUTE_LOCATIONS[name];
			if (location === undefined) continue;
			const a = attributes[name];
			if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute || a.onUploadCallback !== NO_HOOK) return null;
			const glType = glTypeOf(this.gl, a.array);
			if (glType === 0) return null;
			if (a.count !== attributes.position.count) return null;
			list.push({ name, itemSize: a.itemSize, glType, bytes: a.array.BYTES_PER_ELEMENT, normalized: a.normalized === true, location });
		}
		list.sort((x, y) => x.location - y.location);
		if (geometry.index !== null && geometry.index.onUploadCallback !== NO_HOOK) return null;
		const indexed = geometry.index !== null;
		const signature = list.map((a) => `${a.name}:${a.itemSize}:${a.glType}:${a.normalized ? 1 : 0}`).join('|') + (indexed ? '|i' : '');
		let layout = this.layouts.get(signature);
		if (layout === undefined) { layout = { signature, attributes: list, indexed, pages: [] }; this.layouts.set(signature, layout); }
		return layout;
	}

	_allocate(geometry) {
		if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) return NO_PAGE_RECORD(geometry._layoutVersion);
		const layout = this._layoutOf(geometry);
		if (layout === null) return NO_PAGE_RECORD(geometry._layoutVersion);
		const vertexCount = geometry.attributes.position.count;
		const indexCount = layout.indexed ? geometry.index.count : 0;
		if (vertexCount === 0) return NO_PAGE_RECORD(geometry._layoutVersion);
		let page = null, baseVertex = -1, indexStart = 0;
		for (let i = 0; i < layout.pages.length && page === null; i++) {
			const p = layout.pages[i];
			baseVertex = p.vertexAlloc.alloc(vertexCount);
			if (baseVertex < 0) continue;
			indexStart = p.indexAlloc.alloc(indexCount);
			if (indexStart < 0) { p.vertexAlloc.release(baseVertex, vertexCount); continue; }
			page = p;
		}
		if (page === null) {
			const cap = Math.max(PAGE_VERTICES, vertexCount), icap = Math.max(PAGE_VERTICES * PAGE_INDEX_RATIO, indexCount);
			page = new Page(this.gl, layout, cap, icap);
			layout.pages.push(page);
			this.state.currentVAO = null; // Page constructor rebinds VAO
			this.state.currentArrayBuffer = null;
			baseVertex = page.vertexAlloc.alloc(vertexCount);
			indexStart = page.indexAlloc.alloc(indexCount);
		}
		const n = layout.attributes.length;
		const rec = {
			page, layout, baseVertex, vertexCount, indexStart, indexCount, byteOffset: indexStart * 4,
			versions: new Array(n).fill(-1), seqs: new Array(n).fill(-1), indexVersion: -1, indexSeq: -1,
			layoutVersion: geometry._layoutVersion, indexed: layout.indexed, reuploads: 0, dynamic: false,
		};
		if (this._registry !== null) this._registry.register(geometry, rec, rec);
		return rec;
	}

	_segment(buffer, bufferId, byteOffset, array, srcStart, count, bytes) {
		const seg = this._segPool.length > 0 ? this._segPool.pop() : { bufferId: 0, buffer: null, byteOffset: 0, array: null, srcStart: 0, count: 0, bytes: 0 };
		seg.bufferId = bufferId; seg.buffer = buffer; seg.byteOffset = byteOffset; seg.array = array; seg.srcStart = srcStart; seg.count = count; seg.bytes = bytes;
		this._segs.push(seg);
	}

	/**
	 * Schedules the upload of whatever changed in `geometry` since this record was last synchronised.
	 * Call for geometries that are about to be drawn from the page; `flush()` executes the uploads.
	 */
	queue(rec, geometry) {
		const layout = rec.layout, attributes = geometry.attributes, page = rec.page;
		let reupload = false;
		for (let i = 0; i < layout.attributes.length; i++) {
			const a = layout.attributes[i];
			const attribute = attributes[a.name];
			if (attribute === undefined || rec.versions[i] === attribute.version) continue;
			if (rec.versions[i] !== -1) reupload = true;
			rec.versions[i] = attribute.version;
			const array = attribute.array, ranges = attribute.updateRanges;
			const limit = Math.min(rec.vertexCount * a.itemSize, array.length); // never read past the array (count changed behind our back)
			const baseBytes = rec.baseVertex * a.itemSize * a.bytes, buffer = page.buffers[a.name], bufferId = page.bufferIds[a.name];
			if (ranges.length !== 0 && rec.seqs[i] === attribute._uploadSeq) {
				mergeUpdateRanges(ranges);
				for (let r = 0; r < ranges.length; r++) {
					const start = ranges[r].start, end = Math.min(start + ranges[r].count, limit);
					if (end > start) this._segment(buffer, bufferId, baseBytes + start * a.bytes, array, start, end - start, a.bytes);
				}
				attribute.clearUpdateRanges(); attribute._uploadSeq++;
			} else {
				this._segment(buffer, bufferId, baseBytes, array, 0, limit, a.bytes);
				if (ranges.length !== 0) { attribute.clearUpdateRanges(); attribute._uploadSeq++; }
			}
			rec.seqs[i] = attribute._uploadSeq;
			if (attribute.onUploadCallback !== NO_HOOK) this._notify.push(attribute);
		}
		if (rec.indexed) {
			const index = geometry.index;
			if (rec.indexVersion !== index.version) {
				if (rec.indexVersion !== -1) reupload = true;
				rec.indexVersion = index.version;
				const src = index.array, ranges = index.updateRanges, base = rec.baseVertex, limit = Math.min(rec.indexCount, src.length);
				if (ranges.length !== 0 && rec.indexSeq === index._uploadSeq) {
					mergeUpdateRanges(ranges);
					for (let r = 0; r < ranges.length; r++) {
						const start = ranges[r].start, end = Math.min(start + ranges[r].count, limit);
						if (end > start) this._rebasedIndexSegment(page, rec, src, start, end, base);
					}
					index.clearUpdateRanges(); index._uploadSeq++;
				} else {
					this._rebasedIndexSegment(page, rec, src, 0, limit, base);
					if (ranges.length !== 0) { index.clearUpdateRanges(); index._uploadSeq++; }
				}
				rec.indexSeq = index._uploadSeq;
				if (index.onUploadCallback !== NO_HOOK) this._notify.push(index);
			}
		}
		if (reupload && ++rec.reuploads >= DYNAMIC_UPLOADS_BEFORE_EVICTION) rec.dynamic = true;
	}

	_rebasedIndexSegment(page, rec, src, start, end, base) {
		const count = end - start, offset = this._idxStageN;
		if (offset + count > this._idxStage.length) {
			const grown = new Uint32Array(Math.max(offset + count, this._idxStage.length * 2));
			grown.set(this._idxStage.subarray(0, offset));
			this._idxStage = grown;
		}
		const dst = this._idxStage;
		for (let k = 0; k < count; k++) dst[offset + k] = src[start + k] + base;
		this._idxStageN = offset + count;
		this._segment(page.indexBuffer, page.indexBufferId, (rec.indexStart + start) * 4, null, offset, count, 4);
	}

	/** Executes the queued uploads: adjacent regions of one buffer are merged into a single bufferSubData. */
	flush() {
		const segs = this._segs;
		const n = segs.length;
		if (n === 0) return;
		const gl = this.gl, target = gl.COPY_WRITE_BUFFER;
		if (n > 1) segs.sort(compareSegments);
		let i = 0;
		while (i < n) {
			const first = segs[i];
			let end = first.byteOffset + first.count * first.bytes;
			let j = i + 1, total = first.count * first.bytes;
			while (j < n && segs[j].bufferId === first.bufferId && segs[j].byteOffset === end && total < MAX_STAGE_BYTES) {
				const s = segs[j]; end += s.count * s.bytes; total += s.count * s.bytes; j++;
			}
			gl.bindBuffer(target, first.buffer);
			if (j - i === 1) {
				const array = first.array !== null ? first.array : this._idxStage;
				gl.bufferSubData(target, first.byteOffset, array, first.srcStart, first.count);
			} else {
				this._ensureStage(total);
				let pos = 0;
				for (let k = i; k < j; k++) { pos = this._copyToStage(segs[k], pos); }
				gl.bufferSubData(target, first.byteOffset, this._stage, 0, total);
			}
			i = j;
		}
		for (let k = 0; k < n; k++) { const s = segs[k]; s.array = null; s.buffer = null; this._segPool.push(s); }
		segs.length = 0;
		this._idxStageN = 0;
		const notify = this._notify;
		for (let k = 0; k < notify.length; k++) notify[k].onUploadCallback();
		notify.length = 0;
	}

	_ensureStage(bytes) {
		if (this._stage.length >= bytes) return;
		this._stage = new Uint8Array(Math.max(bytes, this._stage.length * 2));
		this._stageF32 = new Float32Array(this._stage.buffer);
	}

	_copyToStage(seg, pos) {
		const array = seg.array !== null ? seg.array : this._idxStage, count = seg.count, src = seg.srcStart;
		const bytes = count * seg.bytes;
		if (array instanceof Float32Array && (pos & 3) === 0) {
			const dst = this._stageF32, d0 = pos >> 2;
			for (let k = 0; k < count; k++) dst[d0 + k] = array[src + k];
		} else {
			this._stage.set(new Uint8Array(array.buffer, array.byteOffset + src * seg.bytes, bytes), pos);
		}
		return pos + bytes;
	}

	dispose() {
		for (const layout of this.layouts.values()) for (const p of layout.pages) p.dispose();
		this.layouts.clear();
		this.records = new WeakMap();
		this._segs.length = 0; this._notify.length = 0; this._idxStageN = 0;
	}
}

export { WebGLMegaBuffers, RangeAllocator };
