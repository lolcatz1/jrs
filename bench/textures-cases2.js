// Second half of the texture cases: depth textures, compressed textures, dynamic textures (canvas / video / framebuffer),
// copyTextureToTexture, initTexture / dispose / Source sharing, user mipmaps, transforms, 3D / array textures, cubes, large uploads.

export function moreCases(env, C, has, h) {
	const { rgbaPattern, busyPattern, canvasPattern, quadScene, basic, typedData, hash, capture, shot, SIZE } = h;
	const out = [];
	const add = (...a) => C(...a);

	// ----------------------------------------------------------------------------------------------------- helpers
	const plain = (T) => { const scene = new T.Scene(); scene.background = new T.Color(0x336699); const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camera.position.z = 2; return { scene, camera }; };
	const shaderQuad = (T, uniforms, fragmentShader, extra = {}) => new T.ShaderMaterial({
		uniforms, vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader, ...extra,
	});
	/** Two half-screen quads sharing one source: left magnified, right minified (exercises mip levels). */
	const splitScene = (T, tex, extra = {}) => {
		const { scene, camera } = plain(T);
		const a = tex, b = tex.clone();
		a.wrapS = a.wrapT = b.wrapS = b.wrapT = T.RepeatWrapping;
		a.repeat.set(1, 1); b.repeat.set(6, 6);
		const ma = new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, a, extra)); ma.position.x = -0.5;
		const mb = new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, b, extra)); mb.position.x = 0.5;
		scene.add(ma, mb);
		return { scene, camera };
	};

	// ----------------------------------------------------------------------------------------------------- depth textures
	const depthTypes = [['UnsignedShort', 'DepthFormat'], ['UnsignedInt', 'DepthFormat'], ['Float', 'DepthFormat'], ['UnsignedInt', 'DepthStencilFormat'], ['UnsignedInt248', 'DepthStencilFormat'], ['Float', 'DepthStencilFormat'], ['UnsignedShort', 'DepthStencilFormat']];
	const depthDemo = (T, side, tname, fname, opts = {}) => {
		const dt = new T.DepthTexture(32, 32, T[tname + 'Type'], undefined, undefined, undefined, undefined, undefined, undefined, T[fname]);
		if (opts.compare !== undefined) dt.compareFunction = T[opts.compare];
		const rt = new T.WebGLRenderTarget(32, 32, { depthTexture: dt, stencilBuffer: fname === 'DepthStencilFormat' });
		const world = new T.Scene(); world.background = new T.Color(0x000000);
		const cam = new T.PerspectiveCamera(50, 1, 0.5, 10); cam.position.set(0, 0, 4);
		const box = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshBasicMaterial({ color: 0xff0000 })); box.rotation.set(0.5, 0.7, 0);
		const wall = new T.Mesh(new T.PlaneGeometry(6, 6), new T.MeshBasicMaterial({ color: 0x00ff00 })); wall.position.z = -2;
		world.add(wall, box);
		side.renderer.setRenderTarget(rt); side.renderer.render(world, cam); side.renderer.setRenderTarget(null);
		const { scene, camera } = plain(T);
		const sampler = opts.compare !== undefined ? 'sampler2DShadow' : 'sampler2D';
		const fs = opts.compare !== undefined
			? 'precision highp sampler2DShadow; uniform sampler2DShadow depthMap; varying vec2 vUv; void main(){ float d = texture(depthMap, vec3(vUv, 0.93)); gl_FragColor = vec4(vec3(d), 1.0); }'
			: 'uniform sampler2D depthMap; varying vec2 vUv; void main(){ float d = texture2D(depthMap, vUv).r; gl_FragColor = vec4(vec3(pow(d, 24.0)), 1.0); }';
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), shaderQuad(T, { depthMap: { value: dt } }, fs)));
		const r = shot(side, scene, camera);
		rt.dispose();
		return r;
	};
	for (const [tname, fname] of depthTypes) {
		add('depth', `DepthTexture ${fname} x ${tname} as render target depth, sampled through sampler2D`, (T, side) => depthDemo(T, side, tname, fname));
	}
	for (const cmp of ['LessEqualCompare', 'GreaterCompare', 'AlwaysCompare']) {
		add('depth', `DepthTexture compareFunction=${cmp} sampled through sampler2DShadow`, (T, side) => depthDemo(T, side, 'UnsignedInt', 'DepthFormat', { compare: cmp }));
	}
	for (const packing of ['BasicDepthPacking', 'RGBADepthPacking']) {
		add('depth', `MeshDepthMaterial depthPacking=${packing} rendered to screen and into an RGBA8 target`, (T, side) => {
			const world = new T.Scene(); world.background = new T.Color(0x000000);
			const cam = new T.PerspectiveCamera(50, 1, 0.5, 10); cam.position.set(0, 0, 4);
			const box = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshDepthMaterial({ depthPacking: T[packing] })); box.rotation.set(0.5, 0.7, 0);
			world.add(box);
			const rt = new T.WebGLRenderTarget(SIZE, SIZE);
			side.renderer.setRenderTarget(rt); side.renderer.render(world, cam); side.renderer.setRenderTarget(null);
			const { scene, camera } = plain(T);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: rt.texture })));
			const a = shot(side, scene, camera);
			const b = shot(side, world, cam); // directly to screen
			rt.dispose();
			// both views must match three.js; fold the second view into the first image (stacked rows)
			const px = new Uint8Array(a.pixels.length);
			for (let i = 0; i < px.length; i++) px[i] = (i % 8 < 4) ? a.pixels[i] : b.pixels[i];
			return { pixels: px, centre: a.centre };
		});
	}

	// ----------------------------------------------------------------------------------------------------- compressed textures
	const sz = (bw, bh, by) => (w, hh) => Math.ceil(w / bw) * Math.ceil(hh / bh) * by;
	const formats = [
		['RGB_S3TC_DXT1_Format', 'WEBGL_compressed_texture_s3tc', 4, 4, 8], ['RGBA_S3TC_DXT1_Format', 'WEBGL_compressed_texture_s3tc', 4, 4, 8],
		['RGBA_S3TC_DXT3_Format', 'WEBGL_compressed_texture_s3tc', 4, 4, 16], ['RGBA_S3TC_DXT5_Format', 'WEBGL_compressed_texture_s3tc', 4, 4, 16],
		['RGB_ETC1_Format', 'WEBGL_compressed_texture_etc', 4, 4, 8], ['RGB_ETC2_Format', 'WEBGL_compressed_texture_etc', 4, 4, 8], ['RGBA_ETC2_EAC_Format', 'WEBGL_compressed_texture_etc', 4, 4, 16],
		['R11_EAC_Format', 'WEBGL_compressed_texture_etc', 4, 4, 8], ['SIGNED_R11_EAC_Format', 'WEBGL_compressed_texture_etc', 4, 4, 8], ['RG11_EAC_Format', 'WEBGL_compressed_texture_etc', 4, 4, 16], ['SIGNED_RG11_EAC_Format', 'WEBGL_compressed_texture_etc', 4, 4, 16],
		['RGBA_ASTC_4x4_Format', 'WEBGL_compressed_texture_astc', 4, 4, 16], ['RGBA_ASTC_5x4_Format', 'WEBGL_compressed_texture_astc', 5, 4, 16], ['RGBA_ASTC_6x6_Format', 'WEBGL_compressed_texture_astc', 6, 6, 16],
		['RGBA_ASTC_8x8_Format', 'WEBGL_compressed_texture_astc', 8, 8, 16], ['RGBA_ASTC_10x5_Format', 'WEBGL_compressed_texture_astc', 10, 5, 16], ['RGBA_ASTC_12x12_Format', 'WEBGL_compressed_texture_astc', 12, 12, 16],
		['RGBA_BPTC_Format', 'EXT_texture_compression_bptc', 4, 4, 16], ['RGB_BPTC_SIGNED_Format', 'EXT_texture_compression_bptc', 4, 4, 16], ['RGB_BPTC_UNSIGNED_Format', 'EXT_texture_compression_bptc', 4, 4, 16],
		['RED_RGTC1_Format', 'EXT_texture_compression_rgtc', 4, 4, 8], ['SIGNED_RED_RGTC1_Format', 'EXT_texture_compression_rgtc', 4, 4, 8],
		['RED_GREEN_RGTC2_Format', 'EXT_texture_compression_rgtc', 4, 4, 16], ['SIGNED_RED_GREEN_RGTC2_Format', 'EXT_texture_compression_rgtc', 4, 4, 16],
		['RGB_PVRTC_4BPPV1_Format', 'WEBGL_compressed_texture_pvrtc', 4, 4, 8], ['RGBA_PVRTC_2BPPV1_Format', 'WEBGL_compressed_texture_pvrtc', 8, 4, 8],
	];
	const blockData = (bytes, seed) => { const d = new Uint8Array(bytes); for (let i = 0; i < bytes; i++) d[i] = (hash(seed * 7919 + i * 31) * 256) | 0; return d; };
	/** A mip chain 16x16 .. 1x1 of pseudo random (but reproducible) blocks. `depth` multiplies each level's size (array textures). */
	const mips = (fmt, size = 16, depth = 1, seed = 1) => {
		const [, , bw, bh, by] = fmt, list = [];
		for (let w = size, i = 0; w >= 1; w >>= 1, i++) list.push({ data: blockData(sz(bw, bh, by)(w, w) * depth, seed * 100 + i), width: w, height: w });
		return list;
	};
	for (const fmt of formats) {
		const [name, ext] = fmt;
		const skip = has(ext) ? undefined : `${ext} not exposed by this GPU/driver (headless SwiftShader); the code path is the same compressedTexSubImage2D call exercised by the other formats`;
		for (const cs of (name.includes('RGB') && !name.includes('BPTC_') && !name.includes('RGTC') && !name.includes('R11') && !name.includes('RG11')) ? ['', 'srgb'] : ['']) {
			add('compressed', `CompressedTexture ${name.replace('_Format', '')}${cs ? ' (sRGB)' : ''}: 5 mip levels, upload path per mipmap`, (T, side) => {
				const tex = new T.CompressedTexture(mips(fmt), 16, 16, T[name]);
				tex.minFilter = T.LinearMipmapLinearFilter; tex.colorSpace = cs; tex.needsUpdate = true;
				const { scene, camera } = splitScene(T, tex);
				return shot(side, scene, camera);
			}, { skip, callsMatch: ['texStorage2D', 'compressedTexImage2D', 'compressedTexSubImage2D', 'texSubImage2D', 'generateMipmap'], compareWarnings: true });
		}
	}
	add('compressed', 'CompressedTexture with RGBAFormat (uncompressed mip chain in mipmaps[])', (T, side) => {
		const list = []; for (let w = 8, i = 0; w >= 1; w >>= 1, i++) list.push({ data: rgbaPattern(w, w).map((v, j) => (j + i * 40) & 255), width: w, height: w });
		const tex = new T.CompressedTexture(list, 8, 8, T.RGBAFormat, T.UnsignedByteType);
		tex.minFilter = T.LinearMipmapLinearFilter; tex.needsUpdate = true;
		const { scene, camera } = splitScene(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'compressedTexSubImage2D', 'texSubImage2D', 'generateMipmap'] });
	add('compressed', 'CompressedTexture re-upload keeps storage (needsUpdate twice: no second texStorage2D)', (T, side) => {
		const fmt = formats[3];
		const tex = new T.CompressedTexture(mips(fmt), 16, 16, T[fmt[0]]); tex.minFilter = T.LinearFilter; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		tex.mipmaps = mips(fmt, 16, 1, 9); tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { skip: has('WEBGL_compressed_texture_s3tc') ? undefined : 'WEBGL_compressed_texture_s3tc not exposed', callsMatch: ['texStorage2D', 'compressedTexSubImage2D', 'compressedTexImage2D'] });

	const arrayFmts = formats.filter((f) => ['RGBA_S3TC_DXT5_Format', 'RGBA_ETC2_EAC_Format', 'RGBA_ASTC_4x4_Format', 'RGBA_BPTC_Format', 'RED_GREEN_RGTC2_Format'].includes(f[0]));
	const arrayShader = (T, tex, layer) => shaderQuad(T, { atlas: { value: tex }, layer: { value: layer } },
		'precision highp sampler2DArray; uniform sampler2DArray atlas; uniform int layer; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture(atlas, vec3(vUv, float(layer))).rgb, 1.0); }');
	for (const fmt of arrayFmts) {
		add('compressed', `CompressedArrayTexture ${fmt[0].replace('_Format', '')}: 3 layers, layer 1 and 2 sampled`, (T, side) => {
			const layers = 3;
			const tex = new T.CompressedArrayTexture(mips(fmt, 8, layers), 8, 8, layers, T[fmt[0]]);
			tex.minFilter = T.NearestFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			const left = new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 1)); left.position.x = -0.5;
			const right = new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 2)); right.position.x = 0.5;
			scene.add(left, right);
			return shot(side, scene, camera);
		}, { skip: has(fmt[1]) ? undefined : `${fmt[1]} not exposed`, callsMatch: ['texStorage3D', 'compressedTexSubImage3D', 'compressedTexImage3D', 'texSubImage3D'] });
	}
	add('compressed', 'CompressedArrayTexture layerUpdates (one layer re-uploaded with compressedTexSubImage3D)', (T, side) => {
		const fmt = formats[3], layers = 3;
		const tex = new T.CompressedArrayTexture(mips(fmt, 8, layers), 8, 8, layers, T[fmt[0]]);
		tex.minFilter = T.NearestFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), arrayShader(T, tex, 2)));
		side.renderer.render(scene, camera);
		const m = tex.mipmaps; const layerBytes = sz(4, 4, 16)(8, 8);
		for (let i = 0; i < layerBytes; i++) m[0].data[2 * layerBytes + i] = (i * 13) & 255;
		tex.addLayerUpdate(2); tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { skip: has('WEBGL_compressed_texture_s3tc') ? undefined : 'WEBGL_compressed_texture_s3tc not exposed', callsMatch: ['texStorage3D', 'compressedTexSubImage3D'] });
	add('compressed', 'CompressedArrayTexture with RGBAFormat (uncompressed layers)', (T, side) => {
		const layers = 2, d = new Uint8Array(4 * 4 * layers * 4); for (let i = 0; i < d.length; i++) d[i] = (i * 37) & 255;
		const tex = new T.CompressedArrayTexture([{ data: d, width: 4, height: 4 }], 4, 4, layers, T.RGBAFormat, T.UnsignedByteType);
		tex.minFilter = T.NearestFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), arrayShader(T, tex, 1)));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D'] });

	const cubeShader = (T, tex) => shaderQuad(T, { env: { value: tex } },
		'uniform samplerCube env; varying vec3 vDir; void main(){ gl_FragColor = vec4(textureCube(env, normalize(vDir)).rgb, 1.0); }').clone();
	const cubeMaterial = (T, tex) => new T.ShaderMaterial({
		uniforms: { env: { value: tex } }, vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
		fragmentShader: 'uniform samplerCube env; varying vec3 vDir; void main(){ gl_FragColor = vec4(textureCube(env, normalize(vDir)).rgb, 1.0); }',
	});
	const cubeView = (T, tex, rot = [0.5, 0.7, 0]) => {
		const scene = new T.Scene(); scene.background = new T.Color(0x336699);
		const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.z = 4;
		const m = new T.Mesh(new T.BoxGeometry(2, 2, 2), cubeMaterial(T, tex)); m.rotation.set(...rot);
		scene.add(m);
		return { scene, camera };
	};
	for (const fmt of arrayFmts.slice(0, 4)) {
		add('compressed', `CompressedCubeTexture ${fmt[0].replace('_Format', '')}: six faces with mip chains`, (T, side) => {
			const faces = []; for (let f = 0; f < 6; f++) faces.push({ mipmaps: mips(fmt, 8, 1, f + 1), width: 8, height: 8 });
			const tex = new T.CompressedCubeTexture(faces, T[fmt[0]]);
			tex.minFilter = T.LinearMipmapLinearFilter; tex.needsUpdate = true;
			const { scene, camera } = cubeView(T, tex);
			return shot(side, scene, camera);
		}, { skip: has(fmt[1]) ? undefined : `${fmt[1]} not exposed`, callsMatch: ['texStorage2D', 'compressedTexSubImage2D', 'compressedTexImage2D', 'generateMipmap'] });
	}

	// ----------------------------------------------------------------------------------------------------- canvas / framebuffer / data updates
	add('dynamic', 'CanvasTexture needsUpdate every frame (3 frames, same size): texSubImage2D only after the first upload', (T, side) => {
		const cv = document.createElement('canvas'); cv.width = cv.height = 32;
		const g = cv.getContext('2d');
		const tex = new T.CanvasTexture(cv); tex.minFilter = T.LinearFilter;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		let r;
		for (let f = 0; f < 3; f++) {
			g.fillStyle = ['#ff0000', '#00ff00', '#0000ff'][f]; g.fillRect(0, 0, 32, 32); g.fillStyle = '#ffffff'; g.fillRect(4 + f * 8, 4, 8, 8);
			tex.needsUpdate = true; r = shot(side, scene, camera);
		}
		return r;
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D', 'generateMipmap'] });
	add('dynamic', 'CanvasTexture resized canvas then needsUpdate (three.js keeps its storage: fails the same way)', (T, side) => {
		const cv = document.createElement('canvas'); cv.width = cv.height = 16;
		const g = cv.getContext('2d'); g.fillStyle = '#ff8000'; g.fillRect(0, 0, 16, 16);
		const tex = new T.CanvasTexture(cv);
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		cv.width = cv.height = 32; g.fillStyle = '#00ff80'; g.fillRect(0, 0, 32, 32);
		tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D'] });
	add('dynamic', 'FramebufferTexture + copyFramebufferToTexture (copies the screen into a texture, then samples it)', (T, side) => {
		const fb = new T.FramebufferTexture(SIZE, SIZE);
		const world = new T.Scene(); world.background = new T.Color(0x203060);
		const cam = new T.PerspectiveCamera(50, 1, 0.1, 100); cam.position.z = 4;
		const box = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshBasicMaterial({ color: 0xff8000 })); box.rotation.set(0.4, 0.6, 0.1);
		world.add(box);
		side.renderer.render(world, cam);
		side.renderer.copyFramebufferToTexture(fb, new T.Vector2(0, 0));
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1.2, 1.2), basic(T, fb, { })));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'copyTexSubImage2D', 'texImage2D'] });
	add('dynamic', 'FramebufferTexture with mip filter (levels allocated, copy into level 1)', (T, side) => {
		const fb = new T.FramebufferTexture(SIZE, SIZE); fb.minFilter = T.LinearMipmapNearestFilter; fb.magFilter = T.NearestFilter;
		const world = new T.Scene(); world.background = new T.Color(0x602030);
		const cam = new T.PerspectiveCamera(50, 1, 0.1, 100); cam.position.z = 4;
		world.add(new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), new T.MeshBasicMaterial({ color: 0x40ff80 })));
		side.renderer.render(world, cam);
		side.renderer.copyFramebufferToTexture(fb, new T.Vector2(0, 0), 1);
		side.renderer.copyFramebufferToTexture(fb, new T.Vector2(0, 0), 0);
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1.2, 1.2), basic(T, fb)));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'copyTexSubImage2D', 'texImage2D'] });

	// ---- VideoTexture (a canvas capture stream plays in a <video>; both libraries sample the same element)
	const videoSetup = async () => {
		const cv = document.createElement('canvas'); cv.width = 64; cv.height = 48;
		const g = cv.getContext('2d');
		const paint = (i) => { g.fillStyle = '#204080'; g.fillRect(0, 0, 64, 48); g.fillStyle = ['#ff2020', '#20ff20', '#ffff20'][i % 3]; g.fillRect(8 + (i % 3) * 8, 8, 24, 20); g.fillStyle = '#fff'; g.fillRect(2, 2, 10, 6); };
		paint(0);
		if (!cv.captureStream) throw new Error('canvas.captureStream unavailable');
		const stream = cv.captureStream(0);
		const video = document.createElement('video'); video.muted = true; video.playsInline = true; video.srcObject = stream;
		await video.play();
		const track = stream.getVideoTracks()[0];
		const frame = async (i) => { paint(i); track.requestFrame(); await new Promise((res) => video.requestVideoFrameCallback(() => res())); };
		await frame(0);
		for (let i = 0; i < 100 && video.videoWidth === 0; i++) await new Promise((r) => setTimeout(r, 20));
		if (video.videoWidth === 0) throw new Error('video has no frame (no codec / headless media pipeline?)');
		return { video, frame };
	};
	add('dynamic', 'VideoTexture: needsUpdate every frame; jrs replaces pixels with texSubImage2D when the size is unchanged', async (T, side, ctx) => {
		const { video, frame } = ctx;
		const tex = new T.VideoTexture(video); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		const first = side.log.length;
		for (let f = 1; f <= 2; f++) { await frame(f); tex.needsUpdate = true; side.renderer.render(scene, camera); }
		const r = shot(side, scene, camera);
		r.info = 'uploads after first: ' + JSON.stringify(side.log.slice(first).filter((c) => /^tex(Sub)?Image2D$/.test(c[0])).map((c) => c[0]));
		tex.dispose();
		return r;
	}, { setup: videoSetup, tolerance: 0, verify: (va, vb, ra, rb) => {
		const subs = (r) => r.calls.filter((c) => c[0] === 'texSubImage2D').length;
		return subs(ra) >= 1 || `jrs should use texSubImage2D for same-size video frames (got ${subs(ra)})`;
	}, showCalls: true, compareWarnings: false });

	// ---- DataTexture update paths
	add('dynamic', 'DataTexture re-upload (needsUpdate) after changing the data', (T, side) => {
		const data = rgbaPattern(8, 8);
		const tex = new T.DataTexture(data, 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		for (let i = 0; i < data.length; i += 4) { data[i] = 255 - data[i]; }
		tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D'] });
	add('dynamic', 'DataTexture updateRanges (partial re-upload of two rows)', (T, side) => {
		const w = 8, data = rgbaPattern(w, 8);
		const tex = new T.DataTexture(data, w, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		for (let i = 0; i < w * 4; i++) { data[2 * w * 4 + i] = 255; data[5 * w * 4 + i] = 0; }
		tex.addUpdateRange(2 * w * 4, w * 4); tex.addUpdateRange(5 * w * 4, w * 4); tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D'] });
	add('dynamic', 'DataTexture whose data is replaced by a differently sized image (image object swapped, needsUpdate)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		side.renderer.render(scene, camera);
		tex.image = { data: rgbaPattern(8, 8), width: 8, height: 8 }; tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { compareWarnings: false });
	add('dynamic', 'DataTexture with null data (allocated only) then sampled', (T, side) => {
		const tex = new T.DataTexture(null, 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D'] });
	add('dynamic', 'Texture marked for update without image data (loading texture): binds nothing, samples black', (T, side) => {
		const tex = new T.Texture(); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		return shot(side, scene, camera);
	});
	add('dynamic', 'Texture never marked for update (version 0): binds nothing, samples black', (T, side) => {
		const tex = new T.Texture(canvasPattern(8, 8));
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, tex)));
		return shot(side, scene, camera);
	});
	add('dynamic', 'Re-upload one map while another unit was the active texture unit (map + emissiveMap on a lit material)', (T, side) => {
		const a = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType); a.needsUpdate = true;
		const b = new T.DataTexture(rgbaPattern(4, 4).map((v, i) => 255 - v), 4, 4, T.RGBAFormat, T.UnsignedByteType); b.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshBasicMaterial({ map: a })));
		const m2 = new T.Mesh(new T.PlaneGeometry(0.5, 0.5), new T.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: b })); m2.position.set(0.5, 0.5, 0.1); scene.add(m2);
		side.renderer.render(scene, camera);
		const d = a.image.data; for (let i = 0; i < d.length; i += 4) d[i + 1] = 255 - d[i + 1];
		a.needsUpdate = true;
		return shot(side, scene, camera);
	});

	// ----------------------------------------------------------------------------------------------------- copyTextureToTexture
	const copyScene = (T, dst) => { const { scene, camera } = plain(T); scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), basic(T, dst))); return { scene, camera }; };
	const mkData = (T, w, hh, seed = 0) => { const t = new T.DataTexture(rgbaPattern(w, hh).map((v, i) => (v + seed * 60) & 255), w, hh, T.RGBAFormat, T.UnsignedByteType); t.needsUpdate = true; return t; };
	add('copy', 'copyTextureToTexture DataTexture -> DataTexture (whole image)', (T, side) => {
		const src = mkData(T, 8, 8, 1), dst = mkData(T, 8, 8, 0);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst);
		const { scene, camera } = copyScene(T, dst);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });
	add('copy', 'copyTextureToTexture with srcRegion (Box2) and dstPosition (Vector2)', (T, side) => {
		const src = mkData(T, 8, 8, 2), dst = mkData(T, 16, 16, 0);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst, new T.Box2(new T.Vector2(2, 2), new T.Vector2(6, 7)), new T.Vector2(5, 3));
		const { scene, camera } = copyScene(T, dst);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D'] });
	add('copy', 'copyTextureToTexture CanvasTexture -> DataTexture', (T, side) => {
		const src = new T.CanvasTexture(canvasPattern(8, 8)), dst = mkData(T, 16, 16, 0);
		src.needsUpdate = true;
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst, null, new T.Vector2(4, 4));
		const { scene, camera } = copyScene(T, dst);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D'] });
	add('copy', 'copyTextureToTexture into mip level 1 (dstLevel) of a mipmapped DataTexture', (T, side) => {
		const dst = new T.DataTexture(rgbaPattern(16, 16), 16, 16, T.RGBAFormat, T.UnsignedByteType);
		dst.generateMipmaps = false; dst.minFilter = T.NearestMipmapNearestFilter;
		dst.mipmaps = [{ data: rgbaPattern(16, 16), width: 16, height: 16 }, { data: rgbaPattern(8, 8), width: 8, height: 8 }, { data: rgbaPattern(4, 4), width: 4, height: 4 }, { data: rgbaPattern(2, 2), width: 2, height: 2 }, { data: rgbaPattern(1, 1), width: 1, height: 1 }];
		dst.needsUpdate = true;
		const src = mkData(T, 8, 8, 3);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst, null, null, 0, 1);
		const { scene, camera } = plain(T);
		const m = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), basic(T, dst)); m.scale.set(0.5, 0.5, 1); scene.add(m); // small: samples level 1
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D'] });
	add('copy', 'copyTextureToTexture from a render target texture (framebuffer blit path)', (T, side) => {
		const rt = new T.WebGLRenderTarget(16, 16);
		const world = new T.Scene(); world.background = new T.Color(0x804020);
		const cam = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); cam.position.z = 2;
		world.add(new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ color: 0x40ff40 })));
		side.renderer.setRenderTarget(rt); side.renderer.render(world, cam); side.renderer.setRenderTarget(null);
		const dst = mkData(T, 16, 16, 0);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(rt.texture, dst);
		const { scene, camera } = copyScene(T, dst);
		const r = shot(side, scene, camera);
		rt.dispose();
		return r;
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'copyTexSubImage2D', 'blitFramebuffer'] });
	add('copy', 'copyTextureToTexture DataArrayTexture layers with a Box3 region and dstPosition (Vector3)', (T, side) => {
		const mk = (seed) => { const d = new Uint8Array(4 * 4 * 3 * 4); for (let i = 0; i < d.length; i++) d[i] = (i * 29 + seed * 71) & 255; const t = new T.DataArrayTexture(d, 4, 4, 3); t.needsUpdate = true; return t; };
		const src = mk(1), dst = mk(0);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst, new T.Box3(new T.Vector3(0, 0, 1), new T.Vector3(3, 3, 3)), new T.Vector3(1, 1, 0));
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, dst, 0)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, dst, 1)).translateX(0.5));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D'] });
	add('copy', 'copyTextureToTexture Data3DTexture -> Data3DTexture (whole volume)', (T, side) => {
		const mk = (seed) => { const d = new Uint8Array(4 * 4 * 4 * 4); for (let i = 0; i < d.length; i++) d[i] = (i * 17 + seed * 91) & 255; const t = new T.Data3DTexture(d, 4, 4, 4); t.needsUpdate = true; return t; };
		const src = mk(2), dst = mk(0);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst);
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), shaderQuad(T, { grid: { value: dst } }, 'precision highp sampler3D; uniform sampler3D grid; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture(grid, vec3(vUv, 0.6)).rgb, 1.0); }')));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D'] });
	add('copy', 'copyTextureToTexture compressed -> compressed (S3TC DXT5)', (T, side) => {
		const fmt = formats[3];
		const mk = (seed) => { const t = new T.CompressedTexture(mips(fmt, 16, 1, seed), 16, 16, T[fmt[0]]); t.minFilter = T.LinearFilter; t.needsUpdate = true; return t; };
		const src = mk(5), dst = mk(1);
		side.renderer.initTexture(dst);
		side.renderer.copyTextureToTexture(src, dst);
		const { scene, camera } = copyScene(T, dst);
		return shot(side, scene, camera);
	}, { skip: has('WEBGL_compressed_texture_s3tc') ? undefined : 'WEBGL_compressed_texture_s3tc not exposed', callsMatch: ['texStorage2D', 'compressedTexSubImage2D'] });
	add('copy', 'renderer.initRenderTarget then copyTextureToTexture into its texture', (T, side) => {
		const rt = new T.WebGLRenderTarget(8, 8, { depthBuffer: false });
		side.renderer.initRenderTarget(rt);
		const src = mkData(T, 8, 8, 1);
		side.renderer.copyTextureToTexture(src, rt.texture);
		const { scene, camera } = copyScene(T, rt.texture);
		const r = shot(side, scene, camera);
		rt.dispose();
		return r;
	}, { callsMatch: ['texImage2D', 'texSubImage2D'] });

	// ----------------------------------------------------------------------------------------------------- initTexture / dispose / Source sharing
	const memTex = (side) => side.renderer.info.memory.textures - side.memBase; // textures created by this case (the page shares one renderer pair)
	add('lifecycle', 'renderer.initTexture uploads immediately (no upload during the later render)', (T, side) => {
		const tex = mkData(T, 8, 8, 1);
		side.renderer.initTexture(tex);
		const afterInit = side.log.filter((c) => /^tex(Sub)?(Image|Storage)2D$/.test(c[0])).length;
		const { scene, camera } = copyScene(T, tex);
		const r = shot(side, scene, camera);
		const afterRender = side.log.filter((c) => /^tex(Sub)?(Image|Storage)2D$/.test(c[0])).length;
		r.data = { uploadsAtInit: afterInit > 0, uploadsDuringRender: afterRender - afterInit, memory: memTex(side) };
		return r;
	});
	for (const kind of ['canvas', 'cube', '3d', 'array', 'compressed']) {
		add('lifecycle', `renderer.initTexture(${kind}) creates and fills the GL texture`, (T, side) => {
			let tex;
			if (kind === 'canvas') tex = new T.CanvasTexture(canvasPattern(16, 16));
			else if (kind === 'cube') { tex = new T.CubeTexture([0, 1, 2, 3, 4, 5].map(() => canvasPattern(8, 8))); tex.needsUpdate = true; }
			else if (kind === '3d') { tex = new T.Data3DTexture(new Uint8Array(4 * 4 * 4 * 4), 4, 4, 4); tex.needsUpdate = true; }
			else if (kind === 'array') { tex = new T.DataArrayTexture(new Uint8Array(4 * 4 * 3 * 4), 4, 4, 3); tex.needsUpdate = true; }
			else { const fmt = formats[3]; tex = new T.CompressedTexture(mips(fmt), 16, 16, T[fmt[0]]); tex.needsUpdate = true; }
			side.renderer.initTexture(tex);
			return { pixels: new Uint8Array(SIZE * SIZE * 4), centre: [0, 0, 0, 0], data: { memory: memTex(side), calls: side.log.filter((c) => /^(tex|compressedTex)/.test(c[0])).map((c) => c[0]) } };
		}, { skip: (kind === 'compressed' && !has('WEBGL_compressed_texture_s3tc')) ? 'WEBGL_compressed_texture_s3tc not exposed' : undefined });
	}
	add('lifecycle', 'texture.dispose() frees the GL texture and decrements info.memory.textures', (T, side) => {
		const a = mkData(T, 4, 4, 1), b = mkData(T, 4, 4, 2);
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ map: a })).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), new T.MeshBasicMaterial({ map: b })).translateX(0.5));
		side.renderer.render(scene, camera);
		const m1 = memTex(side), creates = side.log.filter((c) => c[0] === 'createTexture').length;
		a.dispose();
		const m2 = memTex(side), deletes1 = side.log.filter((c) => c[0] === 'deleteTexture').length;
		b.dispose(); b.dispose();
		const m3 = memTex(side), deletes2 = side.log.filter((c) => c[0] === 'deleteTexture').length;
		const r = shot(side, scene, camera); // disposed textures re-upload on the next use
		const m4 = memTex(side);
		return { ...r, data: { memory: [m1, m2, m3, m4], deletes: [deletes1, deletes2], creates: creates >= 2 } };
	});
	add('lifecycle', 'texture.userData / uuid / name / id are untouched by upload, dispose and re-upload', (T, side) => {
		const tex = mkData(T, 4, 4, 1); tex.userData = { a: 1, nested: { b: [1, 2, 3] } }; tex.name = 'hello';
		const uuid = tex.uuid, id = tex.id, source = tex.source.uuid;
		const { scene, camera } = copyScene(T, tex);
		side.renderer.render(scene, camera); tex.dispose(); tex.needsUpdate = true; side.renderer.render(scene, camera);
		const r = capture(side);
		return { ...r, data: { userData: JSON.stringify(tex.userData), name: tex.name, uuidSame: tex.uuid === uuid, idSame: tex.id === id, sourceSame: tex.source.uuid === source, version: tex.version } };
	});
	add('lifecycle', 'Source sharing: a clone with the same parameters shares one GL texture (one upload)', (T, side) => {
		const a = new T.CanvasTexture(canvasPattern(16, 16)); a.minFilter = T.LinearFilter;
		const b = a.clone(); b.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, a)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, b)).translateX(0.5));
		const r = shot(side, scene, camera);
		const uploads = side.log.filter((c) => /^tex(Sub)?Image2D$/.test(c[0])).length;
		return { ...r, data: { memory: memTex(side), sameSource: a.source === b.source, uploads, creates: side.log.filter((c) => c[0] === 'createTexture').length } };
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });
	add('lifecycle', 'Source sharing: different parameters (wrapS) need their own GL texture, and dispose releases them one by one', (T, side) => {
		const a = new T.CanvasTexture(canvasPattern(16, 16));
		const b = a.clone(); b.wrapS = T.RepeatWrapping; b.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, a)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, b)).translateX(0.5));
		const r = shot(side, scene, camera);
		const m1 = memTex(side); a.dispose(); const m2 = memTex(side); b.dispose(); const m3 = memTex(side);
		return { ...r, data: { memory: [m1, m2, m3], uploads: side.log.filter((c) => /^tex(Sub)?Image2D$/.test(c[0])).length } };
	});
	add('lifecycle', 'Source sharing: changing a parameter after upload moves the texture to a new GL texture and frees the old one', (T, side) => {
		const a = mkData(T, 4, 4, 1);
		const { scene, camera } = copyScene(T, a);
		side.renderer.render(scene, camera);
		const m1 = memTex(side);
		a.wrapS = T.RepeatWrapping; a.needsUpdate = true;
		const r = shot(side, scene, camera);
		return { ...r, data: { memory: [m1, memTex(side)], deletes: side.log.filter((c) => c[0] === 'deleteTexture').length } };
	});
	add('lifecycle', 'Two textures with the same Source but one flipY=false: two GL textures, both render', (T, side) => {
		const a = new T.CanvasTexture(canvasPattern(16, 16)); a.minFilter = T.NearestFilter; a.magFilter = T.NearestFilter;
		const b = a.clone(); b.flipY = false; b.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, a)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, b)).translateX(0.5));
		const r = shot(side, scene, camera);
		return { ...r, data: { memory: memTex(side) } };
	});
	add('lifecycle', 'texture.needsUpdate on a Source shared by two textures re-uploads once per GL texture', (T, side) => {
		const cv = canvasPattern(16, 16);
		const a = new T.CanvasTexture(cv), b = a.clone(); b.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, a)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), basic(T, b)).translateX(0.5));
		side.renderer.render(scene, camera);
		const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(8, 8, 8, 8);
		a.needsUpdate = true;
		side.log.length = 0;
		const r = shot(side, scene, camera);
		return { ...r, data: { uploads: side.log.filter((c) => /^tex(Sub)?Image2D$/.test(c[0])).length } };
	});

	// ----------------------------------------------------------------------------------------------------- user mipmaps
	const levelColors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0], [0, 255, 255], [255, 0, 255]];
	const solid = (w, c) => { const d = new Uint8Array(w * w * 4); for (let i = 0; i < w * w; i++) { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; } return d; };
	for (const mode of ['LinearMipmapLinear', 'NearestMipmapNearest', 'LinearMipmapNearest']) {
		add('mipmaps', `DataTexture mipmaps[] chain 32..1, one colour per level, minFilter=${mode}`, (T, side) => {
			const list = []; for (let w = 32, i = 0; w >= 1; w >>= 1, i++) list.push({ data: solid(w, levelColors[i]), width: w, height: w });
			const tex = new T.DataTexture(list[0].data, 32, 32, T.RGBAFormat, T.UnsignedByteType);
			tex.mipmaps = list; tex.minFilter = T[mode + 'Filter']; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
			const { scene, camera } = splitScene(T, tex);
			return shot(side, scene, camera);
		}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D', 'generateMipmap'] });
	}
	add('mipmaps', 'DataTexture with a partial mipmaps[] chain (32, 16, 8 only): complete because storage has 3 levels', (T, side) => {
		const list = [32, 16, 8].map((w, i) => ({ data: solid(w, levelColors[i]), width: w, height: w }));
		const tex = new T.DataTexture(list[0].data, 32, 32, T.RGBAFormat, T.UnsignedByteType);
		tex.mipmaps = list; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const { scene, camera } = splitScene(T, tex);
		return shot(side, scene, camera);
	});
	add('mipmaps', 'DataTexture base level only with a mipmap minFilter and generateMipmaps=false (complete, samples the base)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(32, 32), 32, 32, T.RGBAFormat, T.UnsignedByteType);
		tex.minFilter = T.LinearMipmapLinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
		const { scene, camera } = splitScene(T, tex);
		return shot(side, scene, camera);
	});
	add('mipmaps', 'Texture mipmaps[] of canvases (image + canvas chain)', (T, side) => {
		const list = []; for (let w = 32, i = 0; w >= 1; w >>= 1, i++) { const cv = document.createElement('canvas'); cv.width = cv.height = w; const g = cv.getContext('2d'); const c = levelColors[i]; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(0, 0, w, w); list.push(cv); }
		const tex = new T.Texture(list[0]); tex.mipmaps = list; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const { scene, camera } = splitScene(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'texImage2D', 'generateMipmap'] });
	add('mipmaps', 'CubeTexture with canvas faces and generateMipmaps (LinearMipmapLinear)', (T, side) => {
		const faces = levelColors.map((c) => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d'); g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(0, 0, 16, 16); g.fillStyle = '#fff'; g.fillRect(2, 2, 6, 6); return cv; });
		const tex = new T.CubeTexture(faces); tex.minFilter = T.LinearMipmapLinearFilter; tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });
	add('mipmaps', 'CubeTexture with user mipmaps (cube chain: base from image, mips from mipmaps[].image)', (T, side) => {
		const mkFaces = (w, off) => [0, 1, 2, 3, 4, 5].map((i) => new T.DataTexture(solid(w, levelColors[(i + off) % 6]), w, w, T.RGBAFormat, T.UnsignedByteType));
		const tex = new T.CubeTexture(mkFaces(8, 0));
		tex.mipmaps = [{ image: mkFaces(4, 1) }, { image: mkFaces(2, 2) }, { image: mkFaces(1, 3) }];
		tex.minFilter = T.NearestMipmapNearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });

	// ----------------------------------------------------------------------------------------------------- transforms
	const tfCase = (name, setup) => add('transform', name, (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType);
		tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		setup(T, tex);
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});
	tfCase('map.offset', (T, t) => t.offset.set(0.3, -0.15));
	tfCase('map.repeat', (T, t) => t.repeat.set(2.5, 1.5));
	tfCase('map.rotation about the origin', (T, t) => { t.rotation = 0.6; });
	tfCase('map.rotation about center (0.5, 0.5)', (T, t) => { t.rotation = 0.6; t.center.set(0.5, 0.5); });
	tfCase('map offset + repeat + rotation + center combined', (T, t) => { t.offset.set(0.1, 0.2); t.repeat.set(1.7, 2.3); t.rotation = -1.1; t.center.set(0.3, 0.7); });
	tfCase('map.matrixAutoUpdate=false with a hand-written matrix', (T, t) => { t.matrixAutoUpdate = false; t.matrix.set(0.8, 0.3, 0.1, -0.3, 0.8, 0.2, 0, 0, 1); });
	add('transform', 'texture transform changes between frames are picked up (offset animated, no needsUpdate)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType);
		tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		side.renderer.render(scene, camera);
		tex.offset.x = 0.37; tex.rotation = 0.2;
		return shot(side, scene, camera);
	});
	add('transform', 'matrixAutoUpdate=false: the matrix is used as is even after offset changes', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType);
		tex.wrapS = tex.wrapT = T.RepeatWrapping; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		tex.updateMatrix(); tex.matrixAutoUpdate = false;
		tex.offset.set(0.5, 0.5);
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});

	// ----------------------------------------------------------------------------------------------------- 3D and array textures
	const vol = (T, n, mip = false) => { const d = new Uint8Array(n * n * n * 4); for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const i = ((z * n + y) * n + x) * 4; d[i] = x * 255 / (n - 1); d[i + 1] = y * 255 / (n - 1); d[i + 2] = z * 255 / (n - 1); d[i + 3] = 255; } return d; };
	const volShader = (T, tex, slice) => shaderQuad(T, { grid: { value: tex }, slice: { value: slice } }, 'precision highp sampler3D; uniform sampler3D grid; uniform float slice; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture(grid, vec3(vUv, slice)).rgb, 1.0); }');
	for (const [filt, mip] of [['Nearest', false], ['Linear', false], ['LinearMipmapLinear', true]]) {
		add('3d', `Data3DTexture RGBA8 minFilter=${filt} generateMipmaps=${mip}`, (T, side) => {
			const tex = new T.Data3DTexture(vol(T, 8), 8, 8, 8);
			tex.minFilter = T[filt + 'Filter']; tex.magFilter = T.LinearFilter; tex.generateMipmaps = mip; tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), volShader(T, tex, 0.31)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), volShader(T, tex, 0.8)).translateX(0.5));
			return shot(side, scene, camera);
		}, { callsMatch: ['texStorage3D', 'texSubImage3D', 'generateMipmap'] });
	}
	for (const [fname, comps, type] of [['RedFormat', 1, 'UnsignedByte'], ['RGFormat', 2, 'Float'], ['RGBAFormat', 4, 'HalfFloat'], ['RedFormat', 1, 'Float']]) {
		add('3d', `Data3DTexture ${fname.replace('Format', '')} x ${type}`, (T, side) => {
			const t = T[type + 'Type'];
			const tex = new T.Data3DTexture(typedData(T, t, 64, comps, (i, c) => ((i * 5 + c * 11) % 17) / 17), 4, 4, 4);
			tex.format = T[fname]; tex.type = t; tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), volShader(T, tex, 0.6)));
			return shot(side, scene, camera);
		});
	}
	add('3d', 'Data3DTexture wrapR=repeat sampled outside 0..1', (T, side) => {
		const tex = new T.Data3DTexture(vol(T, 4), 4, 4, 4); tex.wrapR = T.RepeatWrapping; tex.wrapS = T.MirroredRepeatWrapping; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), shaderQuad(T, { grid: { value: tex } }, 'precision highp sampler3D; uniform sampler3D grid; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture(grid, vec3(vUv * 2.0 - 0.5, 1.3)).rgb, 1.0); }')));
		return shot(side, scene, camera);
	});
	const arr = (layers, w = 4) => { const d = new Uint8Array(w * w * layers * 4); for (let l = 0; l < layers; l++) for (let i = 0; i < w * w; i++) { const o = (l * w * w + i) * 4; d[o] = (l * 60 + i * 7) & 255; d[o + 1] = (l * 110 + i * 3) & 255; d[o + 2] = (l * 30) & 255; d[o + 3] = 255; } return d; };
	add('3d', 'DataArrayTexture layerUpdates after the first upload (one layer)', (T, side) => {
		const d = arr(4), tex = new T.DataArrayTexture(d, 4, 4, 4); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 1)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 3)).translateX(0.5));
		side.renderer.render(scene, camera);
		for (let i = 0; i < 4 * 4 * 4; i++) { d[3 * 64 + i] = 255 - d[3 * 64 + i]; d[1 * 64 + i] = 255 - d[1 * 64 + i]; }
		tex.addLayerUpdate(3); tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D'] });
	add('3d', 'DataArrayTexture layerUpdates registered before the very first upload (three.js uploads only the listed layers)', (T, side) => {
		const tex = new T.DataArrayTexture(arr(4), 4, 4, 4); tex.addLayerUpdate(1); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 1)).translateX(-0.5), new T.Mesh(new T.PlaneGeometry(1, 2), arrayShader(T, tex, 3)).translateX(0.5));
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D'] });
	add('3d', 'DataArrayTexture with several layerUpdates and generateMipmaps', (T, side) => {
		const d = arr(4, 8), tex = new T.DataArrayTexture(d, 8, 8, 4); tex.generateMipmaps = true; tex.minFilter = T.LinearMipmapLinearFilter; tex.magFilter = T.LinearFilter; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), arrayShader(T, tex, 2)));
		side.renderer.render(scene, camera);
		for (let i = 0; i < 8 * 8 * 4; i++) { d[0 * 256 + i] = 0; d[2 * 256 + i] = 200 - (d[2 * 256 + i] >> 1); }
		tex.addLayerUpdate(0); tex.addLayerUpdate(2); tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage3D', 'texSubImage3D', 'generateMipmap'] });
	add('3d', 'DataArrayTexture Float RG layers', (T, side) => {
		const tex = new T.DataArrayTexture(typedData(T, T.FloatType, 4 * 4 * 3, 2, (i, c) => ((i * 7 + c * 5) % 13) / 13), 4, 4, 3);
		tex.format = T.RGFormat; tex.type = T.FloatType; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), arrayShader(T, tex, 1)));
		return shot(side, scene, camera);
	});

	// ----------------------------------------------------------------------------------------------------- cube textures
	const faceCanvas = (w, i) => { const cv = document.createElement('canvas'); cv.width = cv.height = w; const g = cv.getContext('2d'); const c = levelColors[i % 6]; g.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; g.fillRect(0, 0, w, w); g.fillStyle = '#fff'; g.fillRect(1, 1, w / 3, w / 5); return cv; };
	add('cube', 'CubeTexture of six canvases, flipY=false, mipmaps generated', (T, side) => {
		const tex = new T.CubeTexture([0, 1, 2, 3, 4, 5].map((i) => faceCanvas(16, i))); tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });
	add('cube', 'CubeTexture flipY=true (three.js ignores nothing here: uploads flipped)', (T, side) => {
		const tex = new T.CubeTexture([0, 1, 2, 3, 4, 5].map((i) => faceCanvas(16, i))); tex.flipY = true; tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	});
	add('cube', 'CubeTexture of DataTextures (Float RGBA)', (T, side) => {
		const faces = [0, 1, 2, 3, 4, 5].map((i) => new T.DataTexture(typedData(T, T.FloatType, 16, 4, (t, c) => c === 3 ? 1 : (((t + i * 3) * 7 + c * 5) % 16) / 15), 4, 4, T.RGBAFormat, T.FloatType));
		const tex = new T.CubeTexture(faces); tex.type = T.FloatType; tex.magFilter = T.NearestFilter; tex.minFilter = T.NearestFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	});
	add('cube', 'CubeTexture with six images of different sizes (16, 8, 16, 16, 4, 16): fails like three.js', (T, side) => {
		const tex = new T.CubeTexture([16, 8, 16, 16, 4, 16].map((w, i) => faceCanvas(w, i))); tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		const a = shot(side, scene, camera);
		tex.dispose(); tex.needsUpdate = true;
		const b = shot(side, scene, camera);
		a.info = 'self-diff after re-creating the GL texture: ' + h.diffMax(a.pixels, b.pixels);
		return a;
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'], pixelsAdvisory: 'the cube storage is only partly written, the rest is uninitialised GPU memory whose content depends on earlier allocations' });
	add('cube', 'CubeTexture of DataTextures with different sizes: fails like three.js', (T, side) => {
		const faces = [8, 8, 4, 8, 16, 8].map((w, i) => new T.DataTexture(solid(w, levelColors[i]), w, w, T.RGBAFormat, T.UnsignedByteType));
		const tex = new T.CubeTexture(faces); tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D'], pixelsAdvisory: 'the cube storage is only partly written, the rest is uninitialised GPU memory' });
	add('cube', 'CubeTexture with fewer than six images: nothing uploaded, samples black', (T, side) => {
		const tex = new T.CubeTexture([0, 1, 2].map((i) => faceCanvas(8, i))); tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		return shot(side, scene, camera);
	});
	add('cube', 'CubeTexture re-upload after changing one face (needsUpdate)', (T, side) => {
		const faces = [0, 1, 2, 3, 4, 5].map((i) => faceCanvas(8, i));
		const tex = new T.CubeTexture(faces); tex.needsUpdate = true;
		const { scene, camera } = cubeView(T, tex);
		side.renderer.render(scene, camera);
		const g = faces[2].getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 8, 8);
		tex.needsUpdate = true;
		return shot(side, scene, camera);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D', 'generateMipmap'] });

	// ----------------------------------------------------------------------------------------------------- image elements
	add('image', 'HTMLImageElement (data URL) texture through the TextureLoader-style path', async (T, side, ctx) => {
		const img = ctx.image;
		const tex = new T.Texture(img); tex.needsUpdate = true; tex.colorSpace = T.SRGBColorSpace;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	}, { setup: async () => { const img = new Image(); img.src = canvasPattern(24, 24).toDataURL(); await img.decode(); return { image: img }; } });
	add('image', 'ImageBitmap texture (flipY / premultiplyAlpha ignored by the browser for bitmaps)', async (T, side, ctx) => {
		const tex = new T.Texture(ctx.bitmap); tex.needsUpdate = true; tex.flipY = false;
		const { scene, camera } = quadScene(T, basic(T, tex, { transparent: true }));
		return shot(side, scene, camera);
	}, { setup: async () => ({ bitmap: await createImageBitmap(canvasPattern(24, 24, 0.7), { imageOrientation: 'flipY' }) }) });
	add('image', 'texture larger than MAX_TEXTURE_SIZE is resized on a canvas (warns)', (T, side) => {
		const cv = document.createElement('canvas'); cv.width = 9000; cv.height = 40;
		const g = cv.getContext('2d'); g.fillStyle = '#c04020'; g.fillRect(0, 0, 9000, 40); g.fillStyle = '#20c0e0'; g.fillRect(4500, 0, 4500, 20);
		const tex = new T.CanvasTexture(cv);
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera, 'max=' + side.renderer.capabilities.maxTextureSize);
	}, { callsMatch: ['texStorage2D', 'texSubImage2D'] });

	// ----------------------------------------------------------------------------------------------------- other material maps / objects
	// baselines without any texture: if these differ the lighting model (not the texture path) is the cause of a map mismatch
	for (const [r, m] of [[0, 0], [0.3, 0], [0.6, 0], [1, 0], [0.3, 1], [0.8, 1], [0.5, 0.5]]) {
		add('maps', `baseline: MeshStandardMaterial roughness=${r} metalness=${m} on a plane, no textures`, (T, side) => {
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshStandardMaterial({ color: 0xcccccc, roughness: r, metalness: m })));
			return shot(side, scene, camera);
		}, m > 0 ? { tolerance: 5, gap: 'lighting model, not textures: jrs MeshStandardMaterial lacks three.js r186 multiscattering GGX (BRDF_GGX_Multiscatter / DFGApprox), so metals differ' } : { tolerance: 5 });
	}
	for (const r of [0.1, 0.4, 0.9]) {
		add('maps', `baseline: MeshStandardMaterial roughness=${r} on a sphere (geometry roughness from the normal derivatives), no textures`, (T, side) => {
			const scene = new T.Scene(); scene.background = new T.Color(0x336699);
			const camera = new T.PerspectiveCamera(50, 1, 0.1, 100); camera.position.z = 3;
			scene.add(new T.AmbientLight(0xffffff, 0.4)); const dl = new T.DirectionalLight(0xffffff, 2.5); dl.position.set(1, 2, 3); scene.add(dl);
			scene.add(new T.Mesh(new T.SphereGeometry(1, 24, 16), new T.MeshStandardMaterial({ color: 0xcc8844, roughness: r, metalness: 0 })));
			return shot(side, scene, camera);
		}, { tolerance: 3, gap: 'lighting model, not textures: jrs derives geometryRoughness from dFdx/dFdy of normal.z only (three.js uses the max of all components of the non-perturbed normal) and lacks multiscattering GGX' });
	}
	for (const [label, rgb] of [['identity (flat)', [128, 128, 255]], ['uniform tilt +x', [200, 128, 230]], ['uniform tilt +y', [128, 200, 230]], ['strong tilt', [220, 90, 150]]]) {
		add('maps', `normalMap ${label}, constant over the plane (MeshStandardMaterial, roughness 0.7, flat quad)`, (T, side) => {
			const d = new Uint8Array(4 * 4 * 4); for (let i = 0; i < 16; i++) { d[i * 4] = rgb[0]; d[i * 4 + 1] = rgb[1]; d[i * 4 + 2] = rgb[2]; d[i * 4 + 3] = 255; }
			const tex = new T.DataTexture(d, 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.3)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7, metalness: 0, normalMap: tex })));
			return shot(side, scene, camera);
		}, { tolerance: 5 });
	}
	for (const key of ['alphaMap', 'aoMap', 'normalMap']) {
		add('maps', `${key} on a lit MeshStandardMaterial (data texture, colorSpace none)`, (T, side) => {
			const data = rgbaPattern(8, 8);
			if (key === 'normalMap') for (let i = 0; i < 64; i++) { data[i * 4] = 90 + (data[i * 4] >> 1); data[i * 4 + 1] = 90 + (data[i * 4 + 1] >> 1); data[i * 4 + 2] = 215; } // plausible tilted normals (z > 0)
			const tex = new T.DataTexture(data, 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			const m = new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, metalness: 0, transparent: key === 'alphaMap', [key]: tex });
			const g = new T.PlaneGeometry(2, 2); g.setAttribute('uv1', g.attributes.uv.clone());
			scene.add(new T.Mesh(g, m));
			return shot(side, scene, camera);
		}, { tolerance: 5 });
	}
	add('maps', 'roughnessMap on MeshStandardMaterial (metalness 0)', (T, side) => {
		const d = rgbaPattern(8, 8); for (let i = 0; i < 64; i++) d[i * 4 + 1] = 40 + (d[i * 4 + 1] * 0.8) | 0; // roughness 0.16..1 down the map
		const tex = new T.DataTexture(d, 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 1, metalness: 0, roughnessMap: tex })));
		return shot(side, scene, camera);
	}, { tolerance: 5 });
	// metalnessMap: jrs's lighting model differs from three.js for metals (see the baseline cases), so verify the texture path by
	// self-consistency: a map holding a constant blue channel must equal the uniform metalness factor within each library
	add('maps', 'metalnessMap (blue channel) equals the same uniform metalness within the library', (T, side) => {
		const d = new Uint8Array(4 * 4 * 4); for (let i = 0; i < 16; i++) { d[i * 4] = 10; d[i * 4 + 1] = 20; d[i * 4 + 2] = 128; d[i * 4 + 3] = 255; }
		const tex = new T.DataTexture(d, 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const render = (mat) => {
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
			return shot(side, scene, camera);
		};
		const a = render(new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 1, metalnessMap: tex }));
		const b = render(new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5, metalness: 128 / 255 }));
		const px = new Uint8Array(a.pixels.length); for (let i = 0; i < px.length; i++) px[i] = Math.abs(a.pixels[i] - b.pixels[i]);
		return { pixels: px, centre: a.centre, info: 'self diff max ' + Math.max(...px.filter((v, i) => i % 4 < 3)) };
	}, { tolerance: 1 });
	add('maps', 'roughnessMap (green channel) equals the same uniform roughness within the library', (T, side) => {
		const d = new Uint8Array(4 * 4 * 4); for (let i = 0; i < 16; i++) { d[i * 4] = 10; d[i * 4 + 1] = 100; d[i * 4 + 2] = 20; d[i * 4 + 3] = 255; }
		const tex = new T.DataTexture(d, 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const render = (mat) => {
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), mat));
			return shot(side, scene, camera);
		};
		const a = render(new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 1, metalness: 0, roughnessMap: tex }));
		const b = render(new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 100 / 255, metalness: 0 }));
		const px = new Uint8Array(a.pixels.length); for (let i = 0; i < px.length; i++) px[i] = Math.abs(a.pixels[i] - b.pixels[i]);
		return { pixels: px, centre: a.centre, info: 'self diff max ' + Math.max(...px.filter((v, i) => i % 4 < 3)) };
	}, { tolerance: 1 });
	add('maps', 'specularMap on MeshPhongMaterial', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.AmbientLight(0xffffff, 0.3)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(0, 0, 3); scene.add(dl);
		scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), new T.MeshPhongMaterial({ color: 0x404040, specular: 0xffffff, shininess: 30, specularMap: tex })));
		return shot(side, scene, camera);
	}, { tolerance: 5 });
	for (const key of ['lightMap', 'bumpMap', 'displacementMap', 'metalnessMap+envMap']) {
		if (key.includes('+')) continue;
		add('maps', `${key} on a lit material`, (T, side) => {
			const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
			const { scene, camera } = plain(T);
			scene.add(new T.AmbientLight(0xffffff, 0.8)); const dl = new T.DirectionalLight(0xffffff, 2); dl.position.set(1, 2, 3); scene.add(dl);
			const g = new T.PlaneGeometry(2, 2, 8, 8); g.setAttribute('uv1', g.attributes.uv.clone());
			scene.add(new T.Mesh(g, new T.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.6, [key]: tex, ...(key === 'displacementMap' ? { displacementScale: 0.3 } : {}) })));
			return shot(side, scene, camera);
		}, { gap: `${key} is not implemented by jrs's built-in shader (map keys: map, alphaMap, normalMap, emissiveMap, roughnessMap, metalnessMap, aoMap, specularMap)`, tolerance: 3 });
	}
	add('maps', 'map.channel = 1 (uses the uv1 attribute)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(8, 8), 8, 8, T.RGBAFormat, T.UnsignedByteType); tex.channel = 1; tex.magFilter = T.NearestFilter; tex.needsUpdate = true;
		const g = new T.PlaneGeometry(2, 2); const uv1 = g.attributes.uv.clone(); for (let i = 0; i < uv1.count; i++) uv1.setXY(i, uv1.getY(i), uv1.getX(i)); g.setAttribute('uv1', uv1);
		const { scene, camera } = plain(T);
		scene.add(new T.Mesh(g, new T.MeshBasicMaterial({ map: tex })));
		return shot(side, scene, camera);
	}, { gap: 'Texture.channel is not honoured: the map always uses the uv attribute' });
	add('maps', 'Sprite map (colorSpace sRGB, canvas)', (T, side) => {
		const tex = new T.CanvasTexture(canvasPattern(16, 16)); tex.colorSpace = T.SRGBColorSpace;
		const { scene, camera } = plain(T);
		scene.add(new T.Sprite(new T.SpriteMaterial({ map: tex })));
		return shot(side, scene, camera);
	});
	add('maps', 'PointsMaterial map with sizeAttenuation=false', (T, side) => {
		const tex = new T.CanvasTexture(canvasPattern(16, 16)); tex.colorSpace = T.SRGBColorSpace;
		const { scene, camera } = plain(T);
		const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0.5, 0.5, 0], 3));
		scene.add(new T.Points(g, new T.PointsMaterial({ map: tex, size: 24, sizeAttenuation: false, transparent: true })));
		return shot(side, scene, camera);
	});
	add('maps', 'map with alphaTest on an opaque material (discard uses texture alpha, output alpha forced to 1)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(4, 4).map((v, i) => (i % 4 === 3 ? (i >> 2) % 2 * 255 : v)), 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex, { alphaTest: 0.5 }));
		return shot(side, scene, camera);
	});
	add('maps', 'map shared by a lit and an unlit material and a ShaderMaterial (same texture object, three programs)', (T, side) => {
		const tex = new T.DataTexture(rgbaPattern(4, 4), 4, 4, T.RGBAFormat, T.UnsignedByteType); tex.colorSpace = T.SRGBColorSpace; tex.needsUpdate = true;
		const { scene, camera } = plain(T);
		scene.add(new T.AmbientLight(0xffffff, 1));
		scene.add(new T.Mesh(new T.PlaneGeometry(0.6, 2), new T.MeshBasicMaterial({ map: tex })).translateX(-0.7), new T.Mesh(new T.PlaneGeometry(0.6, 2), new T.MeshLambertMaterial({ map: tex })), new T.Mesh(new T.PlaneGeometry(0.6, 2), shaderQuad(T, { t: { value: tex } }, 'uniform sampler2D t; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb, 1.0); }')).translateX(0.7));
		return shot(side, scene, camera);
	}, { tolerance: 2 });

	// ----------------------------------------------------------------------------------------------------- large textures
	for (const n of [1024, 2048, 4096]) {
		add('large', `DataTexture ${n}x${n} RGBA8: upload, render, and a second upload`, (T, side) => {
			const d = new Uint8Array(n * n * 4);
			for (let y = 0; y < n; y++) { const r = (y * 255 / n) | 0; for (let x = 0; x < n; x++) { const i = (y * n + x) * 4; d[i] = r; d[i + 1] = (x * 255 / n) | 0; d[i + 2] = ((x >> 6) + (y >> 6)) & 1 ? 255 : 0; d[i + 3] = 255; } }
			const tex = new T.DataTexture(d, n, n, T.RGBAFormat, T.UnsignedByteType); tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearMipmapLinearFilter; tex.generateMipmaps = true; tex.needsUpdate = true;
			const { scene, camera } = quadScene(T, basic(T, tex));
			const t0 = performance.now(); side.renderer.render(scene, camera); side.gl.finish(); const t1 = performance.now();
			for (let y = 0; y < 8; y++) for (let x = 0; x < n; x++) d[(y * n + x) * 4 + 3] = 255, d[(y * n + x) * 4] = 255;
			tex.needsUpdate = true;
			const t2 = performance.now(); const r = shot(side, scene, camera); side.gl.finish(); const t3 = performance.now();
			r.info = `first upload+render ${(t1 - t0).toFixed(0)} ms, second ${(t3 - t2).toFixed(0)} ms (${side.lib.REVISION ? 'three' : 'jrs'}); ${side.log.filter((c) => /^tex(Sub)?(Image|Storage)2D$/.test(c[0])).map((c) => c[0]).join(',')}`;
			return r;
		}, { compareWarnings: false });
	}
	add('large', 'DataTexture 2048x2048 Float RGBA32F (64 MB) is uploaded and sampled', (T, side) => {
		const n = 2048; // 64 MB of floats: the largest float texture that is still quick on software GL
		const d = new Float32Array(n * n * 4);
		for (let i = 0; i < n * n; i++) { d[i * 4] = (i % n) / n; d[i * 4 + 1] = Math.floor(i / n) / n; d[i * 4 + 2] = 0.5; d[i * 4 + 3] = 1; }
		const tex = new T.DataTexture(d, n, n, T.RGBAFormat, T.FloatType); tex.magFilter = T.LinearFilter; tex.minFilter = T.LinearFilter; tex.generateMipmaps = false; tex.needsUpdate = true;
		const { scene, camera } = quadScene(T, basic(T, tex));
		return shot(side, scene, camera);
	});
	add('large', 'DataTexture streamed every frame (1 MB per frame, 6 frames): texImage2D path, same pixels', (T, side) => {
		const n = 512, d = new Uint8Array(n * n * 4);
		const tex = new T.DataTexture(d, n, n, T.RGBAFormat, T.UnsignedByteType); tex.magFilter = T.NearestFilter;
		const { scene, camera } = quadScene(T, basic(T, tex));
		let r;
		const t0 = performance.now();
		for (let f = 0; f < 6; f++) {
			for (let i = 0; i < n * n; i++) { d[i * 4] = (i * 3 + f * 40) & 255; d[i * 4 + 1] = ((i >> 9) * 2) & 255; d[i * 4 + 2] = f * 40; d[i * 4 + 3] = 255; }
			tex.needsUpdate = true; r = shot(side, scene, camera);
		}
		side.gl.finish();
		r.info = `6 frames in ${(performance.now() - t0).toFixed(0)} ms; ` + side.log.filter((c) => /^tex(Sub)?(Image|Storage)2D$/.test(c[0])).map((c) => c[0]).join(',');
		return r;
	}, { compareWarnings: false });

	return out;
}
