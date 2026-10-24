const http = require('node:http');
const crypto = require('node:crypto');
const { CONTEXT_URI, awarenessText } = require('./ai-awareness.cjs');

function validateArguments(schema, value, path = 'arguments') {
  if (schema.enum && !schema.enum.includes(value)) throw Error(path + ' has an unsupported value.');
  if (schema.type) {
    const accepted = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    if (!accepted.includes(actual) && !(accepted.includes('integer') && Number.isSafeInteger(value)))
      throw Error(path + ' has the wrong type.');
  }
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) ||
      (schema.minimum !== undefined && value < schema.minimum) ||
      (schema.maximum !== undefined && value > schema.maximum))
  )
    throw Error(path + ' is out of range.');
  if (Array.isArray(value)) {
    if (
      (schema.minItems !== undefined && value.length < schema.minItems) ||
      (schema.maxItems !== undefined && value.length > schema.maxItems)
    )
      throw Error(path + ' has the wrong number of items.');
    if (schema.items) value.forEach((v, i) => validateArguments(schema.items, v, path + '[' + i + ']'));
  } else if (value && typeof value === 'object') {
    for (const key of schema.required || [])
      if (!Object.hasOwn(value, key)) throw Error(path + '.' + key + ' is required.');
    for (const [key, child] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw Error('Unsafe argument name.');
      const sub = schema.properties?.[key];
      if (sub) validateArguments(sub, child, path + '.' + key);
      else if (schema.additionalProperties === false) throw Error('Unknown argument: ' + key);
      else if (schema.additionalProperties && typeof schema.additionalProperties === 'object')
        validateArguments(schema.additionalProperties, child, path + '.' + key);
    }
  }
}
function toolContent(value) {
  if (value?.images) {
    if (!Array.isArray(value.images) || !value.images.length || value.images.length > 16)
      throw Error('Invalid viewport capture batch.');
    const { images, ...metadata } = value;
    return [
      ...(Object.keys(metadata).length ? [{ type: 'text', text: JSON.stringify(metadata) }] : []),
      ...images.flatMap((item, index) => [
        { type: 'text', text: `Image ${index + 1}: ${String(item.label || 'Viewport')}` },
        ...toolContent({ image: item.image }),
      ]),
    ];
  }
  if (value?.image) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s.exec(value.image);
    if (!match) throw Error('Invalid viewport capture.');
    const { image, ...metadata } = value;
    return [
      ...(Object.keys(metadata).length ? [{ type: 'text', text: JSON.stringify(metadata) }] : []),
      { type: 'image', mimeType: match[1], data: match[2] },
    ];
  }
  return [{ type: 'text', text: JSON.stringify(value ?? null) }];
}
async function callEditorTool(tools, call, name, args, signal, awareness) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw Error('Unknown tool: ' + name);
  validateArguments(tool.inputSchema, args);
  if (signal?.aborted) throw Error('Request cancelled.');
  try {
    const content = toolContent(await call(name, args, signal));
    if (awareness?.enabled) content.push({ type: 'text', text: awarenessText(awareness.snapshot()) });
    return { content };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: String(error.message || error) }] };
  }
}
async function startMcpServer({
  tools,
  call,
  port = 0,
  token = crypto.randomBytes(32).toString('hex'),
  name = 'MDLxL',
  onCall = () => {},
  awareness,
}) {
  const controllers = new Set(),
    sessions = new Map();
  let actualPort;
  const unsubscribe = awareness?.subscribe(() => {
    const data =
      'event: message\ndata: ' +
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/resources/updated',
        params: { uri: CONTEXT_URI },
      }) +
      '\n\n';
    for (const session of sessions.values())
      if (session.subscribed) for (const stream of session.streams) if (!stream.destroyed) stream.write(data);
  });
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      if (res.destroyed || res.writableEnded) return;
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(value === undefined ? '' : JSON.stringify(value));
    };
    if (
      req.headers.origin ||
      ![`127.0.0.1:${actualPort}`, `localhost:${actualPort}`].includes(req.headers.host)
    )
      return send(403, { error: 'Local clients only.' });
    const bearer = Buffer.from(req.headers.authorization || ''),
      expected = Buffer.from('Bearer ' + token);
    if (bearer.length !== expected.length || !crypto.timingSafeEqual(bearer, expected))
      return send(401, { error: 'Invalid connection token.' });
    if (req.url !== '/mcp') return send(404, { error: 'Not found.' });
    // Forget sessions that have been idle for an hour, so clients cannot grow memory without limit.
    const now = Date.now();
    for (const [id, entry] of sessions)
      if (!entry.streams.size && now - entry.used > 3600000) sessions.delete(id);
    const sessionId = req.headers['mcp-session-id'],
      session = sessions.get(sessionId);
    if (session) session.used = now;
    if (req.method === 'DELETE') {
      if (session) {
        for (const stream of session.streams) stream.end();
        sessions.delete(sessionId);
      }
      return send(200, {});
    }
    if (req.method === 'GET' && awareness) {
      if (!session) return send(404, { error: 'Initialize an MCP session before subscribing.' });
      if (!req.headers.accept?.includes('text/event-stream'))
        return send(406, { error: 'Accept text/event-stream.' });
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      session.streams.add(res);
      res.on('close', () => session.streams.delete(res));
      return;
    }
    if (req.method !== 'POST') return send(405, { error: 'Use MCP Streamable HTTP POST.' });
    if (!req.headers['content-type']?.includes('application/json'))
      return send(415, { error: 'Use application/json.' });
    const controller = new AbortController();
    controllers.add(controller);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    let message;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) {
          send(413, { error: 'Request too large.' });
          return;
        }
        chunks.push(chunk);
      }
      try {
        message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return send(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON.' } });
      }
      if (
        Array.isArray(message) ||
        !message ||
        message.jsonrpc !== '2.0' ||
        typeof message.method !== 'string'
      )
        return send(400, {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32600, message: 'Invalid JSON-RPC request.' },
        });
      if (message.id === undefined) return send(202);
      const params = message.params || {};
      let result;
      switch (message.method) {
        case 'initialize': {
          if (awareness) {
            if (sessions.size >= 64) throw Error('Too many MCP sessions; close an unused client.');
            const id = crypto.randomUUID();
            sessions.set(id, { streams: new Set(), subscribed: false, used: Date.now() });
            res.setHeader('Mcp-Session-Id', id);
          }
          result = {
            protocolVersion: ['2025-03-26', '2025-06-18', '2025-11-25'].includes(params.protocolVersion)
              ? params.protocolVersion
              : '2025-11-25',
            capabilities: {
              tools: { listChanged: false },
              ...(awareness ? { resources: { subscribe: true, listChanged: false } } : {}),
            },
            serverInfo: { name, version: '1.0.0' },
            instructions:
              'Control the live MDLxL editor. Start with mdlxl_context. Preserve unrelated model data and use the captured target token for every action. Complete edits with mdlxl_review inspect and finish. Optional continuous awareness is available at mdlxl://editor/context when the user enables it; updates never change an existing edit target. MDLxL\'s SD Brain setting decides whether Warcraft III SD art direction applies: every mdlxl_context result has sdBrain with the current state and, when it is on, the instructions to follow for that task. It replaces any SD Brain state seen earlier.',
          };
          break;
        }
        case 'ping':
          result = {};
          break;
        case 'resources/list':
          result = {
            resources: awareness
              ? [
                  {
                    uri: CONTEXT_URI,
                    name: 'Live editor context',
                    mimeType: 'application/json',
                    description: 'Optional continuous awareness. Read enabled before using context.',
                  },
                ]
              : [],
          };
          break;
        case 'resources/read':
          if (!awareness || params.uri !== CONTEXT_URI) throw Error('Unknown resource.');
          result = {
            contents: [
              { uri: CONTEXT_URI, mimeType: 'application/json', text: JSON.stringify(awareness.snapshot()) },
            ],
          };
          break;
        case 'resources/subscribe':
        case 'resources/unsubscribe':
          if (!awareness || params.uri !== CONTEXT_URI || !session)
            throw Error('Initialize a session and use the live editor context URI.');
          session.subscribed = message.method === 'resources/subscribe';
          result = {};
          break;
        case 'tools/list':
          result = { tools };
          break;
        case 'tools/call':
          onCall(params.name);
          result = await callEditorTool(
            tools,
            call,
            params.name,
            params.arguments || {},
            controller.signal,
            awareness,
          );
          break;
        default:
          return send(200, {
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: 'Method not found.' },
          });
      }
      send(200, { jsonrpc: '2.0', id: message.id, result });
    } catch (error) {
      send(200, {
        jsonrpc: '2.0',
        id: message?.id ?? null,
        error: { code: -32602, message: String(error.message || error) },
      });
    } finally {
      controllers.delete(controller);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  actualPort = server.address().port;
  const url = `http://127.0.0.1:${actualPort}/mcp`;
  return {
    url,
    port: actualPort,
    token,
    toolNames: tools.map(tool => tool.name),
    config: { mcpServers: { mdlxl: { type: 'http', url, headers: { Authorization: 'Bearer ' + token } } } },
    close: async () => {
      unsubscribe?.();
      for (const c of controllers) c.abort();
      for (const session of sessions.values()) for (const stream of session.streams) stream.end();
      sessions.clear();
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    },
  };
}
module.exports = { startMcpServer, callEditorTool, toolContent, validateArguments };
