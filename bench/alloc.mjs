// Heap allocation per rendered frame, jrs vs three.js, via the CDP sampling heap profiler.
//   node bench/alloc.mjs [scenario ...] [--frames=100] [--warmup=20] [--top=8] [--lib=jrs|three] [--json=path]
// Bytes/frame = sum of sampled allocation sizes (including objects already collected by minor/major GC)
// over the measured frames. GC count = V8 scavenge + mark-compact events recorded by the tracing
// category `v8.gc` during the same frames, reported per 100 frames. Each run uses a fresh page and
// a fresh renderer; the scene is built and warmed up before sampling starts.
import fs from 'node:fs';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { scenarios } from './scenarios.js';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const frames = Number(arg('frames', 100));
const warmup = Number(arg('warmup', 20));
const top = Number(arg('top', 8));
const libs = arg('lib', 'three,jrs').split(',');
const jsonOut = arg('json', '');
const names = only.length ? only : Object.keys(scenarios);

const { server, port } = await startServer();
const browser = await launchBrowser();

async function measure(lib, name) {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
	// set the scene up and warm it, leaving a `window.__frame(f)` to run measured frames
	await page.evaluate(async ([lib, name, warmup]) => {
		const { scenarios } = await import('/bench/scenarios.js');
		const T = lib === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
		const sc = scenarios[name];
		const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; document.body.appendChild(canvas);
		const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: name.startsWith('shader-client'), powerPreference: 'high-performance' });
		renderer.setSize(320, 240, false);
		if (name.startsWith('shadows')) renderer.shadowMap.enabled = true;
		const { scene, camera, update, warm, frame } = sc.build(T, sc.n);
		if (warm) warm(renderer);
		let f = 0;
		window.__frame = () => { if (update) update(f); f++; if (frame) frame(renderer); else renderer.render(scene, camera); };
		for (let i = 0; i < warmup; i++) window.__frame();
		renderer.getContext().finish();
	}, [lib, name, warmup]);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('HeapProfiler.enable');
	await cdp.send('HeapProfiler.collectGarbage');
	await browser.startTracing(page, { categories: ['v8.gc', 'v8'] }).catch(() => {});
	await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
	const times = await page.evaluate((frames) => {
		const t = [];
		for (let i = 0; i < frames; i++) { const s = performance.now(); window.__frame(); t.push(performance.now() - s); }
		return t;
	}, frames);
	const { profile } = await cdp.send('HeapProfiler.stopSampling');
	let gcMinor = 0, gcMajor = 0, gcPauseMs = 0;
	try {
		const trace = JSON.parse((await browser.stopTracing()).toString());
		for (const e of trace.traceEvents || trace) {
			if (e.ph !== 'X' && e.ph !== 'X') continue;
			if (e.name === 'V8.GC_SCAVENGER' || e.name === 'MinorGC' || e.name === 'V8.GCScavenger') { gcMinor++; gcPauseMs += (e.dur || 0) / 1000; }
			else if (e.name === 'MajorGC' || e.name === 'V8.GCCompactor' || e.name === 'V8.GC_MARK_COMPACTOR') { gcMajor++; gcPauseMs += (e.dur || 0) / 1000; }
		}
	} catch (e) { /* tracing unavailable */ }
	// total sampled bytes and per-source breakdown (self size by function + location)
	let total = 0; const by = new Map();
	(function walk(n, parent) {
		const cf = n.callFrame, name = `${cf.functionName || '(anon)'} ${cf.url.replace(/^.*\/(src|node_modules)\//, '$1/')}:${cf.lineNumber + 1}`;
		const key = process.argv.includes('--callers') && parent ? `${name}  <- ${parent}` : name;
		if (n.selfSize) { total += n.selfSize; by.set(key, (by.get(key) || 0) + n.selfSize); }
		for (const c of n.children) walk(c, (cf.functionName || '(anon)') + ':' + (cf.lineNumber + 1));
	})(profile.head, null);
	const sorted = [...times].sort((a, b) => a - b);
	await page.close();
	return {
		lib, scenario: name, frames, bytesPerFrame: Math.round(total / frames),
		gcMinorPer100: +(gcMinor * 100 / frames).toFixed(1), gcMajorPer100: +(gcMajor * 100 / frames).toFixed(1), gcPauseMsPer100: +(gcPauseMs * 100 / frames).toFixed(2),
		medianMs: +sorted[sorted.length >> 1].toFixed(3), worstMs: +sorted[sorted.length - 1].toFixed(3),
		top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => ({ site: k, bytesPerFrame: Math.round(v / frames) })),
	};
}

const out = [];
for (const name of names) for (const lib of libs) {
	const r = await measure(lib, name);
	out.push(r);
	console.log(`${name.padEnd(20)} ${lib.padEnd(5)} ${String(r.bytesPerFrame).padStart(9)} B/frame  GC/100f minor ${r.gcMinorPer100} major ${r.gcMajorPer100} (${r.gcPauseMsPer100} ms)  median ${r.medianMs} ms  worst ${r.worstMs} ms`);
	if (process.argv.includes('--sites') || lib === 'jrs' && process.argv.includes('--jrs-sites')) for (const t of r.top) console.log(`      ${String(t.bytesPerFrame).padStart(8)}  ${t.site}`);
}
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(out, null, 1));
await browser.close(); server.close();
