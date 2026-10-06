import { SRGBColorSpace, LinearSRGBColorSpace, NoColorSpace } from '../constants.js';

export function SRGBToLinear(c) {
	return (c < 0.04045) ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
export function LinearToSRGB(c) {
	return (c < 0.0031308) ? c * 12.92 : 1.055 * (Math.pow(c, 0.41666)) - 0.055;
}

// Working color space is linear-sRGB. sRGB and linear-sRGB share primaries,
// so conversions are pure transfer functions.
export const ColorManagement = {
	enabled: true,
	workingColorSpace: LinearSRGBColorSpace,
	convert(color, sourceColorSpace, targetColorSpace) {
		if (this.enabled === false || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace) return color;
		if (sourceColorSpace === SRGBColorSpace && targetColorSpace === LinearSRGBColorSpace) {
			color.r = SRGBToLinear(color.r); color.g = SRGBToLinear(color.g); color.b = SRGBToLinear(color.b);
		} else if (sourceColorSpace === LinearSRGBColorSpace && targetColorSpace === SRGBColorSpace) {
			color.r = LinearToSRGB(color.r); color.g = LinearToSRGB(color.g); color.b = LinearToSRGB(color.b);
		}
		return color;
	},
	fromWorkingColorSpace(color, targetColorSpace) { return this.convert(color, this.workingColorSpace, targetColorSpace); },
	toWorkingColorSpace(color, sourceColorSpace) { return this.convert(color, sourceColorSpace, this.workingColorSpace); },
	getTransfer(colorSpace) { return colorSpace === NoColorSpace ? 'linear' : (colorSpace === SRGBColorSpace ? 'srgb' : 'linear'); },
};
