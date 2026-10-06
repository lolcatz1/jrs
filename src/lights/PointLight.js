import { Light } from './Light.js';
import { PointLightShadow } from './PointLightShadow.js';

class PointLight extends Light {
	constructor(color, intensity, distance = 0, decay = 2) {
		super(color, intensity);
		this.isPointLight = true;
		this.type = 'PointLight';
		this.distance = distance; this.decay = decay;
		this.shadow = new PointLightShadow();
	}
	get power() { return this.intensity * 4 * Math.PI; }
	set power(power) { this.intensity = power / (4 * Math.PI); }
	dispose() { this.shadow.dispose(); }
	copy(source, recursive) {
		super.copy(source, recursive);
		this.distance = source.distance; this.decay = source.decay;
		this.shadow = source.shadow.clone();
		return this;
	}
}

export { PointLight };
