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
const ROW_FLOATS = MATRIX_TEXTURE_WIDTH * 4;
const MERGE_GAP_ROWS = 2; // dirty runs separated by at most this many clean rows are uploaded as one call

/**
 * Matrix texture bookkeeping. Position `p` of the frame's draw stream (every batched draw list of
 * a frame appends to one stream, so the opaque, transparent and shadow lists keep their own
 * positions) owns eight texels. A CPU mirror (`texData`) remembers which (object id, _worldVersion)
 * it holds at each position: an object that is still at the same position with the same version is
 * not rewritten, and a row of the texture is only uploaded when some position in it changed since
 * that texture was last written. Positions stay contiguous per batch, so `drawBase + gl_InstanceID`
 * addressing in the shader is unchanged.
 */
class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		this.doubleBuffer = false; // alternate two textures per frame so a texture still in flight is not rewritten
		this.textures = [{ tex: null, rows: 0, gen: -1 }, { tex: null, rows: 0, gen: -1 }];
		this.current = 0;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.posId = new Int32Array(this.texCapacity).fill(-1);
		this.posVersion = new Float64Array(this.texCapacity);
		this.rowGen = new Float64Array(this.texCapacity / MATRICES_PER_ROW); // generation at which each row last changed
		this.gen = 1;
		this.texCount = 0; // next free stream position of the current frame
		this.stats = { bytesUploaded: 0, uploads: 0 };
	}
	get texture() { return this.textures[this.current].tex; }
	/** Start of a frame: the draw stream restarts at position 0 (and the second texture is used if double-buffered). */
	beginFrame() {
		this.texCount = 0;
		if (this.doubleBuffer) this.current ^= 1;
	}
	/** Start of one draw list. Positions keep advancing through the frame's stream. */
	begin() { this.gen++; }
	ensureTex(extra) {
		if (this.texCount + extra > this.texCapacity) {
			let cap = this.texCapacity;
			while (cap < this.texCount + extra) cap *= 2;
			const nd = new Float32Array(cap * TEX_STRIDE_FLOATS);
			nd.set(this.texData);
			this.texData = nd;
			const ni = new Int32Array(cap).fill(-1); ni.set(this.posId); this.posId = ni;
			const nv = new Float64Array(cap); nv.set(this.posVersion); this.posVersion = nv;
			const nr = new Float64Array(cap / MATRICES_PER_ROW); nr.set(this.rowGen); this.rowGen = nr;
			this.texCapacity = cap;
		}
	}
	/** Place an object's world matrix and (CPU-cached) normal matrix at the next stream position; returns the position. */
	addTex(object) {
		const p = this.texCount++;
		const id = object.id, version = object._worldVersion;
		const posId = this.posId, posVersion = this.posVersion;
		if (posId[p] === id && posVersion[p] === version) return p;
		posId[p] = id; posVersion[p] = version;
		this.rowGen[(p / MATRICES_PER_ROW) | 0] = this.gen;
		const d = this.texData, o = p * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		if (object._normalVersion !== version) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = version; }
		const no = object._slabOffset + 32;
		d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
		d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
		d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
		return p;
	}
	/** Upload the rows that changed since the current texture was last written (unit `unit`). The texture stays bound to `unit`. */
	uploadTexture(state, unit) {
		const gl = this.gl;
		const t = this.textures[this.current];
		const rows = Math.max(1, Math.ceil(this.texCount / MATRICES_PER_ROW));
		if (t.tex === null || rows > t.rows) {
			if (t.tex !== null) gl.deleteTexture(t.tex);
			t.tex = gl.createTexture();
			let allocRows = 1; while (allocRows < rows) allocRows *= 2;
			state.bindTexture(gl.TEXTURE_2D, t.tex, unit);
			gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, MATRIX_TEXTURE_WIDTH, allocRows);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			t.rows = allocRows;
			t.gen = -1; // fresh storage: every row is dirty
		} else {
			state.bindTexture(gl.TEXTURE_2D, t.tex, unit);
		}
		if (this.texCount === 0) return;
		const rowGen = this.rowGen, since = t.gen;
		let uploaded = false;
		for (let r = 0; r < rows;) {
			if (rowGen[r] <= since) { r++; continue; }
			let end = r + 1, gap = 0;
			for (let q = end; q < rows && gap <= MERGE_GAP_ROWS; q++) { if (rowGen[q] > since) { end = q + 1; gap = 0; } else gap++; }
			if (!uploaded) { gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); uploaded = true; }
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, r, MATRIX_TEXTURE_WIDTH, end - r, gl.RGBA, gl.FLOAT, this.texData, r * ROW_FLOATS);
			this.stats.bytesUploaded += (end - r) * ROW_FLOATS * 4; this.stats.uploads++;
			r = end;
		}
		t.gen = this.gen;
	}
	dispose() { for (const t of this.textures) if (t.tex !== null) { this.gl.deleteTexture(t.tex); t.tex = null; t.rows = 0; t.gen = -1; } }
}

export { WebGLBatcher };
