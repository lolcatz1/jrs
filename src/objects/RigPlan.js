import { epochs } from '../core/epochs.js';
import { TRS_VERSION, TRS_MATRIX_SEEN, TRS_WORLD_VERSION, TRS_PARENT_WORLD_VERSION, TRS_FLAGS, FLAG_NEEDS_UPDATE, FLAG_MATRIX_AUTO, FLAG_WORLD_AUTO } from '../core/SlabTransform.js';

/**
 * Update plan for a bone hierarchy: the scene-graph update of a rig, run from flat arrays.
 *
 * Updating thousands of bones through `Object3D.updateMatrixWorld` recursion costs a cache miss per bone just to
 * read the bone object's fields (children, parent, flags, versions, slab references). A bone's scene-graph state
 * lives in its transform record (see core/SlabTransform.js), so a plan caches, per bone, the record and matrix slab
 * it lives in and the index of its parent, and performs the same computation as `Object3D.updateMatrixWorld`
 * (local matrix recompose when the TRS changed, world matrix when the local one, the parent's world version or a
 * `force` changed) in one loop over those arrays.
 *
 * A plan belongs to a root bone (a Bone whose parent is not a Bone) and covers all Bones below it. Children that are
 * not bones (attached meshes, lights, groups holding further bones) are updated through their own
 * `updateMatrixWorld` after the loop, with the same `force` they would have received. Plans stay valid until
 * `epochs.bones` changes (an add / remove / attach involving a Bone); rigs with Bone subclasses are not planned.
 */
class RigPlan {
	constructor(root, bonesClass) {
		this.epoch = epochs.bones;
		this.enabled = true;
		const bones = [], parents = [], extras = [], extraOwner = [];
		const visit = (bone, parentIndex) => {
			if (bone.constructor !== bonesClass) this.enabled = false; // overridden methods must run
			const k = bones.length;
			bones.push(bone); parents.push(parentIndex);
			const children = bone.children;
			for (let i = 0; i < children.length; i++) {
				const child = children[i];
				if (child.isBone === true) visit(child, k); else { extras.push(child); extraOwner.push(k); }
			}
		};
		visit(root, -1);
		const n = this.n = bones.length;
		this.bones = bones;
		this.recData = new Array(n); this.recOff = new Int32Array(n);
		this.slabData = new Array(n); this.slabOff = new Int32Array(n);
		// per bone: where its parent's world matrix and world version live, and where its parent's force flag is
		// (index n = the root's, which comes from the caller)
		this.parData = new Array(n); this.parOff = new Int32Array(n);
		this.parVerData = new Array(n); this.parVerOff = new Int32Array(n);
		this.forceFrom = new Int32Array(n);
		this.forceOut = new Uint8Array(n + 1);
		this.rootVersion = new Float64Array(1); // the external parent's world version, copied here each update
		for (let k = 0; k < n; k++) {
			const b = bones[k], pk = parents[k];
			this.recData[k] = b._snapData; this.recOff[k] = b._snapOffset;
			this.slabData[k] = b._slabData; this.slabOff[k] = b._slabOffset;
			if (pk >= 0) {
				this.parData[k] = bones[pk]._slabData; this.parOff[k] = bones[pk]._slabOffset + 16;
				this.parVerData[k] = bones[pk]._snapData; this.parVerOff[k] = bones[pk]._snapOffset + TRS_WORLD_VERSION;
				this.forceFrom[k] = pk;
			} else {
				this.parData[k] = b._slabData; this.parOff[k] = 0; // replaced by the external parent's matrix on update
				this.parVerData[k] = this.rootVersion; this.parVerOff[k] = 0;
				this.forceFrom[k] = n;
			}
		}
		this.extras = extras;
		this.extraOwner = Int32Array.from(extraOwner);
	}

	/** Same effect as `root.updateMatrixWorld(force)` on the generic path. */
	update(force) {
		const n = this.n, recData = this.recData, recOff = this.recOff, slabData = this.slabData, slabOff = this.slabOff;
		const parData = this.parData, parOff = this.parOff, parVerData = this.parVerData, parVerOff = this.parVerOff, forceFrom = this.forceFrom, forceOut = this.forceOut;
		const external = this.bones[0].parent;
		const hasExternal = external !== null;
		if (hasExternal) {
			parData[0] = external._slabData; parOff[0] = external._slabOffset + 16;
			this.rootVersion[0] = external._worldVersion;
		}
		forceOut[n] = force === true ? 1 : 0;
		let recomputed = 0;
		for (let k = 0; k < n; k++) {
			const d = recData[k], o = recOff[k];
			const te = slabData[k], l = slabOff[k];
			const flags0 = d[o + TRS_FLAGS];
			let flags = flags0;

			// local matrix: recompose when the TRS was written since the last compose
			if ((flags & FLAG_MATRIX_AUTO) !== 0) {
				const version = d[o + TRS_VERSION];
				if (version !== d[o + TRS_MATRIX_SEEN]) {
					d[o + TRS_MATRIX_SEEN] = version;
					const px = d[o], py = d[o + 1], pz = d[o + 2], x = d[o + 3], y = d[o + 4], z = d[o + 5], w = d[o + 6], sx = d[o + 7], sy = d[o + 8], sz = d[o + 9];
					const x2 = x + x, y2 = y + y, z2 = z + z;
					const xx = x * x2, xy = x * y2, xz = x * z2;
					const yy = y * y2, yz = y * z2, zz = z * z2;
					const wx = w * x2, wy = w * y2, wz = w * z2;
					te[l] = (1 - (yy + zz)) * sx; te[l + 1] = (xy + wz) * sx; te[l + 2] = (xz - wy) * sx; te[l + 3] = 0;
					te[l + 4] = (xy - wz) * sy; te[l + 5] = (1 - (xx + zz)) * sy; te[l + 6] = (yz + wx) * sy; te[l + 7] = 0;
					te[l + 8] = (xz + wy) * sz; te[l + 9] = (yz - wx) * sz; te[l + 10] = (1 - (xx + yy)) * sz; te[l + 11] = 0;
					te[l + 12] = px; te[l + 13] = py; te[l + 14] = pz; te[l + 15] = 1;
					flags |= FLAG_NEEDS_UPDATE;
				}
			}

			// world matrix
			let f = forceOut[forceFrom[k]] !== 0;
			const parentVersion = parVerData[k][parVerOff[k]];
			const hasParent = k !== 0 || hasExternal;
			if ((flags & FLAG_NEEDS_UPDATE) !== 0 || f || (hasParent && parentVersion !== d[o + TRS_PARENT_WORLD_VERSION])) {
				if ((flags & FLAG_WORLD_AUTO) !== 0) {
					const w0 = l + 16;
					if (!hasParent) {
						for (let i = 0; i < 16; i++) te[w0 + i] = te[l + i];
					} else {
						const ae = parData[k], a = parOff[k];
						const b11 = te[l], b12 = te[l + 4], b13 = te[l + 8], b14 = te[l + 12];
						const b21 = te[l + 1], b22 = te[l + 5], b23 = te[l + 9], b24 = te[l + 13];
						const b31 = te[l + 2], b32 = te[l + 6], b33 = te[l + 10], b34 = te[l + 14];
						const a11 = ae[a], a12 = ae[a + 4], a13 = ae[a + 8], a14 = ae[a + 12];
						const a21 = ae[a + 1], a22 = ae[a + 5], a23 = ae[a + 9], a24 = ae[a + 13];
						const a31 = ae[a + 2], a32 = ae[a + 6], a33 = ae[a + 10], a34 = ae[a + 14];
						if (ae[a + 3] === 0 && ae[a + 7] === 0 && ae[a + 11] === 0 && ae[a + 15] === 1 &&
							te[l + 3] === 0 && te[l + 7] === 0 && te[l + 11] === 0 && te[l + 15] === 1) {
							// affine * affine: the bottom row is (0, 0, 0, 1) and the dropped terms are exact zeros
							te[w0] = a11 * b11 + a12 * b21 + a13 * b31;
							te[w0 + 4] = a11 * b12 + a12 * b22 + a13 * b32;
							te[w0 + 8] = a11 * b13 + a12 * b23 + a13 * b33;
							te[w0 + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14;
							te[w0 + 1] = a21 * b11 + a22 * b21 + a23 * b31;
							te[w0 + 5] = a21 * b12 + a22 * b22 + a23 * b32;
							te[w0 + 9] = a21 * b13 + a22 * b23 + a23 * b33;
							te[w0 + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24;
							te[w0 + 2] = a31 * b11 + a32 * b21 + a33 * b31;
							te[w0 + 6] = a31 * b12 + a32 * b22 + a33 * b32;
							te[w0 + 10] = a31 * b13 + a32 * b23 + a33 * b33;
							te[w0 + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34;
							te[w0 + 3] = 0; te[w0 + 7] = 0; te[w0 + 11] = 0; te[w0 + 15] = 1;
						} else {
							const a41 = ae[a + 3], a42 = ae[a + 7], a43 = ae[a + 11], a44 = ae[a + 15];
							const b41 = te[l + 3], b42 = te[l + 7], b43 = te[l + 11], b44 = te[l + 15];
							te[w0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
							te[w0 + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
							te[w0 + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
							te[w0 + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
							te[w0 + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
							te[w0 + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
							te[w0 + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
							te[w0 + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
							te[w0 + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
							te[w0 + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
							te[w0 + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
							te[w0 + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
							te[w0 + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
							te[w0 + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
							te[w0 + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
							te[w0 + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
						}
						d[o + TRS_PARENT_WORLD_VERSION] = parentVersion;
					}
					d[o + TRS_WORLD_VERSION]++;
					recomputed++;
				}
				flags &= ~FLAG_NEEDS_UPDATE;
				f = true;
			}
			if (flags !== flags0) d[o + TRS_FLAGS] = flags;
			forceOut[k] = f ? 1 : 0;
		}
		epochs.world += recomputed;
		const extras = this.extras, extraOwner = this.extraOwner;
		for (let i = 0; i < extras.length; i++) extras[i].updateMatrixWorld(forceOut[extraOwner[i]] !== 0);
	}
}

export { RigPlan };
