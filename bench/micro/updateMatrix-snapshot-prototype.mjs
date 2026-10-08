// Prototype 2: typed-array snapshot + per-class closure copies of updateMatrix/updateMatrixWorld so each copy's
// inline caches only ever see one receiver map (Mesh gets its own copy; everything else shares the base copy).
import { Scene, Mesh, Group, Object3D, AmbientLight, DirectionalLight, BoxGeometry, MeshBasicMaterial, PerspectiveCamera } from '../../src/index.js';
const variant = process.argv[2] || 'perclass';
const makeUpdateMatrix = () => function updateMatrix() {
	let d = this._snap; if (d === undefined) { d = this._snap = new Float64Array(10); d[0] = NaN; }
	const p = this.position, q = this.quaternion, s = this.scale;
	if (p.x === d[0] && p.y === d[1] && p.z === d[2] && q._x === d[3] && q._y === d[4] && q._z === d[5] && q._w === d[6] && s.x === d[7] && s.y === d[8] && s.z === d[9]) return false;
	d[0] = p.x; d[1] = p.y; d[2] = p.z; d[3] = q._x; d[4] = q._y; d[5] = q._z; d[6] = q._w; d[7] = s.x; d[8] = s.y; d[9] = s.z;
	this.matrix.compose(p, q, s);
	this.matrixWorldNeedsUpdate = true;
	return true;
};
const makeUpdateMatrixWorld = () => function updateMatrixWorld(force) {
	if (this.matrixAutoUpdate) this.updateMatrix();
	const parent = this.parent;
	if (this.matrixWorldNeedsUpdate || force || (parent !== null && parent._worldVersion !== this._parentWorldVersion)) {
		if (this.matrixWorldAutoUpdate === true) {
			if (parent === null) this._matrixWorld.copy(this._matrix);
			else { this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix); this._parentWorldVersion = parent._worldVersion; }
			this._worldVersion++;
		}
		this.matrixWorldNeedsUpdate = false;
		force = true;
	}
	const children = this.children;
	for (let i = 0, l = children.length; i < l; i++) children[i].updateMatrixWorld(force);
};
if (variant === 'perclass' || variant === 'snaponly') {
	Object3D.prototype.updateMatrix = makeUpdateMatrix(); Object3D.prototype.updateMatrixWorld = makeUpdateMatrixWorld();
	if (variant === 'perclass') { Mesh.prototype.updateMatrix = makeUpdateMatrix(); Mesh.prototype.updateMatrixWorld = makeUpdateMatrixWorld(); }
}
const scene = new Scene();
const g = new BoxGeometry(), m = new MeshBasicMaterial();
scene.add(new AmbientLight()); scene.add(new DirectionalLight()); scene.add(new Group()); scene.add(new PerspectiveCamera());
for (let i = 0; i < 10000; i++) { const o = new Mesh(g, m); o.position.set(i * 0.1, i * 0.2, 0.5); o.rotation.set(i * 0.1, i * 0.2, 0); scene.add(o); }
for (let f = 0; f < 50; f++) scene.updateMatrixWorld();
global.gc && global.gc();
const h0 = process.memoryUsage().heapUsed;
const t0 = performance.now();
for (let f = 0; f < 200; f++) scene.updateMatrixWorld();
const dt = (performance.now() - t0) / 200;
console.log(variant, 'mixed maps: ms/frame', dt.toFixed(3), 'heap delta KB/frame', ((process.memoryUsage().heapUsed - h0) / 1024 / 200).toFixed(1));
