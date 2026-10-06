import { Material } from './Material.js';
import { cloneUniforms, cloneUniformsGroups } from '../renderers/shaders/UniformsUtils.js';

const default_vertex = `void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
const default_fragment = `void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;

class ShaderMaterial extends Material {
	constructor(parameters) {
		super();
		this.isShaderMaterial = true;
		this.type = 'ShaderMaterial';
		this.defines = {};
		this.uniforms = {};
		this.uniformsGroups = [];
		this.vertexShader = default_vertex;
		this.fragmentShader = default_fragment;
		this.linewidth = 1;
		this.wireframe = false; this.wireframeLinewidth = 1;
		this.fog = false;
		this.lights = false;
		this.clipping = false;
		this.forceSinglePass = true;
		this.extensions = { clipCullDistance: false, multiDraw: false };
		this.defaultAttributeValues = { 'color': [1, 1, 1], 'uv': [0, 0], 'uv1': [0, 0] };
		this.index0AttributeName = undefined;
		this.uniformsNeedUpdate = false;
		this.glslVersion = null;
		if (parameters !== undefined) this.setValues(parameters);
	}
	copy(source) {
		super.copy(source);
		this.fragmentShader = source.fragmentShader;
		this.vertexShader = source.vertexShader;
		this.uniforms = cloneUniforms(source.uniforms);
		this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups);
		this.defines = Object.assign({}, source.defines);
		this.wireframe = source.wireframe; this.wireframeLinewidth = source.wireframeLinewidth;
		this.fog = source.fog; this.lights = source.lights; this.clipping = source.clipping;
		this.extensions = Object.assign({}, source.extensions);
		this.glslVersion = source.glslVersion;
		return this;
	}
}

export { ShaderMaterial };
