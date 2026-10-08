// Benchmark scenarios. Each builds the same scene with either library (`T` is the module namespace).
// Returns { scene, camera, update(frame) } ; update is optional per-frame animation.

function grid(i, n, spacing) {
	const side = Math.ceil(Math.cbrt(n));
	const x = i % side, y = Math.floor(i / side) % side, z = Math.floor(i / (side * side));
	return [(x - side / 2) * spacing, (y - side / 2) * spacing, (z - side / 2) * spacing];
}

export const scenarios = {
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

function buildShadows(T, n, animated) {
	{
		{
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 25, 45); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.4));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(20, 40, 10); sun.castShadow = true;
			sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 200;
			sun.shadow.mapSize.set(1024, 1024);
			scene.add(sun);
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
