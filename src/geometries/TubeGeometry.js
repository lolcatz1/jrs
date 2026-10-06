import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import * as Curves from '../extras/curves/Curves.js';
import { Vector3 } from '../math/Vector3.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * Creates a tube that extrudes along a 3D curve. `path` may be any object exposing three.js's
 * Curve interface (`getPointAt( u, target )` and `computeFrenetFrames( segments, closed )`).
 * Output is identical to three.js's TubeGeometry.
 */
class TubeGeometry extends BufferGeometry {
	constructor(path = new Curves['QuadraticBezierCurve3'](new Vector3(-1, -1, 0), new Vector3(-1, 1, 0), new Vector3(1, 1, 0)), tubularSegments = 64, radius = 1, radialSegments = 8, closed = false) {
		super();
		this.type = 'TubeGeometry';
		this.parameters = {
			path: path,
			tubularSegments: tubularSegments,
			radius: radius,
			radialSegments: radialSegments,
			closed: closed
		};

		const frames = path.computeFrenetFrames(tubularSegments, closed);

		// expose internals
		this.tangents = frames.tangents;
		this.normals = frames.normals;
		this.binormals = frames.binormals;

		// helper variables
		let P = new Vector3();

		// buffers (pre-sized)
		const rowLength = radialSegments + 1;
		const vertexCount = (tubularSegments + 1) * rowLength;
		const indices = allocIndex(tubularSegments * radialSegments * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		let vOff = 0, uvOff = 0, iOff = 0;

		// create buffer data
		generateBufferData();

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));

		// functions

		function generateBufferData() {
			for (let i = 0; i < tubularSegments; i++) generateSegment(i);

			// if the geometry is not closed, generate the last row of vertices and normals
			// at the regular position on the given path
			//
			// if the geometry is closed, duplicate the first row of vertices and normals (uvs will differ)
			generateSegment((closed === false) ? tubularSegments : 0);

			// uvs are generated in a separate function.
			// this makes it easy compute correct values for closed geometries
			generateUVs();

			// finally create faces
			generateIndices();
		}

		function generateSegment(i) {
			// we use getPointAt to sample evenly distributed points from the given path
			P = path.getPointAt(i / tubularSegments, P);

			// retrieve corresponding normal and binormal
			const N = frames.normals[i];
			const B = frames.binormals[i];

			// generate normals and vertices for the current segment
			for (let j = 0; j <= radialSegments; j++) {
				const v = j / radialSegments * Math.PI * 2;

				const sin = Math.sin(v);
				const cos = -Math.cos(v);

				// normal
				let nx = (cos * N.x + sin * B.x);
				let ny = (cos * N.y + sin * B.y);
				let nz = (cos * N.z + sin * B.z);
				const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
				nx *= inv; ny *= inv; nz *= inv;
				normals[vOff] = nx; normals[vOff + 1] = ny; normals[vOff + 2] = nz;

				// vertex
				vertices[vOff] = P.x + radius * nx;
				vertices[vOff + 1] = P.y + radius * ny;
				vertices[vOff + 2] = P.z + radius * nz;
				vOff += 3;
			}
		}

		function generateIndices() {
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
		}

		function generateUVs() {
			for (let i = 0; i <= tubularSegments; i++) {
				const u = i / tubularSegments;
				for (let j = 0; j <= radialSegments; j++) {
					uvs[uvOff++] = u;
					uvs[uvOff++] = j / radialSegments;
				}
			}
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	toJSON() {
		const data = super.toJSON();
		data.path = this.parameters.path.toJSON();
		return data;
	}

	static fromJSON(data) {
		// This only works for built-in curves (e.g. CatmullRomCurve3).
		// User defined curves or instances of CurvePath will not be deserialized.
		return new TubeGeometry(
			new Curves[data.path.type]().fromJSON(data.path),
			data.tubularSegments,
			data.radius,
			data.radialSegments,
			data.closed
		);
	}
}

export { TubeGeometry };
