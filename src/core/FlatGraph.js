/**
 * FlatGraph: a scene's objects as one flat, parent-before-child array.
 *
 * The renderer updates world matrices, culls and collects render items in a single loop over this array instead of
 * two recursive walks (`Object3D.updateMatrixWorld` + `_projectObject`). The array is built on the first render of a
 * scene, patched in place by `Object3D.add` / `remove` / `attach` (the subtree is spliced in after its parent's last
 * descendant, or spliced out), and rebuilt when a patch is not possible (the parent is not in this graph, too many
 * patches since the last frame) or when the renderer finds a `children.length` that differs from what the array was
 * built from (direct `children` mutation).
 *
 * Per-object data lives in typed arrays indexed by position in the array: parent index, subtree end, child count,
 * a kind bitmask (renderable / light / sprite / LOD / custom `updateMatrixWorld` / inside a custom subtree / camera
 * or skinned-mesh post-update hook / does not count toward the world epoch) and the per-frame scratch the pass needs
 * (world version seen, "forced" flag for descendants, effective visibility).
 *
 * The order is exactly `Object3D.traverse` order, so items are pushed in the same order as the recursive walk.
 */

export const K_RENDERABLE = 1;   // Mesh / Line / Points
export const K_SPRITE = 2;
export const K_LIGHT = 4;
export const K_LOD = 8;
export const K_CUSTOM = 16;      // updateMatrixWorld is overridden by an unknown class: run it recursively for this subtree
export const K_INSUB = 32;       // inside a K_CUSTOM subtree: the custom walk updates this object's matrices
export const K_POST = 64;        // has a _flatPostUpdate hook (Camera: inverse view matrix, SkinnedMesh: bind matrix inverse)
export const K_NOCOUNT = 128;    // _countsWorld === false (cameras): a recompute does not bump epochs.world

const MAX_PATCHES = 16;          // more patches than this between two frames -> one rebuild instead

const _stack = [];

class FlatGraph {
	constructor(root) {
		this.root = root;
		this.n = 0;
		this.capacity = 0;
		this.objects = [];
		this.parent = null;      // Int32Array: index of the parent, -1 for the root
		this.end = null;         // Int32Array: index one past the last descendant (subtree range [i, end[i]))
		this.childCount = null;  // Int32Array: children.length when the entry was built / patched
		this.kind = null;        // Uint8Array: K_* bits
		this.wv = null;          // Int32Array: _worldVersion after this frame's update (parent-before-child)
		this.dirty = null;       // Uint8Array: world matrix was (re)computed or forced this frame -> descendants recompute
		this.vis = null;         // Uint8Array: effective visibility (own `visible` and every ancestor's)
		this.valid = false;
		this.changed = false;    // the last update pass recomputed a world matrix that counts toward epochs.world
		this.patches = 0;        // patches applied since the last pass
		this.rebuilds = 0;       // statistics
		this.patched = 0;
	}

	_ensure(capacity) {
		if (capacity <= this.capacity) return;
		let c = this.capacity === 0 ? 256 : this.capacity;
		while (c < capacity) c *= 2;
		const grow = (a, T) => { const b = new T(c); if (a !== null) b.set(a.subarray(0, this.n)); return b; };
		this.parent = grow(this.parent, Int32Array);
		this.end = grow(this.end, Int32Array);
		this.childCount = grow(this.childCount, Int32Array);
		this.kind = grow(this.kind, Uint8Array);
		this.wv = grow(this.wv, Int32Array);
		this.dirty = grow(this.dirty, Uint8Array);
		this.vis = grow(this.vis, Uint8Array);
		this.capacity = c;
	}

	/** Kind bits of `object` whose parent entry has kind `parentKind` (-1 for the root). */
	static kindOf(object, parentKind) {
		let k = 0;
		if (object.isMesh === true || object.isLine === true || object.isPoints === true) k |= K_RENDERABLE;
		else if (object.isSprite === true) k |= K_SPRITE;
		else if (object.isLight === true) k |= K_LIGHT;
		else if (object.isLOD === true) k |= K_LOD;
		if (parentKind > 0 && (parentKind & (K_CUSTOM | K_INSUB)) !== 0) k |= K_INSUB;
		else if (object.updateMatrixWorld !== object._flatUMW) k |= K_CUSTOM;
		else if (object._flatPostUpdate !== null) k |= K_POST;
		if (object._countsWorld === false) k |= K_NOCOUNT;
		return k;
	}

	/** Pre-order fill of entries [at, at + m) with `object`'s subtree; `parentIndex` is the entry of its parent (-1: none). */
	_fill(at, object, parentIndex, parentKind) {
		const objects = this.objects, parent = this.parent, childCount = this.childCount, kind = this.kind;
		let i = at;
		// explicit stack of (object, parent index): children are pushed in reverse so they pop in order
		_stack.length = 0;
		_stack.push(object, parentIndex);
		while (_stack.length > 0) {
			const p = _stack.pop(), o = _stack.pop();
			objects[i] = o; parent[i] = p;
			const pk = p < 0 ? parentKind : kind[p];
			kind[i] = FlatGraph.kindOf(o, pk);
			o._flat = this; o._flatIndex = i;
			const children = o.children;
			childCount[i] = children.length;
			for (let c = children.length - 1; c >= 0; c--) _stack.push(children[c], i);
			i++;
		}
		// subtree ends: every subtree is contiguous and a parent precedes its children, so a reverse sweep suffices
		const end = this.end;
		for (let j = i - 1; j >= at; j--) end[j] = j + 1;
		for (let j = i - 1; j > at; j--) { const p = parent[j]; if (end[j] > end[p]) end[p] = end[j]; }
		return i - at;
	}

	rebuild() {
		let count = 0;
		this.root.traverse(() => { count++; });
		this._ensure(count);
		this.objects.length = count;
		this.n = this._fill(0, this.root, -1, -1);
		this.valid = true; this.patches = 0; this.rebuilds++;
	}

	/** True when `object` is the entry at its recorded index (stale indices on removed objects fail this). */
	indexOf(object) {
		const i = object._flatIndex;
		return object._flat === this && i >= 0 && i < this.n && this.objects[i] === object ? i : -1;
	}

	/** `parent.add(child)` happened (child already in `parent.children`, at the end). */
	onAdd(parentObject, child) {
		if (this.valid === false) return;
		const pi = this.indexOf(parentObject);
		if (pi < 0 || this.patches >= MAX_PATCHES) { this.valid = false; return; }
		let m = 0; child.traverse(() => { m++; });
		const at = this.end[pi], n = this.n;
		this._ensure(n + m);
		const objects = this.objects, parent = this.parent, end = this.end, childCount = this.childCount, kind = this.kind;
		// shift [at, n) up by m
		objects.length = n + m;
		for (let j = n - 1; j >= at; j--) { const o = objects[j]; objects[j + m] = o; o._flatIndex = j + m; }
		parent.copyWithin(at + m, at, n); end.copyWithin(at + m, at, n); childCount.copyWithin(at + m, at, n); kind.copyWithin(at + m, at, n);
		for (let j = at + m; j < n + m; j++) { if (parent[j] >= at) parent[j] += m; end[j] += m; }
		for (let a = pi; a >= 0; a = parent[a]) end[a] += m;
		this.n = n + m;
		this._fill(at, child, pi, kind[pi]);
		childCount[pi] = parentObject.children.length;
		this.patches++; this.patched++;
	}

	/** `parent.remove(child)` happened (child already out of `parent.children`). */
	onRemove(parentObject, child) {
		if (this.valid === false) return;
		const ci = this.indexOf(child);
		if (ci < 0 || this.parent[ci] !== this.indexOf(parentObject) || this.patches >= MAX_PATCHES) { this.valid = false; return; }
		const objects = this.objects, parent = this.parent, end = this.end, childCount = this.childCount, kind = this.kind;
		const to = end[ci], m = to - ci, n = this.n, pi = parent[ci];
		for (let a = pi; a >= 0; a = parent[a]) end[a] -= m;
		for (let j = to; j < n; j++) { const o = objects[j]; objects[j - m] = o; o._flatIndex = j - m; }
		objects.length = n - m;
		parent.copyWithin(ci, to, n); end.copyWithin(ci, to, n); childCount.copyWithin(ci, to, n); kind.copyWithin(ci, to, n);
		for (let j = ci; j < n - m; j++) { if (parent[j] >= to) parent[j] -= m; end[j] -= m; }
		this.n = n - m;
		if (pi >= 0) childCount[pi] = parentObject.children.length;
		this.patches++; this.patched++;
	}

	/** Structural check (the renderer's pass does the same per entry as it goes): every entry still has the child count it was built with. */
	validate() {
		const objects = this.objects, childCount = this.childCount;
		for (let i = 0, n = this.n; i < n; i++) if (objects[i].children.length !== childCount[i]) return false;
		return true;
	}
}

/** Notifies every flat graph rooted at `node` or one of its ancestors (nested scenes rendered alternately each keep one). */
function notifyAdd(node, child) {
	for (let r = node; r !== null; r = r.parent) { const g = r._flatGraph; if (g !== null) g.onAdd(node, child); }
}
function notifyRemove(node, child) {
	for (let r = node; r !== null; r = r.parent) { const g = r._flatGraph; if (g !== null) g.onRemove(node, child); }
}

export { FlatGraph, notifyAdd, notifyRemove };
