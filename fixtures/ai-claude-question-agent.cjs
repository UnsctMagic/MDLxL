// Local Claude control-protocol fixture; no credentials, real tool execution or network.
const fs = require('node:fs');
const args = process.argv.slice(2);
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
if (args[0] === 'auth') { send({ loggedIn: true, authMethod: 'fixture' }); process.exit(0); }
const tools = args[args.indexOf('--tools') + 1].split(',');
if (!tools.includes('AskUserQuestion') || tools.some(t => !['AskUserQuestion', 'WebSearch', 'WebFetch'].includes(t)) || args[args.indexOf('--permission-prompt-tool') + 1] !== 'stdio' || args.includes('--dangerously-skip-permissions')) process.exit(8);
const questions = [{ question: 'Which parts should stay unchanged?', header: 'Keep', options: [{ label: 'Shoulders', description: 'Preserve shoulder position' }, { label: 'Axe', description: 'Preserve the axe size' }], multiSelect: true }];
require('node:readline').createInterface({ input: process.stdin }).on('line', line => {
  const m = JSON.parse(line);
  if (m.type === 'control_request' && m.request.subtype === 'initialize') return send({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: {} } });
  if (m.type === 'user') {
    send({ type: 'system', subtype: 'warning', message: 'Claude fixture warning remains readable.' });
    send({ type: 'control_request', request_id: 'claude-question', request: { subtype: 'can_use_tool', tool_name: 'AskUserQuestion', input: { questions } } });
    if (m.message.content[0].text.includes('cancel-by-provider')) { send({ type: 'control_cancel_request', request_id: 'claude-question' }); setTimeout(() => send({ type: 'result', is_error: false, result: 'Claude cancelled its question.' }), 100); }
    return;
  }
  if (m.type === 'control_response') {
    fs.appendFileSync('claude-control-answers.jsonl', JSON.stringify(m) + '\n');
    if (m.response.request_id === 'claude-question') {
      send({ type: 'control_request', request_id: 'blocked-bash', request: { subtype: 'can_use_tool', tool_name: 'Bash', input: { command: 'echo must never run' } } });
      return;
    }
    if (m.response.request_id === 'blocked-bash') {
      if (m.response.response.behavior !== 'deny') process.exit(9);
      send({ type: 'result', session_id: 'claude-question-thread', is_error: false, result: 'Claude received the answer. Terminal remained disabled.' });
    }
  }
});
