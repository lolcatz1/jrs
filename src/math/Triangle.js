import { Vector3 } from './Vector3.js';
import { Vector4 } from './Vector4.js';

const _v0 = /*@__PURE__*/ new Vector3();
const _v1 = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();
const _v3 = /*@__PURE__*/ new Vector3();
const _vab = /*@__PURE__*/ new Vector3();
const _vac = /*@__PURE__*/ new Vector3();
const _vbc = /*@__PURE__*/ new Vector3();
const _vap = /*@__PURE__*/ new Vector3();
const _vbp = /*@__PURE__*/ new Vector3();
const _vcp = /*@__PURE__*/ new Vector3();
const _v40 = /*@__PURE__*/ new Vector4();
const _v41 = /*@__PURE__*/ new Vector4();
const _v42 = /*@__PURE__*/ new Vector4();

class Triangle {
	constructor(a = new Vector3(), b = new Vector3(), c = new Vector3()) { this.a = a; this.b = b; this.c = c; }
	static getNormal(a, b, c, target) {
		target.subVectors(c, b); _v0.subVectors(a, b); target.cross(_v0);
		const targetLengthSq = target.lengthSq();
		if (targetLengthSq > 0) return target.multiplyScalar(1 / Math.sqrt(targetLengthSq));
		return target.set(0, 0, 0);
	}
	static getBarycoord(point, a, b, c, target) {
		_v0.subVectors(c, a); _v1.subVectors(b, a); _v2.subVectors(point, a);
		const dot00 = _v0.dot(_v0), dot01 = _v0.dot(_v1), dot02 = _v0.dot(_v2), dot11 = _v1.dot(_v1), dot12 = _v1.dot(_v2);
		const denom = (dot00 * dot11 - dot01 * dot01);
		if (denom === 0) { target.set(0, 0, 0); return null; }
		const invDenom = 1 / denom;
		const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
		const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
		return target.set(1 - u - v, v, u);
	}
	static containsPoint(point, a, b, c) {
		if (this.getBarycoord(point, a, b, c, _v3) === null) return false;
		return (_v3.x >= 0) && (_v3.y >= 0) && ((_v3.x + _v3.y) <= 1);
	}
	static getInterpolation(point, p1, p2, p3, v1, v2, v3, target) {
		if (this.getBarycoord(point, p1, p2, p3, _v3) === null) {
			target.x = 0; target.y = 0; if ('z' in target) target.z = 0; if ('w' in target) target.w = 0;
			return null;
		}
		target.setScalar(0);
		target.addScaledVector(v1, _v3.x); target.addScaledVector(v2, _v3.y); target.addScaledVector(v3, _v3.z);
		return target;
	}
	static getInterpolatedAttribute(attr, i1, i2, i3, barycoord, target) {
		_v40.setScalar(0); _v41.setScalar(0); _v42.setScalar(0);
		_v40.fromBufferAttribute(attr, i1); _v41.fromBufferAttribute(attr, i2); _v42.fromBufferAttribute(attr, i3);
		target.setScalar(0);
		target.addScaledVector(_v40, barycoord.x); target.addScaledVector(_v41, barycoord.y); target.addScaledVector(_v42, barycoord.z);
		return target;
	}
	static isFrontFacing(a, b, c, direction) {
		_v0.subVectors(c, b); _v1.subVectors(a, b);
		return (_v0.cross(_v1).dot(direction) < 0) ? true : false;
	}
	set(a, b, c) { this.a.copy(a); this.b.copy(b); this.c.copy(c); return this; }
	setFromPointsAndIndices(points, i0, i1, i2) { this.a.copy(points[i0]); this.b.copy(points[i1]); this.c.copy(points[i2]); return this; }
	setFromAttributeAndIndices(attribute, i0, i1, i2) {
		this.a.fromBufferAttribute(attribute, i0); this.b.fromBufferAttribute(attribute, i1); this.c.fromBufferAttribute(attribute, i2);
		return this;
	}
	clone() { return new this.constructor().copy(this); }
	copy(t) { this.a.copy(t.a); this.b.copy(t.b); this.c.copy(t.c); return this; }
	getArea() { _v0.subVectors(this.c, this.b); _v1.subVectors(this.a, this.b); return _v0.cross(_v1).length() * 0.5; }
	getMidpoint(target) { return target.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3); }
	getNormal(target) { return Triangle.getNormal(this.a, this.b, this.c, target); }
	getPlane(target) { return target.setFromCoplanarPoints(this.a, this.b, this.c); }
	getBarycoord(point, target) { return Triangle.getBarycoord(point, this.a, this.b, this.c, target); }
	getInterpolation(point, v1, v2, v3, target) { return Triangle.getInterpolation(point, this.a, this.b, this.c, v1, v2, v3, target); }
	containsPoint(point) { return Triangle.containsPoint(point, this.a, this.b, this.c); }
	isFrontFacing(direction) { return Triangle.isFrontFacing(this.a, this.b, this.c, direction); }
	intersectsBox(box) { return box.intersectsTriangle(this); }
	closestPointToPoint(p, target) {
		const a = this.a, b = this.b, c = this.c;
		let v, w;
		_vab.subVectors(b, a); _vac.subVectors(c, a); _vap.subVectors(p, a);
		const d1 = _vab.dot(_vap), d2 = _vac.dot(_vap);
		if (d1 <= 0 && d2 <= 0) return target.copy(a);
		_vbp.subVectors(p, b);
		const d3 = _vab.dot(_vbp), d4 = _vac.dot(_vbp);
		if (d3 >= 0 && d4 <= d3) return target.copy(b);
		const vc = d1 * d4 - d3 * d2;
		if (vc <= 0 && d1 >= 0 && d3 <= 0) { v = d1 / (d1 - d3); return target.copy(a).addScaledVector(_vab, v); }
		_vcp.subVectors(p, c);
		const d5 = _vab.dot(_vcp), d6 = _vac.dot(_vcp);
		if (d6 >= 0 && d5 <= d6) return target.copy(c);
		const vb = d5 * d2 - d1 * d6;
		if (vb <= 0 && d2 >= 0 && d6 <= 0) { w = d2 / (d2 - d6); return target.copy(a).addScaledVector(_vac, w); }
		const va = d3 * d6 - d5 * d4;
		if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) { _vbc.subVectors(c, b); w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return target.copy(b).addScaledVector(_vbc, w); }
		const denom = 1 / (va + vb + vc);
		v = vb * denom; w = vc * denom;
		return target.copy(a).addScaledVector(_vab, v).addScaledVector(_vac, w);
	}
	equals(t) { return t.a.equals(this.a) && t.b.equals(this.b) && t.c.equals(this.c); }
}

export { Triangle };
