// Finds the first GL calls that raise an error while rendering a fuzz seed with one library: wraps every
// context method, checks getError after each, and at a failing draw dumps the program's sampler units and
// what is bound on them.   node bench/fuzz-glerr.mjs <seed> [three|jrs] [features,comma,separated]
import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const [seed, lib, only] = [Number(process.argv[2]), process.argv[3] || 'jrs', process.argv[4] || ''];
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message)); page.on('console', (m) => {
	if (m.type() !== 'error' && m.type() !== 'warning') return;
	const text = m.text();
	if (/link failed|Shader Error/.test(text)) {
		// shader logs are long: print the program defines, then every GLSL error with 3 lines of context
		const lines = text.split('\n');
		console.log('[browser] ' + lines[0] + ' | defines: ' + lines.filter((l) => /^\s*\d+: #define/.test(l)).map((l) => l.replace(/^\s*\d+: #define /, '')).join(' '));
		lines.forEach((l, i) => { if (/ERROR:/.test(l)) console.log('[browser]   ' + lines.slice(Math.max(0, i - 1), i + 4).join('\n[browser]   ')); });
	} else console.log('[browser]', text.slice(0, 400));
});
await page.goto(`http://127.0.0.1:${port}/bench/fuzz.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
const r = await page.evaluate(async ([seed, lib, only]) => {
	const T = lib === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
	const { buildFuzzScene, defaultFeatures } = await import('/bench/fuzz-scene.js');
	const features = defaultFeatures();
	if (only) { for (const k in features) features[k] = false; for (const k of only.split(',')) features[k] = true; }
	const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
	const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, stencil: true });
	renderer.setSize(320, 240, false);
	const built = buildFuzzScene(T, seed, features, { width: 320, height: 240, frames: 6 });
	built.setup(renderer);
	const gl = renderer.getContext();
	const proto = Object.getPrototypeOf(gl);
	const errors = [];
	const getError = proto.getError.bind(gl);
	let frame = -1;
	for (const name of Object.getOwnPropertyNames(proto)) {
		if (typeof gl[name] !== 'function' || name === 'getError') continue;
		const orig = proto[name];
		gl[name] = function (...args) {
			const r = orig.apply(gl, args);
			const e = getError();
			if (e !== 0 && errors.length < 8 && name.startsWith('draw')) {
				// dump the current program's samplers and what is bound on their units
				const prog = orig === proto.useProgram ? null : proto.getParameter.call(gl, gl.CURRENT_PROGRAM);
				const active = proto.getParameter.call(gl, gl.ACTIVE_TEXTURE);
				const n = proto.getProgramParameter.call(gl, prog, gl.ACTIVE_UNIFORMS);
				const samplers = [];
				const names = { [gl.SAMPLER_2D]: 's2D', [gl.SAMPLER_2D_SHADOW]: 's2DShadow', [gl.SAMPLER_CUBE]: 'sCube', [gl.SAMPLER_3D]: 's3D', [gl.SAMPLER_2D_ARRAY]: 's2DArray' };
				for (let i = 0; i < n; i++) {
					const info = proto.getActiveUniform.call(gl, prog, i);
					if (!names[info.type]) continue;
					const loc = proto.getUniformLocation.call(gl, prog, info.name.replace('[0]', '[0]'));
					const unit = proto.getUniform.call(gl, prog, loc);
					proto.activeTexture.call(gl, gl.TEXTURE0 + unit);
					const t2 = proto.getParameter.call(gl, gl.TEXTURE_BINDING_2D);
					let cmp = null; if (t2) cmp = proto.getTexParameter.call(gl, gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE);
					samplers.push(`${info.name}:${names[info.type]}@${unit}${t2 ? (cmp === gl.COMPARE_REF_TO_TEXTURE ? ' [2D compare]' : ' [2D]') : ' [no 2D]'}`);
				}
				proto.activeTexture.call(gl, active);
				errors.push({ frame, name, error: e, args: samplers.join(' '), stack: '' });
			} else if (e !== 0 && errors.length < 8) errors.push({ frame, name, error: e, args: args.map((a) => (a && typeof a === 'object') ? (a.constructor.name + (a.length !== undefined ? '[' + a.length + ']' : '')) : String(a)).join(', '), stack: (new Error().stack || '').split('\n').slice(2, 9).map((l) => l.trim().replace(/^at /, '').replace(/http:\/\/127\.0\.0\.1:\d+\//, '')).join(' <- ') });
			return r;
		};
	}
	for (frame = 0; frame < 6; frame++) built.frame(renderer, frame);
	return { notes: built.notes, errors };
}, [seed, lib, only]);
console.log(r.notes.join('; '));
for (const e of r.errors) console.log(`frame ${e.frame} ${e.name}(${e.args}) -> ${e.error}\n   ${e.stack}`);
await browser.close(); server.close();
