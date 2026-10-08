import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2.js';
import { Sphere } from '../math/Sphere.js';
import { Ray } from '../math/Ray.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { Triangle } from '../math/Triangle.js';
import { BackSide, FrontSide } from '../constants.js';
import { MeshBasicMaterial } from '../materials/MeshBasicMaterial.js';
import { BufferGeometry } from '../core/BufferGeometry.js';

const _inverseMatrix = /*@__PURE__*/ new Matrix4();
const _ray = /*@__PURE__*/ new Ray();
const _sphere = /*@__PURE__*/ new Sphere();
const _sphereHitAt = /*@__PURE__*/ new Vector3();

const _vA = /*@__PURE__*/ new Vector3();
const _vB = /*@__PURE__*/ new Vector3();
const _vC = /*@__PURE__*/ new Vector3();
const _tempA = /*@__PURE__*/ new Vector3();
const _morphA = /*@__PURE__*/ new Vector3();
const _intersectionPoint = /*@__PURE__*/ new Vector3();
const _intersectionPointWorld = /*@__PURE__*/ new Vector3();
const _barycoord = /*@__PURE__*/ new Vector3();
const _uvA = /*@__PURE__*/ new Vector2();
const _uvB = /*@__PURE__*/ new Vector2();
const _uvC = /*@__PURE__*/ new Vector2();
const _normalA = /*@__PURE__*/ new Vector3();
const _normalB = /*@__PURE__*/ new Vector3();
const _normalC = /*@__PURE__*/ new Vector3();

class Mesh extends Object3D {
	constructor(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
		super();
		this.isMesh = true;
		this.type = 'Mesh';
		this.geometry = geometry;
		this.material = material;
		this.morphTargetInfluences = undefined;
		this.morphTargetDictionary = undefined;
		this.updateMorphTargets();
	}
	copy(source, recursive) {
		super.copy(source, recursive);
		if (source.morphTargetInfluences !== undefined) this.morphTargetInfluences = source.morphTargetInfluences.slice();
		if (source.morphTargetDictionary !== undefined) this.morphTargetDictionary = Object.assign({}, source.morphTargetDictionary);
		this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
		this.geometry = source.geometry;
		return this;
	}
	updateMorphTargets() {
		const geometry = this.geometry;
		const morphAttributes = geometry.morphAttributes;
		const keys = Object.keys(morphAttributes);
		if (keys.length > 0) {
			const morphAttribute = morphAttributes[keys[0]];
			if (morphAttribute !== undefined) {
				this.morphTargetInfluences = [];
				this.morphTargetDictionary = {};
				for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
					const name = morphAttribute[m].name || String(m);
					this.morphTargetInfluences.push(0);
					this.morphTargetDictionary[name] = m;
				}
			}
		}
	}
	getVertexPosition(index, target) {
		const geometry = this.geometry;
		const position = geometry.attributes.position;
		const morphPosition = geometry.morphAttributes.position;
		const morphTargetsRelative = geometry.morphTargetsRelative;
		target.fromBufferAttribute(position, index);
		const morphInfluences = this.morphTargetInfluences;
		if (morphPosition && morphInfluences) {
			_morphA.set(0, 0, 0);
			for (let i = 0, il = morphPosition.length; i < il; i++) {
				const influence = morphInfluences[i];
				const morphAttribute = morphPosition[i];
				if (influence === 0) continue;
				_tempA.fromBufferAttribute(morphAttribute, index);
				if (morphTargetsRelative) _morphA.addScaledVector(_tempA, influence);
				else _morphA.addScaledVector(_tempA.sub(target), influence);
			}
			target.add(_morphA);
		}
		return target;
	}
	raycast(raycaster, intersects) {
		const geometry = this.geometry;
		const material = this.material;
		const matrixWorld = this.matrixWorld;
		if (material === undefined) return;
		if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
		_sphere.copy(geometry.boundingSphere);
		_sphere.applyMatrix4(matrixWorld);
		_ray.copy(raycaster.ray);
		if (_ray.intersectsSphere(_sphere) === false) return;
		_inverseMatrix.copy(matrixWorld).invert();
		_ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
		if (geometry.boundingBox !== null) {
			if (_ray.intersectsBox(geometry.boundingBox) === false) return;
		}
		this._computeIntersections(raycaster, intersects, _ray);
	}
	_computeIntersections(raycaster, intersects, rayLocalSpace) {
		const geometry = this.geometry;
		const material = this.material;
		const index = geometry.index;
		const position = geometry.attributes.position;
		const uv = geometry.attributes.uv;
		const uv1 = geometry.attributes.uv1;
		const normal = geometry.attributes.normal;
		const groups = geometry.groups;
		const drawRange = geometry.drawRange;
		if (position === undefined) return;

		const useMorph = this.morphTargetInfluences !== undefined && geometry.morphAttributes.position !== undefined;
		// Lazily build the BVH for anything larger than a handful of triangles.
		const triCount = index !== null ? index.count / 3 : position.count / 3;
		// deformed meshes (morph targets, skinning) cannot use the static BVH
		const deformed = useMorph || this.isSkinnedMesh === true;
		if (geometry.boundsTree === null && triCount > 64 && deformed === false) geometry.computeBoundsTree();
		const bvh = deformed ? null : geometry.boundsTree;

		const start = drawRange.start, end = Math.min(index !== null ? index.count : position.count, drawRange.start + drawRange.count);

		if (bvh !== null) {
			const o = rayLocalSpace.origin, d = rayLocalSpace.direction;
			// distance bound in local space: raycaster.far is in world units; use Infinity (world test filters later)
			bvh.raycast(o.x, o.y, o.z, d.x, d.y, d.z, Infinity, (t) => {
				const i = t * 3;
				if (i < start || i + 2 >= end) return;
				let a, b, c;
				if (index !== null) { a = index.getX(i); b = index.getX(i + 1); c = index.getX(i + 2); }
				else { a = i; b = i + 1; c = i + 2; }
				let materialIndex = 0;
				if (Array.isArray(material)) {
					for (let g = 0; g < groups.length; g++) { const gr = groups[g]; if (i >= gr.start && i < gr.start + gr.count) { materialIndex = gr.materialIndex; break; } }
				}
				const mat = Array.isArray(material) ? material[materialIndex] : material;
				if (mat === undefined) return;
				const intersection = checkGeometryIntersection(this, mat, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c, materialIndex);
				if (intersection) { intersection.faceIndex = t; intersects.push(intersection); }
			});
			return;
		}

		if (index !== null) {
			if (Array.isArray(material)) {
				for (let i = 0, il = groups.length; i < il; i++) {
					const group = groups[i];
					const gs = Math.max(group.start, drawRange.start), ge = Math.min(index.count, Math.min((group.start + group.count), (drawRange.start + drawRange.count)));
					for (let j = gs, jl = ge; j < jl; j += 3) {
						const a = index.getX(j), b = index.getX(j + 1), c = index.getX(j + 2);
						const intersection = checkGeometryIntersection(this, material[group.materialIndex], raycaster, rayLocalSpace, uv, uv1, normal, a, b, c, group.materialIndex);
						if (intersection) { intersection.faceIndex = Math.floor(j / 3); intersects.push(intersection); }
					}
				}
			} else {
				for (let i = start, il = end; i < il; i += 3) {
					const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
					const intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
					if (intersection) { intersection.faceIndex = Math.floor(i / 3); intersects.push(intersection); }
				}
			}
		} else {
			if (Array.isArray(material)) {
				for (let i = 0, il = groups.length; i < il; i++) {
					const group = groups[i];
					const gs = Math.max(group.start, drawRange.start), ge = Math.min(position.count, Math.min((group.start + group.count), (drawRange.start + drawRange.count)));
					for (let j = gs, jl = ge; j < jl; j += 3) {
						const intersection = checkGeometryIntersection(this, material[group.materialIndex], raycaster, rayLocalSpace, uv, uv1, normal, j, j + 1, j + 2, group.materialIndex);
						if (intersection) { intersection.faceIndex = Math.floor(j / 3); intersects.push(intersection); }
					}
				}
			} else {
				for (let i = start, il = end; i < il; i += 3) {
					const intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, i, i + 1, i + 2);
					if (intersection) { intersection.faceIndex = Math.floor(i / 3); intersects.push(intersection); }
				}
			}
		}
	}
}

function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
	let intersect;
	if (material.side === BackSide) intersect = ray.intersectTriangle(pC, pB, pA, true, point);
	else intersect = ray.intersectTriangle(pA, pB, pC, material.side === FrontSide, point);
	if (intersect === null) return null;
	_intersectionPointWorld.copy(point);
	_intersectionPointWorld.applyMatrix4(object.matrixWorld);
	const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
	if (distance < raycaster.near || distance > raycaster.far) return null;
	return { distance: distance, point: _intersectionPointWorld.clone(), object: object };
}

function checkGeometryIntersection(object, material, raycaster, ray, uv, uv1, normal, a, b, c, materialIndex = 0) {
	object.getVertexPosition(a, _vA);
	object.getVertexPosition(b, _vB);
	object.getVertexPosition(c, _vC);
	const intersection = checkIntersection(object, material, raycaster, ray, _vA, _vB, _vC, _intersectionPoint);
	if (intersection) {
		const barycoord = new Vector3();
		Triangle.getBarycoord(_intersectionPoint, _vA, _vB, _vC, barycoord);
		if (uv) intersection.uv = Triangle.getInterpolatedAttribute(uv, a, b, c, barycoord, new Vector2());
		if (uv1) intersection.uv1 = Triangle.getInterpolatedAttribute(uv1, a, b, c, barycoord, new Vector2());
		if (normal) {
			intersection.normal = Triangle.getInterpolatedAttribute(normal, a, b, c, barycoord, new Vector3());
			if (intersection.normal.dot(ray.direction) > 0) intersection.normal.multiplyScalar(-1);
		}
		const face = { a: a, b: b, c: c, normal: new Vector3(), materialIndex: materialIndex };
		Triangle.getNormal(_vA, _vB, _vC, face.normal);
		intersection.face = face;
		intersection.barycoord = barycoord;
	}
	return intersection;
}

export { Mesh };
