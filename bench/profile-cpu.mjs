// CPU profile of one scenario (jrs or three.js) via the Chrome DevTools Protocol.
//
//   node bench/profile-cpu.mjs <scenario|all> [--lib=jrs|three|both] [--frames=120] [--interval=50]
//                              [--out=bench/results/swarm/profiles] [--no-heap] [--no-modes]
//
// Per (scenario, lib) it reports
//   * frame time unprofiled, with gl.finish() after every frame (GPU-bound check) and with all draw
//     calls stubbed to no-ops (pure CPU cost of the renderer),
//   * a sampling CPU profile (Profiler.start/stop) of `frames` frames: share of frame time per phase
//     (scene update, cull/project, sort, program resolve, draw-list build, per-draw state, uniform
//     upload, texture bind, geometry bind, draw issue, GC, ...) and inside each phase the part spent in
//     native WebGL binding calls ("GL driver time" on the main thread: validation + command-buffer
//     encoding + flush stalls; SwiftShader rasterisation itself runs in the GPU process),
//   * the top self-time and top inclusive-time functions,
//   * a sampling heap profile (bytes allocated per frame per function),
//   * the worst frames of an unprofiled run with heap deltas (GC) and expensive GL calls preceding them.
// JSON summaries and raw .cpuprofile files go to --out (raw files are skipped with --no-raw); `--reanalyze` re-reads the raw files.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { startServer } from './serve.mjs';
import { scenarios } from './scenarios.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name, def) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.split('=').slice(1).join('=') : def; };
const has = (name) => args.includes(`--${name}`);
const names = args.filter((a) => !a.startsWith('--'));
const scenarioNames = names.length === 0 || names[0] === 'all' ? Object.keys(scenarios) : names;
const libArg = flag('lib', 'jrs');
const libs = libArg === 'both' ? ['jrs', 'three'] : libArg.split(',');
const FRAMES = Number(flag('frames', 120));
const WARMUP = Number(flag('warmup', 10));
const INTERVAL_US = Number(flag('interval', 50));
const outDir = path.resolve(flag('out', path.join(here, 'results', 'swarm', 'profiles')));
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------- three.js module map (line -> top-level function/class)
// (r186 ships two bundles: three.core.js holds math/core classes, three.module.js the renderer)
const threeDeclsByFile = {};
for (const file of ['three.module.js', 'three.core.js']) {
	const src = fs.readFileSync(path.join(here, '..', 'node_modules', 'three', 'build', file), 'utf8').split('\n');
	const decls = [];
	for (let i = 0; i < src.length; i++) { const m = /^(?:function|class)\s+([A-Za-z0-9_$]+)/.exec(src[i]); if (m) decls.push([i, m[1]]); }
	threeDeclsByFile[file] = decls;
}
function threeModuleOf(file, line0) {
	const threeDecls = threeDeclsByFile[file];
	let lo = 0, hi = threeDecls.length - 1, ans = '(top)';
	while (lo <= hi) { const mid = (lo + hi) >> 1; if (threeDecls[mid][0] <= line0) { ans = threeDecls[mid][1]; lo = mid + 1; } else hi = mid - 1; }
	return ans;
}
const threeFileOf = (url) => /three\.module\.js$/.test(url) ? 'three.module.js' : /three\.core\.js$/.test(url) ? 'three.core.js' : null;

// ---------------------------------------------------------------- phase classification
const PHASES = ['app update', 'scene graph update', 'project + cull', 'sort', 'program resolve', 'shadow pass', 'draw-list build', 'batch matrix upload',
	'per-draw state', 'uniform upload', 'texture bind', 'geometry bind', 'draw issue', 'frame setup/other renderer', 'GC', '(program)/VM', 'other JS'];

/** Returns a phase name for a frame (module = basename or three top-level decl, fn = functionName), or null if the frame is not a phase root. */
function phaseOf(lib, mod, fn) {
	if (fn === '(garbage collector)') return 'GC';
	if (fn === '(program)' || fn === '(idle)') return '(program)/VM';
	if (mod === 'scenarios.js') return fn === 'update' || fn === 'frame' ? 'app update' : null;
	if (lib === 'jrs') {
		switch (mod) {
			case 'Object3D.js': return /^(updateMatrixWorld|updateWorldMatrix|updateMatrix)$/.test(fn) ? 'scene graph update' : null;
			case 'WebGLShadowMap.js': return fn === 'render' ? 'shadow pass' : null;
			case 'WebGLRenderLists.js': return fn === 'finish' ? 'sort' : (fn === 'push' || fn === '_getItem') ? 'project + cull' : null;
			case 'WebGLPrograms.js': return 'program resolve';
			case 'WebGLBatcher.js': return fn === 'uploadTexture' ? 'batch matrix upload' : 'draw-list build';
			case 'WebGLMegaBuffers.js': return 'draw-list build';
			case 'WebGLBindingStates.js': return 'geometry bind';
			case 'WebGLTextures.js': return 'texture bind';
			case 'WebGLLights.js': return fn === 'fill' ? 'uniform upload' : 'project + cull';
			case 'WebGLState.js':
				if (fn === 'bindTexture' || fn === 'activeTexture') return 'texture bind';
				if (fn === 'bindVertexArray') return 'geometry bind';
				if (fn === 'bindUniformBufferRange' || fn === 'bindUniformBuffer') return 'uniform upload';
				return 'per-draw state';
			case 'WebGLInfo.js': return 'draw issue';
			case 'WebGLRenderer.js':
				switch (fn) {
					case '_projectObject': case '_cullTest': case '_pushItem': case '_variantFor': case '_noteRenderOrder': case '_renderOrderReset': return 'project + cull';
					case '_resolvePrograms': case '_getProgram': case '_getProgramSlow': case '_materialProps': return 'program resolve';
					case '_drawList': case '_isBatchable': case '_isMultiDrawable': case '_growCommands': case '_growMultiDraw': return 'draw-list build';
					case '_setupMaterial': case 'shadowSideOf': case '_bindMaterialTextures': return 'per-draw state';
					case '_syncMaterialBlock': case '_uploadFrameBlock': case '_uploadShaderMaterialUniforms': case '_uploadUniform': case '_uploadObjectUniformsForShaderMaterial':
					case 'setUniformValue': case 'setUniformValueImpl': case 'cacheArray': case 'cacheVec': case 'cacheSlab': case 'flattenArray': case 'isLeafValue': return 'uniform upload';
					case 'bindTextureUniform': return 'texture bind';
					case '_renderItem': case '_renderBatch': case '_renderMultiDraw': case '_draw': case '_drawMode': return 'draw issue';
					case 'render': case '_updateEnv': case 'clear': case 'setRenderTarget': case '_applyClearColor': case '_trace': return 'frame setup/other renderer';
					default: return 'frame setup/other renderer';
				}
			case 'Frustum.js': return 'project + cull';
			case 'TransformSlab.js': return fn === 'computeNormalMatrix' ? 'draw issue' : null;
			default: return null;
		}
	}
	// three.js r186: mod is the enclosing top-level declaration in three.module.js / three.core.js
	if (/^setValue|^setValueV|^setValueT|^setValueM|^arraysEqual|^copyArray|^flatten$|^allocTexUnits|^getUniformSetter|^PureArrayUniform|^SingleUniform|^StructuredUniform/.test(mod) || /^setValue/.test(fn)) return 'uniform upload';
	if (/^painterSort|^reversePainterSort/.test(mod)) return 'sort';
	switch (mod) {
		case 'Object3D': return /^(updateMatrixWorld|updateWorldMatrix|updateMatrix)$/.test(fn) ? 'scene graph update' : null;
		case 'WebGLShadowMap': return fn === 'render' ? 'shadow pass' : null;
		case 'WebGLRenderList': return /sort/i.test(fn) ? 'sort' : (fn === 'push' || fn === 'unshift' || fn === 'getNextRenderItem') ? 'project + cull' : null;
		case 'WebGLRenderLists': case 'WebGLRenderStates': case 'WebGLRenderState': return 'frame setup/other renderer';
		case 'WebGLLights': return 'uniform upload';
		case 'WebGLPrograms': case 'WebGLProgram': case 'WebGLShaderCache': return 'program resolve';
		case 'WebGLUniforms': case 'WebGLMaterials': case 'WebGLUniformsGroups': return 'uniform upload';
		case 'WebGLTextures': case 'WebGLUtils': return 'texture bind';
		case 'WebGLBindingStates': case 'WebGLGeometries': case 'WebGLAttributes': case 'WebGLObjects': return 'geometry bind';
		case 'WebGLBufferRenderer': case 'WebGLIndexedBufferRenderer': case 'WebGLInfo': return 'draw issue';
		case 'WebGLState': return fn === 'bindTexture' || fn === 'activeTexture' ? 'texture bind' : 'per-draw state';
		case 'WebGLBackground': case 'WebGLClipping': case 'WebGLMorphtargets': case 'WebGLProperties': case 'WebGLEnvironments': return 'frame setup/other renderer';
		case 'Frustum': case 'Layers': case 'Sphere': return 'project + cull';
		case 'WebGLRenderer':
			switch (fn) {
				case 'projectObject': return 'project + cull';
				case 'renderObjects': return 'draw-list build';
				case 'renderObject': case 'renderBufferDirect': case 'renderTransmissionPass': return 'draw issue';
				case 'setProgram': return 'per-draw state';
				case 'getProgram': case 'getUniformList': case 'updateCommonMaterialProperties': case 'materialNeedsLights': return 'program resolve';
				case 'markUniformsLightsNeedsUpdate': case 'refreshFogUniforms': case 'refreshMaterialUniforms': return 'uniform upload';
				case 'render': case 'setRenderTarget': case 'clear': return 'frame setup/other renderer';
				default: return 'frame setup/other renderer';
			}
		default: return null;
	}
}

// ---------------------------------------------------------------- reanalyze mode (no browser): re-read saved raw profiles with the current classifier
if (has('reanalyze')) {
	const glList = JSON.parse(fs.readFileSync(path.join(outDir, 'gl-methods.json'), 'utf8'));
	for (const scenario of scenarioNames) for (const lib of libs) {
		const jsonPath = path.join(outDir, `${scenario}-${lib}.json`), rawPath = path.join(outDir, `${scenario}-${lib}.cpuprofile`);
		if (!fs.existsSync(jsonPath) || !fs.existsSync(rawPath)) continue;
		const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
		result.cpu = analyzeCpuProfile(JSON.parse(fs.readFileSync(rawPath, 'utf8')), lib, result.frames, new Set(glList));
		fs.writeFileSync(jsonPath, JSON.stringify(result, null, 1));
		printResult(result);
	}
	process.exit(0);
}

// ---------------------------------------------------------------- browser
const candidates = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell', '/usr/bin/chromium', '/usr/bin/google-chrome'];
const executablePath = process.env.CHROME_PATH || candidates.find((p) => fs.existsSync(p));
const browser = await chromium.launch({
	headless: true, executablePath,
	args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage', '--enable-webgl', '--enable-precise-memory-info', '--js-flags=--expose-gc'],
});
const { server, port } = await startServer();

// ---------------------------------------------------------------- page-side helpers
const PAGE_SETUP = `
window.__setupProfile = async function (libName, scenarioName, opts) {
	const T = libName === 'jrs' ? await import('/src/index.js') : await import('/node_modules/three/build/three.module.js');
	const { scenarios } = await import('/bench/scenarios.js');
	const sc = scenarios[scenarioName];
	const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240; document.body.appendChild(canvas);
	const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: scenarioName.startsWith('shader-client'), powerPreference: 'high-performance' });
	renderer.setSize(320, 240, false);
	if (scenarioName === 'shadows') renderer.shadowMap.enabled = true;
	const t0 = performance.now();
	const built = sc.build(T, sc.n);
	const buildMs = performance.now() - t0;
	const { scene, camera, update, warm, frame } = built;
	const gl = renderer.getContext();
	if (warm) warm(renderer);
	let f = 0;
	const doFrame = () => { if (update) update(f); if (frame) frame(renderer); else renderer.render(scene, camera); f++; };
	for (let i = 0; i < opts.warmup; i++) doFrame();
	gl.finish();
	window.__prof = { T, renderer, gl, scene, camera, doFrame, built, canvas, get frameIndex() { return f; } };
	const glMethods = Object.getOwnPropertyNames(WebGL2RenderingContext.prototype).filter((n) => typeof gl[n] === 'function');
	return { n: sc.n, buildMs, glMethods, programs: renderer.info.programs ? renderer.info.programs.length : null, calls: renderer.info.render.calls };
};
/** Runs n frames; mode: 'plain' | 'finish' (gl.finish after each frame) | 'nodraw' (draw calls stubbed) */
window.__runFrames = function (n, mode) {
	const p = window.__prof, gl = p.gl;
	const times = new Float64Array(n);
	const mem = performance.memory; const heap = new Float64Array(n + 1);
	let restore = null;
	if (mode === 'nodraw') {
		const names = ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced', 'drawRangeElements'];
		const saved = {}; for (const nm of names) { saved[nm] = gl[nm]; gl[nm] = function () {}; }
		const ext = gl.getExtension('WEBGL_multi_draw');
		const extSaved = {}; if (ext) for (const nm of ['multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']) { extSaved[nm] = ext[nm]; ext[nm] = function () {}; }
		restore = () => { for (const nm in saved) delete gl[nm]; if (ext) for (const nm in extSaved) delete ext[nm]; };
	}
	if (window.gc) window.gc();
	heap[0] = mem ? mem.usedJSHeapSize : 0;
	const wall0 = performance.now();
	for (let i = 0; i < n; i++) {
		if (mode === 'profile') window.__frameMarker();
		const s = performance.now();
		p.doFrame();
		if (mode === 'finish') gl.finish();
		times[i] = performance.now() - s;
		heap[i + 1] = mem ? mem.usedJSHeapSize : 0;
	}
	const tf = performance.now(); gl.finish(); const finishMs = performance.now() - tf;
	const wallMs = performance.now() - wall0;
	if (restore) restore();
	return { times: Array.from(times), heap: Array.from(heap), finishMs, wallMs };
};
/** Runs n frames with every GL method wrapped; returns per-frame counts of "expensive" calls and per-frame time. */
window.__runFramesInstrumented = function (n) {
	const p = window.__prof, gl = p.gl;
	const expensive = ['texSubImage2D', 'texImage2D', 'texSubImage3D', 'texStorage2D', 'texStorage3D', 'bufferData', 'bufferSubData', 'compileShader', 'linkProgram', 'createTexture', 'createBuffer', 'createVertexArray', 'deleteTexture', 'deleteBuffer', 'generateMipmap', 'getError', 'finish', 'flush', 'readPixels', 'getProgramParameter', 'getUniformLocation', 'getShaderParameter', 'texParameteri', 'framebufferTexture2D', 'bindFramebuffer', 'getParameter', 'getExtension'];
	const proto = Object.getPrototypeOf(gl); const orig = {};
	let frameCounts = null;
	for (const nm of Object.getOwnPropertyNames(proto)) {
		if (typeof gl[nm] !== 'function') continue;
		orig[nm] = gl[nm];
		gl[nm] = function (...a) { if (frameCounts) { frameCounts.total++; if (expensive.includes(nm)) frameCounts[nm] = (frameCounts[nm] || 0) + 1; } return orig[nm].apply(gl, a); };
	}
	const out = [];
	const mem = performance.memory;
	for (let i = 0; i < n; i++) {
		frameCounts = { total: 0 };
		const h0 = mem ? mem.usedJSHeapSize : 0;
		const s = performance.now(); p.doFrame(); const d = performance.now() - s;
		out.push({ i, ms: +d.toFixed(3), heapDelta: (mem ? mem.usedJSHeapSize : 0) - h0, counts: frameCounts });
	}
	for (const nm in orig) delete gl[nm];
	return out;
};
/** Spins ~0.25 ms so the CPU profile has a run of samples that delimits frames. */
window.__frameMarker = function __frameMarker() { const t = performance.now(); let x = 0; while (performance.now() - t < 0.25) x++; return x; };
window.__teardown = function () { const p = window.__prof; if (!p) return; try { p.renderer.dispose(); } catch (e) {} p.canvas.remove(); window.__prof = null; };
`;

// ---------------------------------------------------------------- profile analysis
function analyzeCpuProfile(profile, lib, frames, glMethodSet) {
	const nodes = new Map();
	for (const n of profile.nodes) nodes.set(n.id, n);
	const parent = new Map();
	for (const n of profile.nodes) if (n.children) for (const c of n.children) parent.set(c, n.id);
	const frameInfo = new Map(); // node id -> {mod, fn, key, phase, isGL}
	const info = (id) => {
		let fi = frameInfo.get(id);
		if (fi !== undefined) return fi;
		const n = nodes.get(id), cf = n.callFrame;
		const url = cf.url || '';
		let mod;
		const tf = threeFileOf(url);
		if (url === '') mod = '(native)';
		else if (tf !== null) mod = threeModuleOf(tf, cf.lineNumber);
		else mod = url.split('/').pop();
		const fn = cf.functionName || '(anonymous)';
		const isGL = url === '' && glMethodSet.has(fn);
		const line = url === '' ? '' : ':' + (cf.lineNumber + 1);
		const key = `${fn} [${mod}${line}]`;
		fi = { mod, fn, key, phase: phaseOf(lib, mod, fn), isGL, native: url === '' && !/^\(/.test(fn) };
		frameInfo.set(id, fi);
		return fi;
	};
	const samples = profile.samples, deltas = profile.timeDeltas;
	// pass 1: frame index per sample (runs of __frameMarker samples delimit frames) and per-frame sampled time
	const frameOf = new Int32Array(samples.length); const frameUs = [];
	{
		let fi = -1, inMarker = false;
		for (let i = 0; i < samples.length; i++) {
			const dt = i + 1 < deltas.length ? deltas[i + 1] : 0;
			const isMarker = info(samples[i]).fn === '__frameMarker';
			if (isMarker && !inMarker) { fi++; frameUs[fi] = 0; }
			inMarker = isMarker;
			frameOf[i] = fi;
			if (fi >= 0 && !isMarker && dt > 0) frameUs[fi] += dt;
		}
	}
	const sortedFrames = [...frameUs].sort((a, b) => a - b);
	const medianFrameUs = sortedFrames.length ? sortedFrames[sortedFrames.length >> 1] : 0;
	const stallLimit = Math.max(medianFrameUs * 4, medianFrameUs + 3000);
	const stallFrames = new Set(); for (let f = 0; f < frameUs.length; f++) if (frameUs[f] > stallLimit) stallFrames.add(f);
	const steadyFrames = frameUs.length - stallFrames.size;
	const stallDetail = new Map(); // frame -> {us, byLeaf}
	const self = new Map(), incl = new Map(), phaseTime = new Map(), phaseGL = new Map(), glByCall = new Map(), glCallers = new Map(), unclassified = new Map();
	let total = 0, glTotal = 0, allTotal = 0, markerUs = 0;
	// time of a sample = the delta to the NEXT sample (V8 convention)
	for (let i = 0; i < samples.length; i++) {
		const dt = i + 1 < deltas.length ? deltas[i + 1] : 0;
		if (dt <= 0) continue;
		const id = samples[i];
		const leaf = info(id);
		if (frameOf[i] < 0) continue; // before the first frame
		if (leaf.fn === '__frameMarker') { markerUs += dt; continue; }
		allTotal += dt;
		if (stallFrames.has(frameOf[i])) {
			let d = stallDetail.get(frameOf[i]); if (!d) { d = { us: 0, byLeaf: new Map() }; stallDetail.set(frameOf[i], d); }
			d.us += dt; d.byLeaf.set(leaf.key, (d.byLeaf.get(leaf.key) || 0) + dt);
			continue; // steady-state tables exclude stall frames
		}
		total += dt;
		self.set(leaf.key, (self.get(leaf.key) || 0) + dt);
		// inclusive: each distinct function once per sample
		const seen = new Set();
		let phase = null, isGLSample = leaf.isGL, glCall = leaf.isGL ? leaf.fn : null, glCaller = null, inShadow = false;
		for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
			const fi = info(cur);
			if (!seen.has(fi.key)) { seen.add(fi.key); incl.set(fi.key, (incl.get(fi.key) || 0) + dt); }
			if (glCall !== null && glCaller === null && !fi.native && fi.fn !== glCall) glCaller = fi.key;
			if (phase === null && fi.phase !== null) phase = fi.phase;
			if (fi.phase === 'shadow pass') inShadow = true;
		}
		if (leaf.phase === null && !leaf.isGL && leaf.fn !== '(garbage collector)') { const k = leaf.key + ' -> ' + (phase || 'other JS'); unclassified.set(k, (unclassified.get(k) || 0) + dt); }
		if (phase === null) phase = 'other JS';
		if (inShadow && phase !== 'shadow pass') phase = 'shadow pass';
		phaseTime.set(phase, (phaseTime.get(phase) || 0) + dt);
		if (isGLSample) {
			glTotal += dt;
			phaseGL.set(phase, (phaseGL.get(phase) || 0) + dt);
			glByCall.set(glCall, (glByCall.get(glCall) || 0) + dt);
			if (glCaller) { const k = glCall + ' <- ' + glCaller; glCallers.set(k, (glCallers.get(k) || 0) + dt); }
		}
	}
	const perFrame = (us) => +(us / 1000 / Math.max(1, steadyFrames)).toFixed(3);
	const top = (m, k) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([key, us]) => ({ key, msPerFrame: perFrame(us), pct: +(100 * us / total).toFixed(1) }));
	const stalls = [...stallDetail.entries()].sort((a, b) => b[1].us - a[1].us).slice(0, 8).map(([f, d]) => ({ frame: f, ms: +(d.us / 1000).toFixed(1), top: [...d.byLeaf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, us]) => `${k} ${(us / 1000).toFixed(1)}ms`) }));
	return {
		framesSeen: frameUs.length, steadyFrames, stallFrames: stallFrames.size, stallMsTotal: +([...stallDetail.values()].reduce((a, d) => a + d.us, 0) / 1000).toFixed(1), stalls,
		medianSampledFrameMs: +(medianFrameUs / 1000).toFixed(3), allSampledMsPerFrame: +(allTotal / 1000 / Math.max(1, frameUs.length)).toFixed(3), markerMsPerFrame: +(markerUs / 1000 / Math.max(1, frameUs.length)).toFixed(3),
		sampledMsPerFrame: perFrame(total), glNativeMsPerFrame: perFrame(glTotal), samples: samples.length,
		phases: PHASES.filter((p) => phaseTime.has(p)).map((p) => ({ phase: p, msPerFrame: perFrame(phaseTime.get(p)), pct: +(100 * phaseTime.get(p) / total).toFixed(1), glMsPerFrame: perFrame(phaseGL.get(p) || 0) })),
		topSelf: top(self, 40), topInclusive: top(incl, 30), glByCall: top(glByCall, 25), glCallers: top(glCallers, 25), unclassifiedLeaves: top(unclassified, 15),
	};
}

function analyzeHeapProfile(profile, frames) {
	const bySelf = new Map(); let total = 0;
	const walk = (node, stack) => {
		const cf = node.callFrame;
		const url = cf.url || '';
		const tf = threeFileOf(url);
		const mod = url === '' ? '(native)' : tf !== null ? threeModuleOf(tf, cf.lineNumber) : url.split('/').pop();
		const key = `${cf.functionName || '(anonymous)'} [${mod}${url === '' ? '' : ':' + (cf.lineNumber + 1)}]`;
		if (node.selfSize > 0) { total += node.selfSize; const caller = stack.length ? stack[stack.length - 1] : ''; const k = key + (caller ? '  <- ' + caller : ''); bySelf.set(k, (bySelf.get(k) || 0) + node.selfSize); }
		stack.push(key);
		for (const c of node.children || []) walk(c, stack);
		stack.pop();
	};
	walk(profile.head, []);
	return { bytesPerFrame: Math.round(total / frames), top: [...bySelf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([key, b]) => ({ key, bytesPerFrame: Math.round(b / frames), pct: +(100 * b / total).toFixed(1) })) };
}

const stats = (arr) => { const s = [...arr].sort((a, b) => a - b); const sum = s.reduce((a, b) => a + b, 0); return { median: +s[s.length >> 1].toFixed(3), mean: +(sum / s.length).toFixed(3), p90: +s[Math.floor(s.length * 0.9)].toFixed(3), best: +s[0].toFixed(3), worst: +s[s.length - 1].toFixed(3) }; };

// ---------------------------------------------------------------- main loop
const all = [];
for (const scenario of scenarioNames) {
	for (const lib of libs) {
		const page = await browser.newPage();
		page.on('pageerror', (e) => console.log('[pageerror]', e.message));
		page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[browser]', m.text()); });
		await page.goto(`http://127.0.0.1:${port}/bench/index.html`);
		await page.waitForFunction(() => window.ready === true, null, { timeout: 60000 });
		await page.evaluate(PAGE_SETUP);
		const cdp = await page.context().newCDPSession(page);
		const setup = await page.evaluate(([lib, scenario, warmup]) => window.__setupProfile(lib, scenario, { warmup }), [lib, scenario, WARMUP]);
		const glMethodSet = new Set([...setup.glMethods, 'multiDrawElementsWEBGL', 'multiDrawArraysWEBGL', 'multiDrawElementsInstancedWEBGL', 'multiDrawArraysInstancedWEBGL']);
		fs.writeFileSync(path.join(outDir, 'gl-methods.json'), JSON.stringify([...glMethodSet]));
		const result = { scenario, lib, n: setup.n, frames: FRAMES, buildMs: +setup.buildMs.toFixed(1), programs: setup.programs };

		// 1. timing modes (unprofiled)
		if (!has('no-modes')) {
			const plain = await page.evaluate((n) => window.__runFrames(n, 'plain'), FRAMES);
			const finish = await page.evaluate((n) => window.__runFrames(n, 'finish'), FRAMES);
			const nodraw = await page.evaluate((n) => window.__runFrames(n, 'nodraw'), FRAMES);
			const plain2 = await page.evaluate((n) => window.__runFrames(n, 'plain'), FRAMES);
			result.timing = {
				plain: stats(plain.times), plainRepeat: stats(plain2.times), finishPerFrame: stats(finish.times), drawsStubbed: stats(nodraw.times),
				trailingFinishMs: +plain.finishMs.toFixed(2), wallPerFrameMs: +(plain.wallMs / FRAMES).toFixed(3),
			};
			// worst frames + what preceded them (heap drop = GC)
			const t = plain.times, h = plain.heap;
			const order = t.map((v, i) => i).sort((a, b) => t[b] - t[a]).slice(0, 5);
			result.worstFrames = order.map((i) => ({ frame: i, ms: +t[i].toFixed(2), heapDeltaKB: Math.round((h[i + 1] - h[i]) / 1024), prevMs: i > 0 ? +t[i - 1].toFixed(2) : null }));
			const gcFrames = []; for (let i = 0; i < t.length; i++) if (h[i + 1] < h[i]) gcFrames.push(i);
			result.gcFrames = gcFrames.length; result.heapGrowthKBPerFrame = Math.round(((h[h.length - 1] - h[0]) / 1024) / FRAMES);
			// instrumented pass: expensive GL calls per frame
			const inst = await page.evaluate((n) => window.__runFramesInstrumented(n), Math.min(FRAMES, 60));
			const expensiveFrames = inst.filter((f) => Object.keys(f.counts).length > 1).map((f) => ({ frame: f.i, ms: f.ms, heapDeltaKB: Math.round(f.heapDelta / 1024), calls: Object.fromEntries(Object.entries(f.counts).filter(([k]) => k !== 'total')) }));
			result.expensiveGLFrames = { frames: expensiveFrames.length, of: inst.length, sample: expensiveFrames.slice(0, 6), glCallsPerFrame: inst[inst.length >> 1].counts.total };
		}

		// 2. CPU profile
		await cdp.send('Profiler.enable');
		await cdp.send('Profiler.setSamplingInterval', { interval: INTERVAL_US });
		await cdp.send('Profiler.start');
		const profiled = await page.evaluate((n) => window.__runFrames(n, 'profile'), FRAMES);
		const { profile } = await cdp.send('Profiler.stop');
		await cdp.send('Profiler.disable');
		result.profiledFrame = stats(profiled.times);
		result.cpu = analyzeCpuProfile(profile, lib, FRAMES, glMethodSet);
		if (!has('no-raw')) fs.writeFileSync(path.join(outDir, `${scenario}-${lib}.cpuprofile`), JSON.stringify(profile));

		// 3. heap sampling (allocations per frame)
		if (!has('no-heap')) {
			await cdp.send('HeapProfiler.enable');
			await cdp.send('HeapProfiler.startSampling', { samplingInterval: 512, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
			await page.evaluate((n) => window.__runFrames(n, 'plain'), FRAMES);
			const { profile: heap } = await cdp.send('HeapProfiler.stopSampling');
			await cdp.send('HeapProfiler.disable');
			result.heap = analyzeHeapProfile(heap, FRAMES);
		}
		result.info = await page.evaluate(() => { const r = window.__prof.renderer.info; return { calls: r.render.calls, triangles: Math.round(r.render.triangles), programs: r.programs ? r.programs.length : null, geometries: r.memory.geometries, textures: r.memory.textures, batches: r.render.batches, instances: r.render.instances, programSwitches: r.render.programSwitches }; });
		await page.evaluate(() => window.__teardown());
		await cdp.detach();
		await page.close();
		all.push(result);
		fs.writeFileSync(path.join(outDir, `${scenario}-${lib}.json`), JSON.stringify(result, null, 1));
		printResult(result);
	}
}
await browser.close(); server.close();

function printResult(r) {
	const pad = (s, n) => String(s).padEnd(n);
	console.log(`\n==== ${r.scenario} / ${r.lib}  (n=${r.n}, draws=${r.info.calls}, programs=${r.info.programs}, build ${r.buildMs} ms)`);
	if (r.timing) {
		const t = r.timing;
		console.log(`frame ms  plain median ${t.plain.median} (mean ${t.plain.mean}, p90 ${t.plain.p90}, worst ${t.plain.worst}) | repeat ${t.plainRepeat.median} | +gl.finish/frame ${t.finishPerFrame.median} | draws stubbed ${t.drawsStubbed.median} | wall/frame ${t.wallPerFrameMs} | trailing finish ${t.trailingFinishMs} ms`);
		console.log(`worst frames: ${r.worstFrames.map((w) => `#${w.frame} ${w.ms}ms (heap ${w.heapDeltaKB >= 0 ? '+' : ''}${w.heapDeltaKB}KB)`).join(', ')} | GC frames ${r.gcFrames}/${r.frames} | heap growth ${r.heapGrowthKBPerFrame} KB/frame`);
		console.log(`expensive GL calls in ${r.expensiveGLFrames.frames}/${r.expensiveGLFrames.of} frames${r.expensiveGLFrames.sample.length ? ': ' + r.expensiveGLFrames.sample.map((f) => `#${f.frame} ${f.ms}ms ${JSON.stringify(f.calls)}`).join('; ') : ''}`);
	}
	console.log(`profiled frame median ${r.profiledFrame.median} ms; steady-state sampled ${r.cpu.sampledMsPerFrame} ms/frame over ${r.cpu.steadyFrames} frames (${r.cpu.samples} samples), GL native ${r.cpu.glNativeMsPerFrame} ms/frame; ${r.cpu.stallFrames} stall frames totalling ${r.cpu.stallMsTotal} ms excluded`);
	if (r.cpu.stalls.length) for (const s of r.cpu.stalls) console.log(`  stall frame #${s.frame} ${s.ms} ms: ${s.top.join(' | ')}`);
	console.log('steady-state phases (ms/frame, %, of which native GL):');
	for (const p of r.cpu.phases) console.log(`  ${pad(p.phase, 28)} ${pad(p.msPerFrame, 8)} ${pad(p.pct + '%', 7)} gl ${p.glMsPerFrame}`);
	console.log('top self time:');
	for (const f of r.cpu.topSelf.slice(0, 25)) console.log(`  ${pad(f.msPerFrame, 8)} ${pad(f.pct + '%', 7)} ${f.key}`);
	console.log('top inclusive:');
	for (const f of r.cpu.topInclusive.slice(0, 15)) console.log(`  ${pad(f.msPerFrame, 8)} ${pad(f.pct + '%', 7)} ${f.key}`);
	console.log('native GL by call:');
	for (const f of r.cpu.glByCall.slice(0, 12)) console.log(`  ${pad(f.msPerFrame, 8)} ${pad(f.pct + '%', 7)} ${f.key}`);
	if (r.heap) {
		console.log(`allocations: ${r.heap.bytesPerFrame} bytes/frame; top:`);
		for (const f of r.heap.top.slice(0, 12)) console.log(`  ${pad(f.bytesPerFrame, 9)} ${pad(f.pct + '%', 7)} ${f.key}`);
	}
}
