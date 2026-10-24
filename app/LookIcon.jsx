import React from 'react';

// The new look's hand-drawn 24px icons for the sidebar tools and the top row.
// Each part has a role: s = line, f = shape that may be filled, d = detail
// drawn over a filled shape. new-look.css draws them carved; with VIS on they
// stay hidden and the classic icons show instead.
const ICONS = Object.freeze({
  select: [['f', 'M6 3.5 18.5 11.6 12.6 13 9.4 19.2Z']],
  translate: [['s', 'M12 5.5v13M5.5 12h13'], ['f', 'M9.4 6 12 2.8 14.6 6ZM9.4 18 12 21.2 14.6 18ZM6 9.4 2.8 12 6 14.6ZM18 9.4 21.2 12 18 14.6Z'], ['f', { cx: 12, cy: 12, r: 2 }]],
  rotate: [['s', 'M19.2 13.2A7.4 7.4 0 1 1 16.8 6.4'], ['f', 'M20.2 3.6 19.8 9.4 14.6 8.2Z'], ['f', { cx: 12, cy: 12.4, r: 1.7 }]],
  scale: [['f', 'M3.8 13.2h7v7h-7Z'], ['s', 'M3.8 9V3.8H9M15 3.8h5.2V9M20.2 15v5.2H15'], ['s', 'M11.4 12.6 17.4 6.6'], ['f', 'M19.2 4.8 18.6 9.8 14.2 5.4Z']],
  normalRotate: [['s', 'M3 19.5h12'], ['s', 'M9 19.5V9.6'], ['f', 'M6.6 10.4 9 6.4 11.4 10.4Z'], ['s', 'M14.4 4.6A8.4 8.4 0 0 1 20.6 11'], ['f', 'M22.4 10.2 20.4 13.8 18 10.8Z']],
  'Delete vertices': [['s', 'M8.6 17.5h6.8'], ['f', { cx: 6.4, cy: 17.5, r: 2.4 }], ['f', { cx: 17.6, cy: 17.5, r: 2.4 }], ['s', 'M9 3.6l6 6M15 3.6l-6 6']],
  Uncouple: [['f', { cx: 7.6, cy: 12, r: 2.8 }], ['f', { cx: 16.4, cy: 12, r: 2.8 }], ['s', 'M12 4.2v3.2M12 16.6v3.2M2.4 12h.8M20.8 12h.8']],
  Mirror: [['s', 'M12 3v2.6M12 8.6v2.4M12 14v2.4M12 19.4V21'], ['f', 'M9.6 6 3.4 18h6.2Z'], ['s', 'M14.4 6l6.2 12h-6.2Z']],
  Extrude: [['f', 'M3.4 15.4 7.4 12.6h13.2l-4 2.8Z'], ['s', 'M3.4 15.4v4h13.2v-4M16.6 19.4l4-2.8v-4'], ['s', 'M12 12.4V5.4'], ['f', 'M9.6 6.6 12 2.8 14.4 6.6Z']],
  Detach: [['f', 'M3.4 11.6h7.6v8H3.4Z'], ['s', 'M13.2 4.4h7.4v7.4h-7.4Z'], ['s', 'M10.6 9.2l2-2']],
  'Create triangle': [['f', 'M12 3.6 20.8 19.2H3.2Z'], ['d', 'M12 10.4v5.6M9.2 13.2h5.6']],
  'Delete triangles': [['f', 'M9.4 7.4 16.2 19.6H2.6Z'], ['s', 'M15.6 3.6l5 5M20.6 3.6l-5 5']],
  Collapse: [['f', { cx: 12, cy: 12, r: 2.4 }], ['s', 'M3.6 3.6 8.4 8.4M20.4 3.6l-4.8 4.8M3.6 20.4l4.8-4.8M20.4 20.4l-4.8-4.8'], ['s', 'M9 5.2v3.8H5.2M15 5.2v3.8h3.8M9 18.8V15H5.2M15 18.8V15h3.8']],
  Weld: [['f', { cx: 6.6, cy: 14, r: 2.8 }], ['f', { cx: 17.4, cy: 14, r: 2.8 }], ['f', 'M7.4 12.6h9.2v2.8H7.4Z'], ['s', 'M12 3.4v3M8.6 5l1.4 2.2M15.4 5 14 7.2']],
  'Reverse normals': [['s', 'M3 12h18'], ['s', 'M7.6 10.4V5.6M16.4 13.6v4.8'], ['f', 'M5.2 6.4 7.6 2.6 10 6.4ZM14 17.6l2.4 3.8 2.4-3.8Z']],
  'Smooth normals': [['s', 'M3 19c4.4-6.2 13.6-6.2 18 0'], ['s', 'M7.2 15.2 5.8 9.4M12 13.6V7.6M16.8 15.2l1.4-5.8'], ['f', { cx: 5.6, cy: 8, r: 1.5 }], ['f', { cx: 12, cy: 6, r: 1.5 }], ['f', { cx: 18.4, cy: 8, r: 1.5 }]],
  'Restore normals': [['s', 'M20 13.4A8 8 0 1 1 17.4 6.2'], ['f', 'M20.6 2.8V8.6H14.8Z'], ['s', 'M12 16.4V10.8'], ['f', 'M9.8 11.6 12 8 14.2 11.6Z']],
  uv: [['f', 'M4 4h8v8H4ZM12 12h8v8h-8Z'], ['s', 'M4 4h16v16H4Z']],
  new: [['f', 'M6 3h8.4L19 7.6V21H6Z'], ['s', 'M14.4 3v4.6H19'], ['d', 'M12.4 11.4v6M9.4 14.4h6']],
  open: [['f', 'M3 6.6C3 5.7 3.7 5 4.6 5h4.6l2.2 2.2h8C20.3 7.2 21 7.9 21 8.8v9.6c0 .9-.7 1.6-1.6 1.6H4.6C3.7 20 3 19.3 3 18.4Z'], ['d', 'M3.4 10.4h17.2']],
  save: [['f', 'M4 4h12.6L20 7.4V20H4Z'], ['d', 'M8 4v4.6h7V4M7.4 20v-5.8h9.2V20']],
  'camera:work': [['s', 'M12 5.2a6.8 6.8 0 1 0 .01 0M12 2v3.4M12 18.6V22M2 12h3.4M18.6 12H22'], ['f', { cx: 12, cy: 12, r: 2.2 }]],
  'camera:zoom': [['f', { cx: 10.4, cy: 10.4, r: 6.2 }], ['s', 'M15 15l5.6 5.6'], ['d', 'M10.4 7.8v5.2M7.8 10.4H13']],
  'camera:rotate': [['s', 'M2.8 12.6c0-2.4 4.1-4.2 9.2-4.2s9.2 1.8 9.2 4.2-4.1 4.2-9.2 4.2-9.2-1.8-9.2-4.2Z'], ['f', { cx: 12, cy: 12.6, r: 3.6 }], ['f', { cx: 19.6, cy: 9.8, r: 1.4 }]],
  'camera:move': [['s', 'M12 6v12M6 12h12'], ['s', 'M9.6 5.4 12 3l2.4 2.4M9.6 18.6 12 21l2.4-2.4M5.4 9.6 3 12l2.4 2.4M18.6 9.6 21 12l-2.4 2.4'], ['f', 'M10 10h4v4h-4Z']],
  undo: [['s', 'M8 9h7.4a5.4 5.4 0 0 1 0 10.8H11'], ['f', 'M8.6 4.6 3.6 9l5 4.4Z']],
  redo: [['s', 'M16 9H8.6a5.4 5.4 0 0 0 0 10.8H13'], ['f', 'M15.4 4.6 20.4 9l-5 4.4Z']],
  copy: [['f', 'M8.4 8.4h11.6V20H8.4Z'], ['s', 'M4.4 15.6V5.2c0-.4.4-.8.8-.8h10.4']],
  paste: [['f', 'M5.4 5.6h13.2V21H5.4Z'], ['s', 'M9 3.2h6v4.2H9Z'], ['d', 'M9 12h6M9 15.6h4']],
});

export function hasLookIcon(name) { return !!ICONS[name]; }

export default function LookIcon({ name }) {
  const parts = ICONS[name];
  if (!parts) return null;
  return <svg className="look-icon" viewBox="0 0 24 24" aria-hidden="true">{parts.map(([role, shape], index) => typeof shape === 'string'
    ? <path key={index} className={`look-${role}`} d={shape}/>
    : <circle key={index} className={`look-${role}`} cx={shape.cx} cy={shape.cy} r={shape.r}/>)}</svg>;
}
