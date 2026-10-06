import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Vector2 } from '../src/math/Vector2.js';
import { Vector3 } from '../src/math/Vector3.js';
import { Matrix4 } from '../src/math/Matrix4.js';
import { Ray } from '../src/math/Ray.js';
import { BufferGeometry } from '../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../src/core/BufferAttribute.js';
import { MeshBVH } from '../src/core/MeshBVH.js';
import { Raycaster } from '../src/core/Raycaster.js';
import { Mesh } from '../src/objects/Mesh.js';
import { InstancedMesh } from '../src/objects/InstancedMesh.js';
import { Line } from '../src/objects/Line.js';
import { LineSegments } from '../src/objects/LineSegments.js';
import { LineLoop } from '../src/objects/LineLoop.js';
import { Points } from '../src/objects/Points.js';
import { Group } from '../src/objects/Group.js';
import { MeshBasicMaterial } from '../src/materials/MeshBasicMaterial.js';
import { LineBasicMaterial } from '../src/materials/LineBasicMaterial.js';
import { PointsMaterial } from '../src/materials/PointsMaterial.js';
import { PerspectiveCamera } from '../src/cameras/PerspectiveCamera.js';
import { OrthographicCamera } from '../src/cameras/OrthographicCamera.js';
import { FrontSide, BackSide, DoubleSide } from '../src/constants.js';

const OURS = {
	Vector2, Vector3, Matrix4, Ray, BufferGeometry, Float32BufferAttribute, Raycaster, Mesh, InstancedMesh, Line, LineSegments, LineLoop, Points, Group,
	MeshBasicMaterial, LineBasicMaterial, PointsMaterial, PerspectiveCamera, OrthographicCamera, FrontSide, BackSide, DoubleSide,
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
const SEED = 0x5EED;
function compare(fn, eps = 1e-5) {
	assertClose(fn(OURS, prng(SEED)), fn(THREE, prng(SEED)), eps);
}

/**
 * n x n grid of quads over [-1,1]^2 with a gentle height field, CCW when
 * viewed from +Z. Returns plain typed arrays so both libraries get identical data.
 */
function gridData(n, indexed = true) {
	const verts = (n + 1) * (n + 1);
	const pos = new Float32Array(verts * 3), uv = new Float32Array(verts * 2);
	for (let j = 0; j <= n; j++) {
		for (let i = 0; i <= n; i++) {
			const v = j * (n + 1) + i;
			const x = -1 + 2 * i / n, y = -1 + 2 * j / n;
			pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = 0.15 * Math.sin(3 * x) * Math.cos(2 * y);
			uv[v * 2] = i / n; uv[v * 2 + 1] = j / n;
		}
	}
	const idx = [];
	for (let j = 0; j < n; j++) {
		for (let i = 0; i < n; i++) {
			const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
			idx.push(a, b, c, b, d, c);
		}
	}
	if (indexed) return { pos, uv, idx, triCount: idx.length / 3 };
	const p2 = new Float32Array(idx.length * 3), u2 = new Float32Array(idx.length * 2);
	for (let k = 0; k < idx.length; k++) {
		p2.set(pos.subarray(idx[k] * 3, idx[k] * 3 + 3), k * 3);
		u2.set(uv.subarray(idx[k] * 2, idx[k] * 2 + 2), k * 2);
	}
	return { pos: p2, uv: u2, idx: null, triCount: idx.length / 3 };
}
function makeGeometry(L, data) {
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.Float32BufferAttribute(data.pos, 3));
	g.setAttribute('uv', new L.Float32BufferAttribute(data.uv, 2));
	if (data.idx) g.setIndex(data.idx);
	g.computeVertexNormals();
	return g;
}
function makeMesh(L, data, side, transform = true) {
	const mesh = new L.Mesh(makeGeometry(L, data), new L.MeshBasicMaterial({ side }));
	if (transform) { mesh.position.set(1, 2, -3); mesh.rotation.set(0.3, -0.5, 0.2); mesh.scale.set(1.2, 0.8, 1.5); }
	mesh.updateMatrixWorld();
	return mesh;
}
/** Ray given in the object's local space, transformed to world space. */
function localRay(L, object, ox, oy, oz, dx, dy, dz) {
	return new L.Ray(new L.Vector3(ox, oy, oz), new L.Vector3(dx, dy, dz).normalize()).applyMatrix4(object.matrixWorld);
}
function record(hit) {
	return {
		distance: hit.distance, point: hit.point, a: hit.face.a, b: hit.face.b, c: hit.face.c, faceNormal: hit.face.normal,
		faceIndex: hit.faceIndex, uv: hit.uv, normal: hit.normal, barycoord: hit.barycoord,
	};
}
/** Cast rays from above, from below, pointing away and off the grid; return the hit records. */
function castBattery(L, r, mesh, count, recursive = false) {
	const out = [];
	for (let i = 0; i < count; i++) {
		const x = rand(r, -0.8, 0.8), y = rand(r, -0.8, 0.8);
		const tx = rand(r, -0.03, 0.03), ty = rand(r, -0.03, 0.03);
		const rays = [
			localRay(L, mesh, x, y, 5, tx, ty, -1),
			localRay(L, mesh, x, y, -5, tx, ty, 1),
			localRay(L, mesh, x, y, 5, tx, ty, 1),
			localRay(L, mesh, 3 + x, y, 5, 0, 0, -1),
			localRay(L, mesh, x, y, 0.05, tx, ty, -1), // origin just above the surface
		];
		for (const ray of rays) {
			const rc = new L.Raycaster(ray.origin, ray.direction);
			const hits = rc.intersectObject(mesh, recursive);
			out.push(hits.length, hits.map(record));
		}
	}
	return out;
}

// ---------------------------------------------------------------------------
// Mesh raycast parity
// ---------------------------------------------------------------------------

for (const indexed of [true, false]) {
	for (const [sideName, sideKey] of [['FrontSide', 'FrontSide'], ['BackSide', 'BackSide'], ['DoubleSide', 'DoubleSide']]) {
		test(`Mesh raycast parity: ${indexed ? 'indexed' : 'non-indexed'} 50x50 grid, ${sideName}`, () => {
			const data = gridData(50, indexed);
			assert.ok(data.triCount > 64);
			compare((L, r) => {
				const mesh = makeMesh(L, data, L[sideKey]);
				const out = castBattery(L, r, mesh, 12);
				// ray from the untransformed grid as well
				const plain = makeMesh(L, data, L[sideKey], false);
				out.push(...castBattery(L, r, plain, 4));
				return out;
			}, 1e-4);
			const mesh = makeMesh(OURS, data, OURS[sideKey]);
			const ray = localRay(OURS, mesh, 0.1, 0.2, 5, 0, 0, -1);
			const hits = new Raycaster(ray.origin, ray.direction).intersectObject(mesh);
			assert.ok(mesh.geometry.boundsTree instanceof MeshBVH, 'BVH built lazily for > 64 triangles');
			assert.equal(hits.length, sideKey === 'BackSide' ? 0 : 1);
		});
	}
}

test('Mesh raycast parity: tiny geometry (< 64 triangles) uses the brute-force path', () => {
	const data = gridData(4, true);
	assert.ok(data.triCount < 64);
	compare((L, r) => {
		const out = [];
		for (const side of [L.FrontSide, L.BackSide, L.DoubleSide]) out.push(...castBattery(L, r, makeMesh(L, data, side), 8));
		out.push(...castBattery(L, r, makeMesh(L, gridData(4, false), L.DoubleSide), 8));
		return out;
	}, 1e-4);
	const mesh = makeMesh(OURS, data, DoubleSide);
	const ray = localRay(OURS, mesh, 0.1, 0.2, 5, 0, 0, -1);
	const hits = new Raycaster(ray.origin, ray.direction).intersectObject(mesh);
	assert.equal(hits.length, 1);
	assert.equal(mesh.geometry.boundsTree, null, 'no BVH for small geometries');
});

test('Mesh raycast parity with drawRange (indexed and non-indexed, BVH and brute force)', () => {
	compare((L, r) => {
		const out = [];
		for (const [n, indexed] of [[50, true], [50, false], [4, true], [4, false]]) {
			const data = gridData(n, indexed);
			const tris = data.triCount;
			for (const [start, count] of [[0, 3 * Math.floor(tris / 2)], [3 * Math.floor(tris / 3), 3 * Math.floor(tris / 3)], [3 * (tris - 10), Infinity], [0, 0]]) {
				const mesh = makeMesh(L, data, L.DoubleSide);
				mesh.geometry.setDrawRange(start, count);
				out.push(...castBattery(L, r, mesh, 6));
				// a dense sweep across the grid so the draw-range boundary is exercised
				for (let k = 0; k < 20; k++) {
					const ray = localRay(L, mesh, -0.95 + 1.9 * k / 19 + 0.001, -0.95 + 1.9 * k / 19 + 0.002, 5, 0, 0, -1);
					const hits = new L.Raycaster(ray.origin, ray.direction).intersectObject(mesh);
					out.push(hits.length, hits.map((h) => h.faceIndex));
				}
			}
		}
		return out;
	}, 1e-4);
});

test('Mesh raycast parity with material groups (array material)', () => {
	compare((L, r) => {
		const out = [];
		for (const n of [50, 4]) {
			const data = gridData(n, true);
			const g = makeGeometry(L, data);
			const half = 3 * Math.floor(data.triCount / 2);
			g.addGroup(0, half, 0);
			g.addGroup(half, data.idx.length - half, 1);
			const mesh = new L.Mesh(g, [new L.MeshBasicMaterial({ side: L.DoubleSide }), new L.MeshBasicMaterial({ side: L.FrontSide })]);
			mesh.position.set(0.5, 0, -1); mesh.updateMatrixWorld();
			out.push(...castBattery(L, r, mesh, 8));
		}
		return out;
	}, 1e-4);
});

test('raycaster near / far and layers parity', () => {
	compare((L, r) => {
		const mesh = makeMesh(OURS === L ? L : L, gridData(10, true), L.DoubleSide);
		const out = [];
		for (let i = 0; i < 6; i++) {
			const ray = localRay(L, mesh, rand(r, -0.8, 0.8), rand(r, -0.8, 0.8), 5, 0, 0, -1);
			const rc = new L.Raycaster(ray.origin, ray.direction, 0, Infinity);
			const d = rc.intersectObject(mesh)[0].distance;
			out.push(d);
			rc.near = d + 0.01; out.push(rc.intersectObject(mesh).length);
			rc.near = 0; rc.far = d - 0.01; out.push(rc.intersectObject(mesh).length);
			rc.far = d + 0.01; out.push(rc.intersectObject(mesh).length);
			rc.layers.set(1); out.push(rc.intersectObject(mesh).length);
			mesh.layers.enable(1); out.push(rc.intersectObject(mesh).length);
			mesh.layers.set(0);
		}
		return out;
	}, 1e-4);
});

test('recursive intersectObject / intersectObjects parity and sorting', () => {
	compare((L, r) => {
		const group = new L.Group();
		const a = makeMesh(L, gridData(10, true), L.DoubleSide, false); a.position.z = 0; group.add(a);
		const b = makeMesh(L, gridData(6, false), L.DoubleSide, false); b.position.z = -1; group.add(b);
		const c = makeMesh(L, gridData(3, true), L.DoubleSide, false); c.position.z = 1; c.scale.set(0.5, 0.5, 1); group.add(c);
		group.rotation.set(0.1, 0.2, 0.3); group.updateMatrixWorld();
		const out = [];
		for (let i = 0; i < 10; i++) {
			const ray = localRay(L, group, rand(r, -0.8, 0.8), rand(r, -0.8, 0.8), 5, 0, 0, -1);
			const rc = new L.Raycaster(ray.origin, ray.direction);
			const hits = rc.intersectObject(group, true);
			out.push(hits.length, hits.map((h) => [h.distance, h.object === a ? 'a' : h.object === b ? 'b' : 'c', h.faceIndex]));
			out.push(rc.intersectObject(group, false).length);
			out.push(rc.intersectObjects([a, b, c], false).map((h) => h.distance));
			out.push(rc.intersectObjects([c, a], false).map((h) => h.distance));
			// distances are ascending
			out.push(hits.every((h, k) => k === 0 || h.distance >= hits[k - 1].distance));
		}
		return out;
	}, 1e-4);
});

// ---------------------------------------------------------------------------
// BVH
// ---------------------------------------------------------------------------

test('explicit computeBoundsTree gives the same hits as lazy / brute force', () => {
	const r = prng(77);
	for (const [n, indexed] of [[50, true], [50, false], [4, true], [4, false]]) {
		const data = gridData(n, indexed);
		const lazy = makeMesh(OURS, data, DoubleSide);
		const explicit = makeMesh(OURS, data, DoubleSide);
		const bvh = explicit.geometry.computeBoundsTree();
		assert.ok(bvh instanceof MeshBVH && explicit.geometry.boundsTree === bvh);
		assert.equal(bvh.triCount, data.triCount);
		const a = castBattery(OURS, prng(5), lazy, 10);
		const b = castBattery(OURS, prng(5), explicit, 10);
		assertClose(a, b, 1e-9);
		if (n === 4) assert.equal(lazy.geometry.boundsTree, null, 'small geometry stays brute force');
		else assert.ok(lazy.geometry.boundsTree instanceof MeshBVH);
		// custom leaf size
		const custom = makeMesh(OURS, data, DoubleSide);
		custom.geometry.computeBoundsTree({ maxLeafTris: 2 });
		assert.equal(custom.geometry.boundsTree.maxLeafTris, 2);
		assertClose(castBattery(OURS, prng(5), custom, 10), a, 1e-9);
		// disposeBoundsTree drops it and it comes back lazily for big geometries
		explicit.geometry.disposeBoundsTree();
		assert.equal(explicit.geometry.boundsTree, null);
		assertClose(castBattery(OURS, prng(5), explicit, 10), a, 1e-9);
		// modifying the geometry invalidates the tree
		if (explicit.geometry.boundsTree) {
			explicit.geometry.setAttribute('position', explicit.geometry.getAttribute('position'));
			assert.equal(explicit.geometry.boundsTree, null);
			explicit.geometry.computeBoundsTree();
			explicit.geometry.translate(0, 0, 0.1);
			assert.equal(explicit.geometry.boundsTree, null);
			explicit.geometry.computeBoundsTree();
			explicit.geometry.setIndex(explicit.geometry.getIndex());
			assert.equal(explicit.geometry.boundsTree, null);
		}
		void r;
	}
});

function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
/** Möller–Trumbore, no culling; returns t or null. */
function mollerTrumbore(o, d, a, b, c) {
	const e1 = sub(b, a), e2 = sub(c, a);
	const p = cross(d, e2);
	const det = dot(e1, p);
	if (Math.abs(det) < 1e-12) return null;
	const inv = 1 / det;
	const s = sub(o, a);
	const u = dot(s, p) * inv;
	if (u < 0 || u > 1) return null;
	const q = cross(s, e1);
	const v = dot(d, q) * inv;
	if (v < 0 || u + v > 1) return null;
	const t = dot(e2, q) * inv;
	return t > 0 ? t : null;
}
function triVerts(data, t) {
	const vi = (k) => data.idx ? data.idx[t * 3 + k] : t * 3 + k;
	return [0, 1, 2].map((k) => { const v = vi(k); return [data.pos[v * 3], data.pos[v * 3 + 1], data.pos[v * 3 + 2]]; });
}
function bruteForceHits(data, o, d, maxT = Infinity) {
	const hits = new Map();
	for (let t = 0; t < data.triCount; t++) {
		const [a, b, c] = triVerts(data, t);
		const tt = mollerTrumbore(o, d, a, b, c);
		if (tt !== null && tt <= maxT) hits.set(t, tt);
	}
	return hits;
}

test('MeshBVH.raycast reports a superset of the triangles a ray actually hits', () => {
	const r = prng(123);
	for (const indexed of [true, false]) {
		const data = gridData(50, indexed);
		const g = makeGeometry(OURS, data);
		const bvh = new MeshBVH(g);
		assert.equal(bvh.triCount, data.triCount);
		assert.equal(g.boundsTree, null, 'constructing a MeshBVH directly does not attach it');
		// tris is a permutation of all triangle indices
		assert.equal(new Set(bvh.tris).size, data.triCount);
		assert.ok(bvh.nodeCount > 1 && bvh.bounds.length === bvh.nodeCount * 6 && bvh.isLeaf.length === bvh.nodeCount);
		// every leaf holds at most maxLeafTris
		for (let n = 0; n < bvh.nodeCount; n++) if (bvh.isLeaf[n]) assert.ok(bvh.meta[n * 2 + 1] <= bvh.maxLeafTris && bvh.meta[n * 2 + 1] > 0);
		// root bounds enclose the geometry
		g.computeBoundingBox();
		for (let k = 0; k < 3; k++) {
			assert.ok(bvh.bounds[k] <= g.boundingBox.min.getComponent(k) + 1e-6);
			assert.ok(bvh.bounds[3 + k] >= g.boundingBox.max.getComponent(k) - 1e-6);
		}
		let raysWithHits = 0;
		for (let i = 0; i < 60; i++) {
			let o, d;
			if (i % 3 === 0) {
				o = [rand(r, -0.9, 0.9), rand(r, -0.9, 0.9), rand(r, 1, 3)];
				d = [rand(r, -0.3, 0.3), rand(r, -0.3, 0.3), -1];
			} else if (i % 3 === 1) {
				o = [rand(r, -2, 2), rand(r, -2, 2), rand(r, -2, 2)];
				d = [rand(r), rand(r), rand(r)];
			} else {
				// grazing rays nearly parallel to the surface
				o = [rand(r, -2, 2), rand(r, -2, 2), rand(r, -0.1, 0.1)];
				d = [rand(r), rand(r), rand(r, -0.05, 0.05)];
			}
			const len = Math.hypot(...d); d = d.map((v) => v / len);
			const reported = new Set();
			bvh.raycast(o[0], o[1], o[2], d[0], d[1], d[2], Infinity, (t) => reported.add(t));
			const actual = bruteForceHits(data, o, d);
			for (const t of actual.keys()) assert.ok(reported.has(t), `triangle ${t} hit but not reported (ray ${i})`);
			if (actual.size > 0) raysWithHits++;
			if (i % 3 === 0) assert.ok(reported.size < data.triCount / 4, `BVH should cull most triangles (${reported.size})`);
			// maxT bound: triangles beyond it may be dropped, triangles within it must stay
			const maxT = rand(r, 0.5, 3);
			const bounded = new Set();
			bvh.raycast(o[0], o[1], o[2], d[0], d[1], d[2], maxT, (t) => bounded.add(t));
			for (const [t, tt] of actual) if (tt <= maxT) assert.ok(bounded.has(t), `triangle ${t} within maxT but not reported`);
			assert.ok(bounded.size <= reported.size);
		}
		assert.ok(raysWithHits > 10);
		// a ray that starts above the mesh with a tiny maxT reports nothing
		const none = [];
		bvh.raycast(0, 0, 3, 0, 0, -1, 0.5, (t) => none.push(t));
		assert.equal(none.length, 0);
		// axis-aligned rays with zero direction components still work
		const axis = new Set();
		bvh.raycast(0.013, 0.027, 3, 0, 0, -1, Infinity, (t) => axis.add(t));
		for (const t of bruteForceHits(data, [0.013, 0.027, 3], [0, 0, -1]).keys()) assert.ok(axis.has(t));
	}
});

// ---------------------------------------------------------------------------
// Raycaster.setFromCamera
// ---------------------------------------------------------------------------

test('Raycaster.setFromCamera parity for perspective and orthographic cameras', () => {
	compare((L, r) => {
		const out = [];
		const persp = new L.PerspectiveCamera(50, 16 / 9, 0.1, 100);
		persp.position.set(3, 4, 5); persp.lookAt(new L.Vector3(0, 1, 0)); persp.updateMatrixWorld();
		const ortho = new L.OrthographicCamera(-4, 4, 3, -3, 0.5, 50);
		ortho.position.set(-2, 3, 8); ortho.lookAt(new L.Vector3(0, 0, 0)); ortho.updateMatrixWorld();
		const parent = new L.Group(); parent.position.set(1, 1, 1); parent.rotation.y = 0.7;
		const childCam = new L.PerspectiveCamera(70, 1, 0.5, 60); childCam.position.set(0, 2, 6); parent.add(childCam);
		childCam.zoom = 1.3; childCam.updateProjectionMatrix(); parent.updateMatrixWorld();
		const rc = new L.Raycaster();
		for (const cam of [persp, ortho, childCam]) {
			for (const [x, y] of [[0, 0], [-1, -1], [1, 1], [0.3, -0.7], [rand(r), rand(r)], [rand(r), rand(r)]]) {
				rc.setFromCamera(new L.Vector2(x, y), cam);
				out.push(rc.ray.origin.clone(), rc.ray.direction.clone(), rc.camera === cam, rc.ray.direction.length());
			}
		}
		// the ray through the center hits what the camera looks at
		rc.setFromCamera(new L.Vector2(0, 0), persp);
		out.push(rc.ray.direction.clone().cross(new L.Vector3(0, 1, 0).sub(persp.position).normalize()).length() < 1e-5);
		return out;
	}, 1e-4);
	const rc = new Raycaster();
	const errors = console.error; let logged = 0; console.error = () => logged++;
	try { rc.setFromCamera(new Vector2(), new Group()); } finally { console.error = errors; }
	assert.equal(logged, 1);
});

// ---------------------------------------------------------------------------
// Line / Points
// ---------------------------------------------------------------------------

test('Line / LineSegments / LineLoop raycast parity', () => {
	compare((L, r) => {
		const out = [];
		const pts = [0, 0, 0, 1, 0, 0, 1, 1, 0, 2, 1, 0, 2, 0, 0.5, 3, 0, 0.5];
		for (const Ctor of [L.Line, L.LineSegments, L.LineLoop]) {
			const g = new L.BufferGeometry();
			g.setAttribute('position', new L.Float32BufferAttribute(pts, 3));
			const line = new Ctor(g, new L.LineBasicMaterial());
			line.position.set(0.5, 0, -2); line.rotation.z = 0.2; line.scale.setScalar(1.5); line.updateMatrixWorld();
			const rc = new L.Raycaster(); rc.params.Line.threshold = 0.15;
			// probe points sit clearly inside or outside the threshold band, never on its boundary
			const probes = [[0.5, 0.05], [1.02, 0.5], [1.5, 0.93], [0.5, 0.5], [2.5, 0.07], [1.5, 0.25], [1, 0], [2, 0.5]];
			for (let i = 0; i < 6; i++) probes.push([rand(r, 0, 3), rand(r, -0.2, 1.2)]);
			for (const [x, y] of probes) {
				const ray = localRay(L, line, x, y, 5, 0, 0, -1);
				rc.set(ray.origin, ray.direction);
				const hits = rc.intersectObject(line);
				out.push(hits.length, hits.map((h) => ({ distance: h.distance, point: h.point, index: h.index, face: h.face, faceIndex: h.faceIndex })));
			}
			rc.params.Line.threshold = 0.5;
			g.setDrawRange(1, 3);
			for (const [x, y] of probes.slice(0, 6)) {
				const ray = localRay(L, line, x, y, 5, 0, 0, -1);
				rc.set(ray.origin, ray.direction);
				out.push(rc.intersectObject(line).map((h) => [h.distance, h.index]));
			}
			line.computeLineDistances();
			out.push(g.getAttribute('lineDistance').array);
		}
		return out;
	}, 1e-4);
});

test('Points raycast parity', () => {
	compare((L, r) => {
		const out = [];
		const pts = [];
		for (let i = 0; i < 30; i++) pts.push(rand(r, -2, 2), rand(r, -2, 2), rand(r, -0.5, 0.5));
		for (const indexed of [false, true]) {
			const g = new L.BufferGeometry();
			g.setAttribute('position', new L.Float32BufferAttribute(pts, 3));
			if (indexed) g.setIndex(Array.from({ length: 20 }, (_, i) => 29 - i));
			const points = new L.Points(g, new L.PointsMaterial());
			points.position.set(1, -1, 2); points.rotation.x = 0.4; points.scale.setScalar(2); points.updateMatrixWorld();
			const rc = new L.Raycaster(); rc.params.Points.threshold = 0.3;
			for (let i = 0; i < 30; i++) {
				const ray = localRay(L, points, pts[i * 3] + rand(r, -0.1, 0.1), pts[i * 3 + 1] + rand(r, -0.1, 0.1), 5, 0, 0, -1);
				rc.set(ray.origin, ray.direction);
				const hits = rc.intersectObject(points);
				out.push(hits.length, hits.map((h) => ({ distance: h.distance, distanceToRay: h.distanceToRay, point: h.point, index: h.index, face: h.face })));
			}
			g.setDrawRange(5, 10);
			for (let i = 0; i < 30; i += 3) {
				const ray = localRay(L, points, pts[i * 3], pts[i * 3 + 1], 5, 0, 0, -1);
				rc.set(ray.origin, ray.direction);
				out.push(rc.intersectObject(points).map((h) => h.index));
			}
		}
		return out;
	}, 1e-4);
});

// ---------------------------------------------------------------------------
// InstancedMesh
// ---------------------------------------------------------------------------

test('InstancedMesh raycast: 3 instances, one hit with the right instanceId', () => {
	compare((L, r) => {
		const out = [];
		for (const n of [4, 50]) {
			const g = makeGeometry(L, gridData(n, true));
			const im = new L.InstancedMesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }), 3);
			for (let i = 0; i < 3; i++) {
				const m = new L.Matrix4().makeTranslation((i - 1) * 3, 0, 0.2 * i);
				m.multiply(new L.Matrix4().makeRotationZ(0.1 * i));
				im.setMatrixAt(i, m);
			}
			im.position.set(0.5, -0.25, 1); im.rotation.set(0.1, 0.2, 0.3); im.scale.set(1.1, 0.9, 1); im.updateMatrixWorld();
			for (let i = 0; i < 3; i++) {
				for (let k = 0; k < 4; k++) {
					const ray = localRay(L, im, (i - 1) * 3 + rand(r, -0.5, 0.5), rand(r, -0.5, 0.5), 5, 0, 0, -1);
					const hits = new L.Raycaster(ray.origin, ray.direction).intersectObject(im);
					out.push(hits.length, hits.map((h) => ({ instanceId: h.instanceId, distance: h.distance, point: h.point, faceIndex: h.faceIndex, uv: h.uv, isSelf: h.object === im })));
				}
			}
			// a ray between instances misses everything
			const miss = localRay(L, im, 1.5, 0, 5, 0, 0, -1);
			out.push(new L.Raycaster(miss.origin, miss.direction).intersectObject(im).length);
			im.computeBoundingBox(); im.computeBoundingSphere();
			out.push(im.boundingBox.min, im.boundingBox.max, im.boundingSphere.center, im.boundingSphere.radius);
		}
		return out;
	}, 1e-4);
	const g = makeGeometry(OURS, gridData(4, true));
	const im = new InstancedMesh(g, new MeshBasicMaterial({ side: DoubleSide }), 3);
	for (let i = 0; i < 3; i++) im.setMatrixAt(i, new Matrix4().makeTranslation((i - 1) * 3, 0, 0));
	im.updateMatrixWorld();
	for (let i = 0; i < 3; i++) {
		const hits = new Raycaster(new Vector3((i - 1) * 3 + 0.1, 0.2, 5), new Vector3(0, 0, -1)).intersectObject(im);
		assert.equal(hits.length, 1);
		assert.equal(hits[0].instanceId, i);
		assert.equal(hits[0].object, im);
	}
	// count limits which instances are tested
	im.count = 1;
	assert.equal(new Raycaster(new Vector3(3.1, 0.2, 5), new Vector3(0, 0, -1)).intersectObject(im).length, 0);
	assert.equal(new Raycaster(new Vector3(-2.9, 0.2, 5), new Vector3(0, 0, -1)).intersectObject(im).length, 1);
});

// ---------------------------------------------------------------------------
// regression tests for divergences from THREE that were found and fixed
// ---------------------------------------------------------------------------

test('face.materialIndex reflects the group materialIndex for array materials', {}, () => {
	compare((L) => {
		const data = gridData(4, true);
		const g = makeGeometry(L, data);
		const half = 3 * (data.triCount / 2);
		g.addGroup(0, half, 0);
		g.addGroup(half, data.idx.length - half, 1);
		const mesh = new L.Mesh(g, [new L.MeshBasicMaterial({ side: L.DoubleSide }), new L.MeshBasicMaterial({ side: L.DoubleSide })]);
		mesh.updateMatrixWorld();
		const out = [];
		for (const y of [-0.9, 0.8]) { // 0.8 keeps the probe off the cell diagonal
			const hits = new L.Raycaster(new L.Vector3(0.1, y, 5), new L.Vector3(0, 0, -1)).intersectObject(mesh);
			out.push(hits.map((h) => h.face.materialIndex));
		}
		return out; // THREE: [[0], [1]], ours: [[0], [0]]
	});
});
