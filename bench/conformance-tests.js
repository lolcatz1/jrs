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

export const SIZE = 256;

/** Returns [{ name, run(T, renderer) -> { pass, detail } }] */
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
