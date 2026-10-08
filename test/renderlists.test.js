import test from 'node:test';
import assert from 'node:assert/strict';
import { WebGLRenderList } from '../src/renderers/webgl/WebGLRenderLists.js';

// deterministic PRNG
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const geoIndexed = { index: {} }, geoPlain = { index: null };
const opaqueMat = { transparent: false }, glassMat = { transparent: true };

/** Fills a list for one frame; returns reference expectations computed the straightforward way. */
function frame(list, specs, rankOf) {
	list.init();
	specs.forEach((s, i) => {
		list.zScratch[0] = s.z;
		list.push({ id: i, renderOrder: s.ro }, s.indexed ? geoIndexed : geoPlain, s.transparent ? glassMat : opaqueMat, null, s.mat, s.geo, 0);
		list.items[i].program = { _frameRid: s.prog };
	});
	list.finish(true, rankOf);
	// reference: same packed key as the pre-radix implementation, sorted by (key, item index)
	const opaque = [], transparent = [];
	let min = Infinity, max = -Infinity;
	specs.forEach((s) => { if (s.transparent) { if (s.z < min) min = s.z; if (s.z > max) max = s.z; } });
	const scale = max - min > 0 ? 67108863 / (max - min) : 0;
	specs.forEach((s, i) => {
		const rank = rankOf(s.ro);
		if (s.transparent) transparent.push([rank * 67108864 + Math.round((max - Math.fround(s.z)) * scale), i]);
		else opaque.push([(((rank * 64 + (s.prog & 63)) * 1024 + (s.mat & 1023)) * 2 + (s.indexed ? 1 : 0)) * 512 + (s.geo & 511), i]);
	});
	const order = (a) => a.sort((p, q) => p[0] - q[0] || p[1] - q[1]).map((e) => e[1]);
	return { opaque: order(opaque), transparent: order(transparent) };
}

function randomSpecs(r, n, opts) {
	return Array.from({ length: n }, () => ({
		ro: opts.renderOrders ? Math.floor(r() * 3) : 0,
		transparent: r() < opts.transparentFraction,
		indexed: r() < 0.5,
		prog: Math.floor(r() * opts.programs), mat: Math.floor(r() * opts.materials), geo: Math.floor(r() * opts.geometries),
		z: Math.fround(r() * 100 - 20),
	}));
}

test('render list order matches the reference, including ties and stability', () => {
	const r = rng(7);
	for (const n of [0, 1, 2, 5, 24, 25, 100, 3000]) {
		for (const opts of [
			{ transparentFraction: 0.5, programs: 3, materials: 4, geometries: 2, renderOrders: false },
			{ transparentFraction: 0.5, programs: 60, materials: 1000, geometries: 500, renderOrders: true },
			{ transparentFraction: 0.1, programs: 1, materials: 1, geometries: 1, renderOrders: false }, // all opaque keys equal
		]) {
			const list = new WebGLRenderList();
			const rankOf = opts.renderOrders ? (ro) => ro : () => 0;
			const specs = randomSpecs(r, n, opts);
			const want = frame(list, specs, rankOf);
			assert.deepEqual(Array.from(list.opaqueSorted), want.opaque, `opaque n=${n}`);
			assert.deepEqual(Array.from(list.transparentSorted), want.transparent, `transparent n=${n}`);
		}
	}
});

test('order stays exact across frames: unchanged, slowly moving, scrambled, resized', () => {
	const r = rng(99);
	const list = new WebGLRenderList();
	const rankOf = () => 0;
	let specs = randomSpecs(r, 2000, { transparentFraction: 0.7, programs: 4, materials: 8, geometries: 3, renderOrders: false });
	const check = (label) => {
		const want = frame(list, specs, rankOf);
		assert.deepEqual(Array.from(list.opaqueSorted), want.opaque, `opaque ${label}`);
		assert.deepEqual(Array.from(list.transparentSorted), want.transparent, `transparent ${label}`);
	};
	check('first');
	check('unchanged');
	for (let f = 0; f < 5; f++) { specs = specs.map((s) => ({ ...s, z: Math.fround(s.z + (r() - 0.5) * 0.5) })); check('slow move ' + f); }
	specs = specs.map((s) => ({ ...s, z: Math.fround(r() * 100) })); check('scrambled');
	specs = specs.map((s) => ({ ...s, mat: (s.mat + 1) % 8 })); check('materials changed');
	specs = specs.map((s) => ({ ...s, transparent: !s.transparent })); check('kinds swapped');
	specs = specs.slice(0, 1500); check('fewer items');
	specs = specs.concat(randomSpecs(r, 700, { transparentFraction: 0.5, programs: 4, materials: 8, geometries: 3, renderOrders: false })); check('more items');
	specs = specs.map((s) => ({ ...s, z: 5 })); check('all equal depth');
});

test('sorted views are stable objects when the count does not change', () => {
	const list = new WebGLRenderList();
	const specs = randomSpecs(rng(3), 50, { transparentFraction: 0.5, programs: 2, materials: 2, geometries: 2, renderOrders: false });
	frame(list, specs, () => 0);
	const a = list.opaqueSorted, b = list.transparentSorted;
	frame(list, specs, () => 0);
	assert.equal(list.opaqueSorted, a); assert.equal(list.transparentSorted, b);
});
