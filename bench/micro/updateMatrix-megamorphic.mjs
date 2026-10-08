// Does Object3D.updateMatrix allocate when the receiver map set is megamorphic?
import { Scene, Mesh, Group, Object3D, AmbientLight, DirectionalLight, BoxGeometry, MeshBasicMaterial, PerspectiveCamera } from '../../src/index.js';
const mode = process.argv[2] || 'mixed';
const scene = new Scene();
const g = new BoxGeometry(), m = new MeshBasicMaterial();
if (mode === 'mixed') { scene.add(new AmbientLight()); const d = new DirectionalLight(); scene.add(d); scene.add(new Group()); scene.add(new PerspectiveCamera()); }
for (let i = 0; i < 10000; i++) { const o = new Mesh(g, m); o.position.set(i * 0.1, i * 0.2, 0.5); o.rotation.set(i * 0.1, i * 0.2, 0); scene.add(o); }
for (let f = 0; f < 50; f++) scene.updateMatrixWorld();
global.gc && global.gc();
const h0 = process.memoryUsage().heapUsed;
const t0 = performance.now();
for (let f = 0; f < 200; f++) scene.updateMatrixWorld();
const dt = (performance.now() - t0) / 200;
const h1 = process.memoryUsage().heapUsed;
console.log(mode, 'ms/frame', dt.toFixed(3), 'heap delta KB/frame', ((h1 - h0) / 1024 / 200).toFixed(1));
