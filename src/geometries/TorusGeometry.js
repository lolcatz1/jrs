import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A geometry class for representing a torus. Output is identical to three.js's TorusGeometry.
 */
class TorusGeometry extends BufferGeometry {
	constructor(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI * 2) {
		super();
		this.type = 'TorusGeometry';
		this.parameters = {
			radius: radius,
			tube: tube,
			radialSegments: radialSegments,
			tubularSegments: tubularSegments,
			arc: arc,
			thetaStart: thetaStart,
			thetaLength: thetaLength,
		};

		radialSegments = Math.floor(radialSegments);
		tubularSegments = Math.floor(tubularSegments);

		// buffers (pre-sized)
		const rowLength = tubularSegments + 1;
		const vertexCount = (radialSegments + 1) * rowLength;
		const indices = allocIndex(radialSegments * tubularSegments * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, normals and uvs
		for (let j = 0; j <= radialSegments; j++) {
			const v = thetaStart + (j / radialSegments) * thetaLength;
			const cosV = Math.cos(v);
			const z = tube * Math.sin(v);
			const uvY = j / radialSegments;

			for (let i = 0; i <= tubularSegments; i++) {
				const u = i / tubularSegments * arc;
				const cosU = Math.cos(u);
				const sinU = Math.sin(u);

				// vertex
				const x = (radius + tube * cosV) * cosU;
				const y = (radius + tube * cosV) * sinU;
				vertices[vOff] = x; vertices[vOff + 1] = y; vertices[vOff + 2] = z;

				// normal: normalize( vertex - center ), center = ( radius * cos u, radius * sin u, 0 )
				const nx = x - radius * cosU;
				const ny = y - radius * sinU;
				const nz = z - 0;
				const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
				normals[vOff] = nx * inv; normals[vOff + 1] = ny * inv; normals[vOff + 2] = nz * inv;
				vOff += 3;

				// uv
				uvs[uvOff++] = i / tubularSegments;
				uvs[uvOff++] = uvY;
			}
		}

		// generate indices
		for (let j = 1; j <= radialSegments; j++) {
			for (let i = 1; i <= tubularSegments; i++) {
				const a = rowLength * j + i - 1;
				const b = rowLength * (j - 1) + i - 1;
				const c = rowLength * (j - 1) + i;
				const d = rowLength * j + i;

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
		return new TorusGeometry(data.radius, data.tube, data.radialSegments, data.tubularSegments, data.arc, data.thetaStart, data.thetaLength);
	}
}

export { TorusGeometry };
