// One scripted sequence of dynamic-geometry operations; `T` is either library. Returns, per step, the
// rendered pixels and the observable attribute state so the two libraries can be compared.
const SIZE = 128;

export function runGeometryUpdateCase(T) {
	const canvas = document.createElement('canvas');
	canvas.width = SIZE; canvas.height = SIZE;
	document.body.appendChild(canvas);
	const renderer = new T.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
	renderer.setSize(SIZE, SIZE, false);
	const gl = renderer.getContext();
	const scene = new T.Scene();
	scene.background = new T.Color(0x101030);
	const camera = new T.PerspectiveCamera(50, 1, 0.1, 100);
	camera.position.set(0, 0, 10);
	scene.add(new T.AmbientLight(0xffffff, 0.5));
	const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
	const material = new T.MeshLambertMaterial({ color: 0xffaa55, side: T.DoubleSide });

	const SEG = 4;
	const sheet = (seg, phase) => {
		const vc = (seg + 1) * (seg + 1);
		const pos = new Float32Array(vc * 3), nor = new Float32Array(vc * 3), uv = new Float32Array(vc * 2), idx = [];
		for (let y = 0; y <= seg; y++) for (let x = 0; x <= seg; x++) {
			const i = y * (seg + 1) + x;
			pos[i * 3] = (x / seg - 0.5) * 2; pos[i * 3 + 1] = (y / seg - 0.5) * 2; pos[i * 3 + 2] = Math.sin(phase + x + y) * 0.3;
			nor[i * 3 + 2] = 1; uv[i * 2] = x / seg; uv[i * 2 + 1] = y / seg;
		}
		for (let y = 0; y < seg; y++) for (let x = 0; x < seg; x++) { const a = y * (seg + 1) + x, c = a + seg + 1; idx.push(a, c, a + 1, a + 1, c, c + 1); }
		const g = new T.BufferGeometry();
		g.setAttribute('position', new T.BufferAttribute(pos, 3));
		g.setAttribute('normal', new T.BufferAttribute(nor, 3));
		g.setAttribute('uv', new T.BufferAttribute(uv, 2));
		g.setIndex(idx);
		return g;
	};
	const meshes = [];
	for (let i = 0; i < 8; i++) {
		const m = new T.Mesh(sheet(SEG, i), material);
		m.position.set((i % 4 - 1.5) * 2.4, (i < 4 ? 1.2 : -1.2) * 1.0, 0);
		scene.add(m); meshes.push(m);
	}
	// meshes 0-2 carry onUpload hooks (jrs draws those from their own buffers, like three.js); 3-7 have none and are packed into shared buffers
	const upload = meshes.map(() => 0), idxUpload = meshes.map(() => 0);
	[0, 1, 2].forEach((i) => {
		meshes[i].geometry.attributes.position.onUpload(() => { upload[i]++; });
		meshes[i].geometry.index.onUpload(() => { idxUpload[i]++; });
	});
	let lastUpload = upload.slice(), lastIdxUpload = idxUpload.slice();
	const steps = [];
	// `uploads: false` marks steps where a mesh deliberately moves between the shared-buffer path and its own
	// buffers: the GPU copy is then created once more, so onUpload counts are not comparable there.
	const snapshot = (name, { uploads = true } = {}) => {
		renderer.render(scene, camera);
		const px = new Uint8Array(SIZE * SIZE * 4);
		gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
		let painted = 0; for (let k = 0; k < px.length; k += 4) if (px[k] > 60) painted++;
		// onUpload is compared as "fired since the previous step" (a mesh that switches between the shared
		// buffers and its own copy fires once more than three.js, which only ever has one copy)
		const api = {
			upload: uploads ? upload.map((v, i) => v - lastUpload[i]) : null, idxUpload: uploads ? idxUpload.map((v, i) => v - lastIdxUpload[i]) : null,
			ranges: meshes.map((m) => m.geometry.attributes.position.updateRanges.length),
			versions: meshes.map((m) => m.geometry.attributes.position.version),
			glError: gl.getError(),
		};
		lastUpload = upload.slice(); lastIdxUpload = idxUpload.slice();
		steps.push({ name, px, api, painted });
	};
	const bump = (m, amount, from = 0, to = null) => {
		const a = m.geometry.attributes.position;
		const end = to === null ? a.count : to;
		for (let i = from; i < end; i++) a.array[i * 3 + 2] += amount * Math.sin(i + 1);
		for (let i = from; i < end; i++) a.array[i * 3 + 1] += amount * 0.2;
	};

	snapshot('initial');
	snapshot('unchanged frame (no uploads)');
	for (const m of meshes) { bump(m, 0.4); m.geometry.attributes.position.needsUpdate = true; }
	snapshot('all positions needsUpdate');
	bump(meshes[2], 0.5, 5, 15); meshes[2].geometry.attributes.position.addUpdateRange(15, 30); meshes[2].geometry.attributes.position.needsUpdate = true;
	snapshot('one update range');
	{
		const a = meshes[3].geometry.attributes.position;
		bump(meshes[3], 0.6, 0, 6); a.addUpdateRange(0, 18); bump(meshes[3], 0.6, 4, 10); a.addUpdateRange(12, 18); bump(meshes[3], 0.6, 20, 25); a.addUpdateRange(60, 15); a.needsUpdate = true;
	}
	snapshot('overlapping + separate ranges');
	{
		const a = meshes[5].geometry.attributes.position;
		bump(meshes[5], 0.3, 2, 9); a.addUpdateRange(6, 21); a.needsUpdate = true;
	}
	snapshot('range update on a packed mesh');
	{
		// a GPU copy created later (e.g. when a mesh changes render path) legitimately sees the CPU data, so undo the edit
		const a = meshes[1].geometry.attributes.position, saved = a.array.slice();
		bump(meshes[1], 1.0);
		snapshot('modified without needsUpdate');
		a.array.set(saved);
	}
	meshes[4].geometry.setDrawRange(0, 12);
	snapshot('drawRange set after first render', { uploads: false });
	meshes[4].geometry.setDrawRange(0, Infinity);
	snapshot('drawRange restored');
	{
		const old = meshes[5].geometry, g = sheet(8, 1.5);
		old.setAttribute('position', g.attributes.position); old.setAttribute('normal', g.attributes.normal); old.setAttribute('uv', g.attributes.uv); old.setIndex(g.index);
	}
	snapshot('geometry grown (new attributes)');
	{
		const a = meshes[5].geometry.attributes.position;
		for (let i = 0; i < a.count; i++) a.array[i * 3 + 2] += 0.3; a.needsUpdate = true;
	}
	snapshot('grown geometry updated');
	{
		meshes[6].geometry.dispose();
		bump(meshes[6], 0.7); meshes[6].geometry.attributes.position.needsUpdate = true;
	}
	snapshot('dispose then update');
	snapshot('after dispose, unchanged');
	{
		meshes[2].geometry.dispose();
		bump(meshes[2], 0.2); meshes[2].geometry.attributes.position.needsUpdate = true;
	}
	snapshot('dispose hooked mesh then update');
	// two consumers: leave the multi-draw path (regular VAO copy), update with ranges, come back
	if ('autoMultiDraw' in renderer) renderer.autoMultiDraw = false;
	bump(meshes[0], 0.3, 0, 10); meshes[0].geometry.attributes.position.addUpdateRange(0, 30); meshes[0].geometry.attributes.position.needsUpdate = true;
	snapshot('multi-draw off, range update', { uploads: false });
	if ('autoMultiDraw' in renderer) renderer.autoMultiDraw = true;
	bump(meshes[0], 0.3, 10, 14); meshes[0].geometry.attributes.position.addUpdateRange(30, 12); meshes[0].geometry.attributes.position.needsUpdate = true;
	snapshot('multi-draw back on, other range');
	// hidden meshes accumulate ranges that must all be applied when they are drawn again
	meshes[7].visible = false;
	bump(meshes[7], 0.5, 0, 5); meshes[7].geometry.attributes.position.addUpdateRange(0, 15); meshes[7].geometry.attributes.position.needsUpdate = true;
	snapshot('hidden mesh updated');
	bump(meshes[7], 0.5, 12, 16); meshes[7].geometry.attributes.position.addUpdateRange(36, 12); meshes[7].geometry.attributes.position.needsUpdate = true;
	meshes[7].visible = true;
	snapshot('hidden mesh shown again');
	// index data rewritten
	{
		const idx = meshes[2].geometry.index; for (let i = 0; i < 12; i++) idx.array[i] = idx.array[i + 12];
		idx.needsUpdate = true;
	}
	snapshot('index rewritten');
	// interleaved position (regular path)
	{
		const g = new T.BufferGeometry();
		const ib = new T.InterleavedBuffer(new Float32Array([-1, -1, 0, 0, 0, 1, -1, 0, 1, 0, 1, 1, 0, 1, 1, -1, 1, 0, 0, 1]), 5);
		g.setAttribute('position', new T.InterleavedBufferAttribute(ib, 3, 0));
		g.setAttribute('uv', new T.InterleavedBufferAttribute(ib, 2, 3));
		g.setIndex([0, 1, 2, 0, 2, 3]);
		const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x33ff66, side: T.DoubleSide }));
		m.position.set(0, 0, 1); m.scale.setScalar(0.6);
		scene.add(m);
		snapshot('interleaved mesh added');
		ib.array[0] = -2; ib.array[5] = 2; ib.addUpdateRange(0, 10); ib.needsUpdate = true;
		snapshot('interleaved range update');
		steps[steps.length - 1].api.interleavedRanges = ib.updateRanges.length;
	}
	// removed and re-added meshes keep working
	scene.remove(meshes[1]);
	snapshot('mesh removed');
	bump(meshes[1], 0.4); meshes[1].geometry.attributes.position.needsUpdate = true;
	scene.add(meshes[1]);
	snapshot('mesh re-added after update');
	const glErrors = gl.getError();
	renderer.dispose();
	canvas.remove();
	return { steps, glErrors };
}
