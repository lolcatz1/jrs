import * as MathUtils from '../math/MathUtils.js';

let _sourceId = 0;

class Source {
	constructor(data = null) {
		this.isSource = true;
		Object.defineProperty(this, 'id', { value: _sourceId++ });
		this.uuid = MathUtils.generateUUID();
		this.data = data;
		this.dataReady = true;
		this.version = 0;
	}
	getSize(target) {
		const data = this.data;
		if (typeof HTMLVideoElement !== 'undefined' && data instanceof HTMLVideoElement) target.set(data.videoWidth, data.videoHeight, 0);
		else if (typeof VideoFrame !== 'undefined' && data instanceof VideoFrame) target.set(data.displayHeight, data.displayWidth, 0);
		else if (data !== null) target.set(data.width, data.height, data.depth || 0);
		else target.set(0, 0, 0);
		return target;
	}
	set needsUpdate(value) { if (value === true) this.version++; }
	toJSON() { return { uuid: this.uuid }; }
}

export { Source };
