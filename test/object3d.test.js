import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import { Vector2 } from '../src/math/Vector2.js';
import { Vector3 } from '../src/math/Vector3.js';
import { Matrix4 } from '../src/math/Matrix4.js';
import { Quaternion } from '../src/math/Quaternion.js';
import { Euler } from '../src/math/Euler.js';
import { Object3D } from '../src/core/Object3D.js';
import { Group } from '../src/objects/Group.js';
import { Mesh } from '../src/objects/Mesh.js';
import { Scene } from '../src/scenes/Scene.js';
import { BufferGeometry } from '../src/core/BufferGeometry.js';
import { Float32BufferAttribute } from '../src/core/BufferAttribute.js';
import { MeshBasicMaterial } from '../src/materials/MeshBasicMaterial.js';
import { PerspectiveCamera } from '../src/cameras/PerspectiveCamera.js';
import { OrthographicCamera } from '../src/cameras/OrthographicCamera.js';
import { RECORD_SIZE, LOCAL_OFFSET, WORLD_OFFSET, transformSlab } from '../src/core/TransformSlab.js';

const OURS = { Vector2, Vector3, Matrix4, Quaternion, Euler, Object3D, Group, Mesh, Scene, BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, PerspectiveCamera, OrthographicCamera };

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
const ORDERS = ['XYZ', 'YXZ', 'ZXY', 'ZYX', 'YZX', 'XZY'];

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
	if (a.isEuler) { cmpKeys(['x', 'y', 'z']); return assert.equal(a.order, b.order, path + '.order'); }
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
const SEED = 0xBADF00D;
function compare(fn, eps = 1e-5) {
	assertClose(fn(OURS, prng(SEED)), fn(THREE, prng(SEED)), eps);
}

function setRandomTRS(o, r, uniformScale = false) {
	o.position.set(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
	o.rotation.set(rand(r, -Math.PI, Math.PI), rand(r, -Math.PI, Math.PI), rand(r, -Math.PI, Math.PI), ORDERS[Math.floor(r() * 6)]);
	const s = rand(r, 0.5, 2);
	o.scale.set(s, uniformScale ? s : rand(r, 0.5, 2), uniformScale ? s : rand(r, 0.5, 2));
}

/** 3-level hierarchy: root -> 3 mids -> 2 leaves each, random transforms, same order in both libs. */
function buildTree(L, r, Root = L.Object3D, uniform = false) {
	const root = new Root(); root.name = 'root';
	const all = [root];
	setRandomTRS(root, r, uniform);
	for (let i = 0; i < 3; i++) {
		const mid = new L.Object3D(); mid.name = 'mid' + i; setRandomTRS(mid, r, uniform); root.add(mid); all.push(mid);
		for (let j = 0; j < 2; j++) {
			const leaf = new L.Object3D(); leaf.name = `leaf${i}${j}`; setRandomTRS(leaf, r, uniform); mid.add(leaf); all.push(leaf);
		}
	}
	return { root, all };
}
function quadGeometry(L) {
	const g = new L.BufferGeometry();
	g.setAttribute('position', new L.Float32BufferAttribute([-1, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0.25, -1, 0.5, 0.25], 3));
	g.setIndex([0, 1, 2, 0, 2, 3]);
	return g;
}

// ---------------------------------------------------------------------------
// scene graph parity
// ---------------------------------------------------------------------------

test('hierarchy matrixWorld parity after updateMatrixWorld', () => {
	compare((L, r) => {
		const { root, all } = buildTree(L, r);
		root.updateMatrixWorld();
		return all.map((o) => [o.matrix, o.matrixWorld]);
	});
	compare((L, r) => {
		const { root, all } = buildTree(L, r, L.Scene);
		root.updateMatrixWorld();
		// second update with changes applied to a middle node
		all[1].position.x += 1; all[1].rotation.z += 0.5;
		root.updateMatrixWorld();
		return all.map((o) => o.matrixWorld);
	});
});

test('lookAt parity for plain objects, cameras and parented objects', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 8; i++) {
			const o = new L.Object3D();
			o.position.set(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			o.lookAt(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			out.push(o.quaternion, o.rotation);
			const cam = new L.PerspectiveCamera();
			cam.position.set(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			cam.lookAt(new L.Vector3(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5)));
			out.push(cam.quaternion, cam.getWorldDirection(new L.Vector3()));
			const parent = new L.Object3D(); setRandomTRS(parent, r, true);
			const child = new L.Object3D(); child.position.set(rand(r, -2, 2), rand(r, -2, 2), rand(r, -2, 2));
			parent.add(child);
			const target = new L.Vector3(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			child.lookAt(target);
			parent.updateMatrixWorld();
			out.push(child.quaternion, child.matrixWorld, child.getWorldDirection(new L.Vector3()));
			// camera with a parent looks down -Z toward the target
			const camChild = new L.PerspectiveCamera(); parent.add(camChild); camChild.position.set(1, 1, 1);
			camChild.lookAt(target); parent.updateMatrixWorld();
			// THREE r186 drops world scale from the camera view matrix (glTF conformance) while ours is a plain inverse,
			// so under a scaled parent compare the world matrix plus an explicit inverse (see the skipped Camera test below).
			out.push(camChild.quaternion, camChild.matrixWorld, new L.Matrix4().copy(camChild.matrixWorld).invert());
		}
		// looking straight up with default up vector (degenerate case)
		const up = new L.Object3D(); up.lookAt(0, 10, 0); out.push(up.quaternion);
		const camUp = new L.PerspectiveCamera(); camUp.lookAt(0, 10, 0); out.push(camUp.quaternion);
		return out;
	});
	// camera direction is -Z, object direction is +Z
	const o = new Object3D(); o.lookAt(0, 0, -5);
	assert.ok(o.getWorldDirection(new Vector3()).distanceTo(new Vector3(0, 0, -1)) < 1e-6);
	const c = new PerspectiveCamera(); c.lookAt(0, 0, -5);
	assert.ok(c.getWorldDirection(new Vector3()).distanceTo(new Vector3(0, 0, -1)) < 1e-6);
	assert.ok(c.quaternion.w > 0.9999);
	// the stored inverse is in sync with the world matrix for a parented camera after lookAt (unscaled parent)
	const parent = new Object3D(); parent.position.set(1, 2, 3); parent.rotation.set(0.4, -0.3, 0.9);
	const cam = new PerspectiveCamera(); parent.add(cam); cam.position.set(1, 1, 1);
	cam.lookAt(new Vector3(2, -1, 4));
	parent.updateMatrixWorld();
	assertClose(cam.matrixWorldInverse, new Matrix4().copy(cam.matrixWorld).invert(), 1e-6);
});

test('add / remove / attach / removeFromParent / clear parity', () => {
	// Uniform scales: attach() under non-uniformly scaled parents produces a shearing matrix,
	// where ours and THREE diverge (see the skipped applyMatrix4 shear test below).
	compare((L, r) => {
		const { root, all } = buildTree(L, r, L.Object3D, true);
		const out = [];
		const snapshot = () => {
			root.updateMatrixWorld();
			const names = [];
			root.traverse((o) => names.push(o.name + ':' + (o.parent ? o.parent.name : '-') + ':' + o.children.length));
			out.push(names, all.map((o) => o.matrixWorld), all.map((o) => o.position), all.map((o) => o.quaternion), all.map((o) => o.scale));
		};
		snapshot();
		const [, mid0, leaf00, leaf01, mid1, leaf10, , mid2] = all;
		// attach keeps the world transform
		mid1.attach(leaf00); snapshot();
		out.push(leaf00.parent === mid1, mid0.children.length, mid1.children.length);
		root.attach(leaf10); snapshot();
		// attach an orphan object with its own transform
		const orphan = new L.Object3D(); orphan.name = 'orphan'; setRandomTRS(orphan, r, true);
		mid2.attach(orphan); all.push(orphan); snapshot();
		// add moves between parents, keeps the local transform
		mid0.add(leaf01); mid2.add(leaf01); snapshot();
		out.push(mid0.children.includes(leaf01), mid2.children.includes(leaf01));
		// remove / removeFromParent
		mid2.remove(leaf01); out.push(leaf01.parent === null, mid2.children.length);
		leaf00.removeFromParent(); out.push(leaf00.parent === null);
		mid1.add(leaf00, leaf01); out.push(mid1.children.length);
		mid1.remove(leaf00, leaf01); out.push(mid1.children.length);
		// adding an object to itself is ignored
		const errors = console.error; console.error = () => {};
		try { root.add(root); } finally { console.error = errors; }
		out.push(root.children.length);
		// clear
		mid0.clear(); out.push(mid0.children.length, all.filter((o) => o.parent === mid0).length);
		snapshot();
		return out;
	});
});

test('added / removed events', () => {
	const parent = new Object3D(), child = new Object3D();
	const log = [];
	child.addEventListener('added', () => log.push('added'));
	child.addEventListener('removed', () => log.push('removed'));
	parent.addEventListener('childadded', (e) => log.push('childadded:' + (e.child === child)));
	parent.addEventListener('childremoved', (e) => log.push('childremoved:' + (e.child === child)));
	parent.add(child); parent.remove(child);
	assert.deepEqual(log, ['added', 'childadded:true', 'removed', 'childremoved:true']);
});

test('traverse / traverseVisible / traverseAncestors / getObjectByName / getObjectsByProperty', () => {
	compare((L, r) => {
		const { root, all } = buildTree(L, r);
		const out = [];
		const names = []; root.traverse((o) => names.push(o.name)); out.push(names);
		all[1].visible = false;
		const vis = []; root.traverseVisible((o) => vis.push(o.name)); out.push(vis);
		const anc = []; all[all.length - 1].traverseAncestors((o) => anc.push(o.name)); out.push(anc);
		out.push(root.getObjectByName('leaf21') === all[all.length - 1], root.getObjectByName('nope') === undefined, root.getObjectByName('root') === root);
		out.push(root.getObjectById(all[3].id) === all[3]);
		all[2].userData.tag = 'x'; all[5].userData.tag = 'x';
		out.push(root.getObjectsByProperty('visible', false).map((o) => o.name), root.getObjectsByProperty('type', 'Object3D').length);
		return out;
	});
});

test('world getters, local/world conversion, rotate/translate, applyMatrix4 parity', () => {
	compare((L, r) => {
		const { root, all } = buildTree(L, r);
		const out = [];
		for (const o of all) {
			out.push(
				o.getWorldPosition(new L.Vector3()), o.getWorldQuaternion(new L.Quaternion()), o.getWorldScale(new L.Vector3()), o.getWorldDirection(new L.Vector3()),
			);
			const p = new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3));
			const w = o.localToWorld(p.clone());
			out.push(w, o.worldToLocal(w.clone()), o.worldToLocal(w.clone()).distanceTo(p) < 1e-4);
		}
		for (const o of all) {
			o.rotateX(rand(r, -3, 3)); o.rotateY(rand(r, -3, 3)); o.rotateZ(rand(r, -3, 3));
			o.translateX(rand(r, -2, 2)); o.translateY(rand(r, -2, 2)); o.translateZ(rand(r, -2, 2));
			o.rotateOnAxis(new L.Vector3(1, 2, 3).normalize(), rand(r, -3, 3));
			o.rotateOnWorldAxis(new L.Vector3(3, -1, 2).normalize(), rand(r, -3, 3));
			o.translateOnAxis(new L.Vector3(0, 1, 1).normalize(), rand(r, -2, 2));
			out.push(o.position, o.quaternion, o.rotation);
		}
		root.updateMatrixWorld();
		out.push(all.map((o) => o.matrixWorld));
		for (const o of all) {
			const q = new L.Quaternion().setFromEuler(new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)));
			const m = new L.Matrix4().compose(new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)), q, new L.Vector3(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2)));
			o.applyMatrix4(m);
			out.push(o.position, o.quaternion, o.scale, o.matrix);
			o.applyQuaternion(q); out.push(o.quaternion);
			o.setRotationFromAxisAngle(new L.Vector3(0, 1, 0), 0.4); out.push(o.quaternion);
			o.setRotationFromEuler(new L.Euler(0.1, 0.2, 0.3, 'ZYX')); out.push(o.quaternion, o.rotation);
			o.setRotationFromMatrix(m); out.push(o.quaternion);
			o.setRotationFromQuaternion(q); out.push(o.quaternion);
		}
		root.updateMatrixWorld();
		out.push(all.map((o) => o.matrixWorld));
		return out;
	});
});

test('rotation <-> quaternion stay in sync both directions', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 10; i++) {
			const o = new L.Object3D();
			o.rotation.x = rand(r, -3, 3); out.push(o.quaternion);
			o.rotation.y = rand(r, -3, 3); out.push(o.quaternion);
			o.rotation.z = rand(r, -3, 3); out.push(o.quaternion);
			o.rotation.order = ORDERS[i % 6]; out.push(o.quaternion);
			o.rotation.set(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3), ORDERS[(i + 3) % 6]); out.push(o.quaternion);
			o.quaternion.setFromAxisAngle(new L.Vector3(rand(r), rand(r), rand(r)).normalize(), rand(r, -3, 3)); out.push(o.rotation);
			o.quaternion.x = rand(r); o.quaternion.normalize(); out.push(o.rotation);
			o.quaternion.set(0, 0, 0, 1); out.push(o.rotation);
			o.quaternion.copy(new L.Quaternion().setFromEuler(new L.Euler(0.5, -0.4, 0.3, 'YZX'))); out.push(o.rotation);
			o.rotation.copy(new L.Euler(0.1, 0.2, 0.3, 'XZY')); out.push(o.quaternion);
			o.quaternion.fromArray([0.1, 0.2, 0.3, 0.9]); out.push(o.rotation);
			o.rotation.fromArray([0.3, 0.2, 0.1]); out.push(o.quaternion);
		}
		return out;
	});
	const o = new Object3D();
	o.rotation.set(0.3, 0.4, 0.5, 'YXZ');
	const q = new Quaternion().setFromEuler(new Euler(0.3, 0.4, 0.5, 'YXZ'));
	assert.ok(Math.abs(o.quaternion.dot(q)) > 1 - 1e-9);
	o.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
	assert.ok(Math.abs(o.rotation.z - Math.PI / 2) < 1e-6 && o.rotation.order === 'YXZ');
});

// ---------------------------------------------------------------------------
// dirty tracking
// ---------------------------------------------------------------------------

test('dirty tracking: _worldVersion only bumps for recomputed world matrices', () => {
	const { root, all } = buildTree(OURS, prng(5));
	root.updateMatrixWorld();
	const v0 = all.map((o) => o._worldVersion);
	assert.ok(v0.every((v) => v > 0));

	// no changes -> no version changes
	root.updateMatrixWorld();
	root.updateMatrixWorld();
	assert.deepEqual(all.map((o) => o._worldVersion), v0);

	// only a leaf moves -> only that leaf bumps
	const leaf = all[all.length - 1];
	leaf.position.x += 1;
	root.updateMatrixWorld();
	for (let i = 0; i < all.length; i++) assert.equal(all[i]._worldVersion, v0[i] + (all[i] === leaf ? 1 : 0), all[i].name);

	// a middle node changes -> it and its descendants bump, nothing else
	const v1 = all.map((o) => o._worldVersion);
	const mid = all[1];
	mid.scale.y *= 1.5;
	root.updateMatrixWorld();
	for (let i = 0; i < all.length; i++) {
		const inSubtree = all[i] === mid || all[i].parent === mid;
		assert.equal(all[i]._worldVersion, v1[i] + (inSubtree ? 1 : 0), all[i].name);
	}

	// root rotation -> every node bumps exactly once
	const v2 = all.map((o) => o._worldVersion);
	root.rotation.y += 0.1;
	root.updateMatrixWorld();
	for (let i = 0; i < all.length; i++) assert.equal(all[i]._worldVersion, v2[i] + 1, all[i].name);

	// quaternion edits (not just position) are detected
	const v3 = all.map((o) => o._worldVersion);
	leaf.quaternion.x += 0.01;
	root.updateMatrixWorld();
	for (let i = 0; i < all.length; i++) assert.equal(all[i]._worldVersion, v3[i] + (all[i] === leaf ? 1 : 0));

	// force=true bumps everything
	const v4 = all.map((o) => o._worldVersion);
	root.updateMatrixWorld(true);
	for (let i = 0; i < all.length; i++) assert.equal(all[i]._worldVersion, v4[i] + 1);

	// manual matrixWorldNeedsUpdate flag re-multiplies that subtree only
	const v5 = all.map((o) => o._worldVersion);
	mid.matrixWorldNeedsUpdate = true;
	root.updateMatrixWorld();
	for (let i = 0; i < all.length; i++) assert.equal(all[i]._worldVersion, v5[i] + (all[i] === mid || all[i].parent === mid ? 1 : 0));
});

test('updateMatrix returns true only when position/quaternion/scale changed', () => {
	const o = new Object3D();
	assert.equal(o.updateMatrix(), true); // first call always composes
	assert.equal(o.updateMatrix(), false);
	o.position.set(0, 0, 0); // same values
	assert.equal(o.updateMatrix(), false);
	o.position.x = 2;
	assert.equal(o.updateMatrix(), true);
	assert.equal(o.updateMatrix(), false);
	o.rotation.z = 0.5;
	assert.equal(o.updateMatrix(), true);
	assert.equal(o.updateMatrix(), false);
	o.scale.y = 3;
	assert.equal(o.updateMatrix(), true);
	assert.equal(o.updateMatrix(), false);
	o.quaternion.identity();
	assert.equal(o.updateMatrix(), true);
	o.quaternion.identity();
	assert.equal(o.updateMatrix(), false);
	// matrix contents match a fresh compose
	const expected = new Matrix4().compose(o.position, o.quaternion, o.scale);
	assertClose(o.matrix, expected, 1e-7);
	// updateMatrix sets matrixWorldNeedsUpdate, updateMatrixWorld clears it
	o.position.y = 1; o.updateMatrix();
	assert.equal(o.matrixWorldNeedsUpdate, true);
	o.updateMatrixWorld();
	assert.equal(o.matrixWorldNeedsUpdate, false);
	// a newly added child is flagged for update
	const p = new Object3D(); p.updateMatrixWorld(); const c = new Object3D(); c.updateMatrixWorld();
	p.add(c);
	assert.equal(c.matrixWorldNeedsUpdate, true);
});

test('updateWorldMatrix(updateParents, updateChildren) parity and versions', () => {
	compare((L, r) => {
		const { root, all } = buildTree(L, r);
		const leaf = all[all.length - 1];
		leaf.updateWorldMatrix(true, false);
		const out = [leaf.matrixWorld, leaf.parent.matrixWorld, root.matrixWorld];
		all[1].updateWorldMatrix(false, true);
		out.push(all[1].matrixWorld, all[2].matrixWorld, all[3].matrixWorld);
		return out;
	});
	const { root, all } = buildTree(OURS, prng(11));
	root.updateMatrixWorld();
	const v = all.map((o) => o._worldVersion);
	// a clean graph: nothing is recomputed, so no version moves (THREE likewise only re-multiplies dirty nodes)
	all[1].updateWorldMatrix(true, true);
	assert.deepEqual(all.map((o) => o._worldVersion), v);
	// a dirty middle node: it and its descendants bump, the parent chain and sibling subtrees do not
	all[1].position.x += 1;
	all[1].updateWorldMatrix(true, true);
	for (let i = 0; i < all.length; i++) {
		const inSubtree = all[i] === all[1] || all[i].parent === all[1];
		assert.equal(all[i]._worldVersion, v[i] + (inSubtree ? 1 : 0), all[i].name);
	}
	// a dirty root reached through updateParents bumps the root, then the requesting node sees the change
	const v2 = all.map((o) => o._worldVersion);
	root.rotation.z += 0.2;
	const leaf = all[all.length - 1];
	leaf.updateWorldMatrix(true, false);
	assert.equal(root._worldVersion, v2[0] + 1);
	assert.equal(leaf._worldVersion, v2[all.length - 1] + 1);
	assert.equal(leaf.parent._worldVersion, v2[all.length - 3] + 1);
	assert.equal(all[1]._worldVersion, v2[1]); // untouched branch
	assertClose(leaf.matrixWorld, new Matrix4().multiplyMatrices(leaf.parent.matrixWorld, leaf.matrix), 1e-6);
});

test('matrixAutoUpdate = false with a manual matrix matches THREE', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 5; i++) {
			const parent = new L.Object3D(); setRandomTRS(parent, r);
			const child = new L.Object3D();
			child.matrixAutoUpdate = false;
			const q = new L.Quaternion().setFromEuler(new L.Euler(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)));
			child.matrix.compose(new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3)), q, new L.Vector3(rand(r, 0.5, 2), rand(r, 0.5, 2), rand(r, 0.5, 2)));
			child.matrixWorldNeedsUpdate = true;
			parent.add(child);
			parent.updateMatrixWorld();
			out.push(child.matrix, child.matrixWorld, child.position, child.quaternion, child.scale);
			// a later change to the matrix plus the flag propagates again
			child.matrix.setPosition(9, 9, 9);
			child.matrixWorldNeedsUpdate = true;
			parent.updateMatrixWorld();
			out.push(child.matrixWorld);
			// position edits are ignored when matrixAutoUpdate is false
			child.position.set(100, 100, 100);
			child.matrixWorldNeedsUpdate = true;
			parent.updateMatrixWorld();
			out.push(child.matrixWorld);
			// grandchild under a manual node still updates through the chain
			const grand = new L.Object3D(); grand.position.set(1, 0, 0); child.add(grand);
			parent.updateMatrixWorld();
			out.push(grand.matrixWorld);
		}
		return out;
	});
	const o = new Object3D(); o.matrixAutoUpdate = false; o.position.x = 5;
	o.updateMatrixWorld();
	assert.equal(o.matrixWorld.elements[12], 0);
	const v = o._worldVersion;
	o.updateMatrixWorld();
	assert.equal(o._worldVersion, v);
});

// ---------------------------------------------------------------------------
// slab-backed matrices
// ---------------------------------------------------------------------------

test('matrix / matrixWorld are slab views; assignment copies into the slab', () => {
	const a = new Object3D(), b = new Object3D();
	const buf = a.matrix.elements.buffer, off = a.matrix.elements.byteOffset;
	assert.ok(a.matrix.elements instanceof Float32Array && a.matrix.elements.length === 16);
	assert.equal(a.matrixWorld.elements.buffer, buf);
	assert.equal(a.matrixWorld.elements.byteOffset - a.matrix.elements.byteOffset, (WORLD_OFFSET - LOCAL_OFFSET) * 4);
	assert.equal(a._slabData.buffer, buf);
	assert.equal(a.matrix.elements.byteOffset, (a._slabOffset + LOCAL_OFFSET) * 4);
	// siblings allocated back to back share the page
	assert.equal(b.matrix.elements.buffer, buf);
	assert.equal(b._slabOffset - a._slabOffset, RECORD_SIZE);
	assert.ok(transformSlab.pageCount >= 1);

	const m = new Matrix4().makeTranslation(1, 2, 3).multiply(new Matrix4().makeRotationZ(0.3));
	const before = a.matrix;
	a.matrix = m;
	assert.equal(a.matrix, before);
	assert.notEqual(a.matrix, m);
	assert.equal(a.matrix.elements.buffer, buf);
	assert.equal(a.matrix.elements.byteOffset, off);
	assertClose(a.matrix, m, 1e-7);
	m.elements[12] = 99;
	assert.equal(a.matrix.elements[12], 1); // a copy, not an alias

	const v = a._worldVersion;
	a.matrixWorld = m;
	assert.equal(a.matrixWorld.elements.buffer, buf);
	assert.equal(a.matrixWorld.elements[12], 99);
	assert.equal(a._worldVersion, v + 1);
	a.matrix = a.matrix; // self assignment is a no-op
	assert.equal(a.matrix.elements[12], 1);

	// the slab data is what updateMatrix writes
	a.position.set(7, 8, 9); a.updateMatrix();
	assert.equal(a._slabData[a._slabOffset + LOCAL_OFFSET + 12], 7);
	a.updateMatrixWorld();
	assert.equal(a._slabData[a._slabOffset + WORLD_OFFSET + 13], 8);
});

// ---------------------------------------------------------------------------
// clone / copy
// ---------------------------------------------------------------------------

test('clone / copy preserve transforms and children', () => {
	compare((L, r) => {
		const { root, all } = buildTree(L, r);
		root.visible = false; root.castShadow = true; root.renderOrder = 3; root.layers.set(2); root.userData = { a: [1, 2], b: 'x' };
		root.updateMatrixWorld();
		const clone = root.clone();
		const out = [clone.children.length, clone !== root, clone.children[0] !== root.children[0], clone.parent === null, clone.visible, clone.castShadow, clone.renderOrder, clone.layers.mask, clone.userData];
		clone.updateMatrixWorld();
		const names = []; clone.traverse((o) => names.push(o.name)); out.push(names);
		const cloned = []; clone.traverse((o) => cloned.push(o));
		for (let i = 0; i < all.length; i++) out.push(cloned[i].position, cloned[i].quaternion, cloned[i].scale, cloned[i].rotation, cloned[i].matrix, cloned[i].matrixWorld);
		// non-recursive clone
		const shallow = root.clone(false); out.push(shallow.children.length, shallow.position);
		// copy onto an existing object
		const target = new L.Object3D(); target.copy(all[1], false); target.updateMatrixWorld();
		out.push(target.children.length, target.position, target.quaternion, target.scale, target.matrix, target.matrixWorld);
		// mesh clone shares geometry and material
		const mesh = new L.Mesh(quadGeometry(L), new L.MeshBasicMaterial()); setRandomTRS(mesh, r);
		const mc = mesh.clone();
		out.push(mc.geometry === mesh.geometry, mc.material === mesh.material, mc.position, mc.quaternion);
		return out;
	});
	const { root, all } = buildTree(OURS, prng(21));
	root.updateMatrixWorld();
	const clone = root.clone();
	// the clone has its own slab records
	const cloned = []; clone.traverse((o) => cloned.push(o));
	for (let i = 0; i < all.length; i++) {
		assert.notEqual(cloned[i].matrix.elements, all[i].matrix.elements);
		assertClose(cloned[i].matrixWorld, all[i].matrixWorld, 1e-7);
	}
	// clone's dirty tracking starts from the copied state
	clone.updateMatrixWorld();
	assertClose(clone.matrixWorld, root.matrixWorld, 1e-7);
	assert.equal(clone.updateMatrix(), false);
	cloned[3].position.z += 1;
	assert.equal(cloned[3].updateMatrix(), true);
	// userData is deep copied
	assert.notEqual(clone.userData, root.userData);
});

// ---------------------------------------------------------------------------
// cameras
// ---------------------------------------------------------------------------

test('PerspectiveCamera projection parity (params, zoom, setViewOffset, filmOffset)', () => {
	compare((L, r) => {
		const out = [];
		const params = [[50, 1, 0.1, 2000], [75, 16 / 9, 0.01, 100], [35, 0.5, 1, 50], [rand(r, 20, 120), rand(r, 0.3, 3), rand(r, 0.05, 1), rand(r, 10, 500)]];
		for (const [fov, aspect, near, far] of params) {
			const cam = new L.PerspectiveCamera(fov, aspect, near, far);
			out.push(cam.projectionMatrix, cam.projectionMatrixInverse);
			cam.zoom = 2; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix);
			cam.zoom = 0.5; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix);
			cam.zoom = 1;
			cam.setViewOffset(1920, 1080, 640, 0, 640, 1080); out.push(cam.projectionMatrix, cam.aspect, cam.view);
			cam.setViewOffset(1920, 1080, 0, 540, 960, 540); out.push(cam.projectionMatrix);
			cam.zoom = 1.5; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix);
			cam.clearViewOffset(); out.push(cam.projectionMatrix, cam.view.enabled);
			cam.zoom = 1; cam.filmOffset = 3; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix); cam.filmOffset = 0;
			cam.setFocalLength(35); out.push(cam.fov, cam.getFocalLength(), cam.getEffectiveFOV(), cam.getFilmWidth(), cam.getFilmHeight());
			out.push(cam.getViewSize(10, new L.Vector2()));
			out.push(cam.clone().projectionMatrix, cam.clone().fov);
		}
		return out;
	}, 1e-4);
});

test('OrthographicCamera projection parity', () => {
	compare((L, r) => {
		const out = [];
		const params = [[-1, 1, 1, -1, 0.1, 2000], [-8, 8, 4.5, -4.5, 0, 100], [rand(r, -10, -1), rand(r, 1, 10), rand(r, 1, 10), rand(r, -10, -1), rand(r, 0, 1), rand(r, 10, 500)]];
		for (const p of params) {
			const cam = new L.OrthographicCamera(...p);
			out.push(cam.projectionMatrix, cam.projectionMatrixInverse);
			cam.zoom = 3; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix);
			cam.setViewOffset(1920, 1080, 960, 0, 960, 1080); out.push(cam.projectionMatrix, cam.view);
			cam.zoom = 0.75; cam.updateProjectionMatrix(); out.push(cam.projectionMatrix);
			cam.clearViewOffset(); out.push(cam.projectionMatrix);
			out.push(cam.clone().projectionMatrix);
		}
		return out;
	}, 1e-4);
});

test('camera matrixWorldInverse after updateMatrixWorld / updateWorldMatrix', () => {
	compare((L, r) => {
		const out = [];
		for (let i = 0; i < 6; i++) {
			const parent = new L.Object3D(); setRandomTRS(parent, r, true);
			parent.scale.setScalar(1); // THREE excludes world scale from matrixWorldInverse; see the skipped Camera test
			const cam = i % 2 ? new L.PerspectiveCamera(60, 1.5, 0.1, 100) : new L.OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
			cam.position.set(rand(r, -5, 5), rand(r, -5, 5), rand(r, -5, 5));
			cam.lookAt(new L.Vector3(rand(r, -2, 2), rand(r, -2, 2), rand(r, -2, 2)));
			parent.add(cam);
			parent.updateMatrixWorld();
			out.push(cam.matrixWorld, cam.matrixWorldInverse);
			cam.position.x += 1;
			cam.updateWorldMatrix(true, false);
			out.push(cam.matrixWorld, cam.matrixWorldInverse);
			const p = new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), rand(r, -3, 3));
			out.push(p.clone().project(cam), p.clone().project(cam).unproject(cam));
		}
		return out;
	}, 1e-4);
	const cam = new PerspectiveCamera();
	cam.position.set(1, 2, 3); cam.updateMatrixWorld();
	const id = new Matrix4().multiplyMatrices(cam.matrixWorld, cam.matrixWorldInverse);
	assertClose(id, new Matrix4(), 1e-6);
	// projection version bumps when the projection changes
	const pv = cam._projectionVersion;
	cam.updateProjectionMatrix();
	assert.equal(cam._projectionVersion, pv + 1);
});

// ---------------------------------------------------------------------------
// regression tests for divergences from THREE that were found and fixed
// ---------------------------------------------------------------------------

test('applyMatrix4 with a shearing matrix recomposes the local matrix like THREE', {}, () => {
	compare((L) => {
		const o = new L.Object3D();
		o.position.set(1, 2, 3); o.rotation.set(0.3, 0.2, 0.1); o.scale.set(1, 2, 3);
		o.applyMatrix4(new L.Matrix4().makeShear(0.5, 0, 0, 0, 0, 0));
		o.updateMatrixWorld();
		return [o.position, o.quaternion, o.scale, o.matrix, o.matrixWorld, new L.Matrix4().compose(o.position, o.quaternion, o.scale)];
	});
});

test('Camera.matrixWorldInverse excludes world scale like THREE', {}, () => {
	compare((L) => {
		const out = [];
		const parent = new L.Object3D(); parent.position.set(1, 2, 3); parent.rotation.set(0.4, -0.3, 0.9); parent.scale.setScalar(1.3);
		const cam = new L.PerspectiveCamera(); parent.add(cam); cam.position.set(1, 1, 1); cam.lookAt(new L.Vector3(2, -1, 4));
		parent.updateMatrixWorld();
		out.push(cam.matrixWorld, cam.matrixWorldInverse);
		const solo = new L.PerspectiveCamera(); solo.scale.set(2, 2, 2); solo.position.set(0, 1, 5); solo.updateMatrixWorld();
		out.push(solo.matrixWorld, solo.matrixWorldInverse);
		solo.position.x = 1; solo.updateWorldMatrix(true, false);
		out.push(solo.matrixWorldInverse);
		return out;
	});
});
