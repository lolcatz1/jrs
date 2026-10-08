# ShaderMaterial batching: automatic instancing of custom programs

Branch `swarm/shadermaterial-batching`. Runs of meshes that share a `ShaderMaterial` are drawn as one
instanced / multi-draw call through a variant of the custom program that reads `modelMatrix`,
`modelViewMatrix` and `normalMatrix` from the per-frame matrix texture. Target scenarios:
`shader-client` (1,313 ShaderMaterial meshes, 12 shaders x 2 material instances) and
`shader-client-static` (three passes per frame with `scene.overrideMaterial` and stencil volumes).

## Eligibility rules (`src/renderers/shaders/ShaderMaterialBatching.js`)

Decided once per material version (`customShaderObjTexMode`), before any program is compiled, on the
include-resolved user sources with comments stripped. A program qualifies when

* every reference to `modelMatrix`, `modelViewMatrix`, `normalMatrix` in the vertex shader is inside a
  function body (brace depth > 0) and not on a preprocessor line (`#define X modelMatrix`,
  `#if`, ...). Writes are impossible on a compiling shader (uniforms are read-only), so "plain read"
  reduces to "not a global initialiser and not macro trickery";
* the vertex shader never reads `gl_InstanceID` or `gl_DrawID` itself;
* there is exactly one `void main()`;
* the fragment shader does not mention any of the three names (it would have to declare the uniform
  itself, and that copy would stay unfilled);
* for `RawShaderMaterial`: each of the three names is declared at most once, as a single plain
  `uniform [precision] mat4|mat3 name;` statement (the rewrite deletes it).

Chunks used through `#include` (`project_vertex`, `worldpos_vertex`, `defaultnormal_vertex`,
`begin_vertex`, `beginnormal_vertex`) pass unchanged. The usage mask (which of the three are read)
is kept with the decision because it selects the texture entry layout.

Per object, the existing batchability rules apply plus two new ones: a geometry with an
`InstancedBufferAttribute` (or an `InstancedBufferGeometry`) is never batched (the batch's own
instancing would consume it), and a *mirrored* object (negative-determinant world matrix) is never
batched, because the per-object path flips the front face for it and a batch cannot do that per
instance. The second rule now also applies to built-in materials; previously a mirrored mesh inside
a built-in batch was drawn with the wrong winding. `onBeforeRender` / `onAfterRender` hooks,
`InstancedMesh`, skinning, morph targets and geometry groups keep single draws as before. Runs
contain consecutive items of the *same material instance* only; two instances of one shader with
different uniform values never share a draw (three.js semantics: uniforms belong to the material).

## The shader rewrite

The batched variant is built by `buildCustomShader` when the program parameters carry
`objectTexture`. In the prefix the three `uniform` declarations become globals, preceded by:

```glsl
uniform highp sampler2D objectMatrices;
uniform int drawBase;
mat4 modelMatrix; mat4 modelViewMatrix; mat3 normalMatrix;
ivec2 jrs_objectTexel( int entry ) {
	int id = ( drawBase + ( gl_InstanceID + gl_DrawID ) * ENTRIES + entry ) * 8;   // 8 texels per entry
	int y = id / 1024;
	return ivec2( id - y * 1024, y );
}
mat4 jrs_fetchMat4( ivec2 t ) { /* four texelFetch */ }
mat3 jrs_fetchMat3( ivec2 t ) { /* three texelFetch, texels 4..6 */ }
void jrs_fetchObject() { ... assigns only the globals the shader reads ... }
```

and `jrs_fetchObject();` is inserted as the first statement of `main()`. `gl_DrawID` is only used
when `WEBGL_multi_draw` exists (then with `#extension GL_ANGLE_multi_draw : require`); it is 0 in a
plain instanced draw, so *one* variant serves instanced runs and multi-draw runs. Entry layouts:

| shader reads | entries per object | entry 0 | entry 1 |
|---|---:|---|---|
| `modelMatrix` only | 1 | world matrix + world normal matrix (the built-in layout, `WebGLBatcher.addTex`) | - |
| `modelViewMatrix` and/or `normalMatrix` | 1 | model-view matrix + its normal matrix (`addTexView`) | - |
| both kinds | 2 | model-view + normal | world + world normal |

**Why the view-space matrices come from the CPU.** The task allowed `modelViewMatrix =
viewMatrix * modelMatrix` in the vertex shader if the float32 operation order matched the uniform
path. It cannot: the uniform path (`Matrix4.multiplyMatrices` on `Float32Array` elements) forms each
element as a sum of four products evaluated in double precision and rounds once to float32, while a
GLSL `mat4 * mat4` rounds every product to float32 and sums in an order the compiler chooses. The
results differ by an ulp or two per element, which is enough to move an edge pixel at 320x240 (the
existing jrs/three differences in the `shared-*` scenes are exactly this kind of noise). So the
batcher computes `modelViewMatrix` and `getNormalMatrix` with the same calls on the same inputs as
`_uploadObjectUniformsForShaderMaterial` and writes the results into the texture; the batched draw is
bit-identical to the unbatched one (edge-case run below: max difference 0 over 10 frames x 8 shader
kinds, including a RawShaderMaterial and a chunk-based shader). The cost is a 4x4 multiply per
object per fill, which the per-object path paid per draw anyway, and a camera-dependent texture: a
list with view-space entries mixes the camera's view matrix into its texture hash and records it with
its draw-command cache, so a camera move refills and a static frame replays.

**One program per material.** `_pushItem` resolves a batchable ShaderMaterial mesh straight to the
batched variant (the eligibility test is cheap and runs before compilation), so an eligible material
compiles one program and the "programs created" conformance check still sees two programs for three
materials of two shaders. Every run of such a material goes through the batched path, even a run of
one: a single `drawElementsInstanced(count = 1)` plus a `uniform1i(drawBase)` replaces
`uniformMatrix4fv(modelMatrix)` (+ `modelViewMatrix` + `normalMatrix`), and the material never
switches between two programs (a switch re-sends all of its uniforms and samplers, the dominant
per-material cost in the client scene). `autoBatchMinimum` therefore does not apply to
ShaderMaterials. The matrix texture's sampler keeps its fixed unit 15 in custom programs; the
material's own samplers are numbered around it.

**Multi-draw with custom attributes.** Mega-buffer layouts now include every non-instanced
attribute of a geometry, and a page keeps one VAO for the fixed-location attributes plus one per
program with custom attributes (pointed at that program's linker-assigned locations). Without this
the 442 pre-merged chunks of the client scene (unique geometries, five custom attributes) could not
be multi-drawn. The cost model that chooses instanced-per-geometry vs. multi-draw per run is
unchanged.

**Matrix texture per list.** Previously one GPU texture served every list, so the transparent list
of a frame overwrote the opaque list's matrices and the opaque commands could never replay in a
scene with both. Each sorted list (opaque / transparent per scene, pass and camera) now owns a
texture slot (`WebGLBatcher.use(slot)`); the fill buffer and hash logic are shared. In the static
client frame all six lists replay every frame and nothing is uploaded.

## Bugs found on the way

* `_setupMaterial` skipped the per-object front-face flip when the draw only had to re-send
  `uniformsNeedUpdate` uniforms (a hooked object following a mirrored one inherited the flipped
  winding). Fixed: the flip is applied in both branches.
* My first version of the mega-buffer `Page` constructor created the index buffer before binding
  the page VAO, so the element-array binding landed in whatever VAO the previous draw left bound
  (an `InstancedBufferGeometry` mesh drawn right before the first multi-draw lost its index buffer
  from the next frame on). Fixed by unbinding the VAO first; the conformance and edge-case scenes
  cover the sequence.
* Changing `autoBatchShaderMaterials` at runtime left reused render lists pointing at the other
  program variant; the flag is now part of the render-list reuse signature.

## Numbers

Headless Chromium / SwiftShader, 320x240, 60 timed frames after 10 warm-up frames, `node bench/run.mjs
--compare --frames=60`. "Before" is this branch's parent (`18d9f52`, integration branch at session
start) measured in this session; "after" is the better of two full runs on the branch merged with
the current integration branch (the host is noisy: three.js's own medians moved by 2x between runs).

### Target scenarios

| | before (jrs) | after (jrs) | three.js | pixel diff (mean / max) |
|---|---:|---:|---:|---|
| **shader-client** median | 4.3 ms (1,313 draws) | **0.9 ms (297 draws: 132 instanced / single + 165 multi-draw)** | 4.7-26 ms | 0 / 0 -> 0 / 0 |
| shader-client mean / worst | 19.7 / 675 ms | 1.3 / 5 ms | 25 / 726 ms | |
| **shader-client-static** median (3 passes) | 28.7 ms (217 draws per pass) | **0.6 ms (20 + 20 + 9 draws; every list replays)** | 46 ms | 0 / 0 -> 0 / 0 |
| shader-client-static mean / worst | 44.7 / 812 ms | 0.7 / 4 ms | 49 / 728 ms | |

GL calls per frame, shader-client (three -> jrs before -> jrs after): total 3,804 -> 3,320 -> **955**;
`uniform*` 1,054 -> 1,055 -> **481**; `bindVertexArray` 1,248 -> 763 -> **147**; context `draw*` calls
1,313 -> 1,313 -> **132** (plus 165 `multiDrawElementsWEBGL` on the extension object, which the GL
counter does not see; `renderer.info.render.calls` = 297); `useProgram` 13 -> 13 -> 13;
`bindTexture` 171 -> 171 -> 177 (the matrix texture is re-bound per batch through the state cache).
The remaining 481 uniform calls are the materials' own uniforms re-sent on every program switch
(24 material instances x ~20 changed values: `drawBase` per batch, the per-material samplers'
`bindTexture`s, and the two animated shared uniforms), i.e. the per-material cost the uniform-list
report identified as the floor.

shader-client-static, per pass (three -> jrs after): shadow RT `uniform*` 147 -> 25, draws 217 -> 20,
`bindVertexArray` 214 -> 23; near shadow RT 147 -> 25, 217 -> 20; main pass 184 -> 94, 217 -> 9,
`bindTexture` 44 -> 49; total GL calls 1,869 -> **373** (was 1,620). Lists replay every frame, so the
matrix textures are never re-filled or re-uploaded.

Draw-call anatomy of shader-client (per frame): the 442 pre-merged chunks (unique geometries, the
`BATCHED` shader that reads no object matrix) become **2 multi-draws** (one per material instance);
the 11 opaque groups of plastic / textured / diamondplate / ... over 20 shared geometries become 134
draws (the existing cost model picks instanced-per-geometry for runs whose geometries repeat, so the
large groups are 20 draws per material instance and the small ones one multi-draw each); the 150
depth-sorted transparent meshes (two shaders x two instances interleaved by depth) become ~160
multi-draws of 1-3 sub-draws each. Opaque draws: 1,163 -> ~137; transparent: 150 -> ~160 (unchanged
count, but each is now a multi-draw with the matrices in the texture, so no per-object uniform
uploads). Merging the two material instances of each shader (follow-up below) would bring the
transparent list to a handful of draws.

### All scenarios, both runs (merged code)

| Scenario | three.js median | jrs run 2 | jrs run 3 | draws (three -> jrs) | pixel diff (mean / max) | reference (latest.json before) |
|---|---:|---:|---:|---|---|---|
| dynamic-geometry-large | 2.0 ms | 2.0 ms | 2.0 ms | 12 -> 12 | 0 / 0 | 0 / 0 |
| dynamic-geometry | 1.2 ms | 1.3 ms | 1.2 ms | 200 -> 200 | 0 / 0 | 0 / 0 |
| shared-static | 17.2 ms | 0.9 ms | 1.0 ms | 10000 -> 1 | 0.347 / 8 | 0.347 / 8 |
| shared-animated | 19.7 ms | 7.9 ms | 9.6 ms | 10000 -> 1 | 0.346 / 9 | 0.346 / 9 |
| many-materials | 16.3 ms | 0.6 ms | 0.6 ms | 5000 -> 3 | 0 / 0 | 0 / 0 |
| unique-geometries | 6.3 ms | 0.6 ms | 0.8 ms | 2000 -> 1 | 0 / 0 | 0 / 0 |
| transparent-sort | 21.8 ms | 5.9 ms | 6.2 ms | 10000 -> 1 | 0 / 0 | 0 / 0 |
| hierarchy-animated | 29.3 ms | 5.4 ms | 6.7 ms | 8000 -> 1 | 0 / 0 | 0 / 0 |
| instanced-100k | 0.0 ms | 0.1 ms | 0.0 ms | 1 -> 1 | 0 / 0 | 0 / 0 |
| **shader-client** | 4.7 ms | **0.9 ms** | **0.9 ms** | 1313 -> 297 | 0 / 0 | 0 / 0 |
| **shader-client-static** | 46.2 ms | **0.6 ms** | **0.6 ms** | 217 -> 53 | 0 / 0 | 0 / 0 |
| skinned-crowd | 3.8 ms | 4.9 ms | 5.2 ms | 200 -> 200 | 0 / 2 | 0 / 2 |
| shadows | 89.8 ms | 0.3 ms | 0.6 ms | 4001 -> 2 | 0.134 / 33 | 0.134 / 33 |
| shadows-animated | 92.5 ms | 1.8 ms | 1.6 ms | 4001 -> 3 | 0.121 / 31 | 0.121 / 31 |
| shadows-point | 94.9 ms | 0.3 ms | 0.5 ms | 4001 -> 2 | 0 / 0 | 0 / 0 (point-shadows report) |
| shadows-point-animated | 78.0 ms | 2.0 ms | 2.1 ms | 4001 -> 3 | 0 / 0 | 0 / 0 (point-shadows report) |
| shadows-point-multi | 60.7 ms | 0.4 ms | 0.3 ms | 2031 -> 2 | 0.193 / 41 | 0.193 / 41 (point-shadows report) |

Every scenario keeps its reference pixel difference. The skinned-crowd and shared-animated medians
are noisy on this host (the branch does not touch skinning; shared-animated re-uploads 1.3 MB of
matrices per frame as before and sits inside its run-to-run spread of 4.5-9.6 ms across this
session's runs). The per-list matrix texture also helps scenes with both opaque and transparent
batches: the opaque list of `transparent-sort` replays now instead of refilling every frame.

### Validation

`npm test` 139/139 (133 before the merge); `node bench/conformance.mjs` all pass including the new
"ShaderMaterial batching: 50 instances reading modelViewMatrix / normalMatrix" check (76 -> 3
draws, max diff 0 vs individual draws, 0 / 0 vs three.js, hooked mesh keeps its per-object uniform);
`node bench/addons.mjs` and `node bench/smoke.mjs` pass with GL error 0; `bench/fuzz.mjs` does not
exist on this branch. Edge-case script (scratchpad, not committed): 8 shader kinds x 10 frames
(orbiting camera, rotating objects, a uniform changed without `needsUpdate`, an attribute update,
visibility toggles, the flag toggled off and on mid-run, an `InstancedBufferGeometry` mesh, a
mirrored mesh, an `onBeforeRender` hook, wireframe, transparent, RawShaderMaterial GLSL3, chunk-based,
a `gl_InstanceID` user, and an `overrideMaterial` depth pass into a render target): batched vs
unbatched max pixel difference **0** in every frame; vs three.js mean 0.000, max 1-4 on a handful of
pixels (the pre-existing float32-matrix noise; identical with the feature off).

## Risks

* **Shader analysis is textual.** A shader that reaches the object uniforms through means the scan
  does not model (a macro defined in `material.defines` that expands to `modelMatrix`, a
  `customProgramCacheKey` that swaps sources at runtime) could be misclassified. Defines are not
  expanded; the scan sees the literal names, and any directive line mentioning a name disqualifies
  the program, so the failure mode is "not batched", never "batched wrongly", unless the name
  arrives through an unrelated macro expansion.
* **`gl_DrawID` in a non-multi-draw call.** The single variant relies on `gl_DrawID == 0` for
  `drawElementsInstanced`, which the WEBGL_multi_draw spec guarantees and ANGLE implements. A driver
  that violated it would offset instances; `autoMultiDraw = false` does not remove the extension
  from the shader, `autoBatchShaderMaterials = false` does.
* **Per-object uniforms through `onBeforeRender` on a batched material** keep working for the hooked
  object (it is drawn alone with the per-object variant) but the material then carries two programs
  and switches between them each frame. Applications that set per-object uniforms this way for
  *every* object see no benefit and one extra program per shader.
* **GPU memory**: one matrix texture per render list (RGBA32F, 1024 x rows) and, in the
  mega-buffers, page buffers for custom attributes as well. Lists evicted from the per-scene list
  cache and pages do not free their GL textures / VAOs eagerly (the renderer's `dispose` frees the
  default slot; list slots live as long as the context).
* **Transparent runs across different geometries** become multi-draws only when the
  `WEBGL_multi_draw` extension exists; without it, consecutive transparent items with different
  geometries stay single draws (same as before).

## Follow-up ideas

* Merge runs of *different material instances of one shader* whose uniform values are equal that
  frame (the client's two instances per shader differ only in `reflectance` / `diffuseSamp`): a
  per-instance uniform record (like the material-index path of §4c) would halve the remaining draws.
* Per-instance uniforms: let an application mark a uniform as per-object (`uniform.perObject = true`)
  and store it in the matrix texture's spare texel, replacing the `onBeforeRender` pattern.
* Multi-draw without the extension: `drawArraysInstanced` over a merged index range is not possible,
  but a `drawElements` loop inside one VAO (the page) would still save the VAO binds.
* Free list texture slots when a `WebGLRenderList` is evicted or the scene is disposed.
