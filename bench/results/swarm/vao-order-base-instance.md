# swarm/vao-order-base-instance: fewer vertex-array binds for the draws that are not batched

## Result

| scene | bindVertexArray / frame before | after | three.js |
|---|---:|---:|---:|
| shader-client (1313 draws) | 763 | **7** | 1248 |
| shader-client-static (3 passes, 651 draws) | 382 | **14** (4 / 4 / 6 per pass) | 643 |

Total GL calls per frame: shader-client 3320 -> 2564, shader-client-static 1619 -> 1251.

CPU-stubbed render time (`bench/cpu-stubbed.mjs`, draws stubbed, same machine, base and new alternated; median ms/frame):

| scene | base | new |
|---|---:|---:|
| shader-client | 0.84, 0.76, 0.80, 1.04, 0.80 | 0.83, 0.66, 0.59, 0.76, 0.59 (best runs: ~-25 %) |
| shader-client-static | 0.37, 0.37, 0.38, 0.37 | 0.40, 0.33, 0.34, 0.32 (-5..-15 %, near noise) |

Wall-clock medians in `run.mjs` are dominated by SwiftShader rasterisation and swing +-40 % between identical runs on this machine
(hierarchy-animated, which this change does not touch, went 4.6 -> 8.3 ms in one pair), so they are not usable as evidence either way.
The other scenes' stubbed CPU times (skinned-crowd, shared-animated, unique-geometries) are unchanged within noise.

Pixels: `run.mjs --compare` meanAbsDiff/maxDiff are identical to the committed values for every scenario (shader-client and
shader-client-static stay 0/0). `npm test` (139), `conformance` (34 PASS, includes a new test), `addons`, `smoke`, `reuse-check`
(602 frame pairs identical) all pass, re-run after merging the integration branch (conformance 35 PASS). `fuzz.mjs --seeds=50 --continue`: seeds 8 23 27 28 35 fail, **identically on the unmodified integration branch** (same seeds, same worst diffs), so they are pre-existing; no new failures.

## What changed

1. **Fixed locations for custom (ShaderMaterial) attributes** (`WebGLPrograms.js`). Previously the linker chose the locations of
   `aColor`, `aTangent`, ... per program, which is why those geometries needed a VAO per (geometry, program) and could not live in a
   mega-buffer page. Now every ShaderMaterial program `bindAttribLocation`s each plain (non-matrix) attribute it declares to a
   per-name location, shared by all programs and renderers: 9, 10, 11, ... in order of first appearance (`customAttributeLocation`).
   Limits: nothing is bound at or above `MAX_VERTEX_ATTRIBS`; a program that defines `USE_INSTANCING` (instanceMatrix owns 8-11) keeps
   linker locations for names that would land in 9-11; explicit `layout(location=...)` sources are left alone; matN attributes and
   arrays are left to the linker. After linking, `program.customFixed` says whether every custom attribute really sits at its
   registered location (verified from `getActiveAttrib`/`getAttribLocation`, so a mis-parse can only cost the optimisation, never
   correctness). The declaration scan skips `tangent` unless `USE_TANGENT` is defined, because the shared prefix declares it under a
   define and it would waste one of the 7 slots.
2. **Mega-buffer pages carry custom attributes** (`WebGLMegaBuffers.js`). A custom attribute that has a registered location and is
   packable (not interleaved/instanced/`onUpload`-hooked/Float16/int-typed-as-float) is added to the layout and signature. Others are
   simply left out of the layout. `supports(rec, program)` (cached per record) says whether the page carries every custom attribute
   the program reads at the program's locations; otherwise the geometry is drawn the old way. A record also notices when new names
   were registered after its layout was made (shadow pass first, colour programs later) and reallocates once (`_missesCustomAttribute`).
   `sync(rec, geometry)` is an `attributeEpoch` fast-path around the existing lazy `queue`/`flush` uploads.
3. **Single draws use the page VAO** (`WebGLRenderer._drawPaged`, `pagedDraws` flag, default on). Plain `Mesh` (not instanced, not
   skinned, not wireframe, default drawRange) whose geometry lives in a page: bind the page VAO (skipped when already bound, which is
   now almost always) and `drawElements(TRIANGLES, count, UNSIGNED_INT, rec.byteOffset + start * 4)` / `drawArrays(rec.baseVertex + start)`.
   Material groups are honoured. The geometry is also `register`ed with `WebGLBindingStates` so `info.memory.geometries` keeps counting
   it and its dispose hook exists.
4. New conformance test `ShaderMaterial custom attributes drawn from mega-buffer pages (matches three.js)`: depth-only override pass
   first (stale-layout path), custom float/vec3 attributes, indexed/non-indexed/grouped geometries, dynamic attribute update,
   wireframe; pixel-compared with three.js (0/0) and asserts the geometry really is in a page with the custom attributes.

## Extension availability (task item 2)

`WEBGL_(multi_)draw_instanced_base_vertex_base_instance` are **not used and not needed**. Mega-buffer indices are rebased to the page's
vertex base when uploaded (this was already so for the batched path), so every geometry of a page is drawn with plain
`drawElements`/`drawArrays` and an offset under the page VAO: no base-vertex parameter exists to pass, and the path works on every
WebGL2 context. The only requirement is the one the pages already had (`megaBuffers` is created when `WEBGL_multi_draw` exists; without
it `pagedDraws` is inert and the old per-geometry VAOs are used). `renderer.pagedDraws = false` restores the previous behaviour.

## Findings for the other items

* **Opaque sort order (item 1).** Key = rank|program|material|indexed|geometry, so geometry only orders draws *within* a material; for
  shader-client that left ~12 geometry changes per material (321 binds for 871 draws) plus 442 unique chunk geometries. Re-keying to
  put geometry before material would trade binds for material switches (30-uniform upload each) and was not pursued; with page VAOs
  the bind count no longer depends on geometry order. Geometry ids are 9 bits of a per-frame counter; shader-client has 462 distinct
  geometries (< 512), so no collisions. Above 512 distinct geometries the id wraps and only adjacency (not correctness) suffers.
  The VAO cache is already keyed by (geometry, mode, program-if-custom) and `state.bindVertexArray` skips a bind of the VAO that is
  already current, so a material switch never re-binds a VAO; the 763 binds were geometry changes.
* **Trailing `bindVertexArray(null)` (item 3).** All ELEMENT_ARRAY_BUFFER traffic is under an explicit VAO (`WebGLBindingStates`: new VAO in
  `_createVAO`, the geometry's own VAO in the update branch; page index buffers are written through `COPY_WRITE_BUFFER`), so it is not needed for
  jrs's own correctness. It is kept: it costs one call per pass (a pass is 1 of 7/14 binds now), and it leaves the context in the default-VAO
  state three.js leaves it in for code that uses raw `gl` after `render()`.
* **Material block `bindBufferRange` (item 4).** Already skipped when unchanged: `WebGLState.bindUniformBufferRange` compares
  buffer/offset/size per binding index, and it is only reached on a material switch of a program with a Material block (ShaderMaterial
  programs have none: 0 such calls in shader-client).

## Risks

* Global, process-wide custom-attribute registry: first 7 distinct custom names (9..15 with MAX_VERTEX_ATTRIBS=16) get fixed locations; more
  names or mat4 attributes silently use the old per-(geometry, program) VAOs. Behaviour is identical, only slower.
* A page is allocated (262,144 vertices per layout, ~12 MB of unwritten GPU storage) for the first ShaderMaterial layout, as it already was for
  any batchable built-in mesh.
* Geometries drawn only through pages never create their own buffers; `info.memory.geometries` is still counted, `info.memory.textures` etc. unaffected.
* Dynamic custom-attribute geometry is evicted from the pages by the existing re-upload rule (3 re-uploads) and then drawn the old way.
* `supports()` caches one program per record; a geometry alternating between several custom programs re-verifies (a few Set lookups) each switch.

## Follow-up ideas

* The remaining binds are: first draw per pass, indexed vs non-indexed layout, geometries with groups/drawRange, instanced/skinned meshes.
  InstancedMesh and skinned meshes still bind per-geometry VAOs.
* Share non-page custom VAOs across programs now that `program.customFixed` exists (key by geometry only, with a registry-size check).
* Point/Line objects could use pages too (`_drawPaged` is Mesh/TRIANGLES only).
* Widen the geometry id (9 bits) or add a second sort pass only if scenes with >512 geometries per material show a measurable effect.
