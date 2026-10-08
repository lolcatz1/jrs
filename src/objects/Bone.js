import { Object3D } from '../core/Object3D.js';

/** A bone of a Skeleton; a plain Object3D that is part of the bone hierarchy. */
class Bone extends Object3D {
	constructor() {
		super();
		this.isBone = true;
		this.type = 'Bone';
	}
}

export { Bone };
