// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { InterpolateDiscrete } from '../../constants.js';
import { KeyframeTrack } from '../KeyframeTrack.js';

class StringKeyframeTrack extends KeyframeTrack {

	constructor( name, times, values ) {

		super( name, times, values );

	}

}

StringKeyframeTrack.prototype.ValueTypeName = 'string';

StringKeyframeTrack.prototype.ValueBufferType = Array;

StringKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear = undefined;
StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = undefined;

export { StringKeyframeTrack };
