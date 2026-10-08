/**
 * Mega-buffers: geometries that share an attribute layout are sub-allocated into large shared
 * vertex/index buffers ("pages"), one VAO per page. A run of draws with the same material but
 * DIFFERENT geometries can then be issued as a single multiDrawElementsWEBGL call, with each
 * sub-draw reading its object matrix from a per-frame matrix texture via gl_DrawID.
 *
 * Only attributes with fixed locations (position, normal, uv, color, uv1) are packed; indices are
 * rebased to the page's vertex base at upload time (no base-vertex extension needed).
 */
import { ATTRIBUTE_LOCATIONS } from './WebGLBindingStates.js';

const PAGE_VERTICES = 1 << 18; // 262,144 vertices per page per layout
const PAGE_INDEX_RATIO = 4;
// Geometries larger than this are drawn on their own: a multi-draw run gains nothing from a huge sub-draw
// and a private copy of a million-vertex buffer would double its GPU memory.
const MAX_VERTICES = 1 << 16;

/** What a record draws as. Strips, loops and segments of a Line are expanded to indexed LINES so any mix shares one multi-draw. */
export const KIND_TRIANGLES = 0, KIND_LINE_STRIP = 1, KIND_LINE_LOOP = 2, KIND_LINE_SEGMENTS = 3, KIND_POINTS = 4;
const KIND_COUNT = 5;

/** Lines / points / sprites page only the attributes their material reads: position plus `needs` (bit 0 colour, 1 lineDistance, 2 uv). Meshes page everything with a fixed location. */
function wanted(name, kind, needs) {
	if (kind === KIND_TRIANGLES) return true;
	return name === 'position' || (name === 'color' && (needs & 1) !== 0) || (name === 'lineDistance' && (needs & 2) !== 0) || (name === 'uv' && (needs & 4) !== 0);
}

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

class Page {
	constructor(gl, layout, capacity, indexCapacity) {
		this.gl = gl;
		this.layout = layout;
		this.capacity = capacity;
		this.indexCapacity = indexCapacity;
		this.usedVertices = 0;
		this.usedIndices = 0;
		this.buffers = {};
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

class WebGLMegaBuffers {
	constructor(gl, state, info) {
		this.gl = gl;
		this.state = state;
		this.info = info;
		this.layouts = new Map(); // signature -> { signature, attributes:[{name,itemSize,glType,bytes,normalized,location}], indexed, pages: [] }
		this.records = new WeakMap(); // geometry -> [record per kind] (undefined = not tried yet, null = not eligible)
		this._scratchIndex = new Uint32Array(1 << 16);
		this._onGeometryDispose = this._onGeometryDispose.bind(this);
	}

	/** Returns the allocation record for a geometry drawn as `kind` (allocating/updating as needed), or null if not eligible. */
	ensure(geometry, kind = KIND_TRIANGLES, needs = 0) {
		let recs = this.records.get(geometry);
		if (recs === undefined) {
			recs = new Array(KIND_COUNT * 8).fill(undefined);
			this.records.set(geometry, recs);
			geometry.addEventListener('dispose', this._onGeometryDispose);
		}
		const slot = kind === KIND_TRIANGLES ? 0 : kind * 8 + (needs & 7);
		let rec = recs[slot];
		if (rec !== undefined) {
			if (rec === null) return null;
			if (rec.layoutVersion === geometry._layoutVersion) {
				this._update(rec, geometry);
				return rec;
			}
			this._free(rec);
		}
		rec = this._allocate(geometry, kind, needs);
		recs[slot] = rec;
		return rec;
	}

	_onGeometryDispose(event) {
		const geometry = event.target;
		geometry.removeEventListener('dispose', this._onGeometryDispose);
		const recs = this.records.get(geometry);
		if (recs) for (let k = 0; k < recs.length; k++) if (recs[k]) this._free(recs[k]);
		this.records.delete(geometry);
	}

	_free(rec) {
		// bump allocation: the hole is not reused (pages are cheap); nothing else to do
		rec.page = null;
	}

	_layoutOf(geometry, kind, needs) {
		const attributes = geometry.attributes;
		if (attributes.position === undefined || attributes.position.isInterleavedBufferAttribute) return null;
		const list = [];
		for (const name in attributes) {
			const location = ATTRIBUTE_LOCATIONS[name];
			if (location === undefined || !wanted(name, kind, needs)) continue;
			const a = attributes[name];
			if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute) return null;
			const glType = glTypeOf(this.gl, a.array);
			if (glType === 0) return null;
			if (a.count !== attributes.position.count) return null;
			list.push({ name, itemSize: a.itemSize, glType, bytes: a.array.BYTES_PER_ELEMENT, normalized: a.normalized === true, location });
		}
		list.sort((x, y) => x.location - y.location);
		const indexed = geometry.index !== null || kind !== KIND_TRIANGLES && kind !== KIND_POINTS;
		const signature = list.map((a) => `${a.name}:${a.itemSize}:${a.glType}:${a.normalized ? 1 : 0}`).join('|') + (indexed ? '|i' : '');
		let layout = this.layouts.get(signature);
		if (layout === undefined) { layout = { signature, attributes: list, indexed, pages: [] }; this.layouts.set(signature, layout); }
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
		// groups only matter for material arrays, which never reach the batch path; drawRange must be the whole geometry
		if (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return null;
		if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) return null;
		if (geometry.attributes.position === undefined || geometry.attributes.position.count > MAX_VERTICES) return null;
		const layout = this._layoutOf(geometry, kind, needs);
		if (layout === null) return null;
		const vertexCount = geometry.attributes.position.count;
		const indexCount = layout.indexed ? this._indexCountOf(geometry, kind) : 0;
		if (vertexCount === 0 || (layout.indexed && indexCount === 0)) return null;
		let page = null;
		for (let i = 0; i < layout.pages.length; i++) {
			const p = layout.pages[i];
			if (p.capacity - p.usedVertices >= vertexCount && p.indexCapacity - p.usedIndices >= indexCount) { page = p; break; }
		}
		if (page === null) {
			const cap = Math.max(PAGE_VERTICES, vertexCount), icap = Math.max(PAGE_VERTICES * PAGE_INDEX_RATIO, indexCount);
			page = new Page(this.gl, layout, cap, icap);
			layout.pages.push(page);
			this.state.currentVAO = null; // Page constructor rebinds VAO
			this.state.currentArrayBuffer = null;
		}
		const rec = {
			page, layout, baseVertex: page.usedVertices, vertexCount, indexStart: page.usedIndices, indexCount,
			byteOffset: page.usedIndices * 4, versions: {}, indexVersion: -1, layoutVersion: geometry._layoutVersion, indexed: layout.indexed,
			kind, mode: kind === KIND_TRIANGLES ? this.gl.TRIANGLES : kind === KIND_POINTS ? this.gl.POINTS : this.gl.LINES,
		};
		page.usedVertices += vertexCount;
		page.usedIndices += indexCount;
		this._update(rec, geometry, true);
		return rec;
	}

	_update(rec, geometry, force = false) {
		const gl = this.gl, page = rec.page, layout = rec.layout;
		const attributes = geometry.attributes;
		for (let i = 0; i < layout.attributes.length; i++) {
			const a = layout.attributes[i];
			const attribute = attributes[a.name];
			if (attribute === undefined) continue;
			if (force || rec.versions[a.name] !== attribute.version) {
				if (attribute.count !== rec.vertexCount) { rec.layoutVersion = -1; return; } // size changed: reallocate next time
				gl.bindBuffer(gl.ARRAY_BUFFER, page.buffers[a.name]);
				gl.bufferSubData(gl.ARRAY_BUFFER, rec.baseVertex * a.itemSize * a.bytes, attribute.array, 0, rec.vertexCount * a.itemSize);
				this.state.currentArrayBuffer = null;
				rec.versions[a.name] = attribute.version;
			}
		}
		if (rec.indexed) {
			const index = geometry.index;
			const version = index !== null ? index.version : 0;
			if (force || rec.indexVersion !== version) {
				if (this._indexCountOf(geometry, rec.kind) !== rec.indexCount) { rec.layoutVersion = -1; return; }
				if (this._scratchIndex.length < rec.indexCount) this._scratchIndex = new Uint32Array(Math.max(rec.indexCount, this._scratchIndex.length * 2));
				this._fillIndices(geometry, rec, this._scratchIndex);
				// the element buffer is VAO state: bind this page's VAO while uploading
				this.state.bindVertexArray(page.vao);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, page.indexBuffer);
				gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, rec.indexStart * 4, this._scratchIndex, 0, rec.indexCount);
				rec.indexVersion = version;
			}
		}
	}

	/** Write the record's indices (rebased to the page) into `dst`. Lines become independent LINES pairs. */
	_fillIndices(geometry, rec, dst) {
		const base = rec.baseVertex, index = geometry.index, src = index !== null ? index.array : null;
		const m = src !== null ? index.count : rec.vertexCount;
		switch (rec.kind) {
			case KIND_LINE_STRIP: case KIND_LINE_LOOP: {
				let k = 0;
				for (let i = 0; i < m - 1; i++) { dst[k++] = (src !== null ? src[i] : i) + base; dst[k++] = (src !== null ? src[i + 1] : i + 1) + base; }
				if (rec.kind === KIND_LINE_LOOP) { dst[k++] = (src !== null ? src[m - 1] : m - 1) + base; dst[k++] = (src !== null ? src[0] : 0) + base; }
				break;
			}
			case KIND_LINE_SEGMENTS:
				for (let k = 0, l = rec.indexCount; k < l; k++) dst[k] = (src !== null ? src[k] : k) + base;
				break;
			default:
				for (let k = 0; k < rec.indexCount; k++) dst[k] = src[k] + base;
		}
	}

	dispose() {
		for (const layout of this.layouts.values()) for (const p of layout.pages) p.dispose();
		this.layouts.clear();
		this.records = new WeakMap();
	}
}

export { WebGLMegaBuffers };
