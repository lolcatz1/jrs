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
	}

	render(lights, scene, camera) {
		const renderer = this.renderer;
		if (this.enabled === false) return;
		if (this.autoUpdate === false && this.needsUpdate === false) return;
		const shadowLights = [];
		for (let i = 0; i < lights.numDirShadows; i++) shadowLights.push(lights.dir[i]);
		for (let i = 0; i < lights.numSpotShadows; i++) shadowLights.push(lights.spot[i]);
		if (shadowLights.length === 0) return;

		const previousTarget = renderer.getRenderTarget();
		const state = renderer.state;
		state.setDepthTest(true);
		state.setDepthMask(true);
		state.setScissorTest(false);

		for (let i = 0; i < shadowLights.length; i++) {
			const light = shadowLights[i];
			const shadow = light.shadow;
			if (shadow === undefined) continue;
			if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
			const mapSize = shadow.mapSize;
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
			_frustum.copy(shadow.getFrustum());
			renderer.setRenderTarget(shadow.map);
			renderer.clear(false, true, false);
			_viewport.set(0, 0, mapSize.x, mapSize.y);
			state.viewport(0, 0, mapSize.x, mapSize.y);

			// collect casters
			let list = this.lists.get(light);
			if (list === undefined) { list = new WebGLRenderList(); this.lists.set(light, list); }
			list.init();
			// no _renderOrderReset() here: the main pass has already registered every renderOrder of the frame and
			// sorts with that table after this pass; resetting it to the casters' orders alone mis-ranked receivers
			this._collect(scene, shadow.camera, list);
			renderer._resolvePrograms(list, scene);
			list.finish(true, renderer._rankOfRenderOrder);
			renderer._uploadFrameBlock(shadow.camera, scene);
			renderer._drawList(list, list.opaqueSorted, list.opaqueCount, scene, shadow.camera, true);
			renderer._drawList(list, list.transparentSorted, list.transparentCount, scene, shadow.camera, true);
			shadow.needsUpdate = false;
		}
		this.needsUpdate = false;
		renderer.setRenderTarget(previousTarget);
	}

	_collect(object, shadowCamera, list) {
		if (object.visible === false) return;
		const renderer = this.renderer;
		const visible = object.layers.test(shadowCamera.layers);
		if (visible && (object.isMesh || object.isLine || object.isPoints)) {
			if (object.castShadow && (object.frustumCulled === false || renderer._cullTest(object, object.geometry, _frustum))) {
				const geometry = object.geometry;
				const material = object.material;
				list.zScratch[0] = 0;
				if (Array.isArray(material)) {
					const groups = geometry.groups;
					for (let k = 0, kl = groups.length; k < kl; k++) {
						const group = groups[k];
						const groupMaterial = material[group.materialIndex];
						if (groupMaterial && groupMaterial.visible) renderer._pushItem(list, object, geometry, groupMaterial, group, true);
					}
				} else if (material.visible) {
					renderer._pushItem(list, object, geometry, material, null, true);
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
