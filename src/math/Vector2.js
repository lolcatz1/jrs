import { clamp } from './MathUtils.js';

class Vector2 {
	constructor(x = 0, y = 0) {
		this.isVector2 = true;
		this.x = x;
		this.y = y;
	}
	get width() { return this.x; }
	set width(v) { this.x = v; }
	get height() { return this.y; }
	set height(v) { this.y = v; }
	set(x, y) { this.x = x; this.y = y; return this; }
	setScalar(s) { this.x = s; this.y = s; return this; }
	setX(x) { this.x = x; return this; }
	setY(y) { this.y = y; return this; }
	setComponent(i, v) { if (i === 0) this.x = v; else if (i === 1) this.y = v; else throw new Error('index is out of range: ' + i); return this; }
	getComponent(i) { if (i === 0) return this.x; if (i === 1) return this.y; throw new Error('index is out of range: ' + i); }
	clone() { return new this.constructor(this.x, this.y); }
	copy(v) { this.x = v.x; this.y = v.y; return this; }
	add(v) { this.x += v.x; this.y += v.y; return this; }
	addScalar(s) { this.x += s; this.y += s; return this; }
	addVectors(a, b) { this.x = a.x + b.x; this.y = a.y + b.y; return this; }
	addScaledVector(v, s) { this.x += v.x * s; this.y += v.y * s; return this; }
	sub(v) { this.x -= v.x; this.y -= v.y; return this; }
	subScalar(s) { this.x -= s; this.y -= s; return this; }
	subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; return this; }
	multiply(v) { this.x *= v.x; this.y *= v.y; return this; }
	multiplyScalar(s) { this.x *= s; this.y *= s; return this; }
	divide(v) { this.x /= v.x; this.y /= v.y; return this; }
	divideScalar(s) { return this.multiplyScalar(1 / s); }
	applyMatrix3(m) {
		const x = this.x, y = this.y, e = m.elements;
		this.x = e[0] * x + e[3] * y + e[6];
		this.y = e[1] * x + e[4] * y + e[7];
		return this;
	}
	min(v) { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); return this; }
	max(v) { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); return this; }
	clamp(min, max) { this.x = clamp(this.x, min.x, max.x); this.y = clamp(this.y, min.y, max.y); return this; }
	clampScalar(minVal, maxVal) { this.x = clamp(this.x, minVal, maxVal); this.y = clamp(this.y, minVal, maxVal); return this; }
	clampLength(min, max) { const l = this.length(); return this.divideScalar(l || 1).multiplyScalar(clamp(l, min, max)); }
	floor() { this.x = Math.floor(this.x); this.y = Math.floor(this.y); return this; }
	ceil() { this.x = Math.ceil(this.x); this.y = Math.ceil(this.y); return this; }
	round() { this.x = Math.round(this.x); this.y = Math.round(this.y); return this; }
	roundToZero() { this.x = Math.trunc(this.x); this.y = Math.trunc(this.y); return this; }
	negate() { this.x = -this.x; this.y = -this.y; return this; }
	dot(v) { return this.x * v.x + this.y * v.y; }
	cross(v) { return this.x * v.y - this.y * v.x; }
	lengthSq() { return this.x * this.x + this.y * this.y; }
	length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
	manhattanLength() { return Math.abs(this.x) + Math.abs(this.y); }
	normalize() { return this.divideScalar(this.length() || 1); }
	angle() { return Math.atan2(-this.y, -this.x) + Math.PI; }
	angleTo(v) {
		const d = Math.sqrt(this.lengthSq() * v.lengthSq());
		if (d === 0) return Math.PI / 2;
		return Math.acos(clamp(this.dot(v) / d, -1, 1));
	}
	distanceTo(v) { return Math.sqrt(this.distanceToSquared(v)); }
	distanceToSquared(v) { const dx = this.x - v.x, dy = this.y - v.y; return dx * dx + dy * dy; }
	manhattanDistanceTo(v) { return Math.abs(this.x - v.x) + Math.abs(this.y - v.y); }
	setLength(l) { return this.normalize().multiplyScalar(l); }
	lerp(v, a) { this.x += (v.x - this.x) * a; this.y += (v.y - this.y) * a; return this; }
	lerpVectors(v1, v2, a) { this.x = v1.x + (v2.x - v1.x) * a; this.y = v1.y + (v2.y - v1.y) * a; return this; }
	equals(v) { return v.x === this.x && v.y === this.y; }
	fromArray(array, offset = 0) { this.x = array[offset]; this.y = array[offset + 1]; return this; }
	toArray(array = [], offset = 0) { array[offset] = this.x; array[offset + 1] = this.y; return array; }
	fromBufferAttribute(attribute, index) { this.x = attribute.getX(index); this.y = attribute.getY(index); return this; }
	rotateAround(center, angle) {
		const c = Math.cos(angle), s = Math.sin(angle);
		const x = this.x - center.x, y = this.y - center.y;
		this.x = x * c - y * s + center.x;
		this.y = x * s + y * c + center.y;
		return this;
	}
	random() { this.x = Math.random(); this.y = Math.random(); return this; }
	*[Symbol.iterator]() { yield this.x; yield this.y; }
}

export { Vector2 };
