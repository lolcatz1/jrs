import { buildBuiltinShader, buildCustomShader, MAX_DIR_LIGHTS, MAX_POINT_LIGHTS, MAX_SPOT_LIGHTS, MAX_HEMI_LIGHTS } from './ShaderLib.js';
/** Public, read-only view of the shader library for debugging / tooling. */
export const ShaderLib = { buildBuiltinShader, buildCustomShader, MAX_DIR_LIGHTS, MAX_POINT_LIGHTS, MAX_SPOT_LIGHTS, MAX_HEMI_LIGHTS };
