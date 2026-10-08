// Ported from three.js r186 (MIT License, Copyright 2010-2026 three.js authors).
import { BackSide, LinearFilter, LinearMipmapLinearFilter, NoBlending } from '../constants.js';
import { Mesh } from '../objects/Mesh.js';
import { BoxGeometry } from '../geometries/BoxGeometry.js';
import { ShaderMaterial } from '../materials/ShaderMaterial.js';
import { cloneUniforms } from './shaders/UniformsUtils.js';
import { WebGLRenderTarget } from './WebGLRenderTarget.js';
import { CubeCamera } from '../cameras/CubeCamera.js';
import { CubeTexture } from '../textures/CubeTexture.js';

/**
 * A render target whose colour attachment is a cube map (six faces of `size` x `size`).
 * Rendered into with CubeCamera; the texture is usable as an environment map directly.
 */
class WebGLCubeRenderTarget extends WebGLRenderTarget {
	constructor(size = 1, options = {}) {
		super(size, size, options);
		this.isWebGLCubeRenderTarget = true;
		const image = { width: size, height: size, depth: 1 };
		const images = [image, image, image, image, image, image];
		const texture = new CubeTexture(images, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
		texture.generateMipmaps = options.generateMipmaps !== undefined ? options.generateMipmaps : false;
		texture.minFilter = options.minFilter !== undefined ? options.minFilter : LinearFilter;
		texture.internalFormat = options.internalFormat !== undefined ? options.internalFormat : null;
		texture.renderTarget = this;
		// By convention cube maps are specified in a left-handed frame (px/nx appear swapped in a
		// right-handed world). The flip is not applied when the cube texture is a render target
		// texture, which isRenderTargetTexture signals to the renderer.
		texture.isRenderTargetTexture = true;
		this.texture = texture;
		this.textures = [texture];
	}

	/** Renders an equirectangular texture into the six faces. */
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

	clear(renderer, color = true, depth = true, stencil = true) {
		const currentRenderTarget = renderer.getRenderTarget();
		for (let i = 0; i < 6; i++) {
			renderer.setRenderTarget(this, i);
			renderer.clear(color, depth, stencil);
		}
		renderer.setRenderTarget(currentRenderTarget);
	}
}

export { WebGLCubeRenderTarget };
