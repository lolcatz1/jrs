const _lut = [];
for (let i = 0; i < 256; i++) _lut[i] = (i < 16 ? '0' : '') + i.toString(16);

export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

let _seed = 1234567;

export function generateUUID() {
	const d0 = Math.random() * 0xffffffff | 0;
	const d1 = Math.random() * 0xffffffff | 0;
	const d2 = Math.random() * 0xffffffff | 0;
	const d3 = Math.random() * 0xffffffff | 0;
	const uuid = _lut[d0 & 0xff] + _lut[d0 >> 8 & 0xff] + _lut[d0 >> 16 & 0xff] + _lut[d0 >> 24 & 0xff] + '-' +
		_lut[d1 & 0xff] + _lut[d1 >> 8 & 0xff] + '-' + _lut[d1 >> 16 & 0x0f | 0x40] + _lut[d1 >> 24 & 0xff] + '-' +
		_lut[d2 & 0x3f | 0x80] + _lut[d2 >> 8 & 0xff] + '-' + _lut[d2 >> 16 & 0xff] + _lut[d2 >> 24 & 0xff] +
		_lut[d3 & 0xff] + _lut[d3 >> 8 & 0xff] + _lut[d3 >> 16 & 0xff] + _lut[d3 >> 24 & 0xff];
	return uuid.toLowerCase();
}

export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function euclideanModulo(n, m) { return ((n % m) + m) % m; }
export function mapLinear(x, a1, a2, b1, b2) { return b1 + (x - a1) * (b2 - b1) / (a2 - a1); }
export function inverseLerp(x, y, value) { return x !== y ? (value - x) / (y - x) : 0; }
export function lerp(x, y, t) { return (1 - t) * x + t * y; }
export function damp(x, y, lambda, dt) { return lerp(x, y, 1 - Math.exp(-lambda * dt)); }
export function pingpong(x, length = 1) { return length - Math.abs(euclideanModulo(x, length * 2) - length); }
export function smoothstep(x, min, max) {
	if (x <= min) return 0;
	if (x >= max) return 1;
	x = (x - min) / (max - min);
	return x * x * (3 - 2 * x);
}
export function smootherstep(x, min, max) {
	if (x <= min) return 0;
	if (x >= max) return 1;
	x = (x - min) / (max - min);
	return x * x * x * (x * (x * 6 - 15) + 10);
}
export function randInt(low, high) { return low + Math.floor(Math.random() * (high - low + 1)); }
export function randFloat(low, high) { return low + Math.random() * (high - low); }
export function randFloatSpread(range) { return range * (0.5 - Math.random()); }
export function seededRandom(s) {
	if (s !== undefined) _seed = s;
	let t = _seed += 0x6D2B79F5;
	t = Math.imul(t ^ t >>> 15, t | 1);
	t ^= t + Math.imul(t ^ t >>> 7, t | 61);
	return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
export function degToRad(degrees) { return degrees * DEG2RAD; }
export function radToDeg(radians) { return radians * RAD2DEG; }
export function isPowerOfTwo(value) { return (value & (value - 1)) === 0 && value !== 0; }
export function ceilPowerOfTwo(value) { return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2)); }
export function floorPowerOfTwo(value) { return Math.pow(2, Math.floor(Math.log(value) / Math.LN2)); }
export function normalize(value, array) {
	switch (array.constructor) {
		case Float32Array: return value;
		case Uint32Array: return Math.round(value * 4294967295.0);
		case Uint16Array: return Math.round(value * 65535.0);
		case Uint8Array: case Uint8ClampedArray: return Math.round(value * 255.0);
		case Int32Array: return Math.round(value * 2147483647.0);
		case Int16Array: return Math.round(value * 32767.0);
		case Int8Array: return Math.round(value * 127.0);
		default: throw new Error('Invalid component type.');
	}
}
export function denormalize(value, array) {
	switch (array.constructor) {
		case Float32Array: return value;
		case Uint32Array: return value / 4294967295.0;
		case Uint16Array: return value / 65535.0;
		case Uint8Array: case Uint8ClampedArray: return value / 255.0;
		case Int32Array: return Math.max(value / 2147483647.0, -1.0);
		case Int16Array: return Math.max(value / 32767.0, -1.0);
		case Int8Array: return Math.max(value / 127.0, -1.0);
		default: throw new Error('Invalid component type.');
	}
}

export const MathUtils = {
	DEG2RAD, RAD2DEG, generateUUID, clamp, euclideanModulo, mapLinear, inverseLerp, lerp, damp, pingpong,
	smoothstep, smootherstep, randInt, randFloat, randFloatSpread, seededRandom, degToRad, radToDeg,
	isPowerOfTwo, ceilPowerOfTwo, floorPowerOfTwo, normalize, denormalize,
};
