class Timer {
	constructor() {
		this._previousTime = 0; this._currentTime = 0; this._startTime = performance.now();
		this._delta = 0; this._elapsed = 0; this._timescale = 1;
	}
	getDelta() { return this._delta / 1000; }
	getElapsed() { return this._elapsed / 1000; }
	getTimescale() { return this._timescale; }
	setTimescale(t) { this._timescale = t; return this; }
	reset() { this._currentTime = performance.now() - this._startTime; return this; }
	dispose() {}
	update(timestamp) {
		this._previousTime = this._currentTime;
		this._currentTime = (timestamp !== undefined ? timestamp : performance.now()) - this._startTime;
		this._delta = (this._currentTime - this._previousTime) * this._timescale;
		this._elapsed += this._delta;
		return this;
	}
}
export { Timer };
