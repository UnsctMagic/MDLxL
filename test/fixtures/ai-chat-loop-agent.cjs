// Fake native provider: fail one display call, then read and finish normally.
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (m.id === undefined) return;
  if (m.method === 'initialize') return send({ id: m.id, result: { userAgent: 'loop-fixture' } });
  if (m.method === 'account/read') return send({ id: m.id, result: { account: { type: 'chatgpt', planType: 'plus' } } });
  if (['thread/start', 'thread/resume'].includes(m.method)) return send({ id: m.id, result: { thread: { id: 'fixture-thread' } } });
  if (m.method === 'turn/start') {
    send({ id: m.id, result: { turn: { id: 'fixture-turn' } } });
    send({ id: 'display', method: 'item/tool/call', params: { namespace: 'mdlxl', tool: 'mdlxl_command', arguments: { target: 'selected', id: 'showAllGeosets' } } });
    return;
  }
  if (m.id === 'display' && !m.method) {
    if (m.result?.success !== false || !/timed out/.test(JSON.stringify(m.result.contentItems))) process.exit(9);
    send({ id: 'read', method: 'item/tool/call', params: { namespace: 'mdlxl', tool: 'mdlxl_context', arguments: { target: 'selected' } } });
    return;
  }
  if (m.id === 'read' && !m.method) {
    if (!m.result?.success) process.exit(10);
    send({ method: 'item/agentMessage/delta', params: { delta: 'Continued after the display failure.' } });
    send({ method: 'turn/completed', params: { turn: { id: 'fixture-turn', status: 'completed' } } });
    return;
  }
  send({ id: m.id, result: {} });
});
