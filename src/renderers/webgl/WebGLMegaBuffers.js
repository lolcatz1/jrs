/**
 * Mega-buffers: geometries that share an attribute layout are sub-allocated into large shared
 * vertex/index buffers ("pages"), one VAO per page. A run of draws with the same material but
 * DIFFERENT geometries can then be issued as a single multiDrawElementsWEBGL call, with each
 * sub-draw reading its object matrix from a per-frame matrix texture via gl_DrawID.
 *
 * Only attributes with fixed locations (position, normal, uv, color, uv1, and custom ShaderMaterial attributes
 * that have a per-name location, see WebGLPrograms.customAttributeLocation) are packed; indices are
 * rebased to the page's vertex base at upload time, so any geometry of a page is drawn with the page's VAO
 * and a plain index offset (drawElements) or first vertex (drawArrays): the base-vertex extensions would add nothing.
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
import { customAttributeLocation, customAttributeCount } from './WebGLPrograms.js';
import { BufferAttribute } from '../../core/BufferAttribute.js';
import { attributeEpoch } from '../../core/attributeEpoch.js';

const NO_HOOK = BufferAttribute.prototype.onUploadCallback;

const PAGE_VERTICES = 1 << 18; // 262,144 vertices per page per layout
const PAGE_INDEX_RATIO = 4;
// A page whose geometries are all gone is deleted after this many frames (a level swap that reallocates within the
// grace period reuses it; a scene torn down for good gives the GPU memory back).
const EMPTY_PAGE_GRACE_FRAMES = 30;
const MAX_STAGE_BYTES = 1 << 20; // longest run merged into one upload
// Geometries larger than this are drawn on their own: a multi-draw run gains nothing from a huge sub-draw
// and a private copy of a million-vertex buffer would double its GPU memory.
const MAX_VERTICES = 1 << 16;

/** What a record draws as. Strips, loops and segments of a Line are expanded to indexed LINES pairs so any mix shares one multi-draw. */
export const KIND_TRIANGLES = 0, KIND_LINE_STRIP = 1, KIND_LINE_LOOP = 2, KIND_LINE_SEGMENTS = 3, KIND_POINTS = 4;
const KIND_COUNT = 5;
const SLOT_COUNT = KIND_COUNT * 8;
/** One allocation slot per (kind, needs); meshes use slot 0 (everything is paged). */
export function slotOf(kind, needs) { return kind === KIND_TRIANGLES ? 0 : kind * 8 + (needs & 7); }
/** Stand-ins for "this geometry is not paged as that slot", comparable by identity (draw-command caches remember them). */
export const NULL_RECORDS = Array.from({ length: SLOT_COUNT }, (_, slot) => ({ page: null, slot }));

/** Lines / points page only the attributes their material reads: position plus `needs` (bit 0 colour, 1 lineDistance, 2 uv). Meshes page everything with a location. */
function wanted(name, kind, needs) {
	if (kind === KIND_TRIANGLES) return true;
	return name === 'position' || (name === 'color' && (needs & 1) !== 0) || (name === 'lineDistance' && (needs & 2) !== 0) || (name === 'uv' && (needs & 4) !== 0);
}
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
		this.emptySince = -1;
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
	isEmpty() { const v = this.vertexAlloc, i = this.indexAlloc; return v.starts.length === 1 && v.sizes[0] === this.capacity && i.starts.length === 1 && i.sizes[0] === this.indexCapacity; }
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
		this.maxAttributes = gl.getParameter(gl.MAX_VERTEX_ATTRIBS);
		this.pages = []; // every live page of every layout, for the per-frame reclaim sweep
		this.layouts = new Map(); // signature -> { signature, attributes:[{name,itemSize,glType,bytes,normalized,location}], indexed, pages: [] }
		this.records = new WeakMap(); // geometry -> [record per (kind, needs) slot] (page === null: not eligible for this layout version)
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
	ensure(geometry, kind = KIND_TRIANGLES, needs = 0) {
		const drawRange = geometry.drawRange;
		if (drawRange.start !== 0 || drawRange.count !== Infinity) return null; // honoured by the regular path; checked every frame
		let recs = this.records.get(geometry);
		if (recs === undefined) { recs = new Array(SLOT_COUNT).fill(undefined); this.records.set(geometry, recs); }
		const slot = slotOf(kind, needs);
		let rec = recs[slot];
		if (rec !== undefined) {
			if (rec.layoutVersion === geometry._layoutVersion) {
				if (rec.page === null) return null;
				if (rec.dynamic === true) { // keeps changing: leave the pages (this frame's draw already used the page copy)
					this._free(rec);
					recs[slot] = NO_PAGE_RECORD(geometry._layoutVersion);
					return null;
				}
				const position = geometry.attributes.position, index = geometry.index;
				// a program linked after the page layout was made may have registered a name this geometry also carries
				const known = customAttributeCount();
				const stale = rec.registered !== known && (rec.registered = known, this._missesCustomAttribute(rec, geometry));
				if (!stale && position.count === rec.vertexCount) {
					if (kind >= KIND_LINE_STRIP && kind <= KIND_LINE_SEGMENTS) { if (this._indexCountOf(geometry, kind) === rec.indexCount) return rec; }
					else if (rec.indexed ? index !== null && index.count === rec.indexCount : index === null) return rec;
				}
			}
			this._free(rec); // layout changed or an array was replaced by one of another size: reallocate once
		}
		rec = this._allocate(geometry, kind, needs);
		recs[slot] = rec;
		if (rec.page !== null && !recs.listening) { recs.listening = true; geometry.addEventListener('dispose', this._onGeometryDispose); }
		return rec.page !== null ? rec : null;
	}

	/** `ensure` for a slot number (see slotOf). */
	ensureSlot(geometry, slot) { return this.ensure(geometry, slot === 0 ? KIND_TRIANGLES : slot >> 3, slot & 7); }

	_missesCustomAttribute(rec, geometry) {
		const names = rec.layout.customNames;
		for (const name in geometry.attributes) {
			if (ATTRIBUTE_LOCATIONS[name] !== undefined || names.has(name)) continue;
			const location = customAttributeLocation(name);
			if (location >= 0 && location < this.maxAttributes) return true;
		}
		return false;
	}

	/** True when this record's page carries every custom attribute `program` reads, at the locations the program uses. */
	supports(rec, program) {
		if (!program.hasCustomAttributes) return true;
		if (rec.okProgram === program) return true;
		if (rec.badProgram === program) return false;
		let ok = program.customFixed;
		if (ok) {
			const list = program.customAttributes;
			for (let i = 0; i < list.length; i++) if (!rec.layout.customNames.has(list[i].name)) { ok = false; break; }
		}
		if (ok) rec.okProgram = program; else rec.badProgram = program;
		return ok;
	}

	/** Uploads what changed in `geometry` since the record was last synchronised (nothing, cheaply, when no attribute was touched). */
	sync(rec, geometry) {
		if (rec.epoch === attributeEpoch.value) return;
		this.queue(rec, geometry);
		this.flush();
		rec.epoch = attributeEpoch.value;
	}

	_onGeometryDispose(event) {
		const geometry = event.target;
		geometry.removeEventListener('dispose', this._onGeometryDispose);
		const recs = this.records.get(geometry);
		if (recs) for (let k = 0; k < recs.length; k++) if (recs[k]) this._free(recs[k]);
		this.records.delete(geometry);
	}

	_free(rec) {
		const page = rec.page;
		if (page === null) return;
		page.vertexAlloc.release(rec.baseVertex, rec.vertexCount);
		page.indexAlloc.release(rec.indexStart, rec.indexCount);
		rec.page = null;
	}

	_layoutOf(geometry, kind, needs) {
		const attributes = geometry.attributes;
		if (attributes.position === undefined || attributes.position.isInterleavedBufferAttribute) return null;
		const list = [];
		for (const name in attributes) {
			let location = ATTRIBUTE_LOCATIONS[name];
			if (location !== undefined && !wanted(name, kind, needs)) continue;
			const custom = location === undefined;
			if (custom) { location = customAttributeLocation(name); if (location < 0 || location >= this.maxAttributes) continue; }
			const a = attributes[name];
			// a custom attribute that cannot be packed is left out (a program that reads it is then drawn the regular way, see supports())
			if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute || a.onUploadCallback !== NO_HOOK || a.isFloat16BufferAttribute === true) { if (custom) continue; return null; }
			const glType = glTypeOf(this.gl, a.array);
			const integerType = glType === this.gl.INT || glType === this.gl.UNSIGNED_INT;
			if (glType === 0 || (a.gpuType === 1013 && !integerType) || a.count !== attributes.position.count) { if (custom) continue; return null; }
			list.push({ name, itemSize: a.itemSize, glType, bytes: a.array.BYTES_PER_ELEMENT, normalized: a.normalized === true, location });
		}
		list.sort((x, y) => x.location - y.location);
		if (geometry.index !== null && geometry.index.onUploadCallback !== NO_HOOK) return null;
		const indexed = geometry.index !== null || kind === KIND_LINE_STRIP || kind === KIND_LINE_LOOP || kind === KIND_LINE_SEGMENTS;
		const signature = list.map((a) => `${a.name}:${a.itemSize}:${a.glType}:${a.normalized ? 1 : 0}`).join('|') + (indexed ? '|i' : '');
		let layout = this.layouts.get(signature);
		if (layout === undefined) { layout = { signature, attributes: list, indexed, pages: [], customNames: new Set() }; for (const a of list) if (ATTRIBUTE_LOCATIONS[a.name] === undefined) layout.customNames.add(a.name); this.layouts.set(signature, layout); }
		return layout;
	}

	/** Number of indices a record of `kind` needs (0 when the geometry cannot be drawn as that kind). */
	_indexCountOf(geometry, kind) {
		const m = geometry.index !== null ? geometry.index.count : geometry.attributes.position.count;
		switch (kind) {
			case KIND_LINE_STRIP: return m >= 2 ? 2 * (m - 1) : 0;
			case KIND_LINE_LOOP: return m >= 2 ? 2 * m : 0;
			case KIND_LINE_SEGMENTS: return m & ~1;
			default: return geometry.index !== null ? m : 0;
		}
	}

	_allocate(geometry, kind, needs) {
		if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) return NO_PAGE_RECORD(geometry._layoutVersion);
		if (geometry.attributes.position === undefined || geometry.attributes.position.count > MAX_VERTICES) return NO_PAGE_RECORD(geometry._layoutVersion);
		const layout = this._layoutOf(geometry, kind, needs);
		if (layout === null) return NO_PAGE_RECORD(geometry._layoutVersion);
		const vertexCount = geometry.attributes.position.count;
		const indexCount = layout.indexed ? this._indexCountOf(geometry, kind) : 0;
		if (vertexCount === 0 || (layout.indexed && indexCount === 0)) return NO_PAGE_RECORD(geometry._layoutVersion);
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
			layout.pages.push(page); this.pages.push(page);
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
			kind, slot: slotOf(kind, needs), mode: kind === KIND_TRIANGLES ? this.gl.TRIANGLES : kind === KIND_POINTS ? this.gl.POINTS : this.gl.LINES,
			epoch: -1, okProgram: null, badProgram: null, registered: customAttributeCount(), counted: false,
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
		if (rec.indexed && rec.kind >= KIND_LINE_STRIP && rec.kind <= KIND_LINE_SEGMENTS) {
			// strips / loops / segments are expanded to LINES pairs; rebuilt whenever the source index (or nothing, for a non-indexed geometry) changes
			const index = geometry.index, version = index !== null ? index.version : 0;
			if (rec.indexVersion !== version) {
				if (rec.indexVersion !== -1) reupload = true;
				rec.indexVersion = version;
				this._lineIndexSegment(page, rec, geometry);
				if (index !== null) {
					if (index.updateRanges.length !== 0) { index.clearUpdateRanges(); index._uploadSeq++; }
					rec.indexSeq = index._uploadSeq;
					if (index.onUploadCallback !== NO_HOOK) this._notify.push(index);
				}
			}
		} else if (rec.indexed) {
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

	/** Stage the expanded LINES index list of a line record (indices rebased to the page). */
	_lineIndexSegment(page, rec, geometry) {
		const count = rec.indexCount, offset = this._idxStageN;
		if (offset + count > this._idxStage.length) {
			const grown = new Uint32Array(Math.max(offset + count, this._idxStage.length * 2));
			grown.set(this._idxStage.subarray(0, offset));
			this._idxStage = grown;
		}
		const dst = this._idxStage, base = rec.baseVertex, index = geometry.index, src = index !== null ? index.array : null;
		const m = src !== null ? index.count : rec.vertexCount;
		switch (rec.kind) {
			case KIND_LINE_STRIP: case KIND_LINE_LOOP: {
				let k = offset;
				for (let i = 0; i < m - 1; i++) { dst[k++] = (src !== null ? src[i] : i) + base; dst[k++] = (src !== null ? src[i + 1] : i + 1) + base; }
				if (rec.kind === KIND_LINE_LOOP) { dst[k++] = (src !== null ? src[m - 1] : m - 1) + base; dst[k++] = (src !== null ? src[0] : 0) + base; }
				break;
			}
			default:
				for (let k = 0; k < count; k++) dst[offset + k] = (src !== null ? src[k] : k) + base;
		}
		this._idxStageN = offset + count;
		this._segment(page.indexBuffer, page.indexBufferId, rec.indexStart * 4, null, offset, count, 4);
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

	/** Once per frame (outermost render call): deletes pages that have held no geometry for EMPTY_PAGE_GRACE_FRAMES frames. */
	sweep(frame) {
		const pages = this.pages;
		for (let i = pages.length - 1; i >= 0; i--) {
			const page = pages[i];
			if (!page.isEmpty()) { page.emptySince = -1; continue; }
			if (page.emptySince < 0) { page.emptySince = frame; continue; }
			if (frame - page.emptySince < EMPTY_PAGE_GRACE_FRAMES) continue;
			const list = page.layout.pages, at = list.indexOf(page);
			if (at !== -1) list.splice(at, 1);
			pages.splice(i, 1);
			page.dispose();
			if (this.state.currentVAO !== null) { this.gl.bindVertexArray(null); this.state.currentVAO = null; }
			this.state.currentArrayBuffer = null;
		}
	}

	dispose() {
		for (const layout of this.layouts.values()) for (const p of layout.pages) p.dispose();
		this.layouts.clear(); this.pages.length = 0;
		this.records = new WeakMap();
		this._segs.length = 0; this._notify.length = 0; this._idxStageN = 0;
	}
}

export { WebGLMegaBuffers, RangeAllocator };
