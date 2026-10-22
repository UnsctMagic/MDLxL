import { formatChord } from './preferences.js';
import { hotkeyCode } from './hotkey-defaults.js';

/** Notebook areas, in the order Shredder's notebook lists them. */
export const SHREDDER_AREAS = Object.freeze([
  ['everywhere', 'Everywhere'], ['camera', 'Camera and view'], ['vertices', 'Vertex editor'],
  ['uv', 'UV editor'], ['animation', 'Animation and timeline'], ['bones', 'Bones'],
]);
/** Ctrl+Alt+Space code lessons (level 2) in an area wait until this many lessons there are learned. */
export const BASICS_BEFORE_ADVANCED = 3;
/** A key tip comes on the first mouse click of a button; a code tip on the second. */
export const SHORTCUT_CLICKS = 1, CODE_CLICKS = 2;

/** Said once, the first time he may speak after being switched on. */
export const WELCOME = Object.freeze({ id: 'intro:welcome', area: 'everywhere', level: 1, once: true, args: [], learnedBy: Object.freeze([]),
  text: "Hi, I'm Shredder. While you work, I point out keys and tricks you might not know yet. Click me any time for my notebook." });

/**
 * Hand-written tricks, offered the first time the user is where they help.
 * `learnedBy` lists the signals that prove the user does it without help;
 * `key` names a command whose current binding fills {0}.
 */
export const TRICKS = Object.freeze([
  { id: 'trick:alt-badges', area: 'everywhere', level: 1, need: 2, text: 'Hold Alt to see the key on every button.', learnedBy: ['alt-reveal'] },
  { id: 'trick:dropdown-wheel', area: 'everywhere', level: 1, need: 2, text: 'Spin the mouse wheel over a list to step through it without opening it.', learnedBy: ['dropdown-wheel'] },
  { id: 'trick:camera-toggle', area: 'camera', level: 1, key: 'cameraToggle', text: '{0} switches between working and turning the camera.', learnedBy: ['key:cameraToggle'] },
  { id: 'trick:alt-orbit', area: 'camera', level: 1, text: 'Hold Alt and drag with the left mouse button to turn the camera, then let go to keep working.', learnedBy: ['alt-orbit'] },
  { id: 'trick:zoom-anchor', area: 'vertices', level: 1, need: 2, key: 'anchorSelect', target: 'anchorSelect', text: 'Press {0} for Zoom anchor, then drag a box over one selected vertex. Resize then grows and shrinks toward that vertex.', learnedBy: ['use:anchorSelect'] },
  { id: 'trick:timeline-keys', area: 'animation', level: 1, text: 'Click the timeline, then press ← and → to jump from key to key.', learnedBy: ['timeline-arrows'] },
].map(Object.freeze));
export const trick = id => TRICKS.find(lesson => lesson.id === id);

/** The first single-chord key bound to a command, or '' when it has only a Ctrl+Alt+Space code. */
export const directKey = keys => (keys || []).find(key => key && !hotkeyCode(key)) || '';
export const sequenceCode = keys => (keys || []).map(hotkeyCode).find(Boolean) || '';

const everywhere = new Set(['new', 'open', 'save', 'saveAs', 'undo', 'redo', 'copy', 'paste', 'pasteSpecial', 'settings', 'hotkeys', 'pressedKeys', 'help']);
export function areaFor(actionId, mode) {
  if (actionId.startsWith('camera:') || actionId === 'cameraToggle' || ['fit', 'fitSelection', 'viewDirection', 'perspective', 'orthographic'].includes(actionId)) return 'camera';
  if (everywhere.has(actionId) || !['vertices', 'uv', 'animation', 'bones'].includes(mode)) return 'everywhere';
  return mode;
}

/** The automatic lesson for a button the user clicked: its key, or else its code. */
export function shortcutLesson({ actionId, label, keys, mode }) {
  const key = directKey(keys), code = sequenceCode(keys);
  const area = areaFor(actionId, mode);
  if (key) return { id: 'key:' + actionId, area, level: 1, clicks: SHORTCUT_CLICKS, target: actionId, text: 'Next time press {0} for {1}.', args: [formatChord(key), label], learnedBy: ['key:' + actionId] };
  if (code) return { id: 'code:' + actionId, area, level: 2, clicks: CODE_CLICKS, target: actionId, text: '{1} has a code: press Ctrl+Alt+Space, let go, then type {0}.', args: [code, label], learnedBy: ['code:' + actionId] };
  return null;
}

/** What a shortcut run proves: the key (or code) for that command, and that the command was used. */
export function shortcutSignals(actionId, chord) {
  return [(hotkeyCode(chord) ? 'code:' : 'key:') + actionId, 'use:' + actionId];
}

/** The text of a trick with the user's current key filled in; null when that key was removed. */
export function trickLesson(lesson, shortcuts) {
  if (!lesson.key) return { ...lesson, args: [] };
  const key = directKey(shortcuts?.[lesson.key]);
  return key ? { ...lesson, args: [formatChord(key)] } : null;
}

export const fillLesson = (text, args = []) => text.replace(/\{(\d+)\}/g, (slot, index) => args[Number(index)] ?? slot);
