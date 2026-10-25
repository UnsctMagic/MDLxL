// Loaded ONLY in a disposable sandboxed renderer. The editor's CSP stays strict.
const modules = import.meta.glob(['../src/*.js', '!../src/cli.js']);
const sources = import.meta.glob(['../src/*.js', '!../src/cli.js'], { query: '?raw', import: 'default' });
const names = Object.keys(modules)
  .map(path => path.slice('../src/'.length, -3))
  .sort();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
// Await promises nested in plain arrays and objects of a script's return value (a few levels deep).
async function settleValue(value, depth = 0) {
  if (value && typeof value.then === 'function') return settleValue(await value, depth);
  if (depth > 6 || !value || typeof value !== 'object' || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) return Promise.all(value.map(v => settleValue(v, depth + 1)));
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return value;
  const entries = await Promise.all(Object.entries(value).map(async ([k, v]) => [k, await settleValue(v, depth + 1)]));
  return Object.fromEntries(entries);
}
window.aiSandbox.onRun(async payload => {
  try {
    const logs = [];
    const api = {
      modules: names,
      module: async name => {
        const loader = modules[`../src/${name}.js`];
        if (!loader) throw Error('Unknown module. Inspect api.modules.');
        return loader();
      },
      source: async (name, offset = 0, limit = 16000) => {
        const loader = sources[`../src/${name}.js`];
        if (!loader) throw Error('Unknown module.');
        const text = await loader();
        return {
          module: name,
          offset,
          total: text.length,
          text: text.slice(offset, offset + limit),
          truncated: offset + limit < text.length,
        };
      },
      describe: async name => {
        const exports = await api.module(name);
        const source = await sources[`../src/${name}.js`]();
        return {
          exports: Object.fromEntries(Object.entries(exports).map(([key, value]) => [key, typeof value])),
          signatures: [...source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)\s*\(([^]*?)\)\s*\{/g)].map(
            match => ({ name: match[1], arguments: match[2] }),
          ),
          source: 'Read (await api.source("' + name + '")).text for the implementation; api.source returns {module,text,offset,total,truncated}.',
        };
      },
    };
    const { model, selection, context, references, code, before } = payload,
      assets = [];
    const value = await new AsyncFunction(
      'model',
      'selection',
      'context',
      'references',
      'api',
      'assets',
      'before',
      'log',
      '"use strict";\n' + code,
    )(model, selection, context, references, api, assets, before, (...values) => {
      if (logs.length < 100)
        logs.push(
          values
            .map(v => (typeof v === 'string' ? v : JSON.stringify(v)))
            .join(' ')
            .slice(0, 10000),
        );
    });
    // A promise left inside the returned value (api.describe without await) is finished here; anything else
    // that cannot travel back (functions, live objects) gets a plain explanation instead of a clone error.
    const settled = await settleValue(value);
    try {
      window.aiSandbox.finish({ model, selection, assets, value: settled, logs, ...(before ? { before } : {}) });
    } catch (error) {
      if (!/could not be cloned/i.test(String(error?.message))) throw error;
      throw Error('The script returned something that cannot be sent back (a function or a live object). Return plain data: numbers, strings, arrays and plain objects; await every promise.');
    }
  } catch (error) {
    window.aiSandbox.finish({ error: String(error.message || error) });
  }
});
