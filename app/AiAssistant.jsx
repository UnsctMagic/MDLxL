import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUp,
  Bird,
  Brain,
  Check,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Frown,
  Highlighter,
  LoaderCircle,
  LogIn,
  Paperclip,
  PenLine,
  Pause,
  Settings2,
  Square,
  SquarePen,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import AiMessage from './AiMessage.jsx';
import './ai-assistant.css';
import { translate } from '../src/localization.js';
import { sketchStore, SKETCH_COLORS } from '../src/ai-sketch.js';
import BIRDS from '../src/ai-birds.json';

const providers = [
  ['codex', 'Codex / ChatGPT'],
  ['claude', 'Claude Code'],
  ['openai', 'OpenAI API'],
  ['anthropic', 'Claude API'],
  ['compatible', 'Other AI / local model'],
];
const activity = {
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
  mdlxl_worker: 'Handing the job to a worker',
};
const phases = {
  inspecting: 'Inspecting the model',
  editing: 'Working on the model',
  verifying: 'Verifying the result',
  correcting: 'Correcting the result',
  verified: 'Result verified',
  complete: 'Task complete',
};
const tools = [
  {
    id: 'marker',
    label: 'Marker',
    Icon: Highlighter,
    tip: 'Marker: highlight an area on the model for the AI.',
  },
  {
    id: 'pen',
    label: 'Pen',
    Icon: PenLine,
    tip: 'Pen: draw lines or shapes on or around the model for the AI.',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    Icon: Eraser,
    tip: 'Eraser: drag over notes to remove them.',
  },
];
const DOCK_WIDTH = 'mdlxl-ai-width';
// A steady colour per bird, spread around the colour wheel in naming order.
const birdColor = name => {
  const [base, round] = String(name || '').split(' ');
  const index = Math.max(0, BIRDS.indexOf(base)) + (Number(round) > 1 ? (Number(round) - 1) * BIRDS.length : 0);
  return `hsl(${Math.round((index * 137.508) % 360)} 62% 46%)`;
};
// Each model file (or unsaved tab) has its own organiser chat.
const modelKeyOf = (path, documentId) =>
  path ? 'file:' + String(path).replaceAll('/', '\\').toLowerCase() : 'unsaved:' + documentId;
const SD_BRAIN_TIP =
  'SD Brain: applies Warcraft III SD design rules to your modeling requests, fills in routine art-direction details and checks the result. Supports detailed custom SD.';
const OFFLOAD_TIP = 'Offload Mode: this chat hands each job to a separate worker chat with its own memory, keeping this chat short.';
const CLEANUP_CHOICES = [
  ['keep', 'Keep everything', 'Keep all chats.'],
  ['summary', 'Keep a summary', 'Keep a short note of what was done; delete the chats.'],
  ['wipe', 'Wipe it all', 'Delete all chats and notes for this model.'],
];
const toolName = name => name?.replace(/^mcp__mdlxl__/, '');
const readImage = file =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
const storedWidth = () => {
  try {
    return Number(localStorage.getItem(DOCK_WIDTH)) || 400;
  } catch {
    return 400;
  }
};
// One readable line under a tool step, from the arguments the AI sent.
function detailLine(detail) {
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
function ToolPart({ part }) {
  const [open, setOpen] = useState(false),
    name = toolName(part.name),
    line = detailLine(part.detail);
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
          {name}
          {part.detail ? '\n' + part.detail : ''}
          {part.summary ? '\n\n→ ' + part.summary : ''}
        </pre>
      )}
    </div>
  );
}
// A job the organiser gave to a bird; click it to open that bird's chat.
function WorkerPart({ part, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={'ai-worker-row ai-worker-' + part.status} style={{ '--bird': birdColor(part.name) }}>
      <button type="button" className="ai-part-toggle" title="Open this chat." onClick={() => onOpen?.(part.workerId)}>
        <span className="ai-step-icon" aria-hidden="true">
          {part.status === 'working' ? <LoaderCircle size={13} className="ai-spin" /> : part.status === 'failed' ? <X size={13} /> : <Bird size={13} />}
        </span>
        <b translate="no" style={{ color: birdColor(part.name) }}>{part.name}</b>
        <span className="ai-step-detail">{part.job}</span>
        <span className="ai-worker-state">{part.status === 'working' ? 'working…' : part.status === 'done' ? 'done' : 'stopped'}</span>
      </button>
      {part.report && (
        <button
          type="button"
          className="ai-part-toggle ai-worker-report-toggle"
          aria-expanded={open}
          title="What it reported back."
          onClick={() => setOpen(!open)}
        >
          <ChevronRight size={13} aria-hidden="true" />
          Report
        </button>
      )}
      {open && part.report && <AiMessage text={part.report} />}
    </div>
  );
}
// What one API prompt cost: dollars for known Anthropic models, otherwise tokens.
function CostLine({ cost }) {
  const tokens = Math.round(cost.tokens / 1000).toLocaleString() + 'k tokens';
  return (
    <div
      className="ai-cost"
      title="What this prompt has cost on your API key so far. Each step resends the conversation; repeated text is billed at a lower rate."
    >
      {cost.usd === null ? tokens : `About $${cost.usd < 0.01 ? '0.01' : cost.usd.toFixed(2)} · ${tokens}`}
    </div>
  );
}
function AssistantMessage({ message, live, onOpenWorker }) {
  // A worker row stands for the organiser's hand-off step, so that step is not shown twice.
  const parts = (message.parts?.length ? message.parts : message.text ? [{ type: 'text', text: message.text }] : []).filter(
    part => !(part.type === 'tool' && toolName(part.name) === 'mdlxl_worker'),
  );
  const shown = parts.map((part, index) =>
    part.type === 'worker' ? (
      <WorkerPart key={index} part={part} onOpen={onOpenWorker} />
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

export default function AiAssistant({ bridge }) {
  const [open, setOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settings, setSettings] = useState({ provider: 'codex', model: '', executable: '', baseUrl: '' });
  const [apiKey, setApiKey] = useState(''),
    [models, setModels] = useState([]),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [sendingId, setSendingId] = useState(null),
    [running, setRunning] = useState([]),
    [authBusy, setAuthBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(null);
  const [task, setTask] = useState(null),
    [awarenessBusy, setAwarenessBusy] = useState(false);
  const [prompt, setPrompt] = useState(''),
    [images, setImages] = useState([]),
    [messages, setMessages] = useState([]),
    [external, setExternal] = useState(false);
  const [org, setOrg] = useState(null),
    [view, setView] = useState(null),
    [orgReload, setOrgReload] = useState(0),
    [waiting, setWaiting] = useState(null),
    [cleanup, setCleanup] = useState(null),
    [rememberCleanup, setRememberCleanup] = useState(false),
    [savedChoice, setSavedChoice] = useState('ask'),
    [connected, setConnected] = useState(false);
  const id = view;
  // Each model's chat works on its own: this chat is busy while its task or one of
  // its birds runs; other models' AI jobs only block the shared connection settings.
  const chats = [org?.id, ...(org?.workers || []).map(w => w.id)].filter(Boolean),
    ours = chat => !!chat && (chat === id || chats.includes(chat));
  const busy = ours(sendingId) || running.some(r => ours(r.id) || ours(r.worker)),
    anyBusy = !!sendingId || running.length > 0;
  const cleanupRoot = useRef(null);
  useEffect(() => {
    const root = cleanupRoot.current;
    if (!root) return;
    window.dispatchEvent(new CustomEvent('mdlxl-detached-root', { detail: { root, add: true } }));
    return () => window.dispatchEvent(new CustomEvent('mdlxl-detached-root', { detail: { root, add: false } }));
  }, [cleanup]);
  const [dock, setDock] = useState(null),
    [width, setWidth] = useState(storedWidth),
    [palette, setPalette] = useState(false);
  const sketch = useSyncExternalStore(sketchStore.subscribe, sketchStore.get);
  const scroll = useRef(),
    files = useRef(),
    input = useRef(),
    pinned = useRef(true),
    rekeying = useRef(Promise.resolve()),
    activeId = useRef(id);
  activeId.current = id;
  useEffect(() => {
    if (!window.desktop?.aiStatus) return;
    window.desktop
      .aiStatus()
      .then(value => {
        setSettings(value);
        setRunning(value.running || []);
        setExternal(value.enabled);
        setConnected(true);
      })
      .catch(reason => setError(reason.message));
    // The reply streams into the newest assistant message as parts: what the AI
    // says, thinks and does, in the order it happens.
    const update = change =>
      setMessages(previous => {
        const list = [...previous];
        let last = list.at(-1);
        if (last?.role !== 'assistant') list.push((last = { role: 'assistant', text: '', parts: [] }));
        const next = { ...last, parts: [...(last.parts || [])] };
        change(next);
        list[list.length - 1] = next;
        return list;
      });
    return window.desktop.onAiEvent(event => {
      // Roster and setting changes matter whichever chat is showing.
      if (event.type === 'roster') setOrg(previous => (previous?.id === event.id ? { ...previous, workers: event.workers } : previous));
      if (event.type === 'offload') setSettings(previous => ({ ...previous, offload: event.enabled }));
      if (event.type === 'sd-brain') setSettings(previous => ({ ...previous, sdBrain: event.enabled }));
      if (event.type === 'organiser-reset') setOrgReload(n => n + 1);
      if (event.type === 'running') setRunning(event.running);
      if (event.id && event.id !== activeId.current) return;
      if (event.type === 'worker')
        setMessages(previous => {
          const at = previous.findLastIndex(m => m.parts?.some(p => p.type === 'worker' && p.workerId === event.workerId && p.status === 'working'));
          if (at >= 0 && event.status !== 'working') {
            const list = [...previous];
            list[at] = {
              ...list[at],
              parts: list[at].parts.map(p =>
                p.type === 'worker' && p.workerId === event.workerId && p.status === 'working' ? { ...p, status: event.status, report: event.report } : p,
              ),
            };
            return list;
          }
          if (at >= 0) return previous;
          const list = [...previous];
          let last = list.at(-1);
          if (last?.role !== 'assistant') list.push((last = { role: 'assistant', text: '', parts: [] }));
          list[list.length - 1] = {
            ...last,
            parts: [...(last.parts || []), { type: 'worker', workerId: event.workerId, name: event.name, job: event.job, status: event.status }],
          };
          return list;
        });
      if (event.type === 'worker') setStatus(event.status === 'working' ? `The ${event.name} is working on: ${event.job}` : 'Organising');
      if (event.type === 'text' || event.type === 'thinking')
        update(message => {
          if (event.type === 'text') message.text += event.text;
          const last = message.parts.at(-1);
          if (last?.type === event.type) message.parts[message.parts.length - 1] = { ...last, text: last.text + event.text };
          else message.parts.push({ type: event.type, text: event.text });
        });
      if (event.type === 'tool')
        update(message =>
          message.parts.push({ type: 'tool', id: event.callId, name: event.name, detail: event.detail, status: 'running' }),
        );
      if (event.type === 'art')
        update(message => {
          const at = message.parts.findLastIndex(p => p.type === 'art' && p.status === 'running');
          const part = { type: 'art', status: event.status, text: event.text || '' };
          if (at >= 0) message.parts[at] = part;
          else message.parts.push(part);
        });
      if (event.type === 'cost')
        update(message => {
          message.cost = { usd: event.usd, tokens: event.tokens };
        });
      if (event.type === 'art') setStatus(event.status === 'running' ? 'Planning the SD art direction' : 'Working on the model');
      // A steering message may have split the reply since the tool started.
      if (event.type === 'tool-result')
        setMessages(previous => {
          const matches = p =>
            p.type === 'tool' &&
            ((event.callId && p.id === event.callId) || (p.status === 'running' && p.name === event.name));
          const at = previous.findLastIndex(m => m.parts?.some(matches));
          if (at < 0) return previous;
          const list = [...previous],
            parts = [...list[at].parts],
            index = parts.findLastIndex(matches);
          parts[index] = { ...parts[index], status: event.error ? 'error' : 'done', summary: event.summary };
          list[at] = { ...list[at], parts };
          return list;
        });
      if (event.type === 'compaction')
        setMessages(previous => {
          const list = [...previous],
            at = list.findLastIndex(m => m.parts?.some(p => p.type === 'compaction' && p.status === 'running'));
          if (event.active && at < 0) {
            let last = list.at(-1);
            if (last?.role !== 'assistant') list.push((last = { role: 'assistant', text: '', parts: [] }));
            list[list.length - 1] = { ...last, parts: [...(last.parts || []), { type: 'compaction', status: 'running' }] };
          } else if (!event.active && at >= 0)
            list[at] = {
              ...list[at],
              parts: list[at].parts.map(p => (p.type === 'compaction' && p.status === 'running' ? { ...p, status: 'done' } : p)),
            };
          else return previous;
          return list;
        });
      if (event.type === 'compaction')
        setStatus(event.active ? 'Compacting context: summarizing the long chat to make room' : 'Working on the model');
      if (event.type === 'steer')
        setMessages(previous => [
          ...previous,
          { role: 'user', text: event.text, steer: true },
          { role: 'assistant', text: '', parts: [] },
        ]);
      if (event.type === 'tool' || event.type === 'external')
        setStatus(activity[toolName(event.name)] || 'Using the editor');
      if (event.type === 'external-done' && !event.busy) setStatus('');
      if (event.type === 'tool-result')
        setStatus(
          event.error ? 'The AI is checking an editor error.' : activity[toolName(event.name)] || 'Working on the model',
        );
      if (event.type === 'notice' || event.type === 'auth') setStatus(event.text);
      if (event.type === 'error') {
        setError(event.text);
        if (event.authRequired) {
          setSignedIn(false);
          setSettingsOpen(true);
        }
      }
      if (event.type === 'done') setStatus('');
      if (event.type === 'awareness') setSettings(previous => ({ ...previous, awareness: event.enabled }));
      if (event.type === 'task') {
        setTask(event.task);
        if (event.task?.status === 'running') setStatus(phases[event.task.phase] || 'Working on the model');
      }
    });
  }, []);
  const summaryNow = open ? bridge.summary() : null;
  const modelKey = summaryNow ? modelKeyOf(summaryNow.path, summaryNow.documentId) : null;
  // Right after a tab switch the console still holds the previous model's chat until
  // this model's chat loads; a prompt then must not reach the other model's job.
  const switching = !!org && org.modelKey !== modelKey;
  useEffect(() => {
    if (!open || !modelKey || !window.desktop?.aiOrganiser) return;
    let live = true;
    const name = summaryNow.name;
    rekeying.current
      .catch(() => {})
      .then(() => window.desktop.aiOrganiser({ modelKey, name }))
      .then(value => {
        if (!live) return;
        setOrg({ ...value, modelKey });
        setView(value.id);
      })
      .catch(reason => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [open, modelKey, orgReload]);
  useEffect(() => {
    if (!view || !window.desktop?.aiTranscript) return;
    let live = true;
    Promise.all([window.desktop.aiTranscript(view), window.desktop.aiTask(view)])
      .then(([transcript, info]) => {
        if (!live) return;
        pinned.current = true;
        setMessages(transcript);
        setTask(info);
      })
      .catch(reason => live && setError(reason.message));
    return () => {
      live = false;
    };
  }, [view]);
  useEffect(() => {
    if (!settingsOpen || !org?.modelKey || !window.desktop?.aiSaveState) return;
    window.desktop.aiSaveState({ modelKey: org.modelKey }).then(value => setSavedChoice(value.remember), () => {});
  }, [settingsOpen, org?.modelKey]);
  // A bird working on another model tab waits until you return to it.
  useEffect(() => {
    const changed = event => setWaiting(event.detail.waiting ? event.detail.document : null);
    window.addEventListener('mdlxl-ai-waiting', changed);
    return () => window.removeEventListener('mdlxl-ai-waiting', changed);
  }, []);
  // After saving a model the AI worked on, offer to tidy its chats.
  useEffect(() => {
    if (!window.desktop?.aiSaveState) return;
    const saved = event => {
      const { documentId, path, previousPath, name } = event.detail;
      const key = modelKeyOf(path, documentId),
        before = modelKeyOf(previousPath, documentId);
      // Moving the organiser to the new file name starts now, before the console reloads it.
      rekeying.current = before === key ? Promise.resolve() : window.desktop.aiRekey({ from: before, to: key, name });
      rekeying.current
        .then(() => window.desktop.aiSaveState({ modelKey: key }))
        .then(state => {
          if (!state.activity) return;
          if (state.remember === 'ask') {
            setRememberCleanup(false);
            setCleanup({ modelKey: key, name });
          } else return window.desktop.aiCleanup({ modelKey: key, mode: state.remember });
        })
        .catch(reason => setError(reason.message));
    };
    window.addEventListener('mdlxl-model-saved', saved);
    return () => window.removeEventListener('mdlxl-model-saved', saved);
  }, []);
  // Follow the stream unless the user scrolled up to read.
  useLayoutEffect(() => {
    if (scroll.current && pinned.current) scroll.current.scrollTop = scroll.current.scrollHeight;
  }, [messages, status]);
  useLayoutEffect(() => {
    if (open) setDock(document.querySelector('.classic-workspace') || document.body);
    sketchStore.setVisible(open);
  }, [open]);
  useEffect(() => {
    const textarea = input.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 180) + 'px';
    textarea.style.overflowY = textarea.scrollHeight > 180 ? 'auto' : 'hidden';
  }, [prompt, open]);
  // Escape leaves a drawing tool before it clears the model selection.
  useEffect(() => {
    const cancel = event => {
      if (!sketchStore.get().tool || event.defaultPrevented) return;
      sketchStore.clearTool();
      event.preventDefault();
    };
    window.addEventListener('mdlxl-cancel-gesture', cancel);
    return () => window.removeEventListener('mdlxl-cancel-gesture', cancel);
  }, []);
  const summary = summaryNow;
  const references = open ? bridge.host().references?.() || [] : [];
  const viewWorker = org?.workers.find(worker => worker.id === view) || null;
  const earlierView = !!org?.earlier.includes(view);
  const readOnly = viewWorker?.status === 'retired' || earlierView;
  const liveWorkers = org?.workers.filter(worker => worker.status !== 'retired') || [];
  const retiredWorkers = org?.workers.filter(worker => worker.status === 'retired') || [];
  const native = ['codex', 'claude'].includes(settings.provider);
  const providerName = providers.find(p => p[0] === settings.provider)?.[1] || 'AI';
  const strokes = summary ? sketch.strokes.filter(s => s.documentId === summary.documentId) : [];
  const activeTool = tools.find(t => t.id === sketch.tool);
  const colorTool = sketch.tool === 'pen' || sketch.tool === 'marker' ? sketch.tool : null;
  async function saveSettings() {
    const value = await window.desktop.aiConfigure({ ...settings, apiKey });
    setSettings(value);
    setApiKey('');
    return value;
  }
  async function action(callback) {
    setError('');
    try {
      return await callback();
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function changeProvider(provider) {
    setAuthBusy(true);
    setError('');
    try {
      setSettings(await window.desktop.aiStatus(provider));
      setModels([]);
      setApiKey('');
      setSignedIn(null);
      setOrgReload(n => n + 1);
    } catch (reason) {
      setError(reason.message);
    } finally {
      setAuthBusy(false);
      setStatus('');
    }
  }
  // New chat: a fresh organiser for this model; the old one stays among the retired chats.
  async function newChat() {
    if (busy || !org) return;
    try {
      const value = await window.desktop.aiNewOrganiser({ modelKey: org.modelKey, name: summary?.name });
      setOrg({ ...value, modelKey: org.modelKey });
      setView(value.id);
      setMessages([]);
      setTask(null);
      setStatus('');
      setError('');
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function chooseCleanup(mode) {
    const current = cleanup;
    setCleanup(null);
    try {
      await window.desktop.aiCleanup({ modelKey: current.modelKey, mode, remember: rememberCleanup });
    } catch (reason) {
      setError(reason.message);
    }
  }
  // While the AI works, a message steers the running task instead of starting a new one.
  async function steer() {
    const text = prompt.trim();
    if (!text) return;
    setError('');
    try {
      const result = await window.desktop.aiSteer({ id, text, annotations: bridge.annotations() });
      if (result.queued) setPrompt('');
      else setStatus('The AI is busy with another chat. Send this when it finishes.');
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function send(resumeTask = false) {
    const resume = resumeTask === true;
    if (switching || !id) return;
    if (!resume && busy) return steer();
    if ((!resume && !prompt.trim()) || busy || authBusy) return;
    if (native && signedIn === false) {
      await authenticate('login');
      return;
    }
    const text = prompt,
      attached = images;
    const sending = id;
    setSendingId(sending);
    setError('');
    setStatus('Connecting…');
    pinned.current = true;
    try {
      await saveSettings();
      if (native) {
        const auth = await window.desktop.aiAuth('status');
        setSignedIn(auth.loggedIn);
        if (!auth.loggedIn) {
          setSettingsOpen(true);
          return;
        }
      }
      const context = bridge.context();
      if (!resume) {
        setPrompt('');
        setImages([]);
      }
      setMessages(previous => [
        ...previous,
        {
          role: 'user',
          text: resume ? 'Resume task' : text,
          document: context.name,
          selection: context.selection,
          drawings: context.annotations?.strokes.length || 0,
        },
        { role: 'assistant', text: '', parts: [] },
      ]);
      const result = await window.desktop.aiSend({
        id,
        text,
        images: attached.map(image => image.data),
        context,
        resume,
      });
      if (result.authRequired) {
        setSignedIn(false);
        setSettingsOpen(true);
        if (!resume) {
          setPrompt(text);
          setImages(attached);
        }
        setMessages(await window.desktop.aiTranscript(id));
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSendingId(current => (current === sending ? null : current));
      setStatus('');
    }
  }
  async function authenticate(authAction) {
    setAuthBusy(true);
    setError('');
    try {
      await saveSettings();
      const result = await window.desktop.aiAuth(authAction);
      setSignedIn(!!result.loggedIn);
      setStatus('');
      if (!result.loggedIn) setSettingsOpen(true);
      else if (['codex', 'claude'].includes(settings.provider) && !models.length) setModels(await window.desktop.aiModels());
    } catch (reason) {
      setError(reason.message);
      setSettingsOpen(true);
    } finally {
      setAuthBusy(false);
      setStatus('');
    }
  }
  function toggleOpen() {
    setOpen(!open);
    if (!open && !anyBusy && !authBusy && native && window.desktop?.aiAuth) authenticate('status');
  }
  async function loadModels() {
    setAuthBusy(true);
    setError('');
    try {
      await saveSettings();
      setModels(await window.desktop.aiModels());
      setStatus('Available models loaded.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function attach(list) {
    for (const file of list) {
      if (/\.(mdl|mdx)$/i.test(file.name)) {
        await bridge.host().addReference({
          name: file.name,
          path: window.desktop?.droppedPath(file) || null,
          bytes: new Uint8Array(await file.arrayBuffer()),
        });
        setStatus('Reference model added.');
      } else if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        if (file.size > 9 * 1024 * 1024) throw Error('Each image must be under 9 MB.');
        const data = await readImage(file);
        setImages(previous => {
          if (previous.length >= 4) return previous;
          return [...previous, { name: file.name, data }];
        });
      } else throw Error('Choose MDL, MDX, PNG, JPEG or WebP files.');
    }
  }
  // Drawing happens in the modeling view, where the model holds still.
  async function chooseTool(tool) {
    setPalette(false);
    if (sketch.tool !== tool && summary?.mode !== 'vertices') await action(() => bridge.host().view({ mode: 'vertices' }));
    sketchStore.setTool(tool);
  }
  function resizeStart(event) {
    if (event.button !== 0) return;
    const startX = event.clientX,
      startWidth = width,
      handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const next = Math.round(Math.max(300, Math.min(window.innerWidth * 0.6, startWidth + moveEvent.clientX - startX)));
      setWidth(next);
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      setWidth(value => {
        try {
          localStorage.setItem(DOCK_WIDTH, String(value));
        } catch {}
        return value;
      });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    event.preventDefault();
  }
  const live = busy && messages.at(-1)?.role === 'assistant';
  const selected = summary ? summary.vertices + summary.nodes : 0;
  return (
    <>
      <button
        type="button"
        className="classic-tool ai-open ai-tool"
        data-hotkey="ai:open" data-hotkey-badges="false"
        aria-label="AI assistant"
        title="AI console: ask an AI to edit your model."
        aria-pressed={open}
        onClick={toggleOpen}
      >
        <img src="./classic/btn-metamorphosis.png" alt="" draggable={false} />
        <span className="module-icon-badge" aria-hidden="true">
          AI{anyBusy ? '·' : ''}
        </span>
      </button>
      {open &&
        dock &&
        createPortal(
          <section
            className="ai-assistant ai-console"
            data-hotkey-prefix="ai" data-hotkey-scope="ai" data-hotkey-window="" data-hotkey-category="AI console" data-hotkey-badges="false"
            tabIndex={-1}
            role="complementary"
            aria-label="AI assistant"
            style={{ '--ai-width': width + 'px' }}
          >
            <div
              className="ai-resize"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize AI console"
              title="Drag to resize."
              onPointerDown={resizeStart}
            />
            <header className="ai-heading">
              {/* Only the connected AI's name; "AI" until the connection has loaded. */}
              <button
                type="button"
                className="ai-provider-name"
                data-hotkey="provider-settings" data-hotkey-label="Change provider"
                title="The connected AI. Click to change."
                onClick={() => setSettingsOpen(value => !value)}
              >
                <span translate="no">{connected ? providerName : 'AI'}</span>
              </button>
              <select
                        className="ai-model ai-header-model"
                        aria-label="Chat model" data-hotkey="chat-model"
                        title="The AI model that does the work. A change applies from the next message."
                        value={settings.model || ''}
                        disabled={authBusy}
                        onChange={event => action(async () => setSettings(await window.desktop.aiModel(event.target.value)))}
                      >
                        <option value="">Default model</option>
                        {settings.model && !models.some(model => model.id === settings.model) && (
                          <option value={settings.model} translate="no">
                            {settings.model}
                          </option>
                        )}
                        {models.map(model => (
                          <option key={model.id} value={model.id} translate="no">
                            {model.name}
                          </option>
                        ))}
                      </select>
              <button
                type="button"
                role="switch"
                className="ai-icon-button ai-offload-switch"
                aria-label="Offload Mode" data-hotkey="offload"
                aria-checked={settings.offload !== false}
                title={OFFLOAD_TIP}
                disabled={anyBusy}
                onClick={() => action(async () => setSettings(await window.desktop.aiOffload(settings.offload === false)))}
              >
                <Bird size={15} aria-hidden="true" />
              </button>
              {/* A running task keeps the setting it started with; this applies from the next one. */}
              {settings.sdBrainAvailable && (
                <button
                  type="button"
                  role="switch"
                  className="ai-icon-button ai-offload-switch"
                  aria-label="SD Brain" data-hotkey="sd-brain"
                  aria-checked={!!settings.sdBrain}
                  title={translate(SD_BRAIN_TIP)}
                  onClick={() => action(async () => setSettings(await window.desktop.aiSdBrain(!settings.sdBrain)))}
                >
                  <Brain size={15} aria-hidden="true" />
                </button>
              )}
              <span className="ai-heading-gap" />
              <button
                type="button"
                className="ai-icon-button"
                aria-label="New chat" data-hotkey="new-chat"
                title="Start a new chat for this model."
                disabled={busy || authBusy}
                onClick={newChat}
              >
                <SquarePen size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ai-icon-button"
                aria-label="Connection settings" data-hotkey="connection"
                title="AI settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(value => !value)}
              >
                <Settings2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ai-icon-button"
                aria-label="Close AI assistant" data-hotkey="close"
                title="Close the AI console."
                onClick={() => setOpen(false)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            {!window.desktop?.aiSend ? (
              <p className="ai-empty">The AI connection is available in the desktop app.</p>
            ) : (
              <>
                {org && (org.workers.length > 0 || org.earlier.length > 0) && (
                  <nav className="ai-roster" aria-label="AI chats for this model">
                    <button
                      type="button"
                      className="ai-roster-chip" data-hotkey="organiser" data-hotkey-label="Organiser"
                      aria-pressed={view === org.id}
                      title="The main chat for this model."
                      onClick={() => setView(org.id)}
                    >
                      Organiser
                    </button>
                    {liveWorkers.map(worker => (
                      <button
                        key={worker.id}
                        type="button"
                        className={'ai-roster-chip ai-roster-' + worker.status}
                        style={{ '--bird': birdColor(worker.name) }}
                        aria-pressed={view === worker.id}
                        title={`${worker.job} · ${Math.round((worker.use || 0) * 100)}% memory used${worker.status === 'working' && waiting ? ' · paused until you return to ' + waiting : ''}`}
                        onClick={() => setView(worker.id)}
                      >
                        {worker.status === 'working' ? (
                          waiting ? <Pause size={11} aria-hidden="true" /> : <LoaderCircle size={11} className="ai-spin" aria-hidden="true" />
                        ) : (
                          <Bird size={11} aria-hidden="true" />
                        )}
                        <span translate="no">{worker.name}</span>
                      </button>
                    ))}
                    {retiredWorkers.length + org.earlier.length > 0 && (
                      <select
                        className="ai-retired"
                        aria-label="Retired chats" data-hotkey="retired"
                        title="Finished and earlier chats of this model."
                        value={readOnly ? view : ''}
                        onChange={event => event.target.value && setView(event.target.value)}
                      >
                        <option value="">{translate(`Retired (${retiredWorkers.length + org.earlier.length})`)}</option>
                        {retiredWorkers.map(worker => (
                          <option key={worker.id} value={worker.id} translate="no">
                            {worker.name} · {worker.job}
                          </option>
                        ))}
                        {org.earlier.map((earlier, index) => (
                          <option key={earlier} value={earlier}>
                            {translate(`Earlier chat ${index + 1}`)}
                          </option>
                        ))}
                      </select>
                    )}
                  </nav>
                )}
                {settingsOpen && (
                  <div className="ai-connection">
                    {org && (
                      <label title="What happens to this model's AI chats when you save.">
                        After saving
                        <select
                          aria-label="After saving" data-hotkey="after-saving"
                          value={savedChoice}
                          onChange={event =>
                            action(async () => {
                              const value = await window.desktop.aiRememberCleanup({ modelKey: org.modelKey, remember: event.target.value });
                              setSavedChoice(value.remember);
                            })
                          }
                        >
                          <option value="ask">Ask me</option>
                          <option value="keep">Keep everything</option>
                          <option value="summary">Keep a summary</option>
                          <option value="wipe">Wipe it all</option>
                        </select>
                      </label>
                    )}
                    <label title="Which AI service to use.">
                      AI provider
                      <select
                        aria-label="AI provider" data-hotkey="provider"
                        value={settings.provider}
                        disabled={anyBusy || authBusy}
                        onChange={event => changeProvider(event.target.value)}
                      >
                        {providers.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {native ? (
                      <div className="ai-row">
                        <button
                          className={signedIn ? '' : 'ai-primary'}
                          disabled={anyBusy || authBusy}
                          title="Sign in with your account in the browser." data-hotkey="sign-in" data-hotkey-label="Sign in"
                          onClick={() => authenticate('login')}
                        >
                          <LogIn size={14} aria-hidden="true" />
                          Sign in
                        </button>
                        <button disabled={anyBusy || authBusy} title="Check if you are signed in." data-hotkey="check-sign-in" data-hotkey-label="Check sign-in" onClick={() => authenticate('status')}>
                          Check sign-in
                        </button>
                        <button disabled={anyBusy || authBusy} title="Sign out of this AI." data-hotkey="sign-out" data-hotkey-label="Sign out" onClick={() => authenticate('logout')}>
                          Sign out
                        </button>
                        {authBusy && (
                          <button title="Stop waiting for sign-in." data-hotkey="cancel-sign-in" data-hotkey-label="Stop sign-in" onClick={() => window.desktop.aiCancel()}>
                            Cancel
                          </button>
                        )}
                      </div>
                    ) : (
                      <label title="Your key for the AI service, stored encrypted.">
                        API key
                        <input
                          type="password"
                          data-hotkey="api-key" data-hotkey-label="API key" autoComplete="off"
                          value={apiKey}
                          placeholder={settings.hasKey ? 'Saved securely' : ''}
                          onChange={event => setApiKey(event.target.value)}
                        />
                      </label>
                    )}
                    {settings.provider === 'compatible' && (
                      <label title="Address of the AI server.">
                        API base URL
                        <input
                          data-hotkey="base-url" data-hotkey-label="API base URL" value={settings.baseUrl || ''}
                          placeholder="http://localhost:1234/v1"
                          onChange={event =>
                            setSettings(previous => ({ ...previous, baseUrl: event.target.value }))
                          }
                        />
                      </label>
                    )}
                    <label title="Which model to use.">
                      Model
                      <input
                        aria-label="Model" data-hotkey="model"
                        list="mdlxl-ai-models"
                        value={settings.model || ''}
                        placeholder={native ? 'Provider default' : 'Choose or enter a model ID'}
                        onChange={event => setSettings(previous => ({ ...previous, model: event.target.value }))}
                      />
                      <datalist id="mdlxl-ai-models">
                        {models.map(model => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </datalist>
                    </label>
                    {!native && (
                      <label title="Optional. A prompt stops once it has cost about this much on your API key; progress is kept. Works for Anthropic models with known prices. Leave empty for no limit.">
                        Spending limit per prompt ($)
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="No limit"
                          data-hotkey="spend-limit" data-hotkey-label="Spending limit per prompt" value={settings.spendLimit || ''}
                          onChange={event => setSettings(previous => ({ ...previous, spendLimit: event.target.value }))}
                        />
                      </label>
                    )}
                    {settings.provider !== 'codex' && (
                      <label title="Optional. A prompt stops after this many AI steps (each look, edit or check is a step); progress is kept. Leave empty for the usual maximum.">
                        Step limit per prompt
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="Default"
                          data-hotkey="step-limit" data-hotkey-label="Step limit per prompt" value={settings.stepLimit || ''}
                          onChange={event => setSettings(previous => ({ ...previous, stepLimit: event.target.value }))}
                        />
                      </label>
                    )}
                    <div className="ai-row">
                      <button
                        disabled={anyBusy || authBusy}
                        title="Save these settings." data-hotkey="save-connection" data-hotkey-label="Save connection"
                        onClick={() =>
                          action(async () => {
                            await saveSettings();
                            setStatus('Connection saved.');
                          })
                        }
                      >
                        Save connection
                      </button>
                      <button
                        disabled={anyBusy || authBusy}
                        title="Get the list of available models." data-hotkey="load-models" data-hotkey-label="Load models"
                        onClick={loadModels}
                      >
                        Load models
                      </button>
                    </div>
                    {native && (
                      <details>
                        <summary title="Where the AI program is installed." data-hotkey="advanced:expand" data-hotkey-label="Advanced connection">Advanced connection</summary>
                        <label title="Path to the Codex or Claude program.">
                          CLI executable (optional)
                          <input
                            data-hotkey="executable" data-hotkey-label="CLI executable" value={settings.executable || ''}
                            disabled={anyBusy || authBusy}
                            placeholder={settings.provider + '.exe'}
                            onChange={event =>
                              setSettings(previous => ({ ...previous, executable: event.target.value }))
                            }
                          />
                        </label>
                      </details>
                    )}
                    <details>
                      <summary title="Let other AI apps use MDLxL's editor tools." data-hotkey="external:expand" data-hotkey-label="Connect another AI">
                        Connect another AI
                      </summary>
                      <p>Connect any local AI client that supports MCP to the same editor tools.</p>
                      <div className="ai-row">
                        <button
                          title="Turn the connection for other AI apps on or off." data-hotkey="external" data-hotkey-label="Enable connection"
                          onClick={() =>
                            action(async () => {
                              const value = await window.desktop.aiEnable(!external);
                              setExternal(value.enabled);
                            })
                          }
                        >
                          {external ? 'Disable connection' : 'Enable connection'}
                        </button>
                        <button
                          disabled={!external}
                          title="Copy the connection settings." data-hotkey="copy-connection" data-hotkey-label="Copy connection JSON"
                          onClick={() =>
                            action(async () => {
                              await navigator.clipboard.writeText(
                                JSON.stringify(await window.desktop.aiConfig(), null, 2),
                              );
                              setStatus('MCP connection copied.');
                            })
                          }
                        >
                          Copy connection JSON
                        </button>
                      </div>
                    </details>
                  </div>
                )}
                <div
                  className="ai-messages"
                  ref={scroll}
                  role="log"
                  aria-live="polite"
                  onScroll={event => {
                    const element = event.currentTarget;
                    pinned.current = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
                  }}
                >
                  {messages.length ? (
                    <div className="ai-thread">
                      {messages.map((message, index) => (
                        <article key={index} className={'ai-message ai-role-' + message.role}>
                          {message.role === 'assistant' ? (
                            <AssistantMessage
                              message={message}
                              live={live && index === messages.length - 1}
                              onOpenWorker={setView}
                            />
                          ) : message.from === 'organiser' ? (
                            <details
                              className="ai-from-organiser"
                              title="The job this chat was given. Click to show."
                              style={{ '--bird': birdColor(viewWorker?.name) }}
                            >
                              <summary>
                                <Bird size={12} aria-hidden="true" />
                                {message.job === 'Handover' ? 'Asked for a handover note' : 'Job from the organiser: ' + (message.job || '')}
                              </summary>
                              <div className="ai-user-text" translate="no">
                                {message.text}
                              </div>
                            </details>
                          ) : (
                            <>
                              <div className="ai-user-text" translate="no">
                                {message.text}
                              </div>
                              {(message.steer || message.drawings > 0) && (
                                <span className="ai-message-note">
                                  {message.steer
                                    ? 'Sent while the AI was working'
                                    : translate(`${message.drawings} drawing${message.drawings === 1 ? '' : 's'} attached`)}
                                </span>
                              )}
                            </>
                          )}
                          {message.error && (
                            <p className="ai-message-error" role="alert">
                              {message.error}
                            </p>
                          )}
                        </article>
                      ))}
                      {status && (
                        <div className="ai-status" role="status">
                          {status}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="ai-empty">
                      <h3>What should we work on?</h3>
                      <p>
                        Select vertices or bones, or draw on the model with the Marker or Pen, then describe the change.
                        You can also ask how to use a tool, attach reference models or images.
                      </p>
                      {status && (
                        <div className="ai-status" role="status">
                          {status}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {waiting && (
                  <div className="ai-account ai-paused" role="status">
                    <Pause size={12} aria-hidden="true" />
                    {`Paused until you return to ${waiting}`}
                  </div>
                )}
                {native && signedIn !== null && !signedIn && (
                  <div className="ai-account" role="status">
                    Sign in to connect your AI. Your prompt has been kept.
                  </div>
                )}
                {native && signedIn && (
                  <div className="ai-account ai-connected" role="status" hidden={messages.length > 0}>
                    Signed in.
                  </div>
                )}
                {error && (
                  <div className="ai-error" role="alert">
                    {error}
                    <button type="button" className="ai-icon-button" aria-label="Dismiss" data-hotkey="dismiss" title="Hide." onClick={() => setError('')}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {task?.canResume && !busy && (
                  <div className="ai-resume">
                    <span>Task paused. Applied edits are kept.</span>
                    <button
                      disabled={authBusy}
                      title="Continue the stopped task." data-hotkey="resume" data-hotkey-label="Resume task"
                      onClick={() => send(true)}
                    >
                      Resume task
                    </button>
                  </div>
                )}
                <div className="ai-composer">
                  {(summary || images.length > 0 || strokes.length > 0 || references.length > 0) && (
                    <div className="ai-chips">
                      {summary && (
                        <span
                          className="ai-chip"
                          title="What the AI will work on."
                          translate="no"
                        >
                          {summary.name}
                          {selected > 0 && (
                            <span className="ai-chip-muted">
                              {' · '}
                              {translate(`${summary.vertices} vertices · ${summary.nodes} nodes`)}
                            </span>
                          )}
                          {summary.sequenceName != null && (
                            <span className="ai-chip-muted">{` · ${summary.sequenceName} @ ${Math.round(summary.time)}`}</span>
                          )}
                          {summary.reference && (
                            <button
                              type="button"
                              aria-label={`Remove reference ${summary.name}`} data-hotkey="reference-current" data-hotkey-label="Remove current reference"
                              title="Remove this reference model (closes its tab)."
                              onClick={() => bridge.host().removeReference(summary.documentId)}
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          )}
                        </span>
                      )}
                      {references.map((reference, index) => (
                        <span key={reference.id} className="ai-chip" title="A reference model you attached." translate="no">
                          {reference.name}
                          <button
                            type="button"
                            aria-label={`Remove reference ${reference.name}`} data-hotkey={`reference:${index}`} data-hotkey-label={`Remove reference ${index + 1}`}
                            title="Remove this reference model (closes its tab)."
                            onClick={() => bridge.host().removeReference(reference.id)}
                          >
                            <X size={12} aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                      {strokes.length > 0 && (
                        <span className="ai-chip" title="Your notes on the model.">
                          {translate(`${strokes.length} drawing${strokes.length === 1 ? '' : 's'}`)}
                          <button
                            type="button"
                            aria-label="Undo last drawing" data-hotkey="undo-drawing"
                            title="Undo last drawing"
                            onClick={() => sketchStore.undo(summary.documentId)}
                          >
                            <Undo2 size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Clear drawings" data-hotkey="clear-drawings"
                            title="Remove all notes."
                            onClick={() => sketchStore.clear(summary.documentId)}
                          >
                            <Trash2 size={12} aria-hidden="true" />
                          </button>
                        </span>
                      )}
                      {images.map((image, index) => (
                        <button
                          key={index}
                          type="button"
                          className="ai-chip ai-image-chip" data-hotkey={`picture:${index}`} data-hotkey-label={`Remove picture ${index + 1}`}
                          title="Remove picture."
                          onClick={() => setImages(previous => previous.filter((_, i) => i !== index))}
                        >
                          <img src={image.data} alt={image.name} />
                          <X size={11} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea
                    ref={input}
                    rows={1}
                    disabled={readOnly}
                    aria-label="AI prompt" data-hotkey="prompt"
                    placeholder={
                      readOnly
                        ? viewWorker
                          ? `The ${viewWorker.name} is retired. Talk to the organiser to continue.`
                          : 'An earlier chat, read only. Use the organiser to continue.'
                        : busy
                          ? 'Steer the AI while it works…'
                          : viewWorker
                            ? `Talk to the ${viewWorker.name} directly…`
                            : 'Ask the AI to change your model…'
                    }
                    value={prompt}
                    onChange={event => setPrompt(event.target.value)}
                    onPaste={event => {
                      // Word and web pages put a picture of copied text beside the text: paste the text.
                      const pasted = event.clipboardData.getData('text/plain') ? [] : [...event.clipboardData.files];
                      if (pasted.length) {
                        event.preventDefault();
                        action(() => attach(pasted));
                      }
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                        event.preventDefault();
                        send();
                      }
                    }}
                  />
                  <footer>
                    <button
                      type="button"
                      className="ai-tool"
                      aria-label="Attach" data-hotkey="attach"
                      disabled={busy || authBusy}
                      title="Attach a model or picture."
                      onClick={() => files.current.click()}
                    >
                      <Paperclip size={15} aria-hidden="true" />
                    </button>
                    <span className="ai-divider" aria-hidden="true" />
                    <div className="ai-tools" role="group" aria-label="Drawing tools">
                      {tools.map(({ id: toolId, label, Icon, tip }) => (
                        <button
                          key={toolId}
                          type="button"
                          className="ai-tool"
                          aria-label={label} data-hotkey={`tool:${toolId}`}
                          aria-pressed={sketch.tool === toolId}
                          title={tip}
                          disabled={toolId === 'eraser' && !strokes.length && sketch.tool !== 'eraser'}
                          onClick={() => chooseTool(toolId)}
                        >
                          <Icon size={15} aria-hidden="true" />
                        </button>
                      ))}
                      {colorTool && (
                        <span className="ai-palette">
                          <button
                            type="button"
                            className="ai-swatch"
                            aria-label={'Color: ' + sketch.color[colorTool]} data-hotkey="color" data-hotkey-label="Color"
                            title="Colour of this tool."
                            aria-expanded={palette}
                            style={{ '--swatch': sketchStore.colorOf(colorTool) }}
                            onClick={() => setPalette(!palette)}
                          />
                          {palette && (
                            <span className="ai-palette-menu" role="menu">
                              {SKETCH_COLORS.map(color => (
                                <button
                                  key={color.id}
                                  type="button"
                                  role="menuitemradio"
                                  aria-checked={sketch.color[colorTool] === color.id}
                                  aria-label={color.id} data-hotkey={`color:${color.id}`}
                                  title={color.id}
                                  className="ai-swatch"
                                  style={{ '--swatch': color.value }}
                                  onClick={() => {
                                    sketchStore.setColor(colorTool, color.id);
                                    setPalette(false);
                                  }}
                                />
                              ))}
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                    <input
                      ref={files}
                      type="file"
                      hidden
                      multiple
                      accept=".mdl,.mdx,.png,.jpg,.jpeg,.webp"
                      onChange={event => {
                        const selectedFiles = [...event.target.files];
                        event.target.value = '';
                        action(() => attach(selectedFiles));
                      }}
                    />
                    <span className="ai-footer-end">
                      <span className="ai-awareness">
                        <button
                          type="button"
                          role="switch"
                          className="ai-tool"
                          aria-label="Continuous awareness" data-hotkey="awareness"
                          aria-checked={!!settings.awareness}
                          title="Continuous awareness: the AI sees what you do while it works. Fills its memory faster."
                          disabled={awarenessBusy}
                          onClick={async () => {
                            const enabled = !settings.awareness;
                            setAwarenessBusy(true);
                            setSettings(previous => ({ ...previous, awareness: enabled }));
                            setError('');
                            try {
                              await window.desktop.aiAwareness(enabled);
                            } catch (reason) {
                              setSettings(previous => ({ ...previous, awareness: !enabled }));
                              setError(reason.message);
                            } finally {
                              setAwarenessBusy(false);
                            }
                          }}
                        >
                          {settings.awareness ? <Eye size={15} aria-hidden="true" /> : <EyeOff size={15} aria-hidden="true" />}
                        </button>
                        {task?.status === 'complete' && !busy && (
                          <span className="ai-task-state">{task.phase === 'verified' ? 'Result verified' : 'Task complete'}</span>
                        )}
                      </span>
                      {busy && (
                        <button type="button" className="ai-stop" title="Stop the AI." data-hotkey="stop" data-hotkey-label="Stop" onClick={() => window.desktop.aiCancel(id)}>
                          <Square size={11} aria-hidden="true" />
                          <span className="ai-hidden-label">Stop</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="ai-primary ai-send" data-hotkey="send" data-hotkey-label="Send"
                        aria-label={native && signedIn === false ? 'Sign in to send' : busy ? 'Steer' : 'Send'}
                        title={busy ? 'Send to the AI while it works.' : 'Send (Enter).'}
                        disabled={!prompt.trim() || authBusy || switching}
                        onClick={() => send()}
                      >
                        {native && signedIn === false ? <LogIn size={15} aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
                      </button>
                    </span>
                  </footer>
                  {activeTool && (
                    <div className="ai-tool-hint" role="status">
                      {activeTool.id === 'eraser'
                        ? 'Drag over drawings to erase them.'
                        : `Drag on the model to ${activeTool.id === 'pen' ? 'draw' : 'highlight'}.`}{' '}
                      Alt+drag rotates the camera · Esc or click the tool again to stop.
                    </div>
                  )}
                </div>
              </>
            )}
          </section>,
          dock,
        )}
      {cleanup &&
        createPortal(
          <div ref={cleanupRoot} className="ai-cleanup-shade">
            <section className="ai-cleanup" role="dialog" aria-modal="true" aria-label="Tidy up AI chats" data-hotkey-prefix="ai-cleanup" data-hotkey-scope="ai-cleanup" data-hotkey-badges="false">
              <header>
                <strong>{translate(`Tidy up the AI chats for ${cleanup.name}?`)}</strong>
                <button type="button" aria-label="Decide later" data-hotkey="close" title="Decide later." onClick={() => setCleanup(null)}>
                  <X size={14} aria-hidden="true" />
                </button>
              </header>
              <p>The AI worked on this model since it was last saved. Its chats and screenshots take space and slow long sessions down.</p>
              <div className="ai-cleanup-choices">
                {CLEANUP_CHOICES.map(([mode, label, tip]) => (
                  <button
                    key={mode}
                    data-hotkey={mode} data-hotkey-label={label}
                    type="button"
                    className={mode === 'summary' ? 'ai-primary' : ''}
                    title={tip}
                    disabled={busy && mode !== 'keep'}
                    onClick={() => chooseCleanup(mode)}
                  >
                    <b>{label}</b>
                    <span>{tip}</span>
                  </button>
                ))}
              </div>
              {busy && <p className="ai-cleanup-note">Cleaning up is available once the AI finishes its current job.</p>}
              <label title="Use this choice every time for this model.">
                <input data-hotkey="remember" data-hotkey-label="Remember for this model" type="checkbox" checked={rememberCleanup} onChange={event => setRememberCleanup(event.target.checked)} />
                Remember for this model
              </label>
            </section>
          </div>,
          document.body,
        )}
    </>
  );
}
