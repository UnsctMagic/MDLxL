import { formatChord, cameraBindings } from './preferences.js';
import { hotkeyCode } from './hotkey-defaults.js';

/** Notebook areas, in the order Shredder's notebook lists them. */
export const SHREDDER_AREAS = Object.freeze([
  ['everywhere', 'Everywhere'], ['camera', 'Camera and view'], ['vertices', 'Vertex editor'],
  ['uv', 'UV editor'], ['animation', 'Animation and timeline'], ['bones', 'Bones'],
]);
/** Kept for notebooks written by older versions: level 2 lessons wait for basics. */
export const BASICS_BEFORE_ADVANCED = 3;
/** A key tip comes on the first mouse click of a button. A button without a key is worth
 * your own key once it is clicked this often in one session (menu commands sooner). */
export const SHORTCUT_CLICKS = 1, BIND_CLICKS = 5, BIND_MENU_USES = 2;

/** The small caption above each kind of tip. */
export const KIND_CAPTIONS = Object.freeze({ hello: 'Shredder', shortcut: 'Shortcut', faster: 'Faster way', tip: 'Tip', key: 'Your own key' });

/** What he sometimes says when picked up. */
export const PROTESTS = Object.freeze(['Hey!', 'Easy with the feathers.', 'I was comfortable there.', 'Fine. Here, then.', 'Put me down gently.']);
/** Said once, the first time he may speak after being switched on. */
export const WELCOME = Object.freeze({ id: 'intro:welcome', kind: 'hello', area: 'everywhere', level: 1, priority: 2, once: true, args: [], keyArgs: [], learnedBy: Object.freeze([]),
  text: "Hi, I'm Shredder. When I see a faster way to do what you're doing, I'll show you. Drag me anywhere you like, or click me for my notebook." });

/** Ways of moving the camera that are already fast: Shredder never suggests another one to their users. */
export const FAST_ORBIT = Object.freeze(['cam:rotate-right', 'cam:rotate-middle', 'cam:middle-click', 'cam:rotate-alt', 'key:cameraToggle']);
export const FAST_PAN = Object.freeze(['cam:pan-right', 'cam:pan-middle']);
export const FAST_ZOOM = Object.freeze(['cam:wheel-zoom', 'cam:zoom-right', 'cam:zoom-middle']);

/**
 * Hand-written lessons. Each is offered only when the user does something the slow way,
 * and always names the fastest way available with their own settings.
 * - `keys`: commands whose current bindings fill the first slots; `fixed`: literal keys after them.
 *   Every filled slot is shown as a key.
 * - `learnedBy`: signals that the user does exactly this; `coveredBy`: signals that the user
 *   already has an equally fast way, so the lesson is never needed.
 */
export const TRICKS = Object.freeze([
  // Camera: the fastest way depends on the user's mouse buttons (Settings → Mouse).
  { id: 'faster:orbit-middle-click', area: 'camera', kind: 'faster', text: 'Click the middle mouse button to switch between turning the camera and working. Your hand stays on the mouse.', learnedBy: ['cam:middle-click'], coveredBy: FAST_ORBIT },
  { id: 'faster:orbit-right', area: 'camera', kind: 'faster', text: 'Drag with the right mouse button to turn the camera, whatever tool you are using.', learnedBy: ['cam:rotate-right'], coveredBy: FAST_ORBIT },
  { id: 'faster:orbit-middle', area: 'camera', kind: 'faster', text: 'Drag with the middle mouse button to turn the camera, whatever tool you are using.', learnedBy: ['cam:rotate-middle'], coveredBy: FAST_ORBIT },
  { id: 'faster:orbit-alt', area: 'camera', kind: 'faster', fixed: ['Alt'], text: 'Hold {0} and drag with the left mouse button to turn the camera, whatever tool you are using.', learnedBy: ['cam:rotate-alt'], coveredBy: FAST_ORBIT },
  { id: 'faster:pan-right', area: 'camera', kind: 'faster', text: 'Drag with the right mouse button to move the camera, whatever tool you are using.', learnedBy: ['cam:pan-right'], coveredBy: FAST_PAN },
  { id: 'faster:pan-middle', area: 'camera', kind: 'faster', text: 'Drag with the middle mouse button to move the camera, whatever tool you are using.', learnedBy: ['cam:pan-middle'], coveredBy: FAST_PAN },
  { id: 'faster:zoom-wheel', area: 'camera', kind: 'faster', text: 'Spin the mouse wheel over the 3D view to zoom, whatever tool you are using.', learnedBy: ['cam:wheel-zoom'], coveredBy: FAST_ZOOM },
  { id: 'tip:camera-fine', area: 'camera', kind: 'tip', fixed: ['Shift'], text: 'Hold {0} while you turn or move the camera for slow, precise control.', learnedBy: ['camera-fine'] },
  // Vertex editor
  { id: 'faster:select-modifiers', area: 'vertices', kind: 'faster', fixed: ['Shift', 'Ctrl'], text: 'Add to a selection with {0} and take away from it with {1}, instead of selecting everything again.', learnedBy: ['select-modifier'] },
  { id: 'tip:move-axis', area: 'vertices', kind: 'tip', fixed: ['Shift'], text: 'Hold {0} while you move to lock the move to one direction.', learnedBy: ['shift-move'] },
  { id: 'tip:rotate-snap', area: 'vertices', kind: 'tip', fixed: ['Shift'], text: 'Hold {0} while you rotate to snap to 15° steps.', learnedBy: ['shift-rotate'] },
  { id: 'tip:zoom-anchor', area: 'vertices', kind: 'tip', keys: ['anchorSelect'], text: 'Zoom anchor: select some vertices, press {0}, then drag a box over one of them. Resize then grows and shrinks toward that vertex instead of the middle.', learnedBy: ['use:anchorSelect'] },
  { id: 'faster:geoset-range', area: 'vertices', kind: 'faster', fixed: ['Shift'], text: 'Hold {0} and click a geoset box to tick a whole range at once.', learnedBy: ['geoset-range'] },
  // Everywhere
  { id: 'tip:alt-badges', area: 'everywhere', kind: 'tip', fixed: ['Alt'], text: 'Hold {0} to see the key for every button.', learnedBy: ['alt-reveal'] },
  { id: 'faster:dropdown-wheel', area: 'everywhere', kind: 'faster', text: 'Spin the mouse wheel over a list to step to the next or previous entry without opening it.', learnedBy: ['dropdown-wheel'] },
  // UV editor
  { id: 'tip:uv-fine', area: 'uv', kind: 'tip', fixed: ['Alt', 'Shift'], text: 'In the UV editor, hold {0} as you start a drag for fine control, and {1} to lock the direction.', learnedBy: ['uv-fine'] },
  // Animation
  { id: 'shortcut:play', area: 'animation', kind: 'shortcut', keys: ['play'], text: 'Next time press {0} to play and stop the animation.', learnedBy: ['key:play'] },
  { id: 'faster:timeline-keys', area: 'animation', kind: 'faster', fixed: ['←', '→'], text: 'Click the timeline, then press {0} and {1} to jump straight from key to key.', learnedBy: ['timeline-arrows'] },
].map(lesson => Object.freeze({ level: 1, priority: 1, ...lesson })));
export const trick = id => TRICKS.find(lesson => lesson.id === id);

const wheelZooms = preferences => !['scroll', 'pointer'].includes(preferences?.wheelMode);
/**
 * The fastest camera method for `action` ('rotate', 'pan' or 'zoom') with the user's
 * own mouse settings, as a lesson id; null when there is nothing faster to teach.
 */
export function fastestCamera(action, preferences) {
  const { right, middle } = cameraBindings(preferences);
  if (action === 'rotate') return right === 'rotate' ? 'faster:orbit-right' : middle === 'rotate' ? 'faster:orbit-middle' : middle === 'toggle' ? 'faster:orbit-middle-click' : 'faster:orbit-alt';
  if (action === 'pan') return right === 'pan' ? 'faster:pan-right' : middle === 'pan' ? 'faster:pan-middle' : null;
  if (action === 'zoom') return wheelZooms(preferences) ? 'faster:zoom-wheel' : null;
  return null;
}
/** What a camera gesture on the 3D view proves the user knows (a FAST_* signal), or ''. */
export function cameraSignal(event, preferences) {
  const { right, middle } = cameraBindings(preferences);
  if (event.type === 'wheel') return wheelZooms(preferences) && !event.buttons ? 'cam:wheel-zoom' : '';
  if (event.button === 0) return event.altKey ? 'cam:rotate-alt' : '';
  const binding = event.button === 1 ? middle : event.button === 2 ? right : 'none', side = event.button === 1 ? 'middle' : 'right';
  if (binding === 'toggle') return 'cam:middle-click';
  return ['rotate', 'pan', 'zoom'].includes(binding) ? `cam:${binding}-${side}` : '';
}

/** The first single-chord key bound to a command, or '' when it has only a Ctrl+Alt+Space code. */
export const directKey = keys => (keys || []).find(key => key && !hotkeyCode(key)) || '';

const everywhere = new Set(['new', 'open', 'save', 'saveAs', 'undo', 'redo', 'copy', 'paste', 'pasteSpecial', 'settings', 'hotkeys', 'pressedKeys', 'help']);
export function areaFor(actionId, mode) {
  if (actionId.startsWith('camera:') || actionId === 'cameraToggle' || ['fit', 'fitSelection', 'viewDirection', 'perspective', 'orthographic'].includes(actionId)) return 'camera';
  if (everywhere.has(actionId) || !['vertices', 'uv', 'animation', 'bones'].includes(mode)) return 'everywhere';
  return mode;
}

/** The automatic lesson for a button with a key: use the key instead of the mouse trip. */
export function shortcutLesson({ actionId, label, keys, mode }) {
  const key = directKey(keys);
  return key ? { id: 'key:' + actionId, kind: 'shortcut', area: areaFor(actionId, mode), level: 1, priority: 0, clicks: SHORTCUT_CLICKS,
    text: 'Next time press {0} for {1}.', args: [formatChord(key), label], keyArgs: [0], learnedBy: ['key:' + actionId] } : null;
}
/** For a button without a key that the user clicks a lot: give it their own key in Hotkeys. */
export function bindLesson({ actionId, label, mode, shortcuts }) {
  const hotkeys = directKey(shortcuts?.hotkeys);
  return hotkeys ? { id: 'bind:' + actionId, kind: 'key', area: areaFor(actionId, mode), level: 1, priority: 0,
    text: 'You use {1} a lot. Give it your own key: press {0}, search for it and press the key you want.', args: [formatChord(hotkeys), label], keyArgs: [0], learnedBy: ['key:' + actionId] } : null;
}

/** What a shortcut run proves: the key (or code) for that command, and that the command was used. */
export function shortcutSignals(actionId, chord) {
  return [(hotkeyCode(chord) ? 'code:' : 'key:') + actionId, 'use:' + actionId];
}

/** A trick with the user's current keys filled in; null when one of its keys was removed. */
export function trickLesson(lesson, shortcuts) {
  const bound = (lesson.keys || []).map(id => directKey(shortcuts?.[id]));
  if (!bound.every(Boolean)) return null;
  const args = [...bound.map(formatChord), ...(lesson.fixed || [])];
  return { ...lesson, args, keyArgs: args.map((_, index) => index) };
}

export const fillLesson = (text, args = []) => text.replace(/\{(\d+)\}/g, (slot, index) => args[Number(index)] ?? slot);
/** Splits a (translated) template into text and argument pieces, for showing keys as key caps. */
export function lessonPieces(template, args = [], keyArgs = []) {
  return template.split(/(\{\d+\})/).filter(Boolean).map(part => {
    const slot = /^\{(\d+)\}$/.exec(part), index = slot && Number(slot[1]);
    return slot && index < args.length ? { text: args[index], key: keyArgs.includes(index) } : { text: part, key: false };
  });
}
