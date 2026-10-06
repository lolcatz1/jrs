import { LightShadow } from './LightShadow.js';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera.js';

class PointLightShadow extends LightShadow {
	constructor() {
		super(new PerspectiveCamera(90, 1, 0.5, 500));
		this.isPointLightShadow = true;
	}
	updateMatrices(light) {
		const camera = this.camera;
		const far = light.distance || camera.far;
		if (far !== camera.far) { camera.far = far; camera.updateProjectionMatrix(); }
		super.updateMatrices(light);
	}
}

export { PointLightShadow };
