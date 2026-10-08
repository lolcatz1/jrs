// Measures microseconds per frame spent in WebGLRenderList.finish (packed-key build + sort), jrs only.
// usage: node bench/sortcost.mjs [scenario ...] [--frames=300]
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const names = process.argv.slice(2).filter(a => !a.startsWith('--'));
const frames = Number((process.argv.find(a => a.startsWith('--frames=')) || '--frames=300').split('=')[1]);
const list = names.length ? names : ['shared-static', 'many-materials', 'transparent-sort'];
const { server, port } = await startServer();
const browser = await launchBrowser();
for (const name of list) {
	const page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
	await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
	const best = [];
	for (let k = 0; k < 3; k++) best.push((await page.evaluate(([n, f]) => window.sortCost(n, f), [name, frames])).finishUsPerFrame);
	console.log(`${name.padEnd(20)} finish() us/frame: ${best.join(' / ')}  (min ${Math.min(...best)})`);
	await page.close();
}
await browser.close(); server.close();
