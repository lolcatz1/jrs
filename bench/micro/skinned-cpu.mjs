// Node-side (no GL) timing of the CPU parts of the skinned-crowd frame: mixer, matrix update, skeleton update.
//   node bench/micro/skinned-cpu.mjs [scenario=skinned-crowd] [--lib=jrs|three]
import { scenarios } from '../scenarios.js';
const name = process.argv.slice(2).find(a => !a.startsWith('--')) || 'skinned-crowd';
const lib = (process.argv.find(a => a.startsWith('--lib=')) || '--lib=jrs').split('=')[1];
const T = lib === 'three' ? await import('three') : await import('../../src/index.js');
const sc = scenarios[name];
const { scene, update } = sc.build(T, sc.n);
const skeletons = []; scene.traverse(o => { if (o.isSkinnedMesh) skeletons.push(o.skeleton); });
const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
const tm = { mixer: [], world: [], skel: [], total: [] };
for (let f = 0; f < 400; f++) {
	const t0 = performance.now();
	if (update) update(f);
	const t1 = performance.now();
	scene.updateMatrixWorld();
	const t2 = performance.now();
	for (let i = 0; i < skeletons.length; i++) skeletons[i].update();
	const t3 = performance.now();
	if (f >= 100) { tm.mixer.push(t1 - t0); tm.world.push(t2 - t1); tm.skel.push(t3 - t2); tm.total.push(t3 - t0); }
}
console.log(`${lib} ${name}: mixer ${med(tm.mixer).toFixed(3)}  matrixWorld ${med(tm.world).toFixed(3)}  skeleton.update ${med(tm.skel).toFixed(3)}  total ${med(tm.total).toFixed(3)} ms (medians of 300 frames)`);
