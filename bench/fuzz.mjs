// Differential random-scene fuzzer: builds the same seeded random scene with three.js r186 and jrs,
// renders N frames with each in headless Chromium (SwiftShader) and compares pixels per frame.
//
//   node bench/fuzz.mjs                      20 seeds starting at 1
//   node bench/fuzz.mjs --seeds=50           50 seeds
//   node bench/fuzz.mjs --seed=1234          reproduce one seed (always saves its images)
//   node bench/fuzz.mjs --start=201 --seeds=100
//   node bench/fuzz.mjs --continue           keep going after a failure, report all of them
//   node bench/fuzz.mjs --enable=shaderFog,agx --disable=shadows
//   node bench/fuzz.mjs --only=standard,lights   (everything else off)
//   node bench/fuzz.mjs --selfcheck          render each library against ITSELF (determinism check)
//   node bench/fuzz.mjs --strict             no allowance for isolated edge pixels (default: 8 per frame)
//   node bench/fuzz.mjs --bad-pixels=N       allowance for pixels over maxDiff before a frame fails
//   node bench/fuzz.mjs --frames=10 --size=320x240 --list-features
//
// Tolerances are those of bench/results/latest.json: a frame fails when maxDiff > 33 or
// meanAbsDiff > 0.4 (see bench/pixel-compare.js). On the first failure the three.js image, the jrs
// image and a diff image are written to bench/results/fuzz/ and the process exits non-zero.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
import { FEATURES, DEFAULT_OFF, defaultFeatures } from './fuzz-scene.js';
import { TOLERANCE } from './pixel-compare.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, dflt) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a === undefined ? dflt : a.slice(name.length + 3); };

if (flag('help') || flag('h')) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
if (flag('list-features')) {
	for (const [k, v] of Object.entries(FEATURES)) console.log(`${k.padEnd(18)} ${DEFAULT_OFF.includes(k) ? '(off by default) ' : ''}${v}`);
	process.exit(0);
}

const outDir = path.resolve(opt('out', path.join(here, 'results', 'fuzz')));
const frames = Number(opt('frames', 6));
const [width, height] = opt('size', '320x240').split('x').map(Number);
const single = opt('seed', null);
const start = single !== null ? Number(single) : Number(opt('start', 1));
const count = single !== null ? 1 : Number(opt('seeds', 20));
const keepGoing = flag('continue');
const selfcheck = flag('selfcheck');
const quiet = flag('quiet');
const pagesEvery = Number(opt('fresh-page-every', 20));
const tolerance = { ...TOLERANCE, badPixels: flag('strict') ? 0 : Number(opt('bad-pixels', TOLERANCE.badPixels)) };

const features = defaultFeatures();
const only = opt('only', null);
if (only !== null) { for (const k of Object.keys(features)) features[k] = false; for (const k of only.split(',').filter(Boolean)) setFeature(k, true); }
for (const k of opt('enable', '').split(',').filter(Boolean)) setFeature(k, true);
for (const k of opt('disable', '').split(',').filter(Boolean)) setFeature(k, false);
function setFeature(k, v) { if (!(k in FEATURES)) { console.error(`unknown feature "${k}"; use --list-features`); process.exit(2); } features[k] = v; }
const offList = Object.keys(features).filter((k) => !features[k]);

fs.mkdirSync(outDir, { recursive: true });
const { server, port } = await startServer();
const browser = await launchBrowser();
let page = null, pageUses = 0;
async function getPage() {
	if (page && pageUses < pagesEvery) { pageUses++; return page; }
	if (page) await page.close();
	page = await browser.newPage();
	page.on('pageerror', (e) => console.log('[pageerror]', e.message));
	page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text()); });
	await page.goto(`http://127.0.0.1:${port}/bench/fuzz.html`);
	await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
	pageUses = 1;
	return page;
}
const savePng = (file, dataUrl) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

console.log(`fuzz: seeds ${start}..${start + count - 1}, ${frames} frames each, ${width}x${height}, tolerance meanAbsDiff>${tolerance.meanAbsDiff} or maxDiff>${tolerance.maxDiff} on more than ${tolerance.badPixels} pixels${offList.length ? `, features off: ${offList.join(', ')}` : ''}${selfcheck ? ' [SELF-CHECK: each library vs itself]' : ''}`);
const failures = [];
const summary = { date: new Date().toISOString(), start, count, frames, width, height, featuresOff: offList, seeds: [] };
const t0 = Date.now();
let worstMean = 0, worstMax = 0, worstMeanSeed = 0, worstMaxSeed = 0;
outer:
for (let i = 0; i < count; i++) {
	const seed = start + i;
	const runs = selfcheck ? [['three', 'three'], ['jrs', 'jrs']] : [['three', 'jrs']];
	for (const libs of runs) {
		const p = await getPage();
		const r = await p.evaluate(([seed, o]) => window.runFuzz(seed, o), [seed, { frames, width, height, features, libs, tolerance, images: single !== null, allFrames: single !== null }]);
		const label = selfcheck ? `${libs[0]} vs ${libs[0]}` : 'three vs jrs';
		const worst = r.frames.reduce((w, f) => (f.meanAbsDiff > w.meanAbsDiff || (f.meanAbsDiff === w.meanAbsDiff && f.pixelsOverMax > w.pixelsOverMax)) ? f : w, { maxDiff: -1, meanAbsDiff: -1, pixelsOverMax: -1, frame: -1 });
		if (worst.meanAbsDiff > worstMean) { worstMean = worst.meanAbsDiff; worstMeanSeed = seed; }
		if (worst.maxDiff > worstMax) { worstMax = worst.maxDiff; worstMaxSeed = seed; }
		const row = { seed, libs, firstBad: r.firstBad, failure: r.failure || null, worstFrame: worst.frame, worstMaxDiff: worst.maxDiff, worstMeanAbsDiff: worst.meanAbsDiff, drawCalls: r.drawCalls, notes: r.notes, errors: r.errors, glErrors: r.glErrors };
		summary.seeds.push(row);
		const ok = r.firstBad < 0;
		if (!quiet || !ok) {
			const stats = r.frames.length ? `worst frame ${worst.frame}: mean ${worst.meanAbsDiff.toFixed(3).padStart(6)} maxDiff ${String(worst.maxDiff).padStart(3)} on ${String(worst.pixelsOverMax).padStart(5)} px` : 'no frames';
			console.log(`${ok ? 'ok  ' : 'FAIL'} seed ${String(seed).padStart(6)} ${label.padEnd(14)} ${stats}  draws ${(r.drawCalls.three || r.drawCalls.jrs || [])[0]}->${(r.drawCalls.jrs || [])[0]}  ${r.notes.join('; ')}`);
		}
		if (Object.keys(r.glErrors).length) console.log(`      GL errors: ${JSON.stringify(r.glErrors)}`);
		if (!ok) {
			const base = path.join(outDir, `seed-${seed}${selfcheck ? '-' + libs[0] : ''}-frame-${r.firstBad}`);
			if (r.failure === 'exception') {
				for (const [lib, err] of Object.entries(r.errors)) console.log(`      ${lib} threw: ${err.split('\n').slice(0, 4).join('\n        ')}`);
				fs.writeFileSync(`${base}-error.txt`, JSON.stringify(r.errors, null, 2));
			} else {
				const f = r.frames[r.firstBad];
				console.log(`      frame ${r.firstBad}: maxDiff ${f.maxDiff} meanAbsDiff ${f.meanAbsDiff} pixelsOverMax ${f.pixelsOverMax} fractionOver32 ${f.fractionOver32} differingPixels ${f.differingPixels}` + (f.samples.length ? ' e.g. ' + f.samples.map((s) => `(${s.x},${s.y}) ${libs[0]} ${s.a} ${libs[1]} ${s.b}`).join('; ') : ''));
				savePng(`${base}-${libs[0]}.png`, r.images[libs[0]]); savePng(`${base}-${libs[1]}.png`, r.images[libs[1]]); savePng(`${base}-diff.png`, r.images.diff);
				console.log(`      images: ${path.relative(process.cwd(), base)}-{${libs[0]},${libs[1]},diff}.png`);
			}
			failures.push(row);
			if (!keepGoing) break outer;
		} else if (single !== null && r.images) {
			const base = path.join(outDir, `seed-${seed}-frame-${frames - 1}`);
			savePng(`${base}-${libs[0]}.png`, r.images[libs[0]]); savePng(`${base}-${libs[1]}.png`, r.images[libs[1]]); savePng(`${base}-diff.png`, r.images.diff);
			console.log(`      per frame: ${r.frames.map((f) => `#${f.frame} max ${f.maxDiff} mean ${f.meanAbsDiff}`).join(' | ')}`);
			console.log(`      images (last frame): ${path.relative(process.cwd(), base)}-{${libs[0]},${libs[1]},diff}.png`);
		}
	}
}
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
summary.failures = failures.map((f) => f.seed);
summary.elapsedSeconds = +elapsed;
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(summary, null, 1));
const ran = summary.seeds.length;
console.log(`\n${failures.length ? 'FAILED' : 'passed'}: ${ran} run(s) in ${elapsed}s, ${failures.length} failing; worst meanAbsDiff ${worstMean} (seed ${worstMeanSeed}), worst maxDiff ${worstMax} (seed ${worstMaxSeed}); report ${path.relative(process.cwd(), path.join(outDir, 'report.json'))}`);
if (failures.length) console.log(`failing seeds: ${failures.map((f) => f.seed).join(' ')}  (reproduce with --seed=N)`);
await browser.close();
server.close();
process.exit(failures.length ? 1 : 0);
