import { Vector3 } from '../math/Vector3.js';
import { Vector2 } from '../math/Vector2.js';
import { Box3 } from '../math/Box3.js';
import { EventDispatcher } from './EventDispatcher.js';
import { BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from './BufferAttribute.js';
import { Sphere } from '../math/Sphere.js';
import { Object3D } from './Object3D.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Matrix3 } from '../math/Matrix3.js';
import * as MathUtils from '../math/MathUtils.js';
import { MeshBVH } from './MeshBVH.js';

let _id = 0;

const _m1 = /*@__PURE__*/ new Matrix4();
const _obj = /*@__PURE__*/ new Object3D();
const _offset = /*@__PURE__*/ new Vector3();
const _box = /*@__PURE__*/ new Box3();
const _boxMorphTargets = /*@__PURE__*/ new Box3();
const _vector = /*@__PURE__*/ new Vector3();

function arrayNeedsUint32(array) {
	for (let i = array.length - 1; i >= 0; --i) if (array[i] >= 65535) return true;
	return false;
}

class BufferGeometry extends EventDispatcher {
	constructor() {
		super();
		this.isBufferGeometry = true;
		Object.defineProperty(this, 'id', { value: _id++ });
		this.uuid = MathUtils.generateUUID();
		this.name = '';
		this.type = 'BufferGeometry';
		this.index = null;
		this.indirect = null;
		this.attributes = {};
		this.morphAttributes = {};
		this.morphTargetsRelative = false;
		this.groups = [];
		this.boundingBox = null;
		this.boundingSphere = null;
		this.drawRange = { start: 0, count: Infinity };
		this.userData = {};
		/** Lazily built bounding volume hierarchy used by Mesh.raycast. */
		this.boundsTree = null;
		/** Bumped whenever attributes/index are (re)assigned so the renderer can rebuild VAOs. */
		this._layoutVersion = 0;
		this._frameStamp = -1; this._frameRid = 0;
	}
	getIndex() { return this.index; }
	setIndex(index) {
		if (Array.isArray(index)) this.index = new (arrayNeedsUint32(index) ? Uint32BufferAttribute : Uint16BufferAttribute)(index, 1);
		else this.index = index;
		this._layoutVersion++;
		this.boundsTree = null;
		return this;
	}
	setIndirect(indirect) { this.indirect = indirect; return this; }
	getIndirect() { return this.indirect; }
	getAttribute(name) { return this.attributes[name]; }
	setAttribute(name, attribute) {
		this.attributes[name] = attribute;
		this._layoutVersion++;
		if (name === 'position') this.boundsTree = null;
		return this;
	}
	deleteAttribute(name) { delete this.attributes[name]; this._layoutVersion++; return this; }
	hasAttribute(name) { return this.attributes[name] !== undefined; }
	addGroup(start, count, materialIndex = 0) { this.groups.push({ start, count, materialIndex }); }
	clearGroups() { this.groups = []; }
	setDrawRange(start, count) { this.drawRange.start = start; this.drawRange.count = count; }
	applyMatrix4(matrix) {
		const position = this.attributes.position;
		if (position !== undefined) { position.applyMatrix4(matrix); position.needsUpdate = true; }
		const normal = this.attributes.normal;
		if (normal !== undefined) { const normalMatrix = new Matrix3().getNormalMatrix(matrix); normal.applyNormalMatrix(normalMatrix); normal.needsUpdate = true; }
		const tangent = this.attributes.tangent;
		if (tangent !== undefined) { tangent.transformDirection(matrix); tangent.needsUpdate = true; }
		if (this.boundingBox !== null) this.computeBoundingBox();
		if (this.boundingSphere !== null) this.computeBoundingSphere();
		this.boundsTree = null;
		return this;
	}
	applyQuaternion(q) { _m1.makeRotationFromQuaternion(q); this.applyMatrix4(_m1); return this; }
	rotateX(angle) { _m1.makeRotationX(angle); this.applyMatrix4(_m1); return this; }
	rotateY(angle) { _m1.makeRotationY(angle); this.applyMatrix4(_m1); return this; }
	rotateZ(angle) { _m1.makeRotationZ(angle); this.applyMatrix4(_m1); return this; }
	translate(x, y, z) { _m1.makeTranslation(x, y, z); this.applyMatrix4(_m1); return this; }
	scale(x, y, z) { _m1.makeScale(x, y, z); this.applyMatrix4(_m1); return this; }
	lookAt(vector) { _obj.lookAt(vector); _obj.updateMatrix(); this.applyMatrix4(_obj.matrix); return this; }
	center() { this.computeBoundingBox(); this.boundingBox.getCenter(_offset).negate(); this.translate(_offset.x, _offset.y, _offset.z); return this; }
	setFromPoints(points) {
		const positionAttribute = this.getAttribute('position');
		if (positionAttribute === undefined) {
			const position = [];
			for (let i = 0, l = points.length; i < l; i++) { const point = points[i]; position.push(point.x, point.y, point.z || 0); }
			this.setAttribute('position', new Float32BufferAttribute(position, 3));
		} else {
			const l = Math.min(points.length, positionAttribute.count);
			for (let i = 0; i < l; i++) { const point = points[i]; positionAttribute.setXYZ(i, point.x, point.y, point.z || 0); }
			if (points.length > positionAttribute.count) console.warn('BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.');
			positionAttribute.needsUpdate = true;
		}
		return this;
	}
	computeBoundingBox() {
		if (this.boundingBox === null) this.boundingBox = new Box3();
		const position = this.attributes.position;
		const morphAttributesPosition = this.morphAttributes.position;
		if (position && position.isGLBufferAttribute) {
			console.error('BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.', this);
			this.boundingBox.set(new Vector3(-Infinity, -Infinity, -Infinity), new Vector3(+Infinity, +Infinity, +Infinity));
			return;
		}
		if (position !== undefined) {
			this.boundingBox.setFromBufferAttribute(position);
			if (morphAttributesPosition) {
				for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
					const morphAttribute = morphAttributesPosition[i];
					_box.setFromBufferAttribute(morphAttribute);
					if (this.morphTargetsRelative) {
						_vector.addVectors(this.boundingBox.min, _box.min); this.boundingBox.expandByPoint(_vector);
						_vector.addVectors(this.boundingBox.max, _box.max); this.boundingBox.expandByPoint(_vector);
					} else {
						this.boundingBox.expandByPoint(_box.min); this.boundingBox.expandByPoint(_box.max);
					}
				}
			}
		} else {
			this.boundingBox.makeEmpty();
		}
		if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) {
			console.error('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this);
		}
	}
	computeBoundingSphere() {
		if (this.boundingSphere === null) this.boundingSphere = new Sphere();
		const position = this.attributes.position;
		const morphAttributesPosition = this.morphAttributes.position;
		if (position && position.isGLBufferAttribute) {
			console.error('BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.', this);
			this.boundingSphere.set(new Vector3(), Infinity);
			return;
		}
		if (position) {
			const center = this.boundingSphere.center;
			_box.setFromBufferAttribute(position);
			if (morphAttributesPosition) {
				for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
					const morphAttribute = morphAttributesPosition[i];
					_boxMorphTargets.setFromBufferAttribute(morphAttribute);
					if (this.morphTargetsRelative) {
						_vector.addVectors(_box.min, _boxMorphTargets.min); _box.expandByPoint(_vector);
						_vector.addVectors(_box.max, _boxMorphTargets.max); _box.expandByPoint(_vector);
					} else {
						_box.expandByPoint(_boxMorphTargets.min); _box.expandByPoint(_boxMorphTargets.max);
					}
				}
			}
			_box.getCenter(center);
			let maxRadiusSq = 0;
			const arr = position.array, n = position.count, stride = position.itemSize, cx = center.x, cy = center.y, cz = center.z;
			if (position.normalized === false) {
				for (let i = 0, o = 0; i < n; i++, o += stride) {
					const dx = arr[o] - cx, dy = arr[o + 1] - cy, dz = arr[o + 2] - cz;
					const d = dx * dx + dy * dy + dz * dz;
					if (d > maxRadiusSq) maxRadiusSq = d;
				}
			} else {
				for (let i = 0; i < n; i++) { _vector.fromBufferAttribute(position, i); maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector)); }
			}
			if (morphAttributesPosition) {
				for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
					const morphAttribute = morphAttributesPosition[i];
					const morphTargetsRelative = this.morphTargetsRelative;
					for (let j = 0, jl = morphAttribute.count; j < jl; j++) {
						_vector.fromBufferAttribute(morphAttribute, j);
						if (morphTargetsRelative) { _offset.fromBufferAttribute(position, j); _vector.add(_offset); }
						maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector));
					}
				}
			}
			this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
			if (isNaN(this.boundingSphere.radius)) {
				console.error('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
			}
		}
	}
	/** Build (or rebuild) the BVH used to accelerate raycasting. Built lazily on first raycast otherwise. */
	computeBoundsTree(options) { this.boundsTree = new MeshBVH(this, options); return this.boundsTree; }
	disposeBoundsTree() { this.boundsTree = null; }
	computeTangents() {
		const index = this.index, attributes = this.attributes;
		if (index === null || attributes.position === undefined || attributes.normal === undefined || attributes.uv === undefined) {
			console.error('BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)');
			return;
		}
		const positionAttribute = attributes.position, normalAttribute = attributes.normal, uvAttribute = attributes.uv;
		if (this.hasAttribute('tangent') === false) this.setAttribute('tangent', new BufferAttribute(new Float32Array(4 * positionAttribute.count), 4));
		const tangentAttribute = this.getAttribute('tangent');
		const tan1 = [], tan2 = [];
		for (let i = 0; i < positionAttribute.count; i++) { tan1[i] = new Vector3(); tan2[i] = new Vector3(); }
		const vA = new Vector3(), vB = new Vector3(), vC = new Vector3();
		const uvA = new Vector2(), uvB = new Vector2(), uvC = new Vector2();
		const sdir = new Vector3(), tdir = new Vector3();
		function handleTriangle(a, b, c) {
			vA.fromBufferAttribute(positionAttribute, a); vB.fromBufferAttribute(positionAttribute, b); vC.fromBufferAttribute(positionAttribute, c);
			uvA.fromBufferAttribute(uvAttribute, a); uvB.fromBufferAttribute(uvAttribute, b); uvC.fromBufferAttribute(uvAttribute, c);
			vB.sub(vA); vC.sub(vA); uvB.sub(uvA); uvC.sub(uvA);
			const r = 1.0 / (uvB.x * uvC.y - uvC.x * uvB.y);
			if (!isFinite(r)) return;
			sdir.copy(vB).multiplyScalar(uvC.y).addScaledVector(vC, -uvB.y).multiplyScalar(r);
			tdir.copy(vC).multiplyScalar(uvB.x).addScaledVector(vB, -uvC.x).multiplyScalar(r);
			tan1[a].add(sdir); tan1[b].add(sdir); tan1[c].add(sdir);
			tan2[a].add(tdir); tan2[b].add(tdir); tan2[c].add(tdir);
		}
		let groups = this.groups;
		if (groups.length === 0) groups = [{ start: 0, count: index.count }];
		for (let i = 0, il = groups.length; i < il; ++i) {
			const group = groups[i], start = group.start, count = group.count;
			for (let j = start, jl = start + count; j < jl; j += 3) handleTriangle(index.getX(j + 0), index.getX(j + 1), index.getX(j + 2));
		}
		const tmp = new Vector3(), tmp2 = new Vector3(), n = new Vector3(), n2 = new Vector3();
		function handleVertex(v) {
			n.fromBufferAttribute(normalAttribute, v); n2.copy(n);
			const t = tan1[v];
			tmp.copy(t); tmp.sub(n.multiplyScalar(n.dot(t))).normalize();
			tmp2.crossVectors(n2, t);
			const test = tmp2.dot(tan2[v]);
			const w = (test < 0.0) ? -1.0 : 1.0;
			tangentAttribute.setXYZW(v, tmp.x, tmp.y, tmp.z, w);
		}
		for (let i = 0, il = groups.length; i < il; ++i) {
			const group = groups[i], start = group.start, count = group.count;
			for (let j = start, jl = start + count; j < jl; j += 3) { handleVertex(index.getX(j + 0)); handleVertex(index.getX(j + 1)); handleVertex(index.getX(j + 2)); }
		}
	}
	computeVertexNormals() {
		const index = this.index;
		const positionAttribute = this.getAttribute('position');
		if (positionAttribute !== undefined) {
			let normalAttribute = this.getAttribute('normal');
			if (normalAttribute === undefined) {
				normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);
				this.setAttribute('normal', normalAttribute);
			} else {
				for (let i = 0, il = normalAttribute.count; i < il; i++) normalAttribute.setXYZ(i, 0, 0, 0);
			}
			const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
			const nA = new Vector3(), nB = new Vector3(), nC = new Vector3();
			const cb = new Vector3(), ab = new Vector3();
			if (index) {
				for (let i = 0, il = index.count; i < il; i += 3) {
					const vA = index.getX(i + 0), vB = index.getX(i + 1), vC = index.getX(i + 2);
					pA.fromBufferAttribute(positionAttribute, vA); pB.fromBufferAttribute(positionAttribute, vB); pC.fromBufferAttribute(positionAttribute, vC);
					cb.subVectors(pC, pB); ab.subVectors(pA, pB); cb.cross(ab);
					nA.fromBufferAttribute(normalAttribute, vA); nB.fromBufferAttribute(normalAttribute, vB); nC.fromBufferAttribute(normalAttribute, vC);
					nA.add(cb); nB.add(cb); nC.add(cb);
					normalAttribute.setXYZ(vA, nA.x, nA.y, nA.z); normalAttribute.setXYZ(vB, nB.x, nB.y, nB.z); normalAttribute.setXYZ(vC, nC.x, nC.y, nC.z);
				}
			} else {
				for (let i = 0, il = positionAttribute.count; i < il; i += 3) {
					pA.fromBufferAttribute(positionAttribute, i + 0); pB.fromBufferAttribute(positionAttribute, i + 1); pC.fromBufferAttribute(positionAttribute, i + 2);
					cb.subVectors(pC, pB); ab.subVectors(pA, pB); cb.cross(ab);
					normalAttribute.setXYZ(i + 0, cb.x, cb.y, cb.z); normalAttribute.setXYZ(i + 1, cb.x, cb.y, cb.z); normalAttribute.setXYZ(i + 2, cb.x, cb.y, cb.z);
				}
			}
			this.normalizeNormals();
			normalAttribute.needsUpdate = true;
		}
	}
	normalizeNormals() {
		const normals = this.attributes.normal;
		for (let i = 0, il = normals.count; i < il; i++) { _vector.fromBufferAttribute(normals, i); _vector.normalize(); normals.setXYZ(i, _vector.x, _vector.y, _vector.z); }
	}
	toNonIndexed() {
		function convertBufferAttribute(attribute, indices) {
			const array = attribute.array, itemSize = attribute.itemSize, normalized = attribute.normalized;
			const array2 = new array.constructor(indices.length * itemSize);
			let index = 0, index2 = 0;
			for (let i = 0, l = indices.length; i < l; i++) {
				index = attribute.isInterleavedBufferAttribute ? indices[i] * attribute.data.stride + attribute.offset : indices[i] * itemSize;
				for (let j = 0; j < itemSize; j++) array2[index2++] = array[index++];
			}
			return new BufferAttribute(array2, itemSize, normalized);
		}
		if (this.index === null) { console.warn('BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.'); return this; }
		const geometry2 = new BufferGeometry();
		const indices = this.index.array;
		const attributes = this.attributes;
		for (const name in attributes) geometry2.setAttribute(name, convertBufferAttribute(attributes[name], indices));
		const morphAttributes = this.morphAttributes;
		for (const name in morphAttributes) {
			const morphArray = [], morphAttribute = morphAttributes[name];
			for (let i = 0, il = morphAttribute.length; i < il; i++) morphArray.push(convertBufferAttribute(morphAttribute[i], indices));
			geometry2.morphAttributes[name] = morphArray;
		}
		geometry2.morphTargetsRelative = this.morphTargetsRelative;
		const groups = this.groups;
		for (let i = 0, l = groups.length; i < l; i++) { const group = groups[i]; geometry2.addGroup(group.start, group.count, group.materialIndex); }
		return geometry2;
	}
	toJSON() {
		const data = { metadata: { version: 4.6, type: 'BufferGeometry', generator: 'jrs' } };
		data.uuid = this.uuid; data.type = this.type;
		if (this.name !== '') data.name = this.name;
		if (Object.keys(this.userData).length > 0) data.userData = this.userData;
		if (this.parameters !== undefined) {
			const parameters = this.parameters;
			for (const key in parameters) if (parameters[key] !== undefined) data[key] = parameters[key];
			return data;
		}
		data.data = { attributes: {} };
		const index = this.index;
		if (index !== null) data.data.index = { type: index.array.constructor.name, array: Array.prototype.slice.call(index.array) };
		const attributes = this.attributes;
		for (const key in attributes) data.data.attributes[key] = attributes[key].toJSON(data.data);
		const groups = this.groups;
		if (groups.length > 0) data.data.groups = JSON.parse(JSON.stringify(groups));
		const boundingSphere = this.boundingSphere;
		if (boundingSphere !== null) data.data.boundingSphere = { center: boundingSphere.center.toArray(), radius: boundingSphere.radius };
		return data;
	}
	clone() { return new this.constructor().copy(this); }
	copy(source) {
		this.index = null; this.attributes = {}; this.morphAttributes = {}; this.groups = [];
		this.boundingBox = null; this.boundingSphere = null; this.boundsTree = null;
		const data = {};
		this.name = source.name;
		const index = source.index;
		if (index !== null) this.setIndex(index.clone());
		const attributes = source.attributes;
		for (const name in attributes) this.setAttribute(name, attributes[name].clone(data));
		const morphAttributes = source.morphAttributes;
		for (const name in morphAttributes) {
			const array = [], morphAttribute = morphAttributes[name];
			for (let i = 0, l = morphAttribute.length; i < l; i++) array.push(morphAttribute[i].clone(data));
			this.morphAttributes[name] = array;
		}
		this.morphTargetsRelative = source.morphTargetsRelative;
		const groups = source.groups;
		for (let i = 0, l = groups.length; i < l; i++) { const group = groups[i]; this.addGroup(group.start, group.count, group.materialIndex); }
		const boundingBox = source.boundingBox;
		if (boundingBox !== null) this.boundingBox = boundingBox.clone();
		const boundingSphere = source.boundingSphere;
		if (boundingSphere !== null) this.boundingSphere = boundingSphere.clone();
		this.drawRange.start = source.drawRange.start; this.drawRange.count = source.drawRange.count;
		this.userData = source.userData;
		return this;
	}
	dispose() { this.dispatchEvent({ type: 'dispose' }); }
}

export { BufferGeometry };
