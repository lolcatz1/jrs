import { clamp } from './MathUtils.js';

class Vector4 {
	constructor(x = 0, y = 0, z = 0, w = 1) {
		this.isVector4 = true;
		this.x = x; this.y = y; this.z = z; this.w = w;
	}
	get width() { return this.z; }
	set width(v) { this.z = v; }
	get height() { return this.w; }
	set height(v) { this.w = v; }
	set(x, y, z, w) { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
	setScalar(s) { this.x = s; this.y = s; this.z = s; this.w = s; return this; }
	setX(x) { this.x = x; return this; }
	setY(y) { this.y = y; return this; }
	setZ(z) { this.z = z; return this; }
	setW(w) { this.w = w; return this; }
	setComponent(i, v) {
		switch (i) { case 0: this.x = v; break; case 1: this.y = v; break; case 2: this.z = v; break; case 3: this.w = v; break; default: throw new Error('index is out of range: ' + i); }
		return this;
	}
	getComponent(i) {
		switch (i) { case 0: return this.x; case 1: return this.y; case 2: return this.z; case 3: return this.w; default: throw new Error('index is out of range: ' + i); }
	}
	clone() { return new this.constructor(this.x, this.y, this.z, this.w); }
	copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; this.w = v.w !== undefined ? v.w : 1; return this; }
	add(v) { this.x += v.x; this.y += v.y; this.z += v.z; this.w += v.w; return this; }
	addScalar(s) { this.x += s; this.y += s; this.z += s; this.w += s; return this; }
	addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; this.z = a.z + b.z; this.w = a.w + b.w; return this; }
	addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; this.w += v.w * s; return this; }
	sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; this.w -= v.w; return this; }
	subScalar(s) { this.x -= s; this.y -= s; this.z -= s; this.w -= s; return this; }
	subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; this.w = a.w - b.w; return this; }
	multiply(v) { this.x *= v.x; this.y *= v.y; this.z *= v.z; this.w *= v.w; return this; }
	multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; this.w *= s; return this; }
	applyMatrix4(m) {
		const x = this.x, y = this.y, z = this.z, w = this.w, e = m.elements;
		this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
		this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
		this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
		this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
		return this;
	}
	divide(v) { this.x /= v.x; this.y /= v.y; this.z /= v.z; this.w /= v.w; return this; }
	divideScalar(s) { return this.multiplyScalar(1 / s); }
	setAxisAngleFromQuaternion(q) {
		this.w = 2 * Math.acos(q.w);
		const s = Math.sqrt(1 - q.w * q.w);
		if (s < 0.0001) { this.x = 1; this.y = 0; this.z = 0; } else { this.x = q.x / s; this.y = q.y / s; this.z = q.z / s; }
		return this;
	}
	min(v) { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); this.w = Math.min(this.w, v.w); return this; }
	max(v) { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); this.w = Math.max(this.w, v.w); return this; }
	clamp(min, max) {
		this.x = clamp(this.x, min.x, max.x); this.y = clamp(this.y, min.y, max.y);
		this.z = clamp(this.z, min.z, max.z); this.w = clamp(this.w, min.w, max.w);
		return this;
	}
	clampScalar(minVal, maxVal) {
		this.x = clamp(this.x, minVal, maxVal); this.y = clamp(this.y, minVal, maxVal);
		this.z = clamp(this.z, minVal, maxVal); this.w = clamp(this.w, minVal, maxVal);
		return this;
	}
	clampLength(min, max) { const l = this.length(); return this.divideScalar(l || 1).multiplyScalar(clamp(l, min, max)); }
	floor() { this.x = Math.floor(this.x); this.y = Math.floor(this.y); this.z = Math.floor(this.z); this.w = Math.floor(this.w); return this; }
	ceil() { this.x = Math.ceil(this.x); this.y = Math.ceil(this.y); this.z = Math.ceil(this.z); this.w = Math.ceil(this.w); return this; }
	round() { this.x = Math.round(this.x); this.y = Math.round(this.y); this.z = Math.round(this.z); this.w = Math.round(this.w); return this; }
	roundToZero() { this.x = Math.trunc(this.x); this.y = Math.trunc(this.y); this.z = Math.trunc(this.z); this.w = Math.trunc(this.w); return this; }
	negate() { this.x = -this.x; this.y = -this.y; this.z = -this.z; this.w = -this.w; return this; }
	dot(v) { return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w; }
	lengthSq() { return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w; }
	length() { return Math.sqrt(this.lengthSq()); }
	manhattanLength() { return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w); }
	normalize() { return this.divideScalar(this.length() || 1); }
	setLength(l) { return this.normalize().multiplyScalar(l); }
	lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; this.z += (v.z - this.z) * a; this.w += (v.w - this.w) * a; return this; }
	lerpVectors(v1, v2, a) {
		this.x = v1.x + (v2.x - v1.x) * a; this.y = v1.y + (v2.y - v1.y) * a;
		this.z = v1.z + (v2.z - v1.z) * a; this.w = v1.w + (v2.w - v1.w) * a;
		return this;
	}
	equals(v) { return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w; }
	fromArray(array, offset = 0) { this.x = array[offset]; this.y = array[offset + 1]; this.z = array[offset + 2]; this.w = array[offset + 3]; return this; }
	toArray(array = [], offset = 0) { array[offset] = this.x; array[offset + 1] = this.y; array[offset + 2] = this.z; array[offset + 3] = this.w; return array; }
	fromBufferAttribute(attribute, index) {
		this.x = attribute.getX(index); this.y = attribute.getY(index); this.z = attribute.getZ(index); this.w = attribute.getW(index);
		return this;
	}
	random() { this.x = Math.random(); this.y = Math.random(); this.z = Math.random(); this.w = Math.random(); return this; }
	*[Symbol.iterator]() { yield this.x; yield this.y; yield this.z; yield this.w; }
}

export { Vector4 };
