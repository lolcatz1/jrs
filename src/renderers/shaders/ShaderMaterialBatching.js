/**
 * Automatic instancing of ShaderMaterial draws.
 *
 * A custom program is "batchable" when its vertex shader only reads the per-object transforms through
 * the standard three.js names (`modelMatrix`, `modelViewMatrix`, `normalMatrix`, directly or through
 * chunks such as `project_vertex` / `worldpos_vertex` / `defaultnormal_vertex`). For such a program the
 * renderer compiles a second variant in which those three uniforms become plain globals that `main()`
 * fills from the per-frame matrix texture (the same texture the built-in batched programs read), indexed
 * by `drawBase + gl_InstanceID` (+ `gl_DrawID` for multi-draw). A run of objects sharing the material
 * can then be one instanced / multi-draw call.
 *
 * Texture entry layouts (8 texels per entry, see WebGLBatcher):
 *   LAYOUT_WORLD: entry 0 = world matrix + world normal matrix       (shader reads modelMatrix only)
 *   LAYOUT_VIEW:  entry 0 = modelView matrix + its normal matrix     (shader reads modelViewMatrix / normalMatrix only)
 *   LAYOUT_BOTH:  entry 0 as LAYOUT_VIEW, entry 1 as LAYOUT_WORLD    (shader reads both kinds)
 * The view-space matrices are computed on the CPU with exactly the arithmetic the per-object uniform
 * path uses (`Matrix4.multiplyMatrices` / `Matrix3.getNormalMatrix` on float32 inputs), so a batched
 * draw is bit-identical to the unbatched one. Computing `viewMatrix * modelMatrix` in the shader instead
 * would round every product to float32 and sum in an unspecified order, which differs from the CPU's
 * double-precision accumulate by an ulp or two.
 */

export const OBJ_USES_MODEL = 1, OBJ_USES_MODELVIEW = 2, OBJ_USES_NORMAL = 4, OBJ_ELIGIBLE = 8;
export const LAYOUT_WORLD = 0, LAYOUT_VIEW = 1, LAYOUT_BOTH = 2;

/** Entry layout for a usage mask (see above); 1 or 2 entries per object. */
export function layoutOf(mode) {
	if ((mode & (OBJ_USES_MODELVIEW | OBJ_USES_NORMAL)) === 0) return LAYOUT_WORLD;
	return (mode & OBJ_USES_MODEL) !== 0 ? LAYOUT_BOTH : LAYOUT_VIEW;
}
export function entriesOf(mode) { return layoutOf(mode) === LAYOUT_BOTH ? 2 : 1; }

const NAMES = { modelMatrix: OBJ_USES_MODEL, modelViewMatrix: OBJ_USES_MODELVIEW, normalMatrix: OBJ_USES_NORMAL };
const MAIN_PATTERN = /\bvoid\s+main\s*\(\s*(?:void)?\s*\)\s*\{/g;
const COMMENT_PATTERN = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/g;
const RAW_DECL = (name) => new RegExp('uniform\\s+(?:(?:highp|mediump|lowp)\\s+)?mat[34]\\s+' + name + '\\s*;', 'g');

function isIdentStart(c) { return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95; }
function isIdentChar(c) { return isIdentStart(c) || (c >= 48 && c <= 57); }

/**
 * Scans the (include-resolved, comment-free) user part of a vertex shader. Returns the usage mask with
 * OBJ_ELIGIBLE set when every reference to the three object uniforms is a plain read inside a function
 * body, no preprocessor line mentions them, and the shader does not read gl_InstanceID / gl_DrawID itself.
 */
export function analyzeVertexSource(source, isRaw) {
	let src = source.replace(COMMENT_PATTERN, ' ');
	if (isRaw) {
		// RawShaderMaterial declares the uniforms itself; each must be a single plain declaration
		for (const name in NAMES) {
			const matches = src.match(RAW_DECL(name));
			if (matches !== null && matches.length > 1) return 0;
			if (matches !== null) src = src.replace(RAW_DECL(name), ' ');
		}
	}
	let mode = 0, depth = 0, directive = false, lineStart = true;
	for (let i = 0, n = src.length; i < n; i++) {
		const c = src.charCodeAt(i);
		if (c === 10) { directive = false; lineStart = true; continue; }
		if (lineStart) {
			if (c === 32 || c === 9 || c === 13) continue;
			lineStart = false;
			if (c === 35) { directive = true; continue; }
		}
		if (c === 123) { depth++; continue; }
		if (c === 125) { depth--; continue; }
		if (!isIdentStart(c)) continue;
		let j = i + 1;
		while (j < n && isIdentChar(src.charCodeAt(j))) j++;
		const word = src.slice(i, j);
		i = j - 1;
		if (word === 'gl_InstanceID' || word === 'gl_DrawID') return 0;
		const bit = NAMES[word];
		if (bit === undefined) continue;
		if (directive || depth === 0) return 0; // #define / #if tricks, global initialisers, user declarations
		// a declaration of the name in a function would shadow the uniform; a write is a compile error on a uniform
		mode |= bit;
	}
	if (mode === 0) return 0;
	MAIN_PATTERN.lastIndex = 0;
	const first = MAIN_PATTERN.exec(src);
	if (first === null || MAIN_PATTERN.exec(src) !== null) return 0;
	return mode | OBJ_ELIGIBLE;
}

/** The fragment stage must not declare / read the object uniforms itself (they would stay unfilled). */
export function fragmentReferencesObjectUniforms(source) {
	const src = source.replace(COMMENT_PATTERN, ' ');
	return /\b(?:modelMatrix|modelViewMatrix|normalMatrix)\b/.test(src);
}

/**
 * GLSL declaring the matrix texture, the three object globals and `jrs_fetchObject()`, which fills the
 * globals for the current instance / sub-draw. `width` is the matrix texture width in texels,
 * `texels` the texels per entry.
 */
export function objectFetchBlock(mode, multiDraw, width, texels) {
	const layout = layoutOf(mode), entries = entriesOf(mode);
	let s = 'uniform highp sampler2D objectMatrices;\nuniform int drawBase;\n';
	s += 'mat4 modelMatrix;\nmat4 modelViewMatrix;\nmat3 normalMatrix;\n';
	s += 'ivec2 jrs_objectTexel( int entry ) {\n';
	s += `\tint id = ( drawBase + ( gl_InstanceID${multiDraw ? ' + gl_DrawID' : ''} ) * ${entries} + entry ) * ${texels};\n`;
	s += `\tint y = id / ${width};\n\treturn ivec2( id - y * ${width}, y );\n}\n`;
	s += 'mat4 jrs_fetchMat4( ivec2 t ) { return mat4( texelFetch( objectMatrices, t, 0 ), texelFetch( objectMatrices, t + ivec2( 1, 0 ), 0 ), texelFetch( objectMatrices, t + ivec2( 2, 0 ), 0 ), texelFetch( objectMatrices, t + ivec2( 3, 0 ), 0 ) ); }\n';
	s += 'mat3 jrs_fetchMat3( ivec2 t ) { return mat3( texelFetch( objectMatrices, t + ivec2( 4, 0 ), 0 ).xyz, texelFetch( objectMatrices, t + ivec2( 5, 0 ), 0 ).xyz, texelFetch( objectMatrices, t + ivec2( 6, 0 ), 0 ).xyz ); }\n';
	s += 'void jrs_fetchObject() {\n\tivec2 t = jrs_objectTexel( 0 );\n';
	if (layout === LAYOUT_WORLD) {
		s += '\tmodelMatrix = jrs_fetchMat4( t );\n';
	} else {
		if (mode & OBJ_USES_MODELVIEW) s += '\tmodelViewMatrix = jrs_fetchMat4( t );\n';
		if (mode & OBJ_USES_NORMAL) s += '\tnormalMatrix = jrs_fetchMat3( t );\n';
		if (layout === LAYOUT_BOTH) s += '\tmodelMatrix = jrs_fetchMat4( jrs_objectTexel( 1 ) );\n';
	}
	s += '}\n';
	return s;
}

/** Inserts the fetch call at the top of main() (and, for raw shaders, drops the user's uniform declarations). */
export function rewriteVertexSource(source, isRaw) {
	let src = source;
	if (isRaw) for (const name in NAMES) src = src.replace(RAW_DECL(name), '');
	MAIN_PATTERN.lastIndex = 0;
	return src.replace(MAIN_PATTERN, (m) => m + '\n\tjrs_fetchObject();\n');
}
