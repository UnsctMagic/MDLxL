// File and named in-memory inputs for the XFER look-check scripts.
import fs from 'node:fs';
import { openDocument } from '../../src/editor-document.js';
import { createLookCheck } from '../../src/xfer-look.js';

export { LIMITS } from '../../src/xfer-look.js';

const models = new Map();
const check = createLookCheck({ debug: process.env.HELD_DEBUG ? console.log : null });

function modelOf(src) {
  const key = typeof src === 'string' ? src : src.key;
  if (!models.has(key)) models.set(key, typeof src === 'string' ? openDocument(fs.readFileSync(src), src).model : src.model);
  return models.get(key);
}

export function loadModel(src) {
  return check.prepare(modelOf(src));
}

export function measurePair(donor, result, { native = null, ...options } = {}) {
  return check.measurePair(modelOf(donor), modelOf(result), { ...options, native: native ? modelOf(native) : null });
}

export function forget() { models.clear(); check.forget(); }
