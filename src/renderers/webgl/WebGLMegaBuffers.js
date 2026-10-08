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
		this.records = new WeakMap(); // geometry -> allocation record
		this._scratchIndex = new Uint32Array(1 << 16);
		this._onGeometryDispose = this._onGeometryDispose.bind(this);
	}

	/** Returns the allocation record for a geometry (allocating/updating as needed), or null if not eligible. */
	ensure(geometry) {
		let rec = this.records.get(geometry);
		if (rec !== undefined) {
			if (rec === null) return null;
			if (rec.layoutVersion === geometry._layoutVersion) {
				this._update(rec, geometry);
				return rec;
			}
			this._free(rec);
			this.records.delete(geometry);
		}
		rec = this._allocate(geometry);
		this.records.set(geometry, rec);
		if (rec !== null) geometry.addEventListener('dispose', this._onGeometryDispose);
		return rec;
	}

	_onGeometryDispose(event) {
		const geometry = event.target;
		geometry.removeEventListener('dispose', this._onGeometryDispose);
		const rec = this.records.get(geometry);
		if (rec) this._free(rec);
		this.records.delete(geometry);
	}

	_free(rec) {
		// bump allocation: the hole is not reused (pages are cheap); nothing else to do
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
			if (a.isInterleavedBufferAttribute || a.isInstancedBufferAttribute) return null;
			const glType = glTypeOf(this.gl, a.array);
			if (glType === 0) return null;
			if (a.count !== attributes.position.count) return null;
			list.push({ name, itemSize: a.itemSize, glType, bytes: a.array.BYTES_PER_ELEMENT, normalized: a.normalized === true, location });
		}
		list.sort((x, y) => x.location - y.location);
		const indexed = geometry.index !== null;
		const signature = list.map((a) => `${a.name}:${a.itemSize}:${a.glType}:${a.normalized ? 1 : 0}`).join('|') + (indexed ? '|i' : '');
		let layout = this.layouts.get(signature);
		if (layout === undefined) { layout = { signature, attributes: list, indexed, pages: [] }; this.layouts.set(signature, layout); }
		return layout;
	}

	_allocate(geometry) {
		// groups only matter for material arrays, which never reach the batch path; drawRange must be the whole geometry
		if (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return null;
		if (geometry.morphAttributes && Object.keys(geometry.morphAttributes).length > 0) return null;
		const layout = this._layoutOf(geometry);
		if (layout === null) return null;
		const vertexCount = geometry.attributes.position.count;
		const indexCount = layout.indexed ? geometry.index.count : 0;
		if (vertexCount === 0) return null;
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
			if (force || rec.indexVersion !== index.version) {
				if (index.count !== rec.indexCount) { rec.layoutVersion = -1; return; }
				if (this._scratchIndex.length < rec.indexCount) this._scratchIndex = new Uint32Array(Math.max(rec.indexCount, this._scratchIndex.length * 2));
				const src = index.array, dst = this._scratchIndex, base = rec.baseVertex;
				for (let k = 0; k < rec.indexCount; k++) dst[k] = src[k] + base;
				// the element buffer is VAO state: bind this page's VAO while uploading
				this.state.bindVertexArray(page.vao);
				gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, page.indexBuffer);
				gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, rec.indexStart * 4, dst, 0, rec.indexCount);
				rec.indexVersion = index.version;
			}
		}
	}

	dispose() {
		for (const layout of this.layouts.values()) for (const p of layout.pages) p.dispose();
		this.layouts.clear();
		this.records = new WeakMap();
	}
}

export { WebGLMegaBuffers };
