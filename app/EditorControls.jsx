import React, { useEffect, useRef, useState } from 'react';
import ModernIcon, { hasModernIcon } from './ModernIcon.jsx';

export function Tool({ icon, title, onClick, active, disabled, children, flip, action, badge, className = '' }) {
  return <button data-warmkey={action} type="button" className={`classic-tool${active ? ' active' : ''}${className ? ' ' + className : ''}`} title={title} aria-label={title} aria-pressed={active === undefined ? undefined : !!active} disabled={disabled} onClick={onClick}>{icon ? hasModernIcon(icon) ? <ModernIcon name={icon} flip={flip}/> : <img src={`./classic/${icon}${/\.(png|gif|svg)$/.test(icon)?'':'.png'}`} alt="" draggable={false} style={flip ? { transform: 'scaleX(-1)' } : undefined}/> : children}{badge && <span className="module-icon-badge" aria-hidden="true">{badge}</span>}</button>;
}

export function Coordinate({ axis, displayAxis=axis, value, disabled, onCommit }) {
  const [text, setText] = useState('0'), cancel = useRef(false);
  useEffect(() => setText(Number.isFinite(value) ? String(Number(value.toFixed(4))) : '0'), [value]);
  const commit = () => { if (cancel.current) { cancel.current = false; return; } const number = Number(text); if (Number.isFinite(number) && number !== Number(value.toFixed(4))) onCommit(number); else setText(String(Number(value.toFixed(4)))); };
  return <label className="field"><span>{displayAxis}</span><input data-warmkey={`coordinate:${axis}`} aria-label={`${axis} coordinate`} type="number" step="any" disabled={disabled} value={text} onChange={event => setText(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { cancel.current = true; setText(String(Number(value.toFixed(4)))); event.currentTarget.blur(); } }}/></label>;
}

export function CameraTools({ value, onChange }) {
  return <div className="classic-toolbar-group">{[['work', 'sb_cross', 'Work mode'], ['zoom', 'sb_zoom', 'Zoom'], ['rotate', 'sb_rot', 'Camera rotation'], ['move', 'sb_move', 'Move camera']].map(([mode, icon, title]) => <Tool action={'camera:'+mode} key={mode} icon={icon} title={title} active={value === mode} onClick={() => onChange(mode)}/>)}</div>;
}
export function TransformTools({ value, onChange }) {
  return <>{[['select', 'sb_select', 'Select'], ['translate', 'sb_move', 'Move'], ['rotate', 'sb_rot', 'Rotate'], ['scale', 'sb_zoom', 'Resize']].map(([mode, icon, title]) => <Tool action={mode} key={mode} icon={icon} title={title} active={value === mode} onClick={() => onChange(mode)}/>)}</>;
}
export function WorkplaneControls({ enabled, onEnabled, value, onChange, locked }) {
  const group = React.useId();
  return <fieldset className="classic-planes"><legend><label><input data-warmkey="workplaneEnabled" aria-label="Workplane" type="checkbox" disabled={!!locked} checked={!!locked || enabled} onChange={event => onEnabled(event.target.checked)}/>Workplane</label></legend>{[['xy', 'XY'], ['xz', 'ZX'], ['yz', 'YZ']].map(([plane, label]) => <label key={plane}><input data-warmkey={'plane:'+plane} aria-label={label+' workplane'} type="radio" name={group} disabled={!!locked} checked={(locked || value) === plane} onChange={() => onChange(plane)}/>{label}</label>)}</fieldset>;
}
