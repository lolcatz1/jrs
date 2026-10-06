import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A geometry class for representing a (possibly truncated, possibly open-ended) cylinder.
 * Output is identical to three.js's CylinderGeometry, including its three material groups.
 */
class CylinderGeometry extends BufferGeometry {
	constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
		super();
		this.type = 'CylinderGeometry';
		this.parameters = {
			radiusTop: radiusTop,
			radiusBottom: radiusBottom,
			height: height,
			radialSegments: radialSegments,
			heightSegments: heightSegments,
			openEnded: openEnded,
			thetaStart: thetaStart,
			thetaLength: thetaLength
		};

		const scope = this;

		radialSegments = Math.floor(radialSegments);
		heightSegments = Math.floor(heightSegments);

		// sizes
		const rowLength = radialSegments + 1;
		const hasTopCap = openEnded === false && radiusTop > 0;
		const hasBottomCap = openEnded === false && radiusBottom > 0;
		const capVertexCount = radialSegments + rowLength;
		const vertexCount = (heightSegments + 1) * rowLength + (hasTopCap ? capVertexCount : 0) + (hasBottomCap ? capVertexCount : 0);
		const torsoIndexCount = radialSegments * heightSegments * 6 - (radiusTop > 0 ? 0 : radialSegments * 3) - (radiusBottom > 0 ? 0 : radialSegments * 3);
		const indexCount = torsoIndexCount + (hasTopCap ? radialSegments * 3 : 0) + (hasBottomCap ? radialSegments * 3 : 0);

		// buffers (pre-sized)
		const indices = allocIndex(indexCount, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		// helper variables
		let index = 0;
		let vOff = 0, uvOff = 0, iOff = 0;
		const halfHeight = height / 2;
		let groupStart = 0;

		// generate geometry
		generateTorso();

		if (hasTopCap) generateCap(true);
		if (hasBottomCap) generateCap(false);

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));

		function generateTorso() {
			let groupCount = 0;

			// this will be used to calculate the normal
			const slope = (radiusBottom - radiusTop) / height;

			// generate vertices, normals and uvs
			for (let y = 0; y <= heightSegments; y++) {
				const v = y / heightSegments;

				// calculate the radius of the current row
				const radius = v * (radiusBottom - radiusTop) + radiusTop;
				const vy = -v * height + halfHeight;

				for (let x = 0; x <= radialSegments; x++) {
					const u = x / radialSegments;
					const theta = u * thetaLength + thetaStart;

					const sinTheta = Math.sin(theta);
					const cosTheta = Math.cos(theta);

					// vertex
					vertices[vOff] = radius * sinTheta;
					vertices[vOff + 1] = vy;
					vertices[vOff + 2] = radius * cosTheta;

					// normal: normalize( sinTheta, slope, cosTheta )
					const inv = 1 / (Math.sqrt(sinTheta * sinTheta + slope * slope + cosTheta * cosTheta) || 1);
					normals[vOff] = sinTheta * inv;
					normals[vOff + 1] = slope * inv;
					normals[vOff + 2] = cosTheta * inv;
					vOff += 3;

					// uv
					uvs[uvOff++] = u;
					uvs[uvOff++] = 1 - v;

					index++;
				}
			}

			// generate indices (row-major vertex layout: indexArray[ y ][ x ] === y * rowLength + x)
			for (let x = 0; x < radialSegments; x++) {
				for (let y = 0; y < heightSegments; y++) {
					const a = y * rowLength + x;
					const b = a + rowLength;
					const c = b + 1;
					const d = a + 1;

					if (radiusTop > 0 || y !== 0) {
						indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
						groupCount += 3;
					}

					if (radiusBottom > 0 || y !== heightSegments - 1) {
						indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d;
						groupCount += 3;
					}
				}
			}

			// add a group to the geometry. this will ensure multi material support
			scope.addGroup(groupStart, groupCount, 0);
			groupStart += groupCount;
		}

		function generateCap(top) {
			// save the index of the first center vertex
			const centerIndexStart = index;

			const radius = (top === true) ? radiusTop : radiusBottom;
			const sign = (top === true) ? 1 : -1;
			const cy = halfHeight * sign;

			// first we generate the center vertex data of the cap.
			// because the geometry needs one set of uvs per face,
			// we must generate a center vertex per face/segment
			for (let x = 1; x <= radialSegments; x++) {
				vertices[vOff + 1] = cy; // (0, halfHeight * sign, 0)
				normals[vOff + 1] = sign; // (0, sign, 0)
				vOff += 3;
				uvs[uvOff++] = 0.5; uvs[uvOff++] = 0.5;
				index++;
			}

			// save the index of the last center vertex
			const centerIndexEnd = index;

			// now we generate the surrounding vertices, normals and uvs
			for (let x = 0; x <= radialSegments; x++) {
				const u = x / radialSegments;
				const theta = u * thetaLength + thetaStart;

				const cosTheta = Math.cos(theta);
				const sinTheta = Math.sin(theta);

				// vertex
				vertices[vOff] = radius * sinTheta;
				vertices[vOff + 1] = cy;
				vertices[vOff + 2] = radius * cosTheta;

				// normal
				normals[vOff + 1] = sign;
				vOff += 3;

				// uv
				uvs[uvOff++] = (cosTheta * 0.5) + 0.5;
				uvs[uvOff++] = (sinTheta * 0.5 * sign) + 0.5;

				index++;
			}

			// generate indices
			for (let x = 0; x < radialSegments; x++) {
				const c = centerIndexStart + x;
				const i = centerIndexEnd + x;

				if (top === true) {
					indices[iOff++] = i; indices[iOff++] = i + 1; indices[iOff++] = c;
				} else {
					indices[iOff++] = i + 1; indices[iOff++] = i; indices[iOff++] = c;
				}
			}

			const groupCount = radialSegments * 3;

			// add a group to the geometry. this will ensure multi material support
			scope.addGroup(groupStart, groupCount, top === true ? 1 : 2);
			groupStart += groupCount;
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new CylinderGeometry(data.radiusTop, data.radiusBottom, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength);
	}
}

export { CylinderGeometry };
