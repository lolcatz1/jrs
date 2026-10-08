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

	/** Binds an empty placeholder texture of the sampler's target so a program with an unset sampler stays valid. */
	bindEmpty(u, unit) {
		const gl = this.gl;
		if (this._empty === undefined) this._empty = {};
		const key = u.isShadowSampler ? 'shadow' + u.target : String(u.target);
		let tex = this._empty[key];
		if (tex === undefined) {
			tex = gl.createTexture();
			this.state.bindTexture(u.target, tex, unit);
			const zero = new Uint8Array(4);
			if (u.target === gl.TEXTURE_2D) {
				if (u.isShadowSampler) {
					gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT16, 1, 1);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
				} else {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, zero);
				}
			} else if (u.target === gl.TEXTURE_3D || u.target === gl.TEXTURE_2D_ARRAY) {
				gl.texStorage3D(u.target, 1, gl.RGBA8, 1, 1, 1);
				gl.texSubImage3D(u.target, 0, 0, 0, 0, 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, zero);
			} else if (u.target === gl.TEXTURE_CUBE_MAP) {
				for (let i = 0; i < 6; i++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, zero);
			}
			gl.texParameteri(u.target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(u.target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			this._empty[key] = tex;
			return;
		}
		this.state.bindTexture(u.target, tex, unit);
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
		if (target === gl.TEXTURE_3D || target === gl.TEXTURE_2D_ARRAY) gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.wrapToGL[texture.wrapR !== undefined ? texture.wrapR : texture.wrapS]);
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
			state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot); state.activeTexture(slot);
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
		state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot); state.activeTexture(slot);
		state.setUnpack(texture.flipY, texture.premultiplyAlpha, texture.unpackAlignment);
		const image = texture.image;
		const glFormat = this.glFormat(texture.format);
		const glType = this.glType(texture.type);
		const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace, texture.isVideoTexture);
		const streamed = texture.isDataTexture && texture._stream === true;
		if (!streamed || p.allocated !== true) this._setTextureParameters(gl.TEXTURE_2D, texture);
		const mipmaps = texture.mipmaps;
		const useMipmaps = this._textureNeedsMipmaps(texture);
		if (streamed) {
			// Streamed data (bone matrices): redefine the level with texImage2D on every update. In Chromium a
			// client-data texSubImage2D goes through the command buffer's ring transfer buffer and can stall for
			// seconds once it is driven into chunked mode; texImage2D takes the mapped-memory path and does not
			// (see bench/results/swarm/stall-hunter.md). Same bytes per upload, no stall.
			gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, image.data);
			p.allocated = true; p.width = image.width; p.height = image.height;
		} else if (texture.isDataTexture || texture.isDepthTexture) {
			const levels = useMipmaps ? Math.floor(Math.log2(Math.max(image.width, image.height))) + 1 : 1;
			if (p.allocated !== true || p.width !== image.width || p.height !== image.height) {
				if (p.allocated === true) { gl.deleteTexture(p.webglTexture); p.webglTexture = gl.createTexture(); state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot); state.activeTexture(slot); this._setTextureParameters(gl.TEXTURE_2D, texture); }
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

	/** Binds a Data3DTexture to `slot`, uploading on version change. */
	setTexture3D(texture, slot) { this._setTextureLayered(texture, slot, this.gl.TEXTURE_3D); }
	/** Binds a DataArrayTexture to `slot`, uploading on version change (honours layerUpdates). */
	setTexture2DArray(texture, slot) { this._setTextureLayered(texture, slot, this.gl.TEXTURE_2D_ARRAY); }
	_setTextureLayered(texture, slot, target) {
		const gl = this.gl, state = this.state;
		const p = this.get(texture);
		if (p.webglTexture === undefined) {
			p.webglTexture = gl.createTexture();
			this.info.memory.textures++;
			texture.addEventListener('dispose', this._onTextureDispose);
		}
		state.bindTexture(target, p.webglTexture, slot); state.activeTexture(slot);
		if (p.version === texture.version || texture.image === null) return;
		const image = texture.image;
		state.setUnpack(false, texture.premultiplyAlpha, texture.unpackAlignment);
		const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
		const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
		this._setTextureParameters(target, texture);
		const useMipmaps = this._textureNeedsMipmaps(texture);
		const levels = useMipmaps ? Math.floor(Math.log2(Math.max(image.width, image.height, target === gl.TEXTURE_3D ? image.depth : 1))) + 1 : 1;
		if (p.allocated !== true || p.width !== image.width || p.height !== image.height || p.depth !== image.depth || p.levels !== levels) {
			if (p.allocated === true) { gl.deleteTexture(p.webglTexture); p.webglTexture = gl.createTexture(); state.bindTexture(target, p.webglTexture, slot); state.activeTexture(slot); this._setTextureParameters(target, texture); }
			gl.texStorage3D(target, levels, glInternalFormat, image.width, image.height, image.depth);
			p.allocated = true; p.width = image.width; p.height = image.height; p.depth = image.depth; p.levels = levels;
			p.fullUploadNeeded = true;
		}
		if (image.data !== undefined && image.data !== null) {
			const layerUpdates = texture.layerUpdates;
			if (target === gl.TEXTURE_2D_ARRAY && layerUpdates !== undefined && layerUpdates.size > 0 && p.fullUploadNeeded !== true) {
				const layerBytes = getByteLength(image.width, image.height, texture.format, texture.type);
				for (const layerIndex of layerUpdates) {
					const layerData = image.data.subarray(layerIndex * layerBytes / image.data.BYTES_PER_ELEMENT, (layerIndex + 1) * layerBytes / image.data.BYTES_PER_ELEMENT);
					gl.texSubImage3D(target, 0, 0, 0, layerIndex, image.width, image.height, 1, glFormat, glType, layerData);
				}
				texture.clearLayerUpdates();
			} else {
				gl.texSubImage3D(target, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
			}
			p.fullUploadNeeded = false;
		}
		if (useMipmaps) gl.generateMipmap(target);
		p.version = texture.version;
		if (texture.onUpdate) texture.onUpdate(texture);
	}
	/** Binds a CubeTexture (six images or six DataTexture-like objects) to `slot`. */
	setTextureCube(texture, slot) {
		const gl = this.gl, state = this.state;
		const p = this.get(texture);
		if (p.webglTexture === undefined) {
			p.webglTexture = gl.createTexture();
			this.info.memory.textures++;
			texture.addEventListener('dispose', this._onTextureDispose);
		}
		state.bindTexture(gl.TEXTURE_CUBE_MAP, p.webglTexture, slot); state.activeTexture(slot);
		if (texture.isRenderTargetTexture === true || texture.isCubeDepthTexture === true) return; // storage belongs to the render target
		const images = texture.image;
		if (p.version === texture.version || !Array.isArray(images) || images.length < 6) return;
		for (let i = 0; i < 6; i++) { const im = images[i]; if (!im || (im.complete === false)) return; }
		state.setUnpack(texture.flipY, texture.premultiplyAlpha, texture.unpackAlignment);
		const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
		const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
		this._setTextureParameters(gl.TEXTURE_CUBE_MAP, texture);
		for (let i = 0; i < 6; i++) {
			const im = images[i];
			if (im.isDataTexture || (im.data !== undefined && im.width !== undefined)) {
				const d = im.isDataTexture ? im.image : im;
				gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, d.width, d.height, 0, glFormat, glType, d.data);
			} else {
				gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, glFormat, glType, im);
			}
		}
		if (this._textureNeedsMipmaps(texture)) gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
		p.version = texture.version;
		if (texture.onUpdate) texture.onUpdate(texture);
	}

	/** Sets up (once) and binds a render target's framebuffer. */
	setupRenderTarget(renderTarget) {
		if (renderTarget.isWebGLCubeRenderTarget === true) return this._setupCubeRenderTarget(renderTarget);
		const gl = this.gl, state = this.state;
		const p = this.get(renderTarget);
		const texture = renderTarget.texture;
		const tp = this.get(texture);
		if (p.framebuffer === undefined) {
			renderTarget.addEventListener('dispose', this._onRenderTargetDispose);
			texture.isRenderTargetTexture = true;
			p.framebuffer = gl.createFramebuffer();
			state.bindFramebuffer(p.framebuffer);
			// color (reuse a texture object created earlier by a sampler binding of this texture)
			if (renderTarget.depthOnly !== true) {
				if (tp.webglTexture === undefined) { tp.webglTexture = gl.createTexture(); this.info.memory.textures++; }
				state.bindTexture(gl.TEXTURE_2D, tp.webglTexture, 0); state.activeTexture(0);
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
				if (dp.webglTexture === undefined) { dp.webglTexture = gl.createTexture(); this.info.memory.textures++; }
				else { gl.deleteTexture(dp.webglTexture); dp.webglTexture = gl.createTexture(); } // immutable storage: fresh object
				dt.isRenderTargetTexture = true;
				state.bindTexture(gl.TEXTURE_2D, dp.webglTexture, 0); state.activeTexture(0);
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

	/** Framebuffer plus cube colour / cube depth storage of a WebGLCubeRenderTarget. Faces are attached by attachCubeFace(). */
	_setupCubeRenderTarget(renderTarget) {
		const gl = this.gl, state = this.state;
		const p = this.get(renderTarget);
		if (p.framebuffer !== undefined && p.width === renderTarget.width) return p.framebuffer;
		if (p.framebuffer !== undefined) {
			this._onRenderTargetDispose({ target: renderTarget });
			renderTarget.addEventListener('dispose', this._onRenderTargetDispose);
			return this._setupCubeRenderTarget(renderTarget);
		}
		const size = renderTarget.width;
		renderTarget.addEventListener('dispose', this._onRenderTargetDispose);
		const texture = renderTarget.texture;
		const tp = this.get(texture);
		texture.isRenderTargetTexture = true;
		p.framebuffer = gl.createFramebuffer();
		state.bindFramebuffer(p.framebuffer);
		p.cubeFace = -1;
		if (renderTarget.depthOnly !== true) {
			tp.webglTexture = gl.createTexture(); this.info.memory.textures++;
			state.bindTexture(gl.TEXTURE_CUBE_MAP, tp.webglTexture, 0); state.activeTexture(0);
			this._setTextureParameters(gl.TEXTURE_CUBE_MAP, texture);
			const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
			const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
			for (let i = 0; i < 6; i++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, size, size, 0, glFormat, glType, null);
			tp.version = texture.version;
		} else {
			gl.drawBuffers([gl.NONE]);
			gl.readBuffer(gl.NONE);
		}
		const dt = renderTarget.depthTexture;
		if (dt) {
			const dp = this.get(dt);
			if (dp.webglTexture !== undefined) gl.deleteTexture(dp.webglTexture); else this.info.memory.textures++;
			dp.webglTexture = gl.createTexture();
			dt.isRenderTargetTexture = true;
			state.bindTexture(gl.TEXTURE_CUBE_MAP, dp.webglTexture, 0); state.activeTexture(0);
			this._setTextureParameters(gl.TEXTURE_CUBE_MAP, dt);
			const glInternalFormat = this.glInternalFormat(null, this.glFormat(dt.format), this.glType(dt.type));
			gl.texStorage2D(gl.TEXTURE_CUBE_MAP, 1, glInternalFormat, size, size);
			dp.version = dt.version;
		} else if (renderTarget.depthBuffer) {
			p.depthbuffer = gl.createRenderbuffer();
			gl.bindRenderbuffer(gl.RENDERBUFFER, p.depthbuffer);
			gl.renderbufferStorage(gl.RENDERBUFFER, renderTarget.stencilBuffer ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24, size, size);
			gl.framebufferRenderbuffer(gl.FRAMEBUFFER, renderTarget.stencilBuffer ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, p.depthbuffer);
			gl.bindRenderbuffer(gl.RENDERBUFFER, null);
		}
		p.width = size;
		return p.framebuffer;
	}

	/** Attaches `face` of a cube render target's colour / depth textures to its (currently bound) framebuffer. */
	attachCubeFace(renderTarget, face) {
		const p = this.get(renderTarget);
		if (p.cubeFace === face) return;
		const gl = this.gl;
		const target = gl.TEXTURE_CUBE_MAP_POSITIVE_X + face;
		if (renderTarget.depthOnly !== true) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, target, this.get(renderTarget.texture).webglTexture, 0);
		const dt = renderTarget.depthTexture;
		if (dt) gl.framebufferTexture2D(gl.FRAMEBUFFER, dt.format === DepthStencilFormat ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT, target, this.get(dt).webglTexture, 0);
		if (p.cubeFace === -1) {
			const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
			if (status !== gl.FRAMEBUFFER_COMPLETE) console.error('WebGLTextures: cube render target framebuffer incomplete: 0x' + status.toString(16));
		}
		p.cubeFace = face;
	}

	/** Regenerates mipmaps for a render target texture after rendering to it. */
	updateRenderTargetMipmap(renderTarget) {
		const texture = renderTarget.texture;
		if (this._textureNeedsMipmaps(texture)) {
			const tp = this.get(texture);
			const target = renderTarget.isWebGLCubeRenderTarget === true ? this.gl.TEXTURE_CUBE_MAP : this.gl.TEXTURE_2D;
			this.state.bindTexture(target, tp.webglTexture, 0); this.state.activeTexture(0);
			this.gl.generateMipmap(target);
		}
	}
}

export { WebGLTextures };

function getByteLength(width, height, format, type) {
	const typeBytes = (type === FloatType || type === UnsignedIntType || type === IntType) ? 4 : ((type === HalfFloatType || type === UnsignedShortType || type === ShortType) ? 2 : 1);
	let components = 4;
	switch (format) {
		case RedFormat: case RedIntegerFormat: case AlphaFormat: case LuminanceFormat: case DepthFormat: components = 1; break;
		case RGFormat: case RGIntegerFormat: case LuminanceAlphaFormat: components = 2; break;
		case RGBFormat: components = 3; break;
		default: components = 4;
	}
	return width * height * components * typeBytes;
}
