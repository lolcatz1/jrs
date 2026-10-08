import { Quaternion } from './Quaternion.js';
import { Matrix4 } from './Matrix4.js';
import { clamp } from './MathUtils.js';

const _matrix = /*@__PURE__*/ new Matrix4();
const _quaternion = /*@__PURE__*/ new Quaternion();

class Euler {
	constructor(x = 0, y = 0, z = 0, order = Euler.DEFAULT_ORDER) {
		this.isEuler = true;
		this._x = x; this._y = y; this._z = z; this._order = order;
		// lazy sync from a driving quaternion (Object3D.rotation): the owner sets `_stale` instead of
		// converting on every quaternion write; the angles are recomputed from `_source` on first read
		this._stale = false; this._source = null;
	}
	/** Recomputes x / y / z from the driving quaternion if it changed since the last read. */
	_flush() {
		if (this._stale) { this._stale = false; this.setFromQuaternion(this._source, undefined, false); }
		return this;
	}
	get x() { if (this._stale) this._flush(); return this._x; }
	set x(v) { if (this._stale) this._flush(); this._x = v; this._onChangeCallback(); }
	get y() { if (this._stale) this._flush(); return this._y; }
	set y(v) { if (this._stale) this._flush(); this._y = v; this._onChangeCallback(); }
	get z() { if (this._stale) this._flush(); return this._z; }
	set z(v) { if (this._stale) this._flush(); this._z = v; this._onChangeCallback(); }
	get order() { return this._order; }
	set order(v) { if (this._stale) this._flush(); this._order = v; this._onChangeCallback(); }
	set(x, y, z, order = this._order) { this._stale = false; this._x = x; this._y = y; this._z = z; this._order = order; this._onChangeCallback(); return this; }
	clone() { if (this._stale) this._flush(); return new this.constructor(this._x, this._y, this._z, this._order); }
	copy(e) { if (e._stale) e._flush(); this._stale = false; this._x = e._x; this._y = e._y; this._z = e._z; this._order = e._order; this._onChangeCallback(); return this; }
	setFromRotationMatrix(m, order = this._order, update = true) {
		this._stale = false;
		const te = m.elements;
		const m11 = te[0], m12 = te[4], m13 = te[8];
		const m21 = te[1], m22 = te[5], m23 = te[9];
		const m31 = te[2], m32 = te[6], m33 = te[10];
		switch (order) {
			case 'XYZ':
				this._y = Math.asin(clamp(m13, -1, 1));
				if (Math.abs(m13) < 0.9999999) { this._x = Math.atan2(-m23, m33); this._z = Math.atan2(-m12, m11); }
				else { this._x = Math.atan2(m32, m22); this._z = 0; }
				break;
			case 'YXZ':
				this._x = Math.asin(-clamp(m23, -1, 1));
				if (Math.abs(m23) < 0.9999999) { this._y = Math.atan2(m13, m33); this._z = Math.atan2(m21, m22); }
				else { this._y = Math.atan2(-m31, m11); this._z = 0; }
				break;
			case 'ZXY':
				this._x = Math.asin(clamp(m32, -1, 1));
				if (Math.abs(m32) < 0.9999999) { this._y = Math.atan2(-m31, m33); this._z = Math.atan2(-m12, m22); }
				else { this._y = 0; this._z = Math.atan2(m21, m11); }
				break;
			case 'ZYX':
				this._y = Math.asin(-clamp(m31, -1, 1));
				if (Math.abs(m31) < 0.9999999) { this._x = Math.atan2(m32, m33); this._z = Math.atan2(m21, m11); }
				else { this._x = 0; this._z = Math.atan2(-m12, m22); }
				break;
			case 'YZX':
				this._z = Math.asin(clamp(m21, -1, 1));
				if (Math.abs(m21) < 0.9999999) { this._x = Math.atan2(-m23, m22); this._y = Math.atan2(-m31, m11); }
				else { this._x = 0; this._y = Math.atan2(m13, m33); }
				break;
			case 'XZY':
				this._z = Math.asin(-clamp(m12, -1, 1));
				if (Math.abs(m12) < 0.9999999) { this._x = Math.atan2(m32, m22); this._y = Math.atan2(m13, m11); }
				else { this._x = Math.atan2(-m23, m33); this._y = 0; }
				break;
			default:
				console.warn('Euler: .setFromRotationMatrix() encountered an unknown order: ' + order);
		}
		this._order = order;
		if (update === true) this._onChangeCallback();
		return this;
	}
	setFromQuaternion(q, order, update) {
		_matrix.makeRotationFromQuaternion(q);
		return this.setFromRotationMatrix(_matrix, order, update);
	}
	setFromVector3(v, order = this._order) { return this.set(v.x, v.y, v.z, order); }
	reorder(newOrder) {
		if (this._stale) this._flush();
		_quaternion.setFromEuler(this);
		return this.setFromQuaternion(_quaternion, newOrder);
	}
	equals(e) { if (this._stale) this._flush(); if (e._stale) e._flush(); return e._x === this._x && e._y === this._y && e._z === this._z && e._order === this._order; }
	fromArray(array) {
		this._stale = false;
		this._x = array[0]; this._y = array[1]; this._z = array[2];
		if (array[3] !== undefined) this._order = array[3];
		this._onChangeCallback();
		return this;
	}
	toArray(array = [], offset = 0) {
		if (this._stale) this._flush();
		array[offset] = this._x; array[offset + 1] = this._y; array[offset + 2] = this._z; array[offset + 3] = this._order;
		return array;
	}
	_onChange(callback) { this._onChangeCallback = callback; return this; }
	_onChangeCallback() {}
	*[Symbol.iterator]() { if (this._stale) this._flush(); yield this._x; yield this._y; yield this._z; yield this._order; }
}

Euler.DEFAULT_ORDER = 'XYZ';

export { Euler };
