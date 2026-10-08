// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { Interpolant } from '../Interpolant.js';
import { Quaternion } from '../Quaternion.js';

class QuaternionLinearInterpolant extends Interpolant {

	constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

		super( parameterPositions, sampleValues, sampleSize, resultBuffer );

		this._memoCos = NaN; // slerp angle memo (see _slerp)
		this._memoSin = 0;
		this._memoLen = 0;

	}

	/**
	 * Same result as Interpolant.evaluate. A time inside the interval found by the previous call (the common case
	 * while a clip plays) is interpolated right here: the seek machinery would fall through to the same
	 * interpolate_ call without changing anything, and keeping the slerp inside this function keeps its doubles
	 * unboxed (calls across the generic evaluate allocated a HeapNumber per argument per track and frame).
	 */
	evaluate( t ) {

		const i1 = this._cachedIndex;

		if ( i1 > 0 && this.valueSize === 4 ) {

			const pp = this.parameterPositions,
				t1 = pp[ i1 ],
				t0 = pp[ i1 - 1 ];

			if ( t >= t0 && t < t1 ) {

				const dst = this.resultBuffer, src = this.sampleValues, offset = i1 * 4, o0 = offset - 4;
				const alpha = ( t - t0 ) / ( t1 - t0 );

				let x0 = src[ o0 ], y0 = src[ o0 + 1 ], z0 = src[ o0 + 2 ], w0 = src[ o0 + 3 ];
				const x1 = src[ offset ], y1 = src[ offset + 1 ], z1 = src[ offset + 2 ], w1 = src[ offset + 3 ];

				if ( alpha === 0 ) {

					dst[ 0 ] = x0; dst[ 1 ] = y0; dst[ 2 ] = z0; dst[ 3 ] = w0;
					return dst;

				}

				if ( alpha === 1 ) {

					dst[ 0 ] = x1; dst[ 1 ] = y1; dst[ 2 ] = z1; dst[ 3 ] = w1;
					return dst;

				}

				if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

					let s = 1 - alpha, u = alpha;

					const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1,
						dir = ( cos >= 0 ? 1 : - 1 ),
						sqrSin = 1 - cos * cos;

					if ( sqrSin > Number.EPSILON ) {

						if ( cos !== this._memoCos ) this._memoAngle( cos, dir, sqrSin );

						const sin = this._memoSin, len = this._memoLen;

						s = Math.sin( s * len ) / sin;
						u = Math.sin( u * len ) / sin;

					}

					const tDir = u * dir;

					x0 = x0 * s + x1 * tDir;
					y0 = y0 * s + y1 * tDir;
					z0 = z0 * s + z1 * tDir;
					w0 = w0 * s + w1 * tDir;

					// Normalize in case we just did a lerp:
					if ( s === 1 - u ) {

						const f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );

						x0 *= f; y0 *= f; z0 *= f; w0 *= f;

					}

				}

				dst[ 0 ] = x0; dst[ 1 ] = y0; dst[ 2 ] = z0; dst[ 3 ] = w0;
				return dst;

			}

		}

		return super.evaluate( t );

	}

	_memoAngle( cos, dir, sqrSin ) {

		const sin = Math.sqrt( sqrSin );
		this._memoCos = cos;
		this._memoSin = sin;
		this._memoLen = Math.atan2( sin, cos * dir );

	}

	interpolate_( i1, t0, t, t1 ) {

		const result = this.resultBuffer,
			values = this.sampleValues,
			stride = this.valueSize,

			alpha = ( t - t0 ) / ( t1 - t0 );

		let offset = i1 * stride;

		if ( stride === 4 ) return this._slerp( result, values, offset, alpha );

		for ( let end = offset + stride; offset !== end; offset += 4 ) {

			Quaternion.slerpFlat( result, 0, values, offset - stride, values, offset, alpha );

		}

		return result;

	}

	/**
	 * Quaternion.slerpFlat for one quaternion with the angle terms memoised: sqrt(1 - cos^2) and atan2(sin, cos) are
	 * pure functions of the dot product of the two keyframes, which is the same every frame while the clip time stays
	 * inside one interval. Same operations in the same order as slerpFlat, so the result is bit-identical.
	 */
	_slerp( dst, src, offset, t ) {

		const o0 = offset - 4;
		let x0 = src[ o0 ], y0 = src[ o0 + 1 ], z0 = src[ o0 + 2 ], w0 = src[ o0 + 3 ];
		const x1 = src[ offset ], y1 = src[ offset + 1 ], z1 = src[ offset + 2 ], w1 = src[ offset + 3 ];

		if ( t === 0 ) {

			dst[ 0 ] = x0; dst[ 1 ] = y0; dst[ 2 ] = z0; dst[ 3 ] = w0;
			return dst;

		}

		if ( t === 1 ) {

			dst[ 0 ] = x1; dst[ 1 ] = y1; dst[ 2 ] = z1; dst[ 3 ] = w1;
			return dst;

		}

		if ( w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1 ) {

			let s = 1 - t;

			const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1,
				dir = ( cos >= 0 ? 1 : - 1 ),
				sqrSin = 1 - cos * cos;

			if ( sqrSin > Number.EPSILON ) {

				if ( cos !== this._memoCos ) this._memoAngle( cos, dir, sqrSin );

				const sin = this._memoSin, len = this._memoLen;

				s = Math.sin( s * len ) / sin;
				t = Math.sin( t * len ) / sin;

			}

			const tDir = t * dir;

			x0 = x0 * s + x1 * tDir;
			y0 = y0 * s + y1 * tDir;
			z0 = z0 * s + z1 * tDir;
			w0 = w0 * s + w1 * tDir;

			// Normalize in case we just did a lerp:
			if ( s === 1 - t ) {

				const f = 1 / Math.sqrt( x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0 );

				x0 *= f; y0 *= f; z0 *= f; w0 *= f;

			}

		}

		dst[ 0 ] = x0; dst[ 1 ] = y0; dst[ 2 ] = z0; dst[ 3 ] = w0;
		return dst;

	}

}

export { QuaternionLinearInterpolant };
