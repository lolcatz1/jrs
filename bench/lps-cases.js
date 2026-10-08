// Small feature cases for Lines / Points / Sprites. Each is rendered with three.js and with jrs and the
// two images are compared (node bench/lps.mjs). A case returns { scene, camera, update?(frame), pixelRatio? }.

function rng(seed) {
	let s = seed >>> 0;
	return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
function disc(T, srgb = true) {
	const size = 32, d = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1, r = Math.sqrt(dx * dx + dy * dy), i = (y * size + x) * 4;
		d[i] = 255 - x * 6; d[i + 1] = 60 + y * 6; d[i + 2] = x < 16 ? 255 : 80; d[i + 3] = r < 1 ? Math.round(255 * Math.min(1, (1 - r) * 3)) : 0;
	}
	const t = new T.DataTexture(d, size, size, T.RGBAFormat, T.UnsignedByteType);
	t.minFilter = t.magFilter = T.LinearFilter; t.generateMipmaps = false; if (srgb) t.colorSpace = T.SRGBColorSpace; t.needsUpdate = true;
	return t;
}
function ring(T) {
	const size = 32, d = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1, r = Math.sqrt(dx * dx + dy * dy), i = (y * size + x) * 4;
		d[i] = 0; d[i + 1] = r > 0.35 && r < 0.95 ? 60 + y * 6 : 40; d[i + 2] = 0; d[i + 3] = 255;
	}
	const t = new T.DataTexture(d, size, size, T.RGBAFormat, T.UnsignedByteType);
	t.minFilter = t.magFilter = T.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
	return t;
}
function setup(T, { ortho = false, fog = false, bg = 0x101820 } = {}) {
	const scene = new T.Scene();
	scene.background = new T.Color(bg);
	if (fog) scene.fog = fog === 'exp2' ? new T.FogExp2(0x405060, 0.03) : new T.Fog(0x405060, 10, 40);
	const camera = ortho ? new T.OrthographicCamera(-12, 12, 9, -9, 0.1, 100) : new T.PerspectiveCamera(60, 4 / 3, 0.1, 100);
	camera.position.set(1, 2, 14); camera.lookAt(0, 0, 0);
	return { scene, camera };
}
function scatter(T, n, seed, spread = [20, 14, 20], mk) {
	const rand = rng(seed), out = [];
	for (let i = 0; i < n; i++) out.push(mk(i, rand, [(rand() - 0.5) * spread[0], (rand() - 0.5) * spread[1], (rand() - 0.5) * spread[2]]));
	return out;
}
function pointsGeo(T, n, seed, { color = false, uv = false, spread = 18 } = {}) {
	const rand = rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
	for (let i = 0; i < n; i++) {
		pos[i * 3] = (rand() - 0.5) * spread; pos[i * 3 + 1] = (rand() - 0.5) * spread * 0.7; pos[i * 3 + 2] = (rand() - 0.5) * spread * 1.3;
		col[i * 3] = rand(); col[i * 3 + 1] = rand(); col[i * 3 + 2] = rand(); uvs[i * 2] = rand(); uvs[i * 2 + 1] = rand();
	}
	const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
	if (color) g.setAttribute('color', new T.BufferAttribute(col, 3));
	if (uv) g.setAttribute('uv', new T.BufferAttribute(uvs, 2));
	return g;
}
function lineGeo(T, n, seed, { color = false } = {}) {
	const rand = rng(seed), pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
	let x = -6, y = 0, z = 0;
	for (let i = 0; i < n; i++) { x += rand() * 1.5; y += (rand() - 0.5) * 3; z += (rand() - 0.5) * 3; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; col[i * 3] = rand(); col[i * 3 + 1] = rand(); col[i * 3 + 2] = rand(); }
	const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
	if (color) g.setAttribute('color', new T.BufferAttribute(col, 3));
	return g;
}
function addLines(T, scene, material, { dashed = false, color = false, n = 12 } = {}) {
	const kinds = [T.Line, T.LineSegments, T.LineLoop];
	for (let i = 0; i < 9; i++) {
		const o = new kinds[i % 3](lineGeo(T, i % 3 === 1 ? 8 : n, 100 + i, { color }), material);
		if (dashed) o.computeLineDistances();
		o.position.set(-3 + (i % 3) * 3, 5 - Math.floor(i / 3) * 4, 0);
		o.rotation.set(i * 0.4, i * 0.3, i * 0.2); o.scale.setScalar(0.6 + 0.2 * (i % 4));
		scene.add(o);
	}
}

export const cases = {
	'mesh-fog': (T) => { const s = setup(T, { fog: true }); const g = new T.BoxGeometry(2, 2, 2), m = new T.MeshBasicMaterial({ color: 0xffffff }); scatter(T, 30, 5, [20, 14, 40], (i, r, p) => { const o = new T.Mesh(g, m); o.position.set(...p); s.scene.add(o); }); return s; },
	'line-basic': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0xffaa33 })); return s; },
	'line-linewidth-ignored': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0x66ccff, linewidth: 5 })); return s; },
	'line-vertexcolors': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineBasicMaterial({ vertexColors: true }), { color: true }); return s; },
	'line-fog': (T) => { const s = setup(T, { fog: true }); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0xffffff })); return s; },
	'line-nofog': (T) => { const s = setup(T, { fog: true }); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0xffffff, fog: false })); return s; },
	'line-transparent': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0xff55aa, transparent: true, opacity: 0.4 })); return s; },
	'line-dashed': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineDashedMaterial({ color: 0xffaa33, dashSize: 0.7, gapSize: 0.4 }), { dashed: true }); return s; },
	'line-dashed-scale': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineDashedMaterial({ color: 0x66ff99, dashSize: 0.5, gapSize: 0.5, scale: 2.5 }), { dashed: true }); return s; },
	'line-dashed-colors-fog': (T) => { const s = setup(T, { fog: true }); addLines(T, s.scene, new T.LineDashedMaterial({ vertexColors: true, dashSize: 0.3, gapSize: 0.2, scale: 0.7 }), { dashed: true, color: true }); return s; },
	'line-dashed-nodistance': (T) => { const s = setup(T); addLines(T, s.scene, new T.LineDashedMaterial({ color: 0xffffff, dashSize: 1, gapSize: 1 }), { dashed: false }); return s; },
	'line-ortho': (T) => { const s = setup(T, { ortho: true }); addLines(T, s.scene, new T.LineBasicMaterial({ color: 0xeeeeee })); return s; },
	'line-mixed-materials': (T) => {
		const s = setup(T, { fog: 'exp2' });
		const mats = [new T.LineBasicMaterial({ color: 0xff5544 }), new T.LineDashedMaterial({ color: 0x44ff88, dashSize: 0.4, gapSize: 0.3 }), new T.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 })];
		for (let i = 0; i < 40; i++) {
			const o = new (i % 2 ? T.LineSegments : T.Line)(lineGeo(T, i % 2 ? 6 : 10, 200 + i), mats[i % 3]);
			if (i % 3 === 1) o.computeLineDistances();
			o.position.set((i % 8 - 3.5) * 2.2, (Math.floor(i / 8) - 2) * 3, (i % 5) * -1.5); o.rotation.set(i, i * 0.5, 0); s.scene.add(o);
		}
		return s;
	},

	'points-basic': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 400, 1), new T.PointsMaterial({ color: 0xffcc66, size: 0.4 }))); return s; },
	'points-nosizeatten': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 400, 2), new T.PointsMaterial({ color: 0x88ddff, size: 5, sizeAttenuation: false }))); return s; },
	'points-ortho': (T) => { const s = setup(T, { ortho: true }); s.scene.add(new T.Points(pointsGeo(T, 400, 2), new T.PointsMaterial({ color: 0x88ddff, size: 6 }))); return s; },
	'points-ortho-noatten': (T) => { const s = setup(T, { ortho: true }); s.scene.add(new T.Points(pointsGeo(T, 400, 2), new T.PointsMaterial({ color: 0x88ddff, size: 6, sizeAttenuation: false }))); return s; },
	'points-pixelratio2': (T) => { const s = setup(T); s.pixelRatio = 2; s.scene.add(new T.Points(pointsGeo(T, 300, 3), new T.PointsMaterial({ color: 0xffffff, size: 0.5 }))); return s; },
	'points-map': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 200, 4), new T.PointsMaterial({ size: 1.2, map: disc(T), transparent: true, depthWrite: false }))); return s; },
	'points-map-alphatest': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 200, 5), new T.PointsMaterial({ size: 1.6, map: disc(T), alphaTest: 0.5 }))); return s; },
	'points-alphamap': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 200, 6), new T.PointsMaterial({ color: 0xffee99, size: 1.6, alphaMap: ring(T), transparent: true, depthWrite: false }))); return s; },
	'points-map-alphamap': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 200, 7), new T.PointsMaterial({ size: 1.6, map: disc(T), alphaMap: ring(T), alphaTest: 0.2 }))); return s; },
	'points-vertexcolors-map': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 300, 8, { color: true }), new T.PointsMaterial({ size: 1.4, map: disc(T), vertexColors: true, alphaTest: 0.1 }))); return s; },
	'points-uv-attribute': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 200, 9, { uv: true }), new T.PointsMaterial({ size: 1.8, map: disc(T), alphaTest: 0.1 }))); return s; },
	'points-map-transform': (T) => { const s = setup(T); const m = disc(T); m.repeat.set(2, 2); m.offset.set(0.25, 0.1); m.wrapS = m.wrapT = T.RepeatWrapping; s.scene.add(new T.Points(pointsGeo(T, 200, 10), new T.PointsMaterial({ size: 1.8, map: m, alphaTest: 0.1 }))); return s; },
	'points-fog': (T) => { const s = setup(T, { fog: true }); s.scene.add(new T.Points(pointsGeo(T, 600, 11, { color: true }), new T.PointsMaterial({ size: 0.5, vertexColors: true }))); return s; },
	'points-opacity-transparent': (T) => { const s = setup(T); s.scene.add(new T.Points(pointsGeo(T, 300, 12), new T.PointsMaterial({ color: 0xff77aa, size: 1.2, transparent: true, opacity: 0.4, depthWrite: false }))); return s; },
	'points-indexed-drawrange': (T) => {
		const s = setup(T); const g = pointsGeo(T, 300, 13); const idx = []; for (let i = 299; i >= 0; i -= 2) idx.push(i); g.setIndex(idx); g.setDrawRange(10, 100);
		s.scene.add(new T.Points(g, new T.PointsMaterial({ color: 0x99ff99, size: 0.6 }))); return s;
	},
	'points-many-objects': (T) => {
		const s = setup(T, { fog: true }); const mats = [new T.PointsMaterial({ color: 0xff8844, size: 0.5 }), new T.PointsMaterial({ color: 0x44aaff, size: 4, sizeAttenuation: false }), new T.PointsMaterial({ map: disc(T), size: 1, alphaTest: 0.3 })];
		const g = [pointsGeo(T, 12, 20, { spread: 3 }), pointsGeo(T, 20, 21, { spread: 3 }), pointsGeo(T, 7, 22, { spread: 3 })];
		scatter(T, 60, 23, [20, 14, 16], (i, r, p) => { const o = new T.Points(g[i % 3], mats[i % 3]); o.position.set(...p); o.rotation.set(i, i * 0.7, 0); o.scale.setScalar(0.6 + r()); s.scene.add(o); });
		return s;
	},

	'sprite-basic': (T) => { const s = setup(T); scatter(T, 40, 30, undefined, (i, r, p) => { const o = new T.Sprite(new T.SpriteMaterial({ color: 0xffaa55 })); o.position.set(...p); o.scale.setScalar(1 + r()); s.scene.add(o); }); return s; },
	'sprite-map': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ map: disc(T) }); scatter(T, 60, 31, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(1 + r() * 1.5); s.scene.add(o); }); return s; },
	'sprite-rotation': (T) => { const s = setup(T); scatter(T, 30, 32, undefined, (i, r, p) => { const o = new T.Sprite(new T.SpriteMaterial({ map: disc(T), rotation: i * 0.5 - 4 })); o.position.set(...p); o.scale.set(2.5, 1.2, 1); s.scene.add(o); }); return s; },
	'sprite-center': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ map: disc(T), rotation: 0.7 }); scatter(T, 30, 33, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.center.set((i % 4) / 3, (i % 3) / 2); o.scale.set(2, 1.3, 1); s.scene.add(o); }); return s; },
	'sprite-noatten': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ map: disc(T), sizeAttenuation: false, rotation: 0.3 }); scatter(T, 40, 34, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(0.05 + r() * 0.05); s.scene.add(o); }); return s; },
	'sprite-ortho': (T) => { const s = setup(T, { ortho: true }); const m = new T.SpriteMaterial({ map: disc(T), rotation: 0.3 }), m2 = new T.SpriteMaterial({ map: disc(T), sizeAttenuation: false, rotation: 0.3, color: 0x99ff99 }); scatter(T, 40, 35, undefined, (i, r, p) => { const o = new T.Sprite(i % 2 ? m : m2); o.position.set(...p); o.scale.setScalar(i % 2 ? 1 + r() : 0.1 + r() * 0.1); s.scene.add(o); }); return s; },
	'sprite-transparent-depth': (T) => { const s = setup(T); scatter(T, 80, 36, [8, 6, 20], (i, r, p) => { const o = new T.Sprite(new T.SpriteMaterial({ color: new T.Color().setHSL(r(), 0.8, 0.5), opacity: 0.6 })); o.position.set(...p); o.scale.setScalar(2.5); s.scene.add(o); }); return s; },
	'sprite-depthwrite-off': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ map: disc(T), depthWrite: false }); scatter(T, 60, 37, [8, 6, 20], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2.2); s.scene.add(o); }); return s; },
	'sprite-fog': (T) => { const s = setup(T, { fog: true }); const m = new T.SpriteMaterial({ map: disc(T) }); scatter(T, 60, 38, [20, 14, 40], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2); s.scene.add(o); }); return s; },
	'sprite-nofog': (T) => { const s = setup(T, { fog: true }); const m = new T.SpriteMaterial({ map: disc(T), fog: false }); scatter(T, 60, 39, [20, 14, 40], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2); s.scene.add(o); }); return s; },
	'sprite-fog-exp2': (T) => { const s = setup(T, { fog: 'exp2' }); const m = new T.SpriteMaterial({ map: disc(T), rotation: 0.4 }); scatter(T, 60, 40, [20, 14, 40], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2); s.scene.add(o); }); return s; },
	'sprite-alphatest': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ map: disc(T), alphaTest: 0.5, transparent: false }); scatter(T, 50, 41, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2.5); s.scene.add(o); }); return s; },
	'sprite-alphamap': (T) => { const s = setup(T); const m = new T.SpriteMaterial({ color: 0xffee88, alphaMap: ring(T), rotation: 0.5 }); scatter(T, 40, 42, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2.5); s.scene.add(o); }); return s; },
	'sprite-map-transform': (T) => { const s = setup(T); const t = disc(T); t.repeat.set(1.5, 1.5); t.offset.set(0.2, 0.3); t.rotation = 0.4; t.wrapS = t.wrapT = T.RepeatWrapping; const m = new T.SpriteMaterial({ map: t }); scatter(T, 30, 43, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2.5); s.scene.add(o); }); return s; },
	'sprite-parent-scale': (T) => {
		const s = setup(T); const g = new T.Group(); g.scale.set(2, 0.7, 1.5); g.rotation.set(0.5, 0.3, 0.2); g.position.set(1, 0, 0); s.scene.add(g);
		const m = new T.SpriteMaterial({ map: disc(T), rotation: 0.2 });
		scatter(T, 20, 44, [6, 6, 6], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.set(1, 1, 1); g.add(o); }); return s;
	},
	'sprite-pixelratio2': (T) => { const s = setup(T); s.pixelRatio = 2; const m = new T.SpriteMaterial({ map: disc(T), sizeAttenuation: false }); scatter(T, 20, 45, undefined, (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(0.1); s.scene.add(o); }); return s; },
	'sprite-with-meshes': (T) => {
		const s = setup(T); s.scene.add(new T.AmbientLight(0xffffff, 1), new T.DirectionalLight(0xffffff, 2));
		const box = new T.BoxGeometry(2, 2, 2), bm = new T.MeshLambertMaterial({ color: 0x8899ff });
		scatter(T, 12, 46, [14, 8, 14], (i, r, p) => { const o = new T.Mesh(box, bm); o.position.set(...p); s.scene.add(o); });
		const m = new T.SpriteMaterial({ map: disc(T) }); scatter(T, 40, 47, [14, 8, 14], (i, r, p) => { const o = new T.Sprite(m); o.position.set(...p); o.scale.setScalar(2); s.scene.add(o); }); return s;
	},
	'sprite-renderorder': (T) => {
		const s = setup(T); const a = new T.SpriteMaterial({ color: 0xff3333 }), b = new T.SpriteMaterial({ color: 0x3333ff });
		for (let i = 0; i < 6; i++) { const o = new T.Sprite(i % 2 ? a : b); o.position.set(i * 0.8 - 2, 0, -i); o.scale.setScalar(3); o.renderOrder = (i * 7) % 4; s.scene.add(o); } return s;
	},
};
