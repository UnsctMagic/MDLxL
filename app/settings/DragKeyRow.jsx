import React, { useEffect, useRef } from 'react';

export const DRAG_KEYS_CATEGORY = 'Mouse drag keys';

/** One line of the "Mouse drag keys" category. A key already used in that scope waits for Replace. */
export function DragKeyRow({ row, clash, onClash, onMessage }) {
  const clashRow = useRef(null);
  useEffect(() => { clashRow.current?.scrollIntoView({ block: 'nearest' }); }, [clash?.value]);
  const assign = (value, options) => {
    const result = row.change(value, options);
    onClash(result.applied ? null : { id: row.id, value, text: result.conflict });
    if (result.applied) onMessage(`${value || 'None'} assigned to ${row.label}.`);
  };
  return <>
    <tr>
      <td><strong>{row.label}</strong><small title={row.id}>{DRAG_KEYS_CATEGORY} · {row.scopeLabel}</small>{row.conflict && <p className="hotkeys-conflict">{row.conflict}</p>}</td>
      <td><select className="hotkeys-drag-key" aria-label={row.ariaLabel} title={row.tooltip} value={row.value} onChange={event => assign(event.target.value)}>{row.allowed.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></td>
      <td><div className="hotkeys-row-actions"><button aria-label={`Restore default key for ${row.ariaLabel}`} onClick={() => assign(row.defaultValue)}>Reset</button></div></td>
    </tr>
    {clash && <tr ref={clashRow} className="hotkeys-clash"><td colSpan={3}><p className="hotkeys-conflict">{clash.text}</p><div className="settings-inline-actions"><button onClick={() => assign(clash.value, { replace: true })}>Replace existing assignment</button><button onClick={() => onClash(null)}>Cancel</button></div></td></tr>}
  </>;
}
