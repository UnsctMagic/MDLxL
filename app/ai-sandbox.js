// Loaded ONLY in a disposable sandboxed renderer. The editor's CSP stays strict.
import { aiFunctionCards } from '../src/ai-capabilities.js';
const modules = import.meta.glob(['../src/*.js', '!../src/cli.js']);
const sources = import.meta.glob(['../src/*.js', '!../src/cli.js'], { query: '?raw', import: 'default' });
const names = Object.keys(modules)
  .map(path => path.slice('../src/'.length, -3))
  .sort();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
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
          signatures: aiFunctionCards(source),
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
    window.aiSandbox.finish({ model, selection, assets, value, logs, ...(before ? { before } : {}) });
  } catch (error) {
    window.aiSandbox.finish({ error: String(error.message || error) });
  }
});
