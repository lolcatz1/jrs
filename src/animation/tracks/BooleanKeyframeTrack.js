// Ported from three.js r186 (MIT, Copyright 2010-2026 three.js authors).
import { InterpolateDiscrete } from '../../constants.js';
import { KeyframeTrack } from '../KeyframeTrack.js';

class BooleanKeyframeTrack extends KeyframeTrack {

	constructor( name, times, values ) {

		super( name, times, values );

	}

}

BooleanKeyframeTrack.prototype.ValueTypeName = 'bool';

BooleanKeyframeTrack.prototype.ValueBufferType = Array;

BooleanKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear = undefined;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = undefined;

export { BooleanKeyframeTrack };
