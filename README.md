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
| One draw call per mesh | Consecutive meshes sharing geometry and material become **one instanced draw call**; runs of *different* geometries sharing a material become **one multi-draw call** over shared mega-buffers with a `gl_DrawID`-indexed matrix texture; batches also **span materials** that share a program, GL state and textures (each instance picks its material record from a uniform-block array); static scenes skip the uploads entirely |
| Re-sends camera, light and material uniforms per draw/material | Camera, lights and all materials live in std140 uniform blocks: one upload per frame, one `bindBufferRange` per material switch |
| Recompiles all shaders when the light count changes | Fixed-capacity light arrays, counts read from the block: no recompiles |
| Raycasts test every triangle | Lazy bounding-volume hierarchy per geometry, built on first raycast |

Details, with the reasoning behind each choice, are in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Benchmarks

`npm run bench` renders identical scenes with three.js r186 and jrs in headless Chromium
(SwiftShader software WebGL2, so the numbers are CPU-bound frame costs; a real GPU widens the
gap for draw-call-bound scenes and narrows it for fill-bound ones). Average JS time per frame
over 60 frames after 10 warm-up frames, 320x240 (median frame time, so single garbage-collection or driver stalls do not define the number; the raw data has means and worst frames):

| Scenario | Objects | three.js r186 (median) | jrs (median) | Speed-up | Worst frame (three → jrs) | Draw calls (three → jrs) | Pixel diff (mean / max, 0–255) |
|---|---:|---:|---:|---:|---|---|---|
| shared-static: one geometry + one material, static | 10,000 | 10.9 ms | 0.8 ms | **13.6x** | 123 → 1 ms | 10000 → 1 | 0 / 0 |
| shared-animated: same, every object rotating | 10,000 | 13.4 ms | 4.6 ms | **2.9x** | 82 → 18 ms | 10000 → 1 | 0 / 1 |
| many-materials: 3 geometries x 200 Phong materials, point + hemisphere light (batches span materials) | 5,000 | 7.0 ms | 0.6 ms | **11.7x** | 87 → 1 ms | 5000 → 3 | 0 / 0 |
| unique-geometries: a distinct geometry per mesh (multi-draw over the mega-buffer) | 2,000 | 3.6 ms | 0.6 ms | **6.0x** | 59 → 1 ms | 2000 → 1 | 0 / 0 |
| hierarchy-animated: 200 chains of 40 nested objects, roots rotating | 8,000 | 13.1 ms | 3.9 ms | **3.4x** | 40 → 2524 ms | 8000 → 1 | 0 / 0 |
| instanced-100k: one InstancedMesh, 100 000 instances | 100,000 | 0.0 ms | 0.0 ms | n/a (both < 0.1 ms) | 0 → 0 ms | 1 → 1 | 0 / 0 |
| shader-client: 1,313 meshes, all ShaderMaterial, 12 shaders × 2 material instances sharing one 30-uniform object, 2D/3D/array/cube samplers, custom attributes, opaque + transparent (no auto-batching possible) | 1,313 | 4.4 ms | 2.7 ms | **1.6x** | 24 → 194 ms | 1313 → 1313 | 0 / 0 |
| shader-client-static: same materials, fixed camera, nothing moving, 3 passes per frame (2 shadow render targets with `scene.overrideMaterial`, main pass with stencil shadow volumes), ~215 draws per pass | 211 | 33.3 ms | 33.5 ms | **1.0x** | 613 → 554 ms | 217 → 217 | 0 / 0 |
| shadows: 2 000 casters/receivers, 1024² directional shadow map | 2,000 | 69.5 ms | 0.3 ms | **231.7x** | 165 → 1 ms | 4001 → 2 | 0 / 0 |
| shadows-animated: same scene, every third caster moving each frame | 2,000 | 74.7 ms | 1.5 ms | **49.8x** | 193 → 3 ms | 4001 → 3 | 0 / 0 |
| skinned-crowd: 200 skinned meshes, 20 bones each, every bone animated by an `AnimationMixer` | 200 | 3.4 ms | 2.8 ms | **1.2x** | 435 → 534 ms | 200 → 200 | 0 / 2 |
| transparent-sort: 10 000 transparent boxes, orbiting camera (depth re-sort every frame) | 10,000 | 11.8 ms | 3.9 ms | **3.0x** | 44 → 1667 ms | 10000 → 1 | 0 / 0 |
| dynamic-geometry: 200 meshes rewriting vertex data every frame (full and ranged updates, growth, rebuilds) | 200 | 0.9 ms | 1.1 ms | **0.8x** | 127 → 166 ms | 200 → 200 | 0 / 0 |
| dynamic-geometry-large: 12 large meshes, ~3.7 MB of vertex data rewritten per frame | 12 | 2.4 ms | 2.5 ms | **1.0x** | 10 → 7 ms | 12 → 12 | 0 / 0 |
| shadows-point: 2 000 casters, one shadow-casting point light (cube depth map) | 2,000 | 76.9 ms | 0.3 ms | **256.3x** | 202 → 1 ms | 4001 → 2 | 0 / 0 |
| shadows-point-animated: same, a third of the casters moving | 2,000 | 72.8 ms | 1.8 ms | **40.4x** | 170 → 6 ms | 4001 → 3 | 0 / 0 |
| shadows-point-multi: directional + spot + two point shadows + one unshadowed point light | 400 | 48.0 ms | 0.2 ms | **240.0x** | 70 → 1 ms | 2031 → 2 | 0 / 1 |

The instanced scenario is a single draw call in both libraries; it measures only the fixed per-frame cost. Full data: `bench/results/latest.json`.

Worst frames: in this software-GL environment both libraries hit occasional stalls (garbage collection, driver, command-buffer back-pressure), so read the ratios, not the absolute numbers. Pixel differences are now 0 mean / ≤ 2 levels on every scene after the differential fuzzer's parity fixes (`npm run fuzz`, see `bench/results/swarm/parity-fuzzer.md`). The 12–17 s stalls jrs used to show in the batched scenes were traced to Chromium's transfer ring buffer on large `texSubImage2D` uploads of the matrix texture; the texture is now defined with `texImage2D` per upload, which takes the mapped-memory path, and that stall is gone (`bench/results/swarm/stall-hunter.md`). A rarer 1–3 s stall remains in 60-frame runs of the batched scenes; it also appears in three.js at smaller sizes and is still being investigated. The device check page reports per-frame times on real hardware.

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
identical geometry + material that becomes one instanced draw. `renderer.autoBatchMaterials`
(default true) lets a batch span built-in materials that share a program, GL state and textures:
each instance reads its own material record from a uniform-block array indexed by a slot stored
with its matrices (see ARCHITECTURE.md §4c; needs dynamic indexing of uniform arrays, probed at
start-up).

`npm run bench -- --compare` additionally renders each scene with both libraries and reports
the mean absolute pixel difference, writing both images to `bench/results/`. Lambert / Phong /
Basic scenes are pixel-identical; Standard-material scenes differ by a few levels because jrs
does not implement three.js's environment multi-scatter term.

## Compatibility

Implemented with the three.js API and semantics (r186 conventions: linear working colour
space, sRGB output, physically based light units):

* **Core:** `Object3D`, `Scene`, `Group`, `Mesh`, `InstancedMesh`, `SkinnedMesh`, `Skeleton`, `Bone`,
  `Line`, `LineSegments`, `LineLoop`, `Points`, `Sprite`, `BufferGeometry`, `BufferAttribute` (all typed
  variants), `InstancedBufferAttribute`, `InstancedBufferGeometry`, `Raycaster`, `Layers`, `Clock`,
  `Timer`, `EventDispatcher`.
* **Skinning & morph targets:** `SkinnedMesh` (`bind`, `bindMode` attached/detached, `pose`,
  `normalizeSkinWeights`, skinned `raycast` / `computeBoundingBox` / `computeBoundingSphere`),
  `Skeleton` (`update`, `computeBoneTexture`, `getBoneByName`, JSON), bone texture skinning with
  `skinIndex` / `skinWeight`; geometry `morphAttributes.position / normal / color`, `morphTargetsRelative`,
  `morphTargetInfluences` / `morphTargetDictionary` through the same morph texture layout as three r186.
  Pixel-identical to three.js (see the conformance checks). Skinned and morphed meshes draw individually
  (they are excluded from auto-batching).
* **Animation:** `AnimationMixer`, `AnimationAction`, `AnimationClip`, `AnimationObjectGroup`,
  `AnimationUtils`, `KeyframeTrack` and the Number/Vector/Quaternion/Color/Boolean/String tracks,
  `PropertyBinding`, `PropertyMixer`, and the Linear / Discrete / Cubic / Bezier / QuaternionLinear
  interpolants: the three.js r186 sources, verified against three.js by sampling the same clips.
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
  (`RectAreaLight` is accepted but not shaded). Shadow maps for directional, spot and point lights
  (`castShadow`, `receiveShadow`, `shadow.mapSize/bias/normalBias/radius/camera`). Point lights render a six-face cube depth map
  and are sampled exactly as in three r186 (`PCFShadowMap`, `BasicShadowMap`); at most 4 point lights cast shadows at once,
  sharing texture units 8-14 with directional and spot shadow maps. `VSMShadowMap` is not supported for point lights (three skips them too).
* **Scene:** `Fog`, `FogExp2`, `background` colour, `renderOrder`, `visible`, `frustumCulled`,
  `onBeforeRender/onAfterRender`, tone mapping (`Linear`, `Reinhard`, `Cineon`, `ACESFilmic`,
  `Neutral`), `outputColorSpace`, render targets (`WebGLRenderTarget`, `DepthTexture`).
* **Geometries:** Box, Plane, Sphere, Cylinder, Cone, Torus, TorusKnot, Circle, Ring, Capsule,
  Lathe, Tube, Polyhedron/Icosahedron/Octahedron/Tetrahedron/Dodecahedron, Edges, Wireframe,
  with `CatmullRomCurve3`, `LineCurve3`, `QuadraticBezierCurve3`. Output is bit-identical to
  three.js and builds 2–13x faster (pre-sized typed arrays).
* **Math:** `Vector2/3/4`, `Matrix3/4`, `Quaternion`, `Euler`, `Color` + `ColorManagement`,
  `Box3`, `Sphere`, `Plane`, `Ray`, `Frustum`, `Triangle`, `Line3`, `Spherical`, `MathUtils`.
* **Textures & loaders:** `Texture`, `CanvasTexture`, `VideoTexture`, `DataTexture`, `Data3DTexture`,
  `DataArrayTexture` (with `layerUpdates`), `CubeTexture`, `DepthTexture`, `FramebufferTexture`,
  `CompressedTexture`, `CompressedArrayTexture`, `CompressedCubeTexture` (S3TC / ETC / ASTC / BPTC / RGTC when the
  GPU exposes the extension), `TextureLoader`, `CubeTextureLoader`, `CompressedTextureLoader`, `DataTextureLoader`,
  `ImageLoader`, `FileLoader`, `LoadingManager`, `Cache`, `DataUtils`, `TextureUtils`; `renderer.copyTextureToTexture`,
  `copyFramebufferToTexture`, `initTexture`, `initRenderTarget`. Uploads follow three r186's `WebGLTextures`
  (shared GL textures per `Source`, per-class storage paths); `node bench/textures.mjs` compares ~340 texture cases pixel for
  pixel with three (see ARCHITECTURE.md §12 and `bench/results/swarm/texture-formats.md`).
* **Helpers & addon support:** `AxesHelper`, `GridHelper`, `BoxHelper`; `Controls` base class, draw-mode
  constants and `InterleavedBuffer`/`InterleavedBufferAttribute` so three's `examples/jsm` addons such as
  `OrbitControls` and `BufferGeometryUtils` import and run unchanged through an import map
  (`"three/addons/": "<three>/examples/jsm/"`). Verified with `node bench/addons.mjs`.

Not implemented (yet): environment maps / IBL on built-in materials,
`InstancedMesh` morph targets (`morphTexture`), `SkeletonHelper`, clipping planes, `Scene.background` textures, `ShaderMaterial`
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
* `renderer.autoBatch` (default `true`) toggles automatic batching; `renderer.autoMultiDraw` (default `true`)
  toggles the multi-draw form (needs `WEBGL_multi_draw`, present in current Chrome, Firefox and Safari);
  `renderer.autoBatchMinimum` (default 4) is the shortest run that is batched.
* `geometry.boundsTree`, `computeBoundsTree()`, `disposeBoundsTree()` and the `MeshBVH` class are
  additions.

## Development

```sh
npm install        # pulls three.js (for parity tests and benchmarks) and playwright-core
npm test           # 100 parity tests against three.js r186 (math, scene graph, raycasting, geometries)
npm run bench      # headless benchmark, all scenarios; add scenario names or --compare
node bench/smoke.mjs   # end-to-end rendering checks in headless Chromium
npm run fuzz           # differential fuzzer: random scenes rendered with three.js and jrs, pixels compared per frame
```

`npm run fuzz -- --seeds=200` builds 200 seeded random scenes (geometries, materials, maps, blending,
stencil, fog, lights, shadows, instancing, hierarchies, render targets, override materials, tone
mapping, camera moves) with both libraries and fails on the first frame whose pixels differ beyond the
tolerances of `bench/results/latest.json`; `--seed=N` reproduces one and writes both images plus a diff
to `bench/results/fuzz/`. See `bench/results/swarm/parity-fuzzer.md` for coverage and known exclusions.

The tests construct the same objects with both libraries from the same seeded random inputs
and compare results numerically, so every API listed above is checked for identical behaviour,
not just for existing.

## License

MIT. Geometry generators and parts of the math library are ported from three.js (MIT,
© 2010-2026 three.js authors).

## Checking a real device

Open `bench/conformance.html` from any static host (GitHub Pages, `npm run bench:serve` then
`http://<your-machine>:8765/bench/conformance.html` on the phone). It reports the device's WebGL2
limits, runs 28 rendering checks with pixel probes (lighting, batching vs. individual draws,
multi-draw of mixed geometries vs. individual draws, instancing, transparency, 2D/3D/array/cube
textures, stencil, fog, shadows, sprites, ShaderMaterial with chunks, shared programs and custom
attributes, render targets, raycasting, skinning, morph targets and the animation mixer), times a 2 000-object scene, and
when three.js can be loaded (the local copy, else a CDN) renders the skinning / morph scenes with both libraries and compares
the pixels, and runs the same scene with three.js for a side-by-side number. "Copy report" puts the JSON on the clipboard.
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
