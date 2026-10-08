// Benchmark scenarios. Each builds the same scene with either library (`T` is the module namespace).
// Returns { scene, camera, update(frame) } ; update is optional per-frame animation.

function grid(i, n, spacing) {
	const side = Math.ceil(Math.cbrt(n));
	const x = i % side, y = Math.floor(i / side) % side, z = Math.floor(i / (side * side));
	return [(x - side / 2) * spacing, (y - side / 2) * spacing, (z - side / 2) * spacing];
}

export const scenarios = {
	// Large per-frame vertex uploads: 8 meshes of 16 641 vertices plus 4 of 66 049, positions rewritten every frame
	// (~3.7 MB/frame in total). Checks that big bufferSubData uploads do not hit the transfer-buffer stall seen
	// with large texSubImage2D uploads. Only 600 indices of each mesh are drawn (so these meshes are not batched).
	'dynamic-geometry-large': {
		n: 12,
		compareFrames: 5,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 30); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const material = new T.MeshLambertMaterial({ color: 0x99ddaa, side: T.DoubleSide });
			const sheet = (seg) => {
				const vc = (seg + 1) * (seg + 1);
				const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), idx = new (vc > 65535 ? Uint32Array : Uint16Array)(seg * seg * 6);
				let k = 0;
				for (let y = 0; y < seg; y++) for (let x = 0; x < seg; x++) { const a = y * (seg + 1) + x, c = a + seg + 1; idx[k++] = a; idx[k++] = c; idx[k++] = a + 1; idx[k++] = a + 1; idx[k++] = c; idx[k++] = c + 1; }
				for (let i = 0; i < vc; i++) nor[i * 3 + 2] = 1;
				const g = new T.BufferGeometry();
				const position = new T.BufferAttribute(pos, 3); position.setUsage(T.DynamicDrawUsage);
				g.setAttribute('position', position); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
				return g;
			};
			const states = [];
			const meshes = [];
			for (let i = 0; i < n; i++) {
				const seg = i < 8 ? 128 : 256;
				const g = sheet(seg);
				g.setDrawRange(0, 600); // rasterising 800k triangles on a software GL would hide the upload cost; draw a few
				const m = new T.Mesh(g, material);
				m.position.set(((i % 4) - 1.5) * 8, (Math.floor(i / 4) - 1) * 8, 0);
				m.scale.setScalar(3);
				m.frustumCulled = false;
				scene.add(m); meshes.push(m);
				// two precomputed vertex states per mesh, alternated each frame (the CPU cost of animating is not what is measured)
				const vc = (seg + 1) * (seg + 1), s = [new Float32Array(vc * 3), new Float32Array(vc * 3)];
				for (let st = 0; st < 2; st++) for (let v = 0; v < vc; v++) {
					const x = v % (seg + 1), y = (v / (seg + 1)) | 0;
					s[st][v * 3] = x / seg - 0.5; s[st][v * 3 + 1] = y / seg - 0.5; s[st][v * 3 + 2] = Math.sin(x * 0.15 + y * 0.1 + st * 1.5 + i) * 0.05;
				}
				states.push(s);
				g.attributes.position.array.set(s[0]);
			}
			const update = (f) => {
				for (let i = 0; i < n; i++) { const a = meshes[i].geometry.attributes.position; a.array.set(states[i][f & 1]); a.needsUpdate = true; }
			};
			return { scene, camera, update };
		}
	},
	// Dynamic geometry: 200 meshes with a position attribute rewritten every frame (150 whole-array
	// needsUpdate, 50 via updateRanges on a small sub-range), 3 meshes whose drawRange changes, 3 that
	// grow (setAttribute with a larger array every 10 frames) and one geometry rebuilt from scratch every
	// 10 frames. Normals/uvs/index never change (they must not be re-uploaded). Output depends only on the frame number.
	'dynamic-geometry': {
		n: 200,
		compareFrames: 25,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 40); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const material = new T.MeshLambertMaterial({ color: 0x66ccff, side: T.DoubleSide });
			const SEG = 8; // (SEG+1)^2 = 81 vertices per sheet
			const sheet = (seg) => {
				const vc = (seg + 1) * (seg + 1);
				const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2);
				const idx = [];
				for (let y = 0; y <= seg; y++) for (let x = 0; x <= seg; x++) {
					const i = y * (seg + 1) + x;
					nor[i * 3 + 2] = 1; uv[i * 2] = x / seg; uv[i * 2 + 1] = y / seg;
				}
				for (let y = 0; y < seg; y++) for (let x = 0; x < seg; x++) {
					const a = y * (seg + 1) + x, b = a + 1, c = a + seg + 1, d = c + 1;
					idx.push(a, c, b, b, c, d);
				}
				const g = new T.BufferGeometry();
				const position = new T.BufferAttribute(pos, 3); position.setUsage(T.DynamicDrawUsage);
				g.setAttribute('position', position);
				g.setAttribute('normal', new T.BufferAttribute(nor, 3));
				g.setAttribute('uv', new T.BufferAttribute(uv, 2));
				g.setIndex(idx);
				return g;
			};
			const fill = (pos, seg, f, from, to) => {
				for (let i = from; i < to; i++) {
					const x = i % (seg + 1), y = (i / (seg + 1)) | 0;
					pos[i * 3] = (x / seg - 0.5) * 2; pos[i * 3 + 1] = (y / seg - 0.5) * 2;
					pos[i * 3 + 2] = Math.sin(f * 0.2 + x * 0.7 + y * 0.5) * 0.25;
				}
			};
			const meshes = [];
			for (let i = 0; i < n; i++) {
				const g = sheet(SEG);
				fill(g.attributes.position.array, SEG, 0, 0, (SEG + 1) * (SEG + 1));
				const m = new T.Mesh(g, material);
				const p = grid(i, n, 2.6); m.position.set(p[0], p[1], p[2]);
				m.frustumCulled = false;
				scene.add(m); meshes.push(m);
			}
			const FULL = 150, vcount = (SEG + 1) * (SEG + 1);
			const GROW = [0, 1, 2].map((k) => meshes[FULL - 1 - k]); // last three of the full-update group: grow every 10 frames
			const DRAW = [3, 4, 5].map((k) => meshes[k]);
			const REBUILD = meshes[6];
			const update = (f) => {
				for (let i = 0; i < n; i++) {
					const m = meshes[i], g = m.geometry, pa = g.attributes.position;
					if (m.userData.seg === undefined) m.userData.seg = SEG;
					const seg = m.userData.seg, count = (seg + 1) * (seg + 1);
					if (i < FULL) {
						fill(pa.array, seg, f + i, 0, count);
						pa.needsUpdate = true;
					} else {
						// sub-range: first quarter of the vertices
						const to = count >> 2;
						fill(pa.array, seg, f + i, 0, to);
						pa.addUpdateRange(0, to * 3);
						pa.needsUpdate = true;
					}
				}
				for (let k = 0; k < DRAW.length; k++) DRAW[k].geometry.setDrawRange(0, 6 * (1 + ((f + k * 7) % 64)));
				if (f % 10 === 0 && f > 0) {
					for (let k = 0; k < GROW.length; k++) {
						const m = GROW[k], seg = m.userData.seg === undefined ? SEG : m.userData.seg, next = Math.min(seg + 2, 24);
						if (next === seg) continue;
						const old = m.geometry, g = sheet(next);
						m.userData.seg = next;
						// grow in place: same geometry object gets larger attributes (three.js semantics: new attribute objects)
						old.setAttribute('position', g.attributes.position); old.setAttribute('normal', g.attributes.normal); old.setAttribute('uv', g.attributes.uv); old.setIndex(g.index);
						fill(old.attributes.position.array, next, f + FULL - 1 - k, 0, (next + 1) * (next + 1));
					}
					const old = REBUILD.geometry, g = sheet(SEG);
					fill(g.attributes.position.array, SEG, f, 0, vcount);
					REBUILD.geometry = g; old.dispose();
					REBUILD.userData.seg = SEG;
				}
			};
			return { scene, camera, update };
		}
	},
	// Many objects, one geometry + one material. The common "lots of the same thing" case.
	'shared-static': {
		n: 10000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 60); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.5));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const geometry = new T.BoxGeometry(0.5, 0.5, 0.5);
			const material = new T.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.6 });
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, material);
				const p = grid(i, n, 1.2); m.position.set(p[0], p[1], p[2]);
				m.rotation.set(i * 0.1, i * 0.2, 0);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// Same scene but every object rotates every frame.
	'shared-animated': {
		n: 10000,
		build(T, n) {
			const r = scenarios['shared-static'].build(T, n);
			const meshes = r.scene.children.filter(o => o.isMesh);
			r.update = (f) => { for (let i = 0; i < meshes.length; i++) { meshes[i].rotation.y = f * 0.01 + i; } };
			return r;
		}
	},
	// 5000 objects spread over 200 materials (different colours): partial batching, state sorting.
	'many-materials': {
		n: 5000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 45); camera.lookAt(0, 0, 0);
			scene.add(new T.HemisphereLight(0xffffff, 0x444444, 1.5));
			const pl = new T.PointLight(0xffffff, 200, 0, 2); pl.position.set(5, 10, 10); scene.add(pl);
			const geometries = [new T.BoxGeometry(0.5, 0.5, 0.5), new T.SphereGeometry(0.3, 12, 8), new T.ConeGeometry(0.3, 0.6, 10)];
			const materials = [];
			for (let i = 0; i < 200; i++) materials.push(new T.MeshPhongMaterial({ color: new T.Color().setHSL(i / 200, 0.7, 0.5), shininess: 40 }));
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometries[i % 3], materials[(i * 7) % 200]);
				const p = grid(i, n, 1.3); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// 2000 distinct geometries (no two meshes share one): no batching possible, pure per-draw overhead.
	'unique-geometries': {
		n: 2000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 35); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const material = new T.MeshLambertMaterial({ color: 0xffcc66 });
			for (let i = 0; i < n; i++) {
				const g = new T.BoxGeometry(0.4 + (i % 5) * 0.05, 0.4, 0.4, 1 + (i % 2), 1, 1);
				const m = new T.Mesh(g, material);
				const p = grid(i, n, 1.4); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// 10k transparent objects, camera orbits every frame so every depth key changes: exercises the transparent sort path.
	'transparent-sort': {
		n: 10000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			const radius = 60, height = 15;
			camera.position.set(0, height, radius); camera.lookAt(0, 0, 0);
			const geometry = new T.BoxGeometry(0.5, 0.5, 0.5);
			const material = new T.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.35, depthWrite: false });
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, material);
				const p = grid(i, n, 1.2); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			const update = (f) => { const a = f * 0.01; camera.position.set(Math.sin(a) * radius, height, Math.cos(a) * radius); camera.lookAt(0, 0, 0); };
			return { scene, camera, update };
		}
	},
	// Deep hierarchy with animated root: tests world-matrix propagation.
	'hierarchy-animated': {
		n: 8000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 10, 60); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const geometry = new T.BoxGeometry(0.4, 0.4, 0.4);
			const material = new T.MeshBasicMaterial({ color: 0x66ccff });
			const roots = [];
			const perRoot = 40;
			for (let r = 0; r < n / perRoot; r++) {
				const root = new T.Group();
				const p = grid(r, n / perRoot, 6); root.position.set(p[0], p[1], p[2]);
				let parent = root;
				for (let i = 0; i < perRoot; i++) {
					const m = new T.Mesh(geometry, material);
					m.position.set(0.5, 0.1, 0); m.rotation.z = 0.15;
					parent.add(m); parent = m;
				}
				scene.add(root); roots.push(root);
			}
			return { scene, camera, update: (f) => { for (let i = 0; i < roots.length; i++) roots[i].rotation.y = f * 0.01 + i; } };
		}
	},
	// One InstancedMesh with 100k instances: GPU-side instancing in both libraries.
	'instanced-100k': {
		n: 100000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 1000);
			camera.position.set(0, 0, 120); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const im = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshLambertMaterial({ color: 0xff8844 }), n);
			const m4 = new T.Matrix4();
			for (let i = 0; i < n; i++) { const p = grid(i, n, 1.1); m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); }
			scene.add(im);
			return { scene, camera };
		}
	},

	// Mimics a real three.js game client: ~1,300 meshes, all ShaderMaterial, 12 programs, one shared
	// 30-uniform object spread into every material, 4 samplers (2D / 3D / 2D array / cube) + a shadow
	// render target, custom vertex attributes, a BATCHED define for pre-merged static geometry, and a
	// mix of opaque and transparent materials. Auto-batching does not apply (ShaderMaterial).
	'shader-client': {
		n: 1313,
		build(T, n) { return buildShaderClient(T, n, { scale: 1 }); }
	},
	// Same materials and passes as a real client frame with a FIXED camera and nothing moving:
	// two shadow render-target passes with scene.overrideMaterial (a depth ShaderMaterial), the main
	// pass with ~210 draws, and stencil shadow-volume passes (MeshBasicMaterial, stencil state, renderOrder).
	// Measures what a renderer still uploads when nothing changed between frames.
	'shader-client-static': {
		n: 211,
		build(T, n) { return buildShaderClient(T, n, { scale: 211 / 1313, staticFrame: true }); }
	},
	// 5000 Line / LineSegments / LineLoop objects: LineBasicMaterial and LineDashedMaterial
	// (computeLineDistances), vertex colours, linewidth set (ignored by WebGL), fog.
	'lines-many': {
		n: 5000,
		build(T, n) { return buildLinesMany(T, n); }
	},
	// One Points object with 1,000,000 vertices (size, sizeAttenuation, map, alphaMap, alphaTest,
	// vertex colours) plus 2,000 small Points objects over a handful of materials.
	'points-cloud': {
		n: 1000000,
		build(T, n) { return buildPointsCloud(T, n, 2000); }
	},
	// 5000 Sprites: SpriteMaterial with rotation, center, sizeAttenuation off/on, map, transparent
	// (depth sorted), fog.
	'sprites-many': {
		n: 5000,
		build(T, n) { return buildSpritesMany(T, n); }
	},
	// 200 skinned characters (20-bone chains, 4 weights per vertex) each driven by its own AnimationMixer.
	'skinned-crowd': {
		n: 200,
		build(T, n) { return buildSkinnedCrowd(T, n); }
	},
	// Shadows: 2000 casters/receivers under a shadow-casting directional light.
	'shadows': {
		n: 2000,
		build(T, n) { return buildShadows(T, n, false); }
	},
	// Same scene, but a third of the casters move every frame, so the shadow pass cannot be skipped.
	'shadows-animated': {
		n: 2000,
		build(T, n) { return buildShadows(T, n, true); }
	},
	// Point light shadows: the same 2000 casters under one shadow-casting point light (six cube faces, 512² each).
	'shadows-point': {
		n: 2000,
		build(T, n) { return buildShadows(T, n, false, true); }
	},
	// Same, with a third of the casters moving each frame: the six-face pass cannot be skipped.
	'shadows-point-animated': {
		n: 2000,
		build(T, n) { return buildShadows(T, n, true, true); }
	},
	// Every shadow kind at once: directional + spot + two point lights casting (cube maps share texture units with the 2D maps), plus a non-casting point light.
	'shadows-point-multi': {
		n: 400,
		build(T, n) {
			const { scene, camera } = buildShadows(T, n, false, true);
			scene.children.filter(c => c.isPointLight).forEach(l => { l.intensity = 2500; l.position.set(-12, 22, 6); });
			const lamp2 = new T.PointLight(0xffd0a0, 2500); lamp2.position.set(14, 18, -6); lamp2.castShadow = true;
			lamp2.shadow.camera.near = 1; lamp2.shadow.camera.far = 120; lamp2.shadow.bias = -0.0005; lamp2.shadow.mapSize.set(256, 256);
			const spot = new T.SpotLight(0x88aaff, 4000, 0, 0.5, 0.3); spot.position.set(0, 30, 25); spot.target.position.set(0, 0, 0); spot.castShadow = true;
			spot.shadow.camera.near = 5; spot.shadow.camera.far = 90; spot.shadow.mapSize.set(512, 512);
			const sun = new T.DirectionalLight(0xffffff, 0.6); sun.position.set(-20, 40, -10); sun.castShadow = true;
			sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.far = 120;
			const glow = new T.PointLight(0x00ff88, 500); glow.position.set(0, 6, 8);
			scene.add(lamp2, spot, spot.target, sun, glow);
			return { scene, camera };
		}
	},
	// 2000 MeshStandardMaterial spheres lit by scene.environment (a procedural equirectangular DataTexture
	// run through PMREMGenerator): image-based lighting through the PMREM path on every object, 8 materials.
	'pbr-envmap': {
		n: 2000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 35); camera.lookAt(0, 0, 0);
			const w = 256, h = 128, data = new Uint8Array(w * h * 4);
			for (let y = 0; y < h; y++) {
				const v = (y + 0.5) / h;
				for (let x = 0; x < w; x++) {
					const u = (x + 0.5) / w;
					let r, g, b;
					if (v > 0.5) { const t = (v - 0.5) * 2; r = 80 + 50 * (1 - t); g = 130 + 70 * (1 - t); b = 255; } else { const t = v * 2; r = 120 * t + 30; g = 90 * t + 25; b = 50 * t + 15; }
					const du = Math.min(Math.abs(u - 0.3), 1 - Math.abs(u - 0.3)), dv = v - 0.8;
					const sun = Math.exp(-(du * du + dv * dv) * 400);
					r += 255 * sun; g += 230 * sun; b += 160 * sun;
					if (u > 0.6 && u < 0.75 && v > 0.45 && v < 0.6) { r = 255; g = 60; b = 30; }
					const i = (y * w + x) * 4;
					data[i] = Math.min(255, r | 0); data[i + 1] = Math.min(255, g | 0); data[i + 2] = Math.min(255, b | 0); data[i + 3] = 255;
				}
			}
			const env = new T.DataTexture(data, w, h, T.RGBAFormat, T.UnsignedByteType);
			env.mapping = T.EquirectangularReflectionMapping; env.magFilter = T.LinearFilter; env.minFilter = T.LinearFilter; env.needsUpdate = true;
			scene.environment = env;
			scene.environmentIntensity = 1.2;
			const sun = new T.DirectionalLight(0xffffff, 1.5); sun.position.set(1, 2, 3); scene.add(sun);
			const geometry = new T.SphereGeometry(0.45, 16, 12);
			const materials = [];
			for (let i = 0; i < 8; i++) materials.push(new T.MeshStandardMaterial({ color: new T.Color().setHSL(i / 8, 0.6, 0.55), roughness: (i % 4) / 3, metalness: i < 4 ? 1 : 0.1 }));
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, materials[(i * 5) % 8]);
				const p = grid(i, n, 1.3); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
};

function buildSkinnedCrowd(T, n) {
	const scene = new T.Scene();
	scene.background = new T.Color(0x202830);
	const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
	camera.position.set(0, 14, 34); camera.lookAt(0, 2, 0);
	scene.add(new T.AmbientLight(0xffffff, 0.5));
	const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
	const bones = 20, height = 6;
	// one shared geometry: a tapered tube, every vertex weighted over 4 consecutive bones of a chain along Y
	const geometry = new T.CylinderGeometry(0.35, 0.5, height, 10, bones * 2);
	const position = geometry.attributes.position, count = position.count;
	const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
	for (let i = 0; i < count; i++) {
		const t = (position.getY(i) + height / 2) / height * (bones - 1); // 0 .. bones-1
		const b = Math.floor(t), f = t - b;
		// quadratic B-spline blend over bones b-1, b, b+1 (weights sum to 1); the 4th weight is 0
		const w = [0.5 * (1 - f) * (1 - f), 0.5 + f - f * f, 0.5 * f * f, 0];
		const idx = [Math.max(0, b - 1), b, Math.min(bones - 1, b + 1), 0];
		for (let k = 0; k < 4; k++) { skinIndex[i * 4 + k] = idx[k]; skinWeight[i * 4 + k] = w[k]; }
	}
	geometry.setAttribute('skinIndex', new T.BufferAttribute(skinIndex, 4));
	geometry.setAttribute('skinWeight', new T.BufferAttribute(skinWeight, 4));
	const materials = [];
	for (let i = 0; i < 8; i++) materials.push(new T.MeshLambertMaterial({ color: new T.Color().setHSL(i / 8, 0.5, 0.55) }));
	// one clip, shared: every bone sways with its own phase
	const tracks = [];
	for (let b = 0; b < bones; b++) {
		const times = [0, 0.5, 1, 1.5, 2], values = [];
		for (let k = 0; k < times.length; k++) {
			const a = 0.12 * Math.sin(k * Math.PI / 2 + b * 0.4), c = 0.08 * Math.cos(k * Math.PI / 2 + b * 0.7);
			const q = new T.Quaternion().setFromEuler(new T.Euler(a, 0, c));
			values.push(q.x, q.y, q.z, q.w);
		}
		tracks.push(new T.QuaternionKeyframeTrack('bone' + b + '.quaternion', times, values));
	}
	const clip = new T.AnimationClip('sway', 2, tracks);
	const mixers = [];
	const side = Math.ceil(Math.sqrt(n));
	for (let i = 0; i < n; i++) {
		const mesh = new T.SkinnedMesh(geometry, materials[i % materials.length]);
		const chain = [];
		let parent = mesh;
		for (let b = 0; b < bones; b++) {
			const bone = new T.Bone(); bone.name = 'bone' + b;
			bone.position.y = b === 0 ? -height / 2 : height / (bones - 1);
			parent.add(bone); chain.push(bone); parent = bone;
		}
		mesh.position.set(((i % side) - side / 2) * 2.2, height / 2 - 1, (Math.floor(i / side) - side / 2) * 2.2);
		mesh.rotation.y = i * 0.37;
		mesh.updateMatrixWorld(true);
		mesh.bind(new T.Skeleton(chain));
		scene.add(mesh);
		const mixer = new T.AnimationMixer(mesh);
		const action = mixer.clipAction(clip);
		action.time = (i * 0.173) % 2;
		action.play();
		mixers.push(mixer);
	}
	return { scene, camera, update: (f) => { for (let i = 0; i < mixers.length; i++) mixers[i].update(1 / 60); } };
}

function buildShadows(T, n, animated, point = false) {
	{
		{
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 25, 45); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.4));
			if (point) {
				const lamp = new T.PointLight(0xffffff, 6000); lamp.position.set(0, 30, 0); lamp.castShadow = true;
				lamp.shadow.camera.near = 1; lamp.shadow.camera.far = 120; lamp.shadow.bias = -0.0005;
				lamp.shadow.mapSize.set(512, 512);
				scene.add(lamp);
			} else {
				const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(20, 40, 10); sun.castShadow = true;
				sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 200;
				sun.shadow.mapSize.set(1024, 1024);
				scene.add(sun);
			}
			const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshLambertMaterial({ color: 0xcccccc }));
			floor.rotation.x = -Math.PI / 2; floor.position.y = -8; floor.receiveShadow = true; scene.add(floor);
			const geometry = new T.BoxGeometry(0.6, 0.6, 0.6);
			const material = new T.MeshLambertMaterial({ color: 0x8899ff });
			const meshes = [];
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, material);
				const p = grid(i, n, 1.5); m.position.set(p[0], p[1], p[2]);
				m.castShadow = true; m.receiveShadow = true;
				scene.add(m);
				meshes.push(m);
			}
			if (!animated) return { scene, camera };
			// every third caster bobs and spins
			return { scene, camera, update: (f) => { for (let i = 0; i < meshes.length; i += 3) { const m = meshes[i]; m.position.y += Math.sin(f * 0.1 + i) * 0.02; m.rotation.y = f * 0.05 + i; } } };
		}
	}
}

function buildShaderClient(T, n, opts) {
	const scale = opts.scale, staticFrame = opts.staticFrame === true;
	{
		{
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(70, 4 / 3, 0.5, 2000);
			camera.position.set(0, 60, 160); camera.lookAt(0, 0, 0);
			// --- shared textures
			const rt = new T.WebGLRenderTarget(512, 512, { depthBuffer: true });
			const rtNear = new T.WebGLRenderTarget(256, 256, { depthBuffer: true });
			const studs = new Uint8Array(64 * 128 * 6 * 4); for (let i = 0; i < studs.length; i++) studs[i] = (i * 31) & 255;
			const studsTex = new T.DataArrayTexture(studs, 64, 128, 6); studsTex.format = T.RGBAFormat; studsTex.type = T.UnsignedByteType; studsTex.needsUpdate = true;
			const lg = new Uint8Array(32 * 16 * 32); for (let i = 0; i < lg.length; i++) lg[i] = 128 + ((i * 7) & 63);
			const lgridTex = new T.Data3DTexture(lg, 32, 16, 32); lgridTex.format = T.RedFormat; lgridTex.type = T.UnsignedByteType; lgridTex.minFilter = lgridTex.magFilter = T.LinearFilter; lgridTex.needsUpdate = true;
			const faces = []; for (let f = 0; f < 6; f++) { const d = new Uint8Array(16 * 16 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = 40 * f; d[i + 1] = 90; d[i + 2] = 160; d[i + 3] = 255; } const t = new T.DataTexture(d, 16, 16, T.RGBAFormat, T.UnsignedByteType); t.needsUpdate = true; faces.push(t); }
			const envTex = new T.CubeTexture(faces); envTex.magFilter = envTex.minFilter = T.LinearFilter; envTex.generateMipmaps = false; envTex.needsUpdate = true;
			const makeDiffuse = (seed) => { const d = new Uint8Array(32 * 32 * 4); for (let i = 0; i < d.length; i += 4) { d[i] = (i * seed) & 255; d[i + 1] = (i >> 2) & 255; d[i + 2] = seed * 20; d[i + 3] = 255; } const t = new T.DataTexture(d, 32, 32, T.RGBAFormat, T.UnsignedByteType); t.minFilter = T.LinearMipmapLinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.needsUpdate = true; return t; };
			// --- the one shared uniforms object (30 entries), spread into every material
			const shared = {
				lamp0Dir: { value: new T.Vector3(0.3, 0.8, 0.5).normalize() }, lamp1Dir: { value: new T.Vector3(-0.5, 0.2, -0.8).normalize() },
				lamp0Color: { value: new T.Color(1, 0.95, 0.9) }, lamp1Color: { value: new T.Color(0.3, 0.35, 0.5) }, ambiColor: { value: new T.Color(0.25, 0.25, 0.3) },
				fogColor: { value: new T.Color(0.6, 0.7, 0.9) }, fogNear: { value: 200 }, fogFar: { value: 1200 },
				sunShadowMatrix: { value: new T.Matrix4() }, sunShadowMatrixNear: { value: new T.Matrix4() },
				sunShadowTexel: { value: new T.Vector2(1 / 512, 1 / 512) }, sunShadowTexelNear: { value: new T.Vector2(1 / 256, 1 / 256) },
				sunShadowMap: { value: rt.texture }, sunShadowMapNear: { value: rtNear.texture },
				studsSamp: { value: studsTex }, envSamp: { value: envTex }, lgridTex: { value: lgridTex },
				lgridOrigin: { value: new T.Vector3(-64, -16, -64) }, lgridSize: { value: new T.Vector3(128, 32, 128) }, lgridOn: { value: 1 },
				time: { value: 0 }, cameraPos: { value: new T.Vector3() }, outlineColor: { value: new T.Color(0, 0, 0) }, outlineWidth: { value: 0.02 },
				specPower: { value: 32 }, envStrength: { value: 0.3 }, shadowBias: { value: 0.002 }, shadowStrength: { value: 0.6 }, lgridBlend: { value: 0.5 }, globalScale: { value: new T.Vector4(1, 1, 1, 1) },
			};
			const vs = `
				attribute vec3 aColor; attribute vec2 aStudsUV; attribute vec2 aSurfaceUV; attribute vec3 aTangent; attribute vec2 aTexPos;
				uniform mat4 sunShadowMatrix; uniform mat4 sunShadowMatrixNear;
				varying vec3 vColor; varying vec3 vNormal; varying vec3 vWorld; varying vec2 vStuds; varying vec2 vSurf; varying vec4 vShadow; varying vec4 vShadowNear; varying vec3 vTangent;
				void main() {
					#ifdef BATCHED
					vec4 wp = vec4(position, 1.0); vNormal = normal; vTangent = aTangent;
					#else
					vec4 wp = modelMatrix * vec4(position, 1.0); vNormal = mat3(modelMatrix) * normal; vTangent = mat3(modelMatrix) * aTangent;
					#endif
					vColor = aColor; vStuds = aStudsUV; vSurf = aSurfaceUV + aTexPos; vWorld = wp.xyz;
					vShadow = sunShadowMatrix * wp; vShadowNear = sunShadowMatrixNear * wp;
					gl_Position = projectionMatrix * viewMatrix * wp;
				}`;
			const fs = `
				precision highp sampler3D; precision highp sampler2DArray;
				uniform vec3 lamp0Dir, lamp1Dir, lamp0Color, lamp1Color, ambiColor, fogColor, lgridOrigin, lgridSize, cameraPos, outlineColor; uniform float fogNear, fogFar, lgridOn, time, outlineWidth, specPower, envStrength, shadowBias, shadowStrength, lgridBlend; uniform vec4 globalScale;
				uniform vec2 sunShadowTexel, sunShadowTexelNear; uniform sampler2D sunShadowMap, sunShadowMapNear, diffuseSamp; uniform sampler2DArray studsSamp; uniform samplerCube envSamp; uniform sampler3D lgridTex;
				uniform float opacity, reflectance, lodDistance, ffSpecular;
				varying vec3 vColor; varying vec3 vNormal; varying vec3 vWorld; varying vec2 vStuds; varying vec2 vSurf; varying vec4 vShadow; varying vec4 vShadowNear; varying vec3 vTangent;
				void main() {
					vec3 n = normalize(vNormal);
					vec3 base = vColor * texture2D(diffuseSamp, vSurf).rgb;
					vec4 studs = texture(studsSamp, vec3(vStuds, float(VARIANT % 6)));
					float lg = texture(lgridTex, (vWorld - lgridOrigin) / lgridSize).r * lgridOn;
					vec3 sc = vShadow.xyz / vShadow.w; float sh = step(sc.z - shadowBias, texture2D(sunShadowMap, sc.xy).r);
					vec3 scn = vShadowNear.xyz / vShadowNear.w; sh *= step(scn.z - shadowBias, texture2D(sunShadowMapNear, scn.xy).r);
					vec3 v = normalize(cameraPos - vWorld); vec3 r = reflect(-v, n);
					vec3 env = textureCube(envSamp, r).rgb * envStrength * reflectance;
					float d0 = max(dot(n, lamp0Dir), 0.0), d1 = max(dot(n, lamp1Dir), 0.0);
					vec3 light = ambiColor + lamp0Color * d0 * mix(1.0, sh, shadowStrength) + lamp1Color * d1;
					light = mix(light, light * lg * 2.0, lgridBlend);
					float spec = pow(max(dot(r, lamp0Dir), 0.0), specPower) * ffSpecular;
					vec3 c = base * light * mix(vec3(1.0), studs.rgb, 0.3 + 0.01 * float(VARIANT)) + spec + env + outlineColor * outlineWidth * 0.0 + vTangent * 0.0 + globalScale.xyz * 0.0;
					float f = smoothstep(fogNear, fogFar, length(cameraPos - vWorld));
					gl_FragColor = vec4(mix(c, fogColor, f), opacity);
				}`;
			// Like the client, several material INSTANCES share one shader (same source and defines,
			// different uniform values); a renderer must still use one program for them.
			const material = (variant, own, transparent, batched, instance) => new T.ShaderMaterial({
				defines: batched ? { VARIANT: variant, BATCHED: '' } : { VARIANT: variant },
				uniforms: { ...shared, opacity: { value: transparent ? 0.6 : 1 }, reflectance: { value: 0.2 + variant * 0.05 + instance * 0.1 }, lodDistance: { value: 300 }, ffSpecular: { value: 0.5 }, diffuseSamp: { value: makeDiffuse(variant + 1 + instance) }, ...own },
				vertexShader: vs, fragmentShader: fs, transparent, depthWrite: !transparent,
			});
			// --- geometry with the client's custom attributes
			const addAttributes = (g, seed) => {
				const count = g.attributes.position.count;
				const col = new Float32Array(count * 3), studsUv = new Float32Array(count * 2), surf = new Float32Array(count * 2), tan = new Float32Array(count * 3), texPos = new Float32Array(count * 2);
				for (let i = 0; i < count; i++) { col[i * 3] = 0.3 + ((seed * 7 + i) % 10) / 14; col[i * 3 + 1] = 0.3 + ((seed * 3 + i) % 10) / 14; col[i * 3 + 2] = 0.3 + ((seed * 5 + i) % 10) / 14; studsUv[i * 2] = (i % 4) / 4; studsUv[i * 2 + 1] = ((i >> 2) % 4) / 4; surf[i * 2] = i % 2; surf[i * 2 + 1] = (i >> 1) % 2; tan[i * 3] = 1; texPos[i * 2] = seed * 0.1; }
				g.setAttribute('aColor', new T.BufferAttribute(col, 3)); g.setAttribute('aStudsUV', new T.BufferAttribute(studsUv, 2)); g.setAttribute('aSurfaceUV', new T.BufferAttribute(surf, 2)); g.setAttribute('aTangent', new T.BufferAttribute(tan, 3)); g.setAttribute('aTexPos', new T.BufferAttribute(texPos, 2));
				return g;
			};
			// pre-batched chunks: each a unique merged geometry (~1,200 triangles) in world space
			const chunkGeometry = (seed, cx = 0, cz = 0) => {
				const parts = 100, pos = new Float32Array(parts * 24 * 3), nor = new Float32Array(parts * 24 * 3), idx = new Uint32Array(parts * 36);
				const box = new T.BoxGeometry(2, 2, 2); const bp = box.attributes.position.array, bn = box.attributes.normal.array, bi = box.index.array;
				for (let p = 0; p < parts; p++) {
					const ox = ((seed * 13 + p * 7) % 40) - 20 + cx, oy = ((seed * 3 + p * 5) % 8), oz = ((seed * 17 + p * 11) % 40) - 20 + cz;
					for (let v = 0; v < 24; v++) { pos[(p * 24 + v) * 3] = bp[v * 3] + ox; pos[(p * 24 + v) * 3 + 1] = bp[v * 3 + 1] + oy; pos[(p * 24 + v) * 3 + 2] = bp[v * 3 + 2] + oz; nor[(p * 24 + v) * 3] = bn[v * 3]; nor[(p * 24 + v) * 3 + 1] = bn[v * 3 + 1]; nor[(p * 24 + v) * 3 + 2] = bn[v * 3 + 2]; }
					for (let t = 0; t < 36; t++) idx[p * 36 + t] = bi[t] + p * 24;
				}
				const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setIndex(new T.BufferAttribute(idx, 1));
				return addAttributes(g, seed);
			};
			const singleGeometries = []; for (let i = 0; i < 20; i++) singleGeometries.push(addAttributes(new T.BoxGeometry(1 + (i % 5), 1 + (i % 3), 1 + (i % 4)), i));
			// --- population, per the measured scene
			const groups = [
				{ name: 'plastic_low batched', count: 442, variant: 0, batched: true },
				{ name: 'plastic_low', count: 265, variant: 1 },
				{ name: 'textured transparent', count: 126, variant: 2, transparent: true },
				{ name: 'textured', count: 50, variant: 2 },
				{ name: 'diamondplate', count: 115, variant: 3 }, { name: 'wood', count: 87, variant: 4 }, { name: 'grass', count: 77, variant: 5 },
				{ name: 'slate', count: 55, variant: 6 }, { name: 'concrete', count: 42, variant: 7 }, { name: 'rust', count: 2, variant: 8 },
				{ name: 'adorn', count: 8, variant: 9 }, { name: 'glass', count: 24, variant: 10, transparent: true }, { name: 'neon', count: 20, variant: 11 },
			];
			let i = 0, batchedIndex = 0;
			for (const g of groups) {
				const mats = [material(g.variant, {}, g.transparent === true, g.batched === true, 0), material(g.variant, {}, g.transparent === true, g.batched === true, 1)];
				const count = Math.max(1, Math.round(g.count * scale));
				for (let k = 0; k < count; k++, i++) {
					const mat = mats[k % 2];
					let mesh;
					if (g.batched) {
						// pre-merged static geometry is already in world space; the mesh transform is identity
						const cx = (batchedIndex % 21 - 10) * 42, cz = (Math.floor(batchedIndex / 21) - 10) * 42;
						mesh = new T.Mesh(chunkGeometry(batchedIndex, cx, cz), mat);
						mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
						batchedIndex++;
					} else {
						mesh = new T.Mesh(singleGeometries[i % 20], mat);
						const p = grid(i, n, 6); mesh.position.set(p[0], p[1] + 20, p[2]); mesh.rotation.y = i * 0.3;
					}
					scene.add(mesh);
				}
			}
			// render the shadow targets once so their textures exist (both libraries)
			const shadowCam = new T.OrthographicCamera(-200, 200, 200, -200, 1, 500); shadowCam.position.set(50, 200, 80); shadowCam.lookAt(0, 0, 0); shadowCam.updateMatrixWorld();
			shared.sunShadowMatrix.value.multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
			shared.sunShadowMatrixNear.value.copy(shared.sunShadowMatrix.value);
			const warm = (renderer) => {
				const depthScene = new T.Scene(); depthScene.add(new T.Mesh(new T.PlaneGeometry(400, 400), new T.MeshBasicMaterial({ color: 0xffffff })));
				renderer.setRenderTarget(rt); renderer.render(depthScene, shadowCam);
				renderer.setRenderTarget(rtNear); renderer.render(depthScene, shadowCam);
				renderer.setRenderTarget(null);
			};
			shared.cameraPos.value.copy(camera.position);
			if (!staticFrame) {
				const lamp = shared.lamp0Dir.value.clone();
				return { scene, camera, warm, update: (f) => { shared.time.value = f * 0.016; shared.lamp0Dir.value.copy(lamp).applyAxisAngle(new T.Vector3(0, 1, 0), f * 0.002).normalize(); shared.cameraPos.value.copy(camera.position); } };
			}
			// --- static multi-pass frame: shadow RT passes with overrideMaterial, main pass, stencil volume passes
			const depthMat = new T.ShaderMaterial({
				vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
				fragmentShader: 'void main(){ gl_FragColor = vec4(vec3(gl_FragCoord.z), 1.0); }',
			});
			// 6 stencil shadow-volume style meshes: MeshBasicMaterial, stencil ops, renderOrder groups, no colour writes for the volume passes
			const volGeo = new T.BoxGeometry(6, 10, 6);
			const volFront = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: T.FrontSide, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilZFail: T.IncrementWrapStencilOp, stencilZPass: T.KeepStencilOp, stencilFail: T.KeepStencilOp });
			const volBack = new T.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: T.BackSide, stencilWrite: true, stencilFunc: T.AlwaysStencilFunc, stencilZFail: T.DecrementWrapStencilOp, stencilZPass: T.KeepStencilOp, stencilFail: T.KeepStencilOp });
			const volShade = new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4, depthTest: false, depthWrite: false, stencilWrite: true, stencilFunc: T.NotEqualStencilFunc, stencilRef: 0, stencilWriteMask: 0, stencilZPass: T.KeepStencilOp });
			for (let v = 0; v < 2; v++) {
				const f = new T.Mesh(volGeo, volFront); f.position.set(v * 30 - 15, 10, 20); f.renderOrder = 1; scene.add(f);
				const b = new T.Mesh(volGeo, volBack); b.position.copy(f.position); b.renderOrder = 2; scene.add(b);
				const sh = new T.Mesh(new T.PlaneGeometry(2, 2), volShade); sh.position.set(0, 0, 5); sh.renderOrder = 3; sh.frustumCulled = false; scene.add(sh);
			}
			const nearCam = shadowCam.clone(); nearCam.left = -60; nearCam.right = 60; nearCam.top = 60; nearCam.bottom = -60; nearCam.updateProjectionMatrix();
			const frame = (renderer) => {
				scene.overrideMaterial = depthMat;
				renderer.setRenderTarget(rt); renderer.clear(); renderer.render(scene, shadowCam);
				renderer.setRenderTarget(rtNear); renderer.clear(); renderer.render(scene, nearCam);
				scene.overrideMaterial = null;
				renderer.setRenderTarget(null);
				renderer.render(scene, camera);
			};
			return { scene, camera, warm, frame, passes: ['shadow RT (overrideMaterial)', 'near shadow RT (overrideMaterial)', 'main + stencil volumes'] };
		}
	}
}

// deterministic pseudo random numbers so both libraries build the same scene
function rng(seed) {
	let s = seed >>> 0;
	return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

// 64x64 RGBA soft disc (colour varies with position), and a 32x32 single-channel alpha ring
function makeDiscTexture(T) {
	const size = 64, d = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1, r = Math.sqrt(dx * dx + dy * dy), i = (y * size + x) * 4;
		d[i] = 255 - x * 2; d[i + 1] = 160 + y; d[i + 2] = 255; d[i + 3] = r < 1 ? Math.round(255 * Math.min(1, (1 - r) * 3)) : 0;
	}
	const t = new T.DataTexture(d, size, size, T.RGBAFormat, T.UnsignedByteType);
	t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true;
	return t;
}
function makeAlphaTexture(T) {
	const size = 32, d = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1, r = Math.sqrt(dx * dx + dy * dy), i = (y * size + x) * 4;
		const v = r > 0.35 && r < 0.95 ? 255 : 90;
		d[i] = 0; d[i + 1] = v; d[i + 2] = 0; d[i + 3] = 255;
	}
	const t = new T.DataTexture(d, size, size, T.RGBAFormat, T.UnsignedByteType);
	t.minFilter = T.LinearFilter; t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
	return t;
}

function buildLinesMany(T, n) {
	const rand = rng(4321);
	const scene = new T.Scene();
	scene.fog = new T.Fog(0x203040, 40, 110);
	scene.background = new T.Color(0x101820);
	const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 300);
	camera.position.set(0, 0, 70); camera.lookAt(0, 0, 0);
	const palette = [0xff5544, 0x44ff88, 0x4488ff, 0xffcc33, 0xff66ff, 0x66ffff];
	const basic = palette.map((c, i) => new T.LineBasicMaterial({ color: c, linewidth: 1 + (i % 3) * 2 }));
	const colored = new T.LineBasicMaterial({ vertexColors: true, linewidth: 4 });
	const noFog = new T.LineBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.6 });
	const dashed = [
		new T.LineDashedMaterial({ color: 0xffaa33, dashSize: 0.6, gapSize: 0.4, linewidth: 2 }),
		new T.LineDashedMaterial({ color: 0x33aaff, dashSize: 1.5, gapSize: 0.5, scale: 2 }),
		new T.LineDashedMaterial({ vertexColors: true, dashSize: 0.25, gapSize: 0.25, scale: 0.5 }),
	];
	const makeGeometry = (kind, pts, coloured) => {
		const pos = new Float32Array(pts * 3);
		let x = 0, y = 0, z = 0;
		for (let i = 0; i < pts; i++) { x += (rand() - 0.5) * 2.5; y += (rand() - 0.5) * 2.5; z += (rand() - 0.5) * 2.5; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; }
		const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
		if (coloured) { const col = new Float32Array(pts * 3); for (let i = 0; i < col.length; i++) col[i] = rand(); g.setAttribute('color', new T.BufferAttribute(col, 3)); }
		return g;
	};
	const sharedGeo = [makeGeometry('line', 6, false), makeGeometry('line', 9, true)];
	for (let i = 0; i < n; i++) {
		const kind = i % 3; // 0 Line, 1 LineSegments, 2 LineLoop
		const useDash = i % 5 === 0, coloured = i % 7 === 0;
		let geometry;
		if (i % 4 === 0) geometry = sharedGeo[coloured ? 1 : 0]; else geometry = makeGeometry(kind, kind === 1 ? 8 : 4 + (i % 5), coloured);
		let material;
		if (i % 5 === 1 || i % 5 === 3) {
			// per-object material instance (a distinct colour and opacity per line), as scenes that colour each line individually do
			material = i % 10 < 5 ? new T.LineBasicMaterial({ color: new T.Color().setHSL(rand(), 0.8, 0.6), transparent: i % 3 === 0, opacity: 0.5 + rand() * 0.5, linewidth: 2 })
				: new T.LineDashedMaterial({ color: new T.Color().setHSL(rand(), 0.8, 0.6), dashSize: 0.3 + rand(), gapSize: 0.2 + rand() * 0.6, scale: 0.5 + rand() * 2 });
		} else if (useDash) material = dashed[coloured ? 2 : i % 2];
		else if (coloured) material = colored;
		else if (i % 11 === 0) material = noFog;
		else material = basic[i % basic.length];
		const Ctor = kind === 0 ? T.Line : kind === 1 ? T.LineSegments : T.LineLoop;
		const o = new Ctor(geometry, material);
		if (useDash || material.isLineDashedMaterial) o.computeLineDistances();
		o.position.set((rand() - 0.5) * 90, (rand() - 0.5) * 60, (rand() - 0.5) * 60 - 10);
		o.rotation.set(rand() * 6.28, rand() * 6.28, rand() * 6.28);
		o.scale.setScalar(0.4 + rand() * 1.2);
		scene.add(o);
	}
	return { scene, camera, update: (f) => { const a = f * 0.004; camera.position.set(Math.sin(a) * 12, Math.cos(a) * 6, 70); camera.lookAt(0, 0, 0); } };
}

function buildPointsCloud(T, n, smallCount) {
	const rand = rng(99);
	const scene = new T.Scene();
	scene.fog = new T.Fog(0x000000, 60, 160);
	scene.background = new T.Color(0x080810);
	const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 400);
	camera.position.set(0, 0, 80); camera.lookAt(0, 0, 0);
	const disc = makeDiscTexture(T), ring = makeAlphaTexture(T);
	const big = new T.BufferGeometry();
	{
		const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			pos[i * 3] = (rand() - 0.5) * 100; pos[i * 3 + 1] = (rand() - 0.5) * 70; pos[i * 3 + 2] = (rand() - 0.5) * 100;
			col[i * 3] = rand(); col[i * 3 + 1] = rand(); col[i * 3 + 2] = rand();
		}
		big.setAttribute('position', new T.BufferAttribute(pos, 3)); big.setAttribute('color', new T.BufferAttribute(col, 3));
	}
	const bigMat = new T.PointsMaterial({ size: 0.45, sizeAttenuation: true, map: disc, alphaMap: ring, alphaTest: 0.3, vertexColors: true, transparent: false });
	const cloud = new T.Points(big, bigMat); cloud.frustumCulled = false;
	scene.add(cloud);
	const smallMats = [
		new T.PointsMaterial({ color: 0xff8844, size: 2.5, sizeAttenuation: false }),
		new T.PointsMaterial({ color: 0x88ccff, size: 0.8, sizeAttenuation: true, map: disc, alphaTest: 0.2 }),
		new T.PointsMaterial({ vertexColors: true, size: 3, sizeAttenuation: false, alphaMap: ring, transparent: true, depthWrite: false }),
		new T.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: true, fog: false, transparent: true, opacity: 0.7, map: disc }),
	];
	const smallGeo = [];
	for (let g = 0; g < 8; g++) {
		const count = 8 + g * 2, pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
		for (let i = 0; i < count; i++) { pos[i * 3] = (rand() - 0.5) * 3; pos[i * 3 + 1] = (rand() - 0.5) * 3; pos[i * 3 + 2] = (rand() - 0.5) * 3; col[i * 3] = rand(); col[i * 3 + 1] = rand(); col[i * 3 + 2] = rand(); }
		const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('color', new T.BufferAttribute(col, 3));
		smallGeo.push(geo);
	}
	for (let i = 0; i < smallCount; i++) {
		// half of the small clouds have a material of their own (colour, size and opacity per object)
		const mat = i % 2 ? new T.PointsMaterial({ color: new T.Color().setHSL(rand(), 0.8, 0.6), size: 0.5 + rand() * 2, sizeAttenuation: i % 4 === 1, map: disc, alphaTest: 0.2, opacity: 0.6 + rand() * 0.4 }) : smallMats[(i >> 1) % smallMats.length];
		const p = new T.Points(smallGeo[i % smallGeo.length], mat);
		p.position.set((rand() - 0.5) * 90, (rand() - 0.5) * 60, (rand() - 0.5) * 60 + 10);
		p.rotation.set(rand() * 6, rand() * 6, 0); p.scale.setScalar(0.5 + rand());
		scene.add(p);
	}
	return { scene, camera, update: (f) => { const a = f * 0.004; camera.position.set(Math.sin(a) * 15, Math.cos(a) * 8, 80); camera.lookAt(0, 0, 0); } };
}

function buildSpritesMany(T, n) {
	const rand = rng(7);
	const scene = new T.Scene();
	scene.fog = new T.Fog(0x304050, 30, 120);
	scene.background = new T.Color(0x182028);
	const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 300);
	camera.position.set(0, 0, 60); camera.lookAt(0, 0, 0);
	const disc = makeDiscTexture(T), ring = makeAlphaTexture(T);
	const mats = [
		new T.SpriteMaterial({ map: disc }),
		new T.SpriteMaterial({ map: disc, color: 0xffaa66, rotation: 0.6 }),
		new T.SpriteMaterial({ color: 0x66aaff, rotation: 1.3, opacity: 0.5 }),
		new T.SpriteMaterial({ map: disc, sizeAttenuation: false, rotation: -0.4, color: 0xaaffaa }),
		new T.SpriteMaterial({ alphaMap: ring, color: 0xffee88, fog: false, depthWrite: false }),
		new T.SpriteMaterial({ map: disc, alphaTest: 0.5, transparent: false, rotation: 0.2 }),
	];
	for (let i = 0; i < n; i++) {
		// 70% of the sprites own a SpriteMaterial (colour / opacity / rotation / size attenuation per sprite, sharing one texture)
		const own = i % 10 < 7;
		const mat = own ? new T.SpriteMaterial({ map: disc, color: new T.Color().setHSL(rand(), 0.7, 0.6), opacity: 0.5 + rand() * 0.5, rotation: (rand() - 0.5) * 6, sizeAttenuation: i % 4 !== 0 }) : mats[i % mats.length];
		const s = new T.Sprite(mat);
		s.position.set((rand() - 0.5) * 90, (rand() - 0.5) * 60, (rand() - 0.5) * 80);
		s.scale.setScalar(mat.sizeAttenuation === false ? 0.03 + rand() * 0.03 : 0.8 + rand() * 1.6);
		if (i % 4 === 1) s.scale.x *= 1.8;
		s.center.set(i % 3 === 0 ? 0 : 0.5, i % 5 === 0 ? 1 : 0.5);
		scene.add(s);
	}
	return { scene, camera, update: (f) => { const a = f * 0.004; camera.position.set(Math.sin(a) * 15, Math.cos(a) * 8, 60); camera.lookAt(0, 0, 0); } };
}
