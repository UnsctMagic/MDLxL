import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import http from 'node:http';
import { AI_TOOLS } from '../src/ai-tools.js';
const { startMcpServer, validateArguments, toolContent } = createRequire(import.meta.url)(
  '../electron/ai-mcp.cjs',
);

test('real MCP HTTP handshake, discover tools, execute and return tool errors', async t => {
  const seen = [],
    server = await startMcpServer({
      tools: AI_TOOLS,
      call: async (name, args) => {
        seen.push({ name, args });
        if (name === 'mdlxl_patch') throw Error('stale target');
        return { selection: { 0: [2, 4] } };
      },
    });
  t.after(() => server.close());
  const rpc = async (method, params = {}) =>
    (
      await fetch(server.url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + server.token, 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      })
    ).json();
  const initialized = (await rpc('initialize', { protocolVersion: '2025-11-25' })).result;
  assert.equal(initialized.protocolVersion, '2025-11-25');
  // The SD Brain state is read per task from mdlxl_context, not fixed at connect time.
  assert.match(initialized.instructions, /every mdlxl_context result has sdBrain/);
  assert.ok(!initialized.instructions.includes('Warcraft III SD modeling rulebook'));
  assert.ok((await rpc('tools/list')).result.tools.some(t => t.name === 'mdlxl_script'));
  assert.deepEqual(
    JSON.parse((await rpc('tools/call', { name: 'mdlxl_context', arguments: {} })).result.content[0].text)
      .selection,
    { 0: [2, 4] },
  );
  const result = await rpc('tools/call', {
    name: 'mdlxl_patch',
    arguments: {
      target: 'a',
      label: 'edit',
      scope: ['/Geosets'],
      operations: [{ op: 'set', path: '/Geosets/0/Vertices/0', value: 5 }],
    },
  });
  assert.equal(result.result.isError, true);
  assert.match(result.result.content[0].text, /stale/);
  assert.equal(seen.length, 2);
  assert.equal(
    (await rpc('tools/call', { name: 'mdlxl_script', arguments: { code: 'return 1;' } })).error.code,
    -32602,
  );
});
test('MCP refuses unauthenticated, browser-origin and wrong-host requests', async t => {
  let called = false;
  const server = await startMcpServer({
    tools: AI_TOOLS,
    call: () => {
      called = true;
    },
  });
  t.after(() => server.close());
  const base = { method: 'POST', body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' };
  assert.equal((await fetch(server.url, base)).status, 401);
  assert.equal(
    (
      await fetch(server.url, {
        ...base,
        headers: { Authorization: 'Bearer ' + server.token, Origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
  const wrongHost = await new Promise((resolve, reject) => {
    const req = http.request(
      server.url,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + server.token,
          Host: 'evil.example',
          'content-type': 'application/json',
        },
      },
      res => {
        res.resume();
        resolve(res.statusCode);
      },
    );
    req.on('error', reject);
    req.end(base.body);
  });
  assert.equal(wrongHost, 403);
  assert.equal(called, false);
});
test('MCP viewport captures are actual image content', async t => {
  const server = await startMcpServer({
    tools: AI_TOOLS,
    call: () => ({ image: 'data:image/png;base64,aGVsbG8=' }),
  });
  t.after(() => server.close());
  const response = await fetch(server.url, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + server.token, 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'mdlxl_capture', arguments: { target: 'test' } },
    }),
  });
  const data = await response.json();
  assert.equal(data.result.content[0].type, 'image');
  assert.equal(data.result.content[0].mimeType, 'image/png');
});
test('schema rejects prototype pollution, wrong types and unknown control actions', () => {
  const schema = AI_TOOLS.find(t => t.name === 'mdlxl_view').inputSchema;
  assert.throws(() => validateArguments(schema, { target: 'x', sequence: 1.5 }), /type/);
  assert.throws(() => validateArguments(schema, { target: 'x', view: 'arbitrary' }), /unsupported/);
  assert.throws(() => validateArguments(schema, JSON.parse('{"target":"x","__proto__":{}}')), /Unsafe/);
});

test('multiple viewport images retain their view/frame labels in MCP content', () => {
  const content = toolContent({
    images: [
      { label: 'front; frame 0', image: 'data:image/png;base64,aGVsbG8=' },
      { label: 'side; frame 500', image: 'data:image/png;base64,d29ybGQ=' },
    ],
  });
  assert.deepEqual(
    content.map(c => c.type),
    ['text', 'image', 'text', 'image'],
  );
  assert.match(content[2].text, /frame 500/);
  assert.equal(content[3].data, 'd29ybGQ=');
  assert.throws(() => toolContent({ images: [] }), /Invalid/);
});
