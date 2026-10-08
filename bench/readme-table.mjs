// Prints the README benchmark table (markdown rows) from bench/results/latest.json so nobody hand-edits it.
//   node bench/readme-table.mjs [--file=bench/results/latest.json] [--no-header]
// Scenario descriptions are reused from the first column of the table already in README.md (matched by scenario name).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (n, d) => (process.argv.find(a => a.startsWith(`--${n}=`)) || `--${n}=${d}`).split('=').slice(1).join('=');
const data = JSON.parse(fs.readFileSync(path.resolve(arg('file', path.join(here, 'results/latest.json'))), 'utf8'));

const descriptions = new Map();
try {
	for (const line of fs.readFileSync(path.join(here, '..', 'README.md'), 'utf8').split('\n')) {
		const m = /^\| ([a-z0-9-]+)(:[^|]*)?\|/.exec(line);
		if (m) descriptions.set(m[1], line.slice(2, line.indexOf('|', 2)).trim());
	}
} catch (e) { /* no README: names only */ }

const ms = (v) => v === undefined || v === null ? 'n/a' : `${v < 100 ? v.toFixed(1) : Math.round(v)} ms`;
const ms2 = (v) => v === undefined || v === null ? 'n/a' : `${v.toFixed(v < 1 ? 2 : 1)} ms`;
const ratio = (a, b) => (typeof a !== 'number' || typeof b !== 'number') ? 'n/a' : (a < 0.1 && b < 0.1) ? 'n/a (both < 0.1 ms)' : `**${(a / b).toFixed(1)}x**`;
const num = (v) => Number(v).toLocaleString('en-US');

const gpuSource = data.gpuTimer || '';
const rows = [];
if (!process.argv.includes('--no-header')) {
	rows.push('| Scenario | Objects | three.js JS (median) | jrs JS (median) | JS speed-up | three.js GPU* | jrs GPU* | CPU-only (draws stubbed, three → jrs) | Worst frame (three → jrs) | Draw calls (three → jrs) | Pixel diff (mean / max, 0–255) |');
	rows.push('|---|---:|---:|---:|---:|---:|---:|---|---|---|---|');
}
for (const r of data.results) {
	const t = r.three, j = r.jrs;
	const gpuSlower = typeof t.gpuMs === 'number' && typeof j.gpuMs === 'number' && j.gpuMs > t.gpuMs * 1.05;
	rows.push(`| ${descriptions.get(r.scenario) || r.scenario} | ${num(r.n)} | ${ms(t.medianMs)} | ${ms(j.medianMs)} | ${ratio(t.medianMs, j.medianMs)} | ${ms(t.gpuMs)} | ${ms(j.gpuMs)}${gpuSlower ? ' ⚠' : ''} | ${r.three.cpuOnlyMs === undefined ? 'n/a' : `${ms2(t.cpuOnlyMs)} → ${ms2(j.cpuOnlyMs)}`} | ${Math.round(t.worstMs)} → ${Math.round(j.worstMs)} ms | ${t.drawCalls} → ${j.drawCalls} | ${r.compare ? `${r.compare.meanAbsDiff} / ${r.compare.maxDiff}` : 'n/a'} |`);
}
console.log(rows.join('\n'));
if (!process.argv.includes('--no-header')) {
	const proxy = /finish/.test(gpuSource);
	console.log(`\n*GPU: ${proxy ? 'median wall time of one frame followed by `gl.finish()` (EXT_disjoint_timer_query_webgl2 is exposed here but reads 0 ns, so this proxy is used; it contains the CPU work as well, so it is an upper bound on pure GPU time)' : 'median `EXT_disjoint_timer_query_webgl2` TIME_ELAPSED per frame'}. ⚠ = jrs slower than three.js on this column.`);
	console.log(`Settings: ${data.frames} frames after ${data.warmup ?? 10} warm-up frames${data.runs > 1 ? `, median of ${data.runs} alternating runs` : ''}, ${data.renderer}.`);
}
