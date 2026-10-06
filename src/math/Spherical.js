import { clamp } from './MathUtils.js';

class Spherical {
	constructor(radius = 1, phi = 0, theta = 0) { this.radius = radius; this.phi = phi; this.theta = theta; }
	set(radius, phi, theta) { this.radius = radius; this.phi = phi; this.theta = theta; return this; }
	copy(other) { this.radius = other.radius; this.phi = other.phi; this.theta = other.theta; return this; }
	makeSafe() { const EPS = 0.000001; this.phi = clamp(this.phi, EPS, Math.PI - EPS); return this; }
	setFromVector3(v) { return this.setFromCartesianCoords(v.x, v.y, v.z); }
	setFromCartesianCoords(x, y, z) {
		this.radius = Math.sqrt(x * x + y * y + z * z);
		if (this.radius === 0) { this.theta = 0; this.phi = 0; }
		else { this.theta = Math.atan2(x, z); this.phi = Math.acos(clamp(y / this.radius, -1, 1)); }
		return this;
	}
	clone() { return new this.constructor().copy(this); }
}

export { Spherical };
