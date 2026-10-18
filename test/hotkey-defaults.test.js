import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS } from '../src/commands.js';
import { assignHotkey, effectiveBindings, hotkeyConflicts, normalizeChord, normalizePreferences } from '../src/preferences.js';
import { contextualHotkeyDefaults, coreHotkeyDefaults, normalizeHotkeySequence, hotkeyCode, hotkeySequence, HotkeySequence, HOTKEY_LEADER } from '../src/hotkey-defaults.js';

const leader = { key: ' ', code: 'Space', ctrlKey: true, altKey: true };
test('every core action has a unique default and original MDLVis shortcuts retain their command', () => {
  const assigned = new Map();
  for (const action of COMMANDS.filter(action => action.scope !== 'forge-shapes')) {
    assert.ok(action.defaultKeys.length, `${action.id} needs a default`);
    for (const key of action.defaultKeys) { assert.equal(assigned.has(key), false, `${key} already belongs to ${assigned.get(key)}`); assigned.set(key, action.id); }
  }
  for (const [key, action] of Object.entries({ A:'select', M:'translate', Q:'translate', R:'rotate', Z:'scale', W:'cameraToggle', T:'Create triangle', U:'Uncouple', C:'Collapse', B:'Weld', F:'frame', '`':'frame', S:'frameSelection', F1:'vertices', F2:'uv', F3:'animation', 'Ctrl+Z':'undo', 'Ctrl+Y':'redo', 'Ctrl+C':'copy', 'Ctrl+V':'paste', 'Ctrl+P':'paste', 'Ctrl+A':'selectAll' })) assert.equal(assigned.get(key), action);
  assert.equal(assigned.get('N'), 'normals'); // Final patch explicitly assigns normal visibility.
  assert.equal(assigned.get('1'), 'anchorSelect');
  for (const key of ['H', 'K', 'Ctrl+X', 'Ctrl+B']) assert.equal(assigned.has(key), false, `${key} is reserved by original MDLVis`);
  assert.deepEqual(COMMANDS.find(command => command.id === 'keyframe:clear').defaultKeys, ['Ctrl+D']);
  assert.equal(assigned.get('Ctrl+Alt+P'), 'wheel:scroll'); assert.equal(assigned.get('Ctrl+Alt+I'), 'wheel:pointer');
  assert.deepEqual(coreHotkeyDefaults([{ id:'existing', defaultKeys:['M','Q'] }])[0].defaultKeys, ['M','Q']);
});

test('contextual defaults are unique, independent of discovery order, and stable after persistence and new controls', () => {
  const contextual = Array.from({ length: 6000 }, (_, i) => ({ id:`resource:Nodes:node:${i}:field:X`, contextual:true, defaultKeys:[] }));
  const first = contextualHotkeyDefaults([...COMMANDS, ...contextual]);
  const reversed = contextualHotkeyDefaults([...COMMANDS, ...contextual.toReversed()]);
  const byId = actions => Object.fromEntries(actions.map(action => [action.id, action.defaultKeys]));
  assert.deepEqual(byId(first), byId(reversed));
  const codes = first.filter(action => action.scope !== 'forge-shapes').flatMap(action => action.defaultKeys); assert.equal(new Set(codes).size, codes.length);
  const saved = JSON.parse(JSON.stringify(first.filter(action => action.contextual)));
  const next = contextualHotkeyDefaults([...COMMANDS, { id:'new:control', contextual:true }, ...saved]);
  const updated = byId(next);
  for (const action of first) assert.deepEqual(updated[action.id], action.defaultKeys);
  assert.equal(next.find(action => action.id === 'new:control').defaultKeys.length, 1);
  assert.ok(next.filter(action => action.contextual).every(action => !hotkeyCode(action.defaultKeys[0]).startsWith('A')));
});

test('new contextual codes avoid custom assignments; corrupted duplicate saved codes are repaired', () => {
  const action = { id:'context:new', contextual:true }, first = contextualHotkeyDefaults([action])[0];
  const reserved = first.defaultKeys[0];
  assert.notEqual(contextualHotkeyDefaults([action], [reserved])[0].defaultKeys[0], reserved);
  const repaired = contextualHotkeyDefaults([{ ...first, id:'one' }, { ...first, id:'two' }]);
  assert.notEqual(repaired[0].defaultKeys[0], repaired[1].defaultKeys[0]);
});

test('Forge contextual controls drop generated codes but remain available for custom hotkeys', () => {
  const actions = contextualHotkeyDefaults([
    ...COMMANDS,
    { id: 'forge:shape:add:Cube', contextual: true, defaultCode: 'ISG', defaultKeys: [hotkeySequence('ISG')] },
    { id: 'forge:effect:tool:Dome', contextual: true, defaultCode: 'WKY' },
    { id: 'paint:custom:control', contextual: true, defaultCode: 'BCD' },
  ]);
  const bindings = effectiveBindings(actions, {});
  assert.deepEqual(bindings['forge:shape:add:Cube'], []);
  assert.deepEqual(bindings['forge:effect:tool:Dome'], []);
  assert.deepEqual(bindings['paint:custom:control'], [hotkeySequence('BCD')]);
  assert.deepEqual(bindings['forge:shape:extrude'], ['E']);
  assert.deepEqual(bindings['forge:shape:cut'], ['C']);

  const assigned = assignHotkey({}, actions, 'forge:shape:add:Cube', 'F8');
  assert.equal(assigned.ok, true);
  assert.deepEqual(effectiveBindings(actions, assigned.hotkeys)['forge:shape:add:Cube'], ['F8']);
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
