import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands.js';
import { assignHotkey, effectiveBindings, hotkeyConflicts, normalizeChord, normalizePreferences } from '../src/preferences.js';
import { contextualHotkeyDefaults, coreHotkeyDefaults, EDITOR_RESERVED, normalizeHotkeySequence, hotkeyCode, hotkeySequence, HotkeySequence, HOTKEY_LEADER } from '../src/hotkey-defaults.js';

const leader = { key: ' ', code: 'Space', ctrlKey: true, altKey: true };
const namespace = action => action.scope === 'forge-shapes' ? 'forge' : action.scope === 'paint' ? 'paint' : 'editor';
const keyCount = chord => chord.split('+').length;
test('every core action has a default of one or two keys, unique where it works, and original MDLVis shortcuts retain their command', () => {
  const assigned = { editor: new Map(), forge: new Map(), paint: new Map() };
  for (const action of COMMANDS) {
    if(action.id==='surfaceEffects')assert.deepEqual(action.defaultKeys,[],'FX has an owner-assigned shortcut only');
    else assert.ok(action.defaultKeys.length, `${action.id} needs a default`);
    for (const key of action.defaultKeys) {
      assert.equal(hotkeyCode(key), '', `${action.id} has a generated code`);
      assert.ok(keyCount(key) <= 2, `${action.id}: ${key} is more than two keys`);
      const space = assigned[namespace(action)];
      assert.equal(space.has(key), false, `${key} already belongs to ${space.get(key)}`); space.set(key, action.id);
    }
  }
  const editor = assigned.editor;
  for (const [key, action] of Object.entries({ A:'select', M:'translate', Q:'translate', R:'rotate', Z:'scale', W:'cameraToggle', T:'Create triangle', U:'Uncouple', C:'Collapse', B:'Weld', F:'frame', '`':'frame', S:'frameSelection', F1:'vertices', F2:'uv', F3:'animation', 'Ctrl+Z':'undo', 'Ctrl+Y':'redo', 'Ctrl+C':'copy', 'Ctrl+V':'paste', 'Ctrl+P':'paste', 'Ctrl+A':'selectAll' })) assert.equal(editor.get(key), action);
  assert.equal(editor.get('N'), 'normals'); // Final patch explicitly assigns normal visibility.
  assert.equal(editor.get('1'), 'anchorSelect');
  assert.equal(editor.get('Shift+1'), 'alignSelect');
  for (const key of EDITOR_RESERVED) assert.equal(editor.has(key), key === 'Alt+F4', `${key} is reserved`);
  assert.equal(editor.get('Alt+F4'), 'exit', 'Exit teaches the Windows key');
  assert.deepEqual(COMMANDS.find(command => command.id === 'keyframe:clear').defaultKeys, ['Ctrl+D']);
  // Three-key defaults became two-key ones.
  for (const [action, keys] of Object.entries({ saveAs:['F12'], redo:['Ctrl+Y'], pasteSpecial:['Shift+V'], 'wheel:scroll':['Shift+P'], 'wheel:pointer':['Shift+I'] })) assert.deepEqual(COMMANDS.find(command => command.id === action).defaultKeys, keys);
  assert.deepEqual(coreHotkeyDefaults([{ id:'existing', defaultKeys:['M','Q'] }])[0].defaultKeys, ['M','Q']);
  assert.deepEqual(coreHotkeyDefaults([{ id:'none' }])[0].defaultKeys, []);
});

const control = (id, label, group, extra = {}) => ({ id, label, group, contextual: true, defaultKeys: [], ...extra });
const keysOf = actions => Object.fromEntries(actions.filter(action => action.contextual).map(action => [action.id, action.defaultKeys]));
test('controls get short keys from their names, per window, kept once given', () => {
  const materials = ['New', 'Clone', 'Remove'].map((label, index) => control(`resource:Materials:action:${index}`, label, 'resource:Materials'));
  const textures = ['New', 'Load texture files'].map((label, index) => control(`resource:Textures:action:${index}`, label, 'resource:Textures'));
  const first = contextualHotkeyDefaults([...COMMANDS, ...materials, control('resource:Materials:close', 'Close Material Manager', 'resource:Materials'), ...textures]);
  assert.deepEqual(keysOf(first), { 'resource:Materials:action:0':['N'], 'resource:Materials:action:1':['C'], 'resource:Materials:action:2':['R'], 'resource:Materials:close':['Escape'], 'resource:Textures:action:0':['N'], 'resource:Textures:action:1':['L'] });
  for (const keys of Object.values(keysOf(first))) assert.ok(keys.every(key => keyCount(key) <= 2 && !hotkeyCode(key)));
  // Saved keys stay put when controls come back in another order or new ones appear first.
  const saved = JSON.parse(JSON.stringify(first.filter(action => action.contextual)));
  const next = contextualHotkeyDefaults([...COMMANDS, control('resource:Materials:action:9', 'Rename', 'resource:Materials'), ...saved.toReversed()]);
  for (const action of saved) assert.deepEqual(next.find(item => item.id === action.id).defaultKeys, action.defaultKeys);
  assert.deepEqual(next.find(action => action.id === 'resource:Materials:action:9').defaultKeys, ['E'], 'a new control takes the next free letter of its name');
  // A control not yet seen on screen has no window and no key.
  assert.deepEqual(contextualHotkeyDefaults([control('old:entry', 'Old', undefined)])[0].defaultKeys, []);
  // Per-item rows (each geoset, each list entry) get none.
  assert.deepEqual(contextualHotkeyDefaults([control('geoset:3', 'Select geoset 3', 'editor'), control('resource:Sequences:item:4', 'Choose item 5', 'resource:Sequences')]).map(action => action.defaultKeys), [[], []]);
});

test('the editor\'s own controls avoid every command key and the keys MDLVis leaves free', () => {
  const commandKeys = new Set(COMMANDS.flatMap(action => action.defaultKeys));
  const editor = contextualHotkeyDefaults([...COMMANDS, ...['Skeleton', 'Emitters', 'Events', 'Sounds', 'Team color', 'Highlight geoset'].map((label, index) => control(`display:${index}`, label, 'editor'))]);
  const given = Object.values(keysOf(editor)).flat();
  assert.equal(given.length, 6);
  for (const key of given) { assert.equal(commandKeys.has(key), false, key); assert.equal(EDITOR_RESERVED.includes(key), false, key); }
  assert.equal(new Set(given).size, given.length);
});

test('new window keys avoid custom assignments; corrupted duplicate saved keys are repaired', () => {
  const action = control('dialog:apply', 'Apply', 'Undo settings'), first = contextualHotkeyDefaults([action])[0];
  assert.deepEqual(first.defaultKeys, ['A']);
  assert.notEqual(contextualHotkeyDefaults([action], ['A'])[0].defaultKeys[0], 'A');
  const repaired = contextualHotkeyDefaults([{ ...first, id:'one' }, { ...first, id:'two' }]);
  assert.notEqual(repaired[0].defaultKeys[0], repaired[1].defaultKeys[0]);
  assert.equal(contextualHotkeyDefaults([{ ...action, defaultKey: 'Ctrl+Alt+Space > ABC' }])[0].defaultKeys[0], 'A', 'a saved generated code is replaced');
});

test('Forge window controls stay clear of Forge and editor keys but remain available for custom hotkeys', () => {
  const actions = contextualHotkeyDefaults([
    ...COMMANDS,
    control('forge:shape:primitive:Cube', 'Cube', 'Forge', { embedsEditor: true }),
    control('forge:effect:tool:Dome', 'Dome', 'forge:effect', { embedsEditor: true }),
    control('settings:graphics:antialias', 'Smooth edges', 'settings'),
  ]);
  const bindings = effectiveBindings(actions, {});
  const commandKeys = new Set(COMMANDS.flatMap(action => action.defaultKeys));
  for (const id of ['forge:shape:primitive:Cube', 'forge:effect:tool:Dome']) assert.equal(commandKeys.has(bindings[id][0]), false, `${id}: ${bindings[id][0]}`);
  assert.deepEqual(bindings['settings:graphics:antialias'], ['S'], 'other windows may reuse editor letters');
  assert.deepEqual(bindings['forge:shape:extrude'], ['E']);
  assert.deepEqual(bindings['forge:shape:cut'], ['C']);
  const assigned = assignHotkey({}, actions, 'forge:shape:primitive:Cube', 'Ctrl+F9');
  assert.equal(assigned.ok, true);
  assert.ok(effectiveBindings(actions, assigned.hotkeys)['forge:shape:primitive:Cube'].includes('Ctrl+F9'));
});

test('sequence normalization, persistence and assignment conflicts share the same canonical identity', () => {
  assert.equal(normalizeHotkeySequence('alt + control + space > a09'), 'Ctrl+Alt+Space > A09');
  assert.equal(normalizeChord('Ctrl+Alt+Space > xyz'), 'Ctrl+Alt+Space > XYZ');
  for (const value of ['Ctrl+Space > ABC', 'Ctrl+Alt+Space > AB', 'Ctrl+Alt+Space > AB12', 'Ctrl+Alt+Space > A+1', 'Ctrl+Alt+Space > ABC > DEF']) assert.equal(normalizeHotkeySequence(value), '');
  const key = hotkeySequence('AAA'), catalog = [{id:'one', defaultKeys:[key]}, {id:'two', defaultKeys:[]}];
  assert.equal(assignHotkey({}, catalog, 'two', key).ok, false);
  const replaced = assignHotkey({}, catalog, 'two', key, { replace:true });
  assert.deepEqual(effectiveBindings(catalog, replaced.hotkeys), {one:[], two:[key]});
  assert.deepEqual(normalizePreferences({ hotkeys:replaced.hotkeys }).hotkeys, replaced.hotkeys);
  assert.equal(assignHotkey({}, catalog, 'two', HOTKEY_LEADER).ok, false, 'leader cannot become a simultaneous shortcut');
});

test('leader accepts exactly three characters, retained modifiers, and repeats without leaking direct shortcuts', () => {
  const sequence = new HotkeySequence();
  assert.equal(sequence.feed({key:'M'}, 0).consume, false);
  assert.equal(sequence.feed(leader, 10).pending, true);
  assert.equal(sequence.feed({key:'a', code:'KeyA', ctrlKey:true, altKey:true}, 20).code, 'A');
  assert.equal(sequence.feed({key:'a', repeat:true}, 30).code, 'A');
  assert.equal(sequence.feed({key:'Control'}, 35).pending, true);
  assert.equal(sequence.feed({key:'0', code:'Digit0'}, 40).code, 'A0');
  const complete = sequence.feed({key:'1', code:'Digit1'}, 50);
  assert.equal(complete.chord, 'Ctrl+Alt+Space > A01'); assert.equal(complete.consume, true); assert.equal(complete.pending, false);
  assert.equal(sequence.feed({key:'M'}, 60).consume, false);
});

test('Escape, invalid keys, timeout, focus cancellation and IME cancel an incomplete sequence', () => {
  const sequence = new HotkeySequence({timeoutMs:100});
  for (const key of ['Escape', 'ArrowDown', 'Enter']) {
    sequence.feed(leader, 0); sequence.feed({key:'M'}, 10);
    const result = sequence.feed({key}, 20);
    assert.equal(result.consume, true); assert.equal(result.cancelled, true); assert.equal(result.chord, ''); assert.equal(sequence.active, false);
  }
  sequence.feed(leader, 0); sequence.feed({key:'A'}, 10); assert.equal(sequence.expire(109), false); assert.equal(sequence.expire(110), true);
  assert.equal(sequence.feed({key:'M'}, 111).consume, false);
  sequence.feed(leader, 0); sequence.cancel(); assert.equal(sequence.feed({key:'A'}, 30).pending, false);
  sequence.feed(leader, 0); assert.equal(sequence.feed({key:'a',isComposing:true}, 10).consume, false); assert.equal(sequence.active, false);
  sequence.feed(leader, 0); sequence.feed({key:'A'}, 10); assert.equal(sequence.feed({key:'Backspace'}, 20).code, '');
});


test('Forge owns nearby single keys without replacing other editors or allowing ambiguous local assignments', () => {
  const expected = { add:'G', 'mode:Shape':'1', 'mode:Edges':'2', 'mode:Vertices':'3', extrude:'E', inset:'X', duplicate:'D', cut:'C' };
  for (const [id, key] of Object.entries(expected)) {
    const action = COMMANDS.find(a => a.id === 'forge:shape:'+id);
    assert.equal(action.scope, 'forge-shapes');
    assert.deepEqual(action.defaultKeys, [key]);
  }
  const result = assignHotkey({}, COMMANDS, 'forge:shape:cut', 'C');
  assert.equal(result.ok, true);
  assert.deepEqual(effectiveBindings(COMMANDS, result.hotkeys).Collapse, ['C']);
  assert.deepEqual(hotkeyConflicts(COMMANDS, {}, 'forge:shape:cut', 'E'), ['forge:shape:extrude']);
  const global = [...COMMANDS, {id:'global:test',scope:'global',defaultKeys:['F8']}];
  assert.deepEqual(hotkeyConflicts(global, {}, 'forge:shape:cut', 'F8'), ['global:test']);
});

test('window history and playback use the command bindings and can be rebound locally', async () => {
  const {windowCommandActions} = await import('../src/commands.js');
  for (const scope of ['animxl','showcase','showcase-animation','particles','optimizexl']) {
    const local = windowCommandActions(scope, scope, {undo(){},redo(){},play(){}}).map(action => ({...action,scope,group:scope,contextual:true}));
    const catalog = contextualHotkeyDefaults([...COMMANDS,...local,control(scope+':close','Close',scope)]);
    const bindings = effectiveBindings(catalog,{undo:['Ctrl+F9'],redo:['Ctrl+F10'],play:['F11']});
    assert.deepEqual(bindings[scope+':undo'],['Ctrl+F9']);
    assert.deepEqual(bindings[scope+':redo'],['Ctrl+F10']);
    assert.deepEqual(bindings[scope+':play'],['F11']);
    assert.deepEqual(bindings[scope+':close'],['Escape']);
    const allocated = contextualHotkeyDefaults([...COMMANDS,...local],['Ctrl+F9'],{undo:['Ctrl+F9']});
    assert.deepEqual(allocated.find(action=>action.id===scope+':undo').defaultKeys,['Ctrl+F9']);
    assert.deepEqual(effectiveBindings(catalog,{undo:['Ctrl+F9'],[scope+':undo']:['F12']})[scope+':undo'],['F12']);
    assert.deepEqual(effectiveBindings(catalog,{undo:[]})[scope+':undo'],[]);
    assert.equal(assignHotkey({},catalog,scope+':undo','Ctrl+F9').ok,true);
  }
});

test('Paint plain keys stay in their window and reserve their original short keys', () => {
  const entries=[control('paint-key:B','Paint','paint',{keys:['B'],scope:'paint'}),control('paint-key:Ctrl+Z','Undo','paint',{bindingCommand:'undo',scope:'paint'}),control('paint-key:brush','Brush','paint',{scope:'paint'})];
  const catalog=contextualHotkeyDefaults([...COMMANDS,...entries],['Ctrl+F9'],{undo:['Ctrl+F9']});
  assert.deepEqual(catalog.find(action=>action.id==='paint-key:B').defaultKeys,['B']);
  assert.deepEqual(catalog.find(action=>action.id==='paint-key:Ctrl+Z').defaultKeys,['Ctrl+F9']);
  assert.notEqual(catalog.find(action=>action.id==='paint-key:brush').defaultKeys[0],'B');
});

test('a window action inherits a global command without a false Settings conflict',()=>{
  const actions=[{id:'undo',scope:'global',defaultKeys:['Ctrl+Z']},{id:'animxl:undo',bindingCommand:'undo',scope:'animxl',group:'animxl',contextual:true,defaultKeys:['Ctrl+Z']}];
  assert.deepEqual(hotkeyConflicts(actions,{},'animxl:undo','Ctrl+Z'),[]);
  assert.deepEqual(hotkeyConflicts(actions,{},'undo','Ctrl+Z'),[]);
});
