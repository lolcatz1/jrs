// Headless benchmark runner: jrs vs three.js on identical scenes, software WebGL (SwiftShader).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { scenarios } from './scenarios.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'results');
fs.mkdirSync(outDir, { recursive: true });

const args = process.argv.slice(2);
const only = args.filter(a => !a.startsWith('--'));
const flag = (n, d) => Number((args.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=')[1]);
const frames = flag('frames', 60);
const warmup = flag('warmup', 40); // 10 was too few (scout report section 5): V8 tiering and driver warm-up take longer
const runs = Math.max(1, flag('runs', 1)); // K alternating three/jrs runs; reported numbers are the median of K, best of K kept alongside
const compare = args.includes('--compare');
const countGL = !args.includes('--nocount');
const gpu = !args.includes('--nogpu');
const cpuStubbed = args.includes('--cpu-stubbed');

const { server, port } = await startServer();
const browser = await launchBrowser();

async function freshPage() {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	page.on('console', (m) => { if (m.type() === 'error') console.log('[browser]', m.text()); });
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
	return page;
}

const METRICS = ['medianMs', 'renderMedianMs', 'avgMs', 'worstMs', 'gpuMs', 'finishMs', 'finishWaitMs', 'cpuOnlyMs'];
const med = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const round = (v) => +v.toFixed(3);
/** Collapses K runs of one library into one record: the run closest to the median JS time supplies the non-timing fields (GL call counts etc.); timings become median-of-K with best-of-K and the raw list kept. */
function aggregate(list) {
	if (list.length === 1) return list[0];
	const m = med(list.map(r => r.medianMs));
	const rep = list.reduce((x, y) => Math.abs(y.medianMs - m) < Math.abs(x.medianMs - m) ? y : x);
	const out = { ...rep, runs: list.length, perRun: {} };
	for (const k of METRICS) {
		const v = list.map(r => r[k]).filter(x => typeof x === 'number');
		if (!v.length) continue;
		out.perRun[k] = v;
		out[k] = round(k === 'worstMs' ? Math.max(...v) : med(v));
		out[k + 'Best'] = round(Math.min(...v));
	}
	return out;
}

const results = [];
const names = only.length ? only : Object.keys(scenarios);
for (const name of names) {
	const row = { scenario: name, n: scenarios[name].n };
	const collected = { three: [], jrs: [] };
	for (let k = 0; k < runs; k++) {
		for (const lib of (k % 2 ? ['jrs', 'three'] : ['three', 'jrs'])) { // alternate order too so neither library always runs second
			const page = await freshPage();
			collected[lib].push(await page.evaluate(([lib, name, o]) => window.runScenario(lib, name, o), [lib, name, { frames, warmup, countGL: countGL && k === 0, gpu, cpuStubbed }]));
			await page.close();
		}
	}
	for (const lib of ['three', 'jrs']) { if (runs > 1) for (const r of collected[lib]) r.glCalls = r.glCalls || collected[lib][0].glCalls; row[lib] = aggregate(collected[lib]); }
	row.speedup = +(row.three.medianMs / row.jrs.medianMs).toFixed(2); // medians: single stalls (GC, driver) should not define the number
	row.wallSpeedup = +(row.three.wallAvgMs / row.jrs.wallAvgMs).toFixed(2);
	if (runs > 1) row.speedupBest = +(row.three.medianMsBest / row.jrs.medianMsBest).toFixed(2);
	if (typeof row.three.gpuMs === 'number' && typeof row.jrs.gpuMs === 'number') row.gpuSpeedup = +(row.three.gpuMs / row.jrs.gpuMs).toFixed(2);
	if (typeof row.three.cpuOnlyMs === 'number' && typeof row.jrs.cpuOnlyMs === 'number') row.cpuOnlySpeedup = +(row.three.cpuOnlyMs / row.jrs.cpuOnlyMs).toFixed(2);
	results.push(row);
	console.log(`${name.padEnd(20)} n=${String(row.n).padEnd(7)} three ${String(row.three.medianMs).padStart(8)} ms  jrs ${String(row.jrs.medianMs).padStart(8)} ms  => ${row.speedup}x  (medians; render-only ${row.three.renderMedianMs} -> ${row.jrs.renderMedianMs}; means ${row.three.avgMs} -> ${row.jrs.avgMs}, worst ${row.three.worstMs} -> ${row.jrs.worstMs}; draw calls ${row.three.drawCalls} -> ${row.jrs.drawCalls})`);
	if (runs > 1) console.log(`${''.padEnd(20)} runs=${runs} (alternating): JS median-of-${runs} three ${row.three.medianMs} jrs ${row.jrs.medianMs} (${row.speedup}x) | best-of-${runs} three ${row.three.medianMsBest} jrs ${row.jrs.medianMsBest} (${row.speedupBest}x) | per-run three [${row.three.perRun.medianMs}] jrs [${row.jrs.perRun.medianMs}]`);
	if (gpu) console.log(`${''.padEnd(20)} GPU ms/frame [${row.three.gpuSource === row.jrs.gpuSource ? row.jrs.gpuSource : row.three.gpuSource + ' / ' + row.jrs.gpuSource}]: three ${row.three.gpuMs} jrs ${row.jrs.gpuMs}${row.gpuSpeedup ? ` => ${row.gpuSpeedup}x` : ''}${row.gpuSpeedup && row.gpuSpeedup < 0.95 ? '  ** jrs SLOWER on GPU **' : ''} | gl.finish() frame wall: three ${row.three.finishMs} jrs ${row.jrs.finishMs}, wait inside finish: three ${row.three.finishWaitMs} jrs ${row.jrs.finishWaitMs}${row.three.gpuDisjoint || row.jrs.gpuDisjoint ? ` | disjoint frames dropped: ${row.three.gpuDisjoint}/${row.jrs.gpuDisjoint}` : ''}`);
	if (cpuStubbed) console.log(`${''.padEnd(20)} CPU-only ms/frame (draws stubbed): three ${row.three.cpuOnlyMs} jrs ${row.jrs.cpuOnlyMs}${row.cpuOnlySpeedup ? ` => ${row.cpuOnlySpeedup}x` : ''}`);
	const fmtCalls = (c) => c ? `total ${c.total} | uniform* ${c.uniform} | bindTexture ${c.bindTexture} | useProgram ${c.useProgram} | bindVertexArray ${c.bindVertexArray} | draw ${c.draw} | bindBuffer ${c.bindBuffer} | bufferData ${c.bufferData} | state ${c.state}` : 'n/a';
	console.log(`${''.padEnd(20)} GL calls/frame three: ${fmtCalls(row.three.glCalls)}${row.three.glError ? ` GL ERROR 0x${row.three.glError.toString(16)}` : ''}`);
	console.log(`${''.padEnd(20)} GL calls/frame jrs:   ${fmtCalls(row.jrs.glCalls)}${row.jrs.glError ? ` GL ERROR 0x${row.jrs.glError.toString(16)}` : ''}`);
	if (row.three.passes) {
		for (const lib of ['three', 'jrs']) for (const p of row[lib].passes) console.log(`${''.padEnd(20)}   ${lib.padEnd(5)} ${p.name.padEnd(34)} uniform* ${String(p.uniform).padStart(4)}  useProgram ${String(p.useProgram).padStart(3)}  draws ${String(p.draw).padStart(4)}  bindTexture ${String(p.bindTexture).padStart(3)}  bindVAO ${String(p.bindVertexArray).padStart(4)}`);
		if (row.jrs.uniformTrace) for (const t of row.jrs.uniformTrace) { const names = Object.entries(t.uniforms).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '); console.log(`${''.padEnd(20)}   jrs uploads on ${t.target.padEnd(12)} (${t.draws} draws, ${t.useProgram} program switches): ${names || 'none'}`); }
	}
}

if (compare) {
	const page = await freshPage();
	for (const name of names) {
		const c = await page.evaluate((name) => window.compareScenario(name), name);
		fs.writeFileSync(path.join(outDir, `${name}-jrs.png`), Buffer.from(c.jrs.split(',')[1], 'base64'));
		fs.writeFileSync(path.join(outDir, `${name}-three.png`), Buffer.from(c.three.split(',')[1], 'base64'));
		console.log(`compare ${name.padEnd(20)} meanAbsDiff=${c.meanAbsDiff} maxDiff=${c.maxDiff} fractionOver32=${c.fractionOver32} differingPixels=${c.differingPixels}${c.samples && c.samples.length ? ' e.g. ' + c.samples.map(s => `(${s.x},${s.y}) jrs ${s.jrs} three ${s.three}`).join('; ') : ''}`);
		const row = results.find(r => r.scenario === name); if (row) row.compare = { meanAbsDiff: c.meanAbsDiff, maxDiff: c.maxDiff, fractionOver32: c.fractionOver32 };
	}
	await page.close();
}

// merge into the existing results file so a partial run updates only the scenarios it ran
let merged = results;
const latestPath = path.join(outDir, 'latest.json');
if (fs.existsSync(latestPath)) {
	try {
		const previous = JSON.parse(fs.readFileSync(latestPath, 'utf8')).results || [];
		const byName = new Map(previous.map((r) => [r.scenario, r]));
		for (const r of results) { const old = byName.get(r.scenario); if (!r.compare && old && old.compare) r.compare = old.compare; byName.set(r.scenario, r); }
		merged = Object.keys(scenarios).filter((k) => byName.has(k)).map((k) => byName.get(k));
	} catch (e) { merged = results; }
}
fs.writeFileSync(latestPath, JSON.stringify({ date: new Date().toISOString(), frames, warmup, runs, gpuTimer: gpu ? (results[0] && results[0].jrs.gpuSource) : 'off', cpuStubbed, renderer: 'headless Chromium / SwiftShader (software WebGL2)', results: merged }, null, 2));
await browser.close();
server.close();
