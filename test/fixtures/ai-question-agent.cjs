// Native Codex protocol fixture: never contacts a provider or edits a model.
const fs = require('node:fs');
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const options = [{ label: 'Swap animation', description: 'Exchange the left and right arm motion.' }, { label: 'Swap sides', description: 'Move the physical arms to opposite sides.' }];
require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (m.id === undefined) return;
  if (m.method === 'initialize') return send({ id: m.id, result: { userAgent: 'fixture' } });
  if (m.method === 'account/read') return send({ id: m.id, result: { account: { type: 'chatgpt', planType: 'plus' } } });
  if (m.method === 'thread/start' || m.method === 'thread/resume') return send({ id: m.id, result: { thread: { id: 'question-thread' } } });
  if (m.method === 'turn/start') {
    send({ id: m.id, result: { turn: { id: 'question-turn' } } });
    send({ method: 'item/agentMessage/delta', params: { delta: 'I need to clarify the arm swap.' } });
    const text = m.params.input[0].text;
    if (text.includes('protocol-warnings')) {
      for (const [method, params] of [
        ['warning', { message: 'Fixture warning remains readable after later activity.' }],
        ['configWarning', { summary: 'Fixture connection warning', details: 'Check the selected provider setting.' }],
        ['account/rateLimits/updated', { rateLimits: { primary: { usedPercent: 0, resetsAt: 1234 } } }],
        ['model/rerouted', { fromModel: 'fixture-model', toModel: 'fixture-fallback', reason: 'test' }],
        ['turn/plan/updated', { plan: [{ step: 'Inspect the arms', status: 'completed' }] }],
      ]) send({ method, params });
      send({ method: 'item/agentMessage/delta', params: { delta: 'Later activity did not erase the warnings.' } });
      send({ method: 'turn/completed', params: { turn: { id: 'question-turn', status: 'completed' } } });
      return;
    }
    if (text.includes('mcp-form')) {
      send({ id: 'mcp-question', method: 'mcpServer/elicitation/request', params: { threadId: 'question-thread', turnId: 'question-turn', serverName: 'mdlxl', mode: 'form', message: 'Choose the requested model settings', requestedSchema: { type: 'object', required: ['copies', 'visible', 'parts'], properties: {
        copies: { type: 'integer', minimum: 1, maximum: 4, title: 'Copy count' }, visible: { type: 'boolean', title: 'Keep visible?' },
        parts: { type: 'array', title: 'Keep these parts', items: { type: 'string', enum: ['Shoulders', 'Axe'] } }, note: { type: 'string', title: 'Optional note' },
      } } } });
      return;
    }
    const questions = text.includes('free-text') ? [{ id: 'detail', header: 'Detail', question: 'Which arm should keep the axe?', options: null }] : [
      { id: 'arms', header: 'Arms', question: 'How should I switch the arms?', options },
      { id: 'keep', header: 'Keep', question: 'What should stay unchanged?', options: null },
    ];
    send({ id: 'native-question', method: 'item/tool/requestUserInput', params: { threadId: 'question-thread', turnId: 'question-turn', itemId: 'question-item', isBlocking: !text.includes('nonblocking') && !text.includes('provider-cancel') && !text.includes('turn-ended'), questions } });
    if (text.includes('nonblocking')) send({ method: 'item/agentMessage/delta', params: { delta: 'I am inspecting while your question stays open.' } });
    if (text.includes('provider-cancel')) setTimeout(() => { send({ method: 'serverRequest/resolved', params: { requestId: 'native-question', threadId: 'question-thread' } }); send({ method: 'turn/completed', params: { turn: { id: 'question-turn', status: 'completed' } } }); }, 700);
    if (text.includes('turn-ended')) setTimeout(() => send({ method: 'turn/completed', params: { turn: { id: 'question-turn', status: 'completed' } } }), 700);
    return;
  }
  if (m.id === 'mcp-question' && !m.method) {
    fs.appendFileSync('question-answers.jsonl', JSON.stringify(m) + '\n');
    send({ method: 'item/agentMessage/delta', params: { delta: 'MCP settings received: ' + JSON.stringify(m.result?.content) } });
    send({ method: 'turn/completed', params: { turn: { id: 'question-turn', status: 'completed' } } });
    return;
  }
  if (m.id === 'native-question' && !m.method) {
    fs.appendFileSync('question-answers.jsonl', JSON.stringify(m) + '\n');
    if (m.error) { if (m.error.code !== -32800) process.exit(9); send({ method: 'turn/completed', params: { turn: { id: 'question-turn', status: 'completed' } } }); return; }
    send({ method: 'item/agentMessage/delta', params: { delta: '\n\nAnswer received: ' + Object.values(m.result.answers).flatMap(a => a.answers).join('; ') } });
    send({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
    return;
  }
  send({ id: m.id, result: {} });
});
