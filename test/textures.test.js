import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

import * as JRS from '../src/index.js';
import { WebGLTextures } from '../src/renderers/webgl/WebGLTextures.js';
import { WebGLState } from '../src/renderers/webgl/WebGLState.js';
import { WebGLInfo } from '../src/renderers/webgl/WebGLInfo.js';

// ---------------------------------------------------------------------------------------------- classes and constants

test('texture constants match three.js', () => {
	const names = Object.keys(THREE).filter((k) => /(Format|Compare|Transfer|Type)$/.test(k) && typeof THREE[k] !== 'function' && k in JRS);
	assert.ok(names.length > 60);
	for (const k of names) assert.equal(JRS[k], THREE[k], k);
	for (const k of ['RGBA_S3TC_DXT5_Format', 'RGBA_ASTC_12x12_Format', 'RGBA_BPTC_Format', 'RED_GREEN_RGTC2_Format', 'RGB_ETC2_Format', 'UnsignedInt5999Type', 'RGBIntegerFormat', 'NeverCompare', 'SRGBTransfer']) {
		assert.equal(JRS[k], THREE[k], k);
	}
});

test('CompressedTexture family has the three.js defaults', () => {
	const mip = [{ data: new Uint8Array(16), width: 4, height: 4 }];
	for (const make of [
		(L) => new L.CompressedTexture(mip, 4, 4, L.RGBA_S3TC_DXT5_Format),
		(L) => new L.CompressedArrayTexture(mip, 4, 4, 3, L.RGBA_S3TC_DXT5_Format),
		(L) => new L.CompressedCubeTexture([0, 1, 2, 3, 4, 5].map(() => ({ mipmaps: mip, width: 4, height: 4 })), L.RGBA_S3TC_DXT5_Format),
	]) {
		const a = make(JRS), b = make(THREE);
		for (const k of ['isCompressedTexture', 'isCompressedArrayTexture', 'isCompressedCubeTexture', 'isCubeTexture', 'flipY', 'generateMipmaps', 'format', 'type', 'mapping', 'wrapS', 'magFilter', 'minFilter', 'unpackAlignment', 'colorSpace']) {
			assert.equal(a[k], b[k], `${a.constructor.name}.${k}`);
		}
		assert.equal(a.width, b.width); assert.equal(a.height, b.height); assert.equal(a.depth, b.depth);
	}
	const arr = new JRS.CompressedArrayTexture([], 4, 4, 5, JRS.RGBA_S3TC_DXT5_Format);
	assert.equal(arr.image.depth, 5);
	arr.addLayerUpdate(2); assert.ok(arr.layerUpdates.has(2)); arr.clearLayerUpdates(); assert.equal(arr.layerUpdates.size, 0);
});

test('FramebufferTexture and Texture.normalized', () => {
	const a = new JRS.FramebufferTexture(8, 4), b = new THREE.FramebufferTexture(8, 4);
	for (const k of ['magFilter', 'minFilter', 'generateMipmaps', 'version', 'isFramebufferTexture', 'normalized', 'flipY']) assert.equal(a[k], b[k], k);
	assert.equal(a.width, 8); assert.equal(a.height, 4);
	const t = new JRS.Texture(); t.normalized = true;
	assert.equal(t.clone().normalized, true);
});

test('VideoTexture follows the video frame callback and cancels it on dispose', () => {
	const calls = { request: 0, cancel: [] };
	let frameCallback = null;
	const video = { videoWidth: 4, videoHeight: 2, readyState: 4, HAVE_CURRENT_DATA: 2, requestVideoFrameCallback(cb) { calls.request++; frameCallback = cb; return 7; }, cancelVideoFrameCallback(id) { calls.cancel.push(id); } };
	const tex = new JRS.VideoTexture(video);
	assert.equal(tex.isVideoTexture, true); assert.equal(tex.generateMipmaps, false); assert.equal(tex.version, 0);
	frameCallback();
	assert.equal(tex.version, 1);
	assert.equal(calls.request, 2);
	tex.update(); assert.equal(tex.version, 1); // with requestVideoFrameCallback update() does not force an upload
	tex.dispose();
	assert.deepEqual(calls.cancel, [7]);
	const noRvfc = { videoWidth: 2, videoHeight: 2, readyState: 4, HAVE_CURRENT_DATA: 2 };
	const t2 = new JRS.VideoTexture(noRvfc); t2.update(); assert.equal(t2.version, 1);
});

test('TextureUtils.getByteLength, DataUtils and Box2 agree with three.js', () => {
	for (const k of ['RGBAFormat', 'RGBFormat', 'RedFormat', 'RGFormat', 'RGBA_S3TC_DXT5_Format', 'RGB_S3TC_DXT1_Format', 'RGBA_ASTC_6x6_Format', 'RGBA_BPTC_Format', 'RG11_EAC_Format', 'RED_RGTC1_Format']) {
		for (const t of ['UnsignedByteType', 'FloatType', 'HalfFloatType']) {
			assert.equal(JRS.TextureUtils.getByteLength(13, 7, JRS[k], JRS[t]), THREE.TextureUtils.getByteLength(13, 7, THREE[k], THREE[t]), `${k} ${t}`);
		}
	}
	for (const v of [0, 1, -1, 0.5, 65504, 1e-5, 3.14159]) {
		assert.equal(JRS.DataUtils.toHalfFloat(v), THREE.DataUtils.toHalfFloat(v));
		assert.equal(JRS.DataUtils.fromHalfFloat(JRS.DataUtils.toHalfFloat(v)), THREE.DataUtils.fromHalfFloat(THREE.DataUtils.toHalfFloat(v)));
	}
	const a = new JRS.Box2(new JRS.Vector2(1, 2), new JRS.Vector2(5, 4)), b = new THREE.Box2(new THREE.Vector2(1, 2), new THREE.Vector2(5, 4));
	assert.deepEqual(a.getSize(new JRS.Vector2()).toArray(), b.getSize(new THREE.Vector2()).toArray());
	assert.equal(a.containsPoint(new JRS.Vector2(2, 3)), true);
});

test('Source.getSize reports VideoFrame display size in the right order', () => {
	const src = new JRS.Source({ width: 3, height: 5, depth: 2 });
	assert.deepEqual(src.getSize(new JRS.Vector3()).toArray(), [3, 5, 2]);
	global.VideoFrame = class VideoFrame { constructor() { this.displayWidth = 640; this.displayHeight = 360; } };
	try { assert.deepEqual(new JRS.Source(new global.VideoFrame()).getSize(new JRS.Vector3()).toArray(), [640, 360, 0]); } finally { delete global.VideoFrame; }
	assert.equal(JRS.TextureSource, JRS.Source);
});

// ---------------------------------------------------------------------------------------------- WebGLTextures against a recording fake GL

/** A GL context stand-in: UPPER_CASE properties are distinct numbers, methods are recorded, getParameter returns 8192. */
function fakeGL() {
	const calls = [];
	const constants = new Map();
	let counter = 1000;
	let textureId = 0;
	const target = {
		getParameter: () => 8192,
		getExtension: () => null,
		createTexture: () => ({ id: ++textureId }),
		createFramebuffer: () => ({}),
	};
	const gl = new Proxy(target, {
		get(t, prop) {
			if (typeof prop !== 'string') return undefined;
			if (prop in t) return t[prop];
			if (/^[A-Z0-9_]+$/.test(prop)) { if (!constants.has(prop)) constants.set(prop, counter++); return constants.get(prop); }
			return (...args) => { calls.push([prop, ...args.map((a) => (ArrayBuffer.isView(a) ? 'view' : (a && a.id !== undefined ? 'tex' + a.id : a)))]); };
		},
	});
	return { gl, calls };
}
function setup() {
	const { gl, calls } = fakeGL();
	const state = new WebGLState(gl);
	const info = new WebGLInfo(gl);
	const textures = new WebGLTextures(gl, state, info);
	calls.length = 0;
	return { gl, calls, state, info, textures };
}
const names = (calls, re) => calls.filter((c) => re.test(c[0])).map((c) => c[0]);
const rgba = (w, h) => new Uint8Array(w * h * 4);

test('a texture is uploaded with texStorage2D + texSubImage2D and bound without re-uploading', () => {
	const { calls, textures, info } = setup();
	const tex = new JRS.DataTexture(rgba(4, 4), 4, 4); tex.needsUpdate = true;
	textures.setTexture2D(tex, 0);
	assert.deepEqual(names(calls, /^tex(Storage|Sub)?Image?2D$|^texStorage2D$/), ['texStorage2D', 'texSubImage2D']);
	assert.equal(info.memory.textures, 1);
	calls.length = 0;
	textures.setTexture2D(tex, 0);
	assert.deepEqual(names(calls, /^tex/), []);
	tex.needsUpdate = true; textures.setTexture2D(tex, 0);
	assert.deepEqual(names(calls, /^tex(Storage|Sub)?Image2D$/), ['texSubImage2D']);
});

test('a texture without image data or version is bound as nothing (no placeholder texture)', () => {
	const { calls, textures, info } = setup();
	const tex = new JRS.Texture();
	textures.setTexture2D(tex, 0);
	tex.needsUpdate = true; textures.setTexture2D(tex, 0);
	assert.equal(info.memory.textures, 0);
	assert.deepEqual(names(calls, /^(createTexture|tex)/), []);
	const bound = calls.filter((c) => c[0] === 'bindTexture');
	assert.ok(bound.every((c) => c[2] === null || c[2] === undefined));
});

test('textures sharing a Source and parameters share one GL texture; dispose frees it with the last user', () => {
	const { calls, textures, info } = setup();
	const a = new JRS.DataTexture(rgba(4, 4), 4, 4); a.needsUpdate = true;
	const b = a.clone(); b.needsUpdate = true;
	assert.equal(a.source, b.source);
	textures.setTexture2D(a, 0); textures.setTexture2D(b, 1);
	assert.equal(info.memory.textures, 1);
	assert.equal(names(calls, /^texSubImage2D$/).length, 1); // one upload for the shared source
	// different parameters need their own GL texture (and their own upload)
	const c = a.clone(); c.wrapS = JRS.RepeatWrapping; c.needsUpdate = true;
	textures.setTexture2D(c, 2);
	assert.equal(info.memory.textures, 2);
	assert.equal(names(calls, /^texSubImage2D$/).length, 2);
	a.dispose();
	assert.equal(names(calls, /^deleteTexture$/).length, 0); // b still uses it
	assert.equal(info.memory.textures, 2);
	b.dispose();
	assert.equal(names(calls, /^deleteTexture$/).length, 1);
	assert.equal(info.memory.textures, 1);
	c.dispose(); c.dispose();
	assert.equal(names(calls, /^deleteTexture$/).length, 2);
	assert.equal(info.memory.textures, 0);
});

test('changing a parameter and calling needsUpdate moves a texture to a new GL texture and frees the old one', () => {
	const { calls, textures, info } = setup();
	const a = new JRS.DataTexture(rgba(4, 4), 4, 4); a.needsUpdate = true;
	textures.setTexture2D(a, 0);
	a.wrapS = JRS.MirroredRepeatWrapping; a.needsUpdate = true;
	textures.setTexture2D(a, 0);
	assert.equal(names(calls, /^deleteTexture$/).length, 1);
	assert.equal(names(calls, /^texStorage2D$/).length, 2);
	assert.equal(info.memory.textures, 1);
});

test('large and streamed DataTextures are defined with texImage2D (mapped-memory path), small ones keep texStorage2D', () => {
	const { calls, textures } = setup();
	const small = new JRS.DataTexture(rgba(16, 16), 16, 16); small.needsUpdate = true;
	textures.setTexture2D(small, 0);
	assert.deepEqual(names(calls, /^tex(Storage|Sub)?Image?2D$|^texStorage2D$/), ['texStorage2D', 'texSubImage2D']);
	calls.length = 0;
	const large = new JRS.DataTexture(rgba(512, 512), 512, 512); large.needsUpdate = true;
	textures.setTexture2D(large, 0);
	large.needsUpdate = true; textures.setTexture2D(large, 0);
	assert.deepEqual(names(calls, /^tex(Storage|Sub)?Image?2D$|^texStorage2D$/), ['texImage2D', 'texImage2D']);
	calls.length = 0;
	const streamed = new JRS.DataTexture(new Float32Array(16), 2, 2, JRS.RGBAFormat, JRS.FloatType); streamed._stream = true; streamed.needsUpdate = true;
	textures.setTexture2D(streamed, 0);
	streamed.needsUpdate = true; textures.setTexture2D(streamed, 0);
	assert.deepEqual(names(calls, /^tex(Storage|Sub)?Image?2D$|^texStorage2D$/), ['texImage2D', 'texImage2D']);
});

test('DataTexture updateRanges re-upload only the ranges (texSubImage2D) on a small texture', () => {
	const { calls, textures } = setup();
	const tex = new JRS.DataTexture(rgba(8, 8), 8, 8); tex.needsUpdate = true;
	textures.setTexture2D(tex, 0);
	calls.length = 0;
	tex.addUpdateRange(0, 32); tex.addUpdateRange(8 * 4 * 3, 32); tex.needsUpdate = true;
	textures.setTexture2D(tex, 0);
	assert.equal(names(calls, /^texSubImage2D$/).length, 2);
	assert.equal(tex.updateRanges.length, 0);
});

test('DataArrayTexture layerUpdates upload only the listed layers', () => {
	const { calls, textures } = setup();
	const tex = new JRS.DataArrayTexture(new Uint8Array(4 * 4 * 3 * 4), 4, 4, 3); tex.needsUpdate = true;
	textures.setTexture2DArray(tex, 0);
	assert.deepEqual(names(calls, /^tex(Storage3D|SubImage3D)$/), ['texStorage3D', 'texSubImage3D']);
	calls.length = 0;
	tex.addLayerUpdate(2); tex.needsUpdate = true;
	textures.setTexture2DArray(tex, 0);
	const sub = calls.filter((c) => c[0] === 'texSubImage3D');
	assert.equal(sub.length, 1);
	assert.equal(sub[0][5], 2); // zoffset = the layer index
	assert.equal(tex.layerUpdates.size, 0);
});

test('a compressed texture uploads every mipmap with compressedTexSubImage2D into texStorage2D storage', () => {
	const { calls, textures } = setup();
	const mips = [{ data: new Uint8Array(64), width: 8, height: 8 }, { data: new Uint8Array(16), width: 4, height: 4 }, { data: new Uint8Array(16), width: 2, height: 2 }];
	const tex = new JRS.CompressedTexture(mips, 8, 8, JRS.RGBAFormat, JRS.UnsignedByteType);
	tex.needsUpdate = true;
	textures.setTexture2D(tex, 0);
	assert.deepEqual(names(calls, /^tex(Storage2D|SubImage2D)$/), ['texStorage2D', 'texSubImage2D', 'texSubImage2D', 'texSubImage2D']);
	const storage = calls.find((c) => c[0] === 'texStorage2D');
	assert.equal(storage[2], 3); // levels = mipmaps.length
});

test('a cube texture without six images is not uploaded and binds nothing', () => {
	const { calls, textures, info } = setup();
	const tex = new JRS.CubeTexture([{}, {}, {}]); tex.needsUpdate = true;
	textures.setTextureCube(tex, 0);
	assert.equal(info.memory.textures, 0);
	assert.deepEqual(names(calls, /^(createTexture|tex)/), []);
});

test('unpack state goes through the cached pixelStorei', () => {
	const { gl, calls, textures } = setup();
	const a = new JRS.DataTexture(rgba(4, 4), 4, 4); a.flipY = true; a.needsUpdate = true;
	const b = new JRS.DataTexture(rgba(4, 4), 4, 4); b.flipY = true; b.needsUpdate = true;
	textures.setTexture2D(a, 0); textures.setTexture2D(b, 0);
	const flips = calls.filter((c) => c[0] === 'pixelStorei' && c[1] === gl.UNPACK_FLIP_Y_WEBGL);
	assert.equal(flips.length, 1);
});
