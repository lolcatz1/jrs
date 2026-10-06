import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A class for generating a UV sphere geometry. Output is identical to three.js's SphereGeometry.
 */
class SphereGeometry extends BufferGeometry {
	constructor(radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
		super();
		this.type = 'SphereGeometry';
		this.parameters = {
			radius: radius,
			widthSegments: widthSegments,
			heightSegments: heightSegments,
			phiStart: phiStart,
			phiLength: phiLength,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		widthSegments = Math.max(3, Math.floor(widthSegments));
		heightSegments = Math.max(2, Math.floor(heightSegments));

		const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);

		// buffers (pre-sized)
		const rowLength = widthSegments + 1;
		const vertexCount = (heightSegments + 1) * rowLength;
		const topTriangles = thetaStart > 0; // whether the first ring row emits its upper triangle
		const bottomTriangles = thetaEnd < Math.PI; // whether the last ring row emits its lower triangle
		const indexCount = heightSegments * widthSegments * 6 - (topTriangles ? 0 : widthSegments * 3) - (bottomTriangles ? 0 : widthSegments * 3);
		const indices = allocIndex(indexCount, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, normals and uvs
		for (let iy = 0; iy <= heightSegments; iy++) {
			const v = iy / heightSegments;
			const theta = thetaStart + v * thetaLength;

			const y = radius * Math.cos(theta);
			const ringRadius = Math.sqrt(radius * radius - y * y);

			// special case for the poles
			let uOffset = 0;
			if (iy === 0 && thetaStart === 0) {
				uOffset = 0.5 / widthSegments;
			} else if (iy === heightSegments && thetaEnd === Math.PI) {
				uOffset = -0.5 / widthSegments;
			}

			for (let ix = 0; ix <= widthSegments; ix++) {
				const u = ix / widthSegments;
				const phi = phiStart + u * phiLength;

				// vertex
				const x = -ringRadius * Math.cos(phi);
				const z = ringRadius * Math.sin(phi);
				vertices[vOff] = x; vertices[vOff + 1] = y; vertices[vOff + 2] = z;

				// normal (same operation order as Vector3.normalize)
				const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
				normals[vOff] = x * inv; normals[vOff + 1] = y * inv; normals[vOff + 2] = z * inv;
				vOff += 3;

				// uv
				uvs[uvOff++] = u + uOffset;
				uvs[uvOff++] = 1 - v;
			}
		}

		// indices
		for (let iy = 0; iy < heightSegments; iy++) {
			const row = iy * rowLength;
			const nextRow = row + rowLength;
			const upper = iy !== 0 || topTriangles;
			const lower = iy !== heightSegments - 1 || bottomTriangles;
			for (let ix = 0; ix < widthSegments; ix++) {
				const a = row + ix + 1;
				const b = row + ix;
				const c = nextRow + ix;
				const d = nextRow + ix + 1;

				if (upper) { indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d; }
				if (lower) { indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d; }
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
		return new SphereGeometry(data.radius, data.widthSegments, data.heightSegments, data.phiStart, data.phiLength, data.thetaStart, data.thetaLength);
	}
}

export { SphereGeometry };
