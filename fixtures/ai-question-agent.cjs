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
    const questions = text.includes('free-text') ? [{ id: 'detail', header: 'Detail', question: 'Which arm should keep the axe?', options: null }] : [
      { id: 'arms', header: 'Arms', question: 'How should I switch the arms?', options },
      { id: 'keep', header: 'Keep', question: 'What should stay unchanged?', options: null },
    ];
    send({ id: 'native-question', method: 'item/tool/requestUserInput', params: { threadId: 'question-thread', turnId: 'question-turn', itemId: 'question-item', isBlocking: true, questions } });
    return;
  }
  if (m.id === 'native-question' && !m.method) {
    fs.appendFileSync('question-answers.jsonl', JSON.stringify(m) + '\n');
    if (m.error) process.exit(9);
    send({ method: 'item/agentMessage/delta', params: { delta: '\n\nAnswer received: ' + Object.values(m.result.answers).flatMap(a => a.answers).join('; ') } });
    send({ method: 'turn/completed', params: { turn: { status: 'completed' } } });
    return;
  }
  send({ id: m.id, result: {} });
});
