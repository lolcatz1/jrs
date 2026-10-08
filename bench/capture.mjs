// Captures rendered frames + per-frame JS times for both libraries, for making comparison animations.
// usage: node bench/capture.mjs <outDir> [scenario ...] [--frames=120] [--size=480x360]
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { scenarios } from './scenarios.js';

const args = process.argv.slice(2);
const outDir = args.find(a => !a.startsWith('--'));
const names = args.filter(a => !a.startsWith('--')).slice(1);
const frames = Number((args.find(a => a.startsWith('--frames=')) || '--frames=120').split('=')[1]);
const [width, height] = (args.find(a => a.startsWith('--size=')) || '--size=480x360').split('=')[1].split('x').map(Number);
if (!outDir) { console.error('outDir required'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await startServer();
const browser = await launchBrowser();
const summary = {};
for (const name of names.length ? names : Object.keys(scenarios)) {
	for (const lib of ['three', 'jrs']) {
		const page = await browser.newPage();
		page.on('pageerror', (e) => console.log('[pageerror]', e.message));
		await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
		await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
		const r = await page.evaluate(([lib, name, frames, width, height]) => window.captureScenario(lib, name, { frames, width, height }), [lib, name, frames, width, height]);
		await page.close();
		const dir = path.join(outDir, `${name}-${lib}`);
		fs.mkdirSync(dir, { recursive: true });
		r.images.forEach((img, i) => fs.writeFileSync(path.join(dir, `${String(i).padStart(4, '0')}.png`), Buffer.from(img.split(',')[1], 'base64')));
		const sorted = [...r.times].sort((a, b) => a - b);
		summary[`${name}-${lib}`] = { times: r.times, medianMs: sorted[sorted.length >> 1], drawCalls: r.drawCalls, frames: r.images.length };
		console.log(`${name} ${lib}: ${r.images.length} frames, median ${sorted[sorted.length >> 1].toFixed(2)} ms, draw calls ${r.drawCalls}`);
	}
}
fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
