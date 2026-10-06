import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';
const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('console', (m) => console.log('[browser]', m.type(), m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/smoke.html`);
await page.waitForFunction(() => window.ready === true);
const results = await page.evaluate(async () => {
	const out = [];
	const canvas = document.getElementById('c');
	const renderer = new THREE.WebGLRenderer({ canvas });
	const gl = renderer.getContext();
	const err = (label) => { const e = gl.getError(); out.push(label + ': ' + e); };
	renderer.setSize(256, 256, false);
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
	renderer.shadowMap.enabled = true;
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);
	const caster = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
	caster.castShadow = true; scene.add(caster);
	const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(0, 5, 0); sun.castShadow = true; scene.add(sun);
	camera.position.set(0, 4, 6); camera.lookAt(0, 0, 0);
	err('before');
	// instrument shadow pass pieces
	const origRender = renderer.shadowMap.render.bind(renderer.shadowMap);
	renderer.shadowMap.render = (l, s, c) => { err('pre-shadow'); origRender(l, s, c); err('post-shadow'); };
	const origDraw = renderer._drawList.bind(renderer);
	renderer._drawList = (list, keys, n, s, c, sp) => { origDraw(list, keys, n, s, c, sp); err('drawList shadowPass=' + sp + ' n=' + n); };
	renderer.render(scene, camera);
	err('after render');
	out.push('numDirShadows=' + renderer.lights.numDirShadows);
	out.push('map=' + (sun.shadow.map ? sun.shadow.map.width : null));
	const px = readPixel(renderer, 128, 175); out.push('under: ' + px);
	out.push('programs: ' + renderer.programs.programs.map(p => p.parameters.materialType + '/' + p.parameters.numDirShadows + '/' + p.hasLightsBlock).join(', '));
	// check receive program compiled with shadows
	const fp = renderer._materialProps(floor.material);
	out.push('floor variants: ' + Object.keys(fp.programs).join(','));
	// read back the shadow depth texture via a separate FBO
	const tp = renderer.textures.get(sun.shadow.map.depthTexture);
	out.push('depthTex: ' + !!tp.webglTexture);
	// shadow matrix
	out.push('shadowMatrix: ' + Array.from(sun.shadow.matrix.elements).map(v => v.toFixed(2)).join(','));
	out.push('lights data shadow mat: ' + Array.from(renderer.lights.data.slice((32 + 4*32 + 8*48 + 4*64 + 2*48)/4, (32 + 4*32 + 8*48 + 4*64 + 2*48)/4 + 16)).map(v => v.toFixed(2)).join(','));
	return out;
});
console.log(results.join('\n'));
await browser.close(); server.close();
