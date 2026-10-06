import { WebGLCoordinateSystem } from '../constants.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Vector3 } from '../math/Vector3.js';
import { Quaternion } from '../math/Quaternion.js';

const _position = /*@__PURE__*/ new Vector3();
const _quaternion = /*@__PURE__*/ new Quaternion();
const _scale = /*@__PURE__*/ new Vector3();
const _one = /*@__PURE__*/ new Vector3(1, 1, 1);

class Camera extends Object3D {
	constructor() {
		super();
		this.isCamera = true;
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
		this.matrixWorld.decompose(_position, _quaternion, _scale);
		if (_scale.x === 1 && _scale.y === 1 && _scale.z === 1) this.matrixWorldInverse.copy(this.matrixWorld).invert();
		else this.matrixWorldInverse.compose(_position, _quaternion, _one).invert();
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
