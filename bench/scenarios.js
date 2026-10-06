// Benchmark scenarios. Each builds the same scene with either library (`T` is the module namespace).
// Returns { scene, camera, update(frame) } ; update is optional per-frame animation.

function grid(i, n, spacing) {
	const side = Math.ceil(Math.cbrt(n));
	const x = i % side, y = Math.floor(i / side) % side, z = Math.floor(i / (side * side));
	return [(x - side / 2) * spacing, (y - side / 2) * spacing, (z - side / 2) * spacing];
}

export const scenarios = {
	// Many objects, one geometry + one material. The common "lots of the same thing" case.
	'shared-static': {
		n: 10000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 60); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.5));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const geometry = new T.BoxGeometry(0.5, 0.5, 0.5);
			const material = new T.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.6 });
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, material);
				const p = grid(i, n, 1.2); m.position.set(p[0], p[1], p[2]);
				m.rotation.set(i * 0.1, i * 0.2, 0);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// Same scene but every object rotates every frame.
	'shared-animated': {
		n: 10000,
		build(T, n) {
			const r = scenarios['shared-static'].build(T, n);
			const meshes = r.scene.children.filter(o => o.isMesh);
			r.update = (f) => { for (let i = 0; i < meshes.length; i++) { meshes[i].rotation.y = f * 0.01 + i; } };
			return r;
		}
	},
	// 5000 objects spread over 200 materials (different colours): partial batching, state sorting.
	'many-materials': {
		n: 5000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 45); camera.lookAt(0, 0, 0);
			scene.add(new T.HemisphereLight(0xffffff, 0x444444, 1.5));
			const pl = new T.PointLight(0xffffff, 200, 0, 2); pl.position.set(5, 10, 10); scene.add(pl);
			const geometries = [new T.BoxGeometry(0.5, 0.5, 0.5), new T.SphereGeometry(0.3, 12, 8), new T.ConeGeometry(0.3, 0.6, 10)];
			const materials = [];
			for (let i = 0; i < 200; i++) materials.push(new T.MeshPhongMaterial({ color: new T.Color().setHSL(i / 200, 0.7, 0.5), shininess: 40 }));
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometries[i % 3], materials[(i * 7) % 200]);
				const p = grid(i, n, 1.3); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// 2000 distinct geometries (no two meshes share one): no batching possible, pure per-draw overhead.
	'unique-geometries': {
		n: 2000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 0, 35); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const material = new T.MeshLambertMaterial({ color: 0xffcc66 });
			for (let i = 0; i < n; i++) {
				const g = new T.BoxGeometry(0.4 + (i % 5) * 0.05, 0.4, 0.4, 1 + (i % 2), 1, 1);
				const m = new T.Mesh(g, material);
				const p = grid(i, n, 1.4); m.position.set(p[0], p[1], p[2]);
				scene.add(m);
			}
			return { scene, camera };
		}
	},
	// Deep hierarchy with animated root: tests world-matrix propagation.
	'hierarchy-animated': {
		n: 8000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 10, 60); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const geometry = new T.BoxGeometry(0.4, 0.4, 0.4);
			const material = new T.MeshBasicMaterial({ color: 0x66ccff });
			const roots = [];
			const perRoot = 40;
			for (let r = 0; r < n / perRoot; r++) {
				const root = new T.Group();
				const p = grid(r, n / perRoot, 6); root.position.set(p[0], p[1], p[2]);
				let parent = root;
				for (let i = 0; i < perRoot; i++) {
					const m = new T.Mesh(geometry, material);
					m.position.set(0.5, 0.1, 0); m.rotation.z = 0.15;
					parent.add(m); parent = m;
				}
				scene.add(root); roots.push(root);
			}
			return { scene, camera, update: (f) => { for (let i = 0; i < roots.length; i++) roots[i].rotation.y = f * 0.01 + i; } };
		}
	},
	// One InstancedMesh with 100k instances: GPU-side instancing in both libraries.
	'instanced-100k': {
		n: 100000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 1000);
			camera.position.set(0, 0, 120); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.6));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(1, 2, 3); scene.add(sun);
			const im = new T.InstancedMesh(new T.BoxGeometry(0.4, 0.4, 0.4), new T.MeshLambertMaterial({ color: 0xff8844 }), n);
			const m4 = new T.Matrix4();
			for (let i = 0; i < n; i++) { const p = grid(i, n, 1.1); m4.makeTranslation(p[0], p[1], p[2]); im.setMatrixAt(i, m4); }
			scene.add(im);
			return { scene, camera };
		}
	},
	// Shadows: 2000 casters/receivers under a shadow-casting directional light.
	'shadows': {
		n: 2000,
		build(T, n) {
			const scene = new T.Scene();
			const camera = new T.PerspectiveCamera(60, 4 / 3, 0.1, 500);
			camera.position.set(0, 25, 45); camera.lookAt(0, 0, 0);
			scene.add(new T.AmbientLight(0xffffff, 0.4));
			const sun = new T.DirectionalLight(0xffffff, 2); sun.position.set(20, 40, 10); sun.castShadow = true;
			sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 200;
			sun.shadow.mapSize.set(1024, 1024);
			scene.add(sun);
			const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshLambertMaterial({ color: 0xcccccc }));
			floor.rotation.x = -Math.PI / 2; floor.position.y = -8; floor.receiveShadow = true; scene.add(floor);
			const geometry = new T.BoxGeometry(0.6, 0.6, 0.6);
			const material = new T.MeshLambertMaterial({ color: 0x8899ff });
			for (let i = 0; i < n; i++) {
				const m = new T.Mesh(geometry, material);
				const p = grid(i, n, 1.5); m.position.set(p[0], p[1], p[2]);
				m.castShadow = true; m.receiveShadow = true;
				scene.add(m);
			}
			return { scene, camera };
		}
	},
};
