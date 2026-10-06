import { WebGLCoordinateSystem, WebGPUCoordinateSystem } from '../constants.js';
import { Vector3 } from './Vector3.js';
import { Sphere } from './Sphere.js';
import { Plane } from './Plane.js';

const _sphere = /*@__PURE__*/ new Sphere();
const _vector = /*@__PURE__*/ new Vector3();

/**
 * Frustum keeps a flat Float32Array mirror of its six planes so the renderer
 * can cull world-space spheres straight from slab memory without touching
 * Plane/Vector3 objects (see intersectsSphereFlat).
 */
class Frustum {
	constructor(p0 = new Plane(), p1 = new Plane(), p2 = new Plane(), p3 = new Plane(), p4 = new Plane(), p5 = new Plane()) {
		this.planes = [p0, p1, p2, p3, p4, p5];
		this.flat = new Float32Array(24);
	}
	set(p0, p1, p2, p3, p4, p5) {
		const planes = this.planes;
		planes[0].copy(p0); planes[1].copy(p1); planes[2].copy(p2); planes[3].copy(p3); planes[4].copy(p4); planes[5].copy(p5);
		this._syncFlat();
		return this;
	}
	copy(frustum) {
		const planes = this.planes;
		for (let i = 0; i < 6; i++) planes[i].copy(frustum.planes[i]);
		this._syncFlat();
		return this;
	}
	setFromProjectionMatrix(m, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
		const planes = this.planes, me = m.elements;
		const me0 = me[0], me1 = me[1], me2 = me[2], me3 = me[3];
		const me4 = me[4], me5 = me[5], me6 = me[6], me7 = me[7];
		const me8 = me[8], me9 = me[9], me10 = me[10], me11 = me[11];
		const me12 = me[12], me13 = me[13], me14 = me[14], me15 = me[15];
		planes[0].setComponents(me3 - me0, me7 - me4, me11 - me8, me15 - me12).normalize();
		planes[1].setComponents(me3 + me0, me7 + me4, me11 + me8, me15 + me12).normalize();
		planes[2].setComponents(me3 + me1, me7 + me5, me11 + me9, me15 + me13).normalize();
		planes[3].setComponents(me3 - me1, me7 - me5, me11 - me9, me15 - me13).normalize();
		if (reversedDepth) {
			planes[4].setComponents(me2, me6, me10, me14).normalize();
		} else {
			planes[4].setComponents(me3 - me2, me7 - me6, me11 - me10, me15 - me14).normalize();
		}
		if (coordinateSystem === WebGLCoordinateSystem) {
			planes[5].setComponents(me3 + me2, me7 + me6, me11 + me10, me15 + me14).normalize();
		} else if (coordinateSystem === WebGPUCoordinateSystem) {
			planes[5].setComponents(me2, me6, me10, me14).normalize();
		} else {
			throw new Error('Frustum.setFromProjectionMatrix(): Invalid coordinate system: ' + coordinateSystem);
		}
		this._syncFlat();
		return this;
	}
	_syncFlat() {
		const f = this.flat, planes = this.planes;
		for (let i = 0; i < 6; i++) {
			const p = planes[i], o = i * 4;
			f[o] = p.normal.x; f[o + 1] = p.normal.y; f[o + 2] = p.normal.z; f[o + 3] = p.constant;
		}
	}
	intersectsObject(object) {
		if (object.boundingSphere !== undefined) {
			if (object.boundingSphere === null) object.computeBoundingSphere();
			_sphere.copy(object.boundingSphere).applyMatrix4(object.matrixWorld);
		} else {
			const geometry = object.geometry;
			if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
			_sphere.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld);
		}
		return this.intersectsSphere(_sphere);
	}
	intersectsSprite(sprite) {
		_sphere.center.set(0, 0, 0);
		_sphere.radius = 0.7071067811865476;
		_sphere.applyMatrix4(sprite.matrixWorld);
		return this.intersectsSphere(_sphere);
	}
	intersectsSphere(sphere) {
		const f = this.flat, c = sphere.center, negRadius = -sphere.radius;
		const x = c.x, y = c.y, z = c.z;
		for (let o = 0; o < 24; o += 4) {
			if (f[o] * x + f[o + 1] * y + f[o + 2] * z + f[o + 3] < negRadius) return false;
		}
		return true;
	}
	/** Sphere test on raw numbers; used by the renderer's culling loop. */
	intersectsSphereFlat(x, y, z, radius) {
		const f = this.flat, negRadius = -radius;
		if (f[0] * x + f[1] * y + f[2] * z + f[3] < negRadius) return false;
		if (f[4] * x + f[5] * y + f[6] * z + f[7] < negRadius) return false;
		if (f[8] * x + f[9] * y + f[10] * z + f[11] < negRadius) return false;
		if (f[12] * x + f[13] * y + f[14] * z + f[15] < negRadius) return false;
		if (f[16] * x + f[17] * y + f[18] * z + f[19] < negRadius) return false;
		if (f[20] * x + f[21] * y + f[22] * z + f[23] < negRadius) return false;
		return true;
	}
	intersectsBox(box) {
		const planes = this.planes;
		for (let i = 0; i < 6; i++) {
			const plane = planes[i];
			_vector.x = plane.normal.x > 0 ? box.max.x : box.min.x;
			_vector.y = plane.normal.y > 0 ? box.max.y : box.min.y;
			_vector.z = plane.normal.z > 0 ? box.max.z : box.min.z;
			if (plane.distanceToPoint(_vector) < 0) return false;
		}
		return true;
	}
	containsPoint(point) {
		const planes = this.planes;
		for (let i = 0; i < 6; i++) if (planes[i].distanceToPoint(point) < 0) return false;
		return true;
	}
	clone() { return new this.constructor().copy(this); }
}

export { Frustum };
