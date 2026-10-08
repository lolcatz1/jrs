import {
	REVISION, NoToneMapping, SRGBColorSpace, LinearSRGBColorSpace, PCFShadowMap, BasicShadowMap, VSMShadowMap, FrontSide, BackSide, DoubleSide,
	UnsignedByteType, RGBAFormat, WebGLCoordinateSystem
} from '../constants.js';
import { Matrix3 } from '../math/Matrix3.js';
import { WebGLEnvironments } from './webgl/WebGLEnvironments.js';
import { WebGLBackground } from './webgl/WebGLBackground.js';
import { Color } from '../math/Color.js';
import { ColorManagement } from '../math/ColorManagement.js';
import { Frustum } from '../math/Frustum.js';
import { Matrix4 } from '../math/Matrix4.js';
import { Vector3 } from '../math/Vector3.js';
import { Vector4 } from '../math/Vector4.js';
import { Vector2 } from '../math/Vector2.js';
import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { Object3D } from '../core/Object3D.js';
import { epochs } from '../core/epochs.js';
import { FlatGraph, K_RENDERABLE, K_SPRITE, K_LIGHT, K_LOD, K_CUSTOM, K_INSUB, K_POST, K_NOCOUNT } from '../core/FlatGraph.js';
import { WebGLState } from './webgl/WebGLState.js';
import { WebGLAttributes } from './webgl/WebGLAttributes.js';
import { WebGLTextures } from './webgl/WebGLTextures.js';
import { WebGLPrograms, BLOCK_FRAME, BLOCK_LIGHTS, BLOCK_MATERIAL } from './webgl/WebGLPrograms.js';
import { WebGLRenderLists, WebGLRenderList } from './webgl/WebGLRenderLists.js';
import { WebGLLights } from './webgl/WebGLLights.js';
import { WebGLBindingStates } from './webgl/WebGLBindingStates.js';
import { WebGLBatcher } from './webgl/WebGLBatcher.js';
import { WebGLMegaBuffers } from './webgl/WebGLMegaBuffers.js';
import { WebGLMorphtargets } from './webgl/WebGLMorphtargets.js';
import { computeNormalMatrix } from '../core/TransformSlab.js';
import { WebGLInfo } from './webgl/WebGLInfo.js';
import { WebGLShadowMap } from './webgl/WebGLShadowMap.js';
import { getDFGLUT } from './shaders/DFGLUTData.js';
import { MATERIAL_SHADER, MATERIAL_SPRITE, MATERIAL_POINTS, MATERIAL_SHADOW_DEPTH, FRAME_BLOCK_SIZE, LIGHTS_BLOCK_SIZE, MATERIAL_BLOCK_SIZE, TEXTURE_UNITS } from './shaders/ShaderLib.js';

const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _vector3 = /*@__PURE__*/ new Vector3();
const _color = /*@__PURE__*/ new Color();
const _frustum = /*@__PURE__*/ new Frustum();

function isDescendantOf(object, ancestor) {
	for (let o = object.parent; o !== null; o = o.parent) if (o === ancestor) return true;
	return false;
}
const _envRotation = /*@__PURE__*/ new Matrix3();
const _envRotation4 = /*@__PURE__*/ new Matrix4();
const _envFlip = /*@__PURE__*/ new Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1);
const EMPTY_2D = { target: 0x0DE1, isShadowSampler: false }; // gl.TEXTURE_2D
const EMPTY_CUBE = { target: 0x8513, isShadowSampler: false }; // gl.TEXTURE_CUBE_MAP
const _emptyScene = { fog: null, environment: null, background: null, overrideMaterial: null, isScene: true, matrixWorldAutoUpdate: false, children: [], visible: true };
let _frameCounter = 0; // unique across renderers so per-material frame stamps cannot collide

// variant bits for program selection
const V_INSTANCING = 1, V_INSTANCING_COLOR = 2, V_RECEIVE_SHADOW = 4, V_SHADOW_PASS = 8;
const V_HAS_UV = 16, V_HAS_UV1 = 32, V_HAS_COLOR = 64, V_COLOR_ALPHA = 128, V_MULTIDRAW = 256, V_OBJTEX = 512, V_MATARRAY = 1024;
// skinning / morph targets are per-object GPU state: their own program variants, never batched
const V_SKINNING = 2048, V_MORPH_POSITION = 4096, V_MORPH_NORMAL = 8192, V_MORPH_COLOR = 16384, V_MORPH_COUNT_SHIFT = 15; // morph target count in bits 15..22
const V_SIDE_BACK = 1 << 23, V_SIDE_FRONT = 1 << 24; // two-pass transparent DoubleSide materials (three.js renders back faces, then front faces); above the morph-count bits

const ITEM_BATCHABLE = 1, ITEM_MULTIDRAWABLE = 2; // list.flags bits, see _pushItem
const defaultOnBeforeRender = Object3D.prototype.onBeforeRender;
const defaultOnAfterRender = Object3D.prototype.onAfterRender;

/**
 * WebGL2 renderer with the three.js WebGLRenderer API.
 *
 * Differences that matter for speed (see ARCHITECTURE.md):
 *  - Objects are culled from cached world-space bounding spheres and sorted
 *    with packed numeric keys (no comparator).
 *  - Camera, lights and per-material constants live in uniform blocks that
 *    are uploaded once per frame / once per material change.
 *  - Consecutive objects that share geometry + material are drawn with one
 *    instanced draw call ("auto batching"), and the instance buffer is only
 *    re-uploaded when one of them actually moved.
 *  - Per object, the only GPU traffic is a single matrix upload taken directly
 *    from slab memory with the WebGL2 srcOffset overload.
 */
class WebGLRenderer {
	constructor(parameters = {}) {
		const {
			canvas = createCanvasElement(), context = null, depth = true, stencil = false, alpha = false, antialias = false,
			premultipliedAlpha = true, preserveDrawingBuffer = false, powerPreference = 'default', failIfMajorPerformanceCaveat = false,
		} = parameters;
		this.isWebGLRenderer = true;
		this.domElement = canvas;
		/**
		 * debug.traceUniforms = true records, per render() call, every uniform upload that actually
		 * reached GL (name -> count) plus program switches and draws, into debug.uniformTrace (last 16 calls).
		 */
		this.debug = { checkShaderErrors: true, onShaderError: null, traceUniforms: false, uniformTrace: [], verifyListReuse: false, listReuse: { rebuilt: 0, same: 0, cameraOnly: 0, commandsReplayed: 0, mismatches: 0 }, flatUpdate: { merged: 0, split: 0, projectOnly: 0, rebuilds: 0 } };
		this._traceUniforms = null;
		this.autoClear = true; this.autoClearColor = true; this.autoClearDepth = true; this.autoClearStencil = true;
		this.sortObjects = true;
		/** Draw consecutive objects sharing geometry and material with one instanced draw call. */
		this.autoBatch = true;
		/** Smallest run of identical geometry+material that is drawn as one instanced call (shorter runs draw individually, avoiding a program switch to the instanced variant). */
		this.autoBatchMinimum = 4;
		/**
		 * Draw runs of built-in-material meshes with DIFFERENT geometries as one multiDrawElements call
		 * (geometries are packed into shared buffers; matrices come from a per-frame matrix texture).
		 * Requires WEBGL_multi_draw; falls back to instanced batching of identical geometries otherwise.
		 */
		this.autoMultiDraw = true;
		/** Single draws of geometries held in a mega-buffer page use the page's VAO (fewer vertex-array binds); false restores per-geometry VAOs. */
		this.pagedDraws = true;
		/**
		 * Let one batch span several built-in materials that share a program, GL state and textures:
		 * each instance / sub-draw selects its material record from a window of the material uniform
		 * buffer (`Materials` block) by an index stored with its matrices. Requires dynamic indexing of
		 * uniform-block arrays (probed at start-up); otherwise batches break at every material change.
		 */
		this.autoBatchMaterials = true;
		this.clippingPlanes = [];
		this.localClippingEnabled = false;
		this.toneMapping = NoToneMapping;
		this.toneMappingExposure = 1.0;
		this.transmissionResolutionScale = 1.0;
		this._outputColorSpace = SRGBColorSpace;

		let gl = context;
		if (gl === null) {
			const attrs = { alpha: true, depth, stencil, antialias, premultipliedAlpha, preserveDrawingBuffer, powerPreference, failIfMajorPerformanceCaveat };
			gl = canvas.getContext('webgl2', attrs);
			if (gl === null) throw new Error('jrs.WebGLRenderer: WebGL2 is required but could not be created.');
		}
		this._gl = gl;
		this._alpha = alpha;
		this._premultipliedAlpha = premultipliedAlpha;
		this._width = canvas.width; this._height = canvas.height;
		this._pixelRatio = 1;
		this._viewport = new Vector4(0, 0, this._width, this._height);
		this._scissor = new Vector4(0, 0, this._width, this._height);
		this._scissorTest = false;
		this._currentViewport = new Vector4();
		this._currentScissor = new Vector4();
		this._clearColor = new Color(0x000000);
		this._clearAlpha = alpha ? 0 : 1;
		this._currentRenderTarget = null;
		this._activeCubeFace = 0;
		this._activeMipmapLevel = 0;
		this.coordinateSystem = WebGLCoordinateSystem;
		this._renderCallDepth = 0;
		this._inDrawList = false;
		this._nestedStates = []; this._nestedDepth = 0;
		this._frameId = 0;
		this._cameraLayerMask = 1;
		this._envVersion = 0;
		// env version = lights epoch * 65536 + interned id of the (tone mapping, colour space, shadows, fog)
		// state, so switching between render targets and the screen revisits the same version instead
		// of minting a new one, and no string key is built per frame
		this._lightsEpoch = 0;
		this._envKeyId = -1;
		this._envKeyIds = new Map();
		this._colorSpaceIds = new Map([['srgb-linear', 0], ['srgb', 1]]);
		this._lastLightsVersion = -1;
		this._samplerStamp = 0;
		this._programCounter = 0;
		this._currentScene = null;
		this._currentSide = -1;
		this._materialCounter = 0; this._geometryCounter = 0;
		this._isContextLost = false;
		this._onContextLost = this._onContextLost.bind(this);
		this._onContextRestore = this._onContextRestore.bind(this);
		canvas.addEventListener && canvas.addEventListener('webglcontextlost', this._onContextLost, false);
		canvas.addEventListener && canvas.addEventListener('webglcontextrestored', this._onContextRestore, false);

		this.info = new WebGLInfo(gl);
		this.state = new WebGLState(gl);
		this.attributes = new WebGLAttributes(gl);
		this.textures = new WebGLTextures(gl, this.state, this.info);
		this.programs = new WebGLPrograms(gl, this);
		this.renderLists = new WebGLRenderLists();
		this.lights = new WebGLLights();
		this.bindingStates = new WebGLBindingStates(gl, this.state, this.attributes, this.info);
		this.batcher = new WebGLBatcher(gl);
		this.multiDrawExt = gl.getExtension('WEBGL_multi_draw');
		this.megaBuffers = this.multiDrawExt !== null ? new WebGLMegaBuffers(gl, this.state, this.info) : null;
		this._mdCounts = new Int32Array(1024); this._mdOffsets = new Int32Array(1024); this._mdN = 0;
		this._mdUsedThisFrame = false;
		this.morphtargets = new WebGLMorphtargets(this.textures.maxTextureSize);
		this.shadowMap = new WebGLShadowMap(this);
		this.environments = new WebGLEnvironments(this);
		this.background = new WebGLBackground(this);
		this.properties = { get: (obj) => this._materialProps(obj) };
		this.info.programs = this.programs.programs;
		this.capabilities = {
			isWebGL2: true,
			maxTextures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
			maxVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
			maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
			maxCubemapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
			maxAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
			maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
			maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS),
			maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
			maxSamples: gl.getParameter(gl.MAX_SAMPLES),
			precision: 'highp', logarithmicDepthBuffer: false, reversedDepthBuffer: false, vertexTextures: true, floatFragmentTextures: true, floatVertexTextures: true,
			getMaxAnisotropy: () => this.textures.maxAnisotropy, getMaxPrecision: () => 'highp',
		};
		const extCache = {};
		this.extensions = {
			get: (name) => { if (extCache[name] === undefined) extCache[name] = gl.getExtension(name); return extCache[name]; },
			has: (name) => this.extensions.get(name) !== null,
			init: () => {},
		};
		this.xr = { enabled: false, isPresenting: false, cameraAutoUpdate: true, getCamera: () => null, updateCamera: () => {}, setAnimationLoop: () => {}, addEventListener: () => {}, removeEventListener: () => {}, getSession: () => null, setSession: async () => {}, getFrame: () => null, getReferenceSpace: () => null, setReferenceSpaceType: () => {}, setFramebufferScaleFactor: () => {}, getFoveation: () => undefined, setFoveation: () => {}, hasDepthSensing: () => false, getDepthSensingMesh: () => null };

		// uniform buffers
		this._frameData = new Float32Array(FRAME_BLOCK_SIZE / 4);
		// copies of what the GPU buffers currently hold: an unchanged block is not re-uploaded
		this._frameUploaded = new Float32Array(FRAME_BLOCK_SIZE / 4);
		this._lightsUploaded = new Float32Array(LIGHTS_BLOCK_SIZE / 4);
		this._blocksValid = false;
		this._frameBuffer = gl.createBuffer();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
		gl.bufferData(gl.UNIFORM_BUFFER, FRAME_BLOCK_SIZE, gl.DYNAMIC_DRAW);
		this._lightsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
		gl.bufferData(gl.UNIFORM_BUFFER, LIGHTS_BLOCK_SIZE, gl.DYNAMIC_DRAW);
		this._materialStride = Math.max(MATERIAL_BLOCK_SIZE, this.state.uboAlignment);
		// Material-index batching binds a window of `_materialWindow` consecutive material records as one
		// block; the window must fit MAX_UNIFORM_BLOCK_SIZE (16 KB on some mobile GPUs -> 128 records of
		// 128 B) and is capped so the shader's array stays small. Records are padded to the buffer stride.
		this._materialWindow = Math.max(1, Math.min(256, Math.floor(gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE) / this._materialStride)));
		this._materialPad = (this._materialStride - MATERIAL_BLOCK_SIZE) / 16;
		this._materialArrayOk = probeMaterialArray(gl);
		this._batchGroups = new Map();
		this._batchSigScratch = new Float64Array(BATCH_SIG_SIZE);
		// capacity is a multiple of the window so every window lies inside the buffer
		this._materialCapacity = Math.ceil(256 / this._materialWindow) * this._materialWindow;
		this._materialBuffer = gl.createBuffer();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._materialBuffer);
		gl.bufferData(gl.UNIFORM_BUFFER, this._materialStride * this._materialCapacity, gl.DYNAMIC_DRAW);
		gl.bindBuffer(gl.UNIFORM_BUFFER, null);
		this._materialSlotsUsed = 0;
		this._materialFreeSlots = [];
		this._materialScratch = new Float32Array(MATERIAL_BLOCK_SIZE / 4);
		this.state.bindUniformBufferRange(BLOCK_FRAME, this._frameBuffer, 0, FRAME_BLOCK_SIZE);
		this.state.bindUniformBufferRange(BLOCK_LIGHTS, this._lightsBuffer, 0, LIGHTS_BLOCK_SIZE);

		this._materialProperties = new WeakMap();
		this._wireframeGeometries = new WeakMap();
		this._onMaterialDispose = this._onMaterialDispose.bind(this);

		// render-order ranking (renderOrder -> 0..63), rebuilt per frame
		this._renderOrderList = [];
		this._lastNotedRenderOrder = NaN;
		this._rankOfRenderOrder = (ro) => this._rankOf(ro);

		// draw commands
		this._cmdCapacity = 1024;
		this._cmdItem = new Array(this._cmdCapacity);
		this._cmdOffset = new Int32Array(this._cmdCapacity);
		this._cmdCount = new Int32Array(this._cmdCapacity);
		this._cmdKind = new Int8Array(this._cmdCapacity);
		this._cmdMdStart = new Int32Array(this._cmdCapacity);
		this._cmdN = 0;
		/** Reuse the previous frame's sorted render list and draw commands when nothing relevant changed (see WebGLRenderListCache). */
		this.reuseRenderLists = true;
		/**
		 * Update world matrices, cull and collect render items in one flat loop over a per-scene array (core/FlatGraph.js)
		 * instead of the recursive `scene.updateMatrixWorld()` + `_projectObject` walks. `false` restores the recursive walks.
		 */
		this.flatSceneUpdate = true;
		this._flatGraph = null;     // FlatGraph of the scene being rendered (null: recursive walks)
		this._flatMerged = false;   // this render() updates matrices and projects in the same loop (animated scene)
		this._deferSkeletons = false; this._skinnedPending = []; // skeleton.update() runs after a merged pass (bones may follow their mesh)
		this._zTmp = new Float64Array(1);
		this._rec = null;          // RenderListCache being recorded during a build, else null
		this._buildSeq = 0;        // command builds so far (stamps geometries noted in _megaTouch)
		this._touchMap = new Map(); // reused by every command build that records into a cache
		this._megaTouch = null;    // Map geometry -> mega-buffer record touched while building commands, else null
		this._verifyList = null;

		// draw-time cache
		this._currentProgram = null;
		this._currentMaterial = null;
		this._currentCamera = null;
		this._currentGeometryRecord = null;

		this._animationLoop = null;
		this._requestId = null;
		this._onAnimationFrame = this._onAnimationFrame.bind(this);
	}

	// ------------------------------------------------------------------ public API

	get outputColorSpace() { return this._outputColorSpace; }
	set outputColorSpace(v) { this._outputColorSpace = v; }
	getContext() { return this._gl; }
	getContextAttributes() { return this._gl.getContextAttributes(); }
	forceContextLoss() { const ext = this.extensions.get('WEBGL_lose_context'); if (ext) ext.loseContext(); }
	forceContextRestore() { const ext = this.extensions.get('WEBGL_lose_context'); if (ext) ext.restoreContext(); }
	getPixelRatio() { return this._pixelRatio; }
	setPixelRatio(value) { if (value === undefined) return; this._pixelRatio = value; this.setSize(this._width, this._height, false); }
	getSize(target) { return target.set(this._width, this._height); }
	setSize(width, height, updateStyle = true) {
		this._width = width; this._height = height;
		const canvas = this.domElement;
		canvas.width = Math.floor(width * this._pixelRatio);
		canvas.height = Math.floor(height * this._pixelRatio);
		if (updateStyle === true && canvas.style) { canvas.style.width = width + 'px'; canvas.style.height = height + 'px'; }
		this.setViewport(0, 0, width, height);
	}
	getDrawingBufferSize(target) { return target.set(this._width * this._pixelRatio, this._height * this._pixelRatio).floor(); }
	setDrawingBufferSize(width, height, pixelRatio) {
		this._width = width; this._height = height; this._pixelRatio = pixelRatio;
		this.domElement.width = Math.floor(width * pixelRatio); this.domElement.height = Math.floor(height * pixelRatio);
		this.setViewport(0, 0, width, height);
	}
	getCurrentViewport(target) { return target.copy(this._currentViewport); }
	getViewport(target) { return target.copy(this._viewport); }
	setViewport(x, y, width, height) {
		if (x.isVector4) this._viewport.set(x.x, x.y, x.z, x.w); else this._viewport.set(x, y, width, height);
		this.state.viewport(this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio).round().x, this._currentViewport.y, this._currentViewport.z, this._currentViewport.w);
	}
	getScissor(target) { return target.copy(this._scissor); }
	setScissor(x, y, width, height) {
		if (x.isVector4) this._scissor.set(x.x, x.y, x.z, x.w); else this._scissor.set(x, y, width, height);
		this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio).round();
		this.state.scissor(this._currentScissor.x, this._currentScissor.y, this._currentScissor.z, this._currentScissor.w);
	}
	getScissorTest() { return this._scissorTest; }
	setScissorTest(boolean) { this.state.setScissorTest(this._scissorTest = boolean); }
	setOpaqueSort() { console.warn('jrs.WebGLRenderer: setOpaqueSort is not supported; opaque objects are sorted by packed state keys.'); }
	setTransparentSort() { console.warn('jrs.WebGLRenderer: setTransparentSort is not supported.'); }
	getClearColor(target) { return target.copy(this._clearColor); }
	setClearColor(color, alpha = 1) { this._clearColor.set(color); this._clearAlpha = alpha; this._applyClearColor(); }
	getClearAlpha() { return this._clearAlpha; }
	setClearAlpha(alpha) { this._clearAlpha = alpha; this._applyClearColor(); }
	_applyClearColor() {
		let a = this._clearAlpha;
		_color.copy(this._clearColor);
		// three.js converts clear/background colours to the output colour space only for the canvas; render
		// targets are cleared with the working-space (linear) value (an sRGB render target encodes in hardware)
		if (this._currentRenderTarget === null) ColorManagement.fromWorkingColorSpace(_color, this._outputColorSpace);
		let r = _color.r, g = _color.g, b = _color.b;
		if (this._premultipliedAlpha) { r *= a; g *= a; b *= a; }
		this.state.setClearColor(r, g, b, a);
	}
	clear(color = true, depth = true, stencil = true) {
		const gl = this._gl;
		let bits = 0;
		if (color) { bits |= gl.COLOR_BUFFER_BIT; this.state.setColorMask(true); } // a colorWrite=false material may have left the mask off (three.js resets it before clearing)
		if (depth) { bits |= gl.DEPTH_BUFFER_BIT; this.state.setDepthMask(true); }
		if (stencil) { bits |= gl.STENCIL_BUFFER_BIT; this.state.setStencilMask(0xffffffff); }
		gl.clear(bits);
	}
	clearColor() { this.clear(true, false, false); }
	clearDepth() { this.clear(false, true, false); }
	clearStencil() { this.clear(false, false, true); }
	dispose() {
		const canvas = this.domElement;
		canvas.removeEventListener && canvas.removeEventListener('webglcontextlost', this._onContextLost, false);
		canvas.removeEventListener && canvas.removeEventListener('webglcontextrestored', this._onContextRestore, false);
		this.programs.dispose();
		this.batcher.dispose();
		this.environments.dispose();
		this.background.dispose();
		if (this.megaBuffers !== null) this.megaBuffers.dispose();
		this._gl.deleteBuffer(this._frameBuffer); this._gl.deleteBuffer(this._lightsBuffer); this._gl.deleteBuffer(this._materialBuffer);
		this.setAnimationLoop(null);
	}
	_onContextLost(event) { event.preventDefault(); this._isContextLost = true; }
	_onContextRestore() { this._isContextLost = false; this._blocksValid = false; this.state.reset(); this.programs.dispose(); this._materialProperties = new WeakMap(); this.shadowMap._epoch++; this.renderLists.dispose(); }
	setAnimationLoop(callback) {
		this._animationLoop = callback;
		if (this._requestId !== null) { cancelAnimationFrame(this._requestId); this._requestId = null; }
		if (callback !== null) this._requestId = requestAnimationFrame(this._onAnimationFrame);
	}
	_onAnimationFrame(time) {
		if (this._animationLoop !== null) this._animationLoop(time);
		if (this._animationLoop !== null) this._requestId = requestAnimationFrame(this._onAnimationFrame);
	}
	getRenderTarget() { return this._currentRenderTarget; }
	getActiveCubeFace() { return this._activeCubeFace; }
	getActiveMipmapLevel() { return this._activeMipmapLevel; }
	setRenderTarget(renderTarget, activeCubeFace = 0, activeMipmapLevel = 0) {
		this._currentRenderTarget = renderTarget;
		this._activeCubeFace = activeCubeFace;
		this._activeMipmapLevel = activeMipmapLevel; // accepted for API parity; level 0 is rendered
		const state = this.state;
		if (renderTarget !== null) {
			const framebuffer = this.textures.setupRenderTarget(renderTarget);
			state.bindFramebuffer(framebuffer);
			if (renderTarget.isWebGLCubeRenderTarget === true) this.textures.attachCubeFace(renderTarget, activeCubeFace);
			this._currentViewport.copy(renderTarget.viewport);
			this._currentScissor.copy(renderTarget.scissor);
			state.setScissorTest(renderTarget.scissorTest);
		} else {
			state.bindFramebuffer(null);
			this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio).round();
			this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio).round();
			state.setScissorTest(this._scissorTest);
		}
		state.viewport(this._currentViewport.x, this._currentViewport.y, this._currentViewport.z, this._currentViewport.w);
		state.scissor(this._currentScissor.x, this._currentScissor.y, this._currentScissor.z, this._currentScissor.w);
	}
	readRenderTargetPixels(renderTarget, x, y, width, height, buffer) {
		const gl = this._gl;
		const framebuffer = this.textures.setupRenderTarget(renderTarget);
		const prev = this.state.currentFramebuffer;
		this.state.bindFramebuffer(framebuffer);
		const texture = renderTarget.texture;
		gl.readPixels(x, y, width, height, this.textures.glFormat(texture.format), this.textures.glType(texture.type), buffer);
		this.state.bindFramebuffer(prev);
	}
	async readRenderTargetPixelsAsync(renderTarget, x, y, width, height, buffer) { this.readRenderTargetPixels(renderTarget, x, y, width, height, buffer); return buffer; }
	resetState() { this.state.reset(); this.bindingStates.reset(); this._currentProgram = null; this._currentMaterial = null; this._currentGeometryRecord = null; }
	compile(scene, camera, targetScene = null) {
		if (targetScene === null) targetScene = scene;
		this._updateEnv(targetScene);
		this.lights.begin();
		targetScene.traverse((o) => { if (o.isLight) this.lights.push(o); });
		this.lights.end(this.shadowMap.enabled, this.shadowMap.type !== VSMShadowMap);
		this.lights.fill();
		scene.traverse((o) => {
			if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && o.material) {
				const mats = Array.isArray(o.material) ? o.material : [o.material];
				for (const m of mats) this._getProgram(m, o, targetScene, this._variantFor(o, o.geometry, m, false));
			}
		});
		return new Set();
	}
	async compileAsync(scene, camera, targetScene = null) { this.compile(scene, camera, targetScene); }
	copyFramebufferToTexture(texture, position = null, level = 0) {
		const gl = this._gl;
		this.textures.setTexture2D(texture, 0);
		const x = position !== null ? position.x : 0, y = position !== null ? position.y : 0;
		gl.copyTexSubImage2D(gl.TEXTURE_2D, level, 0, 0, x, y, texture.image.width, texture.image.height);
	}

	// ------------------------------------------------------------------ render

	render(scene, camera) {
		if (camera === undefined || camera.isCamera !== true) { console.error('jrs.WebGLRenderer.render: camera is not an instance of Camera.'); return; }
		if (this._isContextLost === true) return;
		const gl = this._gl;
		// environment-map conversions (equirect -> cube, PMREM) render on their own; run them before this frame's state is live
		const backgroundTexture = this.background.resolve(scene);
		if (scene.isScene === true && scene.environment !== null) this.environments.get(scene.environment, true);
		const savedFlat = this._flatGraph, savedMerged = this._flatMerged;
		const flat = this.flatSceneUpdate === true && scene.isObject3D === true ? this._flatGraphFor(scene) : null;
		if (flat !== null) {
			// the frustum needs the camera's final world matrix before the pass: a parentless camera updates itself, a camera
			// inside this scene is updated with its ancestor chain (the pass then finds that chain up to date)
			if (camera.parent === null) { if (camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld(); }
			else if (scene.matrixWorldAutoUpdate === true && isDescendantOf(camera, scene)) camera.updateWorldMatrix(true, false);
		} else {
			if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
			if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
		}
		this._frameId = ++_frameCounter;
		this._renderCallDepth++;
		this._currentCamera = camera;
		this._currentScene = scene;
		this._materialCounter = 0; this._geometryCounter = 0; this._programCounter = 0;
		this._currentMaterial = null; this._currentProgram = null; this._currentSide = -1; this._sideOverride = -1; this._listShadowPass = false;
		this._traceUniforms = this.debug.traceUniforms === true ? new Map() : null;
		this._traceSwitches = 0; this._traceDraws = this.info.render.calls; this._traceSeq = this._traceUniforms !== null ? [] : null; this._traceList = 'o';
		this._updateEnv(scene);

		_projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		_frustum.setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);

		const list = this.renderLists.get(scene, this._renderCallDepth - 1, camera);
		const cache = list.cache;
		if (flat !== null) {
			// A list that cannot be reused anyway (no recorded dependencies, epochs moved, or the last pass moved something: the
			// scene is animating) is built in one loop that also updates the matrices. Otherwise the matrices are updated in a
			// loop of their own first, so an unchanged frame can reuse its list without projecting.
			const update = scene.matrixWorldAutoUpdate === true;
			const merged = update && (cache.hasSig === false || cache.flatChanged === true || this.reuseRenderLists === false ||
				cache.structure !== epochs.structure || cache.world !== epochs.world);
			if (update && merged === false) {
				if (this._flatPass(flat, scene, camera, null, true, false, false) === false) {
					// a children.length differed from the graph (direct edit): rebuild and finish the update
					const changed = flat.changed; flat.rebuild(); this.debug.flatUpdate.rebuilds++;
					this._flatPass(flat, scene, camera, null, true, false, false); flat.changed = flat.changed || changed;
				}
				cache.flatChanged = flat.changed;
			}
			this._flatGraph = flat; this._flatMerged = merged;
			this.debug.flatUpdate[merged ? 'merged' : update ? 'split' : 'projectOnly']++;
		} else { this._flatGraph = null; this._flatMerged = false; }
		const level = this._prepareList(list, cache, scene, camera);
		// verify a reused list before the shadow pass: its draws run onBeforeRender hooks, and a hook that edits the scene
		// would make a fresh build differ from any list built at this point of the frame (reused or not)
		if (level >= 0 && this.debug.verifyListReuse === true && cache.resort === false) this._verifyReuse(list, scene, camera, level);

		if (this.info.autoReset === true && this._renderCallDepth === 1) { this.info.reset(); this._traceDraws = 0; }

		// shadows (renders into other targets; restores ours)
		this.shadowMap.render(this.lights, scene, camera);
		this._inDrawList = false;

		// per-frame blocks (light data is filled after the shadow pass so shadow matrices are current)
		this.lights.fill();
		if (!this._blocksValid || !sameFloats(this.lights.data, this._lightsUploaded)) {
			this._lightsUploaded.set(this.lights.data);
			gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
			gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.lights.data);
			this.state.currentUniformBuffer = this._lightsBuffer;
		}
		this._uploadFrameBlock(camera, scene);
		this._blocksValid = true;
		this.shadowMap.bindShadowMaps(this.lights);

		if (level < 0) list.finish(this.sortObjects, this._rankOfRenderOrder);
		else {
			if (cache.resort === true) {
				cache.resort = false; list.resortTransparent(this.sortObjects, this._rankOfRenderOrder, cache.itemZ);
				if (this.debug.verifyListReuse === true) this._verifyReuse(list, scene, camera, level);
			}
		}

		// background + clear
		const background = scene.isScene === true ? scene.background : null;
		if (background !== null && background.isColor) {
			_color.copy(background);
			if (this._currentRenderTarget === null) ColorManagement.fromWorkingColorSpace(_color, this._outputColorSpace);
			this.state.setClearColor(_color.r, _color.g, _color.b, 1);
			if (this.autoClear || this.autoClearColor) this.clear(true, this.autoClearDepth, this.autoClearStencil);
			this._applyClearColor();
		} else if (this.autoClear) {
			this._applyClearColor(); // the conversion depends on the current render target
			this.clear(this.autoClearColor, this.autoClearDepth, this.autoClearStencil);
		}

		if (backgroundTexture !== null) this.background.render(scene, camera, backgroundTexture);

		if (scene.isScene === true) scene.onBeforeRender(this, scene, camera, this._currentRenderTarget);
		this._drawList(list, list.opaqueSorted, list.opaqueCount, scene, camera, false, cache.ready === true ? cache.cmdOpaque : null, list.opaqueVersion);
		this._drawList(list, list.transparentSorted, list.transparentCount, scene, camera, false, cache.ready === true ? cache.cmdTransparent : null, list.transparentVersion);
		if (scene.isScene === true) scene.onAfterRender(this, scene, camera);
		this._inDrawList = false;

		if (this._currentRenderTarget !== null) this.textures.updateRenderTargetMipmap(this._currentRenderTarget);
		this.state.bindVertexArray(null);
		this._currentGeometryRecord = null;
		if (this._traceUniforms !== null) {
			const t = this.debug.uniformTrace;
			const seq = this._traceSeq;
			const distinct = new Set(); for (let i = 0; i < seq.length; i++) distinct.add(seq[i].id);
			t.push({
				pass: t.length, target: this._currentRenderTarget === null ? 'canvas' : 'renderTarget',
				uniforms: Object.fromEntries(this._traceUniforms), useProgram: this._traceSwitches, draws: this.info.render.calls - this._traceDraws,
				distinctPrograms: distinct.size,
				// one entry per useProgram: program id, list (o = opaque, t = transparent, s = shadow pass), renderOrder, material type
				programSequence: seq.map((e) => `${e.id}${e.list}${e.renderOrder !== 0 ? '/r' + e.renderOrder : ''}:${e.material}`).join(' '),
			});
			if (t.length > 16) t.shift();
			this._traceUniforms = null;
		}
		this._flatGraph = savedFlat; this._flatMerged = savedMerged;
		this._renderCallDepth--;
		if (this._renderCallDepth === 0) this.info.render.frame++;
	}

	/** The scene's flat graph, built on first use and rebuilt when a patch was not possible or `children` was edited directly. */
	_flatGraphFor(scene) {
		let g = scene._flatGraph;
		if (g === null) { g = new FlatGraph(scene); scene._flatGraph = g; }
		if (g.valid === false) { g.rebuild(); this.debug.flatUpdate.rebuilds++; }
		g.patches = 0;
		return g;
	}

	// ------------------------------------------------------------------ render-list reuse

	/**
	 * Fills `list` for this frame: reuses the previous frame's list when nothing it was built from changed
	 * (level 0), when only the camera moved and no cull result flipped (level 1), else rebuilds it (-1).
	 * Either way the frame's lights, render-order ranks and per-frame ids end up as a rebuild would leave them.
	 */
	_prepareList(list, cache, scene, camera) {
		const stats = this.debug.listReuse;
		this._cameraLayerMask = camera.layers.mask;
		let level = -1;
		const view = camera.matrixWorldInverse.elements, pv = _projScreenMatrix.elements;
		if (this.reuseRenderLists === true && cache.ready === true && this._flatMerged === false) level = this._reuseLevel(list, cache, scene, camera, view, pv);
		if (level >= 0) {
			this.lights.begin();
			const lights = cache.lights;
			for (let i = 0; i < lights.length; i++) this.lights.push(lights[i]);
			this.lights.end(this.shadowMap.enabled, this.shadowMap.type !== VSMShadowMap);
			if (this.lights.version !== this._lastLightsVersion) { this._lastLightsVersion = this.lights.version; this._lightsEpoch++; this._envVersion = this._lightsEpoch * 65536 + this._envKeyId; }
			if (this._programsUnchanged(cache, scene)) { this._replayFrameState(cache); if (level === 0) stats.same++; else stats.cameraOnly++; return level; }
		}
		stats.rebuilt++;
		this._buildList(list, cache, scene, camera, view, pv);
		return -1;
	}

	_reuseLevel(list, cache, scene, camera, view, pv) {
		if (cache.structure !== epochs.structure || cache.world !== epochs.world) return -1;
		const override = scene.overrideMaterial === undefined ? null : scene.overrideMaterial;
		if (cache.sortObjects !== this.sortObjects || cache.override !== override) return -1;
		const same = cache.sameCamera(camera, view, pv);
		if (!same && !cache.sameCameraLayers(camera)) return -1;
		if (!cache.depsValid()) return -1;
		if (same) return 0;
		if (!this._recull(list, cache, camera)) return -1;
		cache.setCamera(camera, view, pv);
		return 1;
	}

	/** Camera-only change: true when every candidate keeps its cull result; refreshes the items' depth. */
	_recull(list, cache, camera) {
		const cand = cache.cand, inside = cache.candIn, candItem = cache.candItem, items = list.items, itemZ = cache.itemZ;
		const ve = camera.matrixWorldInverse.elements, sortObjects = this.sortObjects;
		cache.resort = false;
		for (let i = 0, n = cand.length; i < n; i++) {
			const object = cand[i];
			let now;
			if (!object.frustumCulled) now = true;
			else if (object.isSprite) now = _frustum.intersectsSprite(object);
			else now = this._cullTest(object, object.geometry, _frustum, false);
			if ((now ? 1 : 0) !== inside[i]) return false;
			const index = candItem[i];
			if (index >= 0 && (sortObjects || object.isSprite)) {
				const item = items[index];
				this._itemDepth(object, ve, this._zTmp);
				const z = this._zTmp[0];
				if (z !== itemZ[index]) { itemZ[index] = z; if (items[index].material.transparent === true) cache.resort = true; }
			}
		}
		return true;
	}

	/** Every recorded (material, variant) must still resolve to the program the list was sorted with. */
	_programsUnchanged(cache, scene) {
		const mats = cache.pMat, variants = cache.pVariant, objects = cache.pObject, programs = cache.pProgram, groups = cache.pGroup, slots = cache.pSlot;
		for (let i = 0, n = mats.length; i < n; i++) {
			const m = mats[i];
			if (this._getProgram(m, objects[i], scene, variants[i]) !== programs[i]) return false;
			// material-index batching: the batch group (GL state, textures, record window) and the record slot feed the sort keys and the matrix texture
			if (this._batchGroupOf(m) !== groups[i] || this._materialProps(m).blockSlot !== slots[i]) return false;
		}
		return true;
	}

	/** Restore the per-frame state a rebuild would have produced: render-order ranks, dense ids and counters. */
	_replayFrameState(cache) {
		this._setRenderOrders(cache.renderOrders);
		const frame = this._frameId;
		const geoms = cache.geoms, gRid = cache.gRid;
		for (let i = 0; i < geoms.length; i++) if (gRid[i] >= 0) { geoms[i]._frameStamp = frame; geoms[i]._frameRid = gRid[i]; }
		const mats = cache.pMat, mRid = cache.pMatRid, programs = cache.pProgram, pRid = cache.pProgRid;
		for (let i = 0; i < mats.length; i++) {
			const m = mats[i]; m._frameStamp = frame; m._frameRid = mRid[i];
			const bg = cache.pGroup[i]; m._batchGroup = bg;
			if (bg !== null) { bg._frameStamp = frame; bg._frameRid = mRid[i]; }
			const p = programs[i]; p._frameStamp = frame; p._frameRid = pRid[i];
		}
		this._materialCounter = cache.materialCounter; this._geometryCounter = cache.geometryCounter; this._programCounter = cache.programCounter;
	}

	_setRenderOrders(sorted) {
		const l = this._renderOrderList;
		l.length = 0; this._lastNotedRenderOrder = NaN;
		for (let i = 0; i < sorted.length; i++) l.push(sorted[i]);
	}

	/** Traverse the scene into `list`; when the frame before was identical, also record what the list depends on. */
	_buildList(list, cache, scene, camera, view, pv) {
		const override = scene.overrideMaterial === undefined ? null : scene.overrideMaterial;
		const flat = this._flatGraph;
		if (this._flatMerged === true) {
			// animated scene: world matrices and render items in one loop; nothing is recorded (the list is new every frame)
			cache.ready = false; cache.resort = false;
			cache.cmdOpaque.invalidate(); cache.cmdTransparent.invalidate();
			this._rec = null;
			this._cameraLayerMask = camera.layers.mask;
			let changed = false;
			for (;;) {
				list.init();
				this.lights.begin();
				this._renderOrderReset();
				if (this._flatPass(flat, scene, camera, list, true, true, this.sortObjects) === true) break;
				changed = changed || flat.changed; flat.rebuild(); this.debug.flatUpdate.rebuilds++; // direct children edit: the rebuilt graph always passes
			}
			flat.changed = flat.changed || changed;
			cache.hasSig = true; cache.structure = epochs.structure; cache.world = epochs.world; cache.sortObjects = this.sortObjects; cache.override = override;
			cache.setCamera(camera, view, pv);
			cache.flatChanged = flat.changed;
			this.lights.end(this.shadowMap.enabled);
			if (this.lights.version !== this._lastLightsVersion) { this._lastLightsVersion = this.lights.version; this._lightsEpoch++; this._envVersion = this._lightsEpoch * 65536 + this._envKeyId; }
			this._resolvePrograms(list, scene);
			return;
		}
		const structure = epochs.structure, world = epochs.world;
		const record = this.reuseRenderLists === true && cache.hasSig && cache.structure === structure && cache.world === world &&
			cache.sortObjects === this.sortObjects && cache.override === override;
		cache.ready = false; cache.resort = false;
		cache.cmdOpaque.invalidate(); cache.cmdTransparent.invalidate();
		cache.hasSig = true; cache.structure = structure; cache.world = world; cache.sortObjects = this.sortObjects; cache.override = override;
		cache.setCamera(camera, view, pv);
		this._cameraLayerMask = camera.layers.mask;
		for (;;) {
			if (record) cache.resetDeps();
			this._rec = record ? cache : null;
			list.init();
			this.lights.begin();
			this._renderOrderReset();
			if (flat === null) { this._projectObject(scene, camera, 0, this.sortObjects, list); break; }
			if (this._flatPass(flat, scene, camera, list, false, true, this.sortObjects) === true) break;
			flat.rebuild(); this.debug.flatUpdate.rebuilds++; // direct children edit: the rebuilt graph always passes
		}
		this._rec = null;
		this.lights.end(this.shadowMap.enabled, this.shadowMap.type !== VSMShadowMap);
		if (this.lights.version !== this._lastLightsVersion) { this._lastLightsVersion = this.lights.version; this._lightsEpoch++; this._envVersion = this._lightsEpoch * 65536 + this._envKeyId; }
		this._resolvePrograms(list, scene);
		if (record && cache.reusable === true && epochs.structure === structure && epochs.world === world) {
			const pMat = cache.pMat;
			for (let i = 0; i < pMat.length; i++) {
				const program = this._getProgram(pMat[i], cache.pObject[i], scene, cache.pVariant[i]);
				cache.pProgram.push(program); cache.pProgRid.push(program._frameRid); cache.pMatRid.push(pMat[i]._frameRid);
				cache.pGroup.push(pMat[i]._batchGroup); cache.pSlot.push(this._materialProps(pMat[i]).blockSlot);
			}
			cache.renderOrders = this._renderOrderList.slice();
			cache.materialCounter = this._materialCounter; cache.geometryCounter = this._geometryCounter; cache.programCounter = this._programCounter;
			cache.snapshot(this._frameId);
			const itemZ = cache.itemZ = new Float64Array(list.count), ve = camera.matrixWorldInverse.elements, cand = cache.cand, candItem = cache.candItem;
			for (let i = 0; i < cand.length; i++) {
				if (candItem[i] < 0) continue;
				if (this.sortObjects || cand[i].isSprite) { this._itemDepth(cand[i], ve, this._zTmp); itemZ[candItem[i]] = this._zTmp[0]; }
			}
			cache.ready = true;
		}
	}

	/** Debug aid (`renderer.debug.verifyListReuse`): rebuild the list from scratch and compare it with the reused one. */
	_verifyReuse(list, scene, camera, level) {
		const scratch = this._verifyList === null ? (this._verifyList = new WebGLRenderList()) : this._verifyList;
		const savedStamps = [this._materialCounter, this._geometryCounter, this._programCounter], savedRanks = this._renderOrderList.slice();
		this._materialCounter = 0; this._geometryCounter = 0; this._programCounter = 0;
		scratch.init(); this.lights.begin(); this._renderOrderReset();
		this._projectObject(scene, camera, 0, this.sortObjects, scratch);
		this.lights.end(this.shadowMap.enabled, this.shadowMap.type !== VSMShadowMap);
		this._resolvePrograms(scratch, scene);
		this._setRenderOrders(savedRanks); // the real finish ranks with the map the (shadow) passes left behind
		scratch.finish(this.sortObjects, this._rankOfRenderOrder);
		let ok = scratch.count === list.count && scratch.opaqueCount === list.opaqueCount && scratch.transparentCount === list.transparentCount;
		for (let i = 0; ok && i < list.count; i++) {
			const a = scratch.items[i], b = list.items[i];
			ok = a.object === b.object && a.material === b.material && a.geometry === b.geometry && a.program === b.program && a.group === b.group;
		}
		for (let i = 0; ok && i < list.opaqueCount; i++) ok = scratch.opaqueSorted[i] === list.opaqueSorted[i];
		for (let i = 0; ok && i < list.transparentCount; i++) ok = scratch.transparentSorted[i] === list.transparentSorted[i];
		this._materialCounter = savedStamps[0]; this._geometryCounter = savedStamps[1]; this._programCounter = savedStamps[2];
		if (!ok) {
			this.debug.listReuse.mismatches++;
			let detail = `counts ${scratch.count}/${list.count} opaque ${scratch.opaqueCount}/${list.opaqueCount} transparent ${scratch.transparentCount}/${list.transparentCount}`;
			for (let i = 0; i < Math.min(scratch.count, list.count); i++) { const a = scratch.items[i], b = list.items[i]; if (a.object !== b.object || a.material !== b.material || a.geometry !== b.geometry || a.program !== b.program || a.group !== b.group) { detail += ` | item ${i}: fresh ${a.object.name || a.object.type}#${a.object.id} mat ${a.material.id} prog ${a.program && a.program.id} vs reused ${b.object.name || b.object.type}#${b.object.id} mat ${b.material.id} prog ${b.program && b.program.id}`; break; } }
			for (let i = 0; i < Math.min(scratch.opaqueCount, list.opaqueCount); i++) if (scratch.opaqueSorted[i] !== list.opaqueSorted[i]) { detail += ` | opaque order differs at ${i}: ${scratch.opaqueSorted[i]} vs ${list.opaqueSorted[i]}`; break; }
			for (let i = 0; i < Math.min(scratch.transparentCount, list.transparentCount); i++) if (scratch.transparentSorted[i] !== list.transparentSorted[i]) { detail += ` | transparent order differs at ${i}: ${scratch.transparentSorted[i]} vs ${list.transparentSorted[i]}`; break; }
			console.error('jrs: reused render list differs from a fresh build (level ' + level + '): ' + detail);
		}
	}

	/**
	 * Environment-map conversions (PMREM, equirect -> cube) render while a frame may be in flight. They
	 * are bracketed by these two calls, which park the frame's collected lights, render-order ranks,
	 * dense-id counters and trace state and bring them back afterwards. Frame ids keep advancing, so
	 * every per-frame cache simply misses once after a nested render.
	 */
	_beginNestedRender() {
		let st = this._nestedStates[this._nestedDepth++];
		if (st === undefined) st = this._nestedStates[this._nestedDepth - 1] = { lights: null, spareLights: new WebGLLights(), renderOrderList: null, spareList: [] };
		st.lights = this.lights; this.lights = st.spareLights;
		st.renderOrderList = this._renderOrderList; this._renderOrderList = st.spareList;
		st.lastNotedRenderOrder = this._lastNotedRenderOrder;
		st.scene = this._currentScene; st.camera = this._currentCamera; st.layerMask = this._cameraLayerMask;
		st.materialCounter = this._materialCounter; st.geometryCounter = this._geometryCounter; st.programCounter = this._programCounter;
		st.envKeyId = this._envKeyId; st.lastLightsVersion = this._lastLightsVersion;
		st.trace = this._traceUniforms; st.traceSeq = this._traceSeq; st.traceSwitches = this._traceSwitches; st.traceDraws = this._traceDraws; st.traceList = this._traceList;
		st.renderTarget = this._currentRenderTarget; st.cubeFace = this._activeCubeFace; st.mipLevel = this._activeMipmapLevel;
		st.inDrawList = this._inDrawList; st.sideOverride = this._sideOverride;
		this._traceUniforms = null; this._traceSeq = null; this._inDrawList = false; this._sideOverride = -1;
	}
	_endNestedRender() {
		const st = this._nestedStates[--this._nestedDepth];
		this.lights = st.lights; this._renderOrderList = st.renderOrderList; this._lastNotedRenderOrder = st.lastNotedRenderOrder;
		this._currentScene = st.scene; this._currentCamera = st.camera; this._cameraLayerMask = st.layerMask;
		this._materialCounter = st.materialCounter; this._geometryCounter = st.geometryCounter; this._programCounter = st.programCounter;
		this._envKeyId = st.envKeyId; this._lastLightsVersion = st.lastLightsVersion;
		// a fresh epoch: program entries resolved inside the nested render can never be mistaken for this frame's
		this._lightsEpoch++; this._envVersion = this._lightsEpoch * 65536 + this._envKeyId;
		this._traceUniforms = st.trace; this._traceSeq = st.traceSeq; this._traceSwitches = st.traceSwitches; this._traceDraws = st.traceDraws; this._traceList = st.traceList;
		this._inDrawList = st.inDrawList; this._sideOverride = st.sideOverride;
		if (this._currentRenderTarget !== st.renderTarget || this._activeCubeFace !== st.cubeFace) this.setRenderTarget(st.renderTarget, st.cubeFace, st.mipLevel);
		this._currentMaterial = null; this._currentSide = -1; this._currentGeometryRecord = null;
		this.state.bindVertexArray(null);
	}

	_renderOrderReset() { this._renderOrderList.length = 0; this._lastNotedRenderOrder = NaN; }
	/** Index of `ro` in the sorted distinct-renderOrder list, or the insertion point (binary search). */
	_renderOrderIndex(ro) {
		const l = this._renderOrderList;
		let lo = 0, hi = l.length;
		while (lo < hi) { const mid = (lo + hi) >> 1; if (l[mid] < ro) lo = mid + 1; else hi = mid; }
		return lo;
	}
	_noteRenderOrder(ro) {
		if (ro === this._lastNotedRenderOrder) return;
		this._lastNotedRenderOrder = ro;
		const l = this._renderOrderList, at = this._renderOrderIndex(ro);
		if (at < l.length && l[at] === ro) return;
		l.push(ro); // sorted insertion by hand: no comparator closure, no splice result array
		for (let i = l.length - 1; i > at; i--) l[i] = l[i - 1];
		l[at] = ro;
	}
	_rankOf(ro) {
		const l = this._renderOrderList;
		if (l.length <= 1) return 0;
		const at = this._renderOrderIndex(ro);
		return at < l.length && l[at] === ro ? (at < 63 ? at : 63) : 63;
	}

	/** Detects changes in frame-wide shader-affecting state and bumps the env version. */
	_updateEnv(scene) {
		const target = this._currentRenderTarget;
		const cs = target === null ? this._outputColorSpace : target.texture.colorSpace;
		const fog = scene.fog == null ? 0 : (scene.fog.isFogExp2 ? 2 : 1);
		let csId = this._colorSpaceIds.get(cs);
		if (csId === undefined) { csId = this._colorSpaceIds.size; this._colorSpaceIds.set(cs, csId); }
		const shadowKind = this.shadowMap.enabled ? (this.shadowMap.type === BasicShadowMap ? 2 : (this.shadowMap.type === VSMShadowMap ? 3 : 1)) : 0;
		const key = ((this.toneMapping * 64 + csId) * 4 + shadowKind) * 3 + fog;
		let id = this._envKeyIds.get(key);
		if (id === undefined) { id = this._envKeyIds.size % 65536; this._envKeyIds.set(key, id); }
		if (id !== this._envKeyId) { this._envKeyId = id; this._envVersion = this._lightsEpoch * 65536 + id; }
	}

	_uploadFrameBlock(camera, scene) {
		const gl = this._gl, d = this._frameData;
		const pe = camera.projectionMatrix.elements, ve = camera.matrixWorldInverse.elements;
		for (let i = 0; i < 16; i++) { d[i] = pe[i]; d[16 + i] = ve[i]; }
		_projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		const pse = _projScreenMatrix.elements;
		for (let i = 0; i < 16; i++) d[32 + i] = pse[i];
		const we = camera.matrixWorld.elements;
		d[48] = we[12]; d[49] = we[13]; d[50] = we[14]; d[51] = camera.isOrthographicCamera ? 1 : 0;
		const fog = scene.fog;
		if (fog !== null && fog !== undefined) {
			// three.js uploads the fog colour in the "unlit uniform colour space": the output colour space when
			// rendering to the canvas, the (linear) working colour space when rendering to a render target
			_color.copy(fog.color);
			if (this._currentRenderTarget === null) ColorManagement.fromWorkingColorSpace(_color, this._outputColorSpace);
			d[52] = _color.r; d[53] = _color.g; d[54] = _color.b; d[55] = fog.isFogExp2 ? 2 : 1;
			d[56] = fog.near !== undefined ? fog.near : 0; d[57] = fog.far !== undefined ? fog.far : 0; d[58] = fog.density !== undefined ? fog.density : 0;
		} else {
			d[52] = 0; d[53] = 0; d[54] = 0; d[55] = 0; d[56] = 0; d[57] = 0; d[58] = 0;
		}
		d[59] = this.toneMappingExposure;
		const v = this._currentViewport;
		d[60] = v.x; d[61] = v.y; d[62] = v.z; d[63] = v.w;
		if (this._blocksValid && sameFloats(d, this._frameUploaded)) return;
		this._frameUploaded.set(d);
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
		gl.bufferSubData(gl.UNIFORM_BUFFER, 0, d);
		this.state.currentUniformBuffer = this._frameBuffer;
	}

	// ------------------------------------------------------------------ projection / culling

	/** World-space bounding sphere test against `frustum`, with the sphere cached in slab memory per world version. */
	_cullTest(object, geometry, frustum, shadowPass) {
		let bs;
		if (object.boundingSphere !== undefined) {
			// InstancedMesh and SkinnedMesh carry their own sphere (three.js Frustum.intersectsObject rule)
			if (object.boundingSphere === null) object.computeBoundingSphere();
			bs = object.boundingSphere;
		} else {
			if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
			bs = geometry.boundingSphere;
		}
		const s = object._slabData, o = object._slabOffset;
		const c = bs.center;
		// double-valued cache keys live in the object's snapshot record, contiguous with the change-detection data
		const n = object._snapData, q = object._snapOffset + 10;
		const cx = c.x, cy = c.y, cz = c.z, r = bs.radius;
		if (object._cullVersion !== object._worldVersion || object._cullSphere !== bs || n[q] !== r || n[q + 1] !== cx || n[q + 2] !== cy || n[q + 3] !== cz) {
			const e = o + 16;
			const e0 = s[e], e1 = s[e + 1], e2 = s[e + 2], e4 = s[e + 4], e5 = s[e + 5], e6 = s[e + 6], e8 = s[e + 8], e9 = s[e + 9], e10 = s[e + 10];
			s[o + 41] = e0 * cx + e4 * cy + e8 * cz + s[e + 12];
			s[o + 42] = e1 * cx + e5 * cy + e9 * cz + s[e + 13];
			s[o + 43] = e2 * cx + e6 * cy + e10 * cz + s[e + 14];
			const sx = e0 * e0 + e1 * e1 + e2 * e2, sy = e4 * e4 + e5 * e5 + e6 * e6, sz = e8 * e8 + e9 * e9 + e10 * e10;
			s[o + 44] = r * Math.sqrt(sx > sy ? (sx > sz ? sx : sz) : (sy > sz ? sy : sz));
			object._cullVersion = object._worldVersion; object._cullSphere = bs;
			n[q] = r; n[q + 1] = cx; n[q + 2] = cy; n[q + 3] = cz;
			object._cullFV0 = -1; object._cullFV1 = -1;
		}
		// a static object under a static frustum keeps its previous result (frustum.version changes with any plane float)
		const fv = frustum.version;
		if (shadowPass === true) {
			if (object._cullFV1 === fv) return object._cullVis1;
			const vis = frustum.intersectsSphereFlat(s[o + 41], s[o + 42], s[o + 43], s[o + 44]);
			object._cullFV1 = fv; object._cullVis1 = vis;
			return vis;
		}
		if (object._cullFV0 === fv) return object._cullVis0;
		const vis = frustum.intersectsSphereFlat(s[o + 41], s[o + 42], s[o + 43], s[o + 44]);
		object._cullFV0 = fv; object._cullVis0 = vis;
		return vis;
	}

	/** Transparent sort depth, written to out[0]: like three.js, the NDC depth of the world-space bounding sphere
	 *  centre (the instance-aware sphere for InstancedMesh; cached in the slab by _cullTest when culling is on),
	 *  or of the world position for sprites. */
	_itemDepth(object, ve, out) {
		const s = object._slabData, o = object._slabOffset;
		let cx, cy, cz;
		if (object.isSprite === true) { cx = s[o + 28]; cy = s[o + 29]; cz = s[o + 30]; }
		else if (object.frustumCulled) { cx = s[o + 41]; cy = s[o + 42]; cz = s[o + 43]; }
		else {
			const geometry = object.geometry;
			let bs;
			if (object.isInstancedMesh) { if (object.boundingSphere === null) object.computeBoundingSphere(); bs = object.boundingSphere; }
			else { if (geometry.boundingSphere === null) geometry.computeBoundingSphere(); bs = geometry.boundingSphere; }
			_vector3.copy(bs.center).applyMatrix4(object.matrixWorld);
			cx = _vector3.x; cy = _vector3.y; cz = _vector3.z;
		}
		out[0] = ndcDepth(cx, cy, cz);
	}

	_projectObject(object, camera, groupOrder, sortObjects, list) {
		if (object.visible === false) return;
		const rec = this._rec;
		if ((object.layers.mask & this._cameraLayerMask) !== 0) {
			if (object.isMesh === true || object.isLine === true || object.isPoints === true) {
				const geometry = object.geometry;
				const material = object.material;
				const inside = !object.frustumCulled || this._cullTest(object, geometry, _frustum, false);
				const first = list.count;
				if (rec !== null) {
					rec.regGeometry(geometry);
					if (object.isInstancedMesh) rec.regInstanced(object);
					if (Array.isArray(material)) rec.reusable = false; // groups / material arrays are mutated in place without notice
				}
				if (inside) {
					if (sortObjects) this._itemDepth(object, camera.matrixWorldInverse.elements, list.zScratch); else list.zScratch[0] = 0;
					if (Array.isArray(material)) {
						const groups = geometry.groups;
						for (let i = 0, l = groups.length; i < l; i++) {
							const group = groups[i];
							const groupMaterial = material[group.materialIndex];
							if (groupMaterial && groupMaterial.visible) this._pushItem(list, object, geometry, groupMaterial, group, false);
						}
					} else {
						if (rec !== null) rec.regMaterial(material);
						if (material.visible) this._pushItem(list, object, geometry, material, null, false);
					}
				}
				if (rec !== null) rec.addCandidate(object, inside, list.count > first ? first : -1);
			} else if (object.isGroup) {
				groupOrder = object.renderOrder;
			} else if (object.isLOD) {
				if (rec !== null) rec.reusable = false; // update() changes visibility from the camera distance
				if (object.autoUpdate === true) object.update(camera);
			} else if (object.isLight) {
				if (rec !== null) rec.lights.push(object);
				this.lights.push(object);
			} else if (object.isSprite) {
				const inside = !object.frustumCulled || _frustum.intersectsSprite(object);
				const first = list.count;
				if (inside) {
					const material = object.material;
					if (rec !== null) rec.regMaterial(material);
					if (material.visible) {
						this._itemDepth(object, camera.matrixWorldInverse.elements, list.zScratch);
						this._pushItem(list, object, object.geometry, material, null, false);
					}
				}
				if (rec !== null) rec.addCandidate(object, inside, list.count > first ? first : -1);
			}
		}
		const children = object.children;
		for (let i = 0, l = children.length; i < l; i++) this._projectObject(children[i], camera, groupOrder, sortObjects, list);
	}

	/**
	 * One loop over the scene's flat graph (parent before child). With `doUpdate` it does what `scene.updateMatrixWorld()`
	 * does (recompose changed local matrices, remultiply world matrices whose local matrix, parent or `matrixWorldNeedsUpdate`
	 * changed, honouring `matrixAutoUpdate` / `matrixWorldAutoUpdate`, calling subclass overrides of `updateMatrixWorld`
	 * recursively for their subtree); with `project` it does what `_projectObject(scene)` does (visibility, layers, cull,
	 * lights, LOD, sprites, items) into `list`, in the same order as the recursive walk.
	 */
	_flatPass(g, scene, camera, list, doUpdate, project, sortObjects) {
		const objects = g.objects, parentIdx = g.parent, kind = g.kind, childCount = g.childCount, wv = g.wv, dirty = g.dirty, vis = g.vis, n = g.n;
		const rec = this._rec, camMask = this._cameraLayerMask;
		const ve = project ? camera.matrixWorldInverse.elements : null;
		const zScratch = project ? list.zScratch : null;
		const frustum = _frustum, fplanes = frustum.flat, fv = frustum.version;
		const worldBefore = epochs.world;
		let bumps = 0, ok = true;
		this._deferSkeletons = doUpdate && project;
		for (let i = 0; i < n; i++) {
			const o = objects[i];
			if (o.children.length !== childCount[i]) { ok = false; g.valid = false; break; } // children edited directly: caller rebuilds and reruns
			const k = kind[i], p = parentIdx[i];
			let recomputed = false;
			if (doUpdate && (k & K_INSUB) === 0) {
				if ((k & K_CUSTOM) !== 0) {
					// a class with its own updateMatrixWorld: let it update its subtree (entries below it are K_INSUB)
					o.updateMatrixWorld(p >= 0 && dirty[p] === 1);
					dirty[i] = 0;
				} else if (p < 0 && o.parent !== null) {
					// the graph root has a parent of its own (render(group) with the group inside another hierarchy)
					const before = o._worldVersion;
					o.updateWorldMatrix(false, false);
					dirty[i] = before !== o._worldVersion ? 1 : 0;
				} else {
					let need = o.matrixWorldNeedsUpdate === true;
					if (o.matrixAutoUpdate === true) {
						// Object3D.updateMatrix inlined: recompose only when a TRS component differs from the snapshot
						const pos = o.position, q = o.quaternion, sc = o.scale, d = o._snapData, so = o._snapOffset;
						const px = pos.x, py = pos.y, pz = pos.z, x = q._x, y = q._y, z = q._z, w = q._w, sx = sc.x, sy = sc.y, sz = sc.z;
						if (!(px === d[so] && py === d[so + 1] && pz === d[so + 2] &&
							x === d[so + 3] && y === d[so + 4] && z === d[so + 5] && w === d[so + 6] &&
							sx === d[so + 7] && sy === d[so + 8] && sz === d[so + 9])) {
							d[so] = px; d[so + 1] = py; d[so + 2] = pz;
							d[so + 3] = x; d[so + 4] = y; d[so + 5] = z; d[so + 6] = w;
							d[so + 7] = sx; d[so + 8] = sy; d[so + 9] = sz;
							const te = o._slabData, t = o._slabOffset;
							const x2 = x + x, y2 = y + y, z2 = z + z;
							const xx = x * x2, xy = x * y2, xz = x * z2;
							const yy = y * y2, yz = y * z2, zz = z * z2;
							const wx = w * x2, wy = w * y2, wz = w * z2;
							te[t] = (1 - (yy + zz)) * sx; te[t + 1] = (xy + wz) * sx; te[t + 2] = (xz - wy) * sx; te[t + 3] = 0;
							te[t + 4] = (xy - wz) * sy; te[t + 5] = (1 - (xx + zz)) * sy; te[t + 6] = (yz + wx) * sy; te[t + 7] = 0;
							te[t + 8] = (xz + wy) * sz; te[t + 9] = (yz - wx) * sz; te[t + 10] = (1 - (xx + yy)) * sz; te[t + 11] = 0;
							te[t + 12] = px; te[t + 13] = py; te[t + 14] = pz; te[t + 15] = 1;
							need = true;
						}
					}
					let pw = -1;
					if (p >= 0) { pw = wv[p]; if (dirty[p] === 1 || pw !== o._parentWorldVersion) need = true; }
					if (need) {
						if (o.matrixWorldAutoUpdate === true) {
							const s = o._slabData, lo = o._slabOffset, wo = lo + 16;
							if (p < 0) {
								for (let j = 0; j < 16; j++) s[wo + j] = s[lo + j];
							} else {
								// Matrix4.multiplyMatrices(parent.matrixWorld, this.matrix), same expression order
								const pobj = objects[p], ae = pobj._slabData, ao = pobj._slabOffset + 16;
								const a11 = ae[ao], a12 = ae[ao + 4], a13 = ae[ao + 8], a14 = ae[ao + 12];
								const a21 = ae[ao + 1], a22 = ae[ao + 5], a23 = ae[ao + 9], a24 = ae[ao + 13];
								const a31 = ae[ao + 2], a32 = ae[ao + 6], a33 = ae[ao + 10], a34 = ae[ao + 14];
								const a41 = ae[ao + 3], a42 = ae[ao + 7], a43 = ae[ao + 11], a44 = ae[ao + 15];
								const b11 = s[lo], b12 = s[lo + 4], b13 = s[lo + 8], b14 = s[lo + 12];
								const b21 = s[lo + 1], b22 = s[lo + 5], b23 = s[lo + 9], b24 = s[lo + 13];
								const b31 = s[lo + 2], b32 = s[lo + 6], b33 = s[lo + 10], b34 = s[lo + 14];
								const b41 = s[lo + 3], b42 = s[lo + 7], b43 = s[lo + 11], b44 = s[lo + 15];
								s[wo] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
								s[wo + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
								s[wo + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
								s[wo + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
								s[wo + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
								s[wo + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
								s[wo + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
								s[wo + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
								s[wo + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
								s[wo + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
								s[wo + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
								s[wo + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
								s[wo + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
								s[wo + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
								s[wo + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
								s[wo + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
							}
							o._worldVersion++;
							if ((k & K_NOCOUNT) === 0) bumps++;
							recomputed = true;
						}
						if (p >= 0) o._parentWorldVersion = pw; // noted for user-owned world matrices too (see Object3D.updateMatrixWorld)
						o.matrixWorldNeedsUpdate = false;
						dirty[i] = 1;
					} else {
						dirty[i] = 0;
					}
					if ((k & K_POST) !== 0) o._flatPostUpdate();
				}
			}
			wv[i] = o._worldVersion;
			if (project === false) continue;

			// ---- _projectObject, flattened: visibility is inherited through vis[], the rest is per object
			let v = o._visible === false ? 0 : 1;
			if (p >= 0) v &= vis[p];
			vis[i] = v;
			if (v === 0 || (o.layers.mask & camMask) === 0) continue;
			if ((k & K_RENDERABLE) !== 0) {
				const geometry = o.geometry;
				const material = o.material;
				const s = o._slabData, lo = o._slabOffset;
				let inside;
				if (o._frustumCulled === false) inside = true;
				else if (recomputed === true) {
					// the world matrix was just written: refresh the slab sphere and test it here, while the record is hot
					// (same arithmetic as _cullTest, which keeps serving objects that did not move)
					let bs = o.boundingSphere;
					if (bs === undefined) { bs = geometry.boundingSphere; if (bs === null) { geometry.computeBoundingSphere(); bs = geometry.boundingSphere; } }
					else if (bs === null) { o.computeBoundingSphere(); bs = o.boundingSphere; }
					const c = bs.center, cx = c.x, cy = c.y, cz = c.z, r = bs.radius;
					const e = lo + 16;
					const e0 = s[e], e1 = s[e + 1], e2 = s[e + 2], e4 = s[e + 4], e5 = s[e + 5], e6 = s[e + 6], e8 = s[e + 8], e9 = s[e + 9], e10 = s[e + 10];
					s[lo + 41] = e0 * cx + e4 * cy + e8 * cz + s[e + 12];
					s[lo + 42] = e1 * cx + e5 * cy + e9 * cz + s[e + 13];
					s[lo + 43] = e2 * cx + e6 * cy + e10 * cz + s[e + 14];
					const sx = e0 * e0 + e1 * e1 + e2 * e2, sy = e4 * e4 + e5 * e5 + e6 * e6, sz = e8 * e8 + e9 * e9 + e10 * e10;
					s[lo + 44] = r * Math.sqrt(sx > sy ? (sx > sz ? sx : sz) : (sy > sz ? sy : sz));
					const d = o._snapData, q = o._snapOffset + 10;
					d[q] = r; d[q + 1] = cx; d[q + 2] = cy; d[q + 3] = cz;
					o._cullVersion = o._worldVersion; o._cullSphere = bs; o._cullFV1 = -1;
					const x = s[lo + 41], y = s[lo + 42], z = s[lo + 43], negRadius = -s[lo + 44];
					inside = !(fplanes[0] * x + fplanes[1] * y + fplanes[2] * z + fplanes[3] < negRadius ||
						fplanes[4] * x + fplanes[5] * y + fplanes[6] * z + fplanes[7] < negRadius ||
						fplanes[8] * x + fplanes[9] * y + fplanes[10] * z + fplanes[11] < negRadius ||
						fplanes[12] * x + fplanes[13] * y + fplanes[14] * z + fplanes[15] < negRadius ||
						fplanes[16] * x + fplanes[17] * y + fplanes[18] * z + fplanes[19] < negRadius ||
						fplanes[20] * x + fplanes[21] * y + fplanes[22] * z + fplanes[23] < negRadius);
					o._cullFV0 = fv; o._cullVis0 = inside;
				} else inside = this._cullTest(o, geometry, frustum, false);
				const first = list.count;
				if (rec !== null) {
					rec.regGeometry(geometry);
					if (o.isInstancedMesh) rec.regInstanced(o);
					if (Array.isArray(material)) rec.reusable = false;
				}
				if (inside) {
					if (sortObjects) this._itemDepth(o, ve, zScratch); else zScratch[0] = 0;
					// the normal matrix every drawn item needs, computed while its world matrix is in cache
					if (o._normalVersion !== o._worldVersion) { computeNormalMatrix(s, lo); o._normalVersion = o._worldVersion; }
					if (Array.isArray(material)) {
						const groups = geometry.groups;
						for (let j = 0, l = groups.length; j < l; j++) {
							const group = groups[j];
							const groupMaterial = material[group.materialIndex];
							if (groupMaterial && groupMaterial.visible) this._pushItem(list, o, geometry, groupMaterial, group, false);
						}
					} else {
						if (rec !== null) rec.regMaterial(material);
						if (material.visible) this._pushItem(list, o, geometry, material, null, false);
					}
				}
				if (rec !== null) rec.addCandidate(o, inside, list.count > first ? first : -1);
			} else if ((k & K_LIGHT) !== 0) {
				if (rec !== null) rec.lights.push(o);
				this.lights.push(o);
			} else if ((k & K_LOD) !== 0) {
				if (rec !== null) rec.reusable = false;
				if (o.autoUpdate === true) o.update(camera);
			} else if ((k & K_SPRITE) !== 0) {
				const inside = !o.frustumCulled || frustum.intersectsSprite(o);
				const first = list.count;
				if (inside) {
					const material = o.material;
					if (rec !== null) rec.regMaterial(material);
					if (material.visible) {
						this._itemDepth(o, ve, zScratch);
						this._pushItem(list, o, o.geometry, material, null, false);
					}
				}
				if (rec !== null) rec.addCandidate(o, inside, list.count > first ? first : -1);
			}
		}
		if (doUpdate) {
			if (bumps > 0) epochs.world += bumps;
			g.changed = epochs.world !== worldBefore;
		}
		if (this._deferSkeletons === true) {
			this._deferSkeletons = false;
			const pending = this._skinnedPending, frame = this._frameId;
			for (let i = 0; i < pending.length; i++) { const sk = pending[i]; if (sk.frame !== frame) { sk.update(); sk.frame = frame; } }
			pending.length = 0;
		}
		return ok;
	}

	_pushItem(list, object, geometry, material, group, shadowPass) {
		if (shadowPass === false) {
			const override = this._currentScene !== null ? this._currentScene.overrideMaterial : null;
			if (override !== null && override !== undefined && material.allowOverride === true) material = override;
		}
		const variant = this._variantFor(object, geometry, material, shadowPass);
		if (object.isSkinnedMesh === true) {
			// bone matrices once per render call (the skeleton itself skips the work when no bone moved); during a merged flat
			// pass the bones may not have been updated yet, so the update runs once the pass is over
			const skeleton = object.skeleton;
			if (skeleton !== undefined && skeleton.frame !== this._frameId) {
				if (this._deferSkeletons === true) this._skinnedPending.push(skeleton);
				else { skeleton.update(); skeleton.frame = this._frameId; }
			}
		}
		this._noteRenderOrder(object.renderOrder);
		// compact per-frame ids for materials and geometries (dense -> good key packing). A material that
		// can share batches with others sorts under its batch group's id, so same-group materials interleave
		// and geometry runs span them.
		const frame = this._frameId;
		if (material._frameStamp !== frame) {
			material._frameStamp = frame;
			const bg = this._batchGroupOf(material);
			material._batchGroup = bg;
			if (bg === null) material._frameRid = this._materialCounter++;
			else { if (bg._frameStamp !== frame) { bg._frameStamp = frame; bg._frameRid = this._materialCounter++; } material._frameRid = bg._frameRid; }
		}
		if (geometry._frameStamp !== frame) { geometry._frameStamp = frame; geometry._frameRid = this._geometryCounter++; }
		// batching eligibility, decided once here (object, geometry and material are in hand) instead of per scan in _drawList
		let flags = 0;
		// a two-pass (back faces, then front faces) transparent material must stay per object: batching all
		// back faces before all front faces composites overlapping objects differently from three.js
		if (group === null && material.isShaderMaterial !== true && object.isMesh === true && object.isInstancedMesh !== true && object.isSkinnedMesh !== true &&
			object.morphTargetInfluences === undefined && object.onBeforeRender === defaultOnBeforeRender && object.onAfterRender === defaultOnAfterRender &&
			isTwoPass(material, shadowPass) === false) {
			flags = ITEM_BATCHABLE;
			// a sub-draw of a multi-draw covers the whole geometry: a drawRange takes the per-draw path
			const dr = geometry.drawRange;
			if (material.wireframe !== true && object.isSprite !== true && dr.start === 0 && dr.count === Infinity) flags |= ITEM_MULTIDRAWABLE;
		}
		list.push(object, geometry, material, group, material._frameRid, geometry._frameRid, variant, material._batchGroup, flags);
		const rec = this._rec;
		if (rec !== null && shadowPass === false) { rec.regMaterial(material); rec.regPair(material, variant, object); }
	}

	/**
	 * The batch group of a built-in material: materials with the same GL state, the same texture objects
	 * and records in the same window of the material buffer can be drawn by one batch (each instance
	 * reads its own record). Returns null when the material must keep its own runs.
	 */
	_batchGroupOf(material) {
		if (this._materialArrayOk !== true || this.autoBatch !== true || this.autoBatchMaterials !== true || material.isShaderMaterial === true) return null;
		const props = this._materialProps(material);
		if (props.blockSlot < 0) this._allocMaterialSlot(props);
		const s = this._batchSigScratch;
		let k = 0;
		for (let i = 0; i < MAP_KEYS.length; i++) { const t = material[MAP_KEYS[i]]; s[k++] = t ? t.id : -1; }
		s[k++] = material.side; s[k++] = material.shadowSide === null || material.shadowSide === undefined ? -1 : material.shadowSide;
		s[k++] = material.transparent ? 1 : 0; s[k++] = material.blending; s[k++] = material.blendEquation; s[k++] = material.blendSrc; s[k++] = material.blendDst;
		s[k++] = material.blendEquationAlpha === null ? -1 : material.blendEquationAlpha; s[k++] = material.blendSrcAlpha === null ? -1 : material.blendSrcAlpha; s[k++] = material.blendDstAlpha === null ? -1 : material.blendDstAlpha;
		const bc = material.blendColor; s[k++] = bc.r; s[k++] = bc.g; s[k++] = bc.b; s[k++] = material.blendAlpha; s[k++] = material.premultipliedAlpha ? 1 : 0;
		s[k++] = material.depthFunc; s[k++] = material.depthTest ? 1 : 0; s[k++] = material.depthWrite ? 1 : 0; s[k++] = material.colorWrite ? 1 : 0;
		s[k++] = material.polygonOffset ? 1 : 0; s[k++] = material.polygonOffsetFactor; s[k++] = material.polygonOffsetUnits; s[k++] = material.alphaToCoverage ? 1 : 0;
		s[k++] = material.stencilWrite ? 1 : 0; s[k++] = material.stencilWriteMask; s[k++] = material.stencilFunc; s[k++] = material.stencilRef; s[k++] = material.stencilFuncMask;
		s[k++] = material.stencilFail; s[k++] = material.stencilZFail; s[k++] = material.stencilZPass;
		s[k++] = material.wireframe ? 1 : 0;
		s[k++] = material.envMap ? material.envMap.id : -1; // the environment texture is bound once per batch
		s[k++] = Math.floor(props.blockSlot / this._materialWindow);
		const prev = props.batchSig;
		if (prev !== null) {
			let same = true;
			for (let i = 0; i < BATCH_SIG_SIZE; i++) { if (prev[i] !== s[i]) { same = false; break; } }
			if (same) return props.batchGroup;
		} else {
			props.batchSig = new Float64Array(BATCH_SIG_SIZE);
		}
		props.batchSig.set(s);
		const key = Array.prototype.join.call(s, ',');
		let group = this._batchGroups.get(key);
		if (group === undefined) { group = { _frameStamp: -1, _frameRid: 0, page: s[BATCH_SIG_SIZE - 1] }; this._batchGroups.set(key, group); }
		props.batchGroup = group;
		return group;
	}

	/** Resolve the program of every item in the list. Runs after the frame's lights are collected. */
	_resolvePrograms(list, scene) {
		const items = list.items, n = list.count, frame = this._frameId;
		for (let i = 0; i < n; i++) {
			const item = items[i];
			const program = this._getProgram(item.material, item.object, scene, item.variant);
			if (program._frameStamp !== frame) { program._frameStamp = frame; program._frameRid = this._programCounter++; }
			item.program = program;
		}
	}

	_sideVariant() { return this._sideOverride === BackSide ? V_SIDE_BACK : (this._sideOverride === FrontSide ? V_SIDE_FRONT : 0); }
	_variantFor(object, geometry, material, shadowPass) {
		let v = 0;
		if (object.isInstancedMesh) { v |= V_INSTANCING; if (object.instanceColor !== null) v |= V_INSTANCING_COLOR; }
		if (object.receiveShadow) v |= V_RECEIVE_SHADOW;
		if (shadowPass) v |= V_SHADOW_PASS;
		// geometry-dependent bits are cached per attribute layout
		if (geometry._attrBitsVersion !== geometry._layoutVersion) {
			const attributes = geometry.attributes;
			let a = 0;
			if (attributes.uv !== undefined) a |= V_HAS_UV;
			if (attributes.uv1 !== undefined) a |= V_HAS_UV1;
			if (attributes.color !== undefined) { a |= V_HAS_COLOR; if (attributes.color.itemSize === 4) a |= V_COLOR_ALPHA; }
			geometry._attrBits = a; geometry._attrBitsVersion = geometry._layoutVersion;
		}
		let a = geometry._attrBits;
		if (material.vertexColors !== true) a &= ~(V_HAS_COLOR | V_COLOR_ALPHA);
		if (object.isSkinnedMesh === true) v |= V_SKINNING;
		if (object.morphTargetInfluences !== undefined) {
			const ma = geometry.morphAttributes;
			const first = ma.position || ma.normal || ma.color;
			if (first !== undefined) {
				if (ma.position !== undefined) v |= V_MORPH_POSITION;
				if (ma.normal !== undefined) v |= V_MORPH_NORMAL;
				if (ma.color !== undefined) v |= V_MORPH_COLOR;
				v |= Math.min(first.length, 255) << V_MORPH_COUNT_SHIFT;
			}
		}
		return v | a;
	}

	// ------------------------------------------------------------------ materials / programs

	_materialProps(material) {
		let props = this._materialProperties.get(material);
		if (props === undefined) {
			props = { programs: [], blockData: new Float32Array(MATERIAL_BLOCK_SIZE / 4), blockSlot: -1, blockStamp: -1, textureStamp: -1, batchSig: null, batchGroup: null, envStamp: -1, envMap: null, envMapRotation: null, envMapIntensity: 1, envPending: false };
			this._materialProperties.set(material, props);
			material.addEventListener('dispose', this._onMaterialDispose);
		}
		return props;
	}
	_onMaterialDispose(event) {
		const material = event.target;
		material.removeEventListener('dispose', this._onMaterialDispose);
		const props = this._materialProperties.get(material);
		if (props !== undefined) {
			for (let i = 0; i < props.programs.length; i++) { const e = props.programs[i]; if (e) { this.programs.releaseProgram(e.program); if (e.altProgram !== null) this.programs.releaseProgram(e.altProgram); } }
			if (props.blockSlot >= 0) this._materialFreeSlots.push(props.blockSlot);
		}
		this._materialProperties.delete(material);
	}

	_getProgram(material, object, scene, variant) {
		if (material._resolveStamp === this._frameId && material._resolveVariant === variant) return material._resolveProgram;
		const props = this._materialProps(material);
		if (props.envStamp !== this._frameId && this._inDrawList === false) { props.envStamp = this._frameId; this._refreshEnvironment(material, props, scene); }
		const program = this._getProgramSlow(props, material, object, scene, variant);
		material._resolveStamp = this._frameId; material._resolveVariant = variant; material._resolveProgram = program;
		return program;
	}
	/**
	 * The texture this material samples as its environment this frame (material.envMap, else the scene's
	 * environment for lit materials), converted to what the shader expects: the PMREM CubeUV layout for
	 * MeshStandardMaterial and for scene.environment, a cube map otherwise. Also which rotation and
	 * intensity apply (three.js: the scene's when the environment comes from the scene).
	 */
	_refreshEnvironment(material, props, scene) {
		const raw = material.envMap;
		const isLit = material.isMeshStandardMaterial === true || material.isMeshLambertMaterial === true || material.isMeshPhongMaterial === true;
		const environment = (isLit && scene.isScene === true) ? scene.environment : null;
		const source = raw || environment;
		if (source === null || source === undefined) { props.envMap = null; props.envMapRotation = null; props.envMapIntensity = 1; props.envPending = false; return; }
		const usePMREM = material.isMeshStandardMaterial === true || (isLit && !raw);
		const envMap = this.environments.get(source, usePMREM);
		props.envMap = envMap;
		props.envPending = envMap === null; // image not ready yet: try again next frame
		if (environment !== null && !raw) { props.envMapRotation = scene.environmentRotation; props.envMapIntensity = scene.environmentIntensity; }
		else { props.envMapRotation = material.envMapRotation; props.envMapIntensity = material.envMapIntensity !== undefined ? material.envMapIntensity : 1; }
	}
	_getProgramSlow(props, material, object, scene, variant) {
		let entry = props.programs[variant];
		if (entry !== undefined) {
			if (entry.materialVersion === material.version && entry.envVersion === this._envVersion && entry.envMap === props.envMap) return entry.program;
			// the previous environment (typically the other of render target / screen) is kept as a second slot
			if (entry.altProgram !== null && entry.altMaterialVersion === material.version && entry.altEnvVersion === this._envVersion && entry.altEnvMap === props.envMap) {
				const p = entry.program, mv = entry.materialVersion, ev = entry.envVersion, em = entry.envMap;
				entry.program = entry.altProgram; entry.materialVersion = entry.altMaterialVersion; entry.envVersion = entry.altEnvVersion; entry.envMap = entry.altEnvMap;
				entry.altProgram = p; entry.altMaterialVersion = mv; entry.altEnvVersion = ev; entry.altEnvMap = em;
				return entry.program;
			}
		}
		const vflags = {
			instancing: (variant & V_INSTANCING) !== 0, instancingColor: (variant & V_INSTANCING_COLOR) !== 0,
			receiveShadow: (variant & V_RECEIVE_SHADOW) !== 0, shadowPass: (variant & V_SHADOW_PASS) !== 0,
			multiDraw: (variant & V_MULTIDRAW) !== 0, objectTexture: (variant & V_OBJTEX) !== 0, materialArray: (variant & V_MATARRAY) !== 0,
			side: (variant & V_SIDE_BACK) !== 0 ? BackSide : ((variant & V_SIDE_FRONT) !== 0 ? FrontSide : material.side),
		};
		const parameters = this.programs.getParameters(material, object, scene || _emptyScene, this.lights, vflags, props.envMap);
		if (entry !== undefined && entry.program.parameters.key === parameters.key && material.isShaderMaterial !== true) {
			entry.materialVersion = material.version; entry.envVersion = this._envVersion; entry.envMap = props.envMap;
			return entry.program;
		}
		const program = this.programs.acquireProgram(parameters, material);
		if (program.justLinked === true) { program.justLinked = false; this.state.currentProgram = program.program; } // linking made it current behind the state cache
		if (entry !== undefined) {
			// current program becomes the alternate; the one it displaces is released
			if (entry.altProgram !== null) this.programs.releaseProgram(entry.altProgram);
			entry.altProgram = entry.program; entry.altMaterialVersion = entry.materialVersion; entry.altEnvVersion = entry.envVersion; entry.altEnvMap = entry.envMap;
			entry.program = program; entry.materialVersion = material.version; entry.envVersion = this._envVersion; entry.envMap = props.envMap;
		} else {
			entry = { program, materialVersion: material.version, envVersion: this._envVersion, envMap: props.envMap, altProgram: null, altMaterialVersion: -1, altEnvVersion: -1, altEnvMap: null };
		}
		props.programs[variant] = entry;
		material._programDirty = false;
		return program;
	}

	/** Give the material a record slot in the shared material buffer (growing the buffer when full). */
	_allocMaterialSlot(props) {
		const gl = this._gl;
		let slot = this._materialFreeSlots.pop();
		if (slot === undefined) {
			if (this._materialSlotsUsed === this._materialCapacity) {
				// grow buffer (capacity stays a multiple of the Materials window)
				const newCap = this._materialCapacity * 2;
				const newBuffer = gl.createBuffer();
				gl.bindBuffer(gl.UNIFORM_BUFFER, newBuffer);
				gl.bufferData(gl.UNIFORM_BUFFER, this._materialStride * newCap, gl.DYNAMIC_DRAW);
				gl.bindBuffer(gl.COPY_READ_BUFFER, this._materialBuffer);
				gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.UNIFORM_BUFFER, 0, 0, this._materialStride * this._materialCapacity);
				gl.bindBuffer(gl.COPY_READ_BUFFER, null);
				gl.deleteBuffer(this._materialBuffer);
				this._materialBuffer = newBuffer;
				this._materialCapacity = newCap;
				this.state.currentUniformBuffer = newBuffer;
				this.state.currentUniformBindings[BLOCK_MATERIAL] = undefined;
			}
			slot = this._materialSlotsUsed++;
		}
		props.blockSlot = slot;
		props.blockData.fill(NaN); // force upload
	}

	/** Refresh the material's uniform block (once per frame per material) and return its byte offset. */
	_syncMaterialBlock(material, props) {
		if (props.blockStamp === this._frameId) return props.blockSlot * this._materialStride;
		props.blockStamp = this._frameId;
		const gl = this._gl;
		if (props.blockSlot < 0) this._allocMaterialSlot(props);
		const s = this._materialScratch;
		const color = material.color;
		if (color !== undefined) { s[0] = color.r; s[1] = color.g; s[2] = color.b; } else { s[0] = 1; s[1] = 1; s[2] = 1; }
		s[3] = material.opacity;
		const emissive = material.emissive;
		if (emissive !== undefined) { s[4] = emissive.r; s[5] = emissive.g; s[6] = emissive.b; } else { s[4] = 0; s[5] = 0; s[6] = 0; }
		s[7] = material.alphaTest;
		const specular = material.specular;
		if (specular !== undefined) { s[8] = specular.r; s[9] = specular.g; s[10] = specular.b; } else { s[8] = 0; s[9] = 0; s[10] = 0; }
		s[11] = material.shininess !== undefined ? material.shininess : 30;
		s[12] = material.roughness !== undefined ? material.roughness : 1;
		s[13] = material.metalness !== undefined ? material.metalness : 0;
		s[14] = material.aoMapIntensity !== undefined ? material.aoMapIntensity : 1;
		s[15] = material.emissiveIntensity !== undefined ? material.emissiveIntensity : 1;
		const ns = material.normalScale;
		if (ns !== undefined) { s[16] = ns.x; s[17] = ns.y; } else { s[16] = 1; s[17] = 1; }
		s[18] = material.size !== undefined ? material.size * this._pixelRatio : 1;
		s[19] = material.isSpriteMaterial ? material.rotation : (material.bumpScale !== undefined ? material.bumpScale : 1);
		const map = material.map || material.alphaMap || material.emissiveMap || material.normalMap || material.roughnessMap || material.metalnessMap || material.aoMap || material.specularMap;
		if (map && map.isTexture) {
			if (map.matrixAutoUpdate === true) map.updateMatrix();
			const m = map.matrix.elements;
			s[20] = m[0]; s[21] = m[1]; s[22] = m[2]; s[23] = 0;
			s[24] = m[3]; s[25] = m[4]; s[26] = m[5]; s[27] = 0;
			s[28] = m[6]; s[29] = m[7]; s[30] = m[8]; s[31] = 0;
		} else {
			s[20] = 1; s[21] = 0; s[22] = 0; s[23] = 0; s[24] = 0; s[25] = 1; s[26] = 0; s[27] = 0; s[28] = 0; s[29] = 0; s[30] = 1; s[31] = 0;
		}
		// environment map: intensity / reflectivity / refractionRatio / ior and the rotation (as three.js: the
		// inverse of the Euler rotation, with the px/nx flip of non-render-target cube textures)
		s[32] = props.envMapIntensity;
		s[33] = material.reflectivity !== undefined ? material.reflectivity : 1;
		s[34] = material.refractionRatio !== undefined ? material.refractionRatio : 0.98;
		s[35] = material.ior !== undefined ? material.ior : 1.5;
		const envMap = props.envMap;
		if (envMap !== null) {
			_envRotation.setFromMatrix4(_envRotation4.makeRotationFromEuler(props.envMapRotation)).transpose();
			if (envMap.isCubeTexture && envMap.isRenderTargetTexture === false) _envRotation.premultiply(_envFlip);
			const e = _envRotation.elements;
			s[36] = e[0]; s[37] = e[1]; s[38] = e[2]; s[39] = 0; s[40] = e[3]; s[41] = e[4]; s[42] = e[5]; s[43] = 0; s[44] = e[6]; s[45] = e[7]; s[46] = e[8]; s[47] = 0;
		} else {
			s[36] = 1; s[37] = 0; s[38] = 0; s[39] = 0; s[40] = 0; s[41] = 1; s[42] = 0; s[43] = 0; s[44] = 0; s[45] = 0; s[46] = 1; s[47] = 0;
		}
		const b = props.blockData;
		let dirty = false;
		for (let i = 0; i < 48; i++) { if (b[i] !== s[i]) { dirty = true; break; } }
		const offset = props.blockSlot * this._materialStride;
		if (dirty) {
			b.set(s);
			this.state.bindUniformBuffer(this._materialBuffer);
			gl.bufferSubData(gl.UNIFORM_BUFFER, offset, b);
		}
		return offset;
	}

	_bindMaterialTextures(material, props) {
		const t = this.textures, rt = this._currentRenderTarget;
		if (rt !== null) {
			// a map that is this render target's own texture would be a feedback loop: skip it
			for (const key of MAP_KEYS) { const tex = material[key]; if (tex && tex.renderTarget === rt) { t.bindEmpty(EMPTY_2D, TEXTURE_UNITS[key]); } }
		}
		const envMap = props.envMap;
		if (envMap !== null) {
			if (rt !== null && envMap.renderTarget === rt) t.bindEmpty(envMap.isCubeTexture ? EMPTY_CUBE : EMPTY_2D, TEXTURE_UNITS.envMap);
			else if (envMap.isCubeTexture) t.setTextureCube(envMap, TEXTURE_UNITS.envMap);
			else t.setTexture2D(envMap, TEXTURE_UNITS.envMap);
		}
		if (material.map) t.setTexture2D(material.map, TEXTURE_UNITS.map);
		if (material.alphaMap) t.setTexture2D(material.alphaMap, TEXTURE_UNITS.alphaMap);
		if (material.normalMap) t.setTexture2D(material.normalMap, TEXTURE_UNITS.normalMap);
		if (material.emissiveMap) t.setTexture2D(material.emissiveMap, TEXTURE_UNITS.emissiveMap);
		if (material.roughnessMap) t.setTexture2D(material.roughnessMap, TEXTURE_UNITS.roughnessMap);
		if (material.metalnessMap) t.setTexture2D(material.metalnessMap, TEXTURE_UNITS.metalnessMap);
		if (material.aoMap) t.setTexture2D(material.aoMap, TEXTURE_UNITS.aoMap);
		if (material.specularMap) t.setTexture2D(material.specularMap, TEXTURE_UNITS.specularMap);
		if (material.isMeshStandardMaterial) t.setTexture2D(getDFGLUT(), TEXTURE_UNITS.dfgLUT);
	}

	// ------------------------------------------------------------------ drawing

	/**
	 * Mega-buffer record of a geometry (null: draw it the regular way), resolved once per geometry per frame
	 * (`ensure` compares attribute layout and sizes). Geometries are also noted once per command build in the
	 * touch map, which a draw-command cache uses to validate a replay.
	 */
	_mdRecordOf(geometry) {
		let rec;
		if (geometry._mdFrame !== this._frameId || (geometry._mdRec !== null && geometry._mdRec.layoutVersion !== geometry._layoutVersion)) {
			geometry._mdFrame = this._frameId;
			rec = geometry._mdRec = this.megaBuffers.ensure(geometry);
			geometry._mdTouch = -1;
		} else rec = geometry._mdRec;
		if (this._megaTouch !== null && geometry._mdTouch !== this._buildSeq) { geometry._mdTouch = this._buildSeq; this._megaTouch.set(geometry, rec); }
		return rec;
	}

	/**
	 * Build draw commands from a sorted key list, then execute them. Commands are:
	 *   single draw, instanced batch (same geometry+material), or multi-draw batch
	 *   (same material, any geometries from one mega-buffer page).
	 */
	_drawList(list, keys, n, scene, camera, shadowPass, commandCache = null, keysVersion = 0) {
		if (n === 0) return;
		this._currentScene = scene; this._listShadowPass = shadowPass;
		if (this._traceSeq !== null) this._traceList = shadowPass ? 's' : (keys === list.transparentSorted ? 't' : 'o');
		const batcher = this.batcher;
		const autoBatch = this.autoBatch, minimum = this.autoBatchMinimum;
		const multi = autoBatch && this.autoMultiDraw && this.megaBuffers !== null;
		if (commandCache !== null && this._replayCommands(commandCache, keysVersion, multi)) {
			// same sorted list, same matrices already in the matrix texture: skip command building and the texture fill
			this.debug.listReuse.commandsReplayed++;
			this._executeCommands(commandCache.cmdN, scene, camera, shadowPass);
			return;
		}
		batcher.begin();
		let cmdN = 0, mdN = 0;
		const touch = commandCache !== null ? (this._megaTouch = this._touchMap) : null;
		if (touch !== null) touch.clear();
		this._buildSeq++;
		const items = list.items, flags = list.flags, megaBuffers = this.megaBuffers;
		let i = 0;
		while (i < n) {
			const itemIndex = keys[i];
			const item = items[itemIndex];
			const fl = flags[itemIndex];
			const material = item.material, bg = item.batchGroup;
			let j = i + 1;
			let kind = 0; // 0 single, 1 instanced run, 2 multi-draw run; +2 when the run spans several materials
			let firstOtherMaterial = -1; // first item of the run whose material differs from `material` (same batch group)
			let rec0;
			if (multi && (fl & ITEM_MULTIDRAWABLE) !== 0 && (rec0 = this._mdRecordOf(item.geometry)) !== null) {
				item.mdRecord = rec0;
				const page = rec0.page, indexed = rec0.indexed, program = item.program, renderOrder = item.renderOrder;
				let distinct = 1, lastGeometry = item.geometry, firstGroupEnd = -1;
				while (j < n) {
					const nextIndex = keys[j];
					const next = items[nextIndex];
					if ((flags[nextIndex] & ITEM_MULTIDRAWABLE) === 0 || next.program !== program || next.renderOrder !== renderOrder) break;
					if (next.material !== material && (bg === null || next.batchGroup !== bg)) break;
					const geometry = next.geometry;
					if (geometry !== lastGeometry || geometry._mdFrame !== this._frameId) {
						const rec = this._mdRecordOf(geometry);
						if (rec === null || rec.page !== page || rec.indexed !== indexed) break;
						if (geometry !== lastGeometry) { distinct++; lastGeometry = geometry; if (firstGroupEnd < 0) firstGroupEnd = j; }
					}
					if (firstOtherMaterial < 0 && next.material !== material) firstOtherMaterial = j;
					j++;
				}
				if (firstGroupEnd < 0) firstGroupEnd = j;
				// Cost model: a multi-draw costs one call plus a small per-sub-draw cost; an instanced draw
				// costs one call per distinct geometry. Repeated geometries (sorted contiguously) are
				// therefore drawn instanced, geometry-group by geometry-group; mostly-distinct runs use multi-draw.
				if (distinct * 2 >= j - i) { if (j - i >= minimum) kind = 2; }
				else { j = firstGroupEnd; if (j - i >= minimum) kind = 1; }
			} else if (autoBatch && (fl & ITEM_BATCHABLE) !== 0) {
				const geometry = item.geometry, program = item.program, renderOrder = item.renderOrder;
				while (j < n) {
					const nextIndex = keys[j];
					const next = items[nextIndex];
					if (next.geometry === geometry && (next.material === material || (bg !== null && next.batchGroup === bg)) && next.program === program &&
						next.renderOrder === renderOrder && (flags[nextIndex] & ITEM_BATCHABLE) !== 0) {
						if (firstOtherMaterial < 0 && next.material !== material) firstOtherMaterial = j;
						j++;
					} else break;
				}
				if (j - i >= minimum) kind = 1;
			}
			const multiMaterial = kind !== 0 && firstOtherMaterial >= 0 && firstOtherMaterial < j;
			const windowBase = multiMaterial ? bg.page * this._materialWindow : 0;
			if (cmdN === this._cmdCapacity) this._growCommands();
			this._cmdItem[cmdN] = item;
			if (kind === 2) {
				batcher.ensureTex(j - i);
				if (mdN + (j - i) > this._mdCounts.length) this._growMultiDraw(mdN + (j - i));
				this._cmdOffset[cmdN] = batcher.texCount;
				this._cmdCount[cmdN] = j - i;
				this._cmdKind[cmdN] = multiMaterial ? 4 : 2;
				this._cmdMdStart[cmdN] = mdN;
				for (let k = i; k < j; k++) {
					const it = items[keys[k]];
					batcher.addTex(it.object, multiMaterial ? this._materialRecordIndex(it.material, windowBase) : 0);
					const geometry = it.geometry, rec = geometry._mdRec;
					megaBuffers.queue(rec, geometry);
					if (rec.indexed) { this._mdCounts[mdN] = rec.indexCount; this._mdOffsets[mdN] = rec.byteOffset; }
					else { this._mdCounts[mdN] = rec.vertexCount; this._mdOffsets[mdN] = rec.baseVertex; }
					mdN++;
				}
			} else if (kind === 1) {
				batcher.ensureTex(j - i);
				this._cmdOffset[cmdN] = batcher.texCount;
				this._cmdCount[cmdN] = j - i;
				this._cmdKind[cmdN] = multiMaterial ? 3 : 1;
				if (multiMaterial) { for (let k = i; k < j; k++) { const it = items[keys[k]]; batcher.addTex(it.object, this._materialRecordIndex(it.material, windowBase)); } }
				else { for (let k = i; k < j; k++) batcher.addTex(items[keys[k]].object, 0); }
			} else {
				j = i + 1;
				this._cmdOffset[cmdN] = -1;
				this._cmdCount[cmdN] = 1;
				this._cmdKind[cmdN] = 0;
			}
			cmdN++;
			i = j;
		}
		if (batcher.texCount > 0) batcher.uploadTexture(this.state, TEXTURE_UNITS.objectMatrices);
		if (commandCache !== null) {
			this._megaTouch = null;
			this._saveCommands(commandCache, keysVersion, cmdN, mdN, multi, touch, list.cache.pMat);
		}
		this._executeCommands(cmdN, scene, camera, shadowPass);
	}

	_executeCommands(cmdN, scene, camera, shadowPass) {
		this._inDrawList = true; // program resolution from here on must not start an environment conversion render
		this.megaBuffers.flush(); // queued page uploads (lazy, ranged) must land before the draws that read them
		for (let c = 0; c < cmdN; c++) {
			const item = this._cmdItem[c];
			const kind = this._cmdKind[c];
			const passes = isTwoPass(item.material, shadowPass) ? 2 : 1;
			for (let p = 0; p < passes; p++) {
				this._sideOverride = passes === 2 ? (p === 0 ? BackSide : FrontSide) : -1;
				if (kind === 2 || kind === 4) this._renderMultiDraw(item, this._cmdOffset[c], this._cmdCount[c], this._cmdMdStart[c], scene, camera, shadowPass, kind === 4);
				else if (kind === 1 || kind === 3) this._renderBatch(item, this._cmdOffset[c], this._cmdCount[c], scene, camera, shadowPass, kind === 3);
				else this._renderItem(item, scene, camera, shadowPass);
			}
			this._sideOverride = -1;
			this._cmdItem[c] = null;
		}
	}

	/** Remember the commands just built so an identical list can skip building them (see _replayCommands). */
	_saveCommands(cache, keysVersion, cmdN, mdN, multi, touch, pairMats) {
		cache.version = -1;
		const batcher = this.batcher;
		// a geometry whose mega-buffer record changed while building (reallocation) is not safe to replay
		for (const [geometry, rec] of touch) if (rec !== null && rec.layoutVersion !== geometry._layoutVersion) return;
		cache.items = this._cmdItem.slice(0, cmdN);
		cache.offset = this._cmdOffset.slice(0, cmdN); cache.count = this._cmdCount.slice(0, cmdN);
		cache.kind = this._cmdKind.slice(0, cmdN); cache.mdStart = this._cmdMdStart.slice(0, cmdN);
		cache.mdCounts = this._mdCounts.slice(0, mdN); cache.mdOffsets = this._mdOffsets.slice(0, mdN);
		cache.cmdN = cmdN; cache.mdN = mdN;
		cache.texCount = batcher.texCount; cache.texHash = batcher.texHash;
		cache.megaGeoms.length = 0; cache.megaRecs.length = 0; cache.megaPages.length = 0;
		for (const [geometry, rec] of touch) { cache.megaGeoms.push(geometry); cache.megaRecs.push(rec); cache.megaPages.push(rec === null ? null : rec.page); }
		let spans = false;
		for (let c = 0; c < cmdN; c++) if (this._cmdKind[c] >= 3) { spans = true; break; }
		cache.syncMats = spans ? pairMats : null; // building a run that spans materials refreshes each material's record; replay must too
		cache.autoBatch = this.autoBatch; cache.autoMultiDraw = this.autoMultiDraw; cache.minimum = this.autoBatchMinimum; cache.multi = multi;
		cache.version = keysVersion;
	}

	/**
	 * Load previously built commands into the command arrays when they are still exactly what a rebuild would
	 * produce: same sorted keys, same batching settings, same mega-buffer records, and the matrix texture still
	 * holds this list's matrices (nobody drew another list through the batcher since).
	 */
	_replayCommands(cache, keysVersion, multi) {
		if (cache.version !== keysVersion || cache.cmdN === 0) return false;
		if (cache.autoBatch !== this.autoBatch || cache.autoMultiDraw !== this.autoMultiDraw || cache.minimum !== this.autoBatchMinimum || cache.multi !== multi) return false;
		const batcher = this.batcher;
		if (cache.texCount > 0 && (batcher.texture === null || batcher.textureHash !== cache.texHash || batcher.textureCount !== cache.texCount)) return false;
		const geoms = cache.megaGeoms;
		for (let i = 0; i < geoms.length; i++) {
			const rec = this.megaBuffers.ensure(geoms[i]);
			if (rec !== cache.megaRecs[i] || (rec !== null && rec.page !== cache.megaPages[i])) return false;
			if (rec !== null) this.megaBuffers.queue(rec, geoms[i]); // uploads are lazy: changed vertex data still has to reach the page before the replayed draws
		}
		const syncMats = cache.syncMats;
		if (syncMats !== null) for (let i = 0; i < syncMats.length; i++) this._syncMaterialBlock(syncMats[i], this._materialProps(syncMats[i]));
		const cmdN = cache.cmdN;
		while (cmdN > this._cmdCapacity) this._growCommands();
		if (cache.mdN > this._mdCounts.length) this._growMultiDraw(cache.mdN);
		const items = cache.items;
		for (let c = 0; c < cmdN; c++) this._cmdItem[c] = items[c];
		this._cmdOffset.set(cache.offset); this._cmdCount.set(cache.count); this._cmdKind.set(cache.kind); this._cmdMdStart.set(cache.mdStart);
		this._mdCounts.set(cache.mdCounts); this._mdOffsets.set(cache.mdOffsets);
		batcher.texCount = cache.texCount; batcher.texHash = cache.texHash;
		if (cache.texCount > 0) batcher.uploadTexture(this.state, TEXTURE_UNITS.objectMatrices); // binds the texture; the hash matches, so no upload
		return true;
	}

	/** Refreshes the material's record this frame and returns its index inside the Materials window starting at record `windowBase`. */
	_materialRecordIndex(material, windowBase) {
		const props = this._materialProps(material);
		this._syncMaterialBlock(material, props);
		return props.blockSlot - windowBase;
	}
	_growMultiDraw(min) {
		let cap = this._mdCounts.length; while (cap < min) cap *= 2;
		const c = new Int32Array(cap); c.set(this._mdCounts); this._mdCounts = c;
		const o = new Int32Array(cap); o.set(this._mdOffsets); this._mdOffsets = o;
	}

	/** One multiDrawElements/Arrays call for `count` sub-draws whose matrices start at `drawBase` in the matrix texture. */
	_renderMultiDraw(item, drawBase, count, mdStart, scene, camera, shadowPass, materialArray) {
		const object = item.object, material = item.material, gl = this._gl;
		const variant = this._variantFor(object, item.geometry, material, shadowPass) | V_MULTIDRAW | (materialArray ? V_MATARRAY : 0) | this._sideVariant();
		const program = this._getProgram(material, object, scene, variant);
		this._setupMaterial(item, program, material, camera, false, this._sideOverride >= 0 ? this._sideOverride : (shadowPass ? shadowSideOf(material) : material.side));
		const mu = program.modelMatrixUniform;
		if (mu !== null) mu._lastObject = null;
		if (mu !== null && !cacheArray(mu, IDENTITY, 16)) { gl.uniformMatrix4fv(mu.location, false, IDENTITY); if (this._traceUniforms !== null) this._trace(mu); }
		const du = program.drawBaseUniform;
		if (du !== null && du.cache !== drawBase) { du.cache = drawBase; gl.uniform1i(du.location, drawBase); if (this._traceUniforms !== null) this._trace(du); }
		// the matrix texture lives on a fixed unit; make sure nothing replaced it there
		this.state.bindTexture(gl.TEXTURE_2D, this.batcher.texture, TEXTURE_UNITS.objectMatrices);
		const rec = item.mdRecord;
		this.state.bindVertexArray(rec.page.vao);
		const ext = this.multiDrawExt;
		let primitives = 0;
		if (rec.indexed) {
			ext.multiDrawElementsWEBGL(gl.TRIANGLES, this._mdCounts, mdStart, gl.UNSIGNED_INT, this._mdOffsets, mdStart, count);
		} else {
			ext.multiDrawArraysWEBGL(gl.TRIANGLES, this._mdOffsets, mdStart, this._mdCounts, mdStart, count);
		}
		for (let k = 0; k < count; k++) primitives += this._mdCounts[mdStart + k];
		this.info.update(primitives, gl.TRIANGLES, 1);
		this.info.render.batches++;
		this.info.render.instances += count;
	}

	_growCommands() {
		const cap = this._cmdCapacity * 2;
		const a = new Array(cap); for (let i = 0; i < this._cmdCapacity; i++) a[i] = this._cmdItem[i];
		const o = new Int32Array(cap); o.set(this._cmdOffset);
		const cnt = new Int32Array(cap); cnt.set(this._cmdCount);
		const kd = new Int8Array(cap); kd.set(this._cmdKind);
		const ms = new Int32Array(cap); ms.set(this._cmdMdStart);
		this._cmdItem = a; this._cmdOffset = o; this._cmdCount = cnt; this._cmdKind = kd; this._cmdMdStart = ms; this._cmdCapacity = cap;
	}

	_drawMode(object, material) {
		const gl = this._gl;
		if (object.isMesh || object.isSprite) {
			if (material.wireframe === true) return gl.LINES;
			return gl.TRIANGLES;
		}
		if (object.isLine) {
			if (object.isLineSegments) return gl.LINES;
			if (object.isLineLoop) return gl.LINE_LOOP;
			return gl.LINE_STRIP;
		}
		if (object.isPoints) return gl.POINTS;
		return gl.TRIANGLES;
	}

	_wireframeGeometry(geometry) {
		let wf = this._wireframeGeometries.get(geometry);
		if (wf === undefined || wf._sourceLayout !== geometry._layoutVersion || (geometry.index !== null && wf._sourceIndexVersion !== geometry.index.version)) {
			wf = new BufferGeometry();
			wf.attributes = geometry.attributes;
			const indices = [];
			const index = geometry.index, position = geometry.attributes.position;
			if (index !== null) {
				const arr = index.array;
				for (let i = 0, l = arr.length; i < l; i += 3) { const a = arr[i], b = arr[i + 1], c = arr[i + 2]; indices.push(a, b, b, c, c, a); }
			} else {
				for (let i = 0, l = position.count; i < l; i += 3) indices.push(i, i + 1, i + 1, i + 2, i + 2, i);
			}
			wf.setIndex(indices);
			wf._isWireframe = true;
			wf._sourceLayout = geometry._layoutVersion;
			wf._sourceIndexVersion = index !== null ? index.version : 0;
			wf.boundingSphere = geometry.boundingSphere;
			this._wireframeGeometries.set(geometry, wf);
		}
		// three.js draws a wireframe over the source draw range scaled by 2 (one line pair per index)
		const dr = geometry.drawRange;
		wf.drawRange.start = dr.start * 2; wf.drawRange.count = dr.count === Infinity ? Infinity : dr.count * 2;
		return wf;
	}

	/** Shared setup for a draw: program, material state, textures, block binding. Returns the program. */
	_setupMaterial(item, program, material, camera, frontFaceCW, side) {
		const gl = this._gl, state = this.state;
		// a program linked during this list is already current in GL, so the GL-level switch alone cannot tell
		// a new program from the previous draw's: track the renderer-level program as well
		const programChanged = state.useProgram(program.program) || this._currentProgram !== program;
		this._currentProgram = program;
		if (programChanged) { this.info.render.programSwitches++; this._traceSwitches++; if (this._traceSeq !== null) this._traceSeq.push({ id: program.id, list: this._traceList, renderOrder: item.object.renderOrder, material: material.type + (material.name ? '(' + material.name + ')' : '') }); }
		const materialChanged = this._currentMaterial !== material || programChanged || this._currentSide !== side;
		if (materialChanged) {
			this._currentMaterial = material;
			this._currentSide = side;
			if (program.parameters.materialType === MATERIAL_SHADOW_DEPTH) state.setShadowPassMaterial(frontFaceCW, side);
			else state.setMaterial(material, frontFaceCW, side);
			if (program.hasMaterialBlock) {
				const props = this._materialProps(material);
				const offset = this._syncMaterialBlock(material, props);
				if (program.materialArray) {
					// the whole window of records around this material's slot (the batch's other materials were refreshed while it was built)
					const windowBytes = this._materialWindow * this._materialStride;
					state.bindUniformBufferRange(BLOCK_MATERIAL, this._materialBuffer, Math.floor(offset / windowBytes) * windowBytes, windowBytes);
				} else {
					state.bindUniformBufferRange(BLOCK_MATERIAL, this._materialBuffer, offset, MATERIAL_BLOCK_SIZE);
				}
			}
			if (material.isShaderMaterial) {
				this._uploadShaderMaterialUniforms(program, material, camera, programChanged);
			} else {
				this._bindMaterialTextures(material, this._materialProps(material));
			}
			if (material.isLineBasicMaterial) state.setLineWidth(material.linewidth * this._pixelRatio);
		} else if (material.isShaderMaterial && material.uniformsNeedUpdate === true) {
			this._uploadShaderMaterialUniforms(program, material, camera, true);
			material.uniformsNeedUpdate = false;
		} else {
			// frontFaceCW may differ between objects with the same material
			state.setFlipSided(frontFaceCW ? side !== BackSide : side === BackSide);
		}
		return programChanged;
	}

	_renderItem(item, scene, camera, shadowPass) {
		const object = item.object, material = item.material, group = item.group;
		let geometry = item.geometry;
		const side = this._sideOverride >= 0 ? this._sideOverride : (shadowPass ? shadowSideOf(material) : material.side);
		const program = this._sideOverride >= 0 ? this._getProgram(material, object, scene, this._variantFor(object, geometry, material, shadowPass) | this._sideVariant()) : item.program;
		if (object.onBeforeRender !== defaultOnBeforeRender) object.onBeforeRender(this, scene, camera, geometry, material, group);
		const gl = this._gl;
		if (object._flipVersion !== object._worldVersion) { object._frontFaceCW = object.isMesh && object.matrixWorld.determinant() < 0; object._flipVersion = object._worldVersion; }
		const frontFaceCW = object._frontFaceCW;
		this._setupMaterial(item, program, material, camera, frontFaceCW, side);
		if (material.wireframe === true && object.isMesh) geometry = this._wireframeGeometry(geometry);
		// per-object uniforms
		const s = object._slabData, o = object._slabOffset;
		const mu = program.modelMatrixUniform;
		if (mu !== null && (mu._lastObject !== object || mu._lastVersion !== object._worldVersion)) {
			// the cache already holds this object's matrix at this world version when both match
			mu._lastObject = object; mu._lastVersion = object._worldVersion;
			if (!cacheSlab(mu, s, o + 16, 16)) { gl.uniformMatrix4fv(mu.location, false, s, o + 16, 16); if (this._traceUniforms !== null) this._trace(mu); }
		}
		if (material.isShaderMaterial) {
			this._uploadObjectUniformsForShaderMaterial(program, object, camera);
		} else {
			const nu = program.normalMatrixUniform;
			if (nu !== null) {
				if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, o); object._normalVersion = object._worldVersion; }
				if (!cacheSlab(nu, s, o + 32, 9)) { gl.uniformMatrix3fv(nu.location, false, s, o + 32, 9); if (this._traceUniforms !== null) this._trace(nu); }
			}
		}
		if (program.spriteCenterLocation !== null) gl.uniform2f(program.spriteCenterLocation, object.center.x, object.center.y);
		if (object.isSkinnedMesh === true) this._uploadSkinning(program, object);
		if (object.morphTargetInfluences !== undefined && program.morphInfluencesUniform !== null) this._uploadMorphTargets(program, object, geometry);
		// geometry
		const page = this.pagedDraws && this.megaBuffers !== null && object.isMesh === true && object.isInstancedMesh !== true && object.isSkinnedMesh !== true && material.wireframe !== true && geometry.isInstancedBufferGeometry !== true ? this.megaBuffers.ensure(geometry) : null;
		if (page !== null && this.megaBuffers.supports(page, program)) {
			this._drawPaged(page, geometry, group, object);
			if (object.onAfterRender !== defaultOnAfterRender) object.onAfterRender(this, scene, camera, geometry, material, group);
			return;
		}
		const mode = object.isInstancedMesh ? 1 : 0;
		const record = this.bindingStates.bind(geometry, mode, object, null, program);
		let instanceCount = 1, instanced = false;
		if (object.isInstancedMesh) { instanceCount = Math.min(object.count, object.instanceMatrix.count); instanced = true; }
		else if (geometry.isInstancedBufferGeometry) { instanceCount = Math.min(geometry.instanceCount, record.maxInstancedCount); instanced = true; }
		this._draw(record, geometry, group, this._drawMode(object, material), instanceCount, instanced);
		if (object.onAfterRender !== defaultOnAfterRender) object.onAfterRender(this, scene, camera, geometry, material, group);
	}

	/** bindMatrix / bindMatrixInverse (re-sent only when the mesh's bind version changed) and the skeleton's bone texture. */
	_uploadSkinning(program, object) {
		const gl = this._gl;
		const bm = program.bindMatrixUniform, bmi = program.bindMatrixInverseUniform;
		if (bm !== null && !cacheArray(bm, object.bindMatrix.elements, 16)) { gl.uniformMatrix4fv(bm.location, false, object.bindMatrix.elements); if (this._traceUniforms !== null) this._trace(bm); }
		if (bmi !== null && !cacheArray(bmi, object.bindMatrixInverse.elements, 16)) { gl.uniformMatrix4fv(bmi.location, false, object.bindMatrixInverse.elements); if (this._traceUniforms !== null) this._trace(bmi); }
		const bt = program.boneTextureUniform;
		const skeleton = object.skeleton;
		if (bt !== null && skeleton !== undefined) {
			if (skeleton.boneTexture === null) skeleton.computeBoneTexture();
			bt.boundStamp = this._samplerStamp;
			this.textures.setTexture2D(skeleton.boneTexture, bt.unit);
		}
	}
	/** Morph target influences, base influence and the geometry's morph texture (three.js r186 texture layout). */
	_uploadMorphTargets(program, object, geometry) {
		const gl = this._gl;
		const influences = object.morphTargetInfluences;
		let sum = 0;
		for (let i = 0, l = influences.length; i < l; i++) sum += influences[i];
		const base = geometry.morphTargetsRelative ? 1 : 1 - sum;
		const bu = program.morphBaseInfluenceUniform;
		if (bu !== null && bu.cache !== base) { bu.cache = base; gl.uniform1f(bu.location, base); if (this._traceUniforms !== null) this._trace(bu); }
		const iu = program.morphInfluencesUniform;
		if (!cacheArray(iu, influences, influences.length)) { gl.uniform1fv(iu.location, influences); if (this._traceUniforms !== null) this._trace(iu); }
		const tu = program.morphTextureUniform;
		if (tu !== null) {
			const entry = this.morphtargets.get(geometry);
			tu.boundStamp = this._samplerStamp;
			this.textures.setTexture2DArray(entry.texture, tu.unit);
			const su = program.morphTextureSizeUniform;
			if (su !== null && !cacheVec(su, entry.width, entry.height, 0, 0)) { gl.uniform2i(su.location, entry.width, entry.height); if (this._traceUniforms !== null) this._trace(su); }
		}
	}

	/** One instanced draw for `instanceCount` objects sharing geometry and material; matrices come from the matrix texture at `drawBase`. */
	_renderBatch(item, drawBase, instanceCount, scene, camera, shadowPass, materialArray) {
		const object = item.object, material = item.material;
		let geometry = item.geometry;
		const gl = this._gl;
		const variant = this._variantFor(object, geometry, material, shadowPass) | V_OBJTEX | (materialArray ? V_MATARRAY : 0) | this._sideVariant();
		const program = this._getProgram(material, object, scene, variant);
		this._setupMaterial(item, program, material, camera, false, this._sideOverride >= 0 ? this._sideOverride : (shadowPass ? shadowSideOf(material) : material.side));
		if (material.wireframe === true) geometry = this._wireframeGeometry(geometry);
		const mu = program.modelMatrixUniform;
		if (mu !== null) mu._lastObject = null;
		if (mu !== null && !cacheArray(mu, IDENTITY, 16)) { gl.uniformMatrix4fv(mu.location, false, IDENTITY); if (this._traceUniforms !== null) this._trace(mu); }
		const du = program.drawBaseUniform;
		if (du !== null && du.cache !== drawBase) { du.cache = drawBase; gl.uniform1i(du.location, drawBase); if (this._traceUniforms !== null) this._trace(du); }
		this.state.bindTexture(gl.TEXTURE_2D, this.batcher.texture, TEXTURE_UNITS.objectMatrices);
		const record = this.bindingStates.bind(geometry, 0, null, null, program);
		this._draw(record, geometry, null, this._drawMode(object, material), instanceCount, true);
		this.info.render.batches++;
		this.info.render.instances += instanceCount;
	}

	/**
	 * Single draw of a geometry that lives in a mega-buffer page: the page's VAO is shared by every geometry of the
	 * layout, so consecutive draws of different geometries (of different programs too, when their attribute
	 * locations agree) keep it bound. Indices were rebased to the page when uploaded, so the draw only needs the
	 * geometry's index offset (or first vertex), no base-vertex extension.
	 */
	_drawPaged(rec, geometry, group, object) {
		const gl = this._gl, mega = this.megaBuffers;
		mega.sync(rec, geometry);
		if (!rec.counted) { rec.counted = true; this.bindingStates.register(geometry); }
		this.state.bindVertexArray(rec.page.vao);
		let drawStart = 0, drawCount = rec.indexed ? rec.indexCount : rec.vertexCount;
		if (group !== null) {
			const end = Math.min(drawCount, group.start + group.count);
			drawStart = group.start; drawCount = end - drawStart;
		}
		if (drawCount <= 0) return;
		if (rec.indexed) gl.drawElements(gl.TRIANGLES, drawCount, gl.UNSIGNED_INT, rec.byteOffset + drawStart * 4);
		else gl.drawArrays(gl.TRIANGLES, rec.baseVertex + drawStart, drawCount);
		this.info.update(drawCount, gl.TRIANGLES, 1);
	}

	_draw(record, geometry, group, mode, instanceCount, instanced) {
		const gl = this._gl;
		const index = geometry.index;
		const drawRange = geometry.drawRange;
		let drawStart, drawCount;
		if (group !== null && geometry._isWireframe === true) { _wireGroup.start = group.start * 2; _wireGroup.count = group.count * 2; group = _wireGroup; }
		if (index !== null) {
			drawStart = drawRange.start; drawCount = drawRange.count === Infinity ? index.count : drawRange.count;
			if (group !== null) {
				const end = Math.min(drawStart + drawCount, group.start + group.count);
				drawStart = Math.max(drawStart, group.start); drawCount = end - drawStart;
			}
			drawCount = Math.min(drawCount, index.count - drawStart);
			if (drawCount <= 0 || instanceCount <= 0) return;
			if (instanced) gl.drawElementsInstanced(mode, drawCount, record.indexType, drawStart * record.indexBytes, instanceCount);
			else gl.drawElements(mode, drawCount, record.indexType, drawStart * record.indexBytes);
		} else {
			const position = geometry.attributes.position;
			if (position === undefined) return;
			drawStart = drawRange.start; drawCount = drawRange.count === Infinity ? position.count : drawRange.count;
			if (group !== null) {
				const end = Math.min(drawStart + drawCount, group.start + group.count);
				drawStart = Math.max(drawStart, group.start); drawCount = end - drawStart;
			}
			drawCount = Math.min(drawCount, position.count - drawStart);
			if (drawCount <= 0 || instanceCount <= 0) return;
			if (instanced) gl.drawArraysInstanced(mode, drawStart, drawCount, instanceCount);
			else gl.drawArrays(mode, drawStart, drawCount);
		}
		this.info.update(drawCount, mode, instanceCount);
	}

	// ------------------------------------------------------------------ ShaderMaterial support

	_uploadShaderMaterialUniforms(program, material, camera, programChanged) {
		const gl = this._gl;
		const uniforms = material.uniforms;
		// Values are read from the uniform objects now (not snapshotted), so textures assigned
		// later to uniform objects shared between materials are picked up.
		this._samplerStamp++;
		let plan = material._uniformPlan;
		if (plan === undefined || plan.program !== program || plan.uniforms !== uniforms || plan.version !== material.version || plan.count !== Object.keys(uniforms).length) plan = this._buildUniformPlan(program, material);
		const names = plan.names, recs = plan.records, objs = plan.objects, n = names.length;
		if (this._traceUniforms === null) {
			for (let i = 0; i < n; i++) {
				const value = objs[i].value, u = recs[i];
				if (u === null) this._uploadUniform(program, names[i], value);
				else if (value !== null && value !== undefined) u.setter(gl, this, u, value);
			}
		} else {
			for (let i = 0; i < n; i++) {
				if (recs[i] === null) this._uploadUniform(program, names[i], objs[i].value); else setUniformValue(gl, this, recs[i], objs[i].value);
			}
		}
		// every sampler the program declares but this material left null gets an empty texture
		// of the right target on its own unit (mixed sampler types on one unit is INVALID_OPERATION)
		const samplers = program.samplerUniforms;
		for (let i = 0; i < samplers.length; i++) {
			const u = samplers[i];
			if (u.boundStamp !== this._samplerStamp) for (let k = 0; k < u.size; k++) this.textures.bindEmpty(u, u.unit + k);
		}
		const pu = program.uniforms;
		if (pu.projectionMatrix) setUniformValue(gl, this, pu.projectionMatrix, camera.projectionMatrix);
		if (pu.viewMatrix) setUniformValue(gl, this, pu.viewMatrix, camera.matrixWorldInverse);
		if (pu.cameraPosition) { const u = pu.cameraPosition, e = camera.matrixWorld.elements; if (!cacheVec(u, e[12], e[13], e[14], 0)) { gl.uniform3f(u.location, e[12], e[13], e[14]); if (this._traceUniforms !== null) this._trace(u); } }
		if (pu.isOrthographic) setUniformValue(gl, this, pu.isOrthographic, camera.isOrthographicCamera ? 1 : 0);
		if (pu.toneMappingExposure && uniforms.toneMappingExposure === undefined) setUniformValue(gl, this, pu.toneMappingExposure, this.toneMappingExposure);
		const fog = this._currentScene ? this._currentScene.fog : null;
		if (fog && material.fog === true) {
			if (pu.fogColor) setUniformValue(gl, this, pu.fogColor, fog.color);
			if (fog.isFog) { if (pu.fogNear) setUniformValue(gl, this, pu.fogNear, fog.near); if (pu.fogFar) setUniformValue(gl, this, pu.fogFar, fog.far); }
			else if (pu.fogDensity) setUniformValue(gl, this, pu.fogDensity, fog.density);
		}
	}
	/** Names (and program uniform records) a ShaderMaterial uploads to `program`; rebuilt when its uniforms object, key count, version or program change. */
	_buildUniformPlan(program, material) {
		const uniforms = material.uniforms, names = [], records = [], objects = [], pu = program.uniforms;
		for (const name in uniforms) {
			const u = pu[name];
			if (u !== undefined) { if (u.setter === undefined) u.setter = pickSetter(this._gl, u.type); names.push(name); records.push(u); objects.push(uniforms[name]); continue; }
			const v = uniforms[name].value;
			// struct / array-of-struct / flattened-array values resolve to nested program uniforms at upload time
			if (v !== null && v !== undefined && (Array.isArray(v) || (typeof v === 'object' && !isLeafValue(v)))) { names.push(name); records.push(null); objects.push(uniforms[name]); }
		}
		return (material._uniformPlan = { program, uniforms, version: material.version, count: Object.keys(uniforms).length, names, records, objects });
	}
	/** Uploads one uniform value; recurses into structs ({...}) and arrays of structs like three.js. */
	_uploadUniform(program, name, value) {
		const u = program.uniforms[name];
		if (u !== undefined) { setUniformValue(this._gl, this, u, value); return; }
		if (value === null || value === undefined) return;
		if (Array.isArray(value)) {
			if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null && !isLeafValue(value[0])) {
				for (let i = 0; i < value.length; i++) this._uploadUniform(program, name + '[' + i + ']', value[i]);
			} else if (value.length > 0 && isLeafValue(value[0])) {
				// array of vectors / colours / matrices -> flatten into the [0]-stripped array uniform
				const arr = program.uniforms[name];
				if (arr !== undefined) setUniformValue(this._gl, this, arr, value);
			}
		} else if (typeof value === 'object' && !isLeafValue(value)) {
			for (const key in value) this._uploadUniform(program, name + '.' + key, value[key]);
		}
	}
	_uploadObjectUniformsForShaderMaterial(program, object, camera) {
		const gl = this._gl;
		const mvu = program.modelViewMatrixUniform, nu = program.normalMatrixUniform;
		if (mvu !== null || nu !== null) {
			object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
			if (mvu !== null) { const e = object.modelViewMatrix.elements; if (!cacheArray(mvu, e, 16)) { gl.uniformMatrix4fv(mvu.location, false, e); if (this._traceUniforms !== null) this._trace(mvu); } }
			if (nu !== null) {
				object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
				const e = object.normalMatrix.elements;
				if (!cacheArray(nu, e, 9)) { gl.uniformMatrix3fv(nu.location, false, e); if (this._traceUniforms !== null) this._trace(nu); }
			}
		}
	}
	_trace(u) { this._traceUniforms.set(u.name, (this._traceUniforms.get(u.name) || 0) + 1); }
}

/** NDC depth of a world-space point under the current projScreen matrix (three.js's transparent sort key). */
function ndcDepth(x, y, z) {
	const m = _projScreenMatrix.elements;
	const w = m[3] * x + m[7] * y + m[11] * z + m[15];
	return (m[2] * x + m[6] * y + m[10] * z + m[14]) / (w === 0 ? 1 : w);
}
/** True when three.js renders this material in two passes (back faces first, then front faces). */
function isTwoPass(material, shadowPass) {
	return shadowPass === false && material.transparent === true && material.side === DoubleSide && material.forceSinglePass === false;
}
function shadowSideOf(material) {
	if (material.shadowSide !== null && material.shadowSide !== undefined) return material.shadowSide;
	return material.side === FrontSide ? BackSide : (material.side === BackSide ? FrontSide : DoubleSide);
}

const _wireGroup = { start: 0, count: 0, materialIndex: 0 };
const MAP_KEYS = ['map', 'alphaMap', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'specularMap'];
const BATCH_SIG_SIZE = MAP_KEYS.length + 34; // see _batchGroupOf
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/**
 * Does this context accept a std140 struct array inside a uniform block indexed by a non-constant
 * expression (a flat varying in the fragment stage)? GLSL ES 3.00 allows it for uniforms, but the
 * material-index batching path keeps the per-material block for any driver that rejects it.
 */
function probeMaterialArray(gl) {
	const block = 'struct R { vec4 a; vec4 b; };\nlayout(std140) uniform Materials { R materials[ 4 ]; };\n';
	const vsSrc = '#version 300 es\nprecision highp float;\n' + block + 'flat out int v;\nvoid main() { v = gl_VertexID & 3; gl_Position = materials[ v ].a; }\n';
	const fsSrc = '#version 300 es\nprecision highp float;\n' + block + 'flat in int v;\nout vec4 fragColor;\nvoid main() { fragColor = materials[ v ].b; }\n';
	const program = gl.createProgram();
	const vs = gl.createShader(gl.VERTEX_SHADER), fs = gl.createShader(gl.FRAGMENT_SHADER);
	gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
	gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
	gl.attachShader(program, vs); gl.attachShader(program, fs);
	gl.linkProgram(program);
	const ok = gl.getProgramParameter(program, gl.LINK_STATUS) === true && gl.getShaderParameter(vs, gl.COMPILE_STATUS) === true && gl.getShaderParameter(fs, gl.COMPILE_STATUS) === true;
	gl.deleteShader(vs); gl.deleteShader(fs); gl.deleteProgram(program);
	return ok;
}

// WebGL2 uniform type enums as literals: reading them off the context costs a getter call per switch case
const U_FLOAT = 0x1406;
const U_INT = 0x1404;
const U_BOOL = 0x8B56;
const U_UNSIGNED_INT = 0x1405;
const U_FLOAT_VEC2 = 0x8B50;
const U_FLOAT_VEC3 = 0x8B51;
const U_FLOAT_VEC4 = 0x8B52;
const U_INT_VEC2 = 0x8B53;
const U_INT_VEC3 = 0x8B54;
const U_INT_VEC4 = 0x8B55;
const U_BOOL_VEC2 = 0x8B57;
const U_BOOL_VEC3 = 0x8B58;
const U_BOOL_VEC4 = 0x8B59;
const U_FLOAT_MAT2 = 0x8B5A;
const U_FLOAT_MAT3 = 0x8B5B;
const U_FLOAT_MAT4 = 0x8B5C;
const U_SAMPLER_2D = 0x8B5E;
const U_SAMPLER_3D = 0x8B5F;
const U_SAMPLER_CUBE = 0x8B60;
const U_SAMPLER_2D_SHADOW = 0x8B62;
const U_SAMPLER_2D_ARRAY = 0x8DC1;
const U_SAMPLER_2D_ARRAY_SHADOW = 0x8DC4;
const U_SAMPLER_CUBE_SHADOW = 0x8DC5;
const U_INT_SAMPLER_2D = 0x8DCA;
const U_INT_SAMPLER_3D = 0x8DCB;
const U_INT_SAMPLER_2D_ARRAY = 0x8DCF;
const U_UNSIGNED_INT_SAMPLER_2D = 0x8DD2;
const U_UNSIGNED_INT_SAMPLER_3D = 0x8DD3;
const U_UNSIGNED_INT_SAMPLER_2D_ARRAY = 0x8DD7;

function isLeafValue(v) {
	return v.isVector2 || v.isVector3 || v.isVector4 || v.isColor || v.isMatrix3 || v.isMatrix4 || v.isQuaternion || v.isTexture || ArrayBuffer.isView(v);
}
function flattenArray(value, stride) {
	if (ArrayBuffer.isView(value)) return value;
	if (typeof value[0] === 'number') return value;
	const out = new Float32Array(value.length * stride);
	for (let i = 0; i < value.length; i++) {
		const v = value[i];
		if (v.isColor) { out[i * stride] = v.r; out[i * stride + 1] = v.g; out[i * stride + 2] = v.b; }
		else if (v.elements) out.set(v.elements, i * stride);
		else v.toArray(out, i * stride);
	}
	return out;
}
function bindTextureUniform(renderer, u, value, unit) {
	const gl = renderer._gl;
	if (!value || !value.isTexture) return;
	// never sample a texture attached to the framebuffer being rendered to (feedback loop)
	if (value.renderTarget !== null && value.renderTarget !== undefined && value.renderTarget === renderer._currentRenderTarget) { renderer.textures.bindEmpty(u, unit); return; }
	if (u.type === U_SAMPLER_3D) renderer.textures.setTexture3D(value, unit);
	else if (u.type === U_SAMPLER_2D_ARRAY) renderer.textures.setTexture2DArray(value, unit);
	else if (u.type === U_SAMPLER_CUBE || u.type === U_SAMPLER_CUBE_SHADOW) renderer.textures.setTextureCube(value, unit);
	else renderer.textures.setTexture2D(value, unit);
}
/** True if `u.cache` already holds these components; otherwise stores them. */
/** Bitwise-equal compare of two same-length float images (NaN-safe: a NaN never equals, so it just re-uploads). */
function sameFloats(a, b) {
	for (let i = 0, n = a.length; i < n; i++) if (a[i] !== b[i]) return false;
	return true;
}

function cacheVec(u, a, b, c, d) {
	let k = u.cache;
	if (k === undefined) { k = u.cache = new Float64Array(4); k[0] = NaN; }
	if (k[0] === a && k[1] === b && k[2] === c && k[3] === d) return true;
	k[0] = a; k[1] = b; k[2] = c; k[3] = d;
	return false;
}
/** True if `u.cache` equals arr[offset .. offset+n); otherwise copies it. Used for slab-backed matrices. */
function cacheSlab(u, arr, offset, n) {
	let k = u.cache;
	if (k === undefined || k.length !== n) { k = u.cache = new Float64Array(n); for (let i = 0; i < n; i++) k[i] = arr[offset + i]; return false; }
	let same = true;
	for (let i = 0; i < n; i++) { if (k[i] !== arr[offset + i]) { same = false; break; } }
	if (same) return true;
	for (let i = 0; i < n; i++) k[i] = arr[offset + i];
	return false;
}
/** True if `u.cache` equals the array `arr` (length n); otherwise copies it. */
function cacheArray(u, arr, n) {
	let k = u.cache;
	if (k === undefined || k.length !== n) { k = u.cache = new Float64Array(n); for (let i = 0; i < n; i++) k[i] = arr[i]; return false; }
	let same = true;
	for (let i = 0; i < n; i++) { if (k[i] !== arr[i]) { same = false; break; } }
	if (same) return true;
	for (let i = 0; i < n; i++) k[i] = arr[i];
	return false;
}
function setUniformValue(gl, renderer, u, value) {
	if (renderer._traceUniforms === null) return setUniformValueImpl(gl, renderer, u, value);
	// tracing: detect whether an upload happened by counting GL calls through a tiny proxy
	const before = traceCounter;
	setUniformValueImpl(gl, renderer, u, value);
	if (traceCounter !== before) renderer._trace(u);
}
let traceCounter = 0;
function setUniformValueImpl(gl, renderer, u, value) {
	if (value === null || value === undefined) return;
	let f = u.setter;
	if (f === undefined) f = u.setter = pickSetter(gl, u.type);
	f(gl, renderer, u, value);
}
const noopSetter = () => {};
function setFloat(gl, renderer, u, value) {
	if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) { if (!cacheArray(u, value, value.length)) { traceCounter++; gl.uniform1fv(u.location, value); } }
	else if (u.cache !== value) { u.cache = value; traceCounter++; gl.uniform1f(u.location, value); }
}
function setInt(gl, renderer, u, value) {
	if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) { if (!cacheArray(u, value, value.length)) { traceCounter++; gl.uniform1iv(u.location, value); } }
	else { const v = value ? (typeof value === 'boolean' ? 1 : value) : 0; if (u.cache !== v) { u.cache = v; traceCounter++; gl.uniform1i(u.location, v); } }
}
function setUint(gl, renderer, u, value) {
	if (u.size > 1) { traceCounter++; gl.uniform1uiv(u.location, value); } else if (u.cache !== value) { u.cache = value; traceCounter++; gl.uniform1ui(u.location, value); }
}
function setVec2(gl, renderer, u, value) {
	if (value.isVector2) { if (!cacheVec(u, value.x, value.y, 0, 0)) { traceCounter++; gl.uniform2f(u.location, value.x, value.y); } }
	else { const a = flattenArray(value, 2); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniform2fv(u.location, a); } }
}
function setVec3(gl, renderer, u, value) {
	if (value.isVector3) { if (!cacheVec(u, value.x, value.y, value.z, 0)) { traceCounter++; gl.uniform3f(u.location, value.x, value.y, value.z); } }
	else if (value.isColor) { if (!cacheVec(u, value.r, value.g, value.b, 0)) { traceCounter++; gl.uniform3f(u.location, value.r, value.g, value.b); } }
	else { const a = flattenArray(value, 3); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniform3fv(u.location, a); } }
}
function setVec4(gl, renderer, u, value) {
	if (value.isVector4 || value.isQuaternion) { if (!cacheVec(u, value.x, value.y, value.z, value.w)) { traceCounter++; gl.uniform4f(u.location, value.x, value.y, value.z, value.w); } }
	else { const a = flattenArray(value, 4); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniform4fv(u.location, a); } }
}
function setIVec2(gl, renderer, u, value) { traceCounter++; if (value.isVector2) gl.uniform2i(u.location, value.x, value.y); else gl.uniform2iv(u.location, value); }
function setIVec3(gl, renderer, u, value) { traceCounter++; if (value.isVector3) gl.uniform3i(u.location, value.x, value.y, value.z); else gl.uniform3iv(u.location, value); }
function setIVec4(gl, renderer, u, value) { traceCounter++; if (value.isVector4) gl.uniform4i(u.location, value.x, value.y, value.z, value.w); else gl.uniform4iv(u.location, value); }
function setMat2(gl, renderer, u, value) { const a = value.elements || flattenArray(value, 4); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniformMatrix2fv(u.location, false, a); } }
function setMat3(gl, renderer, u, value) { const a = value.elements || flattenArray(value, 9); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniformMatrix3fv(u.location, false, a); } }
function setMat4(gl, renderer, u, value) { const a = value.elements || flattenArray(value, 16); if (!cacheArray(u, a, a.length)) { traceCounter++; gl.uniformMatrix4fv(u.location, false, a); } }
function setSampler(gl, renderer, u, value) {
	// units were assigned at link time (u.unit .. u.unit + size - 1); bind textures, placeholders for gaps
	u.boundStamp = renderer._samplerStamp;
	if (Array.isArray(value)) {
		for (let i = 0; i < u.size; i++) {
			const t = value[i];
			if (t && t.isTexture) bindTextureUniform(renderer, u, t, u.unit + i); else renderer.textures.bindEmpty(u, u.unit + i);
		}
	} else if (value.isTexture) {
		bindTextureUniform(renderer, u, value, u.unit);
	} else {
		renderer.textures.bindEmpty(u, u.unit);
	}
}
/** The upload function for a GL uniform type (chosen once per uniform record). */
function pickSetter(gl, type) {
	switch (type) {
		case U_FLOAT: return setFloat;
		case U_INT: case U_BOOL: return setInt;
		case U_UNSIGNED_INT: return setUint;
		case U_FLOAT_VEC2: return setVec2;
		case U_FLOAT_VEC3: return setVec3;
		case U_FLOAT_VEC4: return setVec4;
		case U_INT_VEC2: case U_BOOL_VEC2: return setIVec2;
		case U_INT_VEC3: case U_BOOL_VEC3: return setIVec3;
		case U_INT_VEC4: case U_BOOL_VEC4: return setIVec4;
		case U_FLOAT_MAT2: return setMat2;
		case U_FLOAT_MAT3: return setMat3;
		case U_FLOAT_MAT4: return setMat4;
		case U_SAMPLER_2D: case U_SAMPLER_2D_SHADOW: case U_SAMPLER_3D: case U_SAMPLER_2D_ARRAY: case U_SAMPLER_CUBE: case U_SAMPLER_CUBE_SHADOW:
		case U_INT_SAMPLER_2D: case U_UNSIGNED_INT_SAMPLER_2D: case U_INT_SAMPLER_3D: case U_UNSIGNED_INT_SAMPLER_3D: case U_INT_SAMPLER_2D_ARRAY: case U_UNSIGNED_INT_SAMPLER_2D_ARRAY:
			return setSampler;
		default: return noopSetter;
	}
}

function createCanvasElement() {
	const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
	canvas.style.display = 'block';
	return canvas;
}

export { WebGLRenderer };
