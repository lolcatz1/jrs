import { Vector3 } from '../math/Vector3.js';
import { Quaternion } from '../math/Quaternion.js';
import { Euler } from '../math/Euler.js';

/**
 * Slab-resident TRS for Bones.
 *
 * A bone's position, quaternion and scale live in its record of the transform slab's snapshot page (a Float64Array
 * shared by thousands of objects) instead of in boxed heap fields:
 *
 *   [0..2] position   [3..6] quaternion   [7..9] scale
 *   [10] TRS version  bumped by every write to any of the above
 *   [11] version the local matrix was composed from        (Bone.updateMatrix: `[10] === [11]` means nothing to do)
 *   [12] quaternion version  bumped by writes to the quaternion only (SlabEuler: stale while it differs from the version it saw)
 *   [13] _worldVersion   [14] _parentWorldVersion   [15] flag bits (matrixWorldNeedsUpdate, matrixAutoUpdate, matrixWorldAutoUpdate)
 *        (accessors on Bone: the scene-graph state of a bone is part of its record, so a rig can be updated from flat
 *        arrays without touching the Bone objects, see objects/RigPlan.js)
 *
 * Why: the per-frame cost of animating a rig was dominated by cache misses on ~10 scattered heap objects per bone
 * (Vector3, Quaternion, Vector3 plus a HeapNumber per component, all promoted in breadth-first GC order). Reading
 * and writing flat records makes the mixer's write, the change check and the matrix compose touch one or two cache
 * lines, and lets AnimationMixer write quaternions without dereferencing a single bone object (PropertyBinding).
 *
 * The classes keep the three.js Vector3 / Quaternion / Euler API and `instanceof`: components are accessors over the
 * record, every write bumps the TRS version, so `bone.position.x += 1`, `bone.quaternion.multiply(q)`,
 * `bone.rotation.y = a` and `matrix.decompose(bone.position, bone.quaternion, bone.scale)` behave as before.
 */
export const TRS_VERSION = 10;
export const TRS_MATRIX_SEEN = 11;
export const TRS_QUAT_VERSION = 12;
export const TRS_WORLD_VERSION = 13;
export const TRS_PARENT_WORLD_VERSION = 14;
export const TRS_FLAGS = 15;
/** Bits of TRS_FLAGS: matrixWorldNeedsUpdate, matrixAutoUpdate, matrixWorldAutoUpdate. */
export const FLAG_NEEDS_UPDATE = 1, FLAG_MATRIX_AUTO = 2, FLAG_WORLD_AUTO = 4;

const noopOnChange = Quaternion.prototype._onChangeCallback;

class SlabVector3 extends Vector3 {
	constructor(owner, d, record, base) {
		super();
		this._owner = owner; // keeps the owning bone (and so its slab record) alive while this vector is referenced
		this._d = d;
		this._b = record + base;
		this._v = record + TRS_VERSION;
	}
	get x() { return this._d[this._b]; }
	set x(value) { const d = this._d; if (d !== undefined) { d[this._b] = value; d[this._v]++; } }
	get y() { return this._d[this._b + 1]; }
	set y(value) { const d = this._d; if (d !== undefined) { d[this._b + 1] = value; d[this._v]++; } }
	get z() { return this._d[this._b + 2]; }
	set z(value) { const d = this._d; if (d !== undefined) { d[this._b + 2] = value; d[this._v]++; } }
	set(x, y, z) {
		if (z === undefined) z = this.z;
		const d = this._d, b = this._b;
		d[b] = x; d[b + 1] = y; d[b + 2] = z; d[this._v]++;
		return this;
	}
	copy(v) {
		const d = this._d, b = this._b;
		d[b] = v.x; d[b + 1] = v.y; d[b + 2] = v.z; d[this._v]++;
		return this;
	}
	fromArray(array, offset = 0) {
		const d = this._d, b = this._b;
		d[b] = array[offset]; d[b + 1] = array[offset + 1]; d[b + 2] = array[offset + 2]; d[this._v]++;
		return this;
	}
	clone() { return new Vector3(this.x, this.y, this.z); }
	toJSON() { return { isVector3: true, x: this.x, y: this.y, z: this.z }; }
}
SlabVector3.prototype.isSlabTransform = true;

class SlabQuaternion extends Quaternion {
	constructor(owner, d, record) {
		super();
		this._owner = owner;
		this._d = d;
		this._b = record + 3;
		this._v = record + TRS_VERSION;
	}
	get _x() { return this._d[this._b]; }
	set _x(value) { const d = this._d; if (d !== undefined) { d[this._b] = value; d[this._v]++; d[this._v + 2]++; } }
	get _y() { return this._d[this._b + 1]; }
	set _y(value) { const d = this._d; if (d !== undefined) { d[this._b + 1] = value; d[this._v]++; d[this._v + 2]++; } }
	get _z() { return this._d[this._b + 2]; }
	set _z(value) { const d = this._d; if (d !== undefined) { d[this._b + 2] = value; d[this._v]++; d[this._v + 2]++; } }
	get _w() { return this._d[this._b + 3]; }
	set _w(value) { const d = this._d; if (d !== undefined) { d[this._b + 3] = value; d[this._v]++; d[this._v + 2]++; } }
	set(x, y, z, w) {
		const d = this._d, b = this._b;
		d[b] = x; d[b + 1] = y; d[b + 2] = z; d[b + 3] = w; d[this._v]++; d[this._v + 2]++;
		this._onChangeCallback();
		return this;
	}
	fromArray(array, offset = 0) {
		const d = this._d, b = this._b;
		d[b] = array[offset]; d[b + 1] = array[offset + 1]; d[b + 2] = array[offset + 2]; d[b + 3] = array[offset + 3]; d[this._v]++; d[this._v + 2]++;
		this._onChangeCallback();
		return this;
	}
	clone() { return new Quaternion(this._x, this._y, this._z, this._w); }
}
SlabQuaternion.prototype.isSlabTransform = true;

/** `rotation` of a bone: stale exactly when the quaternion was written since the angles were last synchronised. */
class SlabEuler extends Euler {
	constructor(owner, d, record) {
		super();
		this._owner = owner;
		this._d = d;
		this._qv = record + TRS_QUAT_VERSION;
		this._seen = 0; // quaternion version the angles were last synchronised to
	}
	get _stale() { const d = this._d; return d !== undefined && d[this._qv] !== this._seen; }
	set _stale(value) { const d = this._d; if (d !== undefined) this._seen = value ? -1 : d[this._qv]; }
	clone() { if (this._stale) this._flush(); return new Euler(this._x, this._y, this._z, this._order); }
}

export { SlabVector3, SlabQuaternion, SlabEuler, noopOnChange };
