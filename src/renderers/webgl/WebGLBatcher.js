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
import { LiveSet } from './LiveSet.js';
import { computeNormalMatrix } from '../../core/TransformSlab.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Matrix3 } from '../../math/Matrix3.js';

const TEX_STRIDE_FLOATS = TEXELS_PER_OBJECT * 4; // model matrix (4 texels) + normal matrix columns (3 texels) + spare
const MATRICES_PER_ROW = MATRIX_TEXTURE_WIDTH / TEXELS_PER_OBJECT;
// scratch for view-space entries: Float32Array-backed like Object3D.modelViewMatrix, so the arithmetic matches the per-object path bit for bit
const _f32 = new Float32Array(10), _i32 = new Int32Array(_f32.buffer);
const _mv = new Matrix4();
const _nm = new Matrix3();

/**
 * One GPU copy of the matrix texture. Every render list keeps its own slot (see WebGLRenderer._drawList), so the
 * matrices of a list that did not change stay on the GPU while other lists (the transparent list, other passes)
 * draw through the batcher, and the list's draw commands can be replayed without a fill or an upload.
 */
class MatrixTextureSlot {
	// the GL texture lives in a box the slot's finalizer can reach without keeping the slot alive
	constructor() { this.box = { texture: null }; this.textureRows = 0; this.textureHash = 0; this.textureCount = 0; }
	get texture() { return this.box.texture; }
	set texture(value) { this.box.texture = value; }
}

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		// matrix texture: RGBA32F, TEXELS_PER_OBJECT texels per object (world matrix + normal matrix), rows of MATRICES_PER_ROW objects.
		// textureRows is the height the texture was last (re)defined with; see uploadTexture for why it is redefined per upload.
		this.defaultSlot = new MatrixTextureSlot();
		// slots belong to render lists, which are simply garbage collected with their scene: a slot's texture is deleted when the slot is,
		// or by dispose() for the ones still alive
		this.live = new LiveSet();
		this._disposed = false;
		this._registry = typeof FinalizationRegistry !== 'undefined' ? new FinalizationRegistry((box) => { if (box.texture !== null && !this._disposed) this.gl.deleteTexture(box.texture); box.texture = null; }) : null;
		this.slot = this.defaultSlot;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.texCount = 0; this.texHash = 0;
		// what each stream position of texData was last filled with: an object that did not move since (same id, same
		// _worldVersion, same material index) at the same position already has its 32 floats in place
		this.texIds = new Int32Array(this.texCapacity).fill(-1);
		this.texVersions = new Float64Array(this.texCapacity);
		this.pixelRatio = 1; this.pointScale = 1;
		this.viewDependent = false; // some entry of the current fill holds view-space matrices (depends on the camera)
		this._viewBits = new Float32Array(16); this._viewBitsU = new Uint32Array(this._viewBits.buffer);
	}
	get texture() { return this.slot.texture; }
	get textureHash() { return this.slot.textureHash; }
	get textureCount() { return this.slot.textureCount; }
	/** Selects the GPU texture the next fill is uploaded to (`null` = the shared default slot). */
	use(slot) { this.slot = slot === null ? this.defaultSlot : slot; }
	newSlot() {
		const slot = new MatrixTextureSlot();
		this.live.add(slot);
		if (this._registry !== null) this._registry.register(slot, slot.box);
		return slot;
	}
	/** `pixelRatio` and `height` (renderer drawing size in CSS pixels) feed the per-point size math of `addTexInstance`, as in three's refreshUniformsPoints. */
	begin(pixelRatio = 1, height = 1) { this.texCount = 0; this.texHash = 0x811c9dc5 | 0; this.viewDependent = false; this.pixelRatio = pixelRatio; this.pointScale = height * 0.5; }
	ensureTex(extra) {
		if (this.texCount + extra > this.texCapacity) {
			let cap = this.texCapacity;
			while (cap < this.texCount + extra) cap *= 2;
			cap = Math.ceil(cap / MATRICES_PER_ROW) * MATRICES_PER_ROW;
			const nd = new Float32Array(cap * TEX_STRIDE_FLOATS);
			nd.set(this.texData);
			this.texData = nd;
			const ids = new Int32Array(cap).fill(-1); ids.set(this.texIds); this.texIds = ids;
			const vers = new Float64Array(cap); vers.set(this.texVersions); this.texVersions = vers;
			this.texCapacity = cap;
		}
	}
	/**
	 * Append an object's world matrix and (CPU-cached) normal matrix; `materialIndex` (index of the
	 * object's material record inside the Materials window bound for its batch, 0 when the batch
	 * is single-material) goes into the spare eighth texel. Returns the object's index in the texture.
	 */
	addTex(object, materialIndex) {
		const p = this.texCount, id = object.id, version = object._worldVersion;
		const d = this.texData, o = p * TEX_STRIDE_FLOATS;
		if (this.texIds[p] !== id || this.texVersions[p] !== version || d[o + 28] !== materialIndex) {
			const s = object._slabData, so = object._slabOffset + 16;
			for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
			if (object._normalVersion !== version) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = version; }
			const no = object._slabOffset + 32;
			d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
			d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
			d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
			d[o + 28] = materialIndex; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
			this.texIds[p] = id; this.texVersions[p] = version;
		}
		// FNV-1a style mix of id, world version and material index: unchanged hash -> the upload is skipped
		let h = this.texHash;
		h = Math.imul(h ^ id, 16777619);
		h = Math.imul(h ^ version, 16777619);
		h = Math.imul(h ^ materialIndex, 16777619);
		this.texHash = h;
		this.texCount = p + 1;
		return p;
	}
	/**
	 * Append an object's entry for a ShaderMaterial batch that reads `modelViewMatrix` / `normalMatrix`: the
	 * model-view matrix and its normal matrix, computed exactly as the per-object uniform path computes them
	 * (ShaderMaterialBatching.js LAYOUT_VIEW). With `both`, the world entry (`addTex`) follows (LAYOUT_BOTH).
	 * Call `mixView(camera)` once per run before: the hash must change with the camera. The entry is always
	 * rewritten (it depends on the camera), and the position is marked so a later world entry there is too.
	 */
	/**
	 * Append a sprite, point cloud or line: its world matrix plus the values its material contributes per object
	 * (see INSTANCE_MATERIAL in the vertex shader). They have no normal matrix, so texels 4-5 carry colour + opacity and a
	 * kind-specific parameter block, and a sprite's anchor goes in texel 6. The values are mixed into the upload-skip hash.
	 */
	addTexInstance(object, material) {
		const p = this.texCount, d = this.texData, o = p * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		let n = 0;
		if (object.isSprite === true) {
			const c = object.center;
			d[o + 24] = c.x; d[o + 25] = c.y;
			_f32[8] = c.x; _f32[9] = c.y; n = 2;
			if (material.isSpriteMaterial === true) { // B: rotation, attenuation flag, -, alphaTest
				const color = material.color;
				d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
				d[o + 20] = material.rotation; d[o + 21] = material.sizeAttenuation === true ? 1 : 0; d[o + 22] = 0; d[o + 23] = material.alphaTest;
				n = 10;
			}
		} else if (object.isPoints === true && material.isPointsMaterial === true) { // B: size, height / 2 when attenuated, -, alphaTest
			const color = material.color;
			d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
			d[o + 20] = material.size * this.pixelRatio; d[o + 21] = material.sizeAttenuation === true ? this.pointScale : 0; d[o + 22] = 0; d[o + 23] = material.alphaTest;
			n = 8;
		} else if (object.isLine === true && material.isLineBasicMaterial === true) { // B (dashed): scale, dashSize, totalSize, alphaTest
			const color = material.color;
			d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
			if (material.isLineDashedMaterial === true) { d[o + 20] = material.scale; d[o + 21] = material.dashSize; d[o + 22] = material.dashSize + material.gapSize; } else { d[o + 20] = 0; d[o + 21] = 0; d[o + 22] = 1; }
			d[o + 23] = material.alphaTest;
			n = 8;
		}
		d[o + 28] = 0; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
		this.texIds[p] = -1; // the entry holds no normal matrix: a mesh at this position must rewrite it
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		if (n >= 8) for (let k = 0; k < 8; k++) _f32[k] = d[o + 16 + k];
		if (n === 2) { _f32[0] = _f32[8]; _f32[1] = _f32[9]; }
		for (let k = 0; k < n; k++) h = Math.imul(h ^ _i32[k], 16777619);
		this.texHash = h;
		this.texCount = p + 1;
		return p;
	}
	addTexView(object, camera, both) {
		const p = this.texCount, d = this.texData, o = p * TEX_STRIDE_FLOATS;
		_mv.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
		_nm.getNormalMatrix(_mv);
		const me = _mv.elements, ne = _nm.elements;
		for (let i = 0; i < 16; i++) d[o + i] = me[i];
		d[o + 16] = ne[0]; d[o + 17] = ne[1]; d[o + 18] = ne[2]; d[o + 19] = 0;
		d[o + 20] = ne[3]; d[o + 21] = ne[4]; d[o + 22] = ne[5]; d[o + 23] = 0;
		d[o + 24] = ne[6]; d[o + 25] = ne[7]; d[o + 26] = ne[8]; d[o + 27] = 0;
		d[o + 28] = 0; d[o + 29] = 0; d[o + 30] = 0; d[o + 31] = 0;
		this.texIds[p] = -1;
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		this.texHash = h;
		this.texCount = p + 1;
		if (both) this.addTex(object, 0);
		return p;
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
	dispose() {
		this.disposeSlot(this.defaultSlot);
		this.live.drain((slot) => this.disposeSlot(slot));
		this._disposed = true;
	}
}

export { WebGLBatcher };
