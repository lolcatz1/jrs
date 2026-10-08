// Per-object isolation of a fuzz seed: renders each mesh ALONE (lights kept) with both libraries and reports
// the diff per object, so an interaction bug (all objects differ, none alone) is told apart from a per-object one.
//   node bench/fuzz-isolate.mjs <seed> [--frame=N] [--only=features] [--nobatch] [--noshadow] [--singlepass]
//   --loo        leave-one-out: hide each object in turn (which object's removal makes the difference vanish)
//   --jrs=prop=value,...   set jrs renderer properties, e.g. --jrs=autoBatchMaterials=false,reuseRenderLists=false,debug.verifyListReuse=true
//   --pair=a,b   render only objects a and b, then b nudged in depth, then both forced draw orders; writes
//                bench/results/fuzz/pair-{three,jrs}.png
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const args = process.argv.slice(2);
const seed = Number(args[0]);
const opt = (n, d) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : d; };
const frame = Number(opt('frame', 0)), only = opt('only', ''), nobatch = args.includes('--nobatch'), noshadow = args.includes('--noshadow');
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text().slice(0, 400)); });
await page.goto(`http://127.0.0.1:${port}/bench/fuzz.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const loo = args.includes('--loo');
const pair = opt('pair', '');
page.on('console', (m) => { if (m.type() === 'log') console.log('[page]', m.text()); });
const singlepass = args.includes('--singlepass');
const jrsProps = opt('jrs', '');
const r = await page.evaluate(async ([seed, frame, only, nobatch, noshadow, loo, pair, singlepass, jrsProps]) => {
	const { buildFuzzScene, defaultFeatures } = await import('/bench/fuzz-scene.js');
	const { comparePixels } = await import('/bench/pixel-compare.js');
	const features = defaultFeatures();
	if (only) { for (const k in features) features[k] = false; for (const k of only.split(',')) features[k] = true; }
	const libs = { three: await import('/node_modules/three/build/three.module.js'), jrs: await import('/src/index.js') };
	const setups = {};
	for (const lib of ['three', 'jrs']) {
		const T = libs[lib];
		const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
		const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, stencil: true });
		renderer.setSize(320, 240, false);
		const built = buildFuzzScene(T, seed, features, { width: 320, height: 240, frames: 6 });
		built.setup(renderer);
		if (nobatch && lib === 'jrs') { renderer.autoBatch = false; renderer.autoMultiDraw = false; }
		if (jrsProps && lib === 'jrs') for (const kv of jrsProps.split(',')) { const [k, v] = kv.split('='); const path = k.split('.'); let o = renderer; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v; }
		if (noshadow) renderer.shadowMap.enabled = false;
		const meshes = []; built.scene.traverse((o) => { if (o.isMesh) { meshes.push(o); if (singlepass) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.forceSinglePass = true; }); } });
		setups[lib] = { renderer, built, meshes, gl: renderer.getContext(), T };
		for (let f = 0; f < frame; f++) built.frame(renderer, f); // advance animation to the frame of interest
	}
	const render = (lib) => { const s = setups[lib]; s.built.frame(s.renderer, frame); const px = new Uint8Array(320 * 240 * 4); s.gl.readPixels(0, 0, 320, 240, s.gl.RGBA, s.gl.UNSIGNED_BYTE, px); return px; };
	const describe = (m) => {
		const mats = Array.isArray(m.material) ? m.material : [m.material];
		return mats.map((mt) => `${mt.type}${mt.userData.template ? '/' + mt.userData.template : ''}${mt.map ? ' map' + (mt.map.colorSpace === 'srgb' ? '(sRGB)' : '') + (mt.map.isRenderTargetTexture ? '(RT)' : '') : ''}${mt.alphaMap ? ' alphaMap' : ''}${mt.emissiveMap ? ' emissiveMap' : ''}${mt.specularMap ? ' specularMap' : ''}${mt.vertexColors ? ' vcol' : ''}${mt.transparent ? ' transp b' + mt.blending + (mt.premultipliedAlpha ? 'p' : '') + ' o' + mt.opacity.toFixed(2) : (mt.blending !== 1 ? ' blend' + mt.blending : '')}${mt.side !== 0 ? ' side' + mt.side : ''}${mt.flatShading ? ' flat' : ''}${mt.wireframe ? ' wire' : ''}${mt.alphaTest ? ' atest' : ''}${mt.stencilWrite ? ' stencil' : ''}${mt.depthTest === false ? ' nodt' : ''}${mt.depthWrite === false ? ' nodw' : ''}${mt.fog === false ? ' nofog' : ''}${mt.emissive && (mt.emissive.r || mt.emissive.g || mt.emissive.b) ? ' emis' : ''}`).join(' | ')
			+ ` geo=${m.geometry.type}${m.geometry.index ? '' : '(nonidx)'}${m.geometry.attributes.color ? ' col' + m.geometry.attributes.color.itemSize : ''}${m.geometry.groups.length > 1 ? ' groups' + m.geometry.groups.length : ''}${m.geometry.drawRange.count !== Infinity ? ' range' : ''}${m.isInstancedMesh ? ' INSTANCED' + m.count + (m.instanceColor ? 'c' : '') : ''}${m.castShadow ? ' cast' : ''}${m.receiveShadow ? ' recv' : ''} ro=${m.renderOrder}`;
	};
	const results = [];
	if (pair) {
		const [a, b] = pair.split(',').map(Number);
		for (const lib of ['three', 'jrs']) setups[lib].meshes.forEach((m, i) => { m.visible = i === a || i === b; });
		const c0 = comparePixels(render('three'), render('jrs'), 320, 240);
		results.push({ k: -2, desc: `pair ${a},${b}`, ...c0 });
		window.__pairImages = { three: setups.three.renderer.domElement.toDataURL('image/png'), jrs: setups.jrs.renderer.domElement.toDataURL('image/png') };
		for (const dz of [0.05, -0.05]) {
			for (const lib of ['three', 'jrs']) { const m = setups[lib].meshes[b]; m.position.z += dz; m.updateMatrixWorld(true); }
			const c = comparePixels(render('three'), render('jrs'), 320, 240);
			results.push({ k: -2, desc: `pair ${a},${b} with ${b} moved dz=${dz}`, ...c });
			for (const lib of ['three', 'jrs']) { const m = setups[lib].meshes[b]; m.position.z -= dz; }
		}
		for (const [ra, rb] of [[1, 2], [2, 1]]) {
			for (const lib of ['three', 'jrs']) { setups[lib].meshes[a].renderOrder = ra; setups[lib].meshes[b].renderOrder = rb; }
			const pxT = render('three'), pxJ = render('jrs');
			const c = comparePixels(pxT, pxJ, 320, 240);
			results.push({ k: -2, desc: `pair ${a},${b} renderOrder ${ra},${rb}`, ...c });
			// also compare each against the natural-order render of the other library
			for (const lib of ['three', 'jrs']) { setups[lib].meshes[a].renderOrder = 0; setups[lib].meshes[b].renderOrder = 0; }
			const cT = comparePixels(pxT, render('three'), 320, 240), cJ = comparePixels(pxJ, render('jrs'), 320, 240);
			results.push({ k: -2, desc: `   forced order vs natural: three mean ${cT.meanAbsDiff}, jrs mean ${cJ.meanAbsDiff}`, meanAbsDiff: 0, maxDiff: 0, pixelsOverMax: 0, differingPixels: 0, samples: [] });
		}
		for (const lib of ['three', 'jrs']) console.log(lib, 'ids', setups[lib].meshes[a].id, setups[lib].meshes[b].id, 'pos', setups[lib].meshes[a].getWorldPosition(new setups[lib].T.Vector3()).toArray().map((v) => v.toFixed(4)).join(','), setups[lib].meshes[b].getWorldPosition(new setups[lib].T.Vector3()).toArray().map((v) => v.toFixed(4)).join(','));
		return { notes: setups.three.built.notes, results };
	}
	const all = comparePixels(render('three'), render('jrs'), 320, 240);
	results.push({ k: -1, desc: 'ALL', ...all });
	const n = setups.three.meshes.length;
	for (let k = 0; k < n; k++) {
		for (const lib of ['three', 'jrs']) setups[lib].meshes.forEach((m, i) => { m.visible = loo ? i !== k : i === k; });
		const c = comparePixels(render('three'), render('jrs'), 320, 240);
		results.push({ k, desc: describe(setups.three.meshes[k]), meanAbsDiff: c.meanAbsDiff, maxDiff: c.maxDiff, pixelsOverMax: c.pixelsOverMax, differingPixels: c.differingPixels, samples: c.samples.slice(0, 2) });
	}
	return { notes: setups.three.built.notes, results };
}, [seed, frame, only, nobatch, noshadow, loo, pair, singlepass, jrsProps]);
if (pair) { const imgs = await page.evaluate(() => window.__pairImages); const fs = await import('node:fs'); const path = await import('node:path'); const { fileURLToPath } = await import('node:url'); const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'results', 'fuzz'); fs.mkdirSync(dir, { recursive: true }); for (const k of ['three', 'jrs']) fs.writeFileSync(path.join(dir, `pair-${k}.png`), Buffer.from(imgs[k].split(',')[1], 'base64')); console.log(`pair images: ${path.relative(process.cwd(), dir)}/pair-{three,jrs}.png`); }
console.log(r.notes.join('; '));
for (const x of r.results) console.log(`${String(x.k).padStart(3)} mean ${x.meanAbsDiff.toFixed(3).padStart(7)} max ${String(x.maxDiff).padStart(3)} over ${String(x.pixelsOverMax).padStart(5)} diff ${String(x.differingPixels).padStart(6)}  ${x.desc}${x.samples && x.samples.length ? '  e.g. ' + x.samples.map((s) => `(${s.x},${s.y}) ${s.a}|${s.b}`).join(' ') : ''}`);
await browser.close(); server.close();
