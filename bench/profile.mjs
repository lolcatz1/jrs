// Phase profile of jrs on one scenario (wraps renderer internals with timers).
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const name = process.argv[2] || 'many-materials';
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
	const { scene, camera, update } = sc.build(JRS, sc.n);
	const gl = renderer.getContext();
	let t = {};
	const wrap = (obj, m, label) => { if (typeof obj[m] !== 'function') return; const f = obj[m].bind(obj); let depth = 0; obj[m] = (...a) => { if (depth++ > 0) { try { return f(...a); } finally { depth--; } } const s = performance.now(); try { return f(...a); } finally { depth--; t[label] = (t[label] || 0) + performance.now() - s; } }; };
	wrap(scene, 'updateMatrixWorld', 'scene.updateMatrixWorld');
	wrap(renderer, '_projectObject', 'project');
	wrap(renderer, '_drawList', 'drawList');
	wrap(renderer, '_resolvePrograms', 'resolvePrograms');
	wrap(renderer.batcher, 'upload', 'batcher.upload');
	wrap(renderer.bindingStates, 'bind', 'bindingStates.bind');
	wrap(renderer, '_syncMaterialBlock', 'syncMaterialBlock');
	wrap(renderer, '_setupMaterial', 'setupMaterial(total)');
	wrap(renderer, '_draw', 'gl draw');
	wrap(renderer.state, 'useProgram', 'useProgram');
	wrap(gl, 'drawElementsInstanced', 'gl.drawElementsInstanced');
	wrap(gl, 'bindBufferRange', 'gl.bindBufferRange');
	wrap(gl, 'vertexAttribPointer', 'gl.vertexAttribPointer');
	wrap(gl, 'bindVertexArray', 'gl.bindVertexArray');
	for (let f = 0; f < 10; f++) { if (update) update(f); renderer.render(scene, camera); }
	gl.finish();
	for (const k in t) t[k] = 0;
	const N = 30;
	const s0 = performance.now();
	for (let f = 0; f < N; f++) { if (update) update(10 + f); renderer.render(scene, camera); }
	const total = (performance.now() - s0) / N;
	for (const k in t) t[k] = +(t[k] / N).toFixed(3);
	t.total = +total.toFixed(3);
	t.calls = renderer.info.render.calls; t.batches = renderer.info.render.batches;
	const timed = t; t = {};
	// no-batch comparison
	renderer.autoBatch = false;
	for (let f = 0; f < 5; f++) renderer.render(scene, camera);
	const s1 = performance.now();
	for (let f = 0; f < N; f++) renderer.render(scene, camera);
	t = timed; t.totalNoBatch = +((performance.now() - s1) / N).toFixed(3);
	return t;
}, name);
console.log(JSON.stringify(r, null, 1));
await browser.close(); server.close();
