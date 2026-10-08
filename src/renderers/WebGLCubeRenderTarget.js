import { BackSide, LinearFilter, LinearMipmapLinearFilter, NoBlending } from '../constants.js';
import { Mesh } from '../objects/Mesh.js';
import { BoxGeometry } from '../geometries/BoxGeometry.js';
import { ShaderMaterial } from '../materials/ShaderMaterial.js';
import { cloneUniforms } from './shaders/UniformsUtils.js';
import { WebGLRenderTarget } from './WebGLRenderTarget.js';
import { CubeCamera } from '../cameras/CubeCamera.js';
import { CubeTexture } from '../textures/CubeTexture.js';

/** Render target with six faces; select the face to draw with `renderer.setRenderTarget(target, face)`. */
class WebGLCubeRenderTarget extends WebGLRenderTarget {
	constructor(size = 1, options = {}) {
		super(size, size, options);
		this.isWebGLCubeRenderTarget = true;
		const image = { width: size, height: size, depth: 1 };
		const old = this.texture;
		const texture = new CubeTexture([image, image, image, image, image, image], options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
		texture.generateMipmaps = old.generateMipmaps;
		texture.internalFormat = old.internalFormat;
		texture.isRenderTargetTexture = true;
		texture.renderTarget = this;
		this.texture = texture;
		this.textures = [texture];
	}
	setSize(width, height) {
		if (this.width !== width || this.height !== height) {
			this.width = width; this.height = height;
			const image = { width: width, height: height, depth: 1 };
			this.texture.image = [image, image, image, image, image, image];
			if (this.depthTexture) this.depthTexture.image = [image, image, image, image, image, image];
			this.dispose();
		}
		this.viewport.set(0, 0, width, height);
		this.scissor.set(0, 0, width, height);
	}
	/** Renders an equirectangular texture into the six faces (three.js r186). */
	fromEquirectangularTexture(renderer, texture) {
		this.texture.type = texture.type;
		this.texture.colorSpace = texture.colorSpace;
		this.texture.generateMipmaps = texture.generateMipmaps;
		this.texture.minFilter = texture.minFilter;
		this.texture.magFilter = texture.magFilter;
		const shader = {
			uniforms: { tEquirect: { value: null } },
			vertexShader: /* glsl */`
				varying vec3 vWorldDirection;
				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
				}
				void main() {
					vWorldDirection = transformDirection( position, modelMatrix );
					#include <begin_vertex>
					#include <project_vertex>
				}
			`,
			fragmentShader: /* glsl */`
				uniform sampler2D tEquirect;
				varying vec3 vWorldDirection;
				#include <common>
				void main() {
					vec3 direction = normalize( vWorldDirection );
					vec2 sampleUV = equirectUv( direction );
					gl_FragColor = texture2D( tEquirect, sampleUV );
				}
			`
		};
		const geometry = new BoxGeometry(5, 5, 5);
		const material = new ShaderMaterial({
			name: 'CubemapFromEquirect',
			uniforms: cloneUniforms(shader.uniforms),
			vertexShader: shader.vertexShader,
			fragmentShader: shader.fragmentShader,
			side: BackSide,
			blending: NoBlending
		});
		material.uniforms.tEquirect.value = texture;
		const mesh = new Mesh(geometry, material);
		const currentMinFilter = texture.minFilter;
		// Avoid blurred poles
		if (texture.minFilter === LinearMipmapLinearFilter) texture.minFilter = LinearFilter;
		const camera = new CubeCamera(1, 10, this);
		camera.update(renderer, mesh);
		texture.minFilter = currentMinFilter;
		mesh.geometry.dispose();
		mesh.material.dispose();
		return this;
	}
	/** Clears every face. */
	clear(renderer, color, depth, stencil) {
		const previous = renderer.getRenderTarget();
		for (let i = 0; i < 6; i++) { renderer.setRenderTarget(this, i); renderer.clear(color, depth, stencil); }
		renderer.setRenderTarget(previous);
	}
}

export { WebGLCubeRenderTarget };
