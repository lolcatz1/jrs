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
const near = (a, b, eps, label) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b)), `${label}: ${a} vs ${b}`);

// A Bone subclass is never rig-planned (its methods may be overridden), so it exercises the generic update path.
class PlainBone extends JRS.Bone {}

// ---------------------------------------------------------------------------------------------------------------------
// Bone transform API against three.js
// ---------------------------------------------------------------------------------------------------------------------

test('Bone position / quaternion / scale / rotation behave like three.js under random edits', () => {
	const r = prng(7);
	const rnd = (lo = -2, hi = 2) => lo + r() * (hi - lo);
	for (let trial = 0; trial < 40; trial++) {
		const a = new JRS.Bone(), b = new THREE.Bone();
		for (let step = 0; step < 30; step++) {
			const op = Math.floor(r() * 14);
			const x = rnd(), y = rnd(), z = rnd(), w = rnd();
			const q = new THREE.Quaternion(x, y, z, w).normalize();
			const qj = new JRS.Quaternion(q.x, q.y, q.z, q.w);
			switch (op) {
				case 0: a.position.set(x, y, z); b.position.set(x, y, z); break;
				case 1: a.position.x += x; b.position.x += x; break;
				case 2: a.scale.set(Math.abs(x) + 0.1, Math.abs(y) + 0.1, Math.abs(z) + 0.1); b.scale.set(Math.abs(x) + 0.1, Math.abs(y) + 0.1, Math.abs(z) + 0.1); break;
				case 3: a.quaternion.copy(qj); b.quaternion.copy(q); break;
				case 4: a.quaternion.multiply(qj); b.quaternion.multiply(q); break;
				case 5: a.rotation.set(x, y, z); b.rotation.set(x, y, z); break;
				case 6: a.rotation.y = x; b.rotation.y = x; break;
				case 7: a.quaternion.slerp(qj, 0.3); b.quaternion.slerp(q, 0.3); break;
				case 8: a.rotateX(x); b.rotateX(x); break;
				case 9: a.translateY(y); b.translateY(y); break;
				case 10: a.quaternion.fromArray([q.x, q.y, q.z, q.w]); b.quaternion.fromArray([q.x, q.y, q.z, q.w]); break;
				case 11: { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1.5, 0.7, 2)); a.matrix.fromArray(m.elements); b.matrix.copy(m); a.matrix.decompose(a.position, a.quaternion, a.scale); b.matrix.decompose(b.position, b.quaternion, b.scale); break; }
				case 12: a.position.copy(new JRS.Vector3(x, y, z)); b.position.copy(new THREE.Vector3(x, y, z)); break;
				case 13: a.setRotationFromAxisAngle(new JRS.Vector3(0, 1, 0), x); b.setRotationFromAxisAngle(new THREE.Vector3(0, 1, 0), x); break;
			}
			a.updateMatrix(); b.updateMatrix();
			for (const k of ['x', 'y', 'z']) { near(a.position[k], b.position[k], 2e-6, 'position.' + k); near(a.scale[k], b.scale[k], 2e-6, 'scale.' + k); }
			for (const k of ['x', 'y', 'z', 'w']) near(a.quaternion[k], b.quaternion[k], 2e-6, 'quaternion.' + k);
			if (Math.abs(Math.sin(b.rotation.y)) < 0.98) for (const k of ['x', 'y', 'z']) near(a.rotation[k], b.rotation[k], 5e-6, 'rotation.' + k); // jrs converts through a float32 matrix; near gimbal lock the decomposition is ambiguous
			for (let i = 0; i < 16; i++) near(a.matrix.elements[i], b.matrix.elements[i], 1e-5, 'matrix[' + i + ']');
		}
	}
});

test('Bone transform objects keep the three.js types and cloning/serialisation behaviour', () => {
	const bone = new JRS.Bone();
	assert.ok(bone.position instanceof JRS.Vector3 && bone.scale instanceof JRS.Vector3);
	assert.ok(bone.quaternion instanceof JRS.Quaternion && bone.rotation instanceof JRS.Euler);
	bone.position.set(1, 2, 3); bone.quaternion.setFromEuler(new JRS.Euler(0.3, 0.2, 0.1)); bone.scale.set(2, 2, 2);
	const p = bone.position.clone(), q = bone.quaternion.clone(), e = bone.rotation.clone();
	assert.equal(p.constructor, JRS.Vector3); assert.equal(q.constructor, JRS.Quaternion); assert.equal(e.constructor, JRS.Euler);
	bone.position.x = 99; bone.quaternion.x = 0.5; bone.rotation.x = 1;
	assert.equal(p.x, 1); assert.notEqual(q.x, 0.5);
	assert.deepEqual(JSON.parse(JSON.stringify(bone.position)).x, 99);
	assert.equal(bone.position.toArray().length, 3);
	bone.updateMatrix();
	const copy = bone.clone();
	assert.ok(copy.isBone && copy !== bone);
	for (const k of ['x', 'y', 'z']) { assert.equal(copy.position[k], bone.position[k]); assert.equal(copy.scale[k], bone.scale[k]); }
	copy.updateMatrix();
	for (let i = 0; i < 16; i++) assert.equal(copy.matrix.elements[i], bone.matrix.elements[i]);
	// an edit of the original must not leak into the clone
	bone.position.y = -5;
	assert.equal(copy.position.y, 2);
});

test('rotation keeps the angles as written and follows quaternion edits lazily', () => {
	const a = new JRS.Bone(), b = new THREE.Bone();
	a.rotation.set(4, 0.2, -3.5); b.rotation.set(4, 0.2, -3.5);
	assert.equal(a.rotation.x, 4); assert.equal(a.rotation.z, -3.5); // not wrapped to the principal range
	for (const k of ['x', 'y', 'z', 'w']) near(a.quaternion[k], b.quaternion[k], 1e-12, 'quaternion.' + k);
	a.quaternion.set(0, 0.7071067811865476, 0, 0.7071067811865476); b.quaternion.set(0, 0.7071067811865476, 0, 0.7071067811865476);
	near(a.rotation.y, b.rotation.y, 1e-6, 'rotation.y after quaternion edit');
	a.rotation.x = 0.1; b.rotation.x = 0.1;
	for (const k of ['x', 'y', 'z', 'w']) near(a.quaternion[k], b.quaternion[k], 1e-12, 'quaternion.' + k + ' after euler edit');
	assert.equal(a.rotation.x, 0.1);
});

// ---------------------------------------------------------------------------------------------------------------------
// Rig update plans against the generic scene-graph update
// ---------------------------------------------------------------------------------------------------------------------

function buildScene(BoneClass, seed) {
	const r = prng(seed);
	const scene = new JRS.Scene();
	const groups = [new JRS.Group(), new JRS.Group()];
	groups[1].position.set(1, 2, 3); scene.add(groups[0], groups[1]);
	const bones = [], others = [];
	const rigs = 1 + Math.floor(r() * 3);
	for (let rig = 0; rig < rigs; rig++) {
		const host = r() < 0.5 ? groups[Math.floor(r() * 2)] : scene;
		const n = 2 + Math.floor(r() * 8);
		const rigBones = [];
		for (let i = 0; i < n; i++) {
			const bone = new BoneClass();
			bone.position.set(r(), r(), r()); bone.quaternion.setFromEuler(new JRS.Euler(r(), r(), r()));
			if (r() < 0.2) bone.scale.set(0.5 + r(), 0.5 + r(), 0.5 + r());
			const parent = i === 0 ? host : rigBones[Math.floor(r() * i)];
			parent.add(bone); rigBones.push(bone);
			if (r() < 0.25) { const m = new JRS.Group(); m.position.set(r(), 0, 0); bone.add(m); others.push(m); if (r() < 0.5) { const inner = new BoneClass(); inner.position.y = 1; m.add(inner); bones.push(inner); } }
		}
		bones.push(...rigBones);
	}
	return { scene, groups, bones, others };
}
function sameMatrices(A, B, label) {
	const oa = [], ob = [];
	A.scene.traverse(o => oa.push(o)); B.scene.traverse(o => ob.push(o));
	assert.equal(oa.length, ob.length, label + ' object count');
	for (let i = 0; i < oa.length; i++) {
		for (let k = 0; k < 16; k++) {
			assert.equal(oa[i].matrix.elements[k], ob[i].matrix.elements[k], `${label} obj ${i} matrix[${k}]`);
			assert.equal(oa[i].matrixWorld.elements[k], ob[i].matrixWorld.elements[k], `${label} obj ${i} matrixWorld[${k}]`);
		}
		assert.equal(oa[i].matrixWorldNeedsUpdate, ob[i].matrixWorldNeedsUpdate, `${label} obj ${i} matrixWorldNeedsUpdate`);
	}
}

test('rig update plans produce exactly the generic update results under random scene edits', () => {
	for (let seed = 1; seed <= 150; seed++) {
		const A = buildScene(JRS.Bone, seed), B = buildScene(PlainBone, seed);
		const r = prng(seed * 977);
		const both = (fn) => { fn(A); fn(B); };
		for (let step = 0; step < 25; step++) {
			const op = Math.floor(r() * 13);
			const bi = Math.floor(r() * A.bones.length), oi = Math.floor(r() * Math.max(1, A.others.length));
			const x = r() - 0.5, y = r() - 0.5, z = r() - 0.5;
			switch (op) {
				case 0: both(S => S.bones[bi].position.set(x, y, z)); break;
				case 1: both(S => S.bones[bi].quaternion.setFromEuler(new JRS.Euler(x, y, z))); break;
				case 2: both(S => S.bones[bi].rotation.x += x); break;
				case 3: both(S => S.bones[bi].scale.setScalar(1 + y)); break;
				case 4: both(S => { S.bones[bi].matrixAutoUpdate = !S.bones[bi].matrixAutoUpdate; }); break;
				case 5: both(S => { S.bones[bi].matrixWorldAutoUpdate = !S.bones[bi].matrixWorldAutoUpdate; }); break;
				case 6: both(S => { S.bones[bi].matrixWorldNeedsUpdate = true; }); break;
				case 7: both(S => S.groups[1].position.set(x, y, z)); break;
				case 8: both(S => { if (S.others.length) S.others[oi].position.set(x, y, z); }); break;
				case 9: { // re-parent a bone under another bone (not its own descendant), a group or the scene
					const target = Math.floor(r() * (A.bones.length + 2));
					both(S => {
						const b = S.bones[bi];
						let np = target < S.bones.length ? S.bones[target] : target === S.bones.length ? S.groups[0] : S.scene;
						for (let p = np; p; p = p.parent) if (p === b) return; // would create a cycle
						np.add(b);
					});
					break;
				}
				case 10: both(S => { const b = new (S === A ? JRS.Bone : PlainBone)(); b.position.set(x, y, z); S.bones[bi].add(b); S.bones.push(b); }); break;
				case 11: both(S => S.bones[bi].matrix.makeTranslation(x, y, z)); break;
				case 12: both(S => { const m = new JRS.Group(); m.position.set(x, y, z); S.bones[bi].add(m); S.others.push(m); }); break;
			}
			if (op === 11) both(S => { S.bones[bi].matrixAutoUpdate = false; });
			const force = r() < 0.15;
			both(S => S.scene.updateMatrixWorld(force));
			sameMatrices(A, B, `seed ${seed} step ${step} op ${op}`);
		}
	}
});

test('bone world matrices equal three.js (float tolerance) for a rig animated through the mixer', () => {
	const make = (T) => {
		const scene = new T.Scene(); const mesh = new T.SkinnedMesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
		const bones = []; let parent = mesh;
		for (let i = 0; i < 8; i++) { const b = new T.Bone(); b.name = 'b' + i; b.position.y = 0.5; parent.add(b); bones.push(b); parent = b; }
		scene.add(mesh); mesh.position.set(1, 2, 3); mesh.rotation.y = 0.4; scene.updateMatrixWorld(true); mesh.bind(new T.Skeleton(bones));
		const tracks = bones.map((b, i) => new T.QuaternionKeyframeTrack(b.name + '.quaternion', [0, 1, 2], [0, 0, 0, 1, Math.sin(0.2 + i * 0.1), 0, 0, Math.cos(0.2 + i * 0.1), 0, Math.sin(0.3), 0, Math.cos(0.3)]));
		tracks.push(new T.VectorKeyframeTrack('b3.position', [0, 2], [0, 0.5, 0, 0.3, 0.7, 0.1]));
		const mixer = new T.AnimationMixer(mesh); mixer.clipAction(new T.AnimationClip('c', 2, tracks)).play();
		return { scene, mesh, bones, mixer };
	};
	const a = make(JRS), b = make(THREE);
	for (let f = 0; f < 90; f++) {
		a.mixer.update(1 / 30); b.mixer.update(1 / 30);
		a.scene.updateMatrixWorld(); b.scene.updateMatrixWorld();
		a.mesh.skeleton.update(); b.mesh.skeleton.update();
		for (let i = 0; i < a.bones.length; i++) for (let k = 0; k < 16; k++) near(a.bones[i].matrixWorld.elements[k], b.bones[i].matrixWorld.elements[k], 1e-5, `frame ${f} bone ${i} world[${k}]`);
		for (let i = 0; i < 16 * a.bones.length; i++) near(a.mesh.skeleton.boneMatrices[i], b.mesh.skeleton.boneMatrices[i], 1e-4, `frame ${f} boneMatrices[${i}]`);
	}
});

test('skeleton update from flat arrays equals the object path, including inverse edits and shared inverses', () => {
	const build = (mixed) => {
		const scene = new JRS.Scene(); const bones = []; let parent = scene;
		for (let i = 0; i < 6; i++) { const b = (mixed && i === 3) ? new JRS.Object3D() : new JRS.Bone(); b.position.set(0.1 * i, 0.5, 0.2); b.rotation.z = 0.1 * i; parent.add(b); bones.push(b); parent = b; }
		scene.updateMatrixWorld(true);
		return { scene, bones, skeleton: new JRS.Skeleton(bones) };
	};
	const A = build(false), B = build(true); // B contains a plain Object3D: object path
	const compare = (label) => { A.skeleton.update(); B.skeleton.update(); for (let i = 0; i < 96; i++) assert.ok(Math.abs(A.skeleton.boneMatrices[i] - B.skeleton.boneMatrices[i]) < 1e-6, `${label} [${i}]`); };
	compare('initial');
	for (let f = 0; f < 5; f++) { for (const S of [A, B]) { S.bones[1].rotation.x += 0.3; S.bones[4].position.x += 0.1; S.scene.updateMatrixWorld(); } compare('frame ' + f); }
	// in-place edit of an inverse
	for (const S of [A, B]) { S.skeleton.boneInverses[2].elements[12] += 0.25; S.bones[0].rotation.y += 0.1; S.scene.updateMatrixWorld(); }
	compare('in-place inverse edit');
	// replacing an inverse matrix
	for (const S of [A, B]) { S.skeleton.boneInverses[5] = new JRS.Matrix4().makeTranslation(1, 2, 3); S.bones[0].rotation.y += 0.1; S.scene.updateMatrixWorld(); }
	compare('replaced inverse');
	// two skeletons sharing the inverse list (cloned characters) stay independent in their bone matrices
	const C = build(false);
	const clone = new JRS.Skeleton(C.bones, A.skeleton.boneInverses);
	for (let i = 0; i < C.bones.length; i++) C.bones[i].position.y += 1;
	C.scene.updateMatrixWorld(); clone.update(); A.skeleton.update();
	let differs = false; for (let i = 0; i < 96; i++) if (Math.abs(clone.boneMatrices[i] - A.skeleton.boneMatrices[i]) > 1e-6) differs = true;
	assert.ok(differs);
	A.skeleton.boneInverses[0].elements[13] += 1; A.bones[0].position.x += 0.01; A.scene.updateMatrixWorld(); A.skeleton.update();
	const before = A.skeleton.boneMatrices[13];
	assert.ok(Number.isFinite(before));
});

test('Object3D.add / remove involving bones invalidates rig plans (bones added later are updated)', () => {
	const scene = new JRS.Scene();
	const root = new JRS.Bone(); scene.add(root);
	scene.updateMatrixWorld();
	const child = new JRS.Bone(); child.position.set(0, 1, 0); root.add(child);
	root.position.x = 2;
	scene.updateMatrixWorld();
	assert.equal(child.matrixWorld.elements[12], 2); assert.equal(child.matrixWorld.elements[13], 1);
	const mesh = new JRS.Mesh(); mesh.position.set(0, 0, 5); child.add(mesh);
	scene.updateMatrixWorld();
	assert.equal(mesh.matrixWorld.elements[12], 2); assert.equal(mesh.matrixWorld.elements[14], 5);
	child.remove(mesh); root.remove(child);
	root.position.x = 7; scene.updateMatrixWorld();
	assert.equal(root.matrixWorld.elements[12], 7);
	// re-parent the root under a moving group
	const g = new JRS.Group(); scene.add(g); g.add(root); g.position.y = 4; scene.updateMatrixWorld();
	assert.equal(root.matrixWorld.elements[13], 4);
	g.position.y = 6; scene.updateMatrixWorld();
	assert.equal(root.matrixWorld.elements[13], 6);
});
