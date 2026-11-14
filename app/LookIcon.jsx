import React from 'react';
import ToolIcon from './ToolIcon.jsx';

// The new look's icons for the sidebar tools, the top row and the display
// toggles, drawn by ToolIcon so every toolbar shares one set. new-look.css
// carves them; with VIS on they stay hidden and the classic icons show instead.
const ICONS = Object.freeze({
  select: 'select', translate: 'move', rotate: 'rotate', scale: 'scale',
  normalRotate: 'normalRotate', 'Delete vertices': 'delete', Uncouple: 'uncouple', Mirror: 'mirror',
  Extrude: 'extrude', Detach: 'detach', 'Create triangle': 'triangle', 'Delete triangles': 'deleteTriangles',
  Collapse: 'collapse', Weld: 'weld', 'Reverse normals': 'reverseNormals', 'Smooth normals': 'smoothNormals',
  'Restore normals': 'restoreNormals', uv: 'uv',
  new: 'new', open: 'open', save: 'save', undo: 'undo', redo: 'redo', copy: 'copy', paste: 'paste',
  'camera:work': 'work', 'camera:zoom': 'scale', 'camera:rotate': 'rotate', 'camera:move': 'move',
  // Display toggles (keyed by their view-menu action)
  shaded: 'shaded', rgb: 'rgb', showVertices: 'vertices', normals: 'normals', 'display:wires': 'wires',
  grid: 'grid', 'display:bones': 'bone', 'display:skeleton': 'skeleton', 'display:focusedSkeleton': 'focusedSkeleton',
  'display:nodes': 'nodes', 'display:particles': 'particles', 'display:events': 'events', 'display:sounds': 'sounds',
  'display:attachments': 'attachments', clearDisplay: 'clear',
});

export function hasLookIcon(name) { return !!ICONS[name]; }

export default function LookIcon({ name }) {
  return ICONS[name] ? <ToolIcon name={ICONS[name]} className="look-icon"/> : null;
}
