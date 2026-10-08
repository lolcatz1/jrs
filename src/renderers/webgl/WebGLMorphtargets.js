import { FloatType } from '../../constants.js';
import { DataArrayTexture } from '../../textures/DataArrayTexture.js';

/**
 * Morph target textures, laid out exactly as three.js r186 does it: one RGBA32F
 * DataArrayTexture per geometry, one layer per morph target, `stride` texels per
 * vertex (position, normal, colour), built once and re-uploaded only when the
 * morph attributes are replaced.
 */
class WebGLMorphtargets {
	constructor(maxTextureSize) {
		this.maxTextureSize = maxTextureSize;
		this.entries = new WeakMap();
	}
	/** Returns { texture, width, height, count } for the geometry's morph attributes. */
	get(geometry) {
		const morphAttributes = geometry.morphAttributes;
		const morphAttribute = morphAttributes.position || morphAttributes.normal || morphAttributes.color;
		const morphTargetsCount = morphAttribute !== undefined ? morphAttribute.length : 0;
		let entry = this.entries.get(geometry);
		if (entry !== undefined && entry.count === morphTargetsCount && entry.position === morphAttributes.position && entry.normal === morphAttributes.normal && entry.color === morphAttributes.color && entry.vertices === geometry.attributes.position.count) return entry;
		if (entry !== undefined) entry.texture.dispose();
		const hasMorphPosition = morphAttributes.position !== undefined;
		const hasMorphNormals = morphAttributes.normal !== undefined;
		const hasMorphColors = morphAttributes.color !== undefined;
		const morphTargets = morphAttributes.position || [];
		const morphNormals = morphAttributes.normal || [];
		const morphColors = morphAttributes.color || [];
		let vertexDataCount = 0;
		if (hasMorphPosition === true) vertexDataCount = 1;
		if (hasMorphNormals === true) vertexDataCount = 2;
		if (hasMorphColors === true) vertexDataCount = 3;
		const vertices = geometry.attributes.position.count;
		let width = vertices * vertexDataCount;
		let height = 1;
		if (width > this.maxTextureSize) { height = Math.ceil(width / this.maxTextureSize); width = this.maxTextureSize; }
		const buffer = new Float32Array(width * height * 4 * morphTargetsCount);
		const texture = new DataArrayTexture(buffer, width, height, morphTargetsCount);
		texture.type = FloatType;
		texture.needsUpdate = true;
		const vertexDataStride = vertexDataCount * 4;
		for (let i = 0; i < morphTargetsCount; i++) {
			const morphTarget = morphTargets[i], morphNormal = morphNormals[i], morphColor = morphColors[i];
			const offset = width * height * 4 * i;
			const count = (morphTarget || morphNormal || morphColor).count;
			for (let j = 0; j < count; j++) {
				const stride = j * vertexDataStride;
				if (hasMorphPosition === true) {
					buffer[offset + stride + 0] = morphTarget.getX(j);
					buffer[offset + stride + 1] = morphTarget.getY(j);
					buffer[offset + stride + 2] = morphTarget.getZ(j);
					buffer[offset + stride + 3] = 0;
				}
				if (hasMorphNormals === true) {
					buffer[offset + stride + 4] = morphNormal.getX(j);
					buffer[offset + stride + 5] = morphNormal.getY(j);
					buffer[offset + stride + 6] = morphNormal.getZ(j);
					buffer[offset + stride + 7] = 0;
				}
				if (hasMorphColors === true) {
					buffer[offset + stride + 8] = morphColor.getX(j);
					buffer[offset + stride + 9] = morphColor.getY(j);
					buffer[offset + stride + 10] = morphColor.getZ(j);
					buffer[offset + stride + 11] = morphColor.itemSize === 4 ? morphColor.getW(j) : 1;
				}
			}
		}
		entry = { count: morphTargetsCount, texture, width, height, position: morphAttributes.position, normal: morphAttributes.normal, color: morphAttributes.color, vertices };
		this.entries.set(geometry, entry);
		const dispose = () => { texture.dispose(); this.entries.delete(geometry); geometry.removeEventListener('dispose', dispose); };
		geometry.addEventListener('dispose', dispose);
		return entry;
	}
}

export { WebGLMorphtargets };
