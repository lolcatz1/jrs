import { BufferGeometry } from '../core/BufferGeometry.js';
import { BufferAttribute } from '../core/BufferAttribute.js';
import { allocIndex, indexAttribute } from './internal.js';

/**
 * A geometry class for a rectangular cuboid with a given width, height, and depth.
 * On creation, the cuboid is centred on the origin, with each edge parallel to one of the axes.
 * Output (vertex order, normals, uvs, index, groups) is identical to three.js's BoxGeometry.
 */
class BoxGeometry extends BufferGeometry {
	constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
		super();
		this.type = 'BoxGeometry';
		this.parameters = {
			width: width,
			height: height,
			depth: depth,
			widthSegments: widthSegments,
			heightSegments: heightSegments,
			depthSegments: depthSegments
		};

		const scope = this;

		// segments
		widthSegments = Math.floor(widthSegments);
		heightSegments = Math.floor(heightSegments);
		depthSegments = Math.floor(depthSegments);

		// buffers (pre-sized)
		const ws = widthSegments, hs = heightSegments, ds = depthSegments;
		const vertexCount = 2 * ((ds + 1) * (hs + 1) + (ws + 1) * (ds + 1) + (ws + 1) * (hs + 1));
		const indexCount = 12 * (ds * hs + ws * ds + ws * hs);
		const indices = allocIndex(indexCount, vertexCount);
		const vertices = new Float32Array(vertexCount * 3);
		const normals = new Float32Array(vertexCount * 3);
		const uvs = new Float32Array(vertexCount * 2);

		// helper variables
		let numberOfVertices = 0;
		let groupStart = 0;
		let vOff = 0, uvOff = 0, iOff = 0;

		// build each side of the box geometry (u, v, w are component offsets: 0 = x, 1 = y, 2 = z)
		buildPlane(2, 1, 0, -1, -1, depth, height, width, depthSegments, heightSegments, 0); // px
		buildPlane(2, 1, 0, 1, -1, depth, height, -width, depthSegments, heightSegments, 1); // nx
		buildPlane(0, 2, 1, 1, 1, width, depth, height, widthSegments, depthSegments, 2); // py
		buildPlane(0, 2, 1, 1, -1, width, depth, -height, widthSegments, depthSegments, 3); // ny
		buildPlane(0, 1, 2, 1, -1, width, height, depth, widthSegments, heightSegments, 4); // pz
		buildPlane(0, 1, 2, -1, -1, width, height, -depth, widthSegments, heightSegments, 5); // nz

		// build geometry
		this.setIndex(indexAttribute(indices));
		this.setAttribute('position', new BufferAttribute(vertices, 3));
		this.setAttribute('normal', new BufferAttribute(normals, 3));
		this.setAttribute('uv', new BufferAttribute(uvs, 2));

		function buildPlane(u, v, w, udir, vdir, width, height, depth, gridX, gridY, materialIndex) {
			const segmentWidth = width / gridX;
			const segmentHeight = height / gridY;

			const widthHalf = width / 2;
			const heightHalf = height / 2;
			const depthHalf = depth / 2;

			const gridX1 = gridX + 1;
			const gridY1 = gridY + 1;

			const nw = depth > 0 ? 1 : -1;

			// generate vertices, normals and uvs
			for (let iy = 0; iy < gridY1; iy++) {
				const y = iy * segmentHeight - heightHalf;
				for (let ix = 0; ix < gridX1; ix++) {
					const x = ix * segmentWidth - widthHalf;

					vertices[vOff + u] = x * udir;
					vertices[vOff + v] = y * vdir;
					vertices[vOff + w] = depthHalf;

					// normals: the u and v components stay at their zero initialisation
					normals[vOff + w] = nw;
					vOff += 3;

					uvs[uvOff++] = ix / gridX;
					uvs[uvOff++] = 1 - (iy / gridY);
				}
			}

			// indices: two triangles (six indices) per segment
			for (let iy = 0; iy < gridY; iy++) {
				for (let ix = 0; ix < gridX; ix++) {
					const a = numberOfVertices + ix + gridX1 * iy;
					const b = numberOfVertices + ix + gridX1 * (iy + 1);
					const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
					const d = numberOfVertices + (ix + 1) + gridX1 * iy;

					indices[iOff++] = a; indices[iOff++] = b; indices[iOff++] = d;
					indices[iOff++] = b; indices[iOff++] = c; indices[iOff++] = d;
				}
			}

			const groupCount = gridX * gridY * 6;

			// add a group to the geometry. this will ensure multi material support
			scope.addGroup(groupStart, groupCount, materialIndex);
			groupStart += groupCount;
			numberOfVertices += gridX1 * gridY1;
		}
	}

	copy(source) {
		super.copy(source);
		this.parameters = Object.assign({}, source.parameters);
		return this;
	}

	static fromJSON(data) {
		return new BoxGeometry(data.width, data.height, data.depth, data.widthSegments, data.heightSegments, data.depthSegments);
	}
}

export { BoxGeometry };
