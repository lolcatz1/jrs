import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { Vector3 } from '../math/Vector3.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * Creates a torus knot, the particular shape of which is defined by a pair of coprime integers p and q.
 * Output is identical to three.js's TorusKnotGeometry.
 */
class TorusKnotGeometry extends BufferGeometry {
	constructor(radius = 1, tube = 0.4, tubularSegments = 64, radialSegments = 8, p = 2, q = 3) {
		super();
		this.type = 'TorusKnotGeometry';
		this.parameters = {
			radius: radius,
			tube: tube,
			tubularSegments: tubularSegments,
			radialSegments: radialSegments,
			p: p,
			q: q
		};

		tubularSegments = Math.floor(tubularSegments);
		radialSegments = Math.floor(radialSegments);

		// buffers (pre-sized)
		const rowLength = radialSegments + 1;
		const vertexCount = (tubularSegments + 1) * rowLength;
		const indices = allocIndex(tubularSegments * radialSegments * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		// helper variables
		const P1 = new Vector3();
		const P2 = new Vector3();
		const B = new Vector3();
		const T = new Vector3();
		const N = new Vector3();

		let vOff = 0, uvOff = 0, iOff = 0;

		// generate vertices, normals and uvs
		for (let i = 0; i <= tubularSegments; ++i) {
			// the radian "u" is used to calculate the position on the torus curve of the current tubular segment
			const u = i / tubularSegments * p * Math.PI * 2;

			// P1 is our current position on the curve, P2 is a little farther ahead.
			calculatePositionOnCurve(u, p, q, radius, P1);
			calculatePositionOnCurve(u + 0.01, p, q, radius, P2);

			// calculate orthonormal basis
			T.subVectors(P2, P1);
			N.addVectors(P2, P1);
			B.crossVectors(T, N);
			N.crossVectors(B, T);

			// normalize B, N. T can be ignored, we don't use it
			B.normalize();
			N.normalize();

			const uvX = i / tubularSegments;

			for (let j = 0; j <= radialSegments; ++j) {
				// extrude a circle in the (N, B) plane
				const v = j / radialSegments * Math.PI * 2;
				const cx = -tube * Math.cos(v);
				const cy = tube * Math.sin(v);

				// vertex
				const x = P1.x + (cx * N.x + cy * B.x);
				const y = P1.y + (cx * N.y + cy * B.y);
				const z = P1.z + (cx * N.z + cy * B.z);
				vertices[vOff] = x; vertices[vOff + 1] = y; vertices[vOff + 2] = z;

				// normal (P1 is always the center/origin of the extrusion)
				const nx = x - P1.x, ny = y - P1.y, nz = z - P1.z;
				const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
				normals[vOff] = nx * inv; normals[vOff + 1] = ny * inv; normals[vOff + 2] = nz * inv;
				vOff += 3;

				// uv
				uvs[uvOff++] = uvX;
				uvs[uvOff++] = j / radialSegments;
			}
		}

		// generate indices
		for (let j = 1; j <= tubularSegments; j++) {
			for (let i = 1; i <= radialSegments; i++) {
				const a = rowLength * (j - 1) + (i - 1);
				const b = rowLength * j + (i - 1);
				const c = rowLength * j + i;
				const d = rowLength * (j - 1) + i;

				indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
				indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d;
			}
		}

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));

		// this function calculates the current position on the torus curve
		function calculatePositionOnCurve(u, p, q, radius, position) {
			const cu = Math.cos(u);
			const su = Math.sin(u);
			const quOverP = q / p * u;
			const cs = Math.cos(quOverP);

			position.x = radius * (2 + cs) * 0.5 * cu;
			position.y = radius * (2 + cs) * su * 0.5;
			position.z = radius * Math.sin(quOverP) * 0.5;
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new TorusKnotGeometry(data.radius, data.tube, data.tubularSegments, data.radialSegments, data.p, data.q);
	}
}

export { TorusKnotGeometry };
