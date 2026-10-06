import { generateUUID } from '../math/MathUtils.js';
import { StaticDrawUsage } from '../constants.js';

/**
 * Interleaved vertex data shared by several InterleavedBufferAttributes.
 * The classes are provided for API compatibility (e.g. BufferGeometryUtils); the renderer
 * does not yet draw interleaved attributes. See README "Not implemented".
 */
class InterleavedBuffer {
	constructor(array, stride) {
		this.isInterleavedBuffer = true;
		this.array = array;
		this.stride = stride;
		this.count = array !== undefined ? array.length / stride : 0;
		this.usage = StaticDrawUsage;
		this.updateRanges = [];
		this.version = 0;
		this.uuid = generateUUID();
	}
	onUploadCallback() {}
	set needsUpdate(value) { if (value === true) this.version++; }
	setUsage(value) { this.usage = value; return this; }
	addUpdateRange(start, count) { this.updateRanges.push({ start, count }); }
	clearUpdateRanges() { this.updateRanges.length = 0; }
	copy(source) {
		this.array = new source.array.constructor(source.array);
		this.count = source.count; this.stride = source.stride; this.usage = source.usage;
		return this;
	}
	copyAt(index1, attribute, index2) {
		index1 *= this.stride; index2 *= attribute.stride;
		for (let i = 0, l = this.stride; i < l; i++) this.array[index1 + i] = attribute.array[index2 + i];
		return this;
	}
	set(value, offset = 0) { this.array.set(value, offset); return this; }
	clone(data) {
		if (data.arrayBuffers === undefined) data.arrayBuffers = {};
		if (this.array.buffer._uuid === undefined) this.array.buffer._uuid = generateUUID();
		if (data.arrayBuffers[this.array.buffer._uuid] === undefined) data.arrayBuffers[this.array.buffer._uuid] = this.array.slice(0).buffer;
		const array = new this.array.constructor(data.arrayBuffers[this.array.buffer._uuid]);
		const ib = new this.constructor(array, this.stride);
		ib.setUsage(this.usage);
		return ib;
	}
	onUpload(callback) { this.onUploadCallback = callback; return this; }
	toJSON(data) {
		if (data.arrayBuffers === undefined) data.arrayBuffers = {};
		if (this.array.buffer._uuid === undefined) this.array.buffer._uuid = generateUUID();
		if (data.arrayBuffers[this.array.buffer._uuid] === undefined) data.arrayBuffers[this.array.buffer._uuid] = Array.from(new Uint32Array(this.array.buffer));
		return { uuid: this.uuid, buffer: this.array.buffer._uuid, type: this.array.constructor.name, stride: this.stride };
	}
}

export { InterleavedBuffer };
