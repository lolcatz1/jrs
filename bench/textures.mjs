// Texture compatibility sweep: renders every case with jrs and three.js r186 in headless Chromium and compares pixels, GL errors,
// warnings and (where relevant) GL call sequences. Usage: node bench/textures.mjs [--only=substring] [--json=path] [--quiet]
import fs from 'node:fs';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([^=]+)(?:=(.*))?$/); return m ? [m[1], m[2] === undefined ? true : m[2]] : [a, true]; }));
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text()) && args.verbose) console.log('[browser]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/bench/textures.html?${args.only ? 'only=' + encodeURIComponent(args.only) + '&' : ''}${args.group ? 'group=' + encodeURIComponent(args.group) + '&' : ''}${args.dump ? 'dump=' + encodeURIComponent(args.dump) : ''}`);
await page.waitForFunction(() => window.texturesReport !== undefined, null, { timeout: 600000 });
const report = await page.evaluate(() => window.texturesReport);
if (report.error) { console.log('textures page error:', report.error); await browser.close(); server.close(); process.exit(1); }
const count = { pass: 0, fail: 0, skip: 0 };
if (args.dump) {
	const dir = typeof args['dump-dir'] === 'string' ? args['dump-dir'] : '.';
	for (const c of report.cases) if (c.images) for (const [k, url] of Object.entries(c.images)) {
		const f = `${dir}/${c.name.replace(/[^a-z0-9]+/gi, '_').slice(0, 60)}-${k}.png`;
		fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', f);
	}
}
for (const c of report.cases) {
	count[c.status]++;
	if (args.quiet && c.status === 'pass') continue;
	console.log(`${c.status.toUpperCase().padEnd(4)}  [${c.group}] ${c.name}  —  ${c.detail}`);
}
console.log(`\ngpu: ${report.gpu}\n${count.pass} passed, ${count.fail} failed, ${count.skip} skipped (of ${report.cases.length})`);
if (args.json) fs.writeFileSync(args.json, JSON.stringify(report.cases, null, 1));
await browser.close(); server.close();
process.exit(count.fail === 0 ? 0 : 1);
