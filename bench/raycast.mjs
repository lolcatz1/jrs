// Raycasting benchmark + parity check: three.js r186 vs jrs. Pure node, no browser.
//   node bench/raycast.mjs [--json] [--reps=5] [--quick]
// Reports ms per 1 000 rays and asserts the hit lists are identical (same objects, same
// order, same face indices, distances within a tolerance).
import * as THREE from 'three';
import * as JRS from '../src/index.js';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.split('=')[1] : d; };
const QUICK = args.includes('--quick');
const REPS = +flag('reps', 5);
const REL_TOL = 1e-5; // jrs stores matrices as float32, three.js as doubles
const THREE_BIG_RAYS = +flag('threeBigRays', QUICK ? 5 : 20); // brute force on 1M triangles is slow

function prng(seed) {
	let s = seed >>> 0;
	return () => {
		s = (s + 0x6D2B79F5) >>> 0;
		let t = s;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function median(a) { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; }

// rays are plain numbers so both libs get exactly the same input
function makeRays(n, seed, extent, targetExtent) {
	const r = prng(seed), out = [];
	for (let i = 0; i < n; i++) {
		const o = [(r() * 2 - 1) * extent, (r() * 2 - 1) * extent, extent * 1.5 + r() * 10];
		const t = [(r() * 2 - 1) * targetExtent, (r() * 2 - 1) * targetExtent, (r() * 2 - 1) * targetExtent];
		let d = [t[0] - o[0], t[1] - o[1], t[2] - o[2]];
		const l = Math.hypot(d[0], d[1], d[2]); d = [d[0] / l, d[1] / l, d[2] / l];
		out.push({ o, d });
	}
	return out;
}

// ---------------------------------------------------------------------------
// scenes (built identically for each library)
// ---------------------------------------------------------------------------
function buildSmallMeshes(T, n, seed, extent) {
	const r = prng(seed);
	const scene = new T.Scene();
	const geos = [new T.BoxGeometry(1, 1, 1), new T.SphereGeometry(0.6, 6, 4), new T.CylinderGeometry(0.4, 0.5, 1, 8, 1), new T.IcosahedronGeometry(0.6, 0)];
	const mats = [new T.MeshBasicMaterial(), new T.MeshBasicMaterial({ side: T.DoubleSide }), new T.MeshBasicMaterial({ side: T.BackSide })];
	for (let i = 0; i < n; i++) {
		const m = new T.Mesh(geos[i % geos.length], mats[i % 7 === 0 ? 1 : i % 11 === 0 ? 2 : 0]);
		m.position.set((r() * 2 - 1) * extent, (r() * 2 - 1) * extent, (r() * 2 - 1) * extent);
		m.rotation.set(r() * 6, r() * 6, r() * 6);
		const s = 0.5 + r() * 1.5; m.scale.set(s, s, s * (0.5 + r()));
		m.userData.i = i;
		scene.add(m);
	}
	scene.updateMatrixWorld(true);
	return scene;
}

function buildBigMesh(T, segs) {
	const scene = new T.Scene();
	const m = new T.Mesh(new T.SphereGeometry(10, segs, segs), new T.MeshBasicMaterial({ side: T.DoubleSide }));
	m.rotation.set(0.3, 0.2, 0.1); m.position.set(1, 2, 3); m.userData.i = 0;
	scene.add(m);
	scene.updateMatrixWorld(true);
	return scene;
}

function buildInstanced(T, count, seed) {
	const r = prng(seed);
	const scene = new T.Scene();
	const im = new T.InstancedMesh(new T.SphereGeometry(0.7, 8, 6), new T.MeshBasicMaterial(), count);
	const m4 = new T.Matrix4(), q = new T.Quaternion(), p = new T.Vector3(), s = new T.Vector3(1, 1, 1);
	for (let i = 0; i < count; i++) {
		p.set((r() * 2 - 1) * 50, (r() * 2 - 1) * 50, (r() * 2 - 1) * 50);
		q.setFromEuler(new T.Euler(r() * 6, r() * 6, r() * 6));
		im.setMatrixAt(i, m4.compose(p, q, s));
	}
	im.instanceMatrix.needsUpdate = true;
	im.userData.i = 0;
	scene.add(im);
	scene.updateMatrixWorld(true);
	return scene;
}

// ---------------------------------------------------------------------------
// harness
// ---------------------------------------------------------------------------
function makeCaster(T, rays) {
	const rc = new T.Raycaster();
	const o = new T.Vector3(), d = new T.Vector3();
	return {
		rc,
		cast(i, fn) { const ray = rays[i]; o.set(ray.o[0], ray.o[1], ray.o[2]); d.set(ray.d[0], ray.d[1], ray.d[2]); rc.set(o, d); return fn(rc); }
	};
}

function summarise(hits) {
	const out = new Array(hits.length);
	for (let i = 0; i < hits.length; i++) {
		const h = hits[i];
		out[i] = { i: h.object.userData.i, dist: h.distance, face: h.faceIndex === undefined ? -1 : h.faceIndex, inst: h.instanceId === undefined ? -1 : h.instanceId, px: h.point.x, py: h.point.y, pz: h.point.z };
	}
	return out;
}

function compare(a, b, label) {
	if (a.length !== b.length) return `${label}: hit count ${a.length} vs ${b.length}`;
	let maxRel = 0;
	for (let k = 0; k < a.length; k++) {
		const x = a[k], y = b[k];
		if (x.i !== y.i || x.face !== y.face || x.inst !== y.inst) return `${label}: hit ${k}: object/face/instance ${x.i}/${x.face}/${x.inst} vs ${y.i}/${y.face}/${y.inst}`;
		const rel = Math.abs(x.dist - y.dist) / Math.max(1, Math.abs(x.dist));
		if (!(rel <= REL_TOL)) return `${label}: hit ${k}: distance ${x.dist} vs ${y.dist}`;
		if (rel > maxRel) maxRel = rel;
	}
	compare.maxRel = Math.max(compare.maxRel || 0, maxRel);
	return null;
}

// Runs one scenario against both libs. `frame(scene, f)` mutates the scene for animated scenarios.
function runScenario(name, desc, { build, rays, perFrame, frames = 1, threeRays, cast }) {
	const res = { name, desc, errors: [] };
	const libs = { three: THREE, jrs: JRS };
	const hitsByLib = {};
	for (const [lib, T] of Object.entries(libs)) {
		const scene = build(T);
		const nRays = lib === 'three' && threeRays !== undefined ? threeRays : rays.length;
		const caster = makeCaster(T, rays);
		const run = (f, sink) => {
			let total = 0;
			for (let i = 0; i < nRays; i++) {
				const hits = caster.cast(i, (rc) => cast(rc, scene));
				total += hits.length;
				if (sink) sink.push(summarise(hits));
			}
			return total;
		};
		// warm-up + parity capture over `frames` frames
		const captured = [];
		const t0 = performance.now();
		for (let f = 0; f < frames; f++) { if (perFrame) perFrame(T, scene, f); run(f, captured); }
		const firstRunMs = performance.now() - t0;
		hitsByLib[lib] = captured;
		// timed repetitions (scene updates excluded from timing)
		const times = [];
		for (let rep = 0; rep < REPS; rep++) {
			let ms = 0, count = 0;
			for (let f = 0; f < frames; f++) {
				if (perFrame) perFrame(T, scene, f + frames * (rep + 1));
				const t = performance.now(); run(f); ms += performance.now() - t; count += nRays;
			}
			times.push(ms / count * 1000);
		}
		res[lib] = { msPer1000: median(times), minMsPer1000: Math.min(...times), raysTimed: nRays, firstRunMs, hits: captured.reduce((s, h) => s + h.length, 0) / captured.length };
	}
	// parity over the rays both libs processed
	const a = hitsByLib.three, b = hitsByLib.jrs;
	const perFrameRays = rays.length, nThree = threeRays !== undefined ? threeRays : rays.length;
	for (let f = 0; f < frames; f++) {
		for (let i = 0; i < nThree; i++) {
			const err = compare(a[f * nThree + i], b[f * perFrameRays + i], `${name} frame ${f} ray ${i}`);
			if (err) { res.errors.push(err); break; }
		}
		if (res.errors.length) break;
	}
	res.identical = res.errors.length === 0;
	return res;
}

const results = [];

// (a) 10 000 small meshes, 1 000 rays, flat children, recursive
{
	const extent = 100, N = QUICK ? 2000 : 10000;
	results.push(runScenario('a-small-meshes', `${N} small meshes (<=80 tris), 1000 rays via intersectObjects(scene.children, true)`, {
		build: (T) => buildSmallMeshes(T, N, 11, extent),
		rays: makeRays(1000, 5, extent, extent),
		cast: (rc, scene) => rc.intersectObjects(scene.children, true),
	}));
}

// (b) one ~1M-triangle mesh, 1 000 rays (three.js is brute force: it casts fewer rays and the time is scaled)
{
	const segs = QUICK ? 200 : 708;
	results.push(runScenario('b-1M-triangles', `one SphereGeometry(${segs}x${segs}) mesh (${QUICK ? '~80k' : '~1M'} tris), 1000 rays; three.js timed on ${THREE_BIG_RAYS} rays and scaled`, {
		build: (T) => buildBigMesh(T, segs),
		rays: makeRays(1000, 9, 12, 8),
		threeRays: THREE_BIG_RAYS,
		cast: (rc, scene) => rc.intersectObject(scene.children[0], false),
	}));
}

// (c) 200 rays vs 2 000 moving meshes, world matrices change each frame
{
	const extent = 80, N = 2000, frames = QUICK ? 3 : 10;
	results.push(runScenario('c-moving-meshes', `${N} meshes whose transforms change every frame, 200 rays/frame, ${frames} frames, updateMatrixWorld excluded from timing`, {
		build: (T) => buildSmallMeshes(T, N, 23, extent),
		rays: makeRays(200, 31, extent, extent),
		frames,
		perFrame: (T, scene, f) => {
			const ch = scene.children;
			for (let i = 0; i < ch.length; i++) {
				const m = ch[i];
				m.position.x += Math.sin(f + i) * 0.7;
				m.rotation.y += 0.05 + (i % 5) * 0.01;
				if (i % 17 === 0) m.scale.setScalar(1 + 0.3 * Math.sin(f * 0.5 + i));
			}
			scene.updateMatrixWorld(true);
		},
		cast: (rc, scene) => rc.intersectObjects(scene.children, true),
	}));
}

// (c2) nested hierarchy: moving parents, children inherit
{
	const extent = 60, frames = QUICK ? 3 : 10;
	results.push(runScenario('c2-hierarchy', `200 moving groups x 10 child meshes, 200 rays/frame, ${frames} frames`, {
		build: (T) => {
			const r = prng(77), scene = new T.Scene();
			const geo = new T.BoxGeometry(1, 1, 1), mat = new T.MeshBasicMaterial({ side: T.DoubleSide });
			let id = 0;
			for (let g = 0; g < 200; g++) {
				const grp = new T.Group(); grp.position.set((r() * 2 - 1) * extent, (r() * 2 - 1) * extent, (r() * 2 - 1) * extent);
				for (let c = 0; c < 10; c++) { const m = new T.Mesh(geo, mat); m.position.set(r() * 6 - 3, r() * 6 - 3, r() * 6 - 3); m.userData.i = id++; grp.add(m); }
				scene.add(grp);
			}
			scene.updateMatrixWorld(true);
			return scene;
		},
		rays: makeRays(200, 41, extent, extent),
		frames,
		perFrame: (T, scene, f) => {
			const ch = scene.children;
			for (let i = 0; i < ch.length; i++) { ch[i].rotation.y += 0.03; if (i % 3 === 0) ch[i].position.x += Math.cos(f + i) * 0.5; }
			scene.updateMatrixWorld(true);
		},
		cast: (rc, scene) => rc.intersectObjects(scene.children, true),
	}));
}

// (d) InstancedMesh (SkinnedMesh is not implemented in jrs)
{
	const count = QUICK ? 200 : 1000;
	results.push(runScenario('d-instanced', `InstancedMesh with ${count} sphere instances, 1000 rays via intersectObject (SkinnedMesh: not supported by jrs, skipped)`, {
		build: (T) => buildInstanced(T, count, 3),
		rays: makeRays(1000, 17, 50, 50),
		cast: (rc, scene) => rc.intersectObject(scene.children[0], false),
	}));
}

// BVH build time (jrs only; three.js has none)
{
	const buildTimes = {};
	for (const [label, segs] of [['100k tris', 224], ['1M tris', 708]]) {
		if (QUICK && segs > 300) continue;
		const g = new JRS.SphereGeometry(10, segs, segs);
		const tris = g.index.count / 3;
		const ts = [];
		for (let i = 0; i < 3; i++) { g.disposeBoundsTree(); const t = performance.now(); g.computeBoundsTree(); ts.push(performance.now() - t); }
		buildTimes[label] = { tris, ms: median(ts) };
	}
	results.buildTimes = buildTimes;
}

// ---------------------------------------------------------------------------
console.log('\nRaycast benchmark: ms per 1000 rays (median of ' + REPS + ' reps; lower is better)\n');
const rows = [];
let failed = false;
for (const r of results) {
	const speed = r.three.msPer1000 / r.jrs.msPer1000;
	rows.push({ scenario: r.name, 'three ms/1k': r.three.msPer1000.toFixed(1), 'jrs ms/1k': r.jrs.msPer1000.toFixed(1), speedup: speed.toFixed(2) + 'x', 'hits/ray': r.jrs.hits.toFixed(2), identical: r.identical ? 'yes' : 'NO' });
	if (!r.identical) { failed = true; console.error('MISMATCH:', r.errors[0]); }
}
console.table(rows);
if (results.buildTimes) console.log('jrs BVH build time:', JSON.stringify(results.buildTimes));
console.log('max relative distance difference seen: ' + (compare.maxRel || 0).toExponential(2));
if (args.includes('--json')) writeFileSync(flag('out', 'bench/results/swarm/raycast-picking.json'), JSON.stringify({ results, buildTimes: results.buildTimes, maxRel: compare.maxRel }, null, 2));
if (failed) { console.error('\nFAIL: results differ from three.js'); process.exit(1); }
console.log('\nOK: all hit lists identical to three.js (objects, order, face indices, distances within ' + REL_TOL + ' relative).');
