import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowUp,
  Check,
  ChevronRight,
  Eraser,
  Eye,
  EyeOff,
  Highlighter,
  LoaderCircle,
  LogIn,
  Paperclip,
  PenLine,
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
    tip: 'Marker: drag on the model to highlight an area for the AI, e.g. "cut this area into its own geoset". Your normal camera controls still work (Alt+drag rotates). Notes never change the model.',
  },
  {
    id: 'pen',
    label: 'Pen',
    Icon: PenLine,
    tip: 'Pen: scribble on or around the model to show the AI a line or shape, e.g. "give the muscle this outline". Your normal camera controls still work (Alt+drag rotates). Notes never change the model.',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    Icon: Eraser,
    tip: 'Eraser: drag over Pen or Marker notes to remove them.',
  },
];
const DOCK_WIDTH = 'mdlxl-ai-width';
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
      <button type="button" className="ai-part-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronRight size={13} aria-hidden="true" />
        {live ? 'Thinking…' : 'Thought process'}
      </button>
      <div ref={body} className="ai-thinking-text">
        {part.text.trim()}
      </div>
    </div>
  );
}
function ToolPart({ part }) {
  const [open, setOpen] = useState(false),
    name = toolName(part.name),
    line = detailLine(part.detail);
  return (
    <div className={'ai-step ai-step-' + part.status + (open ? ' ai-open-part' : '')}>
      <button type="button" className="ai-part-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
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
function AssistantMessage({ message, live }) {
  const parts = message.parts?.length ? message.parts : message.text ? [{ type: 'text', text: message.text }] : [];
  return parts.map((part, index) =>
    part.type === 'thinking' ? (
      <ThinkingPart key={index} part={part} live={live && index === parts.length - 1} />
    ) : part.type === 'tool' ? (
      <ToolPart key={index} part={part} />
    ) : (
      <AiMessage key={index} text={part.text} />
    ),
  );
}

export default function AiAssistant({ bridge }) {
  const [open, setOpen] = useState(false),
    [settingsOpen, setSettingsOpen] = useState(false),
    [settings, setSettings] = useState({ provider: 'codex', model: '', executable: '', baseUrl: '' });
  const [apiKey, setApiKey] = useState(''),
    [models, setModels] = useState([]),
    [status, setStatus] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [authBusy, setAuthBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(null);
  const [task, setTask] = useState(null),
    [awarenessBusy, setAwarenessBusy] = useState(false);
  const [prompt, setPrompt] = useState(''),
    [images, setImages] = useState([]),
    [messages, setMessages] = useState([]),
    [external, setExternal] = useState(false);
  const [id, setId] = useState(() => localStorage.getItem('mdlxl-ai-chat') || crypto.randomUUID());
  const [dock, setDock] = useState(null),
    [width, setWidth] = useState(storedWidth),
    [palette, setPalette] = useState(false);
  const sketch = useSyncExternalStore(sketchStore.subscribe, sketchStore.get);
  const scroll = useRef(),
    files = useRef(),
    input = useRef(),
    pinned = useRef(true),
    activeId = useRef(id);
  activeId.current = id;
  useEffect(() => {
    localStorage.setItem('mdlxl-ai-chat', id);
  }, [id]);
  useEffect(() => {
    if (!window.desktop?.aiStatus) return;
    window.desktop
      .aiStatus()
      .then(async value => {
        setSettings(value);
        setExternal(value.enabled);
        const [messages, task] = await Promise.all([
          window.desktop.aiTranscript(activeId.current),
          window.desktop.aiTask(activeId.current),
        ]);
        setMessages(messages);
        setTask(task);
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
      if (event.id && event.id !== activeId.current) return;
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
        setBusy(false);
        if (event.authRequired) {
          setSignedIn(false);
          setSettingsOpen(true);
        }
      }
      if (event.type === 'done') {
        setStatus('');
        setBusy(false);
      }
      if (event.type === 'awareness') setSettings(previous => ({ ...previous, awareness: event.enabled }));
      if (event.type === 'task') {
        setTask(event.task);
        if (event.task?.status === 'running') setStatus(phases[event.task.phase] || 'Working on the model');
      }
    });
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
  const summary = open ? bridge.summary() : null;
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
      newChat();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setAuthBusy(false);
      setStatus('');
    }
  }
  function newChat() {
    if (busy) return;
    setId(crypto.randomUUID());
    setMessages([]);
    setTask(null);
    setStatus('');
    setError('');
  }
  // While the AI works, a message steers the running task instead of starting a new one.
  async function steer() {
    const text = prompt.trim();
    if (!text) return;
    setError('');
    try {
      const result = await window.desktop.aiSteer({ id, text, annotations: bridge.annotations() });
      if (result.queued) setPrompt('');
      else setStatus('The AI just finished. Press Enter again to send this as a new message.');
    } catch (reason) {
      setError(reason.message);
    }
  }
  async function send(resumeTask = false) {
    const resume = resumeTask === true;
    if (!resume && busy) return steer();
    if ((!resume && !prompt.trim()) || busy || authBusy) return;
    if (native && signedIn === false) {
      await authenticate('login');
      return;
    }
    const text = prompt,
      attached = images;
    setBusy(true);
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
      setBusy(false);
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
      else if (settings.provider === 'codex' && !models.length) setModels(await window.desktop.aiModels());
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
    if (!open && !busy && !authBusy && native && window.desktop?.aiAuth) authenticate('status');
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
      const next = Math.round(Math.max(300, Math.min(window.innerWidth * 0.6, startWidth + startX - moveEvent.clientX)));
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
        className="ai-open"
        aria-label="AI assistant"
        title="Open the AI console: describe what you want, draw on the model to show where"
        aria-pressed={open}
        onClick={toggleOpen}
      >
        AI{busy ? ' ·' : ''}
      </button>
      {open &&
        dock &&
        createPortal(
          <section
            className="ai-assistant ai-console"
            role="complementary"
            aria-label="AI assistant"
            style={{ '--ai-width': width + 'px' }}
          >
            <div
              className="ai-resize"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize AI console"
              title="Drag to resize the AI console"
              onPointerDown={resizeStart}
            />
            <header className="ai-heading">
              <strong>AI</strong>
              <button
                type="button"
                className="ai-provider-name"
                title="Change the AI connection"
                onClick={() => setSettingsOpen(value => !value)}
              >
                <span translate="no">{providerName}</span>
              </button>
              <button
                type="button"
                className="ai-icon-button"
                aria-label="New chat"
                title="New chat"
                disabled={busy || authBusy}
                onClick={newChat}
              >
                <SquarePen size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ai-icon-button"
                aria-label="Connection settings"
                title="Connection settings"
                aria-expanded={settingsOpen}
                onClick={() => setSettingsOpen(value => !value)}
              >
                <Settings2 size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="ai-icon-button"
                aria-label="Close AI assistant"
                title="Close the AI console (drawings are kept)"
                onClick={() => setOpen(false)}
              >
                <X size={15} aria-hidden="true" />
              </button>
            </header>
            {!window.desktop?.aiSend ? (
              <p className="ai-empty">The AI connection is available in the desktop app.</p>
            ) : (
              <>
                {settingsOpen && (
                  <div className="ai-connection">
                    <label>
                      AI provider
                      <select
                        aria-label="AI provider"
                        value={settings.provider}
                        disabled={busy || authBusy}
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
                          disabled={busy || authBusy}
                          onClick={() => authenticate('login')}
                        >
                          <LogIn size={14} aria-hidden="true" />
                          Sign in
                        </button>
                        <button disabled={busy || authBusy} onClick={() => authenticate('status')}>
                          Check sign-in
                        </button>
                        <button disabled={busy || authBusy} onClick={() => authenticate('logout')}>
                          Sign out
                        </button>
                        {authBusy && <button onClick={() => window.desktop.aiCancel()}>Cancel</button>}
                      </div>
                    ) : (
                      <label>
                        API key
                        <input
                          type="password"
                          autoComplete="off"
                          value={apiKey}
                          placeholder={settings.hasKey ? 'Saved securely' : ''}
                          onChange={event => setApiKey(event.target.value)}
                        />
                      </label>
                    )}
                    {settings.provider === 'compatible' && (
                      <label>
                        API base URL
                        <input
                          value={settings.baseUrl || ''}
                          placeholder="http://localhost:1234/v1"
                          onChange={event =>
                            setSettings(previous => ({ ...previous, baseUrl: event.target.value }))
                          }
                        />
                      </label>
                    )}
                    <label>
                      Model
                      <input
                        aria-label="Model"
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
                    <div className="ai-row">
                      <button
                        disabled={busy || authBusy}
                        onClick={() =>
                          action(async () => {
                            await saveSettings();
                            setStatus('Connection saved.');
                          })
                        }
                      >
                        Save connection
                      </button>
                      <button disabled={busy || authBusy || settings.provider === 'claude'} onClick={loadModels}>
                        Load models
                      </button>
                    </div>
                    {native && (
                      <details>
                        <summary>Advanced connection</summary>
                        <label>
                          CLI executable (optional)
                          <input
                            value={settings.executable || ''}
                            disabled={busy || authBusy}
                            placeholder={settings.provider + '.exe'}
                            onChange={event =>
                              setSettings(previous => ({ ...previous, executable: event.target.value }))
                            }
                          />
                        </label>
                      </details>
                    )}
                    <details>
                      <summary>Connect another AI</summary>
                      <p>Connect any local AI client that supports MCP to the same editor tools.</p>
                      <div className="ai-row">
                        <button
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
                            <AssistantMessage message={message} live={live && index === messages.length - 1} />
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
                    <button type="button" className="ai-icon-button" aria-label="Dismiss" onClick={() => setError('')}>
                      <X size={13} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {task?.canResume && !busy && (
                  <div className="ai-resume">
                    <span>Task paused. Applied edits are kept.</span>
                    <button disabled={authBusy} onClick={() => send(true)}>
                      Resume task
                    </button>
                  </div>
                )}
                <div className="ai-composer">
                  {(summary || images.length > 0 || strokes.length > 0) && (
                    <div className="ai-chips">
                      {summary && (
                        <span
                          className="ai-chip"
                          title="The model, selection and drawings are captured when you send the prompt."
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
                        </span>
                      )}
                      {strokes.length > 0 && (
                        <span className="ai-chip" title="Pen and Marker notes on the model; the AI sees them">
                          {translate(`${strokes.length} drawing${strokes.length === 1 ? '' : 's'}`)}
                          <button
                            type="button"
                            aria-label="Undo last drawing"
                            title="Undo last drawing"
                            onClick={() => sketchStore.undo(summary.documentId)}
                          >
                            <Undo2 size={12} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Clear drawings"
                            title="Clear all drawings on this model"
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
                          className="ai-chip ai-image-chip"
                          title="Remove attached image"
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
                    aria-label="AI prompt"
                    placeholder={
                      busy ? 'Steer the AI while it works…' : 'Ask the AI to change your model…'
                    }
                    value={prompt}
                    onChange={event => setPrompt(event.target.value)}
                    onPaste={event => {
                      const pasted = [...event.clipboardData.files];
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
                      aria-label="Attach"
                      disabled={busy || authBusy}
                      title="Attach reference models or images"
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
                          aria-label={label}
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
                            aria-label={'Color: ' + sketch.color[colorTool]}
                            title="Color for this tool. Colors can mean different things, e.g. red = remove, green = keep."
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
                                  aria-label={color.id}
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
                      <select
                        className="ai-model"
                        aria-label="Chat model"
                        title="Model"
                        value={settings.model || ''}
                        disabled={busy || authBusy}
                        onChange={event =>
                          action(async () => {
                            const value = await window.desktop.aiConfigure({
                              ...settings,
                              model: event.target.value,
                              apiKey,
                            });
                            setSettings(value);
                            setApiKey('');
                          })
                        }
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
                      <span className="ai-awareness">
                        <button
                          type="button"
                          role="switch"
                          className="ai-tool"
                          aria-label="Continuous awareness"
                          aria-checked={!!settings.awareness}
                          title="Continuous awareness: share live model, selection, camera and timeline changes with the connected AI. It never starts AI requests by itself; turning it off stops future updates."
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
                        <button type="button" className="ai-stop" title="Stop the AI" onClick={() => window.desktop.aiCancel()}>
                          <Square size={11} aria-hidden="true" />
                          <span className="ai-hidden-label">Stop</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className="ai-primary ai-send"
                        aria-label={native && signedIn === false ? 'Sign in to send' : busy ? 'Steer' : 'Send'}
                        title={busy ? 'Send this to the AI while it works' : 'Send (Enter)'}
                        disabled={!prompt.trim() || authBusy}
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
    </>
  );
}
