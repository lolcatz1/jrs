// Phase profile of jrs on one scenario (wraps renderer internals with timers).
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const name = process.argv[2] || 'many-materials';
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'warning') console.log(m.text()); });
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
	const t = {};
	// outermost call only: recursive methods (_projectObject) would otherwise be counted once per nesting level
	const wrap = (obj, m, label) => { if (!obj || typeof obj[m] !== 'function') { console.warn('profile: skipping stale wrapper', label); return; } const f = obj[m]; let depth = 0; obj[m] = function (...a) { if (depth++ > 0) { try { return f.apply(this, a); } finally { depth--; } } const s = performance.now(); try { return f.apply(this, a); } finally { t[label] = (t[label] || 0) + performance.now() - s; depth--; } }; };
	wrap(scene, 'updateMatrixWorld', 'scene.updateMatrixWorld'); scene._flatUMW = scene.updateMatrixWorld; // the wrapper is not a subclass override
	wrap(renderer, '_projectObject', 'projectObject');
	wrap(renderer, '_flatPass', 'flatPass(update+project)');
	wrap(renderer, '_drawList', 'drawList');
	wrap(renderer, '_resolvePrograms', 'resolvePrograms');
	wrap(renderer.batcher, 'uploadTexture', 'batcher.uploadTexture');
	wrap(gl, 'texImage2D', 'gl.texImage2D');
	wrap(gl, 'texSubImage2D', 'gl.texSubImage2D');
	wrap(renderer.bindingStates, 'bind', 'bindingStates.bind');
	wrap(renderer, '_syncMaterialBlock', 'syncMaterialBlock');
	wrap(renderer, '_setupMaterial', 'setupMaterial(total)');
	wrap(renderer, '_draw', 'gl draw');
	wrap(renderer.state, 'useProgram', 'useProgram');
	wrap(gl, 'drawElementsInstanced', 'gl.drawElementsInstanced');
	wrap(gl, 'bindBufferRange', 'gl.bindBufferRange');
	wrap(gl, 'vertexAttribPointer', 'gl.vertexAttribPointer');
	wrap(gl, 'bindVertexArray', 'gl.bindVertexArray');
	{ const list = renderer.renderLists.get(scene, 0, camera); wrap(Object.getPrototypeOf(list), 'finish', 'list.finish(sort)'); }
	for (let f = 0; f < 10; f++) { if (update) update(f); renderer.render(scene, camera); }
	gl.finish();
	for (const k in t) t[k] = 0;
	const N = 30;
	const s0 = performance.now();
	for (let f = 0; f < N; f++) { if (update) update(10 + f); renderer.render(scene, camera); }
	const total = (performance.now() - s0) / N;
	const out = {}; // snapshot before the no-batch pass below adds to the same timers
	for (const k in t) out[k] = +(t[k] / N).toFixed(3);
	out.total = +total.toFixed(3);
	out.calls = renderer.info.render.calls; out.batches = renderer.info.render.batches;
	// no-batch comparison
	renderer.autoBatch = false;
	for (let f = 0; f < 5; f++) renderer.render(scene, camera);
	const s1 = performance.now();
	for (let f = 0; f < N; f++) renderer.render(scene, camera);
	out.totalNoBatch = +((performance.now() - s1) / N).toFixed(3);
	return out;
}, name);
console.log(JSON.stringify(r, null, 1));
await browser.close(); server.close();
