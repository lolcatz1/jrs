import { Texture } from './Texture.js';
import { NearestFilter, UnsignedIntType, DepthFormat, DepthStencilFormat } from '../constants.js';

class DepthTexture extends Texture {
	constructor(width, height, type, mapping, wrapS, wrapT, magFilter = NearestFilter, minFilter = NearestFilter, anisotropy, format = DepthFormat, depth = 1) {
		if (format !== DepthFormat && format !== DepthStencilFormat) throw new Error('DepthTexture format must be either DepthFormat or DepthStencilFormat');
		if (type === undefined) type = UnsignedIntType; // three.js r186 default for both depth formats
		super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
		this.isDepthTexture = true;
		this.image = { width: width, height: height, depth: depth };
		this.flipY = false;
		this.generateMipmaps = false;
		this.compareFunction = null;
	}
	copy(source) { super.copy(source); this.source = new this.source.constructor(Object.assign({}, source.image)); this.compareFunction = source.compareFunction; return this; }
}

export { DepthTexture };
