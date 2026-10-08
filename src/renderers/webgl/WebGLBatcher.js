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
const _f32 = new Float32Array(10), _i32 = new Int32Array(_f32.buffer);

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		// matrix texture: RGBA32F, TEXELS_PER_OBJECT texels per object (world matrix + normal matrix), rows of MATRICES_PER_ROW objects.
		// textureRows is the height the texture was last (re)defined with; see uploadTexture for why it is redefined per upload.
		this.texture = null; this.textureRows = 0; this.textureHash = 0; this.textureCount = 0;
		this.texCapacity = MATRICES_PER_ROW * 8;
		this.texData = new Float32Array(this.texCapacity * TEX_STRIDE_FLOATS);
		this.texCount = 0; this.texHash = 0;
		this.pixelRatio = 1; this.pointScale = 1;
	}
	/** `pixelRatio` and `height` (renderer drawing size in CSS pixels) feed the per-point size math, as in three's refreshUniformsPoints. */
	begin(pixelRatio = 1, height = 1) { this.texCount = 0; this.texHash = 0x811c9dc5 | 0; this.pixelRatio = pixelRatio; this.pointScale = height * 0.5; }
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
	 * Append an object's world matrix and (CPU-cached) normal matrix. Sprites, points and lines have no normal matrix; the
	 * texels it would use carry their material's per-object values instead (see INSTANCE_MATERIAL in the vertex shader).
	 * Returns its index in the texture.
	 */
	addTex(object, material) {
		const d = this.texData, o = this.texCount * TEX_STRIDE_FLOATS;
		const s = object._slabData, so = object._slabOffset + 16;
		for (let i = 0; i < 16; i++) d[o + i] = s[so + i];
		// FNV-1a style mix of id and world version: unchanged hash -> the upload is skipped
		let h = this.texHash;
		h = Math.imul(h ^ object.id, 16777619);
		h = Math.imul(h ^ object._worldVersion, 16777619);
		if (object.isMesh === true) {
			if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, object._slabOffset); object._normalVersion = object._worldVersion; }
			const no = object._slabOffset + 32;
			d[o + 16] = s[no]; d[o + 17] = s[no + 1]; d[o + 18] = s[no + 2]; d[o + 19] = 0;
			d[o + 20] = s[no + 3]; d[o + 21] = s[no + 4]; d[o + 22] = s[no + 5]; d[o + 23] = 0;
			d[o + 24] = s[no + 6]; d[o + 25] = s[no + 7]; d[o + 26] = s[no + 8]; d[o + 27] = 0;
		} else {
			let n = 0;
			if (object.isSprite === true) {
				// the anchor (a plain mutable Vector2) travels in the last texel
				const c = object.center;
				d[o + 28] = c.x; d[o + 29] = c.y;
				_f32[0] = c.x; _f32[1] = c.y; n = 2;
				if (material !== undefined && material.isSpriteMaterial === true) { // B: rotation, attenuation flag
					const color = material.color;
					d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
					d[o + 20] = material.rotation; d[o + 21] = material.sizeAttenuation === true ? 1 : 0; d[o + 22] = 0; d[o + 23] = material.alphaTest;
					n = 10;
				}
			} else if (material !== undefined) {
				if (object.isPoints === true && material.isPointsMaterial === true) {
					const color = material.color;
					d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
					d[o + 20] = material.size * this.pixelRatio; d[o + 21] = material.sizeAttenuation === true ? this.pointScale : 0; d[o + 22] = 0; d[o + 23] = material.alphaTest;
					n = 8;
				} else if (object.isLine === true && material.isLineBasicMaterial === true) {
					const color = material.color;
					d[o + 16] = color.r; d[o + 17] = color.g; d[o + 18] = color.b; d[o + 19] = material.opacity;
					if (material.isLineDashedMaterial === true) { d[o + 20] = material.scale; d[o + 21] = material.dashSize; d[o + 22] = material.dashSize + material.gapSize; } else { d[o + 20] = 0; d[o + 21] = 0; d[o + 22] = 1; }
					d[o + 23] = material.alphaTest;
					n = 8;
				}
			}
			if (n > 2) for (let k = 0; k < 8; k++) { _f32[k] = d[o + 16 + k]; }
			// the scratch holds the values in order: sprite adds its centre as two more entries
			if (n === 10) { _f32[8] = d[o + 28]; _f32[9] = d[o + 29]; }
			for (let k = 0; k < n; k++) h = Math.imul(h ^ _i32[k], 16777619);
		}
		this.texHash = h;
		return this.texCount++;
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
		const gl = this.gl;
		const rows = Math.max(1, Math.ceil(this.texCount / MATRICES_PER_ROW));
		if (this.texture === null) {
			this.texture = gl.createTexture();
			state.bindTexture(gl.TEXTURE_2D, this.texture, unit);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			this.textureRows = 0; this.textureHash = 0;
		} else {
			state.bindTexture(gl.TEXTURE_2D, this.texture, unit);
		}
		if (this.texCount === 0) return;
		if (this.textureHash === this.texHash && this.textureCount === this.texCount) return;
		state.activeTexture(unit); // the cached binding can make bindTexture a no-op while another unit is active; texImage2D targets the active unit
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, MATRIX_TEXTURE_WIDTH, rows, 0, gl.RGBA, gl.FLOAT, this.texData, 0);
		this.textureRows = rows; this.textureHash = this.texHash; this.textureCount = this.texCount;
	}
	dispose() { if (this.texture !== null) this.gl.deleteTexture(this.texture); }
}

export { WebGLBatcher };
