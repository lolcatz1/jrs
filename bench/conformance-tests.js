// Device conformance checks for jrs. Each test renders a small scene and probes pixels.
// Expected values are tolerant: GPUs differ in rounding, so tests check structure
// (brighter than / equal to within N) rather than exact bytes where appropriate.

function readPixel(renderer, x, y) {
	const gl = renderer.getContext();
	const px = new Uint8Array(4);
	gl.readPixels(x, gl.drawingBufferHeight - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return Array.from(px);
}
function readAll(renderer) {
	const gl = renderer.getContext();
	const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
	gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return px;
}
const near = (px, rgb, tol = 6) => Math.abs(px[0] - rgb[0]) <= tol && Math.abs(px[1] - rgb[1]) <= tol && Math.abs(px[2] - rgb[2]) <= tol;
const lum = (px) => (px[0] + px[1] + px[2]) / 3;
const fmt = (px) => `[${px.slice(0, 3).join(',')}]`;

function baseScene(T, camZ = 5) {
	const scene = new T.Scene();
	scene.background = new T.Color(0x000040);
	const camera = new T.PerspectiveCamera(50, 1, 0.1, 100);
	camera.position.z = camZ;
	return { scene, camera };
}


// ---------------------------------------------------------------------------
// environment maps: the same scene is built with jrs and with three.js (when a three.js renderer is
// available, see conformance.html) and the two images are compared pixel for pixel.
// ---------------------------------------------------------------------------

/** Seeded, library-independent procedural equirectangular sky: gradient + sun blob + a coloured band. */
function equirectData(w, h) {
	const data = new Uint8Array(w * h * 4);
	for (let y = 0; y < h; y++) {
		const v = (y + 0.5) / h; // 0 = bottom (-Y) .. 1 = top (+Y)
		for (let x = 0; x < w; x++) {
			const u = (x + 0.5) / w;
			let r, g, b;
			if (v > 0.5) { const t = (v - 0.5) * 2; r = 90 + 40 * (1 - t); g = 140 + 60 * (1 - t); b = 255; } // sky
			else { const t = v * 2; r = 110 * t + 40; g = 80 * t + 30; b = 40 * t + 20; } // ground
			const du = Math.min(Math.abs(u - 0.72), 1 - Math.abs(u - 0.72)), dv = v - 0.78;
			const sun = Math.exp(-(du * du * 60 + dv * dv * 60) * 8);
			r += 255 * sun; g += 240 * sun; b += 180 * sun;
			if (u > 0.2 && u < 0.3 && v > 0.4 && v < 0.6) { r = 255; g = 40; b = 40; } // red billboard
			if (u > 0.5 && u < 0.52) { r = 255; g = 255; b = 255; } // thin bright stripe
			const i = (y * w + x) * 4;
			data[i] = Math.min(255, r | 0); data[i + 1] = Math.min(255, g | 0); data[i + 2] = Math.min(255, b | 0); data[i + 3] = 255;
		}
	}
	return data;
}
function equirectTexture(T, w = 128, h = 64, colorSpace = null) {
	const tex = new T.DataTexture(equirectData(w, h), w, h, T.RGBAFormat, T.UnsignedByteType);
	tex.mapping = T.EquirectangularReflectionMapping;
	tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter;
	if (colorSpace) tex.colorSpace = colorSpace;
	tex.needsUpdate = true;
	return tex;
}
/** Six 4x4 faces with distinct colours and a diagonal gradient, so reflections carry direction information. */
function cubeTexture(T, mapping) {
	const base = [[255, 40, 40], [40, 255, 40], [40, 40, 255], [255, 255, 40], [40, 255, 255], [255, 40, 255]];
	const faces = base.map((c) => {
		const d = new Uint8Array(4 * 4 * 4);
		for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const k = (x + y) / 6, i = (y * 4 + x) * 4; d[i] = c[0] * (1 - k) + 255 * k; d[i + 1] = c[1] * (1 - k) + 255 * k; d[i + 2] = c[2] * (1 - k) + 255 * k; d[i + 3] = 255; }
		return new T.DataTexture(d, 4, 4, T.RGBAFormat, T.UnsignedByteType);
	});
	const tex = new T.CubeTexture(faces);
	if (mapping !== undefined) tex.mapping = mapping;
	tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false;
	tex.needsUpdate = true;
	return tex;
}
function diffImagesEnv(a, b) {
	let sum = 0, maxd = 0, differing = 0, over16 = 0;
	for (let i = 0; i < a.length; i += 4) {
		const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
		sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
		if (d > maxd) maxd = d; if (d > 0) differing++; if (d > 16) over16++;
	}
	const n = a.length / 4;
	return { mean: +(sum / (n * 3)).toFixed(3), max: maxd, differing, fractionOver16: over16 / n };
}
/**
 * Renders `build(T, renderer)` -> { scene, camera } with jrs and (if available) with three.js and
 * compares the images. `probe(px)` is the fallback sanity check when three.js is not available.
 */
function compareWithThree(T, renderer, ref, build, probe, limits = { mean: 0.1, max: 8 }) {
	const run = (lib, r) => { const { scene, camera } = build(lib, r); r.render(scene, camera); return readAll(r); };
	const ours = run(T, renderer);
	if (!ref || !ref.THREE || !ref.renderer) {
		const ok = probe ? probe(ours) : true;
		return { pass: ok, detail: 'three.js not available here: probe only' + (ok ? ' (ok)' : ' (failed)') };
	}
	const theirs = run(ref.THREE, ref.renderer);
	const d = diffImagesEnv(ours, theirs);
	const pass = d.mean <= limits.mean && d.max <= limits.max && (!probe || probe(ours));
	return { pass, detail: `vs three.js r${ref.THREE.REVISION}: mean abs diff ${d.mean}, max ${d.max}, ${d.differing} of ${ours.length / 4} pixels differ${d.fractionOver16 > 0 ? ` (${(100 * d.fractionOver16).toFixed(3)}% by >16)` : ''}` };
}
const notBackground = (px) => { let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] !== 0 || px[i + 1] !== 0 || px[i + 2] !== 64) n++; return n > px.length / 4 * 0.05; };

export const SIZE = 256;

/** Procedural skinned cylinder: 2 bones along Y (root at the bottom, child in the middle), weights blend across the middle. */
export function buildSkinnedCylinder(T, bend, Ctor) {
	const geometry = new T.CylinderGeometry(0.5, 0.5, 4, 24, 24);
	const position = geometry.attributes.position, count = position.count;
	const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) {
		const y = position.getY(i);
		const w1 = Math.min(1, Math.max(0, (y + 0.5) / 1.0));
		skinIndex[i * 4] = 0; skinIndex[i * 4 + 1] = 1;
		skinWeight[i * 4] = 1 - w1; skinWeight[i * 4 + 1] = w1;
	}
	geometry.setAttribute('skinIndex', new T.BufferAttribute(skinIndex, 4));
	geometry.setAttribute('skinWeight', new T.BufferAttribute(skinWeight, 4));
	const material = new T.MeshLambertMaterial({ color: 0x88bbff });
	const mesh = new (Ctor || T.SkinnedMesh)(geometry, material);
	const root = new T.Bone(); root.name = 'root'; root.position.y = -2;
	const child = new T.Bone(); child.name = 'child'; child.position.y = 2;
	root.add(child);
	mesh.add(root);
	if (mesh.isSkinnedMesh) { mesh.bind(new T.Skeleton([root, child])); }
	child.rotation.z = bend;
	return { mesh, root, child, geometry, material };
}
/** Procedural morphing boxes: absolute position+normal targets, relative position targets, colour targets. */
export function buildMorphBoxes(T, influences) {
	const group = new T.Group();
	const base = new T.BoxGeometry(1, 1, 1, 3, 3, 3);
	const n = base.attributes.position.count;
	const stretched = new Float32Array(n * 3), twisted = new Float32Array(n * 3), normalsA = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const x = base.attributes.position.getX(i), y = base.attributes.position.getY(i), z = base.attributes.position.getZ(i);
		stretched[i * 3] = x * 1.6; stretched[i * 3 + 1] = y * 0.6; stretched[i * 3 + 2] = z * 1.6;
		const a = y * 1.2, c = Math.cos(a), s = Math.sin(a);
		twisted[i * 3] = c * x - s * z; twisted[i * 3 + 1] = y + 0.3 * Math.sin(x * 3); twisted[i * 3 + 2] = s * x + c * z;
		const nx = base.attributes.normal.getX(i), ny = base.attributes.normal.getY(i), nz = base.attributes.normal.getZ(i);
		normalsA[i * 3] = nx * 0.6; normalsA[i * 3 + 1] = ny * 1.6; normalsA[i * 3 + 2] = nz * 0.6;
	}
	// A: absolute targets (position + normal), lit
	const gA = base.clone();
	gA.morphAttributes.position = [new T.Float32BufferAttribute(stretched, 3), new T.Float32BufferAttribute(twisted, 3)];
	gA.morphAttributes.normal = [new T.Float32BufferAttribute(normalsA, 3), new T.Float32BufferAttribute(base.attributes.normal.array.slice(), 3)];
	const mA = new T.Mesh(gA, new T.MeshLambertMaterial({ color: 0xffcc66 }));
	mA.position.x = -1.3; mA.rotation.set(0.5, 0.6, 0);
	mA.morphTargetInfluences[0] = influences[0]; mA.morphTargetInfluences[1] = influences[1];
	// B: relative position targets
	const gB = base.clone();
	const relA = new Float32Array(n * 3), relB = new Float32Array(n * 3);
	for (let i = 0; i < n * 3; i++) { relA[i] = stretched[i] - base.attributes.position.array[i]; relB[i] = twisted[i] - base.attributes.position.array[i]; }
	gB.morphAttributes.position = [new T.Float32BufferAttribute(relA, 3), new T.Float32BufferAttribute(relB, 3)];
	gB.morphTargetsRelative = true;
	const mB = new T.Mesh(gB, new T.MeshLambertMaterial({ color: 0x66ddaa }));
	mB.position.x = 1.3; mB.rotation.set(0.5, 0.6, 0);
	mB.morphTargetInfluences[0] = influences[0]; mB.morphTargetInfluences[1] = influences[1];
	// C: colour targets with RGBA vertex colours (unlit). RGBA because three.js r186's morphcolor_vertex chunk
	// does not compile with RGB vertex colours (vec3 added to its vec4 vColor); jrs renders that case too.
	const gC = base.clone();
	const col = new Float32Array(n * 4), colA = new Float32Array(n * 4), colB = new Float32Array(n * 4);
	for (let i = 0; i < n; i++) { col[i * 4] = 1; col[i * 4 + 1] = 1; col[i * 4 + 2] = 1; col[i * 4 + 3] = 1; colA[i * 4] = 1; colA[i * 4 + 3] = 1; colB[i * 4 + 2] = 1; colB[i * 4 + 3] = 1; }
	gC.setAttribute('color', new T.Float32BufferAttribute(col, 4));
	gC.morphAttributes.position = [new T.Float32BufferAttribute(stretched, 3), new T.Float32BufferAttribute(twisted, 3)];
	gC.morphAttributes.color = [new T.Float32BufferAttribute(colA, 4), new T.Float32BufferAttribute(colB, 4)];
	const mC = new T.Mesh(gC, new T.MeshBasicMaterial({ vertexColors: true }));
	mC.position.y = -1.4; mC.rotation.set(0.5, 0.6, 0);
	mC.morphTargetInfluences[0] = influences[0]; mC.morphTargetInfluences[1] = influences[1];
	group.add(mA, mB, mC);
	return { group, mA, mB, mC };
}
function lightRig(T, scene) {
	const d = new T.DirectionalLight(0xffffff, 2.5); d.position.set(2, 3, 4); scene.add(d);
	scene.add(new T.AmbientLight(0xffffff, 0.4));
}
/** Pixel difference statistics between two RGBA images. */
function diffImages(a, b) {
	let maxd = 0, bad = 0, sum = 0;
	for (let i = 0; i < a.length; i += 4) {
		const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
		sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
		if (d > maxd) maxd = d; if (d > 16) bad++;
	}
	return { maxDiff: maxd, badFraction: bad / (a.length / 4), meanAbsDiff: sum / (a.length * 3 / 4) };
}
/** Renders `build(T)` -> { scene, camera } with the three.js reference renderer (when the page provides one) and compares. */
function compareWithReference(ref, build, jrsPixels) {
	if (!ref || !ref.THREE || !ref.renderer) return null;
	const { scene, camera } = build(ref.THREE);
	ref.renderer.render(scene, camera);
	const px = readAll(ref.renderer);
	return diffImages(jrsPixels, px);
}
const refOk = (d) => d === null || (d.meanAbsDiff < 0.5 && d.badFraction < 0.002);
const refDetail = (d) => d === null ? 'three.js reference not available on this page' : `vs three.js: mean ${d.meanAbsDiff.toFixed(3)}, max ${d.maxDiff}, ${(100 * d.badFraction).toFixed(3)}% of pixels differ by >16`;

/** Returns [{ name, run(T, renderer, ref) -> { pass, detail } }]; `ref` = { THREE, renderer } renders the same scene with three.js for pixel comparison. */
export function conformanceTests() {
	return [
		{
			name: 'WebGL2 context and limits', run(T, renderer) {
				const gl = renderer.getContext();
				const limits = {
					MAX_VERTEX_ATTRIBS: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
					MAX_TEXTURE_IMAGE_UNITS: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
					MAX_UNIFORM_BUFFER_BINDINGS: gl.getParameter(gl.MAX_UNIFORM_BUFFER_BINDINGS),
					MAX_UNIFORM_BLOCK_SIZE: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
					UNIFORM_BUFFER_OFFSET_ALIGNMENT: gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT),
					MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
				};
				const ok = renderer.capabilities.isWebGL2 && limits.MAX_VERTEX_ATTRIBS >= 12 && limits.MAX_TEXTURE_IMAGE_UNITS >= 16 && limits.MAX_UNIFORM_BUFFER_BINDINGS >= 3 && limits.MAX_UNIFORM_BLOCK_SIZE >= 2048;
				return { pass: ok, detail: Object.entries(limits).map(([k, v]) => `${k}=${v}`).join(' ') };
			}
		},
		{
			name: 'Unlit colour and sRGB clear colour', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.add(new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xff0000 })));
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128), bg = readPixel(renderer, 2, 2);
				return { pass: near(c, [255, 0, 0], 2) && near(bg, [0, 0, 64], 2), detail: `center ${fmt(c)} expected [255,0,0]; background ${fmt(bg)} expected [0,0,64]` };
			}
		},
		{
			name: 'Lit MeshStandardMaterial (directional + ambient)', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
				m.rotation.set(0.6, 0.7, 0); scene.add(m);
				const d = new T.DirectionalLight(0xffffff, 3); d.position.set(0, 5, 2); scene.add(d);
				scene.add(new T.AmbientLight(0xffffff, 0.2));
				renderer.render(scene, camera);
				const up = readPixel(renderer, 128, 95), low = readPixel(renderer, 128, 170);
				const grey = Math.abs(up[0] - up[1]) <= 3 && Math.abs(low[0] - low[2]) <= 3;
				return { pass: lum(up) > lum(low) + 60 && lum(low) > 20 && grey, detail: `top face ${fmt(up)} should be much brighter than side ${fmt(low)}` };
			}
		},
		{
			name: 'Unchanged Frame/Lights blocks are skipped, direct mutations still upload', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const m = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0xffffff }));
				m.rotation.set(0.6, 0.7, 0); scene.add(m);
				const d = new T.DirectionalLight(0xffffff, 1); d.position.set(0, 5, 2); scene.add(d);
				const probe = () => readPixel(renderer, 128, 95);
				renderer.render(scene, camera); const a = probe();
				renderer.render(scene, camera); const a2 = probe();
				d.intensity = 0.2; renderer.render(scene, camera); const b = probe();           // direct light mutation
				d.color.r = 0; renderer.render(scene, camera); const c = probe();                // direct colour channel mutation
				scene.fog = new T.Fog(0x402000, 1, 7); renderer.render(scene, camera); const e = probe(); // fog colour != background: a fully fogged pixel must stay distinguishable
				scene.fog.near = 0.1; scene.fog.far = 4.8; renderer.render(scene, camera); const f = probe();  // direct fog mutation
				camera.position.x = 3; renderer.render(scene, camera); const g = probe();                    // camera move
				const same = a.every((v, i) => v === a2[i]);
				const differs = (x, y) => x.some((v, i) => Math.abs(v - y[i]) > 2);
				const ok = same && differs(a, b) && differs(b, c) && differs(c, e) && differs(e, f) && differs(f, g);
				return { pass: ok, detail: `static ${fmt(a)}=${fmt(a2)}; intensity ${fmt(b)}; colour.r ${fmt(c)}; fog ${fmt(e)}; fog.near/far ${fmt(f)}; camera ${fmt(g)}` };
			}
		},
		{
			name: 'Lit MeshPhongMaterial with point and hemisphere light', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const m = new T.Mesh(new T.SphereGeometry(1, 32, 16), new T.MeshPhongMaterial({ color: 0x88aaff, shininess: 60 }));
				scene.add(m);
				const p = new T.PointLight(0xffffff, 40, 0, 2); p.position.set(2, 2, 3); scene.add(p);
				scene.add(new T.HemisphereLight(0xffffff, 0x222222, 0.6));
				renderer.render(scene, camera);
				const hi = readPixel(renderer, 150, 106), lo = readPixel(renderer, 100, 160), bg = readPixel(renderer, 2, 2);
				return { pass: lum(hi) > lum(lo) + 40 && near(bg, [0, 0, 64], 2), detail: `toward light ${fmt(hi)} vs away ${fmt(lo)}` };
			}
		},
		{
			name: 'Auto-batching renders identically to individual draws', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const d = new T.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); scene.add(d);
				scene.add(new T.AmbientLight(0xffffff, 0.3));
				const geo = new T.BoxGeometry(0.15, 0.15, 0.15), mat = new T.MeshLambertMaterial({ color: 0x33cc55 });
				for (let i = 0; i < 300; i++) { const m = new T.Mesh(geo, mat); m.position.set((i % 20 - 10) * 0.2, (Math.floor(i / 20) - 7.5) * 0.2, 0); m.rotation.set(i, i * 0.3, 0); m.scale.setScalar(1 + (i % 3) * 0.2); scene.add(m); }
				renderer.autoBatch = true; renderer.render(scene, camera);
				const a = readAll(renderer), callsA = renderer.info.render.calls;
				renderer.autoBatch = false; renderer.render(scene, camera);
				const b = readAll(renderer), callsB = renderer.info.render.calls;
				renderer.autoBatch = true;
				let maxd = 0, bad = 0;
				for (let i = 0; i < a.length; i++) { const dd = Math.abs(a[i] - b[i]); if (dd > maxd) maxd = dd; if (dd > 16) bad++; }
				return { pass: callsA === 1 && callsB === 300 && bad / a.length < 0.002, detail: `draw calls ${callsB} -> ${callsA}; max pixel diff ${maxd}, ${(100 * bad / a.length).toFixed(3)}% of pixels differ by >16` };
			}
		},
		{
			name: 'Multi-draw of different geometries renders identically to individual draws', run(T, renderer) {
				if (!renderer.multiDrawExt) return { pass: true, detail: 'skipped: WEBGL_multi_draw not available on this device (instanced batching is used instead)' };
				const { scene, camera } = baseScene(T);
				const d = new T.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); scene.add(d);
				scene.add(new T.AmbientLight(0xffffff, 0.3));
				const geos = [new T.BoxGeometry(0.15, 0.15, 0.15), new T.SphereGeometry(0.1, 8, 6), new T.ConeGeometry(0.08, 0.2, 7), new T.TorusGeometry(0.08, 0.03, 6, 10), new T.PlaneGeometry(0.2, 0.2).toNonIndexed()];
				const mat = new T.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.5 }), mat2 = new T.MeshLambertMaterial({ color: 0x4488cc });
				// every mesh gets its own geometry object (as in a scene of unique parts), so the run is multi-drawn
				for (let i = 0; i < 300; i++) { const m = new T.Mesh(geos[i % 5].clone(), i % 7 === 0 ? mat2 : mat); m.position.set((i % 20 - 10) * 0.2, (Math.floor(i / 20) - 7.5) * 0.2, 0); m.rotation.set(i, i * 0.3, 0); m.scale.set(1 + (i % 3) * 0.2, 1, 1 + (i % 2) * 0.3); scene.add(m); }
				renderer.autoMultiDraw = true; renderer.render(scene, camera);
				const a = readAll(renderer), callsA = renderer.info.render.calls;
				renderer.autoMultiDraw = false; renderer.autoBatch = false; renderer.render(scene, camera);
				const b = readAll(renderer), callsB = renderer.info.render.calls;
				renderer.autoMultiDraw = true; renderer.autoBatch = true;
				let maxd = 0, bad = 0;
				for (let i = 0; i < a.length; i++) { const dd = Math.abs(a[i] - b[i]); if (dd > maxd) maxd = dd; if (dd > 16) bad++; }
				const glErr = renderer.getContext().getError();
				return { pass: callsA <= 8 && callsB === 300 && bad / a.length < 0.002 && glErr === 0, detail: `draw calls ${callsB} -> ${callsA} (5 geometries, 2 materials, indexed and non-indexed); max pixel diff ${maxd}, ${(100 * bad / a.length).toFixed(3)}% of pixels differ by >16` };
			}
		},
		{
			name: 'Batches spanning materials render identically to individual draws', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const d = new T.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); scene.add(d);
				const p = new T.PointLight(0xffffff, 20, 0, 2); p.position.set(-2, 1, 3); scene.add(p);
				scene.add(new T.AmbientLight(0xffffff, 0.3));
				const geos = [new T.BoxGeometry(0.15, 0.15, 0.15), new T.SphereGeometry(0.1, 8, 6), new T.ConeGeometry(0.08, 0.2, 7)];
				const data = new Uint8Array([255, 255, 255, 255, 128, 128, 128, 255, 128, 128, 128, 255, 255, 255, 255, 255]);
				const tex = new T.DataTexture(data, 2, 2, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
				// 40 materials of one program: different colours, shininess, emissive, uv transforms; a few textured (same texture) or double-sided
				const mats = [];
				for (let i = 0; i < 40; i++) {
					const m = new T.MeshPhongMaterial({ color: new T.Color().setHSL(i / 40, 0.8, 0.5), shininess: 5 + i * 4, emissive: new T.Color(i % 5 === 0 ? 0x200010 : 0) });
					if (i % 9 === 0) { m.map = tex; m.map.offset.set(0.25 * i, 0); }
					if (i % 11 === 0) m.side = T.DoubleSide;
					mats.push(m);
				}
				for (let i = 0; i < 300; i++) { const m = new T.Mesh(geos[i % 3], mats[(i * 7) % 40]); m.position.set((i % 20 - 10) * 0.2, (Math.floor(i / 20) - 7.5) * 0.2, 0); m.rotation.set(i, i * 0.3, 0); m.scale.setScalar(1 + (i % 3) * 0.2); scene.add(m); }
				renderer.autoBatch = true; renderer.autoBatchMaterials = true; renderer.render(scene, camera);
				const a = readAll(renderer), callsA = renderer.info.render.calls;
				renderer.autoBatchMaterials = false; renderer.render(scene, camera);
				const callsM = renderer.info.render.calls;
				renderer.autoBatch = false; renderer.render(scene, camera);
				const b = readAll(renderer), callsB = renderer.info.render.calls;
				renderer.autoBatch = true; renderer.autoBatchMaterials = true;
				let maxd = 0;
				for (let i = 0; i < a.length; i++) { const dd = Math.abs(a[i] - b[i]); if (dd > maxd) maxd = dd; }
				const glErr = renderer.getContext().getError();
				const supported = renderer._materialArrayOk === true;
				return { pass: (!supported || callsA <= 12) && callsM > callsA && callsB === 300 && maxd === 0 && glErr === 0, detail: `draw calls ${callsB} -> ${callsM} (per material) -> ${callsA} (material-index batching${supported ? '' : ', not supported on this device'}); max pixel diff ${maxd}` };
			}
		},
		{
			name: 'InstancedMesh', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.add(new T.AmbientLight(0xffffff, 3));
				const im = new T.InstancedMesh(new T.SphereGeometry(0.4, 12, 8), new T.MeshLambertMaterial({ color: 0xffff00 }), 3);
				const m4 = new T.Matrix4();
				for (let i = 0; i < 3; i++) { m4.makeTranslation((i - 1) * 1.2, 0, 0); im.setMatrixAt(i, m4); }
				scene.add(im);
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128), side = readPixel(renderer, 128 + 54, 128), gap = readPixel(renderer, 128 + 27, 128);
				return { pass: c[0] > 150 && c[1] > 150 && c[2] < 30 && side[0] > 150 && near(gap, [0, 0, 64], 2) && renderer.info.render.calls === 1, detail: `center ${fmt(c)}, neighbour ${fmt(side)}, gap ${fmt(gap)}, calls ${renderer.info.render.calls}` };
			}
		},
		{
			name: 'Transparency and depth sorting', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const a = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 }));
				const b = new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }));
				b.position.z = 1; scene.add(a, b);
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128);
				// background 0x000040 -> blue plane -> red plane: red ~127, blue reduced
				return { pass: c[0] > 100 && c[0] < 160 && c[2] > 40 && c[2] < 140 && c[1] < 10, detail: `blended centre ${fmt(c)} expected about [127,0,80]` };
			}
		},
		{
			name: 'DataTexture map with nearest filtering', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const data = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
				const tex = new T.DataTexture(data, 2, 2, T.RGBAFormat, T.UnsignedByteType);
				tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter; tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ map: tex })));
				renderer.render(scene, camera);
				const bl = readPixel(renderer, 90, 166), br = readPixel(renderer, 166, 166), tl = readPixel(renderer, 90, 90), tr = readPixel(renderer, 166, 90);
				return { pass: near(bl, [255, 0, 0], 3) && near(br, [0, 255, 0], 3) && near(tl, [0, 0, 255], 3) && near(tr, [255, 255, 255], 3), detail: `quadrants ${fmt(bl)} ${fmt(br)} ${fmt(tl)} ${fmt(tr)}` };
			}
		},
		{
			name: 'CanvasTexture map', run(T, renderer) {
				if (typeof document === 'undefined') return { pass: true, detail: 'skipped (no DOM)' };
				const { scene, camera } = baseScene(T);
				const cv = document.createElement('canvas'); cv.width = cv.height = 64;
				const ctx = cv.getContext('2d'); ctx.fillStyle = '#4080ff'; ctx.fillRect(0, 0, 64, 64);
				const tex = new T.CanvasTexture(cv); tex.colorSpace = T.SRGBColorSpace;
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), new T.MeshBasicMaterial({ map: tex })));
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128);
				return { pass: near(c, [64, 128, 255], 4), detail: `centre ${fmt(c)} expected [64,128,255]` };
			}
		},
		{
			name: 'Vertex colours', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const g = new T.PlaneGeometry(3, 3);
				g.setAttribute('color', new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 1], 3));
				scene.add(new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true })));
				renderer.render(scene, camera);
				const tl = readPixel(renderer, 60, 60), tr = readPixel(renderer, 196, 60);
				return { pass: tl[0] > tl[1] + 60 && tr[1] > tr[0] + 60, detail: `top-left ${fmt(tl)} reddish, top-right ${fmt(tr)} greenish` };
			}
		},
		{
			name: 'Fog', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.fog = new T.Fog(0x000040, 3, 12);
				const n = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0xffffff })); n.position.set(-1, 0, 1); scene.add(n);
				const f = new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshBasicMaterial({ color: 0xffffff })); f.position.set(1.5, 0, -6); scene.add(f);
				renderer.render(scene, camera);
				const nearPx = readPixel(renderer, 70, 128), farPx = readPixel(renderer, 165, 128);
				return { pass: lum(nearPx) > lum(farPx) + 60 && farPx[2] > farPx[0] + 10, detail: `near ${fmt(nearPx)} far ${fmt(farPx)} (far should fade toward fog colour)` };
			}
		},
		{
			name: 'Lines and Points', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-2, 0, 0), new T.Vector3(2, 0, 0)]), new T.LineBasicMaterial({ color: 0xffffff })));
				scene.add(new T.Points(new T.BufferGeometry().setFromPoints([new T.Vector3(0, 1, 0)]), new T.PointsMaterial({ color: 0x00ff00, size: 12, sizeAttenuation: false })));
				renderer.render(scene, camera);
				const line = readPixel(renderer, 64, 128), pt = readPixel(renderer, 128, 128 - 55);
				return { pass: lum(line) > 200 && pt[1] > 200 && pt[0] < 40, detail: `line ${fmt(line)}, point ${fmt(pt)}` };
			}
		},
		{
			name: 'Sprite', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const s = new T.Sprite(new T.SpriteMaterial({ color: 0xff00ff })); s.scale.set(1.5, 1.5, 1); scene.add(s);
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128), bg = readPixel(renderer, 20, 20);
				return { pass: near(c, [255, 0, 255], 3) && near(bg, [0, 0, 64], 2), detail: `centre ${fmt(c)} expected [255,0,255]` };
			}
		},
		{
			name: 'ShaderMaterial (GLSL 1.00 source, three.js uniforms)', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const mat = new T.ShaderMaterial({
					uniforms: { tint: { value: new T.Color(0x00ffff) } },
					vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
					fragmentShader: 'uniform vec3 tint; varying vec2 vUv; void main(){ gl_FragColor = vec4(tint * step(0.5, vUv.x) + vec3(1.0,0.0,0.0) * (1.0 - step(0.5, vUv.x)), 1.0); }',
				});
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), mat));
				renderer.render(scene, camera);
				const l = readPixel(renderer, 90, 128), r = readPixel(renderer, 166, 128);
				return { pass: near(l, [255, 0, 0], 3) && near(r, [0, 255, 255], 3), detail: `left ${fmt(l)} right ${fmt(r)}` };
			}
		},
		{
			name: 'Directional shadow map', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				renderer.shadowMap.enabled = true;
				const floor = new T.Mesh(new T.PlaneGeometry(10, 10), new T.MeshLambertMaterial({ color: 0xffffff }));
				floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);
				const box = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshLambertMaterial({ color: 0xffffff })); box.castShadow = true; scene.add(box);
				const sun = new T.DirectionalLight(0xffffff, 3); sun.position.set(4, 5, 0); sun.castShadow = true; scene.add(sun);
				scene.add(new T.AmbientLight(0xffffff, 0.3));
				camera.position.set(0, 4, 6); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
				renderer.render(scene, camera);
				const px = (x, y, z) => { const v = new T.Vector3(x, y, z).project(camera); return [Math.round((v.x + 1) * 128), Math.round((1 - v.y) * 128)]; };
				const s = px(-0.9, -1, 0), l = px(2.5, -1, 0);
				const inShadow = readPixel(renderer, s[0], s[1]), lit = readPixel(renderer, l[0], l[1]);
				renderer.shadowMap.enabled = false;
				return { pass: lum(inShadow) < lum(lit) * 0.5 && lum(lit) > 120, detail: `in shadow ${fmt(inShadow)} vs lit floor ${fmt(lit)}` };
			}
		},
		{
			name: 'Point light shadow map (cube depth, PCF and BasicShadowMap)', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				renderer.shadowMap.enabled = true;
				const mat = () => new T.MeshLambertMaterial({ color: 0xffffff });
				const floor = new T.Mesh(new T.PlaneGeometry(10, 10), mat());
				floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);
				const wall = new T.Mesh(new T.PlaneGeometry(10, 10), mat());
				wall.position.z = -3; wall.receiveShadow = true; scene.add(wall);
				const box = new T.Mesh(new T.BoxGeometry(1, 1, 1), mat()); box.castShadow = true; scene.add(box);
				const lamp = new T.PointLight(0xffffff, 120); lamp.position.set(0, 3, 0); lamp.castShadow = true; lamp.shadow.bias = -0.001; scene.add(lamp);
				scene.add(new T.AmbientLight(0xffffff, 0.3));
				camera.position.set(4, 3, 6); camera.lookAt(0, -0.5, -1); camera.updateMatrixWorld();
				const px = (x, y, z) => { const v = new T.Vector3(x, y, z).project(camera); return [Math.round((v.x + 1) * 128), Math.round((1 - v.y) * 128)]; };
				const probe = (p) => readPixel(renderer, p[0], p[1]);
				const under = px(0, -1, 0), lit = px(2.2, -1, 0.6);
				const out = {};
				for (const [label, type] of [['pcf', T.PCFShadowMap], ['basic', T.BasicShadowMap]]) {
					renderer.shadowMap.type = type;
					renderer.render(scene, camera);
					out[label] = { shadow: probe(under), lit: probe(lit) };
				}
				// the light now sits in front of the box: its shadow falls on the wall behind (the -Z cube face)
				lamp.position.set(0, 0.2, 3); renderer.shadowMap.type = T.PCFShadowMap; renderer.render(scene, camera);
				const wallShadow = probe(px(0, 0.2, -3)), wallLit = probe(px(2.6, 0.2, -3));
				// a second casting point light must not mix up the cube maps
				const lamp2 = new T.PointLight(0xffffff, 120); lamp2.position.set(-3, 2, 3); lamp2.castShadow = true; scene.add(lamp2);
				renderer.render(scene, camera);
				const two = probe(px(0, 0.2, -3));
				renderer.shadowMap.enabled = false; renderer.shadowMap.type = T.PCFShadowMap;
				const ok = (r) => lum(r.shadow) < lum(r.lit) * 0.6 && lum(r.lit) > 60;
				const wallOk = lum(wallShadow) < lum(wallLit) * 0.6 && lum(wallLit) > 40;
				return { pass: ok(out.pcf) && ok(out.basic) && wallOk && lum(two) < lum(wallLit), detail: `PCF in shadow ${fmt(out.pcf.shadow)} vs lit ${fmt(out.pcf.lit)}; Basic ${fmt(out.basic.shadow)} vs ${fmt(out.basic.lit)}; wall shadow ${fmt(wallShadow)} vs lit ${fmt(wallLit)}; with a second casting light ${fmt(two)}` };
			}
		},
		{
			name: 'Render target + readRenderTargetPixels', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.add(new T.Mesh(new T.BoxGeometry(2, 2, 2), new T.MeshBasicMaterial({ color: 0x00ff00 })));
				const rt = new T.WebGLRenderTarget(64, 64);
				renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null);
				const buf = new Uint8Array(4); renderer.readRenderTargetPixels(rt, 32, 32, 1, 1, buf);
				rt.dispose();
				return { pass: buf[1] > 240 && buf[0] < 10, detail: `render target centre ${fmt(Array.from(buf))}` };
			}
		},

		{
			name: 'Stencil state per material (mask and test)', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				// pass 1: write stencil = 1 where a small quad is, without touching colour
				const marker = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilRef: 1, stencilZPass: T.ReplaceStencilOp, stencilZFail: T.ReplaceStencilOp, stencilFail: T.ReplaceStencilOp }));
				marker.renderOrder = 0; scene.add(marker);
				// pass 2: big green quad drawn only where stencil == 1
				const fill = new T.Mesh(new T.PlaneGeometry(4, 4), new T.MeshBasicMaterial({ color: 0x00ff00, stencilWrite: true, stencilFunc: T.EqualStencilFunc, stencilRef: 1, stencilFuncMask: 0xff, stencilWriteMask: 0, stencilZPass: T.KeepStencilOp }));
				fill.renderOrder = 1; fill.position.z = 0.1; scene.add(fill);
				renderer.clear(true, true, true);
				renderer.render(scene, camera);
				const inside = readPixel(renderer, 128, 128), outside = readPixel(renderer, 40, 40);
				return { pass: near(inside, [0, 255, 0], 3) && near(outside, [0, 0, 64], 2), detail: `inside marker ${fmt(inside)} (green), outside ${fmt(outside)} (background). Needs a renderer created with { stencil: true }.` };
			}
		},
		{
			name: 'Data3DTexture sampled through sampler3D', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const size = 4, data = new Uint8Array(size * size * size * 4);
				for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
					const i = (z * size * size + y * size + x) * 4;
					data[i] = x * 85; data[i + 1] = y * 85; data[i + 2] = z * 85; data[i + 3] = 255;
				}
				const tex = new T.Data3DTexture(data, size, size, size);
				tex.format = T.RGBAFormat; tex.type = T.UnsignedByteType; tex.needsUpdate = true;
				const mat = new T.ShaderMaterial({
					uniforms: { grid: { value: tex }, slice: { value: 0.875 } },
					vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
					fragmentShader: 'precision highp sampler3D; uniform sampler3D grid; uniform float slice; varying vec2 vUv; void main(){ gl_FragColor = texture(grid, vec3(vUv, slice)); }',
				});
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), mat));
				renderer.render(scene, camera);
				// the 3-unit plane spans pixels 46..210; probe the corner cells and one inner cell
				const bl = readPixel(renderer, 50, 205), tr = readPixel(renderer, 205, 50), inner = readPixel(renderer, 90, 166);
				// nearest filtering, slice z=3: cell (0,0) -> [0,0,255]; cell (3,3) -> [255,255,255]; cell (1,1) -> [85,85,255]
				return { pass: near(bl, [0, 0, 255], 3) && near(tr, [255, 255, 255], 3) && near(inner, [85, 85, 255], 3), detail: `cells ${fmt(bl)} ${fmt(inner)} ${fmt(tr)} expected [0,0,255] [85,85,255] [255,255,255]` };
			}
		},
		{
			name: 'DataArrayTexture sampled through sampler2DArray', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const w = 2, h = 2, layers = 3, data = new Uint8Array(w * h * layers * 4);
				const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255]];
				for (let l = 0; l < layers; l++) for (let i = 0; i < w * h; i++) { const o = (l * w * h + i) * 4; data[o] = colors[l][0]; data[o + 1] = colors[l][1]; data[o + 2] = colors[l][2]; data[o + 3] = 255; }
				const tex = new T.DataArrayTexture(data, w, h, layers); tex.format = T.RGBAFormat; tex.type = T.UnsignedByteType; tex.needsUpdate = true;
				const mat = new T.ShaderMaterial({
					uniforms: { atlas: { value: tex }, layer: { value: 2 } },
					vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
					fragmentShader: 'precision highp sampler2DArray; uniform sampler2DArray atlas; uniform int layer; varying vec2 vUv; void main(){ gl_FragColor = texture(atlas, vec3(vUv, float(layer))); }',
				});
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), mat));
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128);
				// update a single layer and re-render
				for (let i = 0; i < w * h; i++) { const o = (2 * w * h + i) * 4; data[o] = 255; data[o + 1] = 255; data[o + 2] = 0; }
				tex.addLayerUpdate(2); tex.needsUpdate = true;
				renderer.render(scene, camera);
				const c2 = readPixel(renderer, 128, 128);
				return { pass: near(c, [0, 0, 255], 3) && near(c2, [255, 255, 0], 3), detail: `layer 2 ${fmt(c)} expected [0,0,255]; after layer update ${fmt(c2)} expected [255,255,0]` };
			}
		},
		{
			name: 'CubeTexture sampled through samplerCube', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const faces = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]].map((c) => ({ data: new Uint8Array([c[0], c[1], c[2], 255]), width: 1, height: 1 }));
				const tex = new T.CubeTexture(faces); tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
				const mat = new T.ShaderMaterial({
					uniforms: { env: { value: tex } },
					vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
					fragmentShader: 'uniform samplerCube env; varying vec3 vDir; void main(){ gl_FragColor = textureCube(env, normalize(vDir)); }',
				});
				scene.add(new T.Mesh(new T.BoxGeometry(2, 2, 2), mat));
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128); // +Z face -> cyan
				return { pass: near(c, [0, 255, 255], 3), detail: `front face ${fmt(c)} expected [0,255,255] (+Z)` };
			}
		},
		{
			name: 'ShaderMaterial with #include chunks, fog uniforms and struct array uniforms', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				scene.fog = new T.Fog(0x000040, 1, 20);
				const mat = new T.ShaderMaterial({
					fog: true,
					uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { lights2: { value: [{ color: new T.Color(1, 0, 0), weight: 0.25 }, { color: new T.Color(0, 1, 0), weight: 0.75 }] }, scales: { value: [0.5, 2.0] } }]),
					vertexShader: '#include <common>\n#include <fog_pars_vertex>\nvoid main(){ vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}',
					fragmentShader: '#include <common>\n#include <fog_pars_fragment>\nstruct L { vec3 color; float weight; }; uniform L lights2[2]; uniform float scales[2];\nvoid main(){ vec3 c = vec3(0.0); for (int i = 0; i < 2; i++) c += lights2[i].color * lights2[i].weight * scales[i]; gl_FragColor = vec4(saturate(c), 1.0);\n#include <fog_fragment>\n}',
				});
				scene.add(new T.Mesh(new T.PlaneGeometry(3, 3), mat));
				renderer.render(scene, camera);
				const c = readPixel(renderer, 128, 128);
				// colour = (0.125, 1.5 -> 1, 0), fog factor smoothstep(1, 20, 5) = 0.114 toward the scene fog colour,
				// which stays linear (0.0144 blue) because the shader does not include <colorspace_fragment>, as in three.js
				return { pass: near(c, [27, 226, 1], 4), detail: `centre ${fmt(c)} expected [27,226,1] (scene fog colour applied, struct/array uniforms summed)` };
			}
		},
		{
			name: 'Custom vertex attributes and InstancedBufferGeometry', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const geo = new T.InstancedBufferGeometry();
				geo.setAttribute('position', new T.Float32BufferAttribute([-0.4, -0.4, 0, 0.4, -0.4, 0, 0.4, 0.4, 0, -0.4, 0.4, 0], 3));
				geo.setIndex([0, 1, 2, 0, 2, 3]);
				geo.setAttribute('offset', new T.InstancedBufferAttribute(new Float32Array([-1.2, 0, 0, 0, 0, 0, 1.2, 0, 0]), 3));
				geo.setAttribute('tint', new T.InstancedBufferAttribute(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), 3));
				geo.setAttribute('scaleFactor', new T.InstancedBufferAttribute(new Float32Array([1, 1.5, 1]), 1));
				geo.instanceCount = 3;
				const mat = new T.ShaderMaterial({
					vertexShader: 'attribute vec3 offset; attribute vec3 tint; attribute float scaleFactor; varying vec3 vTint; void main(){ vTint = tint; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * scaleFactor + offset, 1.0); }',
					fragmentShader: 'varying vec3 vTint; void main(){ gl_FragColor = vec4(vTint, 1.0); }',
				});
				scene.add(new T.Mesh(geo, mat));
				renderer.render(scene, camera);
				const l = readPixel(renderer, 128 - 54, 128), m = readPixel(renderer, 128, 128), r = readPixel(renderer, 128 + 54, 128);
				return { pass: near(l, [255, 0, 0], 3) && near(m, [0, 255, 0], 3) && near(r, [0, 0, 255], 3) && renderer.info.render.calls === 1, detail: `instances ${fmt(l)} ${fmt(m)} ${fmt(r)}, calls ${renderer.info.render.calls}` };
			}
		},

		{
			name: 'Shared null sampler uniforms (2D/3D/array/cube) assigned after creation', run(T, renderer) {
				const gl = renderer.getContext();
				const { scene, camera } = baseScene(T);
				// one shared uniforms object, spread into two materials like a material factory would
				const shared = { a: { value: null }, b: { value: null }, c: { value: null }, d: { value: null } };
				const vs = 'varying vec2 vUv; varying vec3 vDir; void main(){ vUv = uv; vDir = vec3(uv * 2.0 - 1.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
				const fs = 'precision highp sampler3D; precision highp sampler2DArray; uniform sampler2D a; uniform sampler3D b; uniform sampler2DArray c; uniform samplerCube d; varying vec2 vUv; varying vec3 vDir;\n' +
					'void main(){ if (vUv.y > 0.5) { gl_FragColor = vUv.x < 0.5 ? texture2D(a, vUv) : vec4(texture(b, vec3(vUv, 0.5)).r, 0.0, 0.0, 1.0); } else { gl_FragColor = vUv.x < 0.5 ? texture(c, vec3(vUv, 1.0)) : textureCube(d, vDir); } }';
				const m1 = new T.ShaderMaterial({ uniforms: { ...shared }, vertexShader: vs, fragmentShader: fs });
				const m2 = new T.ShaderMaterial({ uniforms: { ...shared, extra: { value: 1 } }, vertexShader: vs, fragmentShader: fs });
				const q1 = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), m1); q1.position.x = -0.8;
				const q2 = new T.Mesh(new T.PlaneGeometry(1.4, 1.4), m2); q2.position.x = 0.8;
				scene.add(q1, q2);
				gl.getError();
				renderer.render(scene, camera); // all samplers null: placeholders must keep the program valid
				const errNull = gl.getError();
				const nullPx = readPixel(renderer, 128 - 44 - 20, 128 - 20);
				// now assign textures by mutating the shared uniform objects (never touching the materials)
				const rt = new T.WebGLRenderTarget(8, 8);
				const rtScene = new T.Scene(); rtScene.background = new T.Color(0xff8000);
				renderer.setRenderTarget(rt); renderer.render(rtScene, camera); renderer.setRenderTarget(null);
				shared.a.value = rt.texture;
				const vol = new Uint8Array(8 * 8 * 8).fill(128);
				const b = new T.Data3DTexture(vol, 8, 8, 8); b.format = T.RedFormat; b.type = T.UnsignedByteType;
				b.wrapS = b.wrapT = b.wrapR = T.RepeatWrapping; b.minFilter = T.LinearMipmapLinearFilter; b.magFilter = T.LinearFilter; b.generateMipmaps = true; b.needsUpdate = true;
				shared.b.value = b;
				const layers = new Uint8Array(2 * 2 * 2 * 4); for (let i = 0; i < 4; i++) { layers[i * 4 + 1] = 255; layers[i * 4 + 3] = 255; layers[16 + i * 4 + 2] = 255; layers[16 + i * 4 + 3] = 255; }
				const c = new T.DataArrayTexture(layers, 2, 2, 2); c.format = T.RGBAFormat; c.type = T.UnsignedByteType; c.needsUpdate = true;
				shared.c.value = c;
				const faces = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [255, 0, 255], [0, 255, 255]].map((col) => ({ data: new Uint8Array([col[0], col[1], col[2], 255]), width: 1, height: 1 }));
				const d = new T.CubeTexture(faces); d.magFilter = d.minFilter = T.NearestFilter; d.generateMipmaps = false; d.needsUpdate = true;
				shared.d.value = d;
				renderer.render(scene, camera);
				const errAfter = gl.getError();
				const probe = (cx) => ({ a: readPixel(renderer, cx - 20, 128 - 20), b: readPixel(renderer, cx + 20, 128 - 20), c: readPixel(renderer, cx - 20, 128 + 20), d: readPixel(renderer, cx + 20, 128 + 20) });
				const p1 = probe(128 - 44), p2 = probe(128 + 44);
				const okOne = (p) => near(p.a, [255, 55, 0], 3) /* render target stores the 0xff8000 clear colour linearly: 0x80 -> 55 */ && near(p.b, [128, 0, 0], 3) && near(p.c, [0, 0, 255], 3) && near(p.d, [255, 0, 255], 3);
				rt.dispose();
				return {
					pass: errNull === 0 && errAfter === 0 && near(nullPx, [0, 0, 0], 2) && okOne(p1) && okOne(p2),
					detail: `GL errors: null pass ${errNull}, after assignment ${errAfter}; null draw samples ${fmt(nullPx)} (expect black placeholder); ` +
						`material 1: 2D ${fmt(p1.a)} 3D ${fmt(p1.b)} array ${fmt(p1.c)} cube ${fmt(p1.d)}; material 2: 2D ${fmt(p2.a)} 3D ${fmt(p2.b)} array ${fmt(p2.c)} cube ${fmt(p2.d)} (expect [255,55,0] [128,0,0] [0,0,255] [255,0,255])`
				};
			}
		},
		{
			name: 'ShaderMaterial instances with the same source share one program', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const vs = 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
				const fs = 'uniform vec3 tint; void main(){ gl_FragColor = vec4(tint, 1.0); }';
				const before = renderer.info.programs ? renderer.info.programs.length : 0;
				const a = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.ShaderMaterial({ uniforms: { tint: { value: new T.Color(1, 0, 0) } }, vertexShader: vs, fragmentShader: fs })); a.position.x = -0.8;
				const b = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.ShaderMaterial({ uniforms: { tint: { value: new T.Color(0, 0, 1) } }, vertexShader: vs, fragmentShader: fs })); b.position.x = 0.8;
				const c = new T.Mesh(new T.PlaneGeometry(1.2, 1.2), new T.ShaderMaterial({ uniforms: { tint: { value: new T.Color(0, 1, 0) } }, vertexShader: vs, fragmentShader: fs, defines: { OTHER: 1 } })); c.position.y = 1.2;
				scene.add(a, b, c);
				renderer.render(scene, camera); renderer.render(scene, camera);
				const added = (renderer.info.programs ? renderer.info.programs.length : 0) - before;
				const pa = readPixel(renderer, 128 - 44, 128), pb = readPixel(renderer, 128 + 44, 128), pc = readPixel(renderer, 128, 128 - 66);
				const switches = renderer.info.render.programSwitches;
				return { pass: added === 2 && near(pa, [255, 0, 0], 2) && near(pb, [0, 0, 255], 2) && near(pc, [0, 255, 0], 2) && switches === 2, detail: `programs created ${added} (expected 2: same source -> shared, different defines -> own), colours ${fmt(pa)} ${fmt(pb)} ${fmt(pc)}, program switches per frame ${switches} (expected 2)` };
			}
		},

		{
			name: 'scene.environment (equirect DataTexture through PMREMGenerator) on MeshStandardMaterial', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 6);
					scene.environment = equirectTexture(L);
					scene.environmentIntensity = 1.3;
					scene.environmentRotation.set(0, 0.4, 0);
					const geo = new L.SphereGeometry(0.7, 48, 24);
					const mats = [
						new L.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, metalness: 1 }),
						new L.MeshStandardMaterial({ color: 0xdd8844, roughness: 0.4, metalness: 0.5 }),
						new L.MeshStandardMaterial({ color: 0x88aaff, roughness: 1.0, metalness: 0 }),
						new L.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, envMapIntensity: 2 }),
					];
					for (let i = 0; i < 4; i++) { const m = new L.Mesh(geo, mats[i]); m.position.set((i % 2) * 1.6 - 0.8, (i < 2 ? 0.8 : -0.8), 0); scene.add(m); }
					const d = new L.DirectionalLight(0xffffff, 1.5); d.position.set(2, 3, 4); scene.add(d);
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'material.envMap on MeshStandardMaterial (cube texture) + PMREMGenerator.fromCubemap / fromEquirectangular as envMap', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L, r) => {
					const { scene, camera } = baseScene(L, 6);
					const cube = cubeTexture(L);
					const pmrem = new L.PMREMGenerator(r);
					pmrem.compileEquirectangularShader();
					const fromEquirect = pmrem.fromEquirectangular(equirectTexture(L)).texture;
					const fromCube = pmrem.fromCubemap(cube).texture;
					pmrem.dispose();
					const geo = new L.SphereGeometry(0.7, 48, 24);
					const a = new L.Mesh(geo, new L.MeshStandardMaterial({ roughness: 0.2, metalness: 1, envMap: cube })); a.position.set(-0.8, 0.8, 0); scene.add(a);
					const b = new L.Mesh(geo, new L.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3, color: 0xcc9966, envMap: fromEquirect, envMapIntensity: 1.5 })); b.position.set(0.8, 0.8, 0); scene.add(b);
					const c = new L.Mesh(geo, new L.MeshStandardMaterial({ roughness: 0.1, metalness: 0.9, envMap: fromCube })); c.position.set(-0.8, -0.8, 0); c.material.envMapRotation.set(0.3, 1.0, 0); scene.add(c);
					const d = new L.Mesh(geo, new L.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0, color: 0x3366ff, envMap: fromEquirect })); d.position.set(0.8, -0.8, 0); scene.add(d);
					scene.add(new L.AmbientLight(0xffffff, 0.4));
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'MeshBasicMaterial envMap: cube texture with Multiply / Mix / Add, reflectivity, refraction, rotation', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 7);
					const cube = cubeTexture(L), refr = cubeTexture(L, L.CubeRefractionMapping);
					const geo = new L.SphereGeometry(0.75, 48, 24), box = new L.BoxGeometry(1.2, 1.2, 1.2);
					const items = [
						new L.Mesh(geo, new L.MeshBasicMaterial({ color: 0xffcc88, envMap: cube, combine: L.MultiplyOperation })),
						new L.Mesh(geo, new L.MeshBasicMaterial({ color: 0xffcc88, envMap: cube, combine: L.MixOperation, reflectivity: 0.6 })),
						new L.Mesh(geo, new L.MeshBasicMaterial({ color: 0x224466, envMap: cube, combine: L.AddOperation, reflectivity: 0.5 })),
						new L.Mesh(box, new L.MeshBasicMaterial({ color: 0xffffff, envMap: refr, refractionRatio: 0.7 })),
						new L.Mesh(geo, new L.MeshBasicMaterial({ color: 0xffffff, envMap: cube, combine: L.MixOperation, reflectivity: 1 })),
						new L.Mesh(box, new L.MeshBasicMaterial({ color: 0xffffff, envMap: cube, combine: L.MixOperation, reflectivity: 1 })),
					];
					items[4].material.envMapRotation.set(0.5, 1.2, 0.2);
					items[5].rotation.set(0.4, 0.6, 0);
					for (let i = 0; i < items.length; i++) { items[i].position.set((i % 3) * 1.9 - 1.9, i < 3 ? 1 : -1, 0); scene.add(items[i]); }
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'MeshLambertMaterial / MeshPhongMaterial envMap: equirect (converted to a cube map), specularMap strength, scene.environment irradiance', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 7);
					const env = equirectTexture(L);
					const spec = new L.DataTexture(new Uint8Array([255, 255, 255, 255, 40, 40, 40, 255, 40, 40, 40, 255, 255, 255, 255, 255]), 2, 2, L.RGBAFormat, L.UnsignedByteType);
					spec.magFilter = L.NearestFilter; spec.minFilter = L.NearestFilter; spec.needsUpdate = true;
					const geo = new L.SphereGeometry(0.75, 48, 24);
					const items = [
						new L.Mesh(geo, new L.MeshLambertMaterial({ color: 0xffffff, envMap: env, combine: L.MixOperation, reflectivity: 0.8 })),
						new L.Mesh(geo, new L.MeshPhongMaterial({ color: 0xaa6633, shininess: 50, envMap: env, combine: L.MultiplyOperation })),
						new L.Mesh(geo, new L.MeshPhongMaterial({ color: 0xffffff, envMap: env, combine: L.MixOperation, specularMap: spec })),
						new L.Mesh(geo, new L.MeshLambertMaterial({ color: 0xffffff })),
						new L.Mesh(geo, new L.MeshPhongMaterial({ color: 0xffffff, shininess: 20 })),
						new L.Mesh(geo, new L.MeshLambertMaterial({ color: 0x88ff88, envMap: env, combine: L.AddOperation, reflectivity: 0.3 })),
					];
					items[0].material.envMapRotation.set(0, 1.0, 0);
					for (let i = 0; i < items.length; i++) { items[i].position.set((i % 3) * 1.9 - 1.9, i < 3 ? 1 : -1, 0); scene.add(items[i]); }
					scene.environment = equirectTexture(L); // lights the two plain materials through PMREM irradiance
					scene.environmentIntensity = 0.8;
					const d = new L.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); scene.add(d);
					scene.add(new L.AmbientLight(0xffffff, 0.2));
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'scene.background equirect texture: sharp, with backgroundBlurriness (PMREM), backgroundIntensity and backgroundRotation', run(T, renderer, ctx) {
				const sharp = compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 5);
					scene.background = equirectTexture(L, 256, 128);
					scene.backgroundIntensity = 0.9;
					scene.backgroundRotation.set(0, 0.7, 0);
					camera.rotation.set(0.2, 0.5, 0);
					scene.add(new L.Mesh(new L.BoxGeometry(1, 1, 1), new L.MeshBasicMaterial({ color: 0xff0000 })));
					return { scene, camera };
				}, notBackground);
				const blurred = compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 5);
					scene.background = equirectTexture(L, 256, 128);
					scene.backgroundBlurriness = 0.35;
					scene.backgroundIntensity = 1.2;
					camera.rotation.set(-0.2, 2.5, 0);
					return { scene, camera };
				}, notBackground);
				return { pass: sharp.pass && blurred.pass, detail: `sharp: ${sharp.detail}; blurred: ${blurred.detail}` };
			}
		},
		{
			name: 'scene.background cube texture + 2D texture plane; MeshStandardMaterial under a cube-texture environment', run(T, renderer, ctx) {
				const cube = compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 5);
					scene.background = cubeTexture(L);
					scene.environment = cubeTexture(L);
					camera.rotation.set(0.3, -0.6, 0);
					const m = new L.Mesh(new L.TorusKnotGeometry(0.8, 0.3, 96, 16), new L.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 1 })); m.position.z = 0; scene.add(m);
					return { scene, camera };
				}, notBackground);
				const plane = compareWithThree(T, renderer, ctx, (L) => {
					const { scene, camera } = baseScene(L, 5);
					const tex = new L.DataTexture(equirectData(32, 16), 32, 16, L.RGBAFormat, L.UnsignedByteType); tex.magFilter = L.LinearFilter; tex.minFilter = L.LinearFilter; tex.needsUpdate = true;
					scene.background = tex;
					scene.backgroundIntensity = 0.7;
					scene.add(new L.Mesh(new L.SphereGeometry(0.8, 24, 12), new L.MeshBasicMaterial({ color: 0x00ff00 })));
					return { scene, camera };
				}, notBackground);
				return { pass: cube.pass && plane.pass, detail: `cube: ${cube.detail}; plane: ${plane.detail}` };
			}
		},
		{
			name: 'CubeCamera + WebGLCubeRenderTarget reflection (Basic envMap, Standard through PMREM of the render target)', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L, r) => {
					const { scene, camera } = baseScene(L, 6);
					scene.background = new L.Color(0x203040);
					// surroundings: coloured boxes on all sides
					const colours = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0x44ffff, 0xff44ff];
					const dirs = [[4, 0, 0], [-4, 0, 0], [0, 4, 0], [0, -4, 0], [0, 0, 4], [0, 0, -4]];
					for (let i = 0; i < 6; i++) { const b = new L.Mesh(new L.BoxGeometry(2, 2, 2), new L.MeshBasicMaterial({ color: colours[i] })); b.position.set(dirs[i][0], dirs[i][1], dirs[i][2]); b.rotation.set(i * 0.3, i * 0.5, 0); scene.add(b); }
					const d = new L.DirectionalLight(0xffffff, 2); d.position.set(1, 3, 2); scene.add(d);
					scene.add(new L.AmbientLight(0xffffff, 0.3));
					const target = new L.WebGLCubeRenderTarget(64, { generateMipmaps: true, minFilter: L.LinearMipmapLinearFilter });
					const cubeCamera = new L.CubeCamera(0.1, 50, target);
					cubeCamera.position.set(0, 0, 0);
					scene.add(cubeCamera);
					cubeCamera.update(r, scene);
					const a = new L.Mesh(new L.SphereGeometry(0.9, 48, 24), new L.MeshBasicMaterial({ envMap: target.texture })); a.position.set(-1.1, 0, 0); scene.add(a);
					const b = new L.Mesh(new L.SphereGeometry(0.9, 48, 24), new L.MeshStandardMaterial({ envMap: target.texture, roughness: 0.15, metalness: 1 })); b.position.set(1.1, 0, 0); scene.add(b);
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'PMREMGenerator.fromScene as scene.environment', run(T, renderer, ctx) {
				return compareWithThree(T, renderer, ctx, (L, r) => {
					const { scene, camera } = baseScene(L, 5);
					const envScene = new L.Scene();
					envScene.background = new L.Color(0x334455);
					const sky = new L.Mesh(new L.SphereGeometry(10, 16, 8), new L.MeshBasicMaterial({ color: 0x88aaff, side: L.BackSide })); envScene.add(sky);
					const lamp = new L.Mesh(new L.BoxGeometry(2, 2, 2), new L.MeshBasicMaterial({ color: 0xffffff })); lamp.position.set(3, 4, 2); envScene.add(lamp);
					const floor = new L.Mesh(new L.PlaneGeometry(20, 20), new L.MeshBasicMaterial({ color: 0x664422 })); floor.rotation.x = -Math.PI / 2; floor.position.y = -3; envScene.add(floor);
					const pmrem = new L.PMREMGenerator(r);
					const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
					pmrem.dispose();
					scene.environment = rt.texture;
					const geo = new L.SphereGeometry(0.8, 48, 24);
					const a = new L.Mesh(geo, new L.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, metalness: 1 })); a.position.x = -1; scene.add(a);
					const b = new L.Mesh(geo, new L.MeshStandardMaterial({ color: 0xff8844, roughness: 0.7, metalness: 0 })); b.position.x = 1; scene.add(b);
					return { scene, camera };
				}, notBackground);
			}
		},
		{
			name: 'ShaderMaterial batching: 50 instances reading modelViewMatrix / normalMatrix (matches individual draws and three.js)', run(T, renderer, ref) {
				const build = (L) => {
					const { scene, camera } = baseScene(L, 6);
					const vsView = 'varying vec3 vN; varying vec3 vP; void main(){ vN = normalize( normalMatrix * normal ); vec4 mv = modelViewMatrix * vec4( position, 1.0 ); vP = mv.xyz; gl_Position = projectionMatrix * mv; }';
					const vsWorld = 'varying vec3 vN; varying vec3 vP; void main(){ vec4 wp = modelMatrix * vec4( position, 1.0 ); vN = normalize( mat3( modelMatrix ) * normal ); vP = ( viewMatrix * wp ).xyz; gl_Position = projectionMatrix * viewMatrix * wp; }';
					const fs = 'uniform vec3 color; varying vec3 vN; varying vec3 vP; void main(){ vec3 n = normalize( vN ); vec3 l = normalize( vec3( 0.4, 0.8, 0.6 ) ); float d = max( dot( n, l ), 0.0 ); float s = pow( max( dot( reflect( -l, n ), normalize( -vP ) ), 0.0 ), 24.0 ); gl_FragColor = vec4( color * ( 0.25 + 0.75 * d ) + s, 1.0 ); }';
					const view = new L.ShaderMaterial({ vertexShader: vsView, fragmentShader: fs, uniforms: { color: { value: new L.Color(0xff8844) } } });
					const world = new L.ShaderMaterial({ vertexShader: vsWorld, fragmentShader: fs, uniforms: { color: { value: new L.Color(0x4488ff) } } });
					const box = new L.BoxGeometry(0.3, 0.3, 0.3), meshes = [];
					// 50 instances of one geometry + one view-space material -> one instanced draw
					for (let i = 0; i < 50; i++) { const m = new L.Mesh(box, view); m.position.set((i % 10 - 4.5) * 0.42, (Math.floor(i / 10) - 2) * 0.42 + 0.9, 0); m.rotation.set(i * 0.3, i * 0.5, 0); m.scale.setScalar(0.8 + (i % 3) * 0.15); scene.add(m); meshes.push(m); }
					// 25 unique geometries + one world-space material -> one multi-draw (instanced per geometry without WEBGL_multi_draw)
					for (let i = 0; i < 25; i++) { const m = new L.Mesh(new L.BoxGeometry(0.3, 0.3 + (i % 4) * 0.08, 0.3), world); m.position.set((i % 5 - 2) * 0.5, -1.7 + Math.floor(i / 5) * 0.2 - 0.3, 0); m.rotation.set(i * 0.4, i * 0.7, 0); scene.add(m); meshes.push(m); }
					// per-object uniform through onBeforeRender: stays a draw of its own and sees its own value
					const hooked = new L.Mesh(box, view); hooked.position.set(2.4, -0.3, 0); hooked.scale.setScalar(2);
					hooked.onBeforeRender = (r, sc, c, g, mat) => { mat.uniforms.color.value.setRGB(0.2, 0.9, 0.3); mat.uniformsNeedUpdate = true; };
					hooked.onAfterRender = (r, sc, c, g, mat) => { mat.uniforms.color.value.setHex(0xff8844); mat.uniformsNeedUpdate = true; };
					scene.add(hooked); meshes.push(hooked);
					return { scene, camera, meshes };
				};
				const a = build(T);
				renderer.autoBatchShaderMaterials = true; renderer.render(a.scene, a.camera); renderer.render(a.scene, a.camera);
				const batched = readAll(renderer), callsA = renderer.info.render.calls, programs = renderer.info.programs.length;
				renderer.autoBatchShaderMaterials = false; renderer.render(a.scene, a.camera);
				const single = readAll(renderer), callsB = renderer.info.render.calls;
				renderer.autoBatchShaderMaterials = true;
				const vsSingle = diffImages(batched, single);
				const d = compareWithReference(ref, build, batched);
				const hookPx = readPixel(renderer, 230, 140);
				const glErr = renderer.getContext().getError();
				return { pass: callsA <= 4 && callsB === 76 && vsSingle.maxDiff === 0 && refOk(d) && hookPx[1] > hookPx[0] && glErr === 0,
					detail: `draw calls ${callsB} -> ${callsA} (50 instanced + 25 multi-drawn + 1 hooked); batched vs individual draws max diff ${vsSingle.maxDiff}; ${refDetail(d)}; hooked mesh ${fmt(hookPx)} (green); programs ${programs}; GL error ${glErr}` };
			}
		},
		{
			name: 'ShaderMaterial custom attributes drawn from mega-buffer pages (matches three.js)', run(T, renderer, ref) {
				const vs = 'attribute vec3 aTint; attribute float aMix; varying vec3 vTint; varying float vMix; void main(){ vTint = aTint; vMix = aMix; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
				const fs = 'uniform vec3 base; varying vec3 vTint; varying float vMix; void main(){ gl_FragColor = vec4(mix(base, vTint, vMix), 1.0); }';
				const tinted = (L, geometry, seed) => {
					const n = geometry.attributes.position.count, tint = new Float32Array(n * 3), mixv = new Float32Array(n);
					for (let i = 0; i < n; i++) { tint[i * 3] = ((i + seed) % 3) / 2; tint[i * 3 + 1] = ((i * 2 + seed) % 5) / 4; tint[i * 3 + 2] = (seed % 2); mixv[i] = 0.5 + 0.5 * ((i + seed) % 2); }
					geometry.setAttribute('aTint', new L.BufferAttribute(tint, 3)); geometry.setAttribute('aMix', new L.BufferAttribute(mixv, 1));
					return geometry;
				};
				const build = (L, frame) => {
					const { scene, camera } = baseScene(L, 7);
					const mats = [0, 1].map((k) => new L.ShaderMaterial({ uniforms: { base: { value: new L.Color(0.1 + 0.4 * k, 0.2, 0.3) } }, vertexShader: vs, fragmentShader: fs }));
					const make = (geometry, x, y, m) => { const mesh = new L.Mesh(geometry, m); mesh.position.set(x, y, 0); mesh.rotation.set(0.3 * x, 0.4 + 0.2 * y, 0); scene.add(mesh); return mesh; };
					const g0 = tinted(L, new L.BoxGeometry(1.2, 1.2, 1.2), 1), g1 = tinted(L, new L.SphereGeometry(0.7, 12, 8), 2), g2 = tinted(L, new L.PlaneGeometry(1.4, 1.4).toNonIndexed(), 3);
					const g3 = tinted(L, new L.BoxGeometry(1, 1, 1, 2, 2, 2), 4); g3.clearGroups(); g3.addGroup(0, 36, 0); g3.addGroup(36, 36, 1);
					const a = make(g0, -2.2, 1.2, mats[0]), b = make(g1, 0, 1.2, mats[1]), c = make(g2, 2.2, 1.2, mats[0]), d = make(g0, -2.2, -1.2, mats[1]), e = make(g3, 0, -1.2, mats);
					const w = make(g1, 2.2, -1.2, mats[0]);
					if (frame > 0) { // dynamic update of a custom attribute, and wireframe toggled
						const t = g1.attributes.aTint; for (let i = 0; i < t.array.length; i++) t.array[i] = 1 - t.array[i]; t.needsUpdate = true;
						w.material = new L.ShaderMaterial({ uniforms: { base: { value: new L.Color(1, 1, 0) } }, vertexShader: vs, fragmentShader: fs, wireframe: true });
					}
					return { scene, camera, mats, g1 };
				};
				const run = (L, rend, frame) => {
					const s = build(L, frame);
					// a depth-only pass first (position only), as a shadow pass would: page layouts are made before the colour programs exist
					const depth = new L.ShaderMaterial({ vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }', fragmentShader: 'void main(){ gl_FragColor = vec4(1.0); }' });
					if (rend === renderer) { s.scene.overrideMaterial = depth; renderer.render(s.scene, s.camera); s.scene.overrideMaterial = null; }
					return s;
				};
				const s0 = run(T, renderer, 0);
				renderer.render(s0.scene, s0.camera);
				const px0 = readAll(renderer);
				const d0 = compareWithReference(ref, (L) => build(L, 0), px0);
				const s1 = run(T, renderer, 1);
				renderer.render(s1.scene, s1.camera);
				const px1 = readAll(renderer);
				const d1 = compareWithReference(ref, (L) => build(L, 1), px1);
				const rec = renderer.megaBuffers ? renderer.megaBuffers.records.get(s1.g1) : null; // the sphere must have been drawn from a page that carries the custom attributes
				const paged = rec === null || (rec.page !== null && rec.layout.customNames.has('aTint') && rec.layout.customNames.has('aMix'));
				return { pass: paged && refOk(d0) && refOk(d1) && diffImages(px0, px1).badFraction > 0.001, detail: `${paged ? 'paged' : 'NOT paged'}; static: ${refDetail(d0)}; after attribute update + wireframe: ${refDetail(d1)}` };
			}
		},
		{
			name: 'SkinnedMesh: cylinder bent by two bones (matches three.js)', run(T, renderer, ref) {
				const build = (L, bend = 0.9) => {
					const { scene, camera } = baseScene(L, 7);
					lightRig(L, scene);
					const { mesh } = buildSkinnedCylinder(L, bend);
					mesh.rotation.y = 0.4;
					scene.add(mesh);
					return { scene, camera, mesh };
				};
				// bind pose must equal the unskinned geometry drawn as a plain Mesh
				const plain = build(T, 0);
				renderer.render(plain.scene, plain.camera);
				const skinnedRest = readAll(renderer);
				const { scene: s2, camera: c2 } = baseScene(T, 7); lightRig(T, s2);
				const ref2 = buildSkinnedCylinder(T, 0, T.Mesh); ref2.mesh.rotation.y = 0.4; s2.add(ref2.mesh);
				renderer.render(s2, c2);
				const plainRest = readAll(renderer);
				const rest = diffImages(skinnedRest, plainRest);
				// bent pose: the top half moves sideways
				const bent = build(T);
				renderer.render(bent.scene, bent.camera);
				const bentPx = readAll(renderer);
				const moved = diffImages(skinnedRest, bentPx);
				const calls = renderer.info.render.calls;
				const d = compareWithReference(ref, (L) => build(L), bentPx);
				// bounding sphere / raycast follow the bones
				bent.mesh.updateMatrixWorld(true);
				bent.mesh.computeBoundingSphere();
				const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(-0.35, 0.3), bent.camera);
				const hits = rc.intersectObject(bent.mesh);
				return { pass: rest.maxDiff <= 2 && moved.badFraction > 0.01 && calls === 1 && refOk(d) && hits.length > 0,
					detail: `bind pose vs plain mesh max diff ${rest.maxDiff}; bent pose changes ${(100 * moved.badFraction).toFixed(1)}% of pixels; ${refDetail(d)}; draw calls ${calls}; raycast on bent part ${hits.length} hit(s)` };
			}
		},
		{
			name: 'Morph targets: position / normal / colour, absolute and relative (matches three.js)', run(T, renderer, ref) {
				const build = (L, influences) => {
					const { scene, camera } = baseScene(L, 5);
					lightRig(L, scene);
					const { group, mA, mB, mC } = buildMorphBoxes(L, influences);
					scene.add(group);
					return { scene, camera, mA, mB, mC };
				};
				const a = build(T, [0.7, 0.4]);
				renderer.render(a.scene, a.camera);
				const px = readAll(renderer);
				const calls = renderer.info.render.calls;
				const d = compareWithReference(ref, (L) => build(L, [0.7, 0.4]), px);
				// influence changes take effect without any needsUpdate
				a.mA.morphTargetInfluences[0] = 0; a.mA.morphTargetInfluences[1] = 1; a.mB.morphTargetInfluences[0] = 1; a.mB.morphTargetInfluences[1] = 0; a.mC.morphTargetInfluences[1] = 1;
				renderer.render(a.scene, a.camera);
				const px2 = readAll(renderer);
				const changed = diffImages(px, px2);
				const d2 = compareWithReference(ref, (L) => { const r = build(L, [0, 1]); r.mB.morphTargetInfluences[0] = 1; r.mB.morphTargetInfluences[1] = 0; r.mC.morphTargetInfluences[0] = 0.7; r.mC.morphTargetInfluences[1] = 1; return r; }, px2);
				// zero influences equal the base geometry
				const z = build(T, [0, 0]);
				renderer.render(z.scene, z.camera);
				const pz = readAll(renderer);
				const { scene: sb, camera: cb } = baseScene(T, 5); lightRig(T, sb);
				const plainBoxes = buildMorphBoxes(T, [0, 0]);
				for (const m of [plainBoxes.mA, plainBoxes.mB, plainBoxes.mC]) { m.geometry.morphAttributes = {}; m.morphTargetInfluences = undefined; m.morphTargetDictionary = undefined; }
				sb.add(plainBoxes.group);
				renderer.render(sb, cb);
				const base = diffImages(pz, readAll(renderer));
				const dict = a.mA.morphTargetDictionary && a.mA.morphTargetDictionary['0'] === 0 && a.mA.morphTargetDictionary['1'] === 1;
				return { pass: calls === 3 && refOk(d) && refOk(d2) && changed.badFraction > 0.005 && base.maxDiff <= 2 && dict,
					detail: `${refDetail(d)}; after influence change ${refDetail(d2)}; influence change moved ${(100 * changed.badFraction).toFixed(1)}% of pixels; zero influences vs base geometry max diff ${base.maxDiff}; draw calls ${calls}` };
			}
		},
		{
			name: 'Skinned mesh animated by AnimationMixer (matches three.js)', run(T, renderer, ref) {
				const build = (L) => {
					const { scene, camera } = baseScene(L, 7);
					lightRig(L, scene);
					const { mesh } = buildSkinnedCylinder(L, 0);
					scene.add(mesh);
					const clip = new L.AnimationClip('bend', 2, [
						new L.QuaternionKeyframeTrack('child.quaternion', [0, 1, 2], [0, 0, 0, 1, 0, 0, Math.sin(0.5), Math.cos(0.5), 0, 0, -Math.sin(0.3), Math.cos(0.3)]),
						new L.VectorKeyframeTrack('root.position', [0, 2], [0, -2, 0, 0.5, -2, 0]),
						new L.NumberKeyframeTrack('.rotation[y]', [0, 2], [0, 1.2]),
					]);
					const mixer = new L.AnimationMixer(mesh);
					mixer.clipAction(clip).play();
					mixer.update(0.7); mixer.update(0.45);
					return { scene, camera, mesh };
				};
				const a = build(T);
				renderer.render(a.scene, a.camera);
				const px = readAll(renderer);
				const d = compareWithReference(ref, build, px);
				return { pass: refOk(d) && Math.abs(a.mesh.rotation.y - 1.2 * 1.15 / 2) < 1e-6, detail: `${refDetail(d)}; mesh.rotation.y ${a.mesh.rotation.y.toFixed(4)} expected ${(1.2 * 1.15 / 2).toFixed(4)}` };
			}
		},
		{
			name: 'Skinned mesh casting and receiving a directional shadow (matches three.js)', run(T, renderer, ref) {
				const build = (L, r) => {
					const { scene, camera } = baseScene(L, 7);
					r.shadowMap.enabled = true;
					const floor = new L.Mesh(new L.PlaneGeometry(10, 10), new L.MeshLambertMaterial({ color: 0xffffff }));
					floor.rotation.x = -Math.PI / 2; floor.position.y = -2.2; floor.receiveShadow = true; scene.add(floor);
					const { mesh } = buildSkinnedCylinder(L, 1.1);
					mesh.castShadow = true; mesh.receiveShadow = true; mesh.rotation.y = 0.3; scene.add(mesh);
					const sun = new L.DirectionalLight(0xffffff, 3); sun.position.set(3, 6, 1); sun.castShadow = true; sun.shadow.mapSize.set(512, 512); scene.add(sun);
					scene.add(new L.AmbientLight(0xffffff, 0.3));
					camera.position.set(0, 4, 7); camera.lookAt(0, -0.5, 0); camera.updateMatrixWorld();
					return { scene, camera };
				};
				const a = build(T, renderer);
				renderer.render(a.scene, a.camera);
				const px = readAll(renderer);
				renderer.shadowMap.enabled = false;
				const d = ref ? compareWithReference({ THREE: ref.THREE, renderer: ref.renderer }, (L) => build(L, ref.renderer), px) : null;
				if (ref) ref.renderer.shadowMap.enabled = false;
				// the bent top casts a shadow onto the floor to the left of the base
				const shadowed = readPixel(renderer, 80, 160), lit = readPixel(renderer, 220, 200);
				return { pass: (d === null || (d.meanAbsDiff < 0.6 && d.badFraction < 0.004)) && lum(shadowed) < lum(lit) * 0.7, detail: `${refDetail(d)}; floor in shadow ${fmt(shadowed)} vs lit ${fmt(lit)}` };
			}
		},
		{
			name: 'ShaderMaterial with skinning and morph target chunks (matches three.js)', run(T, renderer, ref) {
				const build = (L) => {
					const { scene, camera } = baseScene(L, 7);
					const mat = new L.ShaderMaterial({
						uniforms: { tint: { value: new L.Color(0xffaa33) } },
						vertexShader: '#include <common>\n#include <skinning_pars_vertex>\n#include <morphtarget_pars_vertex>\nvarying vec3 vN;\nvoid main(){\n#include <beginnormal_vertex>\n#include <morphnormal_vertex>\n#include <skinbase_vertex>\n#include <skinnormal_vertex>\n#include <begin_vertex>\n#include <morphtarget_vertex>\n#include <skinning_vertex>\n#include <project_vertex>\nvN = normalize( normalMatrix * objectNormal );\n}',
						fragmentShader: 'uniform vec3 tint; varying vec3 vN; void main(){ gl_FragColor = vec4( tint * ( 0.4 + 0.6 * max( vN.z, 0.0 ) ), 1.0 ); }',
					});
					const { mesh } = buildSkinnedCylinder(L, 0.8);
					mesh.material = mat; mesh.rotation.y = 0.5; mesh.position.x = -1.2; scene.add(mesh);
					const { group, mA } = buildMorphBoxes(L, [0.5, 0.5]);
					mA.material = mat; mA.position.set(1.8, 1, 0); scene.add(mA);
					return { scene, camera };
				};
				const a = build(T);
				renderer.render(a.scene, a.camera);
				const px = readAll(renderer);
				const err = renderer.getContext().getError();
				const d = compareWithReference(ref, build, px);
				const c = readPixel(renderer, 60, 128);
				return { pass: err === 0 && refOk(d) && c[0] > 100 && c[2] < 60, detail: `${refDetail(d)}; sample ${fmt(c)} (orange), GL error ${err}` };
			}
		},
		{
			name: 'Raycaster hit through camera', run(T, renderer) {
				const { scene, camera } = baseScene(T);
				const box = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial()); scene.add(box);
				scene.updateMatrixWorld(); camera.updateMatrixWorld();
				const rc = new T.Raycaster(); rc.setFromCamera(new T.Vector2(0.05, 0.03), camera); // off the face diagonal so exactly one triangle is hit
				const hits = rc.intersectObject(box);
				return { pass: hits.length === 1 && Math.abs(hits[0].distance - 4.5) < 0.02, detail: hits.length ? `${hits.length} hit(s), distance ${hits[0].distance.toFixed(4)} expected ~4.5` : 'no hit' };
			}
		},
	];
}

/** Frame-time measurement of a shared geometry/material scene. */
export function benchmarkScene(T, renderer, n = 2000, frames = 40) {
	const scene = new T.Scene();
	const camera = new T.PerspectiveCamera(60, 1, 0.1, 500); camera.position.set(0, 0, 40); camera.lookAt(0, 0, 0);
	scene.add(new T.AmbientLight(0xffffff, 0.5));
	const d = new T.DirectionalLight(0xffffff, 2); d.position.set(1, 2, 3); scene.add(d);
	const g = new T.BoxGeometry(0.5, 0.5, 0.5), m = new T.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.6 });
	const side = Math.ceil(Math.cbrt(n));
	const meshes = [];
	for (let i = 0; i < n; i++) {
		const mesh = new T.Mesh(g, m);
		mesh.position.set((i % side - side / 2) * 1.2, (Math.floor(i / side) % side - side / 2) * 1.2, (Math.floor(i / (side * side)) - side / 2) * 1.2);
		scene.add(mesh); meshes.push(mesh);
	}
	const gl = renderer.getContext();
	for (let f = 0; f < 5; f++) renderer.render(scene, camera);
	gl.finish();
	let t0 = performance.now();
	for (let f = 0; f < frames; f++) renderer.render(scene, camera);
	gl.finish();
	const staticMs = (performance.now() - t0) / frames;
	t0 = performance.now();
	for (let f = 0; f < frames; f++) { for (let i = 0; i < meshes.length; i++) meshes[i].rotation.y = f * 0.01 + i; renderer.render(scene, camera); }
	gl.finish();
	const animatedMs = (performance.now() - t0) / frames;
	return { n, staticMs: +staticMs.toFixed(2), animatedMs: +animatedMs.toFixed(2), drawCalls: renderer.info.render.calls };
}

export { readPixel };
