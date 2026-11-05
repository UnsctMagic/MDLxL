/** Recovery's in-memory wire format. Disk files retain the existing V8 schema.
 * Encode in short tasks so retained history never monopolizes the editor thread.
 * Views own only their visible bytes; object/view identity is retained without
 * carrying giant unrelated backing buffers across Electron's context bridge. */
const MAGIC = 0x3157524d, LIMIT = 768 * 1024 * 1024, CHUNK = 64 * 1024;
const types = [Uint8Array, Int8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array, BigInt64Array, BigUint64Array];
const text = new TextEncoder(), strings = new TextDecoder('utf-8', { fatal: true });
export const recoveryYield = () => globalThis.scheduler?.yield ? scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
class Writer {
  constructor() { this.chunks = []; this.used = 0; this.size = 0; this.buffer = new Uint8Array(CHUNK); this.view = new DataView(this.buffer.buffer); }
  reserve(n) { if (this.used + n > CHUNK) this.flush(); }
  flush() { if (this.used) { this.chunks.push(this.buffer.subarray(0, this.used)); this.size += this.used; if (this.size > LIMIT) throw Error('Recovery snapshot exceeds768MB. Reduce the undo cache budget.'); this.buffer = new Uint8Array(CHUNK); this.view = new DataView(this.buffer.buffer); this.used = 0; } }
  u8(v) { this.reserve(1); this.view.setUint8(this.used++, v); }
  u32(v) { this.reserve(4); this.view.setUint32(this.used, v, true); this.used += 4; }
  number(v) { this.reserve(8); this.view.setFloat64(this.used, v, true); this.used += 8; }
  bytes(v) { let offset = 0; while (offset < v.length) { if (this.used === CHUNK) this.flush(); const n = Math.min(CHUNK - this.used, v.length - offset); this.buffer.set(v.subarray(offset, offset + n), this.used); this.used += n; offset += n; } }
  string(v) { const bytes = text.encode(v); this.u32(bytes.length); this.bytes(bytes); }
  async finish(yieldTask, current, sliceMs) {
    this.flush(); const result = new Uint8Array(this.size); let offset = 0, deadline = performance.now() + sliceMs;
    for (const chunk of this.chunks) {
      result.set(chunk, offset); offset += chunk.length;
      if (performance.now() >= deadline) { await yieldTask(); if (!current()) return null; deadline = performance.now() + sliceMs; }
    }
    return current() ? result : null;
  }
}

export async function encodeRecovery(value, { yieldTask = recoveryYield, current = () => true, sliceMs = 4 } = {}) {
  const out = new Writer(), seen = new Map(), jobs = [{ value }];
  out.u32(MAGIC); let deadline = performance.now() + sliceMs, operations = 0;
  while (jobs.length) {
    if ((++operations & 127) === 0 && performance.now() >= deadline) {
      await yieldTask(); if (!current()) return null; deadline = performance.now() + sliceMs;
    }
    const job = jobs.pop();
    if (job.keys) {
      if (job.index < job.keys.length) {
        const key = job.keys[job.index++]; out.string(key); jobs.push(job, { value: job.object[key] });
      }
      continue;
    }
    if (job.bytes) {
      const end = Math.min(job.offset + CHUNK, job.bytes.length); out.bytes(job.bytes.subarray(job.offset, end)); job.offset = end;
      if (end < job.bytes.length) jobs.push(job);
      continue;
    }
    const v = job.value;
    if (v === undefined) { out.u8(0); continue; }
    if (v === null) { out.u8(1); continue; }
    if (typeof v === 'boolean') { out.u8(v ? 3 : 2); continue; }
    if (typeof v === 'number') { out.u8(4); out.number(v); continue; }
    if (typeof v === 'string') { out.u8(5); out.string(v); continue; }
    if (typeof v === 'bigint') { out.u8(6); out.string(String(v)); continue; }
    if (typeof v !== 'object') throw Error('Recovery contains an unsupported value.');
    if (seen.has(v)) { out.u8(7); out.u32(seen.get(v)); continue; }
    const id = seen.size; seen.set(v, id);
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) {
      const type = globalThis.Buffer?.isBuffer(v) ? 253 : v instanceof ArrayBuffer ? 254 : v instanceof DataView ? 255 : types.findIndex(Type => v instanceof Type);
      if (type < 0) throw Error('Recovery contains an unsupported binary view.');
      const bytes = v instanceof ArrayBuffer ? new Uint8Array(v) : new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
      out.u8(8); out.u32(id); out.u8(type); out.u32(bytes.length); jobs.push({ bytes, offset: 0 }); continue;
    }
    if (v instanceof Date) { out.u8(9); out.u32(id); out.number(v.getTime()); continue; }
    if (v instanceof RegExp) { out.u8(10); out.u32(id); out.string(v.source); out.string(v.flags); continue; }
    if (v instanceof Map || v instanceof Set) {
      out.u8(v instanceof Map ? 11 : 12); out.u32(id); out.u32(v.size);
      const values = v instanceof Map ? [...v].flat() : [...v];
      for (let i = values.length - 1; i >= 0; i--) jobs.push({ value: values[i] });
      continue;
    }
    const keys = Object.keys(v); out.u8(Array.isArray(v) ? 13 : 14); out.u32(id);
    if (Array.isArray(v)) out.u32(v.length);
    out.u32(keys.length); jobs.push({ keys, index: 0, object: v });
  }
  return current() ? out.finish(yieldTask, current, sliceMs) : null;
}

/** Decode only in the desktop worker (or when explicitly restoring in a browser). */
export function decodeRecovery(input) {
  const bytes = ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
  if (bytes.byteLength > LIMIT) throw Error('Recovery file is too large.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), refs = [];
  let at = 0;
  const need = n => { if (!Number.isSafeInteger(n) || n < 0 || at + n > bytes.length) throw Error('Truncated recovery data.'); };
  const u8 = () => { need(1); return view.getUint8(at++); };
  const u32 = () => { need(4); const v = view.getUint32(at, true); at += 4; return v; };
  const number = () => { need(8); const v = view.getFloat64(at, true); at += 8; return v; };
  const string = () => { const n = u32(); need(n); const v = strings.decode(bytes.subarray(at, at + n)); at += n; return v; };
  if (u32() !== MAGIC) throw Error('Invalid recovery wire format.');
  const root = {}, jobs = [{ set: v => { root.value = v; } }];
  while (jobs.length) {
    const job = jobs.pop();
    if (job.remaining !== undefined) {
      if (!job.remaining) continue;
      job.remaining--; jobs.push(job);
      if (job.kind === 'object') { const key = string(); jobs.push({ set: v => Object.defineProperty(job.object, key, { value: v, writable: true, enumerable: true, configurable: true }) }); }
      else if (job.kind === 'set') jobs.push({ set: v => job.object.add(v) });
      else { let key; jobs.push({ set: v => job.object.set(key, v) }, { set: v => { key = v; } }); }
      continue;
    }
    const type = u8(); let value;
    if (type <= 7) {
      if (type === 0) value = undefined;
      else if (type === 1) value = null;
      else if (type === 2 || type === 3) value = type === 3;
      else if (type === 4) value = number();
      else if (type === 5) value = string();
      else if (type === 6) value = BigInt(string());
      else { const id = u32(); if (id >= refs.length) throw Error('Invalid recovery reference.'); value = refs[id]; }
      job.set(value); continue;
    }
    const id = u32(); if (id !== refs.length) throw Error('Invalid recovery object order.');
    if (type === 8) {
      const kind = u8(), n = u32(); need(n); const data = bytes.slice(at, at + n); at += n;
      if (kind === 253) { if (!globalThis.Buffer) throw Error('Node Buffer recovery requires the desktop worker.'); value = Buffer.from(data.buffer); }
      else if (kind === 254) value = data.buffer;
      else if (kind === 255) value = new DataView(data.buffer);
      else { const Type = types[kind]; if (!Type || n % Type.BYTES_PER_ELEMENT) throw Error('Invalid recovery binary view.'); value = new Type(data.buffer); }
    } else if (type === 9) value = new Date(number());
    else if (type === 10) value = new RegExp(string(), string());
    else if (type >= 11 && type <= 14) {
      value = type === 11 ? new Map() : type === 12 ? new Set() : type === 13 ? new Array(u32()) : {};
      const count = u32(); if (count > bytes.length - at) throw Error('Invalid recovery member count.');
      jobs.push({ remaining: count, kind: type === 11 ? 'map' : type === 12 ? 'set' : 'object', object: value });
    } else throw Error('Invalid recovery value type.');
    refs.push(value); job.set(value);
  }
  if (at !== bytes.length) throw Error('Trailing recovery data.');
  return root.value;
}
