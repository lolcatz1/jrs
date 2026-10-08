// Shadow-map cache invalidation: after each mutation the cached renderer must re-render the map
// (or legitimately skip) and its pixels must equal a renderer that never skips.
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
await page.waitForFunction(() => window.ready === true);
const results = await page.evaluate(async () => {
	const J = await import('/src/index.js');
	const mk = () => {
		const c = document.createElement('canvas'); c.width = 96; c.height = 96;
		const r = new J.WebGLRenderer({ canvas: c, preserveDrawingBuffer: true }); r.setSize(96, 96, false); r.shadowMap.enabled = true;
		return r;
	};
	const scene = new J.Scene(); scene.background = new J.Color(0x202030);
	const light = new J.DirectionalLight(0xffffff, 2); light.position.set(5, 8, 3); light.castShadow = true;
	light.shadow.camera.left = -8; light.shadow.camera.right = 8; light.shadow.camera.top = 8; light.shadow.camera.bottom = -8;
	scene.add(light); scene.add(new J.AmbientLight(0x404040));
	const ground = new J.Mesh(new J.PlaneGeometry(20, 20), new J.MeshStandardMaterial({ color: 0x808080 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
	const geo = new J.BoxGeometry(1, 1, 1), mat = new J.MeshStandardMaterial({ color: 0xff4040 });
	const boxes = [];
	for (let i = 0; i < 6; i++) { const m = new J.Mesh(geo, mat); m.position.set(i - 3, 0.5 + (i % 2), (i % 3) - 1); m.castShadow = true; scene.add(m); boxes.push(m); }
	const camera = new J.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 9, 12); camera.lookAt(0, 0, 0);
	const cached = mk();
	const px = (r) => { const gl = r.getContext(); const a = new Uint8Array(96 * 96 * 4); gl.readPixels(0, 0, 96, 96, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; };
	const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i] - b[i])); return d; };
	const out = [];
	const step = (name, mutate, expectRender) => {
		mutate();
		const before = cached.shadowMap.rendered;
		cached.render(scene, camera); const a = px(cached);
		const rendered = cached.shadowMap.rendered - before;
		// reference: the same renderer with the cache bypassed (forced shadow render)
		cached.shadowMap.needsUpdate = true; cached.render(scene, camera); const b = px(cached);
		out.push({ name, rendered, expectRender, maxDiff: diff(a, b), ok: (expectRender === null || (rendered > 0) === expectRender) && diff(a, b) === 0 });
	};
	for (let i = 0; i < 4; i++) cached.render(scene, camera);
	step('static (cached)', () => {}, false);
	step('camera moved', () => { camera.position.x += 2; camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); }, false);
	step('caster moved', () => { boxes[2].position.y += 1; }, true);
	step('static again', () => { cached.render(scene, camera); cached.render(scene, camera); }, false);
	step('light moved', () => { light.position.x += 3; }, true);
	step('light target moved', () => { light.target.position.x = 2; light.target.updateMatrixWorld(); }, true);
	step('caster hidden', () => { boxes[1].visible = false; }, true);
	step('caster shown', () => { boxes[1].visible = true; }, true);
	step('caster removed', () => { scene.remove(boxes[3]); }, true);
	step('caster added', () => { scene.add(boxes[3]); }, true);
	step('castShadow off', () => { boxes[4].castShadow = false; }, true);
	step('castShadow on', () => { boxes[4].castShadow = true; }, true);
	step('new caster', () => { const m = new J.Mesh(geo, mat); m.position.set(0, 3, 0); m.castShadow = true; scene.add(m); }, true);
	step('material side', () => { mat.side = J.DoubleSide; }, true);
	step('geometry edited', () => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) * 2); p.needsUpdate = true; }, true);
	step('geometry replaced', () => { boxes[0].geometry = new J.SphereGeometry(0.8, 12, 8); }, true);
	step('parent moved', () => { const g = new J.Group(); scene.add(g); g.add(boxes[5]); g.position.x = -2; }, true);
	step('map size changed', () => { light.shadow.mapSize.set(256, 256); }, true);
	step('shadow camera frustum', () => { light.shadow.camera.right = 4; light.shadow.camera.updateProjectionMatrix(); }, true);
	step('static final', () => { cached.render(scene, camera); cached.render(scene, camera); }, false);
	// alpha-tested caster is never cached
	const alpha = new J.Mesh(geo, new J.MeshStandardMaterial({ alphaTest: 0.5 })); alpha.castShadow = true; scene.add(alpha);
	for (let i = 0; i < 6; i++) cached.render(scene, camera);
	const b0 = cached.shadowMap.rendered; cached.render(scene, camera); cached.render(scene, camera);
	out.push({ name: 'alphaTest caster always renders', rendered: cached.shadowMap.rendered - b0, ok: cached.shadowMap.rendered - b0 === 2 });
	return out;
});
let bad = 0;
for (const r of results) { console.log((r.ok ? 'ok   ' : 'FAIL ') + r.name + '  mapRenders=' + r.rendered + (r.maxDiff !== undefined ? ' maxDiff=' + r.maxDiff : '')); if (!r.ok) bad++; }
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
