import { EventDispatcher } from '../core/EventDispatcher.js';

/** Base class for controls (OrbitControls etc. from three's addons extend this). */
class Controls extends EventDispatcher {
	constructor(object, domElement = null) {
		super();
		this.object = object;
		this.domElement = domElement;
		this.enabled = true;
		this.state = -1;
		this.keys = {};
		this.mouseButtons = { LEFT: null, MIDDLE: null, RIGHT: null };
		this.touches = { ONE: null, TWO: null };
	}
	connect(element) {
		if (this.domElement !== null) this.disconnect();
		this.domElement = element;
	}
	disconnect() {}
	dispose() {}
	update(/* delta */) {}
}

export { Controls };
