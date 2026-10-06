import { Vector2 } from '../math/Vector2.js';
import { Vector3 } from '../math/Vector3.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Triangle } from '../math/Triangle.js';
import { Object3D } from '../core/Object3D.js';
import { BufferGeometry } from '../core/BufferGeometry.js';
import { Float32BufferAttribute } from '../core/BufferAttribute.js';
import { SpriteMaterial } from '../materials/SpriteMaterial.js';

let _geometry;
const _intersectPoint = /*@__PURE__*/ new Vector3();
const _worldScale = /*@__PURE__*/ new Vector3();
const _mvPosition = /*@__PURE__*/ new Vector3();
const _alignedPosition = /*@__PURE__*/ new Vector2();
const _rotatedPosition = /*@__PURE__*/ new Vector2();
const _viewWorldMatrix = /*@__PURE__*/ new Matrix4();
const _vA = /*@__PURE__*/ new Vector3();
const _vB = /*@__PURE__*/ new Vector3();
const _vC = /*@__PURE__*/ new Vector3();
const _uvA = /*@__PURE__*/ new Vector2();
const _uvB = /*@__PURE__*/ new Vector2();
const _uvC = /*@__PURE__*/ new Vector2();

class Sprite extends Object3D {
	constructor(material = new SpriteMaterial()) {
		super();
		this.isSprite = true;
		this.type = 'Sprite';
		if (_geometry === undefined) {
			_geometry = new BufferGeometry();
			const float32Array = new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, 0.5, 0.5, 0, 1, 1, -0.5, 0.5, 0, 0, 1]);
			_geometry.setIndex([0, 1, 2, 0, 2, 3]);
			const pos = new Float32Array(12), uv = new Float32Array(8);
			for (let i = 0; i < 4; i++) { pos[i * 3] = float32Array[i * 5]; pos[i * 3 + 1] = float32Array[i * 5 + 1]; pos[i * 3 + 2] = float32Array[i * 5 + 2]; uv[i * 2] = float32Array[i * 5 + 3]; uv[i * 2 + 1] = float32Array[i * 5 + 4]; }
			_geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
			_geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
		}
		this.geometry = _geometry;
		this.material = material;
		this.center = new Vector2(0.5, 0.5);
	}
	raycast(raycaster, intersects) {
		if (raycaster.camera === null) console.error('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');
		_worldScale.setFromMatrixScale(this.matrixWorld);
		_viewWorldMatrix.copy(raycaster.camera.matrixWorld);
		this.modelViewMatrix.multiplyMatrices(raycaster.camera.matrixWorldInverse, this.matrixWorld);
		_mvPosition.setFromMatrixPosition(this.modelViewMatrix);
		if (raycaster.camera.isPerspectiveCamera && this.material.sizeAttenuation === false) _worldScale.multiplyScalar(-_mvPosition.z);
		const rotation = this.material.rotation;
		let sin, cos;
		if (rotation !== 0) { cos = Math.cos(rotation); sin = Math.sin(rotation); }
		const center = this.center;
		transformVertex(_vA.set(-0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
		transformVertex(_vB.set(0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
		transformVertex(_vC.set(0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
		_uvA.set(0, 0); _uvB.set(1, 0); _uvC.set(1, 1);
		let intersect = raycaster.ray.intersectTriangle(_vA, _vB, _vC, false, _intersectPoint);
		if (intersect === null) {
			transformVertex(_vB.set(-0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
			_uvB.set(0, 1);
			intersect = raycaster.ray.intersectTriangle(_vA, _vC, _vB, false, _intersectPoint);
			if (intersect === null) return;
		}
		const distance = raycaster.ray.origin.distanceTo(_intersectPoint);
		if (distance < raycaster.near || distance > raycaster.far) return;
		intersects.push({ distance: distance, point: _intersectPoint.clone(), uv: Triangle.getInterpolation(_intersectPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2()), face: null, object: this });
	}
	copy(source, recursive) {
		super.copy(source, recursive);
		if (source.center !== undefined) this.center.copy(source.center);
		this.material = source.material;
		return this;
	}
}

function transformVertex(vertexPosition, mvPosition, center, scale, sin, cos) {
	_alignedPosition.subVectors(vertexPosition, center).addScalar(0.5).multiply(scale);
	if (sin !== undefined) {
		_rotatedPosition.x = (cos * _alignedPosition.x) - (sin * _alignedPosition.y);
		_rotatedPosition.y = (sin * _alignedPosition.x) + (cos * _alignedPosition.y);
	} else {
		_rotatedPosition.copy(_alignedPosition);
	}
	vertexPosition.copy(mvPosition);
	vertexPosition.x += _rotatedPosition.x;
	vertexPosition.y += _rotatedPosition.y;
	vertexPosition.applyMatrix4(_viewWorldMatrix);
}

export { Sprite };
