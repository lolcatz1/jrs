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
	dirShadowMap0: 8, dirShadowMap1: 9, dirShadowMap2: 10, dirShadowMap3: 11,
	spotShadowMap0: 12, spotShadowMap1: 13, spotShadowMap2: 14, spotShadowMap3: 15,
};

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
layout(std140) uniform Material {
	vec4 diffuse;        // rgb, a = opacity
	vec4 emissive;       // rgb, a = alphaTest
	vec4 specular;       // rgb, a = shininess
	vec4 matParams;      // roughness, metalness, aoMapIntensity, emissiveIntensity
	vec4 matParams2;     // normalScale.xy, pointSize, bumpScale
	vec4 uvTransform0;   // mat3 columns, padded
	vec4 uvTransform1;
	vec4 uvTransform2;
};
`;
export const MATERIAL_BLOCK_SIZE = 16 * 8;

const common = /* glsl */`
#define PI 3.141592653589793
#define RECIPROCAL_PI 0.3183098861837907
#define EPSILON 1e-6
float pow2( const in float x ) { return x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) { return RECIPROCAL_PI * diffuseColor; }
`;

const vertexShader = /* glsl */`
precision highp float;
precision highp int;
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
out vec3 vWorldPosition;
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
		vec4 worldPosition = model * vec4( position, 1.0 );
		vec4 mvPosition = viewMatrix * worldPosition;
	#endif
	vWorldPosition = worldPosition.xyz;
	#ifdef USE_NORMAL
		#ifdef USE_INSTANCING
		vNormal = normalize( transpose( inverse( mat3( model ) ) ) * normal );
		#else
		vNormal = normalize( normalMatrix * normal );
		#endif
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
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 f0, const in float f90, const in float roughness ) {
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = clamp( dot( normal, lightDir ), 0.0, 1.0 );
	float dotNV = clamp( dot( normal, viewDir ), 0.0, 1.0 );
	float dotNH = clamp( dot( normal, halfDir ), 0.0, 1.0 );
	float dotVH = clamp( dot( viewDir, halfDir ), 0.0, 1.0 );
	vec3 F = F_Schlick( f0, f90, dotVH );
	float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
	float D = D_GGX( alpha, dotNH );
	return F * ( V * D );
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
		vec3 diffuseBase = diffuseColor.rgb * ( 1.0 - metalnessFactor );
		vec3 specularF0 = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
		float dxy = max( abs( dFdx( normal.z ) ), abs( dFdy( normal.z ) ) );
		float geometryRoughness = min( max( dxy, 0.0525 ), 1.0 );
		float roughness = max( roughnessFactor, 0.0525 );
		roughness = min( roughness + geometryRoughness, 1.0 );
		#else
		vec3 diffuseBase = diffuseColor.rgb;
		#endif
		#if defined( LIGHTING_PHONG )
		vec3 specularColor = specular.rgb;
		float shininess = specular.a;
		float specularStrength = 1.0;
			#ifdef USE_SPECULARMAP
			specularStrength = texture( specularMap, vUv ).r;
			#endif
		#endif
		vec3 directDiffuse = vec3( 0.0 );
		vec3 directSpecular = vec3( 0.0 );
		vec3 irradiance;
		vec3 L;
		float dotNL;
		// directional
		for ( int i = 0; i < ${MAX_DIR_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.x ) break;
			L = dirLights[ i ].direction.xyz;
			dotNL = clamp( dot( normal, L ), 0.0, 1.0 );
			irradiance = dotNL * dirLights[ i ].color.rgb;
			#if NUM_DIR_SHADOWS > 0
			if ( i < NUM_DIR_SHADOWS ) {
				irradiance *= dirShadowFactor( i );
			}
			#endif
			directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
			#if defined( LIGHTING_STANDARD )
			directSpecular += irradiance * BRDF_GGX( L, viewDir, normal, specularF0, 1.0, roughness );
			#elif defined( LIGHTING_PHONG )
			directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
			#endif
		}
		// point
		for ( int i = 0; i < ${MAX_POINT_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.y ) break;
			vec3 lVector = pointLights[ i ].position.xyz - vWorldPosition;
			L = normalize( lVector );
			float lightDistance = length( lVector );
			dotNL = clamp( dot( normal, L ), 0.0, 1.0 );
			irradiance = dotNL * pointLights[ i ].color.rgb * getDistanceAttenuation( lightDistance, pointLights[ i ].params.x, pointLights[ i ].params.y );
			directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
			#if defined( LIGHTING_STANDARD )
			directSpecular += irradiance * BRDF_GGX( L, viewDir, normal, specularF0, 1.0, roughness );
			#elif defined( LIGHTING_PHONG )
			directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
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
				dotNL = clamp( dot( normal, L ), 0.0, 1.0 );
				irradiance = dotNL * spotLights[ i ].color.rgb * spotAttenuation * getDistanceAttenuation( lightDistance, spotLights[ i ].params.x, spotLights[ i ].params.y );
				#if NUM_SPOT_SHADOWS > 0
				if ( i < NUM_SPOT_SHADOWS ) {
					irradiance *= spotShadowFactor( i );
				}
				#endif
				directDiffuse += irradiance * BRDF_Lambert( diffuseBase );
				#if defined( LIGHTING_STANDARD )
				directSpecular += irradiance * BRDF_GGX( L, viewDir, normal, specularF0, 1.0, roughness );
				#elif defined( LIGHTING_PHONG )
				directSpecular += irradiance * BRDF_BlinnPhong( L, viewDir, normal, specularColor, shininess ) * specularStrength;
				#endif
			}
		}
		// indirect (ambient + hemisphere)
		vec3 indirectIrradiance = ambient.rgb;
		for ( int i = 0; i < ${MAX_HEMI_LIGHTS}; i ++ ) {
			if ( i >= lightCounts.w ) break;
			float dotNLh = dot( normal, hemiLights[ i ].direction.xyz );
			float hemiDiffuseWeight = 0.5 * dotNLh + 0.5;
			indirectIrradiance += mix( hemiLights[ i ].ground.rgb, hemiLights[ i ].sky.rgb, hemiDiffuseWeight );
		}
		vec3 indirectDiffuse = indirectIrradiance * BRDF_Lambert( diffuseBase );
		#ifdef USE_AOMAP
			#ifdef USE_UV1
			float ambientOcclusion = ( texture( aoMap, vUv1 ).r - 1.0 ) * matParams.z + 1.0;
			#else
			float ambientOcclusion = ( texture( aoMap, vUv ).r - 1.0 ) * matParams.z + 1.0;
			#endif
		indirectDiffuse *= ambientOcclusion;
		#endif
		vec3 totalEmissive = emissive.rgb * matParams.w;
		#ifdef USE_EMISSIVEMAP
		totalEmissive *= texture( emissiveMap, vUv ).rgb;
		#endif
		outgoingLight = directDiffuse + indirectDiffuse + directSpecular + totalEmissive;
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

/**
 * Build GLSL ES 3.00 sources for a built-in material program.
 * @param {object} p program parameters (see WebGLPrograms.getParameters)
 */
export function buildBuiltinShader(p) {
	const defines = [];
	const d = (name, value) => defines.push(value === undefined ? `#define ${name}` : `#define ${name} ${value}`);
	switch (p.materialType) {
		case MATERIAL_LAMBERT: d('LIGHTING_LAMBERT'); d('USE_NORMAL'); break;
		case MATERIAL_PHONG: d('LIGHTING_PHONG'); d('USE_NORMAL'); break;
		case MATERIAL_STANDARD: d('LIGHTING_STANDARD'); d('USE_NORMAL'); break;
		case MATERIAL_NORMAL: d('IS_NORMAL_MATERIAL'); d('USE_NORMAL'); break;
		case MATERIAL_DEPTH: case MATERIAL_SHADOW_DEPTH: d('IS_DEPTH'); break;
		case MATERIAL_POINTS: d('IS_POINTS'); break;
		case MATERIAL_SPRITE: d('IS_SPRITE'); break;
	}
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
	if (p.flatShading) d('FLAT_SHADED');
	if (p.doubleSided) d('DOUBLE_SIDED');
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
	const vsExtra = p.materialType === MATERIAL_SPRITE ? spriteUniform : '';
	const vs = prefix + vsExtra + vertexShader;
	// insert shadow helper functions after sampleShadow definition
	let fs = fragmentShader;
	const helpers = shadowFactorFunctions(p.numDirShadows | 0, p.numSpotShadows | 0);
	if (helpers !== '') fs = fs.replace('#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb', helpers + '#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb');
	return { vertexShader: vs, fragmentShader: prefix + fs };
}

/** Converts a GLSL 1.00 three.js-style ShaderMaterial source to GLSL ES 3.00. */
export function buildCustomShader(material, p) {
	const defines = [];
	for (const name in material.defines) {
		const v = material.defines[name];
		if (v === false) continue;
		defines.push(v === true || v === '' ? `#define ${name}` : `#define ${name} ${v}`);
	}
	if (p.instancing) defines.push('#define USE_INSTANCING');
	if (p.vertexColors) defines.push('#define USE_COLOR');
	if (p.fog) defines.push('#define USE_FOG');
	const isRaw = material.isRawShaderMaterial === true;
	const version = material.glslVersion === '300 es' || isRaw === false ? '300 es' : null;

	let vs = material.vertexShader, fs = material.fragmentShader;
	const stripIncludes = (src) => src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (m, name) => {
		if (!warnedIncludes.has(name)) { warnedIncludes.add(name); console.warn(`jrs: ShaderMaterial #include <${name}> is not available; the directive was removed.`); }
		return '';
	});
	vs = stripIncludes(vs); fs = stripIncludes(fs);

	const standardVertexUniforms = isRaw ? '' : `
precision ${material.precision || 'highp'} float;
precision ${material.precision || 'highp'} int;
#define SHADER_TYPE ${material.type}
#define SHADER_NAME ${material.name || material.type}
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
in vec3 position;
in vec3 normal;
in vec2 uv;
#ifdef USE_INSTANCING
in mat4 instanceMatrix;
#endif
#ifdef USE_COLOR
in vec3 color;
#endif
`;
	const standardFragmentUniforms = isRaw ? '' : `
precision ${material.precision || 'highp'} float;
precision ${material.precision || 'highp'} int;
#define SHADER_TYPE ${material.type}
#define SHADER_NAME ${material.name || material.type}
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
uniform bool isOrthographic;
`;
	const needsGL1Conversion = version === '300 es' && material.glslVersion !== '300 es';
	if (needsGL1Conversion) {
		vs = vs.replace(/\battribute\b/g, 'in').replace(/\bvarying\b/g, 'out').replace(/\btexture2D\b/g, 'texture').replace(/\btextureCube\b/g, 'texture');
		fs = fs.replace(/\bvarying\b/g, 'in').replace(/\btexture2D\b/g, 'texture').replace(/\btextureCube\b/g, 'texture').replace(/\bgl_FragDepthEXT\b/g, 'gl_FragDepth');
		if (fs.indexOf('gl_FragColor') !== -1) {
			fs = 'layout(location = 0) out highp vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor\n' + fs;
		}
	}
	const head = (version ? `#version ${version}\n` : '') + defines.join('\n') + '\n';
	return {
		vertexShader: head + standardVertexUniforms + vs,
		fragmentShader: head + standardFragmentUniforms + fs,
	};
}

const warnedIncludes = new Set();
