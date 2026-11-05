const { Worker } = require('node:worker_threads');
const path = require('node:path');
/** One lazy recovery encoder. No large object serialization on Electron's main thread. */
class RecoveryEncoder {
  constructor() { this.worker = null; this.pending = new Map(); this.serial = 0; this.idle = null; }
  async run(payload) {
    // Legacy callers can still pass an envelope. Encode cooperatively before
    // worker transfer so Node Buffers retain their type and no graph clone blocks main.
    if (!payload.encoded) {
      const { encodeRecovery } = await import('../src/recovery-wire.js');
      payload = { id: payload.id, version: payload.version, encoded: await encodeRecovery(payload) };
    }
    clearTimeout(this.idle);
    if (!this.worker) {
      const worker = this.worker = new Worker(path.join(__dirname, 'recovery-worker.cjs'));
      const fail = error => { if (this.worker !== worker) return; this.worker = null; for (const job of this.pending.values()) job.reject(error); this.pending.clear(); void worker.terminate(); };
      worker.on('error', fail);
      worker.on('exit', code => { if (this.worker === worker) fail(Error('Recovery worker stopped (' + code + ').')); });
      worker.on('message', result => {
        const job = this.pending.get(result.id); if (!job) return;
        this.pending.delete(result.id); result.error ? job.reject(Error(result.error)) : job.resolve(result);
        if (!this.pending.size) { this.idle = setTimeout(() => this.close(), 1000); this.idle.unref(); }
      });
      worker.unref();
    }
    return new Promise((resolve, reject) => {
      const id = ++this.serial; this.pending.set(id, { resolve, reject });
      // Ref until acknowledged: tests and shutdown must not exit during a write.
      this.worker.ref();
      // Move rather than copy (up to 768 MB) a buffer that holds only this snapshot;
      // nothing reads payload.encoded after this. Pooled, shared or untransferable buffers are copied.
      const bytes = payload.encoded, size = bytes?.byteLength, own = bytes?.buffer instanceof ArrayBuffer && bytes.byteOffset === 0 && size > 0 && size === bytes.buffer.byteLength;
      try {
        try { this.worker.postMessage({ id, payload }, own ? [bytes.buffer] : []); }
        catch (error) { if (!own || bytes.byteLength !== size) throw error; this.worker.postMessage({ id, payload }); }
      } catch (error) { this.pending.delete(id); reject(error); }
    });
  }
  async close() {
    clearTimeout(this.idle);
    if (this.pending.size) throw Error('Recovery encoding is still in progress.');
    const worker = this.worker; this.worker = null; if (worker) await worker.terminate();
  }
}
module.exports = { RecoveryEncoder };
