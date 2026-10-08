// In-page leak scenario shared by bench/leaks.mjs. `runLeaks(T, opts)` builds a varied scene, renders it,
// disposes it the three.js way, renders an empty scene and measures what is left, once per cycle.
// Works against both libraries; jrs-internal cache sizes are only read when the fields exist.

const GL_KINDS = ['Buffer', 'Texture', 'VertexArray', 'Program', 'Framebuffer', 'Renderbuffer', 'Shader'];

// Wrap the create/delete methods of the WebGL2 prototype to keep live-object counts (call before creating a renderer).
export function installGLCounters() {
	const proto = WebGL2RenderingContext.prototype;
	const live = {}; const sets = {};
	for (const k of GL_KINDS) {
		live[k] = 0; sets[k] = new Set();
		const create = proto['create' + k], del = proto['delete' + k];
		proto['create' + k] = function () { const o = create.apply(this, arguments); if (o) { sets[k].add(o); live[k] = sets[k].size; } return o; };
		proto['delete' + k] = function (o) { if (o && sets[k].delete(o)) live[k] = sets[k].size; return del.apply(this, arguments); };
	}
	// a lost context invalidates every object without delete calls
	const reset = () => { for (const k of GL_KINDS) { sets[k].clear(); live[k] = 0; } };
	return { live, reset };
}

function disposeTextures(material) {
	for (const key in material) {
		const v = material[key];
		if (v && v.isTexture && !v.isRenderTargetTexture) v.dispose();
	}
	if (material.uniforms) for (const key in material.uniforms) { const v = material.uniforms[key].value; if (v && v.isTexture && !v.isRenderTargetTexture) v.dispose(); }
}

function dataTexture(T, seed) {
	const d = new Uint8Array(4 * 4 * 4);
	for (let i = 0; i < d.length; i++) d[i] = (i * 37 + seed * 11) & 255;
	const t = new T.DataTexture(d, 4, 4, T.RGBAFormat);
	t.needsUpdate = true;
	return t;
}

/** Builds one cycle's worth of scene content. Returns { scene, cameras, targets, disposables } */
export function buildContent(T, renderer, cycle) {
	const scene = new T.Scene();
	const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 4, 14); camera.lookAt(0, 0, 0);
	const camera2 = new T.PerspectiveCamera(70, 1, 0.1, 60); camera2.position.set(8, 6, 8); camera2.lookAt(0, 0, 0);
	const c_quads = [], geometries = [], materials = [], textures = [], targets = [], skeletons = [], instanced = [], lights = [];
	const own = (g) => (geometries.push(g), g);
	const mat = (m) => (materials.push(m), m);
	const tex = (t) => (textures.push(t), t);

	// unique geometries with unique materials and textures
	for (let i = 0; i < 12; i++) {
		const m = new T.Mesh(own(new T.BoxGeometry(1, 1, 1, 1 + (i % 3), 1, 1)), mat(new T.MeshStandardMaterial({ color: 0x336699 + i * 1000, map: i % 2 ? tex(dataTexture(T, i)) : null, roughness: 0.5 })));
		m.position.set(-8 + i * 1.4, 0, -3); m.castShadow = true; m.receiveShadow = true; scene.add(m);
	}
	// shared geometry + shared material (instanced batch)
	const sg = own(new T.SphereGeometry(0.4, 8, 6)), sm = mat(new T.MeshLambertMaterial({ color: 0xcc6633 }));
	for (let i = 0; i < 24; i++) { const m = new T.Mesh(sg, sm); m.position.set(-6 + (i % 12) * 1.1, 1.5 + Math.floor(i / 12), 0); m.castShadow = true; scene.add(m); }
	// shared geometry, several materials (material-index batching)
	const mg = own(new T.CylinderGeometry(0.3, 0.3, 1, 8));
	const phong = []; for (let i = 0; i < 6; i++) phong.push(mat(new T.MeshPhongMaterial({ color: new T.Color().setHSL(i / 6, 0.7, 0.5) })));
	for (let i = 0; i < 18; i++) { const m = new T.Mesh(mg, phong[i % 6]); m.position.set(-5 + i * 0.6, -1.5, 1); scene.add(m); }
	// distinct geometries, one material (multi-draw)
	const dm = mat(new T.MeshPhongMaterial({ color: 0x88aa44 }));
	for (let i = 0; i < 10; i++) { const m = new T.Mesh(own(new T.TorusGeometry(0.3, 0.1, 6 + i, 8)), dm); m.position.set(-4 + i * 0.9, -3, 2); scene.add(m); }
	// transparent
	const tm = mat(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }));
	for (let i = 0; i < 4; i++) { const m = new T.Mesh(sg, tm); m.position.set(i, 0.5, 4 - i); scene.add(m); }
	// instanced mesh with colours
	const im = new T.InstancedMesh(own(new T.BoxGeometry(0.3, 0.3, 0.3)), mat(new T.MeshStandardMaterial({ color: 0xffffff })), 40);
	const m4 = new T.Matrix4(), col = new T.Color();
	for (let i = 0; i < 40; i++) { m4.makeTranslation(-5 + (i % 10) * 0.9, 3 + Math.floor(i / 10) * 0.5, -1); im.setMatrixAt(i, m4); im.setColorAt(i, col.setHSL(i / 40, 0.8, 0.5)); }
	scene.add(im); instanced.push(im);
	// skinned mesh
	{
		const geo = own(new T.CylinderGeometry(0.4, 0.4, 3, 8, 6, true));
		const pos = geo.attributes.position, n = pos.count, si = [], sw = [];
		for (let i = 0; i < n; i++) { const y = pos.getY(i) + 1.5; const b = Math.min(2, Math.floor(y)); const f = y - b; si.push(b, Math.min(b + 1, 2), 0, 0); sw.push(1 - f, f, 0, 0); }
		geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
		const bones = []; let prev = null;
		for (let i = 0; i < 3; i++) { const b = new T.Bone(); b.position.y = i === 0 ? -1.5 : 1.5; if (prev) prev.add(b); bones.push(b); prev = b; }
		const sk = new T.SkinnedMesh(geo, mat(new T.MeshStandardMaterial({ color: 0xaa4488 })));
		const skeleton = new T.Skeleton(bones); skeletons.push(skeleton);
		sk.add(bones[0]); sk.bind(skeleton); sk.position.set(6, 1.5, 0); sk.castShadow = true; scene.add(sk);
		bones[1].rotation.z = 0.3;
	}
	// morph targets
	{
		const geo = own(new T.BoxGeometry(1, 1, 1, 2, 2, 2));
		const p = geo.attributes.position, arr = new Float32Array(p.count * 3);
		for (let i = 0; i < arr.length; i++) arr[i] = p.array[i] * 1.5;
		geo.morphAttributes.position = [new T.BufferAttribute(arr, 3)];
		const m = new T.Mesh(geo, mat(new T.MeshStandardMaterial({ color: 0x44aa88 }))); m.morphTargetInfluences[0] = 0.5; m.position.set(6, -2, 2); scene.add(m);
	}
	// ShaderMaterial
	{
		const sm2 = mat(new T.ShaderMaterial({ uniforms: { tint: { value: new T.Color(0x00ffcc) }, tex: { value: tex(dataTexture(T, 99 + cycle)) } },
			vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
			fragmentShader: 'uniform vec3 tint; uniform sampler2D tex; varying vec2 vUv; void main(){ gl_FragColor = vec4(tint * texture2D(tex, vUv).rgb, 1.0); }' }));
		const m = new T.Mesh(own(new T.PlaneGeometry(1.5, 1.5)), sm2); m.position.set(-7, 3, 1); scene.add(m);
	}
	// points, line, sprite
	{
		const pg = own(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 5, 0), new T.Vector3(1, 5, 0), new T.Vector3(2, 5, 0)]));
		scene.add(new T.Points(pg, mat(new T.PointsMaterial({ color: 0xffffff, size: 5, sizeAttenuation: false }))));
		scene.add(new T.Line(pg, mat(new T.LineBasicMaterial({ color: 0xffff00 }))));
		const sp = new T.Sprite(mat(new T.SpriteMaterial({ color: 0xff8888 }))); sp.position.set(3, 3, 3); scene.add(sp);
	}
	// lights with shadows
	scene.add(new T.AmbientLight(0xffffff, 0.3));
	const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(5, 10, 5); dl.castShadow = true; dl.shadow.mapSize.set(256, 256); scene.add(dl, dl.target); lights.push(dl);
	const sl = new T.SpotLight(0xffeedd, 60, 40, 0.6, 0.5); sl.position.set(-6, 8, 4); sl.castShadow = true; sl.shadow.mapSize.set(256, 256); scene.add(sl, sl.target); lights.push(sl);
	const pl = new T.PointLight(0xaaccff, 40, 30); pl.position.set(0, 6, -4); pl.castShadow = true; pl.shadow.mapSize.set(128, 128); scene.add(pl); lights.push(pl);
	scene.add(new T.HemisphereLight(0x8899aa, 0x332211, 0.4));
	// render targets: colour (+ depth texture), used as a map
	const rt = new T.WebGLRenderTarget(64, 64, { depthBuffer: true }); rt.depthTexture = new T.DepthTexture(64, 64); targets.push(rt);
	const rt2 = new T.WebGLRenderTarget(64, 64, { samples: 4 }); targets.push(rt2);
	const cube = new T.WebGLCubeRenderTarget(32); targets.push(cube);
	const quad = new T.Mesh(own(new T.PlaneGeometry(2, 2)), mat(new T.MeshBasicMaterial({ map: rt.texture }))); quad.position.set(7, 4, -2); scene.add(quad);
	const quad2 = new T.Mesh(own(new T.PlaneGeometry(2, 2)), mat(new T.MeshBasicMaterial({ map: rt2.texture }))); scene.add(quad2);
	c_quads.push(quad, quad2);
	return { scene, camera, camera2, geometries, materials, textures, targets, skeletons, instanced, lights, cube, quads: c_quads };
}

export function renderContent(renderer, c, frames = 5) {
	renderer.shadowMap.enabled = true;
	for (let f = 0; f < frames; f++) {
		c.scene.rotation.y = f * 0.02;
		for (const q of c.quads) q.visible = false; // no feedback loops
		renderer.setRenderTarget(c.targets[0]); renderer.render(c.scene, c.camera2);
		renderer.setRenderTarget(c.targets[1]); renderer.render(c.scene, c.camera2);
		renderer.setRenderTarget(null);
		for (const q of c.quads) q.visible = true;
		renderer.render(c.scene, f & 1 ? c.camera2 : c.camera);
	}
	for (const q of c.quads) q.visible = false;
	for (let face = 0; face < 6; face++) { renderer.setRenderTarget(c.cube, face); renderer.render(c.scene, c.camera); }
	renderer.setRenderTarget(null);
	for (const q of c.quads) q.visible = true;
	renderer.render(c.scene, c.camera);
}

export function disposeContent(c) {
	const { scene } = c;
	scene.traverse((o) => {
		if (o.isInstancedMesh) o.dispose();
	});
	for (const g of c.geometries) g.dispose();
	for (const m of c.materials) { disposeTextures(m); m.dispose(); }
	for (const t of c.textures) t.dispose();
	for (const t of c.targets) t.dispose();
	for (const s of c.skeletons) s.dispose();
	for (const l of c.lights) l.dispose();
	for (const ch of scene.children.slice()) scene.remove(ch);
}

// jrs frees a mega-buffer page 30 renders after its last geometry is gone
const SETTLE_FRAMES = 32;

const gcNow = async () => { for (let i = 0; i < 4; i++) { gc(); await new Promise((r) => setTimeout(r, 30)); } };

function sizes(renderer) {
	const r = renderer, out = {};
	if (r.megaBuffers) {
		let pages = 0, used = 0;
		for (const layout of r.megaBuffers.layouts.values()) {
			pages += layout.pages.length;
			for (const p of layout.pages) used += p.vertexAlloc && p.vertexAlloc.used !== undefined ? p.vertexAlloc.used : 0;
		}
		out.megaPages = pages;
		out.megaLayouts = r.megaBuffers.layouts.size;
	}
	if (r.batcher) out.batcherTexRows = r.batcher.textureRows;
	if (r._materialSlotsUsed !== undefined) out.matSlots = r._materialSlotsUsed - r._materialFreeSlots.length;
	if (r._batchGroups) out.batchGroups = r._batchGroups.size;
	if (r.programs && r.programs.cache) out.programCache = r.programs.cache.size;
	if (r.shadowMap && r.shadowMap._renderOrders) out.shadowOrders = r.shadowMap._renderOrders.size;
	if (r._envKeyIds) out.envKeys = r._envKeyIds.size;
	return out;
}

export async function runLeaks(T, { cycles = 20, size = 128, log = () => {} } = {}) {
	const counters = installGLCounters();
	const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; document.body.appendChild(canvas);
	const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: false });
	renderer.setSize(size, size, false);
	renderer.shadowMap.enabled = true;
	const emptyScene = new T.Scene(), emptyCam = new T.PerspectiveCamera();
	const rows = [];
	const measure = async (label) => {
		await gcNow();
		const heap = performance.memory ? performance.memory.usedJSHeapSize : 0;
		rows.push({ cycle: label, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length, ...Object.fromEntries(GL_KINDS.map((k) => [k.toLowerCase(), counters.live[k]])), heapKB: Math.round(heap / 1024), ...sizes(renderer) });
	};
	renderer.render(emptyScene, emptyCam);
	await measure('base');
	for (let i = 1; i <= cycles; i++) {
		let c = buildContent(T, renderer, i);
		renderContent(renderer, c);
		renderer.getContext().finish();
		disposeContent(c); c = null;
		for (let f = 0; f < SETTLE_FRAMES; f++) renderer.render(emptyScene, emptyCam); // grace period of the page reclaim
		await measure(i);
	}
	return { rows, counters, renderer };
}

export { GL_KINDS };

const readAll = (renderer) => {
	const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
	const px = new Uint8Array(w * h * 4);
	gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return px;
};
const diff = (a, b) => { let max = 0, n = 0; for (let i = 0; i < a.length; i++) { const d = Math.abs(a[i] - b[i]); if (d) { n++; if (d > max) max = d; } } return { maxDiff: max, differing: n }; };
// the caller acts after a task boundary: restoreContext() inside the lost event's dispatch is ignored
let stage = '';
const nextEvent = (target, name, ms = 10000) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error('timeout waiting for ' + name + ' at ' + stage)), ms); target.addEventListener(name, () => { clearTimeout(t); setTimeout(resolve, 0); }, { once: true });  });

/** Context loss / restore, and renderer.dispose(): pixels must match before and after; dispose must free every GL object. */
export async function runContextTests(T, { size = 128 } = {}) {
	const out = {};
	const counters = installGLCounters();
	const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size; document.body.appendChild(canvas);
	canvas.addEventListener('webglcontextrestored', () => counters.reset()); // before the renderer's own listener
	canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
	const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: false, preserveDrawingBuffer: true });
	renderer.setSize(size, size, false);
	renderer.shadowMap.enabled = true;
	const live = () => Object.fromEntries(GL_KINDS.map((k) => [k.toLowerCase(), counters.live[k]]));
	const total = () => Object.values(live()).reduce((a, b) => a + b, 0);
	const frame = (c) => { for (const q of c.quads) q.visible = false; renderer.setRenderTarget(c.targets[0]); renderer.render(c.scene, c.camera2); renderer.setRenderTarget(null); for (const q of c.quads) q.visible = true; c.scene.rotation.y = 0.3; renderer.render(c.scene, c.camera); return readAll(renderer); };

	// 1. context loss and restore
	let c = buildContent(T, renderer, 1);
	frame(c); const before = frame(c);
	const errorsBefore = renderer.info.render.calls;
	stage = 'first loss';
	renderer.forceContextLoss();
	await nextEvent(canvas, 'webglcontextlost');
	let threw = null; try { renderer.render(c.scene, c.camera); } catch (e) { threw = String(e); }
	out.renderWhileLost = threw === null ? 'ok (no throw)' : 'THROWS ' + threw;
	stage = 'first restore';
	const restored = nextEvent(canvas, 'webglcontextrestored');
	renderer.forceContextRestore();
	await restored;
	frame(c); const after = frame(c);
	out.restorePixels = diff(before, after);
	out.restoreInfo = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length };
	// a second loss/restore cycle, with the scene modified in between
	stage = 'second loss';
	renderer.forceContextLoss(); await nextEvent(canvas, 'webglcontextlost');
	c.scene.children[0].material.color.set(0xff0000);
	stage = 'second restore';
	const restored2 = nextEvent(canvas, 'webglcontextrestored'); renderer.forceContextRestore(); await restored2;
	frame(c); const after2 = frame(c);
	out.restorePixels2 = diff(before, after2); // the changed colour makes a few pixels differ
	c.scene.children[0].material.color.set(0x336699);
	out.restorePixels3 = diff(before, frame(c));

	// 2. dispose everything the three.js way, then the renderer
	disposeContent(c); c = null;
	renderer.render(new T.Scene(), new T.PerspectiveCamera());
	out.afterAssetsDisposed = live();

	// 3. renderer.dispose() with assets still alive
	let c2 = buildContent(T, renderer, 2);
	frame(c2); const ref = frame(c2);
	out.liveBeforeRendererDispose = total();
	renderer.dispose();
	out.afterRendererDispose = live();
	out.infoAfterDispose = { geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length };
	// the renderer keeps working (three.js allows rendering after dispose(); everything is re-created lazily)
	let reuse = null; try { frame(c2); var again = frame(c2); } catch (e) { reuse = String(e); }
	out.renderAfterDispose = reuse === null ? diff(ref, again) : 'THROWS ' + reuse;
	disposeContent(c2);
	renderer.dispose();
	out.afterSecondDispose = live();
	return out;
}

/** Materials, geometries and textures dropped without dispose(): jrs-internal slots / groups must come back through GC. */
export async function runNoDispose(T, { cycles = 6 } = {}) {
	const counters = installGLCounters();
	const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; document.body.appendChild(canvas);
	const renderer = new T.WebGLRenderer({ canvas, antialias: false });
	renderer.setSize(64, 64, false);
	const rows = [];
	for (let i = 0; i <= cycles; i++) {
		if (i > 0) {
			let c = buildContent(T, renderer, i);
			renderContent(renderer, c);
			c = null; // no dispose at all
		}
		await gcNow(); await gcNow();
		rows.push({ cycle: i, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, programs: renderer.info.programs.length, buffer: counters.live.Buffer, texture: counters.live.Texture, program: counters.live.Program, ...sizes(renderer) });
	}
	return rows;
}
