// Pure-CPU renderer cost per frame: all draw calls stubbed to no-ops, time measured over chunks of frames
// (performance.now() is only 0.1 ms resolution here, so single-frame medians are too coarse for sub-ms work).
//   node bench/cpu-stubbed.mjs <scenario...> [--chunks=40] [--chunk=25]
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const args = process.argv.slice(2);
const flag = (n, d) => Number((args.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1]);
const names = args.filter(a => !a.startsWith('--'));
const { server, port } = await startServer();
const browser = await launchBrowser();
for (const name of names.length ? names : ['shader-client', 'shader-client-static']) {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true);
	const r = await page.evaluate(async ([name, chunks, chunk]) => {
		const { scenarios } = await import('/bench/scenarios.js');
		const JRS = await import('/src/index.js');
		const sc = scenarios[name];
		const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
		const renderer = new JRS.WebGLRenderer({ canvas }); renderer.setSize(320, 240, false);
		const built = sc.build(JRS, sc.n);
		const { scene, camera, update } = built;
		if (built.warm) built.warm(renderer);
		const gl = renderer.getContext();
		let f = 0;
		const frame = () => { if (update) update(f++); if (built.frame) built.frame(renderer); else renderer.render(scene, camera); };
		for (let i = 0; i < 30; i++) frame();
		gl.finish();
		for (const nm of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements']) gl[nm] = function () {};
		const ext = gl.getExtension('WEBGL_multi_draw');
		if (ext) for (const nm of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) ext[nm] = function () {};
		for (let i = 0; i < 50; i++) frame();
		const per = [];
		for (let c = 0; c < chunks; c++) { const s = performance.now(); for (let i = 0; i < chunk; i++) frame(); per.push((performance.now() - s) / chunk); }
		per.sort((a, b) => a - b);
		return { median: per[per.length >> 1], best: per[0], p25: per[per.length >> 2] };
	}, [name, flag('chunks', 40), flag('chunk', 25)]);
	console.log(`${name.padEnd(22)} cpu ms/frame (draws stubbed): median ${r.median.toFixed(3)}  p25 ${r.p25.toFixed(3)}  best ${r.best.toFixed(3)}`);
	await page.close();
}
await browser.close(); server.close();
