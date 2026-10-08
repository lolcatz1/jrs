# Material-index batching (scout report item 13)

Branch `swarm/material-index-batching`. Batches (instanced and multi-draw) now span built-in
materials that share a program, GL state and textures; each instance / sub-draw reads its own
material record from a uniform-block array. Target scenario: `many-materials` (5,000 meshes,
200 `MeshPhongMaterial`s x 3 geometries).

## Design

**Sort.** `_pushItem` computes a *batch group* per material per frame (`_batchGroupOf`): a
41-number signature (the 8 map texture ids, side/shadowSide, transparent, the blending state,
depth/colour/polygon-offset/alpha-to-coverage/stencil state, wireframe, and the material's
*page* in the material buffer) is compared against the material's cached signature; when it
changed, the signature string is interned in a renderer-wide `Map` to a group object. Group
objects get the same per-frame dense ids materials used to get, and the opaque sort key's
10-bit "material" field now holds the group id. Within program + group the key orders by
geometry, so a run of one geometry contains every material of the group. `ShaderMaterial`s and
materials whose program/state/texture set differs are their own group, so nothing changes for
them (the `shader-client` scenarios are untouched).

**Run detection** (`_drawList`): a run may continue when `next.material === material` *or*
both items share a non-null batch group (plus the existing program / renderOrder / geometry /
mega-buffer-page checks). The run remembers the first item whose material differs; after the
instanced-vs-multi-draw cost model truncates the run, the run is "multi-material" only if that
item is still inside it. Multi-material runs get command kinds 3 (instanced) and 4 (multi-draw).

**Per-instance record index.** While a multi-material run is filled, every item's material
block is refreshed (`_syncMaterialBlock`, once per frame per material as before) and
`slot - page * N` is written into the eighth texel of the object's matrix-texture record
(`WebGLBatcher.addTex(object, materialIndex)`); it is mixed into the upload-skip hash. The vertex
shader fetches it next to the matrices (`matIdx = int(texelFetch(...).x)`) and passes it to the
fragment shader as `flat int vMaterialIndex`.

**Shader.** `MATERIAL_BLOCK` has two forms selected by `USE_MATERIAL_ARRAY`: the old
`uniform Material { ... }` and `uniform Materials { MaterialRecord materials[N]; }` where
`MaterialRecord` holds the same eight `vec4`s plus `vec4 mPad[MATERIAL_PAD]` so its std140 size
equals the material buffer stride (`max(128, UNIFORM_BUFFER_OFFSET_ALIGNMENT)`, 256 B on this
driver). Macros map `diffuse`, `emissive`, `specular`, `matParams`, `matParams2`,
`uvTransform0..2` to `materials[ matIdx ].m*`, so the shader body (and therefore the lighting
arithmetic) is unchanged. The program variant bit `V_MATARRAY` (1024) selects it; the program key
gains one bit; `WebGLProgram` binds either block name to `BLOCK_MATERIAL` and records
`program.materialArray`.

**Binding.** `_setupMaterial` binds, for array programs, the window
`[page * N * stride, (page + 1) * N * stride)` of the material buffer that contains the run's
first material (all records of the run are in that page by construction). The buffer capacity is
kept a multiple of `N` so every window lies inside the buffer. Single-material runs and single
draws keep the per-material `bindBufferRange` of 128 bytes and the non-array program.

## Limits and fallbacks

* `N = min(256, floor(MAX_UNIFORM_BLOCK_SIZE / stride))`: 256 here (64 KB / 256 B); 128 on a
  16 KB-limit GPU with a 128 B stride, 64 with a 256 B alignment. Materials beyond one window
  land on another page, which is part of the group key, so runs split at page boundaries instead
  of breaking at every material. Verified with the window forced to 8 (page splitting, 38 pages
  for 300 materials): pixel-identical to individual draws.
* Dynamic indexing of a std140 struct array inside a uniform block is probed at renderer
  construction with a 2-record program (`probeMaterialArray`); on failure `_materialArrayOk` is
  false, `_batchGroupOf` returns null for every material and everything behaves as before.
  Verified by forcing it false: draw counts and pixels equal the previous engine.
* Materials with different textures never merge (texture ids are in the signature). A cost model
  extension for textured runs was not needed: textured materials with the *same* maps do merge.
* `renderer.autoBatchMaterials = false` disables it (also used by the new conformance test).
* The transparent list benefits too: consecutive transparent items of one geometry and group
  become one instanced draw, with the back-to-front order preserved as instance order.
* Opaque materials with `depthWrite = false` now sort among their group instead of by material.
  Their output is draw-order dependent by nature (it differed from three.js before as well);
  everything else is pixel-identical to individual draws in the edge-case run below.

## Bug found and fixed on the way

`WebGLBatcher.uploadTexture` relied on `state.bindTexture(TEXTURE_2D, texture, 15)` to make unit
15 active before `texSubImage2D`. When the matrix texture was already recorded on unit 15 the
cached bind was a no-op, the active unit stayed wherever the last material texture upload left
it (unit 0), and the matrix upload hit that texture instead: `INVALID_OPERATION` and stale
matrices for every later batch of the frame. It reproduced on the original branch with any scene
that mixes textured materials and batching, after the first frame. `uploadTexture` now calls
`state.activeTexture(unit)` explicitly.

## Validation

* `npm test`: 100/100. `node bench/conformance.mjs`: all pass, including the new case
  "Batches spanning materials render identically to individual draws" (300 meshes, 40 Phong
  materials with different colours / shininess / emissive / uv offsets, some textured with one
  texture, some double-sided: 300 -> 114 (per material) -> 12 draws, max pixel diff 0).
* `node bench/addons.mjs`, `node bench/smoke.mjs`: pass, GL error 0.
* Edge-case script (scratchpad, not committed): 3,000 meshes, 4 geometries, 300 materials
  (transparent, double-sided, two textures, wireframe, flat-shaded, emissive variants), seven
  frames with material swaps, colour edits without `needsUpdate`, `dispose()` + slot reuse,
  movement and map changes. Compared against `autoBatch = false`: 0 differing pixels in every
  frame for the default window (256), window 8, instanced-only (`autoMultiDraw = false`), the
  probe-failed fallback and `autoBatchMaterials = false` (the last two also exercise the
  batcher fix above).
* `node bench/run.mjs --compare --frames=60` twice: see below.

## Numbers (headless Chromium / SwiftShader, 320x240, 60 timed frames, medians)

Baseline = this branch's parent commit, measured in this session before any change (the
committed `latest.json` said 4.3 ms / 600 draws). "After" = better of two full runs plus two
stand-alone many-materials runs; the host was noisy (three.js's own medians moved by up to 2x
between runs), so the per-scenario table shows the best of the runs for both before and after.

| Scenario | before (jrs) | after (jrs) | pixel diff before -> after (mean / max) |
|---|---:|---:|---|
| **many-materials** | **4.1 ms, 600 draws** | **3.2-3.5 ms, 3 draws** | 0 / 0 -> 0 / 0 |
| shared-static | 3.8 ms | 3.5 ms | 0.347 / 8 -> 0.347 / 8 |
| shared-animated | 5.0 ms | 4.9 ms | 0.346 / 9 -> 0.346 / 9 |
| unique-geometries | 1.2 ms | 1.1 ms | 0 / 0 -> 0 / 0 |
| hierarchy-animated | 4.3 ms | 4.4 ms | 0 / 0 -> 0 / 0 |
| instanced-100k | 0.0 ms | 0.0 ms | 0 / 0 -> 0 / 0 |
| shader-client | 2.9 ms | 2.8 ms (A/B x5: medians 3.0 vs 3.0) | 0 / 0 -> 0 / 0 |
| shader-client-static | 28.1 ms | 16.8 ms | 0 / 0 -> 0 / 0 |
| shadows | 1.4 ms | 1.5 ms | 0.134 / 33 -> 0.134 / 33 |

many-materials GL calls per frame (jrs): before `total 2006 | uniform* 600 | bindVertexArray 601 |
draw 600 | bindBuffer 202 | bufferData 2`; after `total 15 | uniform* 3 | bindVertexArray 4 |
draw 3 | bindBuffer 2 | bufferData 2`. three.js: 14,396 calls, 5,000 draws. The remaining
~3.3 ms is almost entirely SwiftShader rasterising 333k triangles (the single-draw
shared-static scene with 120k triangles costs 3.5 ms), so the CPU side of this scene is now
close to the floor; on a hardware GPU the saving is the 600 draw + 200 bind calls per frame.

Run 1 / run 2 medians (jrs): many-materials 3.2 / 4.0, shared-static 3.5 / 3.6,
shared-animated 7.3 / 5.8, unique-geometries 1.3 / 1.1, hierarchy-animated 5.7 / 4.4,
shader-client 3.8 / 3.2, shader-client-static 25.0 / 16.8, shadows 2.6 / 1.5. Two further
runs of the suite aborted in the harness (`page.goto` timeout after instanced-100k, before any
scenario code) and were repeated.

## Risks

* **Driver support for dynamic UBO-array indexing in the fragment stage.** Spec-legal in
  ESSL 3.00 and fine on ANGLE/SwiftShader; some older mobile drivers are slow (or wrong) with
  non-uniform indexing of uniform arrays. The probe only checks that the program links; a wrong
  render would not be caught. `renderer.autoBatchMaterials = false` is the escape hatch; a
  runtime pixel probe (render two records, read back) would make the fallback automatic.
* **Opaque draw order within a program** changed from material-major to group-major. Correct
  for depth-tested opaque geometry; opaque materials with `depthWrite = false` or coplanar
  surfaces were order-dependent before and keep being so, with a different order.
* **Per-frame signature compare** (41 numbers per material per frame) is ~5 us for 200
  materials; a scene with thousands of distinct materials pays proportionally (still far less
  than the draws it saves).
* The 10-bit sort-key field now counts groups + non-mergeable materials; collisions above 1024
  distinct values only cost batching, not correctness (as before).
* The batch group `Map` is never pruned (one entry per distinct state/texture/page signature
  ever seen); bounded in practice.

## Follow-up ideas

* Fold per-material texture sets into a `sampler2DArray` (or bindless-style texture atlas) so
  textured materials with different maps merge as well; the signature already isolates them.
* Use the material window for *single-material* batches too (one program variant instead of
  two) if the array fetch proves free on hardware; it would halve the batched program count.
* Shadow pass: casters of different materials in one shadow draw already work through the same
  path (alpha-tested casters keep their records); worth a dedicated scenario.
* `three.js` parity for `depthWrite = false` opaque ordering (three sorts them by material
  then z); cheap to special-case by keeping such materials out of groups.
* Make the probe a render test (2 records, read back a pixel) rather than a link test.

## After merging the integration branch (`origin/claude/threejs-performance-fork-vfqpcw`)

Conflicts (sort-list `push` signature, program key bits, renderer helpers, README table,
results, bundles) resolved; the other workers' batcher change (`texImage2D` upload) keeps the
active-unit fix. Re-validated on the merged tree: `npm test` 100/100, conformance 28/28,
smoke and addons clean, edge-case script 0 differing pixels in every mode and frame. Full
benchmark on the merged tree (medians, jrs): many-materials **2.8 ms, 3 draws** (three.js
8.1 ms, 5,000 draws), shared-static 3.0, shared-animated 8.2 (noisy scenario, see A/B below),
unique-geometries 1.1, hierarchy-animated 4.2, shader-client 2.8, shader-client-static 20.9,
shadows 1.4, shadows-animated 1.7; pixel diffs identical to the integration branch's
`latest.json` for every scenario.
shared-animated A/B on the same host, integration source vs merged source, two runs each:
7.3 / 4.7 ms vs 5.1 / 4.9 ms (jrs medians): no regression, the scenario is simply noisy here.
