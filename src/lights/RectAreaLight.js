import { Light } from './Light.js';

class RectAreaLight extends Light {
	constructor(color, intensity, width = 10, height = 10) {
		super(color, intensity);
		this.isRectAreaLight = true;
		this.type = 'RectAreaLight';
		this.width = width; this.height = height;
	}
	get power() { return this.intensity * this.width * this.height * Math.PI; }
	set power(power) { this.intensity = power / (this.width * this.height * Math.PI); }
	copy(source) { super.copy(source); this.width = source.width; this.height = source.height; return this; }
}

export { RectAreaLight };
