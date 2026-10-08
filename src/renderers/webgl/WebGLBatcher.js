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
import { Matrix4 } from '../../math/Matrix4.js';
import { Matrix3 } from '../../math/Matrix3.js';

const TEX_STRIDE_FLOATS = TEXELS_PER_OBJECT * 4; // model matrix (4 texels) + normal matrix columns (3 texels) + spare
const MATRICES_PER_ROW = MATRIX_TEXTURE_WIDTH / TEXELS_PER_OBJECT;
// scratch for view-space entries: Float32Array-backed like Object3D.modelViewMatrix, so the arithmetic matches the per-object path bit for bit
const _mv = new Matrix4();
const _nm = new Matrix3();

/**
 * One GPU copy of the matrix texture. Every render list keeps its own slot (see WebGLRenderer._drawList), so the
 * matrices of a list that did not change stay on the GPU while other lists (the transparent list, other passes)
 * draw through the batcher, and the list's draw commands can be replayed without a fill or an upload.
 */
class MatrixTextureSlot {
	constructor() { this.texture = null; this.textureRows = 0; this.textureHash = 0; this.textureCount = 0; }
}

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		// matrix texture: RGBA32F, TEXELS_PER_OBJECT texels per entry (world matrix + normal matrix, or for ShaderMaterial
		// batches that read modelViewMatrix / normalMatrix the view-space pair), rows of MATRICES_PER_ROW entries.
		// textureRows is the height the texture was last (re)defined with; see uploadTexture for why it is redefined per upload.
		this.defaultSlot = new MatrixTextureSlot();
		this.slot = this.defaultSlot;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.texCount = 0; this.texHash = 0;
		this.viewDependent = false; // some entry of the current fill holds view-space matrices (depends on the camera)
		this._viewBits = new Float32Array(16); this._viewBitsU = new Uint32Array(this._viewBits.buffer);
	}
	get texture() { return this.slot.texture; }
	get textureHash() { return this.slot.textureHash; }
	get textureCount() { return this.slot.textureCount; }
	/** Selects the GPU texture the next fill is uploaded to (`null` = the shared default slot). */
	use(slot) { this.slot = slot === null ? this.defaultSlot : slot; }
	newSlot() { return new MatrixTextureSlot(); }
	begin() { this.texCount = 0; this.texHash = 0x811c9dc5 | 0; this.viewDependent = false; }
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
	/**
	 * Append an object's world matrix and (CPU-cached) normal matrix; `materialIndex` (index of the
	 * object's material record inside the Materials window bound for its batch, 0 when the batch
	 * is single-material) goes into the spare eighth texel. Returns the object's index in the texture.
	 */
	addTex(object, materialIndex) {
		const d = this.texData, o = this.texCount * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = object._worldVersion; }
		const no = object._slabOffset + 32;
		d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
		d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
		d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
		d[o + 28] = materialIndex; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
		// FNV-1a style mix of id, world version and material index: unchanged hash -> the upload is skipped
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		h = Math.imul(h ^ materialIndex, 16777619);
		this.texHash = h;
		return this.texCount++;
	}
	/**
	 * Append an object's entry for a ShaderMaterial batch that reads `modelViewMatrix` / `normalMatrix`: the
	 * model-view matrix and its normal matrix, computed exactly as the per-object uniform path computes them
	 * (ShaderMaterialBatching.js LAYOUT_VIEW). With `both`, the world entry (`addTex`) follows (LAYOUT_BOTH).
	 * Call `mixView(camera)` once per run before: the hash must change with the camera.
	 */
	addTexView(object, camera, both) {
		const d = this.texData, o = this.texCount * TEX_STRIDE_FLOATS;
		_mv.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
		_nm.getNormalMatrix(_mv);
		const me = _mv.elements, ne = _nm.elements;
		for (let i = 0; i < 16; i++) d[o + i] = me[i];
		d[o + 16] = ne[0]; d[o + 17] = ne[1]; d[o + 18] = ne[2]; d[o + 19] = 0;
		d[o + 20] = ne[3]; d[o + 21] = ne[4]; d[o + 22] = ne[5]; d[o + 23] = 0;
		d[o + 24] = ne[6]; d[o + 25] = ne[7]; d[o + 26] = ne[8]; d[o + 27] = 0;
		d[o + 28] = 0; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		this.texHash = h;
		const index = this.texCount++;
		if (both) this.addTex(object, 0);
		return index;
	}
	/** Mixes the camera's view matrix (and the entry layout) into the hash of a run of view-space entries. */
	mixView(camera, both) {
		this.viewDependent = true;
		const f = this._viewBits, u = this._viewBitsU, e = camera.matrixWorldInverse.elements;
		for (let i = 0; i < 16; i++) f[i] = e[i];
		let h = Math.imul(this.texHash ^ (both ? 0x5a5a : 0xa5a5), 16777619);
		for (let i = 0; i < 16; i++) h = Math.imul(h ^ u[i], 16777619);
		this.texHash = h;
	}
	/**
	 * Upload the frame's matrices into the matrix texture (unit `unit`) if they changed. The texture stays bound to `unit`.
	 *
	 * The upload is a full `texImage2D` (re)definition rather than a `texSubImage2D` into immutable storage, on purpose.
	 * In Chromium, `texSubImage2D` with client data always goes through the command buffer's ring "transfer buffer"
	 * (64 KB minimum, resized by a heuristic) and an upload that does not fit is split into row chunks, each of which
	 * waits for the GPU process to release the previous chunk (TexSubImage2DImpl -> RingBuffer::Alloc -> WaitForToken).
	 * With a megabyte of matrices per frame that path degrades after a while into a multi-second stall followed by
	 * ~150 ms per upload. `texImage2D` instead falls back to mapped shared memory for uploads larger than the transfer
	 * buffer and sends them in one piece, so the same bytes cost the same as before and never block.
	 * Redefining the level with an unchanged size and format measured no more expensive per frame than the
	 * sub-image update it replaces (same median); the driver only reallocates when the row count changes.
	 */
	uploadTexture(state, unit) {
		const gl = this.gl, slot = this.slot;
		const rows = Math.max(1, Math.ceil(this.texCount / MATRICES_PER_ROW));
		if (slot.texture === null) {
			slot.texture = gl.createTexture();
			state.bindTexture(gl.TEXTURE_2D, slot.texture, unit);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			slot.textureRows = 0; slot.textureHash = 0;
		} else {
			state.bindTexture(gl.TEXTURE_2D, slot.texture, unit);
		}
		state.activeTexture(unit); // texSubImage2D targets the ACTIVE unit: a cached binding alone does not select it
		if (this.texCount === 0) return;
		if (slot.textureHash === this.texHash && slot.textureCount === this.texCount) return;
		// texImage2D targets the *active* unit: when the cached bind above was a no-op (the texture was
		// already on `unit`) the active unit may still be the one a material texture was uploaded to
		state.activeTexture(unit);
		state.setUnpack(false, false, 4);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MATRIX_TEXTURE_WIDTH, rows, 0, gl.RGBA, gl.FLOAT, this.texData, 0);
		slot.textureRows = rows; slot.textureHash = this.texHash; slot.textureCount = this.texCount;
	}
	disposeSlot(slot) { if (slot.texture !== null) { this.gl.deleteTexture(slot.texture); slot.texture = null; slot.textureHash = 0; slot.textureCount = 0; } }
	dispose() { this.disposeSlot(this.defaultSlot); }
}

export { WebGLBatcher };
