// Build-phase cost of _drawList (run detection + command building + matrix fill), excluding command execution.
// usage: node bench/drawlist-build.mjs [scenario...]   (default: shared-animated hierarchy-animated many-materials)
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const names = process.argv.slice(2).filter((a) => !a.startsWith('-'));
if (names.length === 0) names.push('shared-animated', 'hierarchy-animated', 'many-materials');
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
await page.waitForFunction(() => window.ready === true);
for (const name of names) {
	const r = await page.evaluate(async (name) => {
		const { scenarios } = await import('/bench/scenarios.js');
		const JRS = await import('/src/index.js');
		const sc = scenarios[name];
		const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
		const renderer = new JRS.WebGLRenderer({ canvas });
		renderer.setSize(320, 240, false);
		const { scene, camera, update } = sc.build(JRS, sc.n);
		let build = 0, exec = 0;
		const dl = renderer._drawList.bind(renderer), ex = renderer._executeCommands.bind(renderer);
		renderer._executeCommands = (...a) => { const s = performance.now(); ex(...a); const d = performance.now() - s; exec += d; inner += d; };
		let inner = 0, upload = 0;
		const up = renderer.batcher.uploadTexture.bind(renderer.batcher);
		renderer.batcher.uploadTexture = (...a) => { const s = performance.now(); up(...a); const d = performance.now() - s; upload += d; inner += d; };
		renderer._drawList = (...a) => { inner = 0; const s = performance.now(); dl(...a); build += performance.now() - s - inner; };
		for (let f = 0; f < 20; f++) { if (update) update(f); renderer.render(scene, camera); }
		renderer.getContext().finish();
		build = 0; exec = 0; upload = 0;
		const N = 60, samples = [];
		for (let f = 0; f < N; f++) { const b0 = build; if (update) update(20 + f); renderer.render(scene, camera); samples.push(build - b0); }
		samples.sort((a, b) => a - b);
		return { buildMedian: +samples[N >> 1].toFixed(3), buildMean: +(build / N).toFixed(3), uploadMean: +(upload / N).toFixed(3) };
	}, name);
	console.log(name.padEnd(22), JSON.stringify(r));
}
await browser.close(); server.close();
