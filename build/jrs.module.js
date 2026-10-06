/*! jrs - a faster three.js-compatible WebGL2 engine. MIT License. Geometry and shader chunk sources ported from three.js (MIT, Copyright 2010-2026 three.js authors). */
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/constants.js
var REVISION = "1-jrs";
var MOUSE = { LEFT: 0, MIDDLE: 1, RIGHT: 2, ROTATE: 0, DOLLY: 1, PAN: 2 };
var TOUCH = { ROTATE: 0, PAN: 1, DOLLY_PAN: 2, DOLLY_ROTATE: 3 };
var CullFaceNone = 0;
var CullFaceBack = 1;
var CullFaceFront = 2;
var CullFaceFrontBack = 3;
var BasicShadowMap = 0;
var PCFShadowMap = 1;
var PCFSoftShadowMap = 2;
var VSMShadowMap = 3;
var FrontSide = 0;
var BackSide = 1;
var DoubleSide = 2;
var NoBlending = 0;
var NormalBlending = 1;
var AdditiveBlending = 2;
var SubtractiveBlending = 3;
var MultiplyBlending = 4;
var CustomBlending = 5;
var AddEquation = 100;
var SubtractEquation = 101;
var ReverseSubtractEquation = 102;
var MinEquation = 103;
var MaxEquation = 104;
var ZeroFactor = 200;
var OneFactor = 201;
var SrcColorFactor = 202;
var OneMinusSrcColorFactor = 203;
var SrcAlphaFactor = 204;
var OneMinusSrcAlphaFactor = 205;
var DstAlphaFactor = 206;
var OneMinusDstAlphaFactor = 207;
var DstColorFactor = 208;
var OneMinusDstColorFactor = 209;
var SrcAlphaSaturateFactor = 210;
var ConstantColorFactor = 211;
var OneMinusConstantColorFactor = 212;
var ConstantAlphaFactor = 213;
var OneMinusConstantAlphaFactor = 214;
var NeverDepth = 0;
var AlwaysDepth = 1;
var LessDepth = 2;
var LessEqualDepth = 3;
var EqualDepth = 4;
var GreaterEqualDepth = 5;
var GreaterDepth = 6;
var NotEqualDepth = 7;
var MultiplyOperation = 0;
var MixOperation = 1;
var AddOperation = 2;
var NoToneMapping = 0;
var LinearToneMapping = 1;
var ReinhardToneMapping = 2;
var CineonToneMapping = 3;
var ACESFilmicToneMapping = 4;
var AgXToneMapping = 6;
var NeutralToneMapping = 7;
var UVMapping = 300;
var CubeReflectionMapping = 301;
var CubeRefractionMapping = 302;
var EquirectangularReflectionMapping = 303;
var EquirectangularRefractionMapping = 304;
var RepeatWrapping = 1e3;
var ClampToEdgeWrapping = 1001;
var MirroredRepeatWrapping = 1002;
var NearestFilter = 1003;
var NearestMipmapNearestFilter = 1004;
var NearestMipMapNearestFilter = 1004;
var NearestMipmapLinearFilter = 1005;
var NearestMipMapLinearFilter = 1005;
var LinearFilter = 1006;
var LinearMipmapNearestFilter = 1007;
var LinearMipMapNearestFilter = 1007;
var LinearMipmapLinearFilter = 1008;
var LinearMipMapLinearFilter = 1008;
var UnsignedByteType = 1009;
var ByteType = 1010;
var ShortType = 1011;
var UnsignedShortType = 1012;
var IntType = 1013;
var UnsignedIntType = 1014;
var FloatType = 1015;
var HalfFloatType = 1016;
var UnsignedShort4444Type = 1017;
var UnsignedShort5551Type = 1018;
var UnsignedInt248Type = 1020;
var AlphaFormat = 1021;
var RGBFormat = 1022;
var RGBAFormat = 1023;
var LuminanceFormat = 1024;
var LuminanceAlphaFormat = 1025;
var DepthFormat = 1026;
var DepthStencilFormat = 1027;
var RedFormat = 1028;
var RedIntegerFormat = 1029;
var RGFormat = 1030;
var RGIntegerFormat = 1031;
var RGBAIntegerFormat = 1033;
var NoColorSpace = "";
var SRGBColorSpace = "srgb";
var LinearSRGBColorSpace = "srgb-linear";
var LoopOnce = 2200;
var LoopRepeat = 2201;
var LoopPingPong = 2202;
var TangentSpaceNormalMap = 0;
var ObjectSpaceNormalMap = 1;
var ZeroStencilOp = 0;
var KeepStencilOp = 7680;
var ReplaceStencilOp = 7681;
var IncrementStencilOp = 7682;
var DecrementStencilOp = 7683;
var IncrementWrapStencilOp = 34055;
var DecrementWrapStencilOp = 34056;
var InvertStencilOp = 5386;
var NeverStencilFunc = 512;
var LessStencilFunc = 513;
var EqualStencilFunc = 514;
var LessEqualStencilFunc = 515;
var GreaterStencilFunc = 516;
var NotEqualStencilFunc = 517;
var GreaterEqualStencilFunc = 518;
var AlwaysStencilFunc = 519;
var StaticDrawUsage = 35044;
var DynamicDrawUsage = 35048;
var StreamDrawUsage = 35040;
var StaticReadUsage = 35045;
var DynamicReadUsage = 35049;
var StreamReadUsage = 35041;
var StaticCopyUsage = 35046;
var DynamicCopyUsage = 35050;
var StreamCopyUsage = 35042;
var GLSL1 = "100";
var GLSL3 = "300 es";
var WebGLCoordinateSystem = 2e3;
var WebGPUCoordinateSystem = 2001;

// src/math/MathUtils.js
var _lut = [];
for (let i = 0; i < 256; i++) _lut[i] = (i < 16 ? "0" : "") + i.toString(16);
var DEG2RAD = Math.PI / 180;
var RAD2DEG = 180 / Math.PI;
var _seed = 1234567;
function generateUUID() {
  const d0 = Math.random() * 4294967295 | 0;
  const d1 = Math.random() * 4294967295 | 0;
  const d2 = Math.random() * 4294967295 | 0;
  const d3 = Math.random() * 4294967295 | 0;
  const uuid = _lut[d0 & 255] + _lut[d0 >> 8 & 255] + _lut[d0 >> 16 & 255] + _lut[d0 >> 24 & 255] + "-" + _lut[d1 & 255] + _lut[d1 >> 8 & 255] + "-" + _lut[d1 >> 16 & 15 | 64] + _lut[d1 >> 24 & 255] + "-" + _lut[d2 & 63 | 128] + _lut[d2 >> 8 & 255] + "-" + _lut[d2 >> 16 & 255] + _lut[d2 >> 24 & 255] + _lut[d3 & 255] + _lut[d3 >> 8 & 255] + _lut[d3 >> 16 & 255] + _lut[d3 >> 24 & 255];
  return uuid.toLowerCase();
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function euclideanModulo(n, m) {
  return (n % m + m) % m;
}
function mapLinear(x, a1, a2, b1, b2) {
  return b1 + (x - a1) * (b2 - b1) / (a2 - a1);
}
function inverseLerp(x, y, value) {
  return x !== y ? (value - x) / (y - x) : 0;
}
function lerp(x, y, t) {
  return (1 - t) * x + t * y;
}
function damp(x, y, lambda, dt) {
  return lerp(x, y, 1 - Math.exp(-lambda * dt));
}
function pingpong(x, length = 1) {
  return length - Math.abs(euclideanModulo(x, length * 2) - length);
}
function smoothstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * (3 - 2 * x);
}
function smootherstep(x, min, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  x = (x - min) / (max - min);
  return x * x * x * (x * (x * 6 - 15) + 10);
}
function randInt(low, high) {
  return low + Math.floor(Math.random() * (high - low + 1));
}
function randFloat(low, high) {
  return low + Math.random() * (high - low);
}
function randFloatSpread(range) {
  return range * (0.5 - Math.random());
}
function seededRandom(s) {
  if (s !== void 0) _seed = s;
  let t = _seed += 1831565813;
  t = Math.imul(t ^ t >>> 15, t | 1);
  t ^= t + Math.imul(t ^ t >>> 7, t | 61);
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
}
function degToRad(degrees) {
  return degrees * DEG2RAD;
}
function radToDeg(radians) {
  return radians * RAD2DEG;
}
function isPowerOfTwo(value) {
  return (value & value - 1) === 0 && value !== 0;
}
function ceilPowerOfTwo(value) {
  return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}
function floorPowerOfTwo(value) {
  return Math.pow(2, Math.floor(Math.log(value) / Math.LN2));
}
function normalize(value, array) {
  switch (array.constructor) {
    case Float32Array:
      return value;
    case Uint32Array:
      return Math.round(value * 4294967295);
    case Uint16Array:
      return Math.round(value * 65535);
    case Uint8Array:
    case Uint8ClampedArray:
      return Math.round(value * 255);
    case Int32Array:
      return Math.round(value * 2147483647);
    case Int16Array:
      return Math.round(value * 32767);
    case Int8Array:
      return Math.round(value * 127);
    default:
      throw new Error("Invalid component type.");
  }
}
function denormalize(value, array) {
  switch (array.constructor) {
    case Float32Array:
      return value;
    case Uint32Array:
      return value / 4294967295;
    case Uint16Array:
      return value / 65535;
    case Uint8Array:
    case Uint8ClampedArray:
      return value / 255;
    case Int32Array:
      return Math.max(value / 2147483647, -1);
    case Int16Array:
      return Math.max(value / 32767, -1);
    case Int8Array:
      return Math.max(value / 127, -1);
    default:
      throw new Error("Invalid component type.");
  }
}
var MathUtils = {
  DEG2RAD,
  RAD2DEG,
  generateUUID,
  clamp,
  euclideanModulo,
  mapLinear,
  inverseLerp,
  lerp,
  damp,
  pingpong,
  smoothstep,
  smootherstep,
  randInt,
  randFloat,
  randFloatSpread,
  seededRandom,
  degToRad,
  radToDeg,
  isPowerOfTwo,
  ceilPowerOfTwo,
  floorPowerOfTwo,
  normalize,
  denormalize
};

// src/math/ColorManagement.js
function SRGBToLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function LinearToSRGB(c) {
  return c < 31308e-7 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
var ColorManagement = {
  enabled: true,
  workingColorSpace: LinearSRGBColorSpace,
  convert(color, sourceColorSpace, targetColorSpace) {
    if (this.enabled === false || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace) return color;
    if (sourceColorSpace === SRGBColorSpace && targetColorSpace === LinearSRGBColorSpace) {
      color.r = SRGBToLinear(color.r);
      color.g = SRGBToLinear(color.g);
      color.b = SRGBToLinear(color.b);
    } else if (sourceColorSpace === LinearSRGBColorSpace && targetColorSpace === SRGBColorSpace) {
      color.r = LinearToSRGB(color.r);
      color.g = LinearToSRGB(color.g);
      color.b = LinearToSRGB(color.b);
    }
    return color;
  },
  fromWorkingColorSpace(color, targetColorSpace) {
    return this.convert(color, this.workingColorSpace, targetColorSpace);
  },
  toWorkingColorSpace(color, sourceColorSpace) {
    return this.convert(color, sourceColorSpace, this.workingColorSpace);
  },
  getTransfer(colorSpace) {
    return colorSpace === NoColorSpace ? "linear" : colorSpace === SRGBColorSpace ? "srgb" : "linear";
  }
};

// src/math/Color.js
var _colorKeywords = {
  "aliceblue": 15792383,
  "antiquewhite": 16444375,
  "aqua": 65535,
  "aquamarine": 8388564,
  "azure": 15794175,
  "beige": 16119260,
  "bisque": 16770244,
  "black": 0,
  "blanchedalmond": 16772045,
  "blue": 255,
  "blueviolet": 9055202,
  "brown": 10824234,
  "burlywood": 14596231,
  "cadetblue": 6266528,
  "chartreuse": 8388352,
  "chocolate": 13789470,
  "coral": 16744272,
  "cornflowerblue": 6591981,
  "cornsilk": 16775388,
  "crimson": 14423100,
  "cyan": 65535,
  "darkblue": 139,
  "darkcyan": 35723,
  "darkgoldenrod": 12092939,
  "darkgray": 11119017,
  "darkgreen": 25600,
  "darkgrey": 11119017,
  "darkkhaki": 12433259,
  "darkmagenta": 9109643,
  "darkolivegreen": 5597999,
  "darkorange": 16747520,
  "darkorchid": 10040012,
  "darkred": 9109504,
  "darksalmon": 15308410,
  "darkseagreen": 9419919,
  "darkslateblue": 4734347,
  "darkslategray": 3100495,
  "darkslategrey": 3100495,
  "darkturquoise": 52945,
  "darkviolet": 9699539,
  "deeppink": 16716947,
  "deepskyblue": 49151,
  "dimgray": 6908265,
  "dimgrey": 6908265,
  "dodgerblue": 2003199,
  "firebrick": 11674146,
  "floralwhite": 16775920,
  "forestgreen": 2263842,
  "fuchsia": 16711935,
  "gainsboro": 14474460,
  "ghostwhite": 16316671,
  "gold": 16766720,
  "goldenrod": 14329120,
  "gray": 8421504,
  "green": 32768,
  "greenyellow": 11403055,
  "grey": 8421504,
  "honeydew": 15794160,
  "hotpink": 16738740,
  "indianred": 13458524,
  "indigo": 4915330,
  "ivory": 16777200,
  "khaki": 15787660,
  "lavender": 15132410,
  "lavenderblush": 16773365,
  "lawngreen": 8190976,
  "lemonchiffon": 16775885,
  "lightblue": 11393254,
  "lightcoral": 15761536,
  "lightcyan": 14745599,
  "lightgoldenrodyellow": 16448210,
  "lightgray": 13882323,
  "lightgreen": 9498256,
  "lightgrey": 13882323,
  "lightpink": 16758465,
  "lightsalmon": 16752762,
  "lightseagreen": 2142890,
  "lightskyblue": 8900346,
  "lightslategray": 7833753,
  "lightslategrey": 7833753,
  "lightsteelblue": 11584734,
  "lightyellow": 16777184,
  "lime": 65280,
  "limegreen": 3329330,
  "linen": 16445670,
  "magenta": 16711935,
  "maroon": 8388608,
  "mediumaquamarine": 6737322,
  "mediumblue": 205,
  "mediumorchid": 12211667,
  "mediumpurple": 9662683,
  "mediumseagreen": 3978097,
  "mediumslateblue": 8087790,
  "mediumspringgreen": 64154,
  "mediumturquoise": 4772300,
  "mediumvioletred": 13047173,
  "midnightblue": 1644912,
  "mintcream": 16121850,
  "mistyrose": 16770273,
  "moccasin": 16770229,
  "navajowhite": 16768685,
  "navy": 128,
  "oldlace": 16643558,
  "olive": 8421376,
  "olivedrab": 7048739,
  "orange": 16753920,
  "orangered": 16729344,
  "orchid": 14315734,
  "palegoldenrod": 15657130,
  "palegreen": 10025880,
  "paleturquoise": 11529966,
  "palevioletred": 14381203,
  "papayawhip": 16773077,
  "peachpuff": 16767673,
  "peru": 13468991,
  "pink": 16761035,
  "plum": 14524637,
  "powderblue": 11591910,
  "purple": 8388736,
  "rebeccapurple": 6697881,
  "red": 16711680,
  "rosybrown": 12357519,
  "royalblue": 4286945,
  "saddlebrown": 9127187,
  "salmon": 16416882,
  "sandybrown": 16032864,
  "seagreen": 3050327,
  "seashell": 16774638,
  "sienna": 10506797,
  "silver": 12632256,
  "skyblue": 8900331,
  "slateblue": 6970061,
  "slategray": 7372944,
  "slategrey": 7372944,
  "snow": 16775930,
  "springgreen": 65407,
  "steelblue": 4620980,
  "tan": 13808780,
  "teal": 32896,
  "thistle": 14204888,
  "tomato": 16737095,
  "turquoise": 4251856,
  "violet": 15631086,
  "wheat": 16113331,
  "white": 16777215,
  "whitesmoke": 16119285,
  "yellow": 16776960,
  "yellowgreen": 10145074
};
var _hslA = { h: 0, s: 0, l: 0 };
var _hslB = { h: 0, s: 0, l: 0 };
function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * 6 * (2 / 3 - t);
  return p;
}
var Color = class {
  constructor(r, g, b) {
    this.isColor = true;
    this.r = 1;
    this.g = 1;
    this.b = 1;
    return this.set(r, g, b);
  }
  set(r, g, b) {
    if (g === void 0 && b === void 0) {
      const value = r;
      if (value && value.isColor) this.copy(value);
      else if (typeof value === "number") this.setHex(value);
      else if (typeof value === "string") this.setStyle(value);
    } else {
      this.setRGB(r, g, b);
    }
    return this;
  }
  setScalar(s) {
    this.r = s;
    this.g = s;
    this.b = s;
    return this;
  }
  setHex(hex, colorSpace = SRGBColorSpace) {
    hex = Math.floor(hex);
    this.r = (hex >> 16 & 255) / 255;
    this.g = (hex >> 8 & 255) / 255;
    this.b = (hex & 255) / 255;
    ColorManagement.toWorkingColorSpace(this, colorSpace);
    return this;
  }
  setRGB(r, g, b, colorSpace = ColorManagement.workingColorSpace) {
    this.r = r;
    this.g = g;
    this.b = b;
    ColorManagement.toWorkingColorSpace(this, colorSpace);
    return this;
  }
  setHSL(h, s, l, colorSpace = ColorManagement.workingColorSpace) {
    h = euclideanModulo(h, 1);
    s = clamp(s, 0, 1);
    l = clamp(l, 0, 1);
    if (s === 0) {
      this.r = this.g = this.b = l;
    } else {
      const p = l <= 0.5 ? l * (1 + s) : l + s - l * s;
      const q = 2 * l - p;
      this.r = hue2rgb(q, p, h + 1 / 3);
      this.g = hue2rgb(q, p, h);
      this.b = hue2rgb(q, p, h - 1 / 3);
    }
    ColorManagement.toWorkingColorSpace(this, colorSpace);
    return this;
  }
  setStyle(style, colorSpace = SRGBColorSpace) {
    function handleAlpha(string) {
      if (string === void 0) return;
      if (parseFloat(string) < 1) console.warn("Color: Alpha component of " + style + " will be ignored.");
    }
    let m;
    if (m = /^(\w+)\(([^\)]*)\)/.exec(style)) {
      let color;
      const name = m[1], components = m[2];
      switch (name) {
        case "rgb":
        case "rgba":
          if (color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setRGB(Math.min(255, parseInt(color[1], 10)) / 255, Math.min(255, parseInt(color[2], 10)) / 255, Math.min(255, parseInt(color[3], 10)) / 255, colorSpace);
          }
          if (color = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setRGB(Math.min(100, parseInt(color[1], 10)) / 100, Math.min(100, parseInt(color[2], 10)) / 100, Math.min(100, parseInt(color[3], 10)) / 100, colorSpace);
          }
          break;
        case "hsl":
        case "hsla":
          if (color = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components)) {
            handleAlpha(color[4]);
            return this.setHSL(parseFloat(color[1]) / 360, parseFloat(color[2]) / 100, parseFloat(color[3]) / 100, colorSpace);
          }
          break;
        default:
          console.warn("Color: Unknown color model " + style);
      }
    } else if (m = /^\#([A-Fa-f\d]+)$/.exec(style)) {
      const hex = m[1], size = hex.length;
      if (size === 3) return this.setRGB(parseInt(hex.charAt(0), 16) / 15, parseInt(hex.charAt(1), 16) / 15, parseInt(hex.charAt(2), 16) / 15, colorSpace);
      if (size === 6) return this.setHex(parseInt(hex, 16), colorSpace);
      console.warn("Color: Invalid hex color " + style);
    } else if (style && style.length > 0) {
      return this.setColorName(style, colorSpace);
    }
    return this;
  }
  setColorName(style, colorSpace = SRGBColorSpace) {
    const hex = _colorKeywords[style.toLowerCase()];
    if (hex !== void 0) this.setHex(hex, colorSpace);
    else console.warn("Color: Unknown color " + style);
    return this;
  }
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  copy(c) {
    this.r = c.r;
    this.g = c.g;
    this.b = c.b;
    return this;
  }
  copySRGBToLinear(c) {
    this.r = SRGBToLinear(c.r);
    this.g = SRGBToLinear(c.g);
    this.b = SRGBToLinear(c.b);
    return this;
  }
  copyLinearToSRGB(c) {
    this.r = LinearToSRGB(c.r);
    this.g = LinearToSRGB(c.g);
    this.b = LinearToSRGB(c.b);
    return this;
  }
  convertSRGBToLinear() {
    return this.copySRGBToLinear(this);
  }
  convertLinearToSRGB() {
    return this.copyLinearToSRGB(this);
  }
  getHex(colorSpace = SRGBColorSpace) {
    ColorManagement.fromWorkingColorSpace(_color.copy(this), colorSpace);
    return Math.round(clamp(_color.r * 255, 0, 255)) * 65536 + Math.round(clamp(_color.g * 255, 0, 255)) * 256 + Math.round(clamp(_color.b * 255, 0, 255));
  }
  getHexString(colorSpace = SRGBColorSpace) {
    return ("000000" + this.getHex(colorSpace).toString(16)).slice(-6);
  }
  getHSL(target, colorSpace = ColorManagement.workingColorSpace) {
    ColorManagement.fromWorkingColorSpace(_color.copy(this), colorSpace);
    const r = _color.r, g = _color.g, b = _color.b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hue, saturation;
    const lightness = (min + max) / 2;
    if (min === max) {
      hue = 0;
      saturation = 0;
    } else {
      const delta = max - min;
      saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min);
      switch (max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    target.h = hue;
    target.s = saturation;
    target.l = lightness;
    return target;
  }
  getRGB(target, colorSpace = ColorManagement.workingColorSpace) {
    ColorManagement.fromWorkingColorSpace(_color.copy(this), colorSpace);
    target.r = _color.r;
    target.g = _color.g;
    target.b = _color.b;
    return target;
  }
  getStyle(colorSpace = SRGBColorSpace) {
    ColorManagement.fromWorkingColorSpace(_color.copy(this), colorSpace);
    const r = _color.r, g = _color.g, b = _color.b;
    if (colorSpace !== SRGBColorSpace) return `color(${colorSpace} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)})`;
    return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }
  offsetHSL(h, s, l) {
    this.getHSL(_hslA);
    return this.setHSL(_hslA.h + h, _hslA.s + s, _hslA.l + l);
  }
  add(c) {
    this.r += c.r;
    this.g += c.g;
    this.b += c.b;
    return this;
  }
  addColors(c1, c2) {
    this.r = c1.r + c2.r;
    this.g = c1.g + c2.g;
    this.b = c1.b + c2.b;
    return this;
  }
  addScalar(s) {
    this.r += s;
    this.g += s;
    this.b += s;
    return this;
  }
  sub(c) {
    this.r = Math.max(0, this.r - c.r);
    this.g = Math.max(0, this.g - c.g);
    this.b = Math.max(0, this.b - c.b);
    return this;
  }
  multiply(c) {
    this.r *= c.r;
    this.g *= c.g;
    this.b *= c.b;
    return this;
  }
  multiplyScalar(s) {
    this.r *= s;
    this.g *= s;
    this.b *= s;
    return this;
  }
  lerp(c, a) {
    this.r += (c.r - this.r) * a;
    this.g += (c.g - this.g) * a;
    this.b += (c.b - this.b) * a;
    return this;
  }
  lerpColors(c1, c2, a) {
    this.r = c1.r + (c2.r - c1.r) * a;
    this.g = c1.g + (c2.g - c1.g) * a;
    this.b = c1.b + (c2.b - c1.b) * a;
    return this;
  }
  lerpHSL(c, a) {
    this.getHSL(_hslA);
    c.getHSL(_hslB);
    return this.setHSL(lerp(_hslA.h, _hslB.h, a), lerp(_hslA.s, _hslB.s, a), lerp(_hslA.l, _hslB.l, a));
  }
  setFromVector3(v) {
    this.r = v.x;
    this.g = v.y;
    this.b = v.z;
    return this;
  }
  applyMatrix3(m) {
    const r = this.r, g = this.g, b = this.b, e = m.elements;
    this.r = e[0] * r + e[3] * g + e[6] * b;
    this.g = e[1] * r + e[4] * g + e[7] * b;
    this.b = e[2] * r + e[5] * g + e[8] * b;
    return this;
  }
  equals(c) {
    return c.r === this.r && c.g === this.g && c.b === this.b;
  }
  fromArray(array, offset = 0) {
    this.r = array[offset];
    this.g = array[offset + 1];
    this.b = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.r;
    array[offset + 1] = this.g;
    array[offset + 2] = this.b;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.r = attribute.getX(index);
    this.g = attribute.getY(index);
    this.b = attribute.getZ(index);
    return this;
  }
  toJSON() {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    yield this.r;
    yield this.g;
    yield this.b;
  }
};
var _color = /* @__PURE__ */ new Color();
Color.NAMES = _colorKeywords;

// src/math/Quaternion.js
var Quaternion = class {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.isQuaternion = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
  }
  static slerpFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t) {
    let x0 = src0[srcOffset0 + 0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1 + 0], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    if (t === 0) {
      dst[dstOffset] = x0;
      dst[dstOffset + 1] = y0;
      dst[dstOffset + 2] = z0;
      dst[dstOffset + 3] = w0;
      return;
    }
    if (t === 1) {
      dst[dstOffset] = x1;
      dst[dstOffset + 1] = y1;
      dst[dstOffset + 2] = z1;
      dst[dstOffset + 3] = w1;
      return;
    }
    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let s = 1 - t;
      const cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1, dir = cos >= 0 ? 1 : -1, sqrSin = 1 - cos * cos;
      if (sqrSin > Number.EPSILON) {
        const sin = Math.sqrt(sqrSin), len = Math.atan2(sin, cos * dir);
        s = Math.sin(s * len) / sin;
        t = Math.sin(t * len) / sin;
      }
      const tDir = t * dir;
      x0 = x0 * s + x1 * tDir;
      y0 = y0 * s + y1 * tDir;
      z0 = z0 * s + z1 * tDir;
      w0 = w0 * s + w1 * tDir;
      if (s === 1 - t) {
        const f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
        x0 *= f;
        y0 *= f;
        z0 *= f;
        w0 *= f;
      }
    }
    dst[dstOffset] = x0;
    dst[dstOffset + 1] = y0;
    dst[dstOffset + 2] = z0;
    dst[dstOffset + 3] = w0;
  }
  static multiplyQuaternionsFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1) {
    const x0 = src0[srcOffset0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3];
    const x1 = src1[srcOffset1], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1;
    dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1;
    dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1;
    dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1;
    return dst;
  }
  get x() {
    return this._x;
  }
  set x(v) {
    this._x = v;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(v) {
    this._y = v;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(v) {
    this._z = v;
    this._onChangeCallback();
  }
  get w() {
    return this._w;
  }
  set w(v) {
    this._w = v;
    this._onChangeCallback();
  }
  set(x, y, z, w) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._w = w;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  copy(q) {
    this._x = q.x;
    this._y = q.y;
    this._z = q.z;
    this._w = q.w;
    this._onChangeCallback();
    return this;
  }
  setFromEuler(euler, update = true) {
    const x = euler._x, y = euler._y, z = euler._z, order = euler._order;
    const cos = Math.cos, sin = Math.sin;
    const c1 = cos(x / 2), c2 = cos(y / 2), c3 = cos(z / 2);
    const s1 = sin(x / 2), s2 = sin(y / 2), s3 = sin(z / 2);
    switch (order) {
      case "XYZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this._x = s1 * c2 * c3 + c1 * s2 * s3;
        this._y = c1 * s2 * c3 + s1 * c2 * s3;
        this._z = c1 * c2 * s3 - s1 * s2 * c3;
        this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3;
        this._y = c1 * s2 * c3 - s1 * c2 * s3;
        this._z = c1 * c2 * s3 + s1 * s2 * c3;
        this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        console.warn("Quaternion: .setFromEuler() encountered an unknown order: " + order);
    }
    if (update === true) this._onChangeCallback();
    return this;
  }
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2, s = Math.sin(halfAngle);
    this._x = axis.x * s;
    this._y = axis.y * s;
    this._z = axis.z * s;
    this._w = Math.cos(halfAngle);
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m) {
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10];
    const trace = m11 + m22 + m33;
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1);
      this._w = 0.25 / s;
      this._x = (m32 - m23) * s;
      this._y = (m13 - m31) * s;
      this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this._w = (m32 - m23) / s;
      this._x = 0.25 * s;
      this._y = (m12 + m21) / s;
      this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this._w = (m13 - m31) / s;
      this._x = (m12 + m21) / s;
      this._y = 0.25 * s;
      this._z = (m23 + m32) / s;
    } else {
      const s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this._w = (m21 - m12) / s;
      this._x = (m13 + m31) / s;
      this._y = (m23 + m32) / s;
      this._z = 0.25 * s;
    }
    this._onChangeCallback();
    return this;
  }
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.dot(vTo) + 1;
    if (r < 1e-8) {
      r = 0;
      if (Math.abs(vFrom.x) > Math.abs(vFrom.z)) {
        this._x = -vFrom.y;
        this._y = vFrom.x;
        this._z = 0;
        this._w = r;
      } else {
        this._x = 0;
        this._y = -vFrom.z;
        this._z = vFrom.y;
        this._w = r;
      }
    } else {
      this._x = vFrom.y * vTo.z - vFrom.z * vTo.y;
      this._y = vFrom.z * vTo.x - vFrom.x * vTo.z;
      this._z = vFrom.x * vTo.y - vFrom.y * vTo.x;
      this._w = r;
    }
    return this.normalize();
  }
  angleTo(q) {
    return 2 * Math.acos(Math.abs(clamp(this.dot(q), -1, 1)));
  }
  rotateTowards(q, step) {
    const angle = this.angleTo(q);
    if (angle === 0) return this;
    const t = Math.min(1, step / angle);
    this.slerp(q, t);
    return this;
  }
  identity() {
    return this.set(0, 0, 0, 1);
  }
  invert() {
    return this.conjugate();
  }
  conjugate() {
    this._x *= -1;
    this._y *= -1;
    this._z *= -1;
    this._onChangeCallback();
    return this;
  }
  dot(v) {
    return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
  }
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  normalize() {
    let l = this.length();
    if (l === 0) {
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 1;
    } else {
      l = 1 / l;
      this._x *= l;
      this._y *= l;
      this._z *= l;
      this._w *= l;
    }
    this._onChangeCallback();
    return this;
  }
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  multiplyQuaternions(a, b) {
    const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    this._onChangeCallback();
    return this;
  }
  slerp(qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);
    const x = this._x, y = this._y, z = this._z, w = this._w;
    let cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;
    if (cosHalfTheta < 0) {
      this._w = -qb._w;
      this._x = -qb._x;
      this._y = -qb._y;
      this._z = -qb._z;
      cosHalfTheta = -cosHalfTheta;
    } else {
      this.copy(qb);
    }
    if (cosHalfTheta >= 1) {
      this._w = w;
      this._x = x;
      this._y = y;
      this._z = z;
      return this;
    }
    const sqrSinHalfTheta = 1 - cosHalfTheta * cosHalfTheta;
    if (sqrSinHalfTheta <= Number.EPSILON) {
      const s = 1 - t;
      this._w = s * w + t * this._w;
      this._x = s * x + t * this._x;
      this._y = s * y + t * this._y;
      this._z = s * z + t * this._z;
      this.normalize();
      return this;
    }
    const sinHalfTheta = Math.sqrt(sqrSinHalfTheta);
    const halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta);
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta, ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    this._w = w * ratioA + this._w * ratioB;
    this._x = x * ratioA + this._x * ratioB;
    this._y = y * ratioA + this._y * ratioB;
    this._z = z * ratioA + this._z * ratioB;
    this._onChangeCallback();
    return this;
  }
  slerpQuaternions(qa, qb, t) {
    return this.copy(qa).slerp(qb, t);
  }
  random() {
    const theta1 = 2 * Math.PI * Math.random(), theta2 = 2 * Math.PI * Math.random();
    const x0 = Math.random(), r1 = Math.sqrt(1 - x0), r2 = Math.sqrt(x0);
    return this.set(r1 * Math.sin(theta1), r1 * Math.cos(theta1), r2 * Math.sin(theta2), r2 * Math.cos(theta2));
  }
  equals(q) {
    return q._x === this._x && q._y === this._y && q._z === this._z && q._w === this._w;
  }
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._w = array[offset + 3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._w;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this._x = attribute.getX(index);
    this._y = attribute.getY(index);
    this._z = attribute.getZ(index);
    this._w = attribute.getW(index);
    this._onChangeCallback();
    return this;
  }
  toJSON() {
    return this.toArray();
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._w;
  }
};

// src/math/Vector3.js
var Vector3 = class {
  constructor(x = 0, y = 0, z = 0) {
    this.isVector3 = true;
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x, y, z) {
    if (z === void 0) z = this.z;
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  setScalar(s) {
    this.x = s;
    this.y = s;
    this.z = s;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setComponent(i, v) {
    switch (i) {
      case 0:
        this.x = v;
        break;
      case 1:
        this.y = v;
        break;
      case 2:
        this.z = v;
        break;
      default:
        throw new Error("index is out of range: " + i);
    }
    return this;
  }
  getComponent(i) {
    switch (i) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("index is out of range: " + i);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  multiplyVectors(a, b) {
    this.x = a.x * b.x;
    this.y = a.y * b.y;
    this.z = a.z * b.z;
    return this;
  }
  applyEuler(euler) {
    return this.applyQuaternion(_quaternion.setFromEuler(euler));
  }
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(_quaternion.setFromAxisAngle(axis, angle));
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6] * z;
    this.y = e[1] * x + e[4] * y + e[7] * z;
    this.z = e[2] * x + e[5] * y + e[8] * z;
    return this;
  }
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyQuaternion(q) {
    const vx = this.x, vy = this.y, vz = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * vz - qz * vy);
    const ty = 2 * (qz * vx - qx * vz);
    const tz = 2 * (qx * vy - qy * vx);
    this.x = vx + qw * tx + qy * tz - qz * ty;
    this.y = vy + qw * ty + qz * tx - qx * tz;
    this.z = vz + qw * tz + qx * ty - qy * tx;
    return this;
  }
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  transformDirection(m) {
    const x = this.x, y = this.y, z = this.z, e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z;
    this.y = e[1] * x + e[5] * y + e[9] * z;
    this.z = e[2] * x + e[6] * y + e[10] * z;
    return this.normalize();
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(1 / s);
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const l = this.length();
    return this.divideScalar(l || 1).multiplyScalar(clamp(l, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(l) {
    return this.normalize().multiplyScalar(l);
  }
  lerp(v, a) {
    this.x += (v.x - this.x) * a;
    this.y += (v.y - this.y) * a;
    this.z += (v.z - this.z) * a;
    return this;
  }
  lerpVectors(v1, v2, a) {
    this.x = v1.x + (v2.x - v1.x) * a;
    this.y = v1.y + (v2.y - v1.y) * a;
    this.z = v1.z + (v2.z - v1.z) * a;
    return this;
  }
  cross(v) {
    return this.crossVectors(this, v);
  }
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z;
    this.x = ay * bz - az * by;
    this.y = az * bx - ax * bz;
    this.z = ax * by - ay * bx;
    return this;
  }
  projectOnVector(v) {
    const d = v.lengthSq();
    if (d === 0) return this.set(0, 0, 0);
    const s = v.dot(this) / d;
    return this.copy(v).multiplyScalar(s);
  }
  projectOnPlane(planeNormal) {
    _vector.copy(this).projectOnVector(planeNormal);
    return this.sub(_vector);
  }
  reflect(normal) {
    return this.sub(_vector.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  angleTo(v) {
    const d = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (d === 0) return Math.PI / 2;
    return Math.acos(clamp(this.dot(v) / d, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  setFromSpherical(s) {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  setFromSphericalCoords(radius, phi, theta) {
    const sinPhiRadius = Math.sin(phi) * radius;
    this.x = sinPhiRadius * Math.sin(theta);
    this.y = Math.cos(phi) * radius;
    this.z = sinPhiRadius * Math.cos(theta);
    return this;
  }
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  setFromCylindricalCoords(radius, theta, y) {
    this.x = radius * Math.sin(theta);
    this.y = y;
    this.z = radius * Math.cos(theta);
    return this;
  }
  setFromMatrixPosition(m) {
    const e = m.elements;
    this.x = e[12];
    this.y = e[13];
    this.z = e[14];
    return this;
  }
  setFromMatrixScale(m) {
    const sx = this.setFromMatrixColumn(m, 0).length();
    const sy = this.setFromMatrixColumn(m, 1).length();
    const sz = this.setFromMatrixColumn(m, 2).length();
    this.x = sx;
    this.y = sy;
    this.z = sz;
    return this;
  }
  setFromMatrixColumn(m, index) {
    return this.fromArray(m.elements, index * 4);
  }
  setFromMatrix3Column(m, index) {
    return this.fromArray(m.elements, index * 3);
  }
  setFromEuler(e) {
    this.x = e._x;
    this.y = e._y;
    this.z = e._z;
    return this;
  }
  setFromColor(c) {
    this.x = c.r;
    this.y = c.g;
    this.z = c.b;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    return this;
  }
  randomDirection() {
    const theta = Math.random() * Math.PI * 2;
    const u = Math.random() * 2 - 1;
    const c = Math.sqrt(1 - u * u);
    this.x = c * Math.cos(theta);
    this.y = u;
    this.z = c * Math.sin(theta);
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
  }
};
var _vector = /* @__PURE__ */ new Vector3();
var _quaternion = /* @__PURE__ */ new Quaternion();

// src/math/Box3.js
var Box3 = class {
  constructor(min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity)) {
    this.isBox3 = true;
    this.min = min;
    this.max = max;
  }
  set(min, max) {
    this.min.copy(min);
    this.max.copy(max);
    return this;
  }
  setFromArray(array) {
    this.makeEmpty();
    for (let i = 0, il = array.length; i < il; i += 3) this.expandByPoint(_vector2.fromArray(array, i));
    return this;
  }
  setFromBufferAttribute(attribute) {
    this.makeEmpty();
    for (let i = 0, il = attribute.count; i < il; i++) this.expandByPoint(_vector2.fromBufferAttribute(attribute, i));
    return this;
  }
  setFromPoints(points) {
    this.makeEmpty();
    for (let i = 0, il = points.length; i < il; i++) this.expandByPoint(points[i]);
    return this;
  }
  setFromCenterAndSize(center, size) {
    const halfSize = _vector2.copy(size).multiplyScalar(0.5);
    this.min.copy(center).sub(halfSize);
    this.max.copy(center).add(halfSize);
    return this;
  }
  setFromObject(object, precise = false) {
    this.makeEmpty();
    return this.expandByObject(object, precise);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(box) {
    this.min.copy(box.min);
    this.max.copy(box.max);
    return this;
  }
  makeEmpty() {
    this.min.x = this.min.y = this.min.z = Infinity;
    this.max.x = this.max.y = this.max.z = -Infinity;
    return this;
  }
  isEmpty() {
    return this.max.x < this.min.x || this.max.y < this.min.y || this.max.z < this.min.z;
  }
  getCenter(target) {
    return this.isEmpty() ? target.set(0, 0, 0) : target.addVectors(this.min, this.max).multiplyScalar(0.5);
  }
  getSize(target) {
    return this.isEmpty() ? target.set(0, 0, 0) : target.subVectors(this.max, this.min);
  }
  expandByPoint(point) {
    this.min.min(point);
    this.max.max(point);
    return this;
  }
  expandByVector(vector) {
    this.min.sub(vector);
    this.max.add(vector);
    return this;
  }
  expandByScalar(scalar) {
    this.min.addScalar(-scalar);
    this.max.addScalar(scalar);
    return this;
  }
  expandByObject(object, precise = false) {
    object.updateWorldMatrix(false, false);
    const geometry = object.geometry;
    if (geometry !== void 0) {
      const positionAttribute = geometry.getAttribute("position");
      if (precise === true && positionAttribute !== void 0 && object.isInstancedMesh !== true) {
        for (let i = 0, l = positionAttribute.count; i < l; i++) {
          if (object.isMesh === true) object.getVertexPosition(i, _vector2);
          else _vector2.fromBufferAttribute(positionAttribute, i);
          _vector2.applyMatrix4(object.matrixWorld);
          this.expandByPoint(_vector2);
        }
      } else {
        if (object.boundingBox !== void 0) {
          if (object.boundingBox === null) object.computeBoundingBox();
          _box.copy(object.boundingBox);
        } else {
          if (geometry.boundingBox === null) geometry.computeBoundingBox();
          _box.copy(geometry.boundingBox);
        }
        _box.applyMatrix4(object.matrixWorld);
        this.union(_box);
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) this.expandByObject(children[i], precise);
    return this;
  }
  containsPoint(p) {
    return p.x >= this.min.x && p.x <= this.max.x && p.y >= this.min.y && p.y <= this.max.y && p.z >= this.min.z && p.z <= this.max.z;
  }
  containsBox(box) {
    return this.min.x <= box.min.x && box.max.x <= this.max.x && this.min.y <= box.min.y && box.max.y <= this.max.y && this.min.z <= box.min.z && box.max.z <= this.max.z;
  }
  getParameter(point, target) {
    return target.set((point.x - this.min.x) / (this.max.x - this.min.x), (point.y - this.min.y) / (this.max.y - this.min.y), (point.z - this.min.z) / (this.max.z - this.min.z));
  }
  intersectsBox(box) {
    return box.max.x >= this.min.x && box.min.x <= this.max.x && box.max.y >= this.min.y && box.min.y <= this.max.y && box.max.z >= this.min.z && box.min.z <= this.max.z;
  }
  intersectsSphere(sphere) {
    this.clampPoint(sphere.center, _vector2);
    return _vector2.distanceToSquared(sphere.center) <= sphere.radius * sphere.radius;
  }
  intersectsPlane(plane) {
    let min, max;
    if (plane.normal.x > 0) {
      min = plane.normal.x * this.min.x;
      max = plane.normal.x * this.max.x;
    } else {
      min = plane.normal.x * this.max.x;
      max = plane.normal.x * this.min.x;
    }
    if (plane.normal.y > 0) {
      min += plane.normal.y * this.min.y;
      max += plane.normal.y * this.max.y;
    } else {
      min += plane.normal.y * this.max.y;
      max += plane.normal.y * this.min.y;
    }
    if (plane.normal.z > 0) {
      min += plane.normal.z * this.min.z;
      max += plane.normal.z * this.max.z;
    } else {
      min += plane.normal.z * this.max.z;
      max += plane.normal.z * this.min.z;
    }
    return min <= -plane.constant && max >= -plane.constant;
  }
  intersectsTriangle(triangle) {
    if (this.isEmpty()) return false;
    this.getCenter(_center);
    _extents.subVectors(this.max, _center);
    _v0.subVectors(triangle.a, _center);
    _v1.subVectors(triangle.b, _center);
    _v2.subVectors(triangle.c, _center);
    _f0.subVectors(_v1, _v0);
    _f1.subVectors(_v2, _v1);
    _f2.subVectors(_v0, _v2);
    let axes = [
      0,
      -_f0.z,
      _f0.y,
      0,
      -_f1.z,
      _f1.y,
      0,
      -_f2.z,
      _f2.y,
      _f0.z,
      0,
      -_f0.x,
      _f1.z,
      0,
      -_f1.x,
      _f2.z,
      0,
      -_f2.x,
      -_f0.y,
      _f0.x,
      0,
      -_f1.y,
      _f1.x,
      0,
      -_f2.y,
      _f2.x,
      0
    ];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) return false;
    axes = [1, 0, 0, 0, 1, 0, 0, 0, 1];
    if (!satForAxes(axes, _v0, _v1, _v2, _extents)) return false;
    _triangleNormal.crossVectors(_f0, _f1);
    axes = [_triangleNormal.x, _triangleNormal.y, _triangleNormal.z];
    return satForAxes(axes, _v0, _v1, _v2, _extents);
  }
  clampPoint(point, target) {
    return target.copy(point).clamp(this.min, this.max);
  }
  distanceToPoint(point) {
    return this.clampPoint(point, _vector2).distanceTo(point);
  }
  getBoundingSphere(target) {
    if (this.isEmpty()) target.makeEmpty();
    else {
      this.getCenter(target.center);
      target.radius = this.getSize(_vector2).length() * 0.5;
    }
    return target;
  }
  intersect(box) {
    this.min.max(box.min);
    this.max.min(box.max);
    if (this.isEmpty()) this.makeEmpty();
    return this;
  }
  union(box) {
    this.min.min(box.min);
    this.max.max(box.max);
    return this;
  }
  applyMatrix4(matrix) {
    if (this.isEmpty()) return this;
    _points[0].set(this.min.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[1].set(this.min.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[2].set(this.min.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[3].set(this.min.x, this.max.y, this.max.z).applyMatrix4(matrix);
    _points[4].set(this.max.x, this.min.y, this.min.z).applyMatrix4(matrix);
    _points[5].set(this.max.x, this.min.y, this.max.z).applyMatrix4(matrix);
    _points[6].set(this.max.x, this.max.y, this.min.z).applyMatrix4(matrix);
    _points[7].set(this.max.x, this.max.y, this.max.z).applyMatrix4(matrix);
    this.setFromPoints(_points);
    return this;
  }
  translate(offset) {
    this.min.add(offset);
    this.max.add(offset);
    return this;
  }
  equals(box) {
    return box.min.equals(this.min) && box.max.equals(this.max);
  }
};
var _points = [new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3(), new Vector3()];
var _vector2 = /* @__PURE__ */ new Vector3();
var _box = /* @__PURE__ */ new Box3();
var _v0 = new Vector3();
var _v1 = new Vector3();
var _v2 = new Vector3();
var _f0 = new Vector3();
var _f1 = new Vector3();
var _f2 = new Vector3();
var _center = new Vector3();
var _extents = new Vector3();
var _triangleNormal = new Vector3();
var _testAxis = new Vector3();
function satForAxes(axes, v0, v1, v2, extents) {
  for (let i = 0, j = axes.length - 3; i <= j; i += 3) {
    _testAxis.fromArray(axes, i);
    const r = extents.x * Math.abs(_testAxis.x) + extents.y * Math.abs(_testAxis.y) + extents.z * Math.abs(_testAxis.z);
    const p0 = v0.dot(_testAxis), p1 = v1.dot(_testAxis), p2 = v2.dot(_testAxis);
    if (Math.max(-Math.max(p0, p1, p2), Math.min(p0, p1, p2)) > r) return false;
  }
  return true;
}

// src/math/Sphere.js
var _box2 = /* @__PURE__ */ new Box3();
var _v12 = /* @__PURE__ */ new Vector3();
var _v22 = /* @__PURE__ */ new Vector3();
var Sphere = class {
  constructor(center = new Vector3(), radius = -1) {
    this.isSphere = true;
    this.center = center;
    this.radius = radius;
  }
  set(center, radius) {
    this.center.copy(center);
    this.radius = radius;
    return this;
  }
  setFromPoints(points, optionalCenter) {
    const center = this.center;
    if (optionalCenter !== void 0) center.copy(optionalCenter);
    else _box2.setFromPoints(points).getCenter(center);
    let maxRadiusSq = 0;
    for (let i = 0, il = points.length; i < il; i++) maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(points[i]));
    this.radius = Math.sqrt(maxRadiusSq);
    return this;
  }
  copy(sphere) {
    this.center.copy(sphere.center);
    this.radius = sphere.radius;
    return this;
  }
  isEmpty() {
    return this.radius < 0;
  }
  makeEmpty() {
    this.center.set(0, 0, 0);
    this.radius = -1;
    return this;
  }
  containsPoint(point) {
    return point.distanceToSquared(this.center) <= this.radius * this.radius;
  }
  distanceToPoint(point) {
    return point.distanceTo(this.center) - this.radius;
  }
  intersectsSphere(sphere) {
    const radiusSum = this.radius + sphere.radius;
    return sphere.center.distanceToSquared(this.center) <= radiusSum * radiusSum;
  }
  intersectsBox(box) {
    return box.intersectsSphere(this);
  }
  intersectsPlane(plane) {
    return Math.abs(plane.distanceToPoint(this.center)) <= this.radius;
  }
  clampPoint(point, target) {
    const deltaLengthSq = this.center.distanceToSquared(point);
    target.copy(point);
    if (deltaLengthSq > this.radius * this.radius) {
      target.sub(this.center).normalize();
      target.multiplyScalar(this.radius).add(this.center);
    }
    return target;
  }
  getBoundingBox(target) {
    if (this.isEmpty()) {
      target.makeEmpty();
      return target;
    }
    target.set(this.center, this.center);
    target.expandByScalar(this.radius);
    return target;
  }
  applyMatrix4(matrix) {
    this.center.applyMatrix4(matrix);
    this.radius = this.radius * matrix.getMaxScaleOnAxis();
    return this;
  }
  translate(offset) {
    this.center.add(offset);
    return this;
  }
  expandByPoint(point) {
    if (this.isEmpty()) {
      this.center.copy(point);
      this.radius = 0;
      return this;
    }
    _v12.subVectors(point, this.center);
    const lengthSq = _v12.lengthSq();
    if (lengthSq > this.radius * this.radius) {
      const length = Math.sqrt(lengthSq);
      const delta = (length - this.radius) * 0.5;
      this.center.addScaledVector(_v12, delta / length);
      this.radius += delta;
    }
    return this;
  }
  union(sphere) {
    if (sphere.isEmpty()) return this;
    if (this.isEmpty()) {
      this.copy(sphere);
      return this;
    }
    if (this.center.equals(sphere.center) === true) {
      this.radius = Math.max(this.radius, sphere.radius);
    } else {
      _v22.subVectors(sphere.center, this.center).setLength(sphere.radius);
      this.expandByPoint(_v12.copy(sphere.center).add(_v22));
      this.expandByPoint(_v12.copy(sphere.center).sub(_v22));
    }
    return this;
  }
  equals(sphere) {
    return sphere.center.equals(this.center) && sphere.radius === this.radius;
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/math/Matrix3.js
var Matrix3 = class {
  constructor(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    this.isMatrix3 = true;
    this.elements = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    if (n11 !== void 0) this.set(n11, n12, n13, n21, n22, n23, n31, n32, n33);
  }
  set(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    const te = this.elements;
    te[0] = n11;
    te[1] = n21;
    te[2] = n31;
    te[3] = n12;
    te[4] = n22;
    te[5] = n32;
    te[6] = n13;
    te[7] = n23;
    te[8] = n33;
    return this;
  }
  identity() {
    return this.set(1, 0, 0, 0, 1, 0, 0, 0, 1);
  }
  copy(m) {
    const te = this.elements, me = m.elements;
    for (let i = 0; i < 9; i++) te[i] = me[i];
    return this;
  }
  extractBasis(xAxis, yAxis, zAxis) {
    xAxis.setFromMatrix3Column(this, 0);
    yAxis.setFromMatrix3Column(this, 1);
    zAxis.setFromMatrix3Column(this, 2);
    return this;
  }
  setFromMatrix4(m) {
    const me = m.elements;
    return this.set(me[0], me[4], me[8], me[1], me[5], me[9], me[2], me[6], me[10]);
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements, be = b.elements, te = this.elements;
    const a11 = ae[0], a12 = ae[3], a13 = ae[6], a21 = ae[1], a22 = ae[4], a23 = ae[7], a31 = ae[2], a32 = ae[5], a33 = ae[8];
    const b11 = be[0], b12 = be[3], b13 = be[6], b21 = be[1], b22 = be[4], b23 = be[7], b31 = be[2], b32 = be[5], b33 = be[8];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31;
    te[3] = a11 * b12 + a12 * b22 + a13 * b32;
    te[6] = a11 * b13 + a12 * b23 + a13 * b33;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31;
    te[4] = a21 * b12 + a22 * b22 + a23 * b32;
    te[7] = a21 * b13 + a22 * b23 + a23 * b33;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31;
    te[5] = a31 * b12 + a32 * b22 + a33 * b32;
    te[8] = a31 * b13 + a32 * b23 + a33 * b33;
    return this;
  }
  multiplyScalar(s) {
    const te = this.elements;
    for (let i = 0; i < 9; i++) te[i] *= s;
    return this;
  }
  determinant() {
    const te = this.elements;
    const a = te[0], b = te[1], c = te[2], d = te[3], e = te[4], f = te[5], g = te[6], h = te[7], i = te[8];
    return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n12 = te[3], n22 = te[4], n32 = te[5], n13 = te[6], n23 = te[7], n33 = te[8];
    const t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13;
    const det = n11 * t11 + n21 * t12 + n31 * t13;
    if (det === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n31 * n23 - n33 * n21) * detInv;
    te[2] = (n32 * n21 - n31 * n22) * detInv;
    te[3] = t12 * detInv;
    te[4] = (n33 * n11 - n31 * n13) * detInv;
    te[5] = (n31 * n12 - n32 * n11) * detInv;
    te[6] = t13 * detInv;
    te[7] = (n21 * n13 - n23 * n11) * detInv;
    te[8] = (n22 * n11 - n21 * n12) * detInv;
    return this;
  }
  transpose() {
    let tmp3;
    const m = this.elements;
    tmp3 = m[1];
    m[1] = m[3];
    m[3] = tmp3;
    tmp3 = m[2];
    m[2] = m[6];
    m[6] = tmp3;
    tmp3 = m[5];
    m[5] = m[7];
    m[7] = tmp3;
    return this;
  }
  getNormalMatrix(matrix4) {
    return this.setFromMatrix4(matrix4).invert().transpose();
  }
  transposeIntoArray(r) {
    const m = this.elements;
    r[0] = m[0];
    r[1] = m[3];
    r[2] = m[6];
    r[3] = m[1];
    r[4] = m[4];
    r[5] = m[7];
    r[6] = m[2];
    r[7] = m[5];
    r[8] = m[8];
    return this;
  }
  setUvTransform(tx, ty, sx, sy, rotation, cx, cy) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    return this.set(
      sx * c,
      sx * s,
      -sx * (c * cx + s * cy) + cx + tx,
      -sy * s,
      sy * c,
      -sy * (-s * cx + c * cy) + cy + ty,
      0,
      0,
      1
    );
  }
  scale(sx, sy) {
    return this.premultiply(_m3.makeScale(sx, sy));
  }
  rotate(theta) {
    return this.premultiply(_m3.makeRotation(-theta));
  }
  translate(tx, ty) {
    return this.premultiply(_m3.makeTranslation(tx, ty));
  }
  makeTranslation(x, y) {
    if (x.isVector2) return this.set(1, 0, x.x, 0, 1, x.y, 0, 0, 1);
    return this.set(1, 0, x, 0, 1, y, 0, 0, 1);
  }
  makeRotation(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(c, -s, 0, s, c, 0, 0, 0, 1);
  }
  makeScale(x, y) {
    return this.set(x, 0, 0, 0, y, 0, 0, 0, 1);
  }
  equals(m) {
    const te = this.elements, me = m.elements;
    for (let i = 0; i < 9; i++) if (te[i] !== me[i]) return false;
    return true;
  }
  fromArray(array, offset = 0) {
    for (let i = 0; i < 9; i++) this.elements[i] = array[i + offset];
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    for (let i = 0; i < 9; i++) array[offset + i] = te[i];
    return array;
  }
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
};
var _m3 = /* @__PURE__ */ new Matrix3();

// src/math/Plane.js
var _vector1 = /* @__PURE__ */ new Vector3();
var _vector22 = /* @__PURE__ */ new Vector3();
var _normalMatrix = /* @__PURE__ */ new Matrix3();
var Plane = class {
  constructor(normal = new Vector3(1, 0, 0), constant = 0) {
    this.isPlane = true;
    this.normal = normal;
    this.constant = constant;
  }
  set(normal, constant) {
    this.normal.copy(normal);
    this.constant = constant;
    return this;
  }
  setComponents(x, y, z, w) {
    this.normal.set(x, y, z);
    this.constant = w;
    return this;
  }
  setFromNormalAndCoplanarPoint(normal, point) {
    this.normal.copy(normal);
    this.constant = -point.dot(this.normal);
    return this;
  }
  setFromCoplanarPoints(a, b, c) {
    const normal = _vector1.subVectors(c, b).cross(_vector22.subVectors(a, b)).normalize();
    this.setFromNormalAndCoplanarPoint(normal, a);
    return this;
  }
  copy(plane) {
    this.normal.copy(plane.normal);
    this.constant = plane.constant;
    return this;
  }
  normalize() {
    const inverseNormalLength = 1 / this.normal.length();
    this.normal.multiplyScalar(inverseNormalLength);
    this.constant *= inverseNormalLength;
    return this;
  }
  negate() {
    this.constant *= -1;
    this.normal.negate();
    return this;
  }
  distanceToPoint(point) {
    return this.normal.dot(point) + this.constant;
  }
  distanceToSphere(sphere) {
    return this.distanceToPoint(sphere.center) - sphere.radius;
  }
  projectPoint(point, target) {
    return target.copy(point).addScaledVector(this.normal, -this.distanceToPoint(point));
  }
  intersectLine(line, target) {
    const direction = line.delta(_vector1);
    const denominator = this.normal.dot(direction);
    if (denominator === 0) {
      if (this.distanceToPoint(line.start) === 0) return target.copy(line.start);
      return null;
    }
    const t = -(line.start.dot(this.normal) + this.constant) / denominator;
    if (t < 0 || t > 1) return null;
    return target.copy(line.start).addScaledVector(direction, t);
  }
  intersectsLine(line) {
    const startSign = this.distanceToPoint(line.start), endSign = this.distanceToPoint(line.end);
    return startSign < 0 && endSign > 0 || endSign < 0 && startSign > 0;
  }
  intersectsBox(box) {
    return box.intersectsPlane(this);
  }
  intersectsSphere(sphere) {
    return sphere.intersectsPlane(this);
  }
  coplanarPoint(target) {
    return target.copy(this.normal).multiplyScalar(-this.constant);
  }
  applyMatrix4(matrix, optionalNormalMatrix) {
    const normalMatrix = optionalNormalMatrix || _normalMatrix.getNormalMatrix(matrix);
    const referencePoint = this.coplanarPoint(_vector1).applyMatrix4(matrix);
    const normal = this.normal.applyMatrix3(normalMatrix).normalize();
    this.constant = -referencePoint.dot(normal);
    return this;
  }
  translate(offset) {
    this.constant -= offset.dot(this.normal);
    return this;
  }
  equals(plane) {
    return plane.normal.equals(this.normal) && plane.constant === this.constant;
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/math/Frustum.js
var _sphere = /* @__PURE__ */ new Sphere();
var _vector3 = /* @__PURE__ */ new Vector3();
var Frustum = class {
  constructor(p0 = new Plane(), p1 = new Plane(), p2 = new Plane(), p3 = new Plane(), p4 = new Plane(), p5 = new Plane()) {
    this.planes = [p0, p1, p2, p3, p4, p5];
    this.flat = new Float32Array(24);
  }
  set(p0, p1, p2, p3, p4, p5) {
    const planes = this.planes;
    planes[0].copy(p0);
    planes[1].copy(p1);
    planes[2].copy(p2);
    planes[3].copy(p3);
    planes[4].copy(p4);
    planes[5].copy(p5);
    this._syncFlat();
    return this;
  }
  copy(frustum) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) planes[i].copy(frustum.planes[i]);
    this._syncFlat();
    return this;
  }
  setFromProjectionMatrix(m, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const planes = this.planes, me = m.elements;
    const me0 = me[0], me1 = me[1], me2 = me[2], me3 = me[3];
    const me4 = me[4], me5 = me[5], me6 = me[6], me7 = me[7];
    const me8 = me[8], me9 = me[9], me10 = me[10], me11 = me[11];
    const me12 = me[12], me13 = me[13], me14 = me[14], me15 = me[15];
    planes[0].setComponents(me3 - me0, me7 - me4, me11 - me8, me15 - me12).normalize();
    planes[1].setComponents(me3 + me0, me7 + me4, me11 + me8, me15 + me12).normalize();
    planes[2].setComponents(me3 + me1, me7 + me5, me11 + me9, me15 + me13).normalize();
    planes[3].setComponents(me3 - me1, me7 - me5, me11 - me9, me15 - me13).normalize();
    if (reversedDepth) {
      planes[4].setComponents(me2, me6, me10, me14).normalize();
    } else {
      planes[4].setComponents(me3 - me2, me7 - me6, me11 - me10, me15 - me14).normalize();
    }
    if (coordinateSystem === WebGLCoordinateSystem) {
      planes[5].setComponents(me3 + me2, me7 + me6, me11 + me10, me15 + me14).normalize();
    } else if (coordinateSystem === WebGPUCoordinateSystem) {
      planes[5].setComponents(me2, me6, me10, me14).normalize();
    } else {
      throw new Error("Frustum.setFromProjectionMatrix(): Invalid coordinate system: " + coordinateSystem);
    }
    this._syncFlat();
    return this;
  }
  _syncFlat() {
    const f = this.flat, planes = this.planes;
    for (let i = 0; i < 6; i++) {
      const p = planes[i], o = i * 4;
      f[o] = p.normal.x;
      f[o + 1] = p.normal.y;
      f[o + 2] = p.normal.z;
      f[o + 3] = p.constant;
    }
  }
  intersectsObject(object) {
    if (object.boundingSphere !== void 0) {
      if (object.boundingSphere === null) object.computeBoundingSphere();
      _sphere.copy(object.boundingSphere).applyMatrix4(object.matrixWorld);
    } else {
      const geometry = object.geometry;
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      _sphere.copy(geometry.boundingSphere).applyMatrix4(object.matrixWorld);
    }
    return this.intersectsSphere(_sphere);
  }
  intersectsSprite(sprite) {
    _sphere.center.set(0, 0, 0);
    _sphere.radius = 0.7071067811865476;
    _sphere.applyMatrix4(sprite.matrixWorld);
    return this.intersectsSphere(_sphere);
  }
  intersectsSphere(sphere) {
    const f = this.flat, c = sphere.center, negRadius = -sphere.radius;
    const x = c.x, y = c.y, z = c.z;
    for (let o = 0; o < 24; o += 4) {
      if (f[o] * x + f[o + 1] * y + f[o + 2] * z + f[o + 3] < negRadius) return false;
    }
    return true;
  }
  /** Sphere test on raw numbers; used by the renderer's culling loop. */
  intersectsSphereFlat(x, y, z, radius) {
    const f = this.flat, negRadius = -radius;
    if (f[0] * x + f[1] * y + f[2] * z + f[3] < negRadius) return false;
    if (f[4] * x + f[5] * y + f[6] * z + f[7] < negRadius) return false;
    if (f[8] * x + f[9] * y + f[10] * z + f[11] < negRadius) return false;
    if (f[12] * x + f[13] * y + f[14] * z + f[15] < negRadius) return false;
    if (f[16] * x + f[17] * y + f[18] * z + f[19] < negRadius) return false;
    if (f[20] * x + f[21] * y + f[22] * z + f[23] < negRadius) return false;
    return true;
  }
  intersectsBox(box) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) {
      const plane = planes[i];
      _vector3.x = plane.normal.x > 0 ? box.max.x : box.min.x;
      _vector3.y = plane.normal.y > 0 ? box.max.y : box.min.y;
      _vector3.z = plane.normal.z > 0 ? box.max.z : box.min.z;
      if (plane.distanceToPoint(_vector3) < 0) return false;
    }
    return true;
  }
  containsPoint(point) {
    const planes = this.planes;
    for (let i = 0; i < 6; i++) if (planes[i].distanceToPoint(point) < 0) return false;
    return true;
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/math/Matrix4.js
var Matrix4 = class _Matrix4 {
  constructor(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    this.isMatrix4 = true;
    if (n11 !== void 0 && n11.buffer !== void 0 && n12 === void 0) {
      this.elements = n11;
    } else {
      this.elements = new Float32Array(16);
      this.elements[0] = 1;
      this.elements[5] = 1;
      this.elements[10] = 1;
      this.elements[15] = 1;
      if (n11 !== void 0) this.set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44);
    }
  }
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const te = this.elements;
    te[0] = n11;
    te[4] = n12;
    te[8] = n13;
    te[12] = n14;
    te[1] = n21;
    te[5] = n22;
    te[9] = n23;
    te[13] = n24;
    te[2] = n31;
    te[6] = n32;
    te[10] = n33;
    te[14] = n34;
    te[3] = n41;
    te[7] = n42;
    te[11] = n43;
    te[15] = n44;
    return this;
  }
  identity() {
    const te = this.elements;
    te[0] = 1;
    te[1] = 0;
    te[2] = 0;
    te[3] = 0;
    te[4] = 0;
    te[5] = 1;
    te[6] = 0;
    te[7] = 0;
    te[8] = 0;
    te[9] = 0;
    te[10] = 1;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  clone() {
    return new _Matrix4().fromArray(this.elements);
  }
  copy(m) {
    const te = this.elements, me = m.elements;
    te[0] = me[0];
    te[1] = me[1];
    te[2] = me[2];
    te[3] = me[3];
    te[4] = me[4];
    te[5] = me[5];
    te[6] = me[6];
    te[7] = me[7];
    te[8] = me[8];
    te[9] = me[9];
    te[10] = me[10];
    te[11] = me[11];
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    te[15] = me[15];
    return this;
  }
  copyPosition(m) {
    const te = this.elements, me = m.elements;
    te[12] = me[12];
    te[13] = me[13];
    te[14] = me[14];
    return this;
  }
  setFromMatrix3(m) {
    const me = m.elements;
    return this.set(me[0], me[3], me[6], 0, me[1], me[4], me[7], 0, me[2], me[5], me[8], 0, 0, 0, 0, 1);
  }
  extractBasis(xAxis, yAxis, zAxis) {
    xAxis.setFromMatrixColumn(this, 0);
    yAxis.setFromMatrixColumn(this, 1);
    zAxis.setFromMatrixColumn(this, 2);
    return this;
  }
  makeBasis(xAxis, yAxis, zAxis) {
    return this.set(xAxis.x, yAxis.x, zAxis.x, 0, xAxis.y, yAxis.y, zAxis.y, 0, xAxis.z, yAxis.z, zAxis.z, 0, 0, 0, 0, 1);
  }
  extractRotation(m) {
    const te = this.elements, me = m.elements;
    const scaleX = 1 / _v13.setFromMatrixColumn(m, 0).length();
    const scaleY = 1 / _v13.setFromMatrixColumn(m, 1).length();
    const scaleZ = 1 / _v13.setFromMatrixColumn(m, 2).length();
    te[0] = me[0] * scaleX;
    te[1] = me[1] * scaleX;
    te[2] = me[2] * scaleX;
    te[3] = 0;
    te[4] = me[4] * scaleY;
    te[5] = me[5] * scaleY;
    te[6] = me[6] * scaleY;
    te[7] = 0;
    te[8] = me[8] * scaleZ;
    te[9] = me[9] * scaleZ;
    te[10] = me[10] * scaleZ;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromEuler(euler) {
    const te = this.elements;
    const x = euler.x, y = euler.y, z = euler.z;
    const a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
    if (euler.order === "XYZ") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = -c * f;
      te[8] = d;
      te[1] = af + be * d;
      te[5] = ae - bf * d;
      te[9] = -b * c;
      te[2] = bf - ae * d;
      te[6] = be + af * d;
      te[10] = a * c;
    } else if (euler.order === "YXZ") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce + df * b;
      te[4] = de * b - cf;
      te[8] = a * d;
      te[1] = a * f;
      te[5] = a * e;
      te[9] = -b;
      te[2] = cf * b - de;
      te[6] = df + ce * b;
      te[10] = a * c;
    } else if (euler.order === "ZXY") {
      const ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce - df * b;
      te[4] = -a * f;
      te[8] = de + cf * b;
      te[1] = cf + de * b;
      te[5] = a * e;
      te[9] = df - ce * b;
      te[2] = -a * d;
      te[6] = b;
      te[10] = a * c;
    } else if (euler.order === "ZYX") {
      const ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e;
      te[4] = be * d - af;
      te[8] = ae * d + bf;
      te[1] = c * f;
      te[5] = bf * d + ae;
      te[9] = af * d - be;
      te[2] = -d;
      te[6] = b * c;
      te[10] = a * c;
    } else if (euler.order === "YZX") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = bd - ac * f;
      te[8] = bc * f + ad;
      te[1] = f;
      te[5] = a * e;
      te[9] = -b * e;
      te[2] = -d * e;
      te[6] = ad * f + bc;
      te[10] = ac - bd * f;
    } else if (euler.order === "XZY") {
      const ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e;
      te[4] = -f;
      te[8] = d * e;
      te[1] = ac * f + bd;
      te[5] = a * e;
      te[9] = ad * f - bc;
      te[2] = bc * f - ad;
      te[6] = b * e;
      te[10] = bd * f + ac;
    }
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[12] = 0;
    te[13] = 0;
    te[14] = 0;
    te[15] = 1;
    return this;
  }
  makeRotationFromQuaternion(q) {
    return this.compose(_zero, q, _one);
  }
  lookAt(eye, target, up) {
    const te = this.elements;
    _z.subVectors(eye, target);
    if (_z.lengthSq() === 0) _z.z = 1;
    _z.normalize();
    _x.crossVectors(up, _z);
    if (_x.lengthSq() === 0) {
      if (Math.abs(up.z) === 1) _z.x += 1e-4;
      else _z.z += 1e-4;
      _z.normalize();
      _x.crossVectors(up, _z);
    }
    _x.normalize();
    _y.crossVectors(_z, _x);
    te[0] = _x.x;
    te[4] = _y.x;
    te[8] = _z.x;
    te[1] = _x.y;
    te[5] = _y.y;
    te[9] = _z.y;
    te[2] = _x.z;
    te[6] = _y.z;
    te[10] = _z.z;
    return this;
  }
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  multiplyMatrices(a, b) {
    const ae = a.elements, be = b.elements, te = this.elements;
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    return this;
  }
  multiplyScalar(s) {
    const te = this.elements;
    for (let i = 0; i < 16; i++) te[i] *= s;
    return this;
  }
  determinant() {
    const te = this.elements;
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31);
  }
  transpose() {
    const te = this.elements;
    let tmp3;
    tmp3 = te[1];
    te[1] = te[4];
    te[4] = tmp3;
    tmp3 = te[2];
    te[2] = te[8];
    te[8] = tmp3;
    tmp3 = te[6];
    te[6] = te[9];
    te[9] = tmp3;
    tmp3 = te[3];
    te[3] = te[12];
    te[12] = tmp3;
    tmp3 = te[7];
    te[7] = te[13];
    te[13] = tmp3;
    tmp3 = te[11];
    te[11] = te[14];
    te[14] = tmp3;
    return this;
  }
  setPosition(x, y, z) {
    const te = this.elements;
    if (x.isVector3) {
      te[12] = x.x;
      te[13] = x.y;
      te[14] = x.z;
    } else {
      te[12] = x;
      te[13] = y;
      te[14] = z;
    }
    return this;
  }
  invert() {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) {
      for (let i = 0; i < 16; i++) te[i] = 0;
      return this;
    }
    const detInv = 1 / det;
    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    return this;
  }
  scale(v) {
    const te = this.elements, x = v.x, y = v.y, z = v.z;
    te[0] *= x;
    te[4] *= y;
    te[8] *= z;
    te[1] *= x;
    te[5] *= y;
    te[9] *= z;
    te[2] *= x;
    te[6] *= y;
    te[10] *= z;
    te[3] *= x;
    te[7] *= y;
    te[11] *= z;
    return this;
  }
  getMaxScaleOnAxis() {
    const te = this.elements;
    const sx = te[0] * te[0] + te[1] * te[1] + te[2] * te[2];
    const sy = te[4] * te[4] + te[5] * te[5] + te[6] * te[6];
    const sz = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(sx, sy, sz));
  }
  makeTranslation(x, y, z) {
    if (x.isVector3) return this.set(1, 0, 0, x.x, 0, 1, 0, x.y, 0, 0, 1, x.z, 0, 0, 0, 1);
    return this.set(1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z, 0, 0, 0, 1);
  }
  makeRotationX(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1);
  }
  makeRotationY(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(c, 0, s, 0, 0, 1, 0, 0, -s, 0, c, 0, 0, 0, 0, 1);
  }
  makeRotationZ(theta) {
    const c = Math.cos(theta), s = Math.sin(theta);
    return this.set(c, -s, 0, 0, s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
  }
  makeRotationAxis(axis, angle) {
    const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
    const x = axis.x, y = axis.y, z = axis.z, tx = t * x, ty = t * y;
    return this.set(
      tx * x + c,
      tx * y - s * z,
      tx * z + s * y,
      0,
      tx * y + s * z,
      ty * y + c,
      ty * z - s * x,
      0,
      tx * z - s * y,
      ty * z + s * x,
      t * z * z + c,
      0,
      0,
      0,
      0,
      1
    );
  }
  makeScale(x, y, z) {
    return this.set(x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1);
  }
  makeShear(xy, xz, yx, yz, zx, zy) {
    return this.set(1, yx, zx, 0, xy, 1, zy, 0, xz, yz, 1, 0, 0, 0, 0, 1);
  }
  compose(position, quaternion, scale) {
    const te = this.elements;
    const x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = scale.x, sy = scale.y, sz = scale.z;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    return this;
  }
  decompose(position, quaternion, scale) {
    const te = this.elements;
    let sx = _v13.set(te[0], te[1], te[2]).length();
    const sy = _v13.set(te[4], te[5], te[6]).length();
    const sz = _v13.set(te[8], te[9], te[10]).length();
    if (this.determinant() < 0) sx = -sx;
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    _m1.copy(this);
    const invSX = 1 / sx, invSY = 1 / sy, invSZ = 1 / sz;
    const me = _m1.elements;
    me[0] *= invSX;
    me[1] *= invSX;
    me[2] *= invSX;
    me[4] *= invSY;
    me[5] *= invSY;
    me[6] *= invSY;
    me[8] *= invSZ;
    me[9] *= invSZ;
    me[10] *= invSZ;
    quaternion.setFromRotationMatrix(_m1);
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    return this;
  }
  makePerspective(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const x = 2 * near / (right - left), y = 2 * near / (top - bottom);
    const a = (right + left) / (right - left), b = (top + bottom) / (top - bottom);
    let c, d;
    if (reversedDepth) {
      c = near / (far - near);
      d = far * near / (far - near);
    } else if (coordinateSystem === WebGLCoordinateSystem) {
      c = -(far + near) / (far - near);
      d = -2 * far * near / (far - near);
    } else if (coordinateSystem === WebGPUCoordinateSystem) {
      c = -far / (far - near);
      d = -far * near / (far - near);
    } else {
      throw new Error("Matrix4.makePerspective(): Invalid coordinate system: " + coordinateSystem);
    }
    te[0] = x;
    te[4] = 0;
    te[8] = a;
    te[12] = 0;
    te[1] = 0;
    te[5] = y;
    te[9] = b;
    te[13] = 0;
    te[2] = 0;
    te[6] = 0;
    te[10] = c;
    te[14] = d;
    te[3] = 0;
    te[7] = 0;
    te[11] = -1;
    te[15] = 0;
    return this;
  }
  makeOrthographic(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = false) {
    const te = this.elements;
    const w = 1 / (right - left), h = 1 / (top - bottom), p = 1 / (far - near);
    const x = (right + left) * w, y = (top + bottom) * h;
    let z, zInv;
    if (reversedDepth) {
      z = near * p;
      zInv = p;
    } else if (coordinateSystem === WebGLCoordinateSystem) {
      z = (far + near) * p;
      zInv = -2 * p;
    } else if (coordinateSystem === WebGPUCoordinateSystem) {
      z = near * p;
      zInv = -1 * p;
    } else {
      throw new Error("Matrix4.makeOrthographic(): Invalid coordinate system: " + coordinateSystem);
    }
    te[0] = 2 * w;
    te[4] = 0;
    te[8] = 0;
    te[12] = -x;
    te[1] = 0;
    te[5] = 2 * h;
    te[9] = 0;
    te[13] = -y;
    te[2] = 0;
    te[6] = 0;
    te[10] = zInv;
    te[14] = -z;
    te[3] = 0;
    te[7] = 0;
    te[11] = 0;
    te[15] = 1;
    return this;
  }
  equals(m) {
    const te = this.elements, me = m.elements;
    for (let i = 0; i < 16; i++) if (te[i] !== me[i]) return false;
    return true;
  }
  fromArray(array, offset = 0) {
    const te = this.elements;
    for (let i = 0; i < 16; i++) te[i] = array[i + offset];
    return this;
  }
  toArray(array = [], offset = 0) {
    const te = this.elements;
    for (let i = 0; i < 16; i++) array[offset + i] = te[i];
    return array;
  }
};
var _v13 = /* @__PURE__ */ new Vector3();
var _m1 = /* @__PURE__ */ new Matrix4();
var _zero = /* @__PURE__ */ new Vector3(0, 0, 0);
var _one = /* @__PURE__ */ new Vector3(1, 1, 1);
var _x = /* @__PURE__ */ new Vector3();
var _y = /* @__PURE__ */ new Vector3();
var _z = /* @__PURE__ */ new Vector3();

// src/math/Vector4.js
var Vector4 = class {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.isVector4 = true;
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }
  get width() {
    return this.z;
  }
  set width(v) {
    this.z = v;
  }
  get height() {
    return this.w;
  }
  set height(v) {
    this.w = v;
  }
  set(x, y, z, w) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    return this;
  }
  setScalar(s) {
    this.x = s;
    this.y = s;
    this.z = s;
    this.w = s;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setZ(z) {
    this.z = z;
    return this;
  }
  setW(w) {
    this.w = w;
    return this;
  }
  setComponent(i, v) {
    switch (i) {
      case 0:
        this.x = v;
        break;
      case 1:
        this.y = v;
        break;
      case 2:
        this.z = v;
        break;
      case 3:
        this.w = v;
        break;
      default:
        throw new Error("index is out of range: " + i);
    }
    return this;
  }
  getComponent(i) {
    switch (i) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      case 3:
        return this.w;
      default:
        throw new Error("index is out of range: " + i);
    }
  }
  clone() {
    return new this.constructor(this.x, this.y, this.z, this.w);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    this.w = v.w !== void 0 ? v.w : 1;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    this.w += v.w;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    this.z += s;
    this.w += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    this.z = a.z + b.z;
    this.w = a.w + b.w;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    this.z += v.z * s;
    this.w += v.w * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    this.w -= v.w;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    this.z -= s;
    this.w -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    this.z = a.z - b.z;
    this.w = a.w - b.w;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    this.z *= v.z;
    this.w *= v.w;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    this.w *= s;
    return this;
  }
  applyMatrix4(m) {
    const x = this.x, y = this.y, z = this.z, w = this.w, e = m.elements;
    this.x = e[0] * x + e[4] * y + e[8] * z + e[12] * w;
    this.y = e[1] * x + e[5] * y + e[9] * z + e[13] * w;
    this.z = e[2] * x + e[6] * y + e[10] * z + e[14] * w;
    this.w = e[3] * x + e[7] * y + e[11] * z + e[15] * w;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    this.z /= v.z;
    this.w /= v.w;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(1 / s);
  }
  setAxisAngleFromQuaternion(q) {
    this.w = 2 * Math.acos(q.w);
    const s = Math.sqrt(1 - q.w * q.w);
    if (s < 1e-4) {
      this.x = 1;
      this.y = 0;
      this.z = 0;
    } else {
      this.x = q.x / s;
      this.y = q.y / s;
      this.z = q.z / s;
    }
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    this.z = Math.min(this.z, v.z);
    this.w = Math.min(this.w, v.w);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    this.z = Math.max(this.z, v.z);
    this.w = Math.max(this.w, v.w);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    this.z = clamp(this.z, min.z, max.z);
    this.w = clamp(this.w, min.w, max.w);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    this.z = clamp(this.z, minVal, maxVal);
    this.w = clamp(this.w, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const l = this.length();
    return this.divideScalar(l || 1).multiplyScalar(clamp(l, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    this.z = Math.floor(this.z);
    this.w = Math.floor(this.w);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    this.z = Math.ceil(this.z);
    this.w = Math.ceil(this.w);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    this.z = Math.round(this.z);
    this.w = Math.round(this.w);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    this.z = Math.trunc(this.z);
    this.w = Math.trunc(this.w);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    this.z = -this.z;
    this.w = -this.w;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z + this.w * v.w;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w;
  }
  length() {
    return Math.sqrt(this.lengthSq());
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z) + Math.abs(this.w);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  setLength(l) {
    return this.normalize().multiplyScalar(l);
  }
  lerp(v, a) {
    this.x += (v.x - this.x) * a;
    this.y += (v.y - this.y) * a;
    this.z += (v.z - this.z) * a;
    this.w += (v.w - this.w) * a;
    return this;
  }
  lerpVectors(v1, v2, a) {
    this.x = v1.x + (v2.x - v1.x) * a;
    this.y = v1.y + (v2.y - v1.y) * a;
    this.z = v1.z + (v2.z - v1.z) * a;
    this.w = v1.w + (v2.w - v1.w) * a;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z && v.w === this.w;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    this.z = array[offset + 2];
    this.w = array[offset + 3];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    array[offset + 2] = this.z;
    array[offset + 3] = this.w;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    this.z = attribute.getZ(index);
    this.w = attribute.getW(index);
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    this.z = Math.random();
    this.w = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
    yield this.z;
    yield this.w;
  }
};

// src/math/Vector2.js
var Vector2 = class {
  constructor(x = 0, y = 0) {
    this.isVector2 = true;
    this.x = x;
    this.y = y;
  }
  get width() {
    return this.x;
  }
  set width(v) {
    this.x = v;
  }
  get height() {
    return this.y;
  }
  set height(v) {
    this.y = v;
  }
  set(x, y) {
    this.x = x;
    this.y = y;
    return this;
  }
  setScalar(s) {
    this.x = s;
    this.y = s;
    return this;
  }
  setX(x) {
    this.x = x;
    return this;
  }
  setY(y) {
    this.y = y;
    return this;
  }
  setComponent(i, v) {
    if (i === 0) this.x = v;
    else if (i === 1) this.y = v;
    else throw new Error("index is out of range: " + i);
    return this;
  }
  getComponent(i) {
    if (i === 0) return this.x;
    if (i === 1) return this.y;
    throw new Error("index is out of range: " + i);
  }
  clone() {
    return new this.constructor(this.x, this.y);
  }
  copy(v) {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  add(v) {
    this.x += v.x;
    this.y += v.y;
    return this;
  }
  addScalar(s) {
    this.x += s;
    this.y += s;
    return this;
  }
  addVectors(a, b) {
    this.x = a.x + b.x;
    this.y = a.y + b.y;
    return this;
  }
  addScaledVector(v, s) {
    this.x += v.x * s;
    this.y += v.y * s;
    return this;
  }
  sub(v) {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }
  subScalar(s) {
    this.x -= s;
    this.y -= s;
    return this;
  }
  subVectors(a, b) {
    this.x = a.x - b.x;
    this.y = a.y - b.y;
    return this;
  }
  multiply(v) {
    this.x *= v.x;
    this.y *= v.y;
    return this;
  }
  multiplyScalar(s) {
    this.x *= s;
    this.y *= s;
    return this;
  }
  divide(v) {
    this.x /= v.x;
    this.y /= v.y;
    return this;
  }
  divideScalar(s) {
    return this.multiplyScalar(1 / s);
  }
  applyMatrix3(m) {
    const x = this.x, y = this.y, e = m.elements;
    this.x = e[0] * x + e[3] * y + e[6];
    this.y = e[1] * x + e[4] * y + e[7];
    return this;
  }
  min(v) {
    this.x = Math.min(this.x, v.x);
    this.y = Math.min(this.y, v.y);
    return this;
  }
  max(v) {
    this.x = Math.max(this.x, v.x);
    this.y = Math.max(this.y, v.y);
    return this;
  }
  clamp(min, max) {
    this.x = clamp(this.x, min.x, max.x);
    this.y = clamp(this.y, min.y, max.y);
    return this;
  }
  clampScalar(minVal, maxVal) {
    this.x = clamp(this.x, minVal, maxVal);
    this.y = clamp(this.y, minVal, maxVal);
    return this;
  }
  clampLength(min, max) {
    const l = this.length();
    return this.divideScalar(l || 1).multiplyScalar(clamp(l, min, max));
  }
  floor() {
    this.x = Math.floor(this.x);
    this.y = Math.floor(this.y);
    return this;
  }
  ceil() {
    this.x = Math.ceil(this.x);
    this.y = Math.ceil(this.y);
    return this;
  }
  round() {
    this.x = Math.round(this.x);
    this.y = Math.round(this.y);
    return this;
  }
  roundToZero() {
    this.x = Math.trunc(this.x);
    this.y = Math.trunc(this.y);
    return this;
  }
  negate() {
    this.x = -this.x;
    this.y = -this.y;
    return this;
  }
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  angle() {
    return Math.atan2(-this.y, -this.x) + Math.PI;
  }
  angleTo(v) {
    const d = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (d === 0) return Math.PI / 2;
    return Math.acos(clamp(this.dot(v) / d, -1, 1));
  }
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  distanceToSquared(v) {
    const dx = this.x - v.x, dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  }
  setLength(l) {
    return this.normalize().multiplyScalar(l);
  }
  lerp(v, a) {
    this.x += (v.x - this.x) * a;
    this.y += (v.y - this.y) * a;
    return this;
  }
  lerpVectors(v1, v2, a) {
    this.x = v1.x + (v2.x - v1.x) * a;
    this.y = v1.y + (v2.y - v1.y) * a;
    return this;
  }
  equals(v) {
    return v.x === this.x && v.y === this.y;
  }
  fromArray(array, offset = 0) {
    this.x = array[offset];
    this.y = array[offset + 1];
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this.x;
    array[offset + 1] = this.y;
    return array;
  }
  fromBufferAttribute(attribute, index) {
    this.x = attribute.getX(index);
    this.y = attribute.getY(index);
    return this;
  }
  rotateAround(center, angle) {
    const c = Math.cos(angle), s = Math.sin(angle);
    const x = this.x - center.x, y = this.y - center.y;
    this.x = x * c - y * s + center.x;
    this.y = x * s + y * c + center.y;
    return this;
  }
  random() {
    this.x = Math.random();
    this.y = Math.random();
    return this;
  }
  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }
};

// src/core/EventDispatcher.js
var EventDispatcher = class {
  addEventListener(type, listener) {
    if (this._listeners === void 0) this._listeners = {};
    const listeners = this._listeners;
    if (listeners[type] === void 0) listeners[type] = [];
    if (listeners[type].indexOf(listener) === -1) listeners[type].push(listener);
  }
  hasEventListener(type, listener) {
    const listeners = this._listeners;
    if (listeners === void 0) return false;
    return listeners[type] !== void 0 && listeners[type].indexOf(listener) !== -1;
  }
  removeEventListener(type, listener) {
    const listeners = this._listeners;
    if (listeners === void 0) return;
    const listenerArray = listeners[type];
    if (listenerArray !== void 0) {
      const index = listenerArray.indexOf(listener);
      if (index !== -1) listenerArray.splice(index, 1);
    }
  }
  dispatchEvent(event) {
    const listeners = this._listeners;
    if (listeners === void 0) return;
    const listenerArray = listeners[event.type];
    if (listenerArray !== void 0) {
      event.target = this;
      const array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++) array[i].call(this, event);
      event.target = null;
    }
  }
};

// src/core/BufferAttribute.js
var _vector4 = /* @__PURE__ */ new Vector3();
var _vector23 = /* @__PURE__ */ new Vector2();
var _attributeRid = 0;
var BufferAttribute = class {
  constructor(array, itemSize, normalized = false) {
    if (Array.isArray(array)) throw new TypeError("BufferAttribute: array should be a Typed Array.");
    this.isBufferAttribute = true;
    this.name = "";
    this.array = array;
    this.itemSize = itemSize;
    this.count = array !== void 0 ? array.length / itemSize : 0;
    this.normalized = normalized;
    this.usage = StaticDrawUsage;
    this.updateRanges = [];
    this.gpuType = FloatType;
    this.version = 0;
    this._rid = _attributeRid++;
  }
  onUploadCallback() {
  }
  set needsUpdate(value) {
    if (value === true) this.version++;
  }
  setUsage(value) {
    this.usage = value;
    return this;
  }
  addUpdateRange(start, count) {
    this.updateRanges.push({ start, count });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  copy(source) {
    this.name = source.name;
    this.array = new source.array.constructor(source.array);
    this.itemSize = source.itemSize;
    this.count = source.count;
    this.normalized = source.normalized;
    this.usage = source.usage;
    this.gpuType = source.gpuType;
    return this;
  }
  copyAt(index1, attribute, index2) {
    index1 *= this.itemSize;
    index2 *= attribute.itemSize;
    for (let i = 0, l = this.itemSize; i < l; i++) this.array[index1 + i] = attribute.array[index2 + i];
    return this;
  }
  copyArray(array) {
    this.array.set(array);
    return this;
  }
  applyMatrix3(m) {
    if (this.itemSize === 2) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector23.fromBufferAttribute(this, i);
        _vector23.applyMatrix3(m);
        this.setXY(i, _vector23.x, _vector23.y);
      }
    } else if (this.itemSize === 3) {
      for (let i = 0, l = this.count; i < l; i++) {
        _vector4.fromBufferAttribute(this, i);
        _vector4.applyMatrix3(m);
        this.setXYZ(i, _vector4.x, _vector4.y, _vector4.z);
      }
    }
    return this;
  }
  applyMatrix4(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector4.fromBufferAttribute(this, i);
      _vector4.applyMatrix4(m);
      this.setXYZ(i, _vector4.x, _vector4.y, _vector4.z);
    }
    return this;
  }
  applyNormalMatrix(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector4.fromBufferAttribute(this, i);
      _vector4.applyNormalMatrix(m);
      this.setXYZ(i, _vector4.x, _vector4.y, _vector4.z);
    }
    return this;
  }
  transformDirection(m) {
    for (let i = 0, l = this.count; i < l; i++) {
      _vector4.fromBufferAttribute(this, i);
      _vector4.transformDirection(m);
      this.setXYZ(i, _vector4.x, _vector4.y, _vector4.z);
    }
    return this;
  }
  set(value, offset = 0) {
    this.array.set(value, offset);
    return this;
  }
  getComponent(index, component) {
    let v = this.array[index * this.itemSize + component];
    if (this.normalized) v = denormalize(v, this.array);
    return v;
  }
  setComponent(index, component, value) {
    if (this.normalized) value = normalize(value, this.array);
    this.array[index * this.itemSize + component] = value;
    return this;
  }
  getX(index) {
    let x = this.array[index * this.itemSize];
    if (this.normalized) x = denormalize(x, this.array);
    return x;
  }
  setX(index, x) {
    if (this.normalized) x = normalize(x, this.array);
    this.array[index * this.itemSize] = x;
    return this;
  }
  getY(index) {
    let y = this.array[index * this.itemSize + 1];
    if (this.normalized) y = denormalize(y, this.array);
    return y;
  }
  setY(index, y) {
    if (this.normalized) y = normalize(y, this.array);
    this.array[index * this.itemSize + 1] = y;
    return this;
  }
  getZ(index) {
    let z = this.array[index * this.itemSize + 2];
    if (this.normalized) z = denormalize(z, this.array);
    return z;
  }
  setZ(index, z) {
    if (this.normalized) z = normalize(z, this.array);
    this.array[index * this.itemSize + 2] = z;
    return this;
  }
  getW(index) {
    let w = this.array[index * this.itemSize + 3];
    if (this.normalized) w = denormalize(w, this.array);
    return w;
  }
  setW(index, w) {
    if (this.normalized) w = normalize(w, this.array);
    this.array[index * this.itemSize + 3] = w;
    return this;
  }
  setXY(index, x, y) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    return this;
  }
  setXYZ(index, x, y, z) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    return this;
  }
  setXYZW(index, x, y, z, w) {
    index *= this.itemSize;
    if (this.normalized) {
      x = normalize(x, this.array);
      y = normalize(y, this.array);
      z = normalize(z, this.array);
      w = normalize(w, this.array);
    }
    this.array[index + 0] = x;
    this.array[index + 1] = y;
    this.array[index + 2] = z;
    this.array[index + 3] = w;
    return this;
  }
  onUpload(callback) {
    this.onUploadCallback = callback;
    return this;
  }
  clone() {
    return new this.constructor(this.array, this.itemSize).copy(this);
  }
  toJSON() {
    const data = { itemSize: this.itemSize, type: this.array.constructor.name, array: Array.from(this.array), normalized: this.normalized };
    data.name = this.name;
    data.usage = this.usage;
    data.gpuType = this.gpuType;
    return data;
  }
};
var Int8BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Int8Array(array), itemSize, normalized);
  }
};
var Uint8BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint8Array(array), itemSize, normalized);
  }
};
var Uint8ClampedBufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint8ClampedArray(array), itemSize, normalized);
  }
};
var Int16BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Int16Array(array), itemSize, normalized);
  }
};
var Uint16BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint16Array(array), itemSize, normalized);
  }
};
var Int32BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Int32Array(array), itemSize, normalized);
  }
};
var Uint32BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint32Array(array), itemSize, normalized);
  }
};
var Float16BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Uint16Array(array), itemSize, normalized);
    this.isFloat16BufferAttribute = true;
  }
};
var Float32BufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized) {
    super(new Float32Array(array), itemSize, normalized);
  }
};

// src/math/Euler.js
var _matrix = /* @__PURE__ */ new Matrix4();
var _quaternion2 = /* @__PURE__ */ new Quaternion();
var Euler = class _Euler {
  constructor(x = 0, y = 0, z = 0, order = _Euler.DEFAULT_ORDER) {
    this.isEuler = true;
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
  }
  get x() {
    return this._x;
  }
  set x(v) {
    this._x = v;
    this._onChangeCallback();
  }
  get y() {
    return this._y;
  }
  set y(v) {
    this._y = v;
    this._onChangeCallback();
  }
  get z() {
    return this._z;
  }
  set z(v) {
    this._z = v;
    this._onChangeCallback();
  }
  get order() {
    return this._order;
  }
  set order(v) {
    this._order = v;
    this._onChangeCallback();
  }
  set(x, y, z, order = this._order) {
    this._x = x;
    this._y = y;
    this._z = z;
    this._order = order;
    this._onChangeCallback();
    return this;
  }
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  copy(e) {
    this._x = e._x;
    this._y = e._y;
    this._z = e._z;
    this._order = e._order;
    this._onChangeCallback();
    return this;
  }
  setFromRotationMatrix(m, order = this._order, update = true) {
    const te = m.elements;
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    switch (order) {
      case "XYZ":
        this._y = Math.asin(clamp(m13, -1, 1));
        if (Math.abs(m13) < 0.9999999) {
          this._x = Math.atan2(-m23, m33);
          this._z = Math.atan2(-m12, m11);
        } else {
          this._x = Math.atan2(m32, m22);
          this._z = 0;
        }
        break;
      case "YXZ":
        this._x = Math.asin(-clamp(m23, -1, 1));
        if (Math.abs(m23) < 0.9999999) {
          this._y = Math.atan2(m13, m33);
          this._z = Math.atan2(m21, m22);
        } else {
          this._y = Math.atan2(-m31, m11);
          this._z = 0;
        }
        break;
      case "ZXY":
        this._x = Math.asin(clamp(m32, -1, 1));
        if (Math.abs(m32) < 0.9999999) {
          this._y = Math.atan2(-m31, m33);
          this._z = Math.atan2(-m12, m22);
        } else {
          this._y = 0;
          this._z = Math.atan2(m21, m11);
        }
        break;
      case "ZYX":
        this._y = Math.asin(-clamp(m31, -1, 1));
        if (Math.abs(m31) < 0.9999999) {
          this._x = Math.atan2(m32, m33);
          this._z = Math.atan2(m21, m11);
        } else {
          this._x = 0;
          this._z = Math.atan2(-m12, m22);
        }
        break;
      case "YZX":
        this._z = Math.asin(clamp(m21, -1, 1));
        if (Math.abs(m21) < 0.9999999) {
          this._x = Math.atan2(-m23, m22);
          this._y = Math.atan2(-m31, m11);
        } else {
          this._x = 0;
          this._y = Math.atan2(m13, m33);
        }
        break;
      case "XZY":
        this._z = Math.asin(-clamp(m12, -1, 1));
        if (Math.abs(m12) < 0.9999999) {
          this._x = Math.atan2(m32, m22);
          this._y = Math.atan2(m13, m11);
        } else {
          this._x = Math.atan2(-m23, m33);
          this._y = 0;
        }
        break;
      default:
        console.warn("Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
    }
    this._order = order;
    if (update === true) this._onChangeCallback();
    return this;
  }
  setFromQuaternion(q, order, update) {
    _matrix.makeRotationFromQuaternion(q);
    return this.setFromRotationMatrix(_matrix, order, update);
  }
  setFromVector3(v, order = this._order) {
    return this.set(v.x, v.y, v.z, order);
  }
  reorder(newOrder) {
    _quaternion2.setFromEuler(this);
    return this.setFromQuaternion(_quaternion2, newOrder);
  }
  equals(e) {
    return e._x === this._x && e._y === this._y && e._z === this._z && e._order === this._order;
  }
  fromArray(array) {
    this._x = array[0];
    this._y = array[1];
    this._z = array[2];
    if (array[3] !== void 0) this._order = array[3];
    this._onChangeCallback();
    return this;
  }
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._order;
    return array;
  }
  _onChange(callback) {
    this._onChangeCallback = callback;
    return this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x;
    yield this._y;
    yield this._z;
    yield this._order;
  }
};
Euler.DEFAULT_ORDER = "XYZ";

// src/core/Layers.js
var Layers = class {
  constructor() {
    this.mask = 1 | 0;
  }
  set(channel) {
    this.mask = (1 << channel | 0) >>> 0;
  }
  enable(channel) {
    this.mask |= 1 << channel | 0;
  }
  enableAll() {
    this.mask = 4294967295 | 0;
  }
  toggle(channel) {
    this.mask ^= 1 << channel | 0;
  }
  disable(channel) {
    this.mask &= ~(1 << channel | 0);
  }
  disableAll() {
    this.mask = 0;
  }
  test(layers) {
    return (this.mask & layers.mask) !== 0;
  }
  isEnabled(channel) {
    return (this.mask & (1 << channel | 0)) !== 0;
  }
};

// src/core/TransformSlab.js
var RECORD_SIZE = 48;
var LOCAL_OFFSET = 0;
var WORLD_OFFSET = 16;
var PAGE_RECORDS = 1024;
var Page = class {
  constructor() {
    this.data = new Float32Array(RECORD_SIZE * PAGE_RECORDS);
    this.used = 0;
  }
};
var TransformSlab = class {
  constructor() {
    this.pages = [];
    this.free = [];
    this.live = 0;
    this.registry = typeof FinalizationRegistry !== "undefined" ? new FinalizationRegistry((slot) => {
      this.free.push(slot);
      this.live--;
    }) : null;
  }
  /**
   * Returns a slot {page, offset, data} for `owner`. `data` is a Float32Array
   * view over the record; `page.data` with `offset` gives zero-copy access for
   * srcOffset-style uploads.
   */
  allocate(owner) {
    let slot = this.free.pop();
    if (slot === void 0) {
      let page = this.pages[this.pages.length - 1];
      if (page === void 0 || page.used === PAGE_RECORDS) {
        page = new Page();
        this.pages.push(page);
      }
      slot = { page, offset: page.used * RECORD_SIZE };
      page.used++;
    }
    const d = slot.page.data, o = slot.offset;
    for (let i = 0; i < RECORD_SIZE; i++) d[o + i] = 0;
    d[o] = 1;
    d[o + 5] = 1;
    d[o + 10] = 1;
    d[o + 15] = 1;
    d[o + 16] = 1;
    d[o + 21] = 1;
    d[o + 26] = 1;
    d[o + 31] = 1;
    this.live++;
    if (this.registry !== null) this.registry.register(owner, slot);
    return slot;
  }
  get pageCount() {
    return this.pages.length;
  }
};
var transformSlab = new TransformSlab();

// src/core/Object3D.js
var _object3DId = 0;
var _v14 = /* @__PURE__ */ new Vector3();
var _q1 = /* @__PURE__ */ new Quaternion();
var _m12 = /* @__PURE__ */ new Matrix4();
var _target = /* @__PURE__ */ new Vector3();
var _position = /* @__PURE__ */ new Vector3();
var _scale = /* @__PURE__ */ new Vector3();
var _quaternion3 = /* @__PURE__ */ new Quaternion();
var _xAxis = /* @__PURE__ */ new Vector3(1, 0, 0);
var _yAxis = /* @__PURE__ */ new Vector3(0, 1, 0);
var _zAxis = /* @__PURE__ */ new Vector3(0, 0, 1);
var _addedEvent = { type: "added" };
var _removedEvent = { type: "removed" };
var _childaddedEvent = { type: "childadded", child: null };
var _childremovedEvent = { type: "childremoved", child: null };
var Object3D = class _Object3D extends EventDispatcher {
  constructor() {
    super();
    this.isObject3D = true;
    Object.defineProperty(this, "id", { value: _object3DId++ });
    this.uuid = generateUUID();
    this.name = "";
    this.type = "Object3D";
    this.parent = null;
    this.children = [];
    this.up = _Object3D.DEFAULT_UP.clone();
    const position = new Vector3();
    const rotation = new Euler();
    const quaternion = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    function onRotationChange() {
      quaternion.setFromEuler(rotation, false);
    }
    function onQuaternionChange() {
      rotation.setFromQuaternion(quaternion, void 0, false);
    }
    rotation._onChange(onRotationChange);
    quaternion._onChange(onQuaternionChange);
    const slot = transformSlab.allocate(this);
    this._slabData = slot.page.data;
    this._slabOffset = slot.offset;
    const matrix = new Matrix4(this._slabData.subarray(slot.offset + LOCAL_OFFSET, slot.offset + LOCAL_OFFSET + 16));
    const matrixWorld = new Matrix4(this._slabData.subarray(slot.offset + WORLD_OFFSET, slot.offset + WORLD_OFFSET + 16));
    Object.defineProperties(this, {
      position: { configurable: true, enumerable: true, value: position },
      rotation: { configurable: true, enumerable: true, value: rotation },
      quaternion: { configurable: true, enumerable: true, value: quaternion },
      scale: { configurable: true, enumerable: true, value: scale },
      modelViewMatrix: { value: new Matrix4() },
      normalMatrix: { value: new Matrix3() }
    });
    this._matrix = matrix;
    this._matrixWorld = matrixWorld;
    this._px = NaN;
    this._py = 0;
    this._pz = 0;
    this._qx = 0;
    this._qy = 0;
    this._qz = 0;
    this._qw = 1;
    this._sx = 1;
    this._sy = 1;
    this._sz = 1;
    this._worldVersion = 0;
    this._parentWorldVersion = -1;
    this._normalVersion = -1;
    this._cullVersion = -1;
    this._cullSphere = null;
    this._cullRadius = 0;
    this._cullCx = 0;
    this._cullCy = 0;
    this._cullCz = 0;
    this.matrixAutoUpdate = _Object3D.DEFAULT_MATRIX_AUTO_UPDATE;
    this.matrixWorldAutoUpdate = _Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE;
    this.matrixWorldNeedsUpdate = false;
    this.layers = new Layers();
    this.visible = true;
    this.castShadow = false;
    this.receiveShadow = false;
    this.frustumCulled = true;
    this.renderOrder = 0;
    this.animations = [];
    this.customDepthMaterial = void 0;
    this.customDistanceMaterial = void 0;
    this.userData = {};
  }
  // `matrix` / `matrixWorld` keep their slab storage even if assigned to.
  get matrix() {
    return this._matrix;
  }
  set matrix(m) {
    if (m !== this._matrix) this._matrix.copy(m);
  }
  get matrixWorld() {
    return this._matrixWorld;
  }
  set matrixWorld(m) {
    if (m !== this._matrixWorld) {
      this._matrixWorld.copy(m);
      this._worldVersion++;
    }
  }
  onBeforeShadow() {
  }
  onAfterShadow() {
  }
  onBeforeRender() {
  }
  onAfterRender() {
  }
  applyMatrix4(matrix) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    this._matrix.premultiply(matrix);
    this._matrix.decompose(this.position, this.quaternion, this.scale);
    this._px = NaN;
    this.matrixWorldNeedsUpdate = true;
  }
  applyQuaternion(q) {
    this.quaternion.premultiply(q);
    return this;
  }
  setRotationFromAxisAngle(axis, angle) {
    this.quaternion.setFromAxisAngle(axis, angle);
  }
  setRotationFromEuler(euler) {
    this.quaternion.setFromEuler(euler, true);
  }
  setRotationFromMatrix(m) {
    this.quaternion.setFromRotationMatrix(m);
  }
  setRotationFromQuaternion(q) {
    this.quaternion.copy(q);
  }
  rotateOnAxis(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.multiply(_q1);
    return this;
  }
  rotateOnWorldAxis(axis, angle) {
    _q1.setFromAxisAngle(axis, angle);
    this.quaternion.premultiply(_q1);
    return this;
  }
  rotateX(angle) {
    return this.rotateOnAxis(_xAxis, angle);
  }
  rotateY(angle) {
    return this.rotateOnAxis(_yAxis, angle);
  }
  rotateZ(angle) {
    return this.rotateOnAxis(_zAxis, angle);
  }
  translateOnAxis(axis, distance) {
    _v14.copy(axis).applyQuaternion(this.quaternion);
    this.position.add(_v14.multiplyScalar(distance));
    return this;
  }
  translateX(d) {
    return this.translateOnAxis(_xAxis, d);
  }
  translateY(d) {
    return this.translateOnAxis(_yAxis, d);
  }
  translateZ(d) {
    return this.translateOnAxis(_zAxis, d);
  }
  localToWorld(vector) {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(this._matrixWorld);
  }
  worldToLocal(vector) {
    this.updateWorldMatrix(true, false);
    return vector.applyMatrix4(_m12.copy(this._matrixWorld).invert());
  }
  lookAt(x, y, z) {
    if (x.isVector3) _target.copy(x);
    else _target.set(x, y, z);
    const parent = this.parent;
    this.updateWorldMatrix(true, false);
    _position.setFromMatrixPosition(this._matrixWorld);
    if (this.isCamera || this.isLight) _m12.lookAt(_position, _target, this.up);
    else _m12.lookAt(_target, _position, this.up);
    this.quaternion.setFromRotationMatrix(_m12);
    if (parent) {
      _m12.extractRotation(parent.matrixWorld);
      _q1.setFromRotationMatrix(_m12);
      this.quaternion.premultiply(_q1.invert());
    }
  }
  add(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) this.add(arguments[i]);
      return this;
    }
    if (object === this) {
      console.error("Object3D.add: object can't be added as a child of itself.", object);
      return this;
    }
    if (object && object.isObject3D) {
      object.removeFromParent();
      object.parent = this;
      this.children.push(object);
      object.matrixWorldNeedsUpdate = true;
      object.dispatchEvent(_addedEvent);
      _childaddedEvent.child = object;
      this.dispatchEvent(_childaddedEvent);
      _childaddedEvent.child = null;
    } else {
      console.error("Object3D.add: object not an instance of Object3D.", object);
    }
    return this;
  }
  remove(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++) this.remove(arguments[i]);
      return this;
    }
    const index = this.children.indexOf(object);
    if (index !== -1) {
      object.parent = null;
      this.children.splice(index, 1);
      object.dispatchEvent(_removedEvent);
      _childremovedEvent.child = object;
      this.dispatchEvent(_childremovedEvent);
      _childremovedEvent.child = null;
    }
    return this;
  }
  removeFromParent() {
    const parent = this.parent;
    if (parent !== null) parent.remove(this);
    return this;
  }
  clear() {
    return this.remove(...this.children);
  }
  attach(object) {
    this.updateWorldMatrix(true, false);
    _m12.copy(this._matrixWorld).invert();
    if (object.parent !== null) {
      object.parent.updateWorldMatrix(true, false);
      _m12.multiply(object.parent.matrixWorld);
    }
    object.applyMatrix4(_m12);
    object.removeFromParent();
    object.parent = this;
    this.children.push(object);
    object.updateWorldMatrix(false, true);
    object.dispatchEvent(_addedEvent);
    _childaddedEvent.child = object;
    this.dispatchEvent(_childaddedEvent);
    _childaddedEvent.child = null;
    return this;
  }
  getObjectById(id) {
    return this.getObjectByProperty("id", id);
  }
  getObjectByName(name) {
    return this.getObjectByProperty("name", name);
  }
  getObjectByProperty(name, value) {
    if (this[name] === value) return this;
    for (let i = 0, l = this.children.length; i < l; i++) {
      const object = this.children[i].getObjectByProperty(name, value);
      if (object !== void 0) return object;
    }
    return void 0;
  }
  getObjectsByProperty(name, value, result = []) {
    if (this[name] === value) result.push(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) children[i].getObjectsByProperty(name, value, result);
    return result;
  }
  getWorldPosition(target) {
    this.updateWorldMatrix(true, false);
    return target.setFromMatrixPosition(this._matrixWorld);
  }
  getWorldQuaternion(target) {
    this.updateWorldMatrix(true, false);
    this._matrixWorld.decompose(_position, target, _scale);
    return target;
  }
  getWorldScale(target) {
    this.updateWorldMatrix(true, false);
    this._matrixWorld.decompose(_position, _quaternion3, target);
    return target;
  }
  getWorldDirection(target) {
    this.updateWorldMatrix(true, false);
    const e = this._matrixWorld.elements;
    return target.set(e[8], e[9], e[10]).normalize();
  }
  raycast() {
  }
  traverse(callback) {
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) children[i].traverse(callback);
  }
  traverseVisible(callback) {
    if (this.visible === false) return;
    callback(this);
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) children[i].traverseVisible(callback);
  }
  traverseAncestors(callback) {
    const parent = this.parent;
    if (parent !== null) {
      callback(parent);
      parent.traverseAncestors(callback);
    }
  }
  _snapshot() {
    const p = this.position, q = this.quaternion, s = this.scale;
    this._px = p.x;
    this._py = p.y;
    this._pz = p.z;
    this._qx = q._x;
    this._qy = q._y;
    this._qz = q._z;
    this._qw = q._w;
    this._sx = s.x;
    this._sy = s.y;
    this._sz = s.z;
  }
  /**
   * Recompose the local matrix from position/quaternion/scale, but only if
   * one of them changed since the last call. Returns true when it did.
   */
  updateMatrix() {
    const p = this.position, q = this.quaternion, s = this.scale;
    if (p.x === this._px && p.y === this._py && p.z === this._pz && q._x === this._qx && q._y === this._qy && q._z === this._qz && q._w === this._qw && s.x === this._sx && s.y === this._sy && s.z === this._sz) {
      return false;
    }
    this._px = p.x;
    this._py = p.y;
    this._pz = p.z;
    this._qx = q._x;
    this._qy = q._y;
    this._qz = q._z;
    this._qw = q._w;
    this._sx = s.x;
    this._sy = s.y;
    this._sz = s.z;
    const te = this._matrix.elements;
    const x = q._x, y = q._y, z = q._z, w = q._w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s.x, sy = s.y, sz = s.z;
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    te[12] = p.x;
    te[13] = p.y;
    te[14] = p.z;
    te[15] = 1;
    this.matrixWorldNeedsUpdate = true;
    return true;
  }
  updateMatrixWorld(force) {
    if (this.matrixAutoUpdate) this.updateMatrix();
    const parent = this.parent;
    if (this.matrixWorldNeedsUpdate || force || parent !== null && parent._worldVersion !== this._parentWorldVersion) {
      if (this.matrixWorldAutoUpdate === true) {
        if (parent === null) this._matrixWorld.copy(this._matrix);
        else {
          this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix);
          this._parentWorldVersion = parent._worldVersion;
        }
        this._worldVersion++;
      }
      this.matrixWorldNeedsUpdate = false;
      force = true;
    }
    const children = this.children;
    for (let i = 0, l = children.length; i < l; i++) {
      const child = children[i];
      child.updateMatrixWorld(force);
    }
  }
  updateWorldMatrix(updateParents, updateChildren) {
    const parent = this.parent;
    if (updateParents === true && parent !== null) parent.updateWorldMatrix(true, false);
    if (this.matrixAutoUpdate) this.updateMatrix();
    let changed = false;
    if (this.matrixWorldAutoUpdate === true) {
      if (this.matrixWorldNeedsUpdate || parent !== null && parent._worldVersion !== this._parentWorldVersion || this._worldVersion === 0) {
        if (parent === null) this._matrixWorld.copy(this._matrix);
        else {
          this._matrixWorld.multiplyMatrices(parent._matrixWorld, this._matrix);
          this._parentWorldVersion = parent._worldVersion;
        }
        this._worldVersion++;
        changed = true;
      }
      this.matrixWorldNeedsUpdate = false;
    }
    if (updateChildren === true) {
      const children = this.children;
      for (let i = 0, l = children.length; i < l; i++) children[i].updateWorldMatrix(false, true);
    }
  }
  toJSON() {
    return {
      metadata: { version: 4.6, type: "Object", generator: "jrs" },
      object: { uuid: this.uuid, type: this.type, name: this.name, layers: this.layers.mask, matrix: this._matrix.toArray(), up: this.up.toArray(), userData: this.userData }
    };
  }
  clone(recursive) {
    return new this.constructor().copy(this, recursive);
  }
  copy(source, recursive = true) {
    this.name = source.name;
    this.up.copy(source.up);
    this.position.copy(source.position);
    this.rotation.order = source.rotation.order;
    this.quaternion.copy(source.quaternion);
    this.scale.copy(source.scale);
    this._matrix.copy(source._matrix);
    this._matrixWorld.copy(source._matrixWorld);
    this._snapshot();
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate;
    this.matrixWorldNeedsUpdate = true;
    this.layers.mask = source.layers.mask;
    this.visible = source.visible;
    this.castShadow = source.castShadow;
    this.receiveShadow = source.receiveShadow;
    this.frustumCulled = source.frustumCulled;
    this.renderOrder = source.renderOrder;
    this.animations = source.animations.slice();
    this.userData = JSON.parse(JSON.stringify(source.userData));
    if (recursive === true) {
      for (let i = 0; i < source.children.length; i++) this.add(source.children[i].clone());
    }
    return this;
  }
};
Object3D.DEFAULT_UP = /* @__PURE__ */ new Vector3(0, 1, 0);
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = true;
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = true;

// src/core/MeshBVH.js
var MeshBVH = class {
  constructor(geometry, options = {}) {
    this.maxLeafTris = options.maxLeafTris !== void 0 ? options.maxLeafTris : 8;
    this.geometry = geometry;
    this._build(geometry);
  }
  _build(geometry) {
    const position = geometry.attributes.position;
    const index = geometry.index;
    const pos = position.array, stride = position.itemSize;
    const triCount = index !== null ? index.count / 3 | 0 : position.count / 3 | 0;
    const idx = index !== null ? index.array : null;
    this.triCount = triCount;
    const tris = new Uint32Array(triCount);
    const centroids = new Float32Array(triCount * 3);
    const triBounds = new Float32Array(triCount * 6);
    for (let t = 0; t < triCount; t++) {
      tris[t] = t;
      let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
      for (let k = 0; k < 3; k++) {
        const v = idx !== null ? idx[t * 3 + k] : t * 3 + k;
        const o = v * stride;
        const x = pos[o], y = pos[o + 1], z = pos[o + 2];
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
        if (z < minz) minz = z;
        if (z > maxz) maxz = z;
      }
      const b = t * 6;
      triBounds[b] = minx;
      triBounds[b + 1] = miny;
      triBounds[b + 2] = minz;
      triBounds[b + 3] = maxx;
      triBounds[b + 4] = maxy;
      triBounds[b + 5] = maxz;
      const c = t * 3;
      centroids[c] = (minx + maxx) * 0.5;
      centroids[c + 1] = (miny + maxy) * 0.5;
      centroids[c + 2] = (minz + maxz) * 0.5;
    }
    const maxNodes = Math.max(1, 2 * Math.ceil(triCount / Math.max(1, this.maxLeafTris / 2)) + 1);
    let bounds = new Float32Array(maxNodes * 6);
    let meta = new Int32Array(maxNodes * 2);
    let isLeaf = new Uint8Array(maxNodes);
    let nodeCount = 0;
    const maxLeafTris = this.maxLeafTris;
    function grow() {
      const nb = new Float32Array(bounds.length * 2);
      nb.set(bounds);
      bounds = nb;
      const nm = new Int32Array(meta.length * 2);
      nm.set(meta);
      meta = nm;
      const nl = new Uint8Array(isLeaf.length * 2);
      nl.set(isLeaf);
      isLeaf = nl;
    }
    function computeBounds(node, start, end) {
      let minx = Infinity, miny = Infinity, minz = Infinity, maxx = -Infinity, maxy = -Infinity, maxz = -Infinity;
      for (let i = start; i < end; i++) {
        const b = tris[i] * 6;
        if (triBounds[b] < minx) minx = triBounds[b];
        if (triBounds[b + 1] < miny) miny = triBounds[b + 1];
        if (triBounds[b + 2] < minz) minz = triBounds[b + 2];
        if (triBounds[b + 3] > maxx) maxx = triBounds[b + 3];
        if (triBounds[b + 4] > maxy) maxy = triBounds[b + 4];
        if (triBounds[b + 5] > maxz) maxz = triBounds[b + 5];
      }
      const o = node * 6;
      bounds[o] = minx;
      bounds[o + 1] = miny;
      bounds[o + 2] = minz;
      bounds[o + 3] = maxx;
      bounds[o + 4] = maxy;
      bounds[o + 5] = maxz;
    }
    function partition(start, end, axis, split) {
      let i = start, j = end - 1;
      while (i <= j) {
        while (i <= j && centroids[tris[i] * 3 + axis] < split) i++;
        while (i <= j && centroids[tris[j] * 3 + axis] >= split) j--;
        if (i < j) {
          const tmp3 = tris[i];
          tris[i] = tris[j];
          tris[j] = tmp3;
          i++;
          j--;
        }
      }
      return i;
    }
    const stack = [];
    const root = nodeCount++;
    stack.push(root, 0, triCount);
    while (stack.length > 0) {
      const end = stack.pop(), start = stack.pop(), node = stack.pop();
      if (nodeCount + 2 >= isLeaf.length) grow();
      computeBounds(node, start, end);
      const count = end - start;
      if (count <= maxLeafTris) {
        isLeaf[node] = 1;
        meta[node * 2] = start;
        meta[node * 2 + 1] = count;
        continue;
      }
      let cminx = Infinity, cminy = Infinity, cminz = Infinity, cmaxx = -Infinity, cmaxy = -Infinity, cmaxz = -Infinity;
      for (let i = start; i < end; i++) {
        const c = tris[i] * 3;
        const x = centroids[c], y = centroids[c + 1], z = centroids[c + 2];
        if (x < cminx) cminx = x;
        if (x > cmaxx) cmaxx = x;
        if (y < cminy) cminy = y;
        if (y > cmaxy) cmaxy = y;
        if (z < cminz) cminz = z;
        if (z > cmaxz) cmaxz = z;
      }
      const ex = cmaxx - cminx, ey = cmaxy - cminy, ez = cmaxz - cminz;
      let axis = 0, split = (cminx + cmaxx) * 0.5;
      if (ey > ex && ey >= ez) {
        axis = 1;
        split = (cminy + cmaxy) * 0.5;
      } else if (ez > ex && ez > ey) {
        axis = 2;
        split = (cminz + cmaxz) * 0.5;
      }
      let mid = partition(start, end, axis, split);
      if (mid === start || mid === end) {
        mid = start + end >> 1;
      }
      const left = nodeCount++, right = nodeCount++;
      isLeaf[node] = 0;
      meta[node * 2] = left;
      meta[node * 2 + 1] = right;
      stack.push(left, start, mid);
      stack.push(right, mid, end);
    }
    this.nodeCount = nodeCount;
    this.bounds = bounds.subarray(0, nodeCount * 6);
    this.meta = meta.subarray(0, nodeCount * 2);
    this.isLeaf = isLeaf.subarray(0, nodeCount);
    this.tris = tris;
    this._stack = new Int32Array(128);
  }
  /**
   * Visit every triangle whose node bounds the ray enters. `onTriangle(triIndex)`
   * is called for each; the ray is given by origin (ox,oy,oz) and direction (dx,dy,dz).
   * Returns nothing; collect results in the callback.
   */
  raycast(ox, oy, oz, dx, dy, dz, maxT, onTriangle) {
    const bounds = this.bounds, meta = this.meta, isLeaf = this.isLeaf, tris = this.tris;
    const idx = 1 / dx, idy = 1 / dy, idz = 1 / dz;
    let stack = this._stack, sp = 0;
    stack[sp++] = 0;
    while (sp > 0) {
      const node = stack[--sp];
      const o = node * 6;
      let t1 = (bounds[o] - ox) * idx, t2 = (bounds[o + 3] - ox) * idx;
      let tmin = t1 < t2 ? t1 : t2, tmax = t1 < t2 ? t2 : t1;
      t1 = (bounds[o + 1] - oy) * idy;
      t2 = (bounds[o + 4] - oy) * idy;
      let lo = t1 < t2 ? t1 : t2, hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) tmin = lo;
      if (hi < tmax) tmax = hi;
      t1 = (bounds[o + 2] - oz) * idz;
      t2 = (bounds[o + 5] - oz) * idz;
      lo = t1 < t2 ? t1 : t2;
      hi = t1 < t2 ? t2 : t1;
      if (lo > tmin) tmin = lo;
      if (hi < tmax) tmax = hi;
      if (tmax < 0 || tmin > tmax || tmin > maxT) continue;
      if (isLeaf[node] === 1) {
        const start = meta[node * 2], count = meta[node * 2 + 1];
        for (let i = start, e = start + count; i < e; i++) onTriangle(tris[i]);
      } else {
        if (sp + 2 > stack.length) {
          const ns = new Int32Array(stack.length * 2);
          ns.set(stack);
          stack = this._stack = ns;
        }
        stack[sp++] = meta[node * 2];
        stack[sp++] = meta[node * 2 + 1];
      }
    }
  }
};

// src/core/BufferGeometry.js
var _id = 0;
var _m13 = /* @__PURE__ */ new Matrix4();
var _obj = /* @__PURE__ */ new Object3D();
var _offset = /* @__PURE__ */ new Vector3();
var _box3 = /* @__PURE__ */ new Box3();
var _boxMorphTargets = /* @__PURE__ */ new Box3();
var _vector5 = /* @__PURE__ */ new Vector3();
function arrayNeedsUint32(array) {
  for (let i = array.length - 1; i >= 0; --i) if (array[i] >= 65535) return true;
  return false;
}
var BufferGeometry = class _BufferGeometry extends EventDispatcher {
  constructor() {
    super();
    this.isBufferGeometry = true;
    Object.defineProperty(this, "id", { value: _id++ });
    this.uuid = generateUUID();
    this.name = "";
    this.type = "BufferGeometry";
    this.index = null;
    this.indirect = null;
    this.attributes = {};
    this.morphAttributes = {};
    this.morphTargetsRelative = false;
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    this.drawRange = { start: 0, count: Infinity };
    this.userData = {};
    this.boundsTree = null;
    this._layoutVersion = 0;
    this._frameStamp = -1;
    this._frameRid = 0;
  }
  getIndex() {
    return this.index;
  }
  setIndex(index) {
    if (Array.isArray(index)) this.index = new (arrayNeedsUint32(index) ? Uint32BufferAttribute : Uint16BufferAttribute)(index, 1);
    else this.index = index;
    this._layoutVersion++;
    this.boundsTree = null;
    return this;
  }
  setIndirect(indirect) {
    this.indirect = indirect;
    return this;
  }
  getIndirect() {
    return this.indirect;
  }
  getAttribute(name) {
    return this.attributes[name];
  }
  setAttribute(name, attribute) {
    this.attributes[name] = attribute;
    this._layoutVersion++;
    if (name === "position") this.boundsTree = null;
    return this;
  }
  deleteAttribute(name) {
    delete this.attributes[name];
    this._layoutVersion++;
    return this;
  }
  hasAttribute(name) {
    return this.attributes[name] !== void 0;
  }
  addGroup(start, count, materialIndex = 0) {
    this.groups.push({ start, count, materialIndex });
  }
  clearGroups() {
    this.groups = [];
  }
  setDrawRange(start, count) {
    this.drawRange.start = start;
    this.drawRange.count = count;
  }
  applyMatrix4(matrix) {
    const position = this.attributes.position;
    if (position !== void 0) {
      position.applyMatrix4(matrix);
      position.needsUpdate = true;
    }
    const normal = this.attributes.normal;
    if (normal !== void 0) {
      const normalMatrix = new Matrix3().getNormalMatrix(matrix);
      normal.applyNormalMatrix(normalMatrix);
      normal.needsUpdate = true;
    }
    const tangent = this.attributes.tangent;
    if (tangent !== void 0) {
      tangent.transformDirection(matrix);
      tangent.needsUpdate = true;
    }
    if (this.boundingBox !== null) this.computeBoundingBox();
    if (this.boundingSphere !== null) this.computeBoundingSphere();
    this.boundsTree = null;
    return this;
  }
  applyQuaternion(q) {
    _m13.makeRotationFromQuaternion(q);
    this.applyMatrix4(_m13);
    return this;
  }
  rotateX(angle) {
    _m13.makeRotationX(angle);
    this.applyMatrix4(_m13);
    return this;
  }
  rotateY(angle) {
    _m13.makeRotationY(angle);
    this.applyMatrix4(_m13);
    return this;
  }
  rotateZ(angle) {
    _m13.makeRotationZ(angle);
    this.applyMatrix4(_m13);
    return this;
  }
  translate(x, y, z) {
    _m13.makeTranslation(x, y, z);
    this.applyMatrix4(_m13);
    return this;
  }
  scale(x, y, z) {
    _m13.makeScale(x, y, z);
    this.applyMatrix4(_m13);
    return this;
  }
  lookAt(vector) {
    _obj.lookAt(vector);
    _obj.updateMatrix();
    this.applyMatrix4(_obj.matrix);
    return this;
  }
  center() {
    this.computeBoundingBox();
    this.boundingBox.getCenter(_offset).negate();
    this.translate(_offset.x, _offset.y, _offset.z);
    return this;
  }
  setFromPoints(points) {
    const positionAttribute = this.getAttribute("position");
    if (positionAttribute === void 0) {
      const position = [];
      for (let i = 0, l = points.length; i < l; i++) {
        const point = points[i];
        position.push(point.x, point.y, point.z || 0);
      }
      this.setAttribute("position", new Float32BufferAttribute(position, 3));
    } else {
      const l = Math.min(points.length, positionAttribute.count);
      for (let i = 0; i < l; i++) {
        const point = points[i];
        positionAttribute.setXYZ(i, point.x, point.y, point.z || 0);
      }
      if (points.length > positionAttribute.count) console.warn("BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");
      positionAttribute.needsUpdate = true;
    }
    return this;
  }
  computeBoundingBox() {
    if (this.boundingBox === null) this.boundingBox = new Box3();
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      console.error("BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.", this);
      this.boundingBox.set(new Vector3(-Infinity, -Infinity, -Infinity), new Vector3(Infinity, Infinity, Infinity));
      return;
    }
    if (position !== void 0) {
      this.boundingBox.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _box3.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector5.addVectors(this.boundingBox.min, _box3.min);
            this.boundingBox.expandByPoint(_vector5);
            _vector5.addVectors(this.boundingBox.max, _box3.max);
            this.boundingBox.expandByPoint(_vector5);
          } else {
            this.boundingBox.expandByPoint(_box3.min);
            this.boundingBox.expandByPoint(_box3.max);
          }
        }
      }
    } else {
      this.boundingBox.makeEmpty();
    }
    if (isNaN(this.boundingBox.min.x) || isNaN(this.boundingBox.min.y) || isNaN(this.boundingBox.min.z)) {
      console.error('BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.', this);
    }
  }
  computeBoundingSphere() {
    if (this.boundingSphere === null) this.boundingSphere = new Sphere();
    const position = this.attributes.position;
    const morphAttributesPosition = this.morphAttributes.position;
    if (position && position.isGLBufferAttribute) {
      console.error("BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.", this);
      this.boundingSphere.set(new Vector3(), Infinity);
      return;
    }
    if (position) {
      const center = this.boundingSphere.center;
      _box3.setFromBufferAttribute(position);
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          _boxMorphTargets.setFromBufferAttribute(morphAttribute);
          if (this.morphTargetsRelative) {
            _vector5.addVectors(_box3.min, _boxMorphTargets.min);
            _box3.expandByPoint(_vector5);
            _vector5.addVectors(_box3.max, _boxMorphTargets.max);
            _box3.expandByPoint(_vector5);
          } else {
            _box3.expandByPoint(_boxMorphTargets.min);
            _box3.expandByPoint(_boxMorphTargets.max);
          }
        }
      }
      _box3.getCenter(center);
      let maxRadiusSq = 0;
      const arr = position.array, n = position.count, stride = position.itemSize, cx = center.x, cy = center.y, cz = center.z;
      if (position.normalized === false) {
        for (let i = 0, o = 0; i < n; i++, o += stride) {
          const dx = arr[o] - cx, dy = arr[o + 1] - cy, dz = arr[o + 2] - cz;
          const d = dx * dx + dy * dy + dz * dz;
          if (d > maxRadiusSq) maxRadiusSq = d;
        }
      } else {
        for (let i = 0; i < n; i++) {
          _vector5.fromBufferAttribute(position, i);
          maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector5));
        }
      }
      if (morphAttributesPosition) {
        for (let i = 0, il = morphAttributesPosition.length; i < il; i++) {
          const morphAttribute = morphAttributesPosition[i];
          const morphTargetsRelative = this.morphTargetsRelative;
          for (let j = 0, jl = morphAttribute.count; j < jl; j++) {
            _vector5.fromBufferAttribute(morphAttribute, j);
            if (morphTargetsRelative) {
              _offset.fromBufferAttribute(position, j);
              _vector5.add(_offset);
            }
            maxRadiusSq = Math.max(maxRadiusSq, center.distanceToSquared(_vector5));
          }
        }
      }
      this.boundingSphere.radius = Math.sqrt(maxRadiusSq);
      if (isNaN(this.boundingSphere.radius)) {
        console.error('BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.', this);
      }
    }
  }
  /** Build (or rebuild) the BVH used to accelerate raycasting. Built lazily on first raycast otherwise. */
  computeBoundsTree(options) {
    this.boundsTree = new MeshBVH(this, options);
    return this.boundsTree;
  }
  disposeBoundsTree() {
    this.boundsTree = null;
  }
  computeTangents() {
    const index = this.index, attributes = this.attributes;
    if (index === null || attributes.position === void 0 || attributes.normal === void 0 || attributes.uv === void 0) {
      console.error("BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");
      return;
    }
    const positionAttribute = attributes.position, normalAttribute = attributes.normal, uvAttribute = attributes.uv;
    if (this.hasAttribute("tangent") === false) this.setAttribute("tangent", new BufferAttribute(new Float32Array(4 * positionAttribute.count), 4));
    const tangentAttribute = this.getAttribute("tangent");
    const tan1 = [], tan2 = [];
    for (let i = 0; i < positionAttribute.count; i++) {
      tan1[i] = new Vector3();
      tan2[i] = new Vector3();
    }
    const vA = new Vector3(), vB = new Vector3(), vC = new Vector3();
    const uvA = new Vector2(), uvB = new Vector2(), uvC = new Vector2();
    const sdir = new Vector3(), tdir = new Vector3();
    function handleTriangle(a, b, c) {
      vA.fromBufferAttribute(positionAttribute, a);
      vB.fromBufferAttribute(positionAttribute, b);
      vC.fromBufferAttribute(positionAttribute, c);
      uvA.fromBufferAttribute(uvAttribute, a);
      uvB.fromBufferAttribute(uvAttribute, b);
      uvC.fromBufferAttribute(uvAttribute, c);
      vB.sub(vA);
      vC.sub(vA);
      uvB.sub(uvA);
      uvC.sub(uvA);
      const r = 1 / (uvB.x * uvC.y - uvC.x * uvB.y);
      if (!isFinite(r)) return;
      sdir.copy(vB).multiplyScalar(uvC.y).addScaledVector(vC, -uvB.y).multiplyScalar(r);
      tdir.copy(vC).multiplyScalar(uvB.x).addScaledVector(vB, -uvC.x).multiplyScalar(r);
      tan1[a].add(sdir);
      tan1[b].add(sdir);
      tan1[c].add(sdir);
      tan2[a].add(tdir);
      tan2[b].add(tdir);
      tan2[c].add(tdir);
    }
    let groups = this.groups;
    if (groups.length === 0) groups = [{ start: 0, count: index.count }];
    for (let i = 0, il = groups.length; i < il; ++i) {
      const group = groups[i], start = group.start, count = group.count;
      for (let j = start, jl = start + count; j < jl; j += 3) handleTriangle(index.getX(j + 0), index.getX(j + 1), index.getX(j + 2));
    }
    const tmp3 = new Vector3(), tmp22 = new Vector3(), n = new Vector3(), n2 = new Vector3();
    function handleVertex(v) {
      n.fromBufferAttribute(normalAttribute, v);
      n2.copy(n);
      const t = tan1[v];
      tmp3.copy(t);
      tmp3.sub(n.multiplyScalar(n.dot(t))).normalize();
      tmp22.crossVectors(n2, t);
      const test = tmp22.dot(tan2[v]);
      const w = test < 0 ? -1 : 1;
      tangentAttribute.setXYZW(v, tmp3.x, tmp3.y, tmp3.z, w);
    }
    for (let i = 0, il = groups.length; i < il; ++i) {
      const group = groups[i], start = group.start, count = group.count;
      for (let j = start, jl = start + count; j < jl; j += 3) {
        handleVertex(index.getX(j + 0));
        handleVertex(index.getX(j + 1));
        handleVertex(index.getX(j + 2));
      }
    }
  }
  computeVertexNormals() {
    const index = this.index;
    const positionAttribute = this.getAttribute("position");
    if (positionAttribute !== void 0) {
      let normalAttribute = this.getAttribute("normal");
      if (normalAttribute === void 0) {
        normalAttribute = new BufferAttribute(new Float32Array(positionAttribute.count * 3), 3);
        this.setAttribute("normal", normalAttribute);
      } else {
        for (let i = 0, il = normalAttribute.count; i < il; i++) normalAttribute.setXYZ(i, 0, 0, 0);
      }
      const pA = new Vector3(), pB = new Vector3(), pC = new Vector3();
      const nA = new Vector3(), nB = new Vector3(), nC = new Vector3();
      const cb = new Vector3(), ab = new Vector3();
      if (index) {
        for (let i = 0, il = index.count; i < il; i += 3) {
          const vA = index.getX(i + 0), vB = index.getX(i + 1), vC = index.getX(i + 2);
          pA.fromBufferAttribute(positionAttribute, vA);
          pB.fromBufferAttribute(positionAttribute, vB);
          pC.fromBufferAttribute(positionAttribute, vC);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          nA.fromBufferAttribute(normalAttribute, vA);
          nB.fromBufferAttribute(normalAttribute, vB);
          nC.fromBufferAttribute(normalAttribute, vC);
          nA.add(cb);
          nB.add(cb);
          nC.add(cb);
          normalAttribute.setXYZ(vA, nA.x, nA.y, nA.z);
          normalAttribute.setXYZ(vB, nB.x, nB.y, nB.z);
          normalAttribute.setXYZ(vC, nC.x, nC.y, nC.z);
        }
      } else {
        for (let i = 0, il = positionAttribute.count; i < il; i += 3) {
          pA.fromBufferAttribute(positionAttribute, i + 0);
          pB.fromBufferAttribute(positionAttribute, i + 1);
          pC.fromBufferAttribute(positionAttribute, i + 2);
          cb.subVectors(pC, pB);
          ab.subVectors(pA, pB);
          cb.cross(ab);
          normalAttribute.setXYZ(i + 0, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 1, cb.x, cb.y, cb.z);
          normalAttribute.setXYZ(i + 2, cb.x, cb.y, cb.z);
        }
      }
      this.normalizeNormals();
      normalAttribute.needsUpdate = true;
    }
  }
  normalizeNormals() {
    const normals = this.attributes.normal;
    for (let i = 0, il = normals.count; i < il; i++) {
      _vector5.fromBufferAttribute(normals, i);
      _vector5.normalize();
      normals.setXYZ(i, _vector5.x, _vector5.y, _vector5.z);
    }
  }
  toNonIndexed() {
    function convertBufferAttribute(attribute, indices2) {
      const array = attribute.array, itemSize = attribute.itemSize, normalized = attribute.normalized;
      const array2 = new array.constructor(indices2.length * itemSize);
      let index = 0, index2 = 0;
      for (let i = 0, l = indices2.length; i < l; i++) {
        index = attribute.isInterleavedBufferAttribute ? indices2[i] * attribute.data.stride + attribute.offset : indices2[i] * itemSize;
        for (let j = 0; j < itemSize; j++) array2[index2++] = array[index++];
      }
      return new BufferAttribute(array2, itemSize, normalized);
    }
    if (this.index === null) {
      console.warn("BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed.");
      return this;
    }
    const geometry2 = new _BufferGeometry();
    const indices = this.index.array;
    const attributes = this.attributes;
    for (const name in attributes) geometry2.setAttribute(name, convertBufferAttribute(attributes[name], indices));
    const morphAttributes = this.morphAttributes;
    for (const name in morphAttributes) {
      const morphArray = [], morphAttribute = morphAttributes[name];
      for (let i = 0, il = morphAttribute.length; i < il; i++) morphArray.push(convertBufferAttribute(morphAttribute[i], indices));
      geometry2.morphAttributes[name] = morphArray;
    }
    geometry2.morphTargetsRelative = this.morphTargetsRelative;
    const groups = this.groups;
    for (let i = 0, l = groups.length; i < l; i++) {
      const group = groups[i];
      geometry2.addGroup(group.start, group.count, group.materialIndex);
    }
    return geometry2;
  }
  toJSON() {
    const data = { metadata: { version: 4.6, type: "BufferGeometry", generator: "jrs" } };
    data.uuid = this.uuid;
    data.type = this.type;
    if (this.name !== "") data.name = this.name;
    if (Object.keys(this.userData).length > 0) data.userData = this.userData;
    if (this.parameters !== void 0) {
      const parameters = this.parameters;
      for (const key in parameters) if (parameters[key] !== void 0) data[key] = parameters[key];
      return data;
    }
    data.data = { attributes: {} };
    const index = this.index;
    if (index !== null) data.data.index = { type: index.array.constructor.name, array: Array.prototype.slice.call(index.array) };
    const attributes = this.attributes;
    for (const key in attributes) data.data.attributes[key] = attributes[key].toJSON(data.data);
    const groups = this.groups;
    if (groups.length > 0) data.data.groups = JSON.parse(JSON.stringify(groups));
    const boundingSphere = this.boundingSphere;
    if (boundingSphere !== null) data.data.boundingSphere = { center: boundingSphere.center.toArray(), radius: boundingSphere.radius };
    return data;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.index = null;
    this.attributes = {};
    this.morphAttributes = {};
    this.groups = [];
    this.boundingBox = null;
    this.boundingSphere = null;
    this.boundsTree = null;
    const data = {};
    this.name = source.name;
    const index = source.index;
    if (index !== null) this.setIndex(index.clone());
    const attributes = source.attributes;
    for (const name in attributes) this.setAttribute(name, attributes[name].clone(data));
    const morphAttributes = source.morphAttributes;
    for (const name in morphAttributes) {
      const array = [], morphAttribute = morphAttributes[name];
      for (let i = 0, l = morphAttribute.length; i < l; i++) array.push(morphAttribute[i].clone(data));
      this.morphAttributes[name] = array;
    }
    this.morphTargetsRelative = source.morphTargetsRelative;
    const groups = source.groups;
    for (let i = 0, l = groups.length; i < l; i++) {
      const group = groups[i];
      this.addGroup(group.start, group.count, group.materialIndex);
    }
    const boundingBox = source.boundingBox;
    if (boundingBox !== null) this.boundingBox = boundingBox.clone();
    const boundingSphere = source.boundingSphere;
    if (boundingSphere !== null) this.boundingSphere = boundingSphere.clone();
    this.drawRange.start = source.drawRange.start;
    this.drawRange.count = source.drawRange.count;
    this.userData = source.userData;
    return this;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
};

// src/renderers/webgl/WebGLState.js
var WebGLState = class {
  constructor(gl) {
    this.gl = gl;
    this.enabledCapabilities = {};
    this.currentProgram = null;
    this.currentVAO = null;
    this.currentArrayBuffer = null;
    this.currentElementBuffer = null;
    this.currentUniformBuffer = null;
    this.currentUniformBindings = [];
    this.currentBlendingEnabled = false;
    this.currentBlending = null;
    this.currentBlendEquation = null;
    this.currentBlendSrc = null;
    this.currentBlendDst = null;
    this.currentBlendEquationAlpha = null;
    this.currentBlendSrcAlpha = null;
    this.currentBlendDstAlpha = null;
    this.currentBlendColor = [0, 0, 0];
    this.currentBlendAlpha = 0;
    this.currentPremultipliedAlpha = false;
    this.currentFlipSided = null;
    this.currentCullFace = null;
    this.currentLineWidth = null;
    this.currentPolygonOffsetFactor = null;
    this.currentPolygonOffsetUnits = null;
    this.currentDepthMask = null;
    this.currentDepthFunc = null;
    this.currentDepthTest = null;
    this.currentColorMask = null;
    this.currentStencilTest = null;
    this.currentStencilMask = null;
    this.currentStencilFunc = null;
    this.currentStencilRef = null;
    this.currentStencilFuncMask = null;
    this.currentStencilFail = null;
    this.currentStencilZFail = null;
    this.currentStencilZPass = null;
    this.currentClearColor = new Vector4(0, 0, 0, 0);
    this.currentClearDepth = null;
    this.currentClearStencil = null;
    this.currentViewport = new Vector4(-1, -1, -1, -1);
    this.currentScissor = new Vector4(-1, -1, -1, -1);
    this.currentScissorTest = null;
    this.currentTextureSlot = null;
    this.currentBoundTextures = [];
    this.currentFramebuffer = null;
    this.maxTextures = gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    this.uboAlignment = gl.getParameter(gl.UNIFORM_BUFFER_OFFSET_ALIGNMENT);
    this.equationToGL = {
      [AddEquation]: gl.FUNC_ADD,
      [SubtractEquation]: gl.FUNC_SUBTRACT,
      [ReverseSubtractEquation]: gl.FUNC_REVERSE_SUBTRACT,
      [MinEquation]: gl.MIN,
      [MaxEquation]: gl.MAX
    };
    this.factorToGL = {
      [ZeroFactor]: gl.ZERO,
      [OneFactor]: gl.ONE,
      [SrcColorFactor]: gl.SRC_COLOR,
      [SrcAlphaFactor]: gl.SRC_ALPHA,
      [SrcAlphaSaturateFactor]: gl.SRC_ALPHA_SATURATE,
      [DstColorFactor]: gl.DST_COLOR,
      [DstAlphaFactor]: gl.DST_ALPHA,
      [OneMinusSrcColorFactor]: gl.ONE_MINUS_SRC_COLOR,
      [OneMinusSrcAlphaFactor]: gl.ONE_MINUS_SRC_ALPHA,
      [OneMinusDstColorFactor]: gl.ONE_MINUS_DST_COLOR,
      [OneMinusDstAlphaFactor]: gl.ONE_MINUS_DST_ALPHA,
      [ConstantColorFactor]: gl.CONSTANT_COLOR,
      [OneMinusConstantColorFactor]: gl.ONE_MINUS_CONSTANT_COLOR,
      [ConstantAlphaFactor]: gl.CONSTANT_ALPHA,
      [OneMinusConstantAlphaFactor]: gl.ONE_MINUS_CONSTANT_ALPHA
    };
    this.enable(gl.DEPTH_TEST);
    this.setDepthFunc(LessEqualDepth);
    this.setFlipSided(false);
    this.setCullFace(CullFaceBack);
    this.enable(gl.CULL_FACE);
    this.setBlending(NoBlending);
  }
  enable(id) {
    if (this.enabledCapabilities[id] !== true) {
      this.gl.enable(id);
      this.enabledCapabilities[id] = true;
    }
  }
  disable(id) {
    if (this.enabledCapabilities[id] !== false) {
      this.gl.disable(id);
      this.enabledCapabilities[id] = false;
    }
  }
  useProgram(program) {
    if (this.currentProgram !== program) {
      this.gl.useProgram(program);
      this.currentProgram = program;
      return true;
    }
    return false;
  }
  bindVertexArray(vao) {
    if (this.currentVAO !== vao) {
      this.gl.bindVertexArray(vao);
      this.currentVAO = vao;
      this.currentElementBuffer = void 0;
      return true;
    }
    return false;
  }
  bindArrayBuffer(buffer) {
    if (this.currentArrayBuffer !== buffer) {
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
      this.currentArrayBuffer = buffer;
    }
  }
  bindUniformBuffer(buffer) {
    if (this.currentUniformBuffer !== buffer) {
      this.gl.bindBuffer(this.gl.UNIFORM_BUFFER, buffer);
      this.currentUniformBuffer = buffer;
    }
  }
  bindUniformBufferRange(index, buffer, offset, size) {
    let b = this.currentUniformBindings[index];
    if (b === void 0) {
      b = this.currentUniformBindings[index] = { buffer: null, offset: -1, size: -1 };
    }
    if (b.buffer !== buffer || b.offset !== offset || b.size !== size) {
      this.gl.bindBufferRange(this.gl.UNIFORM_BUFFER, index, buffer, offset, size);
      b.buffer = buffer;
      b.offset = offset;
      b.size = size;
      this.currentUniformBuffer = buffer;
    }
  }
  bindFramebuffer(framebuffer) {
    if (this.currentFramebuffer !== framebuffer) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer);
      this.currentFramebuffer = framebuffer;
      return true;
    }
    return false;
  }
  setBlending(blending, blendEquation, blendSrc, blendDst, blendEquationAlpha, blendSrcAlpha, blendDstAlpha, blendColor, blendAlpha, premultipliedAlpha) {
    const gl = this.gl;
    if (blending === NoBlending) {
      if (this.currentBlendingEnabled === true) {
        this.disable(gl.BLEND);
        this.currentBlendingEnabled = false;
      }
      return;
    }
    if (this.currentBlendingEnabled === false) {
      this.enable(gl.BLEND);
      this.currentBlendingEnabled = true;
    }
    if (blending !== CustomBlending) {
      if (blending !== this.currentBlending || premultipliedAlpha !== this.currentPremultipliedAlpha) {
        if (this.currentBlendEquation !== AddEquation || this.currentBlendEquationAlpha !== AddEquation) {
          gl.blendEquation(gl.FUNC_ADD);
          this.currentBlendEquation = AddEquation;
          this.currentBlendEquationAlpha = AddEquation;
        }
        if (premultipliedAlpha) {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
              break;
            case AdditiveBlending:
              gl.blendFunc(gl.ONE, gl.ONE);
              break;
            case SubtractiveBlending:
              gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
              break;
            case MultiplyBlending:
              gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.SRC_ALPHA);
              break;
            default:
              console.error("WebGLState: Invalid blending: ", blending);
          }
        } else {
          switch (blending) {
            case NormalBlending:
              gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
              break;
            case AdditiveBlending:
              gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
              break;
            case SubtractiveBlending:
              gl.blendFuncSeparate(gl.ZERO, gl.ONE_MINUS_SRC_COLOR, gl.ZERO, gl.ONE);
              break;
            case MultiplyBlending:
              gl.blendFunc(gl.ZERO, gl.SRC_COLOR);
              break;
            default:
              console.error("WebGLState: Invalid blending: ", blending);
          }
        }
        this.currentBlendSrc = null;
        this.currentBlendDst = null;
        this.currentBlendSrcAlpha = null;
        this.currentBlendDstAlpha = null;
        this.currentBlendColor[0] = 0;
        this.currentBlendColor[1] = 0;
        this.currentBlendColor[2] = 0;
        this.currentBlendAlpha = 0;
        this.currentBlending = blending;
        this.currentPremultipliedAlpha = premultipliedAlpha;
      }
      return;
    }
    blendEquationAlpha = blendEquationAlpha || blendEquation;
    blendSrcAlpha = blendSrcAlpha || blendSrc;
    blendDstAlpha = blendDstAlpha || blendDst;
    if (blendEquation !== this.currentBlendEquation || blendEquationAlpha !== this.currentBlendEquationAlpha) {
      gl.blendEquationSeparate(this.equationToGL[blendEquation], this.equationToGL[blendEquationAlpha]);
      this.currentBlendEquation = blendEquation;
      this.currentBlendEquationAlpha = blendEquationAlpha;
    }
    if (blendSrc !== this.currentBlendSrc || blendDst !== this.currentBlendDst || blendSrcAlpha !== this.currentBlendSrcAlpha || blendDstAlpha !== this.currentBlendDstAlpha) {
      gl.blendFuncSeparate(this.factorToGL[blendSrc], this.factorToGL[blendDst], this.factorToGL[blendSrcAlpha], this.factorToGL[blendDstAlpha]);
      this.currentBlendSrc = blendSrc;
      this.currentBlendDst = blendDst;
      this.currentBlendSrcAlpha = blendSrcAlpha;
      this.currentBlendDstAlpha = blendDstAlpha;
    }
    if (blendColor !== void 0 && (blendColor.r !== this.currentBlendColor[0] || blendColor.g !== this.currentBlendColor[1] || blendColor.b !== this.currentBlendColor[2] || blendAlpha !== this.currentBlendAlpha)) {
      gl.blendColor(blendColor.r, blendColor.g, blendColor.b, blendAlpha);
      this.currentBlendColor[0] = blendColor.r;
      this.currentBlendColor[1] = blendColor.g;
      this.currentBlendColor[2] = blendColor.b;
      this.currentBlendAlpha = blendAlpha;
    }
    this.currentBlending = blending;
    this.currentPremultipliedAlpha = false;
  }
  setMaterial(material, frontFaceCW, side = material.side) {
    const gl = this.gl;
    side === DoubleSide ? this.disable(gl.CULL_FACE) : this.enable(gl.CULL_FACE);
    let flipSided = side === BackSide;
    if (frontFaceCW) flipSided = !flipSided;
    this.setFlipSided(flipSided);
    material.blending === NormalBlending && material.transparent === false ? this.setBlending(NoBlending) : this.setBlending(material.blending, material.blendEquation, material.blendSrc, material.blendDst, material.blendEquationAlpha, material.blendSrcAlpha, material.blendDstAlpha, material.blendColor, material.blendAlpha, material.premultipliedAlpha);
    this.setDepthFunc(material.depthFunc);
    this.setDepthTest(material.depthTest);
    this.setDepthMask(material.depthWrite);
    this.setColorMask(material.colorWrite);
    this.setPolygonOffset(material.polygonOffset, material.polygonOffsetFactor, material.polygonOffsetUnits);
    material.alphaToCoverage === true ? this.enable(gl.SAMPLE_ALPHA_TO_COVERAGE) : this.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    const stencilWrite = material.stencilWrite;
    this.setStencilTest(stencilWrite);
    if (stencilWrite) {
      this.setStencilMask(material.stencilWriteMask);
      this.setStencilFunc(material.stencilFunc, material.stencilRef, material.stencilFuncMask);
      this.setStencilOp(material.stencilFail, material.stencilZFail, material.stencilZPass);
    }
  }
  setStencilTest(stencilTest) {
    if (this.currentStencilTest === stencilTest) return;
    if (stencilTest) this.enable(this.gl.STENCIL_TEST);
    else this.disable(this.gl.STENCIL_TEST);
    this.currentStencilTest = stencilTest;
  }
  setStencilMask(mask) {
    if (this.currentStencilMask !== mask) {
      this.gl.stencilMask(mask);
      this.currentStencilMask = mask;
    }
  }
  setStencilFunc(func, ref, mask) {
    if (this.currentStencilFunc !== func || this.currentStencilRef !== ref || this.currentStencilFuncMask !== mask) {
      this.gl.stencilFunc(func, ref, mask);
      this.currentStencilFunc = func;
      this.currentStencilRef = ref;
      this.currentStencilFuncMask = mask;
    }
  }
  setStencilOp(fail, zfail, zpass) {
    if (this.currentStencilFail !== fail || this.currentStencilZFail !== zfail || this.currentStencilZPass !== zpass) {
      this.gl.stencilOp(fail, zfail, zpass);
      this.currentStencilFail = fail;
      this.currentStencilZFail = zfail;
      this.currentStencilZPass = zpass;
    }
  }
  setFlipSided(flipSided) {
    if (this.currentFlipSided !== flipSided) {
      const gl = this.gl;
      if (flipSided) gl.frontFace(gl.CW);
      else gl.frontFace(gl.CCW);
      this.currentFlipSided = flipSided;
    }
  }
  setCullFace(cullFace) {
    const gl = this.gl;
    if (cullFace !== CullFaceNone) {
      this.enable(gl.CULL_FACE);
      if (cullFace !== this.currentCullFace) {
        if (cullFace === CullFaceBack) gl.cullFace(gl.BACK);
        else if (cullFace === CullFaceFront) gl.cullFace(gl.FRONT);
        else gl.cullFace(gl.FRONT_AND_BACK);
      }
    } else {
      this.disable(gl.CULL_FACE);
    }
    this.currentCullFace = cullFace;
  }
  setLineWidth(width) {
    if (width !== this.currentLineWidth) {
      this.gl.lineWidth(width);
      this.currentLineWidth = width;
    }
  }
  setPolygonOffset(polygonOffset, factor, units) {
    const gl = this.gl;
    if (polygonOffset) {
      this.enable(gl.POLYGON_OFFSET_FILL);
      if (this.currentPolygonOffsetFactor !== factor || this.currentPolygonOffsetUnits !== units) {
        gl.polygonOffset(factor, units);
        this.currentPolygonOffsetFactor = factor;
        this.currentPolygonOffsetUnits = units;
      }
    } else {
      this.disable(gl.POLYGON_OFFSET_FILL);
    }
  }
  setDepthTest(depthTest) {
    if (this.currentDepthTest === depthTest) return;
    if (depthTest) this.enable(this.gl.DEPTH_TEST);
    else this.disable(this.gl.DEPTH_TEST);
    this.currentDepthTest = depthTest;
  }
  setDepthMask(depthMask) {
    if (this.currentDepthMask !== depthMask) {
      this.gl.depthMask(depthMask);
      this.currentDepthMask = depthMask;
    }
  }
  setDepthFunc(depthFunc) {
    if (this.currentDepthFunc === depthFunc) return;
    const gl = this.gl;
    switch (depthFunc) {
      case NeverDepth:
        gl.depthFunc(gl.NEVER);
        break;
      case AlwaysDepth:
        gl.depthFunc(gl.ALWAYS);
        break;
      case LessDepth:
        gl.depthFunc(gl.LESS);
        break;
      case LessEqualDepth:
        gl.depthFunc(gl.LEQUAL);
        break;
      case EqualDepth:
        gl.depthFunc(gl.EQUAL);
        break;
      case GreaterEqualDepth:
        gl.depthFunc(gl.GEQUAL);
        break;
      case GreaterDepth:
        gl.depthFunc(gl.GREATER);
        break;
      case NotEqualDepth:
        gl.depthFunc(gl.NOTEQUAL);
        break;
      default:
        gl.depthFunc(gl.LEQUAL);
    }
    this.currentDepthFunc = depthFunc;
  }
  setColorMask(colorMask) {
    if (this.currentColorMask !== colorMask) {
      this.gl.colorMask(colorMask, colorMask, colorMask, colorMask);
      this.currentColorMask = colorMask;
    }
  }
  setClearColor(r, g, b, a) {
    const c = this.currentClearColor;
    if (c.x !== r || c.y !== g || c.z !== b || c.w !== a) {
      this.gl.clearColor(r, g, b, a);
      c.set(r, g, b, a);
    }
  }
  setClearDepth(depth) {
    if (this.currentClearDepth !== depth) {
      this.gl.clearDepth(depth);
      this.currentClearDepth = depth;
    }
  }
  setClearStencil(stencil) {
    if (this.currentClearStencil !== stencil) {
      this.gl.clearStencil(stencil);
      this.currentClearStencil = stencil;
    }
  }
  viewport(x, y, w, h) {
    const v = this.currentViewport;
    if (v.x !== x || v.y !== y || v.z !== w || v.w !== h) {
      this.gl.viewport(x, y, w, h);
      v.set(x, y, w, h);
    }
  }
  scissor(x, y, w, h) {
    const v = this.currentScissor;
    if (v.x !== x || v.y !== y || v.z !== w || v.w !== h) {
      this.gl.scissor(x, y, w, h);
      v.set(x, y, w, h);
    }
  }
  setScissorTest(scissorTest) {
    if (this.currentScissorTest !== scissorTest) {
      if (scissorTest) this.enable(this.gl.SCISSOR_TEST);
      else this.disable(this.gl.SCISSOR_TEST);
      this.currentScissorTest = scissorTest;
    }
  }
  activeTexture(slot) {
    if (this.currentTextureSlot !== slot) {
      this.gl.activeTexture(this.gl.TEXTURE0 + slot);
      this.currentTextureSlot = slot;
    }
  }
  bindTexture(target, texture, slot) {
    if (slot === void 0) slot = this.currentTextureSlot === null ? 0 : this.currentTextureSlot;
    let bound = this.currentBoundTextures[slot];
    if (bound === void 0) {
      bound = { type: void 0, texture: void 0 };
      this.currentBoundTextures[slot] = bound;
    }
    if (bound.type !== target || bound.texture !== texture) {
      this.activeTexture(slot);
      this.gl.bindTexture(target, texture);
      bound.type = target;
      bound.texture = texture;
    }
  }
  unbindTexture() {
    const bound = this.currentBoundTextures[this.currentTextureSlot];
    if (bound !== void 0 && bound.type !== void 0) {
      this.gl.bindTexture(bound.type, null);
      bound.type = void 0;
      bound.texture = void 0;
    }
  }
  reset() {
    const gl = this.gl;
    gl.disable(gl.BLEND);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ZERO);
    gl.blendFuncSeparate(gl.ONE, gl.ZERO, gl.ONE, gl.ZERO);
    gl.blendColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true);
    gl.clearColor(0, 0, 0, 0);
    gl.depthMask(true);
    gl.depthFunc(gl.LESS);
    gl.clearDepth(1);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);
    gl.polygonOffset(0, 0);
    gl.stencilMask(4294967295);
    gl.stencilFunc(gl.ALWAYS, 0, 4294967295);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(null);
    gl.lineWidth(1);
    gl.bindVertexArray(null);
    this.enabledCapabilities = {};
    this.currentTextureSlot = null;
    this.currentBoundTextures = [];
    this.currentProgram = null;
    this.currentVAO = null;
    this.currentArrayBuffer = null;
    this.currentUniformBuffer = null;
    this.currentUniformBindings = [];
    this.currentFramebuffer = null;
    this.currentBlendingEnabled = false;
    this.currentBlending = null;
    this.currentBlendEquation = null;
    this.currentBlendSrc = null;
    this.currentBlendDst = null;
    this.currentBlendEquationAlpha = null;
    this.currentBlendSrcAlpha = null;
    this.currentBlendDstAlpha = null;
    this.currentBlendColor = [0, 0, 0];
    this.currentBlendAlpha = 0;
    this.currentPremultipliedAlpha = false;
    this.currentFlipSided = null;
    this.currentCullFace = null;
    this.currentLineWidth = null;
    this.currentPolygonOffsetFactor = null;
    this.currentPolygonOffsetUnits = null;
    this.currentDepthMask = null;
    this.currentDepthFunc = null;
    this.currentDepthTest = null;
    this.currentColorMask = null;
    this.currentStencilTest = null;
    this.currentStencilMask = null;
    this.currentStencilFunc = null;
    this.currentStencilRef = null;
    this.currentStencilFuncMask = null;
    this.currentStencilFail = null;
    this.currentStencilZFail = null;
    this.currentStencilZPass = null;
    this.currentClearColor.set(0, 0, 0, 0);
    this.currentClearDepth = null;
    this.currentClearStencil = null;
    this.currentViewport.set(-1, -1, -1, -1);
    this.currentScissor.set(-1, -1, -1, -1);
    this.currentScissorTest = null;
  }
};

// src/renderers/webgl/WebGLAttributes.js
var WebGLAttributes = class {
  constructor(gl) {
    this.gl = gl;
    this.buffers = /* @__PURE__ */ new WeakMap();
  }
  _createBuffer(attribute, bufferType) {
    const gl = this.gl;
    const array = attribute.array;
    const usage = attribute.usage;
    const buffer = gl.createBuffer();
    gl.bindBuffer(bufferType, buffer);
    gl.bufferData(bufferType, array, usage);
    attribute.onUploadCallback();
    let type;
    if (array instanceof Float32Array) type = gl.FLOAT;
    else if (array instanceof Uint16Array) type = attribute.isFloat16BufferAttribute ? gl.HALF_FLOAT : gl.UNSIGNED_SHORT;
    else if (array instanceof Int16Array) type = gl.SHORT;
    else if (array instanceof Uint32Array) type = gl.UNSIGNED_INT;
    else if (array instanceof Int32Array) type = gl.INT;
    else if (array instanceof Int8Array) type = gl.BYTE;
    else if (array instanceof Uint8Array) type = gl.UNSIGNED_BYTE;
    else if (array instanceof Uint8ClampedArray) type = gl.UNSIGNED_BYTE;
    else throw new Error("WebGLAttributes: Unsupported buffer data format: " + array);
    return { buffer, type, bytesPerElement: array.BYTES_PER_ELEMENT, version: attribute.version, size: array.byteLength };
  }
  _updateBuffer(buffer, attribute, bufferType) {
    const gl = this.gl;
    const array = attribute.array;
    const updateRanges = attribute.updateRanges;
    gl.bindBuffer(bufferType, buffer);
    if (updateRanges.length === 0) {
      gl.bufferSubData(bufferType, 0, array);
    } else {
      updateRanges.sort((a, b) => a.start - b.start);
      let mergeIndex = 0;
      for (let i = 1; i < updateRanges.length; i++) {
        const previousRange = updateRanges[mergeIndex], range = updateRanges[i];
        if (range.start <= previousRange.start + previousRange.count + 1) {
          previousRange.count = Math.max(previousRange.count, range.start + range.count - previousRange.start);
        } else {
          ++mergeIndex;
          updateRanges[mergeIndex] = range;
        }
      }
      updateRanges.length = mergeIndex + 1;
      for (let i = 0, l = updateRanges.length; i < l; i++) {
        const range = updateRanges[i];
        gl.bufferSubData(bufferType, range.start * array.BYTES_PER_ELEMENT, array, range.start, range.count);
      }
      attribute.clearUpdateRanges();
    }
    attribute.onUploadCallback();
  }
  get(attribute) {
    if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
    return this.buffers.get(attribute);
  }
  remove(attribute) {
    if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
    const data = this.buffers.get(attribute);
    if (data) {
      this.gl.deleteBuffer(data.buffer);
      this.buffers.delete(attribute);
    }
  }
  /** Ensures the GPU buffer exists and is current. Returns the record. */
  update(attribute, bufferType) {
    if (attribute.isInterleavedBufferAttribute) attribute = attribute.data;
    let data = this.buffers.get(attribute);
    if (data === void 0) {
      data = this._createBuffer(attribute, bufferType);
      this.buffers.set(attribute, data);
    } else if (data.version < attribute.version) {
      if (data.size !== attribute.array.byteLength) {
        this.gl.deleteBuffer(data.buffer);
        const fresh = this._createBuffer(attribute, bufferType);
        data.buffer = fresh.buffer;
        data.type = fresh.type;
        data.bytesPerElement = fresh.bytesPerElement;
        data.size = fresh.size;
      } else {
        this._updateBuffer(data.buffer, attribute, bufferType);
      }
      data.version = attribute.version;
    }
    return data;
  }
};

// src/renderers/webgl/WebGLTextures.js
var WebGLTextures = class {
  constructor(gl, state, info) {
    this.gl = gl;
    this.state = state;
    this.info = info;
    this.properties = /* @__PURE__ */ new WeakMap();
    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.anisotropyExt = gl.getExtension("EXT_texture_filter_anisotropic");
    this.maxAnisotropy = this.anisotropyExt ? gl.getParameter(this.anisotropyExt.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
    this.floatLinearExt = gl.getExtension("OES_texture_float_linear");
    this.colorBufferFloatExt = gl.getExtension("EXT_color_buffer_float");
    this._onTextureDispose = this._onTextureDispose.bind(this);
    this._onRenderTargetDispose = this._onRenderTargetDispose.bind(this);
    this.wrapToGL = { [RepeatWrapping]: gl.REPEAT, [ClampToEdgeWrapping]: gl.CLAMP_TO_EDGE, [MirroredRepeatWrapping]: gl.MIRRORED_REPEAT };
    this.filterToGL = {
      [NearestFilter]: gl.NEAREST,
      [NearestMipmapNearestFilter]: gl.NEAREST_MIPMAP_NEAREST,
      [NearestMipmapLinearFilter]: gl.NEAREST_MIPMAP_LINEAR,
      [LinearFilter]: gl.LINEAR,
      [LinearMipmapNearestFilter]: gl.LINEAR_MIPMAP_NEAREST,
      [LinearMipmapLinearFilter]: gl.LINEAR_MIPMAP_LINEAR
    };
    this.compareToGL = {
      [NeverStencilFunc]: gl.NEVER,
      [LessStencilFunc]: gl.LESS,
      [EqualStencilFunc]: gl.EQUAL,
      [LessEqualStencilFunc]: gl.LEQUAL,
      [GreaterStencilFunc]: gl.GREATER,
      [NotEqualStencilFunc]: gl.NOTEQUAL,
      [GreaterEqualStencilFunc]: gl.GEQUAL,
      [AlwaysStencilFunc]: gl.ALWAYS
    };
  }
  get(obj) {
    let p = this.properties.get(obj);
    if (p === void 0) {
      p = {};
      this.properties.set(obj, p);
    }
    return p;
  }
  _onTextureDispose(event) {
    const texture = event.target;
    texture.removeEventListener("dispose", this._onTextureDispose);
    const p = this.properties.get(texture);
    if (p !== void 0 && p.webglTexture !== void 0) {
      this.gl.deleteTexture(p.webglTexture);
      this.info.memory.textures--;
    }
    this.properties.delete(texture);
  }
  _onRenderTargetDispose(event) {
    const renderTarget = event.target;
    renderTarget.removeEventListener("dispose", this._onRenderTargetDispose);
    const p = this.properties.get(renderTarget);
    if (p !== void 0) {
      if (p.framebuffer) this.gl.deleteFramebuffer(p.framebuffer);
      if (p.depthbuffer) this.gl.deleteRenderbuffer(p.depthbuffer);
    }
    const tp = this.properties.get(renderTarget.texture);
    if (tp !== void 0 && tp.webglTexture !== void 0) {
      this.gl.deleteTexture(tp.webglTexture);
      this.info.memory.textures--;
    }
    if (renderTarget.depthTexture) {
      const dp = this.properties.get(renderTarget.depthTexture);
      if (dp !== void 0 && dp.webglTexture !== void 0) {
        this.gl.deleteTexture(dp.webglTexture);
        this.info.memory.textures--;
      }
      this.properties.delete(renderTarget.depthTexture);
    }
    this.properties.delete(renderTarget.texture);
    this.properties.delete(renderTarget);
  }
  glType(type) {
    const gl = this.gl;
    switch (type) {
      case UnsignedByteType:
        return gl.UNSIGNED_BYTE;
      case ByteType:
        return gl.BYTE;
      case ShortType:
        return gl.SHORT;
      case UnsignedShortType:
        return gl.UNSIGNED_SHORT;
      case IntType:
        return gl.INT;
      case UnsignedIntType:
        return gl.UNSIGNED_INT;
      case FloatType:
        return gl.FLOAT;
      case HalfFloatType:
        return gl.HALF_FLOAT;
      case UnsignedShort4444Type:
        return gl.UNSIGNED_SHORT_4_4_4_4;
      case UnsignedShort5551Type:
        return gl.UNSIGNED_SHORT_5_5_5_1;
      case UnsignedInt248Type:
        return gl.UNSIGNED_INT_24_8;
      default:
        return gl.UNSIGNED_BYTE;
    }
  }
  glFormat(format) {
    const gl = this.gl;
    switch (format) {
      case RGBAFormat:
        return gl.RGBA;
      case RGBFormat:
        return gl.RGB;
      case RedFormat:
        return gl.RED;
      case RGFormat:
        return gl.RG;
      case AlphaFormat:
        return gl.ALPHA;
      case LuminanceFormat:
        return gl.LUMINANCE;
      case LuminanceAlphaFormat:
        return gl.LUMINANCE_ALPHA;
      case DepthFormat:
        return gl.DEPTH_COMPONENT;
      case DepthStencilFormat:
        return gl.DEPTH_STENCIL;
      case RedIntegerFormat:
        return gl.RED_INTEGER;
      case RGIntegerFormat:
        return gl.RG_INTEGER;
      case RGBAIntegerFormat:
        return gl.RGBA_INTEGER;
      default:
        return gl.RGBA;
    }
  }
  glInternalFormat(internalFormatName, glFormat, glType, colorSpace, forceLinearTransfer = false) {
    const gl = this.gl;
    if (internalFormatName !== null) {
      if (gl[internalFormatName] !== void 0) return gl[internalFormatName];
      console.warn("WebGLTextures: Attempt to use non-existing WebGL internal format '" + internalFormatName + "'");
    }
    let internalFormat = glFormat;
    if (glFormat === gl.RED) {
      if (glType === gl.FLOAT) internalFormat = gl.R32F;
      if (glType === gl.HALF_FLOAT) internalFormat = gl.R16F;
      if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8;
    }
    if (glFormat === gl.RED_INTEGER) {
      if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.R8UI;
      if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.R16UI;
      if (glType === gl.UNSIGNED_INT) internalFormat = gl.R32UI;
      if (glType === gl.BYTE) internalFormat = gl.R8I;
      if (glType === gl.SHORT) internalFormat = gl.R16I;
      if (glType === gl.INT) internalFormat = gl.R32I;
    }
    if (glFormat === gl.RG) {
      if (glType === gl.FLOAT) internalFormat = gl.RG32F;
      if (glType === gl.HALF_FLOAT) internalFormat = gl.RG16F;
      if (glType === gl.UNSIGNED_BYTE) internalFormat = gl.RG8;
    }
    if (glFormat === gl.RGB) {
      if (glType === gl.FLOAT) internalFormat = gl.RGB32F;
      if (glType === gl.HALF_FLOAT) internalFormat = gl.RGB16F;
      if (glType === gl.UNSIGNED_BYTE) internalFormat = colorSpace === SRGBColorSpace && forceLinearTransfer === false ? gl.SRGB8 : gl.RGB8;
    }
    if (glFormat === gl.RGBA) {
      if (glType === gl.FLOAT) internalFormat = gl.RGBA32F;
      if (glType === gl.HALF_FLOAT) internalFormat = gl.RGBA16F;
      if (glType === gl.UNSIGNED_BYTE) internalFormat = colorSpace === SRGBColorSpace && forceLinearTransfer === false ? gl.SRGB8_ALPHA8 : gl.RGBA8;
      if (glType === gl.UNSIGNED_SHORT_4_4_4_4) internalFormat = gl.RGBA4;
      if (glType === gl.UNSIGNED_SHORT_5_5_5_1) internalFormat = gl.RGB5_A1;
    }
    if (glFormat === gl.DEPTH_COMPONENT) {
      if (glType === gl.UNSIGNED_SHORT) internalFormat = gl.DEPTH_COMPONENT16;
      if (glType === gl.UNSIGNED_INT) internalFormat = gl.DEPTH_COMPONENT24;
      if (glType === gl.FLOAT) internalFormat = gl.DEPTH_COMPONENT32F;
    }
    if (glFormat === gl.DEPTH_STENCIL) {
      if (glType === gl.UNSIGNED_INT_24_8) internalFormat = gl.DEPTH24_STENCIL8;
    }
    return internalFormat;
  }
  _textureNeedsMipmaps(texture) {
    return texture.generateMipmaps && texture.minFilter !== NearestFilter && texture.minFilter !== LinearFilter;
  }
  _setTextureParameters(target, texture) {
    const gl = this.gl;
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, this.wrapToGL[texture.wrapS]);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, this.wrapToGL[texture.wrapT]);
    if (target === gl.TEXTURE_3D || target === gl.TEXTURE_2D_ARRAY) gl.texParameteri(target, gl.TEXTURE_WRAP_R, this.wrapToGL[texture.wrapR !== void 0 ? texture.wrapR : texture.wrapS]);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, this.filterToGL[texture.magFilter]);
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, this.filterToGL[texture.minFilter]);
    if (texture.compareFunction) {
      gl.texParameteri(target, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
      gl.texParameteri(target, gl.TEXTURE_COMPARE_FUNC, this.compareToGL[texture.compareFunction]);
    }
    if (this.anisotropyExt && texture.anisotropy > 1) {
      if (texture.type === FloatType && this.floatLinearExt === null) return;
      gl.texParameterf(target, this.anisotropyExt.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(texture.anisotropy, this.maxAnisotropy));
    }
  }
  /** Binds `texture` to texture unit `slot`, uploading it first if needed. */
  setTexture2D(texture, slot) {
    const gl = this.gl, state = this.state;
    const p = this.get(texture);
    if (texture.isRenderTargetTexture === false && texture.version > 0 && p.version !== texture.version) {
      const image = texture.image;
      if (image === null) {
        console.warn("WebGLTextures: Texture marked for update but no image data found.");
      } else if (image.complete === false) {
        console.warn("WebGLTextures: Texture marked for update but image is incomplete");
      } else {
        this._uploadTexture(p, texture, slot);
        return;
      }
    }
    if (p.webglTexture === void 0) {
      p.webglTexture = gl.createTexture();
      this.info.memory.textures++;
      texture.addEventListener("dispose", this._onTextureDispose);
      state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      return;
    }
    state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
  }
  _uploadTexture(p, texture, slot) {
    const gl = this.gl, state = this.state;
    if (p.webglTexture === void 0) {
      p.webglTexture = gl.createTexture();
      this.info.memory.textures++;
      texture.addEventListener("dispose", this._onTextureDispose);
    }
    state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const image = texture.image;
    const glFormat = this.glFormat(texture.format);
    const glType = this.glType(texture.type);
    const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace, texture.isVideoTexture);
    this._setTextureParameters(gl.TEXTURE_2D, texture);
    const mipmaps = texture.mipmaps;
    const useMipmaps = this._textureNeedsMipmaps(texture);
    if (texture.isDataTexture || texture.isDepthTexture) {
      const levels = useMipmaps ? Math.floor(Math.log2(Math.max(image.width, image.height))) + 1 : 1;
      if (p.allocated !== true || p.width !== image.width || p.height !== image.height) {
        if (p.allocated === true) {
          gl.deleteTexture(p.webglTexture);
          p.webglTexture = gl.createTexture();
          state.bindTexture(gl.TEXTURE_2D, p.webglTexture, slot);
          this._setTextureParameters(gl.TEXTURE_2D, texture);
        }
        gl.texStorage2D(gl.TEXTURE_2D, levels, glInternalFormat, image.width, image.height);
        p.allocated = true;
        p.width = image.width;
        p.height = image.height;
      }
      if (image.data !== void 0 && image.data !== null) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, image.width, image.height, glFormat, glType, image.data);
      }
      if (useMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    } else {
      const w = image.width !== void 0 ? image.width : image.videoWidth, h = image.height !== void 0 ? image.height : image.videoHeight;
      if (mipmaps.length > 0) {
        for (let i = 0, il = mipmaps.length; i < il; i++) {
          const mipmap = mipmaps[i];
          gl.texImage2D(gl.TEXTURE_2D, i, glInternalFormat, glFormat, glType, mipmap);
        }
        texture.generateMipmaps = false;
      } else if (p.allocated === true && p.width === w && p.height === h && texture.isVideoTexture) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, glFormat, glType, image);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, glFormat, glType, image);
        p.allocated = true;
        p.width = w;
        p.height = h;
      }
      if (useMipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    }
    p.version = texture.version;
    if (texture.onUpdate) texture.onUpdate(texture);
  }
  /** Binds a Data3DTexture to `slot`, uploading on version change. */
  setTexture3D(texture, slot) {
    this._setTextureLayered(texture, slot, this.gl.TEXTURE_3D);
  }
  /** Binds a DataArrayTexture to `slot`, uploading on version change (honours layerUpdates). */
  setTexture2DArray(texture, slot) {
    this._setTextureLayered(texture, slot, this.gl.TEXTURE_2D_ARRAY);
  }
  _setTextureLayered(texture, slot, target) {
    const gl = this.gl, state = this.state;
    const p = this.get(texture);
    if (p.webglTexture === void 0) {
      p.webglTexture = gl.createTexture();
      this.info.memory.textures++;
      texture.addEventListener("dispose", this._onTextureDispose);
    }
    state.bindTexture(target, p.webglTexture, slot);
    if (p.version === texture.version || texture.image === null) return;
    const image = texture.image;
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
    const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
    this._setTextureParameters(target, texture);
    const useMipmaps = this._textureNeedsMipmaps(texture);
    const levels = useMipmaps ? Math.floor(Math.log2(Math.max(image.width, image.height, target === gl.TEXTURE_3D ? image.depth : 1))) + 1 : 1;
    if (p.allocated !== true || p.width !== image.width || p.height !== image.height || p.depth !== image.depth || p.levels !== levels) {
      if (p.allocated === true) {
        gl.deleteTexture(p.webglTexture);
        p.webglTexture = gl.createTexture();
        state.bindTexture(target, p.webglTexture, slot);
        this._setTextureParameters(target, texture);
      }
      gl.texStorage3D(target, levels, glInternalFormat, image.width, image.height, image.depth);
      p.allocated = true;
      p.width = image.width;
      p.height = image.height;
      p.depth = image.depth;
      p.levels = levels;
      p.fullUploadNeeded = true;
    }
    if (image.data !== void 0 && image.data !== null) {
      const layerUpdates = texture.layerUpdates;
      if (target === gl.TEXTURE_2D_ARRAY && layerUpdates !== void 0 && layerUpdates.size > 0 && p.fullUploadNeeded !== true) {
        const layerBytes = getByteLength(image.width, image.height, texture.format, texture.type);
        for (const layerIndex of layerUpdates) {
          const layerData = image.data.subarray(layerIndex * layerBytes / image.data.BYTES_PER_ELEMENT, (layerIndex + 1) * layerBytes / image.data.BYTES_PER_ELEMENT);
          gl.texSubImage3D(target, 0, 0, 0, layerIndex, image.width, image.height, 1, glFormat, glType, layerData);
        }
        texture.clearLayerUpdates();
      } else {
        gl.texSubImage3D(target, 0, 0, 0, 0, image.width, image.height, image.depth, glFormat, glType, image.data);
      }
      p.fullUploadNeeded = false;
    }
    if (useMipmaps) gl.generateMipmap(target);
    p.version = texture.version;
    if (texture.onUpdate) texture.onUpdate(texture);
  }
  /** Binds a CubeTexture (six images or six DataTexture-like objects) to `slot`. */
  setTextureCube(texture, slot) {
    const gl = this.gl, state = this.state;
    const p = this.get(texture);
    if (p.webglTexture === void 0) {
      p.webglTexture = gl.createTexture();
      this.info.memory.textures++;
      texture.addEventListener("dispose", this._onTextureDispose);
    }
    state.bindTexture(gl.TEXTURE_CUBE_MAP, p.webglTexture, slot);
    const images = texture.image;
    if (p.version === texture.version || !Array.isArray(images) || images.length < 6) return;
    for (let i = 0; i < 6; i++) {
      const im = images[i];
      if (!im || im.complete === false) return;
    }
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, texture.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, texture.premultiplyAlpha);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, texture.unpackAlignment);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
    const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
    this._setTextureParameters(gl.TEXTURE_CUBE_MAP, texture);
    for (let i = 0; i < 6; i++) {
      const im = images[i];
      if (im.isDataTexture || im.data !== void 0 && im.width !== void 0) {
        const d = im.isDataTexture ? im.image : im;
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, d.width, d.height, 0, glFormat, glType, d.data);
      } else {
        gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, glInternalFormat, glFormat, glType, im);
      }
    }
    if (this._textureNeedsMipmaps(texture)) gl.generateMipmap(gl.TEXTURE_CUBE_MAP);
    p.version = texture.version;
    if (texture.onUpdate) texture.onUpdate(texture);
  }
  /** Sets up (once) and binds a render target's framebuffer. */
  setupRenderTarget(renderTarget) {
    const gl = this.gl, state = this.state;
    const p = this.get(renderTarget);
    const texture = renderTarget.texture;
    const tp = this.get(texture);
    if (p.framebuffer === void 0) {
      renderTarget.addEventListener("dispose", this._onRenderTargetDispose);
      texture.isRenderTargetTexture = true;
      p.framebuffer = gl.createFramebuffer();
      state.bindFramebuffer(p.framebuffer);
      if (renderTarget.depthOnly !== true) {
        tp.webglTexture = gl.createTexture();
        this.info.memory.textures++;
        state.bindTexture(gl.TEXTURE_2D, tp.webglTexture, 0);
        this._setTextureParameters(gl.TEXTURE_2D, texture);
        const glFormat = this.glFormat(texture.format), glType = this.glType(texture.type);
        const glInternalFormat = this.glInternalFormat(texture.internalFormat, glFormat, glType, texture.colorSpace);
        gl.texImage2D(gl.TEXTURE_2D, 0, glInternalFormat, renderTarget.width, renderTarget.height, 0, glFormat, glType, null);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tp.webglTexture, 0);
        tp.version = texture.version;
      } else {
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);
      }
      if (renderTarget.depthTexture) {
        const dt = renderTarget.depthTexture;
        const dp = this.get(dt);
        dp.webglTexture = gl.createTexture();
        this.info.memory.textures++;
        dt.isRenderTargetTexture = true;
        state.bindTexture(gl.TEXTURE_2D, dp.webglTexture, 0);
        this._setTextureParameters(gl.TEXTURE_2D, dt);
        const glFormat = this.glFormat(dt.format), glType = this.glType(dt.type);
        const glInternalFormat = this.glInternalFormat(null, glFormat, glType);
        gl.texStorage2D(gl.TEXTURE_2D, 1, glInternalFormat, renderTarget.width, renderTarget.height);
        const attachment = dt.format === DepthStencilFormat ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachment, gl.TEXTURE_2D, dp.webglTexture, 0);
        dp.version = dt.version;
      } else if (renderTarget.depthBuffer) {
        p.depthbuffer = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, p.depthbuffer);
        if (renderTarget.stencilBuffer) {
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, renderTarget.width, renderTarget.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, p.depthbuffer);
        } else {
          gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, renderTarget.width, renderTarget.height);
          gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, p.depthbuffer);
        }
        gl.bindRenderbuffer(gl.RENDERBUFFER, null);
      }
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) console.error("WebGLTextures: render target framebuffer incomplete: 0x" + status.toString(16));
      p.width = renderTarget.width;
      p.height = renderTarget.height;
    } else if (p.width !== renderTarget.width || p.height !== renderTarget.height) {
      this._onRenderTargetDispose({ target: renderTarget });
      renderTarget.addEventListener("dispose", this._onRenderTargetDispose);
      return this.setupRenderTarget(renderTarget);
    }
    return p.framebuffer;
  }
  /** Regenerates mipmaps for a render target texture after rendering to it. */
  updateRenderTargetMipmap(renderTarget) {
    const texture = renderTarget.texture;
    if (this._textureNeedsMipmaps(texture)) {
      const tp = this.get(texture);
      this.state.bindTexture(this.gl.TEXTURE_2D, tp.webglTexture, 0);
      this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }
  }
};
function getByteLength(width, height, format, type) {
  const typeBytes = type === FloatType || type === UnsignedIntType || type === IntType ? 4 : type === HalfFloatType || type === UnsignedShortType || type === ShortType ? 2 : 1;
  let components = 4;
  switch (format) {
    case RedFormat:
    case RedIntegerFormat:
    case AlphaFormat:
    case LuminanceFormat:
    case DepthFormat:
      components = 1;
      break;
    case RGFormat:
    case RGIntegerFormat:
    case LuminanceAlphaFormat:
      components = 2;
      break;
    case RGBFormat:
      components = 3;
      break;
    default:
      components = 4;
  }
  return width * height * components * typeBytes;
}

// src/renderers/shaders/ShaderChunk.js
var ShaderChunk = {
  alphahash_fragment: `
#ifdef USE_ALPHAHASH

	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;

#endif
`,
  alphahash_pars_fragment: `
#ifdef USE_ALPHAHASH

	/**
	 * See: https://casual-effects.com/research/Wyman2017Hashed/index.html
	 */

	const float ALPHA_HASH_SCALE = 0.05; // Derived from trials only, and may be changed.

	float hash2D( vec2 value ) {

		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );

	}

	float hash3D( vec3 value ) {

		return hash2D( vec2( hash2D( value.xy ), value.z ) );

	}

	float getAlphaHashThreshold( vec3 position ) {

		// Find the discretized derivatives of our coordinates
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );

		// Find two nearest log-discretized noise scales
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);

		// Compute alpha thresholds at our two noise scales
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);

		// Factor to interpolate lerp with
		float lerpFactor = fract( log2( pixScale ) );

		// Interpolate alpha threshold from noise at two scales
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;

		// Pass into CDF to compute uniformly distrib threshold
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);

		// Find our final, uniformly distributed alpha threshold (\u03B1\u03C4)
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;

		// Avoids \u03B1\u03C4 == 0. Could also do \u03B1\u03C4 =1-\u03B1\u03C4
		return clamp( threshold , 1.0e-6, 1.0 );

	}

#endif
`,
  alphamap_fragment: `
#ifdef USE_ALPHAMAP

	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;

#endif
`,
  alphamap_pars_fragment: `
#ifdef USE_ALPHAMAP

	uniform sampler2D alphaMap;

#endif
`,
  alphatest_fragment: `
#ifdef USE_ALPHATEST

	#ifdef ALPHA_TO_COVERAGE

	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;

	#else

	if ( diffuseColor.a < alphaTest ) discard;

	#endif

#endif
`,
  alphatest_pars_fragment: `
#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif
`,
  aomap_fragment: `
#ifdef USE_AOMAP

	// reads channel R, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;

	reflectedLight.indirectDiffuse *= ambientOcclusion;

	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif

	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif

	#if defined( USE_ENVMAP ) && defined( STANDARD )

		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );

		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );

	#endif

#endif
`,
  aomap_pars_fragment: `
#ifdef USE_AOMAP

	uniform sampler2D aoMap;
	uniform float aoMapIntensity;

#endif
`,
  batching_pars_vertex: `
#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif

	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {

		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );

	}

	float getIndirectIndex( const in int i ) {

		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );

	}

#endif

#ifdef USE_BATCHING_COLOR

	uniform sampler2D batchingColorTexture;
	vec4 getBatchingColor( const in float i ) {

		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 );

	}

#endif
`,
  batching_vertex: `
#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif
`,
  begin_vertex: `
vec3 transformed = vec3( position );

#ifdef USE_ALPHAHASH

	vPosition = vec3( position );

#endif
`,
  beginnormal_vertex: `
vec3 objectNormal = vec3( normal );

#ifdef USE_TANGENT

	vec3 objectTangent = vec3( tangent.xyz );

#endif
`,
  bsdfs: `

float G_BlinnPhong_Implicit( /* const in float dotNL, const in float dotNV */ ) {

	// geometry term is (n dot l)(n dot v) / 4(n dot l)(n dot v)
	return 0.25;

}

float D_BlinnPhong( const in float shininess, const in float dotNH ) {

	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );

}

vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );

	vec3 F = F_Schlick( specularColor, 1.0, dotVH );

	float G = G_BlinnPhong_Implicit( /* dotNL, dotNV */ );

	float D = D_BlinnPhong( shininess, dotNH );

	return F * ( G * D );

} // validated

`,
  iridescence_fragment: `

#ifdef USE_IRIDESCENCE

	// XYZ to linear-sRGB color space
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);

	// Assume air interface for top
	// Note: We don't handle the case fresnel0 == 1
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {

		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );

	}

	// Conversion FO/IOR
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {

		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );

	}

	// ior is a value between 1.0 and 3.0. 1.0 is air interface
	float IorToFresnel0( float transmittedIor, float incidentIor ) {

		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));

	}

	// Fresnel equations for dielectric/dielectric interfaces.
	// Ref: https://belcour.github.io/blog/research/2017/05/01/brdf-thin-film.html
	// Evaluation XYZ sensitivity curves in Fourier space
	vec3 evalSensitivity( float OPD, vec3 shift ) {

		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );

		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;

		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;

	}

	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {

		vec3 I;

		// Force iridescenceIOR -> outsideIOR when thinFilmThickness -> 0.0
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		// Evaluate the cosTheta on the base layer (Snell law)
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );

		// Handle TIR:
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {

			return vec3( 1.0 );

		}

		float cosTheta2 = sqrt( cosTheta2Sq );

		// First interface
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;

		// Second interface
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) ); // guard against 1.0
		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;

		// Phase shift
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;

		// Compound terms
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );

		// Reflectance term for m = 0 (DC term amplitude)
		vec3 C0 = R12 + Rs;
		I = C0;

		// Reflectance term for m > 0 (pairs of diracs)
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {

			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;

		}

		// Since out of gamut colors might be produced, negative color values are clamped to 0.
		return max( I, vec3( 0.0 ) );

	}

#endif

`,
  bumpmap_pars_fragment: `
#ifdef USE_BUMPMAP

	uniform sampler2D bumpMap;
	uniform float bumpScale;

	// Bump Mapping Unparametrized Surfaces on the GPU by Morten S. Mikkelsen
	// https://mmikk.github.io/papers3d/mm_sfgrad_bump.pdf

	// Evaluate the derivative of the height w.r.t. screen-space using forward differencing (listing 2)

	vec2 dHdxy_fwd() {

		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );

		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;

		return vec2( dBx, dBy );

	}

	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {

		// normalize is done to ensure that the bump map looks the same regardless of the texture's scale
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm; // normalized

		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );

		float fDet = dot( vSigmaX, R1 ) * faceDirection;

		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );

	}

#endif
`,
  clipping_planes_fragment: `
#if NUM_CLIPPING_PLANES > 0

	vec4 plane;

	#ifdef ALPHA_TO_COVERAGE

		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;

		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {

			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );

			if ( clipOpacity == 0.0 ) discard;

		}
		#pragma unroll_loop_end

		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES

			float unionClipOpacity = 1.0;

			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {

				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );

			}
			#pragma unroll_loop_end

			clipOpacity *= 1.0 - unionClipOpacity;

		#endif

		diffuseColor.a *= clipOpacity;

		if ( diffuseColor.a == 0.0 ) discard;

	#else

		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {

			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;

		}
		#pragma unroll_loop_end

		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES

			bool clipped = true;

			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {

				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;

			}
			#pragma unroll_loop_end

			if ( clipped ) discard;

		#endif

	#endif

#endif
`,
  clipping_planes_pars_fragment: `
#if NUM_CLIPPING_PLANES > 0

	varying vec3 vClipPosition;

	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];

#endif
`,
  clipping_planes_pars_vertex: `
#if NUM_CLIPPING_PLANES > 0

	varying vec3 vClipPosition;

#endif
`,
  clipping_planes_vertex: `
#if NUM_CLIPPING_PLANES > 0

	vClipPosition = - mvPosition.xyz;

#endif
`,
  color_fragment: `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )

	diffuseColor *= vColor;

#endif
`,
  color_pars_fragment: `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )

	varying vec4 vColor;

#endif
`,
  color_pars_vertex: `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )

	varying vec4 vColor;

#endif
`,
  color_vertex: `
#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )

	vColor = vec4( 1.0 );

#endif

#ifdef USE_COLOR_ALPHA

	vColor *= color;

#elif defined( USE_COLOR )

	vColor.rgb *= color;

#endif

#ifdef USE_INSTANCING_COLOR

	vColor.rgb *= instanceColor.rgb;

#endif

#ifdef USE_BATCHING_COLOR

	vColor *= getBatchingColor( getIndirectIndex( gl_DrawID ) );

#endif
`,
  common: `
#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6

#ifndef saturate
// <tonemapping_pars_fragment> may have defined saturate() already
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )

float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }

// expects values in the range of [0,1]x[0,1], returns values in the [0,1] range.
// do not collapse into a single function per: http://byteblacksmith.com/improvements-to-the-canonical-one-liner-glsl-rand-for-opengl-es-2-0/
highp float rand( const in vec2 uv ) {

	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );

	return fract( sin( sn ) * c );

}

#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif

struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};

struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};

#ifdef USE_ALPHAHASH

	varying vec3 vPosition;

#endif

vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

}

#define inverseTransformDirection transformDirectionByInverseViewMatrix // @deprecated r185

vec3 transformNormalByInverseViewMatrix( in vec3 normal, in mat4 viewMatrix ) {

	// upper-left 3x3 of view matrix is assumed to be orthogonal

	return normalize( ( vec4( normal, 0.0 ) * viewMatrix ).xyz );

}

vec3 transformDirectionByInverseViewMatrix( in vec3 dir, in mat4 viewMatrix ) {

	// upper-left 3x3 of view matrix is assumed to be orthogonal

	return normalize( ( vec4( dir, 0.0 ) * viewMatrix ).xyz );

}

bool isPerspectiveMatrix( mat4 m ) {

	return m[ 2 ][ 3 ] == - 1.0;

}

vec2 equirectUv( in vec3 dir ) {

	// dir is assumed to be unit length

	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;

	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;

	return vec2( u, v );

}

vec3 BRDF_Lambert( const in vec3 diffuseColor ) {

	return RECIPROCAL_PI * diffuseColor;

} // validated

vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {

	// Original approximation by Christophe Schlick '94
	// float fresnel = pow( 1.0 - dotVH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

} // validated

float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {

	// Original approximation by Christophe Schlick '94
	// float fresnel = pow( 1.0 - dotVH, 5.0 );

	// Optimized variant (presented by Epic at SIGGRAPH '13)
	// https://cdn2.unrealengine.com/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );

	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );

} // validated
`,
  cube_uv_reflection_fragment: `
#ifdef ENVMAP_TYPE_CUBE_UV

	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0

	// These shader functions convert between the UV coordinates of a single face of
	// a cubemap, the 0-5 integer index of a cube face, and the direction vector for
	// sampling a textureCube (not generally normalized ).

	float getFace( vec3 direction ) {

		vec3 absDirection = abs( direction );

		float face = - 1.0;

		if ( absDirection.x > absDirection.z ) {

			if ( absDirection.x > absDirection.y )

				face = direction.x > 0.0 ? 0.0 : 3.0;

			else

				face = direction.y > 0.0 ? 1.0 : 4.0;

		} else {

			if ( absDirection.z > absDirection.y )

				face = direction.z > 0.0 ? 2.0 : 5.0;

			else

				face = direction.y > 0.0 ? 1.0 : 4.0;

		}

		return face;

	}

	// RH coordinate system; PMREM face-indexing convention
	vec2 getUV( vec3 direction, float face ) {

		vec2 uv;

		if ( face == 0.0 ) {

			uv = vec2( direction.z, direction.y ) / abs( direction.x ); // pos x

		} else if ( face == 1.0 ) {

			uv = vec2( - direction.x, - direction.z ) / abs( direction.y ); // pos y

		} else if ( face == 2.0 ) {

			uv = vec2( - direction.x, direction.y ) / abs( direction.z ); // pos z

		} else if ( face == 3.0 ) {

			uv = vec2( - direction.z, direction.y ) / abs( direction.x ); // neg x

		} else if ( face == 4.0 ) {

			uv = vec2( - direction.x, direction.z ) / abs( direction.y ); // neg y

		} else {

			uv = vec2( direction.x, direction.y ) / abs( direction.z ); // neg z

		}

		return 0.5 * ( uv + 1.0 );

	}

	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {

		float face = getFace( direction );

		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );

		mipInt = max( mipInt, cubeUV_minMipLevel );

		float faceSize = exp2( mipInt );

		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0; // #25071

		if ( face > 2.0 ) {

			uv.y += faceSize;

			face -= 3.0;

		}

		uv.x += face * faceSize;

		uv.x += filterInt * 3.0 * cubeUV_minTileSize;

		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );

		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;

		#ifdef texture2DGradEXT

			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb; // disable anisotropic filtering

		#else

			return texture2D( envMap, uv ).rgb;

		#endif

	}

	// These defines must match with PMREMGenerator

	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0

	float roughnessToMip( float roughness ) {

		float mip = 0.0;

		if ( roughness >= cubeUV_r1 ) {

			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;

		} else if ( roughness >= cubeUV_r4 ) {

			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;

		} else if ( roughness >= cubeUV_r5 ) {

			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;

		} else if ( roughness >= cubeUV_r6 ) {

			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;

		} else {

			mip = - 2.0 * log2( 1.16 * roughness ); // 1.16 = 1.79^0.25
		}

		return mip;

	}

	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {

		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );

		float mipF = fract( mip );

		float mipInt = floor( mip );

		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );

		if ( mipF == 0.0 ) {

			return vec4( color0, 1.0 );

		} else {

			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );

			return vec4( mix( color0, color1, mipF ), 1.0 );

		}

	}

#endif
`,
  defaultnormal_vertex: `

vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT

	vec3 transformedTangent = objectTangent;

#endif

#ifdef USE_BATCHING

	// this is in lieu of a per-instance normal-matrix
	// non-uniform scaling in the instance matrix is supported
	// shear transforms are not supported

	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;

	#ifdef USE_TANGENT

		transformedTangent = bm * transformedTangent;

	#endif

#endif

#ifdef USE_INSTANCING

	// this is in lieu of a per-instance normal-matrix
	// non-uniform scaling in the instance matrix is supported
	// shear transforms are not supported

	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;

	#ifdef USE_TANGENT

		transformedTangent = im * transformedTangent;

	#endif

#endif

transformedNormal = normalMatrix * transformedNormal;

#ifdef FLIP_SIDED

	transformedNormal = - transformedNormal;

#endif

#ifdef USE_TANGENT

	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;

#endif
`,
  displacementmap_pars_vertex: `
#ifdef USE_DISPLACEMENTMAP

	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;

#endif
`,
  displacementmap_vertex: `
#ifdef USE_DISPLACEMENTMAP

	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );

#endif
`,
  emissivemap_fragment: `
#ifdef USE_EMISSIVEMAP

	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );

	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE

		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)

		emissiveColor = sRGBTransferEOTF( emissiveColor );

	#endif

	totalEmissiveRadiance *= emissiveColor.rgb;

#endif
`,
  emissivemap_pars_fragment: `
#ifdef USE_EMISSIVEMAP

	uniform sampler2D emissiveMap;

#endif
`,
  colorspace_fragment: `
gl_FragColor = linearToOutputTexel( gl_FragColor );
`,
  colorspace_pars_fragment: `

vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}

vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}

vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}

`,
  envmap_fragment: `
#ifdef USE_ENVMAP

	#ifdef ENV_WORLDPOS

		vec3 cameraToFrag;

		if ( isOrthographic ) {

			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );

		} else {

			cameraToFrag = normalize( vWorldPosition - cameraPosition );

		}

		// Transforming Normal Vectors with the Inverse Transformation
		vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );

		#ifdef ENVMAP_MODE_REFLECTION

			vec3 reflectVec = reflect( cameraToFrag, worldNormal );

		#else

			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );

		#endif

	#else

		vec3 reflectVec = vReflect;

	#endif

	#ifdef ENVMAP_TYPE_CUBE

		vec4 envColor = textureCube( envMap, envMapRotation * reflectVec );

		#ifdef ENVMAP_BLENDING_MULTIPLY

			outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );

		#elif defined( ENVMAP_BLENDING_MIX )

			outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );

		#elif defined( ENVMAP_BLENDING_ADD )

			outgoingLight += envColor.xyz * specularStrength * reflectivity;

		#endif

	#endif

#endif
`,
  envmap_common_pars_fragment: `
#ifdef USE_ENVMAP

	uniform float envMapIntensity;
	uniform mat3 envMapRotation;

	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif

#endif
`,
  envmap_pars_fragment: `
#ifdef USE_ENVMAP

	uniform float reflectivity;

	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )

		#define ENV_WORLDPOS

	#endif

	#ifdef ENV_WORLDPOS

		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif

#endif
`,
  envmap_pars_vertex: `
#ifdef USE_ENVMAP

	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )

		#define ENV_WORLDPOS

	#endif

	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;

	#else

		varying vec3 vReflect;
		uniform float refractionRatio;

	#endif

#endif
`,
  envmap_physical_pars_fragment: `
#ifdef USE_ENVMAP

	vec3 getIBLIrradiance( const in vec3 normal ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );

			return PI * envMapColor.rgb * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

		#ifdef ENVMAP_TYPE_CUBE_UV

			vec3 reflectVec = reflect( - viewDir, normal );

			// Mixing the reflection with the normal is more accurate and keeps rough objects from gathering light from behind their tangent plane.
			reflectVec = normalize( mix( reflectVec, normal, pow4( roughness ) ) );

			reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );

			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );

			return envMapColor.rgb * envMapIntensity;

		#else

			return vec3( 0.0 );

		#endif

	}

	#ifdef USE_RETROREFLECTION

		vec3 getIBLRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {

			#ifdef ENVMAP_TYPE_CUBE_UV

				// The retroreflective lobe returns light toward its source, so the environment is sampled along the view direction
				vec3 retroVec = normalize( mix( viewDir, normal, pow4( roughness ) ) );

				retroVec = transformDirectionByInverseViewMatrix( retroVec, viewMatrix );

				vec4 envMapColor = textureCubeUV( envMap, envMapRotation * retroVec, roughness );

				return envMapColor.rgb * envMapIntensity;

			#else

				return vec3( 0.0 );

			#endif

		}

	#endif

	#ifdef USE_ANISOTROPY

		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

			#ifdef ENVMAP_TYPE_CUBE_UV

			  // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

				return getIBLRadiance( viewDir, bentNormal, roughness );

			#else

				return vec3( 0.0 );

			#endif

		}

		#ifdef USE_RETROREFLECTION

			vec3 getIBLAnisotropyRetroRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {

				#ifdef ENVMAP_TYPE_CUBE_UV

				  // https://google.github.io/filament/Filament.md.html#lighting/imagebasedlights/anisotropy
					vec3 bentNormal = cross( bitangent, viewDir );
					bentNormal = normalize( cross( bentNormal, bitangent ) );
					bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );

					return getIBLRetroRadiance( viewDir, bentNormal, roughness );

				#else

					return vec3( 0.0 );

				#endif

			}

		#endif

	#endif

#endif
`,
  envmap_vertex: `
#ifdef USE_ENVMAP

	#ifdef ENV_WORLDPOS

		vWorldPosition = worldPosition.xyz;

	#else

		vec3 cameraToVertex;

		if ( isOrthographic ) {

			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );

		} else {

			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );

		}

		vec3 worldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );

		#ifdef ENVMAP_MODE_REFLECTION

			vReflect = reflect( cameraToVertex, worldNormal );

		#else

			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );

		#endif

	#endif

#endif
`,
  fog_vertex: `
#ifdef USE_FOG

	vFogDepth = - mvPosition.z;

#endif
`,
  fog_pars_vertex: `
#ifdef USE_FOG

	varying float vFogDepth;

#endif
`,
  fog_fragment: `
#ifdef USE_FOG

	#ifdef FOG_EXP2

		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );

	#else

		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );

	#endif

	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );

#endif
`,
  fog_pars_fragment: `
#ifdef USE_FOG

	uniform vec3 fogColor;
	varying float vFogDepth;

	#ifdef FOG_EXP2

		uniform float fogDensity;

	#else

		uniform float fogNear;
		uniform float fogFar;

	#endif

#endif
`,
  gradientmap_pars_fragment: `

#ifdef USE_GRADIENTMAP

	uniform sampler2D gradientMap;

#endif

vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {

	// dotNL will be from -1.0 to 1.0
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );

	#ifdef USE_GRADIENTMAP

		return vec3( texture2D( gradientMap, coord ).r );

	#else

		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );

	#endif

}
`,
  lightmap_pars_fragment: `
#ifdef USE_LIGHTMAP

	uniform sampler2D lightMap;
	uniform float lightMapIntensity;

#endif
`,
  lights_lambert_fragment: `
LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;
`,
  lights_lambert_pars_fragment: `
varying vec3 vViewPosition;

struct LambertMaterial {

	vec3 diffuseColor;
	float specularStrength;

};

void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert
`,
  lights_pars_begin: `
uniform bool receiveShadow;
uniform vec3 ambientLightColor;

#if defined( USE_LIGHT_PROBES )

	uniform vec3 lightProbe[ 9 ];

#endif

// get the irradiance (radiance convolved with cosine lobe) at the point 'normal' on the unit sphere
// source: https://graphics.stanford.edu/papers/envmap/envmap.pdf
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {

	// normal is assumed to have unit length

	float x = normal.x, y = normal.y, z = normal.z;

	// band 0
	vec3 result = shCoefficients[ 0 ] * 0.886227;

	// band 1
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;

	// band 2
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );

	return result;

}

vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {

	vec3 worldNormal = transformNormalByInverseViewMatrix( normal, viewMatrix );

	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );

	return irradiance;

}

vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {

	vec3 irradiance = ambientLightColor;

	return irradiance;

}

float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {

	// based upon Frostbite 3 Moving to Physically-based Rendering
	// page 32, equation 26: E[window1]
	// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );

	if ( cutoffDistance > 0.0 ) {

		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );

	}

	return distanceFalloff;

}

float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {

	return smoothstep( coneCosine, penumbraCosine, angleCosine );

}

#if NUM_SUN_LIGHTS > 0

	struct SunLight {
		vec3 direction;
		vec3 color;
	};

	uniform SunLight sunLights[ NUM_SUN_LIGHTS ];

	void getSunLightInfo( const in SunLight sunLight, out IncidentLight light ) {

		light.color = sunLight.color;
		light.direction = sunLight.direction;
		light.visible = true;

	}

#endif


#if NUM_DIR_LIGHTS > 0

	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};

	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];

	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {

		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;

	}

#endif


#if NUM_POINT_LIGHTS > 0

	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};

	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];

	// light is an out parameter as having it as a return value caused compiler errors on some devices
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {

		vec3 lVector = pointLight.position - geometryPosition;

		light.direction = normalize( lVector );

		float lightDistance = length( lVector );

		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );

	}

#endif


#if NUM_SPOT_LIGHTS > 0

	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};

	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];

	// light is an out parameter as having it as a return value caused compiler errors on some devices
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {

		vec3 lVector = spotLight.position - geometryPosition;

		light.direction = normalize( lVector );

		float angleCos = dot( light.direction, spotLight.direction );

		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );

		if ( spotAttenuation > 0.0 ) {

			float lightDistance = length( lVector );

			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );

		} else {

			light.color = vec3( 0.0 );
			light.visible = false;

		}

	}

#endif


#if NUM_RECT_AREA_LIGHTS > 0

	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};

	// Pre-computed values of LinearTransformedCosine approximation of BRDF
	// BRDF approximation Texture is 64x64
	uniform sampler2D ltc_1; // RGBA Float
	uniform sampler2D ltc_2; // RGBA Float

	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];

#endif


#if NUM_HEMI_LIGHTS > 0

	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};

	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];

	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {

		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;

		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );

		return irradiance;

	}

#endif

#include <lightprobes_pars_fragment>
`,
  lights_toon_fragment: `
ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;
`,
  lights_toon_pars_fragment: `
varying vec3 vViewPosition;

struct ToonMaterial {

	vec3 diffuseColor;

};

void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {

	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon
`,
  lights_phong_fragment: `
BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;
`,
  lights_phong_pars_fragment: `
varying vec3 vViewPosition;

struct BlinnPhongMaterial {

	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;

};

void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;

}

void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {

	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );

}

#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong
`,
  lights_physical_fragment: `
PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.diffuseContribution = diffuseColor.rgb * ( 1.0 - metalnessFactor );
material.metalness = metalnessFactor;

vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );

material.roughness = max( roughnessFactor, 0.0525 );// 0.0525 corresponds to the base mip of a 256 cubemap.
material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );

#ifdef IOR

	material.ior = ior;

	#ifdef USE_SPECULAR

		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;

		#ifdef USE_SPECULAR_COLORMAP

			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;

		#endif

		#ifdef USE_SPECULAR_INTENSITYMAP

			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;

		#endif

		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );

	#else

		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;

	#endif

	material.specularColor = min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor;
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );

#else

	material.specularColor = vec3( 0.04 );
	material.specularColorBlended = mix( material.specularColor, diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;

#endif

#ifdef USE_CLEARCOAT

	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;

	#ifdef USE_CLEARCOATMAP

		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;

	#endif

	#ifdef USE_CLEARCOAT_ROUGHNESSMAP

		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;

	#endif

	material.clearcoat = saturate( material.clearcoat ); // Burley clearcoat model
	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );

#endif

#ifdef USE_DISPERSION

	material.dispersion = dispersion;

#endif

#ifdef USE_RETROREFLECTION

	material.retroreflectivity = retroreflectivity;

#endif

#ifdef USE_IRIDESCENCE

	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;

	#ifdef USE_IRIDESCENCEMAP

		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;

	#endif

	#ifdef USE_IRIDESCENCE_THICKNESSMAP

		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;

	#else

		material.iridescenceThickness = iridescenceThicknessMaximum;

	#endif

#endif

#ifdef USE_SHEEN

	material.sheenColor = sheenColor;

	#ifdef USE_SHEEN_COLORMAP

		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;

	#endif

	material.sheenRoughness = clamp( sheenRoughness, 0.0001, 1.0 );

	#ifdef USE_SHEEN_ROUGHNESSMAP

		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;

	#endif

#endif

#ifdef USE_ANISOTROPY

	#ifdef USE_ANISOTROPYMAP

		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;

	#else

		vec2 anisotropyV = anisotropyVector;

	#endif

	material.anisotropy = length( anisotropyV );

	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}

	// Roughness along the anisotropy bitangent is the material roughness, while the tangent roughness increases with anisotropy.
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );

	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;

#endif
`,
  lights_physical_pars_fragment: `

uniform sampler2D dfgLUT;

struct PhysicalMaterial {

	vec3 diffuseColor;
	vec3 diffuseContribution;
	vec3 specularColor;
	vec3 specularColorBlended;

	float roughness;
	float metalness;
	float specularF90;
	float dispersion;
	vec2 dfg;
	vec3 multiScatteringCompensation;

	#ifdef USE_RETROREFLECTION
		float retroreflectivity;
	#endif

	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif

	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0Dielectric;
		vec3 iridescenceF0Metallic;
	#endif

	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif

	#ifdef IOR
		float ior;
	#endif

	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif

	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif

};

// temporary
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );

vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );

    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}

// Moving Frostbite to Physically Based Rendering 3.0 - page 12, listing 2
// https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {

	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );

	return 0.5 / max( gv + gl, EPSILON );

}

// Microfacet Models for Refraction through Rough Surfaces - equation (33)
// http://graphicrants.blogspot.com/2013/08/specular-brdf-reference.html
// alpha is "roughness squared" in Disney\u2019s reparameterization
float D_GGX( const in float alpha, const in float dotNH ) {

	float a2 = pow2( alpha );

	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0; // avoid alpha = 0 with dotNH = 1

	return RECIPROCAL_PI * a2 / pow2( denom );

}

// https://google.github.io/filament/Filament.md.html#materialsystem/anisotropicmodel/anisotropicspecularbrdf
#ifdef USE_ANISOTROPY

	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {

		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		return 0.5 / max( gv + gl, EPSILON );

	}

	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {

		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;

		return RECIPROCAL_PI * a2 * pow2 ( w2 );

	}

#endif

#ifdef USE_CLEARCOAT

	// GGX Distribution, Schlick Fresnel, GGX_SmithCorrelated Visibility
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {

		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;

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

#endif

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

	#ifdef USE_IRIDESCENCE

		F = mix( F, material.iridescenceFresnel, material.iridescence );

	#endif

	#ifdef USE_ANISOTROPY

		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );

		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );

		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );

	#else

		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );

		float D = D_GGX( alpha, dotNH );

	#endif

	return F * ( V * D );

}

// Rect Area Light

// Real-Time Polygonal-Light Shading with Linearly Transformed Cosines
// by Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt
// code: https://github.com/selfshadow/ltc_code/

vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	float dotNV = saturate( dot( N, V ) );

	// texture parameterized by sqrt( GGX alpha ) and sqrt( 1 - cos( theta ) )
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );

	uv = uv * LUT_SCALE + LUT_BIAS;

	return uv;

}

float LTC_ClippedSphereFormFactor( const in vec3 f ) {

	// Real-Time Area Lighting: a Journey from Research to Production (p.102)
	// An approximation of the form factor of a horizon-clipped rectangle.

	float l = length( f );

	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );

}

vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {

	float x = dot( v1, v2 );

	float y = abs( x );

	// rational polynomial approximation to theta / sin( theta ) / 2PI
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;

	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;

	return cross( v1, v2 ) * theta_sintheta;

}

vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {

	// bail if point is on back side of plane of light
	// assumes ccw winding order of light vertices
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );

	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );

	// construct orthonormal basis around N
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 ); // negated from paper; possibly due to a different handedness of world coordinate system

	// compute transform
	mat3 mat = mInv * transpose( mat3( T1, T2, N ) );

	// transform rect
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );

	// project rect onto sphere
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );

	// calculate vector form factor
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );

	// adjust for horizon clipping
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );

/*
	// alternate method of adjusting for horizon clipping (see reference)
	// refactoring required
	float len = length( vectorFormFactor );
	float z = vectorFormFactor.z / len;

	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;

	// tabulated horizon-clipped sphere, apparently...
	vec2 uv = vec2( z * 0.5 + 0.5, len );
	uv = uv * LUT_SCALE + LUT_BIAS;

	float scale = texture2D( ltc_2, uv ).w;

	float result = len * scale;
*/

	return vec3( result );

}

// End Rect Area Light

#if defined( USE_SHEEN )

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float D_Charlie( float roughness, float dotNH ) {

	float alpha = pow2( roughness );

	// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF"
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 ); // 2^(-14/2), so sin2h^2 > 0 in fp16

	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );

}

// https://github.com/google/filament/blob/master/shaders/src/brdf.fs
float V_Neubelt( float dotNV, float dotNL ) {

	// Neubelt and Pettineo 2013, "Crafting a Next-gen Material Pipeline for The Order: 1886"
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );

}

vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {

	vec3 halfDir = normalize( lightDir + viewDir );

	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );

	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );

	return sheenColor * ( D * V );

}

#endif

// This is a curve-fit approximation to the "Charlie sheen" BRDF integrated over the hemisphere from
// Estevez and Kulla 2017, "Production Friendly Microfacet Sheen BRDF".
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );

	float r2 = roughness * roughness;
	float rInv = 1.0 / ( roughness + 0.1 );

	float a = -1.9362 + 1.0678 * roughness + 0.4573 * r2 - 0.8469 * rInv;
	float b = -0.6014 + 0.5538 * roughness - 0.4670 * r2 - 0.1255 * rInv;

	float DG = exp( a * dotNV + b );

	return saturate( DG );

}

vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {

	float dotNV = saturate( dot( normal, viewDir ) );
	vec2 fab = texture2D( dfgLUT, vec2( roughness, dotNV ) ).rg;

	return specularColor * fab.x + specularF90 * fab.y;

}

// Fdez-Ag\xFCera's "Multiple-Scattering Microfacet Model for Real-Time Image Based Lighting"
// Approximates multiscattering in order to preserve energy.
// http://www.jcgt.org/published/0008/01/03/
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec2 fab, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec2 fab, const in vec3 specularColor, const in float specularF90, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif

	#ifdef USE_IRIDESCENCE

		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );

	#else

		vec3 Fr = specularColor;

	#endif

	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;

	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;

	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619; // 1/21
	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );

	singleScatter += FssEss;
	multiScatter += Fms * Ems;

}

#if NUM_RECT_AREA_LIGHTS > 0

	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;

		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight; // counterclockwise; light shines in local neg z direction
		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;

		vec2 uv = LTC_Uv( normal, viewDir, roughness );

		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );

		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);

		// LTC Fresnel Approximation by Stephen Hill
		// http://blog.selfshadow.com/publications/s2016-advances/s2016_ltc_fresnel.pdf
		vec3 fresnel = ( material.specularColorBlended * t2.x + ( material.specularF90 - material.specularColorBlended ) * t2.y );

		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );

		reflectedLight.directDiffuse += lightColor * material.diffuseContribution * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );

		#ifdef USE_CLEARCOAT

			vec3 Ncc = geometryClearcoatNormal;

			vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );

			vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );
			vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );

			mat3 mInvClearcoat = mat3(
				vec3( t1Clearcoat.x, 0, t1Clearcoat.y ),
				vec3(             0, 1,             0 ),
				vec3( t1Clearcoat.z, 0, t1Clearcoat.w )
			);

			// LTC Fresnel Approximation for clearcoat
			vec3 fresnelClearcoat = material.clearcoatF0 * t2Clearcoat.x + ( material.clearcoatF90 - material.clearcoatF0 ) * t2Clearcoat.y;

			clearcoatSpecularDirect += lightColor * fresnelClearcoat * LTC_Evaluate( Ncc, viewDir, position, mInvClearcoat, rectCoords );

		#endif

	}

#endif

void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );

	vec3 irradiance = dotNL * directLight.color;

	#ifdef USE_CLEARCOAT

		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );

		vec3 ccIrradiance = dotNLcc * directLight.color;

		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );

	#endif

	#ifdef USE_SHEEN
 
 		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
 
 		float sheenAlbedoV = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
 		float sheenAlbedoL = IBLSheenBRDF( geometryNormal, directLight.direction, material.sheenRoughness );
 
 		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * max( sheenAlbedoV, sheenAlbedoL );
 
 		irradiance *= sheenEnergyComp;
 
 	#endif

	vec3 specularBRDF = BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );

	#ifdef USE_RETROREFLECTION

		// Minimal Retroreflective Microfacet Model:
		// https://jcgt.org/published/0015/01/04/
		vec3 retroViewDir = reflect( - geometryViewDir, geometryNormal );
		vec3 retroSpecularBRDF = BRDF_GGX( directLight.direction, retroViewDir, geometryNormal, material );

		specularBRDF = mix( specularBRDF, retroSpecularBRDF, saturate( material.retroreflectivity ) );

	#endif

	reflectedLight.directSpecular += irradiance * specularBRDF * material.multiScatteringCompensation;

	// Light reflected by the specular interface is not available to the diffuse layer ( glTF fresnel_mix )
	vec3 halfDir = normalize( directLight.direction + geometryViewDir );
	float dotVH = saturate( dot( geometryViewDir, halfDir ) );
	vec3 F = F_Schlick( material.specularColor, material.specularF90, dotVH );

	#ifdef USE_RETROREFLECTION

		vec3 retroHalfDir = normalize( directLight.direction + retroViewDir );
		float dotRetroVH = saturate( dot( retroViewDir, retroHalfDir ) );
		vec3 retroF = F_Schlick( material.specularColor, material.specularF90, dotRetroVH );

		F = mix( F, retroF, saturate( material.retroreflectivity ) );

	#endif

	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - F );
}

void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {

	// Energy reflected by the specular lobe is not available to the diffuse layer
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );

	#ifdef USE_IRIDESCENCE

		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScattering, multiScattering );

	#else

		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScattering, multiScattering );

	#endif

	vec3 diffuse = irradiance * BRDF_Lambert( material.diffuseContribution ) * ( 1.0 - singleScattering - multiScattering );

	#ifdef USE_SHEEN

		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );

		sheenSpecularIndirect += irradiance * material.sheenColor * sheenAlbedo * RECIPROCAL_PI;

		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;

		diffuse *= sheenEnergyComp;

	#endif

	reflectedLight.indirectDiffuse += diffuse;

}

void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {

	#ifdef USE_CLEARCOAT

		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );

	#endif

	#ifdef USE_SHEEN

		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness ) * RECIPROCAL_PI;

 	#endif

	// Both indirect specular and indirect diffuse light accumulate here
	// Compute multiscattering separately for dielectric and metallic, then mix

	vec3 singleScatteringDielectric = vec3( 0.0 );
	vec3 multiScatteringDielectric = vec3( 0.0 );

	vec3 singleScatteringMetallic = vec3( 0.0 );
	vec3 multiScatteringMetallic = vec3( 0.0 );

	#ifdef USE_IRIDESCENCE

		computeMultiscatteringIridescence( material.dfg, material.specularColor, material.specularF90, material.iridescence, material.iridescenceF0Dielectric, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscatteringIridescence( material.dfg, material.diffuseColor, material.specularF90, material.iridescence, material.iridescenceF0Metallic, singleScatteringMetallic, multiScatteringMetallic );

	#else

		computeMultiscattering( material.dfg, material.specularColor, material.specularF90, singleScatteringDielectric, multiScatteringDielectric );
		computeMultiscattering( material.dfg, material.diffuseColor, material.specularF90, singleScatteringMetallic, multiScatteringMetallic );

	#endif

	// Mix based on metalness
	vec3 singleScattering = mix( singleScatteringDielectric, singleScatteringMetallic, material.metalness );
	vec3 multiScattering = mix( multiScatteringDielectric, multiScatteringMetallic, material.metalness );

	// Diffuse energy conservation uses dielectric path
	vec3 totalScatteringDielectric = singleScatteringDielectric + multiScatteringDielectric;
	vec3 diffuse = material.diffuseContribution * ( 1.0 - totalScatteringDielectric );

	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;

	vec3 indirectSpecular = radiance * singleScattering;
	indirectSpecular += multiScattering * cosineWeightedIrradiance;

	vec3 indirectDiffuse = diffuse * cosineWeightedIrradiance;

	#ifdef USE_SHEEN

		float sheenAlbedo = IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );

		float sheenEnergyComp = 1.0 - max3( material.sheenColor ) * sheenAlbedo;

		indirectSpecular *= sheenEnergyComp;
		indirectDiffuse *= sheenEnergyComp;

	#endif

	reflectedLight.indirectSpecular += indirectSpecular;
	reflectedLight.indirectDiffuse += indirectDiffuse;

}

#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical

// ref: https://seblagarde.files.wordpress.com/2015/07/course_notes_moving_frostbite_to_pbr_v32.pdf
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {

	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );

}
`,
  lights_fragment_begin: `
/**
 * This is a template that can be used to light a material, it uses pluggable
 * RenderEquations (RE)for specific lighting scenarios.
 *
 * Instructions for use:
 * - Ensure that both RE_Direct, RE_IndirectDiffuse and RE_IndirectSpecular are defined
 * - Create a material parameter that is to be passed as the third parameter to your lighting functions.
 *
 * TODO:
 * - Add area light support.
 * - Add sphere light support.
 * - Add diffuse light probe (irradiance cubemap) support.
 */

vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

vec3 geometryClearcoatNormal = vec3( 0.0 );

#ifdef USE_CLEARCOAT

	geometryClearcoatNormal = clearcoatNormal;

#endif

#ifdef USE_IRIDESCENCE

	float dotNVi = saturate( dot( normal, geometryViewDir ) );

	if ( material.iridescenceThickness == 0.0 ) {

		material.iridescence = 0.0;

	} else {

		material.iridescence = saturate( material.iridescence );

	}

	if ( material.iridescence > 0.0 ) {

		vec3 iridescenceFresnelDielectric = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		vec3 iridescenceFresnelMetallic = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.diffuseColor );

		material.iridescenceFresnel = mix( iridescenceFresnelDielectric, iridescenceFresnelMetallic, material.metalness );

		// Iridescence F0 approximation
		material.iridescenceF0Dielectric = Schlick_to_F0( iridescenceFresnelDielectric, 1.0, dotNVi );
		material.iridescenceF0Metallic = Schlick_to_F0( iridescenceFresnelMetallic, 1.0, dotNVi );

	}

#endif

#ifdef STANDARD

	float dotNVms = saturate( dot( geometryNormal, geometryViewDir ) );

	material.dfg = texture2D( dfgLUT, vec2( material.roughness, dotNVms ) ).rg;

	#if ( NUM_SUN_LIGHTS > 0 || NUM_DIR_LIGHTS > 0 || NUM_POINT_LIGHTS > 0 || NUM_SPOT_LIGHTS > 0 )

		// Multi-scattering energy compensation for direct lighting
		// Based on "Practical Multiple Scattering Compensation for Microfacet Models"
		// https://blog.selfshadow.com/publications/turquin/ms_comp_final.pdf

		// Energy of the single-scattering lobe in a white furnace ( F0 = F90 = 1 )
		float EssMs = material.dfg.x + material.dfg.y;

		// Compensate for the energy lost to multiple scattering, tinting the added term by F0 ( equation 16 )
		material.multiScatteringCompensation = 1.0 + material.specularColorBlended * ( 1.0 / EssMs - 1.0 );

	#endif

#endif

IncidentLight directLight;

#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointLightInfo( pointLight, geometryPosition, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS ) && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;

	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotLightInfo( spotLight, geometryPosition, directLight );

		// spot lights are ordered [shadows with maps, shadows without maps, maps without shadows, none]
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif

		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif

		#undef SPOT_LIGHT_MAP_INDEX

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_SUN_LIGHTS > 0 ) && defined( RE_Direct )

	SunLight sunLight;
	#if defined( USE_SHADOWMAP ) && NUM_SUN_LIGHT_SHADOWS > 0
	SunLightShadow sunLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHTS; i ++ ) {

		sunLight = sunLights[ i ];

		getSunLightInfo( sunLight, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SUN_LIGHT_SHADOWS )
		sunLightShadow = sunLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ], sunLightShadow, UNROLLED_LOOP_INDEX ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalLightInfo( directionalLight, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )

	RectAreaLight rectAreaLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {

		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if defined( RE_IndirectDiffuse )

	vec3 iblIrradiance = vec3( 0.0 );

	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

	#if defined( USE_LIGHT_PROBES )

		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );

	#endif

	#if ( NUM_HEMI_LIGHTS > 0 )

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );

		}
		#pragma unroll_loop_end

	#endif

	#ifdef USE_LIGHT_PROBES_GRID

		vec3 probeWorldPos = ( ( vec4( geometryPosition, 1.0 ) - viewMatrix[ 3 ] ) * viewMatrix ).xyz;
		vec3 probeWorldNormal = transformNormalByInverseViewMatrix( geometryNormal, viewMatrix );
		irradiance += getLightProbeGridIrradiance( probeWorldPos, probeWorldNormal );

	#endif

#endif

#if defined( RE_IndirectSpecular )

	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );

#endif
`,
  lights_fragment_maps: `
#if defined( RE_IndirectDiffuse )

	#ifdef USE_LIGHTMAP

		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;

		irradiance += lightMapIrradiance;

	#endif

	#if defined( USE_ENVMAP ) && defined( ENVMAP_TYPE_CUBE_UV )

		#if defined( STANDARD ) || defined( LAMBERT ) || defined( PHONG )

			iblIrradiance += getIBLIrradiance( geometryNormal );

		#endif

	#endif

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

	#ifdef USE_ANISOTROPY

		vec3 iblRadiance = getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );

	#else

		vec3 iblRadiance = getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );

	#endif

	#ifdef USE_RETROREFLECTION

		#ifdef USE_ANISOTROPY

			vec3 retroIBLRadiance = getIBLAnisotropyRetroRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );

		#else

			vec3 retroIBLRadiance = getIBLRetroRadiance( geometryViewDir, geometryNormal, material.roughness );

		#endif

		iblRadiance = mix( iblRadiance, retroIBLRadiance, saturate( material.retroreflectivity ) );

	#endif

	radiance += iblRadiance;

	#ifdef USE_CLEARCOAT

		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );

	#endif

#endif
`,
  lights_fragment_end: `
#if defined( RE_IndirectDiffuse )

	#if defined( LAMBERT ) || defined( PHONG )

		irradiance += iblIrradiance;

	#endif

	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

#endif

#if defined( RE_IndirectSpecular )

	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

#endif
`,
  lightprobes_pars_fragment: `
#ifdef USE_LIGHT_PROBES_GRID

// Single atlas 3D texture that stores all 7 SH sub-volumes stacked along Z.
// Atlas depth = 7 * ( nz + 2 ) where nz = probesResolution.z.
// Each sub-volume occupies ( nz + 2 ) slices: 1 padding + nz data + 1 padding.
// Padding is a copy of the first / last data slice and prevents color bleeding
// when the hardware linear filter reads across a sub-volume boundary.
uniform highp sampler3D probesSH;

uniform vec3 probesMin;
uniform vec3 probesMax;
uniform vec3 probesResolution;

vec3 getLightProbeGridIrradiance( vec3 worldPos, vec3 worldNormal ) {

	vec3 res = probesResolution;
	vec3 gridRange = probesMax - probesMin;
	vec3 resMinusOne = res - 1.0;
	vec3 probeSpacing = gridRange / resMinusOne;

	// Offset sample position along normal by half a probe spacing
	vec3 samplePos = worldPos + worldNormal * probeSpacing * 0.5;
	vec3 uvw = clamp( ( samplePos - probesMin ) / gridRange, 0.0, 1.0 );

	// Remap to texel centers of the probe grid (XY and Z)
	uvw = uvw * resMinusOne / res + 0.5 / res;

	// Atlas UV mapping along Z:
	//   paddedSlices = nz + 2  (1 padding texel at each end of every sub-volume)
	//   atlasDepth   = 7 * paddedSlices
	//   For sub-volume t the first DATA texel sits at atlas slice t*paddedSlices + 1.
	//   Given probe-grid texel-centre UVZ = ( iz + 0.5 ) / nz the atlas UV is:
	//     atlasUvZ = ( uvw.z * nz + t * paddedSlices + 1 ) / atlasDepth
	//
	// uvZBase encodes the nz-scaled Z plus the intra-volume offset (+ 1 for padding),
	// so adding t*paddedSlices steps to each successive sub-volume.
	float nz          = res.z;
	float paddedSlices = nz + 2.0;
	float atlasDepth  = 7.0 * paddedSlices;
	float uvZBase     = uvw.z * nz + 1.0;

	vec4 s0 = texture( probesSH, vec3( uvw.xy, ( uvZBase                       ) / atlasDepth ) );
	vec4 s1 = texture( probesSH, vec3( uvw.xy, ( uvZBase +       paddedSlices   ) / atlasDepth ) );
	vec4 s2 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 2.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s3 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 3.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s4 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 4.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s5 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 5.0 * paddedSlices   ) / atlasDepth ) );
	vec4 s6 = texture( probesSH, vec3( uvw.xy, ( uvZBase + 6.0 * paddedSlices   ) / atlasDepth ) );

	// Unpack 9 vec3 SH L2 coefficients
	vec3 c0 = s0.xyz;
	vec3 c1 = vec3( s0.w, s1.xy );
	vec3 c2 = vec3( s1.zw, s2.x );
	vec3 c3 = s2.yzw;
	vec3 c4 = s3.xyz;
	vec3 c5 = vec3( s3.w, s4.xy );
	vec3 c6 = vec3( s4.zw, s5.x );
	vec3 c7 = s5.yzw;
	vec3 c8 = s6.xyz;

	// Evaluate L2 irradiance
	float x = worldNormal.x, y = worldNormal.y, z = worldNormal.z;

	vec3 result = c0 * 0.886227;
	result += c1 * 2.0 * 0.511664 * y;
	result += c2 * 2.0 * 0.511664 * z;
	result += c3 * 2.0 * 0.511664 * x;
	result += c4 * 2.0 * 0.429043 * x * y;
	result += c5 * 2.0 * 0.429043 * y * z;
	result += c6 * ( 0.743125 * z * z - 0.247708 );
	result += c7 * 2.0 * 0.429043 * x * z;
	result += c8 * 0.429043 * ( x * x - y * y );

	return max( result, vec3( 0.0 ) );

}

#endif
`,
  logdepthbuf_fragment: `
#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )

	// Doing a strict comparison with == 1.0 can cause noise artifacts
	// on some platforms. See issue #17623.
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;

#endif
`,
  logdepthbuf_pars_fragment: `
#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )

	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;

#endif
`,
  logdepthbuf_pars_vertex: `
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER

	varying float vFragDepth;
	varying float vIsPerspective;

#endif
`,
  logdepthbuf_vertex: `
#ifdef USE_LOGARITHMIC_DEPTH_BUFFER

	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );

#endif
`,
  map_fragment: `
#ifdef USE_MAP

	vec4 sampledDiffuseColor = texture2D( map, vMapUv );

	#ifdef DECODE_VIDEO_TEXTURE

		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures (#26516)

		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );

	#endif

	diffuseColor *= sampledDiffuseColor;

#endif
`,
  map_pars_fragment: `
#ifdef USE_MAP

	uniform sampler2D map;

#endif
`,
  map_particle_fragment: `
#if defined( USE_MAP ) || defined( USE_ALPHAMAP )

	#if defined( USE_POINTS_UV )

		vec2 uv = vUv;

	#else

		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;

	#endif

#endif

#ifdef USE_MAP

	diffuseColor *= texture2D( map, uv );

#endif

#ifdef USE_ALPHAMAP

	diffuseColor.a *= texture2D( alphaMap, uv ).g;

#endif
`,
  map_particle_pars_fragment: `
#if defined( USE_POINTS_UV )

	varying vec2 vUv;

#else

	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )

		uniform mat3 uvTransform;

	#endif

#endif

#ifdef USE_MAP

	uniform sampler2D map;

#endif

#ifdef USE_ALPHAMAP

	uniform sampler2D alphaMap;

#endif
`,
  metalnessmap_fragment: `
float metalnessFactor = metalness;

#ifdef USE_METALNESSMAP

	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );

	// reads channel B, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	metalnessFactor *= texelMetalness.b;

#endif
`,
  metalnessmap_pars_fragment: `
#ifdef USE_METALNESSMAP

	uniform sampler2D metalnessMap;

#endif
`,
  morphinstance_vertex: `
#ifdef USE_INSTANCING_MORPH

	float morphTargetInfluences[ MORPHTARGETS_COUNT ];

	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;

	}
#endif
`,
  morphcolor_vertex: `
#if defined( USE_MORPHCOLORS )

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	vColor *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		#if defined( USE_COLOR_ALPHA )

			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];

		#elif defined( USE_COLOR )

			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];

		#endif

	}

#endif
`,
  morphnormal_vertex: `
#ifdef USE_MORPHNORMALS

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in normal = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	objectNormal *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];

	}

#endif
`,
  morphtarget_pars_vertex: `
#ifdef USE_MORPHTARGETS

	#ifndef USE_INSTANCING_MORPH

		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];

	#endif

	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;

	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {

		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;

		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );

	}

#endif
`,
  morphtarget_vertex: `
#ifdef USE_MORPHTARGETS

	// morphTargetBaseInfluence is set based on BufferGeometry.morphTargetsRelative value:
	// When morphTargetsRelative is false, this is set to 1 - sum(influences); this results in position = sum((target - base) * influence)
	// When morphTargetsRelative is true, this is set to 1; as a result, all morph targets are simply added to the base after weighting
	transformed *= morphTargetBaseInfluence;

	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {

		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];

	}

#endif
`,
  normal_fragment_begin: `
float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;

#ifdef FLAT_SHADED

	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );

#else

	vec3 normal = normalize( vNormal );

	#ifdef DOUBLE_SIDED

		normal *= faceDirection;

	#endif

#endif

#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )

	#ifdef USE_TANGENT

		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

	#else

		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);

	#endif

	#ifdef DOUBLE_SIDED

		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;

	#endif

#endif

#ifdef USE_CLEARCOAT_NORMALMAP

	#ifdef USE_TANGENT

		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );

	#else

		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );

	#endif

	#ifdef DOUBLE_SIDED

		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;

	#endif

#endif

// non perturbed normal for clearcoat among others

vec3 nonPerturbedNormal = normal;

`,
  normal_fragment_maps: `

#ifdef USE_NORMALMAP_OBJECTSPACE

	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals

	#ifdef FLIP_SIDED

		normal = - normal;

	#endif

	#ifdef DOUBLE_SIDED

		normal = normal * faceDirection;

	#endif

	normal = normalize( normalMatrix * normal );

#elif defined( USE_NORMALMAP_TANGENTSPACE )

	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;

	#if defined( USE_PACKED_NORMALMAP )

		mapN = vec3( mapN.xy, sqrt( saturate( 1.0 - dot( mapN.xy, mapN.xy ) ) ) );

	#endif

	mapN.xy *= normalScale;

	normal = normalize( tbn * mapN );

#elif defined( USE_BUMPMAP )

	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );

#endif
`,
  normal_pars_fragment: `
#ifndef FLAT_SHADED

	varying vec3 vNormal;

	#ifdef USE_TANGENT

		varying vec3 vTangent;
		varying vec3 vBitangent;

	#endif

#endif
`,
  normal_pars_vertex: `
#ifndef FLAT_SHADED

	varying vec3 vNormal;

	#ifdef USE_TANGENT

		varying vec3 vTangent;
		varying vec3 vBitangent;

	#endif

#endif
`,
  normal_vertex: `
#ifndef FLAT_SHADED // normal is computed with derivatives when FLAT_SHADED

	vNormal = normalize( transformedNormal );

	#ifdef USE_TANGENT

		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );

		#ifdef FLIP_SIDED

			vBitangent = - vBitangent;

		#endif

	#endif

#endif
`,
  normalmap_pars_fragment: `
#ifdef USE_NORMALMAP

	uniform sampler2D normalMap;
	uniform vec2 normalScale;

#endif

#ifdef USE_NORMALMAP_OBJECTSPACE

	uniform mat3 normalMatrix;

#endif

#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )

	// Normal Mapping Without Precomputed Tangents
	// http://www.thetenthplanet.de/archives/1180

	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {

		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );

		vec3 N = surf_norm; // normalized

		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );

		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;

		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );

		return mat3( T * scale, B * scale, N );

	}

#endif
`,
  clearcoat_normal_fragment_begin: `
#ifdef USE_CLEARCOAT

	vec3 clearcoatNormal = nonPerturbedNormal;

#endif
`,
  clearcoat_normal_fragment_maps: `
#ifdef USE_CLEARCOAT_NORMALMAP

	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;

	clearcoatNormal = normalize( tbn2 * clearcoatMapN );

#endif
`,
  clearcoat_pars_fragment: `

#ifdef USE_CLEARCOATMAP

	uniform sampler2D clearcoatMap;

#endif

#ifdef USE_CLEARCOAT_NORMALMAP

	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;

#endif

#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform sampler2D clearcoatRoughnessMap;

#endif
`,
  iridescence_pars_fragment: `

#ifdef USE_IRIDESCENCEMAP

	uniform sampler2D iridescenceMap;

#endif

#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform sampler2D iridescenceThicknessMap;

#endif
`,
  opaque_fragment: `
#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif

#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif

gl_FragColor = vec4( outgoingLight, diffuseColor.a );
`,
  packing: `
vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}

vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}

const float PackUpscale = 256. / 255.; // fraction -> 0..1 (including 1)
const float UnpackDownscale = 255. / 256.; // 0..1 -> fraction (excluding 1)
const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;

const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );

const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );

vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}

vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	// the 0.9999 tweak is unimportant, very tiny empirical improvement
	// return vec3( vuf * Inv255, gf * PackUpscale, bf * 0.9999 );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}

vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}

float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}

float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}

float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}

vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}

vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}

// NOTE: viewZ, the z-coordinate in camera space, is negative for points in front of the camera

float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	// -near maps to 0; -far maps to 1
	return ( viewZ + near ) / ( near - far );
}

float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {

	#ifdef USE_REVERSED_DEPTH_BUFFER
	
		return depth * ( far - near ) - far;

	#else

		return depth * ( near - far ) - near;

	#endif
}

// NOTE: https://twitter.com/gonnavis/status/1377183786949959682

float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	// -near maps to 0; -far maps to 1
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}

float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	
	#ifdef USE_REVERSED_DEPTH_BUFFER

		return ( near * far ) / ( ( near - far ) * depth - near );

	#else

		return ( near * far ) / ( ( far - near ) * depth - far );

	#endif
}
`,
  premultiplied_alpha_fragment: `
#ifdef PREMULTIPLIED_ALPHA

	gl_FragColor.rgb *= gl_FragColor.a;

#endif
`,
  project_vertex: `
vec4 mvPosition = vec4( transformed, 1.0 );

#ifdef USE_BATCHING

	mvPosition = batchingMatrix * mvPosition;

#endif

#ifdef USE_INSTANCING

	mvPosition = instanceMatrix * mvPosition;

#endif

mvPosition = modelViewMatrix * mvPosition;

gl_Position = projectionMatrix * mvPosition;
`,
  dithering_fragment: `
#ifdef DITHERING

	gl_FragColor.rgb = dithering( gl_FragColor.rgb );

#endif
`,
  dithering_pars_fragment: `
#ifdef DITHERING

	// based on https://www.shadertoy.com/view/MslGR8
	vec3 dithering( vec3 color ) {
		//Calculate grid position
		float grid_position = rand( gl_FragCoord.xy );

		//Shift the individual colors differently, thus making it even harder to see the dithering pattern
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );

		//modify shift according to grid position.
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );

		//shift the color by dither_shift
		return color + dither_shift_RGB;
	}

#endif
`,
  roughnessmap_fragment: `
float roughnessFactor = roughness;

#ifdef USE_ROUGHNESSMAP

	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );

	// reads channel G, compatible with a combined OcclusionRoughnessMetallic (RGB) texture
	roughnessFactor *= texelRoughness.g;

#endif
`,
  roughnessmap_pars_fragment: `
#ifdef USE_ROUGHNESSMAP

	uniform sampler2D roughnessMap;

#endif
`,
  shadowmap_pars_fragment: `
#if NUM_SPOT_LIGHT_COORDS > 0

	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];

#endif

#if NUM_SPOT_LIGHT_MAPS > 0

	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];

#endif

#ifdef USE_SHADOWMAP

	#if NUM_SUN_LIGHT_SHADOWS > 0

		// must match the cascade count in SunLightShadow

		#define SUN_LIGHT_CASCADES 2

		#if defined( SHADOWMAP_TYPE_PCF )

			uniform sampler2DShadow sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];

		#else

			uniform sampler2D sunShadowMap[ NUM_SUN_LIGHT_SHADOWS ];

		#endif

		uniform mat4 sunShadowMatrix[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		uniform vec4 sunShadowCascade[ NUM_SUN_LIGHT_SHADOWS * SUN_LIGHT_CASCADES ];
		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;

		struct SunLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform SunLightShadow sunLightShadows[ NUM_SUN_LIGHT_SHADOWS ];

	#endif

	#if NUM_DIR_LIGHT_SHADOWS > 0

		#if defined( SHADOWMAP_TYPE_PCF )

			uniform sampler2DShadow directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];

		#else

			uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];

		#endif

		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];

		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

		#if defined( SHADOWMAP_TYPE_PCF )

			uniform sampler2DShadow spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];

		#else

			uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];

		#endif

		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		#if defined( SHADOWMAP_TYPE_PCF )

			uniform samplerCubeShadow pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];

		#elif defined( SHADOWMAP_TYPE_BASIC )

			uniform samplerCube pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];

		#endif

		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];

		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};

		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];

	#endif

	#if defined( SHADOWMAP_TYPE_PCF )

		// Interleaved Gradient Noise for randomizing sampling patterns
		float interleavedGradientNoise( vec2 position ) {

			return fract( 52.9829189 * fract( dot( position, vec2( 0.06711056, 0.00583715 ) ) ) );

		}

		// Vogel disk sampling for uniform circular distribution
		vec2 vogelDiskSample( int sampleIndex, int samplesCount, float phi ) {

			const float goldenAngle = 2.399963229728653;
			float r = sqrt( ( float( sampleIndex ) + 0.5 ) / float( samplesCount ) );
			float theta = float( sampleIndex ) * goldenAngle + phi;
			return vec2( cos( theta ), sin( theta ) ) * r;

		}

	#endif

	#if defined( SHADOWMAP_TYPE_PCF )

		float getShadow( sampler2DShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;
			shadowCoord.z += shadowBias;

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				// Hardware PCF with LinearFilter gives us 4-tap filtering per sample
				// 5 samples using Vogel disk + IGN = effectively 20 filtered taps with better distribution
				vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
				float radius = shadowRadius * texelSize.x;

				// Use IGN to rotate sampling pattern per pixel
				float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;

				shadow = (
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 0, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 1, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 2, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 3, 5, phi ) * radius, shadowCoord.z ) ) +
					texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( 4, 5, phi ) * radius, shadowCoord.z ) )
				) * 0.2;

			}

			return mix( 1.0, shadow, shadowIntensity );

		}

	#elif defined( SHADOWMAP_TYPE_VSM )

		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;

			#ifdef USE_REVERSED_DEPTH_BUFFER

				shadowCoord.z -= shadowBias;

			#else

				shadowCoord.z += shadowBias;

			#endif

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				vec2 distribution = texture2D( shadowMap, shadowCoord.xy ).rg;

				float mean = distribution.x;
				float variance = distribution.y * distribution.y;

				#ifdef USE_REVERSED_DEPTH_BUFFER

					float hard_shadow = step( mean, shadowCoord.z );

				#else

					float hard_shadow = step( shadowCoord.z, mean );

				#endif
				
				// Early return if fully lit
				if ( hard_shadow == 1.0 ) {

					shadow = 1.0;

				} else {

					// Variance must be non-zero to avoid division by zero
					variance = max( variance, 0.0000001 );

					// Distance from mean
					float d = shadowCoord.z - mean;

					// Chebyshev's inequality for upper bound on probability
					float p_max = variance / ( variance + d * d );

					// Reduce light bleeding by remapping [amount, 1] to [0, 1]
					p_max = clamp( ( p_max - 0.3 ) / 0.65, 0.0, 1.0 );

					shadow = max( hard_shadow, p_max );

				}

			}

			return mix( 1.0, shadow, shadowIntensity );

		}

	#else // SHADOWMAP_TYPE_BASIC

		float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {

			float shadow = 1.0;

			shadowCoord.xyz /= shadowCoord.w;

			#ifdef USE_REVERSED_DEPTH_BUFFER

				shadowCoord.z -= shadowBias;

			#else

				shadowCoord.z += shadowBias;

			#endif

			bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
			bool frustumTest = inFrustum && shadowCoord.z <= 1.0;

			if ( frustumTest ) {

				float depth = texture2D( shadowMap, shadowCoord.xy ).r;

				#ifdef USE_REVERSED_DEPTH_BUFFER

					shadow = step( depth, shadowCoord.z );

				#else

					shadow = step( shadowCoord.z, depth );

				#endif

			}

			return mix( 1.0, shadow, shadowIntensity );

		}

	#endif

	#if NUM_SUN_LIGHT_SHADOWS > 0

		float getSunShadow(
			#if defined( SHADOWMAP_TYPE_PCF )
				sampler2DShadow shadowMap,
			#else
				sampler2D shadowMap,
			#endif
			SunLightShadow sunLightShadow,
			int shadowIndex
		) {

			vec4 shadowWorldPosition = vec4( vSunShadowWorldPosition.xyz + vSunShadowWorldNormal * sunLightShadow.shadowNormalBias, 1.0 );
			float viewDepth = vSunShadowWorldPosition.w;
			int cascadeOffset = shadowIndex * SUN_LIGHT_CASCADES;

			float shadow = 1.0;

			// walk the cascades back to front so each fade band can blend with the shadow behind it

			for ( int i = SUN_LIGHT_CASCADES - 1; i >= 0; i -- ) {

				// ( begin, end, fade start ) view depths of the cascade

				vec4 cascade = sunShadowCascade[ cascadeOffset + i ];

				if ( viewDepth >= cascade.x && viewDepth < cascade.y ) {

					float cascadeShadow = getShadow(
						shadowMap,
						sunLightShadow.shadowMapSize,
						sunLightShadow.shadowIntensity,
						sunLightShadow.shadowBias,
						sunLightShadow.shadowRadius,
						sunShadowMatrix[ cascadeOffset + i ] * shadowWorldPosition
					);

					shadow = mix( cascadeShadow, shadow, smoothstep( cascade.z, cascade.y, viewDepth ) );

				}

			}

			return shadow;

		}

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

	#if defined( SHADOWMAP_TYPE_PCF )

	float getPointShadow( samplerCubeShadow shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {

		float shadow = 1.0;

		// for point lights, the uniform @vShadowCoord is re-purposed to hold
		// the vector from the light to the world-space position of the fragment.
		vec3 lightToPosition = shadowCoord.xyz;

		// Direction from light to fragment
		vec3 bd3D = normalize( lightToPosition );

		// For cube shadow maps, depth is stored as distance along each face's view axis, not radial distance
		// The view-space depth is the maximum component of the direction vector (which face is sampled)
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );

		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {

			// viewZ to perspective depth

			#ifdef USE_REVERSED_DEPTH_BUFFER

				float dp = ( shadowCameraNear * ( shadowCameraFar - viewSpaceZ ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp -= shadowBias;

			#else

				float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
				dp += shadowBias;

			#endif

			// Hardware PCF with LinearFilter gives us 4-tap filtering per sample
			// Use Vogel disk + IGN sampling for better quality
			float texelSize = shadowRadius / shadowMapSize.x;

			// Build a tangent-space coordinate system for applying offsets
			vec3 absDir = abs( bd3D );
			vec3 tangent = absDir.x > absDir.z ? vec3( 0.0, 1.0, 0.0 ) : vec3( 1.0, 0.0, 0.0 );
			tangent = normalize( cross( bd3D, tangent ) );
			vec3 bitangent = cross( bd3D, tangent );

			// Use IGN to rotate sampling pattern per pixel
			float phi = interleavedGradientNoise( gl_FragCoord.xy ) * PI2;

			vec2 sample0 = vogelDiskSample( 0, 5, phi );
			vec2 sample1 = vogelDiskSample( 1, 5, phi );
			vec2 sample2 = vogelDiskSample( 2, 5, phi );
			vec2 sample3 = vogelDiskSample( 3, 5, phi );
			vec2 sample4 = vogelDiskSample( 4, 5, phi );

			shadow = (
				texture( shadowMap, vec4( bd3D + ( tangent * sample0.x + bitangent * sample0.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample1.x + bitangent * sample1.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample2.x + bitangent * sample2.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample3.x + bitangent * sample3.y ) * texelSize, dp ) ) +
				texture( shadowMap, vec4( bd3D + ( tangent * sample4.x + bitangent * sample4.y ) * texelSize, dp ) )
			) * 0.2;

		}

		return mix( 1.0, shadow, shadowIntensity );

	}

	#elif defined( SHADOWMAP_TYPE_BASIC )

	float getPointShadow( samplerCube shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {

		float shadow = 1.0;

		// for point lights, the uniform @vShadowCoord is re-purposed to hold
		// the vector from the light to the world-space position of the fragment.
		vec3 lightToPosition = shadowCoord.xyz;

		// For cube shadow maps, depth is stored as distance along each face's view axis, not radial distance
		// The view-space depth is the maximum component of the direction vector (which face is sampled)
		vec3 absVec = abs( lightToPosition );
		float viewSpaceZ = max( max( absVec.x, absVec.y ), absVec.z );

		if ( viewSpaceZ - shadowCameraFar <= 0.0 && viewSpaceZ - shadowCameraNear >= 0.0 ) {

			// viewZ to perspective depth

			float dp = ( shadowCameraFar * ( viewSpaceZ - shadowCameraNear ) ) / ( viewSpaceZ * ( shadowCameraFar - shadowCameraNear ) );
			dp += shadowBias;

			// Direction from light to fragment
			vec3 bd3D = normalize( lightToPosition );

			float depth = textureCube( shadowMap, bd3D ).r;

			#ifdef USE_REVERSED_DEPTH_BUFFER

				depth = 1.0 - depth;

			#endif

			shadow = step( dp, depth );

		}

		return mix( 1.0, shadow, shadowIntensity );

	}

	#endif

	#endif

#endif
`,
  shadowmap_pars_vertex: `

#if NUM_SPOT_LIGHT_COORDS > 0

	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];

#endif

#ifdef USE_SHADOWMAP

	#if NUM_SUN_LIGHT_SHADOWS > 0

		// cascade selection and shadow coordinates are computed per fragment

		varying vec4 vSunShadowWorldPosition;
		varying vec3 vSunShadowWorldNormal;

	#endif

	#if NUM_DIR_LIGHT_SHADOWS > 0

		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];

		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};

		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];

		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};

		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): uniforms for area light shadows

	#endif
	*/

#endif
`,
  shadowmap_vertex: `

#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_SUN_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )

	#ifdef HAS_NORMAL

		// Offsetting the position used for querying occlusion along the world normal can be used to reduce shadow acne.

		vec3 shadowWorldNormal = transformNormalByInverseViewMatrix( transformedNormal, viewMatrix );

	#else

		vec3 shadowWorldNormal = vec3( 0.0 ); // fallback, see #21483

	#endif

	vec4 shadowWorldPosition;

#endif

#if defined( USE_SHADOWMAP )

	#if NUM_SUN_LIGHT_SHADOWS > 0

		vSunShadowWorldPosition = vec4( worldPosition.xyz, - mvPosition.z );
		vSunShadowWorldNormal = shadowWorldNormal;

	#endif

	#if NUM_DIR_LIGHT_SHADOWS > 0

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {

			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;

		}
		#pragma unroll_loop_end

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {

			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;

		}
		#pragma unroll_loop_end

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): update vAreaShadowCoord with area light info

	#endif
	*/

#endif

// spot lights can be evaluated without active shadow mapping (when SpotLight.map is used)

#if NUM_SPOT_LIGHT_COORDS > 0

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {

		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;

	}
	#pragma unroll_loop_end

#endif


`,
  shadowmask_pars_fragment: `
float getShadowMask() {

	float shadow = 1.0;

	#ifdef USE_SHADOWMAP

	#if NUM_SUN_LIGHT_SHADOWS > 0

	SunLightShadow sunLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SUN_LIGHT_SHADOWS; i ++ ) {

		sunLight = sunLightShadows[ i ];
		shadow *= receiveShadow ? getSunShadow( sunShadowMap[ i ], sunLight, UNROLLED_LOOP_INDEX ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	#if NUM_DIR_LIGHT_SHADOWS > 0

	DirectionalLightShadow directionalLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {

		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	#if NUM_SPOT_LIGHT_SHADOWS > 0

	SpotLightShadow spotLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {

		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	#if NUM_POINT_LIGHT_SHADOWS > 0 && ( defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_BASIC ) )

	PointLightShadow pointLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {

		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;

	}
	#pragma unroll_loop_end

	#endif

	/*
	#if NUM_RECT_AREA_LIGHTS > 0

		// TODO (abelnation): update shadow for Area light

	#endif
	*/

	#endif

	return shadow;

}
`,
  skinbase_vertex: `
#ifdef USE_SKINNING

	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );

#endif
`,
  skinning_pars_vertex: `
#ifdef USE_SKINNING

	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;

	uniform highp sampler2D boneTexture;

	mat4 getBoneMatrix( const in float i ) {

		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );

		return mat4( v1, v2, v3, v4 );

	}

#endif
`,
  skinning_vertex: `
#ifdef USE_SKINNING

	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );

	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;

	transformed = ( bindMatrixInverse * skinned ).xyz;

#endif
`,
  skinnormal_vertex: `
#ifdef USE_SKINNING

	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;

	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;

	#ifdef USE_TANGENT

		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;

	#endif

#endif
`,
  specularmap_fragment: `
float specularStrength;

#ifdef USE_SPECULARMAP

	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;

#else

	specularStrength = 1.0;

#endif
`,
  specularmap_pars_fragment: `
#ifdef USE_SPECULARMAP

	uniform sampler2D specularMap;

#endif
`,
  tonemapping_fragment: `
#if defined( TONE_MAPPING )

	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );

#endif
`,
  tonemapping_pars_fragment: `
#ifndef saturate
// <common> may have defined saturate() already
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif

uniform float toneMappingExposure;

// exposure only
vec3 LinearToneMapping( vec3 color ) {

	return saturate( toneMappingExposure * color );

}

// source: https://www.cs.utah.edu/docs/techreports/2002/pdf/UUCS-02-001.pdf
vec3 ReinhardToneMapping( vec3 color ) {

	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );

}

// source: http://filmicworlds.com/blog/filmic-tonemapping-operators/
vec3 CineonToneMapping( vec3 color ) {

	// filmic operator by Jim Hejl and Richard Burgess-Dawson
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );

}

// source: https://github.com/selfshadow/ltc_code/blob/master/webgl/shaders/ltc/ltc_blit.fs
vec3 RRTAndODTFit( vec3 v ) {

	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;

}

// this implementation of ACES is modified to accommodate a brighter viewing environment.
// the scale factor of 1/0.6 is subjective. see discussion in #19621.

vec3 ACESFilmicToneMapping( vec3 color ) {

	// sRGB => XYZ => D65_2_D60 => AP1 => RRT_SAT
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ), // transposed from source
		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);

	// ODT_SAT => XYZ => D60_2_D65 => sRGB
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ), // transposed from source
		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);

	color *= toneMappingExposure / 0.6;

	color = ACESInputMat * color;

	// Apply RRT and ODT
	color = RRTAndODTFit( color );

	color = ACESOutputMat * color;

	// Clamp to [0, 1]
	return saturate( color );

}

// Matrices for rec 2020 <> rec 709 color space conversion
// matrix provided in row-major order so it has been transposed
// https://www.itu.int/pub/R-REP-BT.2407-2017
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);

const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);

// https://iolite-engine.com/blog_posts/minimal_agx_implementation
// Mean error^2: 3.6705141e-06
vec3 agxDefaultContrastApprox( vec3 x ) {

	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;

	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;

}

// AgX Tone Mapping implementation based on Filament, which in turn is based
// on Blender's implementation using rec 2020 primaries
// https://github.com/google/filament/pull/7236
// Inputs and outputs are encoded as Linear-sRGB.

vec3 AgXToneMapping( vec3 color ) {

	// AgX constants
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);

	// explicit AgXOutsetMatrix generated from Filaments AgXOutsetMatrixInv
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);

	// LOG2_MIN      = -10.0
	// LOG2_MAX      =  +6.5
	// MIDDLE_GRAY   =  0.18
	const float AgxMinEv = - 12.47393;  // log2( pow( 2, LOG2_MIN ) * MIDDLE_GRAY )
	const float AgxMaxEv = 4.026069;    // log2( pow( 2, LOG2_MAX ) * MIDDLE_GRAY )

	color *= toneMappingExposure;

	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;

	color = AgXInsetMatrix * color;

	// Log2 encoding
	color = max( color, 1e-10 ); // avoid 0 or negative numbers for log2
	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );

	color = clamp( color, 0.0, 1.0 );

	// Apply sigmoid
	color = agxDefaultContrastApprox( color );

	// Apply AgX look
	// v = agxLook(v, look);

	color = AgXOutsetMatrix * color;

	// Linearize
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );

	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;

	// Gamut mapping. Simple clamp for now.
	color = clamp( color, 0.0, 1.0 );

	return color;

}

// https://modelviewer.dev/examples/tone-mapping

vec3 NeutralToneMapping( vec3 color ) {

	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;

	color *= toneMappingExposure;

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

vec3 CustomToneMapping( vec3 color ) { return color; }
`,
  transmission_fragment: `
#ifdef USE_TRANSMISSION

	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;

	#ifdef USE_TRANSMISSIONMAP

		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;

	#endif

	#ifdef USE_THICKNESSMAP

		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;

	#endif

	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = transformNormalByInverseViewMatrix( normal, viewMatrix );

	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseContribution, material.specularColorBlended, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );

	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );

	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );

#endif
`,
  transmission_pars_fragment: `
#ifdef USE_TRANSMISSION

	// Transmission code is based on glTF-Sampler-Viewer
	// https://github.com/KhronosGroup/glTF-Sample-Viewer

	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;

	#ifdef USE_TRANSMISSIONMAP

		uniform sampler2D transmissionMap;

	#endif

	#ifdef USE_THICKNESSMAP

		uniform sampler2D thicknessMap;

	#endif

	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;

	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;

	varying vec3 vWorldPosition;

	// Mipped Bicubic Texture Filtering by N8
	// https://www.shadertoy.com/view/Dl2SDW

	float w0( float a ) {

		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );

	}

	float w1( float a ) {

		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );

	}

	float w2( float a ){

		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );

	}

	float w3( float a ) {

		return ( 1.0 / 6.0 ) * ( a * a * a );

	}

	// g0 and g1 are the two amplitude functions
	float g0( float a ) {

		return w0( a ) + w1( a );

	}

	float g1( float a ) {

		return w2( a ) + w3( a );

	}

	// h0 and h1 are the two offset functions
	float h0( float a ) {

		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );

	}

	float h1( float a ) {

		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );

	}

	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {

		uv = uv * texelSize.zw + 0.5;

		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );

		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );

		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;

		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );

	}

	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {

		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );

	}

	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {

		// Direction of refracted light.
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );

		// Compute rotation-independent scaling of the model matrix.
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );

		// The thickness is specified in local space.
		return normalize( refractionVector ) * thickness * modelScale;

	}

	float applyIorToRoughness( const in float roughness, const in float ior ) {

		// Scale roughness with IOR so that an IOR of 1.0 results in no microfacet refraction and
		// an IOR of 1.5 results in the default amount of microfacet refraction.
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );

	}

	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {

		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );

	}

	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {

		if ( isinf( attenuationDistance ) ) {

			// Attenuation distance is +\u221E, i.e. the transmitted color is not attenuated at all.
			return vec3( 1.0 );

		} else {

			// Compute light attenuation using Beer's law.
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance ); // Beer's law
			return transmittance;

		}

	}

	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {

		vec4 transmittedLight;
		vec3 transmittance;

		#ifdef USE_DISPERSION

			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );

			for ( int i = 0; i < 3; i ++ ) {

				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;

				// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;

				// Sample framebuffer to get pixel the refracted ray hits.
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;

				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];

			}

			transmittedLight.a /= 3.0;

		#else

			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;

			// Project refracted vector on the framebuffer, while mapping to normalized device coordinates.
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;

			// Sample framebuffer to get pixel the refracted ray hits.
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );

		#endif

		vec3 attenuatedColor = transmittance * transmittedLight.rgb;

		// Get the specular component.
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );

		// As less light is transmitted, the opacity should be increased. This simple approximation does a decent job
		// of modulating a CSS background, and has no effect when the buffer is opaque, due to a solid object or clear color.
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;

		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );

	}
#endif
`,
  uv_pars_fragment: `
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;

#endif
#ifdef USE_MAP

	varying vec2 vMapUv;

#endif
#ifdef USE_ALPHAMAP

	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	varying vec2 vNormalMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_SPECULARMAP

	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`,
  uv_pars_vertex: `
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	varying vec2 vUv;

#endif
#ifdef USE_MAP

	uniform mat3 mapTransform;
	varying vec2 vMapUv;

#endif
#ifdef USE_ALPHAMAP

	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;

#endif
#ifdef USE_LIGHTMAP

	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;

#endif
#ifdef USE_AOMAP

	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;

#endif
#ifdef USE_BUMPMAP

	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;

#endif
#ifdef USE_NORMALMAP

	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;

#endif
#ifdef USE_DISPLACEMENTMAP

	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;

#endif
#ifdef USE_EMISSIVEMAP

	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;

#endif
#ifdef USE_METALNESSMAP

	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;

#endif
#ifdef USE_ROUGHNESSMAP

	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;

#endif
#ifdef USE_ANISOTROPYMAP

	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;

#endif
#ifdef USE_CLEARCOATMAP

	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;

#endif
#ifdef USE_SHEEN_COLORMAP

	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;

#endif
#ifdef USE_IRIDESCENCEMAP

	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;

#endif
#ifdef USE_SPECULARMAP

	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;

#endif
#ifdef USE_SPECULAR_COLORMAP

	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;

#endif
#ifdef USE_TRANSMISSIONMAP

	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;

#endif
#ifdef USE_THICKNESSMAP

	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;

#endif
`,
  uv_vertex: `
#if defined( USE_UV ) || defined( USE_ANISOTROPY )

	vUv = vec3( uv, 1 ).xy;

#endif
#ifdef USE_MAP

	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ALPHAMAP

	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_LIGHTMAP

	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_AOMAP

	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_BUMPMAP

	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_NORMALMAP

	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_DISPLACEMENTMAP

	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_EMISSIVEMAP

	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_METALNESSMAP

	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ROUGHNESSMAP

	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_ANISOTROPYMAP

	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOATMAP

	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOAT_NORMALMAP

	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP

	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_IRIDESCENCEMAP

	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP

	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SHEEN_COLORMAP

	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SHEEN_ROUGHNESSMAP

	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULARMAP

	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULAR_COLORMAP

	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_SPECULAR_INTENSITYMAP

	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_TRANSMISSIONMAP

	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;

#endif
#ifdef USE_THICKNESSMAP

	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;

#endif
`,
  worldpos_vertex: `
#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0

	vec4 worldPosition = vec4( transformed, 1.0 );

	#ifdef USE_BATCHING

		worldPosition = batchingMatrix * worldPosition;

	#endif

	#ifdef USE_INSTANCING

		worldPosition = instanceMatrix * worldPosition;

	#endif

	worldPosition = modelMatrix * worldPosition;

#endif
`,
  background_vert: `
varying vec2 vUv;
uniform mat3 uvTransform;

void main() {

	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

	gl_Position = vec4( position.xy, 1.0, 1.0 );

}
`,
  background_frag: `
uniform sampler2D t2D;
uniform float backgroundIntensity;

varying vec2 vUv;

void main() {

	vec4 texColor = texture2D( t2D, vUv );

	#ifdef DECODE_VIDEO_TEXTURE

		// use inline sRGB decode until browsers properly support SRGB8_ALPHA8 with video textures

		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );

	#endif

	texColor.rgb *= backgroundIntensity;

	gl_FragColor = texColor;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`,
  backgroundCube_vert: `
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

	gl_Position.z = gl_Position.w; // set z to camera.far

}
`,
  backgroundCube_frag: `

#ifdef ENVMAP_TYPE_CUBE

	uniform samplerCube envMap;

#elif defined( ENVMAP_TYPE_CUBE_UV )

	uniform sampler2D envMap;

#endif

uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;

varying vec3 vWorldDirection;

#include <cube_uv_reflection_fragment>

void main() {

	#ifdef ENVMAP_TYPE_CUBE

		vec4 texColor = textureCube( envMap, backgroundRotation * vWorldDirection );

	#elif defined( ENVMAP_TYPE_CUBE_UV )

		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );

	#else

		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );

	#endif

	texColor.rgb *= backgroundIntensity;

	gl_FragColor = texColor;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`,
  cube_vert: `
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

	gl_Position.z = gl_Position.w; // set z to camera.far

}
`,
  cube_frag: `
uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;

varying vec3 vWorldDirection;

void main() {

	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );

	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`,
  depth_vert: `
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

// This is used for computing an equivalent of gl_FragCoord.z that is as high precision as possible.
// Some platforms compute gl_FragCoord at a lower precision which makes the manually computed value better for
// depth-based postprocessing effects. Reproduced on iPad with A10 processor / iPadOS 13.3.1.
varying vec2 vHighPrecisionZW;

void main() {

	#include <uv_vertex>

	#include <batching_vertex>
	#include <skinbase_vertex>

	#include <morphinstance_vertex>

	#ifdef USE_DISPLACEMENTMAP

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vHighPrecisionZW = gl_Position.zw;

}
`,
  depth_frag: `
#if DEPTH_PACKING == 3200

	uniform float opacity;

#endif

#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

varying vec2 vHighPrecisionZW;

void main() {

	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>

	#if DEPTH_PACKING == 3200

		diffuseColor.a = opacity;

	#endif

	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	#include <logdepthbuf_fragment>

	// Higher precision equivalent of gl_FragCoord.z

	#ifdef USE_REVERSED_DEPTH_BUFFER

		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];

	#else

		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;

	#endif

	#if DEPTH_PACKING == 3200

		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );

	#elif DEPTH_PACKING == 3201

		// TODO Deprecate
		gl_FragColor = packDepthToRGBA( fragCoordZ );

	#elif DEPTH_PACKING == 3202

		// TODO Deprecate
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );

	#elif DEPTH_PACKING == 3203

		// TODO Deprecate
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );

	#endif

}
`,
  distance_vert: `
#define DISTANCE

varying vec3 vWorldPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>

	#include <batching_vertex>
	#include <skinbase_vertex>

	#include <morphinstance_vertex>

	#ifdef USE_DISPLACEMENTMAP

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>

	vWorldPosition = worldPosition.xyz;

}
`,
  distance_frag: `
#define DISTANCE

uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;

#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>

	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist ); // clamp to [ 0, 1 ]

	gl_FragColor = vec4( dist, 0.0, 0.0, 1.0 );

}
`,
  equirect_vert: `
varying vec3 vWorldDirection;

#include <common>

void main() {

	vWorldDirection = transformDirection( position, modelMatrix );

	#include <begin_vertex>
	#include <project_vertex>

}
`,
  equirect_frag: `
uniform sampler2D tEquirect;

varying vec3 vWorldDirection;

#include <common>

void main() {

	vec3 direction = normalize( vWorldDirection );

	vec2 sampleUV = equirectUv( direction );

	gl_FragColor = texture2D( tEquirect, sampleUV );

	#include <tonemapping_fragment>
	#include <colorspace_fragment>

}
`,
  linedashed_vert: `
uniform float scale;
attribute float lineDistance;

varying float vLineDistance;

#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	vLineDistance = scale * lineDistance;

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

}
`,
  linedashed_frag: `
uniform vec3 diffuse;
uniform float opacity;

uniform float dashSize;
uniform float totalSize;

varying float vLineDistance;

#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	if ( mod( vLineDistance, totalSize ) > dashSize ) {

		discard;

	}

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>

	outgoingLight = diffuseColor.rgb; // simple shader

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>

}
`,
  meshbasic_vert: `
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )

		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>

	#endif

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>

}
`,
  meshbasic_frag: `
uniform vec3 diffuse;
uniform float opacity;

#ifndef FLAT_SHADED

	varying vec3 vNormal;

#endif

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );

	// accumulation (baked indirect lighting only)
	#ifdef USE_LIGHTMAP

		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;

	#else

		reflectedLight.indirectDiffuse += vec3( 1.0 );

	#endif

	// modulation
	#include <aomap_fragment>

	reflectedLight.indirectDiffuse *= diffuseColor.rgb;

	vec3 outgoingLight = reflectedLight.indirectDiffuse;

	#include <envmap_fragment>

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  meshlambert_vert: `
#define LAMBERT

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,
  meshlambert_frag: `
#define LAMBERT

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;

	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  meshmatcap_vert: `
#define MATCAP

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>

#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

	vViewPosition = - mvPosition.xyz;

}
`,
  meshmatcap_frag: `
#define MATCAP

uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;

varying vec3 vViewPosition;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5; // 0.495 to remove artifacts caused by undersized matcap disks

	#ifdef USE_MATCAP

		vec4 matcapColor = texture2D( matcap, uv );

	#else

		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 ); // default if matcap is missing

	#endif

	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  meshnormal_vert: `
#define NORMAL

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	varying vec3 vViewPosition;

#endif

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	vViewPosition = - mvPosition.xyz;

#endif

}
`,
  meshnormal_frag: `
#define NORMAL

uniform float opacity;

#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )

	varying vec3 vViewPosition;

#endif

#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );

	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>

	gl_FragColor = vec4( normalize( normal ) * 0.5 + 0.5, diffuseColor.a );

	#ifdef OPAQUE

		gl_FragColor.a = 1.0;

	#endif

}
`,
  meshphong_vert: `
#define PHONG

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,
  meshphong_frag: `
#define PHONG

uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;

	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  meshphysical_vert: `
#define STANDARD

varying vec3 vViewPosition;

#ifdef USE_TRANSMISSION

	varying vec3 vWorldPosition;

#endif

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

#ifdef USE_TRANSMISSION

	vWorldPosition = worldPosition.xyz;

#endif
}
`,
  meshphysical_frag: `
#define STANDARD

#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;

#ifdef IOR
	uniform float ior;
#endif

#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;

	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif

	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif

#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif

#ifdef USE_DISPERSION
	uniform float dispersion;
#endif

#ifdef USE_RETROREFLECTION
	uniform float retroreflectivity;
#endif

#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif

#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;

	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif

	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif

#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;

	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif

varying vec3 vViewPosition;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;

	#include <transmission_fragment>

	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;

	#ifdef USE_SHEEN
 
		outgoingLight = outgoingLight + sheenSpecularDirect + sheenSpecularIndirect;
 
 	#endif

	#ifdef USE_CLEARCOAT

		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );

		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );

		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;

	#endif

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  meshtoon_vert: `
#define TOON

varying vec3 vViewPosition;

#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>

	vViewPosition = - mvPosition.xyz;

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,
  meshtoon_frag: `
#define TOON

uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;

#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>

	// accumulation
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>

	// modulation
	#include <aomap_fragment>

	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>

}
`,
  points_vert: `
uniform float size;
uniform float scale;

#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

#ifdef USE_POINTS_UV

	varying vec2 vUv;
	uniform mat3 uvTransform;

#endif

void main() {

	#ifdef USE_POINTS_UV

		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

	#endif

	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>

	gl_PointSize = size;

	#ifdef USE_SIZEATTENUATION

		bool isPerspective = isPerspectiveMatrix( projectionMatrix );

		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );

	#endif

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>

}
`,
  points_frag: `
uniform vec3 diffuse;
uniform float opacity;

#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	outgoingLight = diffuseColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>

}
`,
  shadow_vert: `
#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>

void main() {

	#include <batching_vertex>

	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>

	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>

	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>

}
`,
  shadow_frag: `
uniform vec3 color;
uniform float opacity;

#include <common>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>

void main() {

	#include <logdepthbuf_fragment>

	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );

	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>

}
`,
  sprite_vert: `
uniform float rotation;
uniform vec2 center;

#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>

void main() {

	#include <uv_vertex>

	vec4 mvPosition = modelViewMatrix[ 3 ];

	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );

	#ifndef USE_SIZEATTENUATION

		bool isPerspective = isPerspectiveMatrix( projectionMatrix );

		if ( isPerspective ) scale *= - mvPosition.z;

	#endif

	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;

	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;

	mvPosition.xy += rotatedPosition;

	gl_Position = projectionMatrix * mvPosition;

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>

}
`,
  sprite_frag: `
uniform vec3 diffuse;
uniform float opacity;

#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>

void main() {

	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>

	vec3 outgoingLight = vec3( 0.0 );

	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>

	outgoingLight = diffuseColor.rgb;

	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>

}
`
};

// src/renderers/shaders/ShaderLib.js
var MAX_DIR_LIGHTS = 4;
var MAX_POINT_LIGHTS = 8;
var MAX_SPOT_LIGHTS = 4;
var MAX_HEMI_LIGHTS = 2;
var MATERIAL_BASIC = 1;
var MATERIAL_LAMBERT = 2;
var MATERIAL_PHONG = 3;
var MATERIAL_STANDARD = 4;
var MATERIAL_NORMAL = 5;
var MATERIAL_DEPTH = 6;
var MATERIAL_LINE = 7;
var MATERIAL_POINTS = 8;
var MATERIAL_SPRITE = 9;
var MATERIAL_SHADER = 10;
var MATERIAL_SHADOW_DEPTH = 11;
var TEXTURE_UNITS = {
  map: 0,
  alphaMap: 1,
  normalMap: 2,
  emissiveMap: 3,
  roughnessMap: 4,
  metalnessMap: 5,
  aoMap: 6,
  specularMap: 7,
  bumpMap: 7,
  // shares with specularMap (never used together by one material type)
  dirShadowMap0: 8,
  dirShadowMap1: 9,
  dirShadowMap2: 10,
  dirShadowMap3: 11,
  spotShadowMap0: 12,
  spotShadowMap1: 13,
  spotShadowMap2: 14,
  spotShadowMap3: 15
};
var FRAME_BLOCK = (
  /* glsl */
  `
layout(std140) uniform Frame {
	mat4 projectionMatrix;
	mat4 viewMatrix;
	mat4 viewProjectionMatrix;
	vec4 cameraPosition;      // xyz, w = 1 for orthographic
	vec4 fogColor;            // rgb, w = fog type (0 none, 1 linear, 2 exp2)
	vec4 fogParams;           // near, far, density, toneMappingExposure
	vec4 viewport;            // x, y, width, height
};
`
);
var LIGHTS_BLOCK = (
  /* glsl */
  `
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
`
);
var LIGHTS_BLOCK_SIZE = 16 + 16 + MAX_DIR_LIGHTS * 32 + MAX_POINT_LIGHTS * 48 + MAX_SPOT_LIGHTS * 64 + MAX_HEMI_LIGHTS * 48 + MAX_DIR_LIGHTS * 64 + MAX_DIR_LIGHTS * 16 + MAX_SPOT_LIGHTS * 64 + MAX_SPOT_LIGHTS * 16;
var FRAME_BLOCK_SIZE = 64 * 3 + 16 * 4;
var MATERIAL_BLOCK = (
  /* glsl */
  `
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
`
);
var MATERIAL_BLOCK_SIZE = 16 * 8;
var common = (
  /* glsl */
  `
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
`
);
var vertexShader = (
  /* glsl */
  `
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
`
);
var fragmentShader = (
  /* glsl */
  `
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
`
);
function shadowFactorFunctions(numDir, numSpot) {
  let s = "";
  if (numDir > 0) {
    s += "float dirShadowFactor( int i ) {\n";
    for (let i = 0; i < numDir; i++) s += `	if ( i == ${i} ) return sampleShadow( dirShadowMap[ ${i} ], vDirShadowCoord[ ${i} ], dirShadowParams[ ${i} ] );
`;
    s += "	return 1.0;\n}\n";
  }
  if (numSpot > 0) {
    s += "float spotShadowFactor( int i ) {\n";
    for (let i = 0; i < numSpot; i++) s += `	if ( i == ${i} ) return sampleShadow( spotShadowMap[ ${i} ], vSpotShadowCoord[ ${i} ], spotShadowParams[ ${i} ] );
`;
    s += "	return 1.0;\n}\n";
  }
  return s;
}
var spriteUniform = "uniform vec2 uSpriteCenter;\n";
function buildBuiltinShader(p) {
  const defines = [];
  const d = (name, value) => defines.push(value === void 0 ? `#define ${name}` : `#define ${name} ${value}`);
  switch (p.materialType) {
    case MATERIAL_LAMBERT:
      d("LIGHTING_LAMBERT");
      d("USE_NORMAL");
      break;
    case MATERIAL_PHONG:
      d("LIGHTING_PHONG");
      d("USE_NORMAL");
      break;
    case MATERIAL_STANDARD:
      d("LIGHTING_STANDARD");
      d("USE_NORMAL");
      break;
    case MATERIAL_NORMAL:
      d("IS_NORMAL_MATERIAL");
      d("USE_NORMAL");
      break;
    case MATERIAL_DEPTH:
    case MATERIAL_SHADOW_DEPTH:
      d("IS_DEPTH");
      break;
    case MATERIAL_POINTS:
      d("IS_POINTS");
      break;
    case MATERIAL_SPRITE:
      d("IS_SPRITE");
      break;
  }
  if (p.map) d("USE_MAP");
  if (p.alphaMap) d("USE_ALPHAMAP");
  if (p.emissiveMap) d("USE_EMISSIVEMAP");
  if (p.normalMap) d("USE_NORMALMAP");
  if (p.roughnessMap) d("USE_ROUGHNESSMAP");
  if (p.metalnessMap) d("USE_METALNESSMAP");
  if (p.aoMap) d("USE_AOMAP");
  if (p.specularMap) d("USE_SPECULARMAP");
  if (p.useUv) d("USE_UV");
  if (p.useUv1) d("USE_UV1");
  if (p.vertexColors) d("USE_COLOR");
  if (p.vertexAlphas) d("USE_COLOR_ALPHA");
  if (p.instancing) d("USE_INSTANCING");
  if (p.instancingColor) d("USE_INSTANCING_COLOR");
  if (p.flatShading) d("FLAT_SHADED");
  if (p.doubleSided) d("DOUBLE_SIDED");
  if (p.fog) d("USE_FOG");
  if (p.alphaTest) d("USE_ALPHATEST");
  if (p.sizeAttenuation) d("SIZE_ATTENUATION");
  if (p.premultipliedAlpha) d("PREMULTIPLIED_ALPHA");
  if (p.dithering) d("DITHERING");
  if (p.toneMapped) d("TONE_MAPPED");
  if (p.sRGBOutput) d("SRGB_OUTPUT");
  d("TONE_MAPPING", p.toneMapping | 0);
  d("NUM_DIR_SHADOWS", p.numDirShadows | 0);
  d("NUM_SPOT_SHADOWS", p.numSpotShadows | 0);
  const prefix = "#version 300 es\n" + defines.join("\n") + "\n";
  const vsExtra = p.materialType === MATERIAL_SPRITE ? spriteUniform : "";
  const vs = prefix + vsExtra + vertexShader;
  let fs = fragmentShader;
  const helpers = shadowFactorFunctions(p.numDirShadows | 0, p.numSpotShadows | 0);
  if (helpers !== "") fs = fs.replace("#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb", helpers + "#ifdef USE_NORMALMAP\nvec3 perturbNormal2Arb");
  return { vertexShader: vs, fragmentShader: prefix + fs };
}
var toneMappingFunctions = {
  [LinearToneMapping]: "Linear",
  [ReinhardToneMapping]: "Reinhard",
  [CineonToneMapping]: "Cineon",
  [ACESFilmicToneMapping]: "ACESFilmic",
  [AgXToneMapping]: "AgX",
  [NeutralToneMapping]: "Neutral",
  5: "Custom"
};
var includePattern = /^[ \t]*#include +<([\w\d./]+)>/gm;
var unrollLoopPattern = /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;
var warnedIncludes = /* @__PURE__ */ new Set();
function resolveIncludes(string) {
  return string.replace(includePattern, (match, include) => {
    const chunk = ShaderChunk[include];
    if (chunk === void 0) {
      if (!warnedIncludes.has(include)) {
        warnedIncludes.add(include);
        console.warn(`jrs: can not resolve #include <${include}>; the directive was removed.`);
      }
      return "";
    }
    return resolveIncludes(chunk);
  });
}
function unrollLoops(string) {
  return string.replace(unrollLoopPattern, (match, start, end, snippet) => {
    let out = "";
    for (let i = parseInt(start); i < parseInt(end); i++) out += snippet.replace(/\[\s*i\s*\]/g, "[ " + i + " ]").replace(/UNROLLED_LOOP_INDEX/g, i);
    return out;
  });
}
var LIGHT_NUMS = [
  "NUM_SUN_LIGHTS",
  "NUM_DIR_LIGHTS",
  "NUM_SPOT_LIGHTS",
  "NUM_SPOT_LIGHT_MAPS",
  "NUM_SPOT_LIGHT_COORDS",
  "NUM_RECT_AREA_LIGHTS",
  "NUM_POINT_LIGHTS",
  "NUM_HEMI_LIGHTS",
  "NUM_SUN_LIGHT_SHADOWS",
  "NUM_DIR_LIGHT_SHADOWS",
  "NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS",
  "NUM_SPOT_LIGHT_SHADOWS",
  "NUM_POINT_LIGHT_SHADOWS"
];
function replaceLightNums(string, defines) {
  for (const name of LIGHT_NUMS) {
    const value = defines && defines[name] !== void 0 ? defines[name] : 0;
    string = string.replace(new RegExp(name + "(?![A-Z_])", "g"), String(value));
  }
  return string;
}
function generatePrecision(precision) {
  const kinds = ["float", "int", "sampler2D", "samplerCube", "sampler3D", "sampler2DArray", "sampler2DShadow", "samplerCubeShadow", "sampler2DArrayShadow", "isampler2D", "isampler3D", "isamplerCube", "isampler2DArray", "usampler2D", "usampler3D", "usamplerCube", "usampler2DArray"];
  let out = kinds.map((k) => `precision ${precision} ${k};`).join("\n");
  out += precision === "highp" ? "\n#define HIGH_PRECISION" : precision === "mediump" ? "\n#define MEDIUM_PRECISION" : "\n#define LOW_PRECISION";
  return out;
}
function generateDefines(defines) {
  const chunks = [];
  for (const name in defines) {
    const value = defines[name];
    if (value === false) continue;
    chunks.push("#define " + name + " " + value);
  }
  return chunks.join("\n");
}
var filterEmptyLine = (string) => string !== "";
function buildCustomShader(material, p) {
  const isRaw = material.isRawShaderMaterial === true;
  const glsl3 = material.glslVersion === "300 es";
  const precision = material.precision || "highp";
  const customDefines = generateDefines(material.defines || {});
  const shaderName = material.name || material.type;
  const toneMapping = p.toneMapping | 0;
  const colorSpaceFn = p.sRGBOutput ? "sRGBTransferOETF" : "LinearTransferOETF";
  let prefixVertex, prefixFragment;
  if (isRaw) {
    prefixVertex = [customDefines].filter(filterEmptyLine).join("\n");
    prefixFragment = [customDefines].filter(filterEmptyLine).join("\n");
  } else {
    prefixVertex = [
      generatePrecision(precision),
      "#define SHADER_TYPE " + material.type,
      "#define SHADER_NAME " + shaderName,
      customDefines,
      p.instancing ? "#define USE_INSTANCING" : "",
      p.instancingColor ? "#define USE_INSTANCING_COLOR" : "",
      p.fog ? "#define USE_FOG" : "",
      p.fogExp2 ? "#define FOG_EXP2" : "",
      p.vertexColors ? "#define USE_COLOR" : "",
      p.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
      p.vertexUv1s ? "#define USE_UV1" : "",
      p.flatShading ? "#define FLAT_SHADED" : "",
      p.doubleSided ? "#define DOUBLE_SIDED" : "",
      p.sizeAttenuation ? "#define USE_SIZEATTENUATION" : "",
      "uniform mat4 modelMatrix;",
      "uniform mat4 modelViewMatrix;",
      "uniform mat4 projectionMatrix;",
      "uniform mat4 viewMatrix;",
      "uniform mat3 normalMatrix;",
      "uniform vec3 cameraPosition;",
      "uniform bool isOrthographic;",
      "#ifdef USE_INSTANCING",
      "	attribute mat4 instanceMatrix;",
      "#endif",
      "#ifdef USE_INSTANCING_COLOR",
      "	attribute vec3 instanceColor;",
      "#endif",
      "attribute vec3 position;",
      "attribute vec3 normal;",
      "attribute vec2 uv;",
      "#ifdef USE_UV1",
      "	attribute vec2 uv1;",
      "#endif",
      "#ifdef USE_TANGENT",
      "	attribute vec4 tangent;",
      "#endif",
      "#if defined( USE_COLOR_ALPHA )",
      "	attribute vec4 color;",
      "#elif defined( USE_COLOR )",
      "	attribute vec3 color;",
      "#endif",
      "#ifdef USE_SKINNING",
      "	attribute vec4 skinIndex;",
      "	attribute vec4 skinWeight;",
      "#endif",
      "\n"
    ].filter(filterEmptyLine).join("\n");
    const encodingMatrix = "mat3( 1.0000, 0.0000, 0.0000, 0.0000, 1.0000, 0.0000, 0.0000, 0.0000, 1.0000 )";
    prefixFragment = [
      generatePrecision(precision),
      "#define SHADER_TYPE " + material.type,
      "#define SHADER_NAME " + shaderName,
      customDefines,
      p.fog ? "#define USE_FOG" : "",
      p.fogExp2 ? "#define FOG_EXP2" : "",
      p.vertexColors ? "#define USE_COLOR" : "",
      p.vertexAlphas ? "#define USE_COLOR_ALPHA" : "",
      p.vertexUv1s ? "#define USE_UV1" : "",
      p.flatShading ? "#define FLAT_SHADED" : "",
      p.doubleSided ? "#define DOUBLE_SIDED" : "",
      p.premultipliedAlpha ? "#define PREMULTIPLIED_ALPHA" : "",
      "uniform mat4 viewMatrix;",
      "uniform vec3 cameraPosition;",
      "uniform bool isOrthographic;",
      toneMapping !== NoToneMapping ? "#define TONE_MAPPING" : "",
      toneMapping !== NoToneMapping ? ShaderChunk["tonemapping_pars_fragment"] : "",
      toneMapping !== NoToneMapping ? `vec3 toneMapping( vec3 color ) { return ${toneMappingFunctions[toneMapping] || "Linear"}ToneMapping( color ); }` : "",
      p.dithering ? "#define DITHERING" : "",
      material.transparent === false ? "#define OPAQUE" : "",
      ShaderChunk["colorspace_pars_fragment"],
      `vec4 linearToOutputTexel( vec4 value ) {
	return ${colorSpaceFn}( vec4( value.rgb * ${encodingMatrix}, value.a ) );
}`,
      "\n"
    ].filter(filterEmptyLine).join("\n");
  }
  let vertexShader2 = material.vertexShader, fragmentShader2 = material.fragmentShader;
  vertexShader2 = resolveIncludes(vertexShader2);
  vertexShader2 = replaceLightNums(vertexShader2, material.defines);
  fragmentShader2 = resolveIncludes(fragmentShader2);
  fragmentShader2 = replaceLightNums(fragmentShader2, material.defines);
  vertexShader2 = unrollLoops(vertexShader2);
  fragmentShader2 = unrollLoops(fragmentShader2);
  const versionString = "#version 300 es\n";
  if (!glsl3 || !isRaw) {
    prefixVertex = ["precision mediump sampler2DArray;", "#define attribute in", "#define varying out", "#define texture2D texture"].join("\n") + "\n" + prefixVertex;
    prefixFragment = [
      "precision mediump sampler2DArray;",
      "#define varying in",
      glsl3 ? "" : "layout(location = 0) out highp vec4 pc_fragColor;",
      glsl3 ? "" : "#define gl_FragColor pc_fragColor",
      "#define gl_FragDepthEXT gl_FragDepth",
      "#define texture2D texture",
      "#define textureCube texture",
      "#define texture2DProj textureProj",
      "#define texture2DLodEXT textureLod",
      "#define texture2DProjLodEXT textureProjLod",
      "#define textureCubeLodEXT textureLod",
      "#define texture2DGradEXT textureGrad",
      "#define texture2DProjGradEXT textureProjGrad",
      "#define textureCubeGradEXT textureGrad"
    ].filter(filterEmptyLine).join("\n") + "\n" + prefixFragment;
  }
  return { vertexShader: versionString + prefixVertex + vertexShader2, fragmentShader: versionString + prefixFragment + fragmentShader2 };
}

// src/renderers/webgl/WebGLPrograms.js
var BLOCK_FRAME = 0;
var BLOCK_LIGHTS = 1;
var BLOCK_MATERIAL = 2;
var _programId = 0;
var FIXED_ATTRIBUTES = { position: 0, normal: 1, uv: 2, color: 3, uv1: 4, instanceColor: 5, instanceMatrix: 8 };
var WebGLProgram = class {
  constructor(gl, parameters, vertexSource, fragmentSource) {
    this.id = _programId++;
    this.parameters = parameters;
    this.usedTimes = 1;
    const program = gl.createProgram();
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, "position");
    gl.bindAttribLocation(program, 1, "normal");
    gl.bindAttribLocation(program, 2, "uv");
    gl.bindAttribLocation(program, 3, "color");
    gl.bindAttribLocation(program, 4, "uv1");
    gl.bindAttribLocation(program, 5, "instanceColor");
    gl.bindAttribLocation(program, 8, "instanceMatrix");
    gl.linkProgram(program);
    if (gl.getProgramParameter(program, gl.LINK_STATUS) === false) {
      const log = gl.getProgramInfoLog(program);
      const vlog = gl.getShaderInfoLog(vs), flog = gl.getShaderInfoLog(fs);
      console.error("WebGLProgram: link failed\n" + log + "\nVERTEX:\n" + vlog + "\n" + addLineNumbers(vertexSource) + "\nFRAGMENT:\n" + flog + "\n" + addLineNumbers(fragmentSource));
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = program;
    this.uniforms = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(program, i);
      let name = info.name;
      if (name.endsWith("[0]")) name = name.slice(0, -3);
      const location = gl.getUniformLocation(program, info.name);
      if (location === null) continue;
      this.uniforms[name] = { location, type: info.type, size: info.size };
    }
    this.modelMatrixLocation = this.uniforms.modelMatrix ? this.uniforms.modelMatrix.location : null;
    this.normalMatrixLocation = this.uniforms.normalMatrix ? this.uniforms.normalMatrix.location : null;
    this.modelViewMatrixLocation = this.uniforms.modelViewMatrix ? this.uniforms.modelViewMatrix.location : null;
    this.spriteCenterLocation = this.uniforms.uSpriteCenter ? this.uniforms.uSpriteCenter.location : null;
    const bind = (name, index) => {
      const bi = gl.getUniformBlockIndex(program, name);
      if (bi !== gl.INVALID_INDEX && bi !== 4294967295) {
        gl.uniformBlockBinding(program, bi, index);
        return true;
      }
      return false;
    };
    this.hasFrameBlock = bind("Frame", BLOCK_FRAME);
    this.hasLightsBlock = bind("Lights", BLOCK_LIGHTS);
    this.hasMaterialBlock = bind("Material", BLOCK_MATERIAL);
    this.attributes = {};
    this.customAttributes = [];
    const na = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);
    for (let i = 0; i < na; i++) {
      const info = gl.getActiveAttrib(program, i);
      const location = gl.getAttribLocation(program, info.name);
      const record = { name: info.name, location, type: info.type, size: info.size, locationSize: info.type === gl.FLOAT_MAT4 ? 4 : info.type === gl.FLOAT_MAT3 ? 3 : info.type === gl.FLOAT_MAT2 ? 2 : 1 };
      this.attributes[info.name] = record;
      if (FIXED_ATTRIBUTES[info.name] === void 0 && location >= 0) this.customAttributes.push(record);
    }
    this.hasCustomAttributes = this.customAttributes.length > 0;
    gl.useProgram(program);
    for (const name in this.uniforms) {
      const u = this.uniforms[name];
      if (u.type === gl.SAMPLER_2D || u.type === gl.SAMPLER_2D_SHADOW || u.type === gl.SAMPLER_CUBE) {
        if (u.size > 1) {
          const base = TEXTURE_UNITS[name + "0"];
          if (base !== void 0) {
            const units = new Int32Array(u.size);
            for (let k = 0; k < u.size; k++) units[k] = base + k;
            gl.uniform1iv(u.location, units);
          }
        } else if (TEXTURE_UNITS[name] !== void 0) {
          gl.uniform1i(u.location, TEXTURE_UNITS[name]);
        }
      }
    }
    this.materialVersion = -1;
    this.materialId = -1;
  }
  destroy(gl) {
    gl.deleteProgram(this.program);
  }
};
function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}
function addLineNumbers(string) {
  const lines = string.split("\n");
  for (let i = 0; i < lines.length; i++) lines[i] = i + 1 + ": " + lines[i];
  return lines.join("\n");
}
function materialTypeOf(material) {
  if (material.isMeshStandardMaterial) return MATERIAL_STANDARD;
  if (material.isMeshPhongMaterial) return MATERIAL_PHONG;
  if (material.isMeshLambertMaterial) return MATERIAL_LAMBERT;
  if (material.isMeshBasicMaterial) return MATERIAL_BASIC;
  if (material.isMeshNormalMaterial) return MATERIAL_NORMAL;
  if (material.isMeshDepthMaterial) return MATERIAL_DEPTH;
  if (material.isLineBasicMaterial) return MATERIAL_LINE;
  if (material.isPointsMaterial) return MATERIAL_POINTS;
  if (material.isSpriteMaterial) return MATERIAL_SPRITE;
  if (material.isShaderMaterial) return MATERIAL_SHADER;
  return MATERIAL_BASIC;
}
var WebGLPrograms = class {
  constructor(gl, renderer) {
    this.gl = gl;
    this.renderer = renderer;
    this.cache = /* @__PURE__ */ new Map();
    this.programs = [];
  }
  /** Compute the integer key + parameters for a built-in material. */
  getParameters(material, object, scene, lights, variant) {
    const renderer = this.renderer;
    const materialType = variant.shadowPass ? MATERIAL_SHADOW_DEPTH : materialTypeOf(material);
    const geometry = object.geometry;
    const attributes = geometry.attributes;
    const isLit = materialType === MATERIAL_LAMBERT || materialType === MATERIAL_PHONG || materialType === MATERIAL_STANDARD;
    const hasUv = attributes.uv !== void 0;
    const hasUv1 = attributes.uv1 !== void 0;
    const vertexColors = material.vertexColors === true && attributes.color !== void 0;
    const fog = scene.fog !== null && material.fog === true && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH;
    const map = !!material.map;
    const alphaMap = !!material.alphaMap;
    const emissiveMap = isLit && !!material.emissiveMap;
    const normalMap = isLit && !!material.normalMap;
    const roughnessMap = materialType === MATERIAL_STANDARD && !!material.roughnessMap;
    const metalnessMap = materialType === MATERIAL_STANDARD && !!material.metalnessMap;
    const aoMap = (isLit || materialType === MATERIAL_BASIC) && !!material.aoMap;
    const specularMap = materialType === MATERIAL_PHONG && !!material.specularMap;
    const useUv = hasUv && (map || alphaMap || emissiveMap || normalMap || roughnessMap || metalnessMap || aoMap || specularMap) && materialType !== MATERIAL_POINTS;
    const useUv1 = hasUv1 && aoMap;
    const receiveShadow = variant.receiveShadow && isLit && renderer.shadowMap.enabled;
    const numDirShadows = receiveShadow ? lights.numDirShadows : 0;
    const numSpotShadows = receiveShadow ? lights.numSpotShadows : 0;
    const toneMapping = material.toneMapped && renderer.toneMapping !== NoToneMapping && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL ? renderer.toneMapping : NoToneMapping;
    const currentRenderTarget = renderer.getRenderTarget();
    const sRGBOutput = (currentRenderTarget === null ? renderer.outputColorSpace : currentRenderTarget.texture.colorSpace) === SRGBColorSpace && materialType !== MATERIAL_SHADOW_DEPTH && materialType !== MATERIAL_DEPTH && materialType !== MATERIAL_NORMAL;
    const p = {
      materialType,
      map,
      alphaMap,
      emissiveMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      aoMap,
      specularMap,
      useUv,
      useUv1,
      vertexColors,
      vertexAlphas: vertexColors && attributes.color.itemSize === 4,
      instancing: variant.instancing,
      instancingColor: variant.instancing && variant.instancingColor,
      flatShading: isLit && material.flatShading === true,
      doubleSided: material.side === DoubleSide,
      fog,
      fogExp2: fog && scene.fog.isFogExp2 === true,
      alphaTest: material.alphaTest > 0,
      sizeAttenuation: (materialType === MATERIAL_POINTS || materialType === MATERIAL_SPRITE) && material.sizeAttenuation === true,
      premultipliedAlpha: material.premultipliedAlpha === true,
      dithering: material.dithering === true,
      vertexUv1s: hasUv1,
      toneMapped: toneMapping !== NoToneMapping,
      toneMapping,
      sRGBOutput,
      numDirShadows,
      numSpotShadows
    };
    let key = materialType;
    key = key * 2 + (map ? 1 : 0);
    key = key * 2 + (alphaMap ? 1 : 0);
    key = key * 2 + (emissiveMap ? 1 : 0);
    key = key * 2 + (normalMap ? 1 : 0);
    key = key * 2 + (roughnessMap ? 1 : 0);
    key = key * 2 + (metalnessMap ? 1 : 0);
    key = key * 2 + (aoMap ? 1 : 0);
    key = key * 2 + (specularMap ? 1 : 0);
    key = key * 2 + (useUv ? 1 : 0);
    key = key * 2 + (useUv1 ? 1 : 0);
    key = key * 2 + (vertexColors ? 1 : 0);
    key = key * 2 + (p.vertexAlphas ? 1 : 0);
    key = key * 2 + (p.instancing ? 1 : 0);
    key = key * 2 + (p.instancingColor ? 1 : 0);
    key = key * 2 + (p.flatShading ? 1 : 0);
    key = key * 2 + (p.doubleSided ? 1 : 0);
    key = key * 2 + (fog ? 1 : 0);
    key = key * 2 + (p.alphaTest ? 1 : 0);
    key = key * 2 + (p.sizeAttenuation ? 1 : 0);
    key = key * 2 + (p.premultipliedAlpha ? 1 : 0);
    key = key * 2 + (p.dithering ? 1 : 0);
    key = key * 2 + (hasUv1 ? 1 : 0);
    key = key * 8 + toneMapping;
    key = key * 2 + (sRGBOutput ? 1 : 0);
    key = key * 8 + numDirShadows;
    key = key * 8 + numSpotShadows;
    p.key = key;
    return p;
  }
  acquireProgram(parameters, material) {
    let key = parameters.key;
    if (parameters.materialType === MATERIAL_SHADER) {
      key = "S" + material.id + ":" + (material.customProgramCacheKey ? material.customProgramCacheKey() : "") + ":" + parameters.key;
    }
    let program = this.cache.get(key);
    if (program === void 0) {
      const src = parameters.materialType === MATERIAL_SHADER ? buildCustomShader(material, parameters) : buildBuiltinShader(parameters);
      program = new WebGLProgram(this.gl, parameters, src.vertexShader, src.fragmentShader);
      this.cache.set(key, program);
      this.programs.push(program);
      program.cacheKey = key;
    } else {
      program.usedTimes++;
    }
    return program;
  }
  releaseProgram(program) {
    if (--program.usedTimes === 0) {
      this.cache.delete(program.cacheKey);
      const i = this.programs.indexOf(program);
      if (i !== -1) this.programs.splice(i, 1);
      program.destroy(this.gl);
    }
  }
  dispose() {
    for (const p of this.programs) p.destroy(this.gl);
    this.programs.length = 0;
    this.cache.clear();
  }
};

// src/renderers/webgl/WebGLRenderLists.js
var INDEX_BITS = 20;
var INDEX_RANGE = 1 << INDEX_BITS;
var WebGLRenderList = class {
  constructor() {
    this.items = [];
    this.count = 0;
    this.opaqueKeys = new Float64Array(1024);
    this.transparentKeys = new Float64Array(256);
    this.opaqueCount = 0;
    this.transparentCount = 0;
    this.transparentDepth = new Float32Array(256);
    this.opaqueSorted = null;
    this.transparentSorted = null;
    this.minDepth = Infinity;
    this.maxDepth = -Infinity;
  }
  init() {
    this.count = 0;
    this.opaqueCount = 0;
    this.transparentCount = 0;
    this.minDepth = Infinity;
    this.maxDepth = -Infinity;
  }
  _getItem(object, geometry, material, group, z, variant) {
    let item = this.items[this.count];
    if (item === void 0) {
      item = { id: object.id, object, geometry, material, program: null, group, z, renderOrder: object.renderOrder, materialRid: 0, geometryRid: 0, variant };
      this.items[this.count] = item;
    } else {
      item.id = object.id;
      item.object = object;
      item.geometry = geometry;
      item.material = material;
      item.program = null;
      item.group = group;
      item.z = z;
      item.renderOrder = object.renderOrder;
      item.variant = variant;
    }
    this.count++;
    return item;
  }
  /**
   * Adds an item. `item.program` is resolved later by the renderer (once the frame's lights are known).
   */
  push(object, geometry, material, group, z, materialRid, geometryRid, variant) {
    if (this.count >= INDEX_RANGE) return;
    const item = this._getItem(object, geometry, material, group, z, variant);
    item.materialRid = materialRid;
    item.geometryRid = geometryRid;
    const index = this.count - 1;
    if (material.transparent === true) {
      if (this.transparentCount === this.transparentKeys.length) {
        const nk = new Float64Array(this.transparentKeys.length * 2);
        nk.set(this.transparentKeys);
        this.transparentKeys = nk;
        const nd = new Float32Array(this.transparentDepth.length * 2);
        nd.set(this.transparentDepth);
        this.transparentDepth = nd;
      }
      this.transparentKeys[this.transparentCount] = index;
      this.transparentDepth[this.transparentCount] = z;
      if (z < this.minDepth) this.minDepth = z;
      if (z > this.maxDepth) this.maxDepth = z;
      this.transparentCount++;
    } else {
      if (this.opaqueCount === this.opaqueKeys.length) {
        const nk = new Float64Array(this.opaqueKeys.length * 2);
        nk.set(this.opaqueKeys);
        this.opaqueKeys = nk;
      }
      this.opaqueKeys[this.opaqueCount++] = index;
    }
  }
  /**
   * Build keys and sort. `rankOf(renderOrder)` maps a renderOrder value to 0..63.
   */
  finish(sortObjects, rankOf) {
    const items = this.items;
    const ok = this.opaqueKeys, on = this.opaqueCount;
    for (let i = 0; i < on; i++) {
      const index = ok[i];
      const item = items[index];
      const rank = rankOf(item.renderOrder);
      const program = item.program.id & 63;
      const mat = item.materialRid & 1023;
      const geo = item.geometryRid & 1023;
      ok[i] = (((rank * 64 + program) * 1024 + mat) * 1024 + geo) * INDEX_RANGE + index;
    }
    this.opaqueSorted = ok.subarray(0, on);
    if (sortObjects && on > 1) this.opaqueSorted.sort();
    const tk = this.transparentKeys, tn = this.transparentCount, td = this.transparentDepth;
    const range = this.maxDepth - this.minDepth;
    const scale = range > 0 ? 67108863 / range : 0;
    for (let i = 0; i < tn; i++) {
      const index = tk[i];
      const item = items[index];
      const rank = rankOf(item.renderOrder);
      const depthKey = Math.round((this.maxDepth - td[i]) * scale);
      tk[i] = (rank * 67108864 + depthKey) * INDEX_RANGE + index;
    }
    this.transparentSorted = tk.subarray(0, tn);
    if (sortObjects && tn > 1) this.transparentSorted.sort();
  }
  /** Item for a sorted key. */
  itemFromKey(key) {
    return this.items[key % INDEX_RANGE];
  }
};
var WebGLRenderLists = class {
  constructor() {
    this.lists = /* @__PURE__ */ new WeakMap();
  }
  get(scene, renderCallDepth) {
    const listArray = this.lists.get(scene);
    let list;
    if (listArray === void 0) {
      list = new WebGLRenderList();
      this.lists.set(scene, [list]);
    } else {
      if (renderCallDepth >= listArray.length) {
        list = new WebGLRenderList();
        listArray.push(list);
      } else list = listArray[renderCallDepth];
    }
    return list;
  }
  dispose() {
    this.lists = /* @__PURE__ */ new WeakMap();
  }
};

// src/renderers/webgl/WebGLLights.js
var _v = /* @__PURE__ */ new Vector3();
var _v23 = /* @__PURE__ */ new Vector3();
var OFF_COUNTS = 16;
var OFF_DIR = 32;
var OFF_POINT = OFF_DIR + MAX_DIR_LIGHTS * 32;
var OFF_SPOT = OFF_POINT + MAX_POINT_LIGHTS * 48;
var OFF_HEMI = OFF_SPOT + MAX_SPOT_LIGHTS * 64;
var OFF_DIR_SHADOW_MAT = OFF_HEMI + MAX_HEMI_LIGHTS * 48;
var OFF_DIR_SHADOW_PARAMS = OFF_DIR_SHADOW_MAT + MAX_DIR_LIGHTS * 64;
var OFF_SPOT_SHADOW_MAT = OFF_DIR_SHADOW_PARAMS + MAX_DIR_LIGHTS * 16;
var OFF_SPOT_SHADOW_PARAMS = OFF_SPOT_SHADOW_MAT + MAX_SPOT_LIGHTS * 64;
var WebGLLights = class {
  constructor() {
    this.data = new Float32Array(LIGHTS_BLOCK_SIZE / 4);
    this.ints = new Int32Array(this.data.buffer);
    this.ambient = new Color(0, 0, 0);
    this.dir = [];
    this.point = [];
    this.spot = [];
    this.hemi = [];
    this.dirShadows = [];
    this.spotShadows = [];
    this.numDirShadows = 0;
    this.numSpotShadows = 0;
    this.version = 0;
    this.hash = "";
  }
  begin() {
    this.ambient.setRGB(0, 0, 0);
    this.dir.length = 0;
    this.point.length = 0;
    this.spot.length = 0;
    this.hemi.length = 0;
    this.dirShadows.length = 0;
    this.spotShadows.length = 0;
  }
  push(light) {
    if (light.isAmbientLight) {
      const c = light.color, i = light.intensity;
      this.ambient.r += c.r * i;
      this.ambient.g += c.g * i;
      this.ambient.b += c.b * i;
    } else if (light.isDirectionalLight) {
      if (this.dir.length < MAX_DIR_LIGHTS) {
        this.dir.push(light);
        if (light.castShadow) this.dirShadows.push(light);
      }
    } else if (light.isPointLight) {
      if (this.point.length < MAX_POINT_LIGHTS) this.point.push(light);
    } else if (light.isSpotLight) {
      if (this.spot.length < MAX_SPOT_LIGHTS) {
        this.spot.push(light);
        if (light.castShadow) this.spotShadows.push(light);
      }
    } else if (light.isHemisphereLight) {
      if (this.hemi.length < MAX_HEMI_LIGHTS) this.hemi.push(light);
    }
  }
  /** Shadow-casting lights come first within their type so sampler indices line up. */
  end(shadowsEnabled) {
    if (shadowsEnabled) {
      this.dir.sort(shadowCastingFirst);
      this.spot.sort(shadowCastingFirst);
      this.numDirShadows = Math.min(this.dirShadows.length, MAX_DIR_LIGHTS);
      this.numSpotShadows = Math.min(this.spotShadows.length, MAX_SPOT_LIGHTS);
    } else {
      this.numDirShadows = 0;
      this.numSpotShadows = 0;
    }
    const hash = this.numDirShadows + ":" + this.numSpotShadows;
    if (hash !== this.hash) {
      this.hash = hash;
      this.version++;
    }
  }
  /** Write the collected lights into the std140 buffer image. Call after shadow matrices are updated. */
  fill() {
    const d = this.data, ints = this.ints;
    d[0] = this.ambient.r;
    d[1] = this.ambient.g;
    d[2] = this.ambient.b;
    d[3] = 1;
    ints[OFF_COUNTS / 4] = this.dir.length;
    ints[OFF_COUNTS / 4 + 1] = this.point.length;
    ints[OFF_COUNTS / 4 + 2] = this.spot.length;
    ints[OFF_COUNTS / 4 + 3] = this.hemi.length;
    for (let i = 0; i < this.dir.length; i++) {
      const light = this.dir[i], o = (OFF_DIR + i * 32) / 4;
      _v.setFromMatrixPosition(light.matrixWorld);
      _v23.setFromMatrixPosition(light.target.matrixWorld);
      _v.sub(_v23).normalize();
      d[o] = _v.x;
      d[o + 1] = _v.y;
      d[o + 2] = _v.z;
      d[o + 3] = 0;
      const c = light.color, k = light.intensity;
      d[o + 4] = c.r * k;
      d[o + 5] = c.g * k;
      d[o + 6] = c.b * k;
      d[o + 7] = 0;
      if (i < this.numDirShadows) {
        const shadow = light.shadow;
        const mo = (OFF_DIR_SHADOW_MAT + i * 64) / 4;
        const me = shadow.matrix.elements;
        for (let k2 = 0; k2 < 16; k2++) d[mo + k2] = me[k2];
        const po = (OFF_DIR_SHADOW_PARAMS + i * 16) / 4;
        d[po] = shadow.bias;
        d[po + 1] = shadow.normalBias;
        d[po + 2] = shadow.radius;
        d[po + 3] = 1 / shadow.mapSize.x;
      }
    }
    for (let i = 0; i < this.point.length; i++) {
      const light = this.point[i], o = (OFF_POINT + i * 48) / 4;
      _v.setFromMatrixPosition(light.matrixWorld);
      d[o] = _v.x;
      d[o + 1] = _v.y;
      d[o + 2] = _v.z;
      d[o + 3] = 0;
      const c = light.color, k = light.intensity;
      d[o + 4] = c.r * k;
      d[o + 5] = c.g * k;
      d[o + 6] = c.b * k;
      d[o + 7] = 0;
      d[o + 8] = light.distance;
      d[o + 9] = light.decay;
      d[o + 10] = 0;
      d[o + 11] = 0;
    }
    for (let i = 0; i < this.spot.length; i++) {
      const light = this.spot[i], o = (OFF_SPOT + i * 64) / 4;
      _v.setFromMatrixPosition(light.matrixWorld);
      d[o] = _v.x;
      d[o + 1] = _v.y;
      d[o + 2] = _v.z;
      d[o + 3] = 0;
      _v23.setFromMatrixPosition(light.target.matrixWorld);
      _v.sub(_v23).normalize();
      d[o + 4] = _v.x;
      d[o + 5] = _v.y;
      d[o + 6] = _v.z;
      d[o + 7] = 0;
      const c = light.color, k = light.intensity;
      d[o + 8] = c.r * k;
      d[o + 9] = c.g * k;
      d[o + 10] = c.b * k;
      d[o + 11] = 0;
      d[o + 12] = light.distance;
      d[o + 13] = light.decay;
      d[o + 14] = Math.cos(light.angle);
      d[o + 15] = Math.cos(light.angle * (1 - light.penumbra));
      if (i < this.numSpotShadows) {
        const shadow = light.shadow;
        const mo = (OFF_SPOT_SHADOW_MAT + i * 64) / 4;
        const me = shadow.matrix.elements;
        for (let k2 = 0; k2 < 16; k2++) d[mo + k2] = me[k2];
        const po = (OFF_SPOT_SHADOW_PARAMS + i * 16) / 4;
        d[po] = shadow.bias;
        d[po + 1] = shadow.normalBias;
        d[po + 2] = shadow.radius;
        d[po + 3] = 1 / shadow.mapSize.x;
      }
    }
    for (let i = 0; i < this.hemi.length; i++) {
      const light = this.hemi[i], o = (OFF_HEMI + i * 48) / 4;
      _v.setFromMatrixPosition(light.matrixWorld).normalize();
      d[o] = _v.x;
      d[o + 1] = _v.y;
      d[o + 2] = _v.z;
      d[o + 3] = 0;
      const k = light.intensity;
      d[o + 4] = light.color.r * k;
      d[o + 5] = light.color.g * k;
      d[o + 6] = light.color.b * k;
      d[o + 7] = 0;
      d[o + 8] = light.groundColor.r * k;
      d[o + 9] = light.groundColor.g * k;
      d[o + 10] = light.groundColor.b * k;
      d[o + 11] = 0;
    }
  }
};
function shadowCastingFirst(a, b) {
  return (b.castShadow ? 1 : 0) - (a.castShadow ? 1 : 0);
}

// src/renderers/webgl/WebGLBatcher.js
var INSTANCE_STRIDE_FLOATS = 16;
var INSTANCE_STRIDE_BYTES = INSTANCE_STRIDE_FLOATS * 4;
var WebGLBatcher = class {
  constructor(gl) {
    this.gl = gl;
    this.buffer = gl.createBuffer();
    this.capacity = 1024;
    this.data = new Float32Array(this.capacity * INSTANCE_STRIDE_FLOATS);
    this.count = 0;
    this.lastHash = 0;
    this.hash = 0;
    this.uploadedBytes = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }
  begin() {
    this.count = 0;
    this.hash = 2166136261 | 0;
  }
  ensure(extra) {
    if (this.count + extra > this.capacity) {
      let cap = this.capacity;
      while (cap < this.count + extra) cap *= 2;
      const nd = new Float32Array(cap * INSTANCE_STRIDE_FLOATS);
      nd.set(this.data);
      this.data = nd;
      this.capacity = cap;
      this.bufferDirty = true;
    }
  }
  /** Append one object's world matrix. Returns the instance index. */
  add(object) {
    const d = this.data, o = this.count * INSTANCE_STRIDE_FLOATS;
    const s = object._slabData, so = object._slabOffset + 16;
    d[o] = s[so];
    d[o + 1] = s[so + 1];
    d[o + 2] = s[so + 2];
    d[o + 3] = s[so + 3];
    d[o + 4] = s[so + 4];
    d[o + 5] = s[so + 5];
    d[o + 6] = s[so + 6];
    d[o + 7] = s[so + 7];
    d[o + 8] = s[so + 8];
    d[o + 9] = s[so + 9];
    d[o + 10] = s[so + 10];
    d[o + 11] = s[so + 11];
    d[o + 12] = s[so + 12];
    d[o + 13] = s[so + 13];
    d[o + 14] = s[so + 14];
    d[o + 15] = s[so + 15];
    let h = this.hash;
    h = Math.imul(h ^ object.id, 16777619);
    h = Math.imul(h ^ object._worldVersion, 16777619);
    this.hash = h;
    return this.count++;
  }
  /** Upload the frame's instance data if it changed. */
  upload() {
    const gl = this.gl;
    if (this.count === 0) return;
    const bytes = this.count * INSTANCE_STRIDE_BYTES;
    if (this.bufferDirty === true) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_STRIDE_FLOATS);
      this.bufferDirty = false;
      this.lastHash = this.hash;
      this.uploadedBytes = bytes;
      return true;
    }
    if (this.hash !== this.lastHash || bytes !== this.uploadedBytes) {
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data, 0, this.count * INSTANCE_STRIDE_FLOATS);
      this.lastHash = this.hash;
      this.uploadedBytes = bytes;
      return true;
    }
    return false;
  }
  dispose() {
    this.gl.deleteBuffer(this.buffer);
  }
};

// src/renderers/webgl/WebGLBindingStates.js
var LOC_POSITION = 0;
var LOC_NORMAL = 1;
var LOC_UV = 2;
var LOC_COLOR = 3;
var LOC_UV1 = 4;
var LOC_INSTANCE_COLOR = 5;
var LOC_INSTANCE_MATRIX = 8;
var ATTRIBUTE_LOCATIONS = { position: LOC_POSITION, normal: LOC_NORMAL, uv: LOC_UV, color: LOC_COLOR, uv1: LOC_UV1 };
var WebGLBindingStates = class {
  constructor(gl, state, attributes) {
    this.gl = gl;
    this.state = state;
    this.attributes = attributes;
    this.cache = /* @__PURE__ */ new WeakMap();
    this._onGeometryDispose = this._onGeometryDispose.bind(this);
  }
  _onGeometryDispose(event) {
    const geometry = event.target;
    geometry.removeEventListener("dispose", this._onGeometryDispose);
    const entry = this.cache.get(geometry);
    if (entry !== void 0) {
      for (const key in entry.vaos) {
        const v = entry.vaos[key];
        if (v) this.gl.deleteVertexArray(v.vao);
      }
      if (entry.custom !== null) for (const r of entry.custom.values()) this.gl.deleteVertexArray(r.vao);
      this.cache.delete(geometry);
    }
    for (const name in geometry.attributes) this.attributes.remove(geometry.attributes[name]);
    if (geometry.index !== null) this.attributes.remove(geometry.index);
  }
  /**
   * Make sure the geometry's GPU buffers are current and bind the right VAO.
   * mode: 0 plain, 1 InstancedMesh (its own instance attributes), 2 batched (renderer's instance buffer).
   * Returns the binding record {vao, indexType, indexBytes}.
   */
  /**
   * `program` is only needed for programs with custom (non-fixed-name) attributes; those get a
   * VAO per (geometry, program) instead of the shared one.
   */
  bind(geometry, mode, instancedObject, batchBuffer, program = null) {
    const gl = this.gl, attributes = this.attributes;
    let entry = this.cache.get(geometry);
    if (entry === void 0) {
      entry = { vaos: [null, null, null], layoutVersion: -1, instancedFor: null, hadInstanceColor: false, custom: null };
      this.cache.set(geometry, entry);
      geometry.addEventListener("dispose", this._onGeometryDispose);
    }
    let rebuild = entry.layoutVersion !== geometry._layoutVersion;
    const geometryAttributes = geometry.attributes;
    for (const name in geometryAttributes) {
      const attribute = geometryAttributes[name];
      const before = attributes.get(attribute);
      const beforeBuffer = before !== void 0 ? before.buffer : null;
      if (attributes.update(attribute, gl.ARRAY_BUFFER).buffer !== beforeBuffer) rebuild = true;
    }
    if (mode === 1) {
      const im = instancedObject.instanceMatrix;
      const before = attributes.get(im);
      const beforeBuffer = before !== void 0 ? before.buffer : null;
      if (attributes.update(im, gl.ARRAY_BUFFER).buffer !== beforeBuffer) rebuild = true;
      if (instancedObject.instanceColor !== null) {
        const ic = instancedObject.instanceColor;
        const b2 = attributes.get(ic);
        const b2b = b2 !== void 0 ? b2.buffer : null;
        if (attributes.update(ic, gl.ARRAY_BUFFER).buffer !== b2b) rebuild = true;
        if (entry.hadInstanceColor !== true) {
          entry.hadInstanceColor = true;
          rebuild = true;
        }
      }
      if (entry.instancedFor !== instancedObject) {
        entry.instancedFor = instancedObject;
        rebuild = true;
      }
    }
    if (this.state.currentArrayBuffer !== null) this.state.currentArrayBuffer = null;
    if (rebuild) {
      for (let i = 0; i < 3; i++) {
        if (entry.vaos[i] !== null) {
          gl.deleteVertexArray(entry.vaos[i].vao);
          entry.vaos[i] = null;
        }
      }
      if (entry.custom !== null) {
        for (const r of entry.custom.values()) gl.deleteVertexArray(r.vao);
        entry.custom.clear();
      }
      entry.layoutVersion = geometry._layoutVersion;
      if (this.state.currentVAO !== null) {
        gl.bindVertexArray(null);
        this.state.currentVAO = null;
      }
    }
    const useCustom = program !== null && program.hasCustomAttributes === true;
    let record;
    if (useCustom) {
      if (entry.custom === null) entry.custom = /* @__PURE__ */ new Map();
      const key = program.id * 4 + mode;
      record = entry.custom.get(key);
      if (record === void 0) record = null;
    } else {
      record = entry.vaos[mode];
    }
    if (record === null) {
      record = this._createVAO(geometry, mode, instancedObject, batchBuffer, useCustom ? program : null);
      if (useCustom) entry.custom.set(program.id * 4 + mode, record);
      else entry.vaos[mode] = record;
      this.state.currentVAO = record.vao;
    } else {
      this.state.bindVertexArray(record.vao);
      const index = geometry.index;
      if (index !== null) {
        const before = attributes.get(index);
        if (before === void 0 || before.version < index.version) {
          const data = attributes.update(index, gl.ELEMENT_ARRAY_BUFFER);
          record.indexType = data.type;
          record.indexBytes = data.bytesPerElement;
        }
      }
    }
    return record;
  }
  _createVAO(geometry, mode, instancedObject, batchBuffer, program) {
    const gl = this.gl, attributes = this.attributes;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.state.currentArrayBuffer = null;
    const geometryAttributes = geometry.attributes;
    let maxInstancedCount = Infinity;
    for (const name in geometryAttributes) {
      const attribute = geometryAttributes[name];
      let location = ATTRIBUTE_LOCATIONS[name];
      if (location === void 0 && program !== null) {
        const custom = program.attributes[name];
        if (custom !== void 0 && custom.location >= 0) location = custom.location;
      }
      if (location === void 0) continue;
      const data = attributes.get(attribute);
      this._setupAttribute(location, attribute, data);
      if (attribute.isInstancedBufferAttribute) {
        gl.vertexAttribDivisor(location, attribute.meshPerAttribute);
        maxInstancedCount = Math.min(maxInstancedCount, attribute.count * attribute.meshPerAttribute);
      }
    }
    const index = geometry.index;
    let indexType = 0, indexBytes = 0;
    if (index !== null) {
      const data = attributes.update(index, gl.ELEMENT_ARRAY_BUFFER);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, data.buffer);
      indexType = data.type;
      indexBytes = data.bytesPerElement;
    }
    if (mode === 1) {
      const im = instancedObject.instanceMatrix;
      const data = attributes.get(im);
      gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(LOC_INSTANCE_MATRIX + i);
        gl.vertexAttribPointer(LOC_INSTANCE_MATRIX + i, 4, gl.FLOAT, false, 64, i * 16);
        gl.vertexAttribDivisor(LOC_INSTANCE_MATRIX + i, im.meshPerAttribute);
      }
      if (instancedObject.instanceColor !== null) {
        const ic = instancedObject.instanceColor;
        const cdata = attributes.get(ic);
        gl.bindBuffer(gl.ARRAY_BUFFER, cdata.buffer);
        gl.enableVertexAttribArray(LOC_INSTANCE_COLOR);
        gl.vertexAttribPointer(LOC_INSTANCE_COLOR, 3, cdata.type, ic.normalized, 0, 0);
        gl.vertexAttribDivisor(LOC_INSTANCE_COLOR, ic.meshPerAttribute);
      }
    } else if (mode === 2) {
      gl.bindBuffer(gl.ARRAY_BUFFER, batchBuffer);
      for (let i = 0; i < 4; i++) {
        gl.enableVertexAttribArray(LOC_INSTANCE_MATRIX + i);
        gl.vertexAttribPointer(LOC_INSTANCE_MATRIX + i, 4, gl.FLOAT, false, INSTANCE_STRIDE_BYTES, i * 16);
        gl.vertexAttribDivisor(LOC_INSTANCE_MATRIX + i, 1);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return { vao, indexType, indexBytes, maxInstancedCount };
  }
  _setupAttribute(location, attribute, data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, data.buffer);
    gl.enableVertexAttribArray(location);
    const integer = data.type === gl.INT || data.type === gl.UNSIGNED_INT || attribute.gpuType === 1013;
    if (integer && data.type !== gl.FLOAT && !attribute.normalized) {
      gl.vertexAttribIPointer(location, attribute.itemSize, data.type, 0, 0);
    } else {
      gl.vertexAttribPointer(location, attribute.itemSize, data.type, attribute.normalized, 0, 0);
    }
  }
  /** Point the batched-instance attributes at a byte offset in the batch buffer (VAO must be bound). */
  setBatchOffset(batchBuffer, byteOffset) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, batchBuffer);
    this.state.currentArrayBuffer = batchBuffer;
    for (let i = 0; i < 4; i++) gl.vertexAttribPointer(LOC_INSTANCE_MATRIX + i, 4, gl.FLOAT, false, INSTANCE_STRIDE_BYTES, byteOffset + i * 16);
  }
  reset() {
    this.state.bindVertexArray(null);
  }
};

// src/renderers/webgl/WebGLInfo.js
var WebGLInfo = class {
  constructor(gl) {
    this.gl = gl;
    this.memory = { geometries: 0, textures: 0 };
    this.render = { frame: 0, calls: 0, triangles: 0, points: 0, lines: 0, batches: 0, instances: 0 };
    this.programs = null;
    this.autoReset = true;
  }
  update(count, mode, instanceCount) {
    const gl = this.gl;
    this.render.calls++;
    switch (mode) {
      case gl.TRIANGLES:
        this.render.triangles += instanceCount * (count / 3);
        break;
      case gl.LINES:
        this.render.lines += instanceCount * (count / 2);
        break;
      case gl.LINE_STRIP:
        this.render.lines += instanceCount * (count - 1);
        break;
      case gl.LINE_LOOP:
        this.render.lines += instanceCount * count;
        break;
      case gl.POINTS:
        this.render.points += instanceCount * count;
        break;
      default:
        console.error("WebGLInfo: Unknown draw mode:", mode);
    }
  }
  reset() {
    this.render.calls = 0;
    this.render.triangles = 0;
    this.render.points = 0;
    this.render.lines = 0;
    this.render.batches = 0;
    this.render.instances = 0;
  }
};

// src/textures/Source.js
var _sourceId = 0;
var Source = class {
  constructor(data = null) {
    this.isSource = true;
    Object.defineProperty(this, "id", { value: _sourceId++ });
    this.uuid = generateUUID();
    this.data = data;
    this.dataReady = true;
    this.version = 0;
  }
  getSize(target) {
    const data = this.data;
    if (typeof HTMLVideoElement !== "undefined" && data instanceof HTMLVideoElement) target.set(data.videoWidth, data.videoHeight, 0);
    else if (typeof VideoFrame !== "undefined" && data instanceof VideoFrame) target.set(data.displayHeight, data.displayWidth, 0);
    else if (data !== null) target.set(data.width, data.height, data.depth || 0);
    else target.set(0, 0, 0);
    return target;
  }
  set needsUpdate(value) {
    if (value === true) this.version++;
  }
  toJSON() {
    return { uuid: this.uuid };
  }
};

// src/textures/Texture.js
var _textureId = 0;
var _tempVec3 = { x: 0, y: 0, z: 0, set(x, y, z) {
  this.x = x;
  this.y = y;
  this.z = z;
  return this;
} };
var Texture = class _Texture extends EventDispatcher {
  constructor(image = _Texture.DEFAULT_IMAGE, mapping = _Texture.DEFAULT_MAPPING, wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping, magFilter = LinearFilter, minFilter = LinearMipmapLinearFilter, format = RGBAFormat, type = UnsignedByteType, anisotropy = _Texture.DEFAULT_ANISOTROPY, colorSpace = NoColorSpace) {
    super();
    this.isTexture = true;
    Object.defineProperty(this, "id", { value: _textureId++ });
    this.uuid = generateUUID();
    this.name = "";
    this.source = new Source(image);
    this.mipmaps = [];
    this.mapping = mapping;
    this.channel = 0;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.magFilter = magFilter;
    this.minFilter = minFilter;
    this.anisotropy = anisotropy;
    this.format = format;
    this.internalFormat = null;
    this.type = type;
    this.offset = new Vector2(0, 0);
    this.repeat = new Vector2(1, 1);
    this.center = new Vector2(0, 0);
    this.rotation = 0;
    this.matrixAutoUpdate = true;
    this.matrix = new Matrix3();
    this.generateMipmaps = true;
    this.premultiplyAlpha = false;
    this.flipY = true;
    this.unpackAlignment = 4;
    this.colorSpace = colorSpace;
    this.userData = {};
    this.updateRanges = [];
    this.version = 0;
    this.onUpdate = null;
    this.renderTarget = null;
    this.isRenderTargetTexture = false;
    this.isArrayTexture = !!(image && image.depth && image.depth > 1);
    this.pmremVersion = 0;
  }
  get width() {
    return this.source.getSize(_tempVec3).x;
  }
  get height() {
    return this.source.getSize(_tempVec3).y;
  }
  get depth() {
    return this.source.getSize(_tempVec3).z;
  }
  get image() {
    return this.source.data;
  }
  set image(value = null) {
    this.source.data = value;
  }
  updateMatrix() {
    this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
  }
  addUpdateRange(start, count) {
    this.updateRanges.push({ start, count });
  }
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.name = source.name;
    this.source = source.source;
    this.mipmaps = source.mipmaps.slice(0);
    this.mapping = source.mapping;
    this.channel = source.channel;
    this.wrapS = source.wrapS;
    this.wrapT = source.wrapT;
    this.magFilter = source.magFilter;
    this.minFilter = source.minFilter;
    this.anisotropy = source.anisotropy;
    this.format = source.format;
    this.internalFormat = source.internalFormat;
    this.type = source.type;
    this.offset.copy(source.offset);
    this.repeat.copy(source.repeat);
    this.center.copy(source.center);
    this.rotation = source.rotation;
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    this.matrix.copy(source.matrix);
    this.generateMipmaps = source.generateMipmaps;
    this.premultiplyAlpha = source.premultiplyAlpha;
    this.flipY = source.flipY;
    this.unpackAlignment = source.unpackAlignment;
    this.colorSpace = source.colorSpace;
    this.renderTarget = source.renderTarget;
    this.isRenderTargetTexture = source.isRenderTargetTexture;
    this.isArrayTexture = source.isArrayTexture;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    this.needsUpdate = true;
    return this;
  }
  setValues(values) {
    for (const key in values) {
      const newValue = values[key];
      if (newValue === void 0) {
        console.warn(`Texture.setValues(): parameter '${key}' has value of undefined.`);
        continue;
      }
      const currentValue = this[key];
      if (currentValue === void 0) {
        console.warn(`Texture.setValues(): property '${key}' does not exist.`);
        continue;
      }
      if (currentValue && newValue && (currentValue.isVector2 && newValue.isVector2)) currentValue.copy(newValue);
      else if (currentValue && newValue && (currentValue.isVector3 && newValue.isVector3)) currentValue.copy(newValue);
      else if (currentValue && newValue && (currentValue.isMatrix3 && newValue.isMatrix3)) currentValue.copy(newValue);
      else this[key] = newValue;
    }
  }
  toJSON() {
    return { uuid: this.uuid, name: this.name, mapping: this.mapping, channel: this.channel, repeat: [this.repeat.x, this.repeat.y], offset: [this.offset.x, this.offset.y], center: [this.center.x, this.center.y], rotation: this.rotation, wrap: [this.wrapS, this.wrapT], format: this.format, internalFormat: this.internalFormat, type: this.type, colorSpace: this.colorSpace, minFilter: this.minFilter, magFilter: this.magFilter, anisotropy: this.anisotropy, flipY: this.flipY, generateMipmaps: this.generateMipmaps, premultiplyAlpha: this.premultiplyAlpha, unpackAlignment: this.unpackAlignment };
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  transformUv(uv) {
    if (this.mapping !== UVMapping) return uv;
    uv.applyMatrix3(this.matrix);
    if (uv.x < 0 || uv.x > 1) {
      switch (this.wrapS) {
        case RepeatWrapping:
          uv.x = uv.x - Math.floor(uv.x);
          break;
        case ClampToEdgeWrapping:
          uv.x = uv.x < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.x) % 2) === 1) uv.x = Math.ceil(uv.x) - uv.x;
          else uv.x = uv.x - Math.floor(uv.x);
          break;
      }
    }
    if (uv.y < 0 || uv.y > 1) {
      switch (this.wrapT) {
        case RepeatWrapping:
          uv.y = uv.y - Math.floor(uv.y);
          break;
        case ClampToEdgeWrapping:
          uv.y = uv.y < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          if (Math.abs(Math.floor(uv.y) % 2) === 1) uv.y = Math.ceil(uv.y) - uv.y;
          else uv.y = uv.y - Math.floor(uv.y);
          break;
      }
    }
    if (this.flipY) uv.y = 1 - uv.y;
    return uv;
  }
  set needsUpdate(value) {
    if (value === true) {
      this.version++;
      this.source.needsUpdate = true;
    }
  }
  set needsPMREMUpdate(value) {
    if (value === true) this.pmremVersion++;
  }
};
Texture.DEFAULT_IMAGE = null;
Texture.DEFAULT_MAPPING = UVMapping;
Texture.DEFAULT_ANISOTROPY = 1;

// src/renderers/WebGLRenderTarget.js
var WebGLRenderTarget = class extends EventDispatcher {
  constructor(width = 1, height = 1, options = {}) {
    super();
    this.isRenderTarget = true;
    this.isWebGLRenderTarget = true;
    this.width = width;
    this.height = height;
    this.depth = 1;
    this.scissor = new Vector4(0, 0, width, height);
    this.scissorTest = false;
    this.viewport = new Vector4(0, 0, width, height);
    const image = { width, height, depth: 1 };
    options = Object.assign({ generateMipmaps: false, internalFormat: null, minFilter: LinearFilter, depthBuffer: true, stencilBuffer: false, resolveDepthBuffer: true, resolveStencilBuffer: true, depthTexture: null, samples: 0, count: 1, depthOnly: false }, options);
    const texture = new Texture(image, options.mapping, options.wrapS, options.wrapT, options.magFilter, options.minFilter, options.format, options.type, options.anisotropy, options.colorSpace);
    texture.flipY = false;
    texture.generateMipmaps = options.generateMipmaps;
    texture.internalFormat = options.internalFormat;
    texture.renderTarget = this;
    this.texture = texture;
    this.textures = [texture];
    this.depthBuffer = options.depthBuffer;
    this.stencilBuffer = options.stencilBuffer;
    this.resolveDepthBuffer = options.resolveDepthBuffer;
    this.resolveStencilBuffer = options.resolveStencilBuffer;
    this.depthOnly = options.depthOnly;
    this._depthTexture = null;
    this.depthTexture = options.depthTexture;
    this.samples = options.samples;
  }
  set depthTexture(current) {
    if (this._depthTexture !== null) this._depthTexture.renderTarget = null;
    if (current !== null) current.renderTarget = this;
    this._depthTexture = current;
  }
  get depthTexture() {
    return this._depthTexture;
  }
  setSize(width, height, depth = 1) {
    if (this.width !== width || this.height !== height || this.depth !== depth) {
      this.width = width;
      this.height = height;
      this.depth = depth;
      for (let i = 0, il = this.textures.length; i < il; i++) {
        this.textures[i].image.width = width;
        this.textures[i].image.height = height;
        this.textures[i].image.depth = depth;
      }
      if (this.depthTexture) {
        this.depthTexture.image.width = width;
        this.depthTexture.image.height = height;
      }
      this.dispose();
    }
    this.viewport.set(0, 0, width, height);
    this.scissor.set(0, 0, width, height);
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.width = source.width;
    this.height = source.height;
    this.depth = source.depth;
    this.scissor.copy(source.scissor);
    this.scissorTest = source.scissorTest;
    this.viewport.copy(source.viewport);
    this.textures.length = 0;
    for (let i = 0, il = source.textures.length; i < il; i++) {
      this.textures[i] = source.textures[i].clone();
      this.textures[i].isRenderTargetTexture = true;
      this.textures[i].renderTarget = this;
      const image = Object.assign({}, source.textures[i].image);
      this.textures[i].source = new Source(image);
    }
    this.depthBuffer = source.depthBuffer;
    this.stencilBuffer = source.stencilBuffer;
    this.resolveDepthBuffer = source.resolveDepthBuffer;
    this.resolveStencilBuffer = source.resolveStencilBuffer;
    if (source.depthTexture !== null) this.depthTexture = source.depthTexture.clone();
    this.samples = source.samples;
    return this;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
};

// src/textures/DepthTexture.js
var DepthTexture = class extends Texture {
  constructor(width, height, type, mapping, wrapS, wrapT, magFilter = NearestFilter, minFilter = NearestFilter, anisotropy, format = DepthFormat, depth = 1) {
    if (format !== DepthFormat && format !== DepthStencilFormat) throw new Error("DepthTexture format must be either DepthFormat or DepthStencilFormat");
    if (type === void 0 && format === DepthFormat) type = UnsignedIntType;
    if (type === void 0 && format === DepthStencilFormat) type = UnsignedInt248Type;
    super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    this.isDepthTexture = true;
    this.image = { width, height, depth };
    this.flipY = false;
    this.generateMipmaps = false;
    this.compareFunction = null;
  }
  copy(source) {
    super.copy(source);
    this.source = new this.source.constructor(Object.assign({}, source.image));
    this.compareFunction = source.compareFunction;
    return this;
  }
};

// src/renderers/webgl/WebGLShadowMap.js
var _frustum = /* @__PURE__ */ new Frustum();
var _viewport = /* @__PURE__ */ new Vector4();
var WebGLShadowMap = class {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = false;
    this.autoUpdate = true;
    this.needsUpdate = false;
    this.type = PCFShadowMap;
    this.lists = /* @__PURE__ */ new WeakMap();
  }
  render(lights, scene, camera) {
    const renderer = this.renderer;
    if (this.enabled === false) return;
    if (this.autoUpdate === false && this.needsUpdate === false) return;
    const shadowLights = [];
    for (let i = 0; i < lights.numDirShadows; i++) shadowLights.push(lights.dir[i]);
    for (let i = 0; i < lights.numSpotShadows; i++) shadowLights.push(lights.spot[i]);
    if (shadowLights.length === 0) return;
    const previousTarget = renderer.getRenderTarget();
    const state = renderer.state;
    state.setDepthTest(true);
    state.setDepthMask(true);
    state.setScissorTest(false);
    for (let i = 0; i < shadowLights.length; i++) {
      const light = shadowLights[i];
      const shadow = light.shadow;
      if (shadow === void 0) continue;
      if (shadow.autoUpdate === false && shadow.needsUpdate === false) continue;
      const mapSize = shadow.mapSize;
      if (shadow.map === null) {
        const depthTexture = new DepthTexture(mapSize.x, mapSize.y, UnsignedIntType, void 0, void 0, void 0, LinearFilter, LinearFilter, void 0, DepthFormat);
        depthTexture.compareFunction = LessEqualStencilFunc;
        shadow.map = new WebGLRenderTarget(mapSize.x, mapSize.y, { depthTexture, depthOnly: true, minFilter: LinearFilter, magFilter: LinearFilter });
        shadow.map.texture.name = light.name + ".shadowMap";
        shadow.camera.updateProjectionMatrix();
      } else if (shadow.map.width !== mapSize.x || shadow.map.height !== mapSize.y) {
        shadow.map.setSize(mapSize.x, mapSize.y);
        shadow.map.depthTexture.image.width = mapSize.x;
        shadow.map.depthTexture.image.height = mapSize.y;
      }
      shadow.updateMatrices(light);
      _frustum.copy(shadow.getFrustum());
      renderer.setRenderTarget(shadow.map);
      renderer.clear(false, true, false);
      _viewport.set(0, 0, mapSize.x, mapSize.y);
      state.viewport(0, 0, mapSize.x, mapSize.y);
      let list = this.lists.get(light);
      if (list === void 0) {
        list = new WebGLRenderList();
        this.lists.set(light, list);
      }
      list.init();
      renderer._renderOrderReset();
      this._collect(scene, shadow.camera, list);
      renderer._resolvePrograms(list, scene);
      list.finish(true, renderer._rankOfRenderOrder);
      renderer._uploadFrameBlock(shadow.camera, scene);
      renderer._drawList(list, list.opaqueSorted, list.opaqueCount, scene, shadow.camera, true);
      renderer._drawList(list, list.transparentSorted, list.transparentCount, scene, shadow.camera, true);
      shadow.needsUpdate = false;
    }
    this.needsUpdate = false;
    renderer.setRenderTarget(previousTarget);
  }
  _collect(object, shadowCamera, list) {
    if (object.visible === false) return;
    const renderer = this.renderer;
    const visible = object.layers.test(shadowCamera.layers);
    if (visible && (object.isMesh || object.isLine || object.isPoints)) {
      if (object.castShadow && (object.frustumCulled === false || renderer._cullTest(object, object.geometry, _frustum))) {
        const geometry = object.geometry;
        const material = object.material;
        if (Array.isArray(material)) {
          const groups = geometry.groups;
          for (let k = 0, kl = groups.length; k < kl; k++) {
            const group = groups[k];
            const groupMaterial = material[group.materialIndex];
            if (groupMaterial && groupMaterial.visible) renderer._pushItem(list, object, geometry, groupMaterial, group, 0, true);
          }
        } else if (material.visible) {
          renderer._pushItem(list, object, geometry, material, null, 0, true);
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) this._collect(children[i], shadowCamera, list);
  }
  /** Bind shadow depth textures to their fixed units for the main pass. */
  bindShadowMaps(lights) {
    const renderer = this.renderer;
    for (let i = 0; i < lights.numDirShadows; i++) {
      const map = lights.dir[i].shadow.map;
      if (map) renderer.textures.setTexture2D(map.depthTexture, TEXTURE_UNITS.dirShadowMap0 + i);
    }
    for (let i = 0; i < lights.numSpotShadows; i++) {
      const map = lights.spot[i].shadow.map;
      if (map) renderer.textures.setTexture2D(map.depthTexture, TEXTURE_UNITS.spotShadowMap0 + i);
    }
  }
};

// src/renderers/WebGLRenderer.js
var _projScreenMatrix = /* @__PURE__ */ new Matrix4();
var _color2 = /* @__PURE__ */ new Color();
var _frustum2 = /* @__PURE__ */ new Frustum();
var _emptyScene = { fog: null, environment: null, background: null, overrideMaterial: null, isScene: true, matrixWorldAutoUpdate: false, children: [], visible: true };
var V_INSTANCING = 1;
var V_INSTANCING_COLOR = 2;
var V_RECEIVE_SHADOW = 4;
var V_SHADOW_PASS = 8;
var V_HAS_UV = 16;
var V_HAS_UV1 = 32;
var V_HAS_COLOR = 64;
var V_COLOR_ALPHA = 128;
var defaultOnBeforeRender = Object3D.prototype.onBeforeRender;
var defaultOnAfterRender = Object3D.prototype.onAfterRender;
var WebGLRenderer = class {
  constructor(parameters = {}) {
    const {
      canvas = createCanvasElement(),
      context = null,
      depth = true,
      stencil = false,
      alpha = false,
      antialias = false,
      premultipliedAlpha = true,
      preserveDrawingBuffer = false,
      powerPreference = "default",
      failIfMajorPerformanceCaveat = false
    } = parameters;
    this.isWebGLRenderer = true;
    this.domElement = canvas;
    this.debug = { checkShaderErrors: true, onShaderError: null };
    this.autoClear = true;
    this.autoClearColor = true;
    this.autoClearDepth = true;
    this.autoClearStencil = true;
    this.sortObjects = true;
    this.autoBatch = true;
    this.clippingPlanes = [];
    this.localClippingEnabled = false;
    this.toneMapping = NoToneMapping;
    this.toneMappingExposure = 1;
    this.transmissionResolutionScale = 1;
    this._outputColorSpace = SRGBColorSpace;
    let gl = context;
    if (gl === null) {
      const attrs = { alpha: true, depth, stencil, antialias, premultipliedAlpha, preserveDrawingBuffer, powerPreference, failIfMajorPerformanceCaveat };
      gl = canvas.getContext("webgl2", attrs);
      if (gl === null) throw new Error("jrs.WebGLRenderer: WebGL2 is required but could not be created.");
    }
    this._gl = gl;
    this._alpha = alpha;
    this._premultipliedAlpha = premultipliedAlpha;
    this._width = canvas.width;
    this._height = canvas.height;
    this._pixelRatio = 1;
    this._viewport = new Vector4(0, 0, this._width, this._height);
    this._scissor = new Vector4(0, 0, this._width, this._height);
    this._scissorTest = false;
    this._currentViewport = new Vector4();
    this._currentScissor = new Vector4();
    this._clearColor = new Color(0);
    this._clearAlpha = alpha ? 0 : 1;
    this._currentRenderTarget = null;
    this._renderCallDepth = 0;
    this._frameId = 0;
    this._envVersion = 0;
    this._lastEnvKey = "";
    this._lastLightsVersion = -1;
    this._currentScene = null;
    this._currentSide = -1;
    this._materialCounter = 0;
    this._geometryCounter = 0;
    this._isContextLost = false;
    this._onContextLost = this._onContextLost.bind(this);
    this._onContextRestore = this._onContextRestore.bind(this);
    canvas.addEventListener && canvas.addEventListener("webglcontextlost", this._onContextLost, false);
    canvas.addEventListener && canvas.addEventListener("webglcontextrestored", this._onContextRestore, false);
    this.info = new WebGLInfo(gl);
    this.state = new WebGLState(gl);
    this.attributes = new WebGLAttributes(gl);
    this.textures = new WebGLTextures(gl, this.state, this.info);
    this.programs = new WebGLPrograms(gl, this);
    this.renderLists = new WebGLRenderLists();
    this.lights = new WebGLLights();
    this.bindingStates = new WebGLBindingStates(gl, this.state, this.attributes);
    this.batcher = new WebGLBatcher(gl);
    this.shadowMap = new WebGLShadowMap(this);
    this.properties = { get: (obj) => this._materialProps(obj) };
    this.info.programs = this.programs.programs;
    this.capabilities = {
      isWebGL2: true,
      maxTextures: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      maxVertexTextures: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxCubemapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
      maxAttributes: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
      maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxVaryings: gl.getParameter(gl.MAX_VARYING_VECTORS),
      maxFragmentUniforms: gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      precision: "highp",
      logarithmicDepthBuffer: false,
      reversedDepthBuffer: false,
      vertexTextures: true,
      floatFragmentTextures: true,
      floatVertexTextures: true,
      getMaxAnisotropy: () => this.textures.maxAnisotropy,
      getMaxPrecision: () => "highp"
    };
    const extCache = {};
    this.extensions = {
      get: (name) => {
        if (extCache[name] === void 0) extCache[name] = gl.getExtension(name);
        return extCache[name];
      },
      has: (name) => this.extensions.get(name) !== null,
      init: () => {
      }
    };
    this.xr = { enabled: false, isPresenting: false, cameraAutoUpdate: true, getCamera: () => null, updateCamera: () => {
    }, setAnimationLoop: () => {
    }, addEventListener: () => {
    }, removeEventListener: () => {
    }, getSession: () => null, setSession: async () => {
    }, getFrame: () => null, getReferenceSpace: () => null, setReferenceSpaceType: () => {
    }, setFramebufferScaleFactor: () => {
    }, getFoveation: () => void 0, setFoveation: () => {
    }, hasDepthSensing: () => false, getDepthSensingMesh: () => null };
    this._frameData = new Float32Array(FRAME_BLOCK_SIZE / 4);
    this._frameBuffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, FRAME_BLOCK_SIZE, gl.DYNAMIC_DRAW);
    this._lightsBuffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, LIGHTS_BLOCK_SIZE, gl.DYNAMIC_DRAW);
    this._materialStride = Math.max(MATERIAL_BLOCK_SIZE, this.state.uboAlignment);
    this._materialCapacity = 256;
    this._materialBuffer = gl.createBuffer();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._materialBuffer);
    gl.bufferData(gl.UNIFORM_BUFFER, this._materialStride * this._materialCapacity, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.UNIFORM_BUFFER, null);
    this._materialSlotsUsed = 0;
    this._materialFreeSlots = [];
    this._materialScratch = new Float32Array(MATERIAL_BLOCK_SIZE / 4);
    this.state.bindUniformBufferRange(BLOCK_FRAME, this._frameBuffer, 0, FRAME_BLOCK_SIZE);
    this.state.bindUniformBufferRange(BLOCK_LIGHTS, this._lightsBuffer, 0, LIGHTS_BLOCK_SIZE);
    this._materialProperties = /* @__PURE__ */ new WeakMap();
    this._wireframeGeometries = /* @__PURE__ */ new WeakMap();
    this._onMaterialDispose = this._onMaterialDispose.bind(this);
    this._renderOrders = /* @__PURE__ */ new Map();
    this._renderOrderList = [];
    this._rankOfRenderOrder = (ro) => {
      const r = this._renderOrders.get(ro);
      return r === void 0 ? 63 : r;
    };
    this._cmdCapacity = 1024;
    this._cmdItem = new Array(this._cmdCapacity);
    this._cmdOffset = new Int32Array(this._cmdCapacity);
    this._cmdCount = new Int32Array(this._cmdCapacity);
    this._cmdN = 0;
    this._currentProgram = null;
    this._currentMaterial = null;
    this._currentCamera = null;
    this._currentGeometryRecord = null;
    this._animationLoop = null;
    this._requestId = null;
    this._onAnimationFrame = this._onAnimationFrame.bind(this);
  }
  // ------------------------------------------------------------------ public API
  get outputColorSpace() {
    return this._outputColorSpace;
  }
  set outputColorSpace(v) {
    this._outputColorSpace = v;
  }
  getContext() {
    return this._gl;
  }
  getContextAttributes() {
    return this._gl.getContextAttributes();
  }
  forceContextLoss() {
    const ext = this.extensions.get("WEBGL_lose_context");
    if (ext) ext.loseContext();
  }
  forceContextRestore() {
    const ext = this.extensions.get("WEBGL_lose_context");
    if (ext) ext.restoreContext();
  }
  getPixelRatio() {
    return this._pixelRatio;
  }
  setPixelRatio(value) {
    if (value === void 0) return;
    this._pixelRatio = value;
    this.setSize(this._width, this._height, false);
  }
  getSize(target) {
    return target.set(this._width, this._height);
  }
  setSize(width, height, updateStyle = true) {
    this._width = width;
    this._height = height;
    const canvas = this.domElement;
    canvas.width = Math.floor(width * this._pixelRatio);
    canvas.height = Math.floor(height * this._pixelRatio);
    if (updateStyle === true && canvas.style) {
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
    }
    this.setViewport(0, 0, width, height);
  }
  getDrawingBufferSize(target) {
    return target.set(this._width * this._pixelRatio, this._height * this._pixelRatio).floor();
  }
  setDrawingBufferSize(width, height, pixelRatio) {
    this._width = width;
    this._height = height;
    this._pixelRatio = pixelRatio;
    this.domElement.width = Math.floor(width * pixelRatio);
    this.domElement.height = Math.floor(height * pixelRatio);
    this.setViewport(0, 0, width, height);
  }
  getCurrentViewport(target) {
    return target.copy(this._currentViewport);
  }
  getViewport(target) {
    return target.copy(this._viewport);
  }
  setViewport(x, y, width, height) {
    if (x.isVector4) this._viewport.set(x.x, x.y, x.z, x.w);
    else this._viewport.set(x, y, width, height);
    this.state.viewport(this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio).round().x, this._currentViewport.y, this._currentViewport.z, this._currentViewport.w);
  }
  getScissor(target) {
    return target.copy(this._scissor);
  }
  setScissor(x, y, width, height) {
    if (x.isVector4) this._scissor.set(x.x, x.y, x.z, x.w);
    else this._scissor.set(x, y, width, height);
    this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio).round();
    this.state.scissor(this._currentScissor.x, this._currentScissor.y, this._currentScissor.z, this._currentScissor.w);
  }
  getScissorTest() {
    return this._scissorTest;
  }
  setScissorTest(boolean) {
    this.state.setScissorTest(this._scissorTest = boolean);
  }
  setOpaqueSort() {
    console.warn("jrs.WebGLRenderer: setOpaqueSort is not supported; opaque objects are sorted by packed state keys.");
  }
  setTransparentSort() {
    console.warn("jrs.WebGLRenderer: setTransparentSort is not supported.");
  }
  getClearColor(target) {
    return target.copy(this._clearColor);
  }
  setClearColor(color, alpha = 1) {
    this._clearColor.set(color);
    this._clearAlpha = alpha;
    this._applyClearColor();
  }
  getClearAlpha() {
    return this._clearAlpha;
  }
  setClearAlpha(alpha) {
    this._clearAlpha = alpha;
    this._applyClearColor();
  }
  _applyClearColor() {
    let a = this._clearAlpha;
    _color2.copy(this._clearColor);
    ColorManagement.fromWorkingColorSpace(_color2, this._currentRenderTarget === null ? this._outputColorSpace : this._currentRenderTarget.texture.colorSpace);
    let r = _color2.r, g = _color2.g, b = _color2.b;
    if (this._premultipliedAlpha) {
      r *= a;
      g *= a;
      b *= a;
    }
    this.state.setClearColor(r, g, b, a);
  }
  clear(color = true, depth = true, stencil = true) {
    const gl = this._gl;
    let bits = 0;
    if (color) bits |= gl.COLOR_BUFFER_BIT;
    if (depth) {
      bits |= gl.DEPTH_BUFFER_BIT;
      this.state.setDepthMask(true);
    }
    if (stencil) {
      bits |= gl.STENCIL_BUFFER_BIT;
      this.state.setStencilMask(4294967295);
    }
    gl.clear(bits);
  }
  clearColor() {
    this.clear(true, false, false);
  }
  clearDepth() {
    this.clear(false, true, false);
  }
  clearStencil() {
    this.clear(false, false, true);
  }
  dispose() {
    const canvas = this.domElement;
    canvas.removeEventListener && canvas.removeEventListener("webglcontextlost", this._onContextLost, false);
    canvas.removeEventListener && canvas.removeEventListener("webglcontextrestored", this._onContextRestore, false);
    this.programs.dispose();
    this.batcher.dispose();
    this._gl.deleteBuffer(this._frameBuffer);
    this._gl.deleteBuffer(this._lightsBuffer);
    this._gl.deleteBuffer(this._materialBuffer);
    this.setAnimationLoop(null);
  }
  _onContextLost(event) {
    event.preventDefault();
    this._isContextLost = true;
  }
  _onContextRestore() {
    this._isContextLost = false;
    this.state.reset();
    this.programs.dispose();
    this._materialProperties = /* @__PURE__ */ new WeakMap();
  }
  setAnimationLoop(callback) {
    this._animationLoop = callback;
    if (this._requestId !== null) {
      cancelAnimationFrame(this._requestId);
      this._requestId = null;
    }
    if (callback !== null) this._requestId = requestAnimationFrame(this._onAnimationFrame);
  }
  _onAnimationFrame(time) {
    if (this._animationLoop !== null) this._animationLoop(time);
    if (this._animationLoop !== null) this._requestId = requestAnimationFrame(this._onAnimationFrame);
  }
  getRenderTarget() {
    return this._currentRenderTarget;
  }
  getActiveCubeFace() {
    return 0;
  }
  getActiveMipmapLevel() {
    return 0;
  }
  setRenderTarget(renderTarget) {
    this._currentRenderTarget = renderTarget;
    const state = this.state;
    if (renderTarget !== null) {
      const framebuffer = this.textures.setupRenderTarget(renderTarget);
      state.bindFramebuffer(framebuffer);
      this._currentViewport.copy(renderTarget.viewport);
      this._currentScissor.copy(renderTarget.scissor);
      state.setScissorTest(renderTarget.scissorTest);
    } else {
      state.bindFramebuffer(null);
      this._currentViewport.copy(this._viewport).multiplyScalar(this._pixelRatio).round();
      this._currentScissor.copy(this._scissor).multiplyScalar(this._pixelRatio).round();
      state.setScissorTest(this._scissorTest);
    }
    state.viewport(this._currentViewport.x, this._currentViewport.y, this._currentViewport.z, this._currentViewport.w);
    state.scissor(this._currentScissor.x, this._currentScissor.y, this._currentScissor.z, this._currentScissor.w);
  }
  readRenderTargetPixels(renderTarget, x, y, width, height, buffer) {
    const gl = this._gl;
    const framebuffer = this.textures.setupRenderTarget(renderTarget);
    const prev = this.state.currentFramebuffer;
    this.state.bindFramebuffer(framebuffer);
    const texture = renderTarget.texture;
    gl.readPixels(x, y, width, height, this.textures.glFormat(texture.format), this.textures.glType(texture.type), buffer);
    this.state.bindFramebuffer(prev);
  }
  async readRenderTargetPixelsAsync(renderTarget, x, y, width, height, buffer) {
    this.readRenderTargetPixels(renderTarget, x, y, width, height, buffer);
    return buffer;
  }
  resetState() {
    this.state.reset();
    this.bindingStates.reset();
    this._currentProgram = null;
    this._currentMaterial = null;
    this._currentGeometryRecord = null;
  }
  compile(scene, camera, targetScene = null) {
    if (targetScene === null) targetScene = scene;
    this._updateEnv(targetScene);
    this.lights.begin();
    targetScene.traverse((o) => {
      if (o.isLight) this.lights.push(o);
    });
    this.lights.end(this.shadowMap.enabled);
    this.lights.fill();
    scene.traverse((o) => {
      if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) this._getProgram(m, o, targetScene, o.isInstancedMesh ? V_INSTANCING : 0);
      }
    });
    return /* @__PURE__ */ new Set();
  }
  async compileAsync(scene, camera, targetScene = null) {
    this.compile(scene, camera, targetScene);
  }
  copyFramebufferToTexture(texture, position = null, level = 0) {
    const gl = this._gl;
    this.textures.setTexture2D(texture, 0);
    const x = position !== null ? position.x : 0, y = position !== null ? position.y : 0;
    gl.copyTexSubImage2D(gl.TEXTURE_2D, level, 0, 0, x, y, texture.image.width, texture.image.height);
  }
  // ------------------------------------------------------------------ render
  render(scene, camera) {
    if (camera === void 0 || camera.isCamera !== true) {
      console.error("jrs.WebGLRenderer.render: camera is not an instance of Camera.");
      return;
    }
    if (this._isContextLost === true) return;
    const gl = this._gl;
    if (scene.matrixWorldAutoUpdate === true) scene.updateMatrixWorld();
    if (camera.parent === null && camera.matrixWorldAutoUpdate === true) camera.updateMatrixWorld();
    this._frameId++;
    this._renderCallDepth++;
    this._currentCamera = camera;
    this._currentScene = scene;
    this._materialCounter = 0;
    this._geometryCounter = 0;
    this._currentMaterial = null;
    this._currentSide = -1;
    this._updateEnv(scene);
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    _frustum2.setFromProjectionMatrix(_projScreenMatrix, camera.coordinateSystem, camera.reversedDepth);
    const list = this.renderLists.get(scene, this._renderCallDepth - 1);
    list.init();
    this.lights.begin();
    this._renderOrderReset();
    this._projectObject(scene, camera, 0, this.sortObjects, list);
    this.lights.end(this.shadowMap.enabled);
    if (this.lights.version !== this._lastLightsVersion) {
      this._lastLightsVersion = this.lights.version;
      this._envVersion++;
    }
    this._resolvePrograms(list, scene);
    if (this.info.autoReset === true && this._renderCallDepth === 1) this.info.reset();
    this.shadowMap.render(this.lights, scene, camera);
    this.lights.fill();
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._lightsBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.lights.data);
    this.state.currentUniformBuffer = this._lightsBuffer;
    this._uploadFrameBlock(camera, scene);
    this.shadowMap.bindShadowMaps(this.lights);
    list.finish(this.sortObjects, this._rankOfRenderOrder);
    const background = scene.background;
    if (background !== null && background.isColor) {
      _color2.copy(background);
      ColorManagement.fromWorkingColorSpace(_color2, this._currentRenderTarget === null ? this._outputColorSpace : this._currentRenderTarget.texture.colorSpace);
      this.state.setClearColor(_color2.r, _color2.g, _color2.b, 1);
      if (this.autoClear || this.autoClearColor) this.clear(true, this.autoClearDepth, this.autoClearStencil);
      this._applyClearColor();
    } else if (this.autoClear) {
      this.clear(this.autoClearColor, this.autoClearDepth, this.autoClearStencil);
    }
    if (scene.isScene === true) scene.onBeforeRender(this, scene, camera, this._currentRenderTarget);
    this._drawList(list, list.opaqueSorted, list.opaqueCount, scene, camera, false);
    this._drawList(list, list.transparentSorted, list.transparentCount, scene, camera, false);
    if (scene.isScene === true) scene.onAfterRender(this, scene, camera);
    if (this._currentRenderTarget !== null) this.textures.updateRenderTargetMipmap(this._currentRenderTarget);
    this.state.bindVertexArray(null);
    this._currentGeometryRecord = null;
    this._renderCallDepth--;
    if (this._renderCallDepth === 0) this.info.render.frame++;
  }
  _renderOrderReset() {
    this._renderOrders.clear();
    this._renderOrderList.length = 0;
  }
  _noteRenderOrder(ro) {
    if (!this._renderOrders.has(ro)) {
      const l = this._renderOrderList;
      l.push(ro);
      l.sort((a, b) => a - b);
      this._renderOrders.clear();
      for (let i = 0; i < l.length; i++) this._renderOrders.set(l[i], Math.min(i, 63));
    }
  }
  /** Detects changes in frame-wide shader-affecting state and bumps the env version. */
  _updateEnv(scene) {
    const target = this._currentRenderTarget;
    const cs = target === null ? this._outputColorSpace : target.texture.colorSpace;
    const fog = scene.fog === null ? 0 : scene.fog.isFogExp2 ? 2 : 1;
    const key = this.toneMapping + "|" + cs + "|" + (this.shadowMap.enabled ? 1 : 0) + "|" + fog;
    if (key !== this._lastEnvKey) {
      this._lastEnvKey = key;
      this._envVersion++;
    }
  }
  _uploadFrameBlock(camera, scene) {
    const gl = this._gl, d = this._frameData;
    const pe = camera.projectionMatrix.elements, ve = camera.matrixWorldInverse.elements;
    for (let i = 0; i < 16; i++) {
      d[i] = pe[i];
      d[16 + i] = ve[i];
    }
    _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    const pse = _projScreenMatrix.elements;
    for (let i = 0; i < 16; i++) d[32 + i] = pse[i];
    const we = camera.matrixWorld.elements;
    d[48] = we[12];
    d[49] = we[13];
    d[50] = we[14];
    d[51] = camera.isOrthographicCamera ? 1 : 0;
    const fog = scene.fog;
    if (fog !== null && fog !== void 0) {
      d[52] = fog.color.r;
      d[53] = fog.color.g;
      d[54] = fog.color.b;
      d[55] = fog.isFogExp2 ? 2 : 1;
      d[56] = fog.near !== void 0 ? fog.near : 0;
      d[57] = fog.far !== void 0 ? fog.far : 0;
      d[58] = fog.density !== void 0 ? fog.density : 0;
    } else {
      d[52] = 0;
      d[53] = 0;
      d[54] = 0;
      d[55] = 0;
      d[56] = 0;
      d[57] = 0;
      d[58] = 0;
    }
    d[59] = this.toneMappingExposure;
    const v = this._currentViewport;
    d[60] = v.x;
    d[61] = v.y;
    d[62] = v.z;
    d[63] = v.w;
    gl.bindBuffer(gl.UNIFORM_BUFFER, this._frameBuffer);
    gl.bufferSubData(gl.UNIFORM_BUFFER, 0, d);
    this.state.currentUniformBuffer = this._frameBuffer;
  }
  // ------------------------------------------------------------------ projection / culling
  /** World-space bounding sphere test against `frustum`, with the sphere cached in slab memory per world version. */
  _cullTest(object, geometry, frustum) {
    let bs;
    if (object.isInstancedMesh) {
      if (object.boundingSphere === null) object.computeBoundingSphere();
      bs = object.boundingSphere;
    } else {
      if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
      bs = geometry.boundingSphere;
    }
    const s = object._slabData, o = object._slabOffset;
    const c = bs.center;
    if (object._cullVersion !== object._worldVersion || object._cullSphere !== bs || object._cullRadius !== bs.radius || object._cullCx !== c.x || object._cullCy !== c.y || object._cullCz !== c.z) {
      const e = o + 16;
      const x = c.x, y = c.y, z = c.z;
      const e0 = s[e], e1 = s[e + 1], e2 = s[e + 2], e4 = s[e + 4], e5 = s[e + 5], e6 = s[e + 6], e8 = s[e + 8], e9 = s[e + 9], e10 = s[e + 10];
      s[o + 41] = e0 * x + e4 * y + e8 * z + s[e + 12];
      s[o + 42] = e1 * x + e5 * y + e9 * z + s[e + 13];
      s[o + 43] = e2 * x + e6 * y + e10 * z + s[e + 14];
      const sx = e0 * e0 + e1 * e1 + e2 * e2, sy = e4 * e4 + e5 * e5 + e6 * e6, sz = e8 * e8 + e9 * e9 + e10 * e10;
      s[o + 44] = bs.radius * Math.sqrt(sx > sy ? sx > sz ? sx : sz : sy > sz ? sy : sz);
      object._cullVersion = object._worldVersion;
      object._cullSphere = bs;
      object._cullRadius = bs.radius;
      object._cullCx = c.x;
      object._cullCy = c.y;
      object._cullCz = c.z;
    }
    return frustum.intersectsSphereFlat(s[o + 41], s[o + 42], s[o + 43], s[o + 44]);
  }
  _projectObject(object, camera, groupOrder, sortObjects, list) {
    if (object.visible === false) return;
    const visible = object.layers.test(camera.layers);
    if (visible) {
      if (object.isGroup) {
        groupOrder = object.renderOrder;
      } else if (object.isLOD) {
        if (object.autoUpdate === true) object.update(camera);
      } else if (object.isLight) {
        this.lights.push(object);
      } else if (object.isSprite) {
        if (!object.frustumCulled || _frustum2.intersectsSprite(object)) {
          const material = object.material;
          if (material.visible) {
            const we = object.matrixWorld.elements, ve = camera.matrixWorldInverse.elements;
            const z = -(ve[2] * we[12] + ve[6] * we[13] + ve[10] * we[14] + ve[14]);
            this._pushItem(list, object, object.geometry, material, null, z, false);
          }
        }
      } else if (object.isMesh || object.isLine || object.isPoints) {
        const geometry = object.geometry;
        const material = object.material;
        if (!object.frustumCulled || this._cullTest(object, geometry, _frustum2)) {
          let z = 0;
          if (sortObjects) {
            const s = object._slabData, o = object._slabOffset, ve = camera.matrixWorldInverse.elements;
            let cx, cy, cz;
            if (object.frustumCulled) {
              cx = s[o + 41];
              cy = s[o + 42];
              cz = s[o + 43];
            } else {
              cx = s[o + 28];
              cy = s[o + 29];
              cz = s[o + 30];
            }
            z = -(ve[2] * cx + ve[6] * cy + ve[10] * cz + ve[14]);
          }
          if (Array.isArray(material)) {
            const groups = geometry.groups;
            for (let i = 0, l = groups.length; i < l; i++) {
              const group = groups[i];
              const groupMaterial = material[group.materialIndex];
              if (groupMaterial && groupMaterial.visible) this._pushItem(list, object, geometry, groupMaterial, group, z, false);
            }
          } else if (material.visible) {
            this._pushItem(list, object, geometry, material, null, z, false);
          }
        }
      }
    }
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) this._projectObject(children[i], camera, groupOrder, sortObjects, list);
  }
  _pushItem(list, object, geometry, material, group, z, shadowPass) {
    const variant = this._variantFor(object, geometry, material, shadowPass);
    this._noteRenderOrder(object.renderOrder);
    const frame = this._frameId;
    if (material._frameStamp !== frame) {
      material._frameStamp = frame;
      material._frameRid = this._materialCounter++;
    }
    if (geometry._frameStamp !== frame) {
      geometry._frameStamp = frame;
      geometry._frameRid = this._geometryCounter++;
    }
    list.push(object, geometry, material, group, z, material._frameRid, geometry._frameRid, variant);
  }
  /** Resolve the program of every item in the list. Runs after the frame's lights are collected. */
  _resolvePrograms(list, scene) {
    const items = list.items, n = list.count;
    for (let i = 0; i < n; i++) {
      const item = items[i];
      item.program = this._getProgram(item.material, item.object, scene, item.variant);
    }
  }
  _variantFor(object, geometry, material, shadowPass) {
    let v = 0;
    if (object.isInstancedMesh) {
      v |= V_INSTANCING;
      if (object.instanceColor !== null) v |= V_INSTANCING_COLOR;
    }
    if (object.receiveShadow) v |= V_RECEIVE_SHADOW;
    if (shadowPass) v |= V_SHADOW_PASS;
    const attributes = geometry.attributes;
    if (attributes.uv !== void 0) v |= V_HAS_UV;
    if (attributes.uv1 !== void 0) v |= V_HAS_UV1;
    if (material.vertexColors === true && attributes.color !== void 0) {
      v |= V_HAS_COLOR;
      if (attributes.color.itemSize === 4) v |= V_COLOR_ALPHA;
    }
    return v;
  }
  // ------------------------------------------------------------------ materials / programs
  _materialProps(material) {
    let props = this._materialProperties.get(material);
    if (props === void 0) {
      props = { programs: [], blockData: new Float32Array(MATERIAL_BLOCK_SIZE / 4), blockSlot: -1, blockStamp: -1, textureStamp: -1 };
      this._materialProperties.set(material, props);
      material.addEventListener("dispose", this._onMaterialDispose);
    }
    return props;
  }
  _onMaterialDispose(event) {
    const material = event.target;
    material.removeEventListener("dispose", this._onMaterialDispose);
    const props = this._materialProperties.get(material);
    if (props !== void 0) {
      for (let i = 0; i < props.programs.length; i++) {
        const e = props.programs[i];
        if (e) this.programs.releaseProgram(e.program);
      }
      if (props.blockSlot >= 0) this._materialFreeSlots.push(props.blockSlot);
    }
    this._materialProperties.delete(material);
  }
  _getProgram(material, object, scene, variant) {
    const props = this._materialProps(material);
    let entry = props.programs[variant];
    if (entry !== void 0 && entry.materialVersion === material.version && entry.envVersion === this._envVersion) return entry.program;
    const vflags = {
      instancing: (variant & V_INSTANCING) !== 0,
      instancingColor: (variant & V_INSTANCING_COLOR) !== 0,
      receiveShadow: (variant & V_RECEIVE_SHADOW) !== 0,
      shadowPass: (variant & V_SHADOW_PASS) !== 0
    };
    const parameters = this.programs.getParameters(material, object, scene || _emptyScene, this.lights, vflags);
    if (entry !== void 0 && entry.program.parameters.key === parameters.key && material.isShaderMaterial !== true) {
      entry.materialVersion = material.version;
      entry.envVersion = this._envVersion;
      return entry.program;
    }
    const program = this.programs.acquireProgram(parameters, material);
    if (entry !== void 0) this.programs.releaseProgram(entry.program);
    entry = { program, materialVersion: material.version, envVersion: this._envVersion };
    props.programs[variant] = entry;
    material._programDirty = false;
    return program;
  }
  /** Refresh the material's uniform block (once per frame per material) and return its byte offset. */
  _syncMaterialBlock(material, props) {
    if (props.blockStamp === this._frameId) return props.blockSlot * this._materialStride;
    props.blockStamp = this._frameId;
    const gl = this._gl;
    if (props.blockSlot < 0) {
      let slot = this._materialFreeSlots.pop();
      if (slot === void 0) {
        if (this._materialSlotsUsed === this._materialCapacity) {
          const newCap = this._materialCapacity * 2;
          const newBuffer = gl.createBuffer();
          gl.bindBuffer(gl.UNIFORM_BUFFER, newBuffer);
          gl.bufferData(gl.UNIFORM_BUFFER, this._materialStride * newCap, gl.DYNAMIC_DRAW);
          gl.bindBuffer(gl.COPY_READ_BUFFER, this._materialBuffer);
          gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.UNIFORM_BUFFER, 0, 0, this._materialStride * this._materialCapacity);
          gl.bindBuffer(gl.COPY_READ_BUFFER, null);
          gl.deleteBuffer(this._materialBuffer);
          this._materialBuffer = newBuffer;
          this._materialCapacity = newCap;
          this.state.currentUniformBuffer = newBuffer;
          this.state.currentUniformBindings[BLOCK_MATERIAL] = void 0;
        }
        slot = this._materialSlotsUsed++;
      }
      props.blockSlot = slot;
      props.blockData.fill(NaN);
    }
    const s = this._materialScratch;
    const color = material.color;
    if (color !== void 0) {
      s[0] = color.r;
      s[1] = color.g;
      s[2] = color.b;
    } else {
      s[0] = 1;
      s[1] = 1;
      s[2] = 1;
    }
    s[3] = material.opacity;
    const emissive = material.emissive;
    if (emissive !== void 0) {
      s[4] = emissive.r;
      s[5] = emissive.g;
      s[6] = emissive.b;
    } else {
      s[4] = 0;
      s[5] = 0;
      s[6] = 0;
    }
    s[7] = material.alphaTest;
    const specular = material.specular;
    if (specular !== void 0) {
      s[8] = specular.r;
      s[9] = specular.g;
      s[10] = specular.b;
    } else {
      s[8] = 0;
      s[9] = 0;
      s[10] = 0;
    }
    s[11] = material.shininess !== void 0 ? material.shininess : 30;
    s[12] = material.roughness !== void 0 ? material.roughness : 1;
    s[13] = material.metalness !== void 0 ? material.metalness : 0;
    s[14] = material.aoMapIntensity !== void 0 ? material.aoMapIntensity : 1;
    s[15] = material.emissiveIntensity !== void 0 ? material.emissiveIntensity : 1;
    const ns = material.normalScale;
    if (ns !== void 0) {
      s[16] = ns.x;
      s[17] = ns.y;
    } else {
      s[16] = 1;
      s[17] = 1;
    }
    s[18] = material.size !== void 0 ? material.size * this._pixelRatio : 1;
    s[19] = material.isSpriteMaterial ? material.rotation : material.bumpScale !== void 0 ? material.bumpScale : 1;
    const map = material.map || material.alphaMap || material.emissiveMap || material.normalMap || material.roughnessMap || material.metalnessMap || material.aoMap || material.specularMap;
    if (map && map.isTexture) {
      if (map.matrixAutoUpdate === true) map.updateMatrix();
      const m = map.matrix.elements;
      s[20] = m[0];
      s[21] = m[1];
      s[22] = m[2];
      s[23] = 0;
      s[24] = m[3];
      s[25] = m[4];
      s[26] = m[5];
      s[27] = 0;
      s[28] = m[6];
      s[29] = m[7];
      s[30] = m[8];
      s[31] = 0;
    } else {
      s[20] = 1;
      s[21] = 0;
      s[22] = 0;
      s[23] = 0;
      s[24] = 0;
      s[25] = 1;
      s[26] = 0;
      s[27] = 0;
      s[28] = 0;
      s[29] = 0;
      s[30] = 1;
      s[31] = 0;
    }
    const b = props.blockData;
    let dirty = false;
    for (let i = 0; i < 32; i++) {
      if (b[i] !== s[i]) {
        dirty = true;
        break;
      }
    }
    const offset = props.blockSlot * this._materialStride;
    if (dirty) {
      b.set(s);
      this.state.bindUniformBuffer(this._materialBuffer);
      gl.bufferSubData(gl.UNIFORM_BUFFER, offset, b);
    }
    return offset;
  }
  _bindMaterialTextures(material) {
    const t = this.textures;
    if (material.map) t.setTexture2D(material.map, TEXTURE_UNITS.map);
    if (material.alphaMap) t.setTexture2D(material.alphaMap, TEXTURE_UNITS.alphaMap);
    if (material.normalMap) t.setTexture2D(material.normalMap, TEXTURE_UNITS.normalMap);
    if (material.emissiveMap) t.setTexture2D(material.emissiveMap, TEXTURE_UNITS.emissiveMap);
    if (material.roughnessMap) t.setTexture2D(material.roughnessMap, TEXTURE_UNITS.roughnessMap);
    if (material.metalnessMap) t.setTexture2D(material.metalnessMap, TEXTURE_UNITS.metalnessMap);
    if (material.aoMap) t.setTexture2D(material.aoMap, TEXTURE_UNITS.aoMap);
    if (material.specularMap) t.setTexture2D(material.specularMap, TEXTURE_UNITS.specularMap);
  }
  // ------------------------------------------------------------------ drawing
  _isBatchable(item) {
    const object = item.object;
    return object.isMesh === true && object.isInstancedMesh !== true && object.isSkinnedMesh !== true && item.group === null && item.material.isShaderMaterial !== true && object.morphTargetInfluences === void 0 && object.onBeforeRender === defaultOnBeforeRender && object.onAfterRender === defaultOnAfterRender;
  }
  /**
   * Build draw commands (singles and batches) from a sorted key list, then execute them.
   */
  _drawList(list, keys, n, scene, camera, shadowPass) {
    if (n === 0) return;
    this._currentScene = scene;
    const batcher = this.batcher;
    batcher.begin();
    let cmdN = 0;
    const autoBatch = this.autoBatch;
    let i = 0;
    while (i < n) {
      const item = list.itemFromKey(keys[i]);
      let j = i + 1;
      if (autoBatch && this._isBatchable(item)) {
        while (j < n) {
          const next = list.itemFromKey(keys[j]);
          if (next.geometry === item.geometry && next.material === item.material && next.program === item.program && next.renderOrder === item.renderOrder && this._isBatchable(next)) j++;
          else break;
        }
      }
      if (cmdN === this._cmdCapacity) this._growCommands();
      this._cmdItem[cmdN] = item;
      if (j - i >= 2) {
        batcher.ensure(j - i);
        this._cmdOffset[cmdN] = batcher.count;
        this._cmdCount[cmdN] = j - i;
        for (let k = i; k < j; k++) batcher.add(list.itemFromKey(keys[k]).object);
      } else {
        this._cmdOffset[cmdN] = -1;
        this._cmdCount[cmdN] = 1;
      }
      cmdN++;
      i = j;
    }
    batcher.upload();
    for (let c = 0; c < cmdN; c++) {
      const item = this._cmdItem[c];
      if (this._cmdOffset[c] >= 0) this._renderBatch(item, this._cmdOffset[c], this._cmdCount[c], scene, camera, shadowPass);
      else this._renderItem(item, scene, camera, shadowPass);
      this._cmdItem[c] = null;
    }
  }
  _growCommands() {
    const cap = this._cmdCapacity * 2;
    const a = new Array(cap);
    for (let i = 0; i < this._cmdCapacity; i++) a[i] = this._cmdItem[i];
    const o = new Int32Array(cap);
    o.set(this._cmdOffset);
    const cnt = new Int32Array(cap);
    cnt.set(this._cmdCount);
    this._cmdItem = a;
    this._cmdOffset = o;
    this._cmdCount = cnt;
    this._cmdCapacity = cap;
  }
  _drawMode(object, material) {
    const gl = this._gl;
    if (object.isMesh || object.isSprite) {
      if (material.wireframe === true) return gl.LINES;
      return gl.TRIANGLES;
    }
    if (object.isLine) {
      if (object.isLineSegments) return gl.LINES;
      if (object.isLineLoop) return gl.LINE_LOOP;
      return gl.LINE_STRIP;
    }
    if (object.isPoints) return gl.POINTS;
    return gl.TRIANGLES;
  }
  _wireframeGeometry(geometry) {
    let wf = this._wireframeGeometries.get(geometry);
    if (wf === void 0 || wf._sourceLayout !== geometry._layoutVersion || geometry.index !== null && wf._sourceIndexVersion !== geometry.index.version) {
      wf = new BufferGeometry();
      wf.attributes = geometry.attributes;
      const indices = [];
      const index = geometry.index, position = geometry.attributes.position;
      if (index !== null) {
        const arr = index.array;
        for (let i = 0, l = arr.length; i < l; i += 3) {
          const a = arr[i], b = arr[i + 1], c = arr[i + 2];
          indices.push(a, b, b, c, c, a);
        }
      } else {
        for (let i = 0, l = position.count; i < l; i += 3) indices.push(i, i + 1, i + 1, i + 2, i + 2, i);
      }
      wf.setIndex(indices);
      wf._sourceLayout = geometry._layoutVersion;
      wf._sourceIndexVersion = index !== null ? index.version : 0;
      wf.boundingSphere = geometry.boundingSphere;
      this._wireframeGeometries.set(geometry, wf);
    }
    return wf;
  }
  /** Shared setup for a draw: program, material state, textures, block binding. Returns the program. */
  _setupMaterial(item, program, material, camera, frontFaceCW, side) {
    const gl = this._gl, state = this.state;
    const programChanged = state.useProgram(program.program);
    const materialChanged = this._currentMaterial !== material || programChanged || this._currentSide !== side;
    if (materialChanged) {
      this._currentMaterial = material;
      this._currentSide = side;
      state.setMaterial(material, frontFaceCW, side);
      if (program.hasMaterialBlock) {
        const props = this._materialProps(material);
        const offset = this._syncMaterialBlock(material, props);
        state.bindUniformBufferRange(BLOCK_MATERIAL, this._materialBuffer, offset, MATERIAL_BLOCK_SIZE);
      }
      if (material.isShaderMaterial) {
        this._uploadShaderMaterialUniforms(program, material, camera, programChanged);
      } else {
        this._bindMaterialTextures(material);
      }
      if (material.isLineBasicMaterial) state.setLineWidth(material.linewidth * this._pixelRatio);
    } else if (material.isShaderMaterial && material.uniformsNeedUpdate === true) {
      this._uploadShaderMaterialUniforms(program, material, camera, true);
      material.uniformsNeedUpdate = false;
    } else {
      state.setFlipSided(frontFaceCW ? side !== BackSide : side === BackSide);
    }
    return programChanged;
  }
  _renderItem(item, scene, camera, shadowPass) {
    const object = item.object, material = item.material, group = item.group;
    let geometry = item.geometry;
    const program = item.program;
    if (object.onBeforeRender !== defaultOnBeforeRender) object.onBeforeRender(this, scene, camera, geometry, material, group);
    const gl = this._gl;
    const frontFaceCW = object.isMesh && object.matrixWorld.determinant() < 0;
    this._setupMaterial(item, program, material, camera, frontFaceCW, shadowPass ? shadowSideOf(material) : material.side);
    if (material.wireframe === true && object.isMesh) geometry = this._wireframeGeometry(geometry);
    const s = object._slabData, o = object._slabOffset;
    if (program.modelMatrixLocation !== null) gl.uniformMatrix4fv(program.modelMatrixLocation, false, s, o + 16, 16);
    if (material.isShaderMaterial) {
      this._uploadObjectUniformsForShaderMaterial(program, object, camera);
    } else if (program.normalMatrixLocation !== null) {
      if (object._normalVersion !== object._worldVersion) {
        computeNormalMatrix(s, o);
        object._normalVersion = object._worldVersion;
      }
      gl.uniformMatrix3fv(program.normalMatrixLocation, false, s, o + 32, 9);
    }
    if (program.spriteCenterLocation !== null) gl.uniform2f(program.spriteCenterLocation, object.center.x, object.center.y);
    const mode = object.isInstancedMesh ? 1 : 0;
    const record = this.bindingStates.bind(geometry, mode, object, null, program);
    let instanceCount = 1, instanced = false;
    if (object.isInstancedMesh) {
      instanceCount = Math.min(object.count, object.instanceMatrix.count);
      instanced = true;
    } else if (geometry.isInstancedBufferGeometry) {
      instanceCount = Math.min(geometry.instanceCount, record.maxInstancedCount);
      instanced = true;
    }
    this._draw(record, geometry, group, this._drawMode(object, material), instanceCount, instanced);
    if (object.onAfterRender !== defaultOnAfterRender) object.onAfterRender(this, scene, camera, geometry, material, group);
  }
  _renderBatch(item, instanceOffset, instanceCount, scene, camera, shadowPass) {
    const object = item.object, material = item.material;
    let geometry = item.geometry;
    const gl = this._gl;
    const variant = this._variantFor(object, geometry, material, shadowPass) | V_INSTANCING;
    const program = this._getProgram(material, object, scene, variant);
    this._setupMaterial(item, program, material, camera, false, shadowPass ? shadowSideOf(material) : material.side);
    if (material.wireframe === true) geometry = this._wireframeGeometry(geometry);
    if (program.modelMatrixLocation !== null) gl.uniformMatrix4fv(program.modelMatrixLocation, false, IDENTITY);
    const record = this.bindingStates.bind(geometry, 2, null, this.batcher.buffer, program);
    this.bindingStates.setBatchOffset(this.batcher.buffer, instanceOffset * 64);
    this._draw(record, geometry, null, this._drawMode(object, material), instanceCount, true);
    this.info.render.batches++;
    this.info.render.instances += instanceCount;
  }
  _draw(record, geometry, group, mode, instanceCount, instanced) {
    const gl = this._gl;
    const index = geometry.index;
    const drawRange = geometry.drawRange;
    let drawStart, drawCount;
    if (index !== null) {
      drawStart = drawRange.start;
      drawCount = drawRange.count === Infinity ? index.count : drawRange.count;
      if (group !== null) {
        const end = Math.min(drawStart + drawCount, group.start + group.count);
        drawStart = Math.max(drawStart, group.start);
        drawCount = end - drawStart;
      }
      drawCount = Math.min(drawCount, index.count - drawStart);
      if (drawCount <= 0 || instanceCount <= 0) return;
      if (instanced) gl.drawElementsInstanced(mode, drawCount, record.indexType, drawStart * record.indexBytes, instanceCount);
      else gl.drawElements(mode, drawCount, record.indexType, drawStart * record.indexBytes);
    } else {
      const position = geometry.attributes.position;
      if (position === void 0) return;
      drawStart = drawRange.start;
      drawCount = drawRange.count === Infinity ? position.count : drawRange.count;
      if (group !== null) {
        const end = Math.min(drawStart + drawCount, group.start + group.count);
        drawStart = Math.max(drawStart, group.start);
        drawCount = end - drawStart;
      }
      drawCount = Math.min(drawCount, position.count - drawStart);
      if (drawCount <= 0 || instanceCount <= 0) return;
      if (instanced) gl.drawArraysInstanced(mode, drawStart, drawCount, instanceCount);
      else gl.drawArrays(mode, drawStart, drawCount);
    }
    this.info.update(drawCount, mode, instanceCount);
  }
  // ------------------------------------------------------------------ ShaderMaterial support
  _uploadShaderMaterialUniforms(program, material, camera, programChanged) {
    const gl = this._gl;
    const uniforms = material.uniforms;
    this._textureUnit = 0;
    for (const name in uniforms) this._uploadUniform(program, name, uniforms[name].value);
    const pu = program.uniforms;
    if (pu.projectionMatrix) gl.uniformMatrix4fv(pu.projectionMatrix.location, false, camera.projectionMatrix.elements);
    if (pu.viewMatrix) gl.uniformMatrix4fv(pu.viewMatrix.location, false, camera.matrixWorldInverse.elements);
    if (pu.cameraPosition) {
      const e = camera.matrixWorld.elements;
      gl.uniform3f(pu.cameraPosition.location, e[12], e[13], e[14]);
    }
    if (pu.isOrthographic) gl.uniform1i(pu.isOrthographic.location, camera.isOrthographicCamera ? 1 : 0);
    if (pu.toneMappingExposure && uniforms.toneMappingExposure === void 0) gl.uniform1f(pu.toneMappingExposure.location, this.toneMappingExposure);
    const fog = this._currentScene ? this._currentScene.fog : null;
    if (fog && material.fog === true) {
      if (pu.fogColor) gl.uniform3f(pu.fogColor.location, fog.color.r, fog.color.g, fog.color.b);
      if (fog.isFog) {
        if (pu.fogNear) gl.uniform1f(pu.fogNear.location, fog.near);
        if (pu.fogFar) gl.uniform1f(pu.fogFar.location, fog.far);
      } else if (pu.fogDensity) gl.uniform1f(pu.fogDensity.location, fog.density);
    }
  }
  /** Uploads one uniform value; recurses into structs ({...}) and arrays of structs like three.js. */
  _uploadUniform(program, name, value) {
    const u = program.uniforms[name];
    if (u !== void 0) {
      this._textureUnit = setUniformValue(this._gl, this, u, value, this._textureUnit);
      return;
    }
    if (value === null || value === void 0) return;
    if (Array.isArray(value)) {
      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && !isLeafValue(value[0])) {
        for (let i = 0; i < value.length; i++) this._uploadUniform(program, name + "[" + i + "]", value[i]);
      } else if (value.length > 0 && isLeafValue(value[0])) {
        const arr = program.uniforms[name];
        if (arr !== void 0) this._textureUnit = setUniformValue(this._gl, this, arr, value, this._textureUnit);
      }
    } else if (typeof value === "object" && !isLeafValue(value)) {
      for (const key in value) this._uploadUniform(program, name + "." + key, value[key]);
    }
  }
  _uploadObjectUniformsForShaderMaterial(program, object, camera) {
    const gl = this._gl, pu = program.uniforms;
    if (pu.modelViewMatrix) {
      object.modelViewMatrix.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
      gl.uniformMatrix4fv(pu.modelViewMatrix.location, false, object.modelViewMatrix.elements);
    }
    if (pu.normalMatrix) {
      object.normalMatrix.getNormalMatrix(object.modelViewMatrix);
      gl.uniformMatrix3fv(pu.normalMatrix.location, false, object.normalMatrix.elements);
    }
  }
};
function shadowSideOf(material) {
  if (material.shadowSide !== null && material.shadowSide !== void 0) return material.shadowSide;
  return material.side === FrontSide ? BackSide : material.side === BackSide ? FrontSide : DoubleSide;
}
var IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
function computeNormalMatrix(s, o) {
  const e = o + 16;
  const n11 = s[e], n21 = s[e + 1], n31 = s[e + 2], n12 = s[e + 4], n22 = s[e + 5], n32 = s[e + 6], n13 = s[e + 8], n23 = s[e + 9], n33 = s[e + 10];
  const t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13;
  const det = n11 * t11 + n21 * t12 + n31 * t13;
  const m = o + 32;
  if (det === 0) {
    for (let i = 0; i < 9; i++) s[m + i] = 0;
    return;
  }
  const detInv = 1 / det;
  const i0 = t11 * detInv, i1 = (n31 * n23 - n33 * n21) * detInv, i2 = (n32 * n21 - n31 * n22) * detInv;
  const i3 = t12 * detInv, i4 = (n33 * n11 - n31 * n13) * detInv, i5 = (n31 * n12 - n32 * n11) * detInv;
  const i6 = t13 * detInv, i7 = (n21 * n13 - n23 * n11) * detInv, i8 = (n22 * n11 - n21 * n12) * detInv;
  s[m] = i0;
  s[m + 1] = i3;
  s[m + 2] = i6;
  s[m + 3] = i1;
  s[m + 4] = i4;
  s[m + 5] = i7;
  s[m + 6] = i2;
  s[m + 7] = i5;
  s[m + 8] = i8;
}
function isLeafValue(v) {
  return v.isVector2 || v.isVector3 || v.isVector4 || v.isColor || v.isMatrix3 || v.isMatrix4 || v.isQuaternion || v.isTexture || ArrayBuffer.isView(v);
}
function flattenArray(value, stride) {
  if (ArrayBuffer.isView(value)) return value;
  if (typeof value[0] === "number") return value;
  const out = new Float32Array(value.length * stride);
  for (let i = 0; i < value.length; i++) {
    const v = value[i];
    if (v.isColor) {
      out[i * stride] = v.r;
      out[i * stride + 1] = v.g;
      out[i * stride + 2] = v.b;
    } else if (v.elements) out.set(v.elements, i * stride);
    else v.toArray(out, i * stride);
  }
  return out;
}
function bindTextureUniform(renderer, u, value, unit) {
  const gl = renderer._gl;
  if (!value || !value.isTexture) return;
  if (u.type === gl.SAMPLER_3D) renderer.textures.setTexture3D(value, unit);
  else if (u.type === gl.SAMPLER_2D_ARRAY) renderer.textures.setTexture2DArray(value, unit);
  else if (u.type === gl.SAMPLER_CUBE || u.type === gl.SAMPLER_CUBE_SHADOW) renderer.textures.setTextureCube(value, unit);
  else renderer.textures.setTexture2D(value, unit);
}
function setUniformValue(gl, renderer, u, value, textureUnit) {
  const loc = u.location;
  if (value === null || value === void 0) return textureUnit;
  switch (u.type) {
    case gl.FLOAT:
      if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) gl.uniform1fv(loc, value);
      else gl.uniform1f(loc, value);
      break;
    case gl.INT:
    case gl.BOOL:
      if (u.size > 1 || Array.isArray(value) || ArrayBuffer.isView(value)) gl.uniform1iv(loc, value);
      else gl.uniform1i(loc, value ? typeof value === "boolean" ? 1 : value : 0);
      break;
    case gl.UNSIGNED_INT:
      if (u.size > 1) gl.uniform1uiv(loc, value);
      else gl.uniform1ui(loc, value);
      break;
    case gl.FLOAT_VEC2:
      if (value.isVector2) gl.uniform2f(loc, value.x, value.y);
      else gl.uniform2fv(loc, flattenArray(value, 2));
      break;
    case gl.FLOAT_VEC3:
      if (value.isVector3) gl.uniform3f(loc, value.x, value.y, value.z);
      else if (value.isColor) gl.uniform3f(loc, value.r, value.g, value.b);
      else gl.uniform3fv(loc, flattenArray(value, 3));
      break;
    case gl.FLOAT_VEC4:
      if (value.isVector4 || value.isQuaternion) gl.uniform4f(loc, value.x, value.y, value.z, value.w);
      else gl.uniform4fv(loc, flattenArray(value, 4));
      break;
    case gl.INT_VEC2:
    case gl.BOOL_VEC2:
      if (value.isVector2) gl.uniform2i(loc, value.x, value.y);
      else gl.uniform2iv(loc, value);
      break;
    case gl.INT_VEC3:
    case gl.BOOL_VEC3:
      if (value.isVector3) gl.uniform3i(loc, value.x, value.y, value.z);
      else gl.uniform3iv(loc, value);
      break;
    case gl.INT_VEC4:
    case gl.BOOL_VEC4:
      if (value.isVector4) gl.uniform4i(loc, value.x, value.y, value.z, value.w);
      else gl.uniform4iv(loc, value);
      break;
    case gl.FLOAT_MAT2:
      gl.uniformMatrix2fv(loc, false, value.elements || flattenArray(value, 4));
      break;
    case gl.FLOAT_MAT3:
      gl.uniformMatrix3fv(loc, false, value.elements || flattenArray(value, 9));
      break;
    case gl.FLOAT_MAT4:
      gl.uniformMatrix4fv(loc, false, value.elements || flattenArray(value, 16));
      break;
    case gl.SAMPLER_2D:
    case gl.SAMPLER_2D_SHADOW:
    case gl.SAMPLER_3D:
    case gl.SAMPLER_2D_ARRAY:
    case gl.SAMPLER_CUBE:
    case gl.SAMPLER_CUBE_SHADOW:
    case gl.INT_SAMPLER_2D:
    case gl.UNSIGNED_INT_SAMPLER_2D:
    case gl.INT_SAMPLER_3D:
    case gl.UNSIGNED_INT_SAMPLER_3D:
    case gl.INT_SAMPLER_2D_ARRAY:
    case gl.UNSIGNED_INT_SAMPLER_2D_ARRAY:
      if (Array.isArray(value)) {
        const units = new Int32Array(value.length);
        for (let i = 0; i < value.length; i++) {
          units[i] = textureUnit;
          bindTextureUniform(renderer, u, value[i], textureUnit);
          textureUnit++;
        }
        gl.uniform1iv(loc, units);
      } else if (value.isTexture) {
        bindTextureUniform(renderer, u, value, textureUnit);
        gl.uniform1i(loc, textureUnit);
        textureUnit++;
      }
      break;
    default:
      break;
  }
  return textureUnit;
}
function createCanvasElement() {
  const canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
  canvas.style.display = "block";
  return canvas;
}

// src/renderers/shaders/UniformsUtils.js
function cloneUniforms(src) {
  const dst = {};
  for (const u in src) {
    dst[u] = {};
    for (const p in src[u]) {
      const property = src[u][p];
      if (property && (property.isColor || property.isMatrix3 || property.isMatrix4 || property.isVector2 || property.isVector3 || property.isVector4 || property.isTexture || property.isQuaternion)) {
        if (property.isRenderTargetTexture) {
          console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms(). Use UniformsUtils.merge() instead.");
          dst[u][p] = null;
        } else {
          dst[u][p] = property.clone();
        }
      } else if (Array.isArray(property)) {
        dst[u][p] = property.slice();
      } else {
        dst[u][p] = property;
      }
    }
  }
  return dst;
}
function mergeUniforms(uniforms) {
  const merged = {};
  for (let u = 0; u < uniforms.length; u++) {
    const tmp3 = cloneUniforms(uniforms[u]);
    for (const p in tmp3) merged[p] = tmp3[p];
  }
  return merged;
}
function cloneUniformsGroups(src) {
  const dst = [];
  for (let u = 0; u < src.length; u++) dst.push(src[u].clone());
  return dst;
}
var UniformsUtils = { clone: cloneUniforms, merge: mergeUniforms };

// src/renderers/shaders/UniformsLib.js
var UniformsLib = {
  common: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 }
  },
  specularmap: {
    specularMap: { value: null },
    specularMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  envmap: {
    envMap: { value: null },
    envMapRotation: { value: /* @__PURE__ */ new Matrix3() },
    reflectivity: { value: 1 },
    // basic, lambert, phong
    ior: { value: 1.5 },
    // physical
    refractionRatio: { value: 0.98 },
    // basic, lambert, phong
    dfgLUT: { value: null }
    // DFG LUT for physically-based rendering
  },
  aomap: {
    aoMap: { value: null },
    aoMapIntensity: { value: 1 },
    aoMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  lightmap: {
    lightMap: { value: null },
    lightMapIntensity: { value: 1 },
    lightMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  bumpmap: {
    bumpMap: { value: null },
    bumpMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    bumpScale: { value: 1 }
  },
  normalmap: {
    normalMap: { value: null },
    normalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    normalScale: { value: /* @__PURE__ */ new Vector2(1, 1) }
  },
  displacementmap: {
    displacementMap: { value: null },
    displacementMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    displacementScale: { value: 1 },
    displacementBias: { value: 0 }
  },
  emissivemap: {
    emissiveMap: { value: null },
    emissiveMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  metalnessmap: {
    metalnessMap: { value: null },
    metalnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  roughnessmap: {
    roughnessMap: { value: null },
    roughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  gradientmap: {
    gradientMap: { value: null }
  },
  fog: {
    fogDensity: { value: 25e-5 },
    fogNear: { value: 1 },
    fogFar: { value: 2e3 },
    fogColor: { value: /* @__PURE__ */ new Color(16777215) }
  },
  lights: {
    ambientLightColor: { value: [] },
    lightProbe: { value: [] },
    sunLights: { value: [], properties: {
      direction: {},
      color: {}
    } },
    sunLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    sunShadowMatrix: { value: [] },
    sunShadowCascade: { value: [] },
    directionalLights: { value: [], properties: {
      direction: {},
      color: {}
    } },
    directionalLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    directionalShadowMatrix: { value: [] },
    spotLights: { value: [], properties: {
      color: {},
      position: {},
      direction: {},
      distance: {},
      coneCos: {},
      penumbraCos: {},
      decay: {}
    } },
    spotLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    spotLightMap: { value: [] },
    spotLightMatrix: { value: [] },
    pointLights: { value: [], properties: {
      color: {},
      position: {},
      decay: {},
      distance: {}
    } },
    pointLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {},
      shadowCameraNear: {},
      shadowCameraFar: {}
    } },
    pointShadowMatrix: { value: [] },
    hemisphereLights: { value: [], properties: {
      direction: {},
      skyColor: {},
      groundColor: {}
    } },
    // TODO (abelnation): RectAreaLight BRDF data needs to be moved from example to main src
    rectAreaLights: { value: [], properties: {
      color: {},
      position: {},
      width: {},
      height: {}
    } },
    ltc_1: { value: null },
    ltc_2: { value: null },
    probesSH: { value: null },
    probesMin: { value: /* @__PURE__ */ new Vector3() },
    probesMax: { value: /* @__PURE__ */ new Vector3() },
    probesResolution: { value: /* @__PURE__ */ new Vector3() }
  },
  points: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    size: { value: 1 },
    scale: { value: 1 },
    map: { value: null },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 },
    uvTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  sprite: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    center: { value: /* @__PURE__ */ new Vector2(0.5, 0.5) },
    rotation: { value: 0 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 }
  }
};

// src/renderers/shaders/ThreeShaderLib.js
var ShaderLib = {
  basic: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.meshbasic_vert,
    fragmentShader: ShaderChunk.meshbasic_frag
  },
  lambert: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshlambert_vert,
    fragmentShader: ShaderChunk.meshlambert_frag
  },
  phong: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        specular: { value: /* @__PURE__ */ new Color(1118481) },
        shininess: { value: 30 },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshphong_vert,
    fragmentShader: ShaderChunk.meshphong_frag
  },
  standard: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.roughnessmap,
      UniformsLib.metalnessmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        roughness: { value: 1 },
        metalness: { value: 0 },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshphysical_vert,
    fragmentShader: ShaderChunk.meshphysical_frag
  },
  toon: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.gradientmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) }
      }
    ]),
    vertexShader: ShaderChunk.meshtoon_vert,
    fragmentShader: ShaderChunk.meshtoon_frag
  },
  matcap: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      {
        matcap: { value: null }
      }
    ]),
    vertexShader: ShaderChunk.meshmatcap_vert,
    fragmentShader: ShaderChunk.meshmatcap_frag
  },
  points: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.points,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.points_vert,
    fragmentShader: ShaderChunk.points_frag
  },
  dashed: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: { value: 1 },
        dashSize: { value: 1 },
        totalSize: { value: 2 }
      }
    ]),
    vertexShader: ShaderChunk.linedashed_vert,
    fragmentShader: ShaderChunk.linedashed_frag
  },
  depth: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap
    ]),
    vertexShader: ShaderChunk.depth_vert,
    fragmentShader: ShaderChunk.depth_frag
  },
  normal: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      {
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshnormal_vert,
    fragmentShader: ShaderChunk.meshnormal_frag
  },
  sprite: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.sprite,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.sprite_vert,
    fragmentShader: ShaderChunk.sprite_frag
  },
  background: {
    uniforms: {
      uvTransform: { value: /* @__PURE__ */ new Matrix3() },
      t2D: { value: null },
      backgroundIntensity: { value: 1 }
    },
    vertexShader: ShaderChunk.background_vert,
    fragmentShader: ShaderChunk.background_frag
  },
  backgroundCube: {
    uniforms: {
      envMap: { value: null },
      backgroundBlurriness: { value: 0 },
      backgroundIntensity: { value: 1 },
      backgroundRotation: { value: /* @__PURE__ */ new Matrix3() }
    },
    vertexShader: ShaderChunk.backgroundCube_vert,
    fragmentShader: ShaderChunk.backgroundCube_frag
  },
  cube: {
    uniforms: {
      tCube: { value: null },
      tFlip: { value: -1 },
      opacity: { value: 1 }
    },
    vertexShader: ShaderChunk.cube_vert,
    fragmentShader: ShaderChunk.cube_frag
  },
  equirect: {
    uniforms: {
      tEquirect: { value: null }
    },
    vertexShader: ShaderChunk.equirect_vert,
    fragmentShader: ShaderChunk.equirect_frag
  },
  distance: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap,
      {
        referencePosition: { value: /* @__PURE__ */ new Vector3() },
        nearDistance: { value: 1 },
        farDistance: { value: 1e3 }
      }
    ]),
    vertexShader: ShaderChunk.distance_vert,
    fragmentShader: ShaderChunk.distance_frag
  },
  shadow: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.lights,
      UniformsLib.fog,
      {
        color: { value: /* @__PURE__ */ new Color(0) },
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.shadow_vert,
    fragmentShader: ShaderChunk.shadow_frag
  }
};
ShaderLib.physical = {
  uniforms: /* @__PURE__ */ mergeUniforms([
    ShaderLib.standard.uniforms,
    {
      clearcoat: { value: 0 },
      clearcoatMap: { value: null },
      clearcoatMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      clearcoatNormalMap: { value: null },
      clearcoatNormalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      clearcoatNormalScale: { value: /* @__PURE__ */ new Vector2(1, 1) },
      clearcoatRoughness: { value: 0 },
      clearcoatRoughnessMap: { value: null },
      clearcoatRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      dispersion: { value: 0 },
      retroreflectivity: { value: 0 },
      iridescence: { value: 0 },
      iridescenceMap: { value: null },
      iridescenceMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      iridescenceIOR: { value: 1.3 },
      iridescenceThicknessMinimum: { value: 100 },
      iridescenceThicknessMaximum: { value: 400 },
      iridescenceThicknessMap: { value: null },
      iridescenceThicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      sheen: { value: 0 },
      sheenColor: { value: /* @__PURE__ */ new Color(0) },
      sheenColorMap: { value: null },
      sheenColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      sheenRoughness: { value: 1 },
      sheenRoughnessMap: { value: null },
      sheenRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      transmission: { value: 0 },
      transmissionMap: { value: null },
      transmissionMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      transmissionSamplerSize: { value: /* @__PURE__ */ new Vector2() },
      transmissionSamplerMap: { value: null },
      thickness: { value: 0 },
      thicknessMap: { value: null },
      thicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      attenuationDistance: { value: 0 },
      attenuationColor: { value: /* @__PURE__ */ new Color(0) },
      specularColor: { value: /* @__PURE__ */ new Color(1, 1, 1) },
      specularColorMap: { value: null },
      specularColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      specularIntensity: { value: 1 },
      specularIntensityMap: { value: null },
      specularIntensityMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      anisotropyVector: { value: /* @__PURE__ */ new Vector2() },
      anisotropyMap: { value: null },
      anisotropyMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    }
  ]),
  vertexShader: ShaderChunk.meshphysical_vert,
  fragmentShader: ShaderChunk.meshphysical_frag
};

// src/scenes/Scene.js
var Scene = class extends Object3D {
  constructor() {
    super();
    this.isScene = true;
    this.type = "Scene";
    this.background = null;
    this.environment = null;
    this.fog = null;
    this.backgroundBlurriness = 0;
    this.backgroundIntensity = 1;
    this.backgroundRotation = new Euler();
    this.environmentIntensity = 1;
    this.environmentRotation = new Euler();
    this.overrideMaterial = null;
    if (typeof __THREE_DEVTOOLS__ !== "undefined") __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe", { detail: this }));
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    if (source.background !== null) this.background = source.background.clone();
    if (source.environment !== null) this.environment = source.environment.clone();
    if (source.fog !== null) this.fog = source.fog.clone();
    this.backgroundBlurriness = source.backgroundBlurriness;
    this.backgroundIntensity = source.backgroundIntensity;
    this.backgroundRotation.copy(source.backgroundRotation);
    this.environmentIntensity = source.environmentIntensity;
    this.environmentRotation.copy(source.environmentRotation);
    if (source.overrideMaterial !== null) this.overrideMaterial = source.overrideMaterial.clone();
    this.matrixAutoUpdate = source.matrixAutoUpdate;
    return this;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    if (this.fog !== null) data.object.fog = this.fog.toJSON();
    return data;
  }
};

// src/scenes/Fog.js
var Fog = class _Fog {
  constructor(color, near = 1, far = 1e3) {
    this.isFog = true;
    this.name = "";
    this.color = new Color(color);
    this.near = near;
    this.far = far;
  }
  clone() {
    return new _Fog(this.color, this.near, this.far);
  }
  toJSON() {
    return { type: "Fog", name: this.name, color: this.color.getHex(), near: this.near, far: this.far };
  }
};

// src/scenes/FogExp2.js
var FogExp2 = class _FogExp2 {
  constructor(color, density = 25e-5) {
    this.isFogExp2 = true;
    this.name = "";
    this.color = new Color(color);
    this.density = density;
  }
  clone() {
    return new _FogExp2(this.color, this.density);
  }
  toJSON() {
    return { type: "FogExp2", name: this.name, color: this.color.getHex(), density: this.density };
  }
};

// src/math/Triangle.js
var _v02 = /* @__PURE__ */ new Vector3();
var _v15 = /* @__PURE__ */ new Vector3();
var _v24 = /* @__PURE__ */ new Vector3();
var _v3 = /* @__PURE__ */ new Vector3();
var _vab = /* @__PURE__ */ new Vector3();
var _vac = /* @__PURE__ */ new Vector3();
var _vbc = /* @__PURE__ */ new Vector3();
var _vap = /* @__PURE__ */ new Vector3();
var _vbp = /* @__PURE__ */ new Vector3();
var _vcp = /* @__PURE__ */ new Vector3();
var _v40 = /* @__PURE__ */ new Vector4();
var _v41 = /* @__PURE__ */ new Vector4();
var _v42 = /* @__PURE__ */ new Vector4();
var Triangle = class _Triangle {
  constructor(a = new Vector3(), b = new Vector3(), c = new Vector3()) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
  static getNormal(a, b, c, target) {
    target.subVectors(c, b);
    _v02.subVectors(a, b);
    target.cross(_v02);
    const targetLengthSq = target.lengthSq();
    if (targetLengthSq > 0) return target.multiplyScalar(1 / Math.sqrt(targetLengthSq));
    return target.set(0, 0, 0);
  }
  static getBarycoord(point, a, b, c, target) {
    _v02.subVectors(c, a);
    _v15.subVectors(b, a);
    _v24.subVectors(point, a);
    const dot00 = _v02.dot(_v02), dot01 = _v02.dot(_v15), dot02 = _v02.dot(_v24), dot11 = _v15.dot(_v15), dot12 = _v15.dot(_v24);
    const denom = dot00 * dot11 - dot01 * dot01;
    if (denom === 0) {
      target.set(0, 0, 0);
      return null;
    }
    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    return target.set(1 - u - v, v, u);
  }
  static containsPoint(point, a, b, c) {
    if (this.getBarycoord(point, a, b, c, _v3) === null) return false;
    return _v3.x >= 0 && _v3.y >= 0 && _v3.x + _v3.y <= 1;
  }
  static getInterpolation(point, p1, p2, p3, v1, v2, v3, target) {
    if (this.getBarycoord(point, p1, p2, p3, _v3) === null) {
      target.x = 0;
      target.y = 0;
      if ("z" in target) target.z = 0;
      if ("w" in target) target.w = 0;
      return null;
    }
    target.setScalar(0);
    target.addScaledVector(v1, _v3.x);
    target.addScaledVector(v2, _v3.y);
    target.addScaledVector(v3, _v3.z);
    return target;
  }
  static getInterpolatedAttribute(attr, i1, i2, i3, barycoord, target) {
    _v40.setScalar(0);
    _v41.setScalar(0);
    _v42.setScalar(0);
    _v40.fromBufferAttribute(attr, i1);
    _v41.fromBufferAttribute(attr, i2);
    _v42.fromBufferAttribute(attr, i3);
    target.setScalar(0);
    target.addScaledVector(_v40, barycoord.x);
    target.addScaledVector(_v41, barycoord.y);
    target.addScaledVector(_v42, barycoord.z);
    return target;
  }
  static isFrontFacing(a, b, c, direction) {
    _v02.subVectors(c, b);
    _v15.subVectors(a, b);
    return _v02.cross(_v15).dot(direction) < 0 ? true : false;
  }
  set(a, b, c) {
    this.a.copy(a);
    this.b.copy(b);
    this.c.copy(c);
    return this;
  }
  setFromPointsAndIndices(points, i0, i1, i2) {
    this.a.copy(points[i0]);
    this.b.copy(points[i1]);
    this.c.copy(points[i2]);
    return this;
  }
  setFromAttributeAndIndices(attribute, i0, i1, i2) {
    this.a.fromBufferAttribute(attribute, i0);
    this.b.fromBufferAttribute(attribute, i1);
    this.c.fromBufferAttribute(attribute, i2);
    return this;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(t) {
    this.a.copy(t.a);
    this.b.copy(t.b);
    this.c.copy(t.c);
    return this;
  }
  getArea() {
    _v02.subVectors(this.c, this.b);
    _v15.subVectors(this.a, this.b);
    return _v02.cross(_v15).length() * 0.5;
  }
  getMidpoint(target) {
    return target.addVectors(this.a, this.b).add(this.c).multiplyScalar(1 / 3);
  }
  getNormal(target) {
    return _Triangle.getNormal(this.a, this.b, this.c, target);
  }
  getPlane(target) {
    return target.setFromCoplanarPoints(this.a, this.b, this.c);
  }
  getBarycoord(point, target) {
    return _Triangle.getBarycoord(point, this.a, this.b, this.c, target);
  }
  getInterpolation(point, v1, v2, v3, target) {
    return _Triangle.getInterpolation(point, this.a, this.b, this.c, v1, v2, v3, target);
  }
  containsPoint(point) {
    return _Triangle.containsPoint(point, this.a, this.b, this.c);
  }
  isFrontFacing(direction) {
    return _Triangle.isFrontFacing(this.a, this.b, this.c, direction);
  }
  intersectsBox(box) {
    return box.intersectsTriangle(this);
  }
  closestPointToPoint(p, target) {
    const a = this.a, b = this.b, c = this.c;
    let v, w;
    _vab.subVectors(b, a);
    _vac.subVectors(c, a);
    _vap.subVectors(p, a);
    const d1 = _vab.dot(_vap), d2 = _vac.dot(_vap);
    if (d1 <= 0 && d2 <= 0) return target.copy(a);
    _vbp.subVectors(p, b);
    const d3 = _vab.dot(_vbp), d4 = _vac.dot(_vbp);
    if (d3 >= 0 && d4 <= d3) return target.copy(b);
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      v = d1 / (d1 - d3);
      return target.copy(a).addScaledVector(_vab, v);
    }
    _vcp.subVectors(p, c);
    const d5 = _vab.dot(_vcp), d6 = _vac.dot(_vcp);
    if (d6 >= 0 && d5 <= d6) return target.copy(c);
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      w = d2 / (d2 - d6);
      return target.copy(a).addScaledVector(_vac, w);
    }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      _vbc.subVectors(c, b);
      w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      return target.copy(b).addScaledVector(_vbc, w);
    }
    const denom = 1 / (va + vb + vc);
    v = vb * denom;
    w = vc * denom;
    return target.copy(a).addScaledVector(_vab, v).addScaledVector(_vac, w);
  }
  equals(t) {
    return t.a.equals(this.a) && t.b.equals(this.b) && t.c.equals(this.c);
  }
};

// src/materials/Material.js
var _materialId = 0;
var Material = class extends EventDispatcher {
  constructor() {
    super();
    this.isMaterial = true;
    Object.defineProperty(this, "id", { value: _materialId++ });
    this.uuid = generateUUID();
    this.name = "";
    this.type = "Material";
    this.blending = NormalBlending;
    this.side = FrontSide;
    this.vertexColors = false;
    this.opacity = 1;
    this.transparent = false;
    this.alphaHash = false;
    this.blendSrc = SrcAlphaFactor;
    this.blendDst = OneMinusSrcAlphaFactor;
    this.blendEquation = AddEquation;
    this.blendSrcAlpha = null;
    this.blendDstAlpha = null;
    this.blendEquationAlpha = null;
    this.blendColor = new Color(0, 0, 0);
    this.blendAlpha = 0;
    this.depthFunc = LessEqualDepth;
    this.depthTest = true;
    this.depthWrite = true;
    this.stencilWriteMask = 255;
    this.stencilFunc = AlwaysStencilFunc;
    this.stencilRef = 0;
    this.stencilFuncMask = 255;
    this.stencilFail = KeepStencilOp;
    this.stencilZFail = KeepStencilOp;
    this.stencilZPass = KeepStencilOp;
    this.stencilWrite = false;
    this.clippingPlanes = null;
    this.clipIntersection = false;
    this.clipShadows = false;
    this.shadowSide = null;
    this.colorWrite = true;
    this.precision = null;
    this.polygonOffset = false;
    this.polygonOffsetFactor = 0;
    this.polygonOffsetUnits = 0;
    this.dithering = false;
    this.alphaToCoverage = false;
    this.premultipliedAlpha = false;
    this.forceSinglePass = false;
    this.allowOverride = true;
    this.visible = true;
    this.toneMapped = true;
    this.userData = {};
    this.version = 0;
    this._alphaTest = 0;
    this._programDirty = true;
    this._frameStamp = -1;
    this._frameRid = 0;
  }
  get alphaTest() {
    return this._alphaTest;
  }
  set alphaTest(value) {
    if (this._alphaTest > 0 !== value > 0) this.version++;
    this._alphaTest = value;
  }
  onBeforeRender() {
  }
  onBeforeCompile() {
  }
  customProgramCacheKey() {
    return this.onBeforeCompile.toString();
  }
  setValues(values) {
    if (values === void 0) return;
    for (const key in values) {
      const newValue = values[key];
      if (newValue === void 0) {
        console.warn(`Material: parameter '${key}' has value of undefined.`);
        continue;
      }
      const currentValue = this[key];
      if (currentValue === void 0) {
        console.warn(`Material: '${key}' is not a property of ${this.type}.`);
        continue;
      }
      if (currentValue && currentValue.isColor) currentValue.set(newValue);
      else if (currentValue && currentValue.isVector3 && (newValue && newValue.isVector3)) currentValue.copy(newValue);
      else this[key] = newValue;
    }
  }
  toJSON() {
    const data = { metadata: { version: 4.6, type: "Material", generator: "jrs" } };
    data.uuid = this.uuid;
    data.type = this.type;
    if (this.name !== "") data.name = this.name;
    if (this.color && this.color.isColor) data.color = this.color.getHex();
    if (this.roughness !== void 0) data.roughness = this.roughness;
    if (this.metalness !== void 0) data.metalness = this.metalness;
    if (this.emissive && this.emissive.isColor) data.emissive = this.emissive.getHex();
    if (this.specular && this.specular.isColor) data.specular = this.specular.getHex();
    if (this.shininess !== void 0) data.shininess = this.shininess;
    if (this.opacity !== 1) data.opacity = this.opacity;
    if (this.transparent === true) data.transparent = true;
    if (this.side !== FrontSide) data.side = this.side;
    if (this.vertexColors === true) data.vertexColors = true;
    if (this.depthTest === false) data.depthTest = false;
    if (this.depthWrite === false) data.depthWrite = false;
    if (this.visible === false) data.visible = false;
    if (Object.keys(this.userData).length > 0) data.userData = this.userData;
    return data;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.name = source.name;
    this.blending = source.blending;
    this.side = source.side;
    this.vertexColors = source.vertexColors;
    this.opacity = source.opacity;
    this.transparent = source.transparent;
    this.blendSrc = source.blendSrc;
    this.blendDst = source.blendDst;
    this.blendEquation = source.blendEquation;
    this.blendSrcAlpha = source.blendSrcAlpha;
    this.blendDstAlpha = source.blendDstAlpha;
    this.blendEquationAlpha = source.blendEquationAlpha;
    this.blendColor.copy(source.blendColor);
    this.blendAlpha = source.blendAlpha;
    this.depthFunc = source.depthFunc;
    this.depthTest = source.depthTest;
    this.depthWrite = source.depthWrite;
    this.stencilWriteMask = source.stencilWriteMask;
    this.stencilFunc = source.stencilFunc;
    this.stencilRef = source.stencilRef;
    this.stencilFuncMask = source.stencilFuncMask;
    this.stencilFail = source.stencilFail;
    this.stencilZFail = source.stencilZFail;
    this.stencilZPass = source.stencilZPass;
    this.stencilWrite = source.stencilWrite;
    const srcPlanes = source.clippingPlanes;
    let dstPlanes = null;
    if (srcPlanes !== null) {
      const n = srcPlanes.length;
      dstPlanes = new Array(n);
      for (let i = 0; i !== n; ++i) dstPlanes[i] = srcPlanes[i].clone();
    }
    this.clippingPlanes = dstPlanes;
    this.clipIntersection = source.clipIntersection;
    this.clipShadows = source.clipShadows;
    this.shadowSide = source.shadowSide;
    this.colorWrite = source.colorWrite;
    this.precision = source.precision;
    this.polygonOffset = source.polygonOffset;
    this.polygonOffsetFactor = source.polygonOffsetFactor;
    this.polygonOffsetUnits = source.polygonOffsetUnits;
    this.dithering = source.dithering;
    this.alphaTest = source.alphaTest;
    this.alphaHash = source.alphaHash;
    this.alphaToCoverage = source.alphaToCoverage;
    this.premultipliedAlpha = source.premultipliedAlpha;
    this.forceSinglePass = source.forceSinglePass;
    this.visible = source.visible;
    this.toneMapped = source.toneMapped;
    this.userData = JSON.parse(JSON.stringify(source.userData));
    return this;
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  set needsUpdate(value) {
    if (value === true) {
      this.version++;
      this._programDirty = true;
    }
  }
};

// src/materials/SpriteMaterial.js
var SpriteMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isSpriteMaterial = true;
    this.type = "SpriteMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.alphaMap = null;
    this.rotation = 0;
    this.sizeAttenuation = true;
    this.transparent = true;
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.rotation = source.rotation;
    this.sizeAttenuation = source.sizeAttenuation;
    this.fog = source.fog;
    return this;
  }
};

// src/objects/Sprite.js
var _geometry;
var _intersectPoint = /* @__PURE__ */ new Vector3();
var _worldScale = /* @__PURE__ */ new Vector3();
var _mvPosition = /* @__PURE__ */ new Vector3();
var _alignedPosition = /* @__PURE__ */ new Vector2();
var _rotatedPosition = /* @__PURE__ */ new Vector2();
var _viewWorldMatrix = /* @__PURE__ */ new Matrix4();
var _vA = /* @__PURE__ */ new Vector3();
var _vB = /* @__PURE__ */ new Vector3();
var _vC = /* @__PURE__ */ new Vector3();
var _uvA = /* @__PURE__ */ new Vector2();
var _uvB = /* @__PURE__ */ new Vector2();
var _uvC = /* @__PURE__ */ new Vector2();
var Sprite = class extends Object3D {
  constructor(material = new SpriteMaterial()) {
    super();
    this.isSprite = true;
    this.type = "Sprite";
    if (_geometry === void 0) {
      _geometry = new BufferGeometry();
      const float32Array = new Float32Array([-0.5, -0.5, 0, 0, 0, 0.5, -0.5, 0, 1, 0, 0.5, 0.5, 0, 1, 1, -0.5, 0.5, 0, 0, 1]);
      _geometry.setIndex([0, 1, 2, 0, 2, 3]);
      const pos = new Float32Array(12), uv = new Float32Array(8);
      for (let i = 0; i < 4; i++) {
        pos[i * 3] = float32Array[i * 5];
        pos[i * 3 + 1] = float32Array[i * 5 + 1];
        pos[i * 3 + 2] = float32Array[i * 5 + 2];
        uv[i * 2] = float32Array[i * 5 + 3];
        uv[i * 2 + 1] = float32Array[i * 5 + 4];
      }
      _geometry.setAttribute("position", new Float32BufferAttribute(pos, 3));
      _geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    }
    this.geometry = _geometry;
    this.material = material;
    this.center = new Vector2(0.5, 0.5);
  }
  raycast(raycaster, intersects) {
    if (raycaster.camera === null) console.error('Sprite: "Raycaster.camera" needs to be set in order to raycast against sprites.');
    _worldScale.setFromMatrixScale(this.matrixWorld);
    _viewWorldMatrix.copy(raycaster.camera.matrixWorld);
    this.modelViewMatrix.multiplyMatrices(raycaster.camera.matrixWorldInverse, this.matrixWorld);
    _mvPosition.setFromMatrixPosition(this.modelViewMatrix);
    if (raycaster.camera.isPerspectiveCamera && this.material.sizeAttenuation === false) _worldScale.multiplyScalar(-_mvPosition.z);
    const rotation = this.material.rotation;
    let sin, cos;
    if (rotation !== 0) {
      cos = Math.cos(rotation);
      sin = Math.sin(rotation);
    }
    const center = this.center;
    transformVertex(_vA.set(-0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
    transformVertex(_vB.set(0.5, -0.5, 0), _mvPosition, center, _worldScale, sin, cos);
    transformVertex(_vC.set(0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
    _uvA.set(0, 0);
    _uvB.set(1, 0);
    _uvC.set(1, 1);
    let intersect2 = raycaster.ray.intersectTriangle(_vA, _vB, _vC, false, _intersectPoint);
    if (intersect2 === null) {
      transformVertex(_vB.set(-0.5, 0.5, 0), _mvPosition, center, _worldScale, sin, cos);
      _uvB.set(0, 1);
      intersect2 = raycaster.ray.intersectTriangle(_vA, _vC, _vB, false, _intersectPoint);
      if (intersect2 === null) return;
    }
    const distance = raycaster.ray.origin.distanceTo(_intersectPoint);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({ distance, point: _intersectPoint.clone(), uv: Triangle.getInterpolation(_intersectPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, new Vector2()), face: null, object: this });
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    if (source.center !== void 0) this.center.copy(source.center);
    this.material = source.material;
    return this;
  }
};
function transformVertex(vertexPosition, mvPosition, center, scale, sin, cos) {
  _alignedPosition.subVectors(vertexPosition, center).addScalar(0.5).multiply(scale);
  if (sin !== void 0) {
    _rotatedPosition.x = cos * _alignedPosition.x - sin * _alignedPosition.y;
    _rotatedPosition.y = sin * _alignedPosition.x + cos * _alignedPosition.y;
  } else {
    _rotatedPosition.copy(_alignedPosition);
  }
  vertexPosition.copy(mvPosition);
  vertexPosition.x += _rotatedPosition.x;
  vertexPosition.y += _rotatedPosition.y;
  vertexPosition.applyMatrix4(_viewWorldMatrix);
}

// src/core/InstancedBufferAttribute.js
var InstancedBufferAttribute = class extends BufferAttribute {
  constructor(array, itemSize, normalized, meshPerAttribute = 1) {
    super(array, itemSize, normalized);
    this.isInstancedBufferAttribute = true;
    this.meshPerAttribute = meshPerAttribute;
  }
  copy(source) {
    super.copy(source);
    this.meshPerAttribute = source.meshPerAttribute;
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.meshPerAttribute = this.meshPerAttribute;
    data.isInstancedBufferAttribute = true;
    return data;
  }
};

// src/math/Ray.js
var _vector6 = /* @__PURE__ */ new Vector3();
var _segCenter = /* @__PURE__ */ new Vector3();
var _segDir = /* @__PURE__ */ new Vector3();
var _diff = /* @__PURE__ */ new Vector3();
var _edge1 = /* @__PURE__ */ new Vector3();
var _edge2 = /* @__PURE__ */ new Vector3();
var _normal = /* @__PURE__ */ new Vector3();
var Ray = class {
  constructor(origin = new Vector3(), direction = new Vector3(0, 0, -1)) {
    this.origin = origin;
    this.direction = direction;
  }
  set(origin, direction) {
    this.origin.copy(origin);
    this.direction.copy(direction);
    return this;
  }
  copy(ray) {
    this.origin.copy(ray.origin);
    this.direction.copy(ray.direction);
    return this;
  }
  at(t, target) {
    return target.copy(this.origin).addScaledVector(this.direction, t);
  }
  lookAt(v) {
    this.direction.copy(v).sub(this.origin).normalize();
    return this;
  }
  recast(t) {
    this.origin.copy(this.at(t, _vector6));
    return this;
  }
  closestPointToPoint(point, target) {
    target.subVectors(point, this.origin);
    const directionDistance = target.dot(this.direction);
    if (directionDistance < 0) return target.copy(this.origin);
    return target.copy(this.origin).addScaledVector(this.direction, directionDistance);
  }
  distanceToPoint(point) {
    return Math.sqrt(this.distanceSqToPoint(point));
  }
  distanceSqToPoint(point) {
    const directionDistance = _vector6.subVectors(point, this.origin).dot(this.direction);
    if (directionDistance < 0) return this.origin.distanceToSquared(point);
    _vector6.copy(this.origin).addScaledVector(this.direction, directionDistance);
    return _vector6.distanceToSquared(point);
  }
  distanceSqToSegment(v0, v1, optionalPointOnRay, optionalPointOnSegment) {
    _segCenter.copy(v0).add(v1).multiplyScalar(0.5);
    _segDir.copy(v1).sub(v0).normalize();
    _diff.copy(this.origin).sub(_segCenter);
    const segExtent = v0.distanceTo(v1) * 0.5;
    const a01 = -this.direction.dot(_segDir);
    const b0 = _diff.dot(this.direction);
    const b1 = -_diff.dot(_segDir);
    const c = _diff.lengthSq();
    const det = Math.abs(1 - a01 * a01);
    let s0, s1, sqrDist, extDet;
    if (det > 0) {
      s0 = a01 * b1 - b0;
      s1 = a01 * b0 - b1;
      extDet = segExtent * det;
      if (s0 >= 0) {
        if (s1 >= -extDet) {
          if (s1 <= extDet) {
            const invDet = 1 / det;
            s0 *= invDet;
            s1 *= invDet;
            sqrDist = s0 * (s0 + a01 * s1 + 2 * b0) + s1 * (a01 * s0 + s1 + 2 * b1) + c;
          } else {
            s1 = segExtent;
            s0 = Math.max(0, -(a01 * s1 + b0));
            sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
          }
        } else {
          s1 = -segExtent;
          s0 = Math.max(0, -(a01 * s1 + b0));
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      } else {
        if (s1 <= -extDet) {
          s0 = Math.max(0, -(-a01 * segExtent + b0));
          s1 = s0 > 0 ? -segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        } else if (s1 <= extDet) {
          s0 = 0;
          s1 = Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = s1 * (s1 + 2 * b1) + c;
        } else {
          s0 = Math.max(0, -(a01 * segExtent + b0));
          s1 = s0 > 0 ? segExtent : Math.min(Math.max(-segExtent, -b1), segExtent);
          sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
        }
      }
    } else {
      s1 = a01 > 0 ? -segExtent : segExtent;
      s0 = Math.max(0, -(a01 * s1 + b0));
      sqrDist = -s0 * s0 + s1 * (s1 + 2 * b1) + c;
    }
    if (optionalPointOnRay) optionalPointOnRay.copy(this.origin).addScaledVector(this.direction, s0);
    if (optionalPointOnSegment) optionalPointOnSegment.copy(_segCenter).addScaledVector(_segDir, s1);
    return sqrDist;
  }
  intersectSphere(sphere, target) {
    _vector6.subVectors(sphere.center, this.origin);
    const tca = _vector6.dot(this.direction);
    const d2 = _vector6.dot(_vector6) - tca * tca;
    const radius2 = sphere.radius * sphere.radius;
    if (d2 > radius2) return null;
    const thc = Math.sqrt(radius2 - d2);
    const t0 = tca - thc, t1 = tca + thc;
    if (t1 < 0) return null;
    if (t0 < 0) return this.at(t1, target);
    return this.at(t0, target);
  }
  intersectsSphere(sphere) {
    if (sphere.radius < 0) return false;
    return this.distanceSqToPoint(sphere.center) <= sphere.radius * sphere.radius;
  }
  distanceToPlane(plane) {
    const denominator = plane.normal.dot(this.direction);
    if (denominator === 0) {
      if (plane.distanceToPoint(this.origin) === 0) return 0;
      return null;
    }
    const t = -(this.origin.dot(plane.normal) + plane.constant) / denominator;
    return t >= 0 ? t : null;
  }
  intersectPlane(plane, target) {
    const t = this.distanceToPlane(plane);
    if (t === null) return null;
    return this.at(t, target);
  }
  intersectsPlane(plane) {
    const distToPoint = plane.distanceToPoint(this.origin);
    if (distToPoint === 0) return true;
    const denominator = plane.normal.dot(this.direction);
    if (denominator * distToPoint < 0) return true;
    return false;
  }
  intersectBox(box, target) {
    let tmin, tmax, tymin, tymax, tzmin, tzmax;
    const invdirx = 1 / this.direction.x, invdiry = 1 / this.direction.y, invdirz = 1 / this.direction.z;
    const origin = this.origin;
    if (invdirx >= 0) {
      tmin = (box.min.x - origin.x) * invdirx;
      tmax = (box.max.x - origin.x) * invdirx;
    } else {
      tmin = (box.max.x - origin.x) * invdirx;
      tmax = (box.min.x - origin.x) * invdirx;
    }
    if (invdiry >= 0) {
      tymin = (box.min.y - origin.y) * invdiry;
      tymax = (box.max.y - origin.y) * invdiry;
    } else {
      tymin = (box.max.y - origin.y) * invdiry;
      tymax = (box.min.y - origin.y) * invdiry;
    }
    if (tmin > tymax || tymin > tmax) return null;
    if (tymin > tmin || isNaN(tmin)) tmin = tymin;
    if (tymax < tmax || isNaN(tmax)) tmax = tymax;
    if (invdirz >= 0) {
      tzmin = (box.min.z - origin.z) * invdirz;
      tzmax = (box.max.z - origin.z) * invdirz;
    } else {
      tzmin = (box.max.z - origin.z) * invdirz;
      tzmax = (box.min.z - origin.z) * invdirz;
    }
    if (tmin > tzmax || tzmin > tmax) return null;
    if (tzmin > tmin || tmin !== tmin) tmin = tzmin;
    if (tzmax < tmax || tmax !== tmax) tmax = tzmax;
    if (tmax < 0) return null;
    return this.at(tmin >= 0 ? tmin : tmax, target);
  }
  intersectsBox(box) {
    return this.intersectBox(box, _vector6) !== null;
  }
  intersectTriangle(a, b, c, backfaceCulling, target) {
    _edge1.subVectors(b, a);
    _edge2.subVectors(c, a);
    _normal.crossVectors(_edge1, _edge2);
    let DdN = this.direction.dot(_normal);
    let sign;
    if (DdN > 0) {
      if (backfaceCulling) return null;
      sign = 1;
    } else if (DdN < 0) {
      sign = -1;
      DdN = -DdN;
    } else return null;
    _diff.subVectors(this.origin, a);
    const DdQxE2 = sign * this.direction.dot(_edge2.crossVectors(_diff, _edge2));
    if (DdQxE2 < 0) return null;
    const DdE1xQ = sign * this.direction.dot(_edge1.cross(_diff));
    if (DdE1xQ < 0) return null;
    if (DdQxE2 + DdE1xQ > DdN) return null;
    const QdN = -sign * _diff.dot(_normal);
    if (QdN < 0) return null;
    return this.at(QdN / DdN, target);
  }
  applyMatrix4(matrix4) {
    this.origin.applyMatrix4(matrix4);
    this.direction.transformDirection(matrix4);
    return this;
  }
  equals(ray) {
    return ray.origin.equals(this.origin) && ray.direction.equals(this.direction);
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/materials/MeshBasicMaterial.js
var MeshBasicMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshBasicMaterial = true;
    this.type = "MeshBasicMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.specularMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.envMapRotation = new Euler();
    this.combine = MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.fog = source.fog;
    return this;
  }
};

// src/objects/Mesh.js
var _inverseMatrix = /* @__PURE__ */ new Matrix4();
var _ray = /* @__PURE__ */ new Ray();
var _sphere2 = /* @__PURE__ */ new Sphere();
var _vA2 = /* @__PURE__ */ new Vector3();
var _vB2 = /* @__PURE__ */ new Vector3();
var _vC2 = /* @__PURE__ */ new Vector3();
var _tempA = /* @__PURE__ */ new Vector3();
var _morphA = /* @__PURE__ */ new Vector3();
var _intersectionPoint = /* @__PURE__ */ new Vector3();
var _intersectionPointWorld = /* @__PURE__ */ new Vector3();
var Mesh = class extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new MeshBasicMaterial()) {
    super();
    this.isMesh = true;
    this.type = "Mesh";
    this.geometry = geometry;
    this.material = material;
    this.morphTargetInfluences = void 0;
    this.morphTargetDictionary = void 0;
    this.updateMorphTargets();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    if (source.morphTargetInfluences !== void 0) this.morphTargetInfluences = source.morphTargetInfluences.slice();
    if (source.morphTargetDictionary !== void 0) this.morphTargetDictionary = Object.assign({}, source.morphTargetDictionary);
    this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
    this.geometry = source.geometry;
    return this;
  }
  updateMorphTargets() {
    const geometry = this.geometry;
    const morphAttributes = geometry.morphAttributes;
    const keys = Object.keys(morphAttributes);
    if (keys.length > 0) {
      const morphAttribute = morphAttributes[keys[0]];
      if (morphAttribute !== void 0) {
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
          const name = morphAttribute[m].name || String(m);
          this.morphTargetInfluences.push(0);
          this.morphTargetDictionary[name] = m;
        }
      }
    }
  }
  getVertexPosition(index, target) {
    const geometry = this.geometry;
    const position = geometry.attributes.position;
    const morphPosition = geometry.morphAttributes.position;
    const morphTargetsRelative = geometry.morphTargetsRelative;
    target.fromBufferAttribute(position, index);
    const morphInfluences = this.morphTargetInfluences;
    if (morphPosition && morphInfluences) {
      _morphA.set(0, 0, 0);
      for (let i = 0, il = morphPosition.length; i < il; i++) {
        const influence = morphInfluences[i];
        const morphAttribute = morphPosition[i];
        if (influence === 0) continue;
        _tempA.fromBufferAttribute(morphAttribute, index);
        if (morphTargetsRelative) _morphA.addScaledVector(_tempA, influence);
        else _morphA.addScaledVector(_tempA.sub(target), influence);
      }
      target.add(_morphA);
    }
    return target;
  }
  raycast(raycaster, intersects) {
    const geometry = this.geometry;
    const material = this.material;
    const matrixWorld = this.matrixWorld;
    if (material === void 0) return;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    _sphere2.copy(geometry.boundingSphere);
    _sphere2.applyMatrix4(matrixWorld);
    _ray.copy(raycaster.ray);
    if (_ray.intersectsSphere(_sphere2) === false) return;
    _inverseMatrix.copy(matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    if (geometry.boundingBox !== null) {
      if (_ray.intersectsBox(geometry.boundingBox) === false) return;
    }
    this._computeIntersections(raycaster, intersects, _ray);
  }
  _computeIntersections(raycaster, intersects, rayLocalSpace) {
    const geometry = this.geometry;
    const material = this.material;
    const index = geometry.index;
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const uv1 = geometry.attributes.uv1;
    const normal = geometry.attributes.normal;
    const groups = geometry.groups;
    const drawRange = geometry.drawRange;
    if (position === void 0) return;
    const useMorph = this.morphTargetInfluences !== void 0 && geometry.morphAttributes.position !== void 0;
    const triCount = index !== null ? index.count / 3 : position.count / 3;
    if (geometry.boundsTree === null && triCount > 64 && useMorph === false) geometry.computeBoundsTree();
    const bvh = useMorph ? null : geometry.boundsTree;
    const start = drawRange.start, end = Math.min(index !== null ? index.count : position.count, drawRange.start + drawRange.count);
    if (bvh !== null) {
      const o = rayLocalSpace.origin, d = rayLocalSpace.direction;
      bvh.raycast(o.x, o.y, o.z, d.x, d.y, d.z, Infinity, (t) => {
        const i = t * 3;
        if (i < start || i + 2 >= end) return;
        let a, b, c;
        if (index !== null) {
          a = index.getX(i);
          b = index.getX(i + 1);
          c = index.getX(i + 2);
        } else {
          a = i;
          b = i + 1;
          c = i + 2;
        }
        let materialIndex = 0;
        if (Array.isArray(material)) {
          for (let g = 0; g < groups.length; g++) {
            const gr = groups[g];
            if (i >= gr.start && i < gr.start + gr.count) {
              materialIndex = gr.materialIndex;
              break;
            }
          }
        }
        const mat = Array.isArray(material) ? material[materialIndex] : material;
        if (mat === void 0) return;
        const intersection = checkGeometryIntersection(this, mat, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c, materialIndex);
        if (intersection) {
          intersection.faceIndex = t;
          intersects.push(intersection);
        }
      });
      return;
    }
    if (index !== null) {
      if (Array.isArray(material)) {
        for (let i = 0, il = groups.length; i < il; i++) {
          const group = groups[i];
          const gs = Math.max(group.start, drawRange.start), ge = Math.min(index.count, Math.min(group.start + group.count, drawRange.start + drawRange.count));
          for (let j = gs, jl = ge; j < jl; j += 3) {
            const a = index.getX(j), b = index.getX(j + 1), c = index.getX(j + 2);
            const intersection = checkGeometryIntersection(this, material[group.materialIndex], raycaster, rayLocalSpace, uv, uv1, normal, a, b, c, group.materialIndex);
            if (intersection) {
              intersection.faceIndex = Math.floor(j / 3);
              intersects.push(intersection);
            }
          }
        }
      } else {
        for (let i = start, il = end; i < il; i += 3) {
          const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
          const intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, a, b, c);
          if (intersection) {
            intersection.faceIndex = Math.floor(i / 3);
            intersects.push(intersection);
          }
        }
      }
    } else {
      if (Array.isArray(material)) {
        for (let i = 0, il = groups.length; i < il; i++) {
          const group = groups[i];
          const gs = Math.max(group.start, drawRange.start), ge = Math.min(position.count, Math.min(group.start + group.count, drawRange.start + drawRange.count));
          for (let j = gs, jl = ge; j < jl; j += 3) {
            const intersection = checkGeometryIntersection(this, material[group.materialIndex], raycaster, rayLocalSpace, uv, uv1, normal, j, j + 1, j + 2, group.materialIndex);
            if (intersection) {
              intersection.faceIndex = Math.floor(j / 3);
              intersects.push(intersection);
            }
          }
        }
      } else {
        for (let i = start, il = end; i < il; i += 3) {
          const intersection = checkGeometryIntersection(this, material, raycaster, rayLocalSpace, uv, uv1, normal, i, i + 1, i + 2);
          if (intersection) {
            intersection.faceIndex = Math.floor(i / 3);
            intersects.push(intersection);
          }
        }
      }
    }
  }
};
function checkIntersection(object, material, raycaster, ray, pA, pB, pC, point) {
  let intersect2;
  if (material.side === BackSide) intersect2 = ray.intersectTriangle(pC, pB, pA, true, point);
  else intersect2 = ray.intersectTriangle(pA, pB, pC, material.side === FrontSide, point);
  if (intersect2 === null) return null;
  _intersectionPointWorld.copy(point);
  _intersectionPointWorld.applyMatrix4(object.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(_intersectionPointWorld);
  if (distance < raycaster.near || distance > raycaster.far) return null;
  return { distance, point: _intersectionPointWorld.clone(), object };
}
function checkGeometryIntersection(object, material, raycaster, ray, uv, uv1, normal, a, b, c, materialIndex = 0) {
  object.getVertexPosition(a, _vA2);
  object.getVertexPosition(b, _vB2);
  object.getVertexPosition(c, _vC2);
  const intersection = checkIntersection(object, material, raycaster, ray, _vA2, _vB2, _vC2, _intersectionPoint);
  if (intersection) {
    const barycoord = new Vector3();
    Triangle.getBarycoord(_intersectionPoint, _vA2, _vB2, _vC2, barycoord);
    if (uv) intersection.uv = Triangle.getInterpolatedAttribute(uv, a, b, c, barycoord, new Vector2());
    if (uv1) intersection.uv1 = Triangle.getInterpolatedAttribute(uv1, a, b, c, barycoord, new Vector2());
    if (normal) {
      intersection.normal = Triangle.getInterpolatedAttribute(normal, a, b, c, barycoord, new Vector3());
      if (intersection.normal.dot(ray.direction) > 0) intersection.normal.multiplyScalar(-1);
    }
    const face = { a, b, c, normal: new Vector3(), materialIndex };
    Triangle.getNormal(_vA2, _vB2, _vC2, face.normal);
    intersection.face = face;
    intersection.barycoord = barycoord;
  }
  return intersection;
}

// src/textures/DataTexture.js
var DataTexture = class extends Texture {
  constructor(data = null, width = 1, height = 1, format, type, mapping, wrapS, wrapT, magFilter = NearestFilter, minFilter = NearestFilter, anisotropy, colorSpace) {
    super(null, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
    this.isDataTexture = true;
    this.image = { data, width, height };
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
  }
};

// src/objects/InstancedMesh.js
var _instanceLocalMatrix = /* @__PURE__ */ new Matrix4();
var _instanceWorldMatrix = /* @__PURE__ */ new Matrix4();
var _instanceIntersects = [];
var _box32 = /* @__PURE__ */ new Box3();
var _identity = /* @__PURE__ */ new Matrix4();
var _mesh = /* @__PURE__ */ new Mesh();
var _sphere3 = /* @__PURE__ */ new Sphere();
var InstancedMesh = class extends Mesh {
  constructor(geometry, material, count) {
    super(geometry, material);
    this.isInstancedMesh = true;
    this.instanceMatrix = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
    this.instanceColor = null;
    this.morphTexture = null;
    this.count = count;
    this.boundingBox = null;
    this.boundingSphere = null;
    for (let i = 0; i < count; i++) this.setMatrixAt(i, _identity);
  }
  computeBoundingBox() {
    const geometry = this.geometry, count = this.count;
    if (this.boundingBox === null) this.boundingBox = new Box3();
    if (geometry.boundingBox === null) geometry.computeBoundingBox();
    this.boundingBox.makeEmpty();
    for (let i = 0; i < count; i++) {
      this.getMatrixAt(i, _instanceLocalMatrix);
      _box32.copy(geometry.boundingBox).applyMatrix4(_instanceLocalMatrix);
      this.boundingBox.union(_box32);
    }
  }
  computeBoundingSphere() {
    const geometry = this.geometry, count = this.count;
    if (this.boundingSphere === null) this.boundingSphere = new Sphere();
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    this.boundingSphere.makeEmpty();
    for (let i = 0; i < count; i++) {
      this.getMatrixAt(i, _instanceLocalMatrix);
      _sphere3.copy(geometry.boundingSphere).applyMatrix4(_instanceLocalMatrix);
      this.boundingSphere.union(_sphere3);
    }
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.instanceMatrix.copy(source.instanceMatrix);
    if (source.morphTexture !== null) this.morphTexture = source.morphTexture.clone();
    if (source.instanceColor !== null) this.instanceColor = source.instanceColor.clone();
    this.count = source.count;
    if (source.boundingBox !== null) this.boundingBox = source.boundingBox.clone();
    if (source.boundingSphere !== null) this.boundingSphere = source.boundingSphere.clone();
    return this;
  }
  getColorAt(index, color) {
    color.fromArray(this.instanceColor.array, index * 3);
  }
  getMatrixAt(index, matrix) {
    matrix.fromArray(this.instanceMatrix.array, index * 16);
  }
  getMorphAt(index, object) {
    const objectInfluences = object.morphTargetInfluences;
    const array = this.morphTexture.source.data.data;
    const len = objectInfluences.length + 1;
    const dataIndex = index * len + 1;
    for (let i = 0; i < objectInfluences.length; i++) objectInfluences[i] = array[dataIndex + i];
  }
  raycast(raycaster, intersects) {
    const matrixWorld = this.matrixWorld, raycastTimes = this.count;
    _mesh.geometry = this.geometry;
    _mesh.material = this.material;
    if (_mesh.material === void 0) return;
    if (this.boundingSphere === null) this.computeBoundingSphere();
    _sphere3.copy(this.boundingSphere);
    _sphere3.applyMatrix4(matrixWorld);
    if (raycaster.ray.intersectsSphere(_sphere3) === false) return;
    for (let instanceId = 0; instanceId < raycastTimes; instanceId++) {
      this.getMatrixAt(instanceId, _instanceLocalMatrix);
      _instanceWorldMatrix.multiplyMatrices(matrixWorld, _instanceLocalMatrix);
      _mesh.matrixWorld = _instanceWorldMatrix;
      _mesh.raycast(raycaster, _instanceIntersects);
      for (let i = 0, l = _instanceIntersects.length; i < l; i++) {
        const intersect2 = _instanceIntersects[i];
        intersect2.instanceId = instanceId;
        intersect2.object = this;
        intersects.push(intersect2);
      }
      _instanceIntersects.length = 0;
    }
  }
  setColorAt(index, color) {
    if (this.instanceColor === null) this.instanceColor = new InstancedBufferAttribute(new Float32Array(this.instanceMatrix.count * 3).fill(1), 3);
    color.toArray(this.instanceColor.array, index * 3);
  }
  setMatrixAt(index, matrix) {
    matrix.toArray(this.instanceMatrix.array, index * 16);
  }
  setMorphAt(index, object) {
    const objectInfluences = object.morphTargetInfluences;
    const len = objectInfluences.length + 1;
    if (this.morphTexture === null) this.morphTexture = new DataTexture(new Float32Array(len * this.count), len, this.count, RedFormat, FloatType);
    const array = this.morphTexture.source.data.data;
    let morphInfluencesSum = 0;
    for (let i = 0; i < objectInfluences.length; i++) morphInfluencesSum += objectInfluences[i];
    const morphBaseInfluence = this.geometry.morphTargetsRelative ? 1 : 1 - morphInfluencesSum;
    const dataIndex = len * index;
    array[dataIndex] = morphBaseInfluence;
    array.set(objectInfluences, dataIndex + 1);
  }
  updateMorphTargets() {
  }
  dispose() {
    this.dispatchEvent({ type: "dispose" });
    if (this.morphTexture !== null) {
      this.morphTexture.dispose();
      this.morphTexture = null;
    }
    return this;
  }
};

// src/materials/LineBasicMaterial.js
var LineBasicMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isLineBasicMaterial = true;
    this.type = "LineBasicMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.linewidth = 1;
    this.linecap = "round";
    this.linejoin = "round";
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.linewidth = source.linewidth;
    this.linecap = source.linecap;
    this.linejoin = source.linejoin;
    this.fog = source.fog;
    return this;
  }
};

// src/objects/Line.js
var _vStart = /* @__PURE__ */ new Vector3();
var _vEnd = /* @__PURE__ */ new Vector3();
var _inverseMatrix2 = /* @__PURE__ */ new Matrix4();
var _ray2 = /* @__PURE__ */ new Ray();
var _sphere4 = /* @__PURE__ */ new Sphere();
var _intersectPointOnRay = /* @__PURE__ */ new Vector3();
var _intersectPointOnSegment = /* @__PURE__ */ new Vector3();
var Line = class extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new LineBasicMaterial()) {
    super();
    this.isLine = true;
    this.type = "Line";
    this.geometry = geometry;
    this.material = material;
    this.morphTargetInfluences = void 0;
    this.morphTargetDictionary = void 0;
    this.updateMorphTargets();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
    this.geometry = source.geometry;
    return this;
  }
  computeLineDistances() {
    const geometry = this.geometry;
    if (geometry.index === null) {
      const positionAttribute = geometry.attributes.position;
      const lineDistances = [0];
      for (let i = 1, l = positionAttribute.count; i < l; i++) {
        _vStart.fromBufferAttribute(positionAttribute, i - 1);
        _vEnd.fromBufferAttribute(positionAttribute, i);
        lineDistances[i] = lineDistances[i - 1];
        lineDistances[i] += _vStart.distanceTo(_vEnd);
      }
      geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
    } else {
      console.warn("Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    }
    return this;
  }
  raycast(raycaster, intersects) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Line.threshold;
    const drawRange = geometry.drawRange;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    _sphere4.copy(geometry.boundingSphere);
    _sphere4.applyMatrix4(matrixWorld);
    _sphere4.radius += threshold;
    if (raycaster.ray.intersectsSphere(_sphere4) === false) return;
    _inverseMatrix2.copy(matrixWorld).invert();
    _ray2.copy(raycaster.ray).applyMatrix4(_inverseMatrix2);
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    const step = this.isLineSegments ? 2 : 1;
    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position;
    if (index !== null) {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(index.count, drawRange.start + drawRange.count);
      for (let i = start, l = end - 1; i < l; i += step) {
        const a = index.getX(i), b = index.getX(i + 1);
        const intersect2 = checkIntersection2(this, raycaster, _ray2, localThresholdSq, a, b, positionAttribute);
        if (intersect2) intersects.push(intersect2);
      }
      if (this.isLineLoop) {
        const a = index.getX(end - 1), b = index.getX(start);
        const intersect2 = checkIntersection2(this, raycaster, _ray2, localThresholdSq, a, b, positionAttribute);
        if (intersect2) intersects.push(intersect2);
      }
    } else {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (let i = start, l = end - 1; i < l; i += step) {
        const intersect2 = checkIntersection2(this, raycaster, _ray2, localThresholdSq, i, i + 1, positionAttribute);
        if (intersect2) intersects.push(intersect2);
      }
      if (this.isLineLoop) {
        const intersect2 = checkIntersection2(this, raycaster, _ray2, localThresholdSq, end - 1, start, positionAttribute);
        if (intersect2) intersects.push(intersect2);
      }
    }
  }
  updateMorphTargets() {
    const geometry = this.geometry;
    const morphAttributes = geometry.morphAttributes;
    const keys = Object.keys(morphAttributes);
    if (keys.length > 0) {
      const morphAttribute = morphAttributes[keys[0]];
      if (morphAttribute !== void 0) {
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
          const name = morphAttribute[m].name || String(m);
          this.morphTargetInfluences.push(0);
          this.morphTargetDictionary[name] = m;
        }
      }
    }
  }
};
function checkIntersection2(object, raycaster, ray, thresholdSq, a, b, positionAttribute) {
  const positionA = _vStart.fromBufferAttribute(positionAttribute, a);
  const positionB = _vEnd.fromBufferAttribute(positionAttribute, b);
  const distSq = ray.distanceSqToSegment(positionA, positionB, _intersectPointOnRay, _intersectPointOnSegment);
  if (distSq > thresholdSq) return;
  _intersectPointOnRay.applyMatrix4(object.matrixWorld);
  const distance = raycaster.ray.origin.distanceTo(_intersectPointOnRay);
  if (distance < raycaster.near || distance > raycaster.far) return;
  return {
    distance,
    point: _intersectPointOnSegment.clone().applyMatrix4(object.matrixWorld),
    index: a,
    face: null,
    faceIndex: null,
    barycoord: null,
    object
  };
}

// src/objects/LineSegments.js
var _start = /* @__PURE__ */ new Vector3();
var _end = /* @__PURE__ */ new Vector3();
var LineSegments = class extends Line {
  constructor(geometry, material) {
    super(geometry, material);
    this.isLineSegments = true;
    this.type = "LineSegments";
  }
  computeLineDistances() {
    const geometry = this.geometry;
    if (geometry.index === null) {
      const positionAttribute = geometry.attributes.position;
      const lineDistances = [];
      for (let i = 0, l = positionAttribute.count; i < l; i += 2) {
        _start.fromBufferAttribute(positionAttribute, i);
        _end.fromBufferAttribute(positionAttribute, i + 1);
        lineDistances[i] = i === 0 ? 0 : lineDistances[i - 1];
        lineDistances[i + 1] = lineDistances[i] + _start.distanceTo(_end);
      }
      geometry.setAttribute("lineDistance", new Float32BufferAttribute(lineDistances, 1));
    } else {
      console.warn("LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");
    }
    return this;
  }
};

// src/objects/LineLoop.js
var LineLoop = class extends Line {
  constructor(geometry, material) {
    super(geometry, material);
    this.isLineLoop = true;
    this.type = "LineLoop";
  }
};

// src/materials/PointsMaterial.js
var PointsMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isPointsMaterial = true;
    this.type = "PointsMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.alphaMap = null;
    this.size = 1;
    this.sizeAttenuation = true;
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.size = source.size;
    this.sizeAttenuation = source.sizeAttenuation;
    this.fog = source.fog;
    return this;
  }
};

// src/objects/Points.js
var _inverseMatrix3 = /* @__PURE__ */ new Matrix4();
var _ray3 = /* @__PURE__ */ new Ray();
var _sphere5 = /* @__PURE__ */ new Sphere();
var _position2 = /* @__PURE__ */ new Vector3();
var Points = class extends Object3D {
  constructor(geometry = new BufferGeometry(), material = new PointsMaterial()) {
    super();
    this.isPoints = true;
    this.type = "Points";
    this.geometry = geometry;
    this.material = material;
    this.morphTargetInfluences = void 0;
    this.morphTargetDictionary = void 0;
    this.updateMorphTargets();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.material = Array.isArray(source.material) ? source.material.slice() : source.material;
    this.geometry = source.geometry;
    return this;
  }
  raycast(raycaster, intersects) {
    const geometry = this.geometry;
    const matrixWorld = this.matrixWorld;
    const threshold = raycaster.params.Points.threshold;
    const drawRange = geometry.drawRange;
    if (geometry.boundingSphere === null) geometry.computeBoundingSphere();
    _sphere5.copy(geometry.boundingSphere);
    _sphere5.applyMatrix4(matrixWorld);
    _sphere5.radius += threshold;
    if (raycaster.ray.intersectsSphere(_sphere5) === false) return;
    _inverseMatrix3.copy(matrixWorld).invert();
    _ray3.copy(raycaster.ray).applyMatrix4(_inverseMatrix3);
    const localThreshold = threshold / ((this.scale.x + this.scale.y + this.scale.z) / 3);
    const localThresholdSq = localThreshold * localThreshold;
    const index = geometry.index;
    const attributes = geometry.attributes;
    const positionAttribute = attributes.position;
    if (index !== null) {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(index.count, drawRange.start + drawRange.count);
      for (let i = start, il = end; i < il; i++) {
        const a = index.getX(i);
        _position2.fromBufferAttribute(positionAttribute, a);
        testPoint(_position2, a, localThresholdSq, matrixWorld, raycaster, intersects, this);
      }
    } else {
      const start = Math.max(0, drawRange.start);
      const end = Math.min(positionAttribute.count, drawRange.start + drawRange.count);
      for (let i = start, l = end; i < l; i++) {
        _position2.fromBufferAttribute(positionAttribute, i);
        testPoint(_position2, i, localThresholdSq, matrixWorld, raycaster, intersects, this);
      }
    }
  }
  updateMorphTargets() {
    const geometry = this.geometry;
    const morphAttributes = geometry.morphAttributes;
    const keys = Object.keys(morphAttributes);
    if (keys.length > 0) {
      const morphAttribute = morphAttributes[keys[0]];
      if (morphAttribute !== void 0) {
        this.morphTargetInfluences = [];
        this.morphTargetDictionary = {};
        for (let m = 0, ml = morphAttribute.length; m < ml; m++) {
          const name = morphAttribute[m].name || String(m);
          this.morphTargetInfluences.push(0);
          this.morphTargetDictionary[name] = m;
        }
      }
    }
  }
};
function testPoint(point, index, localThresholdSq, matrixWorld, raycaster, intersects, object) {
  const rayPointDistanceSq = _ray3.distanceSqToPoint(point);
  if (rayPointDistanceSq < localThresholdSq) {
    const intersectPoint = new Vector3();
    _ray3.closestPointToPoint(point, intersectPoint);
    intersectPoint.applyMatrix4(matrixWorld);
    const distance = raycaster.ray.origin.distanceTo(intersectPoint);
    if (distance < raycaster.near || distance > raycaster.far) return;
    intersects.push({ distance, distanceToRay: Math.sqrt(rayPointDistanceSq), point: intersectPoint, index, face: null, faceIndex: null, barycoord: null, object });
  }
}

// src/objects/Group.js
var Group = class extends Object3D {
  constructor() {
    super();
    this.isGroup = true;
    this.type = "Group";
  }
};

// src/textures/CanvasTexture.js
var CanvasTexture = class extends Texture {
  constructor(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy) {
    super(canvas, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy);
    this.isCanvasTexture = true;
    this.needsUpdate = true;
  }
};

// src/textures/Data3DTexture.js
var Data3DTexture = class extends Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.isData3DTexture = true;
    this.image = { data, width, height, depth };
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.wrapR = ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
  }
  copy(source) {
    super.copy(source);
    this.wrapR = source.wrapR;
    return this;
  }
};

// src/textures/DataArrayTexture.js
var DataArrayTexture = class extends Texture {
  constructor(data = null, width = 1, height = 1, depth = 1) {
    super(null);
    this.isDataArrayTexture = true;
    this.image = { data, width, height, depth };
    this.magFilter = NearestFilter;
    this.minFilter = NearestFilter;
    this.wrapR = ClampToEdgeWrapping;
    this.generateMipmaps = false;
    this.flipY = false;
    this.unpackAlignment = 1;
    this.layerUpdates = /* @__PURE__ */ new Set();
  }
  copy(source) {
    super.copy(source);
    this.wrapR = source.wrapR;
    return this;
  }
  addLayerUpdate(layerIndex) {
    this.layerUpdates.add(layerIndex);
  }
  clearLayerUpdates() {
    this.layerUpdates.clear();
  }
};

// src/textures/CubeTexture.js
var CubeTexture = class extends Texture {
  constructor(images = [], mapping = CubeReflectionMapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace) {
    super(images, mapping, wrapS, wrapT, magFilter, minFilter, format, type, anisotropy, colorSpace);
    this.isCubeTexture = true;
    this.flipY = false;
  }
  get images() {
    return this.image;
  }
  set images(value) {
    this.image = value;
  }
};

// src/geometries/internal.js
function allocIndex(indexCount, vertexCount) {
  return vertexCount - 1 >= 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
}
function indexAttribute(indices) {
  if (indices instanceof Uint32Array) {
    let needsUint32 = false;
    for (let i = indices.length - 1; i >= 0; --i) if (indices[i] >= 65535) {
      needsUint32 = true;
      break;
    }
    if (needsUint32 === false) indices = new Uint16Array(indices);
  }
  return new BufferAttribute(indices, 1);
}
function countInclusive(n) {
  return n >= 0 ? Math.floor(n) + 1 : 0;
}
function countExclusive(n) {
  return n > 0 ? Math.ceil(n) : 0;
}

// src/geometries/BoxGeometry.js
var BoxGeometry = class _BoxGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, depth = 1, widthSegments = 1, heightSegments = 1, depthSegments = 1) {
    super();
    this.type = "BoxGeometry";
    this.parameters = {
      width,
      height,
      depth,
      widthSegments,
      heightSegments,
      depthSegments
    };
    const scope = this;
    widthSegments = Math.floor(widthSegments);
    heightSegments = Math.floor(heightSegments);
    depthSegments = Math.floor(depthSegments);
    const ws = widthSegments, hs = heightSegments, ds = depthSegments;
    const vertexCount = 2 * ((ds + 1) * (hs + 1) + (ws + 1) * (ds + 1) + (ws + 1) * (hs + 1));
    const indexCount = 12 * (ds * hs + ws * ds + ws * hs);
    const indices = allocIndex(indexCount, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let numberOfVertices = 0;
    let groupStart = 0;
    let vOff = 0, uvOff = 0, iOff = 0;
    buildPlane(2, 1, 0, -1, -1, depth, height, width, depthSegments, heightSegments, 0);
    buildPlane(2, 1, 0, 1, -1, depth, height, -width, depthSegments, heightSegments, 1);
    buildPlane(0, 2, 1, 1, 1, width, depth, height, widthSegments, depthSegments, 2);
    buildPlane(0, 2, 1, 1, -1, width, depth, -height, widthSegments, depthSegments, 3);
    buildPlane(0, 1, 2, 1, -1, width, height, depth, widthSegments, heightSegments, 4);
    buildPlane(0, 1, 2, -1, -1, width, height, -depth, widthSegments, heightSegments, 5);
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
    function buildPlane(u, v, w, udir, vdir, width2, height2, depth2, gridX, gridY, materialIndex) {
      const segmentWidth = width2 / gridX;
      const segmentHeight = height2 / gridY;
      const widthHalf = width2 / 2;
      const heightHalf = height2 / 2;
      const depthHalf = depth2 / 2;
      const gridX1 = gridX + 1;
      const gridY1 = gridY + 1;
      const nw = depth2 > 0 ? 1 : -1;
      for (let iy = 0; iy < gridY1; iy++) {
        const y = iy * segmentHeight - heightHalf;
        for (let ix = 0; ix < gridX1; ix++) {
          const x = ix * segmentWidth - widthHalf;
          vertices[vOff + u] = x * udir;
          vertices[vOff + v] = y * vdir;
          vertices[vOff + w] = depthHalf;
          normals[vOff + w] = nw;
          vOff += 3;
          uvs[uvOff++] = ix / gridX;
          uvs[uvOff++] = 1 - iy / gridY;
        }
      }
      for (let iy = 0; iy < gridY; iy++) {
        for (let ix = 0; ix < gridX; ix++) {
          const a = numberOfVertices + ix + gridX1 * iy;
          const b = numberOfVertices + ix + gridX1 * (iy + 1);
          const c = numberOfVertices + (ix + 1) + gridX1 * (iy + 1);
          const d = numberOfVertices + (ix + 1) + gridX1 * iy;
          indices[iOff++] = a;
          indices[iOff++] = b;
          indices[iOff++] = d;
          indices[iOff++] = b;
          indices[iOff++] = c;
          indices[iOff++] = d;
        }
      }
      const groupCount = gridX * gridY * 6;
      scope.addGroup(groupStart, groupCount, materialIndex);
      groupStart += groupCount;
      numberOfVertices += gridX1 * gridY1;
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _BoxGeometry(data.width, data.height, data.depth, data.widthSegments, data.heightSegments, data.depthSegments);
  }
};

// src/geometries/CapsuleGeometry.js
var CapsuleGeometry = class _CapsuleGeometry extends BufferGeometry {
  constructor(radius = 1, height = 1, capSegments = 4, radialSegments = 8, heightSegments = 1) {
    super();
    this.type = "CapsuleGeometry";
    this.parameters = {
      radius,
      height,
      capSegments,
      radialSegments,
      heightSegments
    };
    height = Math.max(0, height);
    capSegments = Math.max(1, Math.floor(capSegments));
    radialSegments = Math.max(3, Math.floor(radialSegments));
    heightSegments = Math.max(1, Math.floor(heightSegments));
    const halfHeight = height / 2;
    const capArcLength = Math.PI / 2 * radius;
    const cylinderPartLength = height;
    const totalArcLength = 2 * capArcLength + cylinderPartLength;
    const numVerticalSegments = capSegments * 2 + heightSegments;
    const verticesPerRow = radialSegments + 1;
    const vertexCount = (numVerticalSegments + 1) * verticesPerRow;
    const indices = allocIndex(numVerticalSegments * radialSegments * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let iy = 0; iy <= numVerticalSegments; iy++) {
      let currentArcLength = 0;
      let profileY = 0;
      let profileRadius = 0;
      let normalYComponent = 0;
      if (iy <= capSegments) {
        const segmentProgress = iy / capSegments;
        const angle = segmentProgress * Math.PI / 2;
        profileY = -halfHeight - radius * Math.cos(angle);
        profileRadius = radius * Math.sin(angle);
        normalYComponent = -radius * Math.cos(angle);
        currentArcLength = segmentProgress * capArcLength;
      } else if (iy <= capSegments + heightSegments) {
        const segmentProgress = (iy - capSegments) / heightSegments;
        profileY = -halfHeight + segmentProgress * height;
        profileRadius = radius;
        normalYComponent = 0;
        currentArcLength = capArcLength + segmentProgress * cylinderPartLength;
      } else {
        const segmentProgress = (iy - capSegments - heightSegments) / capSegments;
        const angle = segmentProgress * Math.PI / 2;
        profileY = halfHeight + radius * Math.sin(angle);
        profileRadius = radius * Math.cos(angle);
        normalYComponent = radius * Math.sin(angle);
        currentArcLength = capArcLength + cylinderPartLength + segmentProgress * capArcLength;
      }
      const v = Math.max(0, Math.min(1, currentArcLength / totalArcLength));
      let uOffset = 0;
      if (iy === 0) {
        uOffset = 0.5 / radialSegments;
      } else if (iy === numVerticalSegments) {
        uOffset = -0.5 / radialSegments;
      }
      for (let ix = 0; ix <= radialSegments; ix++) {
        const u = ix / radialSegments;
        const theta = u * Math.PI * 2;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        const x = -profileRadius * cosTheta;
        const z = profileRadius * sinTheta;
        vertices[vOff] = x;
        vertices[vOff + 1] = profileY;
        vertices[vOff + 2] = z;
        const inv = 1 / (Math.sqrt(x * x + normalYComponent * normalYComponent + z * z) || 1);
        normals[vOff] = x * inv;
        normals[vOff + 1] = normalYComponent * inv;
        normals[vOff + 2] = z * inv;
        vOff += 3;
        uvs[uvOff++] = u + uOffset;
        uvs[uvOff++] = v;
      }
      if (iy > 0) {
        const prevIndexRow = (iy - 1) * verticesPerRow;
        const indexRow = iy * verticesPerRow;
        for (let ix = 0; ix < radialSegments; ix++) {
          const i1 = prevIndexRow + ix;
          const i2 = prevIndexRow + ix + 1;
          const i3 = indexRow + ix;
          const i4 = indexRow + ix + 1;
          indices[iOff++] = i1;
          indices[iOff++] = i2;
          indices[iOff++] = i3;
          indices[iOff++] = i2;
          indices[iOff++] = i4;
          indices[iOff++] = i3;
        }
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _CapsuleGeometry(data.radius, data.height, data.capSegments, data.radialSegments, data.heightSegments);
  }
};

// src/geometries/CircleGeometry.js
var CircleGeometry = class _CircleGeometry extends BufferGeometry {
  constructor(radius = 1, segments = 32, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = "CircleGeometry";
    this.parameters = {
      radius,
      segments,
      thetaStart,
      thetaLength
    };
    segments = Math.max(3, segments);
    const vertexCount = 1 + countInclusive(segments);
    const indices = allocIndex(countExclusive(segments) * 3, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    normals[2] = 1;
    uvs[0] = 0.5;
    uvs[1] = 0.5;
    let vOff = 3, uvOff = 2, iOff = 0;
    for (let s = 0; s <= segments; s++) {
      const segment = thetaStart + s / segments * thetaLength;
      const x = radius * Math.cos(segment);
      const y = radius * Math.sin(segment);
      vertices[vOff] = x;
      vertices[vOff + 1] = y;
      normals[vOff + 2] = 1;
      vOff += 3;
      uvs[uvOff++] = (x / radius + 1) / 2;
      uvs[uvOff++] = (y / radius + 1) / 2;
    }
    for (let i = 1; i <= segments; i++) {
      indices[iOff++] = i;
      indices[iOff++] = i + 1;
      indices[iOff++] = 0;
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _CircleGeometry(data.radius, data.segments, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/CylinderGeometry.js
var CylinderGeometry = class _CylinderGeometry extends BufferGeometry {
  constructor(radiusTop = 1, radiusBottom = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = "CylinderGeometry";
    this.parameters = {
      radiusTop,
      radiusBottom,
      height,
      radialSegments,
      heightSegments,
      openEnded,
      thetaStart,
      thetaLength
    };
    const scope = this;
    radialSegments = Math.floor(radialSegments);
    heightSegments = Math.floor(heightSegments);
    const rowLength = radialSegments + 1;
    const hasTopCap = openEnded === false && radiusTop > 0;
    const hasBottomCap = openEnded === false && radiusBottom > 0;
    const capVertexCount = radialSegments + rowLength;
    const vertexCount = (heightSegments + 1) * rowLength + (hasTopCap ? capVertexCount : 0) + (hasBottomCap ? capVertexCount : 0);
    const torsoIndexCount = radialSegments * heightSegments * 6 - (radiusTop > 0 ? 0 : radialSegments * 3) - (radiusBottom > 0 ? 0 : radialSegments * 3);
    const indexCount = torsoIndexCount + (hasTopCap ? radialSegments * 3 : 0) + (hasBottomCap ? radialSegments * 3 : 0);
    const indices = allocIndex(indexCount, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let index = 0;
    let vOff = 0, uvOff = 0, iOff = 0;
    const halfHeight = height / 2;
    let groupStart = 0;
    generateTorso();
    if (hasTopCap) generateCap(true);
    if (hasBottomCap) generateCap(false);
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
    function generateTorso() {
      let groupCount = 0;
      const slope = (radiusBottom - radiusTop) / height;
      for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const radius = v * (radiusBottom - radiusTop) + radiusTop;
        const vy = -v * height + halfHeight;
        for (let x = 0; x <= radialSegments; x++) {
          const u = x / radialSegments;
          const theta = u * thetaLength + thetaStart;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          vertices[vOff] = radius * sinTheta;
          vertices[vOff + 1] = vy;
          vertices[vOff + 2] = radius * cosTheta;
          const inv = 1 / (Math.sqrt(sinTheta * sinTheta + slope * slope + cosTheta * cosTheta) || 1);
          normals[vOff] = sinTheta * inv;
          normals[vOff + 1] = slope * inv;
          normals[vOff + 2] = cosTheta * inv;
          vOff += 3;
          uvs[uvOff++] = u;
          uvs[uvOff++] = 1 - v;
          index++;
        }
      }
      for (let x = 0; x < radialSegments; x++) {
        for (let y = 0; y < heightSegments; y++) {
          const a = y * rowLength + x;
          const b = a + rowLength;
          const c = b + 1;
          const d = a + 1;
          if (radiusTop > 0 || y !== 0) {
            indices[iOff++] = a;
            indices[iOff++] = b;
            indices[iOff++] = d;
            groupCount += 3;
          }
          if (radiusBottom > 0 || y !== heightSegments - 1) {
            indices[iOff++] = b;
            indices[iOff++] = c;
            indices[iOff++] = d;
            groupCount += 3;
          }
        }
      }
      scope.addGroup(groupStart, groupCount, 0);
      groupStart += groupCount;
    }
    function generateCap(top) {
      const centerIndexStart = index;
      const radius = top === true ? radiusTop : radiusBottom;
      const sign = top === true ? 1 : -1;
      const cy = halfHeight * sign;
      for (let x = 1; x <= radialSegments; x++) {
        vertices[vOff + 1] = cy;
        normals[vOff + 1] = sign;
        vOff += 3;
        uvs[uvOff++] = 0.5;
        uvs[uvOff++] = 0.5;
        index++;
      }
      const centerIndexEnd = index;
      for (let x = 0; x <= radialSegments; x++) {
        const u = x / radialSegments;
        const theta = u * thetaLength + thetaStart;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        vertices[vOff] = radius * sinTheta;
        vertices[vOff + 1] = cy;
        vertices[vOff + 2] = radius * cosTheta;
        normals[vOff + 1] = sign;
        vOff += 3;
        uvs[uvOff++] = cosTheta * 0.5 + 0.5;
        uvs[uvOff++] = sinTheta * 0.5 * sign + 0.5;
        index++;
      }
      for (let x = 0; x < radialSegments; x++) {
        const c = centerIndexStart + x;
        const i = centerIndexEnd + x;
        if (top === true) {
          indices[iOff++] = i;
          indices[iOff++] = i + 1;
          indices[iOff++] = c;
        } else {
          indices[iOff++] = i + 1;
          indices[iOff++] = i;
          indices[iOff++] = c;
        }
      }
      const groupCount = radialSegments * 3;
      scope.addGroup(groupStart, groupCount, top === true ? 1 : 2);
      groupStart += groupCount;
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _CylinderGeometry(data.radiusTop, data.radiusBottom, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/ConeGeometry.js
var ConeGeometry = class _ConeGeometry extends CylinderGeometry {
  constructor(radius = 1, height = 1, radialSegments = 32, heightSegments = 1, openEnded = false, thetaStart = 0, thetaLength = Math.PI * 2) {
    super(0, radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength);
    this.type = "ConeGeometry";
    this.parameters = {
      radius,
      height,
      radialSegments,
      heightSegments,
      openEnded,
      thetaStart,
      thetaLength
    };
  }
  static fromJSON(data) {
    return new _ConeGeometry(data.radius, data.height, data.radialSegments, data.heightSegments, data.openEnded, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/PolyhedronGeometry.js
var PolyhedronGeometry = class _PolyhedronGeometry extends BufferGeometry {
  constructor(vertices = [], indices = [], radius = 1, detail = 0) {
    super();
    this.type = "PolyhedronGeometry";
    this.parameters = {
      vertices,
      indices,
      radius,
      detail
    };
    const cols = detail + 1;
    const faceCount = Math.floor(indices.length / 3);
    const vertexCount = faceCount * cols * cols * 3;
    const vertexBuffer = new Float64Array(vertexCount * 3);
    const uvBuffer = new Float64Array(vertexCount * 2);
    let vOff = 0;
    subdivide(detail);
    applyRadius(radius);
    generateUVs();
    this.setAttribute("position", new BufferAttribute(new Float32Array(vertexBuffer), 3));
    this.setAttribute("normal", new BufferAttribute(new Float32Array(vertexBuffer), 3));
    this.setAttribute("uv", new BufferAttribute(new Float32Array(uvBuffer), 2));
    if (detail === 0) {
      this.computeVertexNormals();
    } else {
      this.normalizeNormals();
    }
    function subdivide(detail2) {
      for (let i = 0; i < indices.length; i += 3) {
        subdivideFace(indices[i + 0] * 3, indices[i + 1] * 3, indices[i + 2] * 3, detail2);
      }
    }
    function subdivideFace(ia, ib, ic, detail2) {
      const cols2 = detail2 + 1;
      const ax = vertices[ia], ay = vertices[ia + 1], az = vertices[ia + 2];
      const bx = vertices[ib], by = vertices[ib + 1], bz = vertices[ib + 2];
      const cx = vertices[ic], cy = vertices[ic + 1], cz = vertices[ic + 2];
      const v = [];
      for (let i = 0; i <= cols2; i++) {
        const t = i / cols2;
        const ajx = ax + (cx - ax) * t, ajy = ay + (cy - ay) * t, ajz = az + (cz - az) * t;
        const bjx = bx + (cx - bx) * t, bjy = by + (cy - by) * t, bjz = bz + (cz - bz) * t;
        const rows = cols2 - i;
        const row = new Float64Array((rows + 1) * 3);
        for (let j = 0, o = 0; j <= rows; j++, o += 3) {
          if (j === 0 && i === cols2) {
            row[o] = ajx;
            row[o + 1] = ajy;
            row[o + 2] = ajz;
          } else {
            const s = j / rows;
            row[o] = ajx + (bjx - ajx) * s;
            row[o + 1] = ajy + (bjy - ajy) * s;
            row[o + 2] = ajz + (bjz - ajz) * s;
          }
        }
        v[i] = row;
      }
      for (let i = 0; i < cols2; i++) {
        const vi = v[i], vi1 = v[i + 1];
        for (let j = 0; j < 2 * (cols2 - i) - 1; j++) {
          const k = Math.floor(j / 2);
          if (j % 2 === 0) {
            pushVertex(vi, k + 1);
            pushVertex(vi1, k);
            pushVertex(vi, k);
          } else {
            pushVertex(vi, k + 1);
            pushVertex(vi1, k + 1);
            pushVertex(vi1, k);
          }
        }
      }
    }
    function applyRadius(radius2) {
      for (let i = 0; i < vertexBuffer.length; i += 3) {
        const x = vertexBuffer[i + 0];
        const y = vertexBuffer[i + 1];
        const z = vertexBuffer[i + 2];
        const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
        vertexBuffer[i + 0] = x * inv * radius2;
        vertexBuffer[i + 1] = y * inv * radius2;
        vertexBuffer[i + 2] = z * inv * radius2;
      }
    }
    function generateUVs() {
      for (let i = 0, j = 0; i < vertexBuffer.length; i += 3, j += 2) {
        const x = vertexBuffer[i + 0];
        const y = vertexBuffer[i + 1];
        const z = vertexBuffer[i + 2];
        const u = azimuth(x, z) / 2 / Math.PI + 0.5;
        const v = inclination(x, y, z) / Math.PI + 0.5;
        uvBuffer[j] = u;
        uvBuffer[j + 1] = 1 - v;
      }
      correctUVs();
      correctSeam();
    }
    function correctSeam() {
      for (let i = 0; i < uvBuffer.length; i += 6) {
        const x0 = uvBuffer[i + 0];
        const x1 = uvBuffer[i + 2];
        const x2 = uvBuffer[i + 4];
        const max = Math.max(x0, x1, x2);
        const min = Math.min(x0, x1, x2);
        if (max > 0.9 && min < 0.1) {
          if (x0 < 0.2) uvBuffer[i + 0] += 1;
          if (x1 < 0.2) uvBuffer[i + 2] += 1;
          if (x2 < 0.2) uvBuffer[i + 4] += 1;
        }
      }
    }
    function pushVertex(row, k) {
      const o = k * 3;
      vertexBuffer[vOff++] = row[o];
      vertexBuffer[vOff++] = row[o + 1];
      vertexBuffer[vOff++] = row[o + 2];
    }
    function correctUVs() {
      for (let i = 0, j = 0; i < vertexBuffer.length; i += 9, j += 6) {
        const ax = vertexBuffer[i + 0], ay = vertexBuffer[i + 1], az = vertexBuffer[i + 2];
        const bx = vertexBuffer[i + 3], by = vertexBuffer[i + 4], bz = vertexBuffer[i + 5];
        const cx = vertexBuffer[i + 6], cy = vertexBuffer[i + 7], cz = vertexBuffer[i + 8];
        const third = 1 / 3;
        const centroidX = (ax + bx + cx) * third;
        const centroidZ = (az + bz + cz) * third;
        const azi = azimuth(centroidX, centroidZ);
        correctUV(uvBuffer[j + 0], j + 0, ax, az, azi);
        correctUV(uvBuffer[j + 2], j + 2, bx, bz, azi);
        correctUV(uvBuffer[j + 4], j + 4, cx, cz, azi);
      }
    }
    function correctUV(uvX, stride, vx, vz, azimuth2) {
      if (azimuth2 < 0 && uvX === 1) {
        uvBuffer[stride] = uvX - 1;
      }
      if (vx === 0 && vz === 0) {
        uvBuffer[stride] = azimuth2 / 2 / Math.PI + 0.5;
      }
    }
    function azimuth(x, z) {
      return Math.atan2(z, -x);
    }
    function inclination(x, y, z) {
      return Math.atan2(-y, Math.sqrt(x * x + z * z));
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _PolyhedronGeometry(data.vertices, data.indices, data.radius, data.detail);
  }
};

// src/geometries/DodecahedronGeometry.js
var DodecahedronGeometry = class _DodecahedronGeometry extends PolyhedronGeometry {
  constructor(radius = 1, detail = 0) {
    const t = (1 + Math.sqrt(5)) / 2;
    const r = 1 / t;
    const vertices = [
      // (±1, ±1, ±1)
      -1,
      -1,
      -1,
      -1,
      -1,
      1,
      -1,
      1,
      -1,
      -1,
      1,
      1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      1,
      1,
      -1,
      1,
      1,
      1,
      // (0, ±1/φ, ±φ)
      0,
      -r,
      -t,
      0,
      -r,
      t,
      0,
      r,
      -t,
      0,
      r,
      t,
      // (±1/φ, ±φ, 0)
      -r,
      -t,
      0,
      -r,
      t,
      0,
      r,
      -t,
      0,
      r,
      t,
      0,
      // (±φ, 0, ±1/φ)
      -t,
      0,
      -r,
      t,
      0,
      -r,
      -t,
      0,
      r,
      t,
      0,
      r
    ];
    const indices = [
      3,
      11,
      7,
      3,
      7,
      15,
      3,
      15,
      13,
      7,
      19,
      17,
      7,
      17,
      6,
      7,
      6,
      15,
      17,
      4,
      8,
      17,
      8,
      10,
      17,
      10,
      6,
      8,
      0,
      16,
      8,
      16,
      2,
      8,
      2,
      10,
      0,
      12,
      1,
      0,
      1,
      18,
      0,
      18,
      16,
      6,
      10,
      2,
      6,
      2,
      13,
      6,
      13,
      15,
      2,
      16,
      18,
      2,
      18,
      3,
      2,
      3,
      13,
      18,
      1,
      9,
      18,
      9,
      11,
      18,
      11,
      3,
      4,
      14,
      12,
      4,
      12,
      0,
      4,
      0,
      8,
      11,
      9,
      5,
      11,
      5,
      19,
      11,
      19,
      7,
      19,
      5,
      14,
      19,
      14,
      4,
      19,
      4,
      17,
      1,
      12,
      14,
      1,
      14,
      5,
      1,
      5,
      9
    ];
    super(vertices, indices, radius, detail);
    this.type = "DodecahedronGeometry";
    this.parameters = {
      radius,
      detail
    };
  }
  static fromJSON(data) {
    return new _DodecahedronGeometry(data.radius, data.detail);
  }
};

// src/geometries/EdgesGeometry.js
var _v03 = /* @__PURE__ */ new Vector3();
var _v16 = /* @__PURE__ */ new Vector3();
var _normal2 = /* @__PURE__ */ new Vector3();
var _triangle = /* @__PURE__ */ new Triangle();
var EdgesGeometry = class extends BufferGeometry {
  constructor(geometry = null, thresholdAngle = 1) {
    super();
    this.type = "EdgesGeometry";
    this.parameters = {
      geometry,
      thresholdAngle
    };
    if (geometry !== null) {
      const precisionPoints = 4;
      const precision = Math.pow(10, precisionPoints);
      const thresholdDot = Math.cos(DEG2RAD * thresholdAngle);
      const indexAttr = geometry.getIndex();
      const positionAttr = geometry.getAttribute("position");
      const indexCount = indexAttr ? indexAttr.count : positionAttr.count;
      const indexArr = [0, 0, 0];
      const vertKeys = ["a", "b", "c"];
      const hashes = new Array(3);
      const edgeData = {};
      const vertices = [];
      for (let i = 0; i < indexCount; i += 3) {
        if (indexAttr) {
          indexArr[0] = indexAttr.getX(i);
          indexArr[1] = indexAttr.getX(i + 1);
          indexArr[2] = indexAttr.getX(i + 2);
        } else {
          indexArr[0] = i;
          indexArr[1] = i + 1;
          indexArr[2] = i + 2;
        }
        const { a, b, c } = _triangle;
        a.fromBufferAttribute(positionAttr, indexArr[0]);
        b.fromBufferAttribute(positionAttr, indexArr[1]);
        c.fromBufferAttribute(positionAttr, indexArr[2]);
        _triangle.getNormal(_normal2);
        hashes[0] = `${Math.round(a.x * precision)},${Math.round(a.y * precision)},${Math.round(a.z * precision)}`;
        hashes[1] = `${Math.round(b.x * precision)},${Math.round(b.y * precision)},${Math.round(b.z * precision)}`;
        hashes[2] = `${Math.round(c.x * precision)},${Math.round(c.y * precision)},${Math.round(c.z * precision)}`;
        if (hashes[0] === hashes[1] || hashes[1] === hashes[2] || hashes[2] === hashes[0]) {
          continue;
        }
        for (let j = 0; j < 3; j++) {
          const jNext = (j + 1) % 3;
          const vecHash0 = hashes[j];
          const vecHash1 = hashes[jNext];
          const v0 = _triangle[vertKeys[j]];
          const v1 = _triangle[vertKeys[jNext]];
          const hash = `${vecHash0}_${vecHash1}`;
          const reverseHash = `${vecHash1}_${vecHash0}`;
          if (reverseHash in edgeData && edgeData[reverseHash]) {
            if (_normal2.dot(edgeData[reverseHash].normal) <= thresholdDot) {
              vertices.push(v0.x, v0.y, v0.z);
              vertices.push(v1.x, v1.y, v1.z);
            }
            edgeData[reverseHash] = null;
          } else if (!(hash in edgeData)) {
            edgeData[hash] = {
              index0: indexArr[j],
              index1: indexArr[jNext],
              normal: _normal2.clone()
            };
          }
        }
      }
      for (const key in edgeData) {
        if (edgeData[key]) {
          const { index0, index1 } = edgeData[key];
          _v03.fromBufferAttribute(positionAttr, index0);
          _v16.fromBufferAttribute(positionAttr, index1);
          vertices.push(_v03.x, _v03.y, _v03.z);
          vertices.push(_v16.x, _v16.y, _v16.z);
        }
      }
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
};

// src/geometries/IcosahedronGeometry.js
var IcosahedronGeometry = class _IcosahedronGeometry extends PolyhedronGeometry {
  constructor(radius = 1, detail = 0) {
    const t = (1 + Math.sqrt(5)) / 2;
    const vertices = [
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      0,
      0,
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      t,
      0,
      -1,
      t,
      0,
      1,
      -t,
      0,
      -1,
      -t,
      0,
      1
    ];
    const indices = [
      0,
      11,
      5,
      0,
      5,
      1,
      0,
      1,
      7,
      0,
      7,
      10,
      0,
      10,
      11,
      1,
      5,
      9,
      5,
      11,
      4,
      11,
      10,
      2,
      10,
      7,
      6,
      7,
      1,
      8,
      3,
      9,
      4,
      3,
      4,
      2,
      3,
      2,
      6,
      3,
      6,
      8,
      3,
      8,
      9,
      4,
      9,
      5,
      2,
      4,
      11,
      6,
      2,
      10,
      8,
      6,
      7,
      9,
      8,
      1
    ];
    super(vertices, indices, radius, detail);
    this.type = "IcosahedronGeometry";
    this.parameters = {
      radius,
      detail
    };
  }
  static fromJSON(data) {
    return new _IcosahedronGeometry(data.radius, data.detail);
  }
};

// src/geometries/LatheGeometry.js
var LatheGeometry = class _LatheGeometry extends BufferGeometry {
  constructor(points = [new Vector2(0, -0.5), new Vector2(0.5, 0), new Vector2(0, 0.5)], segments = 12, phiStart = 0, phiLength = Math.PI * 2) {
    super();
    this.type = "LatheGeometry";
    this.parameters = {
      points,
      segments,
      phiStart,
      phiLength
    };
    segments = Math.floor(segments);
    phiLength = clamp(phiLength, 0, Math.PI * 2);
    const pointCount = points.length;
    const vertexCount = (segments + 1) * pointCount;
    const indices = allocIndex(segments * (pointCount - 1) * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const initNormals = new Float64Array(pointCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const inverseSegments = 1 / segments;
    let dx = 0;
    let dy = 0;
    let prevX = 0, prevY = 0, prevZ = 0;
    const last = pointCount - 1;
    for (let j = 0; j <= last; j++) {
      if (j === 0) {
        dx = points[j + 1].x - points[j].x;
        dy = points[j + 1].y - points[j].y;
        const nx = dy * 1, ny = -dx, nz = dy * 0;
        prevX = nx;
        prevY = ny;
        prevZ = nz;
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        initNormals[0] = nx * inv;
        initNormals[1] = ny * inv;
        initNormals[2] = nz * inv;
      } else if (j === last) {
        initNormals[3 * j] = prevX;
        initNormals[3 * j + 1] = prevY;
        initNormals[3 * j + 2] = prevZ;
      } else {
        dx = points[j + 1].x - points[j].x;
        dy = points[j + 1].y - points[j].y;
        const curX = dy * 1, curY = -dx, curZ = dy * 0;
        let nx = curX, ny = curY, nz = curZ;
        nx += prevX;
        ny += prevY;
        nz += prevZ;
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        initNormals[3 * j] = nx * inv;
        initNormals[3 * j + 1] = ny * inv;
        initNormals[3 * j + 2] = nz * inv;
        prevX = curX;
        prevY = curY;
        prevZ = curZ;
      }
    }
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let i = 0; i <= segments; i++) {
      const phi = phiStart + i * inverseSegments * phiLength;
      const sin = Math.sin(phi);
      const cos = Math.cos(phi);
      const uvX = i / segments;
      for (let j = 0; j <= last; j++) {
        const point = points[j];
        vertices[vOff] = point.x * sin;
        vertices[vOff + 1] = point.y;
        vertices[vOff + 2] = point.x * cos;
        uvs[uvOff++] = uvX;
        uvs[uvOff++] = j / last;
        const n0 = initNormals[3 * j + 0];
        normals[vOff] = n0 * sin;
        normals[vOff + 1] = initNormals[3 * j + 1];
        normals[vOff + 2] = n0 * cos;
        vOff += 3;
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < last; j++) {
        const base = j + i * pointCount;
        const a = base;
        const b = base + pointCount;
        const c = base + pointCount + 1;
        const d = base + 1;
        indices[iOff++] = a;
        indices[iOff++] = b;
        indices[iOff++] = d;
        indices[iOff++] = c;
        indices[iOff++] = d;
        indices[iOff++] = b;
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _LatheGeometry(data.points, data.segments, data.phiStart, data.phiLength);
  }
};

// src/geometries/OctahedronGeometry.js
var OctahedronGeometry = class _OctahedronGeometry extends PolyhedronGeometry {
  constructor(radius = 1, detail = 0) {
    const vertices = [
      1,
      0,
      0,
      -1,
      0,
      0,
      0,
      1,
      0,
      0,
      -1,
      0,
      0,
      0,
      1,
      0,
      0,
      -1
    ];
    const indices = [
      0,
      2,
      4,
      0,
      4,
      3,
      0,
      3,
      5,
      0,
      5,
      2,
      1,
      2,
      5,
      1,
      5,
      3,
      1,
      3,
      4,
      1,
      4,
      2
    ];
    super(vertices, indices, radius, detail);
    this.type = "OctahedronGeometry";
    this.parameters = {
      radius,
      detail
    };
  }
  static fromJSON(data) {
    return new _OctahedronGeometry(data.radius, data.detail);
  }
};

// src/geometries/PlaneGeometry.js
var PlaneGeometry = class _PlaneGeometry extends BufferGeometry {
  constructor(width = 1, height = 1, widthSegments = 1, heightSegments = 1) {
    super();
    this.type = "PlaneGeometry";
    this.parameters = {
      width,
      height,
      widthSegments,
      heightSegments
    };
    const width_half = width / 2;
    const height_half = height / 2;
    const gridX = Math.floor(widthSegments);
    const gridY = Math.floor(heightSegments);
    const gridX1 = gridX + 1;
    const gridY1 = gridY + 1;
    const segment_width = width / gridX;
    const segment_height = height / gridY;
    const vertexCount = gridX1 * gridY1;
    const indices = allocIndex(gridX * gridY * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let iy = 0; iy < gridY1; iy++) {
      const y = iy * segment_height - height_half;
      for (let ix = 0; ix < gridX1; ix++) {
        const x = ix * segment_width - width_half;
        vertices[vOff] = x;
        vertices[vOff + 1] = -y;
        normals[vOff + 2] = 1;
        vOff += 3;
        uvs[uvOff++] = ix / gridX;
        uvs[uvOff++] = 1 - iy / gridY;
      }
    }
    for (let iy = 0; iy < gridY; iy++) {
      for (let ix = 0; ix < gridX; ix++) {
        const a = ix + gridX1 * iy;
        const b = ix + gridX1 * (iy + 1);
        const c = ix + 1 + gridX1 * (iy + 1);
        const d = ix + 1 + gridX1 * iy;
        indices[iOff++] = a;
        indices[iOff++] = b;
        indices[iOff++] = d;
        indices[iOff++] = b;
        indices[iOff++] = c;
        indices[iOff++] = d;
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _PlaneGeometry(data.width, data.height, data.widthSegments, data.heightSegments);
  }
};

// src/geometries/RingGeometry.js
var RingGeometry = class _RingGeometry extends BufferGeometry {
  constructor(innerRadius = 0.5, outerRadius = 1, thetaSegments = 32, phiSegments = 1, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = "RingGeometry";
    this.parameters = {
      innerRadius,
      outerRadius,
      thetaSegments,
      phiSegments,
      thetaStart,
      thetaLength
    };
    thetaSegments = Math.max(3, thetaSegments);
    phiSegments = Math.max(1, phiSegments);
    const vertexCount = countInclusive(phiSegments) * countInclusive(thetaSegments);
    const indices = allocIndex(countExclusive(phiSegments) * countExclusive(thetaSegments) * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let radius = innerRadius;
    const radiusStep = (outerRadius - innerRadius) / phiSegments;
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let j = 0; j <= phiSegments; j++) {
      for (let i = 0; i <= thetaSegments; i++) {
        const segment = thetaStart + i / thetaSegments * thetaLength;
        const x = radius * Math.cos(segment);
        const y = radius * Math.sin(segment);
        vertices[vOff] = x;
        vertices[vOff + 1] = y;
        normals[vOff + 2] = 1;
        vOff += 3;
        uvs[uvOff++] = (x / outerRadius + 1) / 2;
        uvs[uvOff++] = (y / outerRadius + 1) / 2;
      }
      radius += radiusStep;
    }
    for (let j = 0; j < phiSegments; j++) {
      const thetaSegmentLevel = j * (thetaSegments + 1);
      for (let i = 0; i < thetaSegments; i++) {
        const segment = i + thetaSegmentLevel;
        const a = segment;
        const b = segment + thetaSegments + 1;
        const c = segment + thetaSegments + 2;
        const d = segment + 1;
        indices[iOff++] = a;
        indices[iOff++] = b;
        indices[iOff++] = d;
        indices[iOff++] = b;
        indices[iOff++] = c;
        indices[iOff++] = d;
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _RingGeometry(data.innerRadius, data.outerRadius, data.thetaSegments, data.phiSegments, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/SphereGeometry.js
var SphereGeometry = class _SphereGeometry extends BufferGeometry {
  constructor(radius = 1, widthSegments = 32, heightSegments = 16, phiStart = 0, phiLength = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI) {
    super();
    this.type = "SphereGeometry";
    this.parameters = {
      radius,
      widthSegments,
      heightSegments,
      phiStart,
      phiLength,
      thetaStart,
      thetaLength
    };
    widthSegments = Math.max(3, Math.floor(widthSegments));
    heightSegments = Math.max(2, Math.floor(heightSegments));
    const thetaEnd = Math.min(thetaStart + thetaLength, Math.PI);
    const rowLength = widthSegments + 1;
    const vertexCount = (heightSegments + 1) * rowLength;
    const topTriangles = thetaStart > 0;
    const bottomTriangles = thetaEnd < Math.PI;
    const indexCount = heightSegments * widthSegments * 6 - (topTriangles ? 0 : widthSegments * 3) - (bottomTriangles ? 0 : widthSegments * 3);
    const indices = allocIndex(indexCount, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let iy = 0; iy <= heightSegments; iy++) {
      const v = iy / heightSegments;
      const theta = thetaStart + v * thetaLength;
      const y = radius * Math.cos(theta);
      const ringRadius = Math.sqrt(radius * radius - y * y);
      let uOffset = 0;
      if (iy === 0 && thetaStart === 0) {
        uOffset = 0.5 / widthSegments;
      } else if (iy === heightSegments && thetaEnd === Math.PI) {
        uOffset = -0.5 / widthSegments;
      }
      for (let ix = 0; ix <= widthSegments; ix++) {
        const u = ix / widthSegments;
        const phi = phiStart + u * phiLength;
        const x = -ringRadius * Math.cos(phi);
        const z = ringRadius * Math.sin(phi);
        vertices[vOff] = x;
        vertices[vOff + 1] = y;
        vertices[vOff + 2] = z;
        const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1);
        normals[vOff] = x * inv;
        normals[vOff + 1] = y * inv;
        normals[vOff + 2] = z * inv;
        vOff += 3;
        uvs[uvOff++] = u + uOffset;
        uvs[uvOff++] = 1 - v;
      }
    }
    for (let iy = 0; iy < heightSegments; iy++) {
      const row = iy * rowLength;
      const nextRow = row + rowLength;
      const upper = iy !== 0 || topTriangles;
      const lower = iy !== heightSegments - 1 || bottomTriangles;
      for (let ix = 0; ix < widthSegments; ix++) {
        const a = row + ix + 1;
        const b = row + ix;
        const c = nextRow + ix;
        const d = nextRow + ix + 1;
        if (upper) {
          indices[iOff++] = a;
          indices[iOff++] = b;
          indices[iOff++] = d;
        }
        if (lower) {
          indices[iOff++] = b;
          indices[iOff++] = c;
          indices[iOff++] = d;
        }
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _SphereGeometry(data.radius, data.widthSegments, data.heightSegments, data.phiStart, data.phiLength, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/TetrahedronGeometry.js
var TetrahedronGeometry = class _TetrahedronGeometry extends PolyhedronGeometry {
  constructor(radius = 1, detail = 0) {
    const vertices = [
      1,
      1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      -1,
      1,
      -1,
      -1
    ];
    const indices = [
      2,
      1,
      0,
      0,
      3,
      2,
      1,
      3,
      0,
      2,
      3,
      1
    ];
    super(vertices, indices, radius, detail);
    this.type = "TetrahedronGeometry";
    this.parameters = {
      radius,
      detail
    };
  }
  static fromJSON(data) {
    return new _TetrahedronGeometry(data.radius, data.detail);
  }
};

// src/geometries/TorusGeometry.js
var TorusGeometry = class _TorusGeometry extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, radialSegments = 12, tubularSegments = 48, arc = Math.PI * 2, thetaStart = 0, thetaLength = Math.PI * 2) {
    super();
    this.type = "TorusGeometry";
    this.parameters = {
      radius,
      tube,
      radialSegments,
      tubularSegments,
      arc,
      thetaStart,
      thetaLength
    };
    radialSegments = Math.floor(radialSegments);
    tubularSegments = Math.floor(tubularSegments);
    const rowLength = tubularSegments + 1;
    const vertexCount = (radialSegments + 1) * rowLength;
    const indices = allocIndex(radialSegments * tubularSegments * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let j = 0; j <= radialSegments; j++) {
      const v = thetaStart + j / radialSegments * thetaLength;
      const cosV = Math.cos(v);
      const z = tube * Math.sin(v);
      const uvY = j / radialSegments;
      for (let i = 0; i <= tubularSegments; i++) {
        const u = i / tubularSegments * arc;
        const cosU = Math.cos(u);
        const sinU = Math.sin(u);
        const x = (radius + tube * cosV) * cosU;
        const y = (radius + tube * cosV) * sinU;
        vertices[vOff] = x;
        vertices[vOff + 1] = y;
        vertices[vOff + 2] = z;
        const nx = x - radius * cosU;
        const ny = y - radius * sinU;
        const nz = z - 0;
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        normals[vOff] = nx * inv;
        normals[vOff + 1] = ny * inv;
        normals[vOff + 2] = nz * inv;
        vOff += 3;
        uvs[uvOff++] = i / tubularSegments;
        uvs[uvOff++] = uvY;
      }
    }
    for (let j = 1; j <= radialSegments; j++) {
      for (let i = 1; i <= tubularSegments; i++) {
        const a = rowLength * j + i - 1;
        const b = rowLength * (j - 1) + i - 1;
        const c = rowLength * (j - 1) + i;
        const d = rowLength * j + i;
        indices[iOff++] = a;
        indices[iOff++] = b;
        indices[iOff++] = d;
        indices[iOff++] = b;
        indices[iOff++] = c;
        indices[iOff++] = d;
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _TorusGeometry(data.radius, data.tube, data.radialSegments, data.tubularSegments, data.arc, data.thetaStart, data.thetaLength);
  }
};

// src/geometries/TorusKnotGeometry.js
var TorusKnotGeometry = class _TorusKnotGeometry extends BufferGeometry {
  constructor(radius = 1, tube = 0.4, tubularSegments = 64, radialSegments = 8, p = 2, q = 3) {
    super();
    this.type = "TorusKnotGeometry";
    this.parameters = {
      radius,
      tube,
      tubularSegments,
      radialSegments,
      p,
      q
    };
    tubularSegments = Math.floor(tubularSegments);
    radialSegments = Math.floor(radialSegments);
    const rowLength = radialSegments + 1;
    const vertexCount = (tubularSegments + 1) * rowLength;
    const indices = allocIndex(tubularSegments * radialSegments * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const P1 = new Vector3();
    const P2 = new Vector3();
    const B = new Vector3();
    const T = new Vector3();
    const N = new Vector3();
    let vOff = 0, uvOff = 0, iOff = 0;
    for (let i = 0; i <= tubularSegments; ++i) {
      const u = i / tubularSegments * p * Math.PI * 2;
      calculatePositionOnCurve(u, p, q, radius, P1);
      calculatePositionOnCurve(u + 0.01, p, q, radius, P2);
      T.subVectors(P2, P1);
      N.addVectors(P2, P1);
      B.crossVectors(T, N);
      N.crossVectors(B, T);
      B.normalize();
      N.normalize();
      const uvX = i / tubularSegments;
      for (let j = 0; j <= radialSegments; ++j) {
        const v = j / radialSegments * Math.PI * 2;
        const cx = -tube * Math.cos(v);
        const cy = tube * Math.sin(v);
        const x = P1.x + (cx * N.x + cy * B.x);
        const y = P1.y + (cx * N.y + cy * B.y);
        const z = P1.z + (cx * N.z + cy * B.z);
        vertices[vOff] = x;
        vertices[vOff + 1] = y;
        vertices[vOff + 2] = z;
        const nx = x - P1.x, ny = y - P1.y, nz = z - P1.z;
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        normals[vOff] = nx * inv;
        normals[vOff + 1] = ny * inv;
        normals[vOff + 2] = nz * inv;
        vOff += 3;
        uvs[uvOff++] = uvX;
        uvs[uvOff++] = j / radialSegments;
      }
    }
    for (let j = 1; j <= tubularSegments; j++) {
      for (let i = 1; i <= radialSegments; i++) {
        const a = rowLength * (j - 1) + (i - 1);
        const b = rowLength * j + (i - 1);
        const c = rowLength * j + i;
        const d = rowLength * (j - 1) + i;
        indices[iOff++] = a;
        indices[iOff++] = b;
        indices[iOff++] = d;
        indices[iOff++] = b;
        indices[iOff++] = c;
        indices[iOff++] = d;
      }
    }
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
    function calculatePositionOnCurve(u, p2, q2, radius2, position) {
      const cu = Math.cos(u);
      const su = Math.sin(u);
      const quOverP = q2 / p2 * u;
      const cs = Math.cos(quOverP);
      position.x = radius2 * (2 + cs) * 0.5 * cu;
      position.y = radius2 * (2 + cs) * su * 0.5;
      position.z = radius2 * Math.sin(quOverP) * 0.5;
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  static fromJSON(data) {
    return new _TorusKnotGeometry(data.radius, data.tube, data.tubularSegments, data.radialSegments, data.p, data.q);
  }
};

// src/extras/curves/Curves.js
var Curves_exports = {};
__export(Curves_exports, {
  CatmullRomCurve3: () => CatmullRomCurve3,
  LineCurve3: () => LineCurve3,
  QuadraticBezierCurve3: () => QuadraticBezierCurve3
});

// src/extras/core/Curve.js
function rotateAroundAxis(v, axis, angle) {
  const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  const x = axis.x, y = axis.y, z = axis.z, tx = t * x, ty = t * y;
  const vx = v.x, vy = v.y, vz = v.z;
  v.x = (tx * x + c) * vx + (tx * y - s * z) * vy + (tx * z + s * y) * vz;
  v.y = (tx * y + s * z) * vx + (ty * y + c) * vy + (ty * z - s * x) * vz;
  v.z = (tx * z - s * y) * vx + (ty * z + s * x) * vy + (t * z * z + c) * vz;
  return v;
}
var Curve = class {
  constructor() {
    this.type = "Curve";
    this.arcLengthDivisions = 200;
    this.needsUpdate = false;
    this.cacheArcLengths = null;
  }
  getPoint() {
    console.warn("Curve: .getPoint() not implemented.");
  }
  getPointAt(u, optionalTarget) {
    const t = this.getUtoTmapping(u);
    return this.getPoint(t, optionalTarget);
  }
  getPoints(divisions = 5) {
    const points = [];
    for (let d = 0; d <= divisions; d++) points.push(this.getPoint(d / divisions));
    return points;
  }
  // Get sequence of points using getPointAt( u )
  getSpacedPoints(divisions = 5) {
    const points = [];
    for (let d = 0; d <= divisions; d++) points.push(this.getPointAt(d / divisions));
    return points;
  }
  getLength() {
    const lengths = this.getLengths();
    return lengths[lengths.length - 1];
  }
  getLengths(divisions = this.arcLengthDivisions) {
    if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate) {
      return this.cacheArcLengths;
    }
    this.needsUpdate = false;
    const cache = [];
    let current, last = this.getPoint(0);
    let sum = 0;
    cache.push(0);
    for (let p = 1; p <= divisions; p++) {
      current = this.getPoint(p / divisions);
      sum += current.distanceTo(last);
      cache.push(sum);
      last = current;
    }
    this.cacheArcLengths = cache;
    return cache;
  }
  updateArcLengths() {
    this.needsUpdate = true;
    this.getLengths();
  }
  getUtoTmapping(u, distance = null) {
    const arcLengths = this.getLengths();
    let i = 0;
    const il = arcLengths.length;
    let targetArcLength;
    if (distance) {
      targetArcLength = distance;
    } else {
      targetArcLength = u * arcLengths[il - 1];
    }
    let low = 0, high = il - 1, comparison;
    while (low <= high) {
      i = Math.floor(low + (high - low) / 2);
      comparison = arcLengths[i] - targetArcLength;
      if (comparison < 0) {
        low = i + 1;
      } else if (comparison > 0) {
        high = i - 1;
      } else {
        high = i;
        break;
      }
    }
    i = high;
    if (arcLengths[i] === targetArcLength) {
      return i / (il - 1);
    }
    const lengthBefore = arcLengths[i];
    const lengthAfter = arcLengths[i + 1];
    const segmentLength = lengthAfter - lengthBefore;
    const segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
    const t = (i + segmentFraction) / (il - 1);
    return t;
  }
  getTangent(t, optionalTarget) {
    const delta = 1e-4;
    let t1 = t - delta;
    let t2 = t + delta;
    if (t1 < 0) t1 = 0;
    if (t2 > 1) t2 = 1;
    const pt1 = this.getPoint(t1);
    const pt2 = this.getPoint(t2);
    const tangent = optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());
    tangent.copy(pt2).sub(pt1).normalize();
    return tangent;
  }
  getTangentAt(u, optionalTarget) {
    const t = this.getUtoTmapping(u);
    return this.getTangent(t, optionalTarget);
  }
  computeFrenetFrames(segments, closed = false) {
    const normal = new Vector3();
    const tangents = [];
    const normals = [];
    const binormals = [];
    const vec = new Vector3();
    for (let i = 0; i <= segments; i++) {
      const u = i / segments;
      tangents[i] = this.getTangentAt(u, new Vector3());
    }
    normals[0] = new Vector3();
    binormals[0] = new Vector3();
    let min = Number.MAX_VALUE;
    const tx = Math.abs(tangents[0].x);
    const ty = Math.abs(tangents[0].y);
    const tz = Math.abs(tangents[0].z);
    if (tx <= min) {
      min = tx;
      normal.set(1, 0, 0);
    }
    if (ty <= min) {
      min = ty;
      normal.set(0, 1, 0);
    }
    if (tz <= min) {
      normal.set(0, 0, 1);
    }
    vec.crossVectors(tangents[0], normal).normalize();
    normals[0].crossVectors(tangents[0], vec);
    binormals[0].crossVectors(tangents[0], normals[0]);
    for (let i = 1; i <= segments; i++) {
      normals[i] = normals[i - 1].clone();
      binormals[i] = binormals[i - 1].clone();
      vec.crossVectors(tangents[i - 1], tangents[i]);
      if (vec.length() > Number.EPSILON) {
        vec.normalize();
        const theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
        rotateAroundAxis(normals[i], vec, theta);
      }
      binormals[i].crossVectors(tangents[i], normals[i]);
    }
    if (closed === true) {
      let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
      theta /= segments;
      if (tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0) {
        theta = -theta;
      }
      for (let i = 1; i <= segments; i++) {
        rotateAroundAxis(normals[i], tangents[i], theta * i);
        binormals[i].crossVectors(tangents[i], normals[i]);
      }
    }
    return {
      tangents,
      normals,
      binormals
    };
  }
  clone() {
    return new this.constructor().copy(this);
  }
  copy(source) {
    this.arcLengthDivisions = source.arcLengthDivisions;
    return this;
  }
  toJSON() {
    const data = {
      metadata: {
        version: 4.7,
        type: "Curve",
        generator: "Curve.toJSON"
      }
    };
    data.arcLengthDivisions = this.arcLengthDivisions;
    data.type = this.type;
    return data;
  }
  fromJSON(json) {
    this.arcLengthDivisions = json.arcLengthDivisions;
    return this;
  }
};

// src/extras/curves/CatmullRomCurve3.js
function CubicPoly() {
  let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
  function init(x0, x1, t0, t1) {
    c0 = x0;
    c1 = t0;
    c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1;
    c3 = 2 * x0 - 2 * x1 + t0 + t1;
  }
  return {
    initCatmullRom: function(x0, x1, x2, x3, tension) {
      init(x1, x2, tension * (x2 - x0), tension * (x3 - x1));
    },
    initNonuniformCatmullRom: function(x0, x1, x2, x3, dt0, dt1, dt2) {
      let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
      let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
      t1 *= dt1;
      t2 *= dt1;
      init(x1, x2, t1, t2);
    },
    calc: function(t) {
      const t2 = t * t;
      const t3 = t2 * t;
      return c0 + c1 * t + c2 * t2 + c3 * t3;
    }
  };
}
var tmp = /* @__PURE__ */ new Vector3();
var tmp2 = /* @__PURE__ */ new Vector3();
var px = /* @__PURE__ */ new CubicPoly();
var py = /* @__PURE__ */ new CubicPoly();
var pz = /* @__PURE__ */ new CubicPoly();
var CatmullRomCurve3 = class extends Curve {
  constructor(points = [], closed = false, curveType = "centripetal", tension = 0.5) {
    super();
    this.isCatmullRomCurve3 = true;
    this.type = "CatmullRomCurve3";
    this.points = points;
    this.closed = closed;
    this.curveType = curveType;
    this.tension = tension;
  }
  getPoint(t, optionalTarget = new Vector3()) {
    const point = optionalTarget;
    const points = this.points;
    const l = points.length;
    const p = (l - (this.closed ? 0 : 1)) * t;
    let intPoint = Math.floor(p);
    let weight = p - intPoint;
    if (this.closed) {
      intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l;
    } else if (weight === 0 && intPoint === l - 1) {
      intPoint = l - 2;
      weight = 1;
    }
    let p0, p3;
    if (this.closed || intPoint > 0) {
      p0 = points[(intPoint - 1) % l];
    } else {
      tmp2.subVectors(points[0], points[1]).add(points[0]);
      p0 = tmp2;
    }
    const p1 = points[intPoint % l];
    const p2 = points[(intPoint + 1) % l];
    if (this.closed || intPoint + 2 < l) {
      p3 = points[(intPoint + 2) % l];
    } else {
      tmp.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]);
      p3 = tmp;
    }
    if (this.curveType === "centripetal" || this.curveType === "chordal") {
      const pow = this.curveType === "chordal" ? 0.5 : 0.25;
      let dt0 = Math.pow(p0.distanceToSquared(p1), pow);
      let dt1 = Math.pow(p1.distanceToSquared(p2), pow);
      let dt2 = Math.pow(p2.distanceToSquared(p3), pow);
      if (dt1 < 1e-4) dt1 = 1;
      if (dt0 < 1e-4) dt0 = dt1;
      if (dt2 < 1e-4) dt2 = dt1;
      px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
      py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
      pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
    } else if (this.curveType === "catmullrom") {
      px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, this.tension);
      py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, this.tension);
      pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, this.tension);
    }
    point.set(px.calc(weight), py.calc(weight), pz.calc(weight));
    return point;
  }
  copy(source) {
    super.copy(source);
    this.points = [];
    for (let i = 0, l = source.points.length; i < l; i++) this.points.push(source.points[i].clone());
    this.closed = source.closed;
    this.curveType = source.curveType;
    this.tension = source.tension;
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.points = [];
    for (let i = 0, l = this.points.length; i < l; i++) data.points.push(this.points[i].toArray());
    data.closed = this.closed;
    data.curveType = this.curveType;
    data.tension = this.tension;
    return data;
  }
  fromJSON(json) {
    super.fromJSON(json);
    this.points = [];
    for (let i = 0, l = json.points.length; i < l; i++) this.points.push(new Vector3().fromArray(json.points[i]));
    this.closed = json.closed;
    this.curveType = json.curveType;
    this.tension = json.tension;
    return this;
  }
};

// src/extras/curves/LineCurve3.js
var LineCurve3 = class extends Curve {
  constructor(v1 = new Vector3(), v2 = new Vector3()) {
    super();
    this.isLineCurve3 = true;
    this.type = "LineCurve3";
    this.v1 = v1;
    this.v2 = v2;
  }
  getPoint(t, optionalTarget = new Vector3()) {
    const point = optionalTarget;
    if (t === 1) {
      point.copy(this.v2);
    } else {
      point.copy(this.v2).sub(this.v1);
      point.multiplyScalar(t).add(this.v1);
    }
    return point;
  }
  // Line curve is linear, so we can overwrite default getPointAt
  getPointAt(u, optionalTarget) {
    return this.getPoint(u, optionalTarget);
  }
  getTangent(t, optionalTarget = new Vector3()) {
    return optionalTarget.subVectors(this.v2, this.v1).normalize();
  }
  getTangentAt(u, optionalTarget) {
    return this.getTangent(u, optionalTarget);
  }
  copy(source) {
    super.copy(source);
    this.v1.copy(source.v1);
    this.v2.copy(source.v2);
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.v1 = this.v1.toArray();
    data.v2 = this.v2.toArray();
    return data;
  }
  fromJSON(json) {
    super.fromJSON(json);
    this.v1.fromArray(json.v1);
    this.v2.fromArray(json.v2);
    return this;
  }
};

// src/extras/core/Interpolations.js
function QuadraticBezierP0(t, p) {
  const k = 1 - t;
  return k * k * p;
}
function QuadraticBezierP1(t, p) {
  return 2 * (1 - t) * t * p;
}
function QuadraticBezierP2(t, p) {
  return t * t * p;
}
function QuadraticBezier(t, p0, p1, p2) {
  return QuadraticBezierP0(t, p0) + QuadraticBezierP1(t, p1) + QuadraticBezierP2(t, p2);
}

// src/extras/curves/QuadraticBezierCurve3.js
var QuadraticBezierCurve3 = class extends Curve {
  constructor(v0 = new Vector3(), v1 = new Vector3(), v2 = new Vector3()) {
    super();
    this.isQuadraticBezierCurve3 = true;
    this.type = "QuadraticBezierCurve3";
    this.v0 = v0;
    this.v1 = v1;
    this.v2 = v2;
  }
  getPoint(t, optionalTarget = new Vector3()) {
    const point = optionalTarget;
    const v0 = this.v0, v1 = this.v1, v2 = this.v2;
    point.set(
      QuadraticBezier(t, v0.x, v1.x, v2.x),
      QuadraticBezier(t, v0.y, v1.y, v2.y),
      QuadraticBezier(t, v0.z, v1.z, v2.z)
    );
    return point;
  }
  copy(source) {
    super.copy(source);
    this.v0.copy(source.v0);
    this.v1.copy(source.v1);
    this.v2.copy(source.v2);
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.v0 = this.v0.toArray();
    data.v1 = this.v1.toArray();
    data.v2 = this.v2.toArray();
    return data;
  }
  fromJSON(json) {
    super.fromJSON(json);
    this.v0.fromArray(json.v0);
    this.v1.fromArray(json.v1);
    this.v2.fromArray(json.v2);
    return this;
  }
};

// src/geometries/TubeGeometry.js
var TubeGeometry = class _TubeGeometry extends BufferGeometry {
  constructor(path = new QuadraticBezierCurve3(new Vector3(-1, -1, 0), new Vector3(-1, 1, 0), new Vector3(1, 1, 0)), tubularSegments = 64, radius = 1, radialSegments = 8, closed = false) {
    super();
    this.type = "TubeGeometry";
    this.parameters = {
      path,
      tubularSegments,
      radius,
      radialSegments,
      closed
    };
    const frames = path.computeFrenetFrames(tubularSegments, closed);
    this.tangents = frames.tangents;
    this.normals = frames.normals;
    this.binormals = frames.binormals;
    let P = new Vector3();
    const rowLength = radialSegments + 1;
    const vertexCount = (tubularSegments + 1) * rowLength;
    const indices = allocIndex(tubularSegments * radialSegments * 6, vertexCount);
    const vertices = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    let vOff = 0, uvOff = 0, iOff = 0;
    generateBufferData();
    this.setIndex(indexAttribute(indices));
    this.setAttribute("position", new BufferAttribute(vertices, 3));
    this.setAttribute("normal", new BufferAttribute(normals, 3));
    this.setAttribute("uv", new BufferAttribute(uvs, 2));
    function generateBufferData() {
      for (let i = 0; i < tubularSegments; i++) generateSegment(i);
      generateSegment(closed === false ? tubularSegments : 0);
      generateUVs();
      generateIndices();
    }
    function generateSegment(i) {
      P = path.getPointAt(i / tubularSegments, P);
      const N = frames.normals[i];
      const B = frames.binormals[i];
      for (let j = 0; j <= radialSegments; j++) {
        const v = j / radialSegments * Math.PI * 2;
        const sin = Math.sin(v);
        const cos = -Math.cos(v);
        let nx = cos * N.x + sin * B.x;
        let ny = cos * N.y + sin * B.y;
        let nz = cos * N.z + sin * B.z;
        const inv = 1 / (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1);
        nx *= inv;
        ny *= inv;
        nz *= inv;
        normals[vOff] = nx;
        normals[vOff + 1] = ny;
        normals[vOff + 2] = nz;
        vertices[vOff] = P.x + radius * nx;
        vertices[vOff + 1] = P.y + radius * ny;
        vertices[vOff + 2] = P.z + radius * nz;
        vOff += 3;
      }
    }
    function generateIndices() {
      for (let j = 1; j <= tubularSegments; j++) {
        for (let i = 1; i <= radialSegments; i++) {
          const a = rowLength * (j - 1) + (i - 1);
          const b = rowLength * j + (i - 1);
          const c = rowLength * j + i;
          const d = rowLength * (j - 1) + i;
          indices[iOff++] = a;
          indices[iOff++] = b;
          indices[iOff++] = d;
          indices[iOff++] = b;
          indices[iOff++] = c;
          indices[iOff++] = d;
        }
      }
    }
    function generateUVs() {
      for (let i = 0; i <= tubularSegments; i++) {
        const u = i / tubularSegments;
        for (let j = 0; j <= radialSegments; j++) {
          uvs[uvOff++] = u;
          uvs[uvOff++] = j / radialSegments;
        }
      }
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.path = this.parameters.path.toJSON();
    return data;
  }
  static fromJSON(data) {
    return new _TubeGeometry(
      new Curves_exports[data.path.type]().fromJSON(data.path),
      data.tubularSegments,
      data.radius,
      data.radialSegments,
      data.closed
    );
  }
};

// src/geometries/WireframeGeometry.js
var WireframeGeometry = class extends BufferGeometry {
  constructor(geometry = null) {
    super();
    this.type = "WireframeGeometry";
    this.parameters = {
      geometry
    };
    if (geometry !== null) {
      const vertices = [];
      const edges = /* @__PURE__ */ new Set();
      const start = new Vector3();
      const end = new Vector3();
      if (geometry.index !== null) {
        const position = geometry.attributes.position;
        const indices = geometry.index;
        let groups = geometry.groups;
        if (groups.length === 0) {
          groups = [{ start: 0, count: indices.count, materialIndex: 0 }];
        }
        for (let o = 0, ol = groups.length; o < ol; ++o) {
          const group = groups[o];
          const groupStart = group.start;
          const groupCount = group.count;
          for (let i = groupStart, l = groupStart + groupCount; i < l; i += 3) {
            for (let j = 0; j < 3; j++) {
              const index1 = indices.getX(i + j);
              const index2 = indices.getX(i + (j + 1) % 3);
              start.fromBufferAttribute(position, index1);
              end.fromBufferAttribute(position, index2);
              if (isUniqueEdge(start, end, edges) === true) {
                vertices.push(start.x, start.y, start.z);
                vertices.push(end.x, end.y, end.z);
              }
            }
          }
        }
      } else {
        const position = geometry.attributes.position;
        for (let i = 0, l = position.count / 3; i < l; i++) {
          for (let j = 0; j < 3; j++) {
            const index1 = 3 * i + j;
            const index2 = 3 * i + (j + 1) % 3;
            start.fromBufferAttribute(position, index1);
            end.fromBufferAttribute(position, index2);
            if (isUniqueEdge(start, end, edges) === true) {
              vertices.push(start.x, start.y, start.z);
              vertices.push(end.x, end.y, end.z);
            }
          }
        }
      }
      this.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    }
  }
  copy(source) {
    super.copy(source);
    this.parameters = Object.assign({}, source.parameters);
    return this;
  }
};
function isUniqueEdge(start, end, edges) {
  const hash1 = `${start.x},${start.y},${start.z}-${end.x},${end.y},${end.z}`;
  const hash2 = `${end.x},${end.y},${end.z}-${start.x},${start.y},${start.z}`;
  if (edges.has(hash1) === true || edges.has(hash2) === true) {
    return false;
  } else {
    edges.add(hash1);
    edges.add(hash2);
    return true;
  }
}

// src/materials/ShaderMaterial.js
var default_vertex = `void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`;
var default_fragment = `void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;
var ShaderMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isShaderMaterial = true;
    this.type = "ShaderMaterial";
    this.defines = {};
    this.uniforms = {};
    this.uniformsGroups = [];
    this.vertexShader = default_vertex;
    this.fragmentShader = default_fragment;
    this.linewidth = 1;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.fog = false;
    this.lights = false;
    this.clipping = false;
    this.forceSinglePass = true;
    this.extensions = { clipCullDistance: false, multiDraw: false };
    this.defaultAttributeValues = { "color": [1, 1, 1], "uv": [0, 0], "uv1": [0, 0] };
    this.index0AttributeName = void 0;
    this.uniformsNeedUpdate = false;
    this.glslVersion = null;
    if (parameters !== void 0) this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.fragmentShader = source.fragmentShader;
    this.vertexShader = source.vertexShader;
    this.uniforms = cloneUniforms(source.uniforms);
    this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups);
    this.defines = Object.assign({}, source.defines);
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.fog = source.fog;
    this.lights = source.lights;
    this.clipping = source.clipping;
    this.extensions = Object.assign({}, source.extensions);
    this.glslVersion = source.glslVersion;
    return this;
  }
};

// src/materials/RawShaderMaterial.js
var RawShaderMaterial = class extends ShaderMaterial {
  constructor(parameters) {
    super(parameters);
    this.isRawShaderMaterial = true;
    this.type = "RawShaderMaterial";
  }
};

// src/materials/MeshStandardMaterial.js
var MeshStandardMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshStandardMaterial = true;
    this.type = "MeshStandardMaterial";
    this.defines = { "STANDARD": "" };
    this.color = new Color(16777215);
    this.roughness = 1;
    this.metalness = 0;
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.emissive = new Color(0);
    this.emissiveIntensity = 1;
    this.emissiveMap = null;
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.roughnessMap = null;
    this.metalnessMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.envMapRotation = new Euler();
    this.envMapIntensity = 1;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.flatShading = false;
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.defines = { "STANDARD": "" };
    this.color.copy(source.color);
    this.roughness = source.roughness;
    this.metalness = source.metalness;
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.roughnessMap = source.roughnessMap;
    this.metalnessMap = source.metalnessMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.envMapIntensity = source.envMapIntensity;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    this.fog = source.fog;
    return this;
  }
};

// src/materials/MeshPhysicalMaterial.js
var MeshPhysicalMaterial = class extends MeshStandardMaterial {
  constructor(parameters) {
    super();
    this.isMeshPhysicalMaterial = true;
    this.defines = { "STANDARD": "", "PHYSICAL": "" };
    this.type = "MeshPhysicalMaterial";
    this.anisotropyRotation = 0;
    this.anisotropyMap = null;
    this.clearcoatMap = null;
    this.clearcoatRoughness = 0;
    this.clearcoatRoughnessMap = null;
    this.clearcoatNormalScale = new Vector2(1, 1);
    this.clearcoatNormalMap = null;
    this.ior = 1.5;
    Object.defineProperty(this, "reflectivity", {
      get: function() {
        return clamp(2.5 * (this.ior - 1) / (this.ior + 1), 0, 1);
      },
      set: function(reflectivity) {
        this.ior = (1 + 0.4 * reflectivity) / (1 - 0.4 * reflectivity);
      }
    });
    this.iridescenceMap = null;
    this.iridescenceIOR = 1.3;
    this.iridescenceThicknessRange = [100, 400];
    this.iridescenceThicknessMap = null;
    this.sheenColor = new Color(0);
    this.sheenColorMap = null;
    this.sheenRoughness = 1;
    this.sheenRoughnessMap = null;
    this.transmissionMap = null;
    this.thickness = 0;
    this.thicknessMap = null;
    this.attenuationDistance = Infinity;
    this.attenuationColor = new Color(1, 1, 1);
    this.specularIntensity = 1;
    this.specularIntensityMap = null;
    this.specularColor = new Color(1, 1, 1);
    this.specularColorMap = null;
    this._anisotropy = 0;
    this._clearcoat = 0;
    this._dispersion = 0;
    this._iridescence = 0;
    this._sheen = 0;
    this._transmission = 0;
    this.setValues(parameters);
  }
  get anisotropy() {
    return this._anisotropy;
  }
  set anisotropy(value) {
    if (this._anisotropy > 0 !== value > 0) this.version++;
    this._anisotropy = value;
  }
  get clearcoat() {
    return this._clearcoat;
  }
  set clearcoat(value) {
    if (this._clearcoat > 0 !== value > 0) this.version++;
    this._clearcoat = value;
  }
  get iridescence() {
    return this._iridescence;
  }
  set iridescence(value) {
    if (this._iridescence > 0 !== value > 0) this.version++;
    this._iridescence = value;
  }
  get dispersion() {
    return this._dispersion;
  }
  set dispersion(value) {
    if (this._dispersion > 0 !== value > 0) this.version++;
    this._dispersion = value;
  }
  get sheen() {
    return this._sheen;
  }
  set sheen(value) {
    if (this._sheen > 0 !== value > 0) this.version++;
    this._sheen = value;
  }
  get transmission() {
    return this._transmission;
  }
  set transmission(value) {
    if (this._transmission > 0 !== value > 0) this.version++;
    this._transmission = value;
  }
  copy(source) {
    super.copy(source);
    this.defines = { "STANDARD": "", "PHYSICAL": "" };
    this.anisotropy = source.anisotropy;
    this.anisotropyRotation = source.anisotropyRotation;
    this.anisotropyMap = source.anisotropyMap;
    this.clearcoat = source.clearcoat;
    this.clearcoatMap = source.clearcoatMap;
    this.clearcoatRoughness = source.clearcoatRoughness;
    this.clearcoatRoughnessMap = source.clearcoatRoughnessMap;
    this.clearcoatNormalMap = source.clearcoatNormalMap;
    this.clearcoatNormalScale.copy(source.clearcoatNormalScale);
    this.dispersion = source.dispersion;
    this.ior = source.ior;
    this.iridescence = source.iridescence;
    this.iridescenceMap = source.iridescenceMap;
    this.iridescenceIOR = source.iridescenceIOR;
    this.iridescenceThicknessRange = [...source.iridescenceThicknessRange];
    this.iridescenceThicknessMap = source.iridescenceThicknessMap;
    this.sheen = source.sheen;
    this.sheenColor.copy(source.sheenColor);
    this.sheenColorMap = source.sheenColorMap;
    this.sheenRoughness = source.sheenRoughness;
    this.sheenRoughnessMap = source.sheenRoughnessMap;
    this.transmission = source.transmission;
    this.transmissionMap = source.transmissionMap;
    this.thickness = source.thickness;
    this.thicknessMap = source.thicknessMap;
    this.attenuationDistance = source.attenuationDistance;
    this.attenuationColor.copy(source.attenuationColor);
    this.specularIntensity = source.specularIntensity;
    this.specularIntensityMap = source.specularIntensityMap;
    this.specularColor.copy(source.specularColor);
    this.specularColorMap = source.specularColorMap;
    return this;
  }
};

// src/materials/MeshPhongMaterial.js
var MeshPhongMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshPhongMaterial = true;
    this.type = "MeshPhongMaterial";
    this.color = new Color(16777215);
    this.specular = new Color(1118481);
    this.shininess = 30;
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.emissive = new Color(0);
    this.emissiveIntensity = 1;
    this.emissiveMap = null;
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.specularMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.envMapRotation = new Euler();
    this.combine = MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.flatShading = false;
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.specular.copy(source.specular);
    this.shininess = source.shininess;
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    this.fog = source.fog;
    return this;
  }
};

// src/materials/MeshLambertMaterial.js
var MeshLambertMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshLambertMaterial = true;
    this.type = "MeshLambertMaterial";
    this.color = new Color(16777215);
    this.map = null;
    this.lightMap = null;
    this.lightMapIntensity = 1;
    this.aoMap = null;
    this.aoMapIntensity = 1;
    this.emissive = new Color(0);
    this.emissiveIntensity = 1;
    this.emissiveMap = null;
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.specularMap = null;
    this.alphaMap = null;
    this.envMap = null;
    this.envMapRotation = new Euler();
    this.combine = MultiplyOperation;
    this.reflectivity = 1;
    this.refractionRatio = 0.98;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.wireframeLinecap = "round";
    this.wireframeLinejoin = "round";
    this.flatShading = false;
    this.fog = true;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.color.copy(source.color);
    this.map = source.map;
    this.lightMap = source.lightMap;
    this.lightMapIntensity = source.lightMapIntensity;
    this.aoMap = source.aoMap;
    this.aoMapIntensity = source.aoMapIntensity;
    this.emissive.copy(source.emissive);
    this.emissiveMap = source.emissiveMap;
    this.emissiveIntensity = source.emissiveIntensity;
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.specularMap = source.specularMap;
    this.alphaMap = source.alphaMap;
    this.envMap = source.envMap;
    this.envMapRotation.copy(source.envMapRotation);
    this.combine = source.combine;
    this.reflectivity = source.reflectivity;
    this.refractionRatio = source.refractionRatio;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    this.fog = source.fog;
    return this;
  }
};

// src/materials/MeshNormalMaterial.js
var MeshNormalMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshNormalMaterial = true;
    this.type = "MeshNormalMaterial";
    this.bumpMap = null;
    this.bumpScale = 1;
    this.normalMap = null;
    this.normalMapType = TangentSpaceNormalMap;
    this.normalScale = new Vector2(1, 1);
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.flatShading = false;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.bumpMap = source.bumpMap;
    this.bumpScale = source.bumpScale;
    this.normalMap = source.normalMap;
    this.normalMapType = source.normalMapType;
    this.normalScale.copy(source.normalScale);
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    this.flatShading = source.flatShading;
    return this;
  }
};

// src/materials/packing.js
var BasicDepthPacking = 3200;
var RGBADepthPacking = 3201;
var RGBDepthPacking = 3202;
var RGDepthPacking = 3203;

// src/materials/MeshDepthMaterial.js
var MeshDepthMaterial = class extends Material {
  constructor(parameters) {
    super();
    this.isMeshDepthMaterial = true;
    this.type = "MeshDepthMaterial";
    this.depthPacking = BasicDepthPacking;
    this.map = null;
    this.alphaMap = null;
    this.displacementMap = null;
    this.displacementScale = 1;
    this.displacementBias = 0;
    this.wireframe = false;
    this.wireframeLinewidth = 1;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.depthPacking = source.depthPacking;
    this.map = source.map;
    this.alphaMap = source.alphaMap;
    this.displacementMap = source.displacementMap;
    this.displacementScale = source.displacementScale;
    this.displacementBias = source.displacementBias;
    this.wireframe = source.wireframe;
    this.wireframeLinewidth = source.wireframeLinewidth;
    return this;
  }
};

// src/materials/LineDashedMaterial.js
var LineDashedMaterial = class extends LineBasicMaterial {
  constructor(parameters) {
    super();
    this.isLineDashedMaterial = true;
    this.type = "LineDashedMaterial";
    this.scale = 1;
    this.dashSize = 3;
    this.gapSize = 1;
    this.setValues(parameters);
  }
  copy(source) {
    super.copy(source);
    this.scale = source.scale;
    this.dashSize = source.dashSize;
    this.gapSize = source.gapSize;
    return this;
  }
};

// src/loaders/Cache.js
var Cache = {
  enabled: false,
  files: {},
  add(key, file) {
    if (this.enabled === false) return;
    this.files[key] = file;
  },
  get(key) {
    if (this.enabled === false) return;
    return this.files[key];
  },
  remove(key) {
    delete this.files[key];
  },
  clear() {
    this.files = {};
  }
};

// src/loaders/LoadingManager.js
var LoadingManager = class {
  constructor(onLoad, onProgress, onError) {
    const scope = this;
    let isLoading = false, itemsLoaded = 0, itemsTotal = 0, urlModifier = void 0;
    const handlers = [];
    this.onStart = void 0;
    this.onLoad = onLoad;
    this.onProgress = onProgress;
    this.onError = onError;
    this.itemStart = function(url) {
      itemsTotal++;
      if (isLoading === false && scope.onStart !== void 0) scope.onStart(url, itemsLoaded, itemsTotal);
      isLoading = true;
    };
    this.itemEnd = function(url) {
      itemsLoaded++;
      if (scope.onProgress !== void 0) scope.onProgress(url, itemsLoaded, itemsTotal);
      if (itemsLoaded === itemsTotal) {
        isLoading = false;
        if (scope.onLoad !== void 0) scope.onLoad();
      }
    };
    this.itemError = function(url) {
      if (scope.onError !== void 0) scope.onError(url);
    };
    this.resolveURL = function(url) {
      if (urlModifier) return urlModifier(url);
      return url;
    };
    this.setURLModifier = function(transform) {
      urlModifier = transform;
      return this;
    };
    this.addHandler = function(regex, loader) {
      handlers.push(regex, loader);
      return this;
    };
    this.removeHandler = function(regex) {
      const index = handlers.indexOf(regex);
      if (index !== -1) handlers.splice(index, 2);
      return this;
    };
    this.getHandler = function(file) {
      for (let i = 0, l = handlers.length; i < l; i += 2) {
        const regex = handlers[i], loader = handlers[i + 1];
        if (regex.global) regex.lastIndex = 0;
        if (regex.test(file)) return loader;
      }
      return null;
    };
  }
};
var DefaultLoadingManager = /* @__PURE__ */ new LoadingManager();

// src/loaders/Loader.js
var Loader = class {
  constructor(manager) {
    this.manager = manager !== void 0 ? manager : DefaultLoadingManager;
    this.crossOrigin = "anonymous";
    this.withCredentials = false;
    this.path = "";
    this.resourcePath = "";
    this.requestHeader = {};
  }
  load() {
  }
  loadAsync(url, onProgress) {
    const scope = this;
    return new Promise(function(resolve, reject) {
      scope.load(url, resolve, onProgress, reject);
    });
  }
  parse() {
  }
  setCrossOrigin(crossOrigin) {
    this.crossOrigin = crossOrigin;
    return this;
  }
  setWithCredentials(value) {
    this.withCredentials = value;
    return this;
  }
  setPath(path) {
    this.path = path;
    return this;
  }
  setResourcePath(resourcePath) {
    this.resourcePath = resourcePath;
    return this;
  }
  setRequestHeader(requestHeader) {
    this.requestHeader = requestHeader;
    return this;
  }
};
Loader.DEFAULT_MATERIAL_NAME = "__DEFAULT";

// src/loaders/ImageLoader.js
var ImageLoader = class extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    if (this.path !== void 0) url = this.path + url;
    url = this.manager.resolveURL(url);
    const scope = this;
    const cached = Cache.get(`image:${url}`);
    if (cached !== void 0) {
      scope.manager.itemStart(url);
      setTimeout(function() {
        if (onLoad) onLoad(cached);
        scope.manager.itemEnd(url);
      }, 0);
      return cached;
    }
    const image = document.createElementNS("http://www.w3.org/1999/xhtml", "img");
    function onImageLoad() {
      removeEventListeners();
      Cache.add(`image:${url}`, this);
      if (onLoad) onLoad(this);
      scope.manager.itemEnd(url);
    }
    function onImageError(event) {
      removeEventListeners();
      if (onError) onError(event);
      scope.manager.itemError(url);
      scope.manager.itemEnd(url);
    }
    function removeEventListeners() {
      image.removeEventListener("load", onImageLoad, false);
      image.removeEventListener("error", onImageError, false);
    }
    image.addEventListener("load", onImageLoad, false);
    image.addEventListener("error", onImageError, false);
    if (url.slice(0, 5) !== "data:") {
      if (this.crossOrigin !== void 0) image.crossOrigin = this.crossOrigin;
    }
    scope.manager.itemStart(url);
    image.src = url;
    return image;
  }
};

// src/loaders/TextureLoader.js
var TextureLoader = class extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    const texture = new Texture();
    const loader = new ImageLoader(this.manager);
    loader.setCrossOrigin(this.crossOrigin);
    loader.setPath(this.path);
    loader.load(url, function(image) {
      texture.image = image;
      texture.needsUpdate = true;
      if (onLoad !== void 0) onLoad(texture);
    }, onProgress, onError);
    return texture;
  }
};

// src/loaders/FileLoader.js
var loading = {};
var HttpError = class extends Error {
  constructor(message, response) {
    super(message);
    this.response = response;
  }
};
var FileLoader = class extends Loader {
  constructor(manager) {
    super(manager);
  }
  load(url, onLoad, onProgress, onError) {
    if (url === void 0) url = "";
    if (this.path !== void 0) url = this.path + url;
    url = this.manager.resolveURL(url);
    const cached = Cache.get(`file:${url}`);
    if (cached !== void 0) {
      this.manager.itemStart(url);
      setTimeout(() => {
        if (onLoad) onLoad(cached);
        this.manager.itemEnd(url);
      }, 0);
      return cached;
    }
    if (loading[url] !== void 0) {
      loading[url].push({ onLoad, onProgress, onError });
      return;
    }
    loading[url] = [];
    loading[url].push({ onLoad, onProgress, onError });
    const req = new Request(url, { headers: new Headers(this.requestHeader), credentials: this.withCredentials ? "include" : "same-origin" });
    const mimeType = this.mimeType, responseType = this.responseType;
    fetch(req).then((response) => {
      if (response.status === 200 || response.status === 0) {
        if (response.status === 0) console.warn("FileLoader: HTTP Status 0 received.");
        if (typeof ReadableStream === "undefined" || response.body === void 0 || response.body.getReader === void 0) return response;
        const callbacks = loading[url];
        const reader = response.body.getReader();
        const contentLength = response.headers.get("X-File-Size") || response.headers.get("Content-Length");
        const total = contentLength ? parseInt(contentLength) : 0;
        const lengthComputable = total !== 0;
        let loaded = 0;
        const stream = new ReadableStream({
          start(controller) {
            readData();
            function readData() {
              reader.read().then(({ done, value }) => {
                if (done) controller.close();
                else {
                  loaded += value.byteLength;
                  const event = new ProgressEvent("progress", { lengthComputable, loaded, total });
                  for (let i = 0, il = callbacks.length; i < il; i++) {
                    const callback = callbacks[i];
                    if (callback.onProgress) callback.onProgress(event);
                  }
                  controller.enqueue(value);
                  readData();
                }
              }, (e) => {
                controller.error(e);
              });
            }
          }
        });
        return new Response(stream);
      } else {
        throw new HttpError(`fetch for "${response.url}" responded with ${response.status}: ${response.statusText}`, response);
      }
    }).then((response) => {
      switch (responseType) {
        case "arraybuffer":
          return response.arrayBuffer();
        case "blob":
          return response.blob();
        case "document":
          return response.text().then((text) => {
            const parser = new DOMParser();
            return parser.parseFromString(text, mimeType);
          });
        case "json":
          return response.json();
        default:
          if (mimeType === void 0) return response.text();
          const re = /charset="?([^;"\s]*)"?/i;
          const exec = re.exec(mimeType);
          const label = exec && exec[1] ? exec[1].toLowerCase() : void 0;
          const decoder = new TextDecoder(label);
          return response.arrayBuffer().then((ab) => decoder.decode(ab));
      }
    }).then((data) => {
      Cache.add(`file:${url}`, data);
      const callbacks = loading[url];
      delete loading[url];
      for (let i = 0, il = callbacks.length; i < il; i++) {
        const callback = callbacks[i];
        if (callback.onLoad) callback.onLoad(data);
      }
    }).catch((err) => {
      const callbacks = loading[url];
      if (callbacks === void 0) {
        this.manager.itemError(url);
        throw err;
      }
      delete loading[url];
      for (let i = 0, il = callbacks.length; i < il; i++) {
        const callback = callbacks[i];
        if (callback.onError) callback.onError(err);
      }
      this.manager.itemError(url);
    }).finally(() => {
      this.manager.itemEnd(url);
    });
    this.manager.itemStart(url);
  }
  setResponseType(value) {
    this.responseType = value;
    return this;
  }
  setMimeType(value) {
    this.mimeType = value;
    return this;
  }
};

// src/lights/Light.js
var Light = class extends Object3D {
  constructor(color, intensity = 1) {
    super();
    this.isLight = true;
    this.type = "Light";
    this.color = new Color(color);
    this.intensity = intensity;
  }
  dispose() {
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.color.copy(source.color);
    this.intensity = source.intensity;
    return this;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    data.object.color = this.color.getHex();
    data.object.intensity = this.intensity;
    if (this.groundColor !== void 0) data.object.groundColor = this.groundColor.getHex();
    if (this.distance !== void 0) data.object.distance = this.distance;
    if (this.angle !== void 0) data.object.angle = this.angle;
    if (this.decay !== void 0) data.object.decay = this.decay;
    if (this.penumbra !== void 0) data.object.penumbra = this.penumbra;
    return data;
  }
};

// src/lights/LightShadow.js
var _projScreenMatrix2 = /* @__PURE__ */ new Matrix4();
var _lightPositionWorld = /* @__PURE__ */ new Vector3();
var _lookTarget = /* @__PURE__ */ new Vector3();
var LightShadow = class {
  constructor(camera) {
    this.camera = camera;
    this.intensity = 1;
    this.bias = 0;
    this.normalBias = 0;
    this.radius = 1;
    this.blurSamples = 8;
    this.mapSize = new Vector2(512, 512);
    this.mapType = void 0;
    this.map = null;
    this.mapPass = null;
    this.matrix = new Matrix4();
    this.autoUpdate = true;
    this.needsUpdate = false;
    this._frustum = new Frustum();
    this._frameExtents = new Vector2(1, 1);
    this._viewportCount = 1;
    this._viewports = [new Vector4(0, 0, 1, 1)];
  }
  getViewportCount() {
    return this._viewportCount;
  }
  getFrustum() {
    return this._frustum;
  }
  updateMatrices(light) {
    const shadowCamera = this.camera, shadowMatrix = this.matrix;
    _lightPositionWorld.setFromMatrixPosition(light.matrixWorld);
    shadowCamera.position.copy(_lightPositionWorld);
    _lookTarget.setFromMatrixPosition(light.target.matrixWorld);
    shadowCamera.lookAt(_lookTarget);
    shadowCamera.updateMatrixWorld();
    _projScreenMatrix2.multiplyMatrices(shadowCamera.projectionMatrix, shadowCamera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(_projScreenMatrix2, shadowCamera.coordinateSystem, shadowCamera.reversedDepth);
    shadowMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    shadowMatrix.multiply(_projScreenMatrix2);
  }
  getViewport(viewportIndex) {
    return this._viewports[viewportIndex];
  }
  getFrameExtents() {
    return this._frameExtents;
  }
  dispose() {
    if (this.map) this.map.dispose();
    if (this.mapPass) this.mapPass.dispose();
  }
  copy(source) {
    this.camera = source.camera.clone();
    this.intensity = source.intensity;
    this.bias = source.bias;
    this.radius = source.radius;
    this.mapSize.copy(source.mapSize);
    return this;
  }
  clone() {
    return new this.constructor().copy(this);
  }
  toJSON() {
    const object = {};
    if (this.intensity !== 1) object.intensity = this.intensity;
    if (this.bias !== 0) object.bias = this.bias;
    if (this.normalBias !== 0) object.normalBias = this.normalBias;
    if (this.radius !== 1) object.radius = this.radius;
    if (this.mapSize.x !== 512 || this.mapSize.y !== 512) object.mapSize = this.mapSize.toArray();
    object.camera = this.camera.toJSON(false).object;
    delete object.camera.matrix;
    return object;
  }
};

// src/cameras/Camera.js
var _position3 = /* @__PURE__ */ new Vector3();
var _quaternion4 = /* @__PURE__ */ new Quaternion();
var _scale2 = /* @__PURE__ */ new Vector3();
var _one2 = /* @__PURE__ */ new Vector3(1, 1, 1);
var Camera = class extends Object3D {
  constructor() {
    super();
    this.isCamera = true;
    this.type = "Camera";
    this.matrixWorldInverse = new Matrix4();
    this.projectionMatrix = new Matrix4();
    this.projectionMatrixInverse = new Matrix4();
    this.coordinateSystem = WebGLCoordinateSystem;
    this.reversedDepth = false;
    this._projectionVersion = 0;
    this._inverseVersion = -1;
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.matrixWorldInverse.copy(source.matrixWorldInverse);
    this.projectionMatrix.copy(source.projectionMatrix);
    this.projectionMatrixInverse.copy(source.projectionMatrixInverse);
    this.coordinateSystem = source.coordinateSystem;
    this._projectionVersion++;
    return this;
  }
  getWorldDirection(target) {
    this.updateWorldMatrix(true, false);
    const e = this.matrixWorld.elements;
    return target.set(-e[8], -e[9], -e[10]).normalize();
  }
  /** View matrix excludes world scale (glTF conformance), like three.js. */
  _updateInverse() {
    if (this._inverseVersion === this._worldVersion) return;
    this.matrixWorld.decompose(_position3, _quaternion4, _scale2);
    if (_scale2.x === 1 && _scale2.y === 1 && _scale2.z === 1) this.matrixWorldInverse.copy(this.matrixWorld).invert();
    else this.matrixWorldInverse.compose(_position3, _quaternion4, _one2).invert();
    this._inverseVersion = this._worldVersion;
  }
  updateMatrixWorld(force) {
    super.updateMatrixWorld(force);
    this._updateInverse();
  }
  updateWorldMatrix(updateParents, updateChildren) {
    super.updateWorldMatrix(updateParents, updateChildren);
    this._updateInverse();
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/cameras/PerspectiveCamera.js
var _v32 = /* @__PURE__ */ new Vector3();
var _minTarget = /* @__PURE__ */ new Vector2();
var _maxTarget = /* @__PURE__ */ new Vector2();
var PerspectiveCamera = class extends Camera {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2e3) {
    super();
    this.isPerspectiveCamera = true;
    this.type = "PerspectiveCamera";
    this.fov = fov;
    this.zoom = 1;
    this.near = near;
    this.far = far;
    this.focus = 10;
    this.aspect = aspect;
    this.view = null;
    this.filmGauge = 35;
    this.filmOffset = 0;
    this.updateProjectionMatrix();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.fov = source.fov;
    this.zoom = source.zoom;
    this.near = source.near;
    this.far = source.far;
    this.focus = source.focus;
    this.aspect = source.aspect;
    this.view = source.view === null ? null : Object.assign({}, source.view);
    this.filmGauge = source.filmGauge;
    this.filmOffset = source.filmOffset;
    return this;
  }
  setFocalLength(focalLength) {
    const vExtentSlope = 0.5 * this.getFilmHeight() / focalLength;
    this.fov = RAD2DEG * 2 * Math.atan(vExtentSlope);
    this.updateProjectionMatrix();
  }
  getFocalLength() {
    const vExtentSlope = Math.tan(DEG2RAD * 0.5 * this.fov);
    return 0.5 * this.getFilmHeight() / vExtentSlope;
  }
  getEffectiveFOV() {
    return RAD2DEG * 2 * Math.atan(Math.tan(DEG2RAD * 0.5 * this.fov) / this.zoom);
  }
  getFilmWidth() {
    return this.filmGauge * Math.min(this.aspect, 1);
  }
  getFilmHeight() {
    return this.filmGauge / Math.max(this.aspect, 1);
  }
  getViewBounds(distance, minTarget, maxTarget) {
    _v32.set(-1, -1, 0.5).applyMatrix4(this.projectionMatrixInverse);
    minTarget.set(_v32.x, _v32.y).multiplyScalar(-distance / _v32.z);
    _v32.set(1, 1, 0.5).applyMatrix4(this.projectionMatrixInverse);
    maxTarget.set(_v32.x, _v32.y).multiplyScalar(-distance / _v32.z);
  }
  getViewSize(distance, target) {
    this.getViewBounds(distance, _minTarget, _maxTarget);
    return target.subVectors(_maxTarget, _minTarget);
  }
  setViewOffset(fullWidth, fullHeight, x, y, width, height) {
    this.aspect = fullWidth / fullHeight;
    if (this.view === null) this.view = { enabled: true, fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
    this.view.enabled = true;
    this.view.fullWidth = fullWidth;
    this.view.fullHeight = fullHeight;
    this.view.offsetX = x;
    this.view.offsetY = y;
    this.view.width = width;
    this.view.height = height;
    this.updateProjectionMatrix();
  }
  clearViewOffset() {
    if (this.view !== null) this.view.enabled = false;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    const near = this.near;
    let top = near * Math.tan(DEG2RAD * 0.5 * this.fov) / this.zoom;
    let height = 2 * top;
    let width = this.aspect * height;
    let left = -0.5 * width;
    const view = this.view;
    if (this.view !== null && this.view.enabled) {
      const fullWidth = view.fullWidth, fullHeight = view.fullHeight;
      left += view.offsetX * width / fullWidth;
      top -= view.offsetY * height / fullHeight;
      width *= view.width / fullWidth;
      height *= view.height / fullHeight;
    }
    const skew = this.filmOffset;
    if (skew !== 0) left += near * skew / this.getFilmWidth();
    this.projectionMatrix.makePerspective(left, left + width, top, top - height, near, this.far, this.coordinateSystem, this.reversedDepth);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    this._projectionVersion++;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    data.object.fov = this.fov;
    data.object.zoom = this.zoom;
    data.object.near = this.near;
    data.object.far = this.far;
    data.object.focus = this.focus;
    data.object.aspect = this.aspect;
    if (this.view !== null) data.object.view = Object.assign({}, this.view);
    data.object.filmGauge = this.filmGauge;
    data.object.filmOffset = this.filmOffset;
    return data;
  }
};

// src/lights/SpotLightShadow.js
var SpotLightShadow = class extends LightShadow {
  constructor() {
    super(new PerspectiveCamera(50, 1, 0.5, 500));
    this.isSpotLightShadow = true;
    this.focus = 1;
  }
  updateMatrices(light) {
    const camera = this.camera;
    const fov = RAD2DEG * 2 * light.angle * this.focus;
    const aspect = this.mapSize.width / this.mapSize.height;
    const far = light.distance || camera.far;
    if (fov !== camera.fov || aspect !== camera.aspect || far !== camera.far) {
      camera.fov = fov;
      camera.aspect = aspect;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    super.updateMatrices(light);
  }
  copy(source) {
    super.copy(source);
    this.focus = source.focus;
    return this;
  }
};

// src/lights/SpotLight.js
var SpotLight = class extends Light {
  constructor(color, intensity, distance = 0, angle = Math.PI / 3, penumbra = 0, decay = 2) {
    super(color, intensity);
    this.isSpotLight = true;
    this.type = "SpotLight";
    this.position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    this.target = new Object3D();
    this.distance = distance;
    this.angle = angle;
    this.penumbra = penumbra;
    this.decay = decay;
    this.map = null;
    this.shadow = new SpotLightShadow();
  }
  get power() {
    return this.intensity * Math.PI;
  }
  set power(power) {
    this.intensity = power / Math.PI;
  }
  dispose() {
    this.shadow.dispose();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.distance = source.distance;
    this.angle = source.angle;
    this.penumbra = source.penumbra;
    this.decay = source.decay;
    this.target = source.target.clone();
    this.shadow = source.shadow.clone();
    return this;
  }
};

// src/lights/PointLightShadow.js
var PointLightShadow = class extends LightShadow {
  constructor() {
    super(new PerspectiveCamera(90, 1, 0.5, 500));
    this.isPointLightShadow = true;
  }
  updateMatrices(light) {
    const camera = this.camera;
    const far = light.distance || camera.far;
    if (far !== camera.far) {
      camera.far = far;
      camera.updateProjectionMatrix();
    }
    super.updateMatrices(light);
  }
};

// src/lights/PointLight.js
var PointLight = class extends Light {
  constructor(color, intensity, distance = 0, decay = 2) {
    super(color, intensity);
    this.isPointLight = true;
    this.type = "PointLight";
    this.distance = distance;
    this.decay = decay;
    this.shadow = new PointLightShadow();
  }
  get power() {
    return this.intensity * 4 * Math.PI;
  }
  set power(power) {
    this.intensity = power / (4 * Math.PI);
  }
  dispose() {
    this.shadow.dispose();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.distance = source.distance;
    this.decay = source.decay;
    this.shadow = source.shadow.clone();
    return this;
  }
};

// src/lights/RectAreaLight.js
var RectAreaLight = class extends Light {
  constructor(color, intensity, width = 10, height = 10) {
    super(color, intensity);
    this.isRectAreaLight = true;
    this.type = "RectAreaLight";
    this.width = width;
    this.height = height;
  }
  get power() {
    return this.intensity * this.width * this.height * Math.PI;
  }
  set power(power) {
    this.intensity = power / (this.width * this.height * Math.PI);
  }
  copy(source) {
    super.copy(source);
    this.width = source.width;
    this.height = source.height;
    return this;
  }
};

// src/lights/HemisphereLight.js
var HemisphereLight = class extends Light {
  constructor(skyColor, groundColor, intensity) {
    super(skyColor, intensity);
    this.isHemisphereLight = true;
    this.type = "HemisphereLight";
    this.position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    this.groundColor = new Color(groundColor);
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.groundColor.copy(source.groundColor);
    return this;
  }
};

// src/cameras/OrthographicCamera.js
var OrthographicCamera = class extends Camera {
  constructor(left = -1, right = 1, top = 1, bottom = -1, near = 0.1, far = 2e3) {
    super();
    this.isOrthographicCamera = true;
    this.type = "OrthographicCamera";
    this.zoom = 1;
    this.view = null;
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.near = near;
    this.far = far;
    this.updateProjectionMatrix();
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.left = source.left;
    this.right = source.right;
    this.top = source.top;
    this.bottom = source.bottom;
    this.near = source.near;
    this.far = source.far;
    this.zoom = source.zoom;
    this.view = source.view === null ? null : Object.assign({}, source.view);
    return this;
  }
  setViewOffset(fullWidth, fullHeight, x, y, width, height) {
    if (this.view === null) this.view = { enabled: true, fullWidth: 1, fullHeight: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 };
    this.view.enabled = true;
    this.view.fullWidth = fullWidth;
    this.view.fullHeight = fullHeight;
    this.view.offsetX = x;
    this.view.offsetY = y;
    this.view.width = width;
    this.view.height = height;
    this.updateProjectionMatrix();
  }
  clearViewOffset() {
    if (this.view !== null) this.view.enabled = false;
    this.updateProjectionMatrix();
  }
  updateProjectionMatrix() {
    const dx = (this.right - this.left) / (2 * this.zoom);
    const dy = (this.top - this.bottom) / (2 * this.zoom);
    const cx = (this.right + this.left) / 2;
    const cy = (this.top + this.bottom) / 2;
    let left = cx - dx, right = cx + dx, top = cy + dy, bottom = cy - dy;
    if (this.view !== null && this.view.enabled) {
      const scaleW = (this.right - this.left) / this.view.fullWidth / this.zoom;
      const scaleH = (this.top - this.bottom) / this.view.fullHeight / this.zoom;
      left += scaleW * this.view.offsetX;
      right = left + scaleW * this.view.width;
      top -= scaleH * this.view.offsetY;
      bottom = top - scaleH * this.view.height;
    }
    this.projectionMatrix.makeOrthographic(left, right, top, bottom, this.near, this.far, this.coordinateSystem, this.reversedDepth);
    this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    this._projectionVersion++;
  }
  toJSON(meta) {
    const data = super.toJSON(meta);
    data.object.zoom = this.zoom;
    data.object.left = this.left;
    data.object.right = this.right;
    data.object.top = this.top;
    data.object.bottom = this.bottom;
    data.object.near = this.near;
    data.object.far = this.far;
    if (this.view !== null) data.object.view = Object.assign({}, this.view);
    return data;
  }
};

// src/lights/DirectionalLightShadow.js
var DirectionalLightShadow = class extends LightShadow {
  constructor() {
    super(new OrthographicCamera(-5, 5, 5, -5, 0.5, 500));
    this.isDirectionalLightShadow = true;
  }
};

// src/lights/DirectionalLight.js
var DirectionalLight = class extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.isDirectionalLight = true;
    this.type = "DirectionalLight";
    this.position.copy(Object3D.DEFAULT_UP);
    this.updateMatrix();
    this.target = new Object3D();
    this.shadow = new DirectionalLightShadow();
  }
  dispose() {
    this.shadow.dispose();
  }
  copy(source) {
    super.copy(source);
    this.target = source.target.clone();
    this.shadow = source.shadow.clone();
    return this;
  }
};

// src/lights/AmbientLight.js
var AmbientLight = class extends Light {
  constructor(color, intensity) {
    super(color, intensity);
    this.isAmbientLight = true;
    this.type = "AmbientLight";
  }
};

// src/core/InstancedBufferGeometry.js
var InstancedBufferGeometry = class extends BufferGeometry {
  constructor() {
    super();
    this.isInstancedBufferGeometry = true;
    this.type = "InstancedBufferGeometry";
    this.instanceCount = Infinity;
  }
  copy(source) {
    super.copy(source);
    this.instanceCount = source.instanceCount;
    return this;
  }
  toJSON() {
    const data = super.toJSON();
    data.instanceCount = this.instanceCount;
    data.isInstancedBufferGeometry = true;
    return data;
  }
};

// src/core/Raycaster.js
var Raycaster = class {
  constructor(origin, direction, near = 0, far = Infinity) {
    this.ray = new Ray(origin, direction);
    this.near = near;
    this.far = far;
    this.camera = null;
    this.layers = new Layers();
    this.params = { Mesh: {}, Line: { threshold: 1 }, LOD: {}, Points: { threshold: 1 }, Sprite: {} };
  }
  set(origin, direction) {
    this.ray.set(origin, direction);
  }
  setFromCamera(coords, camera) {
    if (camera.isPerspectiveCamera) {
      this.ray.origin.setFromMatrixPosition(camera.matrixWorld);
      this.ray.direction.set(coords.x, coords.y, 0.5).unproject(camera).sub(this.ray.origin).normalize();
      this.camera = camera;
    } else if (camera.isOrthographicCamera) {
      this.ray.origin.set(coords.x, coords.y, (camera.near + camera.far) / (camera.near - camera.far)).unproject(camera);
      this.ray.direction.set(0, 0, -1).transformDirection(camera.matrixWorld);
      this.camera = camera;
    } else {
      console.error("Raycaster: Unsupported camera type: " + camera.type);
    }
  }
  intersectObject(object, recursive = true, intersects = []) {
    intersect(object, this, intersects, recursive);
    intersects.sort(ascSort);
    return intersects;
  }
  intersectObjects(objects, recursive = true, intersects = []) {
    for (let i = 0, l = objects.length; i < l; i++) intersect(objects[i], this, intersects, recursive);
    intersects.sort(ascSort);
    return intersects;
  }
};
function ascSort(a, b) {
  return a.distance - b.distance;
}
function intersect(object, raycaster, intersects, recursive) {
  let propagate = true;
  if (object.layers.test(raycaster.layers)) {
    const result = object.raycast(raycaster, intersects);
    if (result === false) propagate = false;
  }
  if (propagate === true && recursive === true) {
    const children = object.children;
    for (let i = 0, l = children.length; i < l; i++) intersect(children[i], raycaster, intersects, true);
  }
}

// src/core/Clock.js
var Clock = class {
  constructor(autoStart = true) {
    this.autoStart = autoStart;
    this.startTime = 0;
    this.oldTime = 0;
    this.elapsedTime = 0;
    this.running = false;
  }
  start() {
    this.startTime = now();
    this.oldTime = this.startTime;
    this.elapsedTime = 0;
    this.running = true;
  }
  stop() {
    this.getElapsedTime();
    this.running = false;
    this.autoStart = false;
  }
  getElapsedTime() {
    this.getDelta();
    return this.elapsedTime;
  }
  getDelta() {
    let diff = 0;
    if (this.autoStart && !this.running) {
      this.start();
      return 0;
    }
    if (this.running) {
      const newTime = now();
      diff = (newTime - this.oldTime) / 1e3;
      this.oldTime = newTime;
      this.elapsedTime += diff;
    }
    return diff;
  }
};
function now() {
  return (typeof performance === "undefined" ? Date : performance).now();
}

// src/core/Timer.js
var Timer = class {
  constructor() {
    this._previousTime = 0;
    this._currentTime = 0;
    this._startTime = performance.now();
    this._delta = 0;
    this._elapsed = 0;
    this._timescale = 1;
  }
  getDelta() {
    return this._delta / 1e3;
  }
  getElapsed() {
    return this._elapsed / 1e3;
  }
  getTimescale() {
    return this._timescale;
  }
  setTimescale(t) {
    this._timescale = t;
    return this;
  }
  reset() {
    this._currentTime = performance.now() - this._startTime;
    return this;
  }
  dispose() {
  }
  update(timestamp) {
    this._previousTime = this._currentTime;
    this._currentTime = (timestamp !== void 0 ? timestamp : performance.now()) - this._startTime;
    this._delta = (this._currentTime - this._previousTime) * this._timescale;
    this._elapsed += this._delta;
    return this;
  }
};

// src/math/Spherical.js
var Spherical = class {
  constructor(radius = 1, phi = 0, theta = 0) {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
  }
  set(radius, phi, theta) {
    this.radius = radius;
    this.phi = phi;
    this.theta = theta;
    return this;
  }
  copy(other) {
    this.radius = other.radius;
    this.phi = other.phi;
    this.theta = other.theta;
    return this;
  }
  makeSafe() {
    const EPS = 1e-6;
    this.phi = clamp(this.phi, EPS, Math.PI - EPS);
    return this;
  }
  setFromVector3(v) {
    return this.setFromCartesianCoords(v.x, v.y, v.z);
  }
  setFromCartesianCoords(x, y, z) {
    this.radius = Math.sqrt(x * x + y * y + z * z);
    if (this.radius === 0) {
      this.theta = 0;
      this.phi = 0;
    } else {
      this.theta = Math.atan2(x, z);
      this.phi = Math.acos(clamp(y / this.radius, -1, 1));
    }
    return this;
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/math/Line3.js
var _startP = /* @__PURE__ */ new Vector3();
var _startEnd = /* @__PURE__ */ new Vector3();
var Line3 = class {
  constructor(start = new Vector3(), end = new Vector3()) {
    this.start = start;
    this.end = end;
  }
  set(start, end) {
    this.start.copy(start);
    this.end.copy(end);
    return this;
  }
  copy(line) {
    this.start.copy(line.start);
    this.end.copy(line.end);
    return this;
  }
  getCenter(target) {
    return target.addVectors(this.start, this.end).multiplyScalar(0.5);
  }
  delta(target) {
    return target.subVectors(this.end, this.start);
  }
  distanceSq() {
    return this.start.distanceToSquared(this.end);
  }
  distance() {
    return this.start.distanceTo(this.end);
  }
  at(t, target) {
    return this.delta(target).multiplyScalar(t).add(this.start);
  }
  closestPointToPointParameter(point, clampToLine) {
    _startP.subVectors(point, this.start);
    _startEnd.subVectors(this.end, this.start);
    const startEnd2 = _startEnd.dot(_startEnd), startEnd_startP = _startEnd.dot(_startP);
    let t = startEnd_startP / startEnd2;
    if (clampToLine) t = clamp(t, 0, 1);
    return t;
  }
  closestPointToPoint(point, clampToLine, target) {
    const t = this.closestPointToPointParameter(point, clampToLine);
    return this.delta(target).multiplyScalar(t).add(this.start);
  }
  applyMatrix4(matrix) {
    this.start.applyMatrix4(matrix);
    this.end.applyMatrix4(matrix);
    return this;
  }
  equals(line) {
    return line.start.equals(this.start) && line.end.equals(this.end);
  }
  clone() {
    return new this.constructor().copy(this);
  }
};

// src/helpers/AxesHelper.js
var AxesHelper = class extends LineSegments {
  constructor(size = 1) {
    const vertices = [0, 0, 0, size, 0, 0, 0, 0, 0, 0, size, 0, 0, 0, 0, 0, 0, size];
    const colors = [1, 0, 0, 1, 0.6, 0, 0, 1, 0, 0.6, 1, 0, 0, 0, 1, 0, 0.6, 1];
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
    super(geometry, material);
    this.type = "AxesHelper";
  }
  setColors(xAxisColor, yAxisColor, zAxisColor) {
    const color = new Color();
    const array = this.geometry.attributes.color.array;
    color.set(xAxisColor);
    color.toArray(array, 0);
    color.toArray(array, 3);
    color.set(yAxisColor);
    color.toArray(array, 6);
    color.toArray(array, 9);
    color.set(zAxisColor);
    color.toArray(array, 12);
    color.toArray(array, 15);
    this.geometry.attributes.color.needsUpdate = true;
    return this;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
};

// src/helpers/GridHelper.js
var GridHelper = class extends LineSegments {
  constructor(size = 10, divisions = 10, color1 = 4473924, color2 = 8947848) {
    color1 = new Color(color1);
    color2 = new Color(color2);
    const center = divisions / 2, step = size / divisions, halfSize = size / 2;
    const vertices = [], colors = [];
    for (let i = 0, j = 0, k = -halfSize; i <= divisions; i++, k += step) {
      vertices.push(-halfSize, 0, k, halfSize, 0, k);
      vertices.push(k, 0, -halfSize, k, 0, halfSize);
      const color = i === center ? color1 : color2;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
      color.toArray(colors, j);
      j += 3;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
    const material = new LineBasicMaterial({ vertexColors: true, toneMapped: false });
    super(geometry, material);
    this.type = "GridHelper";
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
};

// src/helpers/BoxHelper.js
var _box4 = /* @__PURE__ */ new Box3();
var BoxHelper = class extends LineSegments {
  constructor(object, color = 16776960) {
    const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
    const positions = new Float32Array(8 * 3);
    const geometry = new BufferGeometry();
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    super(geometry, new LineBasicMaterial({ color, toneMapped: false }));
    this.object = object;
    this.type = "BoxHelper";
    this.matrixAutoUpdate = false;
    this.update();
  }
  update(object) {
    if (object !== void 0) console.warn("BoxHelper: .update() has no longer arguments.");
    if (this.object !== void 0) _box4.setFromObject(this.object);
    if (_box4.isEmpty()) return;
    const min = _box4.min, max = _box4.max;
    const position = this.geometry.attributes.position;
    const array = position.array;
    array[0] = max.x;
    array[1] = max.y;
    array[2] = max.z;
    array[3] = min.x;
    array[4] = max.y;
    array[5] = max.z;
    array[6] = min.x;
    array[7] = min.y;
    array[8] = max.z;
    array[9] = max.x;
    array[10] = min.y;
    array[11] = max.z;
    array[12] = max.x;
    array[13] = max.y;
    array[14] = min.z;
    array[15] = min.x;
    array[16] = max.y;
    array[17] = min.z;
    array[18] = min.x;
    array[19] = min.y;
    array[20] = min.z;
    array[21] = max.x;
    array[22] = min.y;
    array[23] = min.z;
    position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }
  setFromObject(object) {
    this.object = object;
    this.update();
    return this;
  }
  copy(source, recursive) {
    super.copy(source, recursive);
    this.object = source.object;
    return this;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
};
export {
  ACESFilmicToneMapping,
  AddEquation,
  AddOperation,
  AdditiveBlending,
  AgXToneMapping,
  AlphaFormat,
  AlwaysDepth,
  AlwaysStencilFunc,
  AmbientLight,
  AxesHelper,
  BackSide,
  BasicDepthPacking,
  BasicShadowMap,
  Box3,
  BoxGeometry,
  BoxHelper,
  BufferAttribute,
  BufferGeometry,
  ByteType,
  Cache,
  Camera,
  CanvasTexture,
  CapsuleGeometry,
  CatmullRomCurve3,
  CineonToneMapping,
  CircleGeometry,
  ClampToEdgeWrapping,
  Clock,
  Color,
  ColorManagement,
  ConeGeometry,
  ConstantAlphaFactor,
  ConstantColorFactor,
  CubeReflectionMapping,
  CubeRefractionMapping,
  CubeTexture,
  CullFaceBack,
  CullFaceFront,
  CullFaceFrontBack,
  CullFaceNone,
  Curve,
  CustomBlending,
  CylinderGeometry,
  Data3DTexture,
  DataArrayTexture,
  DataTexture,
  DecrementStencilOp,
  DecrementWrapStencilOp,
  DefaultLoadingManager,
  DepthFormat,
  DepthStencilFormat,
  DepthTexture,
  DirectionalLight,
  DirectionalLightShadow,
  DodecahedronGeometry,
  DoubleSide,
  DstAlphaFactor,
  DstColorFactor,
  DynamicCopyUsage,
  DynamicDrawUsage,
  DynamicReadUsage,
  EdgesGeometry,
  EqualDepth,
  EqualStencilFunc,
  EquirectangularReflectionMapping,
  EquirectangularRefractionMapping,
  Euler,
  EventDispatcher,
  FileLoader,
  Float16BufferAttribute,
  Float32BufferAttribute,
  FloatType,
  Fog,
  FogExp2,
  FrontSide,
  Frustum,
  GLSL1,
  GLSL3,
  GreaterDepth,
  GreaterEqualDepth,
  GreaterEqualStencilFunc,
  GreaterStencilFunc,
  GridHelper,
  Group,
  HalfFloatType,
  HemisphereLight,
  IcosahedronGeometry,
  ImageLoader,
  IncrementStencilOp,
  IncrementWrapStencilOp,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  InstancedMesh,
  Int16BufferAttribute,
  Int32BufferAttribute,
  Int8BufferAttribute,
  IntType,
  InvertStencilOp,
  KeepStencilOp,
  LatheGeometry,
  Layers,
  LessDepth,
  LessEqualDepth,
  LessEqualStencilFunc,
  LessStencilFunc,
  Light,
  LightShadow,
  Line,
  Line3,
  LineBasicMaterial,
  LineCurve3,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  LinearFilter,
  LinearMipMapLinearFilter,
  LinearMipMapNearestFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  LinearSRGBColorSpace,
  LinearToSRGB,
  LinearToneMapping,
  Loader,
  LoadingManager,
  LoopOnce,
  LoopPingPong,
  LoopRepeat,
  LuminanceAlphaFormat,
  LuminanceFormat,
  MOUSE,
  Material,
  MathUtils,
  Matrix3,
  Matrix4,
  MaxEquation,
  Mesh,
  MeshBVH,
  MeshBasicMaterial,
  MeshDepthMaterial,
  MeshLambertMaterial,
  MeshNormalMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MinEquation,
  MirroredRepeatWrapping,
  MixOperation,
  MultiplyBlending,
  MultiplyOperation,
  NearestFilter,
  NearestMipMapLinearFilter,
  NearestMipMapNearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  NeutralToneMapping,
  NeverDepth,
  NeverStencilFunc,
  NoBlending,
  NoColorSpace,
  NoToneMapping,
  NormalBlending,
  NotEqualDepth,
  NotEqualStencilFunc,
  Object3D,
  ObjectSpaceNormalMap,
  OctahedronGeometry,
  OneFactor,
  OneMinusConstantAlphaFactor,
  OneMinusConstantColorFactor,
  OneMinusDstAlphaFactor,
  OneMinusDstColorFactor,
  OneMinusSrcAlphaFactor,
  OneMinusSrcColorFactor,
  OrthographicCamera,
  PCFShadowMap,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  PointLight,
  PointLightShadow,
  Points,
  PointsMaterial,
  PolyhedronGeometry,
  QuadraticBezierCurve3,
  Quaternion,
  REVISION,
  RGBADepthPacking,
  RGBAFormat,
  RGBAIntegerFormat,
  RGBDepthPacking,
  RGBFormat,
  RGDepthPacking,
  RGFormat,
  RGIntegerFormat,
  RawShaderMaterial,
  Ray,
  Raycaster,
  RectAreaLight,
  RedFormat,
  RedIntegerFormat,
  ReinhardToneMapping,
  RepeatWrapping,
  ReplaceStencilOp,
  ReverseSubtractEquation,
  RingGeometry,
  SRGBColorSpace,
  SRGBToLinear,
  Scene,
  ShaderChunk,
  ShaderLib,
  ShaderMaterial,
  ShortType,
  Source,
  Sphere,
  SphereGeometry,
  Spherical,
  SpotLight,
  SpotLightShadow,
  Sprite,
  SpriteMaterial,
  SrcAlphaFactor,
  SrcAlphaSaturateFactor,
  SrcColorFactor,
  StaticCopyUsage,
  StaticDrawUsage,
  StaticReadUsage,
  StreamCopyUsage,
  StreamDrawUsage,
  StreamReadUsage,
  SubtractEquation,
  SubtractiveBlending,
  TOUCH,
  TangentSpaceNormalMap,
  TetrahedronGeometry,
  Texture,
  TextureLoader,
  Timer,
  TorusGeometry,
  TorusKnotGeometry,
  Triangle,
  TubeGeometry,
  UVMapping,
  Uint16BufferAttribute,
  Uint32BufferAttribute,
  Uint8BufferAttribute,
  Uint8ClampedBufferAttribute,
  UniformsLib,
  UniformsUtils,
  UnsignedByteType,
  UnsignedInt248Type,
  UnsignedIntType,
  UnsignedShort4444Type,
  UnsignedShort5551Type,
  UnsignedShortType,
  VSMShadowMap,
  Vector2,
  Vector3,
  Vector4,
  WebGLCoordinateSystem,
  WebGLRenderTarget,
  WebGLRenderer,
  WebGPUCoordinateSystem,
  WireframeGeometry,
  ZeroFactor,
  ZeroStencilOp,
  cloneUniforms,
  mergeUniforms,
  transformSlab
};
