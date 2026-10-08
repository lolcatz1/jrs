import { epochs } from './epochs.js';

class Layers {
	constructor() { this._mask = 1 | 0; }
	get mask() { return this._mask; }
	set mask(value) { if (value !== this._mask) { this._mask = value; epochs.structure++; } }
	set(channel) { this.mask = (1 << channel | 0) >>> 0; }
	enable(channel) { this.mask |= 1 << channel | 0; }
	enableAll() { this.mask = 0xffffffff | 0; }
	toggle(channel) { this.mask ^= 1 << channel | 0; }
	disable(channel) { this.mask &= ~(1 << channel | 0); }
	disableAll() { this.mask = 0; }
	test(layers) { return (this.mask & layers.mask) !== 0; }
	isEnabled(channel) { return (this.mask & (1 << channel | 0)) !== 0; }
}

export { Layers };
