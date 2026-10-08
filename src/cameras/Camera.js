import { WebGLCoordinateSystem } from '../constants.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Vector3 } from '../math/Vector3.js';
import { Quaternion } from '../math/Quaternion.js';

const _position = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
const _scale = /*@__PURE__*/ new Vector3();
const _one = /*@__PURE__*/ new Vector3(1, 1, 1);
// double-precision scratch (Matrix4 accepts external storage): the view matrix is composed and
// inverted in doubles from the camera's TRS, then rounded once, exactly like three.js's path
const _m64 = /*@__PURE__*/ new Matrix4(new Float64Array(16));

class Camera extends Object3D {
	constructor() {
		super();
		this.isCamera = true;
		this._countsWorld = false; // see epochs.js
		this.type = 'Camera';
		this.matrixWorldInverse = new Matrix4();
		this.projectionMatrix = new Matrix4();
		this.projectionMatrixInverse = new Matrix4();
		this.coordinateSystem = WebGLCoordinateSystem;
		this.reversedDepth = false;
		this._projectionVersion = 0;
		this._inverseVersion = -1;
	}
	copy(source, recursive) {
		super.copy(source, recursive);
		this.matrixWorldInverse.copy(source.matrixWorldInverse);
		this.projectionMatrix.copy(source.projectionMatrix);
		this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
		this.coordinateSystem = source.coordinateSystem;
		this._projectionVersion++;
		return this;
	}
	getWorldDirection(target) {
		this.updateWorldMatrix(true, false);
		const e = this.matrixWorld.elements;
		return target.set(-e[8], -e[9], -e[10]).normalize();
	}
	/** View matrix excludes world scale (glTF conformance), like three.js. */
	_updateInverse() {
		if (this._inverseVersion === this._worldVersion) return;
		if (this.parent === null && this.matrixAutoUpdate === true) {
			// parentless camera: world = compose(position, quaternion, scale); build the inverse in doubles
			_m64.compose(this.position, this.quaternion, _one).invert();
			this.matrixWorldInverse.copy(_m64);
		} else {
			this.matrixWorld.decompose(_position, _quaternion, _scale);
			if (_scale.x === 1 && _scale.y === 1 && _scale.z === 1) _m64.copy(this.matrixWorld).invert();
			else _m64.compose(_position, _quaternion, _one).invert();
			this.matrixWorldInverse.copy(_m64);
		}
		this._inverseVersion = this._worldVersion;
	}
	updateMatrixWorld(force) {
		super.updateMatrixWorld(force);
		this._updateInverse();
	}
	updateWorldMatrix(updateParents, updateChildren) {
		super.updateWorldMatrix(updateParents, updateChildren);
		this._updateInverse();
	}
	clone() { return new this.constructor().copy(this); }
}

export { Camera };
