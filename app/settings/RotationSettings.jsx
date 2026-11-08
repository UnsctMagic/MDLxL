import React from 'react';
import { ROTATION_CHOICES, ROTATION_EDITORS, ROTATION_LIMITS, ROTATION_SNAPS, rotationBehavior, rotationSettingApplies } from '../../src/rotation-drag.js';
import { modifierLabel } from '../../src/modifier-bindings.js';
import { Check } from '../Fields.jsx';
import { SettingsNumberInput } from './controls.jsx';

const CHOICE_WORDS = { arrow: 'Follow the arrow', leftRight: 'Left and right', circle: 'Circle around the centre', ring: 'Along the ring', swing: 'Swing around the centre', lever: 'Swing to pick the axis', axis: 'Turn the grabbed axis', wheel: 'Turn like a wheel', none: 'Do nothing', slow: 'Slow down', snap: 'Snap to 15°' };
const choices = key => ROTATION_CHOICES[key].map(value => [value, CHOICE_WORDS[value]]);
const SPEED = { min: 0.01, max: 4, step: 0.01, unit: '×' };
const ZONE_TIP = 'Close to the centre the turn is gentler, so the selection does not snap around as the mouse passes over it. 0 turns this off.';

/** The page's rows in their groups. `fine` and `snap` are the keys bound to those meanings ('' for none). */
const rotationGroups = (fine, snap, usesPointer) => [
  ['How you drag', [
    { key: 'workplaneDrag', id: 'mouse:rotation-workplane-drag', label: 'Workplane on: how you drag', tip: 'Which mouse movement turns the selection while Workplane Constraints is on.', options: choices('workplaneDrag') },
    { key: 'handleDrag', id: 'mouse:rotation-handle-drag', label: 'Handles: how you drag', tip: 'Which mouse movement turns the selection when you grab a Rotate handle.', options: choices('handleDrag') },
    { key: 'linePick', id: 'mouse:rotation-line-pick', label: 'Lines handles', tip: 'Swing to pick the axis: the way you pull a Lines handle chooses which axis turns. Turn the grabbed axis: the handle you grab turns, as Rings do.', options: choices('linePick') },
    { key: 'leverPick', id: 'mouse:rotation-lever-pick', label: 'Axis pick distance', tip: 'How far you pull a Lines handle before it picks the axis.', number: { ...ROTATION_LIMITS.leverPick, unit: 'px' } },
    { key: 'offHandle', id: 'mouse:rotation-off-handle', label: 'Dragging away from handles', tip: 'What a drag does when it starts away from the Rotate handles.', options: choices('offHandle') },
    { key: 'faceOn', id: 'mouse:rotation-face-on', label: 'Facing views', tip: 'When the workplane faces you: circle around the centre, or drag along a straight arrow.', options: choices('faceOn') },
    { key: 'reverse', id: 'mouse:rotation-reverse', label: 'Reverse direction', tip: 'Swaps which way a straight drag turns.', toggle: true },
  ]],
  ['Speed', [
    { key: 'sensitivity', id: 'mouse:rotation-sensitivity', label: 'Rotation sensitivity', useDefault: 'Use default rotation sensitivity', tip: `${usesPointer ? "Rotation speed multiplies the editor's pointer sensitivity. " : ''}A smaller value turns more slowly. The UV map has its own Rotate settings on the UV page.`, number: SPEED },
    { key: 'precision', label: `${fine} rotation precision`, aria: 'Shift rotation precision', useDefault: 'Use default rotation precision', tip: `Hold ${fine} while rotating to multiply the speed by this amount.`, number: { ...SPEED, max: 1 }, available: !!fine },
    { key: 'handleSensitivity', id: 'mouse:rotation-handle-speed', label: 'Handle speed', tip: 'How fast a drag on a Rotate handle turns. With Use Rotation sensitivity on, it matches Rotation sensitivity.', number: SPEED, followsSensitivity: true },
    { key: 'useDPI', id: 'mouse:rotation-dpi', label: 'Pointer sensitivity affects Rotate', tip: 'On: DPI / pointer sensitivity also changes how fast Rotate turns. Off: only the Rotate speeds count.', toggle: true },
    { key: 'centerZone', id: 'mouse:rotation-zone', label: 'Deadzone near centre', tip: ZONE_TIP, number: { ...ROTATION_LIMITS.centerZone, unit: 'px' } },
    { key: 'bigSelections', id: 'mouse:rotation-big-selections', label: 'Big selections turn slower', tip: 'While the mouse is over a big selection, it turns gently so no point moves faster than the mouse.', toggle: true },
  ]],
  ['Snap', [
    { key: 'shift', id: 'mouse:rotation-shift', label: `${fine} while rotating`, tip: `What holding ${fine} does during a Rotate drag.`, options: choices('shift'), available: !!fine },
    { key: 'snap', id: 'mouse:rotation-snap', label: `Angle snap (hold ${snap} after the drag starts)`, tip: `Press ${snap} after the drag has started to turn in these steps.`, options: ROTATION_SNAPS.map(step => [step, step ? `${step}°` : 'Off']), available: !!snap },
  ]],
];

function RotationControl({ row, value, disabled, onChange }) {
  const aria = row.aria || row.label;
  if (row.toggle) return <Check className="settings-toggle" id={row.id} label={row.label} title={row.tip} value={value} disabled={disabled} onChange={onChange}/>;
  if (row.number) return <label className="settings-number"><span>{row.label}</span><span><SettingsNumberInput aria-label={aria} title={row.tip} data-hotkey={row.id} min={row.number.min} max={row.number.max} step={row.number.step} disabled={disabled} value={value} onChange={onChange}/>{row.number.unit}</span></label>;
  return <label className="settings-select"><span>{row.label}</span><select aria-label={aria} title={row.tip} data-hotkey={row.id} disabled={disabled} value={value} onChange={event => onChange(typeof value === 'number' ? Number(event.target.value) : event.target.value)}>{row.options.map(([entry, name]) => <option key={entry} value={entry}>{name}</option>)}</select></label>;
}
function Checkbox({ className, label, aria = label, checked, disabled, onChange }) {
  return <label className={`settings-rotation-option ${className}`}><input type="checkbox" aria-label={aria} checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)}/>{label}</label>;
}
/** One setting at the chosen level: an editor level can follow the global value through Use default. */
function RotationRow({ row, how, global, override, change }) {
  const inherit = !global && override[row.key] === undefined, set = value => change({ [row.key]: value });
  const same = row.followsSensitivity && how[row.key] === null;
  return <div className="settings-rotation-speed" title={row.tip}>
    <RotationControl row={row} disabled={inherit || same} value={same ? how.sensitivity : how[row.key]} onChange={set}/>
    {row.followsSensitivity && <Checkbox className="settings-follow" label="Use Rotation sensitivity" checked={same} disabled={inherit} onChange={checked => set(checked ? (global ? undefined : null) : how.sensitivity)}/>}
    {!global && <Checkbox className="settings-use-default" label="Use default" aria={row.useDefault || `Use default: ${row.aria || row.label}`} checked={inherit} onChange={checked => set(checked ? undefined : how[row.key])}/>}
  </div>;
}
function RotationHint({ how, editor, fine, usesPointer }) {
  const applies = key => rotationSettingApplies(key, editor);
  const parts = ['A straight drag turns one degree per pixel at 1×. A circling drag follows the angle swept around the centre.'];
  if (usesPointer) parts.push('Pointer sensitivity multiplies both.');
  if (fine && applies('shift')) parts.push(how.shift === 'snap' ? `Hold ${fine} to snap to 15°.` : `Hold ${fine} for precision.`);
  return <p className="settings-hint">{parts.map(part => <span key={part}>{part} </span>)}</p>;
}

/** Mouse > Rotation: every 3D Rotate setting, for all editors or just one. The UV map never reads these. */
export default function RotationSettings({ value, preferences, editor, onEditor, onChange }) {
  const override = value.editors[editor] || {}, global = editor === 'all', how = rotationBehavior({ rotation: value }, editor);
  const fine = modifierLabel('drag.rotate.fine', preferences), snap = modifierLabel('drag.rotate.snap', preferences);
  const usesPointer = how.useDPI && rotationSettingApplies('useDPI', editor);
  const change = patch => {
    if (global) { onChange({ ...value, ...patch }); return; }
    const entry = { ...override, ...patch };
    for (const key of Object.keys(entry)) if (entry[key] === undefined) delete entry[key];
    const editors = { ...value.editors };
    if (Object.keys(entry).length) editors[editor] = entry; else delete editors[editor];
    onChange({ ...value, editors });
  };
  const groups = rotationGroups(fine, snap, usesPointer).map(([title, rows]) => [title, rows.filter(row => row.available !== false && rotationSettingApplies(row.key, editor, how))]).filter(([, rows]) => rows.length);
  return <>
    <section className="settings-appearance-section"><h4>Rotation</h4><div className="settings-appearance-content">
      <label className="settings-select" title="Set the default for every editor, or override just one editor."><span>Apply to</span><select aria-label="Rotation editor" data-hotkey="mouse:rotation-editor" value={editor} onChange={event => onEditor(event.target.value)}><option value="all">All editors (default)</option>{Object.entries(ROTATION_EDITORS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      {editor === 'bones' && <p className="settings-hint">Bones has no Rotate tool.</p>}
    </div></section>
    {groups.map(([title, rows]) => <section className="settings-appearance-section" key={title}><h4>{title}</h4><div className="settings-appearance-content">{rows.map(row => <RotationRow key={row.key} row={row} how={how} global={global} override={override} change={change}/>)}</div></section>)}
    {groups.length > 0 && <RotationHint how={how} editor={editor} fine={fine} usesPointer={usesPointer}/>}
  </>;
}
