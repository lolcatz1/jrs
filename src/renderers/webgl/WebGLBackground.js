// Background textures, after three.js's WebGLBackground (r186, MIT License, Copyright 2010-2026 three.js authors).
import { BackSide, FrontSide, CubeUVReflectionMapping, SRGBTransfer } from '../../constants.js';
import { BoxGeometry } from '../../geometries/BoxGeometry.js';
import { PlaneGeometry } from '../../geometries/PlaneGeometry.js';
import { ShaderMaterial } from '../../materials/ShaderMaterial.js';
import { ColorManagement } from '../../math/ColorManagement.js';
import { Matrix3 } from '../../math/Matrix3.js';
import { Matrix4 } from '../../math/Matrix4.js';
import { Mesh } from '../../objects/Mesh.js';
import { ShaderLib } from '../shaders/ThreeShaderLib.js';
import { cloneUniforms } from '../shaders/UniformsUtils.js';

const _m1 = /*@__PURE__*/ new Matrix4();
const _flip = /*@__PURE__*/ new Matrix3().set(-1, 0, 0, 0, 1, 0, 0, 0, 1);

/**
 * Draws `scene.background` when it is a texture: a cube (cube map or PMREM CubeUV layout, with
 * backgroundBlurriness / backgroundIntensity / backgroundRotation) drawn as a camera-centred
 * BackSide box, or a plain 2D texture drawn as a screen-filling plane. Both are three.js's own
 * background shaders rendered through the ShaderMaterial path, drawn first and without depth
 * writes, which is what three.js does by putting them at the front of the opaque list.
 */
class WebGLBackground {
	constructor(renderer) {
		this.renderer = renderer;
		this.boxMesh = null;
		this.planeMesh = null;
		this.currentBackground = null;
		this.currentBackgroundVersion = 0;
		this.currentToneMapping = null;
		this.currentDefinesKey = '';
		// a persistent render-list item for the background mesh (no per-frame allocation)
		this.item = { id: 0, object: null, geometry: null, material: null, program: null, group: null, renderOrder: 0, materialRid: 0, geometryRid: 0, variant: 0, mdRecord: null };
	}

	/**
	 * The texture the background actually samples (equirect -> cube, or PMREM when blurred), or null
	 * when the background is a colour / nothing / an image that is not ready yet. Runs before the
	 * frame starts so a conversion render never nests inside it.
	 */
	resolve(scene) {
		const background = scene.isScene === true ? scene.background : null;
		if (background && background.isTexture) return this.renderer.environments.get(background, scene.backgroundBlurriness > 0);
		return null;
	}

	/** Draws the resolved background texture (after the clear). */
	render(scene, camera, background) {
		if (background === null) return;
		const renderer = this.renderer;
		let mesh, material;
		if (background.isCubeTexture || background.mapping === CubeUVReflectionMapping) {
			if (this.boxMesh === null) {
				const geometry = new BoxGeometry(1, 1, 1);
				geometry.deleteAttribute('normal');
				geometry.deleteAttribute('uv');
				this.boxMesh = new Mesh(geometry, new ShaderMaterial({
					name: 'BackgroundCubeMaterial',
					uniforms: cloneUniforms(ShaderLib.backgroundCube.uniforms),
					vertexShader: ShaderLib.backgroundCube.vertexShader,
					fragmentShader: ShaderLib.backgroundCube.fragmentShader,
					side: BackSide, depthTest: false, depthWrite: false, fog: false, allowOverride: false,
				}));
				this.boxMesh.frustumCulled = false;
				this.boxMesh.layers.enableAll();
			}
			mesh = this.boxMesh; material = mesh.material;
			// the box follows the camera; copyPosition bypasses the change detection, so bump the version by hand
			mesh.matrixWorld.copyPosition(camera.matrixWorld);
			mesh._worldVersion++;
			const u = material.uniforms;
			u.envMap.value = background;
			u.backgroundBlurriness.value = scene.backgroundBlurriness;
			u.backgroundIntensity.value = scene.backgroundIntensity;
			// note: since the matrix is orthonormal, we can use the more-efficient transpose() in lieu of invert()
			u.backgroundRotation.value.setFromMatrix4(_m1.makeRotationFromEuler(scene.backgroundRotation)).transpose();
			if (background.isCubeTexture && background.isRenderTargetTexture === false) u.backgroundRotation.value.premultiply(_flip);
			// the #defines three.js's program prefix would emit for this env map
			let definesKey;
			if (background.mapping === CubeUVReflectionMapping) {
				const imageHeight = background.image.height;
				definesKey = 'uv' + imageHeight;
				if (definesKey !== this.currentDefinesKey) {
					const maxMip = Math.log2(imageHeight) - 2;
					material.defines = { ENVMAP_TYPE_CUBE_UV: '', CUBEUV_TEXEL_WIDTH: 1.0 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)), CUBEUV_TEXEL_HEIGHT: 1.0 / imageHeight, CUBEUV_MAX_MIP: maxMip + '.0' };
				}
			} else {
				definesKey = 'cube';
				if (definesKey !== this.currentDefinesKey) material.defines = { ENVMAP_TYPE_CUBE: '' };
			}
			if (definesKey !== this.currentDefinesKey) { this.currentDefinesKey = definesKey; material.needsUpdate = true; }
		} else {
			if (this.planeMesh === null) {
				const geometry = new PlaneGeometry(2, 2);
				geometry.deleteAttribute('normal');
				this.planeMesh = new Mesh(geometry, new ShaderMaterial({
					name: 'BackgroundMaterial',
					uniforms: cloneUniforms(ShaderLib.background.uniforms),
					vertexShader: ShaderLib.background.vertexShader,
					fragmentShader: ShaderLib.background.fragmentShader,
					side: FrontSide, depthTest: false, depthWrite: false, fog: false, allowOverride: false,
				}));
				this.planeMesh.frustumCulled = false;
				this.planeMesh.layers.enableAll();
			}
			mesh = this.planeMesh; material = mesh.material;
			const u = material.uniforms;
			u.t2D.value = background;
			u.backgroundIntensity.value = scene.backgroundIntensity;
			if (background.matrixAutoUpdate === true) background.updateMatrix();
			u.uvTransform.value.copy(background.matrix);
		}
		material.toneMapped = ColorManagement.getTransfer(background.colorSpace) !== SRGBTransfer;
		if (this.currentBackground !== background || this.currentBackgroundVersion !== background.version || this.currentToneMapping !== renderer.toneMapping) {
			material.needsUpdate = true;
			this.currentBackground = background;
			this.currentBackgroundVersion = background.version;
			this.currentToneMapping = renderer.toneMapping;
		}
		const item = this.item;
		item.id = mesh.id; item.object = mesh; item.geometry = mesh.geometry; item.material = material; item.renderOrder = 0;
		item.variant = renderer._variantFor(mesh, mesh.geometry, material, false);
		item.program = renderer._getProgram(material, mesh, scene, item.variant);
		renderer._renderItem(item, scene, camera, false);
	}

	dispose() {
		if (this.boxMesh !== null) { this.boxMesh.geometry.dispose(); this.boxMesh.material.dispose(); this.boxMesh = null; }
		if (this.planeMesh !== null) { this.planeMesh.geometry.dispose(); this.planeMesh.material.dispose(); this.planeMesh = null; }
		this.currentBackground = null; this.currentDefinesKey = '';
	}
}

export { WebGLBackground };
