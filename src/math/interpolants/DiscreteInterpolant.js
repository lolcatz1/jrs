// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { Interpolant } from '../Interpolant.js';

class DiscreteInterpolant extends Interpolant {

	constructor( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

		super( parameterPositions, sampleValues, sampleSize, resultBuffer );

	}

	interpolate_( i1 /*, t0, t, t1 */ ) {

		return this.copySampleValue_( i1 - 1 );

	}

}

export { DiscreteInterpolant };
