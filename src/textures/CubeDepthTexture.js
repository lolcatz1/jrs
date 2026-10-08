import { DepthTexture } from './DepthTexture.js';
import { CubeReflectionMapping, NearestFilter, UnsignedIntType, DepthFormat } from '../constants.js';

/** A depth texture with six faces: the shadow map of a point light. */
class CubeDepthTexture extends DepthTexture {
	constructor(size, type = UnsignedIntType, mapping = CubeReflectionMapping, wrapS, wrapT, magFilter = NearestFilter, minFilter = NearestFilter, anisotropy, format = DepthFormat) {
		const image = { width: size, height: size, depth: 1 };
		super(size, size, type, mapping, wrapS, wrapT, magFilter, minFilter, anisotropy, format);
		this.image = [image, image, image, image, image, image];
		this.isCubeDepthTexture = true;
		this.isCubeTexture = true;
	}
	get images() { return this.image; }
	set images(value) { this.image = value; }
}

export { CubeDepthTexture };
