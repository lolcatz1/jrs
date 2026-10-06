// Splits one jrs frame of a scenario into GL draw time vs. everything else (JS + other GL calls).
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const name = process.argv[2] || 'shader-client';
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
await page.waitForFunction(() => window.ready === true);
const r = await page.evaluate(async (name) => {
	const { scenarios } = await import('/bench/scenarios.js');
	const JRS = await import('/src/index.js');
	const sc = scenarios[name];
	const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
	const renderer = new JRS.WebGLRenderer({ canvas });
	renderer.setSize(320, 240, false);
	const { scene, camera, update, warm } = sc.build(JRS, sc.n);
	const gl = renderer.getContext();
	if (warm) warm(renderer);
	for (let f = 0; f < 10; f++) { if (update) update(f); renderer.render(scene, camera); }
	gl.finish();
	const N = 30;
	let t0 = performance.now();
	for (let f = 0; f < N; f++) { if (update) update(10 + f); renderer.render(scene, camera); }
	const plain = (performance.now() - t0) / N;
	// time spent inside gl.draw* and gl.uniform* calls (wrapped), one frame
	const acc = { draw: 0, uniform: 0, other: 0, n: 0 };
	const proto = Object.getPrototypeOf(gl); const orig = {};
	for (const nm of Object.getOwnPropertyNames(proto)) {
		if (typeof gl[nm] !== 'function' || nm.startsWith('get')) continue;
		orig[nm] = gl[nm];
		const cat = nm.startsWith('draw') ? 'draw' : nm.startsWith('uniform') ? 'uniform' : 'other';
		gl[nm] = function (...a) { const s = performance.now(); const r = orig[nm].apply(gl, a); acc[cat] += performance.now() - s; acc.n++; return r; };
	}
	t0 = performance.now();
	for (let f = 0; f < 10; f++) { if (update) update(50 + f); renderer.render(scene, camera); }
	const wrapped = (performance.now() - t0) / 10;
	for (const nm in orig) delete gl[nm];
	// scene-graph + projection cost alone: render with an empty draw (skip _drawList)
	const dl = renderer._drawList; renderer._drawList = () => {};
	t0 = performance.now();
	for (let f = 0; f < N; f++) { if (update) update(100 + f); renderer.render(scene, camera); }
	const noDraw = (performance.now() - t0) / N;
	renderer._drawList = dl;
	return { frameMs: +plain.toFixed(3), wrappedFrameMs: +wrapped.toFixed(3), glDrawMs: +(acc.draw / 10).toFixed(3), glUniformMs: +(acc.uniform / 10).toFixed(3), glOtherMs: +(acc.other / 10).toFixed(3), glCallsPerFrame: acc.n / 10, updateProjectSortMs: +noDraw.toFixed(3), geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
}, name);
console.log(JSON.stringify(r));
await browser.close(); server.close();
