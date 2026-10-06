# jrs

**A faster drop-in alternative to three.js.** Same class names, same scene graph, same
materials, same math library and the same `renderer.render(scene, camera)` call, built on a
different engine: a change-detected scene graph, slab-allocated matrices, comparator-free
sorting, automatic draw-call batching, uniform blocks and a lazily built BVH for raycasting.

```js
import * as THREE from 'jrs'; // or: import { Scene, Mesh, ... } from 'jrs'

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 5;

const mesh = new THREE.Mesh(
	new THREE.BoxGeometry(1, 1, 1),
	new THREE.MeshStandardMaterial({ color: 0x8899ff, roughness: 0.5 })
);
scene.add(mesh);
scene.add(new THREE.DirectionalLight(0xffffff, 3).translateX(2).translateY(3));
scene.add(new THREE.AmbientLight(0xffffff, 0.3));

renderer.setAnimationLoop(() => {
	mesh.rotation.y += 0.01;
	renderer.render(scene, camera);
});
```

If that looks exactly like three.js, that is the point. Rename the import and the rest of the
application keeps working. WebGL2 is required (every current browser has it).

## Why it is faster

| three.js | jrs |
|----------|-----|
| Recomposes and remultiplies **every** object's matrices every frame | Only objects whose position/rotation/scale (or ancestor) changed are touched; everything derived (normal matrix, bounding sphere, instance data) is cached by a per-object version counter |
| 16-element `Array`s of doubles per matrix, converted on every upload | `Float32Array` records in shared slab pages; uploaded with zero-copy `srcOffset` calls |
| Sorts an array of item objects with a JS comparator | Packs a 52-bit key per item into a `Float64Array` and uses the native comparator-free sort |
| One draw call per mesh | Consecutive meshes sharing geometry and material become **one instanced draw call**; static scenes skip the instance-buffer upload entirely |
| Re-sends camera, light and material uniforms per draw/material | Camera, lights and all materials live in std140 uniform blocks: one upload per frame, one `bindBufferRange` per material switch |
| Recompiles all shaders when the light count changes | Fixed-capacity light arrays, counts read from the block: no recompiles |
| Raycasts test every triangle | Lazy bounding-volume hierarchy per geometry, built on first raycast |

Details, with the reasoning behind each choice, are in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Benchmarks

`npm run bench` renders identical scenes with three.js r186 and jrs in headless Chromium
(SwiftShader software WebGL2, so the numbers are CPU-bound frame costs; a real GPU widens the
gap for draw-call-bound scenes and narrows it for fill-bound ones). Average JS time per frame
over 60 frames after 10 warm-up frames, 320x240:

| Scenario | Objects | three.js r186 | jrs | Speed-up | Draw calls (three → jrs) | Pixel diff (mean / max, 0–255) |
|---|---:|---:|---:|---:|---|---|
| shared-static: one geometry + one material, static | 10,000 | 27.17 ms | 3.74 ms | **7.26x** | 10000 → 1 | 0.347 / 8 |
| shared-animated: same, every object rotating | 10,000 | 19.63 ms | 5.54 ms | **3.54x** | 10000 → 1 | 0.346 / 9 |
| many-materials: 3 geometries x 200 Phong materials, point + hemisphere light | 5,000 | 12.41 ms | 3.29 ms | **3.78x** | 5000 → 600 | 0 / 0 |
| unique-geometries: a distinct geometry per mesh (no batching possible) | 2,000 | 6.22 ms | 3.31 ms | **1.88x** | 2000 → 2000 | 0 / 0 |
| hierarchy-animated: 200 chains of 40 nested objects, roots rotating | 8,000 | 25.25 ms | 4.09 ms | **6.18x** | 8000 → 1 | 0 / 0 |
| instanced-100k: one InstancedMesh, 100 000 instances | 100,000 | 0.05 ms | 0.06 ms | **0.96x** | 1 → 1 | 0 / 0 |
| shadows: 2 000 casters/receivers, 1024² directional shadow map | 2,000 | 71.03 ms | 1.28 ms | **55.49x** | 4001 → 3 | 0.134 / 33 |

The instanced scenario is a single draw call in both libraries; it measures only the fixed per-frame cost. Full data: `bench/results/latest.json`.

`npm run bench -- --compare` additionally renders each scene with both libraries and reports
the mean absolute pixel difference, writing both images to `bench/results/`. Lambert / Phong /
Basic scenes are pixel-identical; Standard-material scenes differ by a few levels because jrs
does not implement three.js's environment multi-scatter term.

## Compatibility

Implemented with the three.js API and semantics (r186 conventions: linear working colour
space, sRGB output, physically based light units):

* **Core:** `Object3D`, `Scene`, `Group`, `Mesh`, `InstancedMesh`, `Line`, `LineSegments`,
  `LineLoop`, `Points`, `Sprite`, `BufferGeometry`, `BufferAttribute` (all typed variants),
  `InstancedBufferAttribute`, `InstancedBufferGeometry`, `Raycaster`, `Layers`, `Clock`, `Timer`,
  `EventDispatcher`.
* **Cameras:** `PerspectiveCamera`, `OrthographicCamera` (incl. view offsets, zoom, film offset).
* **Materials:** `MeshBasicMaterial`, `MeshLambertMaterial`, `MeshPhongMaterial`,
  `MeshStandardMaterial` (`MeshPhysicalMaterial` renders as Standard), `MeshNormalMaterial`,
  `MeshDepthMaterial`, `LineBasicMaterial`, `LineDashedMaterial` (solid), `PointsMaterial`,
  `SpriteMaterial`, `ShaderMaterial`, `RawShaderMaterial`. Maps: `map`, `alphaMap`, `normalMap`,
  `emissiveMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `specularMap`; vertex colours,
  `flatShading`, `wireframe`, `alphaTest`, transparency and all blending modes, `side`,
  `depthTest/Write`, polygon offset, `alphaToCoverage`, `premultipliedAlpha`, `dithering`.
* **Lights:** `AmbientLight`, `HemisphereLight`, `DirectionalLight`, `PointLight`, `SpotLight`
  (`RectAreaLight` is accepted but not shaded). Shadow maps for directional and spot lights
  (`castShadow`, `receiveShadow`, `shadow.mapSize/bias/normalBias/radius/camera`).
* **Scene:** `Fog`, `FogExp2`, `background` colour, `renderOrder`, `visible`, `frustumCulled`,
  `onBeforeRender/onAfterRender`, tone mapping (`Linear`, `Reinhard`, `Cineon`, `ACESFilmic`,
  `Neutral`), `outputColorSpace`, render targets (`WebGLRenderTarget`, `DepthTexture`).
* **Geometries:** Box, Plane, Sphere, Cylinder, Cone, Torus, TorusKnot, Circle, Ring, Capsule,
  Lathe, Tube, Polyhedron/Icosahedron/Octahedron/Tetrahedron/Dodecahedron, Edges, Wireframe,
  with `CatmullRomCurve3`, `LineCurve3`, `QuadraticBezierCurve3`. Output is bit-identical to
  three.js and builds 2–13x faster (pre-sized typed arrays).
* **Math:** `Vector2/3/4`, `Matrix3/4`, `Quaternion`, `Euler`, `Color` + `ColorManagement`,
  `Box3`, `Sphere`, `Plane`, `Ray`, `Frustum`, `Triangle`, `Line3`, `Spherical`, `MathUtils`.
* **Textures & loaders:** `Texture`, `CanvasTexture`, `DataTexture`, `DepthTexture`,
  `TextureLoader`, `ImageLoader`, `FileLoader`, `LoadingManager`, `Cache`.
* **Helpers:** `AxesHelper`, `GridHelper`, `BoxHelper`.

Not implemented (yet): environment maps / IBL, point-light shadows, skinning and morph
targets, clipping planes, `Scene.background` textures, post-processing, loaders beyond
textures (GLTFLoader etc. live in three's `examples/`, as do the controls), WebGL1.

### Behavioural differences to know about

* `Matrix4.elements` / `Matrix3.elements` are `Float32Array`s. Code that does
  `matrix.elements.push(...)` or relies on double precision in matrices needs adjusting.
* Opaque objects are grouped by shader/material/geometry instead of sorted front-to-back.
* Lights are limited to 4 directional, 8 point, 4 spot and 2 hemisphere per scene.
* `renderer.info.render` has two extra counters: `batches` and `instances`.
* `renderer.autoBatch` (default `true`) toggles automatic instancing.
* `geometry.boundsTree`, `computeBoundsTree()`, `disposeBoundsTree()` and the `MeshBVH` class are
  additions.

## Development

```sh
npm install        # pulls three.js (for parity tests and benchmarks) and playwright-core
npm test           # 100 parity tests against three.js r186 (math, scene graph, raycasting, geometries)
npm run bench      # headless benchmark, all scenarios; add scenario names or --compare
node bench/smoke.mjs   # end-to-end rendering checks in headless Chromium
```

The tests construct the same objects with both libraries from the same seeded random inputs
and compare results numerically, so every API listed above is checked for identical behaviour,
not just for existing.

## License

MIT. Geometry generators and parts of the math library are ported from three.js (MIT,
© 2010-2026 three.js authors).
