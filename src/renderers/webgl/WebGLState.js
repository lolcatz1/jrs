import {
	NotEqualDepth, GreaterDepth, GreaterEqualDepth, EqualDepth, LessEqualDepth, LessDepth, AlwaysDepth, NeverDepth,
	CullFaceFront, CullFaceBack, CullFaceNone, DoubleSide, BackSide, CustomBlending, MultiplyBlending, SubtractiveBlending,
	AdditiveBlending, NoBlending, NormalBlending, AddEquation, SubtractEquation, ReverseSubtractEquation, MinEquation, MaxEquation,
	ZeroFactor, OneFactor, SrcColorFactor, SrcAlphaFactor, SrcAlphaSaturateFactor, DstColorFactor, DstAlphaFactor,
	OneMinusSrcColorFactor, OneMinusSrcAlphaFactor, OneMinusDstColorFactor, OneMinusDstAlphaFactor,
	ConstantColorFactor, OneMinusConstantColorFactor, ConstantAlphaFactor, OneMinusConstantAlphaFactor
} from '../../constants.js';
import { Vector4 } from '../../math/Vector4.js';

/**
 * Redundant-state eliminator. Every GL state change goes through here and
 * is dropped if it would not change anything.
 */
class WebGLState {
	constructor(gl) {
		this.gl = gl;
		this.enabledCapabilities = {};
		this.currentProgram = null;
		this.currentVAO = null;
		this.currentArrayBuffer = null;
		this.currentElementBuffer = null;
		this.currentUniformBuffer = null;
		this.currentUniformBindings = []; // index -> {buffer, offset, size}
		this.currentBlendingEnabled = false;
		this.currentBlending = null;
		this.currentBlendEquation = null; this.currentBlendSrc = null; this.currentBlendDst = null;
		this.currentBlendEquationAlpha = null; this.currentBlendSrcAlpha = null; this.currentBlendDstAlpha = null;
		this.currentBlendColor = [0, 0, 0]; this.currentBlendAlpha = 0;
		this.currentPremultipliedAlpha = false;
		this.currentFlipSided = null;
		this.currentCullFace = null;
		this.currentLineWidth = null;
		this.currentPolygonOffsetFactor = null; this.currentPolygonOffsetUnits = null;
		this.currentDepthMask = null; this.currentDepthFunc = null; this.currentDepthTest = null;
		this.currentColorMask = null;
		this.currentStencilTest = null; this.currentStencilMask = null;
		this.currentStencilFunc = null; this.currentStencilRef = null; this.currentStencilFuncMask = null;
		this.currentStencilFail = null; this.currentStencilZFail = null; this.currentStencilZPass = null;
		this.currentClearColor = new Vector4(0, 0, 0, 0);
		this.currentClearDepth = null; this.currentClearStencil = null;
		this.currentViewport = new Vector4(-1, -1, -1, -1);
		this.currentScissor = new Vector4(-1, -1, -1, -1);
		this.currentScissorTest = null;
		this.currentMaterialWord = -1; // packed state of the last "simple" material applied by setMaterial; -1 = unknown
		this.currentTextureSlot = null;
		// pixel store (unpack) state, cached so per-frame texture uploads do not re-send it
		this._pixelStore = {};
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
		this.currentBoundTextures = []; // slot -> {type, texture}
		this.currentFramebuffer = null;
		this.maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
		this.uboAlignment = gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT);

		this.equationToGL = {
			[AddEquation]: gl.FUNC_ADD, [SubtractEquation]: gl.FUNC_SUBTRACT, [ReverseSubtractEquation]: gl.FUNC_REVERSE_SUBTRACT,
			[MinEquation]: gl.MIN, [MaxEquation]: gl.MAX
		};
		this.factorToGL = {
			[ZeroFactor]: gl.ZERO, [OneFactor]: gl.ONE, [SrcColorFactor]: gl.SRC_COLOR, [SrcAlphaFactor]: gl.SRC_ALPHA,
			[SrcAlphaSaturateFactor]: gl.SRC_ALPHA_SATURATE, [DstColorFactor]: gl.DST_COLOR, [DstAlphaFactor]: gl.DST_ALPHA,
			[OneMinusSrcColorFactor]: gl.ONE_MINUS_SRC_COLOR, [OneMinusSrcAlphaFactor]: gl.ONE_MINUS_SRC_ALPHA,
			[OneMinusDstColorFactor]: gl.ONE_MINUS_DST_COLOR, [OneMinusDstAlphaFactor]: gl.ONE_MINUS_DST_ALPHA,
			[ConstantColorFactor]: gl.CONSTANT_COLOR, [OneMinusConstantColorFactor]: gl.ONE_MINUS_CONSTANT_COLOR,
			[ConstantAlphaFactor]: gl.CONSTANT_ALPHA, [OneMinusConstantAlphaFactor]: gl.ONE_MINUS_CONSTANT_ALPHA
		};

		// defaults
		this.enable(gl.DEPTH_TEST);
		this.setDepthFunc(LessEqualDepth);
		this.setFlipSided(false);
		this.setCullFace(CullFaceBack);
		this.enable(gl.CULL_FACE);
		this.setBlending(NoBlending);
	}

	enable(id) {
		if (this.enabledCapabilities[id] !== true) { this.gl.enable(id); this.enabledCapabilities[id] = true; }
	}
	disable(id) {
		if (this.enabledCapabilities[id] !== false) { this.gl.disable(id); this.enabledCapabilities[id] = false; }
	}

	useProgram(program) {
		if (this.currentProgram !== program) { this.gl.useProgram(program); this.currentProgram = program; return true; }
		return false;
	}
	bindVertexArray(vao) {
		if (this.currentVAO !== vao) { this.gl.bindVertexArray(vao); this.currentVAO = vao; this.currentElementBuffer = undefined; return true; }
		return false;
	}
	bindArrayBuffer(buffer) {
		if (this.currentArrayBuffer !== buffer) { this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer); this.currentArrayBuffer = buffer; }
	}
	bindUniformBuffer(buffer) {
		if (this.currentUniformBuffer !== buffer) { this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, buffer); this.currentUniformBuffer = buffer; }
	}
	bindUniformBufferRange(index, buffer, offset, size) {
		let b = this.currentUniformBindings[index];
		if (b === undefined) { b = this.currentUniformBindings[index] = { buffer: null, offset: -1, size: -1 }; }
		if (b.buffer !== buffer || b.offset !== offset || b.size !== size) {
			this.gl.bindBufferRange(this.gl.UNIFORM_BUFFER, index, buffer, offset, size);
			b.buffer = buffer; b.offset = offset; b.size = size;
			this.currentUniformBuffer = buffer; // bindBufferRange also binds to the generic target
		}
	}
	bindFramebuffer(framebuffer) {
		if (this.currentFramebuffer !== framebuffer) { this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer); this.currentFramebuffer = framebuffer; return true; }
		return false;
	}

	setBlending(blending, blendEquation, blendSrc, blendDst, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, blendColor, blendAlpha, premultipliedAlpha) {
		const gl = this.gl;
		if (blending === NoBlending) {
			if (this.currentBlendingEnabled === true) { this.disable(gl.BLEND); this.currentBlendingEnabled = false; }
			return;
		}
		if (this.currentBlendingEnabled === false) { this.enable(gl.BLEND); this.currentBlendingEnabled = true; }
		if (blending !== CustomBlending) {
			if (blending !== this.currentBlending || premultipliedAlpha !== this.currentPremultipliedAlpha) {
				if (this.currentBlendEquation !== AddEquation || this.currentBlendEquationAlpha !== AddEquation) {
					gl.blendEquation(gl.FUNC_ADD);
					this.currentBlendEquation = AddEquation; this.currentBlendEquationAlpha = AddEquation;
				}
				if (premultipliedAlpha) {
					switch (blending) {
						case NormalBlending: gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
						case AdditiveBlending: gl.blendFunc(gl.ONE, gl.ONE); break;
						case SubtractiveBlending: gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE); break;
						case MultiplyBlending: gl.blendFuncSeparate(gl.DST_COLOR, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); break;
						default: console.error('WebGLState: Invalid blending: ', blending);
					}
				} else {
					switch (blending) {
						case NormalBlending: gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); break;
						case AdditiveBlending: gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE); break;
						// three.js only logs an error for Subtractive/Multiply without premultipliedAlpha (and keeps the
						// previous blend function); jrs applies the documented non-premultiplied equivalents instead
						case SubtractiveBlending: gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE); break;
						case MultiplyBlending: gl.blendFunc(gl.ZERO, gl.SRC_COLOR); break;
						default: console.error('WebGLState: Invalid blending: ', blending);
					}
				}
				this.currentBlendSrc = null; this.currentBlendDst = null; this.currentBlendSrcAlpha = null; this.currentBlendDstAlpha = null;
				this.currentBlendColor[0] = 0; this.currentBlendColor[1] = 0; this.currentBlendColor[2] = 0; this.currentBlendAlpha = 0;
				this.currentBlending = blending; this.currentPremultipliedAlpha = premultipliedAlpha;
			}
			return;
		}
		blendEquationAlpha = blendEquationAlpha || blendEquation;
		blendSrcAlpha = blendSrcAlpha || blendSrc;
		blendDstAlpha = blendDstAlpha || blendDst;
		if (blendEquation !== this.currentBlendEquation || blendEquationAlpha !== this.currentBlendEquationAlpha) {
			gl.blendEquationSeparate(this.equationToGL[blendEquation], this.equationToGL[blendEquationAlpha]);
			this.currentBlendEquation = blendEquation; this.currentBlendEquationAlpha = blendEquationAlpha;
		}
		if (blendSrc !== this.currentBlendSrc || blendDst !== this.currentBlendDst || blendSrcAlpha !== this.currentBlendSrcAlpha || blendDstAlpha !== this.currentBlendDstAlpha) {
			gl.blendFuncSeparate(this.factorToGL[blendSrc], this.factorToGL[blendDst], this.factorToGL[blendSrcAlpha], this.factorToGL[blendDstAlpha]);
			this.currentBlendSrc = blendSrc; this.currentBlendDst = blendDst; this.currentBlendSrcAlpha = blendSrcAlpha; this.currentBlendDstAlpha = blendDstAlpha;
		}
		if (blendColor !== undefined && (blendColor.r !== this.currentBlendColor[0] || blendColor.g !== this.currentBlendColor[1] || blendColor.b !== this.currentBlendColor[2] || blendAlpha !== this.currentBlendAlpha)) {
			gl.blendColor(blendColor.r, blendColor.g, blendColor.b, blendAlpha);
			this.currentBlendColor[0] = blendColor.r; this.currentBlendColor[1] = blendColor.g; this.currentBlendColor[2] = blendColor.b; this.currentBlendAlpha = blendAlpha;
		}
		this.currentBlending = blending; this.currentPremultipliedAlpha = false;
	}

	setMaterial(material, frontFaceCW, side = material.side) {
		const gl = this.gl;
		// Fast path: materials without custom blend factors, polygon offset or stencil are fully described by one
		// packed word. If it matches what the last setMaterial applied (and no other setter ran since), every
		// call below would be dropped by its own cache, so skip them all.
		let word = -1;
		const blending = material.blending, depthFunc = material.depthFunc;
		if (blending !== CustomBlending && material.polygonOffset !== true && material.stencilWrite !== true && depthFunc >= 0 && depthFunc < 8 && blending >= 0 && blending < 6) {
			const effBlending = (blending === NormalBlending && material.transparent === false) ? NoBlending : blending;
			word = (side & 3) | (frontFaceCW ? 4 : 0) | (effBlending << 3) | (material.premultipliedAlpha ? 64 : 0) | (depthFunc << 7) |
				(material.depthTest ? 1024 : 0) | (material.depthWrite ? 2048 : 0) | (material.colorWrite ? 4096 : 0) | (material.alphaToCoverage === true ? 8192 : 0);
			if (word === this.currentMaterialWord) return;
		}
		side === DoubleSide ? this.disable(gl.CULL_FACE) : this.enable(gl.CULL_FACE);
		let flipSided = (side === BackSide);
		if (frontFaceCW) flipSided = !flipSided;
		this.setFlipSided(flipSided);
		(material.blending === NormalBlending && material.transparent === false)
			? this.setBlending(NoBlending)
			: this.setBlending(material.blending, material.blendEquation, material.blendSrc, material.blendDst, material.blendEquationAlpha, material.blendSrcAlpha, material.blendDstAlpha, material.blendColor, material.blendAlpha, material.premultipliedAlpha);
		this.setDepthFunc(material.depthFunc);
		this.setDepthTest(material.depthTest);
		this.setDepthMask(material.depthWrite);
		this.setColorMask(material.colorWrite);
		this.setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
		material.alphaToCoverage === true ? this.enable(gl.SAMPLE_ALPHA_TO_COVERAGE) : this.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
		// stencil (constants are the GL enums, as in three.js)
		const stencilWrite = material.stencilWrite;
		this.setStencilTest(stencilWrite);
		if (stencilWrite) {
			this.setStencilMask(material.stencilWriteMask);
			this.setStencilFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
			this.setStencilOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
		}
		this.currentMaterialWord = word;
	}
	/** Shadow pass state: three.js renders casters with its own MeshDepthMaterial, so the caster's depth, blend,
	 *  stencil and polygon-offset settings do not apply; only the (flipped) side does. */
	setShadowPassMaterial(frontFaceCW, side) {
		const gl = this.gl;
		side === DoubleSide ? this.disable(gl.CULL_FACE) : this.enable(gl.CULL_FACE);
		let flipSided = (side === BackSide);
		if (frontFaceCW) flipSided = !flipSided;
		this.setFlipSided(flipSided);
		this.setBlending(NoBlending);
		this.setDepthFunc(LessEqualDepth);
		this.setDepthTest(true);
		this.setDepthMask(true);
		this.setColorMask(true);
		this.setPolygonOffset(false, 0, 0);
		this.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
		this.setStencilTest(false);
	}
	setStencilTest(stencilTest) {
		if (this.currentStencilTest === stencilTest) return;
		if (stencilTest) this.enable(this.gl.STENCIL_TEST); else this.disable(this.gl.STENCIL_TEST);
		this.currentStencilTest = stencilTest;
	}
	setStencilMask(mask) {
		this.currentMaterialWord = -1;
		if (this.currentStencilMask !== mask) { this.gl.stencilMask(mask); this.currentStencilMask = mask; }
	}
	setStencilFunc(func, ref, mask) {
		if (this.currentStencilFunc !== func || this.currentStencilRef !== ref || this.currentStencilFuncMask !== mask) {
			this.gl.stencilFunc(func, ref, mask);
			this.currentStencilFunc = func; this.currentStencilRef = ref; this.currentStencilFuncMask = mask;
		}
	}
	setStencilOp(fail, zfail, zpass) {
		if (this.currentStencilFail !== fail || this.currentStencilZFail !== zfail || this.currentStencilZPass !== zpass) {
			this.gl.stencilOp(fail, zfail, zpass);
			this.currentStencilFail = fail; this.currentStencilZFail = zfail; this.currentStencilZPass = zpass;
		}
	}

	setFlipSided(flipSided) {
		this.currentMaterialWord = -1;
		if (this.currentFlipSided !== flipSided) {
			const gl = this.gl;
			if (flipSided) gl.frontFace(gl.CW); else gl.frontFace(gl.CCW);
			this.currentFlipSided = flipSided;
		}
	}
	setCullFace(cullFace) {
		const gl = this.gl;
		if (cullFace !== CullFaceNone) {
			this.enable(gl.CULL_FACE);
			if (cullFace !== this.currentCullFace) {
				if (cullFace === CullFaceBack) gl.cullFace(gl.BACK);
				else if (cullFace === CullFaceFront) gl.cullFace(gl.FRONT);
				else gl.cullFace(gl.FRONT_AND_BACK);
			}
		} else {
			this.disable(gl.CULL_FACE);
		}
		this.currentCullFace = cullFace;
	}
	setLineWidth(width) {
		if (width !== this.currentLineWidth) { this.gl.lineWidth(width); this.currentLineWidth = width; }
	}
	setPolygonOffset(polygonOffset, factor, units) {
		const gl = this.gl;
		if (polygonOffset) {
			this.enable(gl.POLYGON_OFFSET_FILL);
			if (this.currentPolygonOffsetFactor !== factor || this.currentPolygonOffsetUnits !== units) {
				gl.polygonOffset(factor, units);
				this.currentPolygonOffsetFactor = factor; this.currentPolygonOffsetUnits = units;
			}
		} else {
			this.disable(gl.POLYGON_OFFSET_FILL);
		}
	}
	setDepthTest(depthTest) {
		this.currentMaterialWord = -1;
		if (this.currentDepthTest === depthTest) return;
		if (depthTest) this.enable(this.gl.DEPTH_TEST); else this.disable(this.gl.DEPTH_TEST);
		this.currentDepthTest = depthTest;
	}
	setDepthMask(depthMask) {
		this.currentMaterialWord = -1;
		if (this.currentDepthMask !== depthMask) { this.gl.depthMask(depthMask); this.currentDepthMask = depthMask; }
	}
	setDepthFunc(depthFunc) {
		if (this.currentDepthFunc === depthFunc) return;
		const gl = this.gl;
		switch (depthFunc) {
			case NeverDepth: gl.depthFunc(gl.NEVER); break;
			case AlwaysDepth: gl.depthFunc(gl.ALWAYS); break;
			case LessDepth: gl.depthFunc(gl.LESS); break;
			case LessEqualDepth: gl.depthFunc(gl.LEQUAL); break;
			case EqualDepth: gl.depthFunc(gl.EQUAL); break;
			case GreaterEqualDepth: gl.depthFunc(gl.GEQUAL); break;
			case GreaterDepth: gl.depthFunc(gl.GREATER); break;
			case NotEqualDepth: gl.depthFunc(gl.NOTEQUAL); break;
			default: gl.depthFunc(gl.LEQUAL);
		}
		this.currentDepthFunc = depthFunc;
	}
	setColorMask(colorMask) {
		this.currentMaterialWord = -1;
		if (this.currentColorMask !== colorMask) { this.gl.colorMask(colorMask, colorMask, colorMask, colorMask); this.currentColorMask = colorMask; }
	}
	setClearColor(r, g, b, a) {
		const c = this.currentClearColor;
		if (c.x !== r || c.y !== g || c.z !== b || c.w !== a) { this.gl.clearColor(r, g, b, a); c.set(r, g, b, a); }
	}
	setClearDepth(depth) {
		if (this.currentClearDepth !== depth) { this.gl.clearDepth(depth); this.currentClearDepth = depth; }
	}
	setClearStencil(stencil) {
		if (this.currentClearStencil !== stencil) { this.gl.clearStencil(stencil); this.currentClearStencil = stencil; }
	}
	viewport(x, y, w, h) {
		const v = this.currentViewport;
		if (v.x !== x || v.y !== y || v.z !== w || v.w !== h) { this.gl.viewport(x, y, w, h); v.set(x, y, w, h); }
	}
	scissor(x, y, w, h) {
		const v = this.currentScissor;
		if (v.x !== x || v.y !== y || v.z !== w || v.w !== h) { this.gl.scissor(x, y, w, h); v.set(x, y, w, h); }
	}
	setScissorTest(scissorTest) {
		if (this.currentScissorTest !== scissorTest) {
			if (scissorTest) this.enable(this.gl.SCISSOR_TEST); else this.disable(this.gl.SCISSOR_TEST);
			this.currentScissorTest = scissorTest;
		}
	}
	activeTexture(slot) {
		if (this.currentTextureSlot !== slot) { this.gl.activeTexture(this.gl.TEXTURE0 + slot); this.currentTextureSlot = slot; }
	}
	bindTexture(target, texture, slot) {
		if (slot === undefined) slot = this.currentTextureSlot === null ? 0 : this.currentTextureSlot;
		let bound = this.currentBoundTextures[slot];
		if (bound === undefined) { bound = { type: undefined, texture: undefined }; this.currentBoundTextures[slot] = bound; }
		if (bound.type !== target || bound.texture !== texture) {
			this.activeTexture(slot);
			this.gl.bindTexture(target, texture);
			bound.type = target; bound.texture = texture;
		}
	}
	unbindTexture() {
		const bound = this.currentBoundTextures[this.currentTextureSlot];
		if (bound !== undefined && bound.type !== undefined) {
			this.gl.bindTexture(bound.type, null);
			bound.type = undefined; bound.texture = undefined;
		}
	}
	/** Cached gl.pixelStorei (like three.js's WebGLState.pixelStorei). */
	pixelStorei(name, value) {
		const parameters = this._pixelStore;
		if (parameters[name] !== value) { this.gl.pixelStorei(name, value); parameters[name] = value; }
	}
	getParameter(name) {
		const v = this._pixelStore[name];
		return v !== undefined ? v : this.gl.getParameter(name);
	}
	/** Sets the three unpack parameters every upload needs, skipping the ones already current. */
	setUnpack(flipY, premultiplyAlpha, alignment) {
		const gl = this.gl;
		this.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
		this.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiplyAlpha);
		this.pixelStorei(gl.UNPACK_ALIGNMENT, alignment);
	}
	// Texture storage / upload wrappers: like three.js they log instead of throwing when the browser rejects the arguments.
	texImage2D(...a) { try { this.gl.texImage2D(...a); } catch (e) { console.error('WebGLState:', e); } }
	texImage3D(...a) { try { this.gl.texImage3D(...a); } catch (e) { console.error('WebGLState:', e); } }
	texSubImage2D(...a) { try { this.gl.texSubImage2D(...a); } catch (e) { console.error('WebGLState:', e); } }
	texSubImage3D(...a) { try { this.gl.texSubImage3D(...a); } catch (e) { console.error('WebGLState:', e); } }
	texStorage2D(...a) { try { this.gl.texStorage2D(...a); } catch (e) { console.error('WebGLState:', e); } }
	texStorage3D(...a) { try { this.gl.texStorage3D(...a); } catch (e) { console.error('WebGLState:', e); } }
	compressedTexImage2D(...a) { try { this.gl.compressedTexImage2D(...a); } catch (e) { console.error('WebGLState:', e); } }
	compressedTexImage3D(...a) { try { this.gl.compressedTexImage3D(...a); } catch (e) { console.error('WebGLState:', e); } }
	compressedTexSubImage2D(...a) { try { this.gl.compressedTexSubImage2D(...a); } catch (e) { console.error('WebGLState:', e); } }
	compressedTexSubImage3D(...a) { try { this.gl.compressedTexSubImage3D(...a); } catch (e) { console.error('WebGLState:', e); } }
	reset() {
		const gl = this.gl;
		this._pixelStore = {};
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
		gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.disable(gl.DEPTH_TEST); gl.disable(gl.POLYGON_OFFSET_FILL);
		gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
		gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.ONE, gl.ZERO); gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO); gl.blendColor(0, 0, 0, 0);
		gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0);
		gl.depthMask(true); gl.depthFunc(gl.LESS); gl.clearDepth(1);
		gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.polygonOffset(0, 0);
		gl.stencilMask(0xffffffff); gl.stencilFunc(gl.ALWAYS, 0, 0xffffffff); gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
		gl.activeTexture(gl.TEXTURE0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.useProgram(null); gl.lineWidth(1);
		gl.bindVertexArray(null);
		this.enabledCapabilities = {};
		this.currentMaterialWord = -1;
		this.currentTextureSlot = null; this.currentBoundTextures = [];
		this.currentProgram = null; this.currentVAO = null; this.currentArrayBuffer = null; this.currentUniformBuffer = null;
		this.currentUniformBindings = []; this.currentFramebuffer = null;
		this.currentBlendingEnabled = false; this.currentBlending = null;
		this.currentBlendEquation = null; this.currentBlendSrc = null; this.currentBlendDst = null;
		this.currentBlendEquationAlpha = null; this.currentBlendSrcAlpha = null; this.currentBlendDstAlpha = null;
		this.currentBlendColor = [0, 0, 0]; this.currentBlendAlpha = 0; this.currentPremultipliedAlpha = false;
		this.currentFlipSided = null; this.currentCullFace = null; this.currentLineWidth = null;
		this.currentPolygonOffsetFactor = null; this.currentPolygonOffsetUnits = null;
		this.currentDepthMask = null; this.currentDepthFunc = null; this.currentDepthTest = null; this.currentColorMask = null;
		this.currentStencilTest = null; this.currentStencilMask = null; this.currentStencilFunc = null; this.currentStencilRef = null;
		this.currentStencilFuncMask = null; this.currentStencilFail = null; this.currentStencilZFail = null; this.currentStencilZPass = null;
		this.currentClearColor.set(0, 0, 0, 0); this.currentClearDepth = null; this.currentClearStencil = null;
		this.currentViewport.set(-1, -1, -1, -1); this.currentScissor.set(-1, -1, -1, -1); this.currentScissorTest = null;
	}
}

export { WebGLState };
