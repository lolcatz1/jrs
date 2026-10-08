import { DataTexture } from '../../textures/DataTexture.js';
import { RGBAFormat, FloatType } from '../../constants.js';

const WIDTH = 1024; // texels per row: 256 bones
const ROW_STEP = 16; // the texture grows in steps of this many rows (256 KB)

/**
 * One RGBA32F texture holding the bone matrices of every skeleton the renderer draws with a built-in material.
 * Each skeleton owns a stable range of bone slots (`skeleton._atlasBase`); the vertex shader adds the draw's
 * `boneBase` uniform to the bone index, so a frame uploads the changed matrices with ONE texImage2D instead of one
 * bind + upload per skeleton, and the texture stays bound across skinned draws.
 *
 * Ranges are released by `Skeleton.dispose()` and, for skeletons that are simply dropped, by a FinalizationRegistry.
 */
class WebGLBoneAtlas {
	constructor() {
		this.rows = ROW_STEP;
		this.data = new Float32Array(WIDTH * this.rows * 4);
		this.texture = new DataTexture(this.data, WIDTH, this.rows, RGBAFormat, FloatType);
		this.texture._stream = true; // re-uploaded with texImage2D (see WebGLTextures)
		this.texture.needsUpdate = true;
		this.top = 0; // bump pointer, in bone slots
		this.freeRanges = []; // [base, count, base, count, ...]
		this.dirty = false;
		this._registry = typeof FinalizationRegistry === 'function' ? new FinalizationRegistry((r) => this._release(r.base, r.count)) : null;
	}

	/** Copies the skeleton's bone matrices into its slots if they changed (allocating the slots on first use). */
	sync(skeleton) {
		const count = skeleton.bones.length;
		if (skeleton._atlas !== this || skeleton._atlasCount !== count) {
			if (skeleton._atlas !== null) skeleton._atlas.release(skeleton);
			if (count === 0) return;
			skeleton._atlas = this; skeleton._atlasCount = count; skeleton._atlasBase = this._alloc(count); skeleton._atlasVersion = -1;
			if (this._registry !== null) this._registry.register(skeleton, { base: skeleton._atlasBase, count }, skeleton);
		}
		if (skeleton._atlasVersion !== skeleton._dataVersion) {
			skeleton._atlasVersion = skeleton._dataVersion;
			this.data.set(count * 16 === skeleton.boneMatrices.length ? skeleton.boneMatrices : skeleton.boneMatrices.subarray(0, count * 16), skeleton._atlasBase * 16);
			this.dirty = true;
		}
	}

	release(skeleton) {
		if (skeleton._atlas !== this) return;
		if (this._registry !== null) this._registry.unregister(skeleton);
		this._release(skeleton._atlasBase, skeleton._atlasCount);
		skeleton._atlas = null; skeleton._atlasCount = 0; skeleton._atlasBase = 0; skeleton._atlasVersion = -1;
	}

	/** Flags the texture for upload if any range changed since the last call. */
	flush() {
		if (this.dirty) { this.dirty = false; this.texture.needsUpdate = true; }
		return this.texture;
	}

	dispose() {
		this.texture.dispose();
	}

	_alloc(count) {
		const free = this.freeRanges;
		for (let i = 0; i < free.length; i += 2) {
			if (free[i + 1] >= count) {
				const base = free[i];
				if (free[i + 1] === count) free.splice(i, 2); else { free[i] += count; free[i + 1] -= count; }
				return base;
			}
		}
		const base = this.top;
		this.top += count;
		this._ensure(this.top);
		return base;
	}

	_release(base, count) {
		const free = this.freeRanges;
		free.push(base, count);
		if (base + count === this.top) this._trim();
	}

	/** Returns trailing free ranges to the bump pointer. */
	_trim() {
		const free = this.freeRanges;
		for (let again = true; again;) {
			again = false;
			for (let i = 0; i < free.length; i += 2) {
				if (free[i] + free[i + 1] === this.top) { this.top = free[i]; free.splice(i, 2); again = true; break; }
			}
		}
	}

	_ensure(bones) {
		const rowsNeeded = Math.ceil(bones * 4 / WIDTH);
		if (rowsNeeded <= this.rows) return;
		const rows = Math.ceil(rowsNeeded / ROW_STEP) * ROW_STEP;
		const data = new Float32Array(WIDTH * rows * 4);
		data.set(this.data);
		this.data = data; this.rows = rows;
		this.texture.image = { data, width: WIDTH, height: rows };
		this.dirty = true;
	}
}

export { WebGLBoneAtlas };
