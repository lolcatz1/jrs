import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { Vector2 } from '../math/Vector2.js';
import { clamp } from '../math/MathUtils.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * Creates meshes with axial symmetry like vases by rotating a 2D profile around the Y axis.
 * Output is identical to three.js's LatheGeometry.
 */
class LatheGeometry extends BufferGeometry {
	constructor(points = [new Vector2(0, -0.5), new Vector2(0.5, 0), new Vector2(0, 0.5)], segments = 12, phiStart = 0, phiLength = Math.PI * 2) {
		super();
		this.type = 'LatheGeometry';
		this.parameters = {
			points: points,
			segments: segments,
			phiStart: phiStart,
			phiLength: phiLength
		};

		segments = Math.floor(segments);

		// clamp phiLength so it's in range of [ 0, 2PI ]
		phiLength = clamp(phiLength, 0, Math.PI * 2);

		const pointCount = points.length;

		// buffers (pre-sized)
		const vertexCount = (segments + 1) * pointCount;
		const indices = allocIndex(segments * (pointCount - 1) * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);
		const initNormals = new Float64Array(pointCount * 3);
		const normals = new Float32Array(vertexCount * 3);

		// helper variables
		const inverseSegments = 1.0 / segments;

		let dx = 0;
		let dy = 0;
		let prevX = 0, prevY = 0, prevZ = 0; // prevNormal
		const last = pointCount - 1;

		// pre-compute normals for initial "meridian"
		for (let j = 0; j <= last; j++) {
			if (j === 0) {
				// special handling for 1st vertex on path
				dx = points[j + 1].x - points[j].x;
				dy = points[j + 1].y - points[j].y;

				const nx = dy * 1.0, ny = -dx, nz = dy * 0.0;
				prevX = nx; prevY = ny; prevZ = nz;

				const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
				initNormals[0] = nx * inv; initNormals[1] = ny * inv; initNormals[2] = nz * inv;
			} else if (j === last) {
				// special handling for last Vertex on path
				initNormals[3 * j] = prevX; initNormals[3 * j + 1] = prevY; initNormals[3 * j + 2] = prevZ;
			} else {
				// default handling for all vertices in between
				dx = points[j + 1].x - points[j].x;
				dy = points[j + 1].y - points[j].y;

				const curX = dy * 1.0, curY = -dx, curZ = dy * 0.0;
				let nx = curX, ny = curY, nz = curZ;
				nx += prevX; ny += prevY; nz += prevZ;

				const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
				initNormals[3 * j] = nx * inv; initNormals[3 * j + 1] = ny * inv; initNormals[3 * j + 2] = nz * inv;

				prevX = curX; prevY = curY; prevZ = curZ;
			}
		}

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, uvs and normals
		for (let i = 0; i <= segments; i++) {
			const phi = phiStart + i * inverseSegments * phiLength;

			const sin = Math.sin(phi);
			const cos = Math.cos(phi);
			const uvX = i / segments;

			for (let j = 0; j <= last; j++) {
				const point = points[j];

				// vertex
				vertices[vOff] = point.x * sin;
				vertices[vOff + 1] = point.y;
				vertices[vOff + 2] = point.x * cos;

				// uv
				uvs[uvOff++] = uvX;
				uvs[uvOff++] = j / last;

				// normal
				const n0 = initNormals[3 * j + 0];
				normals[vOff] = n0 * sin;
				normals[vOff + 1] = initNormals[3 * j + 1];
				normals[vOff + 2] = n0 * cos;
				vOff += 3;
			}
		}

		// indices
		for (let i = 0; i < segments; i++) {
			for (let j = 0; j < last; j++) {
				const base = j + i * pointCount;

				const a = base;
				const b = base + pointCount;
				const c = base + pointCount + 1;
				const d = base + 1;

				indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
				indices[iOff++] = c; indices[iOff++] = d; indices[iOff++] = b;
			}
		}

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new LatheGeometry(data.points, data.segments, data.phiStart, data.phiLength);
	}
}

export { LatheGeometry };
