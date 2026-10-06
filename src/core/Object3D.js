import { Quaternion } from '../math/Quaternion.js';
import { Vector3 } from '../math/Vector3.js';
import { Matrix4 } from '../math/Matrix4.js';
import { EventDispatcher } from './EventDispatcher.js';
import { Euler } from '../math/Euler.js';
import { Layers } from './Layers.js';
import { Matrix3 } from '../math/Matrix3.js';
import * as MathUtils from '../math/MathUtils.js';
import { transformSlab, LOCAL_OFFSET, WORLD_OFFSET } from './TransformSlab.js';

let _object3DId = 0;

const _v1 = /*@__PURE__*/ new Vector3();
const _q1 = /*@__PURE__*/ new Quaternion();
const _m1 = /*@__PURE__*/ new Matrix4();
const _target = /*@__PURE__*/ new Vector3();
const _position = /*@__PURE__*/ new Vector3();
const _scale = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
const _xAxis = /*@__PURE__*/ new Vector3(1, 0, 0);
const _yAxis = /*@__PURE__*/ new Vector3(0, 1, 0);
const _zAxis = /*@__PURE__*/ new Vector3(0, 0, 1);

const _addedEvent = { type: 'added' };
const _removedEvent = { type: 'removed' };
const _childaddedEvent = { type: 'childadded', child: null };
const _childremovedEvent = { type: 'childremoved', child: null };

/**
 * Object3D with change-detected transforms.
 *
 * three.js recomposes every object's local matrix and remultiplies its world
 * matrix on every frame. Here `updateMatrix()` snapshots position / quaternion
 * / scale and only recomposes when a component actually changed; the world
 * matrix is only remultiplied when the local matrix or an ancestor changed.
 * A monotonically increasing `_worldVersion` lets the renderer cache derived
 * data (normal matrix, world bounding sphere, instance buffers) per object.
 */
class Object3D extends EventDispatcher {
	constructor() {
		super();
		this.isObject3D = true;
		Object.defineProperty(this, 'id', { value: _object3DId++ });
		this.uuid = MathUtils.generateUUID();
		this.name = '';
		this.type = 'Object3D';
		this.parent = null;
		this.children = [];
		this.up = Object3D.DEFAULT_UP.clone();

		const position = new Vector3();
		const rotation = new Euler();
		const quaternion = new Quaternion();
		const scale = new Vector3(1, 1, 1);

		function onRotationChange() { quaternion.setFromEuler(rotation, false); }
		function onQuaternionChange() { rotation.setFromQuaternion(quaternion, undefined, false); }
		rotation._onChange(onRotationChange);
		quaternion._onChange(onQuaternionChange);

		// slab-backed matrices
		const slot = transformSlab.allocate(this);
		this._slabData = slot.page.data;
		this._slabOffset = slot.offset;
		const matrix = new Matrix4(this._slabData.subarray(slot.offset + LOCAL_OFFSET, slot.offset + LOCAL_OFFSET + 16));
		const matrixWorld = new Matrix4(this._slabData.subarray(slot.offset + WORLD_OFFSET, slot.offset + WORLD_OFFSET + 16));

		Object.defineProperties(this, {
			position: { configurable: true, enumerable: true, value: position },
			rotation: { configurable: true, enumerable: true, value: rotation },
			quaternion: { configurable: true, enumerable: true, value: quaternion },
			scale: { configurable: true, enumerable: true, value: scale },
			modelViewMatrix: { value: new Matrix4() },
			normalMatrix: { value: new Matrix3() },
		});

		this._matrix = matrix;
		this._matrixWorld = matrixWorld;

		// change-detection snapshot (NaN forces the first compose)
		this._px = NaN; this._py = 0; this._pz = 0;
		this._qx = 0; this._qy = 0; this._qz = 0; this._qw = 1;
		this._sx = 1; this._sy = 1; this._sz = 1;
		this._worldVersion = 0;
		this._parentWorldVersion = -1;
		// renderer scratch (initialised here so every Object3D shares one hidden class)
		this._normalVersion = -1;
		this._cullVersion = -1; this._cullSphere = null; this._cullRadius = 0; this._cullCx = 0; this._cullCy = 0; this._cullCz = 0;

		this.matrixAutoUpdate = Object3D.DEFAULT_MATRIX_AUTO_UPDATE;
		this.matrixWorldAutoUpdate = Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE;
		this.matrixWorldNeedsUpdate = false;

		this.layers = new Layers();
		this.visible = true;
		this.castShadow = false;
		this.receiveShadow = false;
		this.frustumCulled = true;
		this.renderOrder = 0;
		this.animations = [];
		this.customDepthMaterial = undefined;
		this.customDistanceMaterial = undefined;
		this.userData = {};
	}

	// `matrix` / `matrixWorld` keep their slab storage even if assigned to.
	get matrix() { return this._matrix; }
	set matrix(m) { if (m !== this._matrix) this._matrix.copy(m); }
	get matrixWorld() { return this._matrixWorld; }
	set matrixWorld(m) { if (m !== this._matrixWorld) { this._matrixWorld.copy(m); this._worldVersion++; } }

	onBeforeShadow() {}
	onAfterShadow() {}
	onBeforeRender() {}
	onAfterRender() {}

	applyMatrix4(matrix) {
		if (this.matrixAutoUpdate) this.updateMatrix();
		this._matrix.premultiply(matrix);
		this._matrix.decompose(this.position, this.quaternion, this.scale);
		this._px = NaN; // force the next updateMatrix() to recompose from TRS, as three.js does
		this.matrixWorldNeedsUpdate = true;
	}
	applyQuaternion(q) { this.quaternion.premultiply(q); return this; }
	setRotationFromAxisAngle(axis, angle) { this.quaternion.setFromAxisAngle(axis, angle); }
	setRotationFromEuler(euler) { this.quaternion.setFromEuler(euler, true); }
	setRotationFromMatrix(m) { this.quaternion.setFromRotationMatrix(m); }
	setRotationFromQuaternion(q) { this.quaternion.copy(q); }
	rotateOnAxis(axis, angle) { _q1.setFromAxisAngle(axis, angle); this.quaternion.multiply(_q1); return this; }
	rotateOnWorldAxis(axis, angle) { _q1.setFromAxisAngle(axis, angle); this.quaternion.premultiply(_q1); return this; }
	rotateX(angle) { return this.rotateOnAxis(_xAxis, angle); }
	rotateY(angle) { return this.rotateOnAxis(_yAxis, angle); }
	rotateZ(angle) { return this.rotateOnAxis(_zAxis, angle); }
	translateOnAxis(axis, distance) {
		_v1.copy(axis).applyQuaternion(this.quaternion);
		this.position.add(_v1.multiplyScalar(distance));
		return this;
	}
	translateX(d) { return this.translateOnAxis(_xAxis, d); }
	translateY(d) { return this.translateOnAxis(_yAxis, d); }
	translateZ(d) { return this.translateOnAxis(_zAxis, d); }
	localToWorld(vector) { this.updateWorldMatrix(true, false); return vector.applyMatrix4(this._matrixWorld); }
	worldToLocal(vector) { this.updateWorldMatrix(true, false); return vector.applyMatrix4(_m1.copy(this._matrixWorld).invert()); }
	lookAt(x, y, z) {
		if (x.isVector3) _target.copy(x); else _target.set(x, y, z);
		const parent = this.parent;
		this.updateWorldMatrix(true, false);
		_position.setFromMatrixPosition(this._matrixWorld);
		if (this.isCamera || this.isLight) _m1.lookAt(_position, _target, this.up);
		else _m1.lookAt(_target, _position, this.up);
		this.quaternion.setFromRotationMatrix(_m1);
		if (parent) {
			_m1.extractRotation(parent.matrixWorld);
			_q1.setFromRotationMatrix(_m1);
			this.quaternion.premultiply(_q1.invert());
		}
	}
	add(object) {
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) this.add(arguments[i]);
			return this;
		}
		if (object === this) { console.error('Object3D.add: object can\'t be added as a child of itself.', object); return this; }
		if (object && object.isObject3D) {
			object.removeFromParent();
			object.parent = this;
			this.children.push(object);
			object.matrixWorldNeedsUpdate = true;
			object.dispatchEvent(_addedEvent);
			_childaddedEvent.child = object;
			this.dispatchEvent(_childaddedEvent);
			_childaddedEvent.child = null;
		} else {
			console.error('Object3D.add: object not an instance of Object3D.', object);
		}
		return this;
	}
	remove(object) {
		if (arguments.length > 1) {
			for (let i = 0; i < arguments.length; i++) this.remove(arguments[i]);
			return this;
		}
		const index = this.children.indexOf(object);
		if (index !== -1) {
			object.parent = null;
			this.children.splice(index, 1);
			object.dispatchEvent(_removedEvent);
			_childremovedEvent.child = object;
			this.dispatchEvent(_childremovedEvent);
			_childremovedEvent.child = null;
		}
		return this;
	}
	removeFromParent() { const parent = this.parent; if (parent !== null) parent.remove(this); return this; }
	clear() { return this.remove(...this.children); }
	attach(object) {
		this.updateWorldMatrix(true, false);
		_m1.copy(this._matrixWorld).invert();
		if (object.parent !== null) {
			object.parent.updateWorldMatrix(true, false);
			_m1.multiply(object.parent.matrixWorld);
		}
		object.applyMatrix4(_m1);
		object.removeFromParent();
		object.parent = this;
		this.children.push(object);
		object.updateWorldMatrix(false, true);
		object.dispatchEvent(_addedEvent);
		_childaddedEvent.child = object;
		this.dispatchEvent(_childaddedEvent);
		_childaddedEvent.child = null;
		return this;
	}
	getObjectById(id) { return this.getObjectByProperty('id', id); }
	getObjectByName(name) { return this.getObjectByProperty('name', name); }
	getObjectByProperty(name, value) {
		if (this[name] === value) return this;
		for (let i = 0, l = this.children.length; i < l; i++) {
			const object = this.children[i].getObjectByProperty(name, value);
			if (object !== undefined) return object;
		}
		return undefined;
	}
	getObjectsByProperty(name, value, result = []) {
		if (this[name] === value) result.push(this);
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) children[i].getObjectsByProperty(name, value, result);
		return result;
	}
	getWorldPosition(target) { this.updateWorldMatrix(true, false); return target.setFromMatrixPosition(this._matrixWorld); }
	getWorldQuaternion(target) { this.updateWorldMatrix(true, false); this._matrixWorld.decompose(_position, target, _scale); return target; }
	getWorldScale(target) { this.updateWorldMatrix(true, false); this._matrixWorld.decompose(_position, _quaternion, target); return target; }
	getWorldDirection(target) {
		this.updateWorldMatrix(true, false);
		const e = this._matrixWorld.elements;
		return target.set(e[8], e[9], e[10]).normalize();
	}
	raycast() {}
	traverse(callback) {
		callback(this);
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) children[i].traverse(callback);
	}
	traverseVisible(callback) {
		if (this.visible === false) return;
		callback(this);
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) children[i].traverseVisible(callback);
	}
	traverseAncestors(callback) {
		const parent = this.parent;
		if (parent !== null) { callback(parent); parent.traverseAncestors(callback); }
	}

	_snapshot() {
		const p = this.position, q = this.quaternion, s = this.scale;
		this._px = p.x; this._py = p.y; this._pz = p.z;
		this._qx = q._x; this._qy = q._y; this._qz = q._z; this._qw = q._w;
		this._sx = s.x; this._sy = s.y; this._sz = s.z;
	}

	/**
	 * Recompose the local matrix from position/quaternion/scale, but only if
	 * one of them changed since the last call. Returns true when it did.
	 */
	updateMatrix() {
		const p = this.position, q = this.quaternion, s = this.scale;
		if (p.x === this._px && p.y === this._py && p.z === this._pz &&
			q._x === this._qx && q._y === this._qy && q._z === this._qz && q._w === this._qw &&
			s.x === this._sx && s.y === this._sy && s.z === this._sz) {
			return false;
		}
		this._px = p.x; this._py = p.y; this._pz = p.z;
		this._qx = q._x; this._qy = q._y; this._qz = q._z; this._qw = q._w;
		this._sx = s.x; this._sy = s.y; this._sz = s.z;

		// inlined Matrix4.compose
		const te = this._matrix.elements;
		const x = q._x, y = q._y, z = q._z, w = q._w;
		const x2 = x + x, y2 = y + y, z2 = z + z;
		const xx = x * x2, xy = x * y2, xz = x * z2;
		const yy = y * y2, yz = y * z2, zz = z * z2;
		const wx = w * x2, wy = w * y2, wz = w * z2;
		const sx = s.x, sy = s.y, sz = s.z;
		te[0] = (1 - (yy + zz)) * sx; te[1] = (xy + wz) * sx; te[2] = (xz - wy) * sx; te[3] = 0;
		te[4] = (xy - wz) * sy; te[5] = (1 - (xx + zz)) * sy; te[6] = (yz + wx) * sy; te[7] = 0;
		te[8] = (xz + wy) * sz; te[9] = (yz - wx) * sz; te[10] = (1 - (xx + yy)) * sz; te[11] = 0;
		te[12] = p.x; te[13] = p.y; te[14] = p.z; te[15] = 1;

		this.matrixWorldNeedsUpdate = true;
		return true;
	}

	updateMatrixWorld(force) {
		if (this.matrixAutoUpdate) this.updateMatrix();
		const parent = this.parent;
		if (this.matrixWorldNeedsUpdate || force || (parent !== null && parent._worldVersion !== this._parentWorldVersion)) {
			if (this.matrixWorldAutoUpdate === true) {
				if (parent === null) this._matrixWorld.copy(this._matrix);
				else { this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix); this._parentWorldVersion = parent._worldVersion; }
				this._worldVersion++;
			}
			this.matrixWorldNeedsUpdate = false;
			force = true;
		}
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) {
			const child = children[i];
			child.updateMatrixWorld(force);
		}
	}

	updateWorldMatrix(updateParents, updateChildren) {
		const parent = this.parent;
		if (updateParents === true && parent !== null) parent.updateWorldMatrix(true, false);
		if (this.matrixAutoUpdate) this.updateMatrix();
		let changed = false;
		if (this.matrixWorldAutoUpdate === true) {
			if (this.matrixWorldNeedsUpdate || (parent !== null && parent._worldVersion !== this._parentWorldVersion) || this._worldVersion === 0) {
				if (parent === null) this._matrixWorld.copy(this._matrix);
				else { this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix); this._parentWorldVersion = parent._worldVersion; }
				this._worldVersion++;
				changed = true;
			}
			this.matrixWorldNeedsUpdate = false;
		}
		if (updateChildren === true) {
			const children = this.children;
			for (let i = 0, l = children.length; i < l; i++) children[i].updateWorldMatrix(false, true);
		}
	}

	toJSON() {
		return {
			metadata: { version: 4.6, type: 'Object', generator: 'jrs' },
			object: { uuid: this.uuid, type: this.type, name: this.name, layers: this.layers.mask, matrix: this._matrix.toArray(), up: this.up.toArray(), userData: this.userData }
		};
	}
	clone(recursive) { return new this.constructor().copy(this, recursive); }
	copy(source, recursive = true) {
		this.name = source.name;
		this.up.copy(source.up);
		this.position.copy(source.position);
		this.rotation.order = source.rotation.order;
		this.quaternion.copy(source.quaternion);
		this.scale.copy(source.scale);
		this._matrix.copy(source._matrix);
		this._matrixWorld.copy(source._matrixWorld);
		this._snapshot();
		this.matrixAutoUpdate = source.matrixAutoUpdate;
		this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
		this.matrixWorldNeedsUpdate = true;
		this.layers.mask = source.layers.mask;
		this.visible = source.visible;
		this.castShadow = source.castShadow;
		this.receiveShadow = source.receiveShadow;
		this.frustumCulled = source.frustumCulled;
		this.renderOrder = source.renderOrder;
		this.animations = source.animations.slice();
		this.userData = JSON.parse(JSON.stringify(source.userData));
		if (recursive === true) {
			for (let i = 0; i < source.children.length; i++) this.add(source.children[i].clone());
		}
		return this;
	}
}

Object3D.DEFAULT_UP = /*@__PURE__*/ new Vector3(0, 1, 0);
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = true;
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true;

export { Object3D };
