import {
	LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, NearestFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter,
	RGBAFormat, RGBFormat, RedFormat, RGFormat, AlphaFormat, LuminanceFormat, LuminanceAlphaFormat, DepthFormat, DepthStencilFormat,
	RedIntegerFormat, RGIntegerFormat, RGBAIntegerFormat,
	UnsignedByteType, FloatType, HalfFloatType, UnsignedShortType, UnsignedIntType, UnsignedInt248Type, ByteType, ShortType, IntType,
	UnsignedShort4444Type, UnsignedShort5551Type,
	RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, SRGBColorSpace,
	NeverStencilFunc, LessStencilFunc, EqualStencilFunc, LessEqualStencilFunc, GreaterStencilFunc, NotEqualStencilFunc, GreaterEqualStencilFunc, AlwaysStencilFunc
} from '../../constants.js';

/**
 * Texture upload and render target management.
 */
class WebGLTextures {
	constructor(gl, state, info) {
		this.gl = gl;
		this.state = state;
		this.info = info;
		this.properties = new WeakMap();
		this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		this.anisotropyExt = gl.getExtension('EXT_texture_filter_anisotropic');
		this.maxAnisotropy = this.anisotropyExt ? gl.getParameter(this.anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
		this.floatLinearExt = gl.getExtension('OES_texture_float_linear');
		this.colorBufferFloatExt = gl.getExtension('EXT_color_buffer_float');
		this._onTextureDispose = this._onTextureDispose.bind(this);
		this._onRenderTargetDispose = this._onRenderTargetDispose.bind(this);
		this.wrapToGL = { [RepeatWrapping]: gl.REPEAT, [ClampToEdgeWrapping]: gl.CLAMP_TO_EDGE, [MirroredRepeatWrapping]: gl.MIRRORED_REPEAT };
		this.filterToGL = {
			[NearestFilter]: gl.NEAREST, [NearestMipmapNearestFilter]: gl.NEAREST_MIPMAP_NEAREST, [NearestMipmapLinearFilter]: gl.NEAREST_MIPMAP_LINEAR,
			[LinearFilter]: gl.LINEAR, [LinearMipmapNearestFilter]: gl.LINEAR_MIPMAP_NEAREST, [LinearMipmapLinearFilter]: gl.LINEAR_MIPMAP_LINEAR
		};
		this.compareToGL = {
			[NeverStencilFunc]: gl.NEVER, [LessStencilFunc]: gl.LESS, [EqualStencilFunc]: gl.EQUAL, [LessEqualStencilFunc]: gl.LEQUAL,
			[GreaterStencilFunc]: gl.GREATER, [NotEqualStencilFunc]: gl.NOTEQUAL, [GreaterEqualStencilFunc]: gl.GEQUAL, [AlwaysStencilFunc]: gl.ALWAYS
		};
	}

	get(obj) {
		let p = this.properties.get(obj);
		if (p === undefined) { p = {}; this.properties.set(obj, p); }
		return p;
	}

	_onTextureDispose(event) {
		const texture = event.target;
		texture.removeEventListener('dispose', this._onTextureDispose);
		const p = this.properties.get(texture);
		if (p !== undefined && p.webglTexture !== undefined) {
			this.gl.deleteTexture(p.webglTexture);
			this.info.memory.textures--;
		}
		this.properties.delete(texture);
	}
	_onRenderTargetDispose(event) {
		const renderTarget = event.target;
		renderTarget.removeEventListener('dispose', this._onRenderTargetDispose);
		const p = this.properties.get(renderTarget);
		if (p !== undefined) {
			if (p.framebuffer) this.gl.deleteFramebuffer(p.framebuffer);
			if (p.depthbuffer) this.gl.deleteRenderbuffer(p.depthbuffer);
		}
		const tp = this.properties.get(renderTarget.texture);
		if (tp !== undefined && tp.webglTexture !== undefined) { this.gl.deleteTexture(tp.webglTexture); this.info.memory.textures--; }
		if (renderTarget.depthTexture) {
			const dp = this.properties.get(renderTarget.depthTexture);
			if (dp !== undefined && dp.webglTexture !== undefined) { this.gl.deleteTexture(dp.webglTexture); this.info.memory.textures--; }
			this.properties.delete(renderTarget.depthTexture);
		}
		this.properties.delete(renderTarget.texture);
		this.properties.delete(renderTarget);
	}

	glType(type) {
		const gl = this.gl;
		switch (type) {
			case UnsignedByteType: return gl.UNSIGNED_BYTE;
			case ByteType: return gl.BYTE;
			case ShortType: return gl.SHORT;
			case UnsignedShortType: return gl.UNSIGNED_SHORT;
			case IntType: return gl.INT;
			case UnsignedIntType: return gl.UNSIGNED_INT;
			case FloatType: return gl.FLOAT;
			case HalfFloatType: return gl.HALF_FLOAT;
			case UnsignedShort4444Type: return gl.UNSIGNED_SHORT_4_4_4_4;
			case UnsignedShort5551Type: return gl.UNSIGNED_SHORT_5_5_5_1;
			case UnsignedInt248Type: return gl.UNSIGNED_INT_24_8;
			default: return gl.UNSIGNED_BYTE;
		}
	}
	glFormat(format) {
		const gl = this.gl;
		switch (format) {
			case RGBAFormat: return gl.RGBA;
			case RGBFormat: return gl.RGB;
			case RedFormat: return gl.RED;
			case RGFormat: return gl.RG;
			case AlphaFormat: return gl.ALPHA;
			case LuminanceFormat: return gl.LUMINANCE;
			case LuminanceAlphaFormat: return gl.LUMINANCE_ALPHA;
			case DepthFormat: return gl.DEPTH_COMPONENT;
			case DepthStencilFormat: return gl.DEPTH_STENCIL;
			case RedIntegerFormat: return gl.RED_INTEGER;
			case RGIntegerFormat: return gl.RG_INTEGER;
			case RGBAIntegerFormat: return gl.RGBA_INTEGER;
			default: return gl.RGBA;
		}
	}
	glInternalFormat(internalFormatName, glFormat, glType, colorSpace, forceLinearTransfer = false) {
		const gl = this.gl;
		if (internalFormatName !== null) {
			if (gl[internalFormatName] !== undefined) return gl[internalFormatName];
			console.warn('WebGLTextures: Attempt to use non-existing WebGL internal format \'' + internalFormatName + '\'');
		}
		let internalFormat = glFormat;
		if (glFormat === gl.RED) {
			if (glType === gl.FLOAT) internalFormat = gl.R32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.R16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8;
		}
		if (glFormat === gl.RED_INTEGER) {
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8UI;
			if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.R16UI;
			if (glType === gl.UNSIGNED_INT) internalFormat = gl.R32UI;
			if (glType === gl.BYTE) internalFormat = gl.R8I;
			if (glType === gl.SHORT) internalFormat = gl.R16I;
			if (glType === gl.INT) internalFormat = gl.R32I;
		}
		if (glFormat === gl.RG) {
			if (glType === gl.FLOAT) internalFormat = gl.RG32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.RG16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RG8;
		}
		if (glFormat === gl.RGB) {
			if (glType === gl.FLOAT) internalFormat = gl.RGB32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.RGB16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = (colorSpace === SRGBColorSpace && forceLinearTransfer === false) ? gl.SRGB8 : gl.RGB8;
		}
		if (glFormat === gl.RGBA) {
			if (glType === gl.FLOAT) internalFormat = gl.RGBA32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.RGBA16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = (colorSpace === SRGBColorSpace && forceLinearTransfer === false) ? gl.SRGB8_ALPHA8 : gl.RGBA8;
			if (glType === gl.UNSIGNED_SHORT_4_4_4_4) internalFormat = gl.RGBA4;
			if (glType === gl.UNSIGNED_SHORT_5_5_5_1) internalFormat = gl.RGB5_A1;
		}
		if (glFormat === gl.DEPTH_COMPONENT) {
			if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.DEPTH_COMPONENT16;
			if (glType === gl.UNSIGNED_INT) internalFormat = gl.DEPTH_COMPONENT24;
			if (glType === gl.FLOAT) internalFormat = gl.DEPTH_COMPONENT32F;
		}
		if (glFormat === gl.DEPTH_STENCIL) {
			if (glType === gl.UNSIGNED_INT_24_8) internalFormat = gl.DEPTH24_STENCIL8;
		}
		return internalFormat;
	}

	_textureNeedsMipmaps(texture) {
		return texture.generateMipmaps && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
	}

	_setTextureParameters(target, texture) {
		const gl = this.gl;
		gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.wrapToGL[texture.wrapS]);
		gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.wrapToGL[texture.wrapT]);
		gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.filterToGL[texture.magFilter]);
		gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.filterToGL[texture.minFilter]);
		if (texture.compareFunction) {
			gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
			gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.compareToGL[texture.compareFunction]);
		}
		if (this.anisotropyExt && texture.anisotropy > 1) {
			if (texture.type === FloatType && this.floatLinearExt === null) return;
			gl.texParameterf(target, this.anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, this.maxAnisotropy));
		}
	}

	/** Binds `texture` to texture unit `slot`, uploading it first if needed. */
	setTexture2D(texture, slot) {
		const gl = this.gl, state = this.state;
		const p = this.get(texture);
		if (texture.isRenderTargetTexture === false && texture.version > 0 && p.version !== texture.version) {
			const image = texture.image;
			if (image === null) {
				console.warn('WebGLTextures: Texture marked for update but no image data found.');
			} else if (image.complete === false) {
				console.warn('WebGLTextures: Texture marked for update but image is incomplete');
			} else {
				this._uploadTexture(p, texture, slot);
				return;
			}
		}
		if (p.webglTexture === undefined) {
			// not yet uploaded and nothing to upload: bind a 1x1 white placeholder
			p.webglTexture = gl.createTexture();
			this.info.memory.textures++;
			texture.addEventListener('dispose', this._onTextureDispose);
			state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			return;
		}
		state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
	}

	_uploadTexture(p, texture, slot) {
		const gl = this.gl, state = this.state;
		if (p.webglTexture === undefined) {
			p.webglTexture = gl.createTexture();
			this.info.memory.textures++;
			texture.addEventListener('dispose', this._onTextureDispose);
		}
		state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
		const image = texture.image;
		const glFormat = this.glFormat(texture.format);
		const glType = this.glType(texture.type);
		const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace, texture.isVideoTexture);
		this._setTextureParameters(gl.TEXTURE_2D, texture);
		const mipmaps = texture.mipmaps;
		const useMipmaps = this._textureNeedsMipmaps(texture);
		if (texture.isDataTexture || texture.isDepthTexture) {
			const levels = useMipmaps ? Math.floor(Math.log2(Math.max(image.width, image.height))) + 1 : 1;
			if (p.allocated !== true || p.width !== image.width || p.height !== image.height) {
				if (p.allocated === true) { gl.deleteTexture(p.webglTexture); p.webglTexture = gl.createTexture(); state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot); this._setTextureParameters(gl.TEXTURE_2D, texture); }
				gl.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
				p.allocated = true; p.width = image.width; p.height = image.height;
			}
			if (image.data !== undefined && image.data !== null) {
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
			}
			if (useMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
		} else {
			const w = image.width !== undefined ? image.width : image.videoWidth, h = image.height !== undefined ? image.height : image.videoHeight;
			if (mipmaps.length > 0) {
				for (let i = 0, il = mipmaps.length; i < il; i++) {
					const mipmap = mipmaps[i];
					gl.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
				}
				texture.generateMipmaps = false;
			} else if (p.allocated === true && p.width === w && p.height === h && texture.isVideoTexture) {
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
			} else {
				gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
				p.allocated = true; p.width = w; p.height = h;
			}
			if (useMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
		}
		p.version = texture.version;
		if (texture.onUpdate) texture.onUpdate(texture);
	}

	/** Sets up (once) and binds a render target's framebuffer. */
	setupRenderTarget(renderTarget) {
		const gl = this.gl, state = this.state;
		const p = this.get(renderTarget);
		const texture = renderTarget.texture;
		const tp = this.get(texture);
		if (p.framebuffer === undefined) {
			renderTarget.addEventListener('dispose', this._onRenderTargetDispose);
			texture.isRenderTargetTexture = true;
			p.framebuffer = gl.createFramebuffer();
			state.bindFramebuffer(p.framebuffer);
			// color
			if (renderTarget.depthOnly !== true) {
				tp.webglTexture = gl.createTexture();
				this.info.memory.textures++;
				state.bindTexture(gl.TEXTURE_2D, tp.webglTexture, 0);
				this._setTextureParameters(gl.TEXTURE_2D, texture);
				const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
				const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
				gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, renderTarget.width, renderTarget.height, 0, glFormat, glType, null);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tp.webglTexture, 0);
				tp.version = texture.version;
			} else {
				gl.drawBuffers([gl.NONE]);
				gl.readBuffer(gl.NONE);
			}
			// depth
			if (renderTarget.depthTexture) {
				const dt = renderTarget.depthTexture;
				const dp = this.get(dt);
				dp.webglTexture = gl.createTexture();
				this.info.memory.textures++;
				dt.isRenderTargetTexture = true;
				state.bindTexture(gl.TEXTURE_2D, dp.webglTexture, 0);
				this._setTextureParameters(gl.TEXTURE_2D, dt);
				const glFormat = this.glFormat(dt.format), glType = this.glType(dt.type);
				const glInternalFormat = this.glInternalFormat(null, glFormat, glType);
				gl.texStorage2D(gl.TEXTURE_2D, 1, glInternalFormat, renderTarget.width, renderTarget.height);
				const attachment = dt.format === DepthStencilFormat ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
				gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, dp.webglTexture, 0);
				dp.version = dt.version;
			} else if (renderTarget.depthBuffer) {
				p.depthbuffer = gl.createRenderbuffer();
				gl.bindRenderbuffer(gl.RENDERBUFFER, p.depthbuffer);
				if (renderTarget.stencilBuffer) {
					gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, renderTarget.width, renderTarget.height);
					gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, p.depthbuffer);
				} else {
					gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, renderTarget.width, renderTarget.height);
					gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, p.depthbuffer);
				}
				gl.bindRenderbuffer(gl.RENDERBUFFER, null);
			}
			const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			if (status !== gl.FRAMEBUFFER_COMPLETE) console.error('WebGLTextures: render target framebuffer incomplete: 0x' + status.toString(16));
			p.width = renderTarget.width; p.height = renderTarget.height;
		} else if (p.width !== renderTarget.width || p.height !== renderTarget.height) {
			// resized: tear down and rebuild
			this._onRenderTargetDispose({ target: renderTarget });
			renderTarget.addEventListener('dispose', this._onRenderTargetDispose);
			return this.setupRenderTarget(renderTarget);
		}
		return p.framebuffer;
	}

	/** Regenerates mipmaps for a render target texture after rendering to it. */
	updateRenderTargetMipmap(renderTarget) {
		const texture = renderTarget.texture;
		if (this._textureNeedsMipmaps(texture)) {
			const tp = this.get(texture);
			this.state.bindTexture(this.gl.TEXTURE_2D, tp.webglTexture, 0);
			this.gl.generateMipmap(this.gl.TEXTURE_2D);
		}
	}
}

export { WebGLTextures };
