import {
	MATERIAL_BASIC, MATERIAL_LAMBERT, MATERIAL_PHONG, MATERIAL_STANDARD, MATERIAL_NORMAL, MATERIAL_DEPTH, MATERIAL_LINE, MATERIAL_POINTS,
	MATERIAL_SPRITE, MATERIAL_SHADER, MATERIAL_SHADOW_DEPTH, TEXTURE_UNITS, buildBuiltinShader, buildCustomShader
} from '../shaders/ShaderLib.js';
import { DoubleSide, NoToneMapping, SRGBColorSpace } from '../../constants.js';

export const BLOCK_FRAME = 0;
export const BLOCK_LIGHTS = 1;
export const BLOCK_MATERIAL = 2;

let _programId = 0;
const FIXED_ATTRIBUTES = { position: 0, normal: 1, uv: 2, color: 3, uv1: 4, instanceColor: 5, instanceMatrix: 8 };

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
		gl.bindAttribLocation(program, 8, 'instanceMatrix');
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

		// Texture units are assigned once per program at link time and never change:
		// built-in programs use the fixed table, custom (ShaderMaterial) programs number their
		// samplers sequentially. Every active sampler gets its own unit(s) whether or not a
		// texture is ever assigned to it, so a program is always valid to draw with.
		const isCustom = parameters.materialType === MATERIAL_SHADER;
		this.samplerUniforms = [];
		let nextUnit = 0;
		gl.useProgram(program);
		for (const name in this.uniforms) {
			const u = this.uniforms[name];
			const target = samplerTarget(gl, u.type);
			if (target === 0) continue;
			u.target = target;
			u.isShadowSampler = u.type === gl.SAMPLER_2D_SHADOW || u.type === gl.SAMPLER_CUBE_SHADOW || u.type === gl.SAMPLER_2D_ARRAY_SHADOW;
			u.boundStamp = -1;
			let unit;
			if (!isCustom && (TEXTURE_UNITS[name] !== undefined || TEXTURE_UNITS[name + '0'] !== undefined)) {
				unit = u.size > 1 ? TEXTURE_UNITS[name + '0'] : TEXTURE_UNITS[name];
			} else {
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
		this.programs = [];
	}

	/** Compute the integer key + parameters for a built-in material. */
	getParameters(material, object, scene, lights, variant) {
		const renderer = this.renderer;
		const materialType = variant.shadowPass ? MATERIAL_SHADOW_DEPTH : materialTypeOf(material);
		const geometry = object.geometry;
		const attributes = geometry.attributes;
		const isLit = materialType === MATERIAL_LAMBERT || materialType === MATERIAL_PHONG || materialType === MATERIAL_STANDARD;
		const hasUv = attributes.uv !== undefined;
		const hasUv1 = attributes.uv1 !== undefined;
		const vertexColors = material.vertexColors === true && attributes.color !== undefined;
		const fog = scene.fog !== null && material.fog === true && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH;
		const map = !!material.map;
		const alphaMap = !!material.alphaMap;
		const emissiveMap = isLit && !!material.emissiveMap;
		const normalMap = isLit && !!material.normalMap;
		const roughnessMap = materialType === MATERIAL_STANDARD && !!material.roughnessMap;
		const metalnessMap = materialType === MATERIAL_STANDARD && !!material.metalnessMap;
		const aoMap = (isLit || materialType === MATERIAL_BASIC) && !!material.aoMap;
		const specularMap = materialType === MATERIAL_PHONG && !!material.specularMap;
		const useUv = hasUv && (map || alphaMap || emissiveMap || normalMap || roughnessMap || metalnessMap || aoMap || specularMap) && materialType !== MATERIAL_POINTS;
		const useUv1 = hasUv1 && aoMap;
		const receiveShadow = variant.receiveShadow && isLit && renderer.shadowMap.enabled;
		const numDirShadows = receiveShadow ? lights.numDirShadows : 0;
		const numSpotShadows = receiveShadow ? lights.numSpotShadows : 0;
		const toneMapping = (material.toneMapped && renderer.toneMapping !== NoToneMapping && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL) ? renderer.toneMapping : NoToneMapping;
		const currentRenderTarget = renderer.getRenderTarget();
		const sRGBOutput = (currentRenderTarget === null ? renderer.outputColorSpace : currentRenderTarget.texture.colorSpace) === SRGBColorSpace && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL;

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
			doubleSided: material.side === DoubleSide,
			fog, fogExp2: fog && scene.fog.isFogExp2 === true,
			alphaTest: material.alphaTest > 0,
			sizeAttenuation: (materialType === MATERIAL_POINTS || materialType === MATERIAL_SPRITE) && material.sizeAttenuation === true,
			premultipliedAlpha: material.premultipliedAlpha === true,
			dithering: material.dithering === true,
			vertexUv1s: hasUv1,
			toneMapped: toneMapping !== NoToneMapping,
			toneMapping,
			sRGBOutput,
			numDirShadows, numSpotShadows,
		};
		let key = materialType;
		key = key * 2 + (map ? 1 : 0); key = key * 2 + (alphaMap ? 1 : 0); key = key * 2 + (emissiveMap ? 1 : 0); key = key * 2 + (normalMap ? 1 : 0);
		key = key * 2 + (roughnessMap ? 1 : 0); key = key * 2 + (metalnessMap ? 1 : 0); key = key * 2 + (aoMap ? 1 : 0); key = key * 2 + (specularMap ? 1 : 0);
		key = key * 2 + (useUv ? 1 : 0); key = key * 2 + (useUv1 ? 1 : 0); key = key * 2 + (vertexColors ? 1 : 0); key = key * 2 + (p.vertexAlphas ? 1 : 0);
		key = key * 2 + (p.instancing ? 1 : 0); key = key * 2 + (p.instancingColor ? 1 : 0); key = key * 2 + (p.flatShading ? 1 : 0); key = key * 2 + (p.doubleSided ? 1 : 0);
		key = key * 2 + (fog ? 1 : 0); key = key * 2 + (p.alphaTest ? 1 : 0); key = key * 2 + (p.sizeAttenuation ? 1 : 0); key = key * 2 + (p.premultipliedAlpha ? 1 : 0);
		key = key * 2 + (p.dithering ? 1 : 0); key = key * 2 + (hasUv1 ? 1 : 0); key = key * 8 + toneMapping; key = key * 2 + (sRGBOutput ? 1 : 0);
		key = key * 8 + numDirShadows; key = key * 8 + numSpotShadows; key = key * 2 + (p.multiDraw ? 1 : 0); key = key * 2 + (p.objectTexture ? 1 : 0);
		key = key * 2 + (p.materialArray ? 1 : 0);
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
