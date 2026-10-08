# Architecture

jrs keeps the three.js object model and API and replaces the engine underneath.
This document explains what is different and why each change is faster.

## 1. Change-detected scene graph (`src/core/Object3D.js`)

three.js calls `updateMatrix()` (compose position/quaternion/scale into a 4x4) and
`matrixWorld.multiplyMatrices(parent, local)` for **every object on every frame**,
whether or not anything moved.

jrs snapshots the ten transform components (`_px.._sz`) the last time the local matrix
was composed. `updateMatrix()` compares the live values against the snapshot and
returns early when they match. The world matrix is remultiplied only when the local
matrix changed, the parent's `_worldVersion` changed, or `matrixWorldNeedsUpdate` /
`force` was set. Every world-matrix recompute bumps `_worldVersion`, which the renderer
uses to cache everything derived from the world matrix: the normal matrix, the
world-space bounding sphere, and the instance buffer hash (see §4).

For a static object the per-frame cost is ten float compares.

The `rotation` (Euler) and `quaternion` objects stay synchronised through the same
`_onChange` callbacks three.js uses, so `mesh.rotation.y += 0.01` keeps working.

## 2. Slab-allocated matrices (`src/core/TransformSlab.js`)

Every `Object3D` owns a 48-float record in a large `Float32Array` page:

| floats | content |
|-------:|---------|
| 0–15 | local matrix (`object.matrix.elements` is a view of this range) |
| 16–31 | world matrix (`object.matrixWorld.elements`) |
| 32–40 | world normal matrix (3x3, lazily refreshed) |
| 41–44 | cached world bounding sphere (x, y, z, radius) |

Records are handed out from 1024-record pages and recycled through a
`FinalizationRegistry` when the object is garbage collected, so churn does not leak.

Benefits:

* Objects created together are adjacent in memory; traversal and culling walk cache
  lines instead of chasing heap pointers.
* Matrix uploads use the WebGL2 `uniformMatrix4fv(loc, false, slab, offset, 16)`
  overload straight from the page: no copy, no temporary array, no GC pressure.
* Batched instance buffers are filled with a straight 16-float copy per object.

`Matrix4.elements` is a `Float32Array` everywhere (three.js uses a plain `Array` of
doubles). This matches what the GPU consumes and makes uploads a memcpy. The trade-off
is float32 precision in matrices; scenes with coordinates beyond ~10^5 units should be
camera-relative, as they should be in any float32 pipeline. `Matrix4` also accepts external
storage, so the few places where precision shows up on screen use a `Float64Array`-backed
scratch matrix: a parentless camera's view matrix is composed from its position and
quaternion and inverted in doubles, then rounded once, which is the same arithmetic path
three.js takes. With that, the client-shaped benchmark scenes render pixel-identical to three.

## 3. Culling and sorting without allocation (`src/renderers/webgl/WebGLRenderLists.js`)

* **Culling.** The world bounding sphere is computed into the slab and reused until
  `_worldVersion` or the geometry's bounding sphere changes. `Frustum` keeps a flat
  `Float32Array(24)` mirror of its planes and tests spheres with
  `intersectsSphereFlat(x, y, z, r)`: six multiply-adds, no objects.
* **Sorting.** Each render item gets a 52-bit integer key in a `Float64Array`:

  ```
  opaque:      [renderOrder rank 6][program 6][material 10][indexed 1][geometry 9][item index 20]
  transparent: [renderOrder rank 6][quantised depth, back to front 26][item index 20]
  ```

  The array is sorted with the native comparator-less `TypedArray.prototype.sort`
  (C++ `std::sort`) and the item is recovered from the low 20 bits. Material and
  geometry ids are **per-frame dense ids** (assigned the first time each is seen in a
  frame), so 1024 distinct materials/geometries pack without collision. Opaque objects
  are grouped by state rather than sorted front-to-back: with batching (§4) the state
  grouping is what removes CPU work, and early-z handles overdraw.

## 4. Automatic draw-call batching (`src/renderers/webgl/WebGLBatcher.js`)

After sorting, consecutive items with the same geometry, material and program (and no
per-object hooks, groups or morph targets) are drawn with **one** `drawElementsInstanced`
call. The objects' world matrices and CPU-cached normal matrices are written into a
per-frame **matrix texture** (RGBA32F, eight texels per object, filled straight from the
transform slab) and the vertex shader fetches its matrix by `gl_InstanceID` plus a
per-batch `drawBase` uniform. A batch therefore costs one `uniform1i` and one draw; no
vertex attributes are re-pointed per batch (re-pointing instance attributes turned out to
stall for tens of milliseconds in Chrome when the canvas is composited).

While filling the texture the batcher mixes `(object.id, object._worldVersion)` into a hash;
if the hash matches the previous frame's, the `texSubImage2D` upload is skipped entirely:
a static scene of 10 000 meshes costs one draw call and zero buffer traffic per frame.

Transparent items are batched too. Within one instanced draw the GPU rasterises instances
in order, so the back-to-front order from the sort is preserved.

`InstancedMesh` keeps working as in three.js (its own `instanceMatrix` attribute).
Disable automatic batching with `renderer.autoBatch = false`; `renderer.autoBatchMinimum`
(default 4) is the shortest run that is batched. The vertex texture fetch costs slightly
more per vertex than an attribute would on software GL; on GPUs it is the same technique
`BatchedMesh` uses.

### 4b. Multi-draw over mega-buffers (`src/renderers/webgl/WebGLMegaBuffers.js`)

Instanced batching needs identical geometry. For runs of **different** geometries that share a
material, jrs uses `WEBGL_multi_draw` (Chrome, Firefox, Safari): geometries with the same
attribute layout (names, item sizes, types, indexed or not) are sub-allocated into large shared
vertex and index buffers ("pages", 262k vertices each, one VAO per page). Indices are rebased to
the page's vertex base at upload time, so no base-vertex extension is needed. A run becomes one
`multiDrawElementsWEBGL` (or `multiDrawArraysWEBGL`) call whose sub-draws read their object
matrix and normal matrix from the same per-frame matrix texture, indexed by `gl_DrawID`. This is the transform-texture technique that three's `BatchedMesh` asks the
application to set up by hand, applied automatically and kept in sync with the scene graph:
the matrix texture is filled from the transform slab in the same pass that builds the instance
data, and its upload is skipped when the batch hash is unchanged. Sub-draws execute in order,
so transparent runs keep their back-to-front order. The classic instanced path remains the
fallback when the extension is missing (`renderer.autoMultiDraw = false` disables it).

A cost model picks the form per material run: runs whose geometries repeat (sorted
contiguously) are drawn instanced, geometry group by geometry group, since an instanced draw
has no per-sub-draw cost; runs of mostly distinct geometries use multi-draw. The opaque sort
key carries an "indexed" bit so geometries of one mega-buffer layout stay adjacent.

Effect: the 2,000 distinct-geometry benchmark goes from 2,000 draw calls to 1.

### 4c. Batches that span materials (material-index batching)

A batch used to end at every material change, because the `Material` block (§5) is bound per
material. Built-in materials that would be drawn with the same program, the same GL state
(blending, depth, stencil, side, …) and the same texture objects are now put into one **batch
group**: the opaque sort key carries the group's id in place of the material's, so their meshes
interleave and a geometry run spans all of them. When a run contains more than one material it is
drawn with a program variant whose material block is an array of records,
`layout(std140) uniform Materials { MaterialRecord materials[N]; }`, bound once per run as a
*window* of `N` consecutive records of the shared material buffer. Every instance / sub-draw
stores the index of its record inside that window in the eighth (previously spare) texel of its
matrix-texture entry; the vertex shader fetches it next to the matrices and hands it to the
fragment shader as a `flat` varying. The shader body is unchanged (the block members are
remapped with macros), so the lighting arithmetic is bit-for-bit the same as in the
per-material path and the many-materials benchmark stays pixel-identical to three.js.

Limits and fallbacks:

* `N` = `MAX_UNIFORM_BLOCK_SIZE / record stride`, capped at 256 (the stride is the material
  block size rounded up to `UNIFORM_BUFFER_OFFSET_ALIGNMENT`, so records are padded to it in
  the shader). With a 16 KB limit and 128-byte records that is 128 materials per window. The
  buffer is divided into fixed windows ("pages"); a material's page is part of its group key, so
  materials on different pages simply form separate runs instead of overflowing a window.
* Dynamic indexing of the uniform array is probed at start-up with a tiny program; if the driver
  rejects it the renderer keeps the per-material path (`autoBatchMaterials` reports it off).
* Single-material runs keep using the plain `Material` block, so scenes with one material pay
  nothing for the feature; `ShaderMaterial`s never merge.
* Materials whose maps differ are in different groups (textures are bound per run, not per
  record), as are materials with different GL state. Opaque materials with `depthWrite = false`
  merge like any other, which changes their draw order relative to their neighbours; their
  result was order-dependent before too.

`renderer.autoBatchMaterials = false` turns it off. Effect: the many-materials benchmark (5,000
meshes, 200 Phong materials, 3 geometries) goes from 600 instanced draws plus 200 block binds to
3 draws.

## 5. Uniform blocks instead of uniform uploads (`src/renderers/shaders/ShaderLib.js`)

Three std140 blocks replace most `uniform*` calls:

| block | contents | uploaded |
|-------|----------|----------|
| `Frame` | projection, view, view-projection, camera position, fog, exposure, viewport | once per render |
| `Lights` | ambient + fixed-capacity arrays of directional/point/spot/hemisphere lights, shadow matrices | once per render |
| `Material` | colour, opacity, emissive, specular/shininess, roughness/metalness, uv transform … (128 B) | when the material's values change |

All materials live in one large uniform buffer; switching material is a single
`bindBufferRange`, and a batch that spans materials binds a window of consecutive records
instead (§4c). The material block is refreshed by comparing 32 floats against the
last uploaded copy, once per frame per material, so `material.color.set(...)` without
`needsUpdate = true` still works, but costs nothing when nothing changed.

Light arrays have a fixed capacity (4 directional, 8 point, 4 spot, 2 hemisphere) and
the active counts are read from the block, so **adding or removing lights never
recompiles shaders**. (three.js recompiles every program when the light count changes.)
Only the number of shadow-casting lights is a compile-time constant, because GLSL ES
3.00 sampler arrays must be indexed with constants.

Sampler uniforms are bound to fixed texture units at link time (`map` → 0,
`alphaMap` → 1, …, shadow maps → 8–14, the environment map → 15, the vertex-shader data
textures (bones, morph targets, batched matrices) → 16–18) and never set again. The DFG
lookup table of the physical model shares unit 7 with `specularMap` / `bumpMap`, which a
`MeshStandardMaterial` never uses.

## 6. Program cache keyed by integer (`src/renderers/webgl/WebGLPrograms.js`)

Program parameters are folded into one number (material type + ~25 feature bits +
tone mapping + shadow counts). Looking up a program is a `Map.get(number)`. Programs
are cached per (material, variant) where the variant encodes instancing,
shadow receiving, the shadow pass, and which geometry attributes exist; the cache entry
is validated against `material.version` and a renderer-wide "environment version" that
changes when tone mapping, output colour space, fog type or shadow configuration change.

Attribute locations are fixed per attribute name (`position` 0, `normal` 1, `uv` 2,
`color` 3, `uv1` 4, `instanceColor` 5, `instanceMatrix` 8–11), so a geometry's VAO is
shared by every program and keyed only on (geometry, instancing mode).

## 7. GL state cache (`src/renderers/webgl/WebGLState.js`)

Every `gl.enable/disable/depthFunc/blendFunc/useProgram/bindVertexArray/bindBufferRange/
bindTexture` goes through a cache and is dropped when redundant. Texture binding is
tracked per unit. Every uniform location keeps its last uploaded value in doubles (as
three.js's `WebGLUniforms` does), so shared uniforms, camera matrices and per-object
matrices are only re-sent when they change; `ShaderMaterial` instances with the same
source, defines and parameters share one program and therefore one cache.

## 8. Lazy BVH for raycasting (`src/core/MeshBVH.js`)

`Mesh.raycast` builds a bounding volume hierarchy over the geometry's triangles the first
time a geometry with more than 64 triangles is raycast (`geometry.boundsTree`) and then
visits O(log n) nodes per ray. The tree is struct-of-arrays (`Float32Array` bounds,
`Int32Array` children/leaf ranges, `Uint32Array` triangle indices) built iteratively with a
mid-point split, and traversed with an explicit `Int32Array` stack. three.js tests every
triangle. Call `geometry.computeBoundsTree()` to build eagerly, `disposeBoundsTree()` to
drop it; it is invalidated automatically when `position` or the index change.

## 9. Stencil, 3D / array textures, custom shaders

Stencil state (`stencilWrite`, func/ref/masks, ops) is applied per material through the
state cache like depth and blend state, so stencil shadow volumes and masking work as in
three.js. `Data3DTexture`, `DataArrayTexture` (with per-layer updates) and `CubeTexture`
upload through `texStorage3D`/`texSubImage3D` and `texImage2D` per face, and bind to
`sampler3D`, `sampler2DArray` and `samplerCube` uniforms of `ShaderMaterial`s. Programs
with custom attribute names get a VAO per (geometry, program) instead of the shared one.

## 10. Shadow maps (`src/renderers/webgl/WebGLShadowMap.js`)

Directional and spot lights render depth-only framebuffers (`DepthTexture` with hardware
compare). The main pass samples them through `sampler2DShadow` with 3x3 PCF. Shadow casters
go through the same sort + batch path as the main pass, so a thousand identical casters
are one draw call in the shadow pass too.

## 11. Skinning, morph targets and animation (`src/objects/Skeleton.js`, `src/renderers/webgl/WebGLMorphtargets.js`)

The GPU side is three.js r186's: the built-in vertex shader includes the `skinning_*` and
`morphtarget_*` chunks verbatim (bone matrices in an RGBA32F texture, four texels per bone;
morph targets in an RGBA32F `DataArrayTexture`, one layer per target, position / normal / colour
texels per vertex), `skinIndex` / `skinWeight` have fixed attribute locations 6 and 7, and the bone
and morph textures live on fixed units 16 and 17 (above the 16 fragment units; WebGL2 guarantees
32 combined). Output is pixel-identical to three.js. `ShaderMaterial` gets the same defines and
uniforms, so custom shaders that `#include <skinning_pars_vertex>` work unchanged.

What differs is the CPU side:

* `Skeleton.update()` multiplies each bone's slab-resident world matrix with its inverse bind
  matrix straight into the `boneMatrices` Float32Array (no `Matrix4` temporaries, no `toArray`),
  and it remembers every bone's `_worldVersion`: when no bone moved the whole step, including
  the texture upload, is skipped. Idle characters cost a few compares.
* `SkinnedMesh.bindMatrixInverse` is recomputed only when the world matrix version changed, and
  the renderer re-sends `bindMatrix` / `bindMatrixInverse` only when their values changed.
* The bone texture is streamed with `texImage2D` (not `texSubImage2D` into immutable storage),
  the upload path that does not stall Chromium's command buffer (§ stall-hunter report), and
  its sampler parameters are set once. Unpack pixel-store state is cached in `WebGLState`.
* The skeleton is updated once per `render()` call, from the render list build, so a mesh drawn
  in the shadow pass and the main pass uploads its bones once.
* Skinned and morphed meshes carry per-object GPU state (bone texture, influences) and are never
  auto-batched; they go through the per-object path like `ShaderMaterial` meshes do.

The animation system (`src/animation/`) is the three.js r186 code, which already runs without
per-frame allocation; `AnimationMixer.update` writes into bone `position` / `quaternion` / `scale`
and the change-detected `updateMatrix` picks it up.

## 12. Environment maps and image-based lighting (`src/renderers/webgl/WebGLEnvironments.js`)

The texture a material samples is resolved once per material per frame from `material.envMap`
or `scene.environment`, exactly as three.js does: equirectangular textures become cube maps
(a `WebGLCubeRenderTarget` of the image height), and the PMREM path (`MeshStandardMaterial`,
`scene.environment`, blurred backgrounds) turns cube and equirectangular textures into the
CubeUV layout of `PMREMGenerator`, which is a verbatim port (same GGX VNDF prefilter, same
`cube_uv_reflection_fragment` sampling with `CUBEUV_TEXEL_WIDTH/HEIGHT` and `CUBEUV_MAX_MIP`
defines). Conversions are cached per source texture and redone when a `CubeCamera` target sets
`needsPMREMUpdate`. They render while a frame may be in flight, so the renderer parks the
frame's collected lights, render-order ranks, dense-id counters and trace state around them
(`_beginNestedRender` / `_endNestedRender`).

The built-in `Standard` shader is three.js r186's physical model: the DFG lookup table (a 16x16
RG16F `DataTexture` copied from three), `computeMultiscattering`, the multi-scattering
compensation of direct specular, the Fresnel-weighted direct diffuse and the
single/multi-scatter split of the indirect terms. Lighting stays in world space; the only
view-space conversion is the geometric-roughness derivative, which three.js takes on the
view-space normal. Basic / Lambert / Phong get three's `envmap_fragment` blending (reflection
or refraction vector, `combine`, `reflectivity`, `specularMap` strength), with
`MeshBasicMaterial`'s reflection vector computed per vertex and interpolated like three does.
The per-material environment data (`envMapIntensity`, `reflectivity`, `refractionRatio`, `ior`
and the inverse rotation matrix, with the px/nx flip of non-render-target cube textures) lives
in the material record, so batches spanning several materials keep working; materials that
sample different environment textures are kept in separate batches, because the environment
map is one sampler unit per draw.

`scene.background` textures are drawn like three.js draws them: the `backgroundCube` shader on
a camera-centred BackSide box (cube map, or the PMREM layout when `backgroundBlurriness > 0`),
or the `background` shader on a screen plane for 2D textures, through the ShaderMaterial path,
before the opaque list and without depth writes.

## What is intentionally not there (yet)

* `MeshPhysicalMaterial`'s extra layers (the class exists; it renders as `MeshStandardMaterial`
  with the 0.04 dielectric F0), `lightMap`, `bumpMap`.
* Point-light shadows (cube maps), VSM, rendering into mip levels of a render target,
  `InstancedMesh` morph targets (`morphTexture`), clipping planes, WebGL1.
* `ShaderMaterial` with `lights: true`: three.js fills light uniforms from the scene in
  view space; here lighting data lives in the `Lights` block, which custom shaders do not
  see. Everything else about `ShaderMaterial` (prefix, chunks, `UniformsLib`, GLSL 1.00
  shims, custom attributes, 3D/array/cube samplers) matches three.js.
* `onBeforeCompile` on built-in materials: the built-in shaders are not assembled from
  three.js chunks, so chunk-replacement hooks have nothing to hook into.
