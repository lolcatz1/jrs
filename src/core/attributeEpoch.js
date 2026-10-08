/**
 * Bumped by every `BufferAttribute.needsUpdate = true`. The renderer's VAO validation compares it with
 * the value seen at the last validation and skips the per-attribute version sum while it is unchanged.
 * Internal: deliberately not re-exported from index.js.
 */
export const attributeEpoch = { value: 0 };
