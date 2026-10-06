import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';

/**
 * A polyhedron is a solid in three dimensions with flat faces. This class takes an array of
 * vertices and an array of face indices, projects the (optionally subdivided) faces onto a
 * sphere of the given radius and produces a non-indexed geometry.
 * Output is identical to three.js's PolyhedronGeometry.
 */
class PolyhedronGeometry extends BufferGeometry {
	constructor(vertices = [], indices = [], radius = 1, detail = 0) {
		super();
		this.type = 'PolyhedronGeometry';
		this.parameters = {
			vertices: vertices,
			indices: indices,
			radius: radius,
			detail: detail
		};

		// each face is subdivided into cols^2 triangles
		const cols = detail + 1;
		const faceCount = Math.floor(indices.length / 3);
		const vertexCount = faceCount * cols * cols * 3;

		// double-precision working buffers (three.js keeps doubles until the final Float32 conversion)
		const vertexBuffer = new Float64Array(vertexCount * 3);
		const uvBuffer = new Float64Array(vertexCount * 2);
		let vOff = 0;

		// the subdivision creates the vertex buffer data
		subdivide(detail);

		// all vertices should lie on a conceptual sphere with a given radius
		applyRadius(radius);

		// finally, create the uv data
		generateUVs();

		// build non-indexed geometry
		this.setAttribute('position', new BufferAttribute(new Float32Array(vertexBuffer), 3));
		this.setAttribute('normal', new BufferAttribute(new Float32Array(vertexBuffer), 3));
		this.setAttribute('uv', new BufferAttribute(new Float32Array(uvBuffer), 2));

		if (detail === 0) {
			this.computeVertexNormals(); // flat normals
		} else {
			this.normalizeNormals(); // smooth normals
		}

		// helper functions

		function subdivide(detail) {
			// iterate over all faces and apply a subdivision with the given detail value
			for (let i = 0; i < indices.length; i += 3) {
				subdivideFace(indices[i + 0] * 3, indices[i + 1] * 3, indices[i + 2] * 3, detail);
			}
		}

		function subdivideFace(ia, ib, ic, detail) {
			const cols = detail + 1;

			const ax = vertices[ia], ay = vertices[ia + 1], az = vertices[ia + 2];
			const bx = vertices[ib], by = vertices[ib + 1], bz = vertices[ib + 2];
			const cx = vertices[ic], cy = vertices[ic + 1], cz = vertices[ic + 2];

			// we use this multidimensional array as a data structure for creating the subdivision
			const v = [];

			// construct all of the vertices for this subdivision
			for (let i = 0; i <= cols; i++) {
				const t = i / cols;

				// aj = a.lerp( c, t ), bj = b.lerp( c, t )  (Vector3.lerp: x += ( v.x - x ) * alpha)
				const ajx = ax + (cx - ax) * t, ajy = ay + (cy - ay) * t, ajz = az + (cz - az) * t;
				const bjx = bx + (cx - bx) * t, bjy = by + (cy - by) * t, bjz = bz + (cz - bz) * t;

				const rows = cols - i;
				const row = new Float64Array((rows + 1) * 3);

				for (let j = 0, o = 0; j <= rows; j++, o += 3) {
					if (j === 0 && i === cols) {
						row[o] = ajx; row[o + 1] = ajy; row[o + 2] = ajz;
					} else {
						const s = j / rows;
						row[o] = ajx + (bjx - ajx) * s;
						row[o + 1] = ajy + (bjy - ajy) * s;
						row[o + 2] = ajz + (bjz - ajz) * s;
					}
				}

				v[i] = row;
			}

			// construct all of the faces
			for (let i = 0; i < cols; i++) {
				const vi = v[i], vi1 = v[i + 1];
				for (let j = 0; j < 2 * (cols - i) - 1; j++) {
					const k = Math.floor(j / 2);

					if (j % 2 === 0) {
						pushVertex(vi, k + 1);
						pushVertex(vi1, k);
						pushVertex(vi, k);
					} else {
						pushVertex(vi, k + 1);
						pushVertex(vi1, k + 1);
						pushVertex(vi1, k);
					}
				}
			}
		}

		function applyRadius(radius) {
			// iterate over the entire buffer and apply the radius to each vertex
			for (let i = 0; i < vertexBuffer.length; i += 3) {
				const x = vertexBuffer[i + 0];
				const y = vertexBuffer[i + 1];
				const z = vertexBuffer[i + 2];

				// vertex.normalize().multiplyScalar( radius )
				const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
				vertexBuffer[i + 0] = x * inv * radius;
				vertexBuffer[i + 1] = y * inv * radius;
				vertexBuffer[i + 2] = z * inv * radius;
			}
		}

		function generateUVs() {
			for (let i = 0, j = 0; i < vertexBuffer.length; i += 3, j += 2) {
				const x = vertexBuffer[i + 0];
				const y = vertexBuffer[i + 1];
				const z = vertexBuffer[i + 2];

				const u = azimuth(x, z) / 2 / Math.PI + 0.5;
				const v = inclination(x, y, z) / Math.PI + 0.5;
				uvBuffer[j] = u;
				uvBuffer[j + 1] = 1 - v;
			}

			correctUVs();
			correctSeam();
		}

		function correctSeam() {
			// handle case when face straddles the seam, see three.js #3269
			for (let i = 0; i < uvBuffer.length; i += 6) {
				// uv data of a single face
				const x0 = uvBuffer[i + 0];
				const x1 = uvBuffer[i + 2];
				const x2 = uvBuffer[i + 4];

				const max = Math.max(x0, x1, x2);
				const min = Math.min(x0, x1, x2);

				// 0.9 is somewhat arbitrary
				if (max > 0.9 && min < 0.1) {
					if (x0 < 0.2) uvBuffer[i + 0] += 1;
					if (x1 < 0.2) uvBuffer[i + 2] += 1;
					if (x2 < 0.2) uvBuffer[i + 4] += 1;
				}
			}
		}

		function pushVertex(row, k) {
			const o = k * 3;
			vertexBuffer[vOff++] = row[o];
			vertexBuffer[vOff++] = row[o + 1];
			vertexBuffer[vOff++] = row[o + 2];
		}

		function correctUVs() {
			for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
				const ax = vertexBuffer[i + 0], ay = vertexBuffer[i + 1], az = vertexBuffer[i + 2];
				const bx = vertexBuffer[i + 3], by = vertexBuffer[i + 4], bz = vertexBuffer[i + 5];
				const cx = vertexBuffer[i + 6], cy = vertexBuffer[i + 7], cz = vertexBuffer[i + 8];

				// centroid = ( a + b + c ) / 3  (Vector3.divideScalar: multiply by 1 / 3)
				const third = 1 / 3;
				const centroidX = (ax + bx + cx) * third;
				const centroidZ = (az + bz + cz) * third;

				const azi = azimuth(centroidX, centroidZ);

				correctUV(uvBuffer[j + 0], j + 0, ax, az, azi);
				correctUV(uvBuffer[j + 2], j + 2, bx, bz, azi);
				correctUV(uvBuffer[j + 4], j + 4, cx, cz, azi);
			}
		}

		function correctUV(uvX, stride, vx, vz, azimuth) {
			if ((azimuth < 0) && (uvX === 1)) {
				uvBuffer[stride] = uvX - 1;
			}

			if ((vx === 0) && (vz === 0)) {
				uvBuffer[stride] = azimuth / 2 / Math.PI + 0.5;
			}
		}

		// Angle around the Y axis, counter-clockwise when looking from above.
		function azimuth(x, z) {
			return Math.atan2(z, -x);
		}

		// Angle above the XZ plane.
		function inclination(x, y, z) {
			return Math.atan2(-y, Math.sqrt((x * x) + (z * z)));
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new PolyhedronGeometry(data.vertices, data.indices, data.radius, data.detail);
	}
}

export { PolyhedronGeometry };
