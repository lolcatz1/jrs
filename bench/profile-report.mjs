// Renders the JSON summaries written by bench/profile-cpu.mjs as markdown tables (stdout).
//   node bench/profile-report.mjs [--dir=bench/results/swarm/profiles] [--top=12]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenarios } from './scenarios.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=')[1] : d; };
const dir = path.resolve(flag('dir', path.join(here, 'results', 'swarm', 'profiles')));
const TOP = Number(flag('top', 12));
const load = (s, l) => { const p = path.join(dir, `${s}-${l}.json`); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
const f = (v, d = 2) => v === undefined || v === null ? '–' : (+v).toFixed(d);

// 1. overview table
console.log('| scenario | lib | plain median ms | p90 | +gl.finish/frame | draws stubbed (pure CPU) | profiled steady ms | of which native GL | stall frames (ms total) | alloc bytes/frame |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const s of Object.keys(scenarios)) for (const l of ['three', 'jrs']) {
	const r = load(s, l); if (!r) continue;
	const t = r.timing;
	console.log(`| ${s} | ${l} | ${f(t.plain.median, 1)} | ${f(t.plain.p90, 1)} | ${f(t.finishPerFrame.median, 1)} | ${f(t.drawsStubbed.median, 1)} | ${f(r.cpu.sampledMsPerFrame)} | ${f(r.cpu.glNativeMsPerFrame)} | ${r.cpu.stallFrames} (${r.cpu.stallMsTotal}) | ${r.heap ? r.heap.bytesPerFrame.toLocaleString('en-US') : '–'} |`);
}

// 2. per scenario: phases side by side + top self functions
for (const s of Object.keys(scenarios)) {
	const J = load(s, 'jrs'), T = load(s, 'three');
	if (!J) continue;
	console.log(`\n### ${s}\n`);
	const phases = [...new Set([...(J.cpu.phases.map((p) => p.phase)), ...(T ? T.cpu.phases.map((p) => p.phase) : [])])];
	console.log('| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |');
	console.log('|---|---:|---:|---:|---:|---:|---:|');
	for (const ph of phases) {
		const a = J.cpu.phases.find((p) => p.phase === ph), b = T ? T.cpu.phases.find((p) => p.phase === ph) : null;
		if ((a ? a.msPerFrame : 0) < 0.01 && (b ? b.msPerFrame : 0) < 0.01) continue;
		console.log(`| ${ph} | ${a ? f(a.msPerFrame, 3) : '–'} | ${a ? a.pct : '–'} | ${a ? f(a.glMsPerFrame, 3) : '–'} | ${b ? f(b.msPerFrame, 3) : '–'} | ${b ? b.pct : '–'} | ${b ? f(b.glMsPerFrame, 3) : '–'} |`);
	}
	console.log(`| **total (steady, profiled)** | **${f(J.cpu.sampledMsPerFrame)}** | | **${f(J.cpu.glNativeMsPerFrame)}** | **${T ? f(T.cpu.sampledMsPerFrame) : '–'}** | | **${T ? f(T.cpu.glNativeMsPerFrame) : '–'}** |`);
	console.log(`\njrs top self time (ms/frame, % of steady frame):\n`);
	for (const x of J.cpu.topSelf.slice(0, TOP)) console.log(`- ${f(x.msPerFrame, 3)} ms (${x.pct}%) \`${x.key}\``);
	if (T) { console.log(`\nthree top self time:\n`); for (const x of T.cpu.topSelf.slice(0, Math.min(TOP, 8))) console.log(`- ${f(x.msPerFrame, 3)} ms (${x.pct}%) \`${x.key}\``); }
	if (J.heap) { console.log(`\njrs allocations ${J.heap.bytesPerFrame.toLocaleString('en-US')} bytes/frame:`); for (const x of J.heap.top.slice(0, 4)) if (x.bytesPerFrame > 200) console.log(`- ${x.bytesPerFrame.toLocaleString('en-US')} B \`${x.key}\``); }
	if (J.cpu.stalls.length) { console.log(`\njrs stall frames during the profiled run (excluded from the table):`); for (const x of J.cpu.stalls.slice(0, 4)) console.log(`- frame ${x.frame}: ${x.ms} ms — ${x.top.join(' | ')}`); }
	console.log(`\njrs worst frames (unprofiled run): ${J.worstFrames.map((w) => `#${w.frame} ${w.ms} ms`).join(', ')}; GC frames ${J.gcFrames}/${J.frames}`);
}
