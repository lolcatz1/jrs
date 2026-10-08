// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { KeyframeTrack } from '../KeyframeTrack.js';

class VectorKeyframeTrack extends KeyframeTrack {

	constructor( name, times, values, interpolation ) {

		super( name, times, values, interpolation );

	}

}

VectorKeyframeTrack.prototype.ValueTypeName = 'vector';
// ValueBufferType is inherited
// DefaultInterpolation is inherited

export { VectorKeyframeTrack };
