// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { KeyframeTrack } from '../KeyframeTrack.js';

class ColorKeyframeTrack extends KeyframeTrack {

	constructor( name, times, values, interpolation ) {

		super( name, times, values, interpolation );

	}

}

ColorKeyframeTrack.prototype.ValueTypeName = 'color';
// ValueBufferType is inherited
// DefaultInterpolation is inherited

export { ColorKeyframeTrack };
