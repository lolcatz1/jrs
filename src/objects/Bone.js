import { Object3D } from '../core/Object3D.js';
import { epochs } from '../core/epochs.js';

/**
 * A bone of a Skeleton; an Object3D that is part of the bone hierarchy.
 *
 * `updateMatrix` / `updateMatrixWorld` are behaviourally Object3D's, written out again here on purpose: a
 * rig of N bones is N identical objects, and a separate function body gets its own type feedback, so inside
 * it every property load sees one hidden class (Object3D's copy is shared by lights, meshes, cameras, ...
 * and runs megamorphic). Matrices are read and written straight in the transform slab page.
 */
class Bone extends Object3D {
	constructor() {
		super();
		this.isBone = true;
		this.type = 'Bone';
	}

	updateMatrix() {
		const p = this.position, q = this.quaternion, s = this.scale, d = this._snapData, o = this._snapOffset;
		const px = p.x, py = p.y, pz = p.z, x = q._x, y = q._y, z = q._z, w = q._w, sx = s.x, sy = s.y, sz = s.z;
		if (px === d[o] && py === d[o + 1] && pz === d[o + 2] && x === d[o + 3] && y === d[o + 4] && z === d[o + 5] && w === d[o + 6] &&
			sx === d[o + 7] && sy === d[o + 8] && sz === d[o + 9]) {
			return false;
		}
		d[o] = px; d[o + 1] = py; d[o + 2] = pz;
		d[o + 3] = x; d[o + 4] = y; d[o + 5] = z; d[o + 6] = w;
		d[o + 7] = sx; d[o + 8] = sy; d[o + 9] = sz;

		const te = this._slabData, l = this._slabOffset;
		const x2 = x + x, y2 = y + y, z2 = z + z;
		const xx = x * x2, xy = x * y2, xz = x * z2;
		const yy = y * y2, yz = y * z2, zz = z * z2;
		const wx = w * x2, wy = w * y2, wz = w * z2;
		te[l] = (1 - (yy + zz)) * sx; te[l + 1] = (xy + wz) * sx; te[l + 2] = (xz - wy) * sx; te[l + 3] = 0;
		te[l + 4] = (xy - wz) * sy; te[l + 5] = (1 - (xx + zz)) * sy; te[l + 6] = (yz + wx) * sy; te[l + 7] = 0;
		te[l + 8] = (xz + wy) * sz; te[l + 9] = (yz - wx) * sz; te[l + 10] = (1 - (xx + yy)) * sz; te[l + 11] = 0;
		te[l + 12] = px; te[l + 13] = py; te[l + 14] = pz; te[l + 15] = 1;

		this.matrixWorldNeedsUpdate = true;
		return true;
	}

	updateMatrixWorld(force) {
		if (this.matrixAutoUpdate) this.updateMatrix();
		const parent = this.parent;
		if (this.matrixWorldNeedsUpdate || force || (parent !== null && parent._worldVersion !== this._parentWorldVersion)) {
			if (this.matrixWorldAutoUpdate === true) {
				const te = this._slabData, l = this._slabOffset;
				if (parent === null) {
					for (let i = 0; i < 16; i++) te[l + 16 + i] = te[l + i];
				} else {
					const ae = parent._slabData, a = parent._slabOffset + 16;
					const b11 = te[l], b12 = te[l + 4], b13 = te[l + 8], b14 = te[l + 12];
					const b21 = te[l + 1], b22 = te[l + 5], b23 = te[l + 9], b24 = te[l + 13];
					const b31 = te[l + 2], b32 = te[l + 6], b33 = te[l + 10], b34 = te[l + 14];
					const a11 = ae[a], a12 = ae[a + 4], a13 = ae[a + 8], a14 = ae[a + 12];
					const a21 = ae[a + 1], a22 = ae[a + 5], a23 = ae[a + 9], a24 = ae[a + 13];
					const a31 = ae[a + 2], a32 = ae[a + 6], a33 = ae[a + 10], a34 = ae[a + 14];
					const w = l + 16;
					if (ae[a + 3] === 0 && ae[a + 7] === 0 && ae[a + 11] === 0 && ae[a + 15] === 1 &&
						te[l + 3] === 0 && te[l + 7] === 0 && te[l + 11] === 0 && te[l + 15] === 1) {
						// affine * affine: the bottom row is (0, 0, 0, 1) and the dropped terms are exact zeros
						te[w] = a11 * b11 + a12 * b21 + a13 * b31;
						te[w + 4] = a11 * b12 + a12 * b22 + a13 * b32;
						te[w + 8] = a11 * b13 + a12 * b23 + a13 * b33;
						te[w + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14;
						te[w + 1] = a21 * b11 + a22 * b21 + a23 * b31;
						te[w + 5] = a21 * b12 + a22 * b22 + a23 * b32;
						te[w + 9] = a21 * b13 + a22 * b23 + a23 * b33;
						te[w + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24;
						te[w + 2] = a31 * b11 + a32 * b21 + a33 * b31;
						te[w + 6] = a31 * b12 + a32 * b22 + a33 * b32;
						te[w + 10] = a31 * b13 + a32 * b23 + a33 * b33;
						te[w + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34;
						te[w + 3] = 0; te[w + 7] = 0; te[w + 11] = 0; te[w + 15] = 1;
					} else {
						this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix);
					}
					this._parentWorldVersion = parent._worldVersion;
				}
				this._worldVersion++;
				if (this._countsWorld) epochs.world++;
			}
			this.matrixWorldNeedsUpdate = false;
			force = true;
		}
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(force);
	}
}

export { Bone };
