import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three';

import * as Geometries from '../src/geometries/Geometries.js';
import { CatmullRomCurve3 } from '../src/extras/curves/CatmullRomCurve3.js';
import { LineCurve3 } from '../src/extras/curves/LineCurve3.js';
import { QuadraticBezierCurve3 } from '../src/extras/curves/QuadraticBezierCurve3.js';
import { Vector2 } from '../src/math/Vector2.js';
import { Vector3 } from '../src/math/Vector3.js';

const JRS = { ...Geometries, CatmullRomCurve3, LineCurve3, QuadraticBezierCurve3, Vector2, Vector3 };

const EPS = 1e-5;

// Recursive, prototype-agnostic comparison of `parameters` (they may hold Vector2s, curves, geometries, arrays).
function assertParamsEqual(expected, actual, path = 'parameters', seen = new Map()) {
	if (typeof expected === 'number') {
		assert.equal(typeof actual, 'number', `${path}: type`);
		if (Number.isNaN(expected)) return assert.ok(Number.isNaN(actual), `${path}: NaN`);
		assert.ok(Math.abs(expected - actual) <= 1e-9 * Math.max(1, Math.abs(expected)), `${path}: ${expected} !== ${actual}`);
		return;
	}
	if (expected === null || typeof expected !== 'object') return assert.equal(actual, expected, path);
	assert.ok(actual !== null && typeof actual === 'object', `${path}: expected object`);
	if (seen.get(expected) === actual) return;
	seen.set(expected, actual);
	if (ArrayBuffer.isView(expected) || Array.isArray(expected)) {
		assert.equal(actual.length, expected.length, `${path}.length`);
		for (let i = 0; i < expected.length; i++) assertParamsEqual(expected[i], actual[i], `${path}[${i}]`, seen);
		return;
	}
	if (expected.isBufferGeometry) return assertGeometryEqual(expected, actual, path);
	const keys = Object.keys(expected).filter((k) => !k.startsWith('_') && k !== 'uuid' && k !== 'id');
	for (const k of keys) {
		assert.ok(k in actual, `${path}.${k} missing`);
		assertParamsEqual(expected[k], actual[k], `${path}.${k}`, seen);
	}
}

function assertArrayClose(expected, actual, label) {
	assert.equal(actual.length, expected.length, `${label}: length`);
	for (let i = 0; i < expected.length; i++) {
		const e = expected[i], a = actual[i];
		if (Number.isNaN(e) && Number.isNaN(a)) continue;
		if (!(Math.abs(e - a) <= EPS)) {
			assert.fail(`${label}[${i}]: expected ${e}, got ${a}`);
		}
	}
}

function assertGeometryEqual(expected, actual, label) {
	assert.equal(actual.type, expected.type, `${label}: type`);
	assertParamsEqual(expected.parameters, actual.parameters, `${label}.parameters`);

	const names = Object.keys(expected.attributes);
	assert.deepEqual(Object.keys(actual.attributes), names, `${label}: attribute names`);
	for (const name of names) {
		const ea = expected.attributes[name], aa = actual.attributes[name];
		assert.equal(aa.itemSize, ea.itemSize, `${label}.${name}: itemSize`);
		assert.equal(aa.count, ea.count, `${label}.${name}: count`);
		assert.equal(aa.array.constructor.name, ea.array.constructor.name, `${label}.${name}: array type`);
		assertArrayClose(ea.array, aa.array, `${label}.${name}`);
	}

	if (expected.index === null) {
		assert.equal(actual.index, null, `${label}: index should be null`);
	} else {
		assert.ok(actual.index !== null, `${label}: index missing`);
		assert.equal(actual.index.itemSize, 1, `${label}: index itemSize`);
		assert.equal(actual.index.array.constructor.name, expected.index.array.constructor.name, `${label}: index array type`);
		assert.equal(actual.index.count, expected.index.count, `${label}: index count`);
		assert.deepEqual(Array.from(actual.index.array), Array.from(expected.index.array), `${label}: index values`);
	}

	assert.deepEqual(actual.groups, expected.groups, `${label}: groups`);
}

// Each case is a function receiving the library namespace (THREE or JRS) and returning constructor arguments,
// so geometry/curve/vector arguments are built with the matching library.
const latheProfile = (lib) => [new lib.Vector2(0, -1), new lib.Vector2(0.6, -0.5), new lib.Vector2(1, 0.2), new lib.Vector2(0.4, 0.8), new lib.Vector2(0.2, 1)];
const catmull = (lib, closed = false) => new lib.CatmullRomCurve3([
	new lib.Vector3(-1, -1, 0), new lib.Vector3(-0.5, 1, 0.5), new lib.Vector3(0.5, -0.5, 1), new lib.Vector3(1, 1, -0.5)
], closed);

const cases = {
	BoxGeometry: [() => [], () => [2, 3, 4, 2, 3, 4], () => [1, 1, 1, 1, 2, 3]],
	PlaneGeometry: [() => [], () => [2, 3, 4, 5]],
	SphereGeometry: [() => [], () => [2, 8, 6, 0.5, 2, 0.3, 1.5], () => [1.5, 7, 5, 0, Math.PI, 0, Math.PI / 2], () => [1, 2, 1]],
	CylinderGeometry: [() => [], () => [0.5, 1, 2, 8, 3, true, 0.5, 3], () => [0, 1, 2, 8, 2, false], () => [1, 0, 2, 6, 3, false, 0, Math.PI], () => [1, 2, 2, 5, 2, false, 0.2, 4]],
	ConeGeometry: [() => [], () => [2, 3, 8, 2, true, 0.1, 2], () => [1, 2, 7, 3]],
	TorusGeometry: [() => [], () => [2, 0.5, 6, 10, 3, 0.2, 2]],
	TorusKnotGeometry: [() => [], () => [2, 0.3, 32, 6, 3, 5]],
	CircleGeometry: [() => [], () => [2, 8, 0.5, 2]],
	RingGeometry: [() => [], () => [1, 2, 8, 3, 0.5, 2]],
	PolyhedronGeometry: [
		() => [],
		() => [[1, 1, 1, -1, -1, 1, -1, 1, -1, 1, -1, -1], [2, 1, 0, 0, 3, 2, 1, 3, 0, 2, 3, 1], 2, 2],
		() => [[1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1], [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2], 1.5, 0],
	],
	IcosahedronGeometry: [() => [], () => [2, 2], () => [1, 5]],
	OctahedronGeometry: [() => [], () => [2, 2]],
	TetrahedronGeometry: [() => [], () => [2, 3]],
	DodecahedronGeometry: [() => [], () => [2, 2]],
	CapsuleGeometry: [() => [], () => [2, 3, 3, 12, 2], () => [1, 0, 2, 5, 1]],
	LatheGeometry: [() => [], (lib) => [latheProfile(lib), 8, 0.5, 3], (lib) => [latheProfile(lib), 10, 0, 10]],
	TubeGeometry: [
		() => [],
		(lib) => [catmull(lib), 32, 0.5, 6, false],
		(lib) => [catmull(lib, true), 24, 0.3, 5, true],
		(lib) => [new lib.LineCurve3(new lib.Vector3(0, 0, 0), new lib.Vector3(1, 2, 3)), 4, 0.2, 3, false],
	],
	EdgesGeometry: [
		() => [],
		(lib) => [new lib.BoxGeometry(1, 1, 1, 2, 2, 2), 1],
		(lib) => [new lib.SphereGeometry(1, 8, 6), 20],
		(lib) => [new lib.IcosahedronGeometry(1, 1), 15],
	],
	WireframeGeometry: [
		() => [],
		(lib) => [new lib.BoxGeometry(1, 1, 1, 2, 2, 2)],
		(lib) => [new lib.TetrahedronGeometry(1, 1)],
		(lib) => [new lib.CylinderGeometry(1, 1, 2, 6, 2)],
	],
};

for (const [name, argSets] of Object.entries(cases)) {
	test(name, () => {
		assert.ok(typeof JRS[name] === 'function', `${name} is exported`);
		argSets.forEach((makeArgs, i) => {
			const expected = new THREE[name](...makeArgs(THREE));
			const actual = new JRS[name](...makeArgs(JRS));
			assertGeometryEqual(expected, actual, `${name}#${i}`);
		});
	});
}

test('Geometries barrel exports every class', () => {
	const expected = ['BoxGeometry', 'CapsuleGeometry', 'CircleGeometry', 'ConeGeometry', 'CylinderGeometry', 'DodecahedronGeometry',
		'EdgesGeometry', 'IcosahedronGeometry', 'LatheGeometry', 'OctahedronGeometry', 'PlaneGeometry', 'PolyhedronGeometry', 'RingGeometry',
		'SphereGeometry', 'TetrahedronGeometry', 'TorusGeometry', 'TorusKnotGeometry', 'TubeGeometry', 'WireframeGeometry'];
	assert.deepEqual(Object.keys(Geometries).sort(), expected.sort());
});

test('fromJSON round trips', () => {
	for (const name of ['BoxGeometry', 'SphereGeometry', 'CylinderGeometry', 'ConeGeometry', 'TorusKnotGeometry', 'IcosahedronGeometry', 'CapsuleGeometry']) {
		const g = new JRS[name]();
		const copy = JRS[name].fromJSON(g.parameters);
		assertGeometryEqual(g, copy, `${name}.fromJSON`);
	}
});

test('TubeGeometry exposes frames and large geometries use Uint32 indices like three.js', () => {
	const tube = new JRS.TubeGeometry(catmull(JRS), 8, 0.5, 4);
	assert.equal(tube.tangents.length, 9);
	assert.equal(tube.normals.length, 9);
	assert.equal(tube.binormals.length, 9);

	const big = new JRS.PlaneGeometry(1, 1, 300, 300); // 90601 vertices
	const bigThree = new THREE.PlaneGeometry(1, 1, 300, 300);
	assert.equal(big.index.array.constructor.name, bigThree.index.array.constructor.name);
	assert.equal(big.index.array.constructor, Uint32Array);
});

test('Curve interface matches three.js', () => {
	const ours = catmull(JRS), theirs = catmull(THREE);
	assertArrayClose(theirs.getLengths(), ours.getLengths(), 'getLengths');
	assert.ok(Math.abs(theirs.getLength() - ours.getLength()) < 1e-12, 'getLength');
	for (const u of [0, 0.1, 0.37, 0.5, 0.99, 1]) {
		const a = theirs.getPointAt(u), b = ours.getPointAt(u);
		assertArrayClose([a.x, a.y, a.z], [b.x, b.y, b.z], `getPointAt(${u})`);
		const ta = theirs.getTangentAt(u), tb = ours.getTangentAt(u);
		assertArrayClose([ta.x, ta.y, ta.z], [tb.x, tb.y, tb.z], `getTangentAt(${u})`);
	}
	assert.equal(ours.getPoints(7).length, 8);
	assert.equal(ours.getSpacedPoints(7).length, 8);
	ours.updateArcLengths();
	assert.equal(ours.cacheArcLengths.length, 201);
});
