import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RangeField } from './Fields.jsx';
import { useWindowKeyClaim } from './Hotkeys.jsx';
import { LEG_TIMING } from '../src/transplant-autofix.js';
import { translate } from '../src/localization.js';

// The Transfer window's method row and part chip (contract: docs/agent-tasks/xfer-controls-design.md).
// Rotation = each joint turns as the donor's (method A, engine 1); Position = hands, feet and limbs go where the donor's are
// (method B, engine 2); Mix = per part, picked on the model. The buttons are a view of the per-part choice.

export const METHOD_PARTS = ['armL', 'armR', 'legL', 'legR', 'weapon'];
const TIPS = {
  A: 'Each joint turns like the donor\'s. Best when the bodies are built alike.',
  B: 'Hands and feet go where the donor\'s go, scaled to this body. Best when proportions differ.',
  mix: 'Choose Rotation or Position for each body part. Click a part on the model.',
};
const PART_LABELS = { armL: 'Left arm', armR: 'Right arm', legL: 'Left leg', legR: 'Right leg', weapon: 'Weapon' };

/** The switch's state from a per-part choice ({part: 1|2}) over the parts there are: 'A', 'B' or 'mix'. */
export function methodOf(choice, parts) {
  const values = parts.map(key => choice?.[key] === 2 ? 2 : 1);
  return !values.length || values.every(v => v === 1) ? 'A' : values.every(v => v === 2) ? 'B' : 'mix';
}

/** Method row: [Rotation][Position][Mix], scope (Transplant only), More, and the warning count. */
export function MethodRow({ method, suggested, onMethod, scope, onScope, animation, more = [], onMore, warnings = [], disabled }) {
  const mark = <span className="xf-suggested" title={translate('Suggested for this pair.')} aria-label={translate('Suggested for this pair.')}>✦</span>;
  const [open, setOpen] = React.useState(false), menu = useRef(null), [listed, setListed] = React.useState(false), list = useRef(null);
  useEffect(() => {
    if (!listed) return undefined;
    const away = event => { if (!list.current?.contains(event.target)) setListed(false); };
    window.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('pointerdown', away, true); };
  }, [listed]);
  useEffect(() => {
    if (!open) return undefined;
    const away = event => { if (!menu.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('pointerdown', away, true); };
  }, [open]);
  // Esc closes an open menu or list first, not the window.
  useWindowKeyClaim(({ event }) => { if (event.key !== 'Escape' || !(open || listed)) return false; setOpen(false); setListed(false); return true; }, 0);
  const shownMore = more.filter(item => item.visible);
  return <div className="xf-repairs xf-methods" data-transfer-methods="" role="group" aria-label={translate('Method')}>
    <span className="xf-method-switch" role="group" aria-label={translate('Method')}>
      {[['A', 'Rotation'], ['B', 'Position'], ['mix', 'Mix']].map(([id, label]) => <button key={id} data-method={id} data-hotkey={`transfer:method-${label.toLowerCase()}`} data-hotkey-manual data-hotkey-label={label}
        aria-pressed={method === id} disabled={disabled} title={translate(TIPS[id])} onClick={() => onMethod(id)}>{translate(label)}{suggested === id && mark}</button>)}
      {warnings.length > 0 && <span className="xf-more" ref={list}><button className="xf-warn-count" aria-expanded={listed} title={translate('Parts that do not get the chosen method. Click the ! on a part.')} onClick={() => setListed(value => !value)}>! {warnings.length}</button>
        {listed && <span className="xf-more-menu xf-warn-list" role="status">{warnings.map(item => <span key={item.key}><b>{item.label}</b> {item.reason}</span>)}</span>}</span>}
    </span>
    {onScope && <span className="xf-scope xf-method-scope" role="group" aria-label={translate('Scope')}>
      <button data-hotkey="transfer:all-animations" data-hotkey-manual data-hotkey-label="All animations" aria-pressed={scope === 'all'} onClick={() => onScope('all')}>{translate('All animations')}</button>
      <button data-hotkey="transfer:this-animation" data-hotkey-manual data-hotkey-label="This animation" aria-pressed={scope === 'this'} title={translate('Changes apply only to {0}.').replace('{0}', () => animation || '')} onClick={() => onScope('this')}>{translate('This animation')}</button>
    </span>}
    {shownMore.length > 0 && <span className="xf-more" ref={menu}>
      <button className="xf-more-button" aria-expanded={open} title={translate('Choices for unusual models.')} onClick={() => setOpen(value => !value)}>{translate('More')} ▸</button>
      {open && <span className="xf-more-menu" role="menu">
        {shownMore.map(item => <button key={item.key} role="menuitemcheckbox" aria-checked={item.on} aria-pressed={item.on} data-more={item.key} title={translate(item.tip)} onClick={() => onMore(item.key, !item.on)}>{translate(item.label)}</button>)}
      </span>}
    </span>}
  </div>;
}

/** Part chip at a picked dot: Rotation / Position for the part (Shift = both sides), the weapon's choice on the weapon arm, the
 * front-leg choice on a spare front leg, the reason of a warning, and "Same as all" in This animation. */
export function PartChip({ chip, onPick, onClose, sameAsAll, frontLegs }) {
  const box = useRef(null);
  useEffect(() => {
    const away = event => { if (!box.current?.contains(event.target)) onClose(); };
    window.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('pointerdown', away, true); };
  }, [onClose]);
  useWindowKeyClaim(({ event }) => { if (event.key !== 'Escape') return false; onClose(); return true; }, 0);
  const row = (key, value, locked) => <span className="xf-chip-row" role="group" aria-label={translate(PART_LABELS[key] || key)}>
    {key === 'weapon' && <span className="xf-chip-name">{translate('Weapon')}</span>}
    {[[1, 'Rotation'], [2, 'Position']].map(([v, label]) => <button key={v} aria-pressed={value === v} disabled={!!locked && v === 2} title={locked && v === 2 ? translate(locked) : key === 'weapon' ? translate(v === 2 ? 'The hand turns so the weapon points the way the donor\'s weapon points.' : 'The hand turns like the donor\'s hand.') : translate(TIPS[v === 2 ? 'B' : 'A'])}
      onClick={event => onPick(key, v, event.shiftKey)}>{translate(label)}</button>)}
  </span>;
  // Next to the clicked dot, never over it, kept inside the view.
  const [place, setPlace] = useState({ left: chip.x + 16, top: chip.y - 12 });
  useLayoutEffect(() => {
    const element = box.current, view = element?.parentElement;
    if (!element || !view) return;
    const width = element.offsetWidth, height = element.offsetHeight, room = view.clientWidth, tall = view.clientHeight;
    // Above, below, right or left of the dot (in that order), the first that covers no dot; else the one covering fewest.
    const clamp = (x, y) => ({ left: Math.max(4, Math.min(room - width - 4, x)), top: Math.max(4, Math.min(tall - height - 4, y)) });
    const spots = [clamp(chip.x - 12, chip.y - 18 - height), clamp(chip.x - 12, chip.y + 18), clamp(chip.x + 18, chip.y - height / 2), clamp(chip.x - 18 - width, chip.y - height / 2)];
    const dots = [{ x: chip.x, y: chip.y }, ...(chip.avoid || [])];
    const covers = spot => dots.filter(dot => dot.x >= spot.left - 14 && dot.x <= spot.left + width + 14 && dot.y >= spot.top - 14 && dot.y <= spot.top + height + 14).length;
    setPlace(spots.reduce((best, spot) => covers(spot) < covers(best) ? spot : best));
  }, [chip.x, chip.y, chip.region, chip.weapon, chip.reason, !!frontLegs, !!sameAsAll]);
  return <div className="xf-chip" ref={box} role="group" aria-label={translate(chip.label)} style={place}>
    <b className="xf-chip-title">{translate(chip.label)}</b>
    {chip.region && row(chip.region, chip.value, chip.locked)}
    {chip.weapon && row('weapon', chip.weaponValue)}
    {chip.reason && <p className="xf-chip-reason" role="status">{translate(chip.reason)}</p>}
    {frontLegs}
    {sameAsAll && <button className="xf-chip-same" onClick={sameAsAll}>{translate('Same as all')}</button>}
  </div>;
}

/** The front-leg choice (moved from the repair row onto the spare front leg's chip). */
export function FrontLegs({ mirrorLegs, useArms, onChange, legTiming = LEG_TIMING.default, onLegTiming, labels }) {
  const tip = translate('When the front legs step: 0 with the back leg on the same side, 50 with the opposite one.');
  return <span className="xf-chip-front">
    <span className="xf-chip-row">
      <button aria-pressed={mirrorLegs} title={translate(labels.mirrorLegs[1])} onClick={() => onChange('mirrorLegs', !mirrorLegs)}>{translate(labels.mirrorLegs[0])}</button>
      <button aria-pressed={useArms} title={translate(labels.useArms[1])} onClick={() => onChange('useArms', !useArms)}>{translate(labels.useArms[0])}</button>
    </span>
    {mirrorLegs && <RangeField className="xf-leg-timing" label={translate('Leg timing')} title={tip} inputProps={{ title: tip, 'data-leg-timing': '' }}
      min={LEG_TIMING.min} max={LEG_TIMING.max} step={LEG_TIMING.step} value={legTiming} output={value => `${value}%`} onCommit={onLegTiming}/>}
  </span>;
}
