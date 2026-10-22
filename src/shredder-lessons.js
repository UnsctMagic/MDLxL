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
export const WELCOME = Object.freeze({ id: 'intro:welcome', area: 'everywhere', level: 1, priority: 2, once: true, args: [], learnedBy: Object.freeze([]),
  text: "Hi, I'm Shredder. While you work, I point out keys and tricks you might not know yet. Click me any time for my notebook." });

/**
 * Hand-written tricks, offered the first time the user is where they help, and
 * again (spaced out) until the user does them. `learnedBy` lists the signals
 * that prove it; `keys` names commands whose current bindings fill {0}, {1}...
 */
export const TRICKS = Object.freeze([
  // Everywhere
  { id: 'trick:alt-badges', area: 'everywhere', text: 'Hold Alt to see the key on every button.', learnedBy: ['alt-reveal'] },
  { id: 'trick:dropdown-wheel', area: 'everywhere', text: 'Spin the mouse wheel over a list to step through it without opening it.', learnedBy: ['dropdown-wheel'] },
  { id: 'trick:hotkeys-page', area: 'everywhere', keys: ['hotkeys'], text: '{0} opens Hotkeys: search any command and give it your own key.', learnedBy: ['key:hotkeys'] },
  // Camera
  { id: 'trick:camera-toggle', area: 'camera', keys: ['cameraToggle'], text: '{0} switches between working and turning the camera.', learnedBy: ['key:cameraToggle'] },
  { id: 'trick:alt-orbit', area: 'camera', text: 'Hold Alt and drag with the left mouse button to turn the camera, then let go to keep working.', learnedBy: ['alt-orbit'] },
  { id: 'trick:camera-fine', area: 'camera', text: 'Hold Shift while you turn or move the camera for slow, fine control.', learnedBy: ['camera-fine'] },
  // Vertex editor
  { id: 'trick:select-modifiers', area: 'vertices', text: 'When you select, hold Shift to add to the selection and Ctrl to take away from it.', learnedBy: ['select-modifier'] },
  { id: 'trick:move-axis', area: 'vertices', text: 'While you move vertices, hold Shift to lock the move to one direction.', learnedBy: ['shift-move'] },
  { id: 'trick:rotate-snap', area: 'vertices', text: 'While you rotate, hold Shift to snap to 15° steps.', learnedBy: ['shift-rotate'] },
  { id: 'trick:zoom-anchor', area: 'vertices', keys: ['anchorSelect'], text: 'Zoom anchor: select some vertices, press {0}, then drag a box over one of them. Resize then grows and shrinks toward that vertex instead of the middle.', learnedBy: ['use:anchorSelect'] },
  { id: 'trick:geoset-range', area: 'vertices', text: 'Shift-click a geoset box to tick a whole range at once.', learnedBy: ['geoset-range'] },
  // UV editor
  { id: 'trick:uv-keys', area: 'uv', keys: ['uv:flip-u', 'uv:flip-v', 'uv:fold'], text: 'In the UV editor, {0} flips sideways, {1} flips up and down and {2} folds the selected UVs.', learnedBy: ['key:uv:flip-u', 'key:uv:flip-v', 'key:uv:fold'] },
  { id: 'trick:uv-fine', area: 'uv', text: 'In the UV editor, hold Alt as you start a drag for fine control, and Shift to lock the direction.', learnedBy: ['uv-fine'] },
  // Animation
  { id: 'trick:play-space', area: 'animation', keys: ['play'], text: '{0} plays and stops the animation.', learnedBy: ['key:play'] },
  { id: 'trick:timeline-keys', area: 'animation', text: 'Click the timeline, then press ← and → to jump from key to key.', learnedBy: ['timeline-arrows'] },
  // Bones
  { id: 'trick:bones-keys', area: 'bones', keys: ['rotate', 'Collapse', 'Create triangle', 'bone:detach'], text: 'In Bones, {0} is Hard Bind, {1} is Soft Bind, {2} is Attach and {3} detaches from the parent bone.', learnedBy: ['bones:rotate', 'bones:Collapse', 'bones:Create triangle', 'bones:bone:detach'] },
].map(lesson => Object.freeze({ level: 1, priority: 1, ...lesson })));
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

/** The text of a trick with the user's current keys filled in; null when one of them was removed. */
export function trickLesson(lesson, shortcuts) {
  const args = (lesson.keys || []).map(id => directKey(shortcuts?.[id]));
  return args.every(Boolean) ? { ...lesson, args: args.map(formatChord) } : null;
}

export const fillLesson = (text, args = []) => text.replace(/\{(\d+)\}/g, (slot, index) => args[Number(index)] ?? slot);
