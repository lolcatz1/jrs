import { BufferAttribute } from '../core/BufferAttribute.js';

/**
 * Allocates a pre-sized index array able to address `vertexCount` vertices.
 * Mirrors three.js's `setIndex( array )` type selection (Uint32 once any index may reach 65535).
 */
export function allocIndex(indexCount, vertexCount) {
	return vertexCount - 1 >= 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
}

/**
 * Wraps a filled index array in a BufferAttribute. A Uint32Array whose values never reach 65535
 * is downcast to Uint16 so the result is identical to what three.js's `setIndex( array )` produces.
 */
export function indexAttribute(indices) {
	if (indices instanceof Uint32Array) {
		let needsUint32 = false;
		for (let i = indices.length - 1; i >= 0; --i) if (indices[i] >= 65535) { needsUint32 = true; break; }
		if (needsUint32 === false) indices = new Uint16Array(indices);
	}
	return new BufferAttribute(indices, 1);
}

/** Number of iterations of `for ( let i = 0; i <= n; i ++ )`. */
export function countInclusive(n) { return n >= 0 ? Math.floor(n) + 1 : 0; }

/** Number of iterations of `for ( let i = 0; i < n; i ++ )`. */
export function countExclusive(n) { return n > 0 ? Math.ceil(n) : 0; }
