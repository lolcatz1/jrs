import { clamp } from '../../math/MathUtils.js';
import { Vector2 } from '../../math/Vector2.js';
import { Vector3 } from '../../math/Vector3.js';

/**
 * Rotates `v` in place around the unit `axis` by `angle`, in double precision.
 * Performs exactly the arithmetic of three.js's `Matrix4.makeRotationAxis` followed by
 * `Vector3.applyMatrix4`, so the result is bit-identical to three.js while avoiding the
 * float32 rounding that storing the matrix in our Float32Array-backed Matrix4 would introduce.
 */
function rotateAroundAxis(v, axis, angle) {
	const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
	const x = axis.x, y = axis.y, z = axis.z, tx = t * x, ty = t * y;
	const vx = v.x, vy = v.y, vz = v.z;
	v.x = (tx * x + c) * vx + (tx * y - s * z) * vy + (tx * z + s * y) * vz;
	v.y = (tx * y + s * z) * vx + (ty * y + c) * vy + (ty * z - s * x) * vz;
	v.z = (tx * z - s * y) * vx + (ty * z + s * x) * vy + (t * z * z + c) * vz;
	return v;
}

/**
 * An abstract base class for creating an analytic curve object that contains methods
 * for interpolation. Subclasses implement `getPoint( t, optionalTarget )`.
 * API and numerical behaviour match three.js's Curve.
 */
class Curve {
	constructor() {
		this.type = 'Curve';
		this.arcLengthDivisions = 200;
		this.needsUpdate = false;
		this.cacheArcLengths = null;
	}

	getPoint(/* t, optionalTarget */) {
		console.warn('Curve: .getPoint() not implemented.');
	}

	getPointAt(u, optionalTarget) {
		const t = this.getUtoTmapping(u);
		return this.getPoint(t, optionalTarget);
	}

	getPoints(divisions = 5) {
		const points = [];
		for (let d = 0; d <= divisions; d++) points.push(this.getPoint(d / divisions));
		return points;
	}

	// Get sequence of points using getPointAt( u )
	getSpacedPoints(divisions = 5) {
		const points = [];
		for (let d = 0; d <= divisions; d++) points.push(this.getPointAt(d / divisions));
		return points;
	}

	getLength() {
		const lengths = this.getLengths();
		return lengths[lengths.length - 1];
	}

	getLengths(divisions = this.arcLengthDivisions) {
		if (this.cacheArcLengths && (this.cacheArcLengths.length === divisions + 1) && !this.needsUpdate) {
			return this.cacheArcLengths;
		}

		this.needsUpdate = false;

		const cache = [];
		let current, last = this.getPoint(0);
		let sum = 0;

		cache.push(0);

		for (let p = 1; p <= divisions; p++) {
			current = this.getPoint(p / divisions);
			sum += current.distanceTo(last);
			cache.push(sum);
			last = current;
		}

		this.cacheArcLengths = cache;

		return cache; // Sum is in the last element.
	}

	updateArcLengths() {
		this.needsUpdate = true;
		this.getLengths();
	}

	getUtoTmapping(u, distance = null) {
		const arcLengths = this.getLengths();

		let i = 0;
		const il = arcLengths.length;

		let targetArcLength; // The targeted u distance value to get

		if (distance) {
			targetArcLength = distance;
		} else {
			targetArcLength = u * arcLengths[il - 1];
		}

		// binary search for the index with largest value smaller than target u distance
		let low = 0, high = il - 1, comparison;

		while (low <= high) {
			i = Math.floor(low + (high - low) / 2);
			comparison = arcLengths[i] - targetArcLength;

			if (comparison < 0) {
				low = i + 1;
			} else if (comparison > 0) {
				high = i - 1;
			} else {
				high = i;
				break;
			}
		}

		i = high;

		if (arcLengths[i] === targetArcLength) {
			return i / (il - 1);
		}

		// we could get finer grain at lengths, or use simple interpolation between two points
		const lengthBefore = arcLengths[i];
		const lengthAfter = arcLengths[i + 1];

		const segmentLength = lengthAfter - lengthBefore;

		// determine where we are between the 'before' and 'after' points
		const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;

		// add that fractional amount to t
		const t = (i + segmentFraction) / (il - 1);

		return t;
	}

	getTangent(t, optionalTarget) {
		const delta = 0.0001;
		let t1 = t - delta;
		let t2 = t + delta;

		// Capping in case of danger
		if (t1 < 0) t1 = 0;
		if (t2 > 1) t2 = 1;

		const pt1 = this.getPoint(t1);
		const pt2 = this.getPoint(t2);

		const tangent = optionalTarget || ((pt1.isVector2) ? new Vector2() : new Vector3());

		tangent.copy(pt2).sub(pt1).normalize();

		return tangent;
	}

	getTangentAt(u, optionalTarget) {
		const t = this.getUtoTmapping(u);
		return this.getTangent(t, optionalTarget);
	}

	computeFrenetFrames(segments, closed = false) {
		// see http://www.cs.indiana.edu/pub/techreports/TR425.pdf

		const normal = new Vector3();

		const tangents = [];
		const normals = [];
		const binormals = [];

		const vec = new Vector3();

		// compute the tangent vectors for each segment on the curve
		for (let i = 0; i <= segments; i++) {
			const u = i / segments;
			tangents[i] = this.getTangentAt(u, new Vector3());
		}

		// select an initial normal vector perpendicular to the first tangent vector,
		// and in the direction of the minimum tangent xyz component
		normals[0] = new Vector3();
		binormals[0] = new Vector3();
		let min = Number.MAX_VALUE;
		const tx = Math.abs(tangents[0].x);
		const ty = Math.abs(tangents[0].y);
		const tz = Math.abs(tangents[0].z);

		if (tx <= min) { min = tx; normal.set(1, 0, 0); }
		if (ty <= min) { min = ty; normal.set(0, 1, 0); }
		if (tz <= min) { normal.set(0, 0, 1); }

		vec.crossVectors(tangents[0], normal).normalize();

		normals[0].crossVectors(tangents[0], vec);
		binormals[0].crossVectors(tangents[0], normals[0]);

		// compute the slowly-varying normal and binormal vectors for each segment on the curve
		for (let i = 1; i <= segments; i++) {
			normals[i] = normals[i - 1].clone();
			binormals[i] = binormals[i - 1].clone();

			vec.crossVectors(tangents[i - 1], tangents[i]);

			if (vec.length() > Number.EPSILON) {
				vec.normalize();
				const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1)); // clamp for floating pt errors
				rotateAroundAxis(normals[i], vec, theta);
			}

			binormals[i].crossVectors(tangents[i], normals[i]);
		}

		// if the curve is closed, postprocess the vectors so the first and last normal vectors are the same
		if (closed === true) {
			let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
			theta /= segments;

			if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
				theta = -theta;
			}

			for (let i = 1; i <= segments; i++) {
				// twist a little...
				rotateAroundAxis(normals[i], tangents[i], theta * i);
				binormals[i].crossVectors(tangents[i], normals[i]);
			}
		}

		return {
			tangents: tangents,
			normals: normals,
			binormals: binormals
		};
	}

	clone() {
		return new this.constructor().copy(this);
	}

	copy(source) {
		this.arcLengthDivisions = source.arcLengthDivisions;
		return this;
	}

	toJSON() {
		const data = {
			metadata: {
				version: 4.7,
				type: 'Curve',
				generator: 'Curve.toJSON'
			}
		};

		data.arcLengthDivisions = this.arcLengthDivisions;
		data.type = this.type;

		return data;
	}

	fromJSON(json) {
		this.arcLengthDivisions = json.arcLengthDivisions;
		return this;
	}
}

export { Curve };
