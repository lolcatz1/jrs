/**
 * Weakly held set of the GPU-resource records a subsystem has created (attribute buffers, VAO entries,
 * texture / render-target properties). `renderer.dispose()` walks it to delete every GL object that is
 * still alive without pinning the scene objects the records belong to: a record is only reachable through
 * a WeakMap value keyed by its geometry / texture, so it (and its GL handle) is still collected with the key.
 */
class LiveSet {
	constructor() { this.refs = new Set(); this._adds = 0; }
	add(record) {
		record._liveRef = new WeakRef(record);
		this.refs.add(record._liveRef);
		if ((++this._adds & 1023) === 0) this._compact();
	}
	delete(record) { if (record._liveRef !== undefined) { this.refs.delete(record._liveRef); record._liveRef = undefined; } }
	_compact() { for (const r of this.refs) if (r.deref() === undefined) this.refs.delete(r); }
	/** Calls fn(record) for every record that is still alive, then forgets them all. */
	drain(fn) {
		for (const r of this.refs) { const rec = r.deref(); if (rec !== undefined) { rec._liveRef = undefined; fn(rec); } }
		this.refs.clear();
	}
	get size() { let n = 0; for (const r of this.refs) if (r.deref() !== undefined) n++; return n; }
}

export { LiveSet };
