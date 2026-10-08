import { ShaderChunk } from './ShaderChunk.js';
import {
	NoToneMapping as _NoToneMapping, LinearToneMapping, ReinhardToneMapping, CineonToneMapping, ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping,
	SRGBColorSpace as _SRGBColorSpace
} from '../../constants.js';
/**
 * Shader library.
 *
 * One vertex shader and one fragment shader cover every built-in material;
 * features are switched with #defines. Per-frame data (camera, fog), lights
 * and per-material constants live in std140 uniform blocks, so switching
 * materials costs one bindBufferRange instead of a dozen uniform uploads,
 * and changing the number of lights never forces a recompile: light arrays
 * have a fixed capacity and the active counts are read from the block.
 */

export const MAX_DIR_LIGHTS = 4;
export const MAX_POINT_LIGHTS = 8;
export const MAX_SPOT_LIGHTS = 4;
export const MAX_HEMI_LIGHTS = 2;

export const MATERIAL_BASIC = 1;
export const MATERIAL_LAMBERT = 2;
export const MATERIAL_PHONG = 3;
export const MATERIAL_STANDARD = 4;
export const MATERIAL_NORMAL = 5;
export const MATERIAL_DEPTH = 6;
export const MATERIAL_LINE = 7;
export const MATERIAL_POINTS = 8;
export const MATERIAL_SPRITE = 9;
export const MATERIAL_SHADER = 10;
export const MATERIAL_SHADOW_DEPTH = 11; // internal: shadow map pass

// Texture unit assignment is fixed per sampler so sampler uniforms are set
// once per program and never again.
export const TEXTURE_UNITS = {
	map: 0, alphaMap: 1, normalMap: 2, emissiveMap: 3, roughnessMap: 4, metalnessMap: 5, aoMap: 6, specularMap: 7,
	bumpMap: 7, // shares with specularMap (never used together by one material type)
	dfgLUT: 7, // Standard materials only (they have neither specularMap nor bumpMap): the DFG lookup table
	dirShadowMap0: 8, dirShadowMap1: 9, dirShadowMap2: 10, dirShadowMap3: 11,
	spotShadowMap0: 12, spotShadowMap1: 13, spotShadowMap2: 14, // shadow-casting spot lights are capped at 3
	envMap: 15, // environment map: samplerCube, or the sampler2D CubeUV (PMREM) layout
	// vertex-shader data textures live above the 16 fragment units (WebGL2 guarantees 32 combined units)
	boneTexture: 16, morphTargetsTexture: 17,
	objectMatrices: 18, // batched draws' matrix texture
};
export const MATRIX_TEXTURE_WIDTH = 1024; // texels
export const TEXELS_PER_OBJECT = 8; // model matrix (4) + normal matrix columns (3) + spare -> 128 objects per row

export const FRAME_BLOCK = /* glsl */`
layout(std140) uniform Frame {
	mat4 projectionMatrix;
	mat4 viewMatrix;
	mat4 viewProjectionMatrix;
	vec4 cameraPosition;      // xyz, w = 1 for orthographic
	vec4 fogColor;            // rgb, w = fog type (0 none, 1 linear, 2 exp2)
	vec4 fogParams;           // near, far, density, toneMappingExposure
	vec4 viewport;            // x, y, width, height
};
`;

export const LIGHTS_BLOCK = /* glsl */`
struct DirectionalLight { vec4 direction; vec4 color; };
struct PointLight { vec4 position; vec4 color; vec4 params; }; // params: distance, decay
struct SpotLight { vec4 position; vec4 direction; vec4 color; vec4 params; }; // distance, decay, coneCos, penumbraCos
struct HemiLight { vec4 direction; vec4 sky; vec4 ground; };
layout(std140) uniform Lights {
	vec4 ambient;
	ivec4 lightCounts; // dir, point, spot, hemi
	DirectionalLight dirLights[${MAX_DIR_LIGHTS}];
	PointLight pointLights[${MAX_POINT_LIGHTS}];
	SpotLight spotLights[${MAX_SPOT_LIGHTS}];
	HemiLight hemiLights[${MAX_HEMI_LIGHTS}];
	mat4 dirShadowMatrix[${MAX_DIR_LIGHTS}];
	vec4 dirShadowParams[${MAX_DIR_LIGHTS}];   // bias, normalBias, radius, 1/mapSize
	mat4 spotShadowMatrix[${MAX_SPOT_LIGHTS}];
	vec4 spotShadowParams[${MAX_SPOT_LIGHTS}];
};
`;

// Byte size of the Lights block (std140): 16 + 16 + 4*32 + 8*48 + 4*64 + 2*48 + 4*64 + 4*16 + 4*64 + 4*16
export const LIGHTS_BLOCK_SIZE = 16 + 16 + MAX_DIR_LIGHTS * 32 + MAX_POINT_LIGHTS * 48 + MAX_SPOT_LIGHTS * 64 + MAX_HEMI_LIGHTS * 48 + MAX_DIR_LIGHTS * 64 + MAX_DIR_LIGHTS * 16 + MAX_SPOT_LIGHTS * 64 + MAX_SPOT_LIGHTS * 16;
export const FRAME_BLOCK_SIZE = 64 * 3 + 16 * 4;

export const MATERIAL_BLOCK = /* glsl */`
#ifdef USE_MATERIAL_ARRAY
// Batched draws spanning several materials: the block holds a window of MATERIAL_ARRAY_SIZE
// consecutive material records of the shared material buffer (each padded to the buffer's
// slot stride) and every instance / sub-draw selects its record with the slot index stored
// in the spare texel of its matrix-texture record. The member names below are remapped so
// the shader body reads the same identifiers either way.
struct MaterialRecord {
	vec4 mDiffuse;
	vec4 mEmissive;
	vec4 mSpecular;
	vec4 mParams;
	vec4 mParams2;
	vec4 mUvTransform0;
	vec4 mUvTransform1;
	vec4 mUvTransform2;
	vec4 mEnvParams;
	mat3 mEnvMapRotation;
	#if MATERIAL_PAD > 0
	vec4 mPad[ MATERIAL_PAD ];
	#endif
};
layout(std140) uniform Materials {
	MaterialRecord materials[ MATERIAL_ARRAY_SIZE ];
};
#define diffuse materials[ matIdx ].mDiffuse
#define emissive materials[ matIdx ].mEmissive
#define specular materials[ matIdx ].mSpecular
#define matParams materials[ matIdx ].mParams
#define matParams2 materials[ matIdx ].mParams2
#define uvTransform0 materials[ matIdx ].mUvTransform0
#define uvTransform1 materials[ matIdx ].mUvTransform1
#define uvTransform2 materials[ matIdx ].mUvTransform2
#define envParams materials[ matIdx ].mEnvParams
#define envMapRotation materials[ matIdx ].mEnvMapRotation
#else
layout(std140) uniform Material {
	vec4 diffuse;        // rgb, a = opacity
	vec4 emissive;       // rgb, a = alphaTest
	vec4 specular;       // rgb, a = shininess
	vec4 matParams;      // roughness, metalness, aoMapIntensity, emissiveIntensity
	vec4 matParams2;     // normalScale.xy, pointSize, bumpScale
	vec4 uvTransform0;   // mat3 columns, padded
	vec4 uvTransform1;
	vec4 uvTransform2;
	vec4 envParams;      // envMapIntensity, reflectivity, refractionRatio, ior
	mat3 envMapRotation; // three vec4 columns
};
#endif
#define envMapIntensity envParams.x
#define reflectivity envParams.y
#define refractionRatio envParams.z
`;
export const MATERIAL_BLOCK_SIZE = 16 * 12;

// three's <common> chunk: PI, pow2/pow4, saturate, F_Schlick, BRDF_Lambert, equirectUv and the
// direction helpers the environment-map chunks rely on. The GLSL 1.00 sampler names are mapped
// onto ES 3.00 so the chunks compile unchanged.
const common = /* glsl */`
#define texture2D texture
#define textureCube texture
#define texture2DGradEXT textureGrad
#include <common>
`;

const vertexShader = /* glsl */`
precision highp float;
precision highp int;
precision highp sampler2DArray;
${FRAME_BLOCK}
${MATERIAL_BLOCK}
#if NUM_DIR_SHADOWS > 0 || NUM_SPOT_SHADOWS > 0
${LIGHTS_BLOCK}
#endif
uniform mat4 modelMatrix;
uniform mat3 normalMatrix;
in vec3 position;
#ifdef USE_NORMAL
in vec3 normal;
#endif
#ifdef USE_UV
in vec2 uv;
#endif
#ifdef USE_UV1
in vec2 uv1;
#endif
#ifdef USE_COLOR
	#ifdef USE_COLOR_ALPHA
	in vec4 color;
	#else
	in vec3 color;
	#endif
#endif
#ifdef USE_INSTANCING
in mat4 instanceMatrix;
	#ifdef USE_INSTANCING_COLOR
	in vec3 instanceColor;
	#endif
#endif
#ifdef USE_SKINNING
in vec4 skinIndex;
in vec4 skinWeight;
#endif
${ShaderChunk.skinning_pars_vertex}
${ShaderChunk.morphtarget_pars_vertex}
#ifdef USE_OBJECT_TEXTURE
// Batched draws: each object's world matrix and normal matrix come from a per-frame matrix
// texture. Instanced batches index it by gl_InstanceID, multi-draw batches by gl_DrawID.
uniform highp sampler2D objectMatrices;
uniform int drawBase;
ivec2 objectTexel;
mat4 fetchObjectMatrix() {
	int id = drawBase + gl_InstanceID;
	#ifdef USE_MULTIDRAW
	id += gl_DrawID;
	#endif
	id *= ${TEXELS_PER_OBJECT};
	int y = id / ${MATRIX_TEXTURE_WIDTH};
	int x = id - y * ${MATRIX_TEXTURE_WIDTH};
	objectTexel = ivec2( x, y );
	return mat4( texelFetch( objectMatrices, ivec2( x, y ), 0 ), texelFetch( objectMatrices, ivec2( x + 1, y ), 0 ), texelFetch( objectMatrices, ivec2( x + 2, y ), 0 ), texelFetch( objectMatrices, ivec2( x + 3, y ), 0 ) );
}
mat3 fetchObjectNormalMatrix() {
	return mat3( texelFetch( objectMatrices, objectTexel + ivec2( 4, 0 ), 0 ).xyz, texelFetch( objectMatrices, objectTexel + ivec2( 5, 0 ), 0 ).xyz, texelFetch( objectMatrices, objectTexel + ivec2( 6, 0 ), 0 ).xyz );
}
	#ifdef USE_MATERIAL_ARRAY
	// spare texel: x = index of the object's material record inside the bound Materials window
	int matIdx;
	flat out int vMaterialIndex;
	#endif
#endif
#ifndef SHADOW_LEAN
out vec3 vWorldPosition;
#endif
#ifdef USE_NORMAL
out vec3 vNormal;
#endif
#ifdef USE_UV
out vec2 vUv;
#endif
#ifdef USE_UV1
out vec2 vUv1;
#endif
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
out vec4 vColor;
#endif
#ifdef USE_FOG
out float vFogDepth;
#endif
#if defined( USE_ENVMAP ) && ! defined( ENV_WORLDPOS )
out vec3 vReflect;
#endif
#if NUM_DIR_SHADOWS > 0
out vec4 vDirShadowCoord[ NUM_DIR_SHADOWS ];
#endif
#if NUM_SPOT_SHADOWS > 0
out vec4 vSpotShadowCoord[ NUM_SPOT_SHADOWS ];
#endif

void main() {
	mat4 model = modelMatrix;
	#ifdef USE_INSTANCING
	model = model * instanceMatrix;
	#endif
	#ifdef USE_OBJECT_TEXTURE
	model = model * fetchObjectMatrix();
		#ifdef USE_MATERIAL_ARRAY
		matIdx = int( texelFetch( objectMatrices, objectTexel + ivec2( 7, 0 ), 0 ).x );
		vMaterialIndex = matIdx;
		#endif
	#endif
	vec3 transformed = vec3( position );
	#ifdef USE_NORMAL
	vec3 objectNormal = vec3( normal );
	#endif
	${ShaderChunk.morphtarget_vertex}
	#ifdef USE_NORMAL
	${ShaderChunk.morphnormal_vertex}
	#endif
	${ShaderChunk.skinbase_vertex}
	#ifdef USE_NORMAL
	${ShaderChunk.skinnormal_vertex}
	#endif
	${ShaderChunk.skinning_vertex}
	#ifdef IS_SPRITE
		// billboard: sprite plane in view space
		vec4 mvPosition = viewMatrix * model * vec4( 0.0, 0.0, 0.0, 1.0 );
		vec2 scale = vec2( length( model[ 0 ].xyz ), length( model[ 1 ].xyz ) );
		#ifndef SIZE_ATTENUATION
		if ( cameraPosition.w < 0.5 ) scale *= - mvPosition.z;
		#endif
		vec2 aligned = ( position.xy - ( uSpriteCenter - vec2( 0.5 ) ) ) * scale;
		float c = cos( matParams2.w ), s = sin( matParams2.w );
		vec2 rotated = vec2( c * aligned.x - s * aligned.y, s * aligned.x + c * aligned.y );
		mvPosition.xy += rotated;
		// camera right/up axes in world space are rows 0 and 1 of the view matrix
		vec3 camRight = vec3( viewMatrix[ 0 ][ 0 ], viewMatrix[ 1 ][ 0 ], viewMatrix[ 2 ][ 0 ] );
		vec3 camUp = vec3( viewMatrix[ 0 ][ 1 ], viewMatrix[ 1 ][ 1 ], viewMatrix[ 2 ][ 1 ] );
		vec4 worldPosition = vec4( model[ 3 ].xyz + camRight * rotated.x + camUp * rotated.y, 1.0 );
	#else
		vec4 worldPosition = model * vec4( transformed, 1.0 );
		vec4 mvPosition = viewMatrix * worldPosition;
	#endif
	#ifndef SHADOW_LEAN
	vWorldPosition = worldPosition.xyz;
	#endif
	#ifdef USE_NORMAL
		#if defined( USE_OBJECT_TEXTURE )
		vNormal = normalize( fetchObjectNormalMatrix() * objectNormal );
		#elif defined( USE_INSTANCING )
		vNormal = normalize( transpose( inverse( mat3( model ) ) ) * objectNormal );
		#else
		vNormal = normalize( normalMatrix * objectNormal );
		#endif
		#ifdef FLIP_SIDED
		vNormal = - vNormal;
		#endif
	#endif
	#if defined( USE_ENVMAP ) && ! defined( ENV_WORLDPOS )
	{
		// MeshBasicMaterial: the reflection vector is computed per vertex and interpolated, as in three.js
		vec3 cameraToVertex;
		if ( cameraPosition.w > 0.5 ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition.xyz );
		}
		vec3 worldNormal = vNormal;
		#ifdef ENVMAP_MODE_REFLECTION
		vReflect = reflect( cameraToVertex, worldNormal );
		#else
		vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	}
	#endif
	#ifdef USE_UV
	vUv = ( mat3( uvTransform0.xyz, uvTransform1.xyz, uvTransform2.xyz ) * vec3( uv, 1.0 ) ).xy;
	#endif
	#ifdef USE_UV1
	vUv1 = uv1;
	#endif
	#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	vColor = vec4( 1.0 );
		#ifdef USE_COLOR
			#ifdef USE_COLOR_ALPHA
			vColor *= color;
			#else
			vColor.rgb *= color;
			#endif
		#endif
		#ifdef USE_INSTANCING_COLOR
		vColor.rgb *= instanceColor;
		#endif
		#ifdef USE_MORPHCOLORS
		// three.js morphcolor_vertex, on a vec4 vColor: alpha only morphs with USE_COLOR_ALPHA
			#ifdef USE_COLOR_ALPHA
			vColor *= morphTargetBaseInfluence;
			for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
				if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
			}
			#elif defined( USE_COLOR )
			vColor.rgb *= morphTargetBaseInfluence;
			for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
				if ( morphTargetInfluences[ i ] != 0.0 ) vColor.rgb += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
			}
			#endif
		#endif
	#endif
	gl_Position = projectionMatrix * mvPosition;
	#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
	#endif
	#ifdef IS_POINTS
	gl_PointSize = matParams2.z;
		#ifdef SIZE_ATTENUATION
		if ( cameraPosition.w < 0.5 ) gl_PointSize *= ( viewport.w * 0.5 ) / ( - mvPosition.z );
		#endif
	#endif
	#if NUM_DIR_SHADOWS > 0
	for ( int i = 0; i < NUM_DIR_SHADOWS; i ++ ) {
		vec3 shadowWorldNormal = vec3( 0.0 );
		#ifdef USE_NORMAL
		shadowWorldNormal = vNormal;
		#endif
		vec4 shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * dirShadowParams[ i ].y, 0.0 );
		vDirShadowCoord[ i ] = dirShadowMatrix[ i ] * shadowWorldPosition;
	}
	#endif
	#if NUM_SPOT_SHADOWS > 0
	for ( int i = 0; i < NUM_SPOT_SHADOWS; i ++ ) {
		vec3 shadowWorldNormal = vec3( 0.0 );
		#ifdef USE_NORMAL
		shadowWorldNormal = vNormal;
		#endif
		vec4 shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * spotShadowParams[ i ].y, 0.0 );
		vSpotShadowCoord[ i ] = spotShadowMatrix[ i ] * shadowWorldPosition;
	}
	#endif
}
`;

const fragmentShader = /* glsl */`
precision highp float;
precision highp int;
precision highp sampler2DShadow;
${FRAME_BLOCK}
${LIGHTS_BLOCK}
#ifdef USE_MATERIAL_ARRAY
flat in int vMaterialIndex;
#define matIdx vMaterialIndex
#endif
${MATERIAL_BLOCK}
${common}
in vec3 vWorldPosition;
#ifdef USE_NORMAL
in vec3 vNormal;
#endif
#ifdef USE_UV
in vec2 vUv;
#endif
#ifdef USE_UV1
in vec2 vUv1;
#endif
#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
in vec4 vColor;
#endif
#ifdef USE_FOG
in float vFogDepth;
#endif
#ifdef USE_MAP
uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
uniform sampler2D alphaMap;
#endif
#ifdef USE_EMISSIVEMAP
uniform sampler2D emissiveMap;
#endif
#ifdef USE_NORMALMAP
uniform sampler2D normalMap;
#endif
#ifdef USE_ROUGHNESSMAP
uniform sampler2D roughnessMap;
#endif
#ifdef USE_METALNESSMAP
uniform sampler2D metalnessMap;
#endif
#ifdef USE_AOMAP
uniform sampler2D aoMap;
#endif
#ifdef USE_SPECULARMAP
uniform sampler2D specularMap;
#endif
#ifdef USE_ENVMAP
	#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
	#else
	uniform sampler2D envMap;
	#endif
	#ifndef ENV_WORLDPOS
	in vec3 vReflect;
	#endif
#endif
#ifdef LIGHTING_STANDARD
uniform sampler2D dfgLUT;
#endif
#include <cube_uv_reflection_fragment>
#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
// three.js <envmap_physical_pars_fragment> with world-space inputs (jrs lights in world space)
vec3 getIBLIrradiance( const in vec3 worldNormal ) {
	vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
	return PI * envMapColor.rgb * envMapIntensity;
}
vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
	vec3 reflectVec = reflect( - viewDir, normal );
	// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
	reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );
	vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
	return envMapColor.rgb * envMapIntensity;
}
#endif
#if NUM_DIR_SHADOWS > 0
in vec4 vDirShadowCoord[ NUM_DIR_SHADOWS ];
uniform sampler2DShadow dirShadowMap[ NUM_DIR_SHADOWS ];
#endif
#if NUM_SPOT_SHADOWS > 0
in vec4 vSpotShadowCoord[ NUM_SPOT_SHADOWS ];
uniform sampler2DShadow spotShadowMap[ NUM_SPOT_SHADOWS ];
#endif
out vec4 fragColor;

#if NUM_DIR_SHADOWS > 0 || NUM_SPOT_SHADOWS > 0
float sampleShadow( sampler2DShadow shadowMap, vec4 coord, vec4 params ) {
	vec3 c = coord.xyz / coord.w;
	c.z -= params.x;
	bvec4 inFrustumVec = bvec4( c.x >= 0.0, c.x <= 1.0, c.y >= 0.0, c.y <= 1.0 );
	bool inFrustum = all( inFrustumVec );
	bvec2 frustumTestVec = bvec2( inFrustum, c.z <= 1.0 );
	if ( ! all( frustumTestVec ) ) return 1.0;
	float texel = params.w * params.z;
	float shadow = 0.0;
	shadow += texture( shadowMap, c + vec3( - texel, - texel, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( 0.0, - texel, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( texel, - texel, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( - texel, 0.0, 0.0 ) );
	shadow += texture( shadowMap, c );
	shadow += texture( shadowMap, c + vec3( texel, 0.0, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( - texel, texel, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( 0.0, texel, 0.0 ) );
	shadow += texture( shadowMap, c + vec3( texel, texel, 0.0 ) );
	return shadow / 9.0;
}
#endif

#ifdef USE_NORMALMAP
vec3 perturbNormal2Arb( vec3 eye_pos, vec3 surf_norm, vec3 mapN, float faceDirection ) {
	vec3 q0 = dFdx( eye_pos.xyz );
	vec3 q1 = dFdy( eye_pos.xyz );
	vec2 st0 = dFdx( vUv.st );
	vec2 st1 = dFdy( vUv.st );
	vec3 N = surf_norm;
	vec3 q1perp = cross( q1, N );
	vec3 q0perp = cross( N, q0 );
	vec3 T = q1perp * st0.x + q0perp * st1.x;
	vec3 B = q1perp * st0.y + q0perp * st1.y;
	float det = max( dot( T, T ), dot( B, B ) );
	float scale = ( det == 0.0 ) ? 0.0 : faceDirection * inversesqrt( det );
	return normalize( T * ( mapN.x * scale ) + B * ( mapN.y * scale ) + N * mapN.z );
}
#endif

float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( clamp( 1.0 - pow4( lightDistance / cutoffDistance ), 0.0, 1.0 ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}

#if defined( LIGHTING_STANDARD )
struct PhysicalMaterial {
	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;
	float roughness;
	float metalness;
	float specularF90;
	vec2 dfg;
	vec3 multiScatteringCompensation;
};
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1
	return RECIPROCAL_PI * a2 / pow2( denom );
}
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColorBlended;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness ); // UE4's roughness
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
	float D = D_GGX( alpha, dotNH );
	return F * ( V * D );
}
// Fdez-Agüera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
// Approximates multiscattering in order to preserve energy.
// http://www.jcgt.org/published/0008/01/03/
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
	vec3 Fr = specularColor;
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619; // 1/21
	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
void RE_Direct_Physical( const in vec3 lightDir, const in vec3 irradiance, const in vec3 normal, const in vec3 viewDir, const in PhysicalMaterial material, inout vec3 directDiffuse, inout vec3 directSpecular ) {
	vec3 specularBRDF = BRDF_GGX( lightDir, viewDir, normal, material );
	directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;
	// Light reflected by the specular interface is not available to the diffuse layer ( glTF fresnel_mix )
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );
	directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in PhysicalMaterial material, inout vec3 indirectDiffuse ) {
	// Energy reflected by the specular lobe is not available to the diffuse layer
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );
	vec3 diffuseTerm = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering ); // three names this diffuse; that is a record macro in batched programs
	indirectDiffuse += diffuseTerm;
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in PhysicalMaterial material, inout vec3 indirectDiffuse, inout vec3 indirectSpecular ) {
	// Both indirect specular and indirect diffuse light accumulate here
	// Compute multiscattering separately for dielectric and metallic, then mix
	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );
	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );
	computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
	computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );
	// Mix based on metalness
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );
	// Diffuse energy conservation uses dielectric path
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuseTerm = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	vec3 indirectSpecularAdd = radiance * singleScattering;
	indirectSpecularAdd += multiScattering * cosineWeightedIrradiance;
	vec3 indirectDiffuseAdd = diffuseTerm * cosineWeightedIrradiance;
	indirectSpecular += indirectSpecularAdd;
	indirectDiffuse += indirectDiffuseAdd;
}
// ref: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}
#endif
#if defined( LIGHTING_PHONG )
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = clamp( dot( normal, halfDir ), 0.0, 1.0 );
	float dotVH = clamp( dot( viewDir, halfDir ), 0.0, 1.0 );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = 0.25;
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
}
#endif

// --- tone mapping ---
vec3 LinearToneMapping( vec3 color ) { return clamp( fogParams.w * color, 0.0, 1.0 ); }
vec3 ReinhardToneMapping( vec3 color ) { color *= fogParams.w; return clamp( color / ( vec3( 1.0 ) + color ), 0.0, 1.0 ); }
vec3 CineonToneMapping( vec3 color ) {
	color *= fogParams.w;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3( vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 ) );
	const mat3 ACESOutputMat = mat3( vec3( 1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 ) );
	color *= fogParams.w / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return clamp( color, 0.0, 1.0 );
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= fogParams.w;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 toneMapping( vec3 color ) {
	#if TONE_MAPPING == 1
	return LinearToneMapping( color );
	#elif TONE_MAPPING == 2
	return ReinhardToneMapping( color );
	#elif TONE_MAPPING == 3
	return CineonToneMapping( color );
	#elif TONE_MAPPING == 4
	return ACESFilmicToneMapping( color );
	#elif TONE_MAPPING == 7
	return NeutralToneMapping( color );
	#else
	return color;
	#endif
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

void main() {
	#ifdef IS_POINTS
	vec2 pointUv = gl_PointCoord;
	#endif
	vec4 diffuseColor = vec4( diffuse.rgb, diffuse.a );
	#ifdef IS_SPRITE
	#endif
	#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
	diffuseColor *= vColor;
	#endif
	#ifdef USE_MAP
		#ifdef IS_POINTS
		vec4 sampledDiffuseColor = texture( map, ( mat3( uvTransform0.xyz, uvTransform1.xyz, uvTransform2.xyz ) * vec3( pointUv, 1.0 ) ).xy );
		#else
		vec4 sampledDiffuseColor = texture( map, vUv );
		#endif
	diffuseColor *= sampledDiffuseColor;
	#endif
	#ifdef USE_ALPHAMAP
		#ifdef IS_POINTS
		diffuseColor.a *= texture( alphaMap, pointUv ).g;
		#else
		diffuseColor.a *= texture( alphaMap, vUv ).g;
		#endif
	#endif
	#ifdef USE_ALPHATEST
	if ( diffuseColor.a < emissive.a ) discard;
	#endif

	#ifdef IS_DEPTH
	fragColor = vec4( vec3( 1.0 - gl_FragCoord.z ), diffuseColor.a );
	return;
	#endif

	#ifdef USE_NORMAL
	float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
		#ifdef FLAT_SHADED
		vec3 fdx = dFdx( vWorldPosition );
		vec3 fdy = dFdy( vWorldPosition );
		vec3 normal = normalize( cross( fdx, fdy ) );
		#else
		vec3 normal = normalize( vNormal );
			#ifdef DOUBLE_SIDED
			normal *= faceDirection;
			#endif
		#endif
		vec3 nonPerturbedNormal = normal;
		#ifdef USE_NORMALMAP
		vec3 mapN = texture( normalMap, vUv ).xyz * 2.0 - 1.0;
		mapN.xy *= matParams2.xy;
		normal = perturbNormal2Arb( vWorldPosition - cameraPosition.xyz, normal, mapN, faceDirection );
		#endif
	#endif

	#ifdef IS_NORMAL_MATERIAL
	fragColor = vec4( normalize( ( viewMatrix * vec4( normal, 0.0 ) ).xyz ) * 0.5 + 0.5, diffuseColor.a );
	return;
	#endif

	vec3 outgoingLight = vec3( 0.0 );
	float specularStrength = 1.0;
	#ifdef USE_SPECULARMAP
	specularStrength = texture( specularMap, vUv ).r;
	#endif

	#if defined( LIGHTING_LAMBERT ) || defined( LIGHTING_PHONG ) || defined( LIGHTING_STANDARD )
		// camera +Z axis in world space is the third row of the view matrix (no inverse needed)
		vec3 viewDir = ( cameraPosition.w > 0.5 ) ? normalize( vec3( viewMatrix[ 0 ][ 2 ], viewMatrix[ 1 ][ 2 ], viewMatrix[ 2 ][ 2 ] ) ) : normalize( cameraPosition.xyz - vWorldPosition );
		float roughnessFactor = matParams.x;
		float metalnessFactor = matParams.y;
		#ifdef USE_ROUGHNESSMAP
		roughnessFactor *= texture( roughnessMap, vUv ).g;
		#endif
		#ifdef USE_METALNESSMAP
		metalnessFactor *= texture( metalnessMap, vUv ).b;
		#endif
		#if defined( LIGHTING_STANDARD )
		// three.js r186 <lights_physical_fragment> + the STANDARD part of <lights_fragment_begin>
		PhysicalMaterial material;
		material.diffuseColor = diffuseColor.rgb;
		material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
		material.metalness = metalnessFactor;
		// three.js measures the geometric roughness on the view-space normal; rotate ours into view space first
		vec3 viewNonPerturbedNormal = mat3( viewMatrix ) * nonPerturbedNormal;
		vec3 dxy = max( abs( dFdx( viewNonPerturbedNormal ) ), abs( dFdy( viewNonPerturbedNormal ) ) );
		float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
		material.roughness = max( roughnessFactor, 0.0525 ); // 0.0525 corresponds to the base mip of a 256 cubemap.
		material.roughness += geometryRoughness;
		material.roughness = min( material.roughness, 1.0 );
		material.specularColor = vec3( 0.04 );
		material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
		material.specularF90 = 1.0;
		float dotNVms = saturate( dot( normal, viewDir ) );
		material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;
		// Multi-scattering energy compensation for direct lighting
		// Based on "Practical Multiple Scattering Compensation for Microfacet Models"
		// https://blog.selfshadow.com/publications/turquin/ms_comp_final.pdf
		float EssMs = material.dfg.x + material.dfg.y;
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );
		#else
		vec3 diffuseBase = diffuseColor.rgb;
		#endif
		#if defined( LIGHTING_PHONG )
		vec3 specularColor = specular.rgb;
		float shininess = specular.a;
		#endif
		vec3 directDiffuse = vec3( 0.0 );
		vec3 directSpecular = vec3( 0.0 );
		vec3 indirectDiffuse = vec3( 0.0 );
		vec3 indirectSpecular = vec3( 0.0 );
		vec3 irradiance;
		vec3 L;
		float dotNL;
		// directional
		for ( int i = 0; i < ${MAX_DIR_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.x ) break;
			L = dirLights[ i ].direction.xyz;
			dotNL = saturate( dot( normal, L ) );
			irradiance = dotNL * dirLights[ i ].color.rgb;
			#if NUM_DIR_SHADOWS > 0
			if ( i < NUM_DIR_SHADOWS ) {
				irradiance *= dirShadowFactor( i );
			}
			#endif
			#if defined( LIGHTING_STANDARD )
			RE_Direct_Physical( L, irradiance, normal, viewDir, material, directDiffuse, directSpecular );
			#else
			directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
				#if defined( LIGHTING_PHONG )
				directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
				#endif
			#endif
		}
		// point
		for ( int i = 0; i < ${MAX_POINT_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.y ) break;
			vec3 lVector = pointLights[ i ].position.xyz - vWorldPosition;
			L = normalize( lVector );
			float lightDistance = length( lVector );
			vec3 lightColor = pointLights[ i ].color.rgb;
			lightColor *= getDistanceAttenuation( lightDistance, pointLights[ i ].params.x, pointLights[ i ].params.y );
			dotNL = saturate( dot( normal, L ) );
			irradiance = dotNL * lightColor;
			#if defined( LIGHTING_STANDARD )
			RE_Direct_Physical( L, irradiance, normal, viewDir, material, directDiffuse, directSpecular );
			#else
			directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
				#if defined( LIGHTING_PHONG )
				directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
				#endif
			#endif
		}
		// spot
		for ( int i = 0; i < ${MAX_SPOT_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.z ) break;
			vec3 lVector = spotLights[ i ].position.xyz - vWorldPosition;
			L = normalize( lVector );
			float angleCos = dot( L, spotLights[ i ].direction.xyz );
			float spotAttenuation = getSpotAttenuation( spotLights[ i ].params.z, spotLights[ i ].params.w, angleCos );
			if ( spotAttenuation > 0.0 ) {
				float lightDistance = length( lVector );
				vec3 lightColor = spotLights[ i ].color.rgb * spotAttenuation;
				lightColor *= getDistanceAttenuation( lightDistance, spotLights[ i ].params.x, spotLights[ i ].params.y );
				dotNL = saturate( dot( normal, L ) );
				irradiance = dotNL * lightColor;
				#if NUM_SPOT_SHADOWS > 0
				if ( i < NUM_SPOT_SHADOWS ) {
					irradiance *= spotShadowFactor( i );
				}
				#endif
				#if defined( LIGHTING_STANDARD )
				RE_Direct_Physical( L, irradiance, normal, viewDir, material, directDiffuse, directSpecular );
				#else
				directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
					#if defined( LIGHTING_PHONG )
					directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
					#endif
				#endif
			}
		}
		// indirect: ambient + hemisphere (+ the environment's irradiance and radiance)
		vec3 iblIrradiance = vec3( 0.0 );
		vec3 indirectIrradiance = ambient.rgb;
		for ( int i = 0; i < ${MAX_HEMI_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.w ) break;
			float dotNLh = dot( normal, hemiLights[ i ].direction.xyz );
			float hemiDiffuseWeight = 0.5 * dotNLh + 0.5;
			indirectIrradiance += mix( hemiLights[ i ].ground.rgb, hemiLights[ i ].sky.rgb, hemiDiffuseWeight );
		}
		#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( normal );
		#endif
		#if defined( LIGHTING_STANDARD )
		vec3 radiance = vec3( 0.0 );
			#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )
			radiance += getIBLRadiance( viewDir, normal, material.roughness );
			#endif
		RE_IndirectDiffuse_Physical( indirectIrradiance, material, indirectDiffuse );
		RE_IndirectSpecular_Physical( radiance, iblIrradiance, material, indirectDiffuse, indirectSpecular );
		#else
		indirectIrradiance += iblIrradiance;
		indirectDiffuse += indirectIrradiance * BRDF_Lambert( diffuseBase );
		#endif
		#ifdef USE_AOMAP
			#ifdef USE_UV1
			float ambientOcclusion = ( texture( aoMap, vUv1 ).r - 1.0 ) * matParams.z + 1.0;
			#else
			float ambientOcclusion = ( texture( aoMap, vUv ).r - 1.0 ) * matParams.z + 1.0;
			#endif
		indirectDiffuse *= ambientOcclusion;
			#if defined( USE_ENVMAP ) && defined( LIGHTING_STANDARD )
			float dotNV = saturate( dot( normal, viewDir ) );
			indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
			#endif
		#endif
		vec3 totalEmissive = emissive.rgb * matParams.w;
		#ifdef USE_EMISSIVEMAP
		totalEmissive *= texture( emissiveMap, vUv ).rgb;
		#endif
		#if defined( LIGHTING_STANDARD )
		vec3 totalDiffuse = directDiffuse + indirectDiffuse;
		vec3 totalSpecular = directSpecular + indirectSpecular;
		outgoingLight = totalDiffuse + totalSpecular + totalEmissive;
		#elif defined( LIGHTING_PHONG )
		outgoingLight = directDiffuse + indirectDiffuse + directSpecular + indirectSpecular + totalEmissive;
		#else
		outgoingLight = directDiffuse + indirectDiffuse + totalEmissive;
		#endif
	#else
		// unlit
		outgoingLight = diffuseColor.rgb;
		#ifdef USE_AOMAP
			#ifdef USE_UV1
			float ambientOcclusion = ( texture( aoMap, vUv1 ).r - 1.0 ) * matParams.z + 1.0;
			#else
			float ambientOcclusion = ( texture( aoMap, vUv ).r - 1.0 ) * matParams.z + 1.0;
			#endif
		outgoingLight *= ambientOcclusion;
		#endif
	#endif

	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE ) && ! defined( LIGHTING_STANDARD )
	{
		// three.js <envmap_fragment>: reflection / refraction of a cube map blended into the lit colour
		#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( cameraPosition.w > 0.5 ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition.xyz );
		}
		vec3 worldNormal = normal;
			#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
			#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
			#endif
		#else
		vec3 reflectVec = vReflect;
		#endif
		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );
		#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
		#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
		#endif
	}
	#endif

	fragColor = vec4( outgoingLight, diffuseColor.a );
	#if TONE_MAPPING > 0 && defined( TONE_MAPPED )
	fragColor.rgb = toneMapping( fragColor.rgb );
	#endif
	#ifdef SRGB_OUTPUT
	fragColor = sRGBTransferOETF( fragColor );
	#endif
	#ifdef USE_FOG
	float fogFactor;
	if ( fogColor.w > 1.5 ) {
		fogFactor = 1.0 - exp( - fogParams.z * fogParams.z * vFogDepth * vFogDepth );
	} else {
		fogFactor = smoothstep( fogParams.x, fogParams.y, vFogDepth );
	}
	fragColor.rgb = mix( fragColor.rgb, fogColor.rgb, fogFactor );
	#endif
	#ifdef PREMULTIPLIED_ALPHA
	fragColor.rgb *= fragColor.a;
	#endif
	#ifdef DITHERING
	fragColor.rgb += vec3( dot( vec2( 171.0, 231.0 ), gl_FragCoord.xy ) ) / 255.0 * ( 1.0 / 255.0 ) - 0.5 / 255.0;
	#endif
}
`;

// shadow factor helpers need the sampler arrays indexed by a constant; generate unrolled functions
function shadowFactorFunctions(numDir, numSpot) {
	let s = '';
	if (numDir > 0) {
		s += 'float dirShadowFactor( int i ) {\n';
		for (let i = 0; i < numDir; i++) s += `\tif ( i == ${i} ) return sampleShadow( dirShadowMap[ ${i} ], vDirShadowCoord[ ${i} ], dirShadowParams[ ${i} ] );\n`;
		s += '\treturn 1.0;\n}\n';
	}
	if (numSpot > 0) {
		s += 'float spotShadowFactor( int i ) {\n';
		for (let i = 0; i < numSpot; i++) s += `\tif ( i == ${i} ) return sampleShadow( spotShadowMap[ ${i} ], vSpotShadowCoord[ ${i} ], spotShadowParams[ ${i} ] );\n`;
		s += '\treturn 1.0;\n}\n';
	}
	return s;
}

const spriteUniform = 'uniform vec2 uSpriteCenter;\n';

const ENVMAP_BLENDING = { 0: 'ENVMAP_BLENDING_MULTIPLY', 1: 'ENVMAP_BLENDING_MIX', 2: 'ENVMAP_BLENDING_ADD' }; // MultiplyOperation, MixOperation, AddOperation
/** The environment-map #defines three.js's WebGLProgram emits for these parameters (fragment: all; vertex: USE_ENVMAP + mode). */
function envMapDefines(p, vertex) {
	if (!p.envMap) return [];
	const out = ['#define USE_ENVMAP', '#define ' + (p.envMapRefraction ? 'ENVMAP_MODE_REFRACTION' : 'ENVMAP_MODE_REFLECTION')];
	if (vertex) return out;
	out.push('#define ' + (p.envMapCubeUV ? 'ENVMAP_TYPE_CUBE_UV' : 'ENVMAP_TYPE_CUBE'));
	out.push('#define ' + (ENVMAP_BLENDING[p.combine] || 'ENVMAP_BLENDING_NONE'));
	if (p.envMapCubeUV) {
		// same arithmetic as three.js generateCubeUVSize, so the define strings match character for character
		const imageHeight = p.envMapCubeUVHeight;
		const maxMip = Math.log2(imageHeight) - 2;
		const texelHeight = 1.0 / imageHeight;
		const texelWidth = 1.0 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16));
		out.push('#define CUBEUV_TEXEL_WIDTH ' + texelWidth, '#define CUBEUV_TEXEL_HEIGHT ' + texelHeight, '#define CUBEUV_MAX_MIP ' + maxMip + '.0');
	}
	return out;
}
let _resolvedVertex = null, _resolvedFragment = null;

/**
 * Build GLSL ES 3.00 sources for a built-in material program.
 * @param {object} p program parameters (see WebGLPrograms.getParameters)
 */
export function buildBuiltinShader(p) {
	const defines = [];
	const d = (name, value) => defines.push(value === undefined ? `#define ${name}` : `#define ${name} ${value}`);
	switch (p.materialType) {
		case MATERIAL_BASIC: if (p.envMap) d('USE_NORMAL'); break; // per-vertex reflection vector needs the normal
		case MATERIAL_LAMBERT: d('LIGHTING_LAMBERT'); d('USE_NORMAL'); break;
		case MATERIAL_PHONG: d('LIGHTING_PHONG'); d('USE_NORMAL'); break;
		case MATERIAL_STANDARD: d('LIGHTING_STANDARD'); d('USE_NORMAL'); break;
		case MATERIAL_NORMAL: d('IS_NORMAL_MATERIAL'); d('USE_NORMAL'); break;
		case MATERIAL_DEPTH: case MATERIAL_SHADOW_DEPTH: d('IS_DEPTH'); break;
		case MATERIAL_POINTS: d('IS_POINTS'); break;
		case MATERIAL_SPRITE: d('IS_SPRITE'); break;
	}
	if (p.leanShadow) d('SHADOW_LEAN');
	if (p.map) d('USE_MAP');
	if (p.alphaMap) d('USE_ALPHAMAP');
	if (p.emissiveMap) d('USE_EMISSIVEMAP');
	if (p.normalMap) d('USE_NORMALMAP');
	if (p.roughnessMap) d('USE_ROUGHNESSMAP');
	if (p.metalnessMap) d('USE_METALNESSMAP');
	if (p.aoMap) d('USE_AOMAP');
	if (p.specularMap) d('USE_SPECULARMAP');
	if (p.useUv) d('USE_UV');
	if (p.useUv1) d('USE_UV1');
	if (p.vertexColors) d('USE_COLOR');
	if (p.vertexAlphas) d('USE_COLOR_ALPHA');
	if (p.instancing) d('USE_INSTANCING');
	if (p.instancingColor) d('USE_INSTANCING_COLOR');
	if (p.objectTexture) d('USE_OBJECT_TEXTURE');
	if (p.skinning) d('USE_SKINNING');
	if (p.morphTargets) d('USE_MORPHTARGETS');
	if (p.morphNormals && p.flatShading === false) d('USE_MORPHNORMALS');
	if (p.morphColors) d('USE_MORPHCOLORS');
	if (p.morphTargetsCount > 0) { d('MORPHTARGETS_TEXTURE_STRIDE', p.morphTextureStride); d('MORPHTARGETS_COUNT', p.morphTargetsCount); }
	if (p.multiDraw) d('USE_MULTIDRAW');
	if (p.materialArray) { d('USE_MATERIAL_ARRAY'); d('MATERIAL_ARRAY_SIZE', p.materialArraySize | 0); d('MATERIAL_PAD', p.materialPad | 0); }
	if (p.flatShading) d('FLAT_SHADED');
	if (p.doubleSided) d('DOUBLE_SIDED');
	if (p.flipSided) d('FLIP_SIDED');
	if (p.envMap) {
		for (const line of envMapDefines(p, false)) defines.push(line);
		if (p.envWorldPos) d('ENV_WORLDPOS');
	}
	if (p.fog) d('USE_FOG');
	if (p.alphaTest) d('USE_ALPHATEST');
	if (p.sizeAttenuation) d('SIZE_ATTENUATION');
	if (p.premultipliedAlpha) d('PREMULTIPLIED_ALPHA');
	if (p.dithering) d('DITHERING');
	if (p.toneMapped) d('TONE_MAPPED');
	if (p.sRGBOutput) d('SRGB_OUTPUT');
	d('TONE_MAPPING', p.toneMapping | 0);
	d('NUM_DIR_SHADOWS', p.numDirShadows | 0);
	d('NUM_SPOT_SHADOWS', p.numSpotShadows | 0);
	const prefix = '#version 300 es\n' + defines.join('\n') + '\n';
	const vsExtra = (p.multiDraw ? '#extension GL_ANGLE_multi_draw : require\n' : '') + (p.materialType === MATERIAL_SPRITE ? spriteUniform : '');
	if (_resolvedVertex === null) { _resolvedVertex = resolveIncludes(vertexShader); _resolvedFragment = resolveIncludes(fragmentShader); }
	const vs = prefix + vsExtra + _resolvedVertex;
	if (p.leanShadow) {
		// depth-only caster: no varyings, no fragment work (the depth attachment is all that is written)
		return { vertexShader: vs, fragmentShader: '#version 300 es\nprecision mediump float;\nlayout(location = 0) out vec4 fragColor;\nvoid main() { fragColor = vec4( 0.0 ); }\n' };
	}
	// insert shadow helper functions after sampleShadow definition
	let fs = _resolvedFragment;
	const helpers = shadowFactorFunctions(p.numDirShadows | 0, p.numSpotShadows | 0);
	if (helpers !== '') fs = fs.replace('#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb', helpers + '#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb');
	return { vertexShader: vs, fragmentShader: prefix + fs };
}


const toneMappingFunctions = {
	[LinearToneMapping]: 'Linear', [ReinhardToneMapping]: 'Reinhard', [CineonToneMapping]: 'Cineon',
	[ACESFilmicToneMapping]: 'ACESFilmic', [AgXToneMapping]: 'AgX', [NeutralToneMapping]: 'Neutral', 5: 'Custom',
};
const includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm;
const unrollLoopPattern = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
const warnedIncludes = new Set();

function resolveIncludes(string) {
	return string.replace(includePattern, (match, include) => {
		const chunk = ShaderChunk[include];
		if (chunk === undefined) {
			if (!warnedIncludes.has(include)) { warnedIncludes.add(include); console.warn(`jrs: can not resolve #include <${include}>; the directive was removed.`); }
			return '';
		}
		return resolveIncludes(chunk);
	});
}
function unrollLoops(string) {
	return string.replace(unrollLoopPattern, (match, start, end, snippet) => {
		let out = '';
		for (let i = parseInt(start); i < parseInt(end); i++) out += snippet.replace(/\[\s*i\s*\]/g, '[ ' + i + ' ]').replace(/UNROLLED_LOOP_INDEX/g, i);
		return out;
	});
}
const LIGHT_NUMS = ['NUM_SUN_LIGHTS', 'NUM_DIR_LIGHTS', 'NUM_SPOT_LIGHTS', 'NUM_SPOT_LIGHT_MAPS', 'NUM_SPOT_LIGHT_COORDS', 'NUM_RECT_AREA_LIGHTS', 'NUM_POINT_LIGHTS', 'NUM_HEMI_LIGHTS',
	'NUM_SUN_LIGHT_SHADOWS', 'NUM_DIR_LIGHT_SHADOWS', 'NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS', 'NUM_SPOT_LIGHT_SHADOWS', 'NUM_POINT_LIGHT_SHADOWS'];
function replaceLightNums(string, defines) {
	// three.js substitutes these from the scene's light counts; ShaderMaterial lighting is not
	// driven by the scene here, so they resolve to 0 unless the material defines them.
	for (const name of LIGHT_NUMS) {
		const value = defines && defines[name] !== undefined ? defines[name] : 0;
		string = string.replace(new RegExp(name + '(?![A-Z_])', 'g'), String(value));
	}
	return string;
}
function generatePrecision(precision) {
	const kinds = ['float', 'int', 'sampler2D', 'samplerCube', 'sampler3D', 'sampler2DArray', 'sampler2DShadow', 'samplerCubeShadow', 'sampler2DArrayShadow', 'isampler2D', 'isampler3D', 'isamplerCube', 'isampler2DArray', 'usampler2D', 'usampler3D', 'usamplerCube', 'usampler2DArray'];
	let out = kinds.map((k) => `precision ${precision} ${k};`).join('\n');
	out += precision === 'highp' ? '\n#define HIGH_PRECISION' : (precision === 'mediump' ? '\n#define MEDIUM_PRECISION' : '\n#define LOW_PRECISION');
	return out;
}
function generateDefines(defines) {
	const chunks = [];
	for (const name in defines) {
		const value = defines[name];
		if (value === false) continue;
		chunks.push('#define ' + name + ' ' + value);
	}
	return chunks.join('\n');
}
const filterEmptyLine = (string) => string !== '';

/**
 * Builds a ShaderMaterial / RawShaderMaterial program the way three.js's WebGLProgram does:
 * same prefix (precision, SHADER_TYPE/NAME, custom defines, feature defines, built-in uniforms
 * and attributes), #include <chunk> resolution from the ported ShaderChunk library,
 * #pragma unroll_loop support, light-count substitution and GLSL 1.00 -> ES 3.00 shims.
 */
export function buildCustomShader(material, p) {
	const isRaw = material.isRawShaderMaterial === true;
	const glsl3 = material.glslVersion === '300 es';
	const precision = material.precision || 'highp';
	const customDefines = generateDefines(material.defines || {});
	const shaderName = material.name || material.type;
	const toneMapping = p.toneMapping | 0;
	const colorSpaceFn = p.sRGBOutput ? 'sRGBTransferOETF' : 'LinearTransferOETF';

	let prefixVertex, prefixFragment;
	if (isRaw) {
		prefixVertex = [customDefines].filter(filterEmptyLine).join('\n');
		prefixFragment = [customDefines].filter(filterEmptyLine).join('\n');
	} else {
		prefixVertex = [
			generatePrecision(precision),
			'#define SHADER_TYPE ' + material.type,
			'#define SHADER_NAME ' + shaderName,
			customDefines,
			p.instancing ? '#define USE_INSTANCING' : '',
			p.instancingColor ? '#define USE_INSTANCING_COLOR' : '',
			p.fog ? '#define USE_FOG' : '',
			p.fogExp2 ? '#define FOG_EXP2' : '',
			p.vertexColors ? '#define USE_COLOR' : '',
			p.vertexAlphas ? '#define USE_COLOR_ALPHA' : '',
			p.vertexUv1s ? '#define USE_UV1' : '',
			p.flatShading ? '#define FLAT_SHADED' : '',
			p.skinning ? '#define USE_SKINNING' : '',
			p.morphTargets ? '#define USE_MORPHTARGETS' : '',
			p.morphNormals && p.flatShading === false ? '#define USE_MORPHNORMALS' : '',
			p.morphColors ? '#define USE_MORPHCOLORS' : '',
			p.morphTargetsCount > 0 ? '#define MORPHTARGETS_TEXTURE_STRIDE ' + p.morphTextureStride : '',
			p.morphTargetsCount > 0 ? '#define MORPHTARGETS_COUNT ' + p.morphTargetsCount : '',
			p.doubleSided ? '#define DOUBLE_SIDED' : '',
			p.flipSided ? '#define FLIP_SIDED' : '',
			...envMapDefines(p, true),
			p.sizeAttenuation ? '#define USE_SIZEATTENUATION' : '',
			'uniform mat4 modelMatrix;',
			'uniform mat4 modelViewMatrix;',
			'uniform mat4 projectionMatrix;',
			'uniform mat4 viewMatrix;',
			'uniform mat3 normalMatrix;',
			'uniform vec3 cameraPosition;',
			'uniform bool isOrthographic;',
			'#ifdef USE_INSTANCING',
			'	attribute mat4 instanceMatrix;',
			'#endif',
			'#ifdef USE_INSTANCING_COLOR',
			'	attribute vec3 instanceColor;',
			'#endif',
			'attribute vec3 position;',
			'attribute vec3 normal;',
			'attribute vec2 uv;',
			'#ifdef USE_UV1',
			'	attribute vec2 uv1;',
			'#endif',
			'#ifdef USE_TANGENT',
			'	attribute vec4 tangent;',
			'#endif',
			'#if defined( USE_COLOR_ALPHA )',
			'	attribute vec4 color;',
			'#elif defined( USE_COLOR )',
			'	attribute vec3 color;',
			'#endif',
			'#ifdef USE_SKINNING',
			'	attribute vec4 skinIndex;',
			'	attribute vec4 skinWeight;',
			'#endif',
			'\n'
		].filter(filterEmptyLine).join('\n');
		const encodingMatrix = 'mat3( 1.0000, 0.0000, 0.0000, 0.0000, 1.0000, 0.0000, 0.0000, 0.0000, 1.0000 )';
		prefixFragment = [
			generatePrecision(precision),
			'#define SHADER_TYPE ' + material.type,
			'#define SHADER_NAME ' + shaderName,
			customDefines,
			p.fog ? '#define USE_FOG' : '',
			p.fogExp2 ? '#define FOG_EXP2' : '',
			p.vertexColors ? '#define USE_COLOR' : '',
			p.vertexAlphas ? '#define USE_COLOR_ALPHA' : '',
			p.vertexUv1s ? '#define USE_UV1' : '',
			p.flatShading ? '#define FLAT_SHADED' : '',
			p.doubleSided ? '#define DOUBLE_SIDED' : '',
			p.flipSided ? '#define FLIP_SIDED' : '',
			...envMapDefines(p, false),
			p.premultipliedAlpha ? '#define PREMULTIPLIED_ALPHA' : '',
			'uniform mat4 viewMatrix;',
			'uniform vec3 cameraPosition;',
			'uniform bool isOrthographic;',
			(toneMapping !== _NoToneMapping) ? '#define TONE_MAPPING' : '',
			(toneMapping !== _NoToneMapping) ? ShaderChunk['tonemapping_pars_fragment'] : '',
			(toneMapping !== _NoToneMapping) ? `vec3 toneMapping( vec3 color ) { return ${toneMappingFunctions[toneMapping] || 'Linear'}ToneMapping( color ); }` : '',
			p.dithering ? '#define DITHERING' : '',
			material.transparent === false ? '#define OPAQUE' : '',
			ShaderChunk['colorspace_pars_fragment'],
			`vec4 linearToOutputTexel( vec4 value ) {\n	return ${colorSpaceFn}( vec4( value.rgb * ${encodingMatrix}, value.a ) );\n}`,
			'\n'
		].filter(filterEmptyLine).join('\n');
	}

	let vertexShader = material.vertexShader, fragmentShader = material.fragmentShader;
	vertexShader = resolveIncludes(vertexShader); vertexShader = replaceLightNums(vertexShader, material.defines);
	fragmentShader = resolveIncludes(fragmentShader); fragmentShader = replaceLightNums(fragmentShader, material.defines);
	vertexShader = unrollLoops(vertexShader); fragmentShader = unrollLoops(fragmentShader);

	// Always GLSL ES 3.00 output. Sources written for GLSL 1.00 get the same shims three.js applies.
	const versionString = '#version 300 es\n';
	if (!glsl3 || !isRaw) {
		prefixVertex = ['precision mediump sampler2DArray;', '#define attribute in', '#define varying out', '#define texture2D texture'].join('\n') + '\n' + prefixVertex;
		prefixFragment = [
			'precision mediump sampler2DArray;',
			'#define varying in',
			glsl3 ? '' : 'layout(location = 0) out highp vec4 pc_fragColor;',
			glsl3 ? '' : '#define gl_FragColor pc_fragColor',
			'#define gl_FragDepthEXT gl_FragDepth',
			'#define texture2D texture',
			'#define textureCube texture',
			'#define texture2DProj textureProj',
			'#define texture2DLodEXT textureLod',
			'#define texture2DProjLodEXT textureProjLod',
			'#define textureCubeLodEXT textureLod',
			'#define texture2DGradEXT textureGrad',
			'#define texture2DProjGradEXT textureProjGrad',
			'#define textureCubeGradEXT textureGrad'
		].filter(filterEmptyLine).join('\n') + '\n' + prefixFragment;
	}
	return { vertexShader: versionString + prefixVertex + vertexShader, fragmentShader: versionString + prefixFragment + fragmentShader };
}


