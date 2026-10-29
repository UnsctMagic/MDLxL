// Plain-array vectors of any length; add, sub, scale and lerp keep the input length.
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const sub = (a, b) => a.map((v, i) => v - b[i]);
export const scale = (a, n) => a.map(v => v * n);
export const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = a => Math.hypot(...a);
export const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// A zero-length vector stays zero.
export const unit = a => scale(a, 1 / (Math.hypot(...a) || 1));
