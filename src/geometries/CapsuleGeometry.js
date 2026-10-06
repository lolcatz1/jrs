import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A geometry class for representing a capsule (a cylinder with hemispherical caps).
 * Output is identical to three.js's CapsuleGeometry.
 */
class CapsuleGeometry extends BufferGeometry {
	constructor(radius = 1, height = 1, capSegments = 4, radialSegments = 8, heightSegments = 1) {
		super();
		this.type = 'CapsuleGeometry';
		this.parameters = {
			radius: radius,
			height: height,
			capSegments: capSegments,
			radialSegments: radialSegments,
			heightSegments: heightSegments,
		};

		height = Math.max(0, height);
		capSegments = Math.max(1, Math.floor(capSegments));
		radialSegments = Math.max(3, Math.floor(radialSegments));
		heightSegments = Math.max(1, Math.floor(heightSegments));

		// helper variables
		const halfHeight = height / 2;
		const capArcLength = (Math.PI / 2) * radius;
		const cylinderPartLength = height;
		const totalArcLength = 2 * capArcLength + cylinderPartLength;
		const numVerticalSegments = capSegments * 2 + heightSegments;
		const verticesPerRow = radialSegments + 1;

		// buffers (pre-sized)
		const vertexCount = (numVerticalSegments + 1) * verticesPerRow;
		const indices = allocIndex(numVerticalSegments * radialSegments * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, normals, and uvs
		for (let iy = 0; iy <= numVerticalSegments; iy++) {
			let currentArcLength = 0;
			let profileY = 0;
			let profileRadius = 0;
			let normalYComponent = 0;

			if (iy <= capSegments) {
				// bottom cap
				const segmentProgress = iy / capSegments;
				const angle = (segmentProgress * Math.PI) / 2;
				profileY = -halfHeight - radius * Math.cos(angle);
				profileRadius = radius * Math.sin(angle);
				normalYComponent = -radius * Math.cos(angle);
				currentArcLength = segmentProgress * capArcLength;
			} else if (iy <= capSegments + heightSegments) {
				// middle section
				const segmentProgress = (iy - capSegments) / heightSegments;
				profileY = -halfHeight + segmentProgress * height;
				profileRadius = radius;
				normalYComponent = 0;
				currentArcLength = capArcLength + segmentProgress * cylinderPartLength;
			} else {
				// top cap
				const segmentProgress = (iy - capSegments - heightSegments) / capSegments;
				const angle = (segmentProgress * Math.PI) / 2;
				profileY = halfHeight + radius * Math.sin(angle);
				profileRadius = radius * Math.cos(angle);
				normalYComponent = radius * Math.sin(angle);
				currentArcLength = capArcLength + cylinderPartLength + segmentProgress * capArcLength;
			}

			const v = Math.max(0, Math.min(1, currentArcLength / totalArcLength));

			// special case for the poles
			let uOffset = 0;
			if (iy === 0) {
				uOffset = 0.5 / radialSegments;
			} else if (iy === numVerticalSegments) {
				uOffset = -0.5 / radialSegments;
			}

			for (let ix = 0; ix <= radialSegments; ix++) {
				const u = ix / radialSegments;
				const theta = u * Math.PI * 2;
				const sinTheta = Math.sin(theta);
				const cosTheta = Math.cos(theta);

				// vertex
				const x = -profileRadius * cosTheta;
				const z = profileRadius * sinTheta;
				vertices[vOff] = x; vertices[vOff + 1] = profileY; vertices[vOff + 2] = z;

				// normal: normalize( x, normalYComponent, z )
				const inv = 1 / (Math.sqrt(x * x + normalYComponent * normalYComponent + z * z) || 1);
				normals[vOff] = x * inv; normals[vOff + 1] = normalYComponent * inv; normals[vOff + 2] = z * inv;
				vOff += 3;

				// uv
				uvs[uvOff++] = u + uOffset;
				uvs[uvOff++] = v;
			}

			if (iy > 0) {
				const prevIndexRow = (iy - 1) * verticesPerRow;
				const indexRow = iy * verticesPerRow;
				for (let ix = 0; ix < radialSegments; ix++) {
					const i1 = prevIndexRow + ix;
					const i2 = prevIndexRow + ix + 1;
					const i3 = indexRow + ix;
					const i4 = indexRow + ix + 1;

					indices[iOff++] = i1; indices[iOff++] = i2; indices[iOff++] = i3;
					indices[iOff++] = i2; indices[iOff++] = i4; indices[iOff++] = i3;
				}
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
		return new CapsuleGeometry(data.radius, data.height, data.capSegments, data.radialSegments, data.heightSegments);
	}
}

export { CapsuleGeometry };
