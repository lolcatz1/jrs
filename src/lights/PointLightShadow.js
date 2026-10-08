import { LightShadow } from './LightShadow.js';
import { PerspectiveCamera } from '../cameras/PerspectiveCamera.js';

/**
 * Shadow of a point light: six 90 degree faces rendered into a cube depth map by the renderer.
 * The face cameras are driven by the renderer (as in three.js); `camera` is the shared face camera.
 */
class PointLightShadow extends LightShadow {
	constructor() {
		super(new PerspectiveCamera(90, 1, 0.5, 500));
		this.isPointLightShadow = true;
	}
}

export { PointLightShadow };
