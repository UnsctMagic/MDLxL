// The Transfer window's Transplant builds (app/transplant.worker.js). Only the newest request
// matters: a request for other settings stops a build still running (its worker is ended and a new
// one started), the same request again waits for the one running. The worker keeps the open model
// and the donor between builds, so a setting change sends only the options. When no worker can
// start (or one fails), builds run here instead, after a short wait so the window paints first.
// Pure of React and the DOM: `spawn` makes a worker, `buildHere(request)` returns { model, report }.
export function createTransplantBuilder({ spawn, buildHere, onResult, onSuggestion, wait = (run, ms) => setTimeout(run, ms), stopWait = clearTimeout }) {
  let worker = null, held = null, busy = null, latest = null, broken = false, next = 0, timer = null;
  const end = () => { if (worker) { worker.onmessage = worker.onerror = null; worker.terminate(); } worker = null; held = null; busy = null; };
  const deliver = (request, result) => { if (request === latest) { latest = null; onResult({ key: request.key, ...result }); } };
  const here = request => {
    if (timer != null) stopWait(timer);
    timer = wait(() => {
      timer = null;
      if (request !== latest) return;
      let result; try { const out = buildHere(request); result = { model: out.model, report: out.report }; } catch (error) { result = { error: error.message }; }
      deliver(request, result);
    }, 30);
  };
  const start = () => {
    try { worker = spawn(); } catch { worker = null; }
    if (!worker) { broken = true; return false; }
    held = { model: null, donor: null };
    worker.onmessage = ({ data }) => {
      const request = busy;
      if (!request || data.id !== request.id) return;
      if (data.suggestion || data.suggestionError != null) {
        busy = null;
        const result = data.suggestion ? { suggestion: data.suggestion } : { suggestionError: data.suggestionError };
        onSuggestion?.({ key: request.key, ...result });
        return;
      }
      if (!request.suggest || data.error != null) busy = null;
      deliver(request, data.error != null ? { error: data.error } : { model: data.model, report: data.report });
    };
    worker.onerror = event => {
      event?.preventDefault?.();
      const request = busy;
      end(); broken = true;
      if (latest) here(latest);
      else if (request?.suggest) onSuggestion?.({ key: request.key, suggestionError: event?.message || 'Toggle suggestion worker stopped.' });
    };
    return true;
  };
  const send = request => {
    if (busy) end();
    if (!worker && !start()) { here(request); return; }
    // A model edited in place keeps its object: `modelKey` / `donorKey` (a revision) say it changed.
    for (const part of ['model', 'donor']) {
      const was = held[part], key = request[part + 'Key'];
      if (was?.value === request[part] && was.key === key) continue;
      worker.postMessage({ hold: part, value: request[part] }); held[part] = { value: request[part], key };
    }
    busy = request;
    worker.postMessage({ id: request.id, options: request.options, suggest: request.suggest, automaticMirror: request.automaticMirror });
  };
  return {
    /** Delivers the current build through onResult and, when requested, its later suggestion through onSuggestion. */
    request(request) {
      if (busy?.key === request.key) return;
      latest = { ...request, id: ++next };
      if (broken) here(latest); else send(latest);
    },
    /** Nothing is wanted any more: a running build is stopped. */
    cancel() { latest = null; if (timer != null) { stopWait(timer); timer = null; } if (busy) end(); },
    get building() { return !!latest; },
    dispose() { this.cancel(); end(); },
  };
}
