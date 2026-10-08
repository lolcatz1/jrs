/**
 * GPU buffer management for BufferAttributes. One WebGLBuffer per attribute,
 * re-uploaded only when `attribute.version` changes, honouring updateRanges.
 *
 * `updateRanges` are consumed (and cleared) by whichever GPU copy uploads first, so a second copy of
 * the same attribute (the mega-buffer page) must not trust them: `attribute._uploadSeq` counts range
 * consumptions and a copy only uses ranges when no other copy consumed any since its own last upload.
 * Growing an attribute (array of a different byte length) re-specifies the existing buffer with
 * bufferData instead of creating a new one, so the VAOs that point at it stay valid.
 */
/** Sorts and merges adjacent/overlapping ranges in place (same algorithm as three.js). */
function mergeUpdateRanges(updateRanges) {
	updateRanges.sort((a, b) => a.start - b.start);
	let mergeIndex = 0;
	for (let i = 1; i < updateRanges.length; i++) {
		const previousRange = updateRanges[mergeIndex], range = updateRanges[i];
		if (range.start <= previousRange.start + previousRange.count + 1) {
			previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
		} else {
			++mergeIndex;
			updateRanges[mergeIndex] = range;
		}
	}
	updateRanges.length = mergeIndex + 1;
}

class WebGLAttributes {
	constructor(gl) {
		this.gl = gl;
		this.buffers = new WeakMap();
	}
	_createBuffer(attribute, bufferType) {
		const gl = this.gl;
		const array = attribute.array;
		const usage = attribute.usage;
		const buffer = gl.createBuffer();
		gl.bindBuffer(bufferType, buffer);
		gl.bufferData(bufferType, array, usage);
		// a first upload sends everything, so it consumes any pending ranges (three.js leaves them, which only costs it a stale range later)
		if (attribute.updateRanges.length !== 0) { attribute.clearUpdateRanges(); attribute._uploadSeq++; }
		attribute.onUploadCallback();
		const type = this._typeOf(array, attribute);
		return { buffer, type, bytesPerElement: array.BYTES_PER_ELEMENT, version: attribute.version, size: array.byteLength, itemSize: attribute.itemSize, stride: attribute.stride, seq: attribute._uploadSeq };
	}
	_typeOf(array, attribute) {
		const gl = this.gl;
		if (array instanceof Float32Array) return gl.FLOAT;
		if (array instanceof Uint16Array) return attribute.isFloat16BufferAttribute ? gl.HALF_FLOAT : gl.UNSIGNED_SHORT;
		if (array instanceof Int16Array) return gl.SHORT;
		if (array instanceof Uint32Array) return gl.UNSIGNED_INT;
		if (array instanceof Int32Array) return gl.INT;
		if (array instanceof Int8Array) return gl.BYTE;
		if (array instanceof Uint8Array || array instanceof Uint8ClampedArray) return gl.UNSIGNED_BYTE;
		throw new Error('WebGLAttributes: Unsupported buffer data format: ' + array);
	}
	_updateBuffer(data, attribute, bufferType) {
		const gl = this.gl;
		const array = attribute.array;
		const updateRanges = attribute.updateRanges;
		gl.bindBuffer(bufferType, data.buffer);
		if (updateRanges.length === 0 || data.seq !== attribute._uploadSeq) {
			// Not using update ranges (or another copy of this attribute consumed ranges we never saw)
			gl.bufferSubData(bufferType, 0, array);
			if (updateRanges.length !== 0) { attribute.clearUpdateRanges(); attribute._uploadSeq++; }
		} else {
			mergeUpdateRanges(updateRanges);
			for (let i = 0, l = updateRanges.length; i < l; i++) {
				const range = updateRanges[i];
				gl.bufferSubData(bufferType, range.start * array.BYTES_PER_ELEMENT, array, range.start, range.count);
			}
			attribute.clearUpdateRanges();
			attribute._uploadSeq++;
		}
		data.seq = attribute._uploadSeq;
		attribute.onUploadCallback();
	}
	_regrow(data, attribute, bufferType) {
		const gl = this.gl;
		const fresh = this._createBuffer(attribute, bufferType); // creates + uploads + onUpload
		gl.deleteBuffer(data.buffer);
		data.buffer = fresh.buffer; data.type = fresh.type; data.bytesPerElement = fresh.bytesPerElement; data.size = fresh.size;
		data.itemSize = fresh.itemSize; data.stride = fresh.stride; data.seq = fresh.seq;
	}
	get(attribute) {
		if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
		return this.buffers.get(attribute);
	}
	remove(attribute) {
		if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
		const data = this.buffers.get(attribute);
		if (data) { this.gl.deleteBuffer(data.buffer); this.buffers.delete(attribute); }
	}
	/** Ensures the GPU buffer exists and is current. Returns the record. */
	update(attribute, bufferType) {
		if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
		let data = this.buffers.get(attribute);
		if (data === undefined) {
			data = this._createBuffer(attribute, bufferType);
			this.buffers.set(attribute, data);
		} else if (data.version < attribute.version) {
			if (data.size !== attribute.array.byteLength) {
				if (attribute.isInstancedBufferAttribute !== true && data.itemSize === attribute.itemSize && data.stride === attribute.stride &&
					data.bytesPerElement === attribute.array.BYTES_PER_ELEMENT && this._typeOf(attribute.array, attribute) === data.type) {
					// same layout, new size: re-specify the storage of the existing buffer (one bufferData, VAOs stay valid)
					const gl = this.gl;
					gl.bindBuffer(bufferType, data.buffer);
					gl.bufferData(bufferType, attribute.array, attribute.usage);
					data.size = attribute.array.byteLength;
					if (attribute.updateRanges.length !== 0) attribute.clearUpdateRanges();
					attribute._uploadSeq++;
					data.seq = attribute._uploadSeq;
					attribute.onUploadCallback();
				} else this._regrow(data, attribute, bufferType);
			} else {
				this._updateBuffer(data, attribute, bufferType);
			}
			data.version = attribute.version;
		}
		return data;
	}
}

export { WebGLAttributes, mergeUpdateRanges };
