# Audit 03: AI subsystem

Read-only audit of origin/main at `fe46a534`. Scope: `electron/ai-*.cjs`, `app/AiAssistant.jsx`, `app/ai-editor.js`, `app/ai-review.js`, `app/ai-*.js`, `src/ai-*.js`, AI part of `electron/preload.cjs`.
Line numbers are from that revision. "Proposed owner" is a smallest-change suggestion that keeps product behaviour; anything that would change visible behaviour is called out as needing the owner's approval.

## Summary counts

| Severity | Findings |
|---|---|
| High | 2 |
| Medium | 8 |
| Low | 12 |
| **Total** | **22** |

By category: re-implemented helpers 9 (F1, F6, F7, F10, F12, F13, F14, F17, F22), oversized files 2 (F8, F9), state in two places 5 (F2, F5, F15, F16, F18), provider abstraction leaks 2 (F3, F4 + ~20 branch sites), IPC/dead code 2 (F19, F21), duplicated prompt text 1 (F20), mixed tool classification 1 (F11).

IPC: 31 `invoke` channels, 5 `send` channels, 3 main-to-renderer push channels, 2 sandbox channels. All 38 preload methods are used by the renderer. One emitted `ai:event` type (`waiting`) is never consumed; one (`awareness-delivered`) is test-only.

No `TODO`/`FIXME`/`legacy`/`deprecated` markers and no commented-out code blocks (longest comment run is 6 lines, `src/ai-sketch.js:93-98`, prose). One intentional parked feature flag: SD Brain (`src/ai-sd-rules.js:34`, `SD_BRAIN_AVAILABLE = false`).

---

## High

### F1. Provider dispatch and "one-shot AI call" boilerplate repeated in ai-service.cjs

**Severity:** high (the most repeated plumbing; each new provider or option means 4 edits).

Provider dispatch, identical in 4 places:

- `electron/ai-service.cjs:643-645` (routeJob)
- `electron/ai-service.cjs:1080-1082` (runTask)
- `electron/ai-service.cjs:1375-1377` (artDirection)
- `electron/ai-service.cjs:1422-1424` (outsideCheck)

```js
if (settings.provider === 'codex') await runCodex(options);
else if (settings.provider === 'claude') await runClaude(options);
else await runApi(options);
```

The tool-free one-shot call (build options, collect `text` events into `reply`, forward the rest to a meter, no tools, throwaway conversation, `awareness: null`, throwaway steering) is written out 3 times:

- `electron/ai-service.cjs:606-628` routeJob: `event: value => { if (value.type === 'text') reply += value.text; else meter(value); }, tools: [], call: async () => { throw Error('Routing has no editor tools.'); }`
- `electron/ai-service.cjs:1350-1374` artDirection: `event: (() => { const meter = this.measureUsage(...); return value => { if (value.type === 'text') reply += value.text; else meter(value); }; })()`
- `electron/ai-service.cjs:1382-1416` outsideCheck: same shape, `throw Error('The outside check has no tools.')`

**Identical vs divergent:** dispatch identical. One-shot blocks differ only in: routeJob forces `stepLimit: 1`, artDirection passes user images, the "no tools" error text, the meter role name (`router`, `bird`, `outside check`) and the throwaway conversation id suffix (`-router`, `-art`, `-check`).

**Proposed owner:**
- `runProvider(options)` exported from `electron/ai-providers.cjs` (`({ codex: runCodex, claude: runClaude }[options.settings.provider] || runApi)(options)`). The 4 call sites switch to it.
- `AiService.askOnce({ settings, system, prompt, images, conversation, signal, meter, label })` in `electron/ai-service.cjs`, returning the reply text. routeJob (per attempt), artDirection and outsideCheck switch to it; each keeps its own parsing.

**Risk:** low. Tests use real fake servers / fake CLIs, not module stubs, so a dispatcher is transparent. Covering tests: `test/ai-offload.test.js` (routing decisions, invalid-reply retry), `test/ai-workflow.test.js` (outside check, art direction, web research), `test/ai-provider-protocol.test.js` (measureUsage), packaged `test/ai-routing.electron.cjs`, `test/ai-console.electron.cjs`.

### F2. The chat transcript is reduced twice: AiRecorder in main and a hand-written copy in the renderer

**Severity:** high (state in two places; the copies have already drifted).

- Main: `electron/ai-offload.cjs:86-135` `AiRecorder.event(value)` builds the stored transcript (text/thinking merge, compaction, question, question-result, provider-notice de-dup, tool, tool-result matching, worker, art, cost, usage).
- Renderer: `app/AiAssistant.jsx:463-605` (`update` helper at 463, `onAiEvent` reducer at 473) re-implements the same rules on React state:

```js
// ai-offload.cjs:107
const same = reply.parts.findIndex(p => p.type === part.type && p.text === part.text && p.name === part.name);
// AiAssistant.jsx:518
same = message.parts.findIndex(p => p.type === part.type && p.text === part.text && p.name === part.name);
```

The renderer throws its copy away and reloads the main one (`aiTranscript`) on view change (`AiAssistant.jsx:643-656`), after a model-choice question (`:881-884`) and after authRequired (`:886-893`), so the two must stay equal.

**Divergent behaviour found:**
- `error`: main stores `recorder.reply.error` (`ai-service.cjs:490`, `:1294`) and the thread shows it inline after a reload (`AiAssistant.jsx:1497-1500`); live, the renderer only sets the banner (`AiAssistant.jsx:587-592`). Same error, two looks depending on whether the chat was reopened.
- `provider-notice`: main keeps 5 named fields (`ai-offload.cjs:106`); renderer spreads the whole event, including `id` (`AiAssistant.jsx:518`).
- `cost`: main adds `roles` only when present (`ai-offload.cjs:129`); renderer always sets it (`AiAssistant.jsx:537`).
- `usage`: main stores `conversation.usage`; renderer ignores it (fine, but undocumented).

**Proposed owner:** one pure reducer, `applyAiEvent(messages, event)` (mutates a shallow copy: last assistant message plus matched part), in a new `src/ai-transcript.js`. Main loads it the same way it already loads `src/ai-tools.js` (dynamic import in `AiService.init()`, `ai-service.cjs:78-81`) and passes it to `AiRecorder`; the renderer imports it and calls it inside `setMessages`. Keep the renderer-only side effects (status line, banner error, `setOrg`/`setSettings`) where they are. To keep behaviour unchanged, leave `error` out of the shared reducer; whether live errors should also show inline is an owner decision.

**Risk:** medium (streaming text merge must stay cheap; the renderer must keep immutable updates). Covering tests: `test/ai-provider-protocol.test.js`, `test/ai-questions.test.js` (AiRecorder), `test/ai-questions.electron.cjs`, `test/ai-console.electron.cjs`, `test/ai-editor.electron.cjs`, `test/ai-parallel.electron.cjs`. There is no unit test of the renderer reducer today; add one with the shared function.

---

## Medium

### F3. Provider identity and capabilities are spread outside ai-providers.cjs

**Severity:** medium.

Provider list, written twice:
- `electron/ai-service.cjs:213` `if (!['codex', 'claude', 'openai', 'anthropic', 'compatible'].includes(input.provider))`
- `app/AiAssistant.jsx:34-40` `const providers = [['codex', 'Codex / ChatGPT'], ['claude', 'Claude Code'], ...]`
- Default `'codex'` twice: `ai-service.cjs:91`, `AiAssistant.jsx:402`.

"Native CLI" set, 5 copies:
- `ai-service.cjs:218` `const native = ['codex', 'claude'].includes(input.provider)`
- `ai-service.cjs:419` `if (['codex', 'claude'].includes(settings.provider)) {` (auth before send)
- `ai-service.cjs:1907` `if (!['codex', 'claude'].includes(settings.provider)) throw Error('This provider uses an API key.');`
- `AiAssistant.jsx:731` `const native = ['codex', 'claude'].includes(settings.provider);`
- `AiAssistant.jsx:911` `else if (['codex', 'claude'].includes(settings.provider) && !models.length)`

Capability gates in the settings form (what each provider supports), only in the renderer:
- `AiAssistant.jsx:1277` `settings.provider === 'compatible'` (custom base URL row)
- `AiAssistant.jsx:1317` `settings.provider !== 'compatible'` (Thinking effort)
- `AiAssistant.jsx:1340` `!native` (spending limit)
- `AiAssistant.jsx:1353` `settings.provider !== 'codex'` (step limit)
- `AiAssistant.jsx:116` `name?.replace(/^mcp__mdlxl__/, '')` (Claude Code's tool naming leaks into the console)
- `WEB_TIP` (`AiAssistant.jsx:108-109`) states which providers support web research; `runApi` only uses `web` in the Anthropic branch (`ai-providers.cjs:226`).

Provider storage layout known in three files:
- `electron/ai-process.cjs:18` `env[provider === 'codex' ? 'CODEX_HOME' : 'CLAUDE_CONFIG_DIR'] = path.join(directory, provider);`
- `electron/ai-offload.cjs:241` `for (const provider of ['codex', 'claude']) await walk(path.join(directory, provider), 0);`
- `electron/ai-service.cjs:1709` `for (const folder of ['codex/sessions', 'codex/archived_sessions', 'claude/projects'])`

Claude-specific model knowledge in the service:
- `ai-service.cjs:250` `(settings.provider === 'claude' ? [{id:'haiku',name:'Haiku'}] : [])`
- `ai-service.cjs:435` `... && settings.provider !== 'claude') await this.models();`
- duplicates the alias list in `ai-providers.cjs:1101-1107`.

**Identical vs divergent:** all copies agree today.

**Proposed owner:** a small provider table, `src/ai-providers.json` (same pattern as `src/ai-birds.json`, already `require`d by `electron/ai-offload.cjs:10` and imported by `AiAssistant.jsx:32`): `{ id, label, native, apiKey, baseUrl, effort, spendLimit, stepLimit, web, logFolders }`. `ai-service.cjs` (213, 218, 419, 1907), `ai-offload.cjs:241`, `ai-service.cjs:1709` and `AiAssistant.jsx` (34-40, 731, 911, 1277, 1317, 1340, 1353) read flags from it. Labels and order stay as they are.

**Risk:** low if the table reproduces today's values. Tests: `test/ai-native-providers.test.js` (configure validation, key/baseUrl rules), `test/ai-offload.test.js` (cleanup sweeps), `test/ai-hotkeys.electron.cjs` (settings form keys), `test/ai-console.electron.cjs`.

### F4. Codex and Claude sign-in and Codex model listing live in ai-service.cjs, not ai-providers.cjs

**Severity:** medium (provider leak; the providers module is half the story for native CLIs).

- `electron/ai-service.cjs:1871-1899` `models()`: Codex branch starts a `CodexProcess` and calls `model/list` itself, while `providerModels` returns `[]` for Codex (`ai-providers.cjs:1108` `if (settings.provider === 'codex') return [];`).
- `electron/ai-service.cjs:1900-1982` `auth(action)`: full Codex login (`account/login/start`, browser open, `account/login/completed`) and full Claude `claude auth <action>` spawn, using `providerEnvironment`, `spawnAgent`, `lines`, `stopAgent` directly.

**Proposed owner:** `providerModels` in `ai-providers.cjs` handles Codex too (move the `model/list` block); new `providerAuth(settings, action, { directory, signal, openExternal, notify })` in `ai-providers.cjs`. `AiService.models()`/`auth()` keep the busy/exclusive checks and the `modelCatalog` cache only.

**Risk:** low-medium (moving code, same calls). Tests: `test/ai-native-providers.test.js` (auth with fake CLIs), `test/ai-offload.test.js` (`models()`), `test/ai-provider-protocol.test.js`.

### F5. Native sign-in is checked twice for every send (two CLI launches)

**Severity:** medium (performance; each check starts a Codex app-server or runs `claude auth status`).

- Renderer: `app/AiAssistant.jsx:829-836`
  ```js
  if (native) {
    const auth = await window.desktop.aiAuth('status');
    setSignedIn(auth.loggedIn);
  ```
- Main: `electron/ai-service.cjs:419-425`
  ```js
  if (['codex', 'claude'].includes(settings.provider)) {
    const auth = await this.auth('status');
    if (!auth.loggedIn) { ... return { ok: false, authRequired: true, error: error.message }; }
  ```
- The renderer already handles the main result: `AiAssistant.jsx:886-893` (`if (result.authRequired) { setSignedIn(false); setSettingsOpen(true); ... }`).

**Proposed owner:** keep the main check (it guards the turn); drop the renderer pre-check in `send()`. Note one visible difference to confirm with the owner: without the pre-check the user's bubble appears briefly before the transcript reload. Alternative with zero visible change: main caches a successful status for the session and `auth('login'/'logout')` clears it.

**Risk:** low. Tests: `test/ai-native-providers.test.js`, `test/ai-console.electron.cjs`, `test/ai-live.electron.cjs`.

### F6. Tool-step events and image conversion are written separately in every provider runner

**Severity:** medium-low.

`tool-result` events with a 300-character summary, 4 copies plus 2 for outside check:
- `ai-providers.cjs:345-351` (Anthropic API) `summary: result.content.find(c => c.type === 'text')?.text?.slice(0, 300)`
- `ai-providers.cjs:456-462` (OpenAI/compatible) `summary: textContent.slice(0, 300)`
- `ai-providers.cjs:652-659` (Codex) `summary: (p.item.error?.message || p.item.result?.content?.find(c => c.type === 'text')?.text)?.slice(0, 300)`
- `ai-providers.cjs:1048-1056` (Claude Code) `summary: typeof text === 'string' ? text.slice(0, 300) : undefined`
- `ai-service.cjs:1434`, `:1441` (outside check, full text, no slice)

Tool result run plus error wrap, 2 copies: `ai-providers.cjs:329-334` and `:430-442` (`try { result = await callEditorTool(...) } catch (error) { result = { isError: true, content: [{ type: 'text', text: error.message }] }; }`). Note `callEditorTool` (`ai-mcp.cjs:64-76`) already catches tool errors, so these only catch validation errors.

MCP image content to provider format, 3 variants:
- `ai-providers.cjs:340-342` Anthropic `{ type: 'image', source: { type: 'base64', media_type: c.mimeType, data: c.data } }`
- `ai-providers.cjs:452-455` OpenAI `{ type: 'image_url', image_url: { url: \`data:${image.mimeType};base64,${image.data}\` } }`
- `ai-providers.cjs:580` Codex `{ type: 'inputImage', imageUrl: 'data:' + c.mimeType + ';base64,' + c.data }`

Two data-URL parsers with different strictness:
- `ai-providers.cjs:67` `/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/`
- `ai-mcp.cjs:54` `/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s`

Divergence: Codex's dynamic `item/tool/call` path (`ai-providers.cjs:579`) calls `callEditorTool` without `awareness`, so it does not append the live-awareness text that `runApi` (`:331`) and the MCP server (`ai-mcp.cjs:243-250`) append. Probably harmless (Codex uses MCP for editor tools), but undocumented.

**Proposed owner:** in `ai-providers.cjs`, next to `toolDetail` (`:75-82`): `toolSummary(text)` (the 300 slice), `providerImage(content, kind)` and reuse of one `IMAGE_DATA_URL` regex exported from `ai-mcp.cjs`. Runners switch call by call. Do not unify the regexes' strictness without a test (the stricter one rejects whitespace).

**Risk:** low. Tests: `test/ai-providers.test.js`, `test/ai-native-providers.test.js`, `test/ai-mcp.test.js`, `test/ai-workflow.test.js`.

### F7. JSON extraction from a model reply: two different implementations

**Severity:** medium-low.

- `electron/ai-service.cjs:647` (routing): strips a code fence, then parses the whole reply.
  `JSON.parse(reply.trim().replace(/^\x60\x60\x60(?:json)?\s*|\s*\x60\x60\x60$/g, ''))`
- `electron/ai-service.cjs:1425` (outside check): slices first `{` to last `}`.
  `JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1))`

**Divergent:** routing rejects prose around the JSON (and then retries once with a correction prompt, `:661-664`); outside check accepts it.

**Proposed owner:** `jsonFromReply(text)` in `electron/ai-service.cjs` (or `ai-job-plan.cjs`, which already holds pure job helpers). Smallest safe step: one helper with today's two behaviours as an option, so nothing changes. Making routing as lenient as the outside check would reduce correction retries but is a behaviour change for the owner to approve.

**Risk:** low. Tests: `test/ai-offload.test.js` ("routing decision"), `test/ai-workflow.test.js` (outside check verdicts).

### F8. ai-service.cjs (2196 lines) owns about 16 responsibilities

**Severity:** medium.

| Lines | Responsibility |
|---|---|
| 1-51 | Imports, limit and cleanup-day helpers |
| 82-113, 114-164, 179-263, 1538-1580 | Connection config: load/persist (`connections.json`), key encryption, `status`, `setModel`, `configure`, `lighterChoices`, `settings`, and the five on/off toggles |
| 165-178, 264-307 | Window bridge: `busy`, `runningChats`, `emitRunning`, `emit`, editor-tool RPC `call` (180 s timeout, waiting pause) |
| 308-350 | External MCP server lifecycle (`enable`, `setEnabled`) |
| 351-399, 1748-1756 | Conversation storage (`conversation`, `persistConversation`, `readConversation`, `taskInfo`) |
| 400-502 | Prompt admission and model choice (`send`) |
| 503-605 | Offload organiser and parallel region jobs (`runOffload`, `runRegionJobs`) |
| 606-668 | Automatic routing (`routeJob`, router prompt, JSON validation) |
| 669-701 | Cost and context metering (`measureUsage`) |
| 702-1152 | Task engine: tool gating, plan, checkpoints, routines, review, SD Brain review, outside-check hook, verification loop, diary (`runTask`, 450 lines) |
| 1153-1349, 1446-1473 | Birds: helper, briefing, names, `runWorker`, handovers, retire, roster |
| 1350-1445, 2167-2194 | One-shot judges: art director, outside check, `choosePictures` |
| 1474-1537, 1581-1747 | Organiser registry and chat cleanup: organiser/new/rekey/saveState, cleanup modes, `chatsOf`, `removeChats`, important, `cleanupUnused`, timers, memory note |
| 1757-1821 | Questions to the user (`askUser`, link, answer) |
| 1822-1870 | Steering and cancel |
| 1871-1982 | Provider account ops (`models`, `auth`), see F4 |
| 1983-1998 | Shutdown |
| 2000-2165 | IPC registration, including editor utilities unrelated to AI state: `ai:capture` (2063), `ai:gesture` (2068-2117), `ai:readModel` (2118), `ai:writeModel` (2123) |

**Smallest extractions (no rewrite), in order of payoff:**
1. F1's `askOnce` and `runProvider` (removes ~60 lines, no file split).
2. Chat cleanup block (1581-1718: `setRememberedCleanup`, `cleanup`, `chatsOf`, `removeChats`, `setImportant`, `cleanupUnused`, `startCleanup`) into `electron/ai-chats.cjs` as functions taking the service; `ai-offload.cjs` already owns `OrganiserRegistry` and `deleteProviderSessions`, so this could also go there.
3. `models`/`auth` into `ai-providers.cjs` (F4).
4. The four editor-utility IPC handlers (2063-2131) into `electron/ai-editor-ipc.cjs`; they only need `service.pending` and `getWindow`.

`runTask` itself should stay as it is for now: its closures share task state and splitting it is a rewrite.

**Risk:** medium for 2 and 4 (many internal `this.` references), low for 1 and 3. Tests: whole `test/ai-*.test.js` set, `test/ai-offload.test.js` for cleanup, `test/ai-editor.electron.cjs` for gestures/capture.

### F9. AiAssistant.jsx (1869 lines) mixes console UI, connection settings, transcript and job state

**Severity:** medium.

| Lines | Part | Kind |
|---|---|---|
| 34-131 | Provider labels, tool activity labels, phases, drawing tools, tooltips, cleanup choices, helpers | constants |
| 132-398 | Transcript part components: `detailLine`, `ThinkingPart`, `ArtPart`, `CompactionPart`, `readablePlan`, `ToolPart`, `WorkerPart`, `CostLine`, `QuestionPart`, `ProviderNotice`, `AssistantMessage`, `FrameLabel` | transcript view |
| 399-448 | About 30 `useState` plus refs (`activeId`, `pinned`, `rekeying`) | all |
| 450-606 | `aiStatus` load and the `onAiEvent` reducer (F2) | transcript + job state |
| 607-622 | Per-chat drafts | composer |
| 623-735 | Effects: organiser load, transcript load, save state, waiting, save-cleanup offer, scroll, dock, textarea, Escape | job state + console |
| 736-765, 902-937 | `saveSettings`, `changeProvider`, `authenticate`, `loadModels` | connection settings |
| 766-901 | `newChat`, `chooseCleanup`, `steer`, `send` (send is ~100 lines with draft re-keying) | job state |
| 938-990 | Attach files, drawing tool, dock resize | composer/console |
| 1000-1193 | Open button, header toggles (Offload, SD Brain, handbook, web), roster | console |
| 1194-1449 | Connection settings form | connection settings |
| 1450-1565 | Thread, status, account, error, resume, model question | transcript + job state |
| 1566-1827 | Composer: chips, drawing tools, palette, awareness, send/stop | console |
| 1828-1869 | Save-cleanup dialog | chat cleanup |

**Smallest extractions:** (1) move the part components (132-398) unchanged into `app/AiParts.jsx`; (2) the reducer into the shared `src/ai-transcript.js` (F2); (3) optionally the settings form (1194-1449) into `app/AiConnectionSettings.jsx` with `settings`, `setSettings`, `authBusy`, `anyBusy`, `models` and the 3 action callbacks as props. No layout or control changes.

**Risk:** low for (1), medium for (3) (many props; hotkey `data-hotkey` attributes must stay identical). Tests: `test/ai-console.electron.cjs`, `test/ai-hotkeys.electron.cjs`, `test/ai-questions.electron.cjs`, `test/ai-organiser-refresh.electron.cjs`.

### F10. Five near-identical on/off setters, each with its own IPC channel, preload method and renderer listener

**Severity:** medium-low.

- `ai-service.cjs:145-155` `setAwareness`, `:1541-1549` `setSdBrain`, `:1551-1558` `setEditingHandbook`, `:1560-1567` `setWebResearch`, `:1573-1580` `setOffload`:
  ```js
  if (typeof enabled !== 'boolean') throw Error('Choose on or off.');
  const config = await this.configuration();
  config.webResearch = enabled; await this.persist(); this.emit({ type: 'web-research', enabled }); return this.status();
  ```
- IPC: `ai-service.cjs:2023`, `:2039-2042`; preload `electron/preload.cjs:7`, `:24-27`.
- Renderer listeners: `AiAssistant.jsx:476-479` and `:595`.

**Divergent:** `setAwareness` also calls `this.awareness.setEnabled`; `setSdBrain` checks availability first. The rest are identical.

**Proposed owner:** private `async setSwitch(key, event, enabled, after)` in `AiService`; the five public methods stay (tests call them) and become one-liners. IPC channels and preload names stay unchanged.

**Risk:** low. Tests: `test/ai-offload.test.js` (`setOffload`, `setEditingHandbook`), `test/ai-workflow.test.js` (`setWebResearch`, `setEditingHandbook`), `test/ai-awareness.test.js`.

### F20. Prompt text outside src/ai-tools.js, and repeated prompt fragments

**Severity:** medium (prompts are the product; scattered copies drift).

All system prompts live in `src/ai-tools.js` (`AI_SYSTEM_PROMPT` 312, `AI_ORGANISER_PROMPT` 430, `AI_WORKER_NOTE` 434, `AI_HELPER_NOTE` 438, handover/memory 440-444) except:
- Router system prompt hard-coded in `electron/ai-service.cjs:626` (`system: 'Route one message. In bird mode, act as the organiser. ...'`, ~2000 chars). Its tiny-job and follow-up rules overlap `AI_ORGANISER_PROMPT` (`src/ai-tools.js:430-432`: "Follow-ups ... go to the worker that did that job ... Small one-step jobs ... go to the tiny-jobs worker").
- MCP `initialize` instructions in `electron/ai-mcp.cjs:202` ("Start with mdlxl_context. Preserve unrelated model data and use the captured target token...") restate parts of `AI_SYSTEM_PROMPT` lines 313-318.

Fragile coupling: the worker prompt drops the first line of the editing prompt by string surgery, `ai-service.cjs:1051`:
```js
? AI_WORKER_NOTE + '\n' + editing.slice(editing.indexOf('\n') + 1)
```
Any edit to the first line of `AI_SYSTEM_PROMPT` silently changes what workers get.

Repeated prompt fragments inside `ai-service.cjs`:
- "MDLxL context captured when this prompt was sent:\n" + JSON: `:830`, `:1092`, `:1120`
- "Memory note from earlier work on this model:\n": `:1191`, `:1280`
- "SD art brief for this request": `:812`, `:1278`

Repeated user-facing error strings (same meaning, different wording):
- "Terminal and filesystem access ..." 6 variants: `ai-providers.cjs:574`, `:578`, `:579`, `:593`, `:957`, `:958`
- "AI request cancelled." 9 times: `ai-providers.cjs:206`, `:534`, `:540`, `:986`; `ai-service.cjs:281`, `:583`, `:863`, `:2099`, `:2104`; plus `ai-mcp.cjs:68` "Request cancelled." and `app/ai-editor.js:433`, `:1048` "AI request cancelled; no further edit was applied."

**Proposed owner:** move the router prompt to `src/ai-tools.js` as `AI_ROUTER_PROMPT` (runTask already reads prompts from `contract`; routeJob would read `contract.AI_ROUTER_PROMPT`; routeJob is already called with `contract`, `ai-service.cjs:535`, but does not destructure it). Export `AI_EDITING_INTRO` and `AI_EDITING_BODY` so the worker prompt is `AI_WORKER_NOTE + '\n' + AI_EDITING_BODY` with identical text. Small helpers `contextNote(context)`, `memoryNoteText(note)` in `ai-service.cjs`; `CANCELLED` and `TOOLS_ONLY` message constants in `ai-providers.cjs`. Texts stay byte-identical.

**Risk:** low if texts are byte-identical (a test can assert the built strings). Tests: `test/ai-workflow.test.js` (prompt assembly, handbook, web research), `test/ai-offload.test.js` (routing), `test/ai-mcp.test.js` (initialize).

---

## Low

### F11. Four hand-written lists decide which AI tools read or edit

- `src/ai-tools.js:12-16` `readOnlyHint` per tool (MCP annotation): review, capabilities, context, read, sample, capture, help.
- `src/ai-tools.js:18-24` `aiToolEditsModel` (patch, script edit, command, ui click/set/gesture, view mode, versions use).
- `electron/ai-job-plan.cjs:2` `READ_TOOLS` (helpers may call: context, read, capabilities, help, sample, capture, script, assets) plus `helperCanCall` (`:10-13`).
- `app/ai-editor.js:423` queue bypass: `['mdlxl_read', 'mdlxl_sample', 'mdlxl_capture', 'mdlxl_help', 'mdlxl_capabilities'].includes(name) || name === 'mdlxl_script' && !args.edit`.

**Divergent by design** (MCP hint vs helper permission vs concurrency vs edit tracking), but e.g. `mdlxl_assets` is `readOnlyHint: false` yet helper-callable for search/preview/load. **Proposed owner:** keep semantics, co-locate as named exports in `src/ai-tools.js` (`AI_HELPER_TOOLS`, `aiToolRunsUnqueued`) with one comment table; `ai-service.cjs` reads them from `contract` (runTask already destructures it at `:703-719`), `ai-editor.js` imports directly. **Tests:** `test/ai-job-plan.test.js`, `test/ai-workflow.test.js`, `test/ai-editor.electron.cjs`.

### F12. Chat file helpers repeated; two loaders; connections.json not written atomically

- Chat path built 5 times: `ai-service.cjs:363`, `:374`, `:1636`, `:1663`, `:1751` (`path.join(this.directory, 'chat-' + id + '.json')`).
- Id regex 3 times: `ai-service.cjs:352`, `:1689`, `:2048` (`/^[a-zA-Z0-9_-]{1,80}$/`).
- Two loaders: `conversation()` (`:351-372`, caches, throws on non-ENOENT, checks provider) vs `readConversation()` (`:1748-1755`, no cache, returns null on any error). Intentional difference, but both parse plus `settleConversation`.
- Atomic tmp+rename write in `persistConversation` (`:376-379`) and `OrganiserRegistry.save` (`ai-offload.cjs:194-197`), but `persist()` (`ai-service.cjs:101-105`) writes `connections.json` (which holds the encrypted keys) directly. The same tmp+rename appears outside AI in `electron/casc.cjs:87,139,177,209` and `electron/particle-library.cjs:13` (cross-cutting, for the shared-helpers audit).

**Proposed owner:** `chatFile(id)` and `CHAT_ID` in `ai-service.cjs`; `writeJsonAtomic(file, value)` in `ai-offload.cjs` (or a project-wide helper). Making `persist()` atomic is a robustness change; low risk, but mention it to the owner. **Tests:** `test/ai-offload.test.js`, `test/ai-workflow.test.js`.

### F13. Two recursive walkers delete provider session logs

- `electron/ai-offload.cjs:220-243` `deleteProviderSessions` (depth < 6, `.jsonl?` names containing an id).
- `electron/ai-service.cjs:1697-1707` `sweep` inside `cleanupUnused` (depth < 6, predicate plus age).

**Proposed owner:** one `removeFiles(folder, wanted, depth)` in `ai-offload.cjs`, used by both. **Tests:** `test/ai-offload.test.js` (cleanup and deleteProviderSessions).

### F14. providerEnvironment plus two mkdirs written 3 times

- `ai-providers.cjs:494-496` (Codex), `:909-913` (Claude Code), `ai-service.cjs:1944-1946` (Claude auth).

**Proposed owner:** `async prepareEnvironment(directory, provider)` in `electron/ai-process.cjs` returning the env after creating `TEMP` and the provider home. **Tests:** `test/ai-process.test.js`, `test/ai-native-providers.test.js`.

### F15. Two running registries in main; taskInfo checks only one (suspected latent mismatch)

- `this.tasks` (by chat id, `ai-service.cjs:68`) and `this.runningIds` (`:73`, added only in `runTask` `:774`, removed `:1135`).
- `taskInfo` (`:388`) marks a `running` task `interrupted` if its id is not in `runningIds`:
  ```js
  if (task.status === 'running' && !this.runningIds.has(id)) { task.status = 'interrupted'; await this.persistConversation(conversation); }
  ```
- In Offload mode the organiser's own task (`runOffload`, `:545`) never goes through `runTask`, so `aiTask(organiserId)` during a job (the console calls it on every view switch, `AiAssistant.jsx:646`) persists `interrupted` mid-run. It is overwritten when the job ends and the Resume row is hidden while busy (`AiAssistant.jsx:1549`), so the visible effect is small. Not reproduced; flag for a test.

**Proposed owner:** `taskInfo` also accepts `this.tasks.has(id)`. **Tests:** `test/ai-workflow.test.js` (`taskInfo`), `test/ai-offload.test.js`, `test/ai-routing.electron.cjs`.

### F16. The awareness switch is mirrored in four places

- Main: `config.awareness` plus `AiAwareness.enabled` (`ai-service.cjs:93`, `:148-150`).
- Renderer console: `settings.awareness` (`AiAssistant.jsx:595`), from its own `aiStatus` (`:453`).
- Renderer bridge: `AiEditorBridge.awarenessEnabled` (`app/ai-editor.js:983`, `:993`), from a second `aiStatus` call and a second `onAiEvent` listener (`:981`, `:990-996`).
- Also `mdlxl_help` asks main for `editingHandbook` with a third `aiStatus` call per help request (`app/ai-editor.js:462`), although main could pass it with the call.

**Proposed owner:** leave the copies (they are event-synced) but have the bridge read the flag the console already holds, or pass `handbook` in the `mdlxl_help` arguments from `runTask` (`ai-service.cjs:817`). Low value; note only. **Tests:** `test/ai-awareness.test.js`, `test/ai-awareness.electron.cjs`.

### F17. modelCatalog key concatenated 4 times

- `ai-service.cjs:250`, `:435`, `:1887`, `:1894`: `settings.provider + ':' + (settings.baseUrl || '')`.

**Proposed owner:** `catalogKey(settings)` in `ai-service.cjs`. **Tests:** `test/ai-offload.test.js` (lighter-model choices).

### F18. Defaults and limits written in more than one place

- Thinking effort default `'high'`: `ai-service.cjs:134`, `:235`, `:260`; `AiAssistant.jsx:1320`.
- Default route from routing setting: `ai-service.cjs:442`, `:525`; `AiAssistant.jsx:879`.
- Image limits: renderer `AiAssistant.jsx:950` (`file.size > 9 * 1024 * 1024`) and 4 images (`:953`); main `ai-service.cjs:408-412` (`image.length > 12 * 1024 * 1024`, data-URL length) and 4 images.
- 16 pictures per tool result: `app/ai-review.js:150` `MAX_REVIEW_PICTURES = 16` and `electron/ai-mcp.cjs:42` (`value.images.length > 16`); the comment at `ai-review.js:149` acknowledges it.
- `send()` reads `this.configuration()` three times (`ai-service.cjs:439`, `:441`, `:455`).

**Proposed owner:** named constants next to the main check, imported or mirrored by name in the renderer. **Tests:** `test/ai-attachments.electron.cjs`, `test/ai-review-pictures.test.js`.

### F19. IPC surface and dead or near-dead pieces

Channels (all registered in `registerAiService`, `ai-service.cjs:2000-2165`; preload `electron/preload.cjs:3-40`):
- invoke (31): `ai:status, configure, enable, awareness, task, config, send, cancel, steer, answerQuestion, questionLink, organiser, newOrganiser, rekey, saveState, cleanup, rememberCleanup, important, offload, sdBrain, editingHandbook, webResearch, model, auth, models, transcript, script, capture, gesture, readModel, writeModel`
- renderer to main (5): `ai:ready` (sent inside `onAiTool`), `ai:toolWaiting`, `ai:toolResult`, `ai:contextChanged`, `ai:awarenessError`
- main to renderer (3): `ai:event`, `ai:tool`, `ai:toolCancel`
- sandbox (2): `ai-sandbox:run`, `ai-sandbox:result` (`electron/ai-sandbox.cjs`, `ai-sandbox-preload.cjs`)

Every preload method is used: `AiAssistant.jsx` uses 27, `app/ai-editor.js` 12 (`aiStatus`, `onAiEvent` in both), `app/ai-review.js` uses `aiScript`.

Dead or near-dead:
- `ai:event` type `waiting` (`ai-service.cjs:2145`) has no consumer in `app/` or `test/`; the console learns about waiting from the window event `mdlxl-ai-waiting` dispatched by `app/ai-editor.js:1037`. The `ai:toolWaiting` channel itself is live (it pauses the 180 s tool timer, `:2144`). Proposal: drop the `service.emit({ type: 'waiting', ... })` line. Risk: none found; packaged `test/ai-live-tabs.electron.cjs` covers waiting.
- `ai:event` type `awareness-delivered` (`ai-providers.cjs:803`) is used only by tests (`test/ai-native-providers.test.js:206`, `test/ai-live.electron.cjs:244`). Keep; document it as a test signal.
- Export-only symbols (used in their own file, exported but imported nowhere): `anthropicCost` (`ai-providers.cjs:1127`), `pointerParts`, `readPointer` (`src/ai-model.js`), `SKETCH_DEFAULT_COLOR` (`src/ai-sketch.js`), `tabSelection` (`src/ai-tab.js`). Harmless.
- `routeJob` receives `contract` (`ai-service.cjs:535`) but its signature (`:606`) ignores it. Useful for F20.
- SD Brain is parked (`src/ai-sd-rules.js:32-34`) with about 29 references in `ai-service.cjs`, 6 in `AiAssistant.jsx`, and a test override (`sdBrainOverride`, `ai-service.cjs:56`). This is an intentional owner decision; keep. `status()` calls `sdBrainAvailable()` twice (`:139-140`).

### F21. Tool details are truncated JSON that the console parses back

- Main: `toolDetail` (`ai-providers.cjs:75-82`) JSON-stringifies the arguments and cuts at 4000 characters plus "…".
- Renderer: `detailLine` (`AiAssistant.jsx:132-141`) and `readablePlan` (`:207-221`) `JSON.parse` that string. For long arguments (big scripts, long plans) the parse fails silently: the step shows no detail line, and a long plan shows raw truncated JSON instead of the readable plan.

**Proposed owner:** `toolDetail` also emits a short `line` field (label/id/action/query/name) computed before truncation; `detailLine` prefers it. This only fills in what is lost today; still worth a one-line owner OK. **Tests:** `test/ai-providers.test.js`, `test/ai-console.electron.cjs`.

### F22. Small renderer-side duplicates

- Paging result `{ total, offset, truncated, items }` and word matching: `app/ai-assets.js:6-17` (`page`, `matches`) and inline in `src/ai-capabilities.js:111-141`.
- Same raw-source glob twice: `app/ai-capabilities.js:3` and `app/ai-sandbox.js:3` (`import.meta.glob(['../src/*.js', '!../src/cli.js'], { query: '?raw', import: 'default' })`). They live in different bundles (editor vs sandbox page), so this is acceptable; note only.
- Forbidden key list `['__proto__', 'prototype', 'constructor']` 3 times: `src/ai-model.js:15`, `src/ai-regions.js:7`, `electron/ai-mcp.cjs:31`.
- Two path parsers by design: `src/ai-regions.js:5-10` (canonical, no escapes) vs `src/ai-model.js:60-70` (JSON Pointer). Keep separate; a comment cross-reference would help.
- Bird-addressing regex twice: `ai-service.cjs:524` and `:1845` (`new RegExp('^(?:ask\\s+)?' + w.name + '(?:[:,]|\\s+to\\b)', 'i')`), plus the generic form in `electron/ai-model-choice.cjs:4`. Proposal: `addressedBird(workers, text)` in `ai-service.cjs`.
- Two MCP tool-timeout constants in different units: `ai-providers.cjs:507` (`tool_timeout_sec=3600`) and `:911` (`MCP_TOOL_TIMEOUT = '3600000'`). Proposal: one `MCP_TOOL_TIMEOUT_MS`.
- Default API base URLs and `anthropic-version` header twice: `ai-providers.cjs:184`/`:1111` and `:253`/`:1118`. Proposal: `apiBase(settings)` and `ANTHROPIC_HEADERS` in `ai-providers.cjs`.

**Tests:** `test/ai-mcp.test.js`, `test/ai-regions.test.js`, `test/ai-model.test.js`, `test/ai-capabilities.test.js`, `test/ai-assets.test.js`, `test/ai-providers.test.js`.

---

## Already shared and good

- **`electron/ai-process.cjs`**: one place for CLI discovery (`resolveExecutable`, Windows install folders), safe spawning without a shell (`spawnAgent`, npm `.cmd` unwrapping), process-tree stop (`stopAgent`), line framing (`lines`) and credential-stripped environments (`providerEnvironment`). Used by Codex, Claude Code and sign-in alike.
- **`callEditorTool` + `validateArguments` (`electron/ai-mcp.cjs:5-76`)**: a single schema check and result shape for the MCP server, the API runner and Codex dynamic tools.
- **`electron/ai-user-input.cjs`**: question adapters for MCP forms, Codex and Claude Code, plus one `questionCancelled` error code used everywhere.
- **`awarenessText` (`electron/ai-awareness.cjs:33`)**: one wording for live context, used by `runApi`, `runCodex`, `callEditorTool` and `runTask`.
- **`AiSteering` / `AiRecorder` / `settleConversation` (`electron/ai-offload.cjs`)**: shared by every run type (organiser, birds, helpers, handover, memory note). F2 is about the renderer copy, not these classes.
- **`effortFor`, `toolDetail`, `endpoint`, `authenticationRequired` (`electron/ai-providers.cjs`)**: shared across providers and the service.
- **`electron/ai-job-plan.cjs`, `ai-diary.cjs`, `ai-model-choice.cjs`**: small, pure, separately tested job helpers.
- **`src/ai-birds.json`**: one bird list required by main and imported by the console. This is the pattern F3 proposes for the provider table.
- **`src/ai-tools.js`**: single home for tool schemas and nearly all prompts, loaded by main via `AiService.init()`.
- **`registerAiService` `handle()` wrapper (`ai-service.cjs:2008-2018`)**: every invoke channel gets the same sender/frame check and is tracked for clean shutdown.
- **Preload**: no unused AI methods; channel names match handler names one to one.

## Suggested order (smallest, safest first)

1. F1 `runProvider` + `askOnce` (pure refactor, well covered).
2. F20 move the router prompt and split the editing prompt intro/body (byte-identical text).
3. F6, F14, F17, F22 small helpers in their existing files.
4. F10 toggle setter helper.
5. F3 provider table JSON, then F4 move auth/model list into ai-providers.cjs.
6. F2 shared transcript reducer (needs a new unit test first).
7. F8/F9 file extractions, only after the above shrink them.

Needs the owner's decision before any change: F2 (live vs reloaded error display), F5 (brief bubble before sign-in prompt, or cache instead), F7 (routing JSON leniency), F12 (atomic `connections.json`), F21 (tool detail line).
