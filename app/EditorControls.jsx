import React from 'react';
import { useDraftNumber } from './Fields.jsx';
import ModernIcon, { hasModernIcon } from './ModernIcon.jsx';
import LookIcon, { hasLookIcon } from './LookIcon.jsx';

// look: also draw the new look's icon for this action (shown only with VIS off).
export function Tool({ icon, title, description, onClick, active, disabled, children, flip, action, badge, className = '', look = false }) {
  const lookIcon = look && hasLookIcon(action);
  return <button data-hotkey={action} type="button" className={`classic-tool${active ? ' active' : ''}${lookIcon ? ' has-look-icon' : ''}${className ? ' ' + className : ''}`} title={description || title} aria-label={title} aria-pressed={active === undefined ? undefined : !!active} disabled={disabled} onClick={onClick}>{lookIcon && <LookIcon name={action}/>}{icon ? hasModernIcon(icon) ? <ModernIcon name={icon} flip={flip}/> : <img src={`./classic/${icon}${/\.(png|gif|svg)$/.test(icon)?'':'.png'}`} alt="" draggable={false} style={flip ? { transform: 'scaleX(-1)' } : undefined}/> : children}{badge && <span className="module-icon-badge" aria-hidden="true">{badge}</span>}</button>;
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
  return <>{[['select', 'sb_select', 'Select'], ['translate', 'sb_move', 'Move'], ['rotate', 'sb_rot', 'Rotate'], ['scale', 'sb_zoom', 'Resize']].map(([mode, icon, title]) => <Tool action={mode} key={mode} icon={icon} title={title} look={look} active={value === mode} onClick={() => onChange(mode)}/>)}</>;
}
export function WorkplaneControls({ enabled, onEnabled, value, onChange, locked }) {
  const group = React.useId();
  return <fieldset className="classic-planes"><legend><label><input data-hotkey="workplaneEnabled" aria-label="Workplane" type="checkbox" disabled={!!locked} checked={!!locked || enabled} onChange={event => onEnabled(event.target.checked)}/>Workplane</label></legend>{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([plane, label]) => <label key={plane}><input data-hotkey={'plane:'+plane} aria-label={label+' workplane'} type="radio" name={group} disabled={!!locked} checked={(locked || value) === plane} onChange={() => onChange(plane)}/>{label}</label>)}</fieldset>;
}
