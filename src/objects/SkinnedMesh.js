import { Mesh } from './Mesh.js';
import { Box3 } from '../math/Box3.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Sphere } from '../math/Sphere.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector4 } from '../math/Vector4.js';
import { Ray } from '../math/Ray.js';
import { AttachedBindMode, DetachedBindMode } from '../constants.js';

const _baseVector = /*@__PURE__*/ new Vector4();
const _skinIndex = /*@__PURE__*/ new Vector4();
const _skinWeight = /*@__PURE__*/ new Vector4();
const _vector4 = /*@__PURE__*/ new Vector4();
const _matrix4 = /*@__PURE__*/ new Matrix4();
const _vertex = /*@__PURE__*/ new Vector3();
const _sphere = /*@__PURE__*/ new Sphere();
const _inverseMatrix = /*@__PURE__*/ new Matrix4();
const _ray = /*@__PURE__*/ new Ray();

/**
 * Mesh deformed by a Skeleton (three.js API). The bind matrices are ordinary Matrix4s;
 * `bindMatrixInverse` is refreshed in updateMatrixWorld like three.js does. The renderer
 * never batches skinned meshes (each has its own bone texture).
 */
class SkinnedMesh extends Mesh {
	constructor(geometry, material) {
		super(geometry, material);
		this.isSkinnedMesh = true;
		this.type = 'SkinnedMesh';
		this.bindMode = AttachedBindMode;
		this.bindMatrix = new Matrix4();
		this.bindMatrixInverse = new Matrix4();
		this.boundingBox = null;
		this.boundingSphere = null;
		// version counters so the renderer re-sends bindMatrix / bindMatrixInverse only when they changed
		this._bindVersion = 0;
		this._bindInverseWorldVersion = -1;
	}
	computeBoundingBox() {
		const geometry = this.geometry;
		if (this.boundingBox === null) this.boundingBox = new Box3();
		this.boundingBox.makeEmpty();
		const positionAttribute = geometry.getAttribute('position');
		for (let i = 0; i < positionAttribute.count; i++) { this.getVertexPosition(i, _vertex); this.boundingBox.expandByPoint(_vertex); }
	}
	computeBoundingSphere() {
		const geometry = this.geometry;
		if (this.boundingSphere === null) this.boundingSphere = new Sphere();
		this.boundingSphere.makeEmpty();
		const positionAttribute = geometry.getAttribute('position');
		for (let i = 0; i < positionAttribute.count; i++) { this.getVertexPosition(i, _vertex); this.boundingSphere.expandByPoint(_vertex); }
	}
	copy(source, recursive) {
		super.copy(source, recursive);
		this.bindMode = source.bindMode;
		this.bindMatrix.copy(source.bindMatrix);
		this.bindMatrixInverse.copy(source.bindMatrixInverse);
		this.skeleton = source.skeleton;
		if (source.boundingBox !== null) this.boundingBox = source.boundingBox.clone();
		if (source.boundingSphere !== null) this.boundingSphere = source.boundingSphere.clone();
		this._bindVersion++;
		return this;
	}
	raycast(raycaster, intersects) {
		const material = this.material;
		const matrixWorld = this.matrixWorld;
		if (material === undefined) return;
		if (this.boundingSphere === null) this.computeBoundingSphere();
		_sphere.copy(this.boundingSphere);
		_sphere.applyMatrix4(matrixWorld);
		if (raycaster.ray.intersectsSphere(_sphere) === false) return;
		_inverseMatrix.copy(matrixWorld).invert();
		_ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
		if (this.boundingBox !== null) { if (_ray.intersectsBox(this.boundingBox) === false) return; }
		this._computeIntersections(raycaster, intersects, _ray);
	}
	getVertexPosition(index, target) {
		super.getVertexPosition(index, target);
		this.applyBoneTransform(index, target);
		return target;
	}
	bind(skeleton, bindMatrix) {
		this.skeleton = skeleton;
		if (bindMatrix === undefined) {
			this.updateMatrixWorld(true);
			this.skeleton.calculateInverses();
			bindMatrix = this.matrixWorld;
		}
		this.bindMatrix.copy(bindMatrix);
		this.bindMatrixInverse.copy(bindMatrix).invert();
		this._bindVersion++;
		this._bindInverseWorldVersion = -1;
	}
	pose() { this.skeleton.pose(); }
	normalizeSkinWeights() {
		const vector = new Vector4();
		const skinWeight = this.geometry.attributes.skinWeight;
		for (let i = 0, l = skinWeight.count; i < l; i++) {
			vector.fromBufferAttribute(skinWeight, i);
			const scale = 1.0 / vector.manhattanLength();
			if (scale !== Infinity) vector.multiplyScalar(scale);
			else vector.set(1, 0, 0, 0);
			skinWeight.setXYZW(i, vector.x, vector.y, vector.z, vector.w);
		}
	}
	updateMatrixWorld(force) {
		super.updateMatrixWorld(force);
		this._updateBindMatrixInverse();
	}
	updateWorldMatrix(updateParents, updateChildren) {
		super.updateWorldMatrix(updateParents, updateChildren);
		this._updateBindMatrixInverse();
	}
	/** bindMatrixInverse follows the world matrix in attached mode; recomputed only when the world matrix changed. */
	_updateBindMatrixInverse() {
		if (this.bindMode === AttachedBindMode) {
			if (this._bindInverseWorldVersion !== this._worldVersion) {
				this.bindMatrixInverse.copy(this.matrixWorld).invert();
				this._bindInverseWorldVersion = this._worldVersion;
				this._bindVersion++;
			}
		} else if (this.bindMode === DetachedBindMode) {
			if (this._bindInverseWorldVersion !== -3) {
				this.bindMatrixInverse.copy(this.bindMatrix).invert();
				this._bindInverseWorldVersion = -3;
				this._bindVersion++;
			}
		} else {
			console.warn('SkinnedMesh: Unrecognized bindMode: ' + this.bindMode);
		}
	}
	applyBoneTransform(index, target) {
		const skeleton = this.skeleton;
		const geometry = this.geometry;
		_skinIndex.fromBufferAttribute(geometry.attributes.skinIndex, index);
		_skinWeight.fromBufferAttribute(geometry.attributes.skinWeight, index);
		if (target.isVector4) {
			_baseVector.copy(target);
			target.set(0, 0, 0, 0);
		} else {
			_baseVector.set(target.x, target.y, target.z, 1);
			target.set(0, 0, 0);
		}
		_baseVector.applyMatrix4(this.bindMatrix);
		for (let i = 0; i < 4; i++) {
			const weight = _skinWeight.getComponent(i);
			if (weight !== 0) {
				const boneIndex = _skinIndex.getComponent(i);
				_matrix4.multiplyMatrices(skeleton.bones[boneIndex].matrixWorld, skeleton.boneInverses[boneIndex]);
				target.addScaledVector(_vector4.copy(_baseVector).applyMatrix4(_matrix4), weight);
			}
		}
		if (target.isVector4) target.w = _baseVector.w;
		return target.applyMatrix4(this.bindMatrixInverse);
	}
}

export { SkinnedMesh };
