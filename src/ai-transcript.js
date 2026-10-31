// How a chat's transcript follows the AI's streamed events: what it says, thinks
// and does, in the order it happens. Main records the events into the saved chat
// (AiRecorder) and the console applies the same events to the chat it shows, so
// the thread looks the same live and after it is reopened.

const newReply = () => ({ role: 'assistant', text: '', parts: [] });

// One event applied to `messages`. With `copy`, nothing passed in is changed: the
// list, a changed message and a changed part are copies (the console's React
// state). Without it, they change in place (main's saved chat, where streaming
// text must stay cheap and the recorder keeps its reply).
function reduce(messages, event, copy) {
  let list = messages,
    changed = false;
  const own = () => {
    changed = true;
    if (copy && list === messages) list = [...messages];
  };
  // The message at `index`, ready to change.
  const message = index => {
    own();
    if (copy) list[index] = { ...list[index], parts: [...(list[index].parts || [])] };
    else list[index].parts ||= [];
    return list[index];
  };
  // The reply being written: the last message, or a new one after the user's.
  const reply = () => {
    if (list.at(-1)?.role !== 'assistant') {
      own();
      list.push(newReply());
    }
    return message(list.length - 1);
  };
  // The last (or first) part of any message that passes `test`, as [message, part].
  const find = (test, last = true) => {
    for (let m = last ? list.length - 1 : 0; last ? m >= 0 : m < list.length; m += last ? -1 : 1) {
      const parts = list[m].parts || [],
        p = last ? parts.findLastIndex(test) : parts.findIndex(test);
      if (p >= 0) return [m, p];
    }
    return null;
  };
  const update = ([m, p], change) => {
    const parts = message(m).parts;
    parts[p] = copy ? { ...parts[p], ...change } : Object.assign(parts[p], change);
  };
  switch (event.type) {
    case 'text':
    case 'thinking': {
      if (!event.text) break;
      const target = reply(),
        last = target.parts.at(-1);
      if (event.type === 'text') target.text += event.text;
      if (last?.type === event.type) target.parts[target.parts.length - 1] = copy ? { ...last, text: last.text + event.text } : ((last.text += event.text), last);
      else target.parts.push({ type: event.type, text: event.text });
      break;
    }
    case 'compaction': {
      const running = find(p => p.type === 'compaction' && p.status === 'running');
      if (event.active && !running) reply().parts.push({ type: 'compaction', status: 'running' });
      else if (!event.active && running) update(running, { status: 'done' });
      break;
    }
    case 'question':
      reply().parts.push({ type: 'question', questionId: event.questionId, questions: event.questions, name: event.name, message: event.message, status: 'running' });
      break;
    case 'question-result': {
      const at = find(p => p.type === 'question' && p.questionId === event.questionId, false);
      if (at) update(at, { status: event.status, answers: event.answers, reason: event.reason });
      break;
    }
    // A repeated notice (usage, plan, tool progress) updates its row instead of adding one.
    case 'provider-notice': {
      const part = { type: 'provider-notice', text: event.text, detail: event.detail, severity: event.severity, name: event.name },
        parts = reply().parts,
        same = parts.findIndex(p => p.type === part.type && p.text === part.text && p.name === part.name);
      if (same < 0) parts.push(part);
      else parts[same] = part;
      break;
    }
    case 'tool':
      reply().parts.push({ type: 'tool', id: event.callId, name: event.name, detail: event.detail, ...(event.line ? { line: event.line } : {}), status: 'running' });
      break;
    // A steering message may have split the reply since the tool started.
    case 'tool-result': {
      const at =
        find(p => p.type === 'tool' && event.callId && p.id === event.callId) ||
        find(p => p.type === 'tool' && p.status === 'running' && p.name === event.name);
      if (at) update(at, { status: event.error ? 'error' : 'done', summary: event.summary });
      break;
    }
    case 'worker': {
      const at = find(p => p.type === 'worker' && p.workerId === event.workerId && p.status === 'working');
      if (at && event.status !== 'working') update(at, { status: event.status, report: event.report, cost: event.cost, model: event.model, light: event.light });
      else if (at && event.job && event.job !== at.job) update(at, { job: event.job });
      else if (!at) reply().parts.push({ type: 'worker', workerId: event.workerId, name: event.name, job: event.job, status: event.status, region: event.region, model: event.model, light: event.light });
      break;
    }
    // SD Brain's art brief: a row that fills in once the brief is written.
    case 'art': {
      const parts = reply().parts,
        at = parts.findLastIndex(p => p.type === 'art' && p.status === 'running'),
        change = { status: event.status, text: event.text || '' };
      if (at < 0) parts.push({ type: 'art', ...change });
      else parts[at] = copy ? { ...parts[at], ...change } : Object.assign(parts[at], change);
      break;
    }
    // What the prompt has spent so far, kept with the reply it belongs to.
    case 'cost':
      reply().cost = { usd: event.usd, tokens: event.tokens, model: event.model, light: event.light, ...(event.roles ? { roles: event.roles } : {}) };
      break;
    // A steering message splits the reply where it was sent.
    case 'steer':
      own();
      list.push({ role: 'user', text: event.text, steer: true }, newReply());
      break;
    // The reply that failed shows why, in the thread as well as the console's banner.
    case 'error':
      reply().error = event.text;
      break;
    // MDLxL stopped the job (its tab was closed): one friendly line, not an error.
    case 'stopped':
      reply().notice = event.text;
      break;
  }
  return { list, changed };
}

// The transcript after one event. Nothing passed in is changed; an event that
// changes nothing returns `messages` itself.
export function applyAiEvent(messages, event) {
  return reduce(messages, event, true).list;
}
// The same, changing `messages` in place. Returns whether anything changed.
export function recordAiEvent(messages, event) {
  return reduce(messages, event, false).changed;
}
