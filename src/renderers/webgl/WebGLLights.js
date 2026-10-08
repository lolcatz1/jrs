import { Vector3 } from '../../math/Vector3.js';
import { Color } from '../../math/Color.js';
import { MAX_DIR_LIGHTS, MAX_POINT_LIGHTS, MAX_SPOT_LIGHTS, MAX_HEMI_LIGHTS, MAX_POINT_SHADOWS, LIGHTS_BLOCK_SIZE, pointShadowUnit } from '../shaders/ShaderLib.js';

const _v = /*@__PURE__*/ new Vector3();
const _v2 = /*@__PURE__*/ new Vector3();

// std140 offsets (bytes) inside the Lights block
const OFF_AMBIENT = 0;
const OFF_COUNTS = 16;
const OFF_DIR = 32;
const OFF_POINT = OFF_DIR + MAX_DIR_LIGHTS * 32;
const OFF_SPOT = OFF_POINT + MAX_POINT_LIGHTS * 48;
const OFF_HEMI = OFF_SPOT + MAX_SPOT_LIGHTS * 64;
const OFF_DIR_SHADOW_MAT = OFF_HEMI + MAX_HEMI_LIGHTS * 48;
const OFF_DIR_SHADOW_PARAMS = OFF_DIR_SHADOW_MAT + MAX_DIR_LIGHTS * 64;
const OFF_SPOT_SHADOW_MAT = OFF_DIR_SHADOW_PARAMS + MAX_DIR_LIGHTS * 16;
const OFF_SPOT_SHADOW_PARAMS = OFF_SPOT_SHADOW_MAT + MAX_SPOT_LIGHTS * 64;
const OFF_POINT_SHADOW_PARAMS = OFF_SPOT_SHADOW_PARAMS + MAX_SPOT_LIGHTS * 16;
const OFF_POINT_SHADOW_INFO = OFF_POINT_SHADOW_PARAMS + MAX_POINT_SHADOWS * 16;

/**
 * Collects the scene's lights into one std140 buffer that is uploaded once
 * per frame. World-space lighting; no per-camera rework.
 */
class WebGLLights {
	constructor() {
		this.data = new Float32Array(LIGHTS_BLOCK_SIZE / 4);
		this.ints = new Int32Array(this.data.buffer);
		this.ambient = new Color(0, 0, 0);
		this.dir = []; this.point = []; this.spot = []; this.hemi = [];
		this.dirShadows = []; this.spotShadows = []; this.pointShadows = [];
		this.numDirShadows = 0; this.numSpotShadows = 0; this.numPointShadows = 0;
		this.version = 0;
		this.hash = '';
	}
	begin() {
		this.ambient.setRGB(0, 0, 0);
		this.dir.length = 0; this.point.length = 0; this.spot.length = 0; this.hemi.length = 0;
		this.dirShadows.length = 0; this.spotShadows.length = 0; this.pointShadows.length = 0;
	}
	push(light) {
		if (light.isAmbientLight) {
			const c = light.color, i = light.intensity;
			this.ambient.r += c.r * i; this.ambient.g += c.g * i; this.ambient.b += c.b * i;
		} else if (light.isDirectionalLight) {
			if (this.dir.length < MAX_DIR_LIGHTS) { this.dir.push(light); if (light.castShadow) this.dirShadows.push(light); }
		} else if (light.isPointLight) {
			if (this.point.length < MAX_POINT_LIGHTS) { this.point.push(light); if (light.castShadow) this.pointShadows.push(light); }
		} else if (light.isSpotLight) {
			if (this.spot.length < MAX_SPOT_LIGHTS) { this.spot.push(light); if (light.castShadow) this.spotShadows.push(light); }
		} else if (light.isHemisphereLight) {
			if (this.hemi.length < MAX_HEMI_LIGHTS) this.hemi.push(light);
		}
	}
	/** Shadow-casting lights come first within their type so sampler indices line up. */
	end(shadowsEnabled, pointShadowsEnabled = true) {
		if (shadowsEnabled) {
			this.dir.sort(shadowCastingFirst);
			this.spot.sort(shadowCastingFirst);
			this.point.sort(shadowCastingFirst);
			this.numDirShadows = Math.min(this.dirShadows.length, MAX_DIR_LIGHTS);
			this.numSpotShadows = Math.min(this.spotShadows.length, MAX_SPOT_LIGHTS - 1); // texture unit 15 is shared with the multi-draw matrix texture
			// cube maps take the shadow texture units (8-14) the directional and spot maps leave free
			let n = pointShadowsEnabled ? Math.min(this.pointShadows.length, MAX_POINT_SHADOWS) : 0;
			while (n > 0 && pointShadowUnit(n - 1, this.numDirShadows, this.numSpotShadows) < 0) n--;
			this.numPointShadows = n;
		} else {
			this.numDirShadows = 0; this.numSpotShadows = 0; this.numPointShadows = 0;
		}
		const hash = this.numDirShadows + ':' + this.numSpotShadows + ':' + this.numPointShadows;
		if (hash !== this.hash) { this.hash = hash; this.version++; }
	}
	/** Write the collected lights into the std140 buffer image. Call after shadow matrices are updated. */
	fill() {
		const d = this.data, ints = this.ints;
		d[0] = this.ambient.r; d[1] = this.ambient.g; d[2] = this.ambient.b; d[3] = 1;
		ints[OFF_COUNTS / 4] = this.dir.length; ints[OFF_COUNTS / 4 + 1] = this.point.length;
		ints[OFF_COUNTS / 4 + 2] = this.spot.length; ints[OFF_COUNTS / 4 + 3] = this.hemi.length;
		for (let i = 0; i < this.dir.length; i++) {
			const light = this.dir[i], o = (OFF_DIR + i * 32) / 4;
			_v.setFromMatrixPosition(light.matrixWorld);
			_v2.setFromMatrixPosition(light.target.matrixWorld);
			_v.sub(_v2).normalize();
			d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; d[o + 3] = 0;
			const c = light.color, k = light.intensity;
			d[o + 4] = c.r * k; d[o + 5] = c.g * k; d[o + 6] = c.b * k; d[o + 7] = 0;
			if (i < this.numDirShadows) {
				const shadow = light.shadow;
				const mo = (OFF_DIR_SHADOW_MAT + i * 64) / 4;
				const me = shadow.matrix.elements;
				for (let k2 = 0; k2 < 16; k2++) d[mo + k2] = me[k2];
				const po = (OFF_DIR_SHADOW_PARAMS + i * 16) / 4;
				d[po] = shadow.bias; d[po + 1] = shadow.normalBias; d[po + 2] = shadow.radius / shadow.mapSize.x; d[po + 3] = shadow.intensity;
			}
		}
		for (let i = 0; i < this.point.length; i++) {
			const light = this.point[i], o = (OFF_POINT + i * 48) / 4;
			_v.setFromMatrixPosition(light.matrixWorld);
			d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; d[o + 3] = 0;
			const c = light.color, k = light.intensity;
			d[o + 4] = c.r * k; d[o + 5] = c.g * k; d[o + 6] = c.b * k; d[o + 7] = 0;
			d[o + 8] = light.distance; d[o + 9] = light.decay; d[o + 10] = 0; d[o + 11] = 0;
			if (i < this.numPointShadows) {
				const shadow = light.shadow;
				const po = (OFF_POINT_SHADOW_PARAMS + i * 16) / 4;
				d[po] = shadow.bias; d[po + 1] = shadow.normalBias; d[po + 2] = shadow.radius; d[po + 3] = shadow.intensity;
				const io = (OFF_POINT_SHADOW_INFO + i * 16) / 4;
				d[io] = shadow.mapSize.x; d[io + 1] = shadow.camera.near; d[io + 2] = shadow.camera.far; d[io + 3] = 0;
			}
		}
		for (let i = 0; i < this.spot.length; i++) {
			const light = this.spot[i], o = (OFF_SPOT + i * 64) / 4;
			_v.setFromMatrixPosition(light.matrixWorld);
			d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; d[o + 3] = 0;
			_v2.setFromMatrixPosition(light.target.matrixWorld);
			_v.sub(_v2).normalize();
			d[o + 4] = _v.x; d[o + 5] = _v.y; d[o + 6] = _v.z; d[o + 7] = 0;
			const c = light.color, k = light.intensity;
			d[o + 8] = c.r * k; d[o + 9] = c.g * k; d[o + 10] = c.b * k; d[o + 11] = 0;
			d[o + 12] = light.distance; d[o + 13] = light.decay; d[o + 14] = Math.cos(light.angle); d[o + 15] = Math.cos(light.angle * (1 - light.penumbra));
			if (i < this.numSpotShadows) {
				const shadow = light.shadow;
				const mo = (OFF_SPOT_SHADOW_MAT + i * 64) / 4;
				const me = shadow.matrix.elements;
				for (let k2 = 0; k2 < 16; k2++) d[mo + k2] = me[k2];
				const po = (OFF_SPOT_SHADOW_PARAMS + i * 16) / 4;
				d[po] = shadow.bias; d[po + 1] = shadow.normalBias; d[po + 2] = shadow.radius / shadow.mapSize.x; d[po + 3] = shadow.intensity;
			}
		}
		for (let i = 0; i < this.hemi.length; i++) {
			const light = this.hemi[i], o = (OFF_HEMI + i * 48) / 4;
			_v.setFromMatrixPosition(light.matrixWorld).normalize();
			d[o] = _v.x; d[o + 1] = _v.y; d[o + 2] = _v.z; d[o + 3] = 0;
			const k = light.intensity;
			d[o + 4] = light.color.r * k; d[o + 5] = light.color.g * k; d[o + 6] = light.color.b * k; d[o + 7] = 0;
			d[o + 8] = light.groundColor.r * k; d[o + 9] = light.groundColor.g * k; d[o + 10] = light.groundColor.b * k; d[o + 11] = 0;
		}
	}
}

function shadowCastingFirst(a, b) { return (b.castShadow ? 1 : 0) - (a.castShadow ? 1 : 0); }

export { WebGLLights };
