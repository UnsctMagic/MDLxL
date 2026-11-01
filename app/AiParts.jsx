import React, { useEffect, useRef, useState } from 'react';
import { Brain, Check, ChevronRight, Frown, LoaderCircle, X } from 'lucide-react';
import AiMessage from './AiMessage.jsx';
import { translate } from '../src/localization.js';

// The parts of an AI reply in the console thread: what the AI says, thinks and
// does, questions, notices and cost.
export const activity = {
  mdlxl_context: 'Inspecting the model',
  mdlxl_capabilities: 'Finding modeling tools',
  mdlxl_sample: 'Inspecting the model',
  mdlxl_assets: 'Checking model files',
  mdlxl_read: 'Reading model data',
  mdlxl_script: 'Working on the model',
  mdlxl_patch: 'Applying a precise edit',
  mdlxl_select: 'Selecting model elements',
  mdlxl_command: 'Using an editor tool',
  mdlxl_view: 'Inspecting a view',
  mdlxl_capture: 'Checking the viewport',
  mdlxl_document: 'Checking model files',
  mdlxl_help: 'Reading MDLxL help',
  mdlxl_ui: 'Using program controls',
  mdlxl_review: 'Checking the result',
  mdlxl_plan: 'Planning the change',
  mdlxl_versions: 'Comparing versions',
  outside_check: 'Outside check',
};
export const toolName = name => name?.replace(/^mcp__mdlxl__/, '');
// One readable line under a tool step, from the arguments the AI sent. Main
// sends it as `line`; chats saved before that read it from the detail.
function detailLine(detail, line) {
  if (line) return line;
  if (!detail) return '';
  try {
    const value = JSON.parse(detail);
    const line = value.label || value.id || value.action || value.query || value.name || '';
    return typeof line === 'string' ? line : '';
  } catch {
    return '';
  }
}

function ThinkingPart({ part, live }) {
  const [open, setOpen] = useState(false),
    body = useRef();
  useEffect(() => {
    if (live && !open && body.current) body.current.scrollTop = body.current.scrollHeight;
  });
  return (
    <div className={'ai-thinking' + (open ? ' ai-open-part' : '') + (live ? ' ai-live' : '')}>
      <button
        type="button"
        className="ai-part-toggle"
        aria-expanded={open}
        title="What the AI thought. Click to show."
        onClick={() => setOpen(!open)}
      >
        <ChevronRight size={13} aria-hidden="true" />
        {live ? 'Thinking…' : 'Thought process'}
      </button>
      <div ref={body} className="ai-thinking-text">
        {part.text.trim()}
      </div>
    </div>
  );
}
// SD Brain's art direction for the request: collapsed to one row until clicked.
function ArtPart({ part }) {
  const [open, setOpen] = useState(false),
    running = part.status === 'running';
  return (
    <div className={'ai-thinking ai-art' + (open ? ' ai-open-part' : '') + (running ? ' ai-live' : '')}>
      <button
        type="button"
        className="ai-part-toggle"
        aria-expanded={open}
        disabled={running || !part.text}
        title={
          part.status === 'error'
            ? 'SD Brain could not write the art direction; the work continued without it. Click for the reason.'
            : 'The SD art direction SD Brain wrote for this request. Click to show.'
        }
        onClick={() => setOpen(!open)}
      >
        <Brain size={13} aria-hidden="true" />
        {running ? 'Planning the art direction…' : part.status === 'error' || !part.text ? 'Art direction unavailable' : 'Art direction'}
      </button>
      <div className="ai-thinking-text">{part.text}</div>
    </div>
  );
}
// The chat grew past what the AI can hold, so it summarizes older messages first.
function CompactionPart({ part }) {
  const running = part.status === 'running';
  return (
    <div
      className={'ai-compaction' + (running ? ' ai-live' : '')}
      role="status"
      title="The chat is too long, so the AI is summarizing older messages."
    >
      <Frown size={15} aria-hidden="true" />
      {running ? 'Compacting context… the chat got too long' : 'Context compacted: older messages were summarized'}
    </div>
  );
}
// The AI's plan as plain lines instead of the data it sent.
function readablePlan(detail, line) {
  try {
    const plan = JSON.parse(detail);
    return [
      translate('Cause:') + ' ' + plan.cause,
      translate('Reaches:') + ' ' + plan.reach,
      translate('Keeps:') + ' ' + (plan.keep || []).map(item => /^\+\d+ more$/.test(item) ? translate(item) : item).join('; '),
      translate('Options:'),
      ...(plan.options || []).map((option, index) => typeof option === 'string' ? '  ' + (/^\+\d+ more$/.test(option) ? translate(option) : option) : `  ${index + 1}. ${option.fix} (${option.cost})${index === plan.choice ? '  ← ' + translate('chosen') : ''}`),
      translate('Why:') + ' ' + plan.why,
    ].join('\n');
  } catch {
    return line || translate('plan too long to show');
  }
}
function ToolPart({ part }) {
  const [open, setOpen] = useState(false),
    name = toolName(part.name),
    line = detailLine(part.detail, part.line);
  return (
    <div className={'ai-step ai-step-' + part.status + (open ? ' ai-open-part' : '')}>
      <button
        type="button"
        className="ai-part-toggle"
        aria-expanded={open}
        title="A step the AI took. Click for details."
        onClick={() => setOpen(!open)}
      >
        <span className="ai-step-icon" aria-hidden="true">
          {part.status === 'running' ? (
            <LoaderCircle size={13} className="ai-spin" />
          ) : part.status === 'error' || part.status === 'stopped' ? (
            <X size={13} />
          ) : (
            <Check size={13} />
          )}
        </span>
        <span className="ai-step-label">{activity[name] || 'Using the editor'}</span>
        {line && (
          <span className="ai-step-detail" translate="no">
            {line}
          </span>
        )}
      </button>
      {open && (
        <pre className="ai-step-body" translate="no">
          {name === 'mdlxl_plan' ? readablePlan(part.detail, line) : name}
          {part.detail && name !== 'mdlxl_plan' ? '\n' + part.detail : ''}
          {part.summary ? '\n\n→ ' + part.summary : ''}
        </pre>
      )}
    </div>
  );
}
// What one API prompt cost: dollars for known Anthropic models, otherwise tokens.
function CostLine({ cost }) {
  const tokens = cost.tokens == null ? 'tokens unavailable' : cost.tokens.toLocaleString() + ' tokens';
  const roles = Object.entries(cost.roles || {}).map(([role, use]) => `${role}: ${use.calls} ${use.unit === 'turn' ? 'provider turns' : 'calls'} · ${use.tokens === null ? 'tokens unavailable' : use.tokens.toLocaleString() + ' tokens'}`).join(' | ');
  return (
    <div
      className="ai-cost"
      title="What this prompt has cost on your API key so far. Each step resends the conversation; repeated text is billed at a lower rate."
    >
      {cost.model && <span>{cost.model} · </span>}
      {roles || (cost.usd === null ? tokens : `About ${cost.usd < 0.01 ? '0.01' : cost.usd.toFixed(2)} · ${tokens}`)}
    </div>
  );
}
function QuestionPart({ part }) {
  const [values, setValues] = useState({}), [custom, setCustom] = useState({}),
    [sending, setSending] = useState(false), [error, setError] = useState('');
  const pending = part.status === 'running';
  const answer = q => [...(values[q.id] || []), ...(custom[q.id]?.trim() ? [custom[q.id].trim()] : [])];
  async function submit(event, cancel = false) {
    event.preventDefault();
    if (sending || !pending) return;
    setSending(true); setError('');
    try {
      await window.desktop.aiAnswerQuestion({ questionId: part.questionId, cancel,
        answers: Object.fromEntries(part.questions.map(q => [q.id, { answers: answer(q) }])) });
    } catch (reason) { setError(reason.message); }
    finally { setSending(false); }
  }
  return <form className="ai-question" onSubmit={submit}>
    <div className="ai-message-note">{part.name && <span translate="no">{part.name}: </span>}{pending ? 'Waiting for your answer' : part.status === 'done' ? 'Answered' : 'Question stopped'}</div>
    {part.message && <p translate="no">{part.message}</p>}
    {part.questions.map(q => <fieldset key={q.id} disabled={!pending || sending}>
      <legend><span translate="no">{q.question}</span>{q.required === false && <small title={q.multiSelect ? undefined : 'Click a chosen answer again to clear it.'}> (optional)</small>}</legend>
      {q.description && <p translate="no">{q.description}</p>}
      {q.link && <a href={q.link} target="_blank" rel="noreferrer" onClick={event => { event.preventDefault(); window.desktop.aiQuestionLink({ questionId: part.questionId, id: q.id }).catch(reason => setError(reason.message)); }} title="Opens this address in your web browser.">Open input page</a>}
      {q.link && <small translate="no"> {linkHost(q.link)}</small>}
      {pending ? <>
        {!q.isSecret && (q.options || []).map((option, index) => <label key={index} className="ai-question-option">
          <input type={q.multiSelect ? 'checkbox' : 'radio'} name={part.questionId + ':' + q.id} checked={(values[q.id] || []).includes(option.label)}
            onClick={() => { if (!q.multiSelect && q.required === false && (values[q.id] || []).includes(option.label)) setValues(old => ({ ...old, [q.id]: [] })); }}
            onChange={event => { const checked = event.target.checked; setValues(old => ({ ...old, [q.id]: q.multiSelect ? checked ? [...(old[q.id] || []), option.label] : (old[q.id] || []).filter(v => v !== option.label) : [option.label] })); if (!q.multiSelect) setCustom(old => ({ ...old, [q.id]: '' })); }} />
          <span translate="no"><b>{option.label}</b>{option.description && <small>{option.description}</small>}</span>
        </label>)}
        {q.allowCustom !== false && <input type={q.isSecret ? 'password' : q.inputType || 'text'} aria-label={q.question} autoComplete="off"
          min={q.minimum} max={q.maximum} minLength={q.minLength} maxLength={q.maxLength} step={q.step}
          placeholder={q.options?.length ? 'Or type your answer' : 'Your answer'} value={custom[q.id] || ''}
          onChange={event => { const value = event.target.value; setCustom(old => ({ ...old, [q.id]: value })); if (!q.multiSelect) setValues(old => ({ ...old, [q.id]: [] })); }} />}
      </> : <div translate="no">{part.answers?.[q.id]?.answers.join(', ')}</div>}
    </fieldset>)}
    {pending && <div className="ai-row">
      <button type="submit" title="Send these answers to the AI that asked." disabled={sending || part.questions.some(q => q.required !== false && !answer(q).length)}>Send answer</button>
      <button type="button" title="Cancel this question without answering it." disabled={sending} onClick={event => submit(event, true)}>Cancel question</button>
    </div>}
    {part.reason && <p className="ai-message-note">{part.reason}</p>}
    {error && <p className="ai-message-error" role="alert">{error}</p>}
  </form>;
}
// The input page's site, shown beside its link so a question cannot hide where it leads.
function linkHost(link) {
  try { return new URL(link).host; } catch { return ''; }
}
function ProviderNotice({ part }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <details className={'ai-provider-notice ai-provider-' + part.severity}>
    <summary title="Provider notice: click to show or hide details."><ChevronRight size={12} aria-hidden="true" /><span>{part.name && <span translate="no">{part.name}: </span>}{part.text}</span>
      <button type="button" aria-label="Dismiss provider notice" title="Hide this notice." onClick={event => { event.preventDefault(); setDismissed(true); }}><X size={12} /></button>
    </summary>
    {part.detail && <pre translate="no">{part.detail}</pre>}
  </details>;
}
export function AssistantMessage({ message, live }) {
  // Legacy saved reports remain readable; suppress their duplicate delegation tool row.
  const parts = (message.parts?.length ? message.parts : message.text ? [{ type: 'text', text: message.text }] : []).filter(
    part => !(part.type === 'tool' && toolName(part.name) === 'mdlxl_worker'),
  );
  const shown = parts.map((part, index) =>
    part.type === 'worker' ? (
      <div key={index} className="ai-message-note"><span translate="no">{part.job}</span>{part.report && <AiMessage text={part.report} />}</div>
    ) : part.type === 'provider-notice' ? (
      <ProviderNotice key={index} part={part} />
    ) : part.type === 'question' ? (
      <QuestionPart key={part.questionId} part={part} />
    ) : part.type === 'thinking' ? (
      <ThinkingPart key={index} part={part} live={live && index === parts.length - 1} />
    ) : part.type === 'tool' ? (
      <ToolPart key={index} part={part} />
    ) : part.type === 'compaction' ? (
      <CompactionPart key={index} part={part} />
    ) : part.type === 'art' ? (
      <ArtPart key={index} part={part} />
    ) : (
      <AiMessage key={index} text={part.text} />
    ),
  );
  return message.cost ? [...shown, <CostLine key="cost" cost={message.cost} />] : shown;
}
