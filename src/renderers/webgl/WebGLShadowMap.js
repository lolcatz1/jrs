import { Object3D } from '../../core/Object3D.js';
import { Frustum } from '../../math/Frustum.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Vector4 } from '../../math/Vector4.js';
import { WebGLRenderTarget } from '../WebGLRenderTarget.js';
import { DepthTexture } from '../../textures/DepthTexture.js';
import { LessEqualStencilFunc, LinearFilter, FrontSide, BackSide, DoubleSide, UnsignedIntType, DepthFormat, PCFShadowMap } from '../../constants.js';
import { WebGLRenderList } from './WebGLRenderLists.js';
import { TEXTURE_UNITS } from '../shaders/ShaderLib.js';

const _frustum = /*@__PURE__*/ new Frustum();
const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _viewport = /*@__PURE__*/ new Vector4();
const _f64 = /*@__PURE__*/ new Float64Array(1);
const _i32 = /*@__PURE__*/ new Int32Array(_f64.buffer);
const _defaultOnBeforeRender = Object3D.prototype.onBeforeRender;
const _defaultOnAfterRender = Object3D.prototype.onAfterRender;
const SIG_PER_CASTER = 7;

function mixInt(h, x) { return Math.imul(h ^ x, 0x01000193); }
function mixNum(h, x) { _f64[0] = x; return mixInt(mixInt(h, _i32[0]), _i32[1]); }

/**
 * Shadow map pass for directional and spot lights. Depth-only framebuffers,
 * hardware compare (sampler2DShadow) with 3x3 PCF in the main pass. Uses the
 * renderer's command builder so shadow casters are batched too.
 */
class WebGLShadowMap {
	constructor(renderer) {
		this.renderer = renderer;
		this.enabled = false;
		this.autoUpdate = true;
		this.needsUpdate = false;
		this.type = PCFShadowMap;
		this.lists = new WeakMap(); // light -> WebGLRenderList
		// Per-light "what produced the depth map" signatures. When the signature of the current frame equals the one the
		// map was last rendered from, the map is still exact and the whole pass (collect, cull, sort, upload, draw) is skipped.
		this.records = new WeakMap(); // light -> { sig, n, valid, map, epoch }
		this._sig = new Float64Array(4096);
		this._sigN = 0;
		this._sigCacheable = true;
		this._sigBail = false;
		this._sigPrev = null;
		this._epoch = 0; // bumped when the GL context is restored: depth maps are gone
		this._renderOrders = new Map();
		this._renderOrderList = [];
		/** Number of shadow maps whose render was skipped / performed (diagnostics). */
		this.skipped = 0; this.rendered = 0;
	}

	render(lights, scene, camera) {
		const renderer = this.renderer;
		if (this.enabled === false) return;
		if (this.autoUpdate === false && this.needsUpdate === false) return;
		const shadowLights = [];
		for (let i = 0; i < lights.numDirShadows; i++) shadowLights.push(lights.dir[i]);
		for (let i = 0; i < lights.numSpotShadows; i++) shadowLights.push(lights.spot[i]);
		if (shadowLights.length === 0) return;

		const state = renderer.state;
		let previousTarget = null;
		let stateReady = false;
		let savedOrders = null, savedOrderList = null, savedLastNoted = NaN;

		for (let i = 0; i < shadowLights.length; i++) {
			const light = shadowLights[i];
			const shadow = light.shadow;
			if (shadow === undefined) continue;
			if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
			const mapSize = shadow.mapSize;
			let record = this.records.get(light);
			if (record === undefined) { record = { sig: new Float64Array(0), n: 0, valid: false, map: null, epoch: -1, misses: 0, cool: 0 }; this.records.set(light, record); }
			if (shadow.map === null) {
				const depthTexture = new DepthTexture(mapSize.x, mapSize.y, UnsignedIntType, undefined, undefined, undefined, LinearFilter, LinearFilter, undefined, DepthFormat);
				depthTexture.compareFunction = LessEqualStencilFunc;
				shadow.map = new WebGLRenderTarget(mapSize.x, mapSize.y, { depthTexture, depthOnly: true, minFilter: LinearFilter, magFilter: LinearFilter });
				shadow.map.texture.name = light.name + '.shadowMap';
				shadow.camera.updateProjectionMatrix();
			} else if (shadow.map.width !== mapSize.x || shadow.map.height !== mapSize.y) {
				shadow.map.setSize(mapSize.x, mapSize.y);
				shadow.map.depthTexture.image.width = mapSize.x; shadow.map.depthTexture.image.height = mapSize.y;
			}
			shadow.updateMatrices(light);

			// unchanged inputs -> the depth map from the last render is still exact
			const forced = shadow.needsUpdate === true || this.needsUpdate === true;
			const unchanged = this._computeSignature(light, shadow, scene, record);
			if (unchanged && !forced) { this.skipped++; continue; }
			this.rendered++;

			if (stateReady === false) {
				stateReady = true;
				previousTarget = renderer.getRenderTarget();
				state.setDepthTest(true);
				state.setDepthMask(true);
				state.setScissorTest(false);
				// the shadow pass must not disturb the main pass's renderOrder ranking (consumed in list.finish after this pass)
				savedOrders = renderer._renderOrders; savedOrderList = renderer._renderOrderList; savedLastNoted = renderer._lastNotedRenderOrder;
				renderer._renderOrders = this._renderOrders; renderer._renderOrderList = this._renderOrderList;
			}
			_frustum.copy(shadow.getFrustum());
			renderer.setRenderTarget(shadow.map);
			renderer.clear(false, true, false);
			_viewport.set(0, 0, mapSize.x, mapSize.y);
			state.viewport(0, 0, mapSize.x, mapSize.y);

			// collect casters
			let list = this.lists.get(light);
			if (list === undefined) { list = new WebGLRenderList(); this.lists.set(light, list); }
			list.init();
			renderer._renderOrderReset();
			this._collect(scene, shadow.camera, list);
			renderer._resolvePrograms(list, scene);
			list.finish(true, renderer._rankOfRenderOrder);
			renderer._uploadFrameBlock(shadow.camera, scene);
			renderer._drawList(list, list.opaqueSorted, list.opaqueCount, scene, shadow.camera, true);
			renderer._drawList(list, list.transparentSorted, list.transparentCount, scene, shadow.camera, true);
			shadow.needsUpdate = false;
		}
		this.needsUpdate = false;
		if (stateReady) {
			renderer._renderOrders = savedOrders; renderer._renderOrderList = savedOrderList; renderer._lastNotedRenderOrder = savedLastNoted;
			renderer.setRenderTarget(previousTarget);
		}
	}

	/**
	 * Walks the casters (no culling, no list building) and records everything the depth map depends on: the shadow
	 * camera matrices, every caster's id and world version, and per-material / per-geometry digests. Returns true when
	 * it is identical to the signature the map was last rendered from (the render can be skipped); otherwise the new
	 * signature is stored as the reference for the render about to happen.
	 * Anything the signature cannot describe (alpha-tested or custom-shader casters, render hooks, lines, points,
	 * multi-material meshes) makes the light uncacheable: it renders every frame as before and is only re-probed rarely.
	 * A light whose signature keeps changing (animated casters) backs off: most frames skip the signature entirely, so
	 * the walk costs nothing there; a scene that becomes static is detected a few frames late and then skips.
	 */
	_computeSignature(light, shadow, scene, record) {
		if (record.cool > 0) { record.cool--; record.valid = false; return false; }
		const renderer = this.renderer;
		const camera = shadow.camera;
		const pe = camera.projectionMatrix.elements, ve = camera.matrixWorldInverse.elements;
		const prev = record.sig;
		const comparing = record.valid && record.map === shadow.map && record.epoch === this._epoch;
		let sig = this._sig;
		for (let k = 0; k < 16; k++) { sig[k] = pe[k]; sig[16 + k] = ve[k]; }
		sig[32] = shadow.mapSize.x; sig[33] = shadow.mapSize.y; sig[34] = camera.layers.mask; sig[35] = renderer._envVersion; sig[36] = this.type;
		this._sigN = 37;
		this._sigCacheable = true;
		this._sigBail = false;
		this._sigPrev = comparing ? prev : null;
		if (comparing) for (let k = 0; k < 37; k++) if (prev[k] !== sig[k]) { this._sigBail = true; break; }
		if (!this._sigBail) this._sigWalk(scene, camera, renderer._frameId);
		const n = this._sigN;
		sig = this._sig; // may have grown
		this._sigPrev = null;
		if (!this._sigCacheable) { record.valid = false; record.cool = 30; return false; }
		if (comparing) {
			if (!this._sigBail && record.n === n) { record.misses = 0; return true; }
			record.valid = false;
			if (++record.misses >= 2) record.cool = 3;
			return false;
		}
		// record: the scratch buffer becomes the reference, the old one the next scratch
		record.sig = sig; this._sig = prev.length >= 4096 ? prev : new Float64Array(4096);
		record.n = n; record.valid = true; record.map = shadow.map; record.epoch = this._epoch;
		return false;
	}

	_sigWalk(object, shadowCamera, frame) {
		if (object.visible === false) return;
		if (object.castShadow && object.layers.test(shadowCamera.layers) && (object.isMesh || object.isLine || object.isPoints)) {
			const geometry = object.geometry, material = object.material;
			if (object.isMesh !== true || Array.isArray(material) || object.onBeforeRender !== _defaultOnBeforeRender || object.onAfterRender !== _defaultOnAfterRender) {
				this._sigCacheable = false; this._sigBail = true;
				return;
			}
			if (this._sigN + SIG_PER_CASTER > this._sig.length) { const g = new Float64Array(this._sig.length * 2); g.set(this._sig); this._sig = g; }
			if (material._shadowSigStamp !== frame) { material._shadowSigStamp = frame; material._shadowSig = this._materialDigest(material); }
			if (geometry._shadowSigStamp !== frame) { geometry._shadowSigStamp = frame; geometry._shadowSig = this._geometryDigest(geometry); }
			if (material._shadowSig === 0 || geometry._shadowSig === 0) { this._sigCacheable = false; this._sigBail = true; return; }
			const sig = this._sig;
			const start = this._sigN;
			let n = start;
			sig[n++] = object.id; sig[n++] = object._worldVersion;
			sig[n++] = material._shadowSig; sig[n++] = geometry._shadowSig;
			if (object.isInstancedMesh) {
				const bs = object.boundingSphere;
				sig[n++] = (object.frustumCulled ? 1 : 0) + 2 * object.count;
				sig[n++] = object.instanceMatrix.version + 4294967296 * object.instanceMatrix.count;
				sig[n++] = bs === null ? -1 : bs.radius;
			} else { sig[n++] = object.frustumCulled ? 1 : 0; sig[n++] = 0; sig[n++] = 0; }
			this._sigN = n;
			const prev = this._sigPrev;
			if (prev !== null) {
				for (let k = start; k < n; k++) if (prev[k] !== sig[k]) { this._sigBail = true; return; }
			}
		}
		const children = object.children;
		for (let i = 0, l = children.length; i < l; i++) {
			this._sigWalk(children[i], shadowCamera, frame);
			if (this._sigBail) return;
		}
	}

	/** 32-bit digest of everything about a material the shadow pass reads; 0 = cannot be cached. */
	_materialDigest(m) {
		if (m.isShaderMaterial === true || m.alphaTest > 0) return 0;
		let h = 0x811c9dc5 | 0;
		h = mixInt(h, m.id); h = mixInt(h, m.version);
		h = mixInt(h, (m.visible ? 1 : 0) | (m.wireframe ? 2 : 0) | (m.transparent ? 4 : 0) | (m.depthWrite ? 8 : 0) | (m.depthTest ? 16 : 0) | (m.colorWrite ? 32 : 0) | (m.polygonOffset ? 64 : 0));
		h = mixInt(h, m.side); h = mixInt(h, m.shadowSide === null || m.shadowSide === undefined ? -1 : m.shadowSide);
		h = mixInt(h, m.blending); h = mixNum(h, m.polygonOffsetFactor); h = mixNum(h, m.polygonOffsetUnits);
		return h === 0 ? 1 : h;
	}

	/** 32-bit digest of everything about a geometry the shadow pass reads; 0 = cannot be cached. */
	_geometryDigest(g) {
		let h = 0x811c9dc5 | 0;
		const position = g.attributes.position, index = g.index;
		h = mixInt(h, g.id); h = mixInt(h, g._layoutVersion);
		if (position !== undefined) {
			const v = position.isInterleavedBufferAttribute ? position.data.version : position.version;
			h = mixInt(h, v); h = mixInt(h, position.count);
		}
		if (index !== null) { h = mixInt(h, index.version); h = mixInt(h, index.count); }
		h = mixNum(h, g.drawRange.start); h = mixNum(h, g.drawRange.count);
		if (g.isInstancedBufferGeometry) h = mixNum(h, g.instanceCount);
		const bs = g.boundingSphere;
		if (bs !== null) { h = mixNum(h, bs.radius); h = mixNum(h, bs.center.x); h = mixNum(h, bs.center.y); h = mixNum(h, bs.center.z); }
		return h === 0 ? 1 : h;
	}

	_collect(object, shadowCamera, list) {
		if (object.visible === false) return;
		const renderer = this.renderer;
		const visible = object.layers.test(shadowCamera.layers);
		if (visible && (object.isMesh || object.isLine || object.isPoints)) {
			if (object.castShadow && (object.frustumCulled === false || renderer._cullTest(object, object.geometry, _frustum, true))) {
				const geometry = object.geometry;
				const material = object.material;
				if (Array.isArray(material)) {
					const groups = geometry.groups;
					for (let k = 0, kl = groups.length; k < kl; k++) {
						const group = groups[k];
						const groupMaterial = material[group.materialIndex];
						if (groupMaterial && groupMaterial.visible) renderer._pushItem(list, object, geometry, groupMaterial, group, 0, true);
					}
				} else if (material.visible) {
					renderer._pushItem(list, object, geometry, material, null, 0, true);
				}
			}
		}
		const children = object.children;
		for (let i = 0, l = children.length; i < l; i++) this._collect(children[i], shadowCamera, list);
	}

	/** Bind shadow depth textures to their fixed units for the main pass. */
	bindShadowMaps(lights) {
		const renderer = this.renderer;
		for (let i = 0; i < lights.numDirShadows; i++) {
			const map = lights.dir[i].shadow.map;
			if (map) renderer.textures.setTexture2D(map.depthTexture, TEXTURE_UNITS.dirShadowMap0 + i);
		}
		for (let i = 0; i < lights.numSpotShadows; i++) {
			const map = lights.spot[i].shadow.map;
			if (map) renderer.textures.setTexture2D(map.depthTexture, TEXTURE_UNITS.spotShadowMap0 + i);
		}
	}
}

export { WebGLShadowMap };
