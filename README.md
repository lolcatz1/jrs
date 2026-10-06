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

| shader-client: 1,313 meshes, all ShaderMaterial, 12 shaders × 2 material instances each sharing one 30-uniform object, 2D/3D/array/cube samplers, custom attributes, opaque + transparent (no auto-batching possible) | 1,313 | 25.5 ms | 9.7 ms | **2.6x** | 1313 → 1313 | 0.002 / 44 (41 edge pixels) |
| shader-client-static: same materials, fixed camera, nothing moving, 3 passes per frame (2 shadow render targets with `scene.overrideMaterial`, main pass with stencil shadow volumes), ~215 draws per pass | 211 | 34.4 ms | 36.5 ms | 0.94x (fill-bound) | 651 → 649 | 0.001 / 10 (11 edge pixels) |

The instanced scenario is a single draw call in both libraries; it measures only the fixed per-frame cost. Full data: `bench/results/latest.json`.

The two `shader-client` rows model a real three.js game client. Their gain comes from the per-draw
path, not from batching: every uniform location caches its last uploaded value (as three.js does), so
shared uniforms, camera matrices and per-object matrices are only re-sent when they change; a
validated-VAO fast path; cached front-face orientation; opaque sorting by program, material and
geometry; `ShaderMaterial` instances that share a shader (same source, defines and parameters) share
one program and one uniform cache, exactly as in three.js. The bench counts GL calls for one frame per
library and, for multi-pass scenes, per `render()` call. Static scene, per pass (three → jrs): shadow
render targets `uniform*` 147 → 147, main pass 184 → 184, `useProgram` 17 → 16, `bindTexture`
44 → 44, total GL calls 1,869 → 1,620. The remaining edge-pixel differences come from float32
matrices (geometry at ±450 units); they are identical between this and the previous engine version.

Diagnosing uploads in your own app: set `renderer.debug.traceUniforms = true` and read
`renderer.debug.uniformTrace` (last 16 `render()` calls: uniform name → upload count, program
switches, draws, distinct programs, and `programSequence`, one entry per `useProgram` as
`<program id><list o/t/s>[/r<renderOrder>]:<material type>`). `renderer.info.render.programSwitches`
counts `useProgram` calls per frame. `renderer.autoBatchMinimum` (default 4) is the shortest run of
identical geometry + material that becomes one instanced draw.

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
  `depthTest/Write`, polygon offset, `alphaToCoverage`, `premultipliedAlpha`, `dithering`, and the
  full stencil state (`stencilWrite`, `stencilFunc/Ref/FuncMask`, `stencilWriteMask`,
  `stencilFail/ZFail/ZPass`) for stencil-shadow and masking techniques.
* **ShaderMaterial** gets the same treatment as in three.js: the identical prefix (precision,
  `SHADER_TYPE`/`SHADER_NAME`, your `defines`, feature defines, built-in uniforms and attributes),
  `#include <chunk>` resolution from the complete ported `ShaderChunk` library, `UniformsLib`,
  `#pragma unroll_loop`, GLSL 1.00 to ES 3.00 shims (`gl_FragColor`, `texture2D`, …), custom
  vertex attributes, `InstancedBufferGeometry` / `InstancedBufferAttribute`, struct and array
  uniforms, arrays of textures, and `sampler2D` / `sampler3D` / `sampler2DArray` / `samplerCube`
  uniforms. Fog uniforms and `toneMappingExposure` are filled from the scene and renderer.
  `lights: true` (scene-driven light uniforms) is not implemented.
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
* **Textures & loaders:** `Texture`, `CanvasTexture`, `DataTexture`, `Data3DTexture`,
  `DataArrayTexture` (with `layerUpdates`), `CubeTexture`, `DepthTexture`, `TextureLoader`,
  `ImageLoader`, `FileLoader`, `LoadingManager`, `Cache`.
* **Helpers & addon support:** `AxesHelper`, `GridHelper`, `BoxHelper`; `Controls` base class, draw-mode
  constants and `InterleavedBuffer`/`InterleavedBufferAttribute` so three's `examples/jsm` addons such as
  `OrbitControls` and `BufferGeometryUtils` import and run unchanged through an import map
  (`"three/addons/": "<three>/examples/jsm/"`). Verified with `node bench/addons.mjs`.

Not implemented (yet): environment maps / IBL on built-in materials, point-light shadows,
skinning and morph targets, clipping planes, `Scene.background` textures, `ShaderMaterial`
`lights: true`, `onBeforeCompile` for built-in materials, rendering of `InterleavedBufferAttribute`
geometry (the classes exist for API compatibility),
post-processing, loaders beyond textures (GLTFLoader etc. live in three's `examples/`, as do
the controls), WebGL1.

### Behavioural differences to know about

* `Matrix4.elements` / `Matrix3.elements` are `Float32Array`s. Code that does
  `matrix.elements.push(...)` or relies on double precision in matrices needs adjusting.
* Opaque objects are grouped by shader/material/geometry instead of sorted front-to-back.
* Lights are limited to 4 directional, 8 point, 4 spot and 2 hemisphere per scene.
* `renderer.info.render` has two extra counters: `batches` and `instances`. `renderer.info.memory.geometries`
  counts geometries the renderer has uploaded, like three.js.
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

## Checking a real device

Open `bench/conformance.html` from any static host (GitHub Pages, `npm run bench:serve` then
`http://<your-machine>:8765/bench/conformance.html` on the phone). It reports the device's WebGL2
limits, runs 23 rendering checks with pixel probes (lighting, batching vs. individual draws,
instancing, transparency, 2D/3D/array/cube textures, stencil, fog, shadows, sprites,
ShaderMaterial with chunks and custom attributes, render targets, raycasting), times a 2 000-object scene, and when a CDN is reachable runs the same scene with
three.js for a side-by-side number. "Copy report" puts the JSON on the clipboard.
`node bench/conformance.mjs` runs the same page in headless Chromium.

## Using the single-file build (import map swap)

`npm run build` writes `build/jrs.module.js` and `build/jrs.module.min.js` (both committed). To put
jrs behind a URL flag in an app that imports `three` through an import map:

```html
<script>
	const useJrs = new URLSearchParams(location.search).get('renderer') === 'jrs';
	document.write(`<script type="importmap">${JSON.stringify({
		imports: { three: useJrs ? './vendor/jrs/build/jrs.module.js' : './vendor/three/build/three.module.js' }
	})}<\/script>`);
</script>
<script type="module" src="./app.js"></script>
```

Everything that does `import * as THREE from 'three'` then resolves to jrs when the page is opened
with `?renderer=jrs`, and to three.js otherwise. Create the renderer with `{ stencil: true }` if you
use stencil techniques; three.js and jrs both default to no stencil buffer.
