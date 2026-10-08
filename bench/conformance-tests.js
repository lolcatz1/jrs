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
