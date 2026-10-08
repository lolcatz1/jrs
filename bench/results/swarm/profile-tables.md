| scenario | lib | plain median ms | p90 | +gl.finish/frame | draws stubbed (pure CPU) | profiled steady ms | of which native GL | stall frames (ms total) | alloc bytes/frame |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| shared-static | three | 14.9 | 19.4 | 15.4 | 13.9 | 28.50 | 4.79 | 3 (14361.5) | 314,893 |
| shared-static | jrs | 4.8 | 7.7 | 4.6 | 4.2 | 8.26 | 0.08 | 1 (31.3) | 1,300,432 |
| shared-animated | three | 19.1 | 31.2 | 18.1 | 18.1 | 34.90 | 5.47 | 0 (0) | 435,391 |
| shared-animated | jrs | 7.8 | 13.4 | 11.5 | 7.9 | 14.03 | 0.47 | 4 (27738.1) | 698,188 |
| many-materials | three | 12.9 | 19.3 | 13.2 | 10.8 | 21.02 | 2.96 | 1 (10137.3) | 248,698 |
| many-materials | jrs | 6.1 | 9.1 | 4.5 | 4.2 | 8.52 | 0.47 | 2 (11670.2) | 658,394 |
| unique-geometries | three | 4.9 | 9.3 | 4.8 | 4.8 | 11.39 | 2.16 | 2 (3321.8) | 52,601 |
| unique-geometries | jrs | 1.2 | 1.9 | 1.2 | 1.1 | 2.27 | 0.07 | 2 (18.9) | 267,284 |
| hierarchy-animated | three | 24.7 | 26.5 | 24.5 | 21.9 | 40.56 | 3.06 | 2 (10959.3) | 1,074,387 |
| hierarchy-animated | jrs | 5.2 | 9.6 | 7.4 | 5.5 | 9.17 | 0.36 | 2 (11851.2) | 1,078,807 |
| instanced-100k | three | 0.1 | 0.1 | 0.1 | 0.0 | 0.28 | 0.01 | 2 (10.1) | 1,143 |
| instanced-100k | jrs | 0.0 | 0.1 | 0.1 | 0.0 | 0.35 | 0.03 | 1 (3.3) | 2,056 |
| shader-client | three | 5.5 | 8.2 | 4.9 | 6.7 | 9.51 | 1.45 | 2 (12570.9) | 131,854 |
| shader-client | jrs | 4.2 | 6.4 | 1.8 | 1.2 | 4.45 | 0.98 | 4 (12179.7) | 17,983 |
| shader-client-static | three | 59.8 | 82.5 | 58.0 | 1.5 | 113.93 | 107.42 | 3 (2728.6) | 53,895 |
| shader-client-static | jrs | 60.3 | 86.5 | 55.6 | 0.7 | 82.76 | 80.21 | 8 (5230.9) | 104,945 |
| shadows | three | 92.2 | 121.4 | 101.1 | 7.2 | 109.03 | 89.09 | 10 (9583.4) | 159,352 |
| shadows | jrs | 1.8 | 2.5 | 1.6 | 1.4 | 3.48 | 0.07 | 0 (0) | 268,050 |

### shared-static

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.020 | 0.2 | 0.000 | 0.006 | 0 | 0.000 |
| scene graph update | 2.729 | 33 | 0.000 | 2.862 | 10 | 0.000 |
| project + cull | 1.980 | 24 | 0.000 | 3.085 | 10.8 | 0.000 |
| sort | 0.205 | 2.5 | 0.000 | 0.551 | 1.9 | 0.000 |
| program resolve | 0.238 | 2.9 | 0.000 | – | – | – |
| draw-list build | 2.629 | 31.8 | 0.000 | 0.456 | 1.6 | 0.000 |
| per-draw state | 0.008 | 0.1 | 0.000 | 5.112 | 17.9 | 0.000 |
| uniform upload | 0.026 | 0.3 | 0.013 | 6.928 | 24.3 | 3.260 |
| geometry bind | 0.023 | 0.3 | 0.014 | 0.857 | 3 | 0.000 |
| draw issue | 0.018 | 0.2 | 0.011 | 2.637 | 9.3 | 0.000 |
| frame setup/other renderer | 0.108 | 1.3 | 0.038 | 5.566 | 19.5 | 1.528 |
| GC | 0.039 | 0.5 | 0.000 | 0.138 | 0.5 | 0.000 |
| (program)/VM | 0.047 | 0.6 | 0.000 | 0.135 | 0.5 | 0.000 |
| other JS | 0.194 | 2.3 | 0.000 | 0.167 | 0.6 | 0.000 |
| **total (steady, profiled)** | **8.26** | | **0.08** | **28.50** | | **4.79** |

jrs top self time (ms/frame, % of steady frame):

- 2.165 ms (26.2%) `_drawList [WebGLRenderer.js:765]`
- 1.514 ms (18.3%) `updateMatrixWorld [Object3D.js:295]`
- 1.215 ms (14.7%) `updateMatrix [Object3D.js:267]`
- 1.095 ms (13.3%) `_projectObject [WebGLRenderer.js:510]`
- 0.580 ms (7%) `_cullTest [WebGLRenderer.js:484]`
- 0.461 ms (5.6%) `_update [WebGLMegaBuffers.js:158]`
- 0.279 ms (3.4%) `push [WebGLRenderLists.js:48]`
- 0.238 ms (2.9%) `_resolvePrograms [WebGLRenderer.js:574]`
- 0.205 ms (2.5%) `finish [WebGLRenderLists.js:73]`
- 0.138 ms (1.7%) `now [(native)]`
- 0.067 ms (0.8%) `render [WebGLRenderer.js:354]`
- 0.047 ms (0.6%) `(program) [(native)]`

three top self time:

- 3.950 ms (13.9%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 2.979 ms (10.5%) `setProgram [WebGLRenderer:18407]`
- 2.091 ms (7.3%) `updateMatrixWorld [Object3D:13067]`
- 2.047 ms (7.2%) `setMaterial [WebGLState:10409]`
- 1.931 ms (6.8%) `multiplyMatrices [Matrix4:10570]`
- 1.927 ms (6.8%) `setValueM4 [setValueM4:5284]`
- 1.708 ms (6%) `setValueM3 [setValueM3:5257]`
- 1.696 ms (5.9%) `uniformMatrix4fv [(native)]`

jrs allocations 1,300,432 bytes/frame:
- 1,201,935 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 97,031 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 600 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`

jrs stall frames during the profiled run (excluded from the table):
- frame 70: 31.3 ms — _drawList [WebGLRenderer.js:765] 9.3ms | updateMatrixWorld [Object3D.js:295] 5.5ms | updateMatrix [Object3D.js:267] 4.1ms

jrs worst frames (unprofiled run): #38 9.9 ms, #17 8.3 ms, #110 8.1 ms, #106 8 ms, #107 8 ms; GC frames 0/120

### shared-animated

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 3.172 | 22.6 | 0.000 | 3.106 | 8.9 | 0.000 |
| scene graph update | 3.571 | 25.5 | 0.000 | 3.238 | 9.3 | 0.000 |
| project + cull | 2.597 | 18.5 | 0.000 | 3.395 | 9.7 | 0.000 |
| sort | 0.205 | 1.5 | 0.000 | 0.609 | 1.7 | 0.000 |
| program resolve | 0.207 | 1.5 | 0.000 | – | – | – |
| draw-list build | 2.850 | 20.3 | 0.000 | 0.560 | 1.6 | 0.000 |
| batch matrix upload | 0.392 | 2.8 | 0.383 | – | – | – |
| per-draw state | 0.012 | 0.1 | 0.000 | 5.549 | 15.9 | 0.000 |
| uniform upload | 0.029 | 0.2 | 0.006 | 7.906 | 22.7 | 3.915 |
| geometry bind | 0.020 | 0.1 | 0.014 | 0.877 | 2.5 | 0.000 |
| draw issue | 0.406 | 2.9 | 0.012 | 2.752 | 7.9 | 0.000 |
| frame setup/other renderer | 0.114 | 0.8 | 0.056 | 6.420 | 18.4 | 1.559 |
| GC | 0.245 | 1.7 | 0.000 | 0.152 | 0.4 | 0.000 |
| (program)/VM | 0.069 | 0.5 | 0.000 | 0.154 | 0.4 | 0.000 |
| other JS | 0.134 | 1 | 0.000 | 0.178 | 0.5 | 0.000 |
| **total (steady, profiled)** | **14.03** | | **0.47** | **34.90** | | **5.47** |

jrs top self time (ms/frame, % of steady frame):

- 2.333 ms (16.6%) `_drawList [WebGLRenderer.js:765]`
- 1.722 ms (12.3%) `setFromEuler [Quaternion.js:50]`
- 1.403 ms (10%) `updateMatrix [Object3D.js:267]`
- 1.361 ms (9.7%) `_projectObject [WebGLRenderer.js:510]`
- 1.224 ms (8.7%) `updateMatrixWorld [Object3D.js:295]`
- 1.085 ms (7.7%) `set y [Euler.js:16]`
- 0.945 ms (6.7%) `_cullTest [WebGLRenderer.js:484]`
- 0.944 ms (6.7%) `multiplyMatrices [Matrix4.js:133]`
- 0.515 ms (3.7%) `_update [WebGLMegaBuffers.js:158]`
- 0.379 ms (2.7%) `computeNormalMatrix [TransformSlab.js:79]`
- 0.374 ms (2.7%) `texSubImage2D [(native)]`
- 0.365 ms (2.6%) `doFrame [(native)]`

three top self time:

- 4.766 ms (13.7%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 3.351 ms (9.6%) `setProgram [WebGLRenderer:18407]`
- 2.334 ms (6.7%) `updateMatrixWorld [Object3D:13067]`
- 2.212 ms (6.3%) `multiplyMatrices [Matrix4:10570]`
- 2.116 ms (6.1%) `setMaterial [WebGLState:10409]`
- 2.115 ms (6.1%) `setValueM4 [setValueM4:5284]`
- 1.970 ms (5.6%) `uniformMatrix3fv [(native)]`
- 1.945 ms (5.6%) `uniformMatrix4fv [(native)]`

jrs allocations 698,188 bytes/frame:
- 480,152 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 119,305 B `doFrame [(native)]  <- window.__runFrames [(native)]`
- 97,211 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 604 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`

jrs stall frames during the profiled run (excluded from the table):
- frame 9: 15134.9 ms — texSubImage2D [(native)] 15126.4ms | _drawList [WebGLRenderer.js:765] 1.9ms | set y [Euler.js:16] 1.4ms
- frame 97: 12488.1 ms — texSubImage2D [(native)] 12461.0ms | _drawList [WebGLRenderer.js:765] 6.0ms | _projectObject [WebGLRenderer.js:510] 3.5ms
- frame 92: 64.9 ms — _projectObject [WebGLRenderer.js:510] 14.1ms | _drawList [WebGLRenderer.js:765] 8.5ms | texSubImage2D [(native)] 7.8ms
- frame 91: 50.2 ms — _drawList [WebGLRenderer.js:765] 10.5ms | texSubImage2D [(native)] 9.0ms | _projectObject [WebGLRenderer.js:510] 7.0ms

jrs worst frames (unprofiled run): #18 2244.5 ms, #86 20.6 ms, #45 14.4 ms, #41 14.3 ms, #51 14.3 ms; GC frames 0/120

### many-materials

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| scene graph update | 1.451 | 17 | 0.000 | 1.390 | 6.6 | 0.000 |
| project + cull | 1.128 | 13.2 | 0.000 | 1.203 | 5.7 | 0.000 |
| sort | 0.709 | 8.3 | 0.000 | 1.440 | 6.9 | 0.000 |
| program resolve | 0.287 | 3.4 | 0.000 | – | – | – |
| draw-list build | 3.442 | 40.4 | 0.000 | 2.066 | 9.8 | 0.000 |
| batch matrix upload | 0.018 | 0.2 | 0.000 | – | – | – |
| per-draw state | 0.104 | 1.2 | 0.042 | 3.707 | 17.6 | 0.000 |
| uniform upload | 0.057 | 0.7 | 0.002 | 3.004 | 14.3 | 1.147 |
| geometry bind | 0.175 | 2.1 | 0.127 | 0.468 | 2.2 | 0.000 |
| draw issue | 0.504 | 5.9 | 0.282 | 2.827 | 13.5 | 0.000 |
| frame setup/other renderer | 0.144 | 1.7 | 0.017 | 4.553 | 21.7 | 1.811 |
| GC | 0.227 | 2.7 | 0.000 | 0.084 | 0.4 | 0.000 |
| (program)/VM | 0.060 | 0.7 | 0.000 | 0.099 | 0.5 | 0.000 |
| other JS | 0.204 | 2.4 | 0.002 | 0.177 | 0.8 | 0.002 |
| **total (steady, profiled)** | **8.52** | | **0.47** | **21.02** | | **2.96** |

jrs top self time (ms/frame, % of steady frame):

- 2.703 ms (31.7%) `_drawList [WebGLRenderer.js:765]`
- 0.744 ms (8.7%) `updateMatrixWorld [Object3D.js:295]`
- 0.709 ms (8.3%) `finish [WebGLRenderLists.js:73]`
- 0.707 ms (8.3%) `updateMatrix [Object3D.js:267]`
- 0.706 ms (8.3%) `_projectObject [WebGLRenderer.js:510]`
- 0.640 ms (7.5%) `_update [WebGLMegaBuffers.js:158]`
- 0.261 ms (3.1%) `_cullTest [WebGLRenderer.js:484]`
- 0.227 ms (2.7%) `(garbage collector) [(native)]`
- 0.191 ms (2.2%) `_renderBatch [WebGLRenderer.js:993]`
- 0.190 ms (2.2%) `_resolvePrograms [WebGLRenderer.js:574]`
- 0.162 ms (1.9%) `now [(native)]`
- 0.158 ms (1.9%) `drawElementsInstanced [(native)]`

three top self time:

- 2.690 ms (12.8%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 2.557 ms (12.2%) `setProgram [WebGLRenderer:18407]`
- 2.350 ms (11.2%) `multiplyMatrices [Matrix4:10570]`
- 2.065 ms (9.8%) `renderObjects [WebGLRenderer:18165]`
- 1.122 ms (5.3%) `setMaterial [WebGLState:10409]`
- 1.120 ms (5.3%) `setValueM4 [setValueM4:5284]`
- 1.098 ms (5.2%) `uniformMatrix4fv [(native)]`
- 1.037 ms (4.9%) `updateMatrixWorld [Object3D:13067]`

jrs allocations 658,394 bytes/frame:
- 600,048 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 56,784 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 591 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`

jrs stall frames during the profiled run (excluded from the table):
- frame 21: 11633.7 ms — drawElementsInstanced [(native)] 11623.3ms | _drawList [WebGLRenderer.js:765] 3.4ms | updateMatrix [Object3D.js:267] 0.9ms
- frame 22: 36.5 ms — _drawList [WebGLRenderer.js:765] 12.0ms | _update [WebGLMegaBuffers.js:158] 5.8ms | updateMatrixWorld [Object3D.js:295] 5.7ms

jrs worst frames (unprofiled run): #33 1491.1 ms, #49 9.7 ms, #81 9.7 ms, #50 9.5 ms, #8 9.4 ms; GC frames 0/120

### unique-geometries

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.009 | 0.4 | 0.000 | 0.024 | 0.2 | 0.000 |
| scene graph update | 0.453 | 20 | 0.000 | 0.709 | 6.2 | 0.000 |
| project + cull | 0.317 | 14 | 0.000 | 0.639 | 5.6 | 0.000 |
| sort | 0.232 | 10.2 | 0.000 | 0.140 | 1.2 | 0.000 |
| program resolve | 0.042 | 1.9 | 0.000 | 0.008 | 0.1 | 0.000 |
| draw-list build | 0.944 | 41.6 | 0.000 | 0.186 | 1.6 | 0.000 |
| per-draw state | 0.005 | 0.2 | 0.000 | 1.171 | 10.3 | 0.000 |
| uniform upload | 0.007 | 0.3 | 0.005 | 1.300 | 11.4 | 0.611 |
| draw issue | 0.052 | 2.3 | 0.049 | 0.701 | 6.2 | 0.000 |
| frame setup/other renderer | 0.031 | 1.4 | 0.013 | 4.015 | 35.2 | 1.547 |
| GC | 0.010 | 0.5 | 0.000 | 0.023 | 0.2 | 0.000 |
| (program)/VM | 0.007 | 0.3 | 0.000 | 0.103 | 0.9 | 0.000 |
| other JS | 0.152 | 6.7 | 0.000 | 0.144 | 1.3 | 0.000 |
| geometry bind | – | – | – | 2.229 | 19.6 | 0.000 |
| **total (steady, profiled)** | **2.27** | | **0.07** | **11.39** | | **2.16** |

jrs top self time (ms/frame, % of steady frame):

- 0.409 ms (18%) `_drawList [WebGLRenderer.js:765]`
- 0.299 ms (13.2%) `updateMatrixWorld [Object3D.js:295]`
- 0.289 ms (12.7%) `_update [WebGLMegaBuffers.js:158]`
- 0.247 ms (10.9%) `ensure [WebGLMegaBuffers.js:75]`
- 0.232 ms (10.2%) `finish [WebGLRenderLists.js:73]`
- 0.154 ms (6.8%) `updateMatrix [Object3D.js:267]`
- 0.143 ms (6.3%) `now [(native)]`
- 0.141 ms (6.2%) `_projectObject [WebGLRenderer.js:510]`
- 0.115 ms (5.1%) `_cullTest [WebGLRenderer.js:484]`
- 0.053 ms (2.3%) `push [WebGLRenderLists.js:48]`
- 0.040 ms (1.8%) `multiDrawElementsWEBGL [(native)]`
- 0.039 ms (1.7%) `_resolvePrograms [WebGLRenderer.js:574]`

three top self time:

- 2.425 ms (21.3%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 0.962 ms (8.4%) `bindVertexArray [(native)]`
- 0.880 ms (7.7%) `update [WebGLObjects:4612]`
- 0.825 ms (7.2%) `needsUpdate [WebGLBindingStates:1759]`
- 0.694 ms (6.1%) `setProgram [WebGLRenderer:18407]`
- 0.620 ms (5.4%) `setValueM4 [setValueM4:5284]`
- 0.611 ms (5.4%) `uniformMatrix4fv [(native)]`
- 0.576 ms (5.1%) `drawElements [(native)]`

jrs allocations 267,284 bytes/frame:
- 241,783 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 23,920 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 699 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`

jrs stall frames during the profiled run (excluded from the table):
- frame 86: 9.8 ms — (idle) [(native)] 5.5ms | _update [WebGLMegaBuffers.js:158] 0.6ms | finish [WebGLRenderLists.js:73] 0.5ms
- frame 68: 9.1 ms — _drawList [WebGLRenderer.js:765] 1.9ms | _update [WebGLMegaBuffers.js:158] 1.3ms | updateMatrix [Object3D.js:267] 1.1ms

jrs worst frames (unprofiled run): #31 2.9 ms, #81 2.5 ms, #0 2.4 ms, #23 2.4 ms, #24 2.4 ms; GC frames 0/120

### hierarchy-animated

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.136 | 1.5 | 0.000 | 0.070 | 0.2 | 0.000 |
| scene graph update | 2.957 | 32.2 | 0.000 | 7.218 | 17.8 | 0.000 |
| project + cull | 2.297 | 25 | 0.000 | 9.451 | 23.3 | 0.000 |
| sort | 0.177 | 1.9 | 0.000 | 3.297 | 8.1 | 0.000 |
| program resolve | 0.173 | 1.9 | 0.000 | – | – | – |
| draw-list build | 2.038 | 22.2 | 0.000 | 2.149 | 5.3 | 0.000 |
| batch matrix upload | 0.260 | 2.8 | 0.254 | – | – | – |
| per-draw state | 0.019 | 0.2 | 0.000 | 3.891 | 9.6 | 0.000 |
| uniform upload | 0.012 | 0.1 | 0.008 | 3.295 | 8.1 | 1.633 |
| geometry bind | 0.021 | 0.2 | 0.010 | 0.541 | 1.3 | 0.000 |
| draw issue | 0.348 | 3.8 | 0.005 | 5.260 | 13 | 0.000 |
| frame setup/other renderer | 0.166 | 1.8 | 0.084 | 4.867 | 12 | 1.427 |
| GC | 0.320 | 3.5 | 0.000 | 0.202 | 0.5 | 0.000 |
| (program)/VM | 0.076 | 0.8 | 0.000 | 0.130 | 0.3 | 0.000 |
| other JS | 0.171 | 1.9 | 0.000 | 0.193 | 0.5 | 0.000 |
| **total (steady, profiled)** | **9.17** | | **0.36** | **40.56** | | **3.06** |

jrs top self time (ms/frame, % of steady frame):

- 1.644 ms (17.9%) `_drawList [WebGLRenderer.js:765]`
- 1.368 ms (14.9%) `_projectObject [WebGLRenderer.js:510]`
- 1.288 ms (14%) `updateMatrixWorld [Object3D.js:295]`
- 0.992 ms (10.8%) `updateMatrix [Object3D.js:267]`
- 0.677 ms (7.4%) `multiplyMatrices [Matrix4.js:133]`
- 0.659 ms (7.2%) `_cullTest [WebGLRenderer.js:484]`
- 0.393 ms (4.3%) `_update [WebGLMegaBuffers.js:158]`
- 0.330 ms (3.6%) `computeNormalMatrix [TransformSlab.js:79]`
- 0.320 ms (3.5%) `(garbage collector) [(native)]`
- 0.262 ms (2.9%) `push [WebGLRenderLists.js:48]`
- 0.248 ms (2.7%) `texSubImage2D [(native)]`
- 0.177 ms (1.9%) `finish [WebGLRenderLists.js:73]`

three top self time:

- 6.466 ms (15.9%) `updateMatrixWorld [Object3D:13067]`
- 5.200 ms (12.8%) `projectObject [WebGLRenderer:17897]`
- 4.272 ms (10.5%) `multiplyMatrices [Matrix4:10570]`
- 3.361 ms (8.3%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 2.550 ms (6.3%) `intersectsObject [Frustum:25925]`
- 2.161 ms (5.3%) `setProgram [WebGLRenderer:18407]`
- 2.149 ms (5.3%) `renderObjects [WebGLRenderer:18165]`
- 1.824 ms (4.5%) `sort [WebGLRenderList:8213]`

jrs allocations 1,078,807 bytes/frame:
- 978,279 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 96,614 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 2,400 B `doFrame [(native)]  <- window.__runFrames [(native)]`
- 639 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`

jrs stall frames during the profiled run (excluded from the table):
- frame 13: 11801 ms — texSubImage2D [(native)] 11779.5ms | _projectObject [WebGLRenderer.js:510] 4.1ms | _drawList [WebGLRenderer.js:765] 3.4ms
- frame 79: 50.2 ms — _drawList [WebGLRenderer.js:765] 8.5ms | _projectObject [WebGLRenderer.js:510] 8.2ms | updateMatrixWorld [Object3D.js:295] 7.1ms

jrs worst frames (unprofiled run): #24 1187.1 ms, #9 11.5 ms, #15 11.3 ms, #11 11.1 ms, #10 10.4 ms; GC frames 0/120

### instanced-100k

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.011 | 3.1 | 0.000 | 0.006 | 2.3 | 0.000 |
| uniform upload | 0.025 | 7.1 | 0.022 | 0.006 | 2.3 | 0.000 |
| frame setup/other renderer | 0.014 | 3.9 | 0.003 | 0.026 | 9.1 | 0.006 |
| other JS | 0.293 | 83.6 | 0.000 | 0.216 | 77.1 | 0.000 |
| per-draw state | – | – | – | 0.013 | 4.7 | 0.000 |
| **total (steady, profiled)** | **0.35** | | **0.03** | **0.28** | | **0.01** |

jrs top self time (ms/frame, % of steady frame):

- 0.283 ms (80.8%) `now [(native)]`
- 0.025 ms (7.1%) `bufferSubData [(native)]`
- 0.011 ms (3.1%) `doFrame [(native)]`
- 0.010 ms (2.7%) `window.__runFrames [(native)]`
- 0.008 ms (2.4%) `render [WebGLRenderer.js:354]`
- 0.003 ms (0.8%) `_projectObject [WebGLRenderer.js:510]`
- 0.003 ms (0.8%) `_cullTest [WebGLRenderer.js:484]`
- 0.003 ms (0.8%) `begin [WebGLLights.js:35]`
- 0.003 ms (0.8%) `get [WebGLRenderLists.js:112]`
- 0.003 ms (0.7%) `_uploadFrameBlock [WebGLRenderer.js:457]`

three top self time:

- 0.200 ms (71.3%) `now [(native)]`
- 0.016 ms (5.8%) `window.__runFrames [(native)]`
- 0.007 ms (2.4%) `WebGLShadowMap.render [WebGLShadowMap:9143]`
- 0.007 ms (2.4%) `WebGLRenderer.render [WebGLRenderer:17674]`
- 0.007 ms (2.4%) `setProgram [WebGLRenderer:18407]`
- 0.006 ms (2.3%) `doFrame [(native)]`
- 0.006 ms (2%) `clear [(native)]`
- 0.005 ms (1.7%) `setFromProjectionMatrix [Frustum:25874]`

jrs allocations 2,056 bytes/frame:
- 561 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`
- 509 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`

jrs stall frames during the profiled run (excluded from the table):
- frame 54: 3.3 ms — (idle) [(native)] 2.6ms | (anonymous) [(native)] 0.4ms | _promiseAwareJsonValueNoThrow [(native)] 0.3ms

jrs worst frames (unprofiled run): #0 1 ms, #29 0.2 ms, #49 0.2 ms, #68 0.2 ms, #73 0.2 ms; GC frames 0/120

### shader-client

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.026 | 0.6 | 0.000 | 0.018 | 0.2 | 0.000 |
| scene graph update | 0.121 | 2.7 | 0.000 | 0.290 | 3 | 0.000 |
| project + cull | 0.239 | 5.4 | 0.000 | 0.364 | 3.8 | 0.000 |
| sort | 0.183 | 4.1 | 0.000 | 0.352 | 3.7 | 0.000 |
| program resolve | 0.038 | 0.8 | 0.000 | 0.004 | 0 | 0.000 |
| draw-list build | 0.135 | 3 | 0.000 | 0.195 | 2 | 0.000 |
| per-draw state | 0.151 | 3.4 | 0.018 | 1.138 | 12 | 0.016 |
| uniform upload | 1.441 | 32.4 | 0.075 | 0.827 | 8.7 | 0.377 |
| texture bind | 0.193 | 4.3 | 0.050 | 0.125 | 1.3 | 0.050 |
| geometry bind | 0.746 | 16.8 | 0.380 | 4.378 | 46 | 0.688 |
| draw issue | 0.913 | 20.5 | 0.432 | 0.763 | 8 | 0.284 |
| frame setup/other renderer | 0.035 | 0.8 | 0.025 | 0.698 | 7.3 | 0.037 |
| GC | 0.014 | 0.3 | 0.000 | 0.059 | 0.6 | 0.000 |
| (program)/VM | 0.055 | 1.2 | 0.000 | 0.112 | 1.2 | 0.000 |
| other JS | 0.164 | 3.7 | 0.002 | 0.186 | 2 | 0.000 |
| **total (steady, profiled)** | **4.45** | | **0.98** | **9.51** | | **1.45** |

jrs top self time (ms/frame, % of steady frame):

- 0.686 ms (15.4%) `setUniformValueImpl [WebGLRenderer.js:1174]`
- 0.612 ms (13.7%) `_uploadShaderMaterialUniforms [WebGLRenderer.js:1045]`
- 0.380 ms (8.5%) `bindVertexArray [(native)]`
- 0.346 ms (7.8%) `_renderItem [WebGLRenderer.js:958]`
- 0.333 ms (7.5%) `bind [WebGLBindingStates.js:47]`
- 0.219 ms (4.9%) `uniformMatrix4fv [(native)]`
- 0.213 ms (4.8%) `drawElements [(native)]`
- 0.183 ms (4.1%) `finish [WebGLRenderLists.js:73]`
- 0.142 ms (3.2%) `now [(native)]`
- 0.139 ms (3.1%) `_projectObject [WebGLRenderer.js:510]`
- 0.135 ms (3%) `_drawList [WebGLRenderer.js:765]`
- 0.134 ms (3%) `_draw [WebGLRenderer.js:1012]`

three top self time:

- 1.608 ms (16.9%) `setup [WebGLBindingStates:1623]`
- 1.192 ms (12.5%) `needsUpdate [WebGLBindingStates:1759]`
- 0.740 ms (7.8%) `setProgram [WebGLRenderer:18407]`
- 0.688 ms (7.2%) `bindVertexArray [(native)]`
- 0.578 ms (6.1%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 0.456 ms (4.8%) `update [WebGLObjects:4612]`
- 0.360 ms (3.8%) `setMaterial [WebGLState:10409]`
- 0.323 ms (3.4%) `uniformMatrix4fv [(native)]`

jrs allocations 17,983 bytes/frame:
- 16,067 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 600 B `_uploadFrameBlock [WebGLRenderer.js:457]  <- render [WebGLRenderer.js:354]`
- 371 B `setUniformValueImpl [WebGLRenderer.js:1174]  <- _uploadShaderMaterialUniforms [WebGLRenderer.js:1045]`

jrs stall frames during the profiled run (excluded from the table):
- frame 2: 12111.6 ms — uniformMatrix4fv [(native)] 12064.0ms | bindVertexArray [(native)] 16.0ms | drawElements [(native)] 7.0ms
- frame 15: 26.6 ms — uniformMatrix4fv [(native)] 6.8ms | bindTexture [(native)] 4.8ms | _uploadShaderMaterialUniforms [WebGLRenderer.js:1045] 3.4ms
- frame 4: 22.7 ms — uniformMatrix4fv [(native)] 14.5ms | drawElements [(native)] 3.8ms | _uploadShaderMaterialUniforms [WebGLRenderer.js:1045] 0.9ms
- frame 16: 18.8 ms — _renderItem [WebGLRenderer.js:958] 5.0ms | _uploadShaderMaterialUniforms [WebGLRenderer.js:1045] 2.0ms | bind [WebGLBindingStates.js:47] 1.6ms

jrs worst frames (unprofiled run): #9 2181.7 ms, #30 9.7 ms, #33 8.7 ms, #31 8.3 ms, #11 8.1 ms; GC frames 0/120

### shader-client-static

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.033 | 0 | 0.000 | 0.039 | 0 | 0.000 |
| scene graph update | 0.080 | 0.1 | 0.000 | 0.157 | 0.1 | 0.000 |
| project + cull | 0.328 | 0.4 | 0.000 | 0.360 | 0.3 | 0.000 |
| sort | 0.064 | 0.1 | 0.000 | 0.280 | 0.2 | 0.000 |
| program resolve | 0.199 | 0.2 | 0.000 | – | – | – |
| draw-list build | 0.096 | 0.1 | 0.000 | 0.129 | 0.1 | 0.000 |
| per-draw state | 1.423 | 1.7 | 1.258 | 69.328 | 60.9 | 68.542 |
| uniform upload | 0.989 | 1.2 | 0.451 | 1.024 | 0.9 | 0.660 |
| texture bind | 0.940 | 1.1 | 0.906 | 0.601 | 0.5 | 0.569 |
| geometry bind | 3.651 | 4.4 | 3.239 | 18.135 | 15.9 | 15.561 |
| draw issue | 74.707 | 90.3 | 74.311 | 18.732 | 16.4 | 18.128 |
| frame setup/other renderer | 0.128 | 0.2 | 0.045 | 4.832 | 4.2 | 3.964 |
| GC | 0.007 | 0 | 0.000 | 0.040 | 0 | 0.000 |
| other JS | 0.112 | 0.1 | 0.000 | 0.151 | 0.1 | 0.000 |
| (program)/VM | – | – | – | 0.122 | 0.1 | 0.000 |
| **total (steady, profiled)** | **82.76** | | **80.21** | **113.93** | | **107.42** |

jrs top self time (ms/frame, % of steady frame):

- 61.161 ms (73.9%) `uniformMatrix4fv [(native)]`
- 13.155 ms (15.9%) `drawElements [(native)]`
- 3.239 ms (3.9%) `bindVertexArray [(native)]`
- 1.240 ms (1.5%) `useProgram [(native)]`
- 0.906 ms (1.1%) `bindTexture [(native)]`
- 0.431 ms (0.5%) `uniform1f [(native)]`
- 0.401 ms (0.5%) `bind [WebGLBindingStates.js:47]`
- 0.287 ms (0.3%) `setUniformValueImpl [WebGLRenderer.js:1174]`
- 0.216 ms (0.3%) `_renderItem [WebGLRenderer.js:958]`
- 0.206 ms (0.2%) `_uploadShaderMaterialUniforms [WebGLRenderer.js:1045]`
- 0.205 ms (0.2%) `_projectObject [WebGLRenderer.js:510]`
- 0.159 ms (0.2%) `_resolvePrograms [WebGLRenderer.js:574]`

three top self time:

- 68.481 ms (60.1%) `uniformMatrix4fv [(native)]`
- 22.019 ms (19.3%) `drawElements [(native)]`
- 15.561 ms (13.7%) `bindVertexArray [(native)]`
- 1.292 ms (1.1%) `needsUpdate [WebGLBindingStates:1759]`
- 0.739 ms (0.6%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 0.712 ms (0.6%) `setup [WebGLBindingStates:1623]`
- 0.649 ms (0.6%) `uniform1f [(native)]`
- 0.569 ms (0.5%) `bindTexture [(native)]`

jrs allocations 104,945 bytes/frame:
- 73,890 B `_resolvePrograms [WebGLRenderer.js:574]  <- render [WebGLRenderer.js:354]`
- 9,726 B `customProgramKey [WebGLPrograms.js:128]  <- _resolvePrograms [WebGLRenderer.js:574]`
- 9,644 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 4,774 B `getParameters [WebGLPrograms.js:185]  <- _resolvePrograms [WebGLRenderer.js:574]`

jrs stall frames during the profiled run (excluded from the table):
- frame 32: 1518.1 ms — uniformMatrix4fv [(native)] 1249.2ms | drawElements [(native)] 235.1ms | bindVertexArray [(native)] 20.9ms
- frame 10: 1290.4 ms — uniformMatrix4fv [(native)] 1243.3ms | drawElements [(native)] 39.8ms | setUniformValueImpl [WebGLRenderer.js:1174] 2.9ms
- frame 30: 506.3 ms — uniformMatrix4fv [(native)] 381.6ms | drawElements [(native)] 102.7ms | bindVertexArray [(native)] 16.8ms
- frame 31: 440.3 ms — uniformMatrix4fv [(native)] 323.6ms | drawElements [(native)] 70.8ms | bindVertexArray [(native)] 18.8ms

jrs worst frames (unprofiled run): #19 1299.4 ms, #59 125.5 ms, #115 116.1 ms, #54 112.7 ms, #47 111.1 ms; GC frames 0/120

### shadows

| phase | jrs ms/frame | jrs % | jrs native GL | three ms/frame | three % | three native GL |
|---|---:|---:|---:|---:|---:|---:|
| app update | 0.014 | 0.4 | 0.000 | 0.008 | 0 | 0.000 |
| scene graph update | 0.647 | 18.6 | 0.000 | 0.760 | 0.7 | 0.000 |
| project + cull | 0.460 | 13.2 | 0.000 | 0.858 | 0.8 | 0.000 |
| sort | 0.047 | 1.4 | 0.000 | 0.779 | 0.7 | 0.000 |
| program resolve | 0.049 | 1.4 | 0.000 | 0.013 | 0 | 0.000 |
| shadow pass | 1.282 | 36.9 | 0.045 | – | – | – |
| draw-list build | 0.706 | 20.3 | 0.000 | 0.434 | 0.4 | 0.000 |
| per-draw state | 0.014 | 0.4 | 0.002 | 3.129 | 2.9 | 0.047 |
| uniform upload | 0.009 | 0.3 | 0.009 | 77.263 | 70.9 | 74.831 |
| geometry bind | 0.009 | 0.3 | 0.004 | 5.655 | 5.2 | 0.016 |
| draw issue | 0.004 | 0.1 | 0.001 | 15.758 | 14.5 | 14.198 |
| frame setup/other renderer | 0.040 | 1.2 | 0.010 | 3.964 | 3.6 | 0.000 |
| GC | 0.020 | 0.6 | 0.000 | 0.134 | 0.1 | 0.000 |
| (program)/VM | 0.055 | 1.6 | 0.000 | 0.128 | 0.1 | 0.000 |
| other JS | 0.116 | 3.3 | 0.000 | 0.146 | 0.1 | 0.000 |
| **total (steady, profiled)** | **3.48** | | **0.07** | **109.03** | | **89.09** |

jrs top self time (ms/frame, % of steady frame):

- 1.131 ms (32.5%) `_drawList [WebGLRenderer.js:765]`
- 0.432 ms (12.4%) `updateMatrixWorld [Object3D.js:295]`
- 0.293 ms (8.4%) `_update [WebGLMegaBuffers.js:158]`
- 0.286 ms (8.2%) `_pushItem [WebGLRenderer.js:559]`
- 0.241 ms (6.9%) `_cullTest [WebGLRenderer.js:484]`
- 0.215 ms (6.2%) `updateMatrix [Object3D.js:267]`
- 0.160 ms (4.6%) `_projectObject [WebGLRenderer.js:510]`
- 0.105 ms (3%) `finish [WebGLRenderLists.js:73]`
- 0.105 ms (3%) `_resolvePrograms [WebGLRenderer.js:574]`
- 0.100 ms (2.9%) `_collect [WebGLShadowMap.js:84]`
- 0.097 ms (2.8%) `now [(native)]`
- 0.045 ms (1.3%) `(idle) [(native)]`

three top self time:

- 74.831 ms (68.6%) `uniformMatrix4fv [(native)]`
- 14.198 ms (13%) `drawElements [(native)]`
- 2.858 ms (2.6%) `needsUpdate [WebGLBindingStates:1759]`
- 2.532 ms (2.3%) `WebGLRenderer.renderBufferDirect [WebGLRenderer:17233]`
- 2.335 ms (2.1%) `setup [WebGLBindingStates:1623]`
- 1.981 ms (1.8%) `setValueM4 [setValueM4:5284]`
- 1.699 ms (1.6%) `setProgram [WebGLRenderer:18407]`
- 1.283 ms (1.2%) `setMaterial [WebGLState:10409]`

jrs allocations 268,050 bytes/frame:
- 242,090 B `updateMatrix [Object3D.js:267]  <- updateMatrixWorld [Object3D.js:295]`
- 23,980 B `_projectObject [WebGLRenderer.js:510]  <- _projectObject [WebGLRenderer.js:510]`
- 231 B `subarray [(native)]  <- finish [WebGLRenderLists.js:73]`

jrs worst frames (unprofiled run): #62 5.4 ms, #41 3.9 ms, #24 3.5 ms, #30 3.3 ms, #3 3 ms; GC frames 0/120
