import React from 'react';
import { UV_DRAG_LIMITS, UV_ROTATE_SNAPS, UV_ZOOM_SNAPS } from '../../src/uv-drag-settings.js';
import { Numeric, SettingsCheck, SettingsSelect } from './controls.jsx';

/** Mouse > UV: how the UV Wrapper's Rotate and Zoom drags feel. 3D tools never read these. */
export default function UVDragSettings({ value, onChange }) {
  const style = value.rotateStyle, limits = UV_DRAG_LIMITS;
  return <>
    <section className="settings-appearance-section"><h4>Rotate</h4><div className="settings-appearance-content">
      <SettingsSelect id="mouse:uv-rotate-style" label="How you drag" aria="UV Rotate drag" tip="Which mouse movement turns the selection." value={style} onChange={rotateStyle => onChange({ rotateStyle })} options={[['circle', 'Circle around the centre'], ['leftRight', 'Left and right'], ['both', 'Circle + left and right']]}/>
      <Numeric id="mouse:uv-rotate-speed" label="Turn speed" title="How far the selection turns for the same mouse movement." value={value.rotateSpeed} {...limits.rotateSpeed} unit="%" onChange={rotateSpeed => onChange({ rotateSpeed })}/>
      {style !== 'leftRight' && <Numeric id="mouse:uv-rotate-zone" label="Deadzone near centre" title="Close to the centre the turn is gentler, so the selection does not snap around as the mouse passes over it. 0 turns this off." value={value.rotateZone} {...limits.rotateZone} unit="px" onChange={rotateZone => onChange({ rotateZone })}/>}
      {style !== 'leftRight' && <SettingsCheck id="mouse:uv-rotate-big-pieces" label="Big pieces turn slower" tip="While the mouse is over a big piece, it turns gently so no point moves faster than the mouse." checked={value.rotateBigPieces} onChange={rotateBigPieces => onChange({ rotateBigPieces })}/>}
      {style !== 'circle' && <SettingsCheck id="mouse:uv-rotate-reverse" label="Reverse direction" tip="Swaps which way left and right turn." checked={value.rotateReverse} onChange={rotateReverse => onChange({ rotateReverse })}/>}
      <SettingsSelect id="mouse:uv-rotate-snap" label="Angle snap (hold Ctrl)" tip="While Ctrl is held, turns in these steps." value={value.rotateSnap} onChange={rotateSnap => onChange({ rotateSnap })} options={UV_ROTATE_SNAPS.map(snap => [snap, snap ? `${snap}°` : 'Off'])}/>
    </div></section>
    <section className="settings-appearance-section"><h4>Zoom</h4><div className="settings-appearance-content">
      <SettingsSelect id="mouse:uv-zoom-style" label="How you drag" aria="UV Zoom drag" tip="Which mouse movement resizes the selection." value={value.zoomStyle} onChange={zoomStyle => onChange({ zoomStyle })} options={[['centre', 'Away from or toward the centre'], ['rightUp', 'Right or up grows, left or down shrinks'], ['leftRight', 'Left and right only'], ['upDown', 'Up grows, down shrinks']]}/>
      <Numeric id="mouse:uv-zoom-speed" label="Zoom speed" title="How much the size changes for the same mouse movement." value={value.zoomSpeed} {...limits.zoomSpeed} unit="%" onChange={zoomSpeed => onChange({ zoomSpeed })}/>
      <SettingsSelect id="mouse:uv-zoom-snap" label="Size snap (hold Ctrl)" tip="While Ctrl is held, resizes in these steps." value={value.zoomSnap} onChange={zoomSnap => onChange({ zoomSnap })} options={UV_ZOOM_SNAPS.map(snap => [snap, snap ? `${snap}%` : 'Off'])}/>
    </div></section>
  </>;
}
