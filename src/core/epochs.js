/**
 * Global change counters the renderer uses to prove that nothing relevant to a cached render list changed.
 *
 * `structure` is bumped when the scene graph's shape or any property that decides what gets drawn changes:
 * add / remove / attach, `visible`, `renderOrder`, `frustumCulled`, `receiveShadow`, `layers.mask`, a mesh's
 * `geometry` / `material`, and the first assignment of an `onBeforeRender` / `onAfterRender` hook.
 * `world` is bumped whenever a (non-camera) object's world matrix is recomputed.
 *
 * The counters are global rather than per scene: any change anywhere invalidates every cached list, which is
 * conservative but never stale, and a static scene (the case that benefits) never touches them.
 */
const epochs = { structure: 0, world: 0 };

/** Defines `name` on `proto` as an accessor over `_name` that bumps `epochs.structure` when the value changes. */
function trackRenderProperty(proto, name) {
	const key = '_' + name;
	Object.defineProperty(proto, name, {
		configurable: true, enumerable: true,
		get() { return this[key]; },
		set(value) { if (value !== this[key]) { this[key] = value; epochs.structure++; } },
	});
}

export { epochs, trackRenderProperty };
