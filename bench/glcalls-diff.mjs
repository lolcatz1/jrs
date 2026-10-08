// Per-GL-function call counts for one frame of a scenario, three.js vs jrs, with the delta.
//   node bench/glcalls-diff.mjs [scenario ...]     (default: all)
// For multi-pass scenes the counts cover the whole frame (all render() calls). Extension methods
// (WEBGL_multi_draw) are counted too. Prints only functions where either library makes a call.
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { scenarios } from './scenarios.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const names = only.length ? only : Object.keys(scenarios);
const { server, port } = await startServer();
const browser = await launchBrowser();

async function countFrame(lib, scenario) {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true);
	const r = await page.evaluate(async ([lib, name]) => {
		const T = lib === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
		const { scenarios } = await import('/bench/scenarios.js');
		const sc = scenarios[name];
		const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; document.body.appendChild(canvas);
		const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: name.startsWith('shader-client'), powerPreference: 'high-performance' });
		renderer.setSize(320, 240, false);
		if (name === 'shadows') renderer.shadowMap.enabled = true;
		const { scene, camera, update, warm, frame } = sc.build(T, sc.n);
		const gl = renderer.getContext();
		if (warm) warm(renderer);
		let f = 0;
		const doFrame = () => { if (update) update(f); if (frame) frame(renderer); else renderer.render(scene, camera); f++; };
		for (let i = 0; i < 12; i++) doFrame();
		gl.finish();
		const counts = {};
		const proto = Object.getPrototypeOf(gl); const orig = {};
		for (const nm of Object.getOwnPropertyNames(proto)) {
			if (typeof gl[nm] !== 'function') continue;
			orig[nm] = gl[nm];
			gl[nm] = function (...a) { counts[nm] = (counts[nm] || 0) + 1; return orig[nm].apply(gl, a); };
		}
		const ext = gl.getExtension('WEBGL_multi_draw'); const extOrig = {};
		if (ext) for (const nm of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) { extOrig[nm] = ext[nm]; ext[nm] = function (...a) { counts[nm] = (counts[nm] || 0) + 1; return extOrig[nm].apply(ext, a); }; }
		doFrame();
		for (const nm in orig) delete gl[nm];
		if (ext) for (const nm in extOrig) delete ext[nm];
		renderer.dispose(); canvas.remove();
		return counts;
	}, [lib, scenario]);
	await page.close();
	return r;
}

const out = {};
for (const name of names) {
	const three = await countFrame('three', name);
	const jrs = await countFrame('jrs', name);
	const keys = [...new Set([...Object.keys(three), ...Object.keys(jrs)])].sort((a, b) => ((jrs[b] || 0) - (three[b] || 0)) - ((jrs[a] || 0) - (three[a] || 0)));
	const total = (c) => Object.values(c).reduce((a, b) => a + b, 0);
	console.log(`\n### ${name}  total GL calls/frame: three ${total(three)} -> jrs ${total(jrs)}`);
	console.log('| GL function | three | jrs | delta |\n|---|---:|---:|---:|');
	for (const k of keys) { const t = three[k] || 0, j = jrs[k] || 0; console.log(`| ${k} | ${t} | ${j} | ${j - t > 0 ? '+' : ''}${j - t} |`); }
	out[name] = { three, jrs };
}
const outDir = path.join(here, 'results', 'swarm'); fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'glcalls-diff.json'), JSON.stringify(out, null, 1));
await browser.close(); server.close();
