import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A geometry class for representing a plane in the XY plane facing +Z.
 * Output is identical to three.js's PlaneGeometry.
 */
class PlaneGeometry extends BufferGeometry {
	constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
		super();
		this.type = 'PlaneGeometry';
		this.parameters = {
			width: width,
			height: height,
			widthSegments: widthSegments,
			heightSegments: heightSegments
		};

		const width_half = width / 2;
		const height_half = height / 2;

		const gridX = Math.floor(widthSegments);
		const gridY = Math.floor(heightSegments);

		const gridX1 = gridX + 1;
		const gridY1 = gridY + 1;

		const segment_width = width / gridX;
		const segment_height = height / gridY;

		const vertexCount = gridX1 * gridY1;
		const indices = allocIndex(gridX * gridY * 6, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		let vOff = 0, uvOff = 0, iOff = 0;

		for (let iy = 0; iy < gridY1; iy++) {
			const y = iy * segment_height - height_half;
			for (let ix = 0; ix < gridX1; ix++) {
				const x = ix * segment_width - width_half;

				vertices[vOff] = x; vertices[vOff + 1] = -y; // z stays 0
				normals[vOff + 2] = 1; // (0, 0, 1)
				vOff += 3;

				uvs[uvOff++] = ix / gridX;
				uvs[uvOff++] = 1 - (iy / gridY);
			}
		}

		for (let iy = 0; iy < gridY; iy++) {
			for (let ix = 0; ix < gridX; ix++) {
				const a = ix + gridX1 * iy;
				const b = ix + gridX1 * (iy + 1);
				const c = (ix + 1) + gridX1 * (iy + 1);
				const d = (ix + 1) + gridX1 * iy;

				indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
				indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d;
			}
		}

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
		return new PlaneGeometry(data.width, data.height, data.widthSegments, data.heightSegments);
	}
}

export { PlaneGeometry };
