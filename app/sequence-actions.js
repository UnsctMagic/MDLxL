import { createSequence } from '../src/sequence-editor.js';

/** The blank-sequence action shared by Animations and Movement. */
export function addAnimationSequence({ onEdit, onTimelineChange, onSeek, onNotice, onError }) {
  let index = -1, start = 0, cause;
  try {
    const result = onEdit('Create animation sequence', ['Sequences', 'Geosets'], current => {
      try {
        index = createSequence(current);
        start = current.Sequences[index].Interval[0];
        return index;
      } catch (failure) { cause = failure; throw failure; }
    });
    if (cause) throw cause;
    onError('');
    onNotice(result === false ? 'Values are already up to date.' : 'One-second blank sequence created.');
    onTimelineChange?.(index);
    onSeek?.(start);
    return true;
  } catch (failure) { onError(failure.message); onNotice(''); return false; }
}
