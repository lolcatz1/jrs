/**
 * Automatic draw-call batching.
 *
 * After sorting, consecutive render items that share geometry, material and
 * program are drawn with ONE instanced draw call: their world matrices are
 * copied out of the transform slab into a per-frame instance buffer. For a
 * static scene the buffer content is unchanged frame to frame and the upload
 * is skipped entirely (the frame hash covers object identity and
 * _worldVersion of every batched object).
 */
import { MATRIX_TEXTURE_WIDTH, TEXELS_PER_OBJECT } from '../shaders/ShaderLib.js';
import { computeNormalMatrix } from '../../core/TransformSlab.js';

export const INSTANCE_STRIDE_FLOATS = 16;
const TEX_STRIDE_FLOATS = TEXELS_PER_OBJECT * 4; // model matrix (4 texels) + normal matrix columns (3 texels) + spare
const MATRICES_PER_ROW = MATRIX_TEXTURE_WIDTH / TEXELS_PER_OBJECT;
export const INSTANCE_STRIDE_BYTES = INSTANCE_STRIDE_FLOATS * 4;

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		this.buffer = gl.createBuffer();
		this.capacity = 1024; // instances (a multiple of MATRICES_PER_ROW)
		this.data = new Float32Array(this.capacity * INSTANCE_STRIDE_FLOATS);
		this.count = 0;
		this.lastHash = 0;
		this.hash = 0;
		this.uploadedBytes = 0;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
		// matrix texture for multi-draw: RGBA32F, 4 texels per matrix, rows of MATRICES_PER_ROW matrices
		this.texture = null; this.textureRows = 0; this.textureHash = 0; this.textureCount = 0;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.texCount = 0; this.texHash = 0;
	}
	ensureTex(extra) {
		if (this.texCount + extra > this.texCapacity) {
			let cap = this.texCapacity;
			while (cap < this.texCount + extra) cap *= 2;
			cap = Math.ceil(cap / MATRICES_PER_ROW) * MATRICES_PER_ROW;
			const nd = new Float32Array(cap * TEX_STRIDE_FLOATS);
			nd.set(this.texData);
			this.texData = nd; this.texCapacity = cap;
		}
	}
	/** Append an object's world matrix and (CPU-cached) normal matrix for the multi-draw matrix texture. */
	addTex(object) {
		const d = this.texData, o = this.texCount * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = object._worldVersion; }
		const no = object._slabOffset + 32;
		d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
		d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
		d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		this.texHash = h;
		return this.texCount++;
	}
	/** Upload the frame's matrices into the matrix texture (unit `unit`) if they changed. The texture stays bound to `unit`. */
	uploadTexture(state, unit) {
		const gl = this.gl;
		const rows = Math.max(1, Math.ceil(this.texCount / MATRICES_PER_ROW));
		if (this.texture === null || rows > this.textureRows) {
			if (this.texture !== null) gl.deleteTexture(this.texture);
			this.texture = gl.createTexture();
			let allocRows = 1; while (allocRows < rows) allocRows *= 2;
			state.bindTexture(gl.TEXTURE_2D, this.texture, unit);
			gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, MATRIX_TEXTURE_WIDTH, allocRows);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			this.textureRows = allocRows;
			this.textureHash = 0;
		} else {
			state.bindTexture(gl.TEXTURE_2D, this.texture, unit);
		}
		if (this.texCount === 0) return;
		if (this.textureHash === this.texHash && this.textureCount === this.texCount) return;
		// texData capacity is a multiple of a full row (see ensureTex), so whole rows can be uploaded
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MATRIX_TEXTURE_WIDTH, rows, gl.RGBA, gl.FLOAT, this.texData, 0);
		this.textureHash = this.texHash; this.textureCount = this.texCount;
	}
	begin() { this.count = 0; this.hash = 0x811c9dc5 | 0; this.texCount = 0; this.texHash = 0x811c9dc5 | 0; }
	ensure(extra) {
		if (this.count + extra > this.capacity) {
			let cap = this.capacity;
			while (cap < this.count + extra) cap *= 2;
			cap = Math.ceil(cap / MATRICES_PER_ROW) * MATRICES_PER_ROW;
			const nd = new Float32Array(cap * INSTANCE_STRIDE_FLOATS);
			nd.set(this.data);
			this.data = nd; this.capacity = cap;
			this.bufferDirty = true;
		}
	}
	/** Append one object's world matrix. Returns the instance index. */
	add(object) {
		const d = this.data, o = this.count * INSTANCE_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		d[o] = s[so]; d[o + 1] = s[so + 1]; d[o + 2] = s[so + 2]; d[o + 3] = s[so + 3];
		d[o + 4] = s[so + 4]; d[o + 5] = s[so + 5]; d[o + 6] = s[so + 6]; d[o + 7] = s[so + 7];
		d[o + 8] = s[so + 8]; d[o + 9] = s[so + 9]; d[o + 10] = s[so + 10]; d[o + 11] = s[so + 11];
		d[o + 12] = s[so + 12]; d[o + 13] = s[so + 13]; d[o + 14] = s[so + 14]; d[o + 15] = s[so + 15];
		// FNV-1a style mix of id and world version
		let h = this.hash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		this.hash = h;
		return this.count++;
	}
	/** Upload the frame's instance data if it changed. */
	upload() {
		const gl = this.gl;
		if (this.count === 0) return;
		const bytes = this.count * INSTANCE_STRIDE_BYTES;
		if (this.bufferDirty === true) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
			gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_STRIDE_FLOATS);
			this.bufferDirty = false;
			this.lastHash = this.hash; this.uploadedBytes = bytes;
			return true;
		}
		if (this.hash !== this.lastHash || bytes !== this.uploadedBytes) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_STRIDE_FLOATS);
			this.lastHash = this.hash; this.uploadedBytes = bytes;
			return true;
		}
		return false;
	}
	dispose() { this.gl.deleteBuffer(this.buffer); if (this.texture !== null) this.gl.deleteTexture(this.texture); }
}

export { WebGLBatcher };
