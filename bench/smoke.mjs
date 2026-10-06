import { startServer } from './serve.mjs';
import { launchBrowser } from './browser.mjs';

const { server, port } = await startServer();
const browser = await launchBrowser();
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[browser]', m.type(), m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/bench/smoke.html`);
await page.waitForFunction(() => window.ready === true);

const results = await page.evaluate(async () => {
	const out = {};
	const canvas = document.getElementById('c');
	const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
	renderer.setSize(256, 256, false);
	out.webgl2 = renderer.capabilities.isWebGL2;
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
	camera.position.z = 5;

	// 1. unlit red box in the centre, background dark blue
	scene.background = new THREE.Color(0x000040);
	const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
	scene.add(box);
	renderer.render(scene, camera);
	out.basicCenter = readPixel(renderer, 128, 128);
	out.basicCorner = readPixel(renderer, 2, 2);
	out.callsBasic = renderer.info.render.calls;

	// 2. lit standard material with a directional light: top face brighter than side
	scene.remove(box);
	const std = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
	std.rotation.set(0.6, 0.7, 0);
	scene.add(std);
	const dir = new THREE.DirectionalLight(0xffffff, 3); dir.position.set(0, 5, 2); scene.add(dir);
	scene.add(new THREE.AmbientLight(0xffffff, 0.2));
	renderer.render(scene, camera);
	out.litCenter = readPixel(renderer, 128, 128);
	out.litUpper = readPixel(renderer, 128, 95);
	out.litLower = readPixel(renderer, 128, 170);

	// 3. auto-batching: 200 meshes sharing geometry+material -> 1 draw call
	scene.remove(std);
	const geo = new THREE.BoxGeometry(0.1, 0.1, 0.1), mat = new THREE.MeshLambertMaterial({ color: 0x00ff00 });
	const group = new THREE.Group();
	for (let i = 0; i < 200; i++) { const m = new THREE.Mesh(geo, mat); m.position.set((i % 20 - 10) * 0.2, (Math.floor(i / 20) - 5) * 0.2, 0); group.add(m); }
	scene.add(group);
	renderer.render(scene, camera);
	out.batchCalls = renderer.info.render.calls;
	out.batchBatches = renderer.info.render.batches;
	out.batchInstances = renderer.info.render.instances;
	out.batchPixel = readPixel(renderer, 128 + 13, 128 - 13);
	renderer.autoBatch = false;
	renderer.render(scene, camera);
	out.noBatchCalls = renderer.info.render.calls;
	out.noBatchPixel = readPixel(renderer, 128 + 13, 128 - 13);
	renderer.autoBatch = true;

	// 4. InstancedMesh
	scene.remove(group);
	const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshPhongMaterial({ color: 0xffff00 }), 3);
	const m4 = new THREE.Matrix4();
	for (let i = 0; i < 3; i++) { m4.makeTranslation((i - 1) * 1.2, 0, 0); im.setMatrixAt(i, m4); }
	scene.add(im);
	renderer.render(scene, camera);
	out.instancedCenter = readPixel(renderer, 128, 128);
	out.instancedCalls = renderer.info.render.calls;

	// 5. transparency + sorting, lines, points, sprite
	scene.remove(im);
	const t1 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.5 }));
	const t2 = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 }));
	t2.position.z = 1; scene.add(t1, t2);
	const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, -1.5, 0), new THREE.Vector3(2, -1.5, 0)]), new THREE.LineBasicMaterial({ color: 0xffffff }));
	scene.add(line);
	const pts = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.8, 1.8, 0)]), new THREE.PointsMaterial({ color: 0xffffff, size: 10, sizeAttenuation: false }));
	scene.add(pts);
	renderer.render(scene, camera);
	out.transCenter = readPixel(renderer, 128, 128);
	out.transCalls = renderer.info.render.calls;

	// 6. shadows
	scene.clear();
	renderer.shadowMap.enabled = true;
	const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshLambertMaterial({ color: 0xffffff }));
	floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);
	const caster = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }));
	caster.castShadow = true; scene.add(caster);
	const sun = new THREE.DirectionalLight(0xffffff, 3); sun.position.set(4, 5, 0); sun.castShadow = true; sun.shadow.mapSize.set(512, 512); scene.add(sun);
	camera.position.set(0, 4, 6); camera.lookAt(0, 0, 0);
	camera.updateMatrixWorld();
	renderer.render(scene, camera);
	const px = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(camera); return [Math.round((v.x + 1) * 128), Math.round((1 - v.y) * 128)]; };
	// the light comes from +x, so the shadow lies on the floor toward -x: sample inside it and outside it
	const inShadow = px(-0.9, -1, 0), lit = px(2.5, -1, 0);
	out.shadowUnder = readPixel(renderer, inShadow[0], inShadow[1]);
	out.floorLit = readPixel(renderer, lit[0], lit[1]);
	out.shadowPx = [inShadow, lit];
	out.shadowCalls = renderer.info.render.calls;

	// 7. wireframe + raycast
	const rc = new THREE.Raycaster();
	rc.setFromCamera(new THREE.Vector2(0, 0), camera);
	const hits = rc.intersectObjects(scene.children, true);
	out.rayHits = hits.length; out.rayFirst = hits.length ? hits[0].object.type + ' ' + hits[0].distance.toFixed(3) : null;
	out.glError = renderer.getContext().getError();
	return out;
});
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
