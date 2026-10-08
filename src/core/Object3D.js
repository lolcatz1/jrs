import { Quaternion } from '../math/Quaternion.js';
import { Vector3 } from '../math/Vector3.js';
import { Matrix4 } from '../math/Matrix4.js';
import { EventDispatcher } from './EventDispatcher.js';
import { Euler } from '../math/Euler.js';
import { Layers } from './Layers.js';
import { Matrix3 } from '../math/Matrix3.js';
import * as MathUtils from '../math/MathUtils.js';
import { transformSlab, LOCAL_OFFSET, WORLD_OFFSET } from './TransformSlab.js';
import { epochs, trackRenderProperty } from './epochs.js';
import { notifyAdd, notifyRemove } from './FlatGraph.js';

let _object3DId = 0;

const _v1 = /*@__PURE__*/ new Vector3();
const _q1 = /*@__PURE__*/ new Quaternion();
const _m1 = /*@__PURE__*/ new Matrix4(new Float64Array(16)); // double-precision scratch: lookAt / worldToLocal round only at the end, like three.js
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
		this._snapData = slot.page.snapshot;
		this._snapOffset = slot.snapshotOffset;
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

		// change-detection snapshot lives in the slab page (_snapData/_snapOffset); NaN forces the first compose
		this._worldVersion = 0;
		this._parentWorldVersion = -1;
		// renderer scratch (initialised here so every Object3D shares one hidden class)
		this._normalVersion = -1;
		this._flipVersion = -1; this._frontFaceCW = false;
		this._cullVersion = -1; this._cullSphere = null; // cull-cache doubles (radius, centre) live in the snapshot record at +10..+13
		// cached frustum test result per pass (0 = camera, 1 = shadow): frustum version it was computed for, and the result
		this._cullFV0 = -1; this._cullVis0 = false; this._cullFV1 = -1; this._cullVis1 = false;

		this.matrixAutoUpdate = Object3D.DEFAULT_MATRIX_AUTO_UPDATE;
		this.matrixWorldAutoUpdate = Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE;
		this.matrixWorldNeedsUpdate = false;

		this.layers = new Layers();
		this._visible = true; this._receiveShadow = false; this._frustumCulled = true; this._renderOrder = 0; // tracked accessors (see epochs.js)
		this._countsWorld = true; // Camera sets this to false: a moving camera must not look like a moving scene
		// flat scene update (see FlatGraph.js): the graph this object is an entry of and its index; roots keep their graph
		this._flat = null; this._flatIndex = -1; this._flatGraph = null;
		this.castShadow = false;
		this.animations = [];
		this.customDepthMaterial = undefined;
		this.customDistanceMaterial = undefined;
		this.userData = {};
	}

	// `matrix` / `matrixWorld` keep their slab storage even if assigned to.
	get matrix() { return this._matrix; }
	set matrix(m) { if (m !== this._matrix) this._matrix.copy(m); }
	get matrixWorld() { return this._matrixWorld; }
	set matrixWorld(m) { if (m !== this._matrixWorld) { this._matrixWorld.copy(m); this._worldVersion++; if (this._countsWorld) epochs.world++; } }

	onBeforeShadow() {}
	onAfterShadow() {}

	applyMatrix4(matrix) {
		if (this.matrixAutoUpdate) this.updateMatrix();
		this._matrix.premultiply(matrix);
		this._matrix.decompose(this.position, this.quaternion, this.scale);
		this._snapData[this._snapOffset] = NaN; // force the next updateMatrix() to recompose from TRS, as three.js does
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
		// at the root (or under an untransformed scene) the world position is the double-precision position itself
		if (this.matrixAutoUpdate === true && (parent === null || (parent.isScene === true && parent._matrixWorld.isIdentity()))) _position.copy(this.position);
		else _position.setFromMatrixPosition(this._matrixWorld);
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
			epochs.structure++;
			notifyAdd(this, object);
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
			epochs.structure++;
			notifyRemove(this, object);
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
		epochs.structure++;
		notifyAdd(this, object);
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
		const p = this.position, q = this.quaternion, s = this.scale, d = this._snapData, o = this._snapOffset;
		d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z;
		d[o + 3] = q._x; d[o + 4] = q._y; d[o + 5] = q._z; d[o + 6] = q._w;
		d[o + 7] = s.x; d[o + 8] = s.y; d[o + 9] = s.z;
	}

	/**
	 * Recompose the local matrix from position/quaternion/scale, but only if
	 * one of them changed since the last call. Returns true when it did.
	 */
	updateMatrix() {
		const p = this.position, q = this.quaternion, s = this.scale, d = this._snapData, o = this._snapOffset;
		if (p.x === d[o] && p.y === d[o + 1] && p.z === d[o + 2] &&
			q._x === d[o + 3] && q._y === d[o + 4] && q._z === d[o + 5] && q._w === d[o + 6] &&
			s.x === d[o + 7] && s.y === d[o + 8] && s.z === d[o + 9]) {
			return false;
		}
		d[o] = p.x; d[o + 1] = p.y; d[o + 2] = p.z;
		d[o + 3] = q._x; d[o + 4] = q._y; d[o + 5] = q._z; d[o + 6] = q._w;
		d[o + 7] = s.x; d[o + 8] = s.y; d[o + 9] = s.z;

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
				else this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix);
				this._worldVersion++;
				if (this._countsWorld) epochs.world++;
			}
			// also noted for a user-owned world matrix (matrixWorldAutoUpdate = false), so its children are recomputed when the
			// parent moves or the flag is set, not on every frame
			if (parent !== null) this._parentWorldVersion = parent._worldVersion;
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
				if (this._countsWorld) epochs.world++;
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

// `visible`, `renderOrder`, `frustumCulled` and `receiveShadow` decide what the renderer draws, so changing them invalidates cached render lists.
trackRenderProperty(Object3D.prototype, 'visible');
trackRenderProperty(Object3D.prototype, 'renderOrder');
trackRenderProperty(Object3D.prototype, 'frustumCulled');
trackRenderProperty(Object3D.prototype, 'receiveShadow');

// Render hooks: the first assignment on an object (which turns it from batchable into hooked) bumps the epoch and then
// becomes an ordinary own data property. Subclass methods shadow these accessors as before.
function noopHook() {}
for (const hook of ['onBeforeRender', 'onAfterRender']) {
	Object.defineProperty(Object3D.prototype, hook, {
		configurable: true, enumerable: false,
		get() { return noopHook; },
		set(fn) { epochs.structure++; Object.defineProperty(this, hook, { value: fn, writable: true, configurable: true, enumerable: true }); },
	});
}

// Flat scene update (FlatGraph.js): `_flatUMW` is the updateMatrixWorld the flat pass knows how to replace; an object whose
// `updateMatrixWorld` differs (a subclass override) is updated by calling it, recursively, for its whole subtree.
// `_flatPostUpdate` runs after the pass recomputed an object's world matrix (Camera / SkinnedMesh set it).
Object3D.prototype._flatUMW = Object3D.prototype.updateMatrixWorld;
Object3D.prototype._flatPostUpdate = null;

Object3D.DEFAULT_UP = /*@__PURE__*/ new Vector3(0, 1, 0);
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = true;
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true;

export { Object3D };
