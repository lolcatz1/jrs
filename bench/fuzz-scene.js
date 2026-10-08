// Differential fuzzer scene generator. `buildFuzzScene(T, seed, features)` builds the SAME random
// scene with whichever library namespace `T` is (three.js or jrs): all randomness comes from a
// seeded generator and the construction order never depends on the library, so both builds consume
// the identical random sequence.
//
// Everything that would make the output legitimately order-dependent (depthTest/depthWrite off,
// stencil, blending on opaque objects) is given a distinct renderOrder, because three.js sorts
// opaque objects front-to-back while jrs groups them by material (documented difference).

export const FEATURES = {
	// geometry
	customGeometry: 'custom BufferGeometry (indexed and non-indexed)',
	groups: 'geometry.addGroup with material arrays',
	drawRange: 'geometry.setDrawRange',
	vertexColors: 'vertex colour attributes (RGB and RGBA)',
	wireframe: 'material.wireframe',
	// materials
	basic: 'MeshBasicMaterial', lambert: 'MeshLambertMaterial', phong: 'MeshPhongMaterial', standard: 'MeshStandardMaterial',
	shader: 'ShaderMaterial with three.js chunks',
	maps: 'procedural DataTexture colour/alpha/emissive/specular maps with wrap/filter/transform variations',
	transparency: 'transparent materials, opacity, all blending modes, premultipliedAlpha',
	alphaTest: 'material.alphaTest',
	side: 'FrontSide/BackSide/DoubleSide',
	depthState: 'depthTest/depthWrite off (with unique renderOrder)',
	stencil: 'stencil write/test pairs (with unique renderOrder)',
	flatShading: 'flatShading on lit materials',
	// scene
	fog: 'Fog / FogExp2',
	lights: 'ambient/hemisphere/directional/point/spot lights',
	shadows: 'shadow maps for directional and spot lights',
	instancing: 'InstancedMesh with animated matrices and instance colours',
	hierarchy: 'nested groups with animated transforms',
	cameraMoves: 'camera orbit, fov/zoom changes, orthographic camera',
	renderTarget: 'a sub-scene rendered into a WebGLRenderTarget used as a map',
	overrideMaterial: 'scene.overrideMaterial on some frames',
	background: 'scene.background colour / clear colour',
	toneMapping: 'tone mapping operators and exposure',
	// off by default: known differences, see bench/results/swarm/parity-fuzzer.md
	shaderFog: 'ShaderMaterial with fog: true (three fog chunks)',
	agx: 'AgX tone mapping (not implemented in jrs)',
	points: 'Points objects (point size rasterisation)',
	lines: 'Line / LineSegments objects',
};
export const DEFAULT_OFF = ['agx', 'shaderFog', 'points', 'lines'];

export function defaultFeatures() {
	const f = {};
	for (const k of Object.keys(FEATURES)) f[k] = !DEFAULT_OFF.includes(k);
	return f;
}

// mulberry32: small, fast, deterministic
export function makeRng(seed) {
	let a = (seed >>> 0) || 0x9e3779b9;
	const next = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
	const rng = next;
	rng.int = (n) => Math.floor(next() * n);
	rng.range = (lo, hi) => lo + next() * (hi - lo);
	rng.pick = (arr) => arr[Math.floor(next() * arr.length)];
	rng.chance = (p) => next() < p;
	rng.sign = () => next() < 0.5 ? -1 : 1;
	return rng;
}

export function buildFuzzScene(T, seed, features = defaultFeatures(), opts = {}) {
	const rng = makeRng(seed);
	const width = opts.width || 320, height = opts.height || 240;
	const frames = opts.frames || 6;
	const notes = [];
	const note = (s) => notes.push(s);
	let nextRenderOrder = 1;

	// ---------- scene, camera ----------
	const scene = new T.Scene();
	let camera;
	const ortho = features.cameraMoves && rng.chance(0.25);
	if (ortho) {
		const h = rng.range(4, 8);
		camera = new T.OrthographicCamera(-h * width / height, h * width / height, h, -h, 0.5, 60);
		note('orthographic camera');
	} else {
		camera = new T.PerspectiveCamera(rng.range(35, 80), width / height, rng.pick([0.1, 0.5, 1]), rng.pick([50, 100, 500]));
	}
	const camR = rng.range(9, 15), camTheta = rng.range(0, Math.PI * 2), camPhi = rng.range(0.15, 1.2);
	const camTarget = new T.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
	const placeCamera = (f) => {
		const dTheta = features.cameraMoves ? f * rng_camSpeed : 0;
		const r = camR + (features.cameraMoves ? Math.sin(f * 0.7) * rng_camZoom : 0);
		camera.position.set(r * Math.sin(camPhi) * Math.cos(camTheta + dTheta), r * Math.cos(camPhi), r * Math.sin(camPhi) * Math.sin(camTheta + dTheta));
		camera.lookAt(camTarget);
	};
	const rng_camSpeed = rng.range(-0.15, 0.15), rng_camZoom = rng.range(0, 2);
	const camFovAnim = features.cameraMoves && !ortho && rng.chance(0.3);
	const camZoomAnim = features.cameraMoves && rng.chance(0.2);
	if (features.cameraMoves && rng.chance(0.1)) { camera.setViewOffset(width * 2, height * 2, rng.int(width), rng.int(height), width, height); note('camera view offset'); }

	// ---------- background / clear ----------
	const clearColor = new T.Color().setHSL(rng(), rng.range(0.2, 0.8), rng.range(0.05, 0.5));
	let background = null;
	if (features.background) {
		if (rng.chance(0.75)) { background = clearColor.clone(); scene.background = background; }
	} else scene.background = new T.Color(0x202020);
	const useClearColor = features.background && background === null && rng.chance(0.7);

	// ---------- fog ----------
	if (features.fog && rng.chance(0.45)) {
		const col = new T.Color().setHSL(rng(), 0.5, 0.5);
		if (rng.chance(0.4)) { scene.fog = new T.FogExp2(col, rng.range(0.02, 0.09)); note('FogExp2'); }
		else { scene.fog = new T.Fog(col, rng.range(2, 8), rng.range(12, 25)); note('Fog'); }
	}

	// ---------- lights ----------
	const shadowLights = [];
	const wantShadows = features.shadows && rng.chance(0.5);
	if (features.lights) {
		if (rng.chance(0.85)) scene.add(new T.AmbientLight(new T.Color().setHSL(rng(), 0.3, 0.6), rng.range(0.1, 1.5)));
		const nHemi = rng.int(3), nDir = rng.int(4), nPoint = rng.int(4), nSpot = rng.int(3);
		for (let i = 0; i < nHemi; i++) scene.add(new T.HemisphereLight(new T.Color().setHSL(rng(), 0.5, 0.7), new T.Color().setHSL(rng(), 0.5, 0.3), rng.range(0.2, 1.5)));
		for (let i = 0; i < nDir; i++) {
			const l = new T.DirectionalLight(new T.Color().setHSL(rng(), rng.range(0, 0.6), rng.range(0.5, 1)), rng.range(0.3, 3.5));
			l.position.set(rng.range(-10, 10), rng.range(2, 12), rng.range(-10, 10));
			if (rng.chance(0.3)) { l.target.position.set(rng.range(-3, 3), rng.range(-3, 3), rng.range(-3, 3)); scene.add(l.target); }
			if (wantShadows && rng.chance(0.6)) {
				l.castShadow = true;
				const s = rng.pick([6, 8, 12]);
				l.shadow.camera.left = -s; l.shadow.camera.right = s; l.shadow.camera.top = s; l.shadow.camera.bottom = -s;
				l.shadow.camera.near = 0.5; l.shadow.camera.far = 40;
				l.shadow.mapSize.set(rng.pick([256, 512]), rng.pick([256, 512]));
				l.shadow.bias = rng.pick([0, -0.001, 0.002]); l.shadow.normalBias = rng.pick([0, 0.02, 0.05]);
				l.shadow.radius = rng.pick([1, 1, 2, 4]);
				shadowLights.push(l);
			}
			scene.add(l);
		}
		for (let i = 0; i < nPoint; i++) {
			const l = new T.PointLight(new T.Color().setHSL(rng(), rng.range(0, 0.7), rng.range(0.5, 1)), rng.range(20, 250), rng.pick([0, 0, 15, 30]), rng.pick([2, 2, 1]));
			l.position.set(rng.range(-6, 6), rng.range(-2, 8), rng.range(-6, 6));
			scene.add(l);
		}
		for (let i = 0; i < nSpot; i++) {
			const l = new T.SpotLight(new T.Color().setHSL(rng(), rng.range(0, 0.7), rng.range(0.5, 1)), rng.range(50, 400), rng.pick([0, 0, 30]), rng.range(0.3, 1.1), rng.range(0, 1), rng.pick([2, 2, 1]));
			l.position.set(rng.range(-8, 8), rng.range(3, 12), rng.range(-8, 8));
			l.target.position.set(rng.range(-2, 2), rng.range(-2, 2), rng.range(-2, 2)); scene.add(l.target);
			if (wantShadows && rng.chance(0.5)) {
				l.castShadow = true;
				l.shadow.mapSize.set(rng.pick([256, 512]), rng.pick([256, 512]));
				l.shadow.camera.near = 0.5; l.shadow.camera.far = 40;
				l.shadow.bias = rng.pick([0, -0.001, 0.002]); l.shadow.normalBias = rng.pick([0, 0.02]);
				l.shadow.radius = rng.pick([1, 1, 2, 4]);
				shadowLights.push(l);
			}
			scene.add(l);
		}
		note(`lights: hemi ${nHemi} dir ${nDir} point ${nPoint} spot ${nSpot}${shadowLights.length ? ` (${shadowLights.length} casting shadows)` : ''}`);
	} else scene.add(new T.AmbientLight(0xffffff, 1));

	// ---------- textures ----------
	const textures = [];
	const makeTexture = (kind) => {
		const size = rng.pick([8, 16, 32]);
		const data = new Uint8Array(size * size * 4);
		const fx = rng.range(0.5, 4), fy = rng.range(0.5, 4), ph = rng.range(0, 6);
		for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
			const i = (y * size + x) * 4;
			const u = x / size, v = y / size;
			let r, g, b, a;
			if (kind === 'checker') { const c = ((x >> 2) + (y >> 2)) & 1; r = c ? 230 : 40; g = c ? 60 : 200; b = c ? 90 : 220; a = ((x + y) & 3) === 0 ? 60 : 255; }
			else { r = 128 + 127 * Math.sin(u * fx * 6.283 + ph); g = 128 + 127 * Math.sin(v * fy * 6.283 + ph * 0.5); b = (x * 37 + y * 91 + seed) & 255; a = 100 + ((x * 13 + y * 7) % 156); }
			data[i] = r | 0; data[i + 1] = g | 0; data[i + 2] = b | 0; data[i + 3] = a | 0;
		}
		const tex = new T.DataTexture(data, size, size, T.RGBAFormat, T.UnsignedByteType);
		tex.magFilter = rng.pick([T.NearestFilter, T.LinearFilter]);
		tex.minFilter = rng.pick([T.NearestFilter, T.LinearFilter, T.LinearMipmapLinearFilter, T.NearestMipmapNearestFilter, T.LinearMipmapNearestFilter]);
		tex.generateMipmaps = tex.minFilter !== T.NearestFilter && tex.minFilter !== T.LinearFilter;
		tex.wrapS = rng.pick([T.RepeatWrapping, T.ClampToEdgeWrapping, T.MirroredRepeatWrapping]);
		tex.wrapT = rng.pick([T.RepeatWrapping, T.ClampToEdgeWrapping, T.MirroredRepeatWrapping]);
		if (rng.chance(0.3)) tex.colorSpace = T.SRGBColorSpace;
		if (rng.chance(0.4)) { tex.repeat.set(rng.range(0.5, 3), rng.range(0.5, 3)); tex.offset.set(rng.range(0, 1), rng.range(0, 1)); }
		if (rng.chance(0.2)) { tex.rotation = rng.range(0, 6.28); tex.center.set(0.5, 0.5); }
		tex.needsUpdate = true;
		textures.push(tex);
		return tex;
	};
	const nTextures = features.maps ? 1 + rng.int(4) : 0;
	for (let i = 0; i < nTextures; i++) makeTexture(rng.pick(['checker', 'wave', 'wave']));

	// ---------- render target (sub-scene rendered to a texture used as a map) ----------
	let renderTarget = null, rtScene = null, rtCamera = null, rtAnim = null;
	if (features.renderTarget && rng.chance(0.35)) {
		const size = rng.pick([64, 128, 256]);
		renderTarget = new T.WebGLRenderTarget(size, size, { depthBuffer: true, stencilBuffer: false, minFilter: T.LinearFilter, magFilter: T.LinearFilter });
		if (rng.chance(0.3)) renderTarget.texture.colorSpace = T.SRGBColorSpace;
		rtScene = new T.Scene();
		rtScene.background = new T.Color().setHSL(rng(), 0.6, 0.4);
		rtCamera = new T.PerspectiveCamera(60, 1, 0.1, 50); rtCamera.position.set(0, 1.5, 6); rtCamera.lookAt(0, 0, 0);
		rtScene.add(new T.AmbientLight(0xffffff, 0.8));
		const d = new T.DirectionalLight(0xffffff, 2); d.position.set(2, 3, 4); rtScene.add(d);
		const rtMeshes = [];
		const n = 2 + rng.int(4);
		for (let i = 0; i < n; i++) {
			const m = new T.Mesh(rng.pick([new T.BoxGeometry(1, 1, 1), new T.SphereGeometry(0.6, 12, 8), new T.TorusGeometry(0.6, 0.2, 8, 16)]),
				rng.chance(0.5) ? new T.MeshLambertMaterial({ color: new T.Color().setHSL(rng(), 0.8, 0.5) }) : new T.MeshBasicMaterial({ color: new T.Color().setHSL(rng(), 0.8, 0.5) }));
			m.position.set(rng.range(-2, 2), rng.range(-1.5, 1.5), rng.range(-1, 1)); m.rotation.set(rng.range(0, 6), rng.range(0, 6), 0);
			rtScene.add(m); rtMeshes.push(m);
		}
		rtAnim = (f) => { for (let i = 0; i < rtMeshes.length; i++) rtMeshes[i].rotation.y += 0.2 + i * 0.1; };
		textures.push(renderTarget.texture);
		note(`render target ${size}x${size}${renderTarget.texture.colorSpace === T.SRGBColorSpace ? ' sRGB' : ''}`);
	}

	// ---------- geometries ----------
	const geometries = [];
	const randomColorAttr = (count, itemSize) => {
		const a = new Float32Array(count * itemSize);
		for (let i = 0; i < count; i++) { a[i * itemSize] = rng(); a[i * itemSize + 1] = rng(); a[i * itemSize + 2] = rng(); if (itemSize === 4) a[i * itemSize + 3] = rng.range(0.2, 1); }
		return new T.BufferAttribute(a, itemSize);
	};
	const customGeometry = () => {
		// a random triangle soup / fan: `tris` triangles around a ring, optionally indexed
		const tris = 4 + rng.int(20);
		const indexed = rng.chance(0.5);
		const g = new T.BufferGeometry();
		if (indexed) {
			const nv = tris + 2;
			const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
			for (let i = 0; i < nv; i++) {
				const ang = i / nv * Math.PI * 2, r = i === 0 ? 0 : rng.range(0.5, 1.2);
				pos[i * 3] = Math.cos(ang) * r; pos[i * 3 + 1] = rng.range(-0.3, 0.3); pos[i * 3 + 2] = Math.sin(ang) * r;
				nor[i * 3] = 0; nor[i * 3 + 1] = 1; nor[i * 3 + 2] = 0;
				uv[i * 2] = Math.cos(ang) * 0.5 + 0.5; uv[i * 2 + 1] = Math.sin(ang) * 0.5 + 0.5;
			}
			const idx = [];
			for (let i = 1; i < nv - 1; i++) idx.push(0, i + 1, i);
			g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
			g.setIndex(rng.chance(0.5) ? new T.BufferAttribute(new Uint16Array(idx), 1) : idx);
		} else {
			const nv = tris * 3;
			const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
			for (let t = 0; t < tris; t++) {
				const cx = rng.range(-1, 1), cy = rng.range(-1, 1), cz = rng.range(-1, 1);
				const n = new T.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
				for (let k = 0; k < 3; k++) {
					const i = t * 3 + k;
					pos[i * 3] = cx + rng.range(-0.6, 0.6); pos[i * 3 + 1] = cy + rng.range(-0.6, 0.6); pos[i * 3 + 2] = cz + rng.range(-0.6, 0.6);
					nor[i * 3] = n.x; nor[i * 3 + 1] = n.y; nor[i * 3 + 2] = n.z;
					uv[i * 2] = rng(); uv[i * 2 + 1] = rng();
				}
			}
			g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('normal', new T.BufferAttribute(nor, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
			if (rng.chance(0.5)) g.computeVertexNormals();
		}
		return g;
	};
	const seedVertexColors = features.vertexColors && rng.chance(0.4); // all geometries carry colours, or none (three renders black without the attribute)
	const nGeo = 2 + rng.int(5);
	for (let i = 0; i < nGeo; i++) {
		const kinds = ['box', 'sphere', 'plane', 'torus', 'cylinder'];
		if (features.customGeometry) kinds.push('custom', 'custom');
		const kind = rng.pick(kinds);
		let g;
		if (kind === 'box') g = new T.BoxGeometry(rng.range(0.5, 2), rng.range(0.5, 2), rng.range(0.5, 2), rng.pick([1, 1, 2, 3]), rng.pick([1, 1, 2]), 1);
		else if (kind === 'sphere') g = new T.SphereGeometry(rng.range(0.4, 1.3), rng.pick([6, 10, 16, 24]), rng.pick([4, 8, 12]));
		else if (kind === 'plane') g = new T.PlaneGeometry(rng.range(0.8, 3), rng.range(0.8, 3), rng.pick([1, 1, 3]), rng.pick([1, 2]));
		else if (kind === 'torus') g = new T.TorusGeometry(rng.range(0.4, 1), rng.range(0.1, 0.4), rng.pick([6, 8, 12]), rng.pick([8, 12, 20]));
		else if (kind === 'cylinder') g = new T.CylinderGeometry(rng.range(0.1, 1), rng.range(0.2, 1), rng.range(0.5, 2), rng.pick([5, 8, 16]), 1, rng.chance(0.3));
		else g = customGeometry();
		if (features.customGeometry && kind !== 'custom' && rng.chance(0.2)) g = g.toNonIndexed();
		if (seedVertexColors) g.setAttribute('color', randomColorAttr(g.attributes.position.count, rng.chance(0.3) ? 4 : 3));
		if (features.drawRange && rng.chance(0.25)) {
			const total = g.index ? g.index.count : g.attributes.position.count;
			const start = 3 * rng.int(Math.max(1, (total / 3) >> 1));
			const count = 3 * (1 + rng.int(Math.max(1, (total - start) / 3)));
			g.setDrawRange(start, count);
		}
		if (features.groups && rng.chance(0.3)) {
			g.clearGroups();
			const total = g.index ? g.index.count : g.attributes.position.count;
			const nGroups = 2 + rng.int(3);
			let at = 0;
			for (let k = 0; k < nGroups; k++) {
				const remaining = total - at;
				const cnt = k === nGroups - 1 ? remaining : 3 * (1 + rng.int(Math.max(1, remaining / 3 / (nGroups - k))));
				if (cnt <= 0) break;
				g.addGroup(at, cnt, k);
				at += cnt;
			}
			g.userData.groupCount = nGroups;
		}
		geometries.push(g);
	}

	// ---------- materials ----------
	const materials = [];
	const orderSensitive = new Set();
	const randomColor = () => new T.Color().setHSL(rng(), rng.range(0.3, 1), rng.range(0.3, 0.75));
	const blendings = [T.NormalBlending, T.NormalBlending, T.AdditiveBlending, T.SubtractiveBlending, T.MultiplyBlending, T.CustomBlending];
	const factors = [T.ZeroFactor, T.OneFactor, T.SrcColorFactor, T.OneMinusSrcColorFactor, T.SrcAlphaFactor, T.OneMinusSrcAlphaFactor, T.DstAlphaFactor, T.OneMinusDstAlphaFactor, T.DstColorFactor, T.OneMinusDstColorFactor];
	const equations = [T.AddEquation, T.AddEquation, T.SubtractEquation, T.ReverseSubtractEquation, T.MinEquation, T.MaxEquation];
	const shaderTemplates = [
		// uses three's chunk library and built-in uniforms
		{
			name: 'chunks-uv-fog', vertexShader: `
				#include <common>
				#include <uv_pars_vertex>
				#include <color_pars_vertex>
				#include <fog_pars_vertex>
				varying vec3 vNormalW;
				void main() {
					#include <uv_vertex>
					#include <color_vertex>
					#include <beginnormal_vertex>
					#include <defaultnormal_vertex>
					#include <begin_vertex>
					#include <project_vertex>
					#include <fog_vertex>
					vNormalW = normalize( transformedNormal );
				}`,
			fragmentShader: `
				#include <common>
				#include <uv_pars_fragment>
				#include <color_pars_fragment>
				#include <fog_pars_fragment>
				uniform vec3 tint; uniform float uOpacity; uniform sampler2D tex; uniform vec3 lightDir;
				varying vec3 vNormalW;
				void main() {
					vec3 c = tint;
					#ifdef USE_UV
					c *= texture2D( tex, vUv ).rgb;
					#endif
					#ifdef USE_COLOR
					c *= vColor;
					#endif
					float d = 0.3 + 0.7 * max( dot( normalize( vNormalW ), normalize( lightDir ) ), 0.0 );
					gl_FragColor = vec4( c * d, uOpacity );
					#include <tonemapping_fragment>
					#include <colorspace_fragment>
					#include <fog_fragment>
				}`,
		},
		{
			name: 'raw-attributes', vertexShader: `
				attribute float aSize; attribute vec3 aOffset;
				varying float vS; varying vec3 vP;
				void main() {
					vS = aSize;
					vec3 p = position * ( 0.6 + 0.4 * aSize ) + aOffset;
					vP = p;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( p, 1.0 );
				}`,
			fragmentShader: `
				uniform vec3 tint; uniform float uOpacity; uniform float uTime;
				varying float vS; varying vec3 vP;
				void main() {
					vec3 c = tint * ( 0.5 + 0.5 * sin( vP * 3.0 + uTime ) ) * ( 0.5 + 0.5 * vS );
					gl_FragColor = vec4( c, uOpacity );
				}`,
			attributes: true,
		},
		{
			name: 'normal-view', vertexShader: `
				varying vec3 vN; varying vec3 vV;
				void main() {
					vN = normalMatrix * normal;
					vec4 mv = modelViewMatrix * vec4( position, 1.0 );
					vV = -mv.xyz;
					gl_Position = projectionMatrix * mv;
				}`,
			fragmentShader: `
				uniform vec3 tint; uniform float uOpacity;
				varying vec3 vN; varying vec3 vV;
				void main() {
					vec3 n = normalize( vN ); vec3 v = normalize( vV );
					float f = pow( 1.0 - max( dot( n, v ), 0.0 ), 2.0 );
					gl_FragColor = vec4( mix( tint, vec3( 1.0 ), f ), uOpacity );
					#include <colorspace_fragment>
				}`,
		},
	];
	const shaderUniformsShared = [];
	const makeMaterial = () => {
		const kinds = [];
		if (features.basic) kinds.push('basic');
		if (features.lambert) kinds.push('lambert');
		if (features.phong) kinds.push('phong');
		if (features.standard) kinds.push('standard');
		if (features.shader) kinds.push('shader');
		if (kinds.length === 0) kinds.push('basic');
		const kind = rng.pick(kinds);
		const params = { color: randomColor() };
		const transparent = features.transparency && rng.chance(0.3);
		const hasVertexColors = seedVertexColors && rng.chance(0.6);
		let sensitive = false;
		if (features.maps && textures.length && rng.chance(0.5)) params.map = rng.pick(textures);
		if (features.vertexColors) params.vertexColors = hasVertexColors;
		if (features.side) params.side = rng.pick([T.FrontSide, T.FrontSide, T.BackSide, T.DoubleSide]);
		if (features.wireframe && rng.chance(0.08)) params.wireframe = true;
		if (features.alphaTest && rng.chance(0.15)) params.alphaTest = rng.range(0.2, 0.8);
		if (transparent) {
			params.transparent = true;
			params.opacity = rng.range(0.2, 0.95);
			params.blending = rng.pick(blendings);
			if (params.blending === T.CustomBlending) {
				params.blendSrc = rng.pick(factors); params.blendDst = rng.pick(factors); params.blendEquation = rng.pick(equations);
				if (rng.chance(0.5)) { params.blendSrcAlpha = rng.pick(factors); params.blendDstAlpha = rng.pick(factors); params.blendEquationAlpha = rng.pick(equations); }
			}
			if (rng.chance(0.3)) params.premultipliedAlpha = true;
			if (features.depthState && rng.chance(0.4)) params.depthWrite = false;
		} else if (features.transparency && rng.chance(0.08)) {
			// blending on an opaque material: order-dependent
			params.blending = rng.pick([T.AdditiveBlending, T.MultiplyBlending]);
			sensitive = true;
		}
		if (features.depthState && rng.chance(0.08)) { params.depthTest = false; sensitive = true; }
		if (features.depthState && !transparent && rng.chance(0.08)) { params.depthWrite = false; sensitive = true; }
		if (features.flatShading && kind !== 'basic' && kind !== 'shader' && rng.chance(0.3)) params.flatShading = true;
		if (features.maps && textures.length) {
			if (rng.chance(0.2)) params.alphaMap = rng.pick(textures);
			if ((kind === 'lambert' || kind === 'phong' || kind === 'standard') && rng.chance(0.25)) { params.emissive = randomColor(); params.emissiveIntensity = rng.range(0.1, 1); if (rng.chance(0.5)) params.emissiveMap = rng.pick(textures); }
			if (kind === 'phong' && rng.chance(0.3)) params.specularMap = rng.pick(textures);
		}
		if (kind === 'phong') { params.shininess = rng.range(1, 120); params.specular = new T.Color().setHSL(rng(), 0.2, rng.range(0.05, 0.5)); }
		if (kind === 'standard') { params.roughness = rng.range(0, 1); params.metalness = rng.range(0, 1); }
		if ((kind === 'lambert' || kind === 'phong' || kind === 'standard') && rng.chance(0.2)) params.emissive = randomColor();
		if (features.fog && rng.chance(0.15)) params.fog = false;
		let mat;
		if (kind === 'basic') mat = new T.MeshBasicMaterial(params);
		else if (kind === 'lambert') mat = new T.MeshLambertMaterial(params);
		else if (kind === 'phong') mat = new T.MeshPhongMaterial(params);
		else if (kind === 'standard') mat = new T.MeshStandardMaterial(params);
		else {
			const tpl = rng.pick(shaderTemplates);
			const uniforms = T.UniformsUtils.merge([T.UniformsLib.fog, {
				tint: { value: params.color }, uOpacity: { value: transparent ? params.opacity : 1 }, tex: { value: params.map || null },
				lightDir: { value: new T.Vector3(rng.range(-1, 1), rng.range(0.2, 1), rng.range(-1, 1)) }, uTime: { value: 0 },
			}]);
			const defines = {};
			if (tpl.name === 'chunks-uv-fog' && params.map) defines.USE_UV = '';
			const sp = { uniforms, defines, vertexShader: tpl.vertexShader, fragmentShader: tpl.fragmentShader, side: params.side, transparent: params.transparent, blending: params.blending, depthTest: params.depthTest, depthWrite: params.depthWrite, premultipliedAlpha: params.premultipliedAlpha, vertexColors: hasVertexColors, wireframe: params.wireframe };
			if (params.blendSrc !== undefined) { sp.blendSrc = params.blendSrc; sp.blendDst = params.blendDst; sp.blendEquation = params.blendEquation; }
			if (params.blendSrcAlpha !== undefined) { sp.blendSrcAlpha = params.blendSrcAlpha; sp.blendDstAlpha = params.blendDstAlpha; sp.blendEquationAlpha = params.blendEquationAlpha; }
			if (features.shaderFog && scene.fog && rng.chance(0.6)) sp.fog = true;
			for (const k of Object.keys(sp)) if (sp[k] === undefined) delete sp[k];
			mat = new T.ShaderMaterial(sp);
			mat.userData.template = tpl.name; mat.userData.needsAttributes = tpl.attributes === true; mat.userData.usesUv = tpl.name === 'chunks-uv-fog';
			if (rng.chance(0.4)) mat.toneMapped = false;
			shaderUniformsShared.push(uniforms);
		}
		if (features.stencil && rng.chance(0.12)) {
			// a stencil writer; a matching reader is made right after, both order-sensitive
			const ref = 1 + rng.int(7);
			mat.stencilWrite = true; mat.stencilRef = ref; mat.stencilFunc = T.AlwaysStencilFunc; mat.stencilZPass = T.ReplaceStencilOp; mat.stencilFail = T.KeepStencilOp; mat.stencilZFail = rng.pick([T.KeepStencilOp, T.ReplaceStencilOp]);
			mat.stencilFuncMask = 0xff; mat.stencilWriteMask = 0xff;
			if (rng.chance(0.4)) mat.colorWrite = false;
			mat.userData.stencilRef = ref;
			sensitive = true;
		}
		mat.userData.kind = kind;
		if (sensitive) orderSensitive.add(mat);
		return mat;
	};
	const nMat = 2 + rng.int(7);
	for (let i = 0; i < nMat; i++) {
		const m = makeMaterial();
		materials.push(m);
		if (m.userData.stencilRef !== undefined) {
			// reader: only draws where the writer left its reference value
			const r = new T.MeshBasicMaterial({ color: randomColor(), side: T.DoubleSide });
			r.stencilWrite = true; r.stencilRef = m.userData.stencilRef; r.stencilFunc = rng.pick([T.EqualStencilFunc, T.NotEqualStencilFunc, T.LessStencilFunc, T.GreaterEqualStencilFunc]);
			r.stencilFail = T.KeepStencilOp; r.stencilZFail = T.KeepStencilOp; r.stencilZPass = rng.pick([T.KeepStencilOp, T.IncrementStencilOp, T.InvertStencilOp]);
			r.stencilWriteMask = rng.pick([0, 0xff]); r.stencilFuncMask = 0xff;
			if (rng.chance(0.5)) r.depthTest = false;
			r.userData.kind = 'stencil-reader';
			materials.push(r); orderSensitive.add(r);
		}
	}
	const kindsUsed = materials.map((m) => m.userData.kind);
	note(`materials: ${kindsUsed.join(', ')}`);
	const randomOpaqueMaterial = () => materials[rng.int(materials.length)];

	// ShaderMaterial custom attributes: add to geometries that end up used by 'raw-attributes'
	const ensureShaderAttributes = (g) => {
		if (g.attributes.aSize) return;
		const n = g.attributes.position.count;
		const s = new Float32Array(n), o = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) { s[i] = rng(); o[i * 3] = rng.range(-0.1, 0.1); o[i * 3 + 1] = rng.range(-0.1, 0.1); o[i * 3 + 2] = rng.range(-0.1, 0.1); }
		g.setAttribute('aSize', new T.BufferAttribute(s, 1)); g.setAttribute('aOffset', new T.BufferAttribute(o, 3));
	};
	for (const g of geometries) ensureShaderAttributes(g); // same attribute set everywhere: no library-dependent layout

	// ---------- objects ----------
	const animated = []; // { object, fn(f) }
	const meshes = [];
	const assignRenderOrder = (mesh, mats) => {
		if (mats.some((m) => orderSensitive.has(m))) mesh.renderOrder = nextRenderOrder++;
	};
	const makeMesh = (shared) => {
		const g = shared ? geometries[rng.int(Math.min(2, geometries.length))] : rng.pick(geometries);
		let material;
		const groupCount = g.userData.groupCount || (g.groups.length > 1 ? g.groups.length : 0);
		if (features.groups && groupCount > 0 && (g.userData.groupCount || rng.chance(0.5))) {
			material = [];
			for (let k = 0; k < groupCount; k++) material.push(randomOpaqueMaterial());
		} else material = shared ? materials[rng.int(Math.min(2, materials.length))] : randomOpaqueMaterial();
		const mesh = new T.Mesh(g, material);
		assignRenderOrder(mesh, Array.isArray(material) ? material : [material]);
		mesh.position.set(rng.range(-4, 4), rng.range(-3, 3), rng.range(-4, 4));
		mesh.rotation.set(rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28));
		const s = rng.range(0.3, 1.4); mesh.scale.set(s, s * rng.range(0.6, 1.4), s);
		if (wantShadows) { mesh.castShadow = rng.chance(0.7); mesh.receiveShadow = rng.chance(0.7); }
		if (rng.chance(0.08)) mesh.frustumCulled = false;
		if (rng.chance(0.05)) mesh.visible = false;
		const spin = rng.range(-0.3, 0.3), bob = rng.range(0, 0.5), axis = rng.int(3);
		if (rng.chance(0.5)) animated.push({ object: mesh, fn: (f) => { mesh.rotation[axis === 0 ? 'x' : axis === 1 ? 'y' : 'z'] += spin; mesh.position.y += Math.sin(f) * bob * 0.3; } });
		else if (rng.chance(0.15)) {
			// manual matrix: matrixAutoUpdate false, matrix composed by hand each frame
			mesh.matrixAutoUpdate = false;
			const p = mesh.position.clone(), q = mesh.quaternion.clone(), sc = mesh.scale.clone();
			const setM = (f) => { q.setFromEuler(new T.Euler(f * spin, f * 0.2, 0)); mesh.matrix.compose(p, q, sc); mesh.matrixWorldNeedsUpdate = true; };
			setM(0);
			animated.push({ object: mesh, fn: setM });
		}
		meshes.push(mesh);
		return mesh;
	};
	const manyShared = rng.chance(0.4); // a run of identical geometry+material (jrs auto-batches these)
	const nMeshes = manyShared ? 12 + rng.int(40) : 3 + rng.int(18);
	const roots = [];
	for (let i = 0; i < nMeshes; i++) {
		const mesh = makeMesh(manyShared && rng.chance(0.8));
		if (features.hierarchy && rng.chance(0.35) && roots.length) {
			// attach under an existing group/mesh (depth grows naturally)
			const parent = rng.pick(roots);
			mesh.position.multiplyScalar(0.4);
			parent.add(mesh);
			if (rng.chance(0.5)) roots.push(mesh);
		} else if (features.hierarchy && rng.chance(0.3)) {
			const grp = new T.Group();
			grp.position.set(rng.range(-2, 2), rng.range(-2, 2), rng.range(-2, 2));
			grp.rotation.set(rng.range(0, 6), rng.range(0, 6), 0);
			grp.scale.setScalar(rng.range(0.6, 1.3));
			const gs = rng.range(-0.25, 0.25);
			if (rng.chance(0.7)) animated.push({ object: grp, fn: (f) => { grp.rotation.y += gs; grp.position.x += Math.cos(f) * 0.1; } });
			grp.add(mesh); scene.add(grp); roots.push(grp);
		} else { scene.add(mesh); if (rng.chance(0.3)) roots.push(mesh); }
	}
	note(`${nMeshes} meshes${manyShared ? ' (mostly shared geometry+material)' : ''}, ${roots.length} hierarchy roots, ${animated.length} animated`);

	// a floor plane sometimes, to receive shadows / show fog
	if (rng.chance(0.5)) {
		const floorKinds = [];
		if (features.lambert) floorKinds.push('lambert'); if (features.standard) floorKinds.push('standard'); if (features.phong) floorKinds.push('phong');
		const fk = floorKinds.length ? rng.pick(floorKinds) : 'basic', fc = randomColor(), fr = rng();
		const floorMat = fk === 'lambert' ? new T.MeshLambertMaterial({ color: fc }) : fk === 'standard' ? new T.MeshStandardMaterial({ color: fc, roughness: fr }) : fk === 'phong' ? new T.MeshPhongMaterial({ color: fc }) : new T.MeshBasicMaterial({ color: fc });
		const floor = new T.Mesh(new T.PlaneGeometry(rng.range(10, 30), rng.range(10, 30)), floorMat);
		floor.rotation.x = -Math.PI / 2; floor.position.y = rng.range(-4.5, -3);
		floor.receiveShadow = true;
		scene.add(floor); meshes.push(floor);
	}

	// ---------- instanced meshes ----------
	if (features.instancing && rng.chance(0.5)) {
		const nInst = 1 + rng.int(2);
		for (let k = 0; k < nInst; k++) {
			const count = 3 + rng.int(40);
			const g = rng.pick(geometries);
			let mat = randomOpaqueMaterial();
			if (mat.userData.kind === 'stencil-reader' || mat.userData.stencilRef !== undefined || (mat.userData.kind === 'shader' && mat.userData.template !== 'chunks-uv-fog')) mat = new T.MeshLambertMaterial({ color: randomColor() });
			const im = new T.InstancedMesh(g, mat, count);
			assignRenderOrder(im, [mat]);
			const m4 = new T.Matrix4(), p = new T.Vector3(), q = new T.Quaternion(), e = new T.Euler(), s = new T.Vector3();
			const seeds = [];
			for (let i = 0; i < count; i++) { seeds.push([rng.range(-4, 4), rng.range(-3, 3), rng.range(-4, 4), rng.range(0, 6), rng.range(0, 6), rng.range(0.2, 0.8), rng.range(-0.3, 0.3)]); }
			const setAll = (f) => {
				for (let i = 0; i < count; i++) {
					const d = seeds[i];
					p.set(d[0], d[1] + Math.sin(f + i) * 0.2, d[2]); e.set(d[3] + f * d[6], d[4], 0); q.setFromEuler(e); s.setScalar(d[5]);
					m4.compose(p, q, s); im.setMatrixAt(i, m4);
				}
				im.instanceMatrix.needsUpdate = true;
			};
			setAll(0);
			if (rng.chance(0.5)) { for (let i = 0; i < count; i++) im.setColorAt(i, randomColor()); im.instanceColor.needsUpdate = true; }
			if (wantShadows) { im.castShadow = rng.chance(0.7); im.receiveShadow = rng.chance(0.7); }
			if (rng.chance(0.6)) animated.push({ object: im, fn: setAll });
			if (rng.chance(0.3)) im.frustumCulled = false;
			if (rng.chance(0.3)) { const grp = new T.Group(); grp.rotation.y = rng.range(0, 6); grp.add(im); scene.add(grp); } else scene.add(im);
			meshes.push(im);
			note(`InstancedMesh x${count}${im.instanceColor ? ' with colours' : ''}`);
		}
	}

	// ---------- points / lines (off by default) ----------
	if (features.points && rng.chance(0.5)) {
		const g = rng.pick(geometries);
		const pm = new T.PointsMaterial({ color: randomColor(), size: rng.range(2, 8), sizeAttenuation: rng.chance(0.5), vertexColors: !!g.attributes.color });
		const pts = new T.Points(g, pm); pts.position.set(rng.range(-3, 3), rng.range(-2, 2), rng.range(-3, 3)); scene.add(pts); note('Points');
	}
	if (features.lines && rng.chance(0.5)) {
		const g = rng.pick(geometries);
		const lm = new T.LineBasicMaterial({ color: randomColor(), vertexColors: !!g.attributes.color });
		const ln = rng.chance(0.5) ? new T.LineSegments(g, lm) : new T.Line(g, lm); ln.position.set(rng.range(-3, 3), rng.range(-2, 2), rng.range(-3, 3)); scene.add(ln); note('Lines');
	}

	// ---------- renderer-level settings ----------
	const toneMappings = [T.NoToneMapping, T.NoToneMapping, T.LinearToneMapping, T.ReinhardToneMapping, T.CineonToneMapping, T.ACESFilmicToneMapping, T.NeutralToneMapping];
	if (features.agx) toneMappings.push(T.AgXToneMapping);
	const toneMapping = features.toneMapping ? rng.pick(toneMappings) : T.NoToneMapping;
	const exposure = features.toneMapping ? rng.pick([1, 1, rng.range(0.4, 2.5)]) : 1;
	if (toneMapping !== T.NoToneMapping) note(`toneMapping ${toneMapping} exposure ${exposure.toFixed(2)}`);
	const shadowType = T.PCFShadowMap;

	// override material on some frames
	let overrideMaterials = null, overrideFrames = null;
	if (features.overrideMaterial && rng.chance(0.25)) {
		overrideMaterials = [new T.MeshNormalMaterial(), new T.MeshBasicMaterial({ color: randomColor() }), new T.MeshDepthMaterial(), new T.MeshLambertMaterial({ color: randomColor() })];
		overrideFrames = [];
		for (let f = 0; f < frames; f++) overrideFrames.push(rng.chance(0.4) ? rng.int(overrideMaterials.length) : -1);
		note('overrideMaterial frames: ' + overrideFrames.map((o) => o < 0 ? '-' : ['normal', 'basic', 'depth', 'lambert'][o]).join(' '));
	}

	// ---------- per-frame driver ----------
	const setup = (renderer) => {
		renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure;
		renderer.shadowMap.enabled = wantShadows && shadowLights.length > 0; renderer.shadowMap.type = shadowType;
		if (useClearColor) renderer.setClearColor(clearColor, 1);
	};
	const frame = (renderer, f) => {
		for (const a of animated) a.fn(f);
		for (const u of shaderUniformsShared) u.uTime.value = f * 0.3;
		placeCamera(f);
		if (camFovAnim) { camera.fov = 40 + 20 * Math.sin(f * 0.5); camera.updateProjectionMatrix(); }
		if (camZoomAnim) { camera.zoom = 1 + 0.3 * Math.sin(f * 0.4); camera.updateProjectionMatrix(); }
		if (renderTarget) {
			rtAnim(f);
			renderer.setRenderTarget(renderTarget);
			renderer.render(rtScene, rtCamera);
			renderer.setRenderTarget(null);
		}
		scene.overrideMaterial = overrideFrames && overrideFrames[f] >= 0 ? overrideMaterials[overrideFrames[f]] : null;
		renderer.render(scene, camera);
	};
	const dispose = (renderer) => {
		for (const t of textures) t.dispose();
		for (const g of geometries) g.dispose();
		for (const m of materials) m.dispose();
		if (renderTarget) renderTarget.dispose();
	};
	return { scene, camera, setup, frame, dispose, notes, frames, needsStencil: true };
}
