import { searchAiCapabilities } from '../src/ai-capabilities.js';

const sources = import.meta.glob(['../src/*.js', '!../src/cli.js'], { query: '?raw', import: 'default' });
let catalog;
export async function aiCapabilities(args) {
  catalog ??= Promise.all(
    Object.entries(sources).map(async ([file, load]) => [file.slice('../src/'.length, -3), await load()]),
  ).then(Object.fromEntries);
  return searchAiCapabilities(await catalog, args);
}
