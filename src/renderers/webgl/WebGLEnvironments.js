// Ported from three.js r186 (MIT License, Copyright 2010-2026 three.js authors), adapted to jrs.
import { CubeReflectionMapping, CubeRefractionMapping, EquirectangularReflectionMapping, EquirectangularRefractionMapping } from '../../constants.js';
import { PMREMGenerator } from '../../extras/PMREMGenerator.js';
import { WebGLCubeRenderTarget } from '../WebGLCubeRenderTarget.js';

/**
 * Resolves the texture a material or background actually samples from the one the user assigned:
 * equirectangular textures become cube maps (cube render target of the image height), and the
 * PMREM path (MeshStandardMaterial, scene.environment, blurred backgrounds) turns cube and
 * equirectangular textures into the CubeUV layout produced by PMREMGenerator. Conversions are
 * cached per source texture and redone when `needsPMREMUpdate` bumps the source's pmremVersion
 * (CubeCamera targets). The conversion renders run nested inside the frame that asks for them,
 * so they are bracketed by the renderer's nested-render state save / restore.
 */
class WebGLEnvironments {
	constructor(renderer) {
		this.renderer = renderer;
		this.cubeMaps = new WeakMap();
		this.pmremMaps = new WeakMap();
		this.pmremGenerator = null;
		this._onCubemapDispose = this._onCubemapDispose.bind(this);
		this._onPMREMDispose = this._onPMREMDispose.bind(this);
	}

	/** The texture to sample for `texture`, or null while its image is not ready. */
	get(texture, usePMREM = false) {
		if (texture === null || texture === undefined) return null;
		if (usePMREM) return this._getPMREM(texture);
		return this._getCube(texture);
	}

	_getCube(texture) {
		if (texture && texture.isTexture) {
			const mapping = texture.mapping;
			if (mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping) {
				const cached = this.cubeMaps.get(texture);
				if (cached !== undefined) return mapTextureMapping(cached.texture, texture.mapping);
				const image = texture.image;
				if (image && image.height > 0) {
					const renderer = this.renderer;
					const renderTarget = new WebGLCubeRenderTarget(image.height);
					renderer._beginNestedRender();
					renderTarget.fromEquirectangularTexture(renderer, texture);
					renderer._endNestedRender();
					this.cubeMaps.set(texture, renderTarget);
					texture.addEventListener('dispose', this._onCubemapDispose);
					return mapTextureMapping(renderTarget.texture, texture.mapping);
				}
				return null; // image not yet ready: try the conversion next frame
			}
		}
		return texture;
	}

	_getPMREM(texture) {
		if (texture && texture.isTexture) {
			const mapping = texture.mapping;
			const isEquirectMap = (mapping === EquirectangularReflectionMapping || mapping === EquirectangularRefractionMapping);
			const isCubeMap = (mapping === CubeReflectionMapping || mapping === CubeRefractionMapping);
			if (isEquirectMap || isCubeMap) {
				let renderTarget = this.pmremMaps.get(texture);
				const currentPMREMVersion = renderTarget !== undefined ? renderTarget.texture.pmremVersion : 0;
				if (texture.isRenderTargetTexture && texture.pmremVersion !== currentPMREMVersion) {
					const renderer = this.renderer;
					if (this.pmremGenerator === null) this.pmremGenerator = new PMREMGenerator(renderer);
					renderer._beginNestedRender();
					renderTarget = isEquirectMap ? this.pmremGenerator.fromEquirectangular(texture, renderTarget) : this.pmremGenerator.fromCubemap(texture, renderTarget);
					renderer._endNestedRender();
					renderTarget.texture.pmremVersion = texture.pmremVersion;
					this.pmremMaps.set(texture, renderTarget);
					return renderTarget.texture;
				}
				if (renderTarget !== undefined) return renderTarget.texture;
				const image = texture.image;
				if ((isEquirectMap && image && image.height > 0) || (isCubeMap && image && isCubeTextureComplete(image))) {
					const renderer = this.renderer;
					if (this.pmremGenerator === null) this.pmremGenerator = new PMREMGenerator(renderer);
					renderer._beginNestedRender();
					renderTarget = isEquirectMap ? this.pmremGenerator.fromEquirectangular(texture) : this.pmremGenerator.fromCubemap(texture);
					renderer._endNestedRender();
					renderTarget.texture.pmremVersion = texture.pmremVersion;
					this.pmremMaps.set(texture, renderTarget);
					texture.addEventListener('dispose', this._onPMREMDispose);
					return renderTarget.texture;
				}
				return null; // image not yet ready
			}
		}
		return texture;
	}

	_onCubemapDispose(event) {
		const texture = event.target;
		texture.removeEventListener('dispose', this._onCubemapDispose);
		const cubemap = this.cubeMaps.get(texture);
		if (cubemap !== undefined) { this.cubeMaps.delete(texture); cubemap.dispose(); }
	}
	_onPMREMDispose(event) {
		const texture = event.target;
		texture.removeEventListener('dispose', this._onPMREMDispose);
		const pmrem = this.pmremMaps.get(texture);
		if (pmrem !== undefined) { this.pmremMaps.delete(texture); pmrem.dispose(); }
	}
	dispose() {
		this.cubeMaps = new WeakMap();
		this.pmremMaps = new WeakMap();
		if (this.pmremGenerator !== null) { this.pmremGenerator.dispose(); this.pmremGenerator = null; }
	}
}

function mapTextureMapping(texture, mapping) {
	if (mapping === EquirectangularReflectionMapping) texture.mapping = CubeReflectionMapping;
	else if (mapping === EquirectangularRefractionMapping) texture.mapping = CubeRefractionMapping;
	return texture;
}
function isCubeTextureComplete(image) {
	let count = 0;
	for (let i = 0; i < 6; i++) if (image[i] !== undefined) count++;
	return count === 6;
}

export { WebGLEnvironments };
