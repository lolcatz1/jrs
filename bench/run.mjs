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
		const r = await page.evaluate(([lib, name, frames]) => window.runScenario(lib, name, { frames }), [lib, name, frames]);
		await page.close();
		row[lib] = r;
	}
	row.speedup = +(row.three.avgMs / row.jrs.avgMs).toFixed(2);
	row.wallSpeedup = +(row.three.wallAvgMs / row.jrs.wallAvgMs).toFixed(2);
	results.push(row);
	console.log(`${name.padEnd(20)} n=${String(row.n).padEnd(7)} three ${String(row.three.avgMs).padStart(8)} ms  jrs ${String(row.jrs.avgMs).padStart(8)} ms  => ${row.speedup}x   (draw calls ${row.three.drawCalls} -> ${row.jrs.drawCalls}; wall ${row.three.wallAvgMs} -> ${row.jrs.wallAvgMs} ms, ${row.wallSpeedup}x)`);
	const fmtCalls = (c) => c ? `total ${c.total} | uniform* ${c.uniform} | bindTexture ${c.bindTexture} | useProgram ${c.useProgram} | bindVertexArray ${c.bindVertexArray} | draw ${c.draw} | bindBuffer ${c.bindBuffer} | bufferData ${c.bufferData} | state ${c.state}` : 'n/a';
	console.log(`${''.padEnd(20)} GL calls/frame three: ${fmtCalls(row.three.glCalls)}${row.three.glError ? ` GL ERROR 0x${row.three.glError.toString(16)}` : ''}`);
	console.log(`${''.padEnd(20)} GL calls/frame jrs:   ${fmtCalls(row.jrs.glCalls)}${row.jrs.glError ? ` GL ERROR 0x${row.jrs.glError.toString(16)}` : ''}`);
}

if (compare) {
	const page = await freshPage();
	for (const name of names) {
		const c = await page.evaluate((name) => window.compareScenario(name), name);
		fs.writeFileSync(path.join(outDir, `${name}-jrs.png`), Buffer.from(c.jrs.split(',')[1], 'base64'));
		fs.writeFileSync(path.join(outDir, `${name}-three.png`), Buffer.from(c.three.split(',')[1], 'base64'));
		console.log(`compare ${name.padEnd(20)} meanAbsDiff=${c.meanAbsDiff} maxDiff=${c.maxDiff} fractionOver32=${c.fractionOver32}`);
		const row = results.find(r => r.scenario === name); if (row) row.compare = { meanAbsDiff: c.meanAbsDiff, maxDiff: c.maxDiff, fractionOver32: c.fractionOver32 };
	}
	await page.close();
}

fs.writeFileSync(path.join(outDir, 'latest.json'), JSON.stringify({ date: new Date().toISOString(), frames, renderer: 'headless Chromium / SwiftShader (software WebGL2)', results }, null, 2));
await browser.close();
server.close();
