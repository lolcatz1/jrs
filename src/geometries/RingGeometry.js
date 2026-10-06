import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute, countInclusive, countExclusive } from './internal.js';

/**
 * A class for generating a two-dimensional ring geometry in the XY plane facing +Z.
 * Output is identical to three.js's RingGeometry.
 */
class RingGeometry extends BufferGeometry {
	constructor(innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2) {
		super();
		this.type = 'RingGeometry';
		this.parameters = {
			innerRadius: innerRadius,
			outerRadius: outerRadius,
			thetaSegments: thetaSegments,
			phiSegments: phiSegments,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		thetaSegments = Math.max(3, thetaSegments);
		phiSegments = Math.max(1, phiSegments);

		// buffers (pre-sized)
		const vertexCount = countInclusive(phiSegments) * countInclusive(thetaSegments);
		const indices = allocIndex(countExclusive(phiSegments) * countExclusive(thetaSegments) * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		// some helper variables
		let radius = innerRadius;
		const radiusStep = ((outerRadius - innerRadius) / phiSegments);

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, normals and uvs
		for (let j = 0; j <= phiSegments; j++) {
			for (let i = 0; i <= thetaSegments; i++) {
				// values are generate from the inside of the ring to the outside
				const segment = thetaStart + i / thetaSegments * thetaLength;

				// vertex
				const x = radius * Math.cos(segment);
				const y = radius * Math.sin(segment);
				vertices[vOff] = x; vertices[vOff + 1] = y; // z stays 0

				// normal
				normals[vOff + 2] = 1;
				vOff += 3;

				// uv
				uvs[uvOff++] = (x / outerRadius + 1) / 2;
				uvs[uvOff++] = (y / outerRadius + 1) / 2;
			}

			// increase the radius for next row of vertices
			radius += radiusStep;
		}

		// indices
		for (let j = 0; j < phiSegments; j++) {
			const thetaSegmentLevel = j * (thetaSegments + 1);
			for (let i = 0; i < thetaSegments; i++) {
				const segment = i + thetaSegmentLevel;

				const a = segment;
				const b = segment + thetaSegments + 1;
				const c = segment + thetaSegments + 2;
				const d = segment + 1;

				indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
				indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d;
			}
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
		return new RingGeometry(data.innerRadius, data.outerRadius, data.thetaSegments, data.phiSegments, data.thetaStart, data.thetaLength);
	}
}

export { RingGeometry };
