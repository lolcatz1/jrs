import { WebGLRenderTarget } from './WebGLRenderTarget.js';
import { CubeTexture } from '../textures/CubeTexture.js';

/** Render target with six faces; select the face to draw with `renderer.setRenderTarget(target, face)`. */
class WebGLCubeRenderTarget extends WebGLRenderTarget {
	constructor(size = 1, options = {}) {
		super(size, size, options);
		this.isWebGLCubeRenderTarget = true;
		const image = { width: size, height: size, depth: 1 };
		const old = this.texture;
		const texture = new CubeTexture([image, image, image, image, image, image], options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
		texture.generateMipmaps = old.generateMipmaps;
		texture.internalFormat = old.internalFormat;
		texture.isRenderTargetTexture = true;
		texture.renderTarget = this;
		this.texture = texture;
		this.textures = [texture];
	}
	setSize(width, height) {
		if (this.width !== width || this.height !== height) {
			this.width = width; this.height = height;
			const image = { width: width, height: height, depth: 1 };
			this.texture.image = [image, image, image, image, image, image];
			if (this.depthTexture) this.depthTexture.image = [image, image, image, image, image, image];
			this.dispose();
		}
		this.viewport.set(0, 0, width, height);
		this.scissor.set(0, 0, width, height);
	}
	/** Clears every face. */
	clear(renderer, color, depth, stencil) {
		const previous = renderer.getRenderTarget();
		for (let i = 0; i < 6; i++) { renderer.setRenderTarget(this, i); renderer.clear(color, depth, stencil); }
		renderer.setRenderTarget(previous);
	}
}

export { WebGLCubeRenderTarget };
