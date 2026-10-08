// Flat scene update (core/FlatGraph.js + WebGLRenderer._flatPass): the single parent-before-child loop must behave exactly
// like scene.updateMatrixWorld() followed by the recursive _projectObject walk. Each test builds the same hierarchy twice,
// drives one copy through the recursive path and the other through the flat pass (with a GL-free fake renderer), and
// compares matrices, versions, item order and hook order.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Object3D } from '../src/core/Object3D.js';
import { Group } from '../src/objects/Group.js';
import { Mesh } from '../src/objects/Mesh.js';
import { Sprite } from '../src/objects/Sprite.js';
import { Scene } from '../src/scenes/Scene.js';
import { BufferGeometry } from '../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../src/core/BufferAttribute.js';
import { MeshBasicMaterial } from '../src/materials/MeshBasicMaterial.js';
import { PerspectiveCamera } from '../src/cameras/PerspectiveCamera.js';
import { DirectionalLight } from '../src/lights/DirectionalLight.js';
import { Matrix4 } from '../src/math/Matrix4.js';
import { FlatGraph, K_CUSTOM, K_INSUB, K_POST } from '../src/core/FlatGraph.js';
import { WebGLRenderer } from '../src/renderers/WebGLRenderer.js';
import { epochs } from '../src/core/epochs.js';

function prng(seed) {
	let s = seed >>> 0;
	return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const geometry = new BufferGeometry();
geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 0, 1, 0], 3));
geometry.computeBoundingSphere();
const material = new MeshBasicMaterial();

function randomize(o, r) {
	o.position.set(r() * 4 - 2, r() * 4 - 2, r() * 4 - 2);
	o.rotation.set(r() * 6, r() * 6, r() * 6);
	o.scale.set(0.5 + r(), 0.5 + r(), 0.5 + r());
}

/** A hierarchy with meshes, groups, a light, a camera, a sprite and an invisible subtree, deterministic for a seed. */
function buildWorld(seed = 1) {
	const r = prng(seed);
	const scene = new Scene();
	const all = [scene], named = {};
	const make = (Type, name, parent) => { const o = new Type(geometry, material); o.name = name; randomize(o, r); parent.add(o); all.push(o); named[name] = o; return o; };
	const g1 = make(Group, 'g1', scene);
	make(Mesh, 'm1', g1); make(Mesh, 'm2', g1);
	const g2 = make(Group, 'g2', g1);
	make(Mesh, 'm3', g2); make(Mesh, 'm4', g2);
	const hidden = make(Group, 'hidden', scene); hidden.visible = false;
	make(Mesh, 'h1', hidden); make(Mesh, 'h2', hidden);
	const light = new DirectionalLight(); light.name = 'light'; randomize(light, r); scene.add(light); all.push(light); named.light = light;
	const camRig = make(Group, 'rig', scene);
	const cam = new PerspectiveCamera(); cam.name = 'cam'; randomize(cam, r); camRig.add(cam); all.push(cam); named.cam = cam;
	const sprite = new Sprite(); sprite.name = 'sprite'; randomize(sprite, r); scene.add(sprite); all.push(sprite); named.sprite = sprite;
	make(Mesh, 'm5', scene);
	const viewer = new PerspectiveCamera(); viewer.position.set(0, 0, 20); viewer.updateMatrixWorld();
	return { scene, all, named, viewer };
}

/** GL-free stand-in for the renderer: records pushes, hooks and lights in order; every object passes the cull test. */
function fakeRenderer() {
	const f = {
		_rec: null, _cameraLayerMask: 1, _deferSkeletons: false, _skinnedPending: [],
		pushed: [], lightsPushed: [],
		lights: { push(l) { f.lightsPushed.push(l); } },
		_cullTest() { return true; },
		_itemDepth(o, ve, out) { out[0] = 0; },
		_pushItem(list, object) { f.pushed.push(object); },
	};
	return f;
}
const fakeList = { count: 0, zScratch: new Float64Array(1) };

function flatPass(f, scene, camera, doUpdate = true, project = true) {
	let g = scene._flatGraph;
	if (g === null) { g = new FlatGraph(scene); scene._flatGraph = g; }
	if (g.valid === false || g.validate() === false) g.rebuild();
	g.patches = 0;
	f.pushed.length = 0; f.lightsPushed.length = 0;
	WebGLRenderer.prototype._flatPass.call(f, g, scene, camera, project ? fakeList : null, doUpdate, project, false);
	return g;
}

function worldsOf(objects) { return objects.map((o) => Array.from(o.matrixWorld.elements)); }
function assertSameWorlds(a, b, what) {
	assert.equal(a.length, b.length, what + ': count');
	for (let i = 0; i < a.length; i++) assert.deepEqual(worldsOf([a[i]])[0], worldsOf([b[i]])[0], `${what}: matrixWorld of ${a[i].name || a[i].type} (#${i})`);
}
/** The recursive reference path, as render() runs it. */
function recursiveUpdate(scene, camera) {
	if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
	if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
}
function traverseVisibleOrder(scene, camera) {
	const out = [];
	scene.traverseVisible((o) => { if ((o.layers.mask & camera.layers.mask) !== 0 && (o.isMesh || o.isSprite)) out.push(o.name); });
	return out;
}

test('flat graph is traverse order, parent before child, with correct subtree ends', () => {
	const { scene, all } = buildWorld();
	const g = new FlatGraph(scene); g.rebuild();
	const order = []; scene.traverse((o) => order.push(o));
	assert.deepEqual(g.objects.slice(0, g.n), order);
	assert.equal(g.n, all.length);
	for (let i = 0; i < g.n; i++) {
		const o = g.objects[i];
		assert.equal(g.parent[i], o.parent === null ? -1 : g.objects.indexOf(o.parent));
		assert.ok(g.parent[i] < i);
		let count = 0; o.traverse(() => count++);
		assert.equal(g.end[i] - i, count, 'subtree size of ' + o.name);
		assert.equal(g.childCount[i], o.children.length);
		assert.equal(o._flat, g); assert.equal(o._flatIndex, i);
	}
});

test('flat pass reproduces updateMatrixWorld: first frame, animated frames, parent moves, static frames', () => {
	const A = buildWorld(7), B = buildWorld(7);
	const f = fakeRenderer();
	for (let frame = 0; frame < 6; frame++) {
		if (frame > 0) {
			for (const w of [A, B]) {
				w.named.g1.rotation.y += 0.1; w.named.m3.position.x += 0.5; w.named.cam.rotation.x += 0.05;
				if (frame === 3) w.named.g2.scale.setScalar(2);
			}
		}
		recursiveUpdate(A.scene, A.viewer);
		flatPass(f, B.scene, B.viewer);
		assertSameWorlds(A.all, B.all, 'frame ' + frame);
		for (let i = 0; i < A.all.length; i++) {
			assert.equal(B.all[i]._worldVersion, A.all[i]._worldVersion, `world version of ${A.all[i].name} (frame ${frame})`);
			assert.equal(B.all[i].matrixWorldNeedsUpdate, false);
		}
		// the camera inside the hierarchy keeps its inverse current (K_POST hook)
		assert.deepEqual(Array.from(B.named.cam.matrixWorldInverse.elements), Array.from(A.named.cam.matrixWorldInverse.elements));
	}
});

test('items are pushed in traverseVisible order; invisible subtrees keep their world matrices updated', () => {
	const { scene, named, viewer, all } = buildWorld(3);
	const f = fakeRenderer();
	flatPass(f, scene, viewer);
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer));
	assert.deepEqual(f.lightsPushed, [named.light]);
	assert.ok(!f.pushed.includes(named.h1) && !f.pushed.includes(named.h2));
	// hidden subtree world matrices are still updated like three.js does
	const expected = new Matrix4().multiplyMatrices(named.hidden.matrixWorld, named.h1.matrix);
	assert.deepEqual(Array.from(named.h1.matrixWorld.elements), Array.from(expected.elements));
	// toggling visibility re-includes the subtree, in traversal position
	named.hidden.visible = true;
	flatPass(f, scene, viewer);
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer));
	// scene itself invisible: nothing pushed, matrices still updated
	scene.visible = false; named.m1.position.x += 1;
	const before = all.map((o) => o._worldVersion);
	flatPass(f, scene, viewer);
	assert.equal(f.pushed.length, 0);
	assert.ok(named.m1._worldVersion > before[all.indexOf(named.m1)]);
});

test('layers: objects whose layers do not match the camera are skipped but their children are not', () => {
	const { scene, named, viewer } = buildWorld(4);
	const f = fakeRenderer();
	named.g1.layers.set(2); // group on another layer: children still visible
	named.m3.layers.set(2);
	flatPass(f, scene, viewer);
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer));
	assert.ok(!f.pushed.includes(named.m3) && f.pushed.includes(named.m4));
	f._cameraLayerMask = viewer.layers.mask = 1 | 4;
	flatPass(f, scene, viewer);
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer));
	assert.ok(f.pushed.includes(named.m3));
});

test('matrixAutoUpdate = false objects use the user-written local matrix', () => {
	const A = buildWorld(5), B = buildWorld(5);
	const f = fakeRenderer();
	for (const w of [A, B]) {
		w.named.m2.matrixAutoUpdate = false;
		w.named.m2.matrix.makeTranslation(1, 2, 3);
		w.named.m2.matrixWorldNeedsUpdate = true;
		w.named.g2.matrixAutoUpdate = false; // group: its children compose with the frozen local matrix
	}
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'frame 0');
	for (const w of [A, B]) { w.named.m2.position.x = 100; w.named.g2.rotation.z = 1; w.named.g1.position.y += 1; }
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'frame 1 (position change ignored)');
	// a user-written matrix without the flag is picked up once the parent moves (both paths) or the flag is set
	for (const w of [A, B]) { w.named.m2.matrix.makeTranslation(5, 5, 5); w.named.m2.matrixWorldNeedsUpdate = true; }
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'frame 2');
	assert.deepEqual(Array.from(B.named.m2.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(B.named.g1.matrixWorld, B.named.m2.matrix).elements));
});

test('matrixWorldAutoUpdate = false objects keep the user-written world matrix; children follow it when flagged', () => {
	const A = buildWorld(6), B = buildWorld(6);
	const f = fakeRenderer();
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	for (const w of [A, B]) {
		w.named.g2.matrixWorldAutoUpdate = false;
		w.named.g2.matrixWorld.makeTranslation(7, 8, 9);
		w.named.g2.position.x += 3; // ignored: the world matrix is user-owned
	}
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'user world matrix, children not yet flagged');
	assert.deepEqual(Array.from(B.named.g2.matrixWorld.elements), Array.from(new Matrix4().makeTranslation(7, 8, 9).elements));
	for (const w of [A, B]) w.named.g2.matrixWorldNeedsUpdate = true; // three.js: force descendants to use the new world matrix
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'children forced');
	assert.deepEqual(Array.from(B.named.m3.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(B.named.g2.matrixWorld, B.named.m3.matrix).elements));
	for (const w of [A, B]) { w.named.g1.rotation.x += 0.3; } // parent moves: g2 stays user-owned, m3 recomputed from it
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'parent moved above a user-owned world matrix');
});

test('user calls to updateMatrixWorld(force) / updateWorldMatrix(parents, children) between frames', () => {
	const A = buildWorld(8), B = buildWorld(8);
	const f = fakeRenderer();
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	for (const w of [A, B]) {
		w.named.m3.position.z += 1; w.named.m3.updateWorldMatrix(true, false); // ancestors + self, between frames
		w.named.g1.rotation.y += 0.2; w.named.g1.updateMatrixWorld(true);        // forced subtree
		w.named.m5.position.x += 2; w.named.m5.updateWorldMatrix(false, true);
	}
	assertSameWorlds(A.all, B.all, 'after user calls');
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'next frame');
	for (let i = 0; i < A.all.length; i++) assert.equal(B.all[i]._worldVersion, A.all[i]._worldVersion, 'version of ' + A.all[i].name);
	// scene.updateMatrixWorld() by the app every frame is harmless
	for (const w of [A, B]) { w.named.m1.position.y += 1; w.scene.updateMatrixWorld(); }
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	assertSameWorlds(A.all, B.all, 'app-side updateMatrixWorld');
});

test('add / remove / attach patch the flat array; direct children edits trigger a rebuild', () => {
	const { scene, named, viewer } = buildWorld(9);
	const f = fakeRenderer();
	const g = flatPass(f, scene, viewer);
	const check = (what) => {
		flatPass(f, scene, viewer); // validates the graph (rebuilding it after a direct children edit) and runs it
		assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer), what + ': items');
		const order = []; scene.traverse((o) => order.push(o));
		assert.deepEqual(g.objects.slice(0, g.n).map((o) => o.name), order.map((o) => o.name), what + ': order');
		for (let i = 0; i < g.n; i++) {
			const o = g.objects[i];
			assert.equal(g.parent[i], o.parent === null ? -1 : g.objects.indexOf(o.parent), what + ': parent of ' + o.name);
			let count = 0; o.traverse(() => count++);
			assert.equal(g.end[i] - i, count, what + ': subtree of ' + o.name);
			assert.equal(g.childCount[i], o.children.length, what + ': childCount of ' + o.name);
			assert.equal(g.indexOf(o), i, what + ': index of ' + o.name);
		}
	};
	const rebuilds = g.rebuilds;
	const sub = new Group(); sub.name = 'sub';
	const s1 = new Mesh(geometry, material); s1.name = 's1'; sub.add(s1);
	const s2 = new Mesh(geometry, material); s2.name = 's2'; s1.add(s2);
	named.g2.add(sub); check('add subtree under g2');
	named.m1.add(new Mesh(geometry, material)); check('add leaf under m1');
	scene.add(new Mesh(geometry, material)); check('append to scene');
	named.g1.remove(named.g2); check('remove subtree');
	scene.add(named.g2); check('re-add removed subtree at the end');
	named.hidden.attach(named.m5); check('attach (world transform kept)');
	named.g1.add(named.m4); check('reparent inside the graph (remove + add)');
	assert.equal(g.rebuilds, rebuilds, 'all patched, no rebuild');
	// direct children mutation is not seen by the hooks: validate() notices the length change and rebuilds
	const direct = new Mesh(geometry, material); direct.name = 'direct'; direct.parent = named.g1; named.g1.children.push(direct);
	check('direct children.push');
	assert.equal(g.rebuilds, rebuilds + 1);
	// removing from a graph the object is not indexed in (stale index) invalidates instead of corrupting
	const other = new Scene(); const og = new FlatGraph(other); og.rebuild();
	other.add(named.m2); // m2 moves from scene's graph into other's: scene's graph patched, other's graph patched
	check('moved to another scene');
	assert.equal(og.valid, true); og.onRemove(other, named.m2); // consistent
});

test('objects reparented or removed during onBeforeRender are seen next frame', () => {
	const { scene, named, viewer } = buildWorld(10);
	const f = fakeRenderer();
	flatPass(f, scene, viewer);
	// simulate hooks firing while the previous frame draws
	named.g2.remove(named.m3);
	scene.add(named.m3);
	named.g1.add(named.m5);
	named.m4.removeFromParent();
	flatPass(f, scene, viewer);
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(scene, viewer));
	assert.deepEqual(Array.from(named.m5.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(named.g1.matrixWorld, named.m5.matrix).elements));
	assert.deepEqual(Array.from(named.m3.matrixWorld.elements), Array.from(named.m3.matrix.elements));
});

test('subclass overriding updateMatrixWorld is called recursively for its subtree', () => {
	class Gizmo extends Object3D {
		updateMatrixWorld(force) { this.calls++; this.position.x = 1.5; super.updateMatrixWorld(force); }
	}
	const { scene, named, viewer } = buildWorld(11);
	const gz = new Gizmo(); gz.calls = 0; gz.name = 'gizmo';
	const inner = new Mesh(geometry, material); inner.name = 'inner'; inner.position.set(0, 1, 0); gz.add(inner);
	named.g2.add(gz);
	const f = fakeRenderer();
	const g = flatPass(f, scene, viewer);
	const gi = g.indexOf(gz);
	assert.ok(g.kind[gi] & K_CUSTOM); assert.ok(g.kind[gi + 1] & K_INSUB);
	assert.equal(gz.calls, 1);
	assert.deepEqual(Array.from(inner.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(gz.matrixWorld, inner.matrix).elements));
	assert.equal(gz.matrixWorld.elements[12] !== 0, true);
	assert.ok(f.pushed.includes(inner));
	assert.ok(g.kind[g.indexOf(named.cam)] & K_POST, 'cameras use the post-update hook, not the custom walk');
});

test('scene with matrixWorldAutoUpdate = false is not updated but still projected', () => {
	const A = buildWorld(12), B = buildWorld(12);
	const f = fakeRenderer();
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer);
	for (const w of [A, B]) { w.scene.matrixWorldAutoUpdate = false; w.named.m1.position.x += 5; }
	recursiveUpdate(A.scene, A.viewer); flatPass(f, B.scene, B.viewer, false, true);
	assertSameWorlds(A.all, B.all, 'frozen scene');
	assert.deepEqual(f.pushed.map((o) => o.name), traverseVisibleOrder(B.scene, B.viewer));
});

test('nested scenes rendered alternately and one scene seen by two passes', () => {
	const outer = buildWorld(13), inner = buildWorld(14);
	outer.scene.add(inner.scene);
	const f1 = fakeRenderer(), f2 = fakeRenderer();
	for (let frame = 0; frame < 4; frame++) {
		for (const w of [outer, inner]) w.named.g1.rotation.y += 0.1;
		flatPass(f1, outer.scene, outer.viewer);
		const expectOuter = traverseVisibleOrder(outer.scene, outer.viewer);
		assert.deepEqual(f1.pushed.map((o) => o.name), expectOuter);
		// second pass over the same scene (another renderer): nothing moved, same items
		flatPass(f2, outer.scene, outer.viewer);
		assert.deepEqual(f2.pushed.map((o) => o.name), expectOuter);
		assert.equal(outer.scene._flatGraph.changed, false);
		flatPass(f1, inner.scene, inner.viewer);
		assert.deepEqual(f1.pushed.map((o) => o.name), traverseVisibleOrder(inner.scene, inner.viewer));
		// inner objects composed with the outer chain (inner scene is a child of the outer scene)
		const m = inner.named.m1;
		assert.deepEqual(Array.from(m.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(inner.named.g1.matrixWorld, m.matrix).elements));
		assert.deepEqual(Array.from(inner.scene.matrixWorld.elements), Array.from(new Matrix4().multiplyMatrices(outer.scene.matrixWorld, inner.scene.matrix).elements));
		// mutating through the inner scene keeps both graphs consistent
		if (frame === 1) { inner.scene.add(new Mesh(geometry, material)); inner.named.g2.remove(inner.named.m3); }
	}
});

test('epochs.world moves exactly when a non-camera world matrix was recomputed', () => {
	const { scene, named, viewer } = buildWorld(15);
	const f = fakeRenderer();
	flatPass(f, scene, viewer);
	let w = epochs.world;
	flatPass(f, scene, viewer);
	assert.equal(epochs.world, w, 'static frame');
	assert.equal(scene._flatGraph.changed, false);
	named.cam.rotation.y += 0.1; // camera only (inside a static rig)
	flatPass(f, scene, viewer);
	assert.equal(epochs.world, w, 'camera move does not count');
	named.m4.position.x += 1;
	flatPass(f, scene, viewer);
	assert.ok(epochs.world > w); assert.equal(scene._flatGraph.changed, true);
});
