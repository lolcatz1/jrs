import test from 'node:test';
import assert from 'node:assert/strict';
import { PointLight, PointLightShadow, CubeDepthTexture, WebGLCubeRenderTarget, DirectionalLight, SpotLight, UnsignedIntType, NearestFilter } from '../src/index.js';
import { WebGLLights } from '../src/renderers/webgl/WebGLLights.js';
import { pointShadowUnit, MAX_POINT_SHADOWS } from '../src/renderers/shaders/ShaderLib.js';

test('PointLight owns a PointLightShadow with a 90 degree camera', () => {
	const light = new PointLight();
	assert.ok(light.shadow instanceof PointLightShadow);
	assert.equal(light.shadow.isPointLightShadow, true);
	assert.equal(light.shadow.camera.fov, 90);
	assert.equal(light.shadow.camera.aspect, 1);
	assert.equal(light.shadow.camera.near, 0.5);
	assert.equal(light.shadow.camera.far, 500);
});

test('CubeDepthTexture has six square faces', () => {
	const t = new CubeDepthTexture(64, UnsignedIntType);
	assert.equal(t.isCubeDepthTexture, true);
	assert.equal(t.isDepthTexture, true);
	assert.equal(t.image.length, 6);
	assert.equal(t.image[3].width, 64);
	assert.equal(t.magFilter, NearestFilter);
});

test('WebGLCubeRenderTarget is a cube target with a cube texture', () => {
	const rt = new WebGLCubeRenderTarget(32, { depthOnly: true });
	assert.equal(rt.isWebGLCubeRenderTarget, true);
	assert.equal(rt.width, 32); assert.equal(rt.height, 32);
	assert.equal(rt.texture.isCubeTexture, true);
	assert.equal(rt.texture.renderTarget, rt);
	rt.setSize(16, 16);
	assert.equal(rt.texture.image.length, 6); assert.equal(rt.texture.image[0].width, 16);
});

test('point shadow texture units are the free units of 8-14', () => {
	assert.deepEqual([0, 1, 2, 3].map((i) => pointShadowUnit(i, 0, 0)), [8, 9, 10, 11]);
	assert.deepEqual([0, 1].map((i) => pointShadowUnit(i, 2, 1)), [10, 11]); // 8,9 directional; 12 spot
	assert.equal(pointShadowUnit(0, 4, 3), -1); // 8-11 directional, 12-14 spot: nothing left
});

function lightsWith(dirs, spots, points, pointShadowsEnabled = true) {
	const lights = new WebGLLights();
	lights.begin();
	for (let i = 0; i < dirs; i++) { const l = new DirectionalLight(); l.castShadow = true; lights.push(l); }
	for (let i = 0; i < spots; i++) { const l = new SpotLight(); l.castShadow = true; lights.push(l); }
	for (let i = 0; i < points; i++) { const l = new PointLight(); l.castShadow = i % 2 === 0; lights.push(l); }
	lights.end(true, pointShadowsEnabled);
	return lights;
}

test('WebGLLights: point shadow casters come first and are capped by the free texture units', () => {
	const a = lightsWith(0, 0, 8);
	assert.equal(a.numPointShadows, MAX_POINT_SHADOWS);
	for (let i = 0; i < a.numPointShadows; i++) assert.equal(a.point[i].castShadow, true);
	assert.equal(lightsWith(4, 3, 2).numPointShadows, 0);
	assert.equal(lightsWith(2, 1, 3).numPointShadows, 2);
	assert.equal(lightsWith(0, 0, 3, false).numPointShadows, 0); // VSM: not supported for point lights (three.js skips them too)
});

test('WebGLLights: the shadow counts change the lights version (program recompile)', () => {
	const lights = new WebGLLights();
	lights.begin(); const l = new PointLight(); l.castShadow = true; lights.push(l); lights.end(true);
	const v = lights.version;
	lights.begin(); const l2 = new PointLight(); lights.push(l2); lights.end(true);
	assert.notEqual(lights.version, v);
});
