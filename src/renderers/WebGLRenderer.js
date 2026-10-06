import {
	REVISION, NoToneMapping, SRGBColorSpace, LinearSRGBColorSpace, PCFShadowMap, FrontSide, BackSide, DoubleSide,
	UnsignedByteType, RGBAFormat
} from '../constants.js';
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
import { WebGLState } from './webgl/WebGLState.js';
import { WebGLAttributes } from './webgl/WebGLAttributes.js';
import { WebGLTextures } from './webgl/WebGLTextures.js';
import { WebGLPrograms, BLOCK_FRAME, BLOCK_LIGHTS, BLOCK_MATERIAL } from './webgl/WebGLPrograms.js';
import { WebGLRenderLists } from './webgl/WebGLRenderLists.js';
import { WebGLLights } from './webgl/WebGLLights.js';
import { WebGLBindingStates } from './webgl/WebGLBindingStates.js';
import { WebGLBatcher } from './webgl/WebGLBatcher.js';
import { WebGLInfo } from './webgl/WebGLInfo.js';
import { WebGLShadowMap } from './webgl/WebGLShadowMap.js';
import { MATERIAL_SHADER, MATERIAL_SPRITE, MATERIAL_POINTS, FRAME_BLOCK_SIZE, LIGHTS_BLOCK_SIZE, MATERIAL_BLOCK_SIZE, TEXTURE_UNITS } from './shaders/ShaderLib.js';

const _projScreenMatrix = /*@__PURE__*/ new Matrix4();
const _vector3 = /*@__PURE__*/ new Vector3();
const _color = /*@__PURE__*/ new Color();
const _frustum = /*@__PURE__*/ new Frustum();
const _emptyScene = { fog: null, environment: null, background: null, overrideMaterial: null, isScene: true, matrixWorldAutoUpdate: false, children: [], visible: true };

// variant bits for program selection
const V_INSTANCING = 1, V_INSTANCING_COLOR = 2, V_RECEIVE_SHADOW = 4, V_SHADOW_PASS = 8;
const V_HAS_UV = 16, V_HAS_UV1 = 32, V_HAS_COLOR = 64, V_COLOR_ALPHA = 128;

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
		this.debug = { checkShaderErrors: true, onShaderError: null };
		this.autoClear = true; this.autoClearColor = true; this.autoClearDepth = true; this.autoClearStencil = true;
		this.sortObjects = true;
		/** Draw consecutive objects sharing geometry and material with one instanced draw call. */
		this.autoBatch = true;
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
		this._renderCallDepth = 0;
		this._frameId = 0;
		this._envVersion = 0;
		this._lastEnvKey = '';
		this._lastLightsVersion = -1;
		this._samplerStamp = 0;
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
		this.bindingStates = new WebGLBindingStates(gl, this.state, this.attributes);
		this.batcher = new WebGLBatcher(gl);
		this.shadowMap = new WebGLShadowMap(this);
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
		this._frameBuffer = gl.createBuffer();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
		gl.bufferData(gl.UNIFORM_BUFFER, FRAME_BLOCK_SIZE, gl.DYNAMIC_DRAW);
		this._lightsBuffer = gl.createBuffer();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
		gl.bufferData(gl.UNIFORM_BUFFER, LIGHTS_BLOCK_SIZE, gl.DYNAMIC_DRAW);
		this._materialStride = Math.max(MATERIAL_BLOCK_SIZE, this.state.uboAlignment);
		this._materialCapacity = 256;
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
		this._renderOrders = new Map();
		this._renderOrderList = [];
		this._rankOfRenderOrder = (ro) => { const r = this._renderOrders.get(ro); return r === undefined ? 63 : r; };

		// draw commands
		this._cmdCapacity = 1024;
		this._cmdItem = new Array(this._cmdCapacity);
		this._cmdOffset = new Int32Array(this._cmdCapacity);
		this._cmdCount = new Int32Array(this._cmdCapacity);
		this._cmdN = 0;

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
		ColorManagement.fromWorkingColorSpace(_color, this._currentRenderTarget === null ? this._outputColorSpace : this._currentRenderTarget.texture.colorSpace);
		let r = _color.r, g = _color.g, b = _color.b;
		if (this._premultipliedAlpha) { r *= a; g *= a; b *= a; }
		this.state.setClearColor(r, g, b, a);
	}
	clear(color = true, depth = true, stencil = true) {
		const gl = this._gl;
		let bits = 0;
		if (color) bits |= gl.COLOR_BUFFER_BIT;
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
		this._gl.deleteBuffer(this._frameBuffer); this._gl.deleteBuffer(this._lightsBuffer); this._gl.deleteBuffer(this._materialBuffer);
		this.setAnimationLoop(null);
	}
	_onContextLost(event) { event.preventDefault(); this._isContextLost = true; }
	_onContextRestore() { this._isContextLost = false; this.state.reset(); this.programs.dispose(); this._materialProperties = new WeakMap(); }
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
	getActiveCubeFace() { return 0; }
	getActiveMipmapLevel() { return 0; }
	setRenderTarget(renderTarget) {
		this._currentRenderTarget = renderTarget;
		const state = this.state;
		if (renderTarget !== null) {
			const framebuffer = this.textures.setupRenderTarget(renderTarget);
			state.bindFramebuffer(framebuffer);
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
		this.lights.end(this.shadowMap.enabled);
		this.lights.fill();
		scene.traverse((o) => {
			if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && o.material) {
				const mats = Array.isArray(o.material) ? o.material : [o.material];
				for (const m of mats) this._getProgram(m, o, targetScene, o.isInstancedMesh ? V_INSTANCING : 0);
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
		if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
		if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
		this._frameId++;
		this._renderCallDepth++;
		this._currentCamera = camera;
		this._currentScene = scene;
		this._materialCounter = 0; this._geometryCounter = 0;
		this._currentMaterial = null; this._currentSide = -1;
		this._updateEnv(scene);

		_projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
		_frustum.setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);

		const list = this.renderLists.get(scene, this._renderCallDepth - 1);
		list.init();
		this.lights.begin();
		this._renderOrderReset();
		this._projectObject(scene, camera, 0, this.sortObjects, list);
		this.lights.end(this.shadowMap.enabled);
		if (this.lights.version !== this._lastLightsVersion) { this._lastLightsVersion = this.lights.version; this._envVersion++; }
		this._resolvePrograms(list, scene);

		if (this.info.autoReset === true && this._renderCallDepth === 1) this.info.reset();

		// shadows (renders into other targets; restores ours)
		this.shadowMap.render(this.lights, scene, camera);

		// per-frame blocks (light data is filled after the shadow pass so shadow matrices are current)
		this.lights.fill();
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
		gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.lights.data);
		this.state.currentUniformBuffer = this._lightsBuffer;
		this._uploadFrameBlock(camera, scene);
		this.shadowMap.bindShadowMaps(this.lights);

		list.finish(this.sortObjects, this._rankOfRenderOrder);

		// background + clear
		const background = scene.background;
		if (background !== null && background.isColor) {
			_color.copy(background);
			ColorManagement.fromWorkingColorSpace(_color, this._currentRenderTarget === null ? this._outputColorSpace : this._currentRenderTarget.texture.colorSpace);
			this.state.setClearColor(_color.r, _color.g, _color.b, 1);
			if (this.autoClear || this.autoClearColor) this.clear(true, this.autoClearDepth, this.autoClearStencil);
			this._applyClearColor();
		} else if (this.autoClear) {
			this.clear(this.autoClearColor, this.autoClearDepth, this.autoClearStencil);
		}

		if (scene.isScene === true) scene.onBeforeRender(this, scene, camera, this._currentRenderTarget);
		this._drawList(list, list.opaqueSorted, list.opaqueCount, scene, camera, false);
		this._drawList(list, list.transparentSorted, list.transparentCount, scene, camera, false);
		if (scene.isScene === true) scene.onAfterRender(this, scene, camera);

		if (this._currentRenderTarget !== null) this.textures.updateRenderTargetMipmap(this._currentRenderTarget);
		this.state.bindVertexArray(null);
		this._currentGeometryRecord = null;
		this._renderCallDepth--;
		if (this._renderCallDepth === 0) this.info.render.frame++;
	}

	_renderOrderReset() { this._renderOrders.clear(); this._renderOrderList.length = 0; }
	_noteRenderOrder(ro) {
		if (!this._renderOrders.has(ro)) {
			const l = this._renderOrderList;
			l.push(ro);
			l.sort((a, b) => a - b);
			this._renderOrders.clear();
			for (let i = 0; i < l.length; i++) this._renderOrders.set(l[i], Math.min(i, 63));
		}
	}

	/** Detects changes in frame-wide shader-affecting state and bumps the env version. */
	_updateEnv(scene) {
		const target = this._currentRenderTarget;
		const cs = target === null ? this._outputColorSpace : target.texture.colorSpace;
		const fog = scene.fog === null ? 0 : (scene.fog.isFogExp2 ? 2 : 1);
		const key = this.toneMapping + '|' + cs + '|' + (this.shadowMap.enabled ? 1 : 0) + '|' + fog;
		if (key !== this._lastEnvKey) { this._lastEnvKey = key; this._envVersion++; }
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
			d[52] = fog.color.r; d[53] = fog.color.g; d[54] = fog.color.b; d[55] = fog.isFogExp2 ? 2 : 1;
			d[56] = fog.near !== undefined ? fog.near : 0; d[57] = fog.far !== undefined ? fog.far : 0; d[58] = fog.density !== undefined ? fog.density : 0;
		} else {
			d[52] = 0; d[53] = 0; d[54] = 0; d[55] = 0; d[56] = 0; d[57] = 0; d[58] = 0;
		}
		d[59] = this.toneMappingExposure;
		const v = this._currentViewport;
		d[60] = v.x; d[61] = v.y; d[62] = v.z; d[63] = v.w;
		gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
		gl.bufferSubData(gl.UNIFORM_BUFFER, 0, d);
		this.state.currentUniformBuffer = this._frameBuffer;
	}

	// ------------------------------------------------------------------ projection / culling

	/** World-space bounding sphere test against `frustum`, with the sphere cached in slab memory per world version. */
	_cullTest(object, geometry, frustum) {
		let bs;
		if (object.isInstancedMesh) {
			if (object.boundingSphere === null) object.computeBoundingSphere();
			bs = object.boundingSphere;
		} else {
			if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
			bs = geometry.boundingSphere;
		}
		const s = object._slabData, o = object._slabOffset;
		const c = bs.center;
		if (object._cullVersion !== object._worldVersion || object._cullSphere !== bs || object._cullRadius !== bs.radius || object._cullCx !== c.x || object._cullCy !== c.y || object._cullCz !== c.z) {
			const e = o + 16;
			const x = c.x, y = c.y, z = c.z;
			const e0 = s[e], e1 = s[e + 1], e2 = s[e + 2], e4 = s[e + 4], e5 = s[e + 5], e6 = s[e + 6], e8 = s[e + 8], e9 = s[e + 9], e10 = s[e + 10];
			s[o + 41] = e0 * x + e4 * y + e8 * z + s[e + 12];
			s[o + 42] = e1 * x + e5 * y + e9 * z + s[e + 13];
			s[o + 43] = e2 * x + e6 * y + e10 * z + s[e + 14];
			const sx = e0 * e0 + e1 * e1 + e2 * e2, sy = e4 * e4 + e5 * e5 + e6 * e6, sz = e8 * e8 + e9 * e9 + e10 * e10;
			s[o + 44] = bs.radius * Math.sqrt(sx > sy ? (sx > sz ? sx : sz) : (sy > sz ? sy : sz));
			object._cullVersion = object._worldVersion; object._cullSphere = bs; object._cullRadius = bs.radius;
			object._cullCx = c.x; object._cullCy = c.y; object._cullCz = c.z;
		}
		return frustum.intersectsSphereFlat(s[o + 41], s[o + 42], s[o + 43], s[o + 44]);
	}

	_projectObject(object, camera, groupOrder, sortObjects, list) {
		if (object.visible === false) return;
		const visible = object.layers.test(camera.layers);
		if (visible) {
			if (object.isGroup) {
				groupOrder = object.renderOrder;
			} else if (object.isLOD) {
				if (object.autoUpdate === true) object.update(camera);
			} else if (object.isLight) {
				this.lights.push(object);
			} else if (object.isSprite) {
				if (!object.frustumCulled || _frustum.intersectsSprite(object)) {
					const material = object.material;
					if (material.visible) {
						const we = object.matrixWorld.elements, ve = camera.matrixWorldInverse.elements;
						const z = -(ve[2] * we[12] + ve[6] * we[13] + ve[10] * we[14] + ve[14]);
						this._pushItem(list, object, object.geometry, material, null, z, false);
					}
				}
			} else if (object.isMesh || object.isLine || object.isPoints) {
				const geometry = object.geometry;
				const material = object.material;
				if (!object.frustumCulled || this._cullTest(object, geometry, _frustum)) {
					let z = 0;
					if (sortObjects) {
						// cached world center is in the slab after _cullTest; if culling is off, use the object position
						const s = object._slabData, o = object._slabOffset, ve = camera.matrixWorldInverse.elements;
						let cx, cy, cz;
						if (object.frustumCulled) { cx = s[o + 41]; cy = s[o + 42]; cz = s[o + 43]; }
						else { cx = s[o + 28]; cy = s[o + 29]; cz = s[o + 30]; }
						z = -(ve[2] * cx + ve[6] * cy + ve[10] * cz + ve[14]);
					}
					if (Array.isArray(material)) {
						const groups = geometry.groups;
						for (let i = 0, l = groups.length; i < l; i++) {
							const group = groups[i];
							const groupMaterial = material[group.materialIndex];
							if (groupMaterial && groupMaterial.visible) this._pushItem(list, object, geometry, groupMaterial, group, z, false);
						}
					} else if (material.visible) {
						this._pushItem(list, object, geometry, material, null, z, false);
					}
				}
			}
		}
		const children = object.children;
		for (let i = 0, l = children.length; i < l; i++) this._projectObject(children[i], camera, groupOrder, sortObjects, list);
	}

	_pushItem(list, object, geometry, material, group, z, shadowPass) {
		const variant = this._variantFor(object, geometry, material, shadowPass);
		this._noteRenderOrder(object.renderOrder);
		// compact per-frame ids for materials and geometries (dense -> good key packing)
		const frame = this._frameId;
		if (material._frameStamp !== frame) { material._frameStamp = frame; material._frameRid = this._materialCounter++; }
		if (geometry._frameStamp !== frame) { geometry._frameStamp = frame; geometry._frameRid = this._geometryCounter++; }
		list.push(object, geometry, material, group, z, material._frameRid, geometry._frameRid, variant);
	}

	/** Resolve the program of every item in the list. Runs after the frame's lights are collected. */
	_resolvePrograms(list, scene) {
		const items = list.items, n = list.count;
		for (let i = 0; i < n; i++) {
			const item = items[i];
			item.program = this._getProgram(item.material, item.object, scene, item.variant);
		}
	}

	_variantFor(object, geometry, material, shadowPass) {
		let v = 0;
		if (object.isInstancedMesh) { v |= V_INSTANCING; if (object.instanceColor !== null) v |= V_INSTANCING_COLOR; }
		if (object.receiveShadow) v |= V_RECEIVE_SHADOW;
		if (shadowPass) v |= V_SHADOW_PASS;
		const attributes = geometry.attributes;
		if (attributes.uv !== undefined) v |= V_HAS_UV;
		if (attributes.uv1 !== undefined) v |= V_HAS_UV1;
		if (material.vertexColors === true && attributes.color !== undefined) { v |= V_HAS_COLOR; if (attributes.color.itemSize === 4) v |= V_COLOR_ALPHA; }
		return v;
	}

	// ------------------------------------------------------------------ materials / programs

	_materialProps(material) {
		let props = this._materialProperties.get(material);
		if (props === undefined) {
			props = { programs: [], blockData: new Float32Array(MATERIAL_BLOCK_SIZE / 4), blockSlot: -1, blockStamp: -1, textureStamp: -1 };
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
			for (let i = 0; i < props.programs.length; i++) { const e = props.programs[i]; if (e) this.programs.releaseProgram(e.program); }
			if (props.blockSlot >= 0) this._materialFreeSlots.push(props.blockSlot);
		}
		this._materialProperties.delete(material);
	}

	_getProgram(material, object, scene, variant) {
		const props = this._materialProps(material);
		let entry = props.programs[variant];
		if (entry !== undefined && entry.materialVersion === material.version && entry.envVersion === this._envVersion) return entry.program;
		const vflags = {
			instancing: (variant & V_INSTANCING) !== 0, instancingColor: (variant & V_INSTANCING_COLOR) !== 0,
			receiveShadow: (variant & V_RECEIVE_SHADOW) !== 0, shadowPass: (variant & V_SHADOW_PASS) !== 0,
		};
		const parameters = this.programs.getParameters(material, object, scene || _emptyScene, this.lights, vflags);
		if (entry !== undefined && entry.program.parameters.key === parameters.key && material.isShaderMaterial !== true) {
			entry.materialVersion = material.version; entry.envVersion = this._envVersion;
			return entry.program;
		}
		const program = this.programs.acquireProgram(parameters, material);
		if (entry !== undefined) this.programs.releaseProgram(entry.program);
		entry = { program, materialVersion: material.version, envVersion: this._envVersion };
		props.programs[variant] = entry;
		material._programDirty = false;
		return program;
	}

	/** Refresh the material's uniform block (once per frame per material) and return its byte offset. */
	_syncMaterialBlock(material, props) {
		if (props.blockStamp === this._frameId) return props.blockSlot * this._materialStride;
		props.blockStamp = this._frameId;
		const gl = this._gl;
		if (props.blockSlot < 0) {
			let slot = this._materialFreeSlots.pop();
			if (slot === undefined) {
				if (this._materialSlotsUsed === this._materialCapacity) {
					// grow buffer
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
		const b = props.blockData;
		let dirty = false;
		for (let i = 0; i < 32; i++) { if (b[i] !== s[i]) { dirty = true; break; } }
		const offset = props.blockSlot * this._materialStride;
		if (dirty) {
			b.set(s);
			this.state.bindUniformBuffer(this._materialBuffer);
			gl.bufferSubData(gl.UNIFORM_BUFFER, offset, b);
		}
		return offset;
	}

	_bindMaterialTextures(material) {
		const t = this.textures;
		if (material.map) t.setTexture2D(material.map, TEXTURE_UNITS.map);
		if (material.alphaMap) t.setTexture2D(material.alphaMap, TEXTURE_UNITS.alphaMap);
		if (material.normalMap) t.setTexture2D(material.normalMap, TEXTURE_UNITS.normalMap);
		if (material.emissiveMap) t.setTexture2D(material.emissiveMap, TEXTURE_UNITS.emissiveMap);
		if (material.roughnessMap) t.setTexture2D(material.roughnessMap, TEXTURE_UNITS.roughnessMap);
		if (material.metalnessMap) t.setTexture2D(material.metalnessMap, TEXTURE_UNITS.metalnessMap);
		if (material.aoMap) t.setTexture2D(material.aoMap, TEXTURE_UNITS.aoMap);
		if (material.specularMap) t.setTexture2D(material.specularMap, TEXTURE_UNITS.specularMap);
	}

	// ------------------------------------------------------------------ drawing

	_isBatchable(item) {
		const object = item.object;
		return object.isMesh === true && object.isInstancedMesh !== true && object.isSkinnedMesh !== true && item.group === null &&
			item.material.isShaderMaterial !== true && object.morphTargetInfluences === undefined &&
			object.onBeforeRender === defaultOnBeforeRender && object.onAfterRender === defaultOnAfterRender;
	}

	/**
	 * Build draw commands (singles and batches) from a sorted key list, then execute them.
	 */
	_drawList(list, keys, n, scene, camera, shadowPass) {
		if (n === 0) return;
		this._currentScene = scene;
		const batcher = this.batcher;
		batcher.begin();
		let cmdN = 0;
		const autoBatch = this.autoBatch;
		let i = 0;
		while (i < n) {
			const item = list.itemFromKey(keys[i]);
			let j = i + 1;
			if (autoBatch && this._isBatchable(item)) {
				while (j < n) {
					const next = list.itemFromKey(keys[j]);
					if (next.geometry === item.geometry && next.material === item.material && next.program === item.program &&
						next.renderOrder === item.renderOrder && this._isBatchable(next)) j++;
					else break;
				}
			}
			if (cmdN === this._cmdCapacity) this._growCommands();
			this._cmdItem[cmdN] = item;
			if (j - i >= 2) {
				batcher.ensure(j - i);
				this._cmdOffset[cmdN] = batcher.count;
				this._cmdCount[cmdN] = j - i;
				for (let k = i; k < j; k++) batcher.add(list.itemFromKey(keys[k]).object);
			} else {
				this._cmdOffset[cmdN] = -1;
				this._cmdCount[cmdN] = 1;
			}
			cmdN++;
			i = j;
		}
		batcher.upload();
		for (let c = 0; c < cmdN; c++) {
			const item = this._cmdItem[c];
			if (this._cmdOffset[c] >= 0) this._renderBatch(item, this._cmdOffset[c], this._cmdCount[c], scene, camera, shadowPass);
			else this._renderItem(item, scene, camera, shadowPass);
			this._cmdItem[c] = null;
		}
	}
	_growCommands() {
		const cap = this._cmdCapacity * 2;
		const a = new Array(cap); for (let i = 0; i < this._cmdCapacity; i++) a[i] = this._cmdItem[i];
		const o = new Int32Array(cap); o.set(this._cmdOffset);
		const cnt = new Int32Array(cap); cnt.set(this._cmdCount);
		this._cmdItem = a; this._cmdOffset = o; this._cmdCount = cnt; this._cmdCapacity = cap;
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
			wf._sourceLayout = geometry._layoutVersion;
			wf._sourceIndexVersion = index !== null ? index.version : 0;
			wf.boundingSphere = geometry.boundingSphere;
			this._wireframeGeometries.set(geometry, wf);
		}
		return wf;
	}

	/** Shared setup for a draw: program, material state, textures, block binding. Returns the program. */
	_setupMaterial(item, program, material, camera, frontFaceCW, side) {
		const gl = this._gl, state = this.state;
		const programChanged = state.useProgram(program.program);
		const materialChanged = this._currentMaterial !== material || programChanged || this._currentSide !== side;
		if (materialChanged) {
			this._currentMaterial = material;
			this._currentSide = side;
			state.setMaterial(material, frontFaceCW, side);
			if (program.hasMaterialBlock) {
				const props = this._materialProps(material);
				const offset = this._syncMaterialBlock(material, props);
				state.bindUniformBufferRange(BLOCK_MATERIAL, this._materialBuffer, offset, MATERIAL_BLOCK_SIZE);
			}
			if (material.isShaderMaterial) {
				this._uploadShaderMaterialUniforms(program, material, camera, programChanged);
			} else {
				this._bindMaterialTextures(material);
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
		const program = item.program;
		if (object.onBeforeRender !== defaultOnBeforeRender) object.onBeforeRender(this, scene, camera, geometry, material, group);
		const gl = this._gl;
		const frontFaceCW = object.isMesh && object.matrixWorld.determinant() < 0;
		this._setupMaterial(item, program, material, camera, frontFaceCW, shadowPass ? shadowSideOf(material) : material.side);
		if (material.wireframe === true && object.isMesh) geometry = this._wireframeGeometry(geometry);
		// per-object uniforms
		const s = object._slabData, o = object._slabOffset;
		if (program.modelMatrixLocation !== null) gl.uniformMatrix4fv(program.modelMatrixLocation, false, s, o + 16, 16);
		if (material.isShaderMaterial) {
			this._uploadObjectUniformsForShaderMaterial(program, object, camera);
		} else if (program.normalMatrixLocation !== null) {
			if (object._normalVersion !== object._worldVersion) { computeNormalMatrix(s, o); object._normalVersion = object._worldVersion; }
			gl.uniformMatrix3fv(program.normalMatrixLocation, false, s, o + 32, 9);
		}
		if (program.spriteCenterLocation !== null) gl.uniform2f(program.spriteCenterLocation, object.center.x, object.center.y);
		// geometry
		const mode = object.isInstancedMesh ? 1 : 0;
		const record = this.bindingStates.bind(geometry, mode, object, null, program);
		let instanceCount = 1, instanced = false;
		if (object.isInstancedMesh) { instanceCount = Math.min(object.count, object.instanceMatrix.count); instanced = true; }
		else if (geometry.isInstancedBufferGeometry) { instanceCount = Math.min(geometry.instanceCount, record.maxInstancedCount); instanced = true; }
		this._draw(record, geometry, group, this._drawMode(object, material), instanceCount, instanced);
		if (object.onAfterRender !== defaultOnAfterRender) object.onAfterRender(this, scene, camera, geometry, material, group);
	}

	_renderBatch(item, instanceOffset, instanceCount, scene, camera, shadowPass) {
		const object = item.object, material = item.material;
		let geometry = item.geometry;
		const gl = this._gl;
		const variant = this._variantFor(object, geometry, material, shadowPass) | V_INSTANCING;
		const program = this._getProgram(material, object, scene, variant);
		this._setupMaterial(item, program, material, camera, false, shadowPass ? shadowSideOf(material) : material.side);
		if (material.wireframe === true) geometry = this._wireframeGeometry(geometry);
		if (program.modelMatrixLocation !== null) gl.uniformMatrix4fv(program.modelMatrixLocation, false, IDENTITY);
		const record = this.bindingStates.bind(geometry, 2, null, this.batcher.buffer, program);
		this.bindingStates.setBatchOffset(this.batcher.buffer, instanceOffset * 64);
		this._draw(record, geometry, null, this._drawMode(object, material), instanceCount, true);
		this.info.render.batches++;
		this.info.render.instances += instanceCount;
	}

	_draw(record, geometry, group, mode, instanceCount, instanced) {
		const gl = this._gl;
		const index = geometry.index;
		const drawRange = geometry.drawRange;
		let drawStart, drawCount;
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
		for (const name in uniforms) this._uploadUniform(program, name, uniforms[name].value);
		// every sampler the program declares but this material left null gets an empty texture
		// of the right target on its own unit (mixed sampler types on one unit is INVALID_OPERATION)
		const samplers = program.samplerUniforms;
		for (let i = 0; i < samplers.length; i++) {
			const u = samplers[i];
			if (u.boundStamp !== this._samplerStamp) for (let k = 0; k < u.size; k++) this.textures.bindEmpty(u, u.unit + k);
		}
		const pu = program.uniforms;
		if (pu.projectionMatrix) gl.uniformMatrix4fv(pu.projectionMatrix.location, false, camera.projectionMatrix.elements);
		if (pu.viewMatrix) gl.uniformMatrix4fv(pu.viewMatrix.location, false, camera.matrixWorldInverse.elements);
		if (pu.cameraPosition) { const e = camera.matrixWorld.elements; gl.uniform3f(pu.cameraPosition.location, e[12], e[13], e[14]); }
		if (pu.isOrthographic) gl.uniform1i(pu.isOrthographic.location, camera.isOrthographicCamera ? 1 : 0);
		if (pu.toneMappingExposure && uniforms.toneMappingExposure === undefined) gl.uniform1f(pu.toneMappingExposure.location, this.toneMappingExposure);
		const fog = this._currentScene ? this._currentScene.fog : null;
		if (fog && material.fog === true) {
			if (pu.fogColor) gl.uniform3f(pu.fogColor.location, fog.color.r, fog.color.g, fog.color.b);
			if (fog.isFog) { if (pu.fogNear) gl.uniform1f(pu.fogNear.location, fog.near); if (pu.fogFar) gl.uniform1f(pu.fogFar.location, fog.far); }
			else if (pu.fogDensity) gl.uniform1f(pu.fogDensity.location, fog.density);
		}
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
		const gl = this._gl, pu = program.uniforms;
		if (pu.modelViewMatrix) {
			object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
			gl.uniformMatrix4fv(pu.modelViewMatrix.location, false, object.modelViewMatrix.elements);
		}
		if (pu.normalMatrix) {
			object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
			gl.uniformMatrix3fv(pu.normalMatrix.location, false, object.normalMatrix.elements);
		}
	}
}

function shadowSideOf(material) {
	if (material.shadowSide !== null && material.shadowSide !== undefined) return material.shadowSide;
	return material.side === FrontSide ? BackSide : (material.side === BackSide ? FrontSide : DoubleSide);
}

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

/** Inverse-transpose of the upper 3x3 of the world matrix at slab[o+16..32) -> slab[o+32..41). */
function computeNormalMatrix(s, o) {
	const e = o + 16;
	const n11 = s[e], n21 = s[e + 1], n31 = s[e + 2], n12 = s[e + 4], n22 = s[e + 5], n32 = s[e + 6], n13 = s[e + 8], n23 = s[e + 9], n33 = s[e + 10];
	const t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13;
	const det = n11 * t11 + n21 * t12 + n31 * t13;
	const m = o + 32;
	if (det === 0) { for (let i = 0; i < 9; i++) s[m + i] = 0; return; }
	const detInv = 1 / det;
	// inverse (column-major) then transpose => write transposed directly
	const i0 = t11 * detInv, i1 = (n31 * n23 - n33 * n21) * detInv, i2 = (n32 * n21 - n31 * n22) * detInv;
	const i3 = t12 * detInv, i4 = (n33 * n11 - n31 * n13) * detInv, i5 = (n31 * n12 - n32 * n11) * detInv;
	const i6 = t13 * detInv, i7 = (n21 * n13 - n23 * n11) * detInv, i8 = (n22 * n11 - n21 * n12) * detInv;
	s[m] = i0; s[m + 1] = i3; s[m + 2] = i6;
	s[m + 3] = i1; s[m + 4] = i4; s[m + 5] = i7;
	s[m + 6] = i2; s[m + 7] = i5; s[m + 8] = i8;
}

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
	if (u.type === gl.SAMPLER_3D) renderer.textures.setTexture3D(value, unit);
	else if (u.type === gl.SAMPLER_2D_ARRAY) renderer.textures.setTexture2DArray(value, unit);
	else if (u.type === gl.SAMPLER_CUBE || u.type === gl.SAMPLER_CUBE_SHADOW) renderer.textures.setTextureCube(value, unit);
	else renderer.textures.setTexture2D(value, unit);
}
function setUniformValue(gl, renderer, u, value) {
	const loc = u.location;
	if (value === null || value === undefined) return;
	switch (u.type) {
		case gl.FLOAT: if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) gl.uniform1fv(loc, value); else gl.uniform1f(loc, value); break;
		case gl.INT: case gl.BOOL: if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) gl.uniform1iv(loc, value); else gl.uniform1i(loc, value ? (typeof value === 'boolean' ? 1 : value) : 0); break;
		case gl.UNSIGNED_INT: if (u.size > 1) gl.uniform1uiv(loc, value); else gl.uniform1ui(loc, value); break;
		case gl.FLOAT_VEC2: if (value.isVector2) gl.uniform2f(loc, value.x, value.y); else gl.uniform2fv(loc, flattenArray(value, 2)); break;
		case gl.FLOAT_VEC3:
			if (value.isVector3) gl.uniform3f(loc, value.x, value.y, value.z);
			else if (value.isColor) gl.uniform3f(loc, value.r, value.g, value.b);
			else gl.uniform3fv(loc, flattenArray(value, 3));
			break;
		case gl.FLOAT_VEC4:
			if (value.isVector4 || value.isQuaternion) gl.uniform4f(loc, value.x, value.y, value.z, value.w); else gl.uniform4fv(loc, flattenArray(value, 4));
			break;
		case gl.INT_VEC2: case gl.BOOL_VEC2: if (value.isVector2) gl.uniform2i(loc, value.x, value.y); else gl.uniform2iv(loc, value); break;
		case gl.INT_VEC3: case gl.BOOL_VEC3: if (value.isVector3) gl.uniform3i(loc, value.x, value.y, value.z); else gl.uniform3iv(loc, value); break;
		case gl.INT_VEC4: case gl.BOOL_VEC4: if (value.isVector4) gl.uniform4i(loc, value.x, value.y, value.z, value.w); else gl.uniform4iv(loc, value); break;
		case gl.FLOAT_MAT2: gl.uniformMatrix2fv(loc, false, value.elements || flattenArray(value, 4)); break;
		case gl.FLOAT_MAT3: gl.uniformMatrix3fv(loc, false, value.elements || flattenArray(value, 9)); break;
		case gl.FLOAT_MAT4: gl.uniformMatrix4fv(loc, false, value.elements || flattenArray(value, 16)); break;
		case gl.SAMPLER_2D: case gl.SAMPLER_2D_SHADOW: case gl.SAMPLER_3D: case gl.SAMPLER_2D_ARRAY: case gl.SAMPLER_CUBE: case gl.SAMPLER_CUBE_SHADOW:
		case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D: case gl.INT_SAMPLER_3D: case gl.UNSIGNED_INT_SAMPLER_3D: case gl.INT_SAMPLER_2D_ARRAY: case gl.UNSIGNED_INT_SAMPLER_2D_ARRAY:
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
			break;
		default: break;
	}
}

function createCanvasElement() {
	const canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
	canvas.style.display = 'block';
	return canvas;
}

export { WebGLRenderer };
