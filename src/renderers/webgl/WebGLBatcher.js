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

const TEX_STRIDE_FLOATS = TEXELS_PER_OBJECT * 4; // model matrix (4 texels) + normal matrix columns (3 texels) + spare
const MATRICES_PER_ROW = MATRIX_TEXTURE_WIDTH / TEXELS_PER_OBJECT;

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		// matrix texture: RGBA32F, TEXELS_PER_OBJECT texels per object (world matrix + normal matrix), rows of MATRICES_PER_ROW objects
		this.texture = null; this.textureRows = 0; this.textureHash = 0; this.textureCount = 0;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.texCount = 0; this.texHash = 0;
	}
	begin() { this.texCount = 0; this.texHash = 0x811c9dc5 | 0; }
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
	/** Append an object's world matrix and (CPU-cached) normal matrix. Returns its index in the texture. */
	addTex(object) {
		const d = this.texData, o = this.texCount * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = object._worldVersion; }
		const no = object._slabOffset + 32;
		d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
		d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
		d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
		// FNV-1a style mix of id and world version: unchanged hash -> the upload is skipped
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
		state.activeTexture(unit); // texSubImage2D targets the ACTIVE unit: a cached binding alone does not select it
		if (this.texCount === 0) return;
		if (this.textureHash === this.texHash && this.textureCount === this.texCount) return;
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MATRIX_TEXTURE_WIDTH, rows, gl.RGBA, gl.FLOAT, this.texData, 0);
		this.textureHash = this.texHash; this.textureCount = this.texCount;
	}
	dispose() { if (this.texture !== null) this.gl.deleteTexture(this.texture); }
}

export { WebGLBatcher };
