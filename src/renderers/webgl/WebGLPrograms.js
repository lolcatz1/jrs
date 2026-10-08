import {
	MATERIAL_BASIC, MATERIAL_LAMBERT, MATERIAL_PHONG, MATERIAL_STANDARD, MATERIAL_NORMAL, MATERIAL_DEPTH, MATERIAL_LINE, MATERIAL_POINTS,
	MATERIAL_SPRITE, MATERIAL_SHADER, MATERIAL_SHADOW_DEPTH, TEXTURE_UNITS, pointShadowUnit, buildBuiltinShader, buildCustomShader
} from '../shaders/ShaderLib.js';
import { DoubleSide, BackSide, NoToneMapping, SRGBColorSpace, BasicShadowMap, CubeUVReflectionMapping, CubeRefractionMapping, NormalBlending } from '../../constants.js';
import { OBJ_ELIGIBLE, OBJ_USES_MODEL } from '../shaders/ShaderMaterialBatching.js';

export const BLOCK_FRAME = 0;
export const BLOCK_LIGHTS = 1;
export const BLOCK_MATERIAL = 2;

let _programId = 0;
const FIXED_ATTRIBUTES = { position: 0, normal: 1, uv: 2, color: 3, uv1: 4, instanceColor: 5, skinIndex: 6, skinWeight: 7, instanceMatrix: 8 };

/**
 * Custom (ShaderMaterial) attribute names get one location per name, shared by every program and every
 * renderer, so geometries holding them can live in a mega-buffer page whose VAO fits all those programs.
 * Locations start at 9, just above instanceMatrix (a mat4, 8-11): a program that declares instanceMatrix
 * cannot use 9-11 and keeps linker-chosen locations for the colliding names (see WebGLProgram.customFixed).
 */
const CUSTOM_ATTRIBUTE_BASE = 9;
const customAttributeIndex = new Map();
/** Fixed location for a custom attribute name, or -1 when it has none (not seen in any program yet). */
export function customAttributeLocation(name) {
	const i = customAttributeIndex.get(name);
	return i === undefined ? -1 : CUSTOM_ATTRIBUTE_BASE + i;
}
/** Number of custom attribute names registered so far (grows when a program with a new name is linked). */
export function customAttributeCount() { return customAttributeIndex.size; }
const ATTRIBUTE_DECLARATION = /(?<=^|[;}\n])\s*(?:attribute|in)\s+(?:(?:highp|mediump|lowp)\s+)?(\w+)\s+([^;(){}]+);/g; // a declaration starts a line or follows ';' / '}' (function parameters follow '(' or ',')
function bindCustomAttributeLocations(gl, program, vertexSource, maxAttributes) {
	if (/layout\s*\(\s*location/.test(vertexSource)) return; // explicit locations: leave everything to the shader
	const usesInstanceMatrix = /^[ \t]*#define[ \t]+USE_INSTANCING\b/m.test(vertexSource); // the prefix declares instanceMatrix only under this define
	const hasTangent = /^[ \t]*#define[ \t]+USE_TANGENT\b/m.test(vertexSource);
	ATTRIBUTE_DECLARATION.lastIndex = 0;
	let m;
	while ((m = ATTRIBUTE_DECLARATION.exec(vertexSource)) !== null) {
		if (m[1].startsWith('mat')) continue; // multi-location attributes stay with the linker
		const names = m[2].split(',');
		for (let k = 0; k < names.length; k++) {
			if (names[k].indexOf('[') !== -1) continue;
			const name = names[k].trim();
			if (name === '' || FIXED_ATTRIBUTES[name] !== undefined || (name === 'tangent' && !hasTangent)) continue; // the prefix declares tangent (and the other optional attributes) under defines
			let i = customAttributeIndex.get(name);
			if (i === undefined) { i = customAttributeIndex.size; customAttributeIndex.set(name, i); }
			const location = CUSTOM_ATTRIBUTE_BASE + i;
			if (location >= maxAttributes || (usesInstanceMatrix && location < 12)) continue;
			gl.bindAttribLocation(program, location, name);
		}
	}
}

/**
 * A compiled program plus everything the renderer needs to drive it without
 * string lookups at draw time: uniform locations, attribute locations and
 * uniform block bindings resolved once at link time.
 */
class WebGLProgram {
	constructor(gl, parameters, vertexSource, fragmentSource) {
		this.id = _programId++;
		this.parameters = parameters;
		this.usedTimes = 1;
		const program = gl.createProgram();
		const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
		const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		// fixed attribute locations keep VAOs shareable between programs
		gl.bindAttribLocation(program, 0, 'position');
		gl.bindAttribLocation(program, 1, 'normal');
		gl.bindAttribLocation(program, 2, 'uv');
		gl.bindAttribLocation(program, 3, 'color');
		gl.bindAttribLocation(program, 4, 'uv1');
		gl.bindAttribLocation(program, 5, 'instanceColor');
		gl.bindAttribLocation(program, 6, 'skinIndex');
		gl.bindAttribLocation(program, 7, 'skinWeight');
		gl.bindAttribLocation(program, 8, 'instanceMatrix');
		if (parameters.materialType === MATERIAL_SHADER) bindCustomAttributeLocations(gl, program, vertexSource, gl.getParameter(gl.MAX_VERTEX_ATTRIBS)); // built-in shaders have no custom attributes
		gl.linkProgram(program);
		if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
			const log = gl.getProgramInfoLog(program);
			const vlog = gl.getShaderInfoLog(vs), flog = gl.getShaderInfoLog(fs);
			console.error('WebGLProgram: link failed\n' + log + '\nVERTEX:\n' + vlog + '\n' + addLineNumbers(vertexSource) + '\nFRAGMENT:\n' + flog + '\n' + addLineNumbers(fragmentSource));
		}
		gl.deleteShader(vs);
		gl.deleteShader(fs);
		this.program = program;

		// uniforms
		this.uniforms = {};
		const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
		for (let i = 0; i < n; i++) {
			const info = gl.getActiveUniform(program, i);
			let name = info.name;
			if (name.endsWith('[0]')) name = name.slice(0, -3);
			const location = gl.getUniformLocation(program, info.name);
			if (location === null) continue; // uniform block member
			this.uniforms[name] = { name, location, type: info.type, size: info.size, cache: undefined };
		}
		this.modelMatrixLocation = this.uniforms.modelMatrix ? this.uniforms.modelMatrix.location : null;
		this.normalMatrixLocation = this.uniforms.normalMatrix ? this.uniforms.normalMatrix.location : null;
		this.modelViewMatrixLocation = this.uniforms.modelViewMatrix ? this.uniforms.modelViewMatrix.location : null;
		this.modelMatrixUniform = this.uniforms.modelMatrix || null;
		this.normalMatrixUniform = this.uniforms.normalMatrix || null;
		this.modelViewMatrixUniform = this.uniforms.modelViewMatrix || null;
		this._frameStamp = -1; this._frameRid = 0;
		this.spriteCenterLocation = this.uniforms.uSpriteCenter ? this.uniforms.uSpriteCenter.location : null;
		this.drawBaseUniform = this.uniforms.drawBase || null;
		// skinning / morph target uniforms (built-in and custom programs alike)
		this.bindMatrixUniform = this.uniforms.bindMatrix || null;
		this.bindMatrixInverseUniform = this.uniforms.bindMatrixInverse || null;
		this.boneTextureUniform = this.uniforms.boneTexture || null;
		this.morphBaseInfluenceUniform = this.uniforms.morphTargetBaseInfluence || null;
		this.morphInfluencesUniform = this.uniforms.morphTargetInfluences || null;
		this.morphTextureUniform = this.uniforms.morphTargetsTexture || null;
		this.morphTextureSizeUniform = this.uniforms.morphTargetsTextureSize || null;

		// uniform blocks
		const bind = (name, index) => {
			const bi = gl.getUniformBlockIndex(program, name);
			if (bi !== gl.INVALID_INDEX && bi !== 0xffffffff) { gl.uniformBlockBinding(program, bi, index); return true; }
			return false;
		};
		this.hasFrameBlock = bind('Frame', BLOCK_FRAME);
		this.hasLightsBlock = bind('Lights', BLOCK_LIGHTS);
		this.hasMaterialBlock = bind('Material', BLOCK_MATERIAL) || bind('Materials', BLOCK_MATERIAL);
		/** true when the program reads its material from a window of the material buffer indexed per instance (see ShaderLib MATERIAL_BLOCK). */
		this.materialArray = parameters.materialArray === true;

		// attributes; names outside the fixed table (custom ShaderMaterial attributes) get linker-assigned locations
		this.attributes = {};
		this.customAttributes = [];
		const na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
		for (let i = 0; i < na; i++) {
			const info = gl.getActiveAttrib(program, i);
			const location = gl.getAttribLocation(program, info.name);
			const record = { name: info.name, location, type: info.type, size: info.size, locationSize: info.type === gl.FLOAT_MAT4 ? 4 : (info.type === gl.FLOAT_MAT3 ? 3 : (info.type === gl.FLOAT_MAT2 ? 2 : 1)) };
			this.attributes[info.name] = record;
			if (FIXED_ATTRIBUTES[info.name] === undefined && location >= 0) this.customAttributes.push(record);
		}
		this.hasCustomAttributes = this.customAttributes.length > 0;
		/** every custom attribute sits at its per-name fixed location (so a mega-buffer page VAO can feed this program) */
		this.customFixed = true;
		for (let i = 0; i < this.customAttributes.length; i++) {
			const r = this.customAttributes[i];
			if (r.locationSize !== 1 || customAttributeLocation(r.name) !== r.location) { this.customFixed = false; break; }
		}

		// Texture units are assigned once per program at link time and never change:
		// built-in programs use the fixed table, custom (ShaderMaterial) programs number their
		// samplers sequentially. Every active sampler gets its own unit(s) whether or not a
		// texture is ever assigned to it, so a program is always valid to draw with.
		const isCustom = parameters.materialType === MATERIAL_SHADER;
		const reserveMatrixUnit = isCustom && this.uniforms.objectMatrices !== undefined; // batched variant: unit 15 belongs to the matrix texture
		this.samplerUniforms = [];
		let nextUnit = 0;
		gl.useProgram(program); // leaves this program current in GL: the renderer syncs its state cache (justLinked)
		this.justLinked = true;
		for (const name in this.uniforms) {
			const u = this.uniforms[name];
			const target = samplerTarget(gl, u.type);
			if (target === 0) continue;
			u.target = target;
			u.isShadowSampler = u.type === gl.SAMPLER_2D_SHADOW || u.type === gl.SAMPLER_CUBE_SHADOW || u.type === gl.SAMPLER_2D_ARRAY_SHADOW;
			u.boundStamp = -1;
			let unit;
			if (!isCustom && name === 'pointShadowMap') {
				// point shadow cube maps take the units left free by the directional and spot shadow maps
				const units = new Int32Array(u.size);
				for (let k = 0; k < u.size; k++) units[k] = pointShadowUnit(k, parameters.numDirShadows | 0, parameters.numSpotShadows | 0);
				u.unit = units[0]; u.units = units;
				gl.uniform1iv(u.location, units);
				this.samplerUniforms.push(u);
				continue;
			}
			if (!isCustom && (TEXTURE_UNITS[name] !== undefined || TEXTURE_UNITS[name + '0'] !== undefined)) {
				// a sampler array of size 1 (one shadow-casting light) is still an array: it takes the '<name>0' slot
				unit = TEXTURE_UNITS[name] !== undefined ? TEXTURE_UNITS[name] : TEXTURE_UNITS[name + '0'];
			} else if (isCustom && name === 'objectMatrices') {
				// batched variant of a custom program: the matrix texture keeps its fixed unit (bound by the renderer, never by the material)
				unit = TEXTURE_UNITS.objectMatrices;
				u.unit = unit;
				gl.uniform1i(u.location, unit);
				continue;
			} else {
				if (reserveMatrixUnit && nextUnit <= TEXTURE_UNITS.objectMatrices && nextUnit + u.size > TEXTURE_UNITS.objectMatrices) nextUnit = TEXTURE_UNITS.objectMatrices + 1;
				unit = nextUnit; nextUnit += u.size;
			}
			u.unit = unit;
			if (u.size > 1) {
				const units = new Int32Array(u.size);
				for (let k = 0; k < u.size; k++) units[k] = unit + k;
				gl.uniform1iv(u.location, units);
			} else {
				gl.uniform1i(u.location, unit);
			}
			this.samplerUniforms.push(u);
		}
		/**
		 * Automatic instancing (ShaderMaterialBatching.js): 0 when this program's object uniforms cannot be fed
		 * from the matrix texture, else the usage mask (which of modelMatrix / modelViewMatrix / normalMatrix
		 * the vertex shader reads) with OBJ_ELIGIBLE set. Built-in programs always qualify.
		 */
		this.objTexMode = OBJ_ELIGIBLE | OBJ_USES_MODEL;
		this.materialVersion = -1; // last material version whose non-block uniforms were set (ShaderMaterial)
		this.materialId = -1;
	}
	destroy(gl) { gl.deleteProgram(this.program); }
}

function customProgramKey(material, parameters) {
	const defines = material.defines;
	let d = '';
	if (defines) { const names = Object.keys(defines).sort(); for (let i = 0; i < names.length; i++) d += names[i] + '=' + defines[names[i]] + ';'; }
	return 'S' + parameters.key + '|' + material.type + '|' + (material.name || '') + '|' + (material.precision || '') + '|' + (material.glslVersion || '') + '|' +
		(material.customProgramCacheKey ? material.customProgramCacheKey() : '') + '|' + d + '|' + material.vertexShader + '|' + material.fragmentShader;
}

function samplerTarget(gl, type) {
	switch (type) {
		case gl.SAMPLER_2D: case gl.SAMPLER_2D_SHADOW: case gl.INT_SAMPLER_2D: case gl.UNSIGNED_INT_SAMPLER_2D: return gl.TEXTURE_2D;
		case gl.SAMPLER_3D: case gl.INT_SAMPLER_3D: case gl.UNSIGNED_INT_SAMPLER_3D: return gl.TEXTURE_3D;
		case gl.SAMPLER_2D_ARRAY: case gl.SAMPLER_2D_ARRAY_SHADOW: case gl.INT_SAMPLER_2D_ARRAY: case gl.UNSIGNED_INT_SAMPLER_2D_ARRAY: return gl.TEXTURE_2D_ARRAY;
		case gl.SAMPLER_CUBE: case gl.SAMPLER_CUBE_SHADOW: case gl.INT_SAMPLER_CUBE: case gl.UNSIGNED_INT_SAMPLER_CUBE: return gl.TEXTURE_CUBE_MAP;
		default: return 0;
	}
}

function compileShader(gl, type, source) {
	const shader = gl.createShader(type);
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}
function addLineNumbers(string) {
	const lines = string.split('\n');
	for (let i = 0; i < lines.length; i++) lines[i] = (i + 1) + ': ' + lines[i];
	return lines.join('\n');
}

function materialTypeOf(material) {
	if (material.isMeshStandardMaterial) return MATERIAL_STANDARD;
	if (material.isMeshPhongMaterial) return MATERIAL_PHONG;
	if (material.isMeshLambertMaterial) return MATERIAL_LAMBERT;
	if (material.isMeshBasicMaterial) return MATERIAL_BASIC;
	if (material.isMeshNormalMaterial) return MATERIAL_NORMAL;
	if (material.isMeshDepthMaterial) return MATERIAL_DEPTH;
	if (material.isLineBasicMaterial) return MATERIAL_LINE;
	if (material.isPointsMaterial) return MATERIAL_POINTS;
	if (material.isSpriteMaterial) return MATERIAL_SPRITE;
	if (material.isShaderMaterial) return MATERIAL_SHADER;
	return MATERIAL_BASIC;
}

/**
 * Program cache keyed by an integer feature mask. Resolving a program for a
 * (material, object, scene) triple is a handful of bit ops and one Map get.
 */
class WebGLPrograms {
	constructor(gl, renderer) {
		this.gl = gl;
		this.renderer = renderer;
		this.cache = new Map();
		this._baseKeyIds = new Map();
		this.programs = [];
	}

	/** Compute the integer key + parameters for a built-in material. */
	/** `envMap` is the texture the material will actually sample (resolved by the renderer from material.envMap / scene.environment), or null. */
	getParameters(material, object, scene, lights, variant, envMap = null) {
		const renderer = this.renderer;
		const materialType = variant.shadowPass ? MATERIAL_SHADOW_DEPTH : materialTypeOf(material);
		const geometry = object.geometry;
		const attributes = geometry.attributes;
		const isLit = materialType === MATERIAL_LAMBERT || materialType === MATERIAL_PHONG || materialType === MATERIAL_STANDARD;
		const hasUv = attributes.uv !== undefined;
		const hasUv1 = attributes.uv1 !== undefined;
		// three.js draws shadow casters with a MeshDepthMaterial that takes only map, alphaMap and alphaTest (0.5 for
		// alphaToCoverage) from the caster: no vertex colours, no opacity. Without a map there is nothing to test, so
		// every such caster shares one lean depth-only program (no uvs, colours or textures in its key).
		const shadowPass = variant.shadowPass === true;
		const shadowAlpha = shadowPass && (!!material.map || !!material.alphaMap) && (material.alphaTest > 0 || material.alphaToCoverage === true);
		const leanShadow = shadowPass && !shadowAlpha;
		// three's depth and normal shaders have no vertex-colour chunk
		const vertexColors = !shadowPass && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL && material.vertexColors === true && attributes.color !== undefined;
		const fog = scene.fog != null && material.fog === true && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH;
		const map = !leanShadow && !!material.map;
		const alphaMap = !leanShadow && !!material.alphaMap;
		const emissiveMap = isLit && !!material.emissiveMap;
		const normalMap = isLit && !!material.normalMap;
		const roughnessMap = materialType === MATERIAL_STANDARD && !!material.roughnessMap;
		const metalnessMap = materialType === MATERIAL_STANDARD && !!material.metalnessMap;
		const aoMap = (isLit || materialType === MATERIAL_BASIC) && !!material.aoMap;
		if (variant.shadowPass || !(isLit || materialType === MATERIAL_BASIC || materialType === MATERIAL_SHADER)) envMap = null;
		if (materialType === MATERIAL_STANDARD && envMap !== null && envMap.mapping !== CubeUVReflectionMapping) envMap = null; // Standard samples the PMREM layout only
		const hasEnvMap = envMap !== null;
		const envMapCubeUV = hasEnvMap && envMap.mapping === CubeUVReflectionMapping;
		// specularMap modulates Phong's specular term and the env-map reflection of Basic / Lambert
		const specularMap = (materialType === MATERIAL_PHONG || (hasEnvMap && (materialType === MATERIAL_BASIC || materialType === MATERIAL_LAMBERT))) && !!material.specularMap;
		const useUv = hasUv && (map || alphaMap || emissiveMap || normalMap || roughnessMap || metalnessMap || aoMap || specularMap) && materialType !== MATERIAL_POINTS;
		const useUv1 = hasUv1 && aoMap;
		const receiveShadow = variant.receiveShadow && isLit && renderer.shadowMap.enabled;
		const numDirShadows = receiveShadow ? lights.numDirShadows : 0;
		const numSpotShadows = receiveShadow ? lights.numSpotShadows : 0;
		const numPointShadows = receiveShadow ? lights.numPointShadows : 0;
		const pointShadowBasic = numPointShadows > 0 && renderer.shadowMap.type === BasicShadowMap;
		const currentRenderTarget = renderer.getRenderTarget();
		// three.js: tone mapping and the output colour space encoding only apply when rendering to the canvas; a render target
		// is written in the working (linear) space (an sRGB render target encodes in hardware)
		const toneMapping = (material.toneMapped && currentRenderTarget === null && renderer.toneMapping !== NoToneMapping && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL) ? renderer.toneMapping : NoToneMapping;
		const sRGBOutput = currentRenderTarget === null && renderer.outputColorSpace === SRGBColorSpace && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL;
		// skinning and morph targets are object / geometry features (same rule as three.js: the program follows the object)
		const skinning = object.isSkinnedMesh === true;
		const morphAttributes = geometry.morphAttributes;
		const morphAttribute = morphAttributes.position || morphAttributes.normal || morphAttributes.color;
		const morphTargetsCount = morphAttribute !== undefined ? Math.min(morphAttribute.length, 255) : 0;
		let morphTextureStride = 0;
		if (morphAttributes.position !== undefined) morphTextureStride = 1;
		if (morphAttributes.normal !== undefined) morphTextureStride = 2;
		if (morphAttributes.color !== undefined) morphTextureStride = 3;

		const p = {
			materialType,
			map, alphaMap, emissiveMap, normalMap, roughnessMap, metalnessMap, aoMap, specularMap,
			useUv, useUv1,
			vertexColors,
			vertexAlphas: vertexColors && attributes.color.itemSize === 4,
			instancing: variant.instancing,
			instancingColor: variant.instancing && variant.instancingColor,
			objectTexture: variant.objectTexture === true || variant.multiDraw === true,
			multiDraw: variant.multiDraw === true,
			materialArray: variant.materialArray === true && (variant.objectTexture === true || variant.multiDraw === true),
			materialArraySize: renderer._materialWindow, materialPad: renderer._materialPad,
			flatShading: isLit && material.flatShading === true,
			doubleSided: !leanShadow && variant.side === DoubleSide,
			flipSided: !leanShadow && variant.side === BackSide,
			leanShadow,
			envMap: hasEnvMap,
			envMapCubeUV,
			envMapRefraction: hasEnvMap && envMap.mapping === CubeRefractionMapping,
			envMapCubeUVHeight: envMapCubeUV ? envMap.image.height : 0,
			combine: hasEnvMap && material.combine !== undefined ? material.combine : 0,
			envWorldPos: hasEnvMap && (materialType === MATERIAL_LAMBERT || materialType === MATERIAL_PHONG || normalMap),
			fog, fogExp2: fog && scene.fog.isFogExp2 === true,
			alphaTest: shadowPass ? shadowAlpha : (material.alphaTest > 0 && materialType !== MATERIAL_NORMAL), // three's normal shader has no alphatest chunk
			alphaTestHalf: shadowAlpha && material.alphaToCoverage === true, // three approximates alphaToCoverage casters with alphaTest 0.5
			sizeAttenuation: (materialType === MATERIAL_POINTS || materialType === MATERIAL_SPRITE) && material.sizeAttenuation === true,
			premultipliedAlpha: material.premultipliedAlpha === true,
			// three.js (opaque_fragment): an opaque material writes alpha 1 whatever its map / vertex alpha says, so a
			// later DST_ALPHA blend sees 1; depth materials write `opacity` instead and never take the define
			opaque: material.transparent === false && material.blending === NormalBlending && material.alphaToCoverage === false && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_SHADOW_DEPTH,
			dithering: material.dithering === true,
			depthPacking: materialType === MATERIAL_DEPTH && material.depthPacking !== undefined ? material.depthPacking : 3200,
			vertexUv1s: hasUv1,
			toneMapped: toneMapping !== NoToneMapping,
			toneMapping,
			sRGBOutput,
			numDirShadows, numSpotShadows, numPointShadows, pointShadowBasic,
			skinning,
			morphTargets: morphAttributes.position !== undefined,
			morphNormals: morphAttributes.normal !== undefined,
			morphColors: morphAttributes.color !== undefined,
			morphTargetsCount, morphTextureStride,
		};
		let key = materialType;
		key = key * 2 + (map ? 1 : 0); key = key * 2 + (alphaMap ? 1 : 0); key = key * 2 + (emissiveMap ? 1 : 0); key = key * 2 + (normalMap ? 1 : 0);
		key = key * 2 + (roughnessMap ? 1 : 0); key = key * 2 + (metalnessMap ? 1 : 0); key = key * 2 + (aoMap ? 1 : 0); key = key * 2 + (specularMap ? 1 : 0);
		key = key * 2 + (useUv ? 1 : 0); key = key * 2 + (useUv1 ? 1 : 0); key = key * 2 + (vertexColors ? 1 : 0); key = key * 2 + (p.vertexAlphas ? 1 : 0);
		key = key * 2 + (p.instancing ? 1 : 0); key = key * 2 + (p.instancingColor ? 1 : 0); key = key * 2 + (p.flatShading ? 1 : 0); key = key * 2 + (p.doubleSided ? 1 : 0); key = key * 2 + (p.flipSided ? 1 : 0);
		key = key * 2 + (fog ? 1 : 0); key = key * 2 + (p.alphaTest ? 1 : 0); key = key * 2 + (p.sizeAttenuation ? 1 : 0); key = key * 2 + (p.premultipliedAlpha ? 1 : 0);
		key = key * 2 + (p.dithering ? 1 : 0); key = key * 2 + (hasUv1 ? 1 : 0); key = key * 8 + toneMapping; key = key * 2 + (sRGBOutput ? 1 : 0);
		key = key * 8 + numDirShadows; key = key * 8 + numSpotShadows; key = key * 2 + (p.multiDraw ? 1 : 0); key = key * 2 + (p.objectTexture ? 1 : 0); key = key * 2 + (leanShadow ? 1 : 0);
		// With every feature the product of the fields above exceeds 2^53 (precision loss would merge programs that differ
		// only in their low bits), so the base part is interned to a small id and the remaining fields are packed under it.
		let baseId = this._baseKeyIds.get(key);
		if (baseId === undefined) { baseId = this._baseKeyIds.size; this._baseKeyIds.set(key, baseId); }
		key = baseId;
		key = key * 8 + numPointShadows; key = key * 2 + (pointShadowBasic ? 1 : 0);
		key = key * 2 + (p.materialArray ? 1 : 0); key = key * 2 + (p.alphaTestHalf ? 1 : 0);
		key = key * 2 + (skinning ? 1 : 0); key = key * 2 + (p.morphTargets ? 1 : 0); key = key * 2 + (p.morphNormals ? 1 : 0); key = key * 2 + (p.morphColors ? 1 : 0);
		key = key * 4 + morphTextureStride; key = key * 256 + morphTargetsCount;
		key = key * 2 + (hasEnvMap ? 1 : 0); key = key * 2 + (envMapCubeUV ? 1 : 0); key = key * 2 + (p.envMapRefraction ? 1 : 0);
		key = key * 4 + (p.combine & 3); key = key * 16 + (envMapCubeUV ? (Math.log2(p.envMapCubeUVHeight) | 0) & 15 : 0);
		key = key * 2 + (p.opaque ? 1 : 0); key = key * 4 + (p.depthPacking - 3200);
		p.key = key;
		return p;
	}

	acquireProgram(parameters, material) {
		let key = parameters.key;
		if (parameters.materialType === MATERIAL_SHADER) {
			// Custom shader: like three.js, key on what actually produces the program (sources, defines,
			// type/name, precision, GLSL version, customProgramCacheKey, feature parameters) so material
			// instances that share a shader share one program and one uniform cache.
			key = customProgramKey(material, parameters);
		}
		let program = this.cache.get(key);
		if (program === undefined) {
			const src = parameters.materialType === MATERIAL_SHADER ? buildCustomShader(material, parameters) : buildBuiltinShader(parameters);
			program = new WebGLProgram(this.gl, parameters, src.vertexShader, src.fragmentShader);
			if (src.objTexMode !== undefined) program.objTexMode = src.objTexMode;
			// the constructor binds the new program to set sampler units; tell the state cache
			this.renderer.state.currentProgram = program.program;
			this.cache.set(key, program);
			this.programs.push(program);
			program.cacheKey = key;
		} else {
			program.usedTimes++;
		}
		return program;
	}

	releaseProgram(program) {
		if (--program.usedTimes === 0) {
			this.cache.delete(program.cacheKey);
			const i = this.programs.indexOf(program);
			if (i !== -1) this.programs.splice(i, 1);
			program.destroy(this.gl);
		}
	}

	dispose() {
		for (const p of this.programs) p.destroy(this.gl);
		this.programs.length = 0;
		this.cache.clear();
	}
}

export { WebGLPrograms, WebGLProgram, materialTypeOf };
