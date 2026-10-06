import { Texture } from './Texture.js';
import { ClampToEdgeWrapping, NearestFilter } from '../constants.js';

class Data3DTexture extends Texture {
	constructor(data = null, width = 1, height = 1, depth = 1) {
		super(null);
		this.isData3DTexture = true;
		this.image = { data, width, height, depth };
		this.magFilter = NearestFilter;
		this.minFilter = NearestFilter;
		this.wrapR = ClampToEdgeWrapping;
		this.generateMipmaps = false;
		this.flipY = false;
		this.unpackAlignment = 1;
	}
	copy(source) { super.copy(source); this.wrapR = source.wrapR; return this; }
}

export { Data3DTexture };
