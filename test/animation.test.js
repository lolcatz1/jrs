import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as JRS from '../src/index.js';

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
	if (a === b) return;
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
	if (a.isSphere) return cmpKeys(['center', 'radius']);
	if (a.isBox3) return cmpKeys(['min', 'max']);
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
const SEED = 0xC0FFEE;
function compare(fn, eps = 1e-5) { assertClose(fn(JRS, prng(SEED)), fn(THREE, prng(SEED)), eps); }

/** A chain of `n` bones under a SkinnedMesh with a procedurally skinned cylinder (same construction in both libs). */
function buildRig(T, r, n = 6, segments = 12) {
	const geometry = new T.CylinderGeometry(0.4, 0.3, n, 10, segments);
	const position = geometry.attributes.position, count = position.count;
	const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) {
		const t = (position.getY(i) + n / 2); // 0..n along the chain
		const b = Math.min(n - 1, Math.max(0, Math.floor(t)));
		const f = t - b;
		skinIndex[i * 4] = b; skinIndex[i * 4 + 1] = Math.min(n - 1, b + 1);
		skinWeight[i * 4] = 1 - f; skinWeight[i * 4 + 1] = f;
	}
	geometry.setAttribute('skinIndex', new T.BufferAttribute(skinIndex, 4));
	geometry.setAttribute('skinWeight', new T.BufferAttribute(skinWeight, 4));
	const mesh = new T.SkinnedMesh(geometry, new T.MeshBasicMaterial());
	const bones = [];
	let parent = mesh;
	for (let i = 0; i < n; i++) {
		const bone = new T.Bone(); bone.name = 'bone' + i;
		bone.position.y = i === 0 ? -n / 2 : 1;
		parent.add(bone); bones.push(bone); parent = bone;
	}
	mesh.position.set(rand(r, -2, 2), rand(r, -2, 2), rand(r, -2, 2));
	mesh.rotation.set(rand(r, -1, 1), rand(r, -1, 1), rand(r, -1, 1));
	mesh.scale.setScalar(rand(r, 0.7, 1.4));
	mesh.updateMatrixWorld(true);
	mesh.bind(new T.Skeleton(bones));
	return { mesh, bones, geometry };
}
function poseRig(rig, r, amount = 0.6) {
	for (const bone of rig.bones) { bone.rotation.set(rand(r, -amount, amount), rand(r, -amount, amount), rand(r, -amount, amount)); }
	rig.mesh.updateMatrixWorld(true);
}
function boneMatricesOf(rig) { rig.mesh.skeleton.update(); return Array.from(rig.mesh.skeleton.boneMatrices); }
/** A clip animating every bone's quaternion + position of the root + a morph influence number track. */
function makeClip(T, r, bones, name = 'walk') {
	const tracks = [];
	for (const bone of bones) {
		const times = [0, 0.5, 1.0, 1.5, 2.0];
		const values = [];
		for (let k = 0; k < times.length; k++) {
			const q = new T.Quaternion().setFromEuler(new T.Euler(rand(r, -0.8, 0.8), rand(r, -0.8, 0.8), rand(r, -0.8, 0.8)));
			values.push(q.x, q.y, q.z, q.w);
		}
		tracks.push(new T.QuaternionKeyframeTrack(bone.name + '.quaternion', times, values));
	}
	tracks.push(new T.VectorKeyframeTrack(bones[0].name + '.position', [0, 1, 2], [0, -3, 0, 0.3, -2.7, 0.1, 0, -3, 0]));
	tracks.push(new T.NumberKeyframeTrack('.scale[x]', [0, 2], [1, 1.5]));
	return new T.AnimationClip(name, 2, tracks);
}

// ---------------------------------------------------------------------------
// Skeleton / SkinnedMesh
// ---------------------------------------------------------------------------

test('Skeleton: bone inverses, bone matrices and bone texture layout match three.js', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		poseRig(rig, r);
		rig.mesh.skeleton.computeBoneTexture();
		rig.mesh.skeleton.update();
		return {
			inverses: rig.mesh.skeleton.boneInverses.map((m) => Array.from(m.elements)),
			boneMatrices: Array.from(rig.mesh.skeleton.boneMatrices),
			bindMatrix: Array.from(rig.mesh.bindMatrix.elements),
			bindMatrixInverse: Array.from(rig.mesh.bindMatrixInverse.elements),
			textureSize: [rig.mesh.skeleton.boneTexture.image.width, rig.mesh.skeleton.boneTexture.image.height],
			names: rig.mesh.skeleton.bones.map((b) => b.name),
			byName: rig.mesh.skeleton.getBoneByName('bone3').name,
			missing: rig.mesh.skeleton.getBoneByName('nope'),
		};
	}, 1e-5);
});

test('Skeleton.update skips the work when nothing moved, and tracks every bone change', () => {
	const r = prng(SEED);
	const rig = buildRig(JRS, r);
	const sk = rig.mesh.skeleton;
	sk.computeBoneTexture();
	sk.update();
	const v1 = sk.boneTexture.version;
	sk.update();
	assert.equal(sk.boneTexture.version, v1, 'unchanged skeleton must not re-flag the bone texture');
	const before = Array.from(sk.boneMatrices);
	rig.bones[3].rotation.x = 0.5; rig.mesh.updateMatrixWorld(true);
	sk.update();
	assert.equal(sk.boneTexture.version, v1 + 1);
	assert.notDeepEqual(Array.from(sk.boneMatrices), before);
	// the bone matrices equal three.js's for the same pose
	const r2 = prng(SEED);
	const ref = buildRig(THREE, r2);
	ref.bones[3].rotation.x = 0.5; ref.mesh.updateMatrixWorld(true);
	ref.mesh.skeleton.computeBoneTexture(); ref.mesh.skeleton.update();
	assertClose(Array.from(sk.boneMatrices), Array.from(ref.mesh.skeleton.boneMatrices), 1e-5, 'boneMatrices');
	// recomputed inverses are picked up
	sk.calculateInverses();
	sk.update();
	assert.equal(sk.boneTexture.version, v1 + 2);
});

test('SkinnedMesh: skinned vertex positions, bounding box / sphere, detached bind mode match three.js', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		poseRig(rig, r);
		const out = { verts: [], verts4: [] };
		const v = new L.Vector3(), v4 = new L.Vector4();
		for (let i = 0; i < rig.geometry.attributes.position.count; i += 7) {
			rig.mesh.getVertexPosition(i, v); out.verts.push(v.x, v.y, v.z);
			v4.set(1, 2, 3, 1); rig.mesh.applyBoneTransform(i, v4); out.verts4.push(v4.x, v4.y, v4.z, v4.w);
		}
		rig.mesh.computeBoundingBox(); rig.mesh.computeBoundingSphere();
		out.box = rig.mesh.boundingBox; out.sphere = rig.mesh.boundingSphere;
		// detached: bindMatrixInverse stays the inverse of the bind matrix even when the mesh moves
		rig.mesh.bindMode = L.DetachedBindMode;
		rig.mesh.position.x += 1; rig.mesh.updateMatrixWorld(true);
		out.detachedInverse = Array.from(rig.mesh.bindMatrixInverse.elements);
		rig.mesh.bindMode = L.AttachedBindMode;
		rig.mesh.updateMatrixWorld(true);
		out.attachedInverse = Array.from(rig.mesh.bindMatrixInverse.elements);
		return out;
	}, 1e-4);
});

test('SkinnedMesh.raycast hits the deformed geometry like three.js', () => {
	compare((L, r) => {
		const rig = buildRig(L, r, 6, 24);
		rig.mesh.position.set(0, 0, 0); rig.mesh.rotation.set(0, 0, 0); rig.mesh.scale.setScalar(1);
		rig.mesh.updateMatrixWorld(true);
		rig.mesh.bind(rig.mesh.skeleton); // rebind at the identity
		poseRig(rig, r, 0.5);
		const hits = [];
		for (let k = 0; k < 24; k++) {
			const o = new L.Vector3(rand(r, -3, 3), rand(r, -3, 3), 10);
			const d = new L.Vector3(rand(r, -0.2, 0.2), rand(r, -0.2, 0.2), -1).normalize();
			const rc = new L.Raycaster(o, d);
			const h = rc.intersectObject(rig.mesh);
			hits.push(h.length, ...h.map((x) => [x.distance, x.point.x, x.point.y, x.point.z, x.faceIndex, x.face.a, x.face.b, x.face.c]).flat());
		}
		return hits;
	}, 1e-4);
});

test('SkinnedMesh.normalizeSkinWeights, pose() and clone/copy match three.js', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		const sw = rig.geometry.attributes.skinWeight;
		for (let i = 0; i < sw.count; i++) sw.setXYZW(i, sw.getX(i) * 3, sw.getY(i) * 3, i % 5 === 0 ? 0.5 : 0, 0);
		sw.setXYZW(3, 0, 0, 0, 0); // degenerate row -> (1,0,0,0)
		rig.mesh.normalizeSkinWeights();
		const weights = Array.from(sw.array);
		poseRig(rig, r);
		rig.mesh.pose();
		rig.mesh.updateMatrixWorld(true);
		const posed = rig.bones.map((b) => [Array.from(b.matrix.elements), Array.from(b.matrixWorld.elements), b.position.toArray(), b.quaternion.toArray(), b.scale.toArray()]);
		const clone = rig.mesh.clone();
		return { weights, posed, cloneBind: Array.from(clone.bindMatrix.elements), cloneMode: clone.bindMode, sameSkeleton: clone.skeleton === rig.mesh.skeleton, type: clone.type };
	}, 1e-5);
});

test('Mesh.updateMorphTargets / morphTargetDictionary / getVertexPosition with morph targets match three.js', () => {
	compare((L, r) => {
		const g = new L.BoxGeometry(1, 1, 1, 2, 2, 2);
		const n = g.attributes.position.count;
		const t0 = new Float32Array(n * 3), t1 = new Float32Array(n * 3);
		for (let i = 0; i < n * 3; i++) { t0[i] = rand(r); t1[i] = rand(r); }
		const a0 = new L.Float32BufferAttribute(t0, 3); a0.name = 'smile';
		g.morphAttributes.position = [a0, new L.Float32BufferAttribute(t1, 3)];
		const m = new L.Mesh(g, new L.MeshBasicMaterial());
		m.morphTargetInfluences[0] = 0.3; m.morphTargetInfluences[1] = 0.6;
		const out = { dict: m.morphTargetDictionary, infl: m.morphTargetInfluences.slice(), abs: [], rel: [] };
		const v = new L.Vector3();
		for (let i = 0; i < n; i += 5) { m.getVertexPosition(i, v); out.abs.push(v.x, v.y, v.z); }
		g.morphTargetsRelative = true;
		for (let i = 0; i < n; i += 5) { m.getVertexPosition(i, v); out.rel.push(v.x, v.y, v.z); }
		g.computeBoundingBox(); g.computeBoundingSphere();
		out.box = g.boundingBox; out.sphere = g.boundingSphere;
		return out;
	}, 1e-5);
});

// ---------------------------------------------------------------------------
// Animation system
// ---------------------------------------------------------------------------

test('AnimationMixer samples a clip identically to three.js (bone matrices at many times)', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		const clip = makeClip(L, r, rig.bones);
		const mixer = new L.AnimationMixer(rig.mesh);
		const action = mixer.clipAction(clip);
		action.play();
		const out = [];
		for (let i = 0; i < 40; i++) {
			mixer.update(0.073);
			rig.mesh.updateMatrixWorld(true);
			out.push(...boneMatricesOf(rig), rig.mesh.scale.x, mixer.time);
		}
		return out;
	}, 1e-4);
});

test('Loop modes, time scale, clamp-when-finished, and events match three.js', () => {
	for (const loop of ['LoopOnce', 'LoopRepeat', 'LoopPingPong']) {
		compare((L, r) => {
			const rig = buildRig(L, r);
			const clip = makeClip(L, r, rig.bones);
			const mixer = new L.AnimationMixer(rig.mesh);
			const action = mixer.clipAction(clip);
			action.setLoop(L[loop], 3);
			action.clampWhenFinished = true;
			action.timeScale = 1.7;
			action.play();
			const events = [];
			mixer.addEventListener('loop', (e) => events.push('loop', e.loopDelta));
			mixer.addEventListener('finished', (e) => events.push('finished', e.direction));
			const out = [];
			for (let i = 0; i < 60; i++) {
				mixer.update(0.11);
				rig.mesh.updateMatrixWorld(true);
				out.push(action.time, action.isRunning() ? 1 : 0, action.enabled ? 1 : 0, action.getEffectiveWeight(), ...boneMatricesOf(rig).slice(0, 16));
			}
			// reverse playback
			action.reset(); action.timeScale = -1; action.time = 1.3; action.play();
			for (let i = 0; i < 20; i++) { mixer.update(0.1); rig.mesh.updateMatrixWorld(true); out.push(action.time, ...boneMatricesOf(rig).slice(16, 32)); }
			return { out, events };
		}, 1e-4);
	}
});

test('Crossfade between two actions, additive blending and warping match three.js', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		const walk = makeClip(L, r, rig.bones, 'walk'), run = makeClip(L, r, rig.bones, 'run');
		const mixer = new L.AnimationMixer(rig.mesh);
		const a = mixer.clipAction(walk), b = mixer.clipAction(run);
		a.play();
		const out = [];
		const step = () => { mixer.update(0.05); rig.mesh.updateMatrixWorld(true); out.push(a.getEffectiveWeight(), b.getEffectiveWeight(), a.getEffectiveTimeScale(), ...boneMatricesOf(rig)); };
		for (let i = 0; i < 10; i++) step();
		a.crossFadeTo(b.play(), 0.6, true);
		for (let i = 0; i < 20; i++) step();
		b.halt(0.4);
		for (let i = 0; i < 12; i++) step();
		b.stopWarping(); b.setEffectiveTimeScale(1).setEffectiveWeight(1).play();
		b.warp(1, 2.5, 0.5);
		for (let i = 0; i < 12; i++) step();
		// additive
		const addClip = L.AnimationUtils.makeClipAdditive(makeClip(L, r, rig.bones, 'add'));
		const c = mixer.clipAction(addClip);
		c.setEffectiveWeight(0.5).play();
		for (let i = 0; i < 12; i++) step();
		mixer.stopAllAction();
		for (let i = 0; i < 3; i++) step();
		return out;
	}, 1e-4);
});

test('KeyframeTrack interpolation modes (discrete, linear, smooth), ending modes and utilities match three.js', () => {
	compare((L, r) => {
		const times = [0, 0.4, 1.1, 1.5, 2.2];
		const vals = []; for (let i = 0; i < times.length * 3; i++) vals.push(rand(r, -3, 3));
		const qv = []; for (let i = 0; i < times.length; i++) { const q = new L.Quaternion().setFromEuler(new L.Euler(rand(r, -2, 2), rand(r, -2, 2), rand(r, -2, 2))); qv.push(q.x, q.y, q.z, q.w); }
		const out = {};
		const sample = (track, name) => {
			const interp = track.createInterpolant();
			const res = [];
			for (let t = -0.3; t < 2.6; t += 0.07) { interp.evaluate(t); res.push(...interp.resultBuffer); }
			out[name] = res;
		};
		sample(new L.VectorKeyframeTrack('.position', times, vals, L.InterpolateDiscrete), 'discrete');
		sample(new L.VectorKeyframeTrack('.position', times, vals, L.InterpolateLinear), 'linear');
		const smooth = new L.VectorKeyframeTrack('.position', times, vals, L.InterpolateSmooth);
		sample(smooth, 'smooth');
		const si = smooth.createInterpolant(); si.settings = { endingStart: L.WrapAroundEnding, endingEnd: L.ZeroSlopeEnding };
		{ const res = []; for (let t = -0.3; t < 2.6; t += 0.07) { si.evaluate(t); res.push(...si.resultBuffer); } out.smoothEndings = res; }
		sample(new L.QuaternionKeyframeTrack('.quaternion', times, qv), 'slerp');
		sample(new L.NumberKeyframeTrack('.opacity', times, vals.slice(0, 5)), 'number');
		sample(new L.ColorKeyframeTrack('.material.color', times, vals), 'color');
		const b = new L.BooleanKeyframeTrack('.visible', [0, 1, 2], [true, false, true]);
		sample(b, 'boolean');
		const s = new L.StringKeyframeTrack('.name', [0, 1, 2], ['a', 'b', 'c']);
		sample(s, 'string');
		// utilities
		const t2 = new L.VectorKeyframeTrack('.position', [0, 1, 2, 3, 4], [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
		out.trimmed = Array.from(t2.clone().trim(1, 3).times).concat(Array.from(t2.clone().trim(1, 3).values));
		out.scaled = Array.from(t2.clone().scale(2).times);
		out.shifted = Array.from(t2.clone().shift(0.5).times);
		out.optimized = Array.from(t2.clone().optimize().times);
		out.validate = t2.validate();
		out.json = L.KeyframeTrack.toJSON(t2);
		const clip = new L.AnimationClip('c', -1, [t2, smooth]);
		out.duration = clip.duration;
		out.sub = L.AnimationUtils.subclip(clip, 'sub', 1, 3, 30).duration;
		out.order = L.AnimationUtils.getKeyframeOrder([3, 1, 2]);
		out.sorted = L.AnimationUtils.sortedArray([10, 11, 20, 21, 30, 31], 2, [2, 0, 1]);
		out.flat = (() => { const vs = []; L.AnimationUtils.flattenJSON([{ time: 0, pos: [1, 2, 3] }, { time: 1 }, { time: 2, pos: [4, 5, 6] }], [], vs, 'pos'); return vs; })();
		out.clipJson = L.AnimationClip.toJSON(clip); delete out.clipJson.uuid;
		out.parsed = L.AnimationClip.parse(L.AnimationClip.toJSON(clip)).tracks.map((t) => [t.name, Array.from(t.times), Array.from(t.values), t.getInterpolation()]);
		return out;
	}, 1e-5);
});

test('PropertyBinding paths: bones by name, material properties, morph influences by name, parseTrackName', () => {
	compare((L, r) => {
		const rig = buildRig(L, r);
		rig.mesh.name = 'body';
		const mat = rig.mesh.material; mat.name = 'skin';
		const g = rig.geometry;
		const n = g.attributes.position.count;
		const a0 = new L.Float32BufferAttribute(new Float32Array(n * 3), 3); a0.name = 'puff';
		g.morphAttributes.position = [a0];
		rig.mesh.updateMorphTargets();
		const clip = new L.AnimationClip('props', 2, [
			new L.NumberKeyframeTrack('body.material.opacity', [0, 2], [1, 0]),
			new L.ColorKeyframeTrack('.material.color', [0, 2], [1, 0, 0, 0, 0, 1]),
			new L.NumberKeyframeTrack('.morphTargetInfluences[puff]', [0, 2], [0, 1]),
			new L.BooleanKeyframeTrack('body.visible', [0, 1, 2], [true, false, true]),
			new L.VectorKeyframeTrack('.bones[bone2].position', [0, 2], [0, 1, 0, 1, 1, 1]),
			new L.QuaternionKeyframeTrack('bone4.quaternion', [0, 2], [0, 0, 0, 1, 0, 0.7071, 0, 0.7071]),
		]);
		const mixer = new L.AnimationMixer(rig.mesh);
		mixer.clipAction(clip).play();
		const out = [];
		for (let i = 0; i < 6; i++) {
			mixer.update(0.33);
			rig.mesh.updateMatrixWorld(true);
			out.push(mat.opacity, mat.color.r, mat.color.g, mat.color.b, rig.mesh.morphTargetInfluences[0], rig.mesh.visible ? 1 : 0, rig.bones[2].position.x, rig.bones[2].position.y, rig.bones[4].quaternion.y, ...Array.from(rig.bones[4].matrixWorld.elements));
		}
		const parsed = L.PropertyBinding.parseTrackName('body.bones[bone2].position[x]');
		return { out, parsed: [parsed.nodeName, parsed.objectName, parsed.objectIndex, parsed.propertyName, parsed.propertyIndex], sanitized: L.PropertyBinding.sanitizeNodeName('a b.c'), found: L.PropertyBinding.findNode(rig.mesh, 'bone3').name };
	}, 1e-4);
});

test('AnimationClip.CreateFromMorphTargetSequence / CreateClipsFromMorphTargetSequences / findByName', () => {
	compare((L) => {
		const targets = ['run_000', 'run_001', 'run_002', 'jump_000', 'jump_001'].map((name, i) => ({ name, vertices: [] }));
		const clips = L.AnimationClip.CreateClipsFromMorphTargetSequences(targets, 10, false);
		const one = L.AnimationClip.CreateFromMorphTargetSequence('seq', targets.slice(0, 3), 12, true);
		return {
			names: clips.map((c) => c.name), durations: clips.map((c) => c.duration),
			tracks: clips.map((c) => c.tracks.map((t) => [t.name, Array.from(t.times), Array.from(t.values)])),
			one: [one.name, one.duration, one.tracks.map((t) => [t.name, Array.from(t.times), Array.from(t.values)])],
			found: L.AnimationClip.findByName(clips, clips[1].name).name,
		};
	});
});

test('AnimationObjectGroup drives several rigs from one action', () => {
	compare((L, r) => {
		const rigs = [buildRig(L, r), buildRig(L, r)];
		const clip = makeClip(L, r, rigs[0].bones);
		const group = new L.AnimationObjectGroup(rigs[0].mesh, rigs[1].mesh);
		const mixer = new L.AnimationMixer(group);
		mixer.clipAction(clip).play();
		const out = [];
		for (let i = 0; i < 8; i++) { mixer.update(0.1); for (const rig of rigs) { rig.mesh.updateMatrixWorld(true); out.push(...boneMatricesOf(rig)); } }
		group.remove(rigs[1].mesh);
		for (let i = 0; i < 3; i++) { mixer.update(0.1); for (const rig of rigs) { rig.mesh.updateMatrixWorld(true); out.push(...boneMatricesOf(rig)); } }
		return out;
	}, 1e-4);
});
