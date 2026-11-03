import { clearEditorData } from '../src/editor-data.js';

const pending = new WeakMap();

/** Run the existing verified serializer in a worker, just like GIF export.
 * The detached snapshot also associates the saved bytes with the right revision
 * if the live document changes while the worker or disk operation is pending.
 */
export function prepareModelSaveAsync(doc, format = doc.format, name = doc.name,
  createWorker = () => new Worker(new URL('./model-save.worker.js', import.meta.url), { type: 'module' })) {
  let jobs = pending.get(doc);
  if (!jobs) { jobs = new Map(); pending.set(doc, jobs); }
  const key = JSON.stringify([doc.revision, format, name]);
  if (jobs.has(key)) return jobs.get(key);
  const operation = new Promise((resolve, reject) => {
    let worker;
    try {
      const snapshot = doc.captureRecoveryState({ includeHistory: false });
      worker = createWorker();
      const fail = error => { worker.terminate(); reject(error); };
      worker.onerror = event => fail(new Error(event.message || 'Model save worker failed.'));
      worker.onmessageerror = () => fail(new Error('Model save worker returned unreadable data.'));
      worker.onmessage = ({ data }) => {
        worker.terminate();
        doc.lastSaveTimings = data.timings;
        if (data.error) { reject(new Error(data.error)); return; }
        doc.rememberSerializedSnapshot(data.bytes, snapshot.model, snapshot.revision);
        if (data.withoutEditorData) {
          const cleaned = structuredClone(snapshot.model); clearEditorData(cleaned);
          doc.rememberSerializedSnapshot(data.withoutEditorData, cleaned, snapshot.revision);
        }
        resolve(data);
      };
      worker.postMessage({ snapshot, format, name });
    } catch (error) { worker?.terminate(); reject(error); }
  });
  jobs.set(key, operation);
  const clear = () => {
    jobs.delete(key);
    if (!jobs.size) pending.delete(doc);
  };
  operation.then(clear, clear);
  return operation;
}
