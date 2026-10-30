import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { toolDetail } = require('../electron/ai-providers.cjs');
const bundle = await build({ entryPoints: [fileURLToPath(new URL('../app/AiParts.jsx', import.meta.url))],
  bundle: true, write: false, format: 'cjs', platform: 'node', packages: 'external', logLevel: 'silent' });
const module = { exports: {} };
// Render the real tool step in its expanded state; no product exports or UI hooks are added.
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(
  name => name === 'react' ? { ...React, useState: () => [true, () => {}] } : require(name), module, module.exports);
const { AssistantMessage } = module.exports;
const body = part => {
  const html = renderToStaticMarkup(React.createElement(AssistantMessage, {
    message: { role: 'assistant', parts: [{ type: 'tool', name: 'mdlxl_plan', status: 'done', ...part }] },
  }));
  return html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1];
};
const plan = { cause: 'A gap', reach: 'Helmet rim', keep: ['Shape'],
  options: [{ fix: 'Weld the rim', cost: 'No texture change' }], choice: 0, why: 'Closes the gap' };

test('ordinary plans retain their readable lines and chosen option', () => {
  const text = body({ detail: JSON.stringify(plan) });
  assert.match(text, /Cause: A gap/);
  assert.match(text, /Keeps: Shape/);
  assert.match(text, /1\. Weld the rim \(No texture change\)  .*chosen/);
  assert.match(text, /Why: Closes the gap/);
});

test('many-entry provider details render as readable plans with omission markers', () => {
  const text = 'x'.repeat(62);
  const detail = toolDetail({ ...plan, target: text, cause: text, reach: text, why: text,
    keep: Array(20).fill(text), options: Array.from({ length: 6 }, () => ({ fix: text, cost: text })),
    checks: Array(20).fill(text) });
  const shown = body(detail);
  assert.match(shown, /Cause: /);
  assert.match(shown, /Options:/);
  assert.match(shown, /\+\d+ more/);
  assert.doesNotMatch(shown, /undefined|&quot;cause&quot;|plan too long to show/);
});

test('omitted options render as a plain marker rather than undefined option fields', () => {
  const text = body({ detail: JSON.stringify({ ...plan, options: [...plan.options, '+5 more'] }) });
  assert.match(text, /Options:[\s\S]*\+5 more/);
  assert.doesNotMatch(text, /undefined/);
});

test('old cut-off plan chats show their saved short line or the one-line fallback', () => {
  const detail = '{"cause":"raw cut-off data';
  assert.equal(body({ detail, line: 'Weld only the rim' }), 'Weld only the rim');
  assert.equal(body({ detail }), 'plan too long to show');
  assert.equal(body({ name: 'mcp__mdlxl__mdlxl_plan', detail }), 'plan too long to show');
});
