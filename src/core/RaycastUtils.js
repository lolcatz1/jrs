/**
 * Allocation-free world-space bounding-sphere rejection shared by the raycast() methods.
 *
 * Replays, with scalars, exactly what three.js does in Mesh/Points/Line.raycast():
 *   sphere.copy(geometry.boundingSphere).applyMatrix4(matrixWorld); sphere.radius += pad;
 *   ray.intersectsSphere(sphere)
 * so it accepts and rejects precisely the same objects, but without Sphere/Vector3 method calls.
 * It reads the world matrix straight out of the transform slab (`m` = slab page, `mo` = offset),
 * so it is always current (no cache that could go stale when matrixWorld is edited directly).
 *
 * `prune` additionally skips objects that lie entirely outside [near, far]: every point of the
 * mesh is within `R` of the world-space sphere centre, so its hit distance is at least |c - o| - R
 * and at most |c - o| + R. A relative margin keeps float rounding from ever rejecting a real hit.
 */
export function rayMissesWorldSphere(ray, near, far, m, mo, bs, pad, prune) {
	const c = bs.center, cx = c.x, cy = c.y, cz = c.z;
	const e0 = m[mo], e1 = m[mo + 1], e2 = m[mo + 2], e4 = m[mo + 4], e5 = m[mo + 5], e6 = m[mo + 6], e8 = m[mo + 8], e9 = m[mo + 9], e10 = m[mo + 10];
	let px = e0 * cx + e4 * cy + e8 * cz + m[mo + 12];
	let py = e1 * cx + e5 * cy + e9 * cz + m[mo + 13];
	let pz = e2 * cx + m[mo + 6] * cy + e10 * cz + m[mo + 14];
	// affine matrices (the normal case) have w == 1 exactly, so skip the division
	if (m[mo + 3] !== 0 || m[mo + 7] !== 0 || m[mo + 11] !== 0 || m[mo + 15] !== 1) {
		const w = 1 / (m[mo + 3] * cx + m[mo + 7] * cy + m[mo + 11] * cz + m[mo + 15]);
		px *= w; py *= w; pz *= w;
	}
	const sx = e0 * e0 + e1 * e1 + e2 * e2, sy = e4 * e4 + e5 * e5 + e6 * e6, sz = e8 * e8 + e9 * e9 + e10 * e10;
	const sMax = sx > sy ? (sx > sz ? sx : sz) : (sy > sz ? sy : sz);

	const o = ray.origin, d = ray.direction;
	const ox = o.x, oy = o.y, oz = o.z, dx = d.x, dy = d.y, dz = d.z;
	const vx = px - ox, vy = py - oy, vz = pz - oz;
	// closest point on the ray to the centre; clamping dd at 0 is the same as three.js's
	// "behind the origin" branch (origin + d*0 == origin) without the unpredictable jump
	const dd = vx * dx + vy * dy + vz * dz;
	const t = dd > 0 ? dd : 0;
	const ax = (ox + dx * t) - px, ay = (oy + dy * t) - py, az = (oz + dz * t) - pz;
	const d2 = ax * ax + ay * ay + az * az;

	// Cheap decisive tests first (skip the sqrt); only a ray within 1e-9 of the sphere surface
	// falls through to the exact comparison three.js makes.
	const rr = bs.radius;
	let radius;
	if (pad === 0) {
		const approx = rr * rr * sMax;
		if (d2 > approx * (1 + 1e-9)) return true;
		radius = rr * Math.sqrt(sMax);
	} else radius = rr * Math.sqrt(sMax) + pad;
	if (radius < 0) return true;
	if (!(d2 <= radius * radius)) return true;

	if (prune === true && (far !== Infinity || near > 0)) {
		const dist = Math.sqrt(vx * vx + vy * vy + vz * vz);
		const margin = 1e-4 * (1 + dist + radius);
		if (dist - radius - margin > far || dist + radius + margin < near) return true;
	}
	return false;
}
