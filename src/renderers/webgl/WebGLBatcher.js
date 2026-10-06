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
export const INSTANCE_STRIDE_FLOATS = 16;
export const INSTANCE_STRIDE_BYTES = INSTANCE_STRIDE_FLOATS * 4;

class WebGLBatcher {
	constructor(gl) {
		this.gl = gl;
		this.buffer = gl.createBuffer();
		this.capacity = 1024; // instances
		this.data = new Float32Array(this.capacity * INSTANCE_STRIDE_FLOATS);
		this.count = 0;
		this.lastHash = 0;
		this.hash = 0;
		this.uploadedBytes = 0;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.ARRAY_BUFFER, null);
	}
	begin() { this.count = 0; this.hash = 0x811c9dc5 | 0; }
	ensure(extra) {
		if (this.count + extra > this.capacity) {
			let cap = this.capacity;
			while (cap < this.count + extra) cap *= 2;
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
	dispose() { this.gl.deleteBuffer(this.buffer); }
}

export { WebGLBatcher };
