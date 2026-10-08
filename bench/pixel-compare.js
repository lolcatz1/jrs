// Pixel comparison shared by the fuzzer (and identical to the inline version in bench/index.html's
// compareScenario): a, b are RGBA Uint8Arrays of the same width x height.
export function comparePixels(a, b, width, height) {
	let sum = 0, maxd = 0, bad = 0, differing = 0, overMax = 0;
	const samples = [];
	for (let i = 0; i < a.length; i += 4) {
		const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
		sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
		if (d > maxd) maxd = d; if (d > 32) bad++; if (d > TOLERANCE.maxDiff) overMax++;
		if (d > 0) { differing++; if (samples.length < 6 && d > 8) samples.push({ x: (i / 4) % width, y: height - 1 - Math.floor(i / 4 / width), a: [a[i], a[i + 1], a[i + 2]], b: [b[i], b[i + 1], b[i + 2]] }); }
	}
	const count = a.length * 3 / 4;
	return { meanAbsDiff: +(sum / count).toFixed(3), maxDiff: maxd, fractionOver32: +(bad / count).toFixed(4), pixelsOverMax: overMax, differingPixels: differing, samples };
}

// Tolerances used by bench/results/latest.json's pixel comparison rows. `badPixels` is the number of
// pixels that may exceed maxDiff before the frame fails: jrs computes vertex positions in a different
// (float32) order than three.js, so an object edge occasionally lands one pixel over; those isolated
// edge pixels are not a rendering difference. --strict sets it to 0.
export const TOLERANCE = { maxDiff: 33, meanAbsDiff: 0.4, badPixels: 8 };
export function withinTolerance(r, tol = TOLERANCE) {
	if (r.meanAbsDiff > tol.meanAbsDiff) return false;
	if (r.maxDiff > tol.maxDiff && r.pixelsOverMax > (tol.badPixels || 0)) return false;
	return true;
}
