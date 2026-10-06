import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute, countInclusive, countExclusive } from './internal.js';

/**
 * A simple shape of Euclidean geometry: a flat triangle fan in the XY plane facing +Z.
 * Output is identical to three.js's CircleGeometry.
 */
class CircleGeometry extends BufferGeometry {
	constructor(radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2) {
		super();
		this.type = 'CircleGeometry';
		this.parameters = {
			radius: radius,
			segments: segments,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		segments = Math.max(3, segments);

		// buffers (pre-sized): one center vertex plus `segments + 1` ring vertices
		const vertexCount = 1 + countInclusive(segments);
		const indices = allocIndex(countExclusive(segments) * 3, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		// center point: position (0, 0, 0), normal (0, 0, 1), uv (0.5, 0.5)
		normals[2] = 1;
		uvs[0] = 0.5; uvs[1] = 0.5;

		let vOff = 3, uvOff = 2, iOff = 0;

		for (let s = 0; s <= segments; s++) {
			const segment = thetaStart + s / segments * thetaLength;

			// vertex
			const x = radius * Math.cos(segment);
			const y = radius * Math.sin(segment);
			vertices[vOff] = x; vertices[vOff + 1] = y; // z stays 0

			// normal
			normals[vOff + 2] = 1;
			vOff += 3;

			// uvs
			uvs[uvOff++] = (x / radius + 1) / 2;
			uvs[uvOff++] = (y / radius + 1) / 2;
		}

		// indices
		for (let i = 1; i <= segments; i++) {
			indices[iOff++] = i; indices[iOff++] = i + 1; indices[iOff++] = 0;
		}

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new CircleGeometry(data.radius, data.segments, data.thetaStart, data.thetaLength);
	}
}

export { CircleGeometry };
