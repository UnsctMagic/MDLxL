const { parentPort } = require('node:worker_threads');
const v8 = require('node:v8'), zlib = require('node:zlib');
const wire = import('../src/recovery-wire.js');
parentPort.on('message', async ({ id, payload }) => {
  try {
    const envelope = payload.encoded ? (await wire).decodeRecovery(payload.encoded) : payload;
    if (envelope.id !== payload.id || envelope.version !== payload.version || !envelope.state) throw Error('Recovery payload identity mismatch.');
    const date = new Date().toISOString(), raw = v8.serialize({ ...envelope, date });
    if (raw.length > 768 * 1024 * 1024) throw Error('Recovery snapshot exceeds768MB. Reduce the undo cache budget.');
    const packed = zlib.gzipSync(raw, { level: 1 });
    const metadata = { id: envelope.id, version: envelope.version, name: envelope.state.name, date, bytes: packed.length, dirty: envelope.dirty !== false, path: envelope.path };
    parentPort.postMessage({ id, packed, metadata }, [packed.buffer]);
  } catch (error) { parentPort.postMessage({ id, error: error.message }); }
});
