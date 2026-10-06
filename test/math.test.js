import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Vector2 } from '../src/math/Vector2.js';
import { Vector3 } from '../src/math/Vector3.js';
import { Vector4 } from '../src/math/Vector4.js';
import { Matrix3 } from '../src/math/Matrix3.js';
import { Matrix4 } from '../src/math/Matrix4.js';
import { Quaternion } from '../src/math/Quaternion.js';
import { Euler } from '../src/math/Euler.js';
import { Color } from '../src/math/Color.js';
import { ColorManagement } from '../src/math/ColorManagement.js';
import { Box3 } from '../src/math/Box3.js';
import { Sphere } from '../src/math/Sphere.js';
import { Plane } from '../src/math/Plane.js';
import { Ray } from '../src/math/Ray.js';
import { Frustum } from '../src/math/Frustum.js';
import { Triangle } from '../src/math/Triangle.js';
import { Line3 } from '../src/math/Line3.js';
import { MathUtils } from '../src/math/MathUtils.js';
import { PerspectiveCamera } from '../src/cameras/PerspectiveCamera.js';
import { OrthographicCamera } from '../src/cameras/OrthographicCamera.js';
import { Object3D } from '../src/core/Object3D.js';
import { BufferGeometry } from '../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../src/core/BufferAttribute.js';
import { Mesh } from '../src/objects/Mesh.js';
import { MeshBasicMaterial } from '../src/materials/MeshBasicMaterial.js';
import { SRGBColorSpace, LinearSRGBColorSpace } from '../src/constants.js';

const OURS = {
	Vector2, Vector3, Vector4, Matrix3, Matrix4, Quaternion, Euler, Color, ColorManagement,
	Box3, Sphere, Plane, Ray, Frustum, Triangle, Line3, MathUtils,
	PerspectiveCamera, OrthographicCamera, Object3D, BufferGeometry, Float32BufferAttribute, Mesh, MeshBasicMaterial,
	SRGBColorSpace, LinearSRGBColorSpace,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** mulberry32: tiny deterministic PRNG so both libraries see identical inputs. */
function prng(seed) {
	let s = seed >>> 0;
	return function () {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}
function rand(r, lo = -1, hi = 1) { return lo + r() * (hi - lo); }
function rv3(r, lo = -5, hi = 5) { return [rand(r, lo, hi), rand(r, lo, hi), rand(r, lo, hi)]; }
const ORDERS = ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'];

function near(a, b, eps, path) {
	if (a === b) return; // covers +-Infinity
	const tol = eps * Math.max(1, Math.abs(a), Math.abs(b));
	assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol, `${path}: ${a} vs ${b} (tol ${tol})`);
}

/** Structural comparison of ours vs THREE results within a relative tolerance. */
function assertClose(a, b, eps = 1e-5, path = 'result') {
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
		if (typeof a === 'number' && typeof b === 'number') return near(a, b, eps, path);
		return assert.equal(a, b, path);
	}
	const cmpKeys = (keys) => { for (const k of keys) assertClose(a[k], b[k], eps, path + '.' + k); };
	if (a.isQuaternion || a.isVector4) return cmpKeys(['x', 'y', 'z', 'w']);
	if (a.isVector3) return cmpKeys(['x', 'y', 'z']);
	if (a.isVector2) return cmpKeys(['x', 'y']);
	if (a.isEuler) { cmpKeys(['x', 'y', 'z']); return assert.equal(a.order, b.order, path + '.order'); }
	if (a.isColor) return cmpKeys(['r', 'g', 'b']);
	if (a.isBox3) return cmpKeys(['min', 'max']);
	if (a.isSphere) return cmpKeys(['center', 'radius']);
	if (a.isPlane) return cmpKeys(['normal', 'constant']);
	if (a.elements !== undefined) return assertClose(a.elements, b.elements, eps, path + '.elements');
	if (Array.isArray(a) || ArrayBuffer.isView(a)) {
		assert.equal(a.length, b.length, path + '.length');
		for (let i = 0; i < a.length; i++) assertClose(a[i], b[i], eps, `${path}[${i}]`);
		return;
	}
	const keysOf = (o) => Object.keys(o).filter((k) => typeof o[k] !== 'function' && !k.startsWith('_') && !k.startsWith('is')).sort();
	assert.deepEqual(keysOf(a), keysOf(b), path + ' keys');
	cmpKeys(keysOf(a));
}

const SEED = 0xC0FFEE;
/** Run `fn(lib, rng)` against our library and THREE with the same seed; compare results. */
function compare(fn, eps = 1e-5) {
	const ours = fn(OURS, prng(SEED));
	const theirs = fn(THREE, prng(SEED));
	assertClose(ours, theirs, eps);
}

function randomQuat(L, r) { return new L.Quaternion().setFromEuler(new L.Euler(rand(r, -Math.PI, Math.PI), rand(r, -Math.PI, Math.PI), rand(r, -Math.PI, Math.PI))); }
/** q and -q are the same rotation; THREE's slerp does not pin the sign at t = 1, so canonicalize before comparing. */
function canon(q) {
	const c = [q.x, q.y, q.z, q.w];
	const k = c.findIndex((v) => Math.abs(v) > 1e-6);
	if (k >= 0 && c[k] < 0) q.set(-q.x, -q.y, -q.z, -q.w);
	return q;
}
function randomTRS(L, r) {
	return {
		p: new L.Vector3(...rv3(r)),
		q: randomQuat(L, r),
		s: new L.Vector3(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2)),
	};
}
function randomMatrix(L, r) { const t = randomTRS(L, r); return new L.Matrix4().compose(t.p, t.q, t.s); }
function makeCamera(L, r) {
	const cam = new L.PerspectiveCamera(rand(r, 40, 80), rand(r, 1, 2), 0.1, 100);
	cam.position.set(...rv3(r, 3, 8));
	cam.lookAt(new L.Vector3(0, 0, 0));
	cam.updateMatrixWorld();
	return cam;
}
/** Hand-built indexed quad geometry (two triangles) with uvs. */
function quadGeometry(L) {
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.Float32BufferAttribute([-1, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0.25, -1, 0.5, 0.25], 3));
	g.setAttribute('uv', new L.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	return g;
}

// ---------------------------------------------------------------------------
// Vector3
// ---------------------------------------------------------------------------

test('Vector3: arithmetic and products', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 25; i++) {
			const a = new L.Vector3(...rv3(r)), b = new L.Vector3(...rv3(r));
			out.push(
				a.clone().add(b), a.clone().sub(b), a.clone().cross(b), a.dot(b),
				a.clone().normalize(), a.length(), a.lengthSq(), a.clone().multiply(b), a.clone().divide(b),
				a.clone().addScaledVector(b, rand(r)), a.clone().multiplyScalar(rand(r, -3, 3)),
				a.clone().lerp(b, rand(r, 0, 1)), new L.Vector3().lerpVectors(a, b, rand(r, 0, 1)),
				a.distanceTo(b), a.distanceToSquared(b), a.manhattanDistanceTo(b), a.manhattanLength(),
				a.angleTo(b), a.clone().reflect(b.clone().normalize()),
				a.clone().projectOnVector(b), a.clone().projectOnPlane(b.clone().normalize()),
				a.clone().negate(), a.clone().min(b), a.clone().max(b),
				a.clone().clampLength(0.5, 2), a.clone().setLength(3),
				a.clone().floor(), a.clone().ceil(), a.clone().round(), a.clone().roundToZero(),
				new L.Vector3().crossVectors(a, b), new L.Vector3().subVectors(a, b), new L.Vector3().addVectors(a, b), new L.Vector3().multiplyVectors(a, b),
				a.clone().clamp(new L.Vector3(-1, -1, -1), new L.Vector3(1, 1, 1)), a.clone().clampScalar(-2, 2),
				a.toArray(), a.getComponent(i % 3), a.clone().setComponent(i % 3, 9),
				a.clone().applyAxisAngle(b.clone().normalize(), rand(r, -3, 3)),
			);
		}
		return out;
	});
});

test('Vector3: matrix / quaternion transforms', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 20; i++) {
			const v = new L.Vector3(...rv3(r));
			const m = randomMatrix(L, r);
			const q = randomQuat(L, r);
			const e = new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3), ORDERS[i % 6]);
			const persp = new L.Matrix4().makePerspective(-1, 1, 1, -1, 0.5, 50);
			const n = new L.Matrix3().getNormalMatrix(m);
			out.push(
				v.clone().applyMatrix4(m), v.clone().applyMatrix4(persp), v.clone().applyQuaternion(q), v.clone().applyEuler(e),
				v.clone().transformDirection(m), v.clone().applyMatrix3(n), v.clone().applyNormalMatrix(n),
				new L.Vector3().setFromMatrixPosition(m), new L.Vector3().setFromMatrixScale(m),
				new L.Vector3().setFromMatrixColumn(m, i % 4), new L.Vector3().setFromMatrix3Column(n, i % 3),
				new L.Vector3().setFromEuler(e), new L.Vector3().setFromSphericalCoords(rand(r, 1, 3), rand(r, 0, Math.PI), rand(r, -3, 3)),
				new L.Vector3().setFromCylindricalCoords(rand(r, 1, 3), rand(r, -3, 3), rand(r)),
			);
		}
		return out;
	});
});

test('Vector3: project / unproject with a camera', () => {
	compare((L, r) => {
		const cam = makeCamera(L, r);
		const out = [];
		for (let i = 0; i < 10; i++) {
			const p = new L.Vector3(...rv3(r, -2, 2));
			const ndc = p.clone().project(cam);
			const back = ndc.clone().unproject(cam);
			out.push(ndc, back, back.distanceTo(p));
		}
		return out;
	}, 1e-4);
	// explicit round trip on ours
	const cam = new PerspectiveCamera(60, 1.5, 0.1, 100);
	cam.position.set(1, 2, 5); cam.lookAt(new Vector3(0, 0, 0)); cam.updateMatrixWorld();
	const p = new Vector3(0.3, -0.2, 0.7);
	const back = p.clone().project(cam).unproject(cam);
	assert.ok(back.distanceTo(p) < 1e-4);
});

// ---------------------------------------------------------------------------
// Vector2 / Vector4
// ---------------------------------------------------------------------------

test('Vector2 basics', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 20; i++) {
			const a = new L.Vector2(rand(r, -5, 5), rand(r, -5, 5)), b = new L.Vector2(rand(r, -5, 5), rand(r, -5, 5));
			const m3 = new L.Matrix3().setUvTransform(rand(r), rand(r), rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, -3, 3), 0.5, 0.5);
			out.push(
				a.clone().add(b), a.clone().sub(b), a.dot(b), a.cross(b), a.length(), a.clone().normalize(), a.angle(), a.angleTo(b),
				a.clone().rotateAround(b, rand(r, -3, 3)), a.clone().applyMatrix3(m3), a.clone().lerp(b, rand(r, 0, 1)),
				a.distanceTo(b), a.clone().multiplyScalar(rand(r)), a.clone().clampLength(0.5, 2), a.clone().setLength(2),
				a.clone().min(b), a.clone().max(b), a.clone().floor(), a.clone().negate(), a.toArray(), a.width, a.height,
			);
		}
		return out;
	});
});

test('Vector4 basics', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 20; i++) {
			const a = new L.Vector4(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			const b = new L.Vector4(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			const m = randomMatrix(L, r);
			out.push(
				a.clone().add(b), a.clone().sub(b), a.dot(b), a.length(), a.clone().normalize(), a.clone().multiplyScalar(rand(r)),
				a.clone().applyMatrix4(m), a.clone().lerp(b, rand(r, 0, 1)), a.clone().min(b), a.clone().max(b),
				new L.Vector4().setAxisAngleFromQuaternion(randomQuat(L, r)), a.clone().clampLength(1, 3), a.toArray(), a.manhattanLength(),
				new L.Vector4().copy(new L.Vector3(1, 2, 3)),
			);
		}
		return out;
	});
});

// ---------------------------------------------------------------------------
// Matrix4
// ---------------------------------------------------------------------------

test('Matrix4: compose / decompose round trip', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 15; i++) {
			const t = randomTRS(L, r);
			if (i % 5 === 0) t.s.x *= -1; // negative determinant path
			const m = new L.Matrix4().compose(t.p, t.q, t.s);
			const p = new L.Vector3(), q = new L.Quaternion(), s = new L.Vector3();
			m.decompose(p, q, s);
			out.push(m, p, q, s, p.distanceTo(t.p), s.distanceTo(t.s), Math.abs(q.dot(t.q)));
		}
		return out;
	});
	const t = randomTRS(OURS, prng(3));
	const m = new Matrix4().compose(t.p, t.q, t.s);
	const p = new Vector3(), q = new Quaternion(), s = new Vector3();
	m.decompose(p, q, s);
	assert.ok(p.distanceTo(t.p) < 1e-5 && s.distanceTo(t.s) < 1e-5 && Math.abs(q.dot(t.q)) > 1 - 1e-5);
});

test('Matrix4: products, inverse, determinant', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 15; i++) {
			const a = randomMatrix(L, r), b = randomMatrix(L, r);
			const persp = new L.Matrix4().makePerspective(rand(r, -2, -0.5), rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, -2, -0.5), rand(r, 0.1, 1), rand(r, 10, 100));
			const ortho = new L.Matrix4().makeOrthographic(rand(r, -5, -1), rand(r, 1, 5), rand(r, 1, 5), rand(r, -5, -1), rand(r, 0.1, 1), rand(r, 10, 100));
			out.push(
				new L.Matrix4().multiplyMatrices(a, b), a.clone().multiply(b), a.clone().premultiply(b),
				a.clone().invert(), persp.clone().invert(), ortho.clone().invert(),
				a.determinant(), b.determinant(), persp.determinant(),
				a.clone().multiply(a.clone().invert()), persp, ortho, a.clone().multiplyScalar(rand(r)),
				a.clone().transpose(), a.getMaxScaleOnAxis(), new L.Matrix4().extractRotation(a),
				a.clone().setPosition(new L.Vector3(...rv3(r))), a.clone().setPosition(1, 2, 3), a.clone().scale(new L.Vector3(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2))),
				new L.Matrix4().copyPosition(a), a.toArray(), new L.Matrix4().fromArray(a.toArray()),
			);
		}
		return out;
	});
	assert.deepEqual(Array.from(new Matrix4().invert().elements), Array.from(new Matrix4().elements));
	const singular = new Matrix4().makeScale(0, 1, 1);
	assert.ok(Array.from(singular.invert().elements).every((v) => v === 0));
});

test('Matrix4: rotation constructors and lookAt', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const x = rand(r, -Math.PI, Math.PI), y = rand(r, -Math.PI, Math.PI), z = rand(r, -Math.PI, Math.PI);
			for (const order of ORDERS) out.push(new L.Matrix4().makeRotationFromEuler(new L.Euler(x, y, z, order)));
			out.push(
				new L.Matrix4().makeRotationX(x), new L.Matrix4().makeRotationY(y), new L.Matrix4().makeRotationZ(z),
				new L.Matrix4().makeRotationAxis(new L.Vector3(...rv3(r)).normalize(), x),
				new L.Matrix4().makeRotationFromQuaternion(randomQuat(L, r)),
				new L.Matrix4().makeTranslation(x, y, z), new L.Matrix4().makeTranslation(new L.Vector3(x, y, z)),
				new L.Matrix4().makeScale(x, y, z), new L.Matrix4().makeShear(x, y, z, x, y, z),
				new L.Matrix4().lookAt(new L.Vector3(...rv3(r)), new L.Vector3(...rv3(r)), new L.Vector3(0, 1, 0)),
				new L.Matrix4().lookAt(new L.Vector3(0, 5, 0), new L.Vector3(0, 0, 0), new L.Vector3(0, 1, 0)), // degenerate up
				new L.Matrix4().makeBasis(new L.Vector3(...rv3(r)), new L.Vector3(...rv3(r)), new L.Vector3(...rv3(r))),
				new L.Matrix4().setFromMatrix3(new L.Matrix3().getNormalMatrix(randomMatrix(L, r))),
			);
			const bx = new L.Vector3(), by = new L.Vector3(), bz = new L.Vector3();
			randomMatrix(L, r).extractBasis(bx, by, bz);
			out.push(bx, by, bz);
		}
		return out;
	});
});

test('Matrix4: elements is a Float32Array and accepts external storage', () => {
	assert.ok(new Matrix4().elements instanceof Float32Array);
	const store = new Float32Array(16);
	const m = new Matrix4(store);
	assert.equal(m.elements, store);
	m.identity();
	assert.equal(store[0], 1);
});

// ---------------------------------------------------------------------------
// Matrix3
// ---------------------------------------------------------------------------

test('Matrix3 parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 15; i++) {
			const m4 = randomMatrix(L, r);
			const a = new L.Matrix3().setFromMatrix4(m4);
			const b = new L.Matrix3().setFromMatrix4(randomMatrix(L, r));
			out.push(
				new L.Matrix3().getNormalMatrix(m4), a.clone().invert(), a.determinant(), a.clone().transpose(),
				new L.Matrix3().setUvTransform(rand(r), rand(r), rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, -3, 3), rand(r, 0, 1), rand(r, 0, 1)),
				new L.Matrix3().multiplyMatrices(a, b), a.clone().multiply(b), a.clone().premultiply(b), a.clone().multiplyScalar(rand(r)),
				a.clone().scale(rand(r), rand(r)), a.clone().rotate(rand(r, -3, 3)), a.clone().translate(rand(r), rand(r)),
				new L.Matrix3().makeRotation(rand(r, -3, 3)), new L.Matrix3().makeScale(rand(r), rand(r)), new L.Matrix3().makeTranslation(rand(r), rand(r)),
				new L.Matrix3().makeTranslation(new L.Vector2(rand(r), rand(r))), a.toArray(), new L.Matrix3().fromArray(a.toArray()),
			);
			const arr = [];
			a.transposeIntoArray(arr);
			out.push(arr);
		}
		return out;
	});
	assert.ok(new Matrix3().elements instanceof Float32Array);
});

// ---------------------------------------------------------------------------
// Quaternion
// ---------------------------------------------------------------------------

test('Quaternion parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const x = rand(r, -Math.PI, Math.PI), y = rand(r, -Math.PI, Math.PI), z = rand(r, -Math.PI, Math.PI);
			for (const order of ORDERS) out.push(new L.Quaternion().setFromEuler(new L.Euler(x, y, z, order)));
			const qa = randomQuat(L, r), qb = randomQuat(L, r);
			const axis = new L.Vector3(...rv3(r)).normalize();
			const from = new L.Vector3(...rv3(r)).normalize(), to = new L.Vector3(...rv3(r)).normalize();
			const rot = new L.Matrix4().makeRotationFromQuaternion(qa);
			const t = rand(r, 0, 1);
			out.push(
				new L.Quaternion().setFromAxisAngle(axis, x),
				new L.Quaternion().setFromRotationMatrix(rot), new L.Quaternion().setFromRotationMatrix(randomMatrix(L, r).extractRotation(randomMatrix(L, r))),
				canon(qa.clone().slerp(qb, t)), canon(qa.clone().slerp(qb, 0)), canon(qa.clone().slerp(qb, 1)), canon(new L.Quaternion().slerpQuaternions(qa, qb, t)),
				qa.clone().multiply(qb), qa.clone().premultiply(qb), new L.Quaternion().multiplyQuaternions(qa, qb),
				new L.Quaternion().setFromUnitVectors(from, to),
				new L.Quaternion().setFromUnitVectors(new L.Vector3(0, 0, 1), new L.Vector3(0, 0, -1)),
				qa.angleTo(qb), qa.clone().invert(), qa.clone().conjugate(), qa.dot(qb), qa.length(), qa.lengthSq(),
				new L.Quaternion(x, y, z, t).normalize(), canon(qa.clone().rotateTowards(qb, rand(r, 0, 2))), qa.toArray(), new L.Quaternion().fromArray(qa.toArray()),
				qa.clone().identity(), new L.Quaternion(x, y, z, t).clone().normalize().equals(new L.Quaternion(x, y, z, t).normalize()),
			);
			const dst = new Array(8).fill(0);
			const src0 = qa.toArray(), src1 = [0, 0, 0, 0, ...qb.toArray()];
			L.Quaternion.slerpFlat(dst, 4, src0, 0, src1, 4, t);
			L.Quaternion.slerpFlat(dst, 0, src0, 0, src1, 4, 0.5);
			out.push(dst);
			const flat = new Float32Array(4);
			L.Quaternion.multiplyQuaternionsFlat(flat, 0, src0, 0, src1, 4);
			out.push(flat);
		}
		return out;
	});
});

test('Quaternion onChange callback fires', () => {
	let calls = 0;
	const q = new Quaternion()._onChange(() => calls++);
	q.x = 1; q.set(0, 0, 0, 1); q.setFromAxisAngle(new Vector3(0, 1, 0), 1); q.normalize();
	assert.equal(calls, 4);
});

// ---------------------------------------------------------------------------
// Euler
// ---------------------------------------------------------------------------

test('Euler parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const q = randomQuat(L, r);
			const m = new L.Matrix4().makeRotationFromQuaternion(q);
			for (const order of ORDERS) {
				out.push(new L.Euler().setFromQuaternion(q, order), new L.Euler().setFromRotationMatrix(m, order));
				const e = new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3), ORDERS[(i + 1) % 6]);
				out.push(e.clone().reorder(order), e.toArray());
			}
			// gimbal-lock branches
			for (const order of ORDERS) {
				const lock = new L.Matrix4().makeRotationFromEuler(new L.Euler(order[0] === 'X' ? 0 : Math.PI / 2, order[0] === 'Y' ? 0 : Math.PI / 2, 0, order));
				out.push(new L.Euler().setFromRotationMatrix(lock, order));
			}
			out.push(new L.Euler().setFromVector3(new L.Vector3(...rv3(r)), 'ZYX'), new L.Euler().fromArray([1, 2, 3, 'YXZ']));
		}
		return out;
	});
	assert.equal(Euler.DEFAULT_ORDER, THREE.Euler.DEFAULT_ORDER);
});

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

function colorScenario(L, r) {
	const out = [];
	const styles = ['#f80', '#FF8800', '#1a2b3c', 'rgb(255, 136, 0)', 'rgb(12,200,99)', 'rgb(100%, 50%, 0%)', 'rgba(10, 20, 30, 1)',
		'hsl(30, 100%, 50%)', 'hsl(210.5, 40%, 25%)', 'hsla(120, 50%, 50%, 1)', 'skyblue', 'rebeccapurple', 'Black', 'WHITE', 'cornflowerblue'];
	for (const s of styles) {
		const c = new L.Color().setStyle(s);
		out.push(c, c.getHexString(), c.getStyle(), c.getHSL({}));
	}
	for (let i = 0; i < 20; i++) {
		const hex = Math.floor(r() * 0x1000000);
		const c = new L.Color(hex);
		out.push(c, c.getHexString(), new L.Color().setHex(hex).getHex() === hex);
		const d = new L.Color(rand(r, 0, 1), rand(r, 0, 1), rand(r, 0, 1));
		out.push(
			d, d.getHex(L.LinearSRGBColorSpace) === d.getHex(L.LinearSRGBColorSpace), d.getHexString(), d.getHSL({}), d.getHSL({}, L.SRGBColorSpace), d.getRGB({}, L.SRGBColorSpace),
			new L.Color().setHSL(rand(r, -1, 2), rand(r, 0, 1), rand(r, 0, 1)), new L.Color().setHSL(0.3, 0.5, 0.5, L.SRGBColorSpace),
			c.clone().lerp(d, rand(r, 0, 1)), new L.Color().lerpColors(c, d, rand(r, 0, 1)), c.clone().lerpHSL(d, rand(r, 0, 1)),
			d.clone().convertSRGBToLinear(), d.clone().convertLinearToSRGB(), new L.Color().copySRGBToLinear(d), new L.Color().copyLinearToSRGB(d),
			d.clone().offsetHSL(0.1, -0.1, 0.05), c.clone().multiply(d), c.clone().add(d), c.clone().sub(d), d.clone().multiplyScalar(rand(r, 0, 2)),
			new L.Color().setRGB(d.r, d.g, d.b, L.SRGBColorSpace), new L.Color().setScalar(0.4), new L.Color().set(c), new L.Color().set(hex), new L.Color().set('tomato'),
			d.toArray(), new L.Color().fromArray([0.1, 0.2, 0.3]), c.equals(c.clone()), c.equals(d), new L.Color().setHex(hex, L.LinearSRGBColorSpace),
			new L.Color().setFromVector3(new L.Vector3(0.2, 0.4, 0.6)), new L.Color(0.5, 0.25, 0.125).toJSON(),
		);
	}
	return out;
}

test('Color parity with ColorManagement enabled', () => {
	assert.equal(ColorManagement.enabled, true);
	assert.equal(ColorManagement.workingColorSpace, THREE.ColorManagement.workingColorSpace);
	compare(colorScenario, 1e-6);
	const c = new Color(0x4080c0);
	assert.equal(c.getHex(), 0x4080c0);
	assert.ok(c.r < 0x40 / 255); // stored linear, so darker than the sRGB byte
	assert.equal(new Color('#f80').getHexString(), 'ff8800');
	assert.equal(new Color('rgb(255,136,0)').getHexString(), 'ff8800');
	assert.equal(new Color('hsl(32, 100%, 50%)').getHexString(), 'ff8800');
	assert.equal(new Color('darkorange').getHexString(), 'ff8c00');
});

test('Color parity with ColorManagement disabled', () => {
	compare((L, r) => {
		L.ColorManagement.enabled = false;
		try {
			const out = colorScenario(L, r);
			const c = new L.Color(0x4080c0);
			out.push(c.r === 0x40 / 255, c.getHex());
			return out;
		} finally {
			L.ColorManagement.enabled = true;
		}
	}, 1e-6);
	assert.equal(ColorManagement.enabled, true);
	assert.equal(THREE.ColorManagement.enabled, true);
});

// ---------------------------------------------------------------------------
// Box3
// ---------------------------------------------------------------------------

test('Box3 parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const pts = [];
			for (let k = 0; k < 10; k++) pts.push(new L.Vector3(...rv3(r)));
			const box = new L.Box3().setFromPoints(pts);
			const other = new L.Box3().setFromCenterAndSize(new L.Vector3(...rv3(r, -3, 3)), new L.Vector3(rand(r, 0.5, 4), rand(r, 0.5, 4), rand(r, 0.5, 4)));
			const sphere = new L.Sphere(new L.Vector3(...rv3(r, -6, 6)), rand(r, 0.5, 3));
			const plane = new L.Plane(new L.Vector3(...rv3(r)).normalize(), rand(r, -5, 5));
			const m = randomMatrix(L, r);
			const p = new L.Vector3(...rv3(r, -6, 6));
			const tri = new L.Triangle(new L.Vector3(...rv3(r, -6, 6)), new L.Vector3(...rv3(r, -6, 6)), new L.Vector3(...rv3(r, -6, 6)));
			out.push(
				box, box.intersectsBox(other), box.intersectsSphere(sphere), box.intersectsPlane(plane), box.intersectsTriangle(tri),
				box.clone().applyMatrix4(m), box.getBoundingSphere(new L.Sphere()), box.containsPoint(p), box.containsBox(other),
				box.getCenter(new L.Vector3()), box.getSize(new L.Vector3()), box.clone().union(other), box.clone().intersect(other),
				box.distanceToPoint(p), box.clampPoint(p, new L.Vector3()), box.clone().expandByScalar(0.5), box.clone().expandByVector(new L.Vector3(1, 2, 3)),
				box.clone().expandByPoint(p), box.clone().translate(p), box.getParameter(p, new L.Vector3()), box.isEmpty(), new L.Box3().isEmpty(),
				new L.Box3().setFromArray(pts.flatMap((v) => v.toArray())), box.equals(box.clone()),
			);
		}
		return out;
	});
});

test('Box3.expandByObject on a Mesh', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 6; i++) {
			const mesh = new L.Mesh(quadGeometry(L), new L.MeshBasicMaterial());
			mesh.position.set(...rv3(r)); mesh.rotation.set(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)); mesh.scale.set(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2));
			const child = new L.Mesh(quadGeometry(L), new L.MeshBasicMaterial());
			child.position.set(...rv3(r)); mesh.add(child);
			out.push(new L.Box3().setFromObject(mesh), new L.Box3().setFromObject(mesh, true), new L.Box3().expandByObject(child));
			const group = new L.Object3D(); group.position.set(...rv3(r)); group.add(mesh);
			out.push(new L.Box3().setFromObject(group), new L.Box3().setFromObject(group, true));
		}
		return out;
	});
});

// ---------------------------------------------------------------------------
// Sphere
// ---------------------------------------------------------------------------

test('Sphere parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const pts = [];
			for (let k = 0; k < 10; k++) pts.push(new L.Vector3(...rv3(r)));
			const s = new L.Sphere().setFromPoints(pts);
			const s2 = new L.Sphere().setFromPoints(pts, new L.Vector3(...rv3(r)));
			const other = new L.Sphere(new L.Vector3(...rv3(r, -6, 6)), rand(r, 0.5, 3));
			const p = new L.Vector3(...rv3(r, -8, 8));
			const m = randomMatrix(L, r);
			const plane = new L.Plane(new L.Vector3(...rv3(r)).normalize(), rand(r, -5, 5));
			out.push(
				s, s2, s.clone().union(other), s.clone().union(new L.Sphere(s.center.clone(), 10)), s.clone().union(new L.Sphere()), new L.Sphere().union(other),
				s.clone().applyMatrix4(m), s.clone().expandByPoint(p), new L.Sphere().expandByPoint(p), s.containsPoint(p), s.distanceToPoint(p),
				s.intersectsSphere(other), s.intersectsBox(new L.Box3().setFromCenterAndSize(p, new L.Vector3(2, 2, 2))), s.intersectsPlane(plane),
				s.clampPoint(p, new L.Vector3()), s.getBoundingBox(new L.Box3()), s.clone().translate(p), s.isEmpty(), new L.Sphere().isEmpty(),
				new L.Sphere().getBoundingBox(new L.Box3()), s.equals(s.clone()),
			);
		}
		return out;
	});
});

// ---------------------------------------------------------------------------
// Plane
// ---------------------------------------------------------------------------

test('Plane parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 12; i++) {
			const a = new L.Vector3(...rv3(r)), b = new L.Vector3(...rv3(r)), c = new L.Vector3(...rv3(r));
			const plane = new L.Plane().setFromCoplanarPoints(a, b, c);
			const p = new L.Vector3(...rv3(r));
			const m = randomMatrix(L, r);
			const line = new L.Line3(new L.Vector3(...rv3(r, -8, 8)), new L.Vector3(...rv3(r, -8, 8)));
			const sphere = new L.Sphere(p, rand(r, 0.5, 3));
			const box = new L.Box3().setFromCenterAndSize(p, new L.Vector3(2, 3, 1));
			const hit = plane.intersectLine(line, new L.Vector3());
			out.push(
				plane, plane.distanceToPoint(p), plane.clone().applyMatrix4(m), plane.clone().applyMatrix4(m, new L.Matrix3().getNormalMatrix(m)),
				hit, plane.intersectsLine(line), plane.projectPoint(p, new L.Vector3()), plane.coplanarPoint(new L.Vector3()),
				new L.Plane().setFromNormalAndCoplanarPoint(new L.Vector3(...rv3(r)).normalize(), p), new L.Plane(new L.Vector3(...rv3(r)), rand(r)).normalize(),
				plane.distanceToSphere(sphere), plane.intersectsSphere(sphere), plane.intersectsBox(box), plane.clone().negate(), plane.clone().translate(p),
				new L.Plane().setComponents(1, 2, 3, 4), plane.equals(plane.clone()),
				// a segment that straddles the plane and one that does not
				plane.intersectLine(new L.Line3(p, p.clone().addScaledVector(plane.normal, -2 * plane.distanceToPoint(p))), new L.Vector3()),
				plane.intersectLine(new L.Line3(p, p.clone().addScaledVector(plane.normal, 0.1 * plane.distanceToPoint(p))), new L.Vector3()),
			);
		}
		return out;
	});
});

// ---------------------------------------------------------------------------
// Ray
// ---------------------------------------------------------------------------

test('Ray parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 15; i++) {
			const origin = new L.Vector3(...rv3(r));
			const target = new L.Vector3(...rv3(r));
			const ray = new L.Ray(origin, target.clone().sub(origin).normalize());
			const sphereHit = new L.Sphere(target, rand(r, 0.2, 1));
			const sphereMiss = new L.Sphere(origin.clone().addScaledVector(ray.direction, -5), 0.5);
			const sphereInside = new L.Sphere(origin.clone(), 1);
			const boxHit = new L.Box3().setFromCenterAndSize(target, new L.Vector3(1, 1, 1));
			const boxMiss = new L.Box3().setFromCenterAndSize(origin.clone().addScaledVector(ray.direction, -5), new L.Vector3(1, 1, 1));
			// triangle around the target, CCW when seen from the origin side or not
			const n = ray.direction;
			const u = new L.Vector3(1, 0, 0).cross(n).normalize(), v = n.clone().cross(u).normalize();
			const a = target.clone().add(u.clone().multiplyScalar(-1)).add(v.clone().multiplyScalar(-1));
			const b = target.clone().add(u.clone().multiplyScalar(2)).add(v.clone().multiplyScalar(-1));
			const c = target.clone().add(v.clone().multiplyScalar(2));
			const facing = new L.Vector3().subVectors(b, a).cross(new L.Vector3().subVectors(c, a)).dot(n) < 0;
			const seg0 = new L.Vector3(...rv3(r)), seg1 = new L.Vector3(...rv3(r));
			const onRay = new L.Vector3(), onSeg = new L.Vector3();
			const m = randomMatrix(L, r);
			const plane = new L.Plane().setFromNormalAndCoplanarPoint(new L.Vector3(...rv3(r)).normalize(), target);
			out.push(
				ray.intersectSphere(sphereHit, new L.Vector3()), ray.intersectSphere(sphereMiss, new L.Vector3()), ray.intersectSphere(sphereInside, new L.Vector3()),
				ray.intersectsSphere(sphereHit), ray.intersectsSphere(sphereMiss),
				ray.intersectBox(boxHit, new L.Vector3()), ray.intersectBox(boxMiss, new L.Vector3()), ray.intersectsBox(boxHit), ray.intersectsBox(boxMiss),
				facing,
				ray.intersectTriangle(a, b, c, true, new L.Vector3()), ray.intersectTriangle(c, b, a, true, new L.Vector3()),
				ray.intersectTriangle(a, b, c, false, new L.Vector3()), ray.intersectTriangle(c, b, a, false, new L.Vector3()),
				ray.intersectTriangle(a.clone().addScaledVector(u, 10), b.clone().addScaledVector(u, 10), c.clone().addScaledVector(u, 10), false, new L.Vector3()),
				ray.distanceSqToSegment(seg0, seg1), ray.distanceSqToSegment(seg0, seg1, onRay, onSeg), onRay, onSeg,
				ray.distanceSqToSegment(seg0, seg0.clone().addScaledVector(ray.direction, 2), onRay, onSeg), onRay, onSeg, // parallel
				ray.clone().applyMatrix4(m), ray.at(rand(r, 0, 5), new L.Vector3()), ray.closestPointToPoint(seg0, new L.Vector3()),
				ray.distanceToPoint(seg0), ray.distanceSqToPoint(seg1), ray.clone().recast(2), ray.clone().lookAt(seg0),
				ray.intersectPlane(plane, new L.Vector3()), ray.intersectsPlane(plane), ray.distanceToPlane(plane), ray.equals(ray.clone()),
			);
		}
		// axis-aligned ray with zero direction components through a box
		const axisRay = new L.Ray(new L.Vector3(0.25, 0.25, -5), new L.Vector3(0, 0, 1));
		out.push(axisRay.intersectBox(new L.Box3(new L.Vector3(-1, -1, -1), new L.Vector3(1, 1, 1)), new L.Vector3()));
		out.push(axisRay.intersectBox(new L.Box3(new L.Vector3(2, 2, -1), new L.Vector3(3, 3, 1)), new L.Vector3()));
		return out;
	});
});

// ---------------------------------------------------------------------------
// Frustum
// ---------------------------------------------------------------------------

test('Frustum parity (perspective and orthographic)', () => {
	compare((L, r) => {
		const out = [];
		const cams = [makeCamera(L, r)];
		const ortho = new L.OrthographicCamera(-3, 3, 2, -2, 0.5, 20);
		ortho.position.set(...rv3(r, 2, 5)); ortho.lookAt(new L.Vector3(0, 0, 0)); ortho.updateMatrixWorld();
		cams.push(ortho);
		for (const cam of cams) {
			const vp = new L.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
			const f = new L.Frustum().setFromProjectionMatrix(vp);
			out.push(f.planes);
			let inside = 0;
			for (let i = 0; i < 60; i++) {
				const p = new L.Vector3(...rv3(r, -12, 12));
				const minDist = Math.min(...f.planes.map((pl) => Math.abs(pl.distanceToPoint(p))));
				if (minDist < 1e-3) { out.push(null); continue; }
				const c = f.containsPoint(p);
				if (c) inside++;
				out.push(c, f.intersectsSphere(new L.Sphere(p, rand(r, 0.1, 3))), f.intersectsBox(new L.Box3().setFromCenterAndSize(p, new L.Vector3(rand(r, 0.1, 3), rand(r, 0.1, 3), rand(r, 0.1, 3)))));
			}
			out.push(inside > 0);
			// points we know are inside / outside
			const ahead = cam.position.clone().addScaledVector(cam.getWorldDirection(new L.Vector3()), 5);
			out.push(f.containsPoint(ahead), f.containsPoint(cam.position.clone().addScaledVector(cam.getWorldDirection(new L.Vector3()), -5)));
			out.push(f.containsPoint(cam.position.clone()), f.intersectsSphere(new L.Sphere(cam.position.clone(), 1)));
			out.push(new L.Frustum().copy(f).planes, f.clone().planes);
		}
		return out;
	});
});

test('Frustum.intersectsSphereFlat agrees with intersectsSphere', () => {
	const r = prng(99);
	const cam = makeCamera(OURS, r);
	const f = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
	let hits = 0, misses = 0;
	for (let i = 0; i < 300; i++) {
		const c = new Vector3(...rv3(r, -12, 12));
		const rad = rand(r, 0.1, 3);
		const a = f.intersectsSphere(new Sphere(c, rad));
		const b = f.intersectsSphereFlat(c.x, c.y, c.z, rad);
		assert.equal(a, b);
		if (a) hits++; else misses++;
	}
	assert.ok(hits > 0 && misses > 0);
	assert.ok(f.flat instanceof Float32Array && f.flat.length === 24);
	const f2 = new Frustum().copy(f);
	assert.deepEqual(Array.from(f2.flat), Array.from(f.flat));
	assert.throws(() => new Frustum().setFromProjectionMatrix(new Matrix4(), 1234));
});

// ---------------------------------------------------------------------------
// Triangle
// ---------------------------------------------------------------------------

test('Triangle parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 15; i++) {
			const a = new L.Vector3(...rv3(r)), b = new L.Vector3(...rv3(r)), c = new L.Vector3(...rv3(r));
			const tri = new L.Triangle(a, b, c);
			const u = rand(r, -0.5, 1.5), v = rand(r, -0.5, 1.5);
			const inPlane = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(c.clone().sub(a), v);
			const p = new L.Vector3(...rv3(r, -8, 8));
			const corner = a.clone().addScaledVector(b.clone().sub(a), 0.25).addScaledVector(c.clone().sub(a), 0.25);
			out.push(
				tri.getNormal(new L.Vector3()), L.Triangle.getNormal(a, b, c, new L.Vector3()),
				tri.getBarycoord(inPlane, new L.Vector3()), L.Triangle.getBarycoord(p, a, b, c, new L.Vector3()),
				tri.containsPoint(inPlane), tri.containsPoint(corner), L.Triangle.containsPoint(inPlane, a, b, c),
				tri.closestPointToPoint(p, new L.Vector3()), tri.closestPointToPoint(a.clone().addScaledVector(a.clone().sub(b), 2), new L.Vector3()),
				tri.closestPointToPoint(inPlane, new L.Vector3()), tri.closestPointToPoint(corner, new L.Vector3()),
				tri.getArea(), tri.getMidpoint(new L.Vector3()), tri.getPlane(new L.Plane()), tri.isFrontFacing(p.clone().normalize()),
				tri.getInterpolation(corner, new L.Vector2(0, 0), new L.Vector2(1, 0), new L.Vector2(0, 1), new L.Vector2()),
				tri.intersectsBox(new L.Box3().setFromCenterAndSize(p, new L.Vector3(4, 4, 4))), tri.clone().equals(tri),
				new L.Triangle().setFromPointsAndIndices([a, b, c], 2, 0, 1),
			);
		}
		// degenerate triangle
		const d = new L.Triangle(new L.Vector3(0, 0, 0), new L.Vector3(1, 1, 1), new L.Vector3(2, 2, 2));
		out.push(d.getNormal(new L.Vector3()), d.getBarycoord(new L.Vector3(5, 5, 5), new L.Vector3()), d.containsPoint(new L.Vector3(0.5, 0.5, 0.5)));
		return out;
	});
});

test('Triangle.getInterpolatedAttribute parity', () => {
	compare((L) => {
		const g = quadGeometry(L);
		const uv = g.getAttribute('uv');
		const bary = new L.Vector3(0.2, 0.3, 0.5);
		return [L.Triangle.getInterpolatedAttribute(uv, 0, 1, 2, bary, new L.Vector2()), L.Triangle.getInterpolatedAttribute(g.getAttribute('position'), 0, 2, 3, bary, new L.Vector3())];
	});
});

// ---------------------------------------------------------------------------
// Line3
// ---------------------------------------------------------------------------

test('Line3 parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 10; i++) {
			const line = new L.Line3(new L.Vector3(...rv3(r)), new L.Vector3(...rv3(r)));
			const p = new L.Vector3(...rv3(r, -8, 8));
			out.push(
				line.getCenter(new L.Vector3()), line.delta(new L.Vector3()), line.distance(), line.distanceSq(), line.at(rand(r, -1, 2), new L.Vector3()),
				line.closestPointToPointParameter(p, true), line.closestPointToPointParameter(p, false),
				line.closestPointToPoint(p, true, new L.Vector3()), line.closestPointToPoint(p, false, new L.Vector3()),
				line.clone().applyMatrix4(randomMatrix(L, r)), line.equals(line.clone()),
			);
		}
		return out;
	});
});

// ---------------------------------------------------------------------------
// MathUtils
// ---------------------------------------------------------------------------

test('MathUtils parity', () => {
	compare((L, r) => {
		const M = L.MathUtils;
		const out = [M.DEG2RAD, M.RAD2DEG];
		for (let i = 0; i < 30; i++) {
			const x = rand(r, -20, 20), lo = rand(r, -5, 0), hi = rand(r, 0, 5), t = rand(r, -0.5, 1.5);
			out.push(
				M.clamp(x, lo, hi), M.euclideanModulo(x, 3), M.euclideanModulo(x, -3), M.euclideanModulo(-7, 3), M.lerp(lo, hi, t), M.inverseLerp(lo, hi, x), M.inverseLerp(2, 2, 5),
				M.mapLinear(x, lo, hi, 0, 100), M.smoothstep(x, lo, hi), M.smoothstep(t, 0, 1), M.smootherstep(t, 0, 1), M.pingpong(x, 2.5), M.pingpong(x),
				M.damp(lo, hi, 2, Math.abs(t)), M.degToRad(x), M.radToDeg(x),
			);
		}
		for (const n of [0, 1, 2, 3, 4, 5, 6, 7, 8, 15, 16, 17, 31, 32, 33, 64, 100, 128, 255, 256, 257, 1023, 1024, 1025, 65536]) {
			out.push(M.isPowerOfTwo(n), M.ceilPowerOfTwo(n), M.floorPowerOfTwo(n));
		}
		for (const arr of [new Float32Array(1), new Uint8Array(1), new Uint16Array(1), new Uint32Array(1), new Int8Array(1), new Int16Array(1), new Int32Array(1)]) {
			out.push(M.normalize(0.3, arr), M.normalize(-0.3, arr), M.denormalize(100, arr), M.denormalize(-100, arr));
		}
		out.push(M.seededRandom(42), M.seededRandom(), M.seededRandom(), M.seededRandom(7), M.seededRandom());
		return out;
	}, 1e-9);
	const uuid = MathUtils.generateUUID();
	assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
	assert.notEqual(uuid, MathUtils.generateUUID());
	assert.equal(new Set(Array.from({ length: 200 }, () => MathUtils.generateUUID())).size, 200);
	for (let i = 0; i < 50; i++) {
		const n = MathUtils.randInt(3, 7); assert.ok(n >= 3 && n <= 7 && Number.isInteger(n));
		const f = MathUtils.randFloat(-1, 1); assert.ok(f >= -1 && f < 1);
		const s = MathUtils.randFloatSpread(4); assert.ok(s >= -2 && s <= 2);
	}
});

// ---------------------------------------------------------------------------
// regression tests for divergences from THREE that were found and fixed
// ---------------------------------------------------------------------------

test('Quaternion.setFromUnitVectors handles nearly antiparallel vectors like THREE', {}, () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 40; i++) {
			const from = new L.Vector3(...rv3(r)).normalize();
			const q = new L.Quaternion().setFromUnitVectors(from, from.clone().negate());
			out.push(q.length(), from.clone().applyQuaternion(q)); // THREE: unit length and maps onto -from
		}
		return out;
	}, 1e-6);
});
