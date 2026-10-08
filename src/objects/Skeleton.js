import { RGBAFormat, FloatType } from '../constants.js';
import { Bone } from './Bone.js';
import { Matrix4 } from '../math/Matrix4.js';
import { DataTexture } from '../textures/DataTexture.js';
import { generateUUID } from '../math/MathUtils.js';

const _identityMatrix = /*@__PURE__*/ new Matrix4();

/**
 * Skeleton with the three.js API. `update()` writes bone.matrixWorld * boneInverse for
 * every bone straight into the `boneMatrices` Float32Array (no temporaries) and marks the
 * bone texture for upload. When no bone's world matrix changed since the last update the
 * whole step is skipped, so idle skeletons cost a few integer compares per frame.
 */
class Skeleton {
	constructor(bones = [], boneInverses = []) {
		this.uuid = generateUUID();
		this.bones = bones.slice(0);
		this.boneInverses = boneInverses;
		this.boneMatrices = null;
		this.boneTexture = null;
		/** Frame stamp used by the renderer to call update() once per frame. */
		this.frame = -1;
		// change detection: last seen _worldVersion per bone and the boneInverses array it was computed with
		this._boneVersions = null;
		this._versionsFor = null;
		this._inversesVersion = 0;
		this._lastInversesVersion = -1;
		this.init();
	}
	init() {
		const bones = this.bones;
		const boneInverses = this.boneInverses;
		this.boneMatrices = new Float32Array(bones.length * 16);
		this._boneVersions = new Float64Array(bones.length).fill(-1);
		this._versionsFor = null;
		this._inversesVersion++;
		if (boneInverses.length === 0) {
			this.calculateInverses();
		} else if (bones.length !== boneInverses.length) {
			console.warn('Skeleton: Number of inverse bone matrices does not match amount of bones.');
			this.boneInverses = [];
			for (let i = 0, il = this.bones.length; i < il; i++) this.boneInverses.push(new Matrix4());
		}
	}
	calculateInverses() {
		this.boneInverses.length = 0;
		for (let i = 0, il = this.bones.length; i < il; i++) {
			const inverse = new Matrix4();
			if (this.bones[i]) inverse.copy(this.bones[i].matrixWorld).invert();
			this.boneInverses.push(inverse);
		}
		this._inversesVersion++;
	}
	pose() {
		// recover the bind-time world matrices
		for (let i = 0, il = this.bones.length; i < il; i++) {
			const bone = this.bones[i];
			if (bone) bone.matrixWorld.copy(this.boneInverses[i]).invert();
		}
		// compute the local matrices, positions, rotations and scales
		for (let i = 0, il = this.bones.length; i < il; i++) {
			const bone = this.bones[i];
			if (bone) {
				if (bone.parent && bone.parent.isBone) {
					bone.matrix.copy(bone.parent.matrixWorld).invert();
					bone.matrix.multiply(bone.matrixWorld);
				} else {
					bone.matrix.copy(bone.matrixWorld);
				}
				bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
				bone._worldVersion++;
			}
		}
		this._inversesVersion++;
	}
	/** Recomputes `boneMatrices` (and flags the bone texture) if any bone moved since the last call. */
	update() {
		const bones = this.bones, boneInverses = this.boneInverses, boneMatrices = this.boneMatrices;
		const n = bones.length;
		let versions = this._boneVersions;
		if (versions.length !== n) { versions = this._boneVersions = new Float64Array(n).fill(-1); }
		let changed = this._versionsFor !== boneInverses || this._lastInversesVersion !== this._inversesVersion || boneMatrices.length < n * 16;
		if (!changed) {
			for (let i = 0; i < n; i++) {
				const bone = bones[i];
				const v = bone ? bone._worldVersion : -2;
				if (versions[i] !== v) { changed = true; break; }
			}
			if (!changed) return;
		}
		this._versionsFor = boneInverses; this._lastInversesVersion = this._inversesVersion;
		for (let i = 0; i < n; i++) {
			const bone = bones[i];
			const ae = bone ? bone.matrixWorld.elements : _identityMatrix.elements;
			const be = boneInverses[i].elements;
			versions[i] = bone ? bone._worldVersion : -2;
			const o = i * 16;
			const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
			const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
			const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
			const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
			const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
			const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
			const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
			const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
			boneMatrices[o] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
			boneMatrices[o + 4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
			boneMatrices[o + 8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
			boneMatrices[o + 12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
			boneMatrices[o + 1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
			boneMatrices[o + 5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
			boneMatrices[o + 9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
			boneMatrices[o + 13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
			boneMatrices[o + 2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
			boneMatrices[o + 6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
			boneMatrices[o + 10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
			boneMatrices[o + 14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
			boneMatrices[o + 3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
			boneMatrices[o + 7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
			boneMatrices[o + 11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
			boneMatrices[o + 15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
		}
		if (this.boneTexture !== null) this.boneTexture.needsUpdate = true;
	}
	clone() { return new Skeleton(this.bones, this.boneInverses); }
	/** Allocates the RGBA float bone texture (4 texels per bone), same layout and size rule as three.js. */
	computeBoneTexture() {
		let size = Math.sqrt(this.bones.length * 4);
		size = Math.ceil(size / 4) * 4;
		size = Math.max(size, 4);
		const boneMatrices = new Float32Array(size * size * 4);
		boneMatrices.set(this.boneMatrices);
		const boneTexture = new DataTexture(boneMatrices, size, size, RGBAFormat, FloatType);
		boneTexture.needsUpdate = true;
		// re-uploaded every frame it changes: the renderer streams it with texImage2D (see WebGLTextures)
		boneTexture._stream = true;
		this.boneMatrices = boneMatrices;
		this.boneTexture = boneTexture;
		return this;
	}
	getBoneByName(name) {
		for (let i = 0, il = this.bones.length; i < il; i++) { const bone = this.bones[i]; if (bone.name === name) return bone; }
		return undefined;
	}
	dispose() {
		if (this.boneTexture !== null) { this.boneTexture.dispose(); this.boneTexture = null; }
	}
	fromJSON(json, bones) {
		this.uuid = json.uuid;
		for (let i = 0, l = json.bones.length; i < l; i++) {
			const uuid = json.bones[i];
			let bone = bones[uuid];
			if (bone === undefined) { console.warn('Skeleton: No bone found with UUID:', uuid); bone = new Bone(); }
			this.bones.push(bone);
			this.boneInverses.push(new Matrix4().fromArray(json.boneInverses[i]));
		}
		this.init();
		return this;
	}
	toJSON() {
		const data = { metadata: { version: 4.7, type: 'Skeleton', generator: 'Skeleton.toJSON' }, bones: [], boneInverses: [] };
		data.uuid = this.uuid;
		for (let i = 0, l = this.bones.length; i < l; i++) {
			data.bones.push(this.bones[i].uuid);
			data.boneInverses.push(this.boneInverses[i].toArray());
		}
		return data;
	}
}

export { Skeleton };
