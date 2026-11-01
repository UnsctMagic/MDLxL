import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = file => readFileSync(path.join(root, file), 'utf8');
// Keep strings (including template channels), but discard comments before matching calls.
function source(text) {
  return text.replace(/(['"`])(?:\\[\s\S]|(?!\1)[^\\])*?\1|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    value => value.startsWith('//') || value.startsWith('/*') ? ' ' : value);
}
const literal = /^(?:'([^'\\]*)'|"([^"\\]*)"|`([^`$\\]*)`)$/;
const value = text => text?.trim().match(literal)?.slice(1).find(part => part !== undefined);
const quoted = "(?:'[^'\\\\]*'|\"[^\"\\\\]*\"|`[^`$\\\\]*`)";
function channels(text, callee) {
  return [...text.matchAll(new RegExp(`(?:${callee})\\s*\\(\\s*(${quoted})`, 'g'))].map(match => value(match[1]));
}
function add(set, entries) { for (const entry of entries) set.add(entry); }
function missing(expected, actual) { return [...expected].filter(channel => !actual.has(channel)).sort(); }

function preloadBridge(text) {
  const invokes = new Set(channels(text, 'ipcRenderer\\s*\\.\\s*invoke|\\bcall'));
  const sends = new Set(channels(text, 'ipcRenderer\\s*\\.\\s*send'));
  const listeners = new Set(channels(text, 'ipcRenderer\\s*\\.\\s*(?:on|once)|\\bsubscribe|\\banswer'));
  // subscribe's ready option sends on mount/unmount; answer sends on its second argument.
  add(sends, [...text.matchAll(new RegExp(`\\bready\\s*:\\s*(${quoted})`, 'g'))].map(match => value(match[1])));
  add(sends, [...text.matchAll(new RegExp(`\\banswer\\s*\\(\\s*${quoted}\\s*,\\s*(${quoted})`, 'g'))].map(match => value(match[1])));
  const exposed = text.slice(text.indexOf('contextBridge.exposeInMainWorld'));
  const tokens = exposed.slice(exposed.indexOf('{')).match(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\[\s\S]|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g) || [];
  const keys = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (depth === 1 && (tokens[i - 1] === '{' || tokens[i - 1] === ',') && tokens[i + 1] === ':')
      keys.push(value(token) ?? token);
    if (['{', '(', '['].includes(token)) depth++;
    if (['}', ')', ']'].includes(token) && --depth === 0) break;
  }
  assert.ok(keys.length, 'No desktop preload keys found; update the bridge parser.');
  return { invokes, sends, listeners, keys };
}

function mainBridge(files) {
  const handles = new Set(), receives = new Set(), pushes = new Set();
  for (const [file, text] of files) {
    add(handles, channels(text, 'ipcMain\\s*\\.\\s*handle'));
    add(receives, channels(text, 'ipcMain\\s*\\.\\s*on'));
    // Includes WebContents.send, the textureDecoder WebContents alias and sendToEditor.
    add(pushes, channels(text, '\\.\\s*send|\\bsendToEditor'));
    if (file === 'ai-editor-ipc.cjs') add(handles, channels(text, '\\bhandle'));
    if (file === 'ai-service.cjs') {
      // Current main wraps ipcMain.handle(name, ...) in handle(name, fn).
      assert.match(text, /const handle\s*=\s*\(name,\s*fn\)\s*=>\s*ipcMain\.handle\(name,/,
        'AI handle wrapper changed; update the bridge parser.');
      add(handles, channels(text, '\\bhandle'));
      // Also resolve the AI registration list when expressed as a for-of loop.
      for (const loop of text.matchAll(/for\s*\(\s*const\s+(\w+)\s+of\s+(\[[\s\S]*?\]|\w+)\s*\)\s*\{?\s*(?:ipcMain\.handle|handle)\s*\(\s*`ai:\$\{\1\}`/g)) {
        const list = loop[2].startsWith('[') ? loop[2] : text.match(new RegExp(`\\b${loop[2]}\\s*=\\s*(\\[[\\s\\S]*?\\])`))?.[1];
        assert.ok(list, `Cannot resolve AI channel list ${loop[2]} in ${file}.`);
        const names = list.slice(1, -1).split(',').map(item => item.trim()).filter(Boolean);
        for (const name of names) {
          assert.notEqual(value(name), undefined, `Nonliteral AI channel in ${file}: ${name}`);
          handles.add(`ai:${value(name)}`);
        }
      }
    }
  }
  return { handles, receives, pushes };
}

function rendererSources(directory) {
  return readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap(entry => {
    const file = `${directory}/${entry.name}`;
    return entry.isDirectory() ? rendererSources(file) : /\.(?:[cm]?[jt]sx?|html)$/.test(entry.name) ? [source(read(file))] : [];
  }).join('\n');
}

const preload = preloadBridge(source(read('electron/preload.cjs')));
const main = mainBridge(readdirSync(path.join(root, 'electron')).filter(file => /\.(?:cjs|mjs)$/.test(file) && !file.endsWith('preload.cjs') && file !== 'rotation-lab-main.cjs')
  .map(file => [file, source(read(`electron/${file}`))]));
const lab = preloadBridge(source(read('electron/rotation-lab-preload.cjs')));
const labMain = mainBridge([['rotation-lab-main.cjs', source(read('electron/rotation-lab-main.cjs'))]]);
const sandbox = preloadBridge(source(read('electron/ai-sandbox-preload.cjs')));
// ai-sandbox:result is sent by the isolated sandbox preload, not window.desktop.
const sandboxReplies = new Set(['ai-sandbox:result']);
// getSettings is deliberately test-facing; app reads settings through other channels.
const unusedKeys = new Set(['getSettings']);

test('preload invoke/send channels have matching main registrations', () => {
  const errors = [
    ...missing(preload.invokes, main.handles).map(channel => `preload invoke ${channel} has no ipcMain.handle`),
    ...missing(preload.sends, main.receives).map(channel => `preload send ${channel} has no ipcMain.on`),
    ...missing(main.handles, preload.invokes).map(channel => `ipcMain.handle ${channel} has no preload invoke`),
    ...missing(main.receives, new Set([...preload.sends, ...sandboxReplies])).map(channel => `ipcMain.on ${channel} has no preload send`),
  ];
  for (const channel of sandboxReplies) assert.ok(sandbox.sends.has(channel), `Sandbox exception ${channel} has no sandbox sender`);
  assert.deepEqual(errors, [], `Desktop bridge request mismatch:\n${errors.join('\n')}`);
});

// The lab entry/preload are loaded together only in the isolated build. Check
// both directions separately so lab channels cannot hide product bridge drift.
test('isolated lab preload channels match its own main registrations', () => {
  const errors = [
    ...missing(lab.invokes, labMain.handles).map(channel => `lab invoke ${channel} has no ipcMain.handle`),
    ...missing(lab.sends, labMain.receives).map(channel => `lab send ${channel} has no ipcMain.on`),
    ...missing(labMain.handles, lab.invokes).map(channel => `lab ipcMain.handle ${channel} has no preload invoke`),
    ...missing(labMain.receives, lab.sends).map(channel => `lab ipcMain.on ${channel} has no preload send`),
    ...missing(labMain.pushes, lab.listeners).map(channel => `lab push ${channel} has no preload listener`),
  ];
  assert.deepEqual(errors, [], `Isolated lab bridge mismatch:\n${errors.join('\n')}`);
});

test('main push channels have preload listeners, including the sandbox preload', () => {
  const absent = missing(main.pushes, new Set([...preload.listeners, ...sandbox.listeners]));
  assert.deepEqual(absent, [], `Main push channel(s) have no preload listener: ${absent.join(', ')}`);
});

test('desktop preload keys are used in app/ or src/', () => {
  const renderer = rendererSources('app') + '\n' + rendererSources('src');
  // Include desktop aliases and the existing conditional bracket access in PaintSaveTexture.
  const properties = new Set([...renderer.matchAll(/\bdesktop\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/g)].map(match => match[1]));
  for (const access of renderer.matchAll(/\bdesktop\s*(?:\?\.\s*)?\[([^\]]+)\]/g))
    add(properties, [...access[1].matchAll(new RegExp(quoted, 'g'))].map(match => value(match[0])));
  const unused = preload.keys.filter(key => !unusedKeys.has(key) && !properties.has(key));
  assert.deepEqual(unused, [], `Unused desktop preload key(s) in app/ and src/: ${unused.join(', ')}`);
});
