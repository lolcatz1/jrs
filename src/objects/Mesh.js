import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2.js';
import { Ray } from '../math/Ray.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Object3D } from '../core/Object3D.js';
import { trackRenderProperty } from '../core/epochs.js';
import { Triangle } from '../math/Triangle.js';
import { BackSide, FrontSide } from '../constants.js';
import { MeshBasicMaterial } from '../materials/MeshBasicMaterial.js';
import { BufferGeometry } from '../core/BufferGeometry.js';
import { WORLD_OFFSET } from '../core/TransformSlab.js';
import { rayMissesWorldSphere } from '../core/RaycastUtils.js';

const _ray = /*@__PURE__*/ new Ray();
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
		this._rcSnap = null; this._rcInverse = null; // raycast: world matrix snapshot + its inverse
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
		if (material === undefined) return;
		let boundingSphere = geometry.boundingSphere;
		if (boundingSphere === null) { geometry.computeBoundingSphere(); boundingSphere = geometry.boundingSphere; }
		// world-space sphere rejection: scalar math straight from the transform slab, no objects touched
		const m = this._slabData, mo = this._slabOffset + WORLD_OFFSET;
		if (rayMissesWorldSphere(raycaster.ray, raycaster.near, raycaster.far, m, mo, boundingSphere, 0, true)) return;
		// inverse world matrix, recomputed only when the 16 world-matrix floats actually changed
		let snap = this._rcSnap, inverse = this._rcInverse;
		let changed = false;
		if (snap === null) { snap = this._rcSnap = new Float32Array(16); inverse = this._rcInverse = new Matrix4(); changed = true; }
		else {
			for (let k = 0; k < 16; k++) if (snap[k] !== m[mo + k] || snap[k] !== snap[k]) { changed = true; break; }
		}
		if (changed) {
			for (let k = 0; k < 16; k++) snap[k] = m[mo + k];
			inverse.copy(this.matrixWorld).invert();
		}
		_ray.copy(raycaster.ray).applyMatrix4(inverse);
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
		// `fast`: positions can be read straight from the typed array and rejected with scalar math
		const fast = useMorph === false && this.isSkinnedMesh !== true && position.isInterleavedBufferAttribute !== true && position.normalized !== true;
		const multi = Array.isArray(material);
		const totalCount = index !== null ? index.count : position.count;
		const triCount = totalCount / 3;
		const start = drawRange.start, end = Math.min(totalCount, drawRange.start + drawRange.count);
		const idx = index !== null ? index.array : null;

		// Lazily build / refit the BVH for anything larger than a handful of triangles.
		let bvh = null;
		if (fast) {
			bvh = geometry.boundsTree;
			if (bvh !== null && bvh.validate(geometry) === false) bvh = geometry.boundsTree = null;
			if (bvh === null && triCount > 64) bvh = geometry.computeBoundsTree();
			if (bvh !== null) {
				// the BVH addresses triangles on the 3*t grid; odd draw-range / group offsets use the plain loop
				let aligned = start % 3 === 0;
				if (aligned && multi) for (let g = 0; g < groups.length; g++) if (Math.max(groups[g].start, start) % 3 !== 0) { aligned = false; break; }
				if (!aligned) bvh = null;
			}
		}

		if (bvh !== null) {
			const o = rayLocalSpace.origin, d = rayLocalSpace.direction;
			// distance bound in local space: raycaster.far is in world units; use Infinity (the world distance test filters later)
			const n = bvh.collect(o.x, o.y, o.z, d.x, d.y, d.z, Infinity);
			if (n === 0) return;
			// three.js tests triangles in index order (or group by group); keep that order for stable ties
			const tris = n > 24 ? bvh._hits.subarray(0, n) : bvh._hits;
			if (n > 24) tris.sort();
			else for (let i = 1; i < n; i++) { const v = tris[i]; let j = i - 1; while (j >= 0 && tris[j] > v) { tris[j + 1] = tris[j]; j--; } tris[j + 1] = v; }
			const pos = position.array, stride = position.itemSize;
			if (multi) {
				for (let g = 0, gl = groups.length; g < gl; g++) {
					const group = groups[g];
					const gs = Math.max(group.start, start), ge = Math.min(totalCount, Math.min(group.start + group.count, start + drawRange.count));
					const mat = material[group.materialIndex];
					for (let k = 0; k < n; k++) {
						const t = tris[k], i = t * 3;
						if (i < gs || i >= ge) continue;
						testTriangle(this, mat, raycaster, rayLocalSpace, uv, uv1, normal, pos, stride, idx, i, t, group.materialIndex, intersects, true);
					}
				}
			} else {
				for (let k = 0; k < n; k++) {
					const t = tris[k], i = t * 3;
					if (i < start || i >= end) continue;
					testTriangle(this, material, raycaster, rayLocalSpace, uv, uv1, normal, pos, stride, idx, i, t, 0, intersects, true);
				}
			}
			return;
		}

		const pos = fast ? position.array : null, stride = position.itemSize;
		if (multi) {
			for (let g = 0, gl = groups.length; g < gl; g++) {
				const group = groups[g];
				const gs = Math.max(group.start, start), ge = Math.min(totalCount, Math.min((group.start + group.count), (start + drawRange.count)));
				const mat = material[group.materialIndex];
				for (let j = gs; j < ge; j += 3) testTriangle(this, mat, raycaster, rayLocalSpace, uv, uv1, normal, pos, stride, idx, j, Math.floor(j / 3), group.materialIndex, intersects, fast);
			}
		} else {
			for (let j = start; j < end; j += 3) testTriangle(this, material, raycaster, rayLocalSpace, uv, uv1, normal, pos, stride, idx, j, Math.floor(j / 3), 0, intersects, fast);
		}
	}
}

/**
 * Tests the triangle starting at index/vertex slot `i`. With `fast`, a scalar copy of
 * Ray.intersectTriangle (same operations in the same order, hence the same accept / reject
 * decision) rejects misses without touching a Vector3; only real hits take the full path
 * that builds the intersection record.
 */
function testTriangle(object, material, raycaster, ray, uv, uv1, normal, pos, stride, idx, i, faceIndex, materialIndex, intersects, fast) {
	if (material === undefined) return;
	let a, b, c;
	if (idx !== null) { a = idx[i]; b = idx[i + 1]; c = idx[i + 2]; } else { a = i; b = i + 1; c = i + 2; }
	if (fast) {
		const side = material.side;
		let ia = a * stride, ib = b * stride, ic = c * stride, cull;
		if (side === BackSide) { const t = ia; ia = ic; ic = t; cull = true; } else cull = side === FrontSide;
		const ax = pos[ia], ay = pos[ia + 1], az = pos[ia + 2];
		const e1x = pos[ib] - ax, e1y = pos[ib + 1] - ay, e1z = pos[ib + 2] - az;
		const e2x = pos[ic] - ax, e2y = pos[ic + 1] - ay, e2z = pos[ic + 2] - az;
		const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
		const o = ray.origin, d = ray.direction, dx = d.x, dy = d.y, dz = d.z;
		let DdN = dx * nx + dy * ny + dz * nz, sign;
		if (DdN > 0) { if (cull) return; sign = 1; } else if (DdN < 0) { sign = -1; DdN = -DdN; } else return;
		const qx = o.x - ax, qy = o.y - ay, qz = o.z - az;
		const DdQxE2 = sign * (dx * (qy * e2z - qz * e2y) + dy * (qz * e2x - qx * e2z) + dz * (qx * e2y - qy * e2x));
		if (DdQxE2 < 0) return;
		const DdE1xQ = sign * (dx * (e1y * qz - e1z * qy) + dy * (e1z * qx - e1x * qz) + dz * (e1x * qy - e1y * qx));
		if (DdE1xQ < 0) return;
		if (DdQxE2 + DdE1xQ > DdN) return;
		const QdN = -sign * (qx * nx + qy * ny + qz * nz);
		if (QdN < 0) return;
	}
	const intersection = checkGeometryIntersection(object, material, raycaster, ray, uv, uv1, normal, a, b, c, materialIndex);
	if (intersection) { intersection.faceIndex = faceIndex; intersects.push(intersection); }
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

// swapping geometry or material changes what is drawn: invalidates cached render lists
trackRenderProperty(Mesh.prototype, 'geometry');
trackRenderProperty(Mesh.prototype, 'material');

export { Mesh };
