import { Camera } from './Camera.js';
import * as MathUtils from '../math/MathUtils.js';
import { Vector2 } from '../math/Vector2.js';
import { Vector3 } from '../math/Vector3.js';

const _v3 = /*@__PURE__*/ new Vector3();
const _minTarget = /*@__PURE__*/ new Vector2();
const _maxTarget = /*@__PURE__*/ new Vector2();

class PerspectiveCamera extends Camera {
	constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) {
		super();
		this.isPerspectiveCamera = true;
		this.type = 'PerspectiveCamera';
		this.fov = fov; this.zoom = 1; this.near = near; this.far = far; this.focus = 10;
		this.aspect = aspect; this.view = null;
		this.filmGauge = 35; this.filmOffset = 0;
		this.updateProjectionMatrix();
	}
	copy(source, recursive) {
		super.copy(source, recursive);
		this.fov = source.fov; this.zoom = source.zoom; this.near = source.near; this.far = source.far; this.focus = source.focus;
		this.aspect = source.aspect; this.view = source.view === null ? null : Object.assign({}, source.view);
		this.filmGauge = source.filmGauge; this.filmOffset = source.filmOffset;
		return this;
	}
	setFocalLength(focalLength) {
		const vExtentSlope = 0.5 * this.getFilmHeight() / focalLength;
		this.fov = MathUtils.RAD2DEG * 2 * Math.atan(vExtentSlope);
		this.updateProjectionMatrix();
	}
	getFocalLength() { const vExtentSlope = Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov); return 0.5 * this.getFilmHeight() / vExtentSlope; }
	getEffectiveFOV() { return MathUtils.RAD2DEG * 2 * Math.atan(Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov) / this.zoom); }
	getFilmWidth() { return this.filmGauge * Math.min(this.aspect, 1); }
	getFilmHeight() { return this.filmGauge / Math.max(this.aspect, 1); }
	getViewBounds(distance, minTarget, maxTarget) {
		_v3.set(-1, -1, 0.5).applyMatrix4(this.projectionMatrixInverse);
		minTarget.set(_v3.x, _v3.y).multiplyScalar(-distance / _v3.z);
		_v3.set(1, 1, 0.5).applyMatrix4(this.projectionMatrixInverse);
		maxTarget.set(_v3.x, _v3.y).multiplyScalar(-distance / _v3.z);
	}
	getViewSize(distance, target) {
		this.getViewBounds(distance, _minTarget, _maxTarget);
		return target.subVectors(_maxTarget, _minTarget);
	}
	setViewOffset(fullWidth, fullHeight, x, y, width, height) {
		this.aspect = fullWidth / fullHeight;
		if (this.view === null) this.view = { enabled: true, fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
		this.view.enabled = true; this.view.fullWidth = fullWidth; this.view.fullHeight = fullHeight;
		this.view.offsetX = x; this.view.offsetY = y; this.view.width = width; this.view.height = height;
		this.updateProjectionMatrix();
	}
	clearViewOffset() { if (this.view !== null) this.view.enabled = false; this.updateProjectionMatrix(); }
	updateProjectionMatrix() {
		const near = this.near;
		let top = near * Math.tan(MathUtils.DEG2RAD * 0.5 * this.fov) / this.zoom;
		let height = 2 * top;
		let width = this.aspect * height;
		let left = -0.5 * width;
		const view = this.view;
		if (this.view !== null && this.view.enabled) {
			const fullWidth = view.fullWidth, fullHeight = view.fullHeight;
			left += view.offsetX * width / fullWidth;
			top -= view.offsetY * height / fullHeight;
			width *= view.width / fullWidth;
			height *= view.height / fullHeight;
		}
		const skew = this.filmOffset;
		if (skew !== 0) left += near * skew / this.getFilmWidth();
		this.projectionMatrix.makePerspective(left, left + width, top, top - height, near, this.far, this.coordinateSystem, this.reversedDepth);
		this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
		this._projectionVersion++;
	}
	toJSON(meta) {
		const data = super.toJSON(meta);
		data.object.fov = this.fov; data.object.zoom = this.zoom; data.object.near = this.near; data.object.far = this.far;
		data.object.focus = this.focus; data.object.aspect = this.aspect;
		if (this.view !== null) data.object.view = Object.assign({}, this.view);
		data.object.filmGauge = this.filmGauge; data.object.filmOffset = this.filmOffset;
		return data;
	}
}

export { PerspectiveCamera };
