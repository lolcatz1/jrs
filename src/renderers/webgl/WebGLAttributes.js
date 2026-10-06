/**
 * GPU buffer management for BufferAttributes. One WebGLBuffer per attribute,
 * re-uploaded only when `attribute.version` changes, honouring updateRanges.
 */
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
		attribute.onUploadCallback();
		let type;
		if (array instanceof Float32Array) type = gl.FLOAT;
		else if (array instanceof Uint16Array) type = attribute.isFloat16BufferAttribute ? gl.HALF_FLOAT : gl.UNSIGNED_SHORT;
		else if (array instanceof Int16Array) type = gl.SHORT;
		else if (array instanceof Uint32Array) type = gl.UNSIGNED_INT;
		else if (array instanceof Int32Array) type = gl.INT;
		else if (array instanceof Int8Array) type = gl.BYTE;
		else if (array instanceof Uint8Array) type = gl.UNSIGNED_BYTE;
		else if (array instanceof Uint8ClampedArray) type = gl.UNSIGNED_BYTE;
		else throw new Error('WebGLAttributes: Unsupported buffer data format: ' + array);
		return { buffer, type, bytesPerElement: array.BYTES_PER_ELEMENT, version: attribute.version, size: array.byteLength };
	}
	_updateBuffer(buffer, attribute, bufferType) {
		const gl = this.gl;
		const array = attribute.array;
		const updateRanges = attribute.updateRanges;
		gl.bindBuffer(bufferType, buffer);
		if (updateRanges.length === 0) {
			gl.bufferSubData(bufferType, 0, array);
		} else {
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
			for (let i = 0, l = updateRanges.length; i < l; i++) {
				const range = updateRanges[i];
				gl.bufferSubData(bufferType, range.start * array.BYTES_PER_ELEMENT, array, range.start, range.count);
			}
			attribute.clearUpdateRanges();
		}
		attribute.onUploadCallback();
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
				this.gl.deleteBuffer(data.buffer);
				const fresh = this._createBuffer(attribute, bufferType);
				data.buffer = fresh.buffer; data.type = fresh.type; data.bytesPerElement = fresh.bytesPerElement; data.size = fresh.size;
			} else {
				this._updateBuffer(data.buffer, attribute, bufferType);
			}
			data.version = attribute.version;
		}
		return data;
	}
}

export { WebGLAttributes };
