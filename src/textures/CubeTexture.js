import { Texture } from './Texture.js';
import { CubeReflectionMapping } from '../constants.js';

class CubeTexture extends Texture {
	constructor(images = [], mapping = CubeReflectionMapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace) {
		super(images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
		this.isCubeTexture = true;
		this.flipY = false;
	}
	get images() { return this.image; }
	set images(value) { this.image = value; }
}

export { CubeTexture };
