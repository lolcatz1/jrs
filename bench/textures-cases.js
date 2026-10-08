// Texture compatibility cases: every case runs `run(T, side, ctx)` once with jrs and once with three.js r186 on identical
// scenes and compares what came out (pixels, GL errors, warnings, optional probe data and GL call logs).
// A case returns { pixels, centre, info?, data? }; `pixels` are compared exactly unless `tolerance` is given.
//
// Case options: group, name, run, skip (reason string -> SKIP), gap (reason string: a known, documented gap -> reported as
// SKIP when the images differ, PASS when they match), tolerance, expectDiffer, compareWarnings, compareData, checkCalls, showCalls, verify.

import { moreCases } from './textures-cases2.js';

export const SIZE = 64;

// ------------------------------------------------------------------------------------------------ infrastructure

const LOGGED = [
	'texImage2D', 'texSubImage2D', 'texStorage2D', 'texImage3D', 'texSubImage3D', 'texStorage3D',
	'compressedTexImage2D', 'compressedTexSubImage2D', 'compressedTexImage3D', 'compressedTexSubImage3D',
	'copyTexImage2D', 'copyTexSubImage2D', 'copyTexSubImage3D', 'generateMipmap', 'createTexture', 'deleteTexture', 'blitFramebuffer',
];
const summ = (v) => {
	if (v === null || v === undefined) return null;
	if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
	if (ArrayBuffer.isView(v)) return 'view:' + v.constructor.name + ':' + v.byteLength;
	if (typeof WebGLTexture !== 'undefined' && v instanceof WebGLTexture) return 'tex';
	if (v.tagName) return v.tagName.toLowerCase();
	if (typeof ImageBitmap !== 'undefined' && v instanceof ImageBitmap) return 'bitmap';
	return typeof v;
};
export function installGLLogger(gl) {
	const log = [];
	for (const name of LOGGED) {
		const orig = gl[name];
		if (typeof orig !== 'function') continue;
		gl[name] = function (...a) { log.push([name, ...a.map(summ)]); return orig.apply(this, a); };
	}
	return log;
}
export function readAll(renderer) {
	const gl = renderer.getContext();
	const px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
	return px;
}
export function diffImages(a, b) {
	let maxd = 0, bad = 0, sum = 0;
	for (let i = 0; i < a.length; i += 4) {
		const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
		sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
		if (d > maxd) maxd = d; if (d > 16) bad++;
	}
	return { maxDiff: maxd, badFraction: bad / (a.length / 4), meanAbsDiff: sum / (a.length * 3 / 4) };
}
function capture(side, info) {
	const px = readAll(side.renderer);
	const o = (Math.floor(SIZE / 2) * SIZE + Math.floor(SIZE / 2)) * 4;
	return { pixels: px, centre: [px[o], px[o + 1], px[o + 2], px[o + 3]], info };
}
/** Renders and captures. */
export function shot(side, scene, camera, info) { side.renderer.render(scene, camera); return capture(side, info); }

/** Full-screen quad scene: a 2x2 plane under an orthographic camera, over a mid-blue background. */
function quadScene(T, material, background = 0x336699) {
	const scene = new T.Scene();
	if (background !== null) scene.background = new T.Color(background);
	const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
	camera.position.z = 2;
	const mesh = new T.Mesh(new T.PlaneGeometry(2, 2), material);
	scene.add(mesh);
	return { scene, camera, mesh };
}
function basic(T, map, extra = {}) { return new T.MeshBasicMaterial({ map, ...extra }); }

// deterministic image data -------------------------------------------------------------------------------------------
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); n = n ^ (n >>> 15); return (n >>> 0) / 4294967295; }
/** RGBA8 pattern: red = x ramp, green = y ramp, blue = checker, alpha as given. */
function rgbaPattern(w, h, alpha = 255) {
	const d = new Uint8Array(w * h * 4);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const i = (y * w + x) * 4;
		d[i] = Math.round(255 * x / Math.max(1, w - 1)); d[i + 1] = Math.round(255 * y / Math.max(1, h - 1));
		d[i + 2] = ((x >> Math.max(0, Math.log2(w) - 3)) + (y >> Math.max(0, Math.log2(h) - 3))) & 1 ? 255 : 40;
		d[i + 3] = alpha;
	}
	return d;
}
/** A noisy but smooth-ish pattern (sharp checker + gradient) so minification/mipmaps visibly differ. */
function busyPattern(w, h) {
	const d = new Uint8Array(w * h * 4);
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
		const i = (y * w + x) * 4, c = ((x ^ y) & 1) ? 255 : 0, g = (x * 255 / w) | 0;
		d[i] = c; d[i + 1] = g; d[i + 2] = (hash(x * 977 + y * 131) * 255) | 0; d[i + 3] = 255;
	}
	return d;
}
function toHalf(v) {
	const f = new Float32Array(1), u = new Uint32Array(f.buffer);
	f[0] = v; const x = u[0];
	const sign = (x >> 16) & 0x8000; let e = ((x >> 23) & 0xff) - 127 + 15, m = (x >> 13) & 0x3ff;
	if (e <= 0) return sign;
	if (e >= 31) return sign | 0x7c00;
	return sign | (e << 10) | m;
}
/** Typed data for `n` texels of `comps` channels in the array type matching a three.js texture `type`. */
function typedData(T, type, n, comps, fn) {
	let a;
	if (type === T.FloatType) a = new Float32Array(n * comps);
	else if (type === T.HalfFloatType || type === T.UnsignedShortType) a = new Uint16Array(n * comps);
	else if (type === T.UnsignedIntType) a = new Uint32Array(n * comps);
	else a = new Uint8Array(n * comps);
	for (let t = 0; t < n; t++) for (let c = 0; c < comps; c++) {
		const v = fn(t, c); // 0..1
		let s;
		if (type === T.FloatType) s = v;
		else if (type === T.HalfFloatType) s = toHalf(v);
		else if (type === T.UnsignedShortType) s = Math.round(v * 65535);
		else if (type === T.UnsignedIntType) s = Math.round(v * 4294967295);
		else s = Math.round(v * 255);
		a[t * comps + c] = s;
	}
	return a;
}
function canvasPattern(w, h, alpha = 1) {
	const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
	const c = cv.getContext('2d');
	c.clearRect(0, 0, w, h);
	c.globalAlpha = alpha;
	c.fillStyle = '#ff3010'; c.fillRect(0, 0, w / 2, h / 2);
	c.fillStyle = '#10c030'; c.fillRect(w / 2, 0, w / 2, h / 2);
	c.fillStyle = '#2040ff'; c.fillRect(0, h / 2, w / 2, h / 2);
	c.fillStyle = '#f0f020'; c.fillRect(w * 0.55, h * 0.55, w * 0.3, h * 0.3);
	c.fillStyle = '#ffffff'; c.fillRect(2, 2, 6, 3); // asymmetric marker: shows flipY and orientation
	return cv;
}

const cases = [];
function C(group, name, run, opts = {}) { cases.push({ group, name, run, ...opts }); }

// ------------------------------------------------------------------------------------------------ cases
export function textureCases(env) {
	cases.length = 0;
	const has = (e) => env.exts.has(e);
	const nameOf = (T, table, v) => Object.keys(table).find((k) => table[k] === v) || String(v);

	// ---------------------------------------------------------------------------------------- wrap modes
	const wraps = (T) => [['repeat', T.RepeatWrapping], ['clamp', T.ClampToEdgeWrapping], ['mirror', T.MirroredRepeatWrapping]];
	for (let si = 0; si < 3; si++) for (let ti = 0; ti < 3; ti++) {
		const sn = ['repeat', 'clamp', 'mirror'][si], tn = ['repeat', 'clamp', 'mirror'][ti];
		C('wrap', `wrapS=${sn} wrapT=${tn} (DataTexture, nearest, uv outside 0..1)`, (T, side) => {
			const w = wraps(T);
			const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType);
			tex.wrapS = w[si][1]; tex.wrapT = w[ti][1]; tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter;
			tex.repeat.set(2.6, 2.6); tex.offset.set(-0.35, 0.3); tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
	}
	C('wrap', 'wrap modes with linear filtering and mipmaps (canvas, mirror/repeat)', (T, side) => {
		const tex = new T.CanvasTexture(canvasPattern(32, 32));
		tex.wrapS = T.MirroredRepeatWrapping; tex.wrapT = T.RepeatWrapping; tex.repeat.set(3.3, 2.2); tex.offset.set(0.2, 0.1);
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});

	// ---------------------------------------------------------------------------------------- filters
	const filterNames = ['Nearest', 'NearestMipmapNearest', 'NearestMipmapLinear', 'Linear', 'LinearMipmapNearest', 'LinearMipmapLinear'];
	for (const gen of [true, false]) for (const mag of ['Nearest', 'Linear']) for (const min of filterNames) {
		C('filter', `magFilter=${mag} minFilter=${min} generateMipmaps=${gen} (magnified and minified)`, (T, side) => {
			const mk = (zoom) => {
				const tex = new T.DataTexture(busyPattern(64, 64), 64, 64, T.RGBAFormat, T.UnsignedByteType);
				tex.magFilter = T[mag + 'Filter']; tex.minFilter = T[min + 'Filter']; tex.generateMipmaps = gen;
				tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(zoom, zoom); tex.needsUpdate = true;
				return tex;
			};
			const scene = new T.Scene(); scene.background = new T.Color(0x336699);
			const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camera.position.z = 2;
			const a = new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, mk(1 / 6))); a.position.x = -0.5; // 64 texels over ~32px*(1/6): magnified
			const b = new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, mk(3.5))); b.position.x = 0.5; // minified ~2x
			scene.add(a, b);
			return shot(side, scene, camera);
		});
	}
	C('filter', 'generateMipmaps=true with LinearFilter min (three allocates a full chain; no visual change)', (T, side) => {
		const tex = new T.DataTexture(busyPattern(32, 32), 32, 32, T.RGBAFormat, T.UnsignedByteType);
		tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	}, { showCalls: true });
	C('filter', 'minFilter mip mode on a non-power-of-two image (canvas 37x23)', (T, side) => {
		const tex = new T.CanvasTexture(canvasPattern(37, 23));
		tex.minFilter = T.LinearMipmapLinearFilter; tex.repeat.set(0.9, 0.9);
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});

	// ---------------------------------------------------------------------------------------- anisotropy
	for (const an of [1, 2, 8, 16]) {
		for (const mip of ['LinearMipmapLinear', 'LinearMipmapNearest', 'Linear']) {
			C('anisotropy', `anisotropy=${an} minFilter=${mip} at a grazing angle`, (T, side) => {
				const tex = new T.DataTexture(busyPattern(128, 128), 128, 128, T.RGBAFormat, T.UnsignedByteType);
				tex.minFilter = T[mip + 'Filter']; tex.magFilter = T.LinearFilter; tex.generateMipmaps = true;
				tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(10, 10); tex.anisotropy = an; tex.needsUpdate = true;
				const scene = new T.Scene(); scene.background = new T.Color(0x336699);
				const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0.5, 2); camera.lookAt(0, 0, -1);
				const m = new T.Mesh(new T.PlaneGeometry(8, 30), basic(T, tex)); m.rotation.x = -Math.PI / 2;
				scene.add(m);
				return shot(side, scene, camera, 'maxAnisotropy=' + side.renderer.capabilities.getMaxAnisotropy());
			}, { skip: has('EXT_texture_filter_anisotropic') ? undefined : 'EXT_texture_filter_anisotropic not exposed' });
		}
	}
	C('anisotropy', 'anisotropy set after first render (texParameter re-applied through needsUpdate)', (T, side) => {
		const tex = new T.DataTexture(busyPattern(128, 128), 128, 128, T.RGBAFormat, T.UnsignedByteType);
		tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.generateMipmaps = true;
		tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.repeat.set(10, 10); tex.needsUpdate = true;
		const scene = new T.Scene(); scene.background = new T.Color(0x336699);
		const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.set(0, 0.5, 2); camera.lookAt(0, 0, -1);
		const m = new T.Mesh(new T.PlaneGeometry(8, 30), basic(T, tex)); m.rotation.x = -Math.PI / 2;
		scene.add(m);
		side.renderer.render(scene, camera);
		tex.anisotropy = 16; tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { skip: has('EXT_texture_filter_anisotropic') ? undefined : 'EXT_texture_filter_anisotropic not exposed' });

	// ---------------------------------------------------------------------------------------- flipY / premultiplyAlpha / unpackAlignment
	for (const flip of [true, false]) for (const pre of [false, true]) {
		C('upload-state', `CanvasTexture flipY=${flip} premultiplyAlpha=${pre} (half-transparent canvas)`, (T, side) => {
			const tex = new T.CanvasTexture(canvasPattern(32, 32, 0.5));
			tex.flipY = flip; tex.premultiplyAlpha = pre; tex.minFilter = T.NearestFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex, { transparent: true }));
			return shot(side, scene, camera);
		});
		C('upload-state', `DataTexture flipY=${flip} premultiplyAlpha=${pre}`, (T, side) => {
			const tex = new T.DataTexture(rgbaPattern(4, 4, 128), 4, 4, T.RGBAFormat, T.UnsignedByteType);
			tex.flipY = flip; tex.premultiplyAlpha = pre; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex, { transparent: true }));
			return shot(side, scene, camera);
		});
	}
	for (const al of [1, 2, 4, 8]) {
		for (const comps of [1, 3]) {
			C('upload-state', `unpackAlignment=${al} ${comps === 1 ? 'Red' : 'RGB'}/UnsignedByte, width 5 (row-padded data)`, (T, side) => {
				const w = 5, h = 4, rowBytes = Math.ceil(w * comps / al) * al;
				const data = new Uint8Array(rowBytes * h);
				for (let y = 0; y < h; y++) for (let x = 0; x < w * comps; x++) data[y * rowBytes + x] = 20 + ((y * 53 + x * 37) % 230);
				const tex = new T.DataTexture(data, w, h, comps === 1 ? T.RedFormat : T.RGBFormat, T.UnsignedByteType);
				tex.unpackAlignment = al; tex.needsUpdate = true;
				const { scene, camera } = quadScene(T, basic(T, tex));
				return shot(side, scene, camera);
			});
		}
	}

	// ---------------------------------------------------------------------------------------- colour spaces
	for (const cs of ['srgb', 'srgb-linear', '']) {
		const label = cs === '' ? 'NoColorSpace' : cs;
		C('colorspace', `map colorSpace=${label} (RGBA8 DataTexture, MeshBasicMaterial)`, (T, side) => {
			const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType);
			tex.colorSpace = cs; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
		C('colorspace', `map colorSpace=${label} (RGB8 DataTexture)`, (T, side) => {
			const d = new Uint8Array(4 * 4 * 3); for (let i = 0; i < d.length; i++) d[i] = (i * 29) & 255;
			const tex = new T.DataTexture(d, 4, 4, T.RGBFormat, T.UnsignedByteType);
			tex.colorSpace = cs; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
		C('colorspace', `map colorSpace=${label} (CanvasTexture)`, (T, side) => {
			const tex = new T.CanvasTexture(canvasPattern(16, 16));
			tex.colorSpace = cs; tex.minFilter = T.NearestFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
		C('colorspace', `emissiveMap colorSpace=${label} (MeshLambertMaterial, black base colour)`, (T, side) => {
			const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType);
			tex.colorSpace = cs; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, new T.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex }));
			return shot(side, scene, camera);
		});
		C('colorspace', `emissiveMap colorSpace=${label} (MeshStandardMaterial, black base colour)`, (T, side) => {
			const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType);
			tex.colorSpace = cs; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, new T.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: tex }));
			return shot(side, scene, camera);
		});
	}
	for (const type of ['Float', 'HalfFloat']) for (const cs of ['srgb', 'srgb-linear']) {
		C('colorspace', `data texture ${type} RGBA with colorSpace=${cs} (no hardware decode, as in three)`, (T, side) => {
			const t = T[type + 'Type'];
			const tex = new T.DataTexture(typedData(T, t, 16, 4, (i, c) => c === 3 ? 1 : ((i * 7 + c * 3) % 16) / 15), 4, 4, T.RGBAFormat, t);
			tex.colorSpace = cs; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
	}
	C('colorspace', 'envMap (CubeTexture, sRGB) on MeshBasicMaterial', (T, side) => {
		const faces = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]].map((c) => new T.DataTexture(new Uint8Array([c[0], c[1], c[2], 255]), 1, 1, T.RGBAFormat, T.UnsignedByteType));
		const tex = new T.CubeTexture(faces); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
		const scene = new T.Scene(); scene.background = new T.Color(0x336699);
		const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.z = 4;
		scene.add(new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshBasicMaterial({ color: 0xffffff, envMap: tex })));
		return shot(side, scene, camera);
	}, { gap: 'environment maps / image-based lighting are not implemented (ARCHITECTURE.md "intentionally not there"); material.envMap is ignored' });
	C('colorspace', 'envMap on MeshStandardMaterial (CubeTexture)', (T, side) => {
		const faces = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]].map((c) => new T.DataTexture(new Uint8Array([c[0], c[1], c[2], 255]), 1, 1, T.RGBAFormat, T.UnsignedByteType));
		const tex = new T.CubeTexture(faces); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
		const scene = new T.Scene(); scene.background = new T.Color(0x336699);
		const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.z = 4;
		scene.add(new T.Mesh(new T.SphereGeometry(1, 16, 12), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 1, envMap: tex })));
		return shot(side, scene, camera);
	}, { gap: 'environment maps / image-based lighting are not implemented; material.envMap is ignored' });

	// ---------------------------------------------------------------------------------------- format x type
	const fmts = [['RGBA', 4, 'RGBAFormat'], ['RGB', 3, 'RGBFormat'], ['Red', 1, 'RedFormat'], ['RG', 2, 'RGFormat']];
	const types = ['UnsignedByte', 'HalfFloat', 'Float', 'UnsignedShort', 'UnsignedInt'];
	for (const [fname, comps, fconst] of fmts) for (const tname of types) {
		C('format-type', `DataTexture ${fname} x ${tname}`, (T, side) => {
			const type = T[tname + 'Type'];
			const data = typedData(T, type, 16, comps, (i, c) => ((i * 5 + c * 7) % 16) / 15 * 0.9 + 0.05);
			const tex = new T.DataTexture(data, 4, 4, T[fconst], type);
			tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
	}
	for (const [fname, comps, fconst] of fmts) for (const tname of ['UnsignedByte', 'HalfFloat', 'Float']) {
		C('format-type', `DataTexture ${fname} x ${tname} with LinearFilter and mipmaps`, (T, side) => {
			const type = T[tname + 'Type'];
			const data = typedData(T, type, 64, comps, (i, c) => ((i * 5 + c * 7) % 16) / 15 * 0.9 + 0.05);
			const tex = new T.DataTexture(data, 8, 8, T[fconst], type);
			tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
	}
	C('format-type', 'DataTexture RGBA x UnsignedShort4444', (T, side) => {
		const tex = new T.DataTexture(new Uint16Array(16).map((_, i) => ((i * 0x1111) ^ 0x4a5b) & 0xffff), 4, 4, T.RGBAFormat, T.UnsignedShort4444Type);
		tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});
	C('format-type', 'DataTexture RGBA x UnsignedShort5551', (T, side) => {
		const tex = new T.DataTexture(new Uint16Array(16).map((_, i) => ((i * 0x1357) ^ 0x4a5b) & 0xffff), 4, 4, T.RGBAFormat, T.UnsignedShort5551Type);
		tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});
	C('format-type', 'DataTexture AlphaFormat / LuminanceFormat (removed in WebGL2 three: same GL errors)', (T, side) => {
		const tex = new T.DataTexture(new Uint8Array(16).map((_, i) => i * 16), 4, 4, T.AlphaFormat, T.UnsignedByteType);
		tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});

	// ---------------------------------------------------------------------------------------- internalFormat overrides
	const internals = [
		['RGBA8', 'RGBAFormat', 'UnsignedByteType', 4], ['SRGB8_ALPHA8', 'RGBAFormat', 'UnsignedByteType', 4], ['RGBA4', 'RGBAFormat', 'UnsignedByteType', 4],
		['RGB5_A1', 'RGBAFormat', 'UnsignedByteType', 4], ['RGBA16F', 'RGBAFormat', 'FloatType', 4], ['RGBA16F', 'RGBAFormat', 'HalfFloatType', 4],
		['RGBA32F', 'RGBAFormat', 'FloatType', 4], ['R11F_G11F_B10F', 'RGBFormat', 'FloatType', 3], ['RGB9_E5', 'RGBFormat', 'FloatType', 3],
		['RGB8', 'RGBFormat', 'UnsignedByteType', 3], ['SRGB8', 'RGBFormat', 'UnsignedByteType', 3], ['R8', 'RedFormat', 'UnsignedByteType', 1],
		['R16F', 'RedFormat', 'FloatType', 1], ['RG16F', 'RGFormat', 'FloatType', 2], ['RG8', 'RGFormat', 'UnsignedByteType', 2], ['RGB10_A2', 'RGBAFormat', 'UnsignedByteType', 4],
		['NOT_A_FORMAT', 'RGBAFormat', 'UnsignedByteType', 4],
	];
	for (const [iname, f, t, comps] of internals) {
		C('internal-format', `internalFormat=${iname} with ${f.replace('Format', '')} x ${t.replace('Type', '')}`, (T, side) => {
			const type = T[t];
			const tex = new T.DataTexture(typedData(T, type, 16, comps, (i, c) => ((i * 5 + c * 7) % 16) / 15 * 0.9 + 0.05), 4, 4, T[f], type);
			tex.internalFormat = iname; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			return shot(side, scene, camera);
		});
	}

	return cases.concat(moreCases(env, C, has, { rgbaPattern, busyPattern, canvasPattern, quadScene, basic, typedData, toHalf, hash, capture, shot, SIZE, readAll, diffMax: (a, b) => diffImages(a, b).maxDiff }));
}

