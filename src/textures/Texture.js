import { EventDispatcher } from '../core/EventDispatcher.js';
import {
	MirroredRepeatWrapping, ClampToEdgeWrapping, RepeatWrapping, UnsignedByteType, RGBAFormat,
	LinearMipmapLinearFilter, LinearFilter, UVMapping, NoColorSpace
} from '../constants.js';
import * as MathUtils from '../math/MathUtils.js';
import { Vector2 } from '../math/Vector2.js';
import { Matrix3 } from '../math/Matrix3.js';
import { Source } from './Source.js';

let _textureId = 0;
const _tempVec3 = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; } };

class Texture extends EventDispatcher {
	constructor(image = Texture.DEFAULT_IMAGE, mapping = Texture.DEFAULT_MAPPING, wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping, magFilter = LinearFilter, minFilter = LinearMipmapLinearFilter, format = RGBAFormat, type = UnsignedByteType, anisotropy = Texture.DEFAULT_ANISOTROPY, colorSpace = NoColorSpace) {
		super();
		this.isTexture = true;
		Object.defineProperty(this, 'id', { value: _textureId++ });
		this.uuid = MathUtils.generateUUID();
		this.name = '';
		this.source = new Source(image);
		this.mipmaps = [];
		this.mapping = mapping;
		this.channel = 0;
		this.wrapS = wrapS; this.wrapT = wrapT;
		this.magFilter = magFilter; this.minFilter = minFilter;
		this.anisotropy = anisotropy;
		this.format = format; this.internalFormat = null; this.type = type;
		this.offset = new Vector2(0, 0);
		this.repeat = new Vector2(1, 1);
		this.center = new Vector2(0, 0);
		this.rotation = 0;
		this.matrixAutoUpdate = true;
		this.matrix = new Matrix3();
		this.generateMipmaps = true;
		this.premultiplyAlpha = false;
		this.flipY = true;
		this.unpackAlignment = 4;
		this.colorSpace = colorSpace;
		this.userData = {};
		this.updateRanges = [];
		this.version = 0;
		this.onUpdate = null;
		this.renderTarget = null;
		this.isRenderTargetTexture = false;
		this.isArrayTexture = !!(image && image.depth && image.depth > 1);
		this.pmremVersion = 0;
	}
	get width() { return this.source.getSize(_tempVec3).x; }
	get height() { return this.source.getSize(_tempVec3).y; }
	get depth() { return this.source.getSize(_tempVec3).z; }
	get image() { return this.source.data; }
	set image(value = null) { this.source.data = value; }
	updateMatrix() { this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y); }
	addUpdateRange(start, count) { this.updateRanges.push({ start, count }); }
	clearUpdateRanges() { this.updateRanges.length = 0; }
	clone() { return new this.constructor().copy(this); }
	copy(source) {
		this.name = source.name;
		this.source = source.source;
		this.mipmaps = source.mipmaps.slice(0);
		this.mapping = source.mapping; this.channel = source.channel;
		this.wrapS = source.wrapS; this.wrapT = source.wrapT;
		this.magFilter = source.magFilter; this.minFilter = source.minFilter;
		this.anisotropy = source.anisotropy;
		this.format = source.format; this.internalFormat = source.internalFormat; this.type = source.type;
		this.offset.copy(source.offset); this.repeat.copy(source.repeat); this.center.copy(source.center);
		this.rotation = source.rotation;
		this.matrixAutoUpdate = source.matrixAutoUpdate;
		this.matrix.copy(source.matrix);
		this.generateMipmaps = source.generateMipmaps;
		this.premultiplyAlpha = source.premultiplyAlpha;
		this.flipY = source.flipY;
		this.unpackAlignment = source.unpackAlignment;
		this.colorSpace = source.colorSpace;
		this.renderTarget = source.renderTarget;
		this.isRenderTargetTexture = source.isRenderTargetTexture;
		this.isArrayTexture = source.isArrayTexture;
		this.userData = JSON.parse(JSON.stringify(source.userData));
		this.needsUpdate = true;
		return this;
	}
	setValues(values) {
		for (const key in values) {
			const newValue = values[key];
			if (newValue === undefined) { console.warn(`Texture.setValues(): parameter '${key}' has value of undefined.`); continue; }
			const currentValue = this[key];
			if (currentValue === undefined) { console.warn(`Texture.setValues(): property '${key}' does not exist.`); continue; }
			if ((currentValue && newValue) && (currentValue.isVector2 && newValue.isVector2)) currentValue.copy(newValue);
			else if ((currentValue && newValue) && (currentValue.isVector3 && newValue.isVector3)) currentValue.copy(newValue);
			else if ((currentValue && newValue) && (currentValue.isMatrix3 && newValue.isMatrix3)) currentValue.copy(newValue);
			else this[key] = newValue;
		}
	}
	toJSON() {
		return { uuid: this.uuid, name: this.name, mapping: this.mapping, channel: this.channel, repeat: [this.repeat.x, this.repeat.y], offset: [this.offset.x, this.offset.y], center: [this.center.x, this.center.y], rotation: this.rotation, wrap: [this.wrapS, this.wrapT], format: this.format, internalFormat: this.internalFormat, type: this.type, colorSpace: this.colorSpace, minFilter: this.minFilter, magFilter: this.magFilter, anisotropy: this.anisotropy, flipY: this.flipY, generateMipmaps: this.generateMipmaps, premultiplyAlpha: this.premultiplyAlpha, unpackAlignment: this.unpackAlignment };
	}
	dispose() { this.dispatchEvent({ type: 'dispose' }); }
	transformUv(uv) {
		if (this.mapping !== UVMapping) return uv;
		uv.applyMatrix3(this.matrix);
		if (uv.x < 0 || uv.x > 1) {
			switch (this.wrapS) {
				case RepeatWrapping: uv.x = uv.x - Math.floor(uv.x); break;
				case ClampToEdgeWrapping: uv.x = uv.x < 0 ? 0 : 1; break;
				case MirroredRepeatWrapping: if (Math.abs(Math.floor(uv.x) % 2) === 1) uv.x = Math.ceil(uv.x) - uv.x; else uv.x = uv.x - Math.floor(uv.x); break;
			}
		}
		if (uv.y < 0 || uv.y > 1) {
			switch (this.wrapT) {
				case RepeatWrapping: uv.y = uv.y - Math.floor(uv.y); break;
				case ClampToEdgeWrapping: uv.y = uv.y < 0 ? 0 : 1; break;
				case MirroredRepeatWrapping: if (Math.abs(Math.floor(uv.y) % 2) === 1) uv.y = Math.ceil(uv.y) - uv.y; else uv.y = uv.y - Math.floor(uv.y); break;
			}
		}
		if (this.flipY) uv.y = 1 - uv.y;
		return uv;
	}
	set needsUpdate(value) { if (value === true) { this.version++; this.source.needsUpdate = true; } }
	set needsPMREMUpdate(value) { if (value === true) this.pmremVersion++; }
}

Texture.DEFAULT_IMAGE = null;
Texture.DEFAULT_MAPPING = UVMapping;
Texture.DEFAULT_ANISOTROPY = 1;

export { Texture };
