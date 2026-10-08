// Pixel parity of Lines / Points / Sprites feature cases, jrs vs three.js.
//   node bench/lps.mjs [case ...] [--save] [--mean=0.05] [--max=33]
// Fails (exit 1) when a case exceeds the mean / max tolerance. --save writes <case>-{jrs,three}.png to bench/results/lps/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? Number(a.split('=')[1]) : d; };
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const tolMean = arg('mean', 0.05), tolMax = arg('max', 33), save = process.argv.includes('--save');
const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'lps');
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text().slice(0, 600)); });
await page.goto(`http://127.0.0.1:${port}/bench/lps.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const names = only.length ? only : await page.evaluate(() => window.caseNames);
let failed = 0;
if (save) fs.mkdirSync(outDir, { recursive: true });
for (const name of names) {
	let r;
	try { r = await page.evaluate((n) => window.compareCase(n), name); } catch (e) { console.log(`ERROR ${name}: ${String(e.message).slice(0, 300)}`); failed++; continue; }
	const ok = r.mean <= tolMean && r.max <= tolMax && r.alphaMax <= tolMax;
	if (!ok) failed++;
	console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(28)} mean ${String(r.mean).padStart(7)}  max ${String(r.max).padStart(3)}  alphaMax ${String(r.alphaMax).padStart(3)}  differing ${String(r.differing).padStart(6)}  draws jrs ${r.callsJrs} three ${r.callsThree}`);
	if (save) { fs.writeFileSync(path.join(outDir, `${name}-jrs.png`), Buffer.from(r.jrs.split(',')[1], 'base64')); fs.writeFileSync(path.join(outDir, `${name}-three.png`), Buffer.from(r.three.split(',')[1], 'base64')); }
}
console.log(failed ? `${failed} case(s) out of tolerance` : 'all cases within tolerance');
await browser.close(); server.close();
process.exit(failed ? 1 : 0);
