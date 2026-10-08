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

const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const frames = Number((process.argv.find(a => a.startsWith('--frames=')) || '--frames=60').split('=')[1]);
const compare = process.argv.includes('--compare');
const countGL = !process.argv.includes('--nocount');

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

const results = [];
const names = only.length ? only : Object.keys(scenarios);
for (const name of names) {
	const row = { scenario: name, n: scenarios[name].n };
	for (const lib of ['three', 'jrs']) {
		const page = await freshPage();
		const r = await page.evaluate(([lib, name, frames, countGL]) => window.runScenario(lib, name, { frames, countGL }), [lib, name, frames, countGL]);
		await page.close();
		row[lib] = r;
	}
	row.speedup = +(row.three.medianMs / row.jrs.medianMs).toFixed(2); // medians: single stalls (GC, driver) should not define the number
	row.wallSpeedup = +(row.three.wallAvgMs / row.jrs.wallAvgMs).toFixed(2);
	results.push(row);
	console.log(`${name.padEnd(20)} n=${String(row.n).padEnd(7)} three ${String(row.three.medianMs).padStart(8)} ms  jrs ${String(row.jrs.medianMs).padStart(8)} ms  => ${row.speedup}x  (medians; render-only ${row.three.renderMedianMs} -> ${row.jrs.renderMedianMs}; means ${row.three.avgMs} -> ${row.jrs.avgMs}, worst ${row.three.worstMs} -> ${row.jrs.worstMs}; draw calls ${row.three.drawCalls} -> ${row.jrs.drawCalls})`);
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
		for (const r of results) byName.set(r.scenario, r);
		merged = Object.keys(scenarios).filter((k) => byName.has(k)).map((k) => byName.get(k));
	} catch (e) { merged = results; }
}
fs.writeFileSync(latestPath, JSON.stringify({ date: new Date().toISOString(), frames, renderer: 'headless Chromium / SwiftShader (software WebGL2)', results: merged }, null, 2));
await browser.close();
server.close();
