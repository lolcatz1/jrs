// Differential test: scripted dynamic-geometry operations (needsUpdate, updateRanges, drawRange, growth,
// dispose, onUpload, interleaved buffers, hidden meshes, toggling the multi-draw path) rendered with jrs and
// three.js must give identical pixels and identical observable attribute state after every step.
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/bench/geometry-updates.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(() => window.runGeometryUpdates());
let failed = 0;
for (const s of r.steps) {
	const ok = s.maxDiff === 0 && s.apiSame && s.painted > 0;
	if (!ok) failed++;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${s.name.padEnd(40)} maxDiff=${s.maxDiff} differing=${s.differing} api ${s.apiSame ? 'same' : 'DIFFERENT'}${s.apiSame ? '' : `\n       jrs   ${JSON.stringify(s.jrsApi)}\n       three ${JSON.stringify(s.threeApi)}`}`);
}
console.log(`GL errors at end: jrs ${r.jrsErrors} three ${r.threeErrors}`);
if (r.jrsErrors !== 0) failed++;
await browser.close(); server.close();
console.log(failed === 0 ? 'geometry-updates: all steps identical' : `geometry-updates: ${failed} step(s) differ`);
process.exit(failed === 0 ? 0 : 1);
