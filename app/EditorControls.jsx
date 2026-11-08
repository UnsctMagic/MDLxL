import React from 'react';
import { useDraftNumber } from './Fields.jsx';
import ModernIcon, { hasModernIcon } from './ModernIcon.jsx';
import LookIcon, { hasLookIcon } from './LookIcon.jsx';
import { usePreferencesContext } from './PreferencesContext.jsx';
import { modifierSentence } from '../src/modifier-bindings.js';

// look: also draw the new look's icon for this action (shown only with VIS off).
export function Tool({ icon, title, description, onClick, active, disabled, children, flip, action, badge, className = '', look = false, ...rest }) {
  const lookIcon = look && hasLookIcon(action);
  return <button data-hotkey={action} {...rest} type="button" className={`classic-tool${active ? ' active' : ''}${lookIcon ? ' has-look-icon' : ''}${className ? ' ' + className : ''}`} title={description || title} aria-label={title} aria-pressed={active === undefined ? undefined : !!active} disabled={disabled} onClick={onClick}>{lookIcon && <LookIcon name={action}/>}{icon ? hasModernIcon(icon) ? <ModernIcon name={icon} flip={flip}/> : <img src={`./classic/${icon}${/\.(png|gif|svg)$/.test(icon)?'':'.png'}`} alt="" draggable={false} style={flip ? { transform: 'scaleX(-1)' } : undefined}/> : children}{badge && <span className="module-icon-badge" aria-hidden="true">{badge}</span>}</button>;
}

const coordinateText = value => Number.isFinite(value) ? String(Number(value.toFixed(4))) : '0';

/** One axis box (X, Y or Z). `format` is the text shown for a value; `className` the label's class. */
export function Coordinate({ axis, displayAxis=axis, value, disabled, onCommit, format = coordinateText, className = 'field' }) {
  const field = useDraftNumber({ value, format, onCommit, disabled });
  return <label className={className || undefined}><span>{displayAxis}</span><input data-hotkey={`coordinate:${axis}`} aria-label={`${axis} coordinate`} type="number" step="any" disabled={disabled} {...field}/></label>;
}

export function CameraTools({ value, onChange, look }) {
  return <div className="classic-toolbar-group">{[['work', 'sb_cross', 'Work mode'], ['zoom', 'sb_zoom', 'Zoom'], ['rotate', 'sb_rot', 'Camera rotation'], ['move', 'sb_move', 'Move camera']].map(([mode, icon, title]) => <Tool action={'camera:'+mode} key={mode} icon={icon} title={title} look={look} active={value === mode} onClick={() => onChange(mode)}/>)}</div>;
}
export function TransformTools({ value, onChange, look }) {
  const { preferences } = usePreferencesContext(), spread = modifierSentence(' Hold {0} while dragging to move separate pieces closer or apart without changing their size.', 'drag.scale.spread', preferences);
  return <>{[['select', 'sb_select', 'Select'], ['translate', 'sb_move', 'Move'], ['rotate', 'sb_rot', 'Rotate'], ['scale', 'sb_zoom', 'Resize', 'Resize: drag to grow or shrink.' + spread]].map(([mode, icon, title, description]) => <Tool action={mode} key={mode} icon={icon} title={title} description={description} look={look} active={value === mode} onClick={() => onChange(mode)}/>)}</>;
}
/** Rotate's "Each piece", stored with the other Rotate settings. Beside Workplane Constraints, also in quad view. */
export function EachPieceToggle() {
  const { preferences, changePreferences } = usePreferencesContext(), on = preferences?.rotation?.eachPiece === true;
  return <div className="classic-selection-actions each-piece-control"><button type="button" data-hotkey="eachPiece" data-hotkey-manual="" aria-label="Each piece" aria-pressed={on} title="On: Rotate works on each separate piece, on its own spot. Off: the whole selection turns as one group." onClick={() => changePreferences?.(previous => ({ ...previous, rotation: { ...previous.rotation, eachPiece: !on } }))}>Each piece</button></div>;
}
export function WorkplaneControls({ enabled, onEnabled, value, onChange, locked }) {
  const group = React.useId();
  return <fieldset className="classic-planes"><legend><label title="On: Rotate stays locked to the chosen plane. Off: use the handles."><input data-hotkey="workplaneEnabled" aria-label="Workplane Constraints" type="checkbox" disabled={!!locked} checked={!!locked || enabled} onChange={event => onEnabled(event.target.checked)}/>Workplane Constraints</label></legend>{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([plane, label]) => <label key={plane}><input data-hotkey={'plane:'+plane} aria-label={label+' workplane'} type="radio" name={group} disabled={!!locked} checked={(locked || value) === plane} onChange={() => onChange(plane)}/>{label}</label>)}</fieldset>;
}
