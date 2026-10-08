// Parity tests for the fast raycast paths (world-sphere rejection, cached inverse, BVH candidates in
// triangle order, refit on position changes, scalar triangle pre-test). Every case builds the same scene
// with three.js and jrs from the same seeded data and compares the complete ordered hit lists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as JRS from '../src/index.js';

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
const rnd = (r, lo, hi) => lo + r() * (hi - lo);

/** Layered, jittered grids with shuffled triangle order so that BVH order != index order. */
function soup(seed, n, layers, { indexed = true, f64 = false } = {}) {
	const r = prng(seed);
	const verts = [], idx = [];
	for (let l = 0; l < layers; l++) {
		const base = verts.length / 3;
		for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
			verts.push(-1 + 2 * i / n + rnd(r, -0.01, 0.01), -1 + 2 * j / n + rnd(r, -0.01, 0.01), l * 0.3 + 0.1 * Math.sin(3 * i / n * 3) + rnd(r, -0.02, 0.02));
		}
		for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
			const a = base + j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
			if (l % 2) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
		}
	}
	const tris = [];
	for (let t = 0; t < idx.length; t += 3) tris.push([idx[t], idx[t + 1], idx[t + 2]]);
	for (let t = tris.length - 1; t > 0; t--) { const k = Math.floor(r() * (t + 1)); [tris[t], tris[k]] = [tris[k], tris[t]]; }
	const flat = tris.flat();
	if (indexed) return { pos: verts, idx: flat, f64 };
	const pos = [];
	for (const v of flat) pos.push(verts[v * 3], verts[v * 3 + 1], verts[v * 3 + 2]);
	return { pos, idx: null, f64 };
}
function geometry(L, data) {
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.BufferAttribute(data.f64 ? new Float64Array(data.pos) : new Float32Array(data.pos), 3));
	if (data.idx) g.setIndex(data.idx);
	g.computeVertexNormals();
	return g;
}
function xform(L, mesh, r) {
	mesh.position.set(rnd(r, -1, 1), rnd(r, -1, 1), rnd(r, -1, 1));
	mesh.rotation.set(rnd(r, -3, 3), rnd(r, -3, 3), rnd(r, -3, 3));
	mesh.scale.set(rnd(r, 0.5, 1.8), rnd(r, 0.5, 1.8), rnd(r, 0.5, 1.8));
	mesh.updateMatrixWorld(true);
}
function rays(r, count, spread = 1.2) {
	const out = [];
	for (let i = 0; i < count; i++) {
		const o = [rnd(r, -spread, spread), rnd(r, -spread, spread), rnd(r, -4, 4)];
		const t = [rnd(r, -spread, spread), rnd(r, -spread, spread), rnd(r, -0.3, 0.9)];
		let d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]];
		const l = Math.hypot(...d); d = d.map((v) => v / l);
		out.push({ o, d });
	}
	// axis-aligned rays hit grid vertices / edges (exact ties)
	for (let i = 0; i < 6; i++) out.push({ o: [-1 + 0.2 * i, -1 + 0.2 * (i % 3), 5], d: [0, 0, -1] });
	return out;
}
function cast(L, rc, ray, target, recursive = true) {
	rc.ray.origin.set(...ray.o); rc.ray.direction.set(...ray.d);
	return Array.isArray(target) ? rc.intersectObjects(target, recursive) : rc.intersectObject(target, recursive);
}

/** Hits within a distance cluster may legally come in either order (float noise); everything else must match. */
function assertSameHits(a, b, label, tol = 1e-4) {
	assert.equal(a.length, b.length, `${label}: hit count`);
	let i = 0;
	while (i < a.length) {
		let j = i + 1;
		while (j < a.length && Math.abs(a[j].distance - a[j - 1].distance) <= tol * Math.max(1, a[j].distance) * 0.01) j++;
		for (let k = i; k < j; k++) assert.ok(Math.abs(a[k].distance - b[k].distance) <= tol * Math.max(1, a[k].distance), `${label}: distance[${k}] ${a[k].distance} vs ${b[k].distance}`);
		const key = (h) => `${h.label}/${h.faceIndex}/${h.instanceId}/${h.materialIndex}`;
		assert.deepEqual(a.slice(i, j).map(key).sort(), b.slice(i, j).map(key).sort(), `${label}: hits ${i}..${j}`);
		if (j - i === 1) {
			assert.equal(key(a[i]), key(b[i]), `${label}: order`);
			const p = a[i].point, q = b[i].point;
			assert.ok(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) <= 1e-3, `${label}: point`);
		}
		i = j;
	}
}
function describe(hits, labels) {
	return hits.map((h) => ({ distance: h.distance, label: labels.get(h.object) ?? '?', faceIndex: h.faceIndex, instanceId: h.instanceId, materialIndex: h.face ? h.face.materialIndex : undefined, point: h.point }));
}
function twin(build) {
	const out = {};
	for (const [name, L] of [['three', THREE], ['jrs', JRS]]) { const labels = new Map(); out[name] = { L, labels, ...build(L, labels, prng(77)) }; }
	return out;
}
function compareCasts(t, rayList, target = (s) => s.mesh, recursive = true, tag = '') {
	let nonEmpty = 0;
	rayList.forEach((ray, i) => {
		const a = describe(cast(t.three.L, t.three.rc, ray, target(t.three), recursive), t.three.labels);
		const b = describe(cast(t.jrs.L, t.jrs.rc, ray, target(t.jrs), recursive), t.jrs.labels);
		if (a.length) nonEmpty++;
		assertSameHits(a, b, `${tag} ray ${i}`);
	});
	return nonEmpty;
}

for (const indexed of [true, false]) for (const side of ['FrontSide', 'BackSide', 'DoubleSide']) {
	test(`BVH candidates are tested in triangle order: shuffled ${indexed ? 'indexed' : 'non-indexed'} layered mesh, ${side}`, () => {
		const data = soup(3, 14, 3, { indexed });
		const t = twin((L, labels, r) => {
			const mesh = new L.Mesh(geometry(L, data), new L.MeshBasicMaterial({ side: L[side] }));
			xform(L, mesh, r); labels.set(mesh, 'm');
			return { mesh, rc: new L.Raycaster() };
		});
		assert.ok(compareCasts(t, rays(prng(5), 80)) > 20);
		assert.ok(t.jrs.mesh.geometry.boundsTree, 'BVH in use');
	});
}

test('Float64 positions and tight leaf size', () => {
	const data = soup(4, 12, 2, { f64: true });
	const t = twin((L, labels, r) => {
		const g = geometry(L, data);
		const mesh = new L.Mesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }));
		xform(L, mesh, r); labels.set(mesh, 'm');
		if (L === JRS) g.computeBoundsTree({ maxLeafTris: 2 });
		return { mesh, rc: new L.Raycaster() };
	});
	assert.ok(compareCasts(t, rays(prng(6), 60)) > 10);
});

test('draw ranges and groups: aligned, misaligned, out-of-order, overlapping, with gaps (BVH and brute force)', () => {
	const cases = [];
	for (const n of [12, 4]) for (const indexed of [true, false]) {
		const total = n * n * 2 * 2;
		cases.push({ n, indexed, drawRange: [0, Infinity], groups: [] });
		cases.push({ n, indexed, drawRange: [3 * 5, 3 * Math.floor(total / 2)], groups: [] });
		cases.push({ n, indexed, drawRange: [4, 3 * Math.floor(total / 2)], groups: [] }); // misaligned start
		cases.push({ n, indexed, drawRange: [0, Infinity], groups: [[0, 3 * Math.floor(total / 3), 1], [3 * Math.floor(total / 2), 3 * Math.floor(total / 3), 0]] }); // gap
		cases.push({ n, indexed, drawRange: [0, Infinity], groups: [[3 * Math.floor(total / 2), 3 * Math.floor(total / 2), 0], [0, 3 * Math.floor(total / 2), 1]] }); // out of order
		cases.push({ n, indexed, drawRange: [0, Infinity], groups: [[0, 3 * Math.floor(total * 0.7), 0], [3 * Math.floor(total * 0.3), 3 * Math.floor(total * 0.7), 1]] }); // overlapping
		cases.push({ n, indexed, drawRange: [3 * 7, 3 * Math.floor(total / 2)], groups: [[0, 3 * Math.floor(total / 2), 1], [3 * Math.floor(total / 2), 3 * Math.floor(total / 2), 0]] }); // range + groups
		cases.push({ n, indexed, drawRange: [0, Infinity], groups: [[1, 3 * Math.floor(total / 3), 0], [3 * Math.floor(total / 2), 3 * Math.floor(total / 3), 1]] }); // misaligned group
	}
	cases.forEach((c, k) => {
		const data = soup(10 + k, c.n, 2, { indexed: c.indexed });
		const t = twin((L, labels, r) => {
			const g = geometry(L, data);
			g.setDrawRange(c.drawRange[0], c.drawRange[1]);
			for (const [s, n, m] of c.groups) g.addGroup(s, n, m);
			const material = c.groups.length ? [new L.MeshBasicMaterial({ side: L.DoubleSide }), new L.MeshBasicMaterial({ side: L.FrontSide })] : new L.MeshBasicMaterial({ side: L.DoubleSide });
			const mesh = new L.Mesh(g, material);
			xform(L, mesh, r); labels.set(mesh, 'm');
			return { mesh, rc: new L.Raycaster() };
		});
		compareCasts(t, rays(prng(k), 40), undefined, true, `case ${k} ${JSON.stringify(c)}`);
	});
});

test('moving meshes: cached inverse / sphere follow every world-matrix change, including direct edits', () => {
	const t = twin((L, labels, r) => {
		const g = geometry(L, soup(5, 8, 1));
		const meshes = [];
		const scene = new L.Scene();
		for (let i = 0; i < 12; i++) {
			const m = new L.Mesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }));
			xform(L, m, r); m.position.multiplyScalar(2); labels.set(m, 'm' + i); meshes.push(m); scene.add(m);
		}
		scene.updateMatrixWorld(true);
		return { scene, meshes, rc: new L.Raycaster() };
	});
	const r = prng(9);
	let hits = 0;
	for (let frame = 0; frame < 25; frame++) {
		const dx = rnd(r, -0.4, 0.4), ry = rnd(r, 0, 0.5), sc = rnd(r, 0.8, 1.3), which = Math.floor(r() * 12);
		for (const s of [t.three, t.jrs]) {
			s.meshes.forEach((m, i) => { m.position.x += dx * Math.sin(i + frame); m.rotation.y += ry * (i % 3 ? 1 : 0); });
			s.meshes[which].scale.setScalar(sc);
			s.scene.updateMatrixWorld(true);
		}
		if (frame % 5 === 4) { // matrixAutoUpdate off + direct matrixWorld edit, no version bump
			for (const s of [t.three, t.jrs]) {
				const m = s.meshes[3]; m.matrixAutoUpdate = false; m.matrixWorldAutoUpdate = false;
				m.matrixWorld.makeTranslation(frame * 0.1, 0.2, 0.1).multiply(new s.L.Matrix4().makeScale(1 + frame * 0.01, 1, 1));
			}
		}
		hits += compareCasts(t, rays(prng(frame), 25, 3), (s) => s.scene, true, `frame ${frame}`);
	}
	assert.ok(hits > 20);
});

test('position.needsUpdate refits the BVH; replacing the index / position array rebuilds it', () => {
	const t = twin((L, labels, r) => {
		const g = geometry(L, soup(6, 12, 2));
		const mesh = new L.Mesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }));
		xform(L, mesh, r); labels.set(mesh, 'm');
		return { mesh, rc: new L.Raycaster() };
	});
	const rl = rays(prng(21), 40);
	compareCasts(t, rl, undefined, true, 'initial');
	const bvh = t.jrs.mesh.geometry.boundsTree;
	assert.ok(bvh);
	for (let step = 0; step < 4; step++) {
		for (const s of [t.three, t.jrs]) {
			const p = s.mesh.geometry.attributes.position;
			for (let i = 0; i < p.count; i++) { p.setZ(i, p.getZ(i) * 0.9 + 0.05 * Math.sin(i + step)); p.setX(i, p.getX(i) * 1.02); }
			p.needsUpdate = true;
			s.mesh.geometry.computeBoundingSphere(); s.mesh.geometry.boundingBox = null;
		}
		compareCasts(t, rl, undefined, true, 'refit ' + step);
		assert.equal(t.jrs.mesh.geometry.boundsTree, bvh, 'refit keeps the same tree');
	}
	// replace the index with a reversed / truncated one
	for (const s of [t.three, t.jrs]) {
		const g = s.mesh.geometry, old = Array.from(g.index.array);
		g.setIndex(old.slice(0, old.length - 3 * 40).reverse());
	}
	compareCasts(t, rl, undefined, true, 'new index');
	assert.notEqual(t.jrs.mesh.geometry.boundsTree, bvh);
	// in-place index edit + needsUpdate
	for (const s of [t.three, t.jrs]) {
		const ia = s.mesh.geometry.index; ia.array.reverse(); ia.needsUpdate = true;
	}
	compareCasts(t, rl, undefined, true, 'index edit');
	// replace the position array
	for (const s of [t.three, t.jrs]) {
		const g = s.mesh.geometry;
		g.setAttribute('position', new s.L.BufferAttribute(new Float32Array(g.attributes.position.array).map((v) => v * 1.5), 3));
		g.computeBoundingSphere(); g.boundingBox = null;
	}
	compareCasts(t, rl, undefined, true, 'new position');
});

test('near / far windows over a scene of meshes (sphere pruning must never drop a real hit)', () => {
	const t = twin((L, labels, r) => {
		const g = geometry(L, soup(7, 6, 1));
		const scene = new L.Scene();
		for (let i = 0; i < 40; i++) {
			const m = new L.Mesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }));
			xform(L, m, r); m.position.multiplyScalar(5); m.scale.multiplyScalar(i % 4 ? 1 : 3); labels.set(m, 'm' + i); scene.add(m);
		}
		scene.updateMatrixWorld(true);
		return { scene, rc: new L.Raycaster() };
	});
	const r = prng(33);
	for (let k = 0; k < 40; k++) {
		const near = r() < 0.5 ? 0 : rnd(r, 0, 12), far = r() < 0.3 ? Infinity : near + rnd(r, 0.5, 15);
		t.three.rc.near = t.jrs.rc.near = near; t.three.rc.far = t.jrs.rc.far = far;
		compareCasts(t, rays(r, 12, 6), (s) => s.scene, true, `near ${near} far ${far}`);
	}
});

test('InstancedMesh over a BVH geometry, with a moving parent', () => {
	const t = twin((L, labels, r) => {
		const g = new L.SphereGeometry(0.6, 10, 8);
		const im = new L.InstancedMesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }), 60);
		const m4 = new L.Matrix4(), q = new L.Quaternion(), s = new L.Vector3();
		for (let i = 0; i < 60; i++) {
			q.setFromEuler(new L.Euler(rnd(r, 0, 6), rnd(r, 0, 6), rnd(r, 0, 6)));
			s.set(rnd(r, 0.5, 1.5), rnd(r, 0.5, 1.5), rnd(r, 0.5, 1.5));
			im.setMatrixAt(i, m4.compose(new L.Vector3(rnd(r, -4, 4), rnd(r, -4, 4), rnd(r, -4, 4)), q, s));
		}
		im.instanceMatrix.needsUpdate = true;
		const parent = new L.Group(); parent.add(im); labels.set(im, 'im');
		parent.position.set(1, 0, 0); parent.updateMatrixWorld(true);
		return { parent, mesh: im, rc: new L.Raycaster() };
	});
	let hits = 0;
	for (let frame = 0; frame < 6; frame++) {
		for (const s of [t.three, t.jrs]) { s.parent.rotation.y += 0.4; s.parent.position.z -= 0.3; s.parent.updateMatrixWorld(true); }
		hits += compareCasts(t, rays(prng(frame), 40, 5), (s) => s.parent, true, `frame ${frame}`);
	}
	assert.ok(hits > 10);
});

test('Points, Lines and Sprites in one scene with random transforms and thresholds', () => {
	const t = twin((L, labels, r) => {
		const scene = new L.Scene();
		const pts = [], lines = [];
		for (let i = 0; i < 300; i++) pts.push(rnd(r, -1, 1), rnd(r, -1, 1), rnd(r, -1, 1));
		for (let i = 0; i < 40; i++) lines.push(rnd(r, -1, 1), rnd(r, -1, 1), rnd(r, -1, 1));
		for (let i = 0; i < 6; i++) {
			const pg = new L.BufferGeometry(); pg.setAttribute('position', new L.Float32BufferAttribute(pts, 3));
			const points = new L.Points(pg, new L.PointsMaterial());
			const lg = new L.BufferGeometry(); lg.setAttribute('position', new L.Float32BufferAttribute(lines, 3));
			const line = i % 2 ? new L.Line(lg, new L.LineBasicMaterial()) : new L.LineSegments(lg, new L.LineBasicMaterial());
			for (const o of [points, line]) { xform(L, o, r); o.scale.set(1.3, 1.3, 1.3); scene.add(o); }
			labels.set(points, 'p' + i); labels.set(line, 'l' + i);
			const sprite = new L.Sprite(new L.SpriteMaterial({ sizeAttenuation: i % 2 === 0 }));
			sprite.position.set(rnd(r, -2, 2), rnd(r, -2, 2), rnd(r, -2, 2)); sprite.scale.set(rnd(r, 0.5, 2), rnd(r, 0.5, 2), 1);
			scene.add(sprite); labels.set(sprite, 's' + i);
		}
		const camera = new L.PerspectiveCamera(60, 1, 0.1, 100); camera.position.set(0, 0, 6); camera.updateMatrixWorld(true);
		scene.updateMatrixWorld(true);
		const rc = new L.Raycaster(); rc.params.Points.threshold = 0.08; rc.params.Line.threshold = 0.06;
		return { scene, camera, rc };
	});
	let hits = 0;
	const r = prng(8);
	for (let k = 0; k < 60; k++) {
		const ndc = { x: rnd(r, -0.6, 0.6), y: rnd(r, -0.6, 0.6) };
		const a = [], b = [];
		for (const s of [t.three, t.jrs]) {
			s.rc.setFromCamera(ndc, s.camera);
			const list = describe(s.rc.intersectObject(s.scene, true), s.labels);
			(s === t.three ? a : b).push(...list);
		}
		hits += a.length ? 1 : 0;
		assertSameHits(a.map((h) => ({ ...h })), b, `camera ray ${k}`);
		// also arbitrary rays
		const ray = rays(r, 1, 1.5)[0];
		const x = describe(cast(THREE, t.three.rc, ray, t.three.scene), t.three.labels), y = describe(cast(JRS, t.jrs.rc, ray, t.jrs.scene), t.jrs.labels);
		assertSameHits(x, y, `ray ${k}`);
	}
	assert.ok(hits > 5);
});

test('layers and visibility behave as in three.js; intersects can be reused', () => {
	const t = twin((L, labels, r) => {
		const g = geometry(L, soup(8, 6, 1));
		const scene = new L.Scene();
		for (let i = 0; i < 10; i++) {
			const m = new L.Mesh(g, new L.MeshBasicMaterial({ side: L.DoubleSide }));
			xform(L, m, r); labels.set(m, 'm' + i); scene.add(m);
			if (i % 3 === 0) m.layers.set(1);
			if (i % 4 === 0) m.layers.enable(2);
		}
		scene.updateMatrixWorld(true);
		return { scene, rc: new L.Raycaster() };
	});
	for (const layer of [0, 1, 2]) {
		t.three.rc.layers.set(layer); t.jrs.rc.layers.set(layer);
		compareCasts(t, rays(prng(layer), 30), (s) => s.scene, true, 'layer ' + layer);
	}
	const reuse = [];
	t.jrs.rc.layers.enableAll();
	const first = t.jrs.rc.intersectObject(t.jrs.scene, true, reuse);
	assert.equal(first, reuse);
});
