// Render-list reuse check: renders twin scenes, one with renderer.reuseRenderLists on (and verifyListReuse, which rebuilds
// every reused list from scratch and compares), one with it off, through a script of scene changes, and requires
// pixel-identical output on every frame. Also runs the bench scenarios the same way.
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });

const report = await page.evaluate(async () => {
	const JRS = await import('/src/index.js');
	const { scenarios } = await import('/bench/scenarios.js');
	const W = 160, H = 120;
	const failures = [];
	let frames = 0;

	function makeRenderer(reuse, shadows) {
		const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
		const r = new JRS.WebGLRenderer({ canvas, antialias: false, stencil: true });
		r.setSize(W, H, false);
		r.reuseRenderLists = reuse;
		r.debug.verifyListReuse = reuse;
		if (shadows) r.shadowMap.enabled = true;
		return r;
	}
	function pixels(r) {
		const gl = r.getContext(), buf = new Uint8Array(W * H * 4);
		gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
		return buf;
	}
	function same(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

	// ---- twin worlds -------------------------------------------------------------------------------------
	function world(shadows) {
		const T = JRS;
		const scene = new T.Scene();
		scene.background = new T.Color(0x203040);
		const cam = new T.PerspectiveCamera(60, W / H, 0.1, 100); cam.position.set(0, 2, 14); cam.lookAt(0, 0, 0);
		const cam2 = new T.PerspectiveCamera(40, W / H, 0.1, 100); cam2.position.set(10, 6, 8); cam2.lookAt(0, 0, 0);
		const ortho = new T.OrthographicCamera(-8, 8, 6, -6, 0.1, 100); ortho.position.set(0, 0, 20);
		const ambient = new T.AmbientLight(0xffffff, 0.4); scene.add(ambient);
		const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(3, 8, 5); scene.add(sun);
		if (shadows) { sun.castShadow = true; sun.shadow.mapSize.set(256, 256); sun.shadow.camera.left = -12; sun.shadow.camera.right = 12; sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12; }
		const box = new T.BoxGeometry(1, 1, 1), sphere = new T.SphereGeometry(0.7, 12, 8), cone = new T.ConeGeometry(0.6, 1.2, 10);
		const mats = [0xff5544, 0x44ff66, 0x4466ff].map((c) => new T.MeshStandardMaterial({ color: c, roughness: 0.5 }));
		const glass = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0.2 });
		const glass2 = new T.MeshPhongMaterial({ color: 0xffaa00, transparent: true, opacity: 0.5 });
		const meshes = [], glassMeshes = [];
		for (let i = 0; i < 48; i++) {
			const m = new T.Mesh(i % 3 === 0 ? box : i % 3 === 1 ? sphere : cone, mats[i % 3]);
			m.position.set((i % 8) * 2 - 7, Math.floor(i / 8) * 1.8 - 4, -((i * 7) % 5));
			m.castShadow = true; m.receiveShadow = true;
			scene.add(m); meshes.push(m);
		}
		for (let i = 0; i < 12; i++) {
			const m = new T.Mesh(i % 2 ? sphere : box, i % 3 === 0 ? glass2 : glass);
			m.position.set(((i * 5) % 9) - 4, ((i * 3) % 6) - 3, 3 - i * 0.7);
			scene.add(m); glassMeshes.push(m);
		}
		const group = new T.Group(); scene.add(group);
		const inGroup = new T.Mesh(box, mats[0]); inGroup.position.set(0, 4.5, 0); group.add(inGroup);
		const floor = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshStandardMaterial({ color: 0x888888 }));
		floor.rotation.x = -Math.PI / 2; floor.position.y = -6; floor.receiveShadow = true; scene.add(floor);
		const instanced = new T.InstancedMesh(box, new T.MeshBasicMaterial({ color: 0xffffff }), 6);
		const mtx = new T.Matrix4();
		for (let i = 0; i < 6; i++) { mtx.makeTranslation(i - 3, 5.5, 1); instanced.setMatrixAt(i, mtx); }
		scene.add(instanced);
		const rt = new T.WebGLRenderTarget(64, 48);
		return { T, scene, cam, cam2, ortho, ambient, sun, mats, glass, glass2, meshes, glassMeshes, group, inGroup, floor, instanced, rt, box, sphere, cone, current: cam };
	}

	async function script(name, shadows) {
		const rOn = makeRenderer(true, shadows), rOff = makeRenderer(false, shadows);
		const a = world(shadows), b = world(shadows);
		let step = '', seenMismatches = 0;
		function render(camName = 'cam') {
			frames++;
			try { rOn.render(a.scene, a[camName]); } catch (e) { failures.push(`${name}: reuse renderer threw at "${step}": ${e.message}`); throw e; }
			if (rOn.debug.listReuse.mismatches !== seenMismatches) { seenMismatches = rOn.debug.listReuse.mismatches; failures.push(`${name}: verify mismatch at "${step}"`); }
			rOff.render(b.scene, b[camName]);
			if (!same(pixels(rOn), pixels(rOff))) { failures.push(`${name}: pixels differ at "${step}"`); }
		}
		function both(label, fn, n = 3, camName = 'cam') {
			step = label; fn(a); fn(b);
			for (let i = 0; i < n; i++) render(camName);
		}
		both('initial static', () => {}, 4);
		for (let i = 0; i < 8; i++) both(`orbit ${i}`, (w) => { const ang = 0.05 * (i + 1); w.cam.position.set(14 * Math.sin(ang), 2, 14 * Math.cos(ang)); w.cam.lookAt(0, 0, 0); }, 1);
		both('camera static again', () => {}, 3);
		both('camera far away (culls change)', (w) => { w.cam.position.set(0, 0, 40); w.cam.lookAt(0, 0, 0); }, 2);
		both('camera near (culls change)', (w) => { w.cam.position.set(6, 1, 3); w.cam.lookAt(0, 0, 0); }, 2);
		both('fov change', (w) => { w.cam.fov = 90; w.cam.updateProjectionMatrix(); }, 2);
		for (let i = 0; i < 6; i++) { step = 'alternating cameras ' + i; frames += 0; render(i % 2 ? 'cam2' : 'cam'); render(i % 2 ? 'ortho' : 'cam2'); }
		both('add mesh', (w) => { w.extra = new w.T.Mesh(w.box, w.mats[1]); w.extra.position.set(1, 1, 2); w.scene.add(w.extra); });
		both('remove mesh', (w) => { w.scene.remove(w.extra); });
		both('toggle visible mesh', (w) => { w.meshes[5].visible = false; });
		both('toggle visible back', (w) => { w.meshes[5].visible = true; });
		both('group invisible', (w) => { w.group.visible = false; });
		both('group visible', (w) => { w.group.visible = true; });
		both('move object', (w) => { w.meshes[7].position.x += 1.5; });
		both('rotate transparent', (w) => { w.glassMeshes[3].rotation.y += 0.7; w.glassMeshes[3].position.z -= 5; });
		both('material colour change', (w) => { w.mats[0].color.setHex(0xffff00); });
		both('material swap', (w) => { w.meshes[2].material = w.mats[2]; });
		both('material to transparent', (w) => { w.mats[1].transparent = true; w.mats[1].opacity = 0.6; w.mats[1].needsUpdate = true; });
		both('material back to opaque', (w) => { w.mats[1].transparent = false; w.mats[1].opacity = 1; w.mats[1].needsUpdate = true; });
		both('material invisible', (w) => { w.glass.visible = false; });
		both('material visible', (w) => { w.glass.visible = true; });
		both('material wireframe', (w) => { w.mats[2].wireframe = true; });
		both('material wireframe off', (w) => { w.mats[2].wireframe = false; });
		both('geometry swap', (w) => { w.meshes[9].geometry = w.cone; });
		both('geometry bounding sphere change', (w) => { w.box.translate(0, 0, 0.0); w.sphere.scale(1.4, 1.4, 1.4); w.sphere.computeBoundingSphere(); });
		both('geometry moved off screen then back', (w) => { w.cone.translate(0, 80, 0); w.cone.computeBoundingSphere(); }, 2);
		both('geometry back', (w) => { w.cone.translate(0, -80, 0); w.cone.computeBoundingSphere(); }, 2);
		both('renderOrder', (w) => { w.glassMeshes[1].renderOrder = 5; w.meshes[0].renderOrder = -3; });
		both('renderOrder reset', (w) => { w.glassMeshes[1].renderOrder = 0; w.meshes[0].renderOrder = 0; });
		both('frustumCulled=false', (w) => { w.meshes[11].frustumCulled = false; w.glassMeshes[2].frustumCulled = false; });
		both('layers', (w) => { w.meshes[13].layers.set(1); });
		both('camera layer enable', (w) => { w.cam.layers.enable(1); });
		both('camera layer set to 1', (w) => { w.cam.layers.set(1); });
		both('camera layer 0 again', (w) => { w.cam.layers.set(0); w.meshes[13].layers.set(0); });
		both('override material', (w) => { w.scene.overrideMaterial = new w.T.MeshBasicMaterial({ color: 0x00ffff }); });
		both('override material removed', (w) => { w.scene.overrideMaterial = null; });
		both('sortObjects off', (w) => {}, 1);
		rOn.sortObjects = false; rOff.sortObjects = false; render(); render(); render();
		rOn.sortObjects = true; rOff.sortObjects = true; render(); render();
		both('onBeforeRender assigned', (w) => { w.meshes[20].onBeforeRender = function () { this.rotation.z += 0.3; }; }, 4);
		both('light intensity', (w) => { w.sun.intensity = 0.5; });
		both('light moved', (w) => { w.sun.position.set(-4, 6, 2); });
		both('light added', (w) => { w.point = new w.T.PointLight(0xff8800, 80, 0, 2); w.point.position.set(0, 3, 4); w.scene.add(w.point); });
		both('light removed', (w) => { w.scene.remove(w.point); });
		both('castShadow off', (w) => { w.sun.castShadow = false; });
		both('castShadow on', (w) => { w.sun.castShadow = shadows; });
		both('instanced colour', (w) => { w.instanced.setColorAt(0, new w.T.Color(1, 0, 0)); w.instanced.setColorAt(1, new w.T.Color(0, 1, 0)); }, 2);
		both('instanced moved', (w) => { const m = new w.T.Matrix4().makeTranslation(0, -2, 0); w.instanced.setMatrixAt(0, m); w.instanced.instanceMatrix.needsUpdate = true; }, 2);
		both('vertex data update', (w) => { const p = w.box.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 0.9); p.needsUpdate = true; }, 3);
		both('array material mesh', (w) => { w.multi = new w.T.Mesh(w.box, [w.mats[0], w.mats[1], w.glass, w.mats[2], w.mats[0], w.mats[1]]); w.multi.position.set(-2, 0, 5); w.scene.add(w.multi); }, 4);
		both('array material entry swap', (w) => { w.multi.material[2] = w.mats[2]; }, 3);
		both('sprite', (w) => { w.sprite = new w.T.Sprite(new w.T.SpriteMaterial({ color: 0xff00ff })); w.sprite.position.set(2, 2, 6); w.sprite.scale.set(2, 2, 1); w.scene.add(w.sprite); }, 4);
		for (let i = 0; i < 4; i++) both('orbit with sprite ' + i, (w) => { w.cam.position.x += 0.4; w.cam.lookAt(0, 0, 0); }, 1);
		both('sprite material invisible', (w) => { w.sprite.material.visible = false; }, 3);
		both('sprite removed', (w) => { w.scene.remove(w.sprite); }, 2);
		both('autoBatch off', () => { rOn.autoBatch = false; rOff.autoBatch = false; }, 3);
		both('autoBatch on', () => { rOn.autoBatch = true; rOff.autoBatch = true; }, 3);
		both('autoBatchMinimum', () => { rOn.autoBatchMinimum = 100; rOff.autoBatchMinimum = 100; }, 3);
		both('autoBatchMinimum back', () => { rOn.autoBatchMinimum = 4; rOff.autoBatchMinimum = 4; }, 3);
		both('autoMultiDraw off', () => { rOn.autoMultiDraw = false; rOff.autoMultiDraw = false; }, 3);
		both('autoMultiDraw on', () => { rOn.autoMultiDraw = true; rOff.autoMultiDraw = true; }, 3);
		// objects added from a render hook while the frame is being drawn
		both('hook adds object mid-frame', (w) => { w.hooked = w.meshes[30]; w.hooked.onBeforeRender = function () { if (!w.late) { w.late = new w.T.Mesh(w.box, w.mats[1]); w.late.position.set(-5, 5, 5); w.scene.add(w.late); } }; }, 4);
		both('hook removes object mid-frame', (w) => { w.hooked.onBeforeRender = function () { if (w.late && w.late.parent) w.scene.remove(w.late); }; }, 4);
		both('stable again', () => {}, 4);
		// render target in between (same scene, same camera, other target)
		step = 'render target interleave';
		for (let i = 0; i < 4; i++) {
			frames++;
			rOn.setRenderTarget(a.rt); rOn.render(a.scene, a.cam); rOn.setRenderTarget(null);
			rOff.setRenderTarget(b.rt); rOff.render(b.scene, b.cam); rOff.setRenderTarget(null);
			render();
		}
		both('after target', () => {}, 2);
		// mutation between frames while hooked mesh changes nothing else
		step = 'dispose-free rerender'; render(); render();
		const stats = rOn.debug.listReuse;
		if (stats.mismatches > 0) failures.push(`${name}: ${stats.mismatches} verify mismatches`);
		if (stats.same === 0) failures.push(`${name}: list was never reused (same=0)`);
		const out = { name, stats: { ...stats } };
		rOn.dispose(); rOff.dispose();
		return out;
	}

	const runs = [];
	for (const [n, sh] of [['plain', false], ['shadows', true]]) { try { runs.push(await script(n, sh)); } catch (e) { failures.push(`${n}: aborted: ${e.message}`); } }

	// ---- bench scenarios: reuse on vs off, verify on ------------------------------------------------------------
	for (const name of ['shared-static', 'shared-animated', 'many-materials', 'unique-geometries', 'hierarchy-animated', 'instanced-100k', 'shadows']) {
		const sc = scenarios[name];
		const n = Math.min(sc.n, 1500);
		const rOn = makeRenderer(true, name === 'shadows'), rOff = makeRenderer(false, name === 'shadows');
		const a = sc.build(JRS, n), b = sc.build(JRS, n);
		for (let f = 0; f < 14; f++) {
			frames++;
			if (a.update) { a.update(f); b.update(f); }
			rOn.render(a.scene, a.camera); rOff.render(b.scene, b.camera);
			if (!same(pixels(rOn), pixels(rOff))) { failures.push(`${name}: pixels differ at frame ${f}`); break; }
		}
		const stats = rOn.debug.listReuse;
		if (stats.mismatches > 0) failures.push(`${name}: ${stats.mismatches} verify mismatches`);
		runs.push({ name, stats: { ...stats } });
		rOn.dispose(); rOff.dispose();
	}
	return { failures, frames, runs };
});

for (const r of report.runs) console.log(r.name.padEnd(20), JSON.stringify(r.stats));
console.log(`${report.frames} frame pairs compared`);
if (report.failures.length) { console.log('FAILURES:\n  ' + [...new Set(report.failures)].join('\n  ')); }
else console.log('reuse check: all frames pixel-identical, no verify mismatches');
await browser.close(); server.close();
process.exit(report.failures.length ? 1 : 0);
