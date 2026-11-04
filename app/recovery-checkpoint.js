import { encodeRecovery, recoveryYield } from '../src/recovery-wire.js';
import { retainedForgeAssets } from '../src/forge-assets.js';

const same = (left, right) => !!left && left.length === right.length && left.every((value, i) => value === right[i]);
function signature(target) {
  return [...target.doc.recoverySignature(), target.path, target.uvPreviews, target.animationDrafts,
    target.paintProject, target.paintProject?.revision, target.paintProject?.dirty,
    target.paintOriginalModelBytes, target.paintWorkingModel, target.paintWorkingRevision, target.paintAppliedRevision,
    ...retainedForgeAssets(target.assets).flatMap(asset => [asset.name, asset.bytes, asset.source])];
}

/** One latest checkpoint per document, shared by autosave, tab changes and close.
 * Navigation returns before snapshot work; unchanged tabs never copy history.
 * A concurrent edit invalidates encoding before any partial draft reaches disk. */
export function createRecoveryCheckpointer(write, { binary = true, yieldTask = recoveryYield } = {}) {
  const states = new WeakMap();
  function stateOf(target) {
    let state = states.get(target);
    if (!state) { state = { saved: null, pending: null, interacting: false, epoch: 0, idle: null, release: null }; states.set(target, state); }
    return state;
  }
  // Paint already reports its interaction lifecycle. Wait for its transaction
  // rather than borrowing a raster while a stroke is changing it between yields.
  function setInteracting(target, active) {
    const state = stateOf(target);
    if (state.interacting === active) return;
    state.interacting = active; state.epoch++;
    if (active) state.idle = new Promise(resolve => { state.release = resolve; });
    else { state.release?.(); state.idle = state.release = null; }
  }
  function checkpoint(target) {
    const state = stateOf(target), stampOf = () => [state.epoch, ...signature(target)];
    if (state.pending) return state.pending;
    if (same(state.saved, stampOf())) return Promise.resolve();
    const operation = (async () => {
      for (;;) {
        await yieldTask();
        while (state.interacting) await state.idle;
        const stamp = stampOf();
        if (same(state.saved, stamp)) return;
        const doc = target.doc, snapshot = doc.captureRecoveryState({ compact: true, detached: !binary });
        const envelope = { id: target.id, version: ++target.checkpoint, path: target.path,
          dirty: doc.dirty || Object.keys(target.uvPreviews).length > 0 || Object.keys(target.animationDrafts).length > 0 || !!target.paintProject?.dirty,
          date: new Date().toISOString(), state: snapshot, animationDrafts: target.animationDrafts, uvPreviews: target.uvPreviews,
          paintProject: target.paintProject, paintOriginalModelBytes: target.paintOriginalModelBytes,
          paintWorkingModel: target.paintWorkingModel, paintAppliedRevision: target.paintAppliedRevision,
          forgeAssets: retainedForgeAssets(target.assets) };
        const encoded = binary ? await encodeRecovery(envelope, { yieldTask, current: () => same(stamp, stampOf()) }) : null;
        if (!same(stamp, stampOf())) continue;
        await write(binary ? { id: target.id, version: envelope.version, encoded } : envelope);
        state.saved = stamp;
        if (same(stamp, stampOf())) return;
      }
    })();
    state.pending = operation;
    const clear = () => { if (state.pending === operation) state.pending = null; };
    operation.then(clear, clear); return operation;
  }
  return { checkpoint, setInteracting, flush: targets => Promise.all(targets.map(checkpoint)) };
}
