export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const clamp01 = value => clamp(value, 0, 1);
export const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep01 = value => { const t = clamp01(value); return t * t * (3 - 2 * t); };
/** Nearest-rank quantile (q from 0 to 1); an empty list gives 0. */
export const quantile = (values, q) => values.length ? [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)] : 0;
