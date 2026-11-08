// Shortcuts mean the same thing on QWERTY, QWERTZ, AZERTY and Russian keyboards.
import test from 'node:test';
import assert from 'node:assert/strict';
import { chordFromEvent, layoutKey } from '../src/preferences.js';

const press = (key, code, extra = {}) => chordFromEvent({ key, code, ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, getModifierState: () => false, ...extra });
const ctrl = { ctrlKey: true }, shift = { shiftKey: true };

test('QWERTY: letters, digits and punctuation as printed', () => {
  assert.equal(press('z', 'KeyZ', ctrl), 'Ctrl+Z');
  assert.equal(press('y', 'KeyY', ctrl), 'Ctrl+Y');
  assert.equal(press('a', 'KeyA'), 'A');
  assert.equal(press('1', 'Digit1'), '1');
  assert.equal(press('!', 'Digit1', shift), 'Shift+1');
  assert.equal(press(',', 'Comma'), ',');
  assert.equal(press('.', 'Period'), '.');
  assert.equal(press('`', 'Backquote'), '`');
  assert.equal(press('[', 'BracketLeft'), '[');
  assert.equal(press('{', 'BracketLeft', shift), 'Shift+{');
  assert.equal(press('+', 'Equal', shift), 'Shift+Plus');
  assert.equal(press('_', 'Minus', shift), 'Shift+_');
  assert.equal(press('?', 'Slash', shift), 'Shift+?');
});

test('QWERTZ: Ctrl+Z undoes and Ctrl+Y redoes, as printed on the keys', () => {
  assert.equal(press('z', 'KeyY', ctrl), 'Ctrl+Z');
  assert.equal(press('y', 'KeyZ', ctrl), 'Ctrl+Y');
  assert.equal(press('z', 'KeyY'), 'Z');
  assert.equal(press('Y', 'KeyZ', shift), 'Shift+Y');
  assert.equal(press('1', 'Digit1'), '1', 'digits unchanged');
  assert.equal(press('/', 'Digit7', shift), 'Shift+7', 'the digit row keeps its digit');
  assert.equal(press('-', 'Slash'), '-', 'punctuation the layout prints is used');
  assert.equal(press('ü', 'BracketLeft'), '[', 'the German Ü key reaches the bracket shortcuts');
  assert.equal(press('Ü', 'BracketLeft', shift), 'Shift+{');
  assert.equal(press('ß', 'Minus'), '-');
});

test('AZERTY: printed letters win, digit row without Shift stays digits, comma is comma', () => {
  assert.equal(press('z', 'KeyW', ctrl), 'Ctrl+Z');
  assert.equal(press('a', 'KeyQ'), 'A');
  assert.equal(press('q', 'KeyA'), 'Q');
  assert.equal(press('m', 'Semicolon'), 'M');
  assert.equal(press('w', 'KeyZ'), 'W');
  assert.equal(press(',', 'KeyM'), ',', 'the key printed with a comma is the comma, not M');
  assert.equal(press('?', 'KeyM', shift), 'Shift+?');
  assert.equal(press('&', 'Digit1'), '1', 'AZERTY digits need Shift on the keyboard but are still digits here');
  assert.equal(press('é', 'Digit2'), '2');
  assert.equal(press('1', 'Digit1', shift), 'Shift+1');
});

test('Russian: Latin letters and punctuation work by key position', () => {
  assert.equal(press('я', 'KeyZ', ctrl), 'Ctrl+Z');
  assert.equal(press('н', 'KeyY', ctrl), 'Ctrl+Y');
  assert.equal(press('ф', 'KeyA'), 'A');
  assert.equal(press('А', 'KeyF'), 'F');
  assert.equal(press('б', 'Comma'), ',');
  assert.equal(press('ю', 'Period'), '.');
  assert.equal(press('ё', 'Backquote'), '`');
  assert.equal(press('х', 'BracketLeft'), '[');
  assert.equal(press('ъ', 'BracketRight'), ']');
  assert.equal(press('Х', 'BracketLeft', shift), 'Shift+{', 'Paint softness keys');
  assert.equal(press('Ъ', 'BracketRight', shift), 'Shift+}');
  assert.equal(press('б', 'Comma', ctrl), 'Ctrl+,', 'Settings opens on Russian too');
});

test('named keys, IME and AltGr are unaffected', () => {
  assert.equal(press('Escape', 'Escape'), 'Escape');
  assert.equal(press('Enter', 'NumpadEnter'), 'Enter');
  assert.equal(press('F11', 'F11'), 'F11');
  assert.equal(press('Home', 'Numpad7'), 'Home');
  assert.equal(press('0', 'Numpad0'), '0');
  assert.equal(press('Control', 'ControlLeft', ctrl), '');
  assert.equal(press('Dead', 'Equal'), '', 'a dead key is not a shortcut');
  assert.equal(chordFromEvent({ key: 'я', code: 'KeyZ', isComposing: true }), '');
  assert.equal(chordFromEvent({ key: '@', code: 'KeyQ', ctrlKey: true, altKey: true, getModifierState: name => name === 'AltGraph' }), '');
});

test('held-letter features read the same key', () => {
  assert.equal(layoutKey({ key: 'a', code: 'KeyQ' }).toLowerCase(), 'a', 'AZERTY A');
  assert.equal(layoutKey({ key: 'ф', code: 'KeyA' }).toLowerCase(), 'a', 'Russian A');
  assert.equal(layoutKey({ key: 'q', code: 'KeyA' }).toLowerCase(), 'q', 'AZERTY Q is not A');
});
