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

## 5. Uniform blocks instead of uniform uploads (`src/renderers/shaders/ShaderLib.js`)

Three std140 blocks replace most `uniform*` calls:

| block | contents | uploaded |
|-------|----------|----------|
| `Frame` | projection, view, view-projection, camera position, fog, exposure, viewport | once per render |
| `Lights` | ambient + fixed-capacity arrays of directional/point/spot/hemisphere lights, shadow matrices | once per render |
| `Material` | colour, opacity, emissive, specular/shininess, roughness/metalness, uv transform … (128 B) | when the material's values change |

All materials live in one large uniform buffer; switching material is a single
`bindBufferRange`. The material block is refreshed by comparing 32 floats against the
last uploaded copy, once per frame per material, so `material.color.set(...)` without
`needsUpdate = true` still works, but costs nothing when nothing changed.

Light arrays have a fixed capacity (4 directional, 8 point, 4 spot, 2 hemisphere) and
the active counts are read from the block, so **adding or removing lights never
recompiles shaders**. (three.js recompiles every program when the light count changes.)
Only the number of shadow-casting lights is a compile-time constant, because GLSL ES
3.00 sampler arrays must be indexed with constants.

Sampler uniforms are bound to fixed texture units at link time (`map` → 0,
`alphaMap` → 1, …, shadow maps → 8–15) and never set again.

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

Point lights render into a cube depth map (`WebGLCubeRenderTarget` + `CubeDepthTexture`, as in three r186; three no longer
uses the 4x2 "cube in a 2D map" layout or a distance-RGBA pass: the hardware depth of a 90 degree perspective face is the
value compared). The six faces use three's `_cubeDirections` / `_cubeUps`. Casters are gathered once per light and culled
against each face's frustum; each face goes through the same sort + batch path (and its matrix texture) as any other pass,
and the per-light signature skip applies to the whole cube. The main pass samples the cube with `samplerCubeShadow` (PCF:
five Vogel-disk taps rotated by interleaved gradient noise, the same code as three) or `samplerCube` plus a manual compare
(`BasicShadowMap`). The vertex shader passes the light-to-fragment vector, so no matrix is stored per point shadow; the Lights
block holds `pointShadowParams` (bias, normalBias, radius, intensity) and `pointShadowInfo` (mapSize, near, far).
Capacity: 4 point shadows, and each cube map needs a texture unit, so they take the units of 8-14 left free by the
directional (8..) and spot (12..) shadow maps (`pointShadowUnit`); a scene with 4 directional and 3 spot shadows has none left.
Point lights are sorted shadow-casting first, so the i-th shadow is the i-th point light. `VSMShadowMap` is unsupported for
point lights (three warns and skips them as well).

## What is intentionally not there (yet)

* Environment maps / image-based lighting, `MeshPhysicalMaterial`'s extra layers
  (the class exists; it renders as `MeshStandardMaterial`).
* VSM (and `BasicShadowMap` for directional/spot lights, which always use hardware PCF), `Scene.background` textures, skinning,
  morph targets, clipping planes, WebGL1.
* `ShaderMaterial` with `lights: true`: three.js fills light uniforms from the scene in
  view space; here lighting data lives in the `Lights` block, which custom shaders do not
  see. Everything else about `ShaderMaterial` (prefix, chunks, `UniformsLib`, GLSL 1.00
  shims, custom attributes, 3D/array/cube samplers) matches three.js.
* `onBeforeCompile` on built-in materials: the built-in shaders are not assembled from
  three.js chunks, so chunk-replacement hooks have nothing to hook into.
