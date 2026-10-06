// Runs the device conformance page in headless Chromium and prints the report.
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text()); });
await page.goto(`http://127.0.0.1:${port}/bench/conformance.html`);
await page.waitForFunction(() => window.conformanceReport !== undefined, null, { timeout: 180000 });
const report = await page.evaluate(() => window.conformanceReport);
for (const t of report.tests) console.log(`${t.pass ? 'PASS' : 'FAIL'}  ${t.name}  —  ${t.detail}`);
console.log('gpu:', report.gpu, '| jrs:', JSON.stringify(report.jrs), '| three:', JSON.stringify(report.three));
await browser.close(); server.close();
process.exit(report.tests.every(t => t.pass) ? 0 : 1);
