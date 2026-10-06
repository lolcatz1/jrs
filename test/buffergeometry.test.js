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
import { Box3 } from '../src/math/Box3.js';
import { Sphere } from '../src/math/Sphere.js';
import { BufferGeometry } from '../src/core/BufferGeometry.js';
import {
	BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, Uint8BufferAttribute, Int8BufferAttribute, Int16BufferAttribute,
	Uint8ClampedBufferAttribute, Int32BufferAttribute,
} from '../src/core/BufferAttribute.js';
import { MeshBVH } from '../src/core/MeshBVH.js';
import { DynamicDrawUsage, StaticDrawUsage } from '../src/constants.js';

const OURS = {
	Vector2, Vector3, Vector4, Matrix3, Matrix4, Quaternion, Euler, Box3, Sphere, BufferGeometry,
	BufferAttribute, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute, Uint8BufferAttribute, Int8BufferAttribute, Int16BufferAttribute,
	Uint8ClampedBufferAttribute, Int32BufferAttribute, DynamicDrawUsage, StaticDrawUsage,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

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

function near(a, b, eps, path) {
	if (a === b) return; // covers +-Infinity
	const tol = eps * Math.max(1, Math.abs(a), Math.abs(b));
	assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tol, `${path}: ${a} vs ${b} (tol ${tol})`);
}
function assertClose(a, b, eps = 1e-5, path = 'result') {
	if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
		if (typeof a === 'number' && typeof b === 'number') return near(a, b, eps, path);
		return assert.equal(a, b, path);
	}
	const cmpKeys = (keys) => { for (const k of keys) assertClose(a[k], b[k], eps, path + '.' + k); };
	if (a.isQuaternion || a.isVector4) return cmpKeys(['x', 'y', 'z', 'w']);
	if (a.isVector3) return cmpKeys(['x', 'y', 'z']);
	if (a.isVector2) return cmpKeys(['x', 'y']);
	if (a.isBox3) return cmpKeys(['min', 'max']);
	if (a.isSphere) return cmpKeys(['center', 'radius']);
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
const SEED = 0xFACE;
function compare(fn, eps = 1e-5) {
	assertClose(fn(OURS, prng(SEED)), fn(THREE, prng(SEED)), eps);
}

function gridData(n, indexed = true) {
	const verts = (n + 1) * (n + 1);
	const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2);
	for (let j = 0; j <= n; j++) {
		for (let i = 0; i <= n; i++) {
			const v = j * (n + 1) + i;
			const x = -1 + 2 * i / n, y = -1 + 2 * j / n;
			pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = 0.3 * Math.sin(3 * x) * Math.cos(2 * y);
			uv[v * 2] = i / n; uv[v * 2 + 1] = j / n;
		}
	}
	const idx = [];
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
	if (indexed) return { pos, uv, idx };
	const p2 = new Float32Array(idx.length * 3), u2 = new Float32Array(idx.length * 2);
	for (let k = 0; k < idx.length; k++) { p2.set(pos.subarray(idx[k] * 3, idx[k] * 3 + 3), k * 3); u2.set(uv.subarray(idx[k] * 2, idx[k] * 2 + 2), k * 2); }
	return { pos: p2, uv: u2, idx: null };
}
function gridGeometry(L, n, indexed = true, normals = true) {
	const d = gridData(n, indexed);
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.Float32BufferAttribute(d.pos, 3));
	g.setAttribute('uv', new L.Float32BufferAttribute(d.uv, 2));
	if (d.idx) g.setIndex(d.idx);
	if (normals) g.computeVertexNormals();
	return g;
}
function randomPointsGeometry(L, r, count) {
	const pos = new Float32Array(count * 3);
	for (let i = 0; i < pos.length; i++) pos[i] = rand(r, -3, 3);
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.BufferAttribute(pos, 3));
	return g;
}
function randomMatrix(L, r) {
	const q = new L.Quaternion().setFromEuler(new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)));
	return new L.Matrix4().compose(new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)), q, new L.Vector3(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2)));
}
function snapshot(g) {
	const out = { index: g.index ? Array.from(g.index.array) : null, indexType: g.index ? g.index.array.constructor.name : null, groups: g.groups, drawRange: g.drawRange };
	for (const name of Object.keys(g.attributes).sort()) {
		const a = g.attributes[name];
		out[name] = { array: a.array, itemSize: a.itemSize, count: a.count, normalized: a.normalized, type: a.array.constructor.name };
	}
	return out;
}

// ---------------------------------------------------------------------------
// bounds
// ---------------------------------------------------------------------------

test('computeBoundingBox / computeBoundingSphere parity', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 6; i++) {
			const g = randomPointsGeometry(L, r, 50 + i * 37);
			out.push(g.boundingBox === null, g.boundingSphere === null);
			g.computeBoundingBox(); g.computeBoundingSphere();
			out.push(g.boundingBox, g.boundingSphere);
			// normalized position attribute path
			const n = new L.BufferGeometry();
			const bytes = new Uint8Array(30); for (let k = 0; k < 30; k++) bytes[k] = Math.floor(r() * 256);
			n.setAttribute('position', new L.BufferAttribute(bytes, 3, true));
			n.computeBoundingBox(); n.computeBoundingSphere();
			out.push(n.boundingBox, n.boundingSphere);
		}
		const grid = gridGeometry(L, 8);
		grid.computeBoundingBox(); grid.computeBoundingSphere();
		out.push(grid.boundingBox, grid.boundingSphere);
		// morph targets contribute to the bounds
		const m = gridGeometry(L, 4);
		const morph = new L.Float32BufferAttribute(Array.from(m.getAttribute('position').array, (v) => v * 2 + 0.5), 3);
		m.morphAttributes.position = [morph];
		m.computeBoundingBox(); m.computeBoundingSphere();
		out.push(m.boundingBox, m.boundingSphere);
		m.morphTargetsRelative = true;
		m.computeBoundingBox(); m.computeBoundingSphere();
		out.push(m.boundingBox, m.boundingSphere);
		// empty geometry
		const e = new L.BufferGeometry(); e.computeBoundingBox();
		out.push(e.boundingBox.isEmpty());
		return out;
	});
});

// ---------------------------------------------------------------------------
// normals / non-indexed
// ---------------------------------------------------------------------------

test('computeVertexNormals parity (indexed and non-indexed, existing normal attribute)', () => {
	compare((L) => {
		const out = [];
		for (const indexed of [true, false]) {
			const g = gridGeometry(L, 12, indexed, false);
			out.push(g.hasAttribute('normal'));
			g.computeVertexNormals();
			out.push(g.getAttribute('normal').array, g.getAttribute('normal').count, g.getAttribute('normal').version);
			// recomputing into the existing attribute resets it first
			g.getAttribute('position').array[2] += 0.5;
			g.computeVertexNormals();
			out.push(g.getAttribute('normal').array, g.getAttribute('normal').version);
		}
		return out;
	}, 1e-5);
});

test('toNonIndexed parity', () => {
	compare((L) => {
		const g = gridGeometry(L, 6);
		g.addGroup(0, 36, 0); g.addGroup(36, 180, 1);
		g.morphAttributes.position = [new L.Float32BufferAttribute(Array.from(g.getAttribute('position').array, (v) => v + 1), 3)];
		g.morphTargetsRelative = true;
		const n = g.toNonIndexed();
		return [n.index === null, snapshot(n), n.morphAttributes.position[0].array, n.morphTargetsRelative, n !== g, n.getAttribute('position').count === g.index.count];
	});
	const warn = console.warn; let warned = 0; console.warn = () => warned++;
	try {
		const g = gridGeometry(OURS, 2, false);
		assert.equal(g.toNonIndexed(), g);
	} finally { console.warn = warn; }
	assert.equal(warned, 1);
});

// ---------------------------------------------------------------------------
// transforms
// ---------------------------------------------------------------------------

test('applyMatrix4 / translate / scale / rotate parity (positions, normals, tangents, bounds)', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 4; i++) {
			const g = gridGeometry(L, 6, i % 2 === 0);
			g.setAttribute('tangent', new L.Float32BufferAttribute(Array.from({ length: g.getAttribute('position').count * 4 }, (_, k) => (k % 4 === 3 ? 1 : rand(r))), 4));
			g.computeBoundingBox(); g.computeBoundingSphere();
			const m = randomMatrix(L, r);
			g.applyMatrix4(m);
			out.push(snapshot(g), g.boundingBox, g.boundingSphere, g.getAttribute('position').version, g.getAttribute('normal').version, g.getAttribute('tangent').version);
			g.translate(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)); out.push(snapshot(g), g.boundingBox);
			g.scale(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2)); out.push(snapshot(g), g.boundingSphere);
			g.rotateX(rand(r, -3, 3)); out.push(snapshot(g));
			g.rotateY(rand(r, -3, 3)); out.push(snapshot(g));
			g.rotateZ(rand(r, -3, 3)); out.push(snapshot(g));
			g.applyQuaternion(new L.Quaternion().setFromEuler(new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)))); out.push(snapshot(g));
			g.lookAt(new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3))); out.push(snapshot(g));
			g.center(); out.push(snapshot(g), g.boundingBox);
			// a geometry without cached bounds does not create them
			const h = gridGeometry(L, 3);
			h.translate(1, 2, 3);
			out.push(h.boundingBox === null, h.boundingSphere === null);
		}
		return out;
	}, 1e-4);
	const g = gridGeometry(OURS, 10);
	g.computeBoundsTree();
	g.rotateY(0.3);
	assert.equal(g.boundsTree, null, 'transforms invalidate the BVH');
});

test('setFromPoints parity', () => {
	compare((L, r) => {
		const pts = [];
		for (let i = 0; i < 12; i++) pts.push(new L.Vector3(rand(r), rand(r), rand(r)));
		pts.push(new L.Vector2(0.5, 0.25));
		const g = new L.BufferGeometry().setFromPoints(pts);
		const out = [snapshot(g)];
		// updating in place into the existing attribute
		g.setFromPoints(pts.slice(0, 5).map((p) => p.clone().multiplyScalar(2)));
		out.push(snapshot(g), g.getAttribute('position').version);
		return out;
	});
});

// ---------------------------------------------------------------------------
// index handling
// ---------------------------------------------------------------------------

test('setIndex with an array picks Uint16 or Uint32 like THREE', () => {
	compare((L) => {
		const out = [];
		for (const arr of [[0, 1, 2], [0, 65534, 2], [0, 65535, 2], [0, 70000, 1], [1, 2, 3, 65535], []]) {
			const g = new L.BufferGeometry().setIndex(arr);
			out.push(g.index.array.constructor.name, g.index.itemSize, g.index.count, Array.from(g.index.array), g.getIndex() === g.index);
		}
		const attr = new L.Uint32BufferAttribute([0, 1, 2], 1);
		const g = new L.BufferGeometry().setIndex(attr);
		out.push(g.index === attr, g.index.array.constructor.name);
		const g2 = new L.BufferGeometry().setIndex([0, 1, 2]).setIndex(null);
		out.push(g2.index);
		return out;
	});
	const g = new BufferGeometry().setIndex([0, 1, 2]);
	assert.ok(g.index instanceof Uint16BufferAttribute && g.index.array instanceof Uint16Array);
	const h = new BufferGeometry().setIndex([0, 65535, 2]);
	assert.ok(h.index instanceof Uint32BufferAttribute && h.index.array instanceof Uint32Array);
});

// ---------------------------------------------------------------------------
// clone / copy
// ---------------------------------------------------------------------------

test('clone / copy parity and independence', () => {
	compare((L, r) => {
		const g = gridGeometry(L, 5);
		g.name = 'grid'; g.addGroup(0, 30, 1); g.addGroup(30, 120, 0); g.setDrawRange(3, 60); g.userData.tag = 'x';
		g.morphAttributes.position = [new L.Float32BufferAttribute(Array.from(g.getAttribute('position').array, (v) => v * 0.5), 3)];
		g.computeBoundingBox(); g.computeBoundingSphere();
		g.getAttribute('position').setUsage(L.DynamicDrawUsage);
		g.getAttribute('uv').name = 'texcoord';
		const c = g.clone();
		const out = [c.name, snapshot(c), c.boundingBox, c.boundingSphere, c.userData, c.morphAttributes.position[0].array, c.getAttribute('position').usage, c.getAttribute('uv').name];
		out.push(c.index !== g.index, c.index.array !== g.index.array, c.getAttribute('position') !== g.getAttribute('position'), c.getAttribute('position').array !== g.getAttribute('position').array);
		out.push(c.boundingBox !== g.boundingBox, c.groups !== g.groups, c.drawRange !== g.drawRange);
		// mutating the clone does not touch the source
		c.getAttribute('position').setX(0, 99); c.index.setX(0, 7); c.translate(1, 0, 0);
		out.push(snapshot(g));
		// copy onto an existing geometry replaces its contents
		const t = randomPointsGeometry(L, r, 10); t.setIndex([0, 1, 2]); t.addGroup(0, 3, 0);
		t.copy(g);
		out.push(snapshot(t), t.boundingBox, Object.keys(t.attributes).sort());
		// clone of a geometry without bounds leaves them null
		const bare = gridGeometry(L, 2).clone();
		out.push(bare.boundingBox, bare.boundingSphere);
		return out;
	});
	const g = gridGeometry(OURS, 10);
	g.computeBoundsTree();
	const c = g.clone();
	assert.equal(c.boundsTree, null, 'the BVH is not shared with the clone');
	assert.ok(g.boundsTree instanceof MeshBVH);
	assert.notEqual(c.uuid, g.uuid);
	assert.notEqual(c.id, g.id);
});

// ---------------------------------------------------------------------------
// layout versioning
// ---------------------------------------------------------------------------

test('setAttribute / deleteAttribute / setIndex bump _layoutVersion', () => {
	const g = new BufferGeometry();
	assert.equal(g._layoutVersion, 0);
	g.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
	assert.equal(g._layoutVersion, 1);
	g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
	assert.equal(g._layoutVersion, 2);
	// reassigning an attribute (even the same object) is a layout change
	g.setAttribute('uv', g.getAttribute('uv'));
	assert.equal(g._layoutVersion, 3);
	g.setIndex([0, 1, 2]);
	assert.equal(g._layoutVersion, 4);
	g.deleteAttribute('uv');
	assert.equal(g._layoutVersion, 5);
	assert.equal(g.hasAttribute('uv'), false);
	assert.equal(g.getAttribute('uv'), undefined);
	// editing an attribute's contents is not a layout change
	g.getAttribute('position').setX(0, 5);
	g.getAttribute('position').needsUpdate = true;
	assert.equal(g._layoutVersion, 5);
	// computeVertexNormals adds a new attribute -> layout change, once
	g.computeVertexNormals();
	assert.equal(g._layoutVersion, 6);
	g.computeVertexNormals();
	assert.equal(g._layoutVersion, 6);
	// position replacement drops the BVH, other attributes keep it
	g.computeBoundsTree();
	g.setAttribute('color', new Float32BufferAttribute([1, 1, 1, 1, 1, 1, 1, 1, 1], 3));
	assert.ok(g.boundsTree instanceof MeshBVH);
	g.setAttribute('position', g.getAttribute('position'));
	assert.equal(g.boundsTree, null);
	// clone starts from a fresh layout version counting its own attributes
	const c = g.clone();
	assert.equal(c._layoutVersion, Object.keys(c.attributes).length + 1);
});

// ---------------------------------------------------------------------------
// BufferAttribute
// ---------------------------------------------------------------------------

test('BufferAttribute getters / setters / normalized behaviour parity', () => {
	compare((L, r) => {
		const out = [];
		const types = [
			['Float32', L.Float32BufferAttribute, false], ['Uint8', L.Uint8BufferAttribute, true], ['Uint8Clamped', L.Uint8ClampedBufferAttribute, false],
			['Int8', L.Int8BufferAttribute, true], ['Uint16', L.Uint16BufferAttribute, true], ['Int16', L.Int16BufferAttribute, true],
			['Uint32', L.Uint32BufferAttribute, true], ['Int32', L.Int32BufferAttribute, true],
		];
		for (const [name, Ctor, normalized] of types) {
			const a = new Ctor(new Array(16).fill(0), 4, normalized);
			out.push(name, a.array.constructor.name, a.count, a.itemSize, a.normalized);
			for (let i = 0; i < 4; i++) {
				const vals = [rand(r), rand(r), rand(r), rand(r)];
				if (i === 0) a.setXYZW(i, ...vals);
				else if (i === 1) { a.setX(i, vals[0]); a.setY(i, vals[1]); a.setZ(i, vals[2]); a.setW(i, vals[3]); }
				else if (i === 2) { a.setXY(i, vals[0], vals[1]); a.setXYZ(i, vals[0], vals[1], vals[2]); a.setComponent(i, 3, vals[3]); }
				else { a.setComponent(i, 0, vals[0]); a.setComponent(i, 1, vals[1]); a.setComponent(i, 2, vals[2]); a.setComponent(i, 3, vals[3]); }
				out.push(a.getX(i), a.getY(i), a.getZ(i), a.getW(i), a.getComponent(i, 0), a.getComponent(i, 3));
				out.push(new L.Vector4().fromBufferAttribute(a, i), new L.Vector3().fromBufferAttribute(a, i), new L.Vector2().fromBufferAttribute(a, i));
			}
			out.push(Array.from(a.array));
			// exact boundaries
			a.setXYZW(0, 1, -1, 0.5, 0);
			out.push(Array.from(a.array.slice(0, 4)), a.getX(0), a.getY(0), a.getZ(0), a.getW(0));
			// non-normalized integer attributes store raw values
			const raw = new Ctor(new Array(8).fill(0), 2, false);
			raw.setXY(1, 3, 7); raw.setX(0, -5);
			out.push(Array.from(raw.array), raw.getX(1), raw.getY(1), raw.getX(0));
		}
		// copyAt / set / copyArray / clone / copy / applyMatrix4 / applyMatrix3 / transformDirection / applyNormalMatrix
		const src = new L.Float32BufferAttribute(Array.from({ length: 30 }, () => rand(r, -3, 3)), 3);
		const dst = new L.Float32BufferAttribute(new Array(30).fill(0), 3);
		dst.copyAt(0, src, 9).copyAt(1, src, 0).set([7, 8, 9], 6).copyArray(Array.from({ length: 30 }, (_, i) => i).slice(0, 12).concat(Array.from(dst.array.slice(12))));
		out.push(Array.from(dst.array));
		const m = randomMatrix(L, r), m3 = new L.Matrix3().getNormalMatrix(m);
		out.push(src.clone().applyMatrix4(m).array, src.clone().applyMatrix3(m3).array, src.clone().applyNormalMatrix(m3).array, src.clone().transformDirection(m).array);
		const uv = new L.Float32BufferAttribute(Array.from({ length: 10 }, () => rand(r)), 2);
		out.push(uv.clone().applyMatrix3(new L.Matrix3().setUvTransform(0.1, 0.2, 2, 3, 0.4, 0.5, 0.5)).array);
		const c = src.clone();
		out.push(c !== src, c.array !== src.array, c.array.constructor.name, c.count, c.itemSize, Array.from(c.array));
		src.name = 'n'; src.setUsage(L.DynamicDrawUsage); src.normalized = true;
		const cp = new L.BufferAttribute(new Float32Array(3), 3).copy(src);
		out.push(cp.name, cp.usage, cp.normalized, cp.count, cp.itemSize, cp.array.constructor.name, cp.array !== src.array);
		const json = src.toJSON();
		out.push(json.itemSize, json.type, json.array, json.normalized, json.name, json.usage);
		return out;
	}, 1e-6);
	assert.throws(() => new BufferAttribute([1, 2, 3], 3), TypeError);
	assert.throws(() => new THREE.BufferAttribute([1, 2, 3], 3), TypeError);
	const f = new Float32BufferAttribute([1, 2, 3], 3);
	assert.ok(f.clone() instanceof Float32BufferAttribute);
	const u = new Uint8BufferAttribute([0, 0, 0], 3, true);
	u.setX(0, 0.5);
	assert.equal(u.array[0], 128);
	assert.ok(Math.abs(u.getX(0) - 128 / 255) < 1e-9);
	const i8 = new Int8BufferAttribute([0], 1, true);
	i8.setX(0, -1);
	assert.equal(i8.array[0], -127);
	assert.equal(i8.getX(0), -1);
	i8.array[0] = -128;
	assert.equal(i8.getX(0), -1); // clamped by denormalize
});

test('needsUpdate bumps version on attributes', () => {
	const a = new Float32BufferAttribute([0, 0, 0], 3);
	assert.equal(a.version, 0);
	a.needsUpdate = true;
	assert.equal(a.version, 1);
	a.needsUpdate = false;
	assert.equal(a.version, 1);
	a.needsUpdate = true;
	a.needsUpdate = true;
	assert.equal(a.version, 3);
	const t = new THREE.Float32BufferAttribute([0, 0, 0], 3);
	t.needsUpdate = true; t.needsUpdate = false; t.needsUpdate = true; t.needsUpdate = true;
	assert.equal(t.version, a.version);
	// geometry helpers flag their attributes
	const g = gridGeometry(OURS, 3, true, false);
	const pos = g.getAttribute('position');
	assert.equal(pos.version, 0);
	g.translate(1, 0, 0);
	assert.equal(pos.version, 1);
	g.computeVertexNormals();
	assert.equal(g.getAttribute('normal').version, 1);
	g.scale(2, 2, 2);
	assert.equal(pos.version, 2);
	assert.equal(g.getAttribute('normal').version, 2);
	// update ranges and usage
	a.addUpdateRange(0, 3);
	assert.deepEqual(a.updateRanges, [{ start: 0, count: 3 }]);
	a.clearUpdateRanges();
	assert.deepEqual(a.updateRanges, []);
	assert.equal(a.usage, StaticDrawUsage);
	assert.equal(a.setUsage(DynamicDrawUsage), a);
	assert.equal(a.usage, DynamicDrawUsage);
	let uploaded = 0;
	a.onUpload(() => uploaded++);
	a.onUploadCallback();
	assert.equal(uploaded, 1);
});

test('groups, drawRange, dispose and misc parity', () => {
	compare((L) => {
		const g = gridGeometry(L, 3);
		const out = [g.groups, g.drawRange];
		g.addGroup(0, 6); g.addGroup(6, 12, 2);
		out.push(g.groups);
		g.clearGroups(); out.push(g.groups);
		g.setDrawRange(3, 9); out.push(g.drawRange);
		g.deleteAttribute('uv'); out.push(Object.keys(g.attributes).sort(), g.hasAttribute('uv'), g.hasAttribute('position'));
		let disposed = 0; g.addEventListener('dispose', () => disposed++); g.dispose(); out.push(disposed);
		g.computeBoundingSphere();
		const json = g.toJSON();
		out.push(json.data.index.type, json.data.index.array.length, Object.keys(json.data.attributes).sort(), json.data.attributes.position.itemSize, json.data.boundingSphere.radius);
		return out;
	});
});

test('computeTangents parity', () => {
	compare((L) => {
		const g = gridGeometry(L, 5);
		g.computeTangents();
		return [g.getAttribute('tangent').array, g.getAttribute('tangent').itemSize];
	}, 1e-4);
});

// ---------------------------------------------------------------------------
// regression tests for divergences from THREE that were found and fixed
// ---------------------------------------------------------------------------

test('normalized Uint8ClampedBufferAttribute parity', {}, () => {
	compare((L) => {
		const a = new L.Uint8ClampedBufferAttribute([0, 0, 0], 3, true);
		a.setXYZ(0, 0.5, 1, -1);
		return [Array.from(a.array), a.getX(0), a.getY(0), a.getZ(0)];
	});
});

test('BufferAttribute.toJSON parity', {}, () => {
	compare((L) => {
		const a = new L.Float32BufferAttribute([1, 2, 3], 3);
		return [a.toJSON(), Object.keys(a.toJSON()).sort()];
	});
});
