import test from 'node:test';
import assert from 'node:assert/strict';
import { hotkeyHint } from '../src/hotkey-badge.js';

test('readable hints keep every modifier and physical key', () => {
  for (const [chord, label] of [
    ['Ctrl+J', 'Ctrl+J'], ['Shift+K', 'Shift+K'], ['Alt+M', 'Alt+M'],
    ['Shift+Home', 'Shift+Home'], ['Ctrl+F12', 'Ctrl+F12'],
    ['Ctrl+Shift+Delete', 'Ctrl+Shift+DEL'], ['Alt+ArrowLeft', 'Alt+←'],
    ['Backspace', 'Backspace'], ['Ctrl+Alt+Space > ABC', 'Ctrl+Alt+Space > ABC'],
  ]) assert.equal(hotkeyHint(chord), label);
  assert.equal(hotkeyHint(undefined), '');
});
