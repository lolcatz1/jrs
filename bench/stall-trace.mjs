// What happens during the multi-hundred-ms "stall" frames? Records a Chrome trace (renderer + GPU process)
// around N frames of a scenario, finds the slowest frames (performance.mark per frame) and lists the longest
// trace events in any process that overlap them, plus the native GL call the main thread was blocked in.
//   node bench/stall-trace.mjs <scenario> [--lib=jrs] [--frames=120] [--out=bench/results/swarm/stall-trace-<scenario>-<lib>.json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const scenario = args.find((a) => !a.startsWith('--')) || 'shader-client';
const lib = flag('lib', 'jrs'); const FRAMES = Number(flag('frames', 120));
const outPath = flag('out', path.join(here, 'results', 'swarm', `stall-trace-${scenario}-${lib}.json`));

const candidates = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || candidates.find((p) => fs.existsSync(p)), args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl'] });
const { server, port } = await startServer();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
await page.waitForFunction(() => window.ready === true);
await page.evaluate(async ([lib, name]) => {
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
	for (let i = 0; i < 10; i++) doFrame();
	gl.finish();
	window.__st = { doFrame, gl };
}, [lib, scenario]);

const cdp = await page.context().newCDPSession(page);
// The browser-level tracing covers every process (renderer main thread, GPU process, compositor).
const client = await browser.newBrowserCDPSession();
await client.send('Tracing.start', {
	traceConfig: {
		recordMode: 'recordContinuously',
		includedCategories: ['toplevel', 'gpu', 'gpu.angle', 'disabled-by-default-gpu.service', 'disabled-by-default-gpu.cmd_decoder', 'cc', 'viz', 'v8.execute', 'v8', 'blink.user_timing', 'disabled-by-default-v8.gc', 'devtools.timeline'],
	},
	transferMode: 'ReturnAsStream',
});
const times = await page.evaluate((n) => {
	const { doFrame, gl } = window.__st; const out = [];
	for (let i = 0; i < n; i++) { performance.mark('frame' + i + ':start'); const s = performance.now(); doFrame(); out.push(performance.now() - s); performance.mark('frame' + i + ':end'); }
	gl.finish();
	return out;
}, FRAMES);
const done = new Promise((resolve) => client.once('Tracing.tracingComplete', resolve));
await client.send('Tracing.end');
const { stream } = await done;
let data = '';
for (;;) { const r = await client.send('IO.read', { handle: stream, size: 1 << 20 }); data += r.base64Encoded ? Buffer.from(r.data, 'base64').toString() : r.data; if (r.eof) break; }
await client.send('IO.close', { handle: stream });
const trace = JSON.parse(data);
const events = trace.traceEvents || trace;
// process / thread names
const procName = new Map(), threadName = new Map();
for (const e of events) { if (e.ph === 'M' && e.name === 'process_name') procName.set(e.pid, e.args.name); if (e.ph === 'M' && e.name === 'thread_name') threadName.set(e.pid + ':' + e.tid, e.args.name); }
// frame windows from user timing marks (blink.user_timing: ph 'R' or 'I' instant events named frameN:start/end)
const marks = new Map();
for (const e of events) { if (e.cat && e.cat.includes('blink.user_timing') && /^frame\d+:(start|end)$/.test(e.name)) marks.set(e.name, e.ts); }
const frames = [];
for (let i = 0; i < FRAMES; i++) { const s = marks.get(`frame${i}:start`), en = marks.get(`frame${i}:end`); if (s !== undefined && en !== undefined) frames.push({ i, start: s, end: en, ms: (en - s) / 1000 }); }
frames.sort((a, b) => b.ms - a.ms);
const sortedMs = times.slice().sort((a, b) => a - b);
console.log(`${scenario}/${lib}: median ${sortedMs[sortedMs.length >> 1].toFixed(2)} ms, worst ${sortedMs[sortedMs.length - 1].toFixed(1)} ms; trace events ${events.length}`);
const report = { scenario, lib, frames: FRAMES, medianMs: sortedMs[sortedMs.length >> 1], worst: [] };
const complete = events.filter((e) => e.ph === 'X' && e.dur > 0);
for (const f of frames.slice(0, 4)) {
	const overlapping = complete.filter((e) => e.ts < f.end && e.ts + e.dur > f.start);
	const byThread = new Map();
	for (const e of overlapping) { const k = `${procName.get(e.pid) || e.pid}/${threadName.get(e.pid + ':' + e.tid) || e.tid}`; byThread.set(k, (byThread.get(k) || 0) + Math.min(e.ts + e.dur, f.end) - Math.max(e.ts, f.start)); }
	const longest = overlapping.sort((a, b) => b.dur - a.dur).slice(0, 14).map((e) => ({ name: e.name, cat: e.cat, ms: +(e.dur / 1000).toFixed(1), where: `${procName.get(e.pid) || e.pid}/${threadName.get(e.pid + ':' + e.tid) || e.tid}`, args: e.args && JSON.stringify(e.args).slice(0, 160) }));
	const gcs = overlapping.filter((e) => /GC|MajorGC|MinorGC|Scavenge/i.test(e.name)).reduce((a, e) => a + e.dur, 0) / 1000;
	report.worst.push({ frame: f.i, ms: +f.ms.toFixed(1), busiestThreads: [...byThread.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, us]) => `${k} ${(us / 1000).toFixed(1)}ms`), gcMs: +gcs.toFixed(1), longest });
	console.log(`\nframe #${f.i}: ${f.ms.toFixed(1)} ms  (GC ${gcs.toFixed(1)} ms)`);
	console.log('  busiest threads: ' + report.worst[report.worst.length - 1].busiestThreads.join(' | '));
	for (const l of longest) console.log(`  ${String(l.ms).padStart(8)} ms  ${l.where.padEnd(40)} ${l.name} [${l.cat}] ${l.args || ''}`);
}
fs.writeFileSync(outPath, JSON.stringify(report, null, 1));
console.log(`\nwritten ${outPath}`);
await browser.close(); server.close();
