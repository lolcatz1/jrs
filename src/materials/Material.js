import { Color } from '../math/Color.js';
import { EventDispatcher } from '../core/EventDispatcher.js';
import {
	FrontSide, NormalBlending, LessEqualDepth, AddEquation, OneMinusSrcAlphaFactor, SrcAlphaFactor,
	AlwaysStencilFunc, KeepStencilOp
} from '../constants.js';
import * as MathUtils from '../math/MathUtils.js';

let _materialId = 0;

class Material extends EventDispatcher {
	constructor() {
		super();
		this.isMaterial = true;
		Object.defineProperty(this, 'id', { value: _materialId++ });
		this.uuid = MathUtils.generateUUID();
		this.name = '';
		this.type = 'Material';
		this.blending = NormalBlending;
		this.side = FrontSide;
		this.vertexColors = false;
		this.opacity = 1;
		this.transparent = false;
		this.alphaHash = false;
		this.blendSrc = SrcAlphaFactor;
		this.blendDst = OneMinusSrcAlphaFactor;
		this.blendEquation = AddEquation;
		this.blendSrcAlpha = null;
		this.blendDstAlpha = null;
		this.blendEquationAlpha = null;
		this.blendColor = new Color(0, 0, 0);
		this.blendAlpha = 0;
		this.depthFunc = LessEqualDepth;
		this.depthTest = true;
		this.depthWrite = true;
		this.stencilWriteMask = 0xff;
		this.stencilFunc = AlwaysStencilFunc;
		this.stencilRef = 0;
		this.stencilFuncMask = 0xff;
		this.stencilFail = KeepStencilOp;
		this.stencilZFail = KeepStencilOp;
		this.stencilZPass = KeepStencilOp;
		this.stencilWrite = false;
		this.clippingPlanes = null;
		this.clipIntersection = false;
		this.clipShadows = false;
		this.shadowSide = null;
		this.colorWrite = true;
		this.precision = null;
		this.polygonOffset = false;
		this.polygonOffsetFactor = 0;
		this.polygonOffsetUnits = 0;
		this.dithering = false;
		this.alphaToCoverage = false;
		this.premultipliedAlpha = false;
		this.forceSinglePass = false;
		this.allowOverride = true;
		this.visible = true;
		this.toneMapped = true;
		this.userData = {};
		this.version = 0;
		this._alphaTest = 0;
		/** Set when `needsUpdate` is assigned; the renderer clears it after re-resolving the program. */
		this._programDirty = true;
		this._frameStamp = -1; this._frameRid = 0; this._batchGroup = null; this._soloStamp = -1; this._soloRid = 0;
		// per-frame program resolution cache (renderer-owned; frame ids are unique across renderers)
		this._resolveStamp = -1; this._resolveVariant = -1; this._resolveProgram = null;
		this._shadowSigStamp = -1; this._shadowSig = 0;
	}
	get alphaTest() { return this._alphaTest; }
	set alphaTest(value) {
		if (this._alphaTest > 0 !== value > 0) this.version++;
		this._alphaTest = value;
	}
	onBeforeRender() {}
	onBeforeCompile() {}
	customProgramCacheKey() { return this.onBeforeCompile.toString(); }
	setValues(values) {
		if (values === undefined) return;
		for (const key in values) {
			const newValue = values[key];
			if (newValue === undefined) { console.warn(`Material: parameter '${key}' has value of undefined.`); continue; }
			const currentValue = this[key];
			if (currentValue === undefined) { console.warn(`Material: '${key}' is not a property of ${this.type}.`); continue; }
			if (currentValue && currentValue.isColor) currentValue.set(newValue);
			else if ((currentValue && currentValue.isVector3) && (newValue && newValue.isVector3)) currentValue.copy(newValue);
			else this[key] = newValue;
		}
	}
	toJSON() {
		const data = { metadata: { version: 4.6, type: 'Material', generator: 'jrs' } };
		data.uuid = this.uuid; data.type = this.type;
		if (this.name !== '') data.name = this.name;
		if (this.color && this.color.isColor) data.color = this.color.getHex();
		if (this.roughness !== undefined) data.roughness = this.roughness;
		if (this.metalness !== undefined) data.metalness = this.metalness;
		if (this.emissive && this.emissive.isColor) data.emissive = this.emissive.getHex();
		if (this.specular && this.specular.isColor) data.specular = this.specular.getHex();
		if (this.shininess !== undefined) data.shininess = this.shininess;
		if (this.opacity !== 1) data.opacity = this.opacity;
		if (this.transparent === true) data.transparent = true;
		if (this.side !== FrontSide) data.side = this.side;
		if (this.vertexColors === true) data.vertexColors = true;
		if (this.depthTest === false) data.depthTest = false;
		if (this.depthWrite === false) data.depthWrite = false;
		if (this.visible === false) data.visible = false;
		if (Object.keys(this.userData).length > 0) data.userData = this.userData;
		return data;
	}
	clone() { return new this.constructor().copy(this); }
	copy(source) {
		this.name = source.name;
		this.blending = source.blending; this.side = source.side; this.vertexColors = source.vertexColors;
		this.opacity = source.opacity; this.transparent = source.transparent;
		this.blendSrc = source.blendSrc; this.blendDst = source.blendDst; this.blendEquation = source.blendEquation;
		this.blendSrcAlpha = source.blendSrcAlpha; this.blendDstAlpha = source.blendDstAlpha; this.blendEquationAlpha = source.blendEquationAlpha;
		this.blendColor.copy(source.blendColor); this.blendAlpha = source.blendAlpha;
		this.depthFunc = source.depthFunc; this.depthTest = source.depthTest; this.depthWrite = source.depthWrite;
		this.stencilWriteMask = source.stencilWriteMask; this.stencilFunc = source.stencilFunc; this.stencilRef = source.stencilRef;
		this.stencilFuncMask = source.stencilFuncMask; this.stencilFail = source.stencilFail; this.stencilZFail = source.stencilZFail;
		this.stencilZPass = source.stencilZPass; this.stencilWrite = source.stencilWrite;
		const srcPlanes = source.clippingPlanes;
		let dstPlanes = null;
		if (srcPlanes !== null) { const n = srcPlanes.length; dstPlanes = new Array(n); for (let i = 0; i !== n; ++i) dstPlanes[i] = srcPlanes[i].clone(); }
		this.clippingPlanes = dstPlanes;
		this.clipIntersection = source.clipIntersection; this.clipShadows = source.clipShadows;
		this.shadowSide = source.shadowSide;
		this.colorWrite = source.colorWrite; this.precision = source.precision;
		this.polygonOffset = source.polygonOffset; this.polygonOffsetFactor = source.polygonOffsetFactor; this.polygonOffsetUnits = source.polygonOffsetUnits;
		this.dithering = source.dithering; this.alphaTest = source.alphaTest; this.alphaHash = source.alphaHash; this.alphaToCoverage = source.alphaToCoverage;
		this.premultipliedAlpha = source.premultipliedAlpha; this.forceSinglePass = source.forceSinglePass;
		this.visible = source.visible; this.toneMapped = source.toneMapped;
		this.userData = JSON.parse(JSON.stringify(source.userData));
		return this;
	}
	dispose() { this.dispatchEvent({ type: 'dispose' }); }
	set needsUpdate(value) { if (value === true) { this.version++; this._programDirty = true; } }
}

export { Material };
