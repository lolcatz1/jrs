// Flat scene update check: renders twin scenes, one with renderer.flatSceneUpdate on (plus verifyListReuse, which rebuilds
// every reused list with the recursive walk and compares), one with the recursive walks, through a script of scene changes
// aimed at the flat pass's semantics (hierarchy animation, cameras and lights inside the tree, skinned meshes whose bones
// follow their mesh in traversal order, matrixAutoUpdate / matrixWorldAutoUpdate = false, custom updateMatrixWorld
// subclasses, user matrix updates between frames, reparenting in onBeforeRender, nested scenes, two renderers on one scene,
// direct children edits) and requires pixel-identical output and the same onBeforeRender / onAfterRender order every frame.
//   node bench/flat-check.mjs                 flat main renderer vs recursive reference
//   node bench/flat-check.mjs main=recursive  both recursive (to tell a pre-existing verify mismatch from a flat-pass one)
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/bench/index.html#${process.argv.slice(2).join('&')}`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const report = await page.evaluate(async () => {
	const JRS = await import('/src/index.js');
	const { scenarios } = await import('/bench/scenarios.js');
	const { buildSkinnedCylinder } = await import('/bench/conformance-tests.js');
	const W = 160, H = 120;
	const failures = [];
	let frames = 0;

	function makeRenderer(flat, shadows) {
		const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
		const r = new JRS.WebGLRenderer({ canvas, antialias: false, stencil: true });
		r.setSize(W, H, false);
		r.flatSceneUpdate = flat;
		r.debug.verifyListReuse = true;
		if (shadows) r.shadowMap.enabled = true;
		return r;
	}
	function pixels(r) {
		const gl = r.getContext(), buf = new Uint8Array(W * H * 4);
		gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
		return buf;
	}
	function same(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
	function diffCount(a, b) { let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; }

	class Gizmo extends JRS.Object3D {
		updateMatrixWorld(force) { this.position.x = Math.sin(this.t || 0); super.updateMatrixWorld(force); }
	}

	// ---- twin worlds -------------------------------------------------------------------------------------
	function world(shadows) {
		const T = JRS;
		const w = { T, log: [] };
		const scene = w.scene = new T.Scene();
		scene.background = new T.Color(0x203040);
		const cam = w.cam = new T.PerspectiveCamera(60, W / H, 0.1, 100); cam.position.set(0, 3, 16); cam.lookAt(0, 0, 0);
		// camera inside the hierarchy, on a rig that moves
		const rig = w.rig = new T.Group(); rig.position.set(0, 1, 0); scene.add(rig);
		const rigCam = w.rigCam = new T.PerspectiveCamera(50, W / H, 0.1, 100); rigCam.position.set(0, 2, 15); rigCam.lookAt(0, 0, 0); rig.add(rigCam);
		scene.add(new T.AmbientLight(0xffffff, 0.4));
		// directional light whose target is in the scene, after the light in traversal order
		const sun = w.sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(3, 8, 5); scene.add(sun);
		const target = w.target = new T.Object3D(); target.position.set(0, 0, 0); scene.add(target); sun.target = target;
		if (shadows) { sun.castShadow = true; sun.shadow.mapSize.set(256, 256); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; }
		const box = w.box = new T.BoxGeometry(1, 1, 1), sphere = w.sphere = new T.SphereGeometry(0.6, 10, 8);
		const mats = w.mats = [0xff5544, 0x44ff66, 0x4466ff].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.5 }));
		const glass = w.glass = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
		const hook = (o, name) => {
			o.name = name;
			o.onBeforeRender = function () { w.log.push('B:' + name); };
			o.onAfterRender = function () { w.log.push('A:' + name); };
		};
		// 6 chains of nested meshes (hierarchy animation)
		w.roots = []; w.chains = [];
		for (let c = 0; c < 6; c++) {
			const root = new T.Group(); root.position.set(c * 2.2 - 5.5, -3, 0); scene.add(root); w.roots.push(root);
			let parent = root;
			for (let i = 0; i < 5; i++) {
				const m = new T.Mesh(i % 2 ? sphere : box, mats[(c + i) % 3]);
				m.position.set(0.3, 0.9, 0); m.rotation.z = 0.2; m.castShadow = true; m.receiveShadow = true;
				parent.add(m); parent = m; w.chains.push(m);
				if (i === 2) hook(m, `chain${c}`);
			}
		}
		// loose meshes, some transparent
		w.meshes = [];
		for (let i = 0; i < 16; i++) {
			const m = new T.Mesh(i % 3 === 0 ? sphere : box, i % 4 === 3 ? glass : mats[i % 3]);
			m.position.set((i % 8) * 1.6 - 5.6, 3 + Math.floor(i / 8) * 1.5, -2 - (i % 3));
			m.castShadow = true;
			scene.add(m); w.meshes.push(m);
			if (i % 5 === 0) hook(m, `mesh${i}`);
		}
		// invisible subtree with a hooked mesh inside it
		const hidden = w.hidden = new T.Group(); hidden.visible = false; scene.add(hidden);
		const h1 = new T.Mesh(box, mats[0]); h1.position.set(0, 0, 4); hidden.add(h1); hook(h1, 'hiddenMesh');
		// skinned mesh: bones are children of the mesh (after it in traversal order)
		const sk = w.skinned = buildSkinnedCylinder(T, 0.4); sk.mesh.position.set(6, 0, 0); sk.mesh.scale.setScalar(0.6); scene.add(sk.mesh);
		// sprite
		const sprite = w.sprite = new T.Sprite(new T.SpriteMaterial({ color: 0xff00ff })); sprite.position.set(-6, 3, 2); sprite.scale.set(1.5, 1.5, 1); scene.add(sprite);
		// frozen local matrix
		const frozen = w.frozen = new T.Mesh(box, mats[1]); frozen.matrixAutoUpdate = false; frozen.matrix.makeTranslation(5, 4, 0); frozen.matrixWorldNeedsUpdate = true; scene.add(frozen);
		// user-owned world matrix with a child
		const owned = w.owned = new T.Group(); owned.matrixWorldAutoUpdate = false; owned.matrixWorld.makeTranslation(-5, -1, 3); owned.matrixWorldNeedsUpdate = true; scene.add(owned);
		const ownedChild = w.ownedChild = new T.Mesh(sphere, mats[2]); ownedChild.position.set(0, 1, 0); owned.add(ownedChild);
		// custom updateMatrixWorld subclass with a mesh inside
		const gizmo = w.gizmo = new Gizmo(); gizmo.position.set(0, 6, 0); scene.add(gizmo);
		const gizmoMesh = new T.Mesh(box, mats[0]); gizmoMesh.scale.setScalar(0.5); gizmo.add(gizmoMesh); hook(gizmoMesh, 'gizmoMesh');
		const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x888888 }));
		floor.rotation.x = -Math.PI / 2; floor.position.y = -5; floor.receiveShadow = true; scene.add(floor);
		// a second scene nested inside the first, also rendered on its own
		const inner = w.inner = new T.Scene(); inner.position.set(0, 0, 5); scene.add(inner);
		const innerMesh = w.innerMesh = new T.Mesh(box, mats[2]); innerMesh.position.set(2, 1, 0); inner.add(innerMesh); hook(innerMesh, 'innerMesh');
		inner.add(new T.AmbientLight(0xffffff, 2));
		return w;
	}

	async function script(name, shadows) {
		const rOn = makeRenderer(!location.hash.includes('main=recursive'), shadows), rOff = makeRenderer(false, shadows);
		// one scene, two renderers: a second flat renderer draws world `a` every third frame, compared with a second recursive
		// renderer drawing world `b` at the same cadence
		const rOn2 = makeRenderer(true, shadows), rOff2 = makeRenderer(false, shadows);
		const a = world(shadows), b = world(shadows);
		let step = '', seenMismatches = 0, seenMismatchesOff = 0, frame = 0;
		const preexisting = [];
		function render(camName = 'cam', sceneName = 'scene') {
			frames++; frame++;
			a.log.length = 0; b.log.length = 0;
			try { rOn.render(a[sceneName], a[camName]); } catch (e) { failures.push(`${name}: flat renderer threw at "${step}": ${e.message}`); throw e; }
			const logA = a.log.slice();
			rOff.render(b[sceneName], b[camName]);
			const onMismatch = rOn.debug.listReuse.mismatches !== seenMismatches, offMismatch = rOff.debug.listReuse.mismatches !== seenMismatchesOff;
			seenMismatches = rOn.debug.listReuse.mismatches; seenMismatchesOff = rOff.debug.listReuse.mismatches;
			// a verify mismatch the recursive reference reports at the same step is a pre-existing list-reuse issue, not the flat pass's
			if (onMismatch && !offMismatch) failures.push(`${name}: verify mismatch at "${step}"`);
			else if (onMismatch) preexisting.push(`${name}: verify mismatch in both renderers at "${step}" (pre-existing, independent of flatSceneUpdate)`);
			if (logA.join(' ') !== b.log.join(' ')) failures.push(`${name}: hook order differs at "${step}": ${logA.join(' ')} vs ${b.log.join(' ')}`);
			if (!same(pixels(rOn), pixels(rOff))) failures.push(`${name}: pixels differ at "${step}"`);
			if (frame % 3 === 0) {
				a.log.length = 0; b.log.length = 0;
				rOn2.render(a[sceneName], a[camName]);
				const log2 = a.log.slice();
				rOff2.render(b[sceneName], b[camName]);
				if (log2.join(' ') !== b.log.join(' ')) failures.push(`${name}: second renderer hook order differs at "${step}"`);
				if (!same(pixels(rOn2), pixels(rOff2))) failures.push(`${name}: second renderer pixels differ at "${step}" (${diffCount(pixels(rOn2), pixels(rOff2))} bytes, frame ${frame})`);
			}
		}
		function both(label, fn, n = 3, camName = 'cam', sceneName = 'scene') {
			step = label; fn(a); fn(b);
			for (let i = 0; i < n; i++) render(camName, sceneName);
		}
		const animate = (w, t) => {
			for (let i = 0; i < w.roots.length; i++) w.roots[i].rotation.y = t * 0.1 + i;
			w.chains[7].rotation.x = t * 0.2;
			w.skinned.child.rotation.z = 0.4 + Math.sin(t * 0.3) * 0.5;
			w.gizmo.t = t * 0.2;
		};
		both('initial static', () => {}, 4);
		for (let t = 1; t <= 6; t++) both(`animate ${t}`, (w) => animate(w, t), 1);
		both('static again', () => {}, 3);
		for (let t = 7; t <= 10; t++) both(`rig camera ${t}`, (w) => { animate(w, t); w.rig.rotation.y = t * 0.05; w.rig.position.x = Math.sin(t) * 0.5; }, 1, 'rigCam');
		both('rig camera static', () => {}, 3, 'rigCam');
		both('back to free camera', () => {}, 2);
		for (let i = 0; i < 4; i++) both(`orbit ${i}`, (w) => { const ang = 0.1 * (i + 1); w.cam.position.set(16 * Math.sin(ang), 3, 16 * Math.cos(ang)); w.cam.lookAt(0, 0, 0); }, 1);
		both('light target moves', (w) => { w.target.position.set(4, -2, 0); }, 2);
		both('light moves with target', (w) => { w.sun.position.set(-4, 7, 3); w.target.position.set(-2, 0, 1); }, 2);
		both('hidden subtree moves (matrices updated, nothing drawn)', (w) => { w.hidden.position.x += 1; w.hidden.children[0].rotation.y += 1; }, 2);
		both('hidden subtree shown', (w) => { w.hidden.visible = true; }, 2);
		both('hidden subtree hidden', (w) => { w.hidden.visible = false; }, 2);
		both('chain middle invisible', (w) => { w.chains[2].visible = false; }, 2);
		both('chain middle visible', (w) => { w.chains[2].visible = true; }, 2);
		both('frozen local matrix rewritten', (w) => { w.frozen.matrix.makeRotationY(0.6).setPosition(5, 4, 1); w.frozen.matrixWorldNeedsUpdate = true; w.frozen.position.x = 99; }, 2);
		both('owned world matrix rewritten + flagged', (w) => { w.owned.matrixWorld.makeTranslation(-4, 0, 3); w.owned.matrixWorldNeedsUpdate = true; }, 2);
		both('owned world matrix rewritten, not flagged (child stays)', (w) => { w.owned.matrixWorld.makeTranslation(-3, 1, 3); }, 2);
		both('user updateMatrixWorld between frames', (w) => { w.chains[12].position.y += 0.5; w.roots[2].updateMatrixWorld(true); w.meshes[3].position.z -= 1; w.meshes[3].updateWorldMatrix(true, false); }, 2);
		both('user scene.updateMatrixWorld each frame', (w) => { w.chains[20].rotation.y += 0.4; w.scene.updateMatrixWorld(); }, 2);
		both('layers', (w) => { w.meshes[1].layers.set(1); w.roots[1].layers.set(1); }, 2);
		both('camera layer', (w) => { w.cam.layers.enable(1); }, 2);
		both('layers back', (w) => { w.meshes[1].layers.set(0); w.roots[1].layers.set(0); w.cam.layers.set(0); }, 2);
		both('frustumCulled off + object off screen', (w) => { w.meshes[2].frustumCulled = false; w.meshes[2].position.x = 60; w.meshes[4].position.x = 60; }, 2);
		both('renderOrder', (w) => { w.meshes[7].renderOrder = 3; w.meshes[0].renderOrder = -1; }, 2);
		both('add subtree under a chain', (w) => { w.extra = new w.T.Group(); const m = new w.T.Mesh(w.box, w.mats[1]); m.position.set(1, 0, 0); w.extra.add(m); w.chains[3].add(w.extra); }, 2);
		both('remove it', (w) => { w.chains[3].remove(w.extra); }, 2);
		both('reparent with attach', (w) => { w.roots[4].attach(w.meshes[5]); }, 2);
		both('reparent with add', (w) => { w.roots[0].add(w.meshes[6]); }, 2);
		both('hook reparents during render', (w) => { w.chains[2].onBeforeRender = function () { if (!w.moved) { w.moved = true; w.scene.add(w.chains[14]); w.scene.remove(w.meshes[8]); } }; }, 3);
		both('hook removes itself', (w) => { w.chains[2].onBeforeRender = function () { if (this.parent) this.parent.remove(this); }; }, 3);
		both('many adds (rebuild path)', (w) => { w.many = []; for (let i = 0; i < 24; i++) { const m = new w.T.Mesh(w.box, w.mats[i % 3]); m.position.set(i * 0.5 - 6, 7, -3); w.scene.add(m); w.many.push(m); } }, 2);
		both('many removes', (w) => { for (const m of w.many) w.scene.remove(m); }, 2);
		// direct children edits: the flat graph notices them by itself; the recursive reference's render-list cache does not
		// (documented limitation of list reuse), so a tracked property is changed as well to keep the reference honest
		both('direct children push', (w) => { const m = new w.T.Mesh(w.sphere, w.mats[0]); m.position.set(0, 5, 2); m.parent = w.scene; w.scene.children.push(m); w.direct = m; w.meshes[9].renderOrder++; }, 2);
		both('direct children splice', (w) => { w.scene.children.splice(w.scene.children.indexOf(w.direct), 1); w.direct.parent = null; w.meshes[9].renderOrder++; }, 2);
		both('scene.matrixWorldAutoUpdate = false', (w) => { w.scene.matrixWorldAutoUpdate = false; w.roots[1].rotation.y += 1; }, 2);
		both('scene.matrixWorldAutoUpdate = true', (w) => { w.scene.matrixWorldAutoUpdate = true; }, 2);
		both('scene invisible', (w) => { w.scene.visible = false; }, 2);
		both('scene visible', (w) => { w.scene.visible = true; }, 2);
		step = 'nested scene rendered alternately';
		for (let t = 11; t <= 16; t++) { animate(a, t); animate(b, t); a.innerMesh.rotation.y = t; b.innerMesh.rotation.y = t; render('cam', 'scene'); render('cam', 'inner'); }
		both('nested scene mutated', (w) => { w.inner.add(new w.T.Mesh(w.sphere, w.mats[1])); }, 2, 'cam', 'inner');
		both('outer after inner mutation', () => {}, 2);
		both('sprite moves', (w) => { w.sprite.position.x += 1; }, 2);
		both('reuse off', () => { rOn.reuseRenderLists = false; rOff.reuseRenderLists = false; }, 3);
		both('reuse on', () => { rOn.reuseRenderLists = true; rOff.reuseRenderLists = true; }, 3);
		for (let t = 17; t <= 20; t++) both(`animate again ${t}`, (w) => animate(w, t), 1);
		both('final static', () => {}, 4);
		const stats = rOn.debug.listReuse, fu = rOn.debug.flatUpdate;
		if (stats.mismatches !== rOff.debug.listReuse.mismatches) failures.push(`${name}: ${stats.mismatches} verify mismatches (recursive reference: ${rOff.debug.listReuse.mismatches})`);
		if (stats.same === 0) failures.push(`${name}: list was never reused (same=0)`);
		if (fu.merged === 0 || fu.split === 0) failures.push(`${name}: expected both merged and split passes (${JSON.stringify(fu)})`);
		const out = { name, listReuse: { ...stats }, flatUpdate: { ...fu }, graph: { rebuilds: a.scene._flatGraph.rebuilds, patched: a.scene._flatGraph.patched }, preexisting };
		rOn.dispose(); rOff.dispose(); rOn2.dispose(); rOff2.dispose();
		return out;
	}

	const runs = [];
	for (const [n, sh] of [['plain', false], ['shadows', true]]) { try { runs.push(await script(n, sh)); } catch (e) { failures.push(`${n}: aborted: ${e.message}`); } }

	// ---- bench scenarios, flat vs recursive, byte-identical frames
	for (const name of ['shared-animated', 'hierarchy-animated', 'shared-static', 'many-materials', 'shadows-animated', 'skinned-crowd', 'shader-client']) {
		const sc = scenarios[name];
		if (!sc) continue;
		const n = Math.min(sc.n, 1500);
		const rOn = makeRenderer(true, name.startsWith('shadows')), rOff = makeRenderer(false, name.startsWith('shadows'));
		const A = sc.build(JRS, n), B = sc.build(JRS, n);
		if (A.warm) { A.warm(rOn); B.warm(rOff); }
		for (let f = 0; f < 12; f++) {
			frames++;
			if (A.update) { A.update(f); B.update(f); }
			if (A.frame) { A.frame(rOn); B.frame(rOff); } else { rOn.render(A.scene, A.camera); rOff.render(B.scene, B.camera); }
			if (!same(pixels(rOn), pixels(rOff))) { failures.push(`${name}: pixels differ at frame ${f}`); break; }
		}
		if (rOn.debug.listReuse.mismatches > 0) failures.push(`${name}: verify mismatches`);
		runs.push({ name, flatUpdate: { ...rOn.debug.flatUpdate } });
		rOn.dispose(); rOff.dispose();
	}
	return { frames, failures, runs };
});

console.log(JSON.stringify(report.runs, null, 1));
console.log(`${report.frames} frame pairs, ${report.failures.length} failures`);
for (const f of report.failures) console.log('FAIL', f);
await browser.close(); server.close();
process.exit(report.failures.length ? 1 : 0);
