// Frame-time series from the first frame after build, for both libraries, to see when each settles
// (V8 tiering, SwiftShader pipeline JIT in the GPU process, first-use uploads). Prints the median of
// consecutive windows of `--window` frames and the worst frame in each window.
//   node bench/warmup-series.mjs <scenario> [--frames=300] [--window=20] [--lib=both]
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const name = args.find((a) => !a.startsWith('--')) || 'shader-client';
const FRAMES = Number(flag('frames', 300)), WINDOW = Number(flag('window', 20));
const libs = flag('lib', 'both') === 'both' ? ['three', 'jrs'] : [flag('lib')];
const { server, port } = await startServer();
const browser = await launchBrowser();
for (const lib of libs) {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true);
	const r = await page.evaluate(async ([lib, name, frames]) => {
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
		const times = [];
		for (let f = 0; f < frames; f++) {
			const s = performance.now();
			if (update) update(f); if (frame) frame(renderer); else renderer.render(scene, camera);
			times.push(performance.now() - s);
		}
		gl.finish();
		renderer.dispose(); canvas.remove();
		return times;
	}, [lib, name, FRAMES]);
	await page.close();
	const rows = [];
	for (let i = 0; i < r.length; i += WINDOW) {
		const w = r.slice(i, i + WINDOW); const s = [...w].sort((a, b) => a - b);
		rows.push(`${String(i).padStart(4)}-${String(i + w.length - 1).padEnd(4)} median ${s[s.length >> 1].toFixed(2).padStart(7)}  worst ${s[s.length - 1].toFixed(1).padStart(7)}`);
	}
	console.log(`\n${name} / ${lib}: first frame ${r[0].toFixed(1)} ms, frames 1-9: ${r.slice(1, 10).map((v) => v.toFixed(1)).join(' ')}`);
	console.log(rows.join('\n'));
}
await browser.close(); server.close();
