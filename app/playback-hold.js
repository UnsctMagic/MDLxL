import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

/**
 * Auto-pause for animation playback.
 *
 * Editing while the animation plays fights the frame moving underneath it:
 * fields refill every frame, edits land on a frame that is already gone and
 * windows re-render under the mouse. Instead, anything that edits takes a
 * hold: the first hold pauses playback, and when the last hold ends playback
 * resumes, but only if it was playing when the first hold began.
 *
 * Play, Stop, the frame reel and seeks stay the user's: they cancel the resume.
 */
export function createPlaybackHold(isPlaying, setPlaying) {
  const holds = new Set();
  let resume = false;
  const hold = () => {
    const token = {};
    if (!holds.size) { resume = !!isPlaying(); if (resume) setPlaying(false); }
    holds.add(token);
    return () => {
      if (!holds.delete(token) || holds.size) return;
      if (resume) { resume = false; setPlaying(true); }
    };
  };
  return {
    hold,
    cancelResume() { resume = false; },
    get held() { return holds.size > 0; },
    get resumes() { return resume; },
  };
}

// Controls that run playback itself (Play/Stop, the frame reel, Frame,
// Playback Speed) never take a hold: they are how the user plays, so touching
// one cancels a pending resume instead.
export const PLAYBACK_CONTROL = '[data-playback-control],[data-time-scrub]';
// A dropdown is a pick, not typing: its click holds like any control, and keeping focus on it does not
// (focus comes back to it when its list closes, which would otherwise pause the preview again).
const TEXT_FIELD = 'textarea,[contenteditable=""],[contenteditable="true"],input:not([type]),input[type="text"],input[type="number"],input[type="search"],input[type="color"]';
const CONTROL = 'button,input,select,textarea,label,option,a,[role="button"],[role="menuitem"],[role="menuitemcheckbox"],[role="option"],[role="tab"],[role="checkbox"],[role="slider"],[role="listbox"],[role="treeitem"],[draggable="true"],[data-hold-playback]';

const closest = (target, selector) => target?.closest ? target.closest(selector) : null;
// The innermost mark wins: keyframe diamonds inside the frame reel are edits (data-hold-playback).
const transport = target => {
  const control = closest(target, PLAYBACK_CONTROL), edit = closest(target, '[data-hold-playback]');
  return !!control && !(edit && control.contains(edit));
};

/**
 * Listens on `root` (a document or one tool window): pressing a control holds
 * playback until the click is done, typing in a field holds it until the field
 * loses focus. A 3D preview's canvas is left alone so the camera still turns
 * while it plays; edits made in a preview take their own hold with `holdForEdit`.
 */
export function installEditHold(root, playback) {
  const doc = root.ownerDocument || root, win = doc.defaultView || window;
  let pressRelease = null, focusRelease = null, pointerDown = false;
  const pending = new Set();
  // The click (and the edit it makes) fires after pointerup and blur: release after it.
  const later = release => { if (release) win.setTimeout(release, 0); };
  const endPress = () => {
    pointerDown = false;
    later(pressRelease); pressRelease = null;
    for (const release of pending) later(release);
    pending.clear();
  };
  const down = event => {
    pointerDown = true;
    const target = event.target;
    if (transport(target)) { playback.cancelResume(); return; }
    if (!pressRelease && closest(target, CONTROL)) pressRelease = playback.hold();
  };
  // A field removed while focused (its window closed) sends no focusout: a light check while held catches it.
  let focusWatch = 0;
  const endFocus = () => { win.clearInterval(focusWatch); focusWatch = 0; later(focusRelease); focusRelease = null; };
  const focusIn = event => {
    const target = event.target;
    // Focus coming back to Play when a window closes is not the user's choice: only a press cancels.
    if (focusRelease || transport(target) || !closest(target, TEXT_FIELD)) return;
    focusRelease = playback.hold();
    focusWatch = win.setInterval(() => { const active = doc.activeElement; if (!active || !active.isConnected || !closest(active, TEXT_FIELD) || transport(active)) endFocus(); }, 250);
  };
  const focusOut = event => {
    const next = event.relatedTarget;
    if (next && root.contains?.(next) !== false && !transport(next) && closest(next, TEXT_FIELD)) return;
    endFocus();
  };
  // A picked option is a finished edit: playback goes on while the list keeps focus. A dropdown's
  // open list takes the mouse release, so the press that opened it ends here too.
  const change = event => { if (event.target?.tagName === 'SELECT') { endFocus(); if (pressRelease) endPress(); } };
  root.addEventListener('pointerdown', down, true);
  win.addEventListener('pointerup', endPress, true);
  win.addEventListener('pointercancel', endPress, true);
  win.addEventListener('blur', endPress);
  root.addEventListener('focusin', focusIn, true);
  root.addEventListener('focusout', focusOut, true);
  root.addEventListener('change', change, true);
  return {
    /** Pause for one edit; resumes when the mouse is released (or straight after a click or key). */
    holdForEdit() {
      const release = playback.hold();
      if (pointerDown) pending.add(release); else later(release);
    },
    dispose() {
      root.removeEventListener('pointerdown', down, true);
      win.removeEventListener('pointerup', endPress, true);
      win.removeEventListener('pointercancel', endPress, true);
      win.removeEventListener('blur', endPress);
      root.removeEventListener('focusin', focusIn, true);
      root.removeEventListener('focusout', focusOut, true);
      root.removeEventListener('change', change, true);
      win.clearInterval(focusWatch);
      pressRelease?.(); focusRelease?.(); for (const release of pending) release();
      pending.clear(); pressRelease = focusRelease = null;
    },
  };
}

/**
 * One playback with auto-pause. `setPlaying(false)` during a hold keeps the
 * resume (it is part of the edit); `setPlaying(true)` and `stopPlayback()` are
 * the user's choice and cancel it. `root` returns the document or window to watch.
 */
export function usePlaybackHold(playing, setPlayingState, root) {
  const playingRef = useRef(playing); playingRef.current = playing;
  const [playback] = useState(() => createPlaybackHold(() => playingRef.current, value => { playingRef.current = value; setPlayingState(value); }));
  const setPlaying = useCallback(value => {
    const next = !!(typeof value === 'function' ? value(playingRef.current) : value);
    if (next) playback.cancelResume();
    playingRef.current = next; setPlayingState(next);
  }, [playback]);
  const stopPlayback = useCallback(() => { playback.cancelResume(); playingRef.current = false; setPlayingState(false); }, [playback]);
  const edits = useRef(null), rootRef = useRef(root); rootRef.current = root;
  useEffect(() => {
    const target = rootRef.current?.();
    if (!target) return undefined;
    const installed = installEditHold(target, playback); edits.current = installed;
    return () => { installed.dispose(); if (edits.current === installed) edits.current = null; };
  }, [playback]);
  const holdForEdit = useCallback(() => { if (edits.current) edits.current.holdForEdit(); else later0(playback.hold()); }, [playback]);
  return { playback, setPlaying, stopPlayback, holdForEdit };
}

const later0 = release => setTimeout(release, 0);

export const PlaybackHoldContext = createContext(null);

/** Holds the main window's playback while `active` (a window or menu that edits is open). */
export function useHoldPlayback(active = true) {
  const playback = useContext(PlaybackHoldContext);
  useEffect(() => active && playback ? playback.hold() : undefined, [active, playback]);
}
