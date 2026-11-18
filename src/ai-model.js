import { createChanges, applyChanges } from './history-store.js';
import { ignoreHistoryAlias, MODEL_COUNT_FIELDS, nodeCollectionKeys } from './editor-document.js';
import FORBIDDEN_KEYS from './forbidden-keys.json' with { type: 'json' };

const types = {
  Float32Array,
  Float64Array,
  Uint8Array,
  Uint8ClampedArray,
  Uint16Array,
  Uint32Array,
  Int8Array,
  Int16Array,
  Int32Array,
};
const forbidden = new Set(FORBIDDEN_KEYS);
export function encodeAiValue(value, ancestors = new Set()) {
  if (ArrayBuffer.isView(value)) return { $type: value.constructor.name, $data: Array.from(value) };
  if (value instanceof ArrayBuffer) return { $type: 'Uint8Array', $data: Array.from(new Uint8Array(value)) };
  if (value === undefined) return null;
  if (['bigint', 'function', 'symbol'].includes(typeof value))
    throw Error('Return a JSON value from the model script.');
  if (value === null || typeof value !== 'object') return value;
  if (ancestors.has(value)) throw Error('Return a JSON value without circular references.');
  ancestors.add(value);
  try {
    return Array.isArray(value)
      ? value.map(item => encodeAiValue(item, ancestors))
      : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeAiValue(item, ancestors)]));
  } finally {
    ancestors.delete(value);
  }
}
export function decodeAiValue(value) {
  if (!value || typeof value !== 'object') return value;
  if (value.$type) {
    const Type = Object.hasOwn(types, value.$type) ? types[value.$type] : null;
    if (
      !Type ||
      !Array.isArray(value.$data) ||
      value.$data.some(x => typeof x !== 'number' || !Number.isFinite(x))
    )
      throw Error('Invalid typed array.');
    const result = new Type(value.$data);
    if (
      !(result instanceof Float32Array || result instanceof Float64Array) &&
      result.some((x, i) => x !== value.$data[i])
    )
      throw Error('Typed array value is out of range.');
    if (result.some(x => !Number.isFinite(x))) throw Error('Typed array contains a non-finite value.');
    return result;
  }
  if (Array.isArray(value)) return value.map(decodeAiValue);
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (forbidden.has(key)) throw Error('Unsafe model property.');
    result[key] = decodeAiValue(item);
  }
  return result;
}
export function pointerParts(path) {
  if (path === '') return [];
  if (typeof path !== 'string' || !path.startsWith('/') || /~(?:[^01]|$)/.test(path))
    throw Error('Use a valid JSON Pointer, such as /Geosets/0/Vertices.');
  const parts = path
    .slice(1)
    .split('/')
    .map(x => x.replace(/~1/g, '/').replace(/~0/g, '~'));
  if (parts.some(x => forbidden.has(x))) throw Error('Unsafe model path.');
  return parts;
}
export const pointer = parts =>
  '/' + parts.map(x => String(x).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
export function readPointer(value, path) {
  for (const key of pointerParts(path)) {
    if (value == null || !Object.hasOwn(value, key)) throw Error('Model path does not exist: ' + path);
    value = value[key];
  }
  return value;
}
export function readAiModel(model, { path = '', offset = 0, limit = 2000 } = {}) {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 20000
  )
    throw Error('Invalid read range.');
  const value = readPointer(model, path),
    list = Array.isArray(value) || ArrayBuffer.isView(value);
  return {
    path,
    offset: list ? offset : 0,
    total: list ? value.length : null,
    truncated: list ? offset + limit < value.length : false,
    value: encodeAiValue(list ? value.slice(offset, offset + limit) : value),
  };
}
export function patchAiModel(model, operations) {
  if (!Array.isArray(operations) || !operations.length || operations.length > 10000)
    throw Error('Provide 1–10000 patch operations.');
  const next = structuredClone(model);
  for (const op of operations) {
    const parts = pointerParts(op.path);
    if (!parts.length) throw Error('Patch a model section, not the document root.');
    const key = parts.pop(),
      parent = parts.length ? readPointer(next, pointer(parts)) : next;
    if (!parent || typeof parent !== 'object') throw Error('Patch parent is not an object.');
    if (op.op === 'set') {
      if (
        (Array.isArray(parent) || ArrayBuffer.isView(parent)) &&
        (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= parent.length)
      )
        throw Error('Use splice to resize an array.');
      const value = decodeAiValue(op.value);
      if (ArrayBuffer.isView(parent) && (typeof value !== 'number' || !Number.isFinite(value)))
        throw Error('A numeric array requires finite numbers.');
      parent[key] = value;
      if (
        ArrayBuffer.isView(parent) &&
        !(parent instanceof Float32Array || parent instanceof Float64Array) &&
        parent[key] !== value
      )
        throw Error('Numeric value is out of range.');
    } else if (op.op === 'delete') {
      if (Array.isArray(parent) || ArrayBuffer.isView(parent))
        throw Error('Use splice to remove array elements.');
      if (!Object.hasOwn(parent, key)) throw Error('Cannot delete a missing property.');
      delete parent[key];
    } else if (op.op === 'splice') {
      const array = parent[key];
      if (!Array.isArray(array) && !ArrayBuffer.isView(array)) throw Error('Splice requires an array.');
      if (
        !Number.isSafeInteger(op.index) ||
        op.index < 0 ||
        op.index > array.length ||
        !Number.isSafeInteger(op.deleteCount) ||
        op.deleteCount < 0 ||
        op.index + op.deleteCount > array.length
      )
        throw Error('Invalid splice range.');
      const items = decodeAiValue(op.items || []),
        result = Array.from(array);
      result.splice(op.index, op.deleteCount, ...items);
      parent[key] = ArrayBuffer.isView(array)
        ? decodeAiValue({ $type: array.constructor.name, $data: result })
        : result;
    } else throw Error('Unknown patch operation.');
  }
  return next;
}
const contains = (parent, child) =>
  parent.length <= child.length && parent.every((part, i) => String(part) === String(child[i]));
const equal = (a, b) => JSON.stringify(encodeAiValue(a)) === JSON.stringify(encodeAiValue(b));
function protectedAnimationKeys(before, after, ranges) {
  if (!ranges) return;
  if (
    !Array.isArray(ranges) ||
    !ranges.length ||
    ranges.some(r => !Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite) || r[0] > r[1])
  )
    throw Error('Invalid animation ranges.');
  const outside = frame => !ranges.some(([a, b]) => frame >= a && frame <= b);
  function visit(a, b, path = []) {
    if (ignoreHistoryAlias(path)) return;
    if (a?.Keys || b?.Keys) {
      if (!equal(a?.Keys?.filter(k => outside(k.Frame)) || [], b?.Keys?.filter(k => outside(k.Frame)) || []))
        throw Error('Edit changes keys outside the requested animation ranges: ' + pointer(path));
      if ((a?.GlobalSeqId != null || b?.GlobalSeqId != null) && !equal(a, b))
        throw Error('Animation ranges cannot authorize changes to global sequence tracks.');
      if (
        a &&
        b &&
        (a.LineType !== b.LineType || a.GlobalSeqId !== b.GlobalSeqId) &&
        (a.Keys || []).some(k => outside(k.Frame))
      )
        throw Error('Track interpolation changes would affect protected animation keys.');
      return;
    }
    if ((!a && !b) || ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return;
    if (typeof a === 'object' || typeof b === 'object')
      for (const key of new Set([...Object.keys(a || {}), ...Object.keys(b || {})]))
        visit(a?.[key], b?.[key], [...path, key]);
  }
  visit(before, after);
}
// Model data such as VertexGroup (Uint8Array) or Faces (Uint16Array) must keep its
// numeric array type; a script may change values but not the storage format.
function keepArrayTypes(a, b, path) {
  if (ArrayBuffer.isView(a)) {
    // Removing an optional array (for example Tangents) is allowed; replacing its type is not.
    if (b == null) return;
    if (!ArrayBuffer.isView(b) || b.constructor !== a.constructor)
      throw Error(
        'Edit changes the array type of ' + pointer(path) + '; keep it a ' + a.constructor.name + '.',
      );
    return;
  }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || ignoreHistoryAlias(path)) return;
  for (const key of Object.keys(a)) if (Object.hasOwn(b, key)) keepArrayTypes(a[key], b[key], [...path, key]);
}
export function prepareAiEdit(before, after, { scope, protectedPaths = [], animationRanges } = {}) {
  if (!Array.isArray(scope) || !scope.length) throw Error('An edit needs an explicit model scope.');
  // A bare /Nodes means every node collection; model.Nodes itself is only an alias.
  const allowed = scope.map(pointerParts).flatMap(p => (p.length === 1 && p[0] === 'Nodes' ? [...nodeCollectionKeys].map(key => [key]) : [p])),
    protectedScopes = protectedPaths.map(pointerParts);
  if (allowed.some(p => !p.length || p[0] === 'Nodes'))
    throw Error(
      'Scope must name canonical model sections; use /Bones or another node collection instead of /Nodes.',
    );
  const changes = createChanges(before, after, { ignore: ignoreHistoryAlias });
  for (const change of changes) {
    const collection = change.path.length === 2 && change.path[0] === 'Info' && MODEL_COUNT_FIELDS[change.path[1]];
    // These counts are owned by normalization, not authored Info fields. Permit
    // only the exact count produced by a collection edit already in scope.
    const derivedCount = collection && change.after === (after[collection]?.length || 0)
      && before[collection]?.length !== after[collection]?.length
      && changes.some(c => c.path[0] === collection && allowed.some(p => contains(p, c.path)));
    // The model's bounding box follows its geometry: allowed whenever a geoset edit is in scope.
    const derivedBounds = change.path[0] === 'Info' && ['MinimumExtent', 'MaximumExtent', 'BoundsRadius'].includes(change.path[1])
      && changes.some(c => c.path[0] === 'Geosets' && allowed.some(p => contains(p, c.path)));
    if (!allowed.some(p => contains(p, change.path)) && !derivedCount && !derivedBounds)
      throw Error('Edit exceeds its scope: ' + pointer(change.path));
    let a, b;
    try {
      a = readPointer(before, pointer(change.path));
      b = readPointer(after, pointer(change.path));
    } catch {}
    keepArrayTypes(a, b, change.path);
    for (const p of protectedScopes)
      if (contains(p, change.path) || contains(change.path, p)) {
        // A parent array splice can include unchanged protected children.
        let a, b;
        try {
          a = readPointer(before, pointer(p));
        } catch {}
        try {
          b = readPointer(after, pointer(p));
        } catch {}
        if (!equal(a, b)) throw Error('Edit changes a protected path: ' + pointer(p));
      }
  }
  protectedAnimationKeys(before, after, animationRanges);
  return {
    changes,
    sections: [...new Set(changes.map(c => c.path[0]))],
    summary: changes.slice(0, 100).map(c => ({
      path: pointer(c.path),
      kind: c.kind,
      ...(c.kind === 'bytes'
        ? { bytes: c.after.byteLength }
        : c.kind === 'splice'
          ? { index: c.index, removed: c.before.length, added: c.after.length }
          : {}),
    })),
    changeCount: changes.length,
  };
}
export function applyAiEdit(model, prepared) {
  applyChanges(model, prepared.changes);
}
export function aiSelectionSignature(state) {
  return JSON.stringify([
    state.selection,
    Array.from(state.selectedNodeIds || []),
    Array.from(state.selectable || []),
    state.activeGeoset,
    state.uvSet,
    state.sequence,
    state.globalSeqId,
    state.keyframes?.range || state.keyframes?.keys?.length ? state.keyframes : null,
    state.mode,
    state.workplane,
    state.session?.paintWorkingRevision,
    state.uvEditing,
    state.uvEligibleSelection,
  ]);
}
export function checkAiTarget(target, state) {
  if (
    !target ||
    target.documentId !== state.session.id ||
    target.revision !== state.doc.revision ||
    target.selectionSignature !== aiSelectionSignature(state)
  )
    throw Error(
      'The model or selection changed since this prompt. Nothing was applied. Ask the user to send the request again for the current selection.',
    );
}

// ---- Script harness helpers (used by the sandboxed renderer; testable in Node) ----
const AsyncFunctionType = Object.getPrototypeOf(async function () {}).constructor;
export const AI_SCRIPT_NAMES = ['model', 'selection', 'context', 'references', 'api', 'assets', 'before', 'files', 'log', 'parameters'];
// The harness names are parameters of an OUTER function; the AI's code runs in an inner
// function, so `const before = ...` or `const log = ...` only shadows them.
export function buildAiScript(code) {
  return new AsyncFunctionType(...AI_SCRIPT_NAMES, '"use strict";\nreturn (async () => {\n' + code + '\n})();');
}
const isViewDetached = view => {
  try {
    structuredClone(view);
    return false;
  } catch {
    return true;
  }
};
// Anything a script returns must survive structured clone; otherwise describe the
// offending parts as text instead of failing with "An object could not be cloned".
export function cloneSafeAiValue(value) {
  try {
    structuredClone(value);
    return { value, replaced: [] };
  } catch {}
  const replaced = [],
    ancestors = new Set();
  const note = (path, what) => {
    if (replaced.length < 20) replaced.push(path + ': ' + what);
    return '[' + what + ']';
  };
  const walk = (item, path) => {
    if (item === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof item)) return item;
    if (typeof item === 'bigint') return String(item);
    if (typeof item === 'symbol') return note(path, 'symbol');
    if (typeof item === 'function') return note(path, 'function ' + (item.name || 'anonymous') + ' cannot be returned');
    if (ArrayBuffer.isView(item) || item instanceof ArrayBuffer) {
      if (isViewDetached(item)) return note(path, 'typed array over a detached buffer');
      return item;
    }
    if (ancestors.has(item)) return note(path, 'circular reference');
    ancestors.add(item);
    try {
      if (item instanceof Date) return item;
      if (item instanceof Map) return Object.fromEntries([...item].map(([k, v]) => [String(k), walk(v, path + '.' + String(k))]));
      if (item instanceof Set) return [...item].map((v, i) => walk(v, path + '[' + i + ']'));
      if (Array.isArray(item)) return item.map((v, i) => walk(v, path + '[' + i + ']'));
      return Object.fromEntries(Object.entries(item).map(([k, v]) => [k, walk(v, path + '.' + k)]));
    } catch (error) {
      return note(path, 'unreadable object: ' + (error?.message || error));
    } finally {
      ancestors.delete(item);
    }
  };
  let safe = walk(value, 'value');
  try {
    structuredClone(safe);
  } catch (error) {
    safe = '[The returned value could not be copied: ' + (error?.message || error) + '. Return plain numbers, strings, arrays and objects.]';
    replaced.push('value: not clonable');
  }
  return { value: safe, replaced };
}

// ---- Tool output size (H5) ----
const TYPED_KEEP = 24, ARRAY_KEEP = 40, TEXT_KEEP = 4000, OUTPUT_BUDGET = 60000;
function typedSummary(type, data) {
  let min = Infinity, max = -Infinity;
  for (const x of data) {
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return {
    $type: type,
    length: data.length,
    first: data.slice(0, 6),
    last: data.slice(-3),
    min: data.length ? min : null,
    max: data.length ? max : null,
    note: 'Typed array summarised; mdlxl_read pages the full data (path, offset, limit).',
  };
}
function compact(value, arrayKeep, textKeep) {
  if (Array.isArray(value)) {
    if (value.length > arrayKeep)
      return {
        length: value.length,
        first: value.slice(0, 5).map(v => compact(v, arrayKeep, textKeep)),
        last: value.slice(-2).map(v => compact(v, arrayKeep, textKeep)),
        note: 'Long list summarised; mdlxl_read pages the full data.',
      };
    return value.map(v => compact(v, arrayKeep, textKeep));
  }
  if (typeof value === 'string') return value.length > textKeep ? value.slice(0, textKeep) + '... [' + (value.length - textKeep) + ' more characters]' : value;
  if (value && typeof value === 'object') {
    if (value.$type && Array.isArray(value.$data)) return value.$data.length > TYPED_KEEP ? typedSummary(value.$type, value.$data) : value;
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, compact(v, arrayKeep, textKeep)]));
  }
  return value;
}
// Encoded script values keep small typed arrays whole and summarise large ones; if the
// whole result is still big, long lists and strings are summarised too.
export function limitAiOutput(value, budget = OUTPUT_BUDGET) {
  const size = v => JSON.stringify(v)?.length ?? 0;
  let result = compact(value, Infinity, Infinity);
  if (size(result) <= budget) return result;
  result = compact(value, ARRAY_KEEP, TEXT_KEEP);
  if (size(result) <= budget) return result;
  result = compact(value, 8, 500);
  if (size(result) <= budget) return result;
  const top = value && typeof value === 'object' ? Object.entries(value) : [];
  return {
    truncated: true,
    note: 'Result too large (' + size(value) + ' characters). Return less, or aggregate in the script; mdlxl_read pages model data.',
    keys: top.slice(0, 50).map(([k, v]) => ({ key: k, characters: size(v) })),
  };
}
