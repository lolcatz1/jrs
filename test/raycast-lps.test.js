// Raycast parity for Points / Line / LineSegments / LineLoop / Sprite: jrs and three.js r186 are built from the same
// seeded data and the complete ordered hit lists are compared (distance, point, index, uv, distanceToRay, ...).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as JRS from '../src/index.js';

function prng(seed) {
	let s = seed >>> 0;
	return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const num = (a, b, path) => { if (a === b) return; assert.ok(Math.abs(a - b) <= 1e-4 * Math.max(1, Math.abs(a), Math.abs(b)), `${path}: ${a} vs ${b}`); };

function describeHit(h, labels) {
	const out = { label: labels.get(h.object), distance: h.distance, point: [h.point.x, h.point.y, h.point.z], index: h.index, distanceToRay: h.distanceToRay, faceIndex: h.faceIndex, face: h.face };
	if (h.uv) out.uv = [h.uv.x, h.uv.y];
	return out;
}
// Hits at the same distance (a ray through a vertex shared by two segments) can swap order because jrs keeps
// float32 matrices; canonicalise ties before comparing.
const canonical = (hits) => hits.map((h, i) => [h, i]).sort((x, y) => (Math.abs(x[0].distance - y[0].distance) > 1e-4 * Math.max(1, x[0].distance) ? x[0].distance - y[0].distance : (x[0].label < y[0].label ? -1 : x[0].label > y[0].label ? 1 : x[0].index - y[0].index))).map((e) => e[0]);
function same(a, b, path = 'hits') {
	a = canonical(a); b = canonical(b);
	assert.equal(a.length, b.length, `${path}: hit count ${a.length} vs ${b.length}`);
	for (let i = 0; i < a.length; i++) {
		const x = a[i], y = b[i], p = `${path}[${i}]`;
		assert.equal(x.label, y.label, `${p}.object`);
		num(x.distance, y.distance, p + '.distance');
		for (let k = 0; k < 3; k++) num(x.point[k], y.point[k], `${p}.point[${k}]`);
		assert.equal(x.index, y.index, p + '.index');
		assert.equal(x.faceIndex, y.faceIndex, p + '.faceIndex');
		assert.equal(x.face, y.face, p + '.face');
		if (x.distanceToRay !== undefined || y.distanceToRay !== undefined) num(x.distanceToRay, y.distanceToRay, p + '.distanceToRay');
		if (x.uv || y.uv) { num(x.uv[0], y.uv[0], p + '.uv.x'); num(x.uv[1], y.uv[1], p + '.uv.y'); }
	}
}

function pointsGeometry(L, r, n, indexed, withRange) {
	const pos = new Float32Array(n * 3);
	for (let i = 0; i < pos.length; i++) pos[i] = (r() - 0.5) * 6;
	const g = new L.BufferGeometry(); g.setAttribute('position', new L.BufferAttribute(pos, 3));
	if (indexed) { const idx = []; for (let i = n - 1; i >= 0; i -= 2) idx.push(i); g.setIndex(idx); }
	if (withRange) g.setDrawRange(3, Math.floor(n / 2));
	return g;
}
function scene(L, seed) {
	const r = prng(seed), labels = new Map(), objects = [];
	const root = new L.Group(); root.position.set(0.5, -0.4, 0.2); root.rotation.set(0.2, 0.4, -0.1); root.scale.set(1.3, 0.8, 1.1);
	for (let i = 0; i < 12; i++) {
		let o;
		const kind = i % 4;
		if (kind === 0) o = new L.Points(pointsGeometry(L, r, 60, i % 8 === 0, i % 3 === 0), new L.PointsMaterial());
		else {
			const Ctor = [null, L.Line, L.LineSegments, L.LineLoop][kind];
			o = new Ctor(pointsGeometry(L, r, 12 + i, i % 2 === 0, i % 3 === 1), new L.LineBasicMaterial());
		}
		o.position.set((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3); o.rotation.set(r() * 6, r() * 6, r() * 6);
		o.scale.set(0.5 + r(), 0.5 + r(), 0.5 + r());
		if (i % 5 === 0) o.scale.setScalar(2);
		labels.set(o, `${o.type}${i}`); (i % 2 ? root : null) ? root.add(o) : objects.push(o);
	}
	const s = new L.Scene(); s.add(root, ...objects); s.updateMatrixWorld(true);
	return { scene: s, labels, r };
}

test('Points / Line / LineSegments / LineLoop raycast parity (indexed, drawRange, transforms, thresholds, near/far)', () => {
	const results = {};
	for (const [name, L] of [['three', THREE], ['jrs', JRS]]) {
		const { scene: s, labels } = scene(L, 4242);
		const rc = new L.Raycaster(); const rr = prng(99);
		const out = [];
		for (let k = 0; k < 120; k++) {
			rc.params.Points.threshold = 0.05 + rr() * 0.6; rc.params.Line.threshold = 0.05 + rr() * 0.5;
			rc.near = k % 7 === 0 ? 3 : 0; rc.far = k % 5 === 0 ? 9 : Infinity;
			rc.set(new L.Vector3((rr() - 0.5) * 4, (rr() - 0.5) * 4, 8), new L.Vector3((rr() - 0.5) * 0.3, (rr() - 0.5) * 0.3, -1).normalize());
			out.push(rc.intersectObject(s, true).map((h) => describeHit(h, labels)));
		}
		results[name] = out;
	}
	let total = 0;
	for (let k = 0; k < results.three.length; k++) { same(results.jrs[k], results.three[k], `ray ${k}`); total += results.three[k].length; }
	assert.ok(total > 50, `the battery should produce hits (got ${total})`);
});

test('Sprite raycast parity (perspective + orthographic, sizeAttenuation, rotation, center, scale, parents)', () => {
	for (const ortho of [false, true]) {
		const results = {};
		for (const [name, L] of [['three', THREE], ['jrs', JRS]]) {
			const r = prng(7), labels = new Map();
			const camera = ortho ? new L.OrthographicCamera(-6, 6, 4.5, -4.5, 0.1, 100) : new L.PerspectiveCamera(50, 4 / 3, 0.1, 100);
			camera.position.set(1, 0.5, 9); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
			const s = new L.Scene(); const g = new L.Group(); g.scale.set(1.2, 0.9, 1); g.position.set(0.3, 0, 0); s.add(g);
			for (let i = 0; i < 40; i++) {
				const m = new L.SpriteMaterial({ rotation: (r() - 0.5) * 6, sizeAttenuation: i % 3 !== 0 });
				const sp = new L.Sprite(m);
				sp.position.set((r() - 0.5) * 8, (r() - 0.5) * 6, (r() - 0.5) * 6);
				const sc = m.sizeAttenuation ? 0.5 + r() * 1.5 : 0.05 + r() * 0.15; sp.scale.set(sc * (1 + (i % 2)), sc, 1);
				sp.center.set(i % 4 === 0 ? 0 : 0.5, i % 5 === 0 ? 1 : 0.5);
				labels.set(sp, 'sprite' + i); (i % 2 ? g : s).add(sp);
			}
			s.updateMatrixWorld(true);
			const rc = new L.Raycaster(); const out = []; const rr = prng(5);
			for (let k = 0; k < 150; k++) {
				rc.near = k % 9 === 0 ? 5 : 0; rc.far = k % 6 === 0 ? 12 : Infinity;
				rc.setFromCamera(new L.Vector2(rr() * 2 - 1, rr() * 2 - 1), camera);
				out.push(rc.intersectObject(s, true).map((h) => describeHit(h, labels)));
			}
			results[name] = out;
		}
		let total = 0;
		for (let k = 0; k < results.three.length; k++) { same(results.jrs[k], results.three[k], `${ortho ? 'ortho' : 'persp'} ray ${k}`); total += results.three[k].length; }
		assert.ok(total > 30, `sprite battery should produce hits (got ${total})`);
	}
});
