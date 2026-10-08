import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WebGLBatcher } from '../src/renderers/webgl/WebGLBatcher.js';
import { Mesh } from '../src/objects/Mesh.js';

function fakeGL() {
	const gl = { uploads: [], created: 0, TEXTURE_2D: 1, RGBA32F: 2, RGBA: 3, FLOAT: 4, NEAREST: 5, TEXTURE_MIN_FILTER: 6, TEXTURE_MAG_FILTER: 7, UNPACK_ALIGNMENT: 8, UNPACK_FLIP_Y_WEBGL: 9 };
	gl.createTexture = () => ({ id: ++gl.created });
	gl.deleteTexture = () => {};
	gl.texStorage2D = () => {}; gl.texParameteri = () => {}; gl.pixelStorei = () => {};
	gl.texSubImage2D = (t, l, x, y, w, h, f, ty, data, off) => gl.uploads.push({ y, h, off });
	return gl;
}
const state = { bindTexture() {} };

function frame(b, meshes) {
	b.beginFrame(); b.begin(); b.ensureTex(meshes.length);
	for (const m of meshes) b.addTex(m);
	b.uploadTexture(state, 0);
}

test('matrix texture uploads only rows containing changed objects', () => {
	const gl = fakeGL(), b = new WebGLBatcher(gl);
	const meshes = []; for (let i = 0; i < 128 * 20; i++) { const m = new Mesh(); m.position.x = i; meshes.push(m); }
	for (const m of meshes) m.updateMatrixWorld(true);
	frame(b, meshes);
	assert.deepEqual(gl.uploads, [{ y: 0, h: 20, off: 0 }]); // first frame: everything
	gl.uploads.length = 0;
	frame(b, meshes);
	assert.equal(gl.uploads.length, 0); // nothing moved
	meshes[5].position.y = 3; meshes[128 * 10 + 1].position.y = 3;
	for (const m of meshes) m.updateMatrixWorld();
	frame(b, meshes);
	assert.deepEqual(gl.uploads.map(u => u.y), [0, 10]); // rows 0 and 10 only
	assert.equal(gl.uploads[0].h, 1);
});

test('double-buffered textures each catch up on missed changes', () => {
	const gl = fakeGL(), b = new WebGLBatcher(gl);
	b.doubleBuffer = true;
	const meshes = []; for (let i = 0; i < 128 * 30; i++) meshes.push(new Mesh());
	for (const m of meshes) m.updateMatrixWorld(true);
	frame(b, meshes); frame(b, meshes); // both textures initialised
	gl.uploads.length = 0;
	meshes[0].position.x = 1; meshes[0].updateMatrixWorld();
	frame(b, meshes); frame(b, meshes);
	assert.equal(gl.uploads.length, 2); // the change reaches both textures
	assert.ok(gl.uploads.every(u => u.y === 0 && u.h === 1));
	frame(b, meshes);
	assert.equal(gl.uploads.length, 2);
});
