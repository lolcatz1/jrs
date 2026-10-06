import { EventDispatcher } from '../core/EventDispatcher.js';
import { Texture } from '../textures/Texture.js';
import { LinearFilter, SRGBColorSpace } from '../constants.js';
import { Vector4 } from '../math/Vector4.js';
import { Source } from '../textures/Source.js';

class WebGLRenderTarget extends EventDispatcher {
	constructor(width = 1, height = 1, options = {}) {
		super();
		this.isRenderTarget = true;
		this.isWebGLRenderTarget = true;
		this.width = width; this.height = height; this.depth = 1;
		this.scissor = new Vector4(0, 0, width, height);
		this.scissorTest = false;
		this.viewport = new Vector4(0, 0, width, height);
		const image = { width: width, height: height, depth: 1 };
		options = Object.assign({ generateMipmaps: false, internalFormat: null, minFilter: LinearFilter, depthBuffer: true, stencilBuffer: false, resolveDepthBuffer: true, resolveStencilBuffer: true, depthTexture: null, samples: 0, count: 1, depthOnly: false }, options);
		const texture = new Texture(image, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
		texture.flipY = false;
		texture.generateMipmaps = options.generateMipmaps;
		texture.internalFormat = options.internalFormat;
		texture.renderTarget = this;
		this.texture = texture;
		this.textures = [texture];
		this.depthBuffer = options.depthBuffer;
		this.stencilBuffer = options.stencilBuffer;
		this.resolveDepthBuffer = options.resolveDepthBuffer;
		this.resolveStencilBuffer = options.resolveStencilBuffer;
		this.depthOnly = options.depthOnly;
		this._depthTexture = null;
		this.depthTexture = options.depthTexture;
		this.samples = options.samples;
	}
	set depthTexture(current) {
		if (this._depthTexture !== null) this._depthTexture.renderTarget = null;
		if (current !== null) current.renderTarget = this;
		this._depthTexture = current;
	}
	get depthTexture() { return this._depthTexture; }
	setSize(width, height, depth = 1) {
		if (this.width !== width || this.height !== height || this.depth !== depth) {
			this.width = width; this.height = height; this.depth = depth;
			for (let i = 0, il = this.textures.length; i < il; i++) {
				this.textures[i].image.width = width; this.textures[i].image.height = height; this.textures[i].image.depth = depth;
			}
			if (this.depthTexture) { this.depthTexture.image.width = width; this.depthTexture.image.height = height; }
			this.dispose();
		}
		this.viewport.set(0, 0, width, height);
		this.scissor.set(0, 0, width, height);
	}
	clone() { return new this.constructor().copy(this); }
	copy(source) {
		this.width = source.width; this.height = source.height; this.depth = source.depth;
		this.scissor.copy(source.scissor); this.scissorTest = source.scissorTest; this.viewport.copy(source.viewport);
		this.textures.length = 0;
		for (let i = 0, il = source.textures.length; i < il; i++) {
			this.textures[i] = source.textures[i].clone();
			this.textures[i].isRenderTargetTexture = true;
			this.textures[i].renderTarget = this;
			const image = Object.assign({}, source.textures[i].image);
			this.textures[i].source = new Source(image);
		}
		this.depthBuffer = source.depthBuffer; this.stencilBuffer = source.stencilBuffer;
		this.resolveDepthBuffer = source.resolveDepthBuffer; this.resolveStencilBuffer = source.resolveStencilBuffer;
		if (source.depthTexture !== null) this.depthTexture = source.depthTexture.clone();
		this.samples = source.samples;
		return this;
	}
	dispose() { this.dispatchEvent({ type: 'dispose' }); }
}

export { WebGLRenderTarget };
