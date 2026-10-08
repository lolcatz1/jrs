import {
	LinearFilter, LinearMipmapLinearFilter, LinearMipmapNearestFilter, NearestFilter, NearestMipmapLinearFilter, NearestMipmapNearestFilter,
	RGBAFormat, DepthFormat, DepthStencilFormat,
	UnsignedByteType, FloatType, UnsignedIntType, UnsignedShortType, UnsignedInt248Type,
	RepeatWrapping, ClampToEdgeWrapping, MirroredRepeatWrapping, SRGBColorSpace, LinearSRGBColorSpace, NoColorSpace, SRGBTransfer, LinearTransfer,
	NeverCompare, AlwaysCompare, LessCompare, LessEqualCompare, EqualCompare, GreaterEqualCompare, GreaterCompare, NotEqualCompare
} from '../../constants.js';
import { ColorManagement } from '../../math/ColorManagement.js';
import { getByteLength } from '../../extras/TextureUtils.js';
import { WebGLUtils } from './WebGLUtils.js';

/** DataTextures with at least this many bytes of client data are uploaded with texImage2D (see _uploadTexture). */
const LARGE_UPLOAD_BYTES = 256 * 1024;

/**
 * Texture upload and render target management.
 *
 * The texture half (format tables, GL texture sharing between textures that use the same Source, storage allocation,
 * upload paths per texture class, parameters) follows three.js r186's WebGLTextures so that the same texture setup
 * produces the same GL objects, GL errors and pixels. Differences are marked "jrs:" below.
 */
class WebGLTextures {
	constructor(gl, state, info) {
		this.gl = gl;
		this.state = state;
		this.info = info;
		this.properties = new WeakMap();
		this._sources = new WeakMap(); // Source -> { [cacheKey]: { texture: WebGLTexture, usedTimes } }
		this._videoTextures = new WeakMap();
		this._extCache = {};
		this.extensions = { get: (name) => this._ext(name), has: (name) => this._ext(name) !== null };
		this.utils = WebGLUtils(gl, this.extensions);
		this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
		this.maxCubemapSize = gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE);
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
			[NeverCompare]: gl.NEVER, [AlwaysCompare]: gl.ALWAYS, [LessCompare]: gl.LESS, [LessEqualCompare]: gl.LEQUAL,
			[EqualCompare]: gl.EQUAL, [GreaterEqualCompare]: gl.GEQUAL, [GreaterCompare]: gl.GREATER, [NotEqualCompare]: gl.NOTEQUAL
		};
		this._canvas = null;
		this._imageDimensions = { width: 0, height: 0 };
	}

	_ext(name) {
		const cache = this._extCache;
		if (cache[name] === undefined) cache[name] = this.gl.getExtension(name);
		return cache[name];
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

	// ------------------------------------------------------------------ disposal

	_onTextureDispose(event) {
		const texture = event.target;
		texture.removeEventListener('dispose', this._onTextureDispose);
		this._deallocateTexture(texture);
		if (texture.isVideoTexture) this._videoTextures.delete(texture);
	}
	_deallocateTexture(texture) {
		const p = this.properties.get(texture);
		if (p === undefined || p.init === undefined) return;
		// the WebGLTexture object is only deleted when no texture that shares the Source (and parameters) uses it any more
		const source = texture.source;
		const webglTextures = this._sources.get(source);
		if (webglTextures) {
			const webglTexture = webglTextures[p.cacheKey];
			webglTexture.usedTimes--;
			if (webglTexture.usedTimes === 0) this._deleteTexture(texture);
			if (Object.keys(webglTextures).length === 0) this._sources.delete(source);
		}
		this.properties.delete(texture);
	}
	_deleteTexture(texture) {
		const p = this.properties.get(texture);
		this.gl.deleteTexture(p.webglTexture);
		const webglTextures = this._sources.get(texture.source);
		delete webglTextures[p.cacheKey];
		this.info.memory.textures--;
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

	// ------------------------------------------------------------------ formats

	/** three.js `utils.convert`: texture format / type constant (and colour space for compressed formats) -> GL enum, or null. */
	convert(p, colorSpace = NoColorSpace) { return this.utils.convert(p, colorSpace); }
	glType(type) { return this.utils.convert(type); }
	glFormat(format, colorSpace = NoColorSpace) { return this.utils.convert(format, colorSpace); }

	glInternalFormat(internalFormatName, glFormat, glType, normalized, colorSpace, forceLinearTransfer = false) {
		const gl = this.gl;
		if (internalFormatName !== null) {
			if (gl[internalFormatName] !== undefined) return gl[internalFormatName];
			console.warn('WebGLRenderer: Attempt to use non-existing WebGL internal format \'' + internalFormatName + '\'');
		}
		let ext_texture_norm16;
		if (normalized) {
			ext_texture_norm16 = this.extensions.get('EXT_texture_norm16');
			if (!ext_texture_norm16) console.warn('WebGLRenderer: Unable to use normalized textures without EXT_texture_norm16 extension');
		}
		let internalFormat = glFormat;
		if (glFormat === gl.RED) {
			if (glType === gl.FLOAT) internalFormat = gl.R32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.R16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8;
			if (glType === gl.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.R16_EXT;
			if (glType === gl.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.R16_SNORM_EXT;
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
			if (glType === gl.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RG16_EXT;
			if (glType === gl.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RG16_SNORM_EXT;
		}
		if (glFormat === gl.RG_INTEGER) {
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RG8UI;
			if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.RG16UI;
			if (glType === gl.UNSIGNED_INT) internalFormat = gl.RG32UI;
			if (glType === gl.BYTE) internalFormat = gl.RG8I;
			if (glType === gl.SHORT) internalFormat = gl.RG16I;
			if (glType === gl.INT) internalFormat = gl.RG32I;
		}
		if (glFormat === gl.RGB_INTEGER) {
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RGB8UI;
			if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.RGB16UI;
			if (glType === gl.UNSIGNED_INT) internalFormat = gl.RGB32UI;
			if (glType === gl.BYTE) internalFormat = gl.RGB8I;
			if (glType === gl.SHORT) internalFormat = gl.RGB16I;
			if (glType === gl.INT) internalFormat = gl.RGB32I;
		}
		if (glFormat === gl.RGBA_INTEGER) {
			if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RGBA8UI;
			if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.RGBA16UI;
			if (glType === gl.UNSIGNED_INT) internalFormat = gl.RGBA32UI;
			if (glType === gl.BYTE) internalFormat = gl.RGBA8I;
			if (glType === gl.SHORT) internalFormat = gl.RGBA16I;
			if (glType === gl.INT) internalFormat = gl.RGBA32I;
		}
		if (glFormat === gl.RGB) {
			if (glType === gl.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGB16_EXT;
			if (glType === gl.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGB16_SNORM_EXT;
			if (glType === gl.UNSIGNED_INT_5_9_9_9_REV) internalFormat = gl.RGB9_E5;
			if (glType === gl.UNSIGNED_INT_10F_11F_11F_REV) internalFormat = gl.R11F_G11F_B10F;
		}
		if (glFormat === gl.RGBA) {
			const transfer = forceLinearTransfer ? LinearTransfer : ColorManagement.getTransfer(colorSpace);
			if (glType === gl.FLOAT) internalFormat = gl.RGBA32F;
			if (glType === gl.HALF_FLOAT) internalFormat = gl.RGBA16F;
			if (glType === gl.UNSIGNED_BYTE) internalFormat = (transfer === SRGBTransfer) ? gl.SRGB8_ALPHA8 : gl.RGBA8;
			if (glType === gl.UNSIGNED_SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGBA16_EXT;
			if (glType === gl.SHORT && ext_texture_norm16) internalFormat = ext_texture_norm16.RGBA16_SNORM_EXT;
			if (glType === gl.UNSIGNED_SHORT_4_4_4_4) internalFormat = gl.RGBA4;
			if (glType === gl.UNSIGNED_SHORT_5_5_5_1) internalFormat = gl.RGB5_A1;
		}
		if (internalFormat === gl.R16F || internalFormat === gl.R32F || internalFormat === gl.RG16F || internalFormat === gl.RG32F ||
			internalFormat === gl.RGBA16F || internalFormat === gl.RGBA32F) {
			this.extensions.get('EXT_color_buffer_float');
		}
		return internalFormat;
	}

	glInternalDepthFormat(useStencil, depthType) {
		const gl = this.gl;
		let glInternalFormat;
		if (useStencil) {
			if (depthType === null || depthType === UnsignedIntType || depthType === UnsignedInt248Type) glInternalFormat = gl.DEPTH24_STENCIL8;
			else if (depthType === FloatType) glInternalFormat = gl.DEPTH32F_STENCIL8;
			else if (depthType === UnsignedShortType) {
				glInternalFormat = gl.DEPTH24_STENCIL8;
				console.warn('DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.');
			}
		} else {
			if (depthType === null || depthType === UnsignedIntType || depthType === UnsignedInt248Type) glInternalFormat = gl.DEPTH_COMPONENT24;
			else if (depthType === FloatType) glInternalFormat = gl.DEPTH_COMPONENT32F;
			else if (depthType === UnsignedShortType) glInternalFormat = gl.DEPTH_COMPONENT16;
		}
		return glInternalFormat;
	}

	_getMipLevels(texture, image) {
		if (texture.generateMipmaps === true || (texture.isFramebufferTexture && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter)) {
			return Math.floor(Math.log2(Math.max(image.width, image.height))) + 1;
		} else if (texture.mipmaps !== undefined && texture.mipmaps.length > 0) {
			return texture.mipmaps.length; // user-defined mipmaps
		} else if (texture.isCompressedTexture && Array.isArray(texture.image)) {
			return image.mipmaps.length;
		}
		return 1; // base level only
	}

	_textureNeedsMipmaps(texture) { return texture.generateMipmaps; }

	// ------------------------------------------------------------------ parameters

	_setTextureParameters(target, texture) {
		const gl = this.gl;
		if (texture.type === FloatType && this.floatLinearExt === null &&
			(texture.magFilter === LinearFilter || texture.magFilter === LinearMipmapNearestFilter || texture.magFilter === NearestMipmapLinearFilter || texture.magFilter === LinearMipmapLinearFilter ||
			texture.minFilter === LinearFilter || texture.minFilter === LinearMipmapNearestFilter || texture.minFilter === NearestMipmapLinearFilter || texture.minFilter === LinearMipmapLinearFilter)) {
			console.warn('WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.');
		}
		gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.wrapToGL[texture.wrapS]);
		gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.wrapToGL[texture.wrapT]);
		if (target === gl.TEXTURE_3D || target === gl.TEXTURE_2D_ARRAY) gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.wrapToGL[texture.wrapR]);
		gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.filterToGL[texture.magFilter]);
		gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.filterToGL[texture.minFilter]);
		if (texture.compareFunction) {
			gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
			gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.compareToGL[texture.compareFunction]);
		}
		if (this.anisotropyExt !== null) {
			if (texture.magFilter === NearestFilter) return;
			if (texture.minFilter !== NearestMipmapLinearFilter && texture.minFilter !== LinearMipmapLinearFilter) return;
			if (texture.type === FloatType && this.floatLinearExt === null) return; // verify extension
			const p = this.get(texture);
			if (texture.anisotropy > 1 || p.currentAnisotropy) {
				gl.texParameterf(target, this.anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, this.maxAnisotropy));
				p.currentAnisotropy = texture.anisotropy;
			}
		}
	}

	// ------------------------------------------------------------------ binding

	/** Binds `texture` to texture unit `slot`, uploading it first if needed. */
	setTexture2D(texture, slot) {
		const p = this.get(texture);
		if (texture.isVideoTexture === true) this._updateVideoTexture(texture);
		if (texture.isRenderTargetTexture === false && texture.version > 0 && p.version !== texture.version) {
			const image = texture.image;
			if (image === null) {
				console.warn('WebGLRenderer: Texture marked for update but no image data found.');
			} else if (image.complete === false) {
				console.warn('WebGLRenderer: Texture marked for update but image is incomplete');
			} else {
				this._uploadTexture(p, texture, slot);
				return;
			}
		}
		// not yet uploaded: bind nothing (samples as black), like three.js
		this.state.bindTexture(this.gl.TEXTURE_2D, p.webglTexture === undefined ? null : p.webglTexture, slot);
	}
	/** Binds a Data3DTexture to `slot`, uploading on version change. */
	setTexture3D(texture, slot) {
		const p = this.get(texture);
		if (texture.isRenderTargetTexture === false && texture.version > 0 && p.version !== texture.version) { this._uploadTexture(p, texture, slot); return; }
		this.state.bindTexture(this.gl.TEXTURE_3D, p.webglTexture === undefined ? null : p.webglTexture, slot);
	}
	/** Binds a DataArrayTexture / CompressedArrayTexture to `slot`, uploading on version change (honours layerUpdates). */
	setTexture2DArray(texture, slot) {
		const p = this.get(texture);
		if (texture.isRenderTargetTexture === false && texture.version > 0 && p.version !== texture.version) { this._uploadTexture(p, texture, slot); return; }
		this.state.bindTexture(this.gl.TEXTURE_2D_ARRAY, p.webglTexture === undefined ? null : p.webglTexture, slot);
	}
	/** Binds a CubeTexture (six images or six DataTexture-like objects) / CompressedCubeTexture to `slot`. */
	setTextureCube(texture, slot) {
		const p = this.get(texture);
		if (texture.isCubeDepthTexture !== true && texture.isRenderTargetTexture !== true && texture.version > 0 && p.version !== texture.version) { this._uploadCubeTexture(p, texture, slot); return; }
		this.state.bindTexture(this.gl.TEXTURE_CUBE_MAP, p.webglTexture === undefined ? null : p.webglTexture, slot);
	}

	_updateVideoTexture(texture) {
		const frame = this.info.render.frame;
		// update a VideoTexture at most once per rendered frame
		if (this._videoTextures.get(texture) !== frame) { this._videoTextures.set(texture, frame); texture.update(); }
	}

	// ------------------------------------------------------------------ images

	_getDimensions(image) {
		const d = this._imageDimensions;
		if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
			d.width = image.naturalWidth || image.width; d.height = image.naturalHeight || image.height;
		} else if (typeof VideoFrame !== 'undefined' && image instanceof VideoFrame) {
			d.width = image.displayWidth; d.height = image.displayHeight;
		} else {
			d.width = image.width; d.height = image.height;
		}
		return d;
	}

	_createCanvas(width, height) {
		if (typeof OffscreenCanvas !== 'undefined') { try { const c = new OffscreenCanvas(width, height); if (c.getContext('2d') !== null) return c; } catch (e) { /* fall through */ } }
		return document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
	}

	/** Scales images that exceed `maxSize` down on a 2D canvas (three.js resizeImage). */
	_resizeImage(image, needsNewCanvas, maxSize) {
		let scale = 1;
		const dimensions = this._getDimensions(image);
		if (dimensions.width > maxSize || dimensions.height > maxSize) scale = maxSize / Math.max(dimensions.width, dimensions.height);
		if (scale < 1) {
			if ((typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) ||
				(typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
				(typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) ||
				(typeof VideoFrame !== 'undefined' && image instanceof VideoFrame)) {
				const width = Math.floor(scale * dimensions.width), height = Math.floor(scale * dimensions.height);
				if (this._canvas === null) this._canvas = this._createCanvas(width, height);
				const canvas = needsNewCanvas ? this._createCanvas(width, height) : this._canvas; // cube textures can't reuse the same canvas
				canvas.width = width; canvas.height = height;
				canvas.getContext('2d').drawImage(image, 0, 0, width, height);
				console.warn('WebGLRenderer: Texture has been resized from (' + dimensions.width + 'x' + dimensions.height + ') to (' + width + 'x' + height + ').');
				return canvas;
			}
			if ('data' in image) console.warn('WebGLRenderer: Image in DataTexture is too big (' + dimensions.width + 'x' + dimensions.height + ').');
		}
		return image;
	}

	_verifyColorSpace(texture, image) {
		const colorSpace = texture.colorSpace, format = texture.format, type = texture.type;
		if (texture.isCompressedTexture === true || texture.isVideoTexture === true) return image;
		if (colorSpace !== LinearSRGBColorSpace && colorSpace !== NoColorSpace) {
			if (ColorManagement.getTransfer(colorSpace) === SRGBTransfer) {
				// in WebGL 2 uncompressed textures can only be sRGB encoded if they have the RGBA8 format
				if (format !== RGBAFormat || type !== UnsignedByteType) console.warn('WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.');
			} else {
				console.error('WebGLTextures: Unsupported texture color space:', colorSpace);
			}
		}
		return image;
	}

	// ------------------------------------------------------------------ GL texture objects shared between textures with the same Source

	_getTextureCacheKey(texture) {
		return texture.wrapS + ',' + texture.wrapT + ',' + (texture.wrapR || 0) + ',' + texture.magFilter + ',' + texture.minFilter + ',' + texture.anisotropy + ',' +
			texture.internalFormat + ',' + texture.format + ',' + texture.type + ',' + texture.generateMipmaps + ',' + texture.premultiplyAlpha + ',' +
			texture.flipY + ',' + texture.unpackAlignment + ',' + texture.colorSpace;
	}

	/** Returns true when a new GL texture object was created and a full upload is therefore required. */
	_initTexture(p, texture) {
		let forceUpload = false;
		if (p.init === undefined) {
			p.init = true;
			texture.addEventListener('dispose', this._onTextureDispose);
		}
		const source = texture.source;
		let webglTextures = this._sources.get(source);
		if (webglTextures === undefined) { webglTextures = {}; this._sources.set(source, webglTextures); }
		const textureCacheKey = this._getTextureCacheKey(texture);
		if (textureCacheKey !== p.cacheKey) {
			if (webglTextures[textureCacheKey] === undefined) {
				webglTextures[textureCacheKey] = { texture: this.gl.createTexture(), usedTimes: 0 };
				this.info.memory.textures++;
				forceUpload = true; // a new GL texture needs its content even if the image is unchanged
			}
			webglTextures[textureCacheKey].usedTimes++;
			// when the key changed, the old GL texture may no longer be used by anyone
			const webglTexture = webglTextures[p.cacheKey];
			if (webglTexture !== undefined) {
				webglTextures[p.cacheKey].usedTimes--;
				if (webglTexture.usedTimes === 0) this._deleteTexture(texture);
			}
			p.cacheKey = textureCacheKey;
			p.webglTexture = webglTextures[textureCacheKey].texture;
		}
		return forceUpload;
	}

	// ------------------------------------------------------------------ uploads

	_updateTexture(texture, image, glFormat, glType) {
		const gl = this.gl, state = this.state;
		const componentStride = 4; // only RGBA supported
		const updateRanges = texture.updateRanges;
		if (updateRanges.length === 0) {
			state.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
			return;
		}
		// merge adjacent / overlapping ranges in place to reduce the number of texSubImage2D calls (same algorithm as three.js)
		updateRanges.sort((a, b) => a.start - b.start);
		let mergeIndex = 0;
		const getRow = (index, rowLength) => Math.floor(Math.floor(index / componentStride) / rowLength);
		for (let i = 1; i < updateRanges.length; i++) {
			const previousRange = updateRanges[mergeIndex], range = updateRanges[i];
			const previousEnd = previousRange.start + previousRange.count;
			const currentRow = getRow(range.start, image.width), previousRow = getRow(previousRange.start, image.width);
			if (range.start <= previousEnd + 1 && currentRow === previousRow && getRow(range.start + range.count - 1, image.width) === currentRow) {
				previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
			} else {
				++mergeIndex;
				updateRanges[mergeIndex] = range;
			}
		}
		updateRanges.length = mergeIndex + 1;
		const currentUnpackRowLen = state.getParameter(gl.UNPACK_ROW_LENGTH);
		const currentUnpackSkipPixels = state.getParameter(gl.UNPACK_SKIP_PIXELS);
		const currentUnpackSkipRows = state.getParameter(gl.UNPACK_SKIP_ROWS);
		state.pixelStorei(gl.UNPACK_ROW_LENGTH, image.width);
		for (let i = 0, l = updateRanges.length; i < l; i++) {
			const range = updateRanges[i];
			const pixelStart = Math.floor(range.start / componentStride), pixelCount = Math.ceil(range.count / componentStride);
			const x = pixelStart % image.width, y = Math.floor(pixelStart / image.width);
			state.pixelStorei(gl.UNPACK_SKIP_PIXELS, x);
			state.pixelStorei(gl.UNPACK_SKIP_ROWS, y);
			state.texSubImage2D(gl.TEXTURE_2D, 0, x, y, pixelCount, 1, glFormat, glType, image.data);
		}
		texture.clearUpdateRanges();
		state.pixelStorei(gl.UNPACK_ROW_LENGTH, currentUnpackRowLen);
		state.pixelStorei(gl.UNPACK_SKIP_PIXELS, currentUnpackSkipPixels);
		state.pixelStorei(gl.UNPACK_SKIP_ROWS, currentUnpackSkipRows);
	}

	_uploadTexture(p, texture, slot) {
		const gl = this.gl, state = this.state;
		let textureType = gl.TEXTURE_2D;
		if (texture.isDataArrayTexture || texture.isCompressedArrayTexture) textureType = gl.TEXTURE_2D_ARRAY;
		if (texture.isData3DTexture) textureType = gl.TEXTURE_3D;

		const forceUpload = this._initTexture(p, texture);
		const source = texture.source;
		state.bindTexture(textureType, p.webglTexture, slot);
		const sourceProperties = this.get(source);

		if (source.version !== sourceProperties.version || forceUpload === true) {
			state.activeTexture(slot);
			const isImageBitmap = (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap);
			// jrs: Skeleton's streamed bone texture keeps its sampler parameters (and unpack state) from the first upload
			const streamed = texture._stream === true && p.allocated === true && forceUpload === false;
			if (isImageBitmap === false) {
				state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
				state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
			}
			state.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);

			let image = this._resizeImage(texture.image, false, this.maxTextureSize);
			image = this._verifyColorSpace(texture, image);

			const glFormat = this.convert(texture.format, texture.colorSpace);
			const glType = this.convert(texture.type);
			let glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.normalized, texture.colorSpace, texture.isVideoTexture);

			if (!streamed) this._setTextureParameters(textureType, texture);

			let mipmap;
			const mipmaps = texture.mipmaps;
			const allocateMemory = (sourceProperties.version === undefined) || (forceUpload === true);
			// jrs: a large DataTexture without user mipmaps (or a streamed one) is (re)defined with texImage2D instead of
			// texStorage2D + texSubImage2D. Chromium sends client-side texSubImage2D data through its command-buffer transfer ring
			// (chunked; once it is driven into chunked mode every upload can stall for seconds), texImage2D takes the mapped-memory
			// path (bench/results/swarm/stall-hunter.md; 4096x4096 RGBA8: ~50 ms vs ~7 ms here). The result is identical: without
			// mipmap generation TEXTURE_MAX_LEVEL = 0 makes the texture complete with its base level only, as the immutable one-level
			// storage three.js allocates would be. Small textures keep three.js's exact storage path (same GL errors for bad formats).
			if (texture.isDataTexture === true && mipmaps.length === 0 && allocateMemory) {
				p.mutable = texture._stream === true || (image.data != null && image.data.byteLength >= LARGE_UPLOAD_BYTES);
			}
			const mutableData = texture.isDataTexture === true && mipmaps.length === 0 && p.mutable === true;
			const useTexStorage = texture.isVideoTexture !== true && mutableData === false;
			const dataReady = source.dataReady;
			const levels = this._getMipLevels(texture, image);

			if (texture.isDepthTexture) {
				glInternalFormat = this.glInternalDepthFormat(texture.format === DepthStencilFormat, texture.type);
				if (allocateMemory) {
					if (useTexStorage) state.texStorage2D(gl.TEXTURE_2D, 1, glInternalFormat, image.width, image.height);
					else state.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, null);
				}
			} else if (texture.isDataTexture) {
				if (mipmaps.length > 0) {
					// use manually created mipmaps if available; otherwise set level 0 and let GL generate the other levels
					if (useTexStorage && allocateMemory) state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
					for (let i = 0, il = mipmaps.length; i < il; i++) {
						mipmap = mipmaps[i];
						if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
						} else {
							state.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
						}
					}
					texture.generateMipmaps = false;
				} else if (useTexStorage) {
					if (allocateMemory) state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
					if (dataReady) this._updateTexture(texture, image, glFormat, glType);
				} else if (allocateMemory === false && texture.updateRanges.length > 0 && p.allocated === true && p.width === image.width && p.height === image.height) {
					if (dataReady) this._updateTexture(texture, image, glFormat, glType);
				} else {
					if (texture.updateRanges.length > 0) texture.clearUpdateRanges();
					if (allocateMemory && texture.generateMipmaps === false) gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, 0);
					state.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, image.width, image.height, 0, glFormat, glType, image.data === undefined ? null : image.data);
				}
				p.allocated = true; p.width = image.width; p.height = image.height;
			} else if (texture.isCompressedTexture) {
				if (texture.isCompressedArrayTexture) {
					if (useTexStorage && allocateMemory) state.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height, image.depth);
					for (let i = 0, il = mipmaps.length; i < il; i++) {
						mipmap = mipmaps[i];
						if (texture.format !== RGBAFormat) {
							if (glFormat !== null) {
								if (useTexStorage) {
									if (dataReady) {
										if (texture.layerUpdates.size > 0) {
											const layerByteLength = getByteLength(mipmap.width, mipmap.height, texture.format, texture.type);
											for (const layerIndex of texture.layerUpdates) {
												const layerData = mipmap.data.subarray(layerIndex * layerByteLength / mipmap.data.BYTES_PER_ELEMENT, (layerIndex + 1) * layerByteLength / mipmap.data.BYTES_PER_ELEMENT);
												state.compressedTexSubImage3D(gl.TEXTURE_2D_ARRAY, i, 0, 0, layerIndex, mipmap.width, mipmap.height, 1, glFormat, layerData);
											}
										} else {
											state.compressedTexSubImage3D(gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, mipmap.width, mipmap.height, image.depth, glFormat, mipmap.data);
										}
									}
								} else {
									state.compressedTexImage3D(gl.TEXTURE_2D_ARRAY, i, glInternalFormat, mipmap.width, mipmap.height, image.depth, 0, mipmap.data, 0, 0);
								}
							} else {
								console.warn('WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()');
							}
						} else if (useTexStorage) {
							if (dataReady) state.texSubImage3D(gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, mipmap.width, mipmap.height, image.depth, glFormat, glType, mipmap.data);
						} else {
							state.texImage3D(gl.TEXTURE_2D_ARRAY, i, glInternalFormat, mipmap.width, mipmap.height, image.depth, 0, glFormat, glType, mipmap.data);
						}
					}
					if (texture.layerUpdates.size > 0) texture.clearLayerUpdates();
				} else {
					if (useTexStorage && allocateMemory) state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, mipmaps[0].width, mipmaps[0].height);
					for (let i = 0, il = mipmaps.length; i < il; i++) {
						mipmap = mipmaps[i];
						if (texture.format !== RGBAFormat) {
							if (glFormat !== null) {
								if (useTexStorage) {
									if (dataReady) state.compressedTexSubImage2D(gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, mipmap.data);
								} else {
									state.compressedTexImage2D(gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
								}
							} else {
								console.warn('WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()');
							}
						} else if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_2D, i, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
						} else {
							state.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
						}
					}
				}
			} else if (texture.isDataArrayTexture) {
				if (useTexStorage) {
					if (allocateMemory) state.texStorage3D(gl.TEXTURE_2D_ARRAY, levels, glInternalFormat, image.width, image.height, image.depth);
					if (dataReady) {
						if (texture.layerUpdates.size > 0) {
							const layerByteLength = getByteLength(image.width, image.height, texture.format, texture.type);
							for (const layerIndex of texture.layerUpdates) {
								const layerData = image.data.subarray(layerIndex * layerByteLength / image.data.BYTES_PER_ELEMENT, (layerIndex + 1) * layerByteLength / image.data.BYTES_PER_ELEMENT);
								state.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layerIndex, image.width, image.height, 1, glFormat, glType, layerData);
							}
							texture.clearLayerUpdates();
						} else {
							state.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
						}
					}
				} else {
					state.texImage3D(gl.TEXTURE_2D_ARRAY, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
				}
			} else if (texture.isData3DTexture) {
				if (useTexStorage) {
					if (allocateMemory) state.texStorage3D(gl.TEXTURE_3D, levels, glInternalFormat, image.width, image.height, image.depth);
					if (dataReady) state.texSubImage3D(gl.TEXTURE_3D, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
				} else {
					state.texImage3D(gl.TEXTURE_3D, 0, glInternalFormat, image.width, image.height, image.depth, 0, glFormat, glType, image.data);
				}
			} else if (texture.isFramebufferTexture) {
				if (allocateMemory) {
					if (useTexStorage) {
						state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
					} else {
						let width = image.width, height = image.height;
						for (let i = 0; i < levels; i++) {
							state.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, width, height, 0, glFormat, glType, null);
							width >>= 1; height >>= 1;
						}
					}
				}
			} else {
				// regular Texture (image, video, canvas): use manually created mipmaps if available, else set level 0 and generate the rest
				if (mipmaps.length > 0) {
					if (useTexStorage && allocateMemory) {
						const dimensions = this._getDimensions(mipmaps[0]);
						state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
					}
					for (let i = 0, il = mipmaps.length; i < il; i++) {
						mipmap = mipmaps[i];
						if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_2D, i, 0, 0, glFormat, glType, mipmap);
						} else {
							state.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
						}
					}
					texture.generateMipmaps = false;
				} else if (useTexStorage) {
					if (allocateMemory) {
						const dimensions = this._getDimensions(image);
						state.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, dimensions.width, dimensions.height);
					}
					if (dataReady) state.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
				} else {
					// VideoTexture (mutable storage). jrs: when the frame size is unchanged redefine nothing, just replace the pixels.
					const w = image.videoWidth !== undefined ? image.videoWidth : image.width, h = image.videoHeight !== undefined ? image.videoHeight : image.height;
					if (allocateMemory === false && p.videoWidth === w && p.videoHeight === h) state.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
					else state.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
					p.videoWidth = w; p.videoHeight = h;
				}
			}

			if (this._textureNeedsMipmaps(texture)) gl.generateMipmap(textureType);
			sourceProperties.version = source.version;
			if (texture.onUpdate) texture.onUpdate(texture);
		}
		p.version = texture.version;
	}

	_uploadCubeTexture(p, texture, slot) {
		const gl = this.gl, state = this.state;
		if (texture.image.length !== 6) return;
		const forceUpload = this._initTexture(p, texture);
		const source = texture.source;
		state.bindTexture(gl.TEXTURE_CUBE_MAP, p.webglTexture, slot);
		const sourceProperties = this.get(source);

		if (source.version !== sourceProperties.version || forceUpload === true) {
			state.activeTexture(slot);
			state.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
			state.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
			state.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);

			const isCompressed = (texture.isCompressedTexture || texture.image[0].isCompressedTexture);
			// jrs also accepts plain { data, width, height } objects as faces (three.js needs DataTexture faces for typed-array data)
			const isDataTexture = !!(texture.image[0] && (texture.image[0].isDataTexture || (texture.image[0].data !== undefined && texture.image[0].width !== undefined && texture.image[0].isTexture !== true)));
			const cubeImage = [];
			for (let i = 0; i < 6; i++) {
				if (!isCompressed && !isDataTexture) cubeImage[i] = this._resizeImage(texture.image[i], true, this.maxCubemapSize);
				else cubeImage[i] = (isDataTexture && texture.image[i].isDataTexture) ? texture.image[i].image : texture.image[i];
				cubeImage[i] = this._verifyColorSpace(texture, cubeImage[i]);
			}
			const image = cubeImage[0];
			const glFormat = this.convert(texture.format, texture.colorSpace), glType = this.convert(texture.type);
			const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.normalized, texture.colorSpace);
			const useTexStorage = texture.isVideoTexture !== true;
			const allocateMemory = (sourceProperties.version === undefined) || (forceUpload === true);
			const dataReady = source.dataReady;
			let levels = this._getMipLevels(texture, image);

			this._setTextureParameters(gl.TEXTURE_CUBE_MAP, texture);

			let mipmaps;
			if (isCompressed) {
				if (useTexStorage && allocateMemory) state.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, glInternalFormat, image.width, image.height);
				for (let i = 0; i < 6; i++) {
					mipmaps = cubeImage[i].mipmaps;
					for (let j = 0; j < mipmaps.length; j++) {
						const mipmap = mipmaps[j];
						if (texture.format !== RGBAFormat) {
							if (glFormat !== null) {
								if (useTexStorage) {
									if (dataReady) state.compressedTexSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, 0, 0, mipmap.width, mipmap.height, glFormat, mipmap.data);
								} else {
									state.compressedTexImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, mipmap.data);
								}
							} else {
								console.warn('WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()');
							}
						} else if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, 0, 0, mipmap.width, mipmap.height, glFormat, glType, mipmap.data);
						} else {
							state.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j, glInternalFormat, mipmap.width, mipmap.height, 0, glFormat, glType, mipmap.data);
						}
					}
				}
			} else {
				mipmaps = texture.mipmaps;
				if (useTexStorage && allocateMemory) {
					// Normal textures and compressed cube textures define base level + mips with their mipmap array; uncompressed cube textures use it for the mips only
					if (mipmaps.length > 0) levels++;
					const dimensions = this._getDimensions(cubeImage[0]);
					state.texStorage2D(gl.TEXTURE_CUBE_MAP, levels, glInternalFormat, dimensions.width, dimensions.height);
				}
				for (let i = 0; i < 6; i++) {
					if (isDataTexture) {
						if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, cubeImage[i].width, cubeImage[i].height, glFormat, glType, cubeImage[i].data);
						} else {
							state.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, cubeImage[i].width, cubeImage[i].height, 0, glFormat, glType, cubeImage[i].data);
						}
						for (let j = 0; j < mipmaps.length; j++) {
							const mipmap = mipmaps[j];
							const mipmapImage = mipmap.image[i].image;
							if (useTexStorage) {
								if (dataReady) state.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, 0, 0, mipmapImage.width, mipmapImage.height, glFormat, glType, mipmapImage.data);
							} else {
								state.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, glInternalFormat, mipmapImage.width, mipmapImage.height, 0, glFormat, glType, mipmapImage.data);
							}
						}
					} else {
						if (useTexStorage) {
							if (dataReady) state.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, 0, 0, glFormat, glType, cubeImage[i]);
						} else {
							state.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, glFormat, glType, cubeImage[i]);
						}
						for (let j = 0; j < mipmaps.length; j++) {
							const mipmap = mipmaps[j];
							if (useTexStorage) {
								if (dataReady) state.texSubImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, 0, 0, glFormat, glType, mipmap.image[i]);
							} else {
								state.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, j + 1, glInternalFormat, glFormat, glType, mipmap.image[i]);
							}
						}
					}
				}
			}
			if (this._textureNeedsMipmaps(texture)) gl.generateMipmap(gl.TEXTURE_CUBE_MAP); // all cube faces are assumed to have the same size
			sourceProperties.version = source.version;
			if (texture.onUpdate) texture.onUpdate(texture);
		}
		p.version = texture.version;
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
				const glFormat = this.glFormat(texture.format, texture.colorSpace), glType = this.glType(texture.type);
				const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.normalized, texture.colorSpace);
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
				const glInternalFormat = this.glInternalDepthFormat(dt.format === DepthStencilFormat, dt.type);
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
			const glFormat = this.glFormat(texture.format, texture.colorSpace), glType = this.glType(texture.type);
			const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.normalized, texture.colorSpace);
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
			const glInternalFormat = this.glInternalDepthFormat(dt.format === DepthStencilFormat, dt.type);
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
