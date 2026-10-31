import React from 'react';

// One icon set for every tool in MDLxL, redrawn from the MDLVis buttons
// (public/classic) with the new look's colours. Each part is
// [kind, path, colour, width]: kind f = filled shape, s = line. Colour "ink"
// follows the button's text colour, so tools still light up when active;
// the other colours are MDLVis's. Inline styles keep the colours in every
// toolbar, whatever CSS that toolbar gives its icons.
const square = (x, y, s) => `M${x} ${y}h${s}v${s}h-${s}Z`;
const round = (x, y, w, h, r) => `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1-${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1-${r}-${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r}-${r}Z`;
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0-${2 * r} 0Z`;
const corners = square(1, 1, 4) + square(18, 1, 4) + square(1, 19, 4) + square(18, 19, 4);
const triangleCorners = square(10, 1.5, 4) + square(1.5, 17.5, 4) + square(18.5, 17.5, 4);
const bone = 'M5 7a2 2 0 1 1 3-2l8 8a2 2 0 1 1 2 3 2 2 0 1 1-3 2L7 10a2 2 0 1 1-2-3Z';
const tile = round(2.5, 2.5, 19, 19, 3);
const frame = 'M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5';
const book = [['f', round(4, 2, 16, 20, 1.5), 'blue'], ['f', 'M6.5 4.5h11v2h-11Z', 'white']];
const arrow = 'M6 3V18l3.5-3.5 2.5 6 2.5-1-2.5-6H17Z';
const brushTip = 'M7 10.5l6.5 6.5c-2 3-5 4.5-10 4.5 0-5 1.5-8 3.5-11Z';

const ICONS = Object.freeze({
  select: [['f', arrow, 'ink'], ['f', corners, 'blue']],
  move: [['f', 'M8 21C6 19.5 4 16.5 3.5 14v-3a1.5 1.5 0 0 1 3 0v2V5a1.5 1.5 0 0 1 3 0v6V3.5a1.5 1.5 0 0 1 3 0V11V5a1.5 1.5 0 0 1 3 0v6.5V8a1.5 1.5 0 0 1 3 0v7c0 3.5-2 6-5 6Z', 'ink']],
  rotate: [['s', 'M5.5 16v-5a6.5 6.5 0 0 1 13 0v5', 'ink', 3], ['f', 'M2 15l3.5 6L9 15ZM15 15l3.5 6L22 15Z', 'solid']],
  scale: [['s', 'M14.5 14.5 21 21', 'blue', 4], ['f', circle(10, 10, 6.5), 'ink'], ['s', 'M7 8.5a3.5 3.5 0 0 1 3-2.5', 'white', 1.6]],
  work: [['f', arrow, 'ink']],
  normalRotate: [['f', tile, 'orange'], ['s', 'M16.5 9.5A5 5 0 0 0 7.5 10M7.5 14.5a5 5 0 0 0 9-.5', 'white', 2.2], ['f', 'M14.5 9.5l3 1 .3-3.5ZM9.5 14.5l-3-1-.3 3.5Z', 'white']],
  delete: [['f', 'M5.5 7 7 21h10l1.5-14Z', 'ink'], ['f', round(4, 4, 16, 3, 1), 'ink'], ['s', 'M9.5 12a3 3 0 0 1 5-.8M14.5 16a3 3 0 0 1-5 .8', 'green', 2], ['f', 'M15.2 9.6 15 12l-2.2-.4ZM8.8 17.4 9 15l2.2.4Z', 'green']],
  uncouple: [['s', 'M1.5 6.5 8 13l-6 6M22.5 4l-7 6 6.5 7', 'red', 2], ['f', square(5.5, 10.5, 5) + square(13, 7.5, 5), 'blue']],
  mirror: [...book, ['s', 'M12 19v-8M8.5 13 12 9l3.5 4', 'white', 2.6]],
  mirrorX: [...book, ['s', 'M7.5 14h9M9.5 11.5 7 14l2.5 2.5M14.5 11.5 17 14l-2.5 2.5', 'white', 2.2]],
  mirrorY: [...book, ['s', 'M12 9.5v10M9.5 12 12 9.5l2.5 2.5M9.5 17 12 19.5l2.5-2.5', 'white', 2.2]],
  extrude: [['f', 'M5 20l2-9q5-8 10 0l2 9Z', 'ink'], ['s', 'M4 20.5h16', 'ink', 2], ['s', 'M12 4v16', 'red', 2.2], ['f', 'M12 10l2 3-2 3-2-3Z', 'red']],
  detach: [['f', circle(12, 12, 9.5), 'green'], ['s', 'M15.5 8C13 6 8.5 7.5 10.5 11s.5 6.5-2.5 5', 'white', 2.4]],
  triangle: [['s', 'M12 3.5 3.5 19.5h17Z', 'red', 2.2], ['f', triangleCorners, 'blue']],
  deleteTriangles: [['s', 'M12 3.5 3.5 19.5h17Z', 'dash', 1.5], ['f', triangleCorners, 'blue'], ['s', 'M9.5 10.5l5 5M14.5 10.5l-5 5', 'red', 2.4]],
  collapse: [['s', 'M4 4l5.5 5.5M20 4l-5.5 5.5M4 20l5.5-5.5M20 20l-5.5-5.5', 'ink', 2], ['f', corners, 'blue'], ['f', circle(12, 12, 3), 'red']],
  weld: [['s', 'M5 8q7 0 7 4t7 4', 'red', 2], ['f', square(2, 5.5, 5) + square(17, 13.5, 5), 'blue'], ['f', circle(12, 12, 3.2), 'yellow']],
  reverseNormals: [['s', 'M4 12h6M14.5 8.5 17.5 6v12M14.5 18h6', 'ink', 2.6]],
  smoothNormals: [['s', 'M2 21h20', 'ink', 2], ['f', 'M4 6h4.5v15H4Z', 'blue'], ['f', 'M10 10h4.5v11H10Z', 'yellow'], ['f', 'M16 7.5h4.5V21H16Z', 'red']],
  restoreNormals: [['f', tile, 'orange'], ['s', 'M8 8l8 8M16 8l-8 8', 'white', 3]],
  uv: [['f', round(3, 3, 18, 18, 1.5), 'ink'], ['s', 'M3 12h18M12 3v18', 'ink', 1.4], ['s', 'M5 19l5-5H5Z', 'red', 1.6], ['f', square(13.5, 4.5, 3), 'blue']],
  fold: [['f', 'M4 3h11l5 5v13H4Z', 'ink'], ['f', 'M15 3v5h5Z', 'orange'], ['s', 'M7 14h9M13 11l3 3-3 3', 'blue', 2.2]],
  crop: [['s', 'M6 2v16h16M2 6h16v16', 'ink', 2.4], ['f', square(9, 9, 6), 'blue']],
  new: [['f', 'M5 3h9l5 5v13H5Z', 'ink'], ['s', 'M14 3v5h5', 'ink', 1.6], ['f', circle(16.5, 17, 5), 'green'], ['s', 'M16.5 14.5v5M14 17h5', 'white', 2]],
  open: [['f', 'M2.5 6.5a1.5 1.5 0 0 1 1.5-1.5h5l2 2h8.5a1.5 1.5 0 0 1 1.5 1.5V19H2.5Z', 'yellow'], ['f', 'M2.5 19l3-8h17l-3 8Z', 'yellow']],
  save: [['f', 'M3.5 3.5h14l3 3v14h-17Z', 'blue'], ['f', 'M7 3.5h9v5H7Z', 'white'], ['f', 'M6.5 13h11v7.5h-11Z', 'white'], ['s', 'M13.5 5v2', 'blue', 1.6]],
  undo: [['s', 'M8 9h7a5.5 5.5 0 0 1 0 11h-4', 'ink', 2.6], ['f', 'M9 4 3.5 9 9 14Z', 'blue']],
  redo: [['s', 'M16 9H9a5.5 5.5 0 0 0 0 11h4', 'ink', 2.6], ['f', 'M15 4l5.5 5L15 14Z', 'blue']],
  copy: [['f', 'M3.5 3.5h11v13h-11Z', 'ink'], ['f', 'M9.5 7.5h11v13h-11Z', 'blue']],
  paste: [['f', round(4, 4, 16, 18, 1.5), 'yellow'], ['f', 'M8.5 2.5h7v4h-7Z', 'ink'], ['f', 'M8 10h10v10H8Z', 'white']],
  play: [['f', 'M6 3.5v17L20 12Z', 'green']],
  stop: [['f', round(4.5, 4.5, 15, 15, 1.5), 'red']],
  refresh: [['s', 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'ink', 2.4], ['f', 'M20.5 3v6.5H14Z', 'blue']],
  lamp: [['f', circle(12, 10, 6.5), 'yellow'], ['f', 'M9 17.5h6v3.5H9Z', 'ink'], ['s', 'M12 1.5v1M3 10h1M20 10h1', 'ink', 1.8]],
  // Display toggles
  shaded: [['f', circle(12, 12, 8.5), 'ink'], ['f', 'M12 3.5a8.5 8.5 0 0 0 0 17Z', 'blue'], ['s', 'M8 8a5 5 0 0 1 2.5-1.8', 'white', 1.6]],
  rgb: [['f', circle(12, 8, 5), 'red'], ['f', circle(8, 15, 5), 'green'], ['f', circle(16, 15, 5), 'blue']],
  vertices: [['s', 'M12 4 4 19h16Z', 'dash', 1.5], ['f', square(10, 2, 4) + square(2, 17, 4) + square(18, 17, 4), 'blue']],
  normals: [['s', 'M2 20h20', 'ink', 2], ['s', 'M8 20V9M16 20V9', 'red', 2], ['f', 'M5.5 10 8 5.5l2.5 4.5ZM13.5 10 16 5.5l2.5 4.5Z', 'red']],
  wires: [['s', 'M12 3 20 7.5v9L12 21 4 16.5v-9ZM12 12l8-4.5M12 12 4 7.5M12 12v9', 'ink', 1.8], ['f', square(10.5, 10.5, 3), 'blue']],
  grid: [['s', 'M3 8h18M3 16h18M8 3v18M16 3v18', 'ink', 1.8]],
  bone: [['f', bone, 'blue']],
  skeleton: [['s', 'M12 7v9M12 10l-5 3M12 10l5 3M12 16l-4 5M12 16l4 5', 'ink', 2], ['f', circle(12, 5, 2.4) + circle(12, 10, 1.5) + circle(12, 16, 1.5), 'blue']],
  focusedSkeleton: [['s', frame, 'ink', 2.2], ['f', circle(12, 12, 3.5), 'blue']],
  nodes: [['s', 'M9 7h6v10', 'ink', 2], ['f', square(3, 3.5, 6.5) + square(14.5, 14, 6.5), 'blue']],
  particles: [['f', 'M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2Z', 'yellow'], ['f', circle(19, 5, 1.6) + circle(5, 19, 1.4), 'orange']],
  events: [['s', 'M6 22V3', 'ink', 2.2], ['f', 'M6.5 3.5h12l-3 4.5 3 4.5h-12Z', 'red']],
  sounds: [['f', 'M3 9.5v5h4l6 5v-15l-6 5Z', 'ink'], ['s', 'M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11', 'blue', 2]],
  attachments: [['s', 'M9.5 13.5 15 8a2.5 2.5 0 0 1 3.5 3.5l-7.8 7.8a4.5 4.5 0 0 1-6.4-6.4L12 5.2', 'ink', 2.2], ['f', circle(15.5, 8.5, 1.6), 'blue']],
  clear: [['s', 'M6 6l12 12M18 6 6 18', 'red', 3]],
  // Bones tab
  boneDelete: [['f', tile, 'red'], ['s', 'M7 12h10', 'white', 3]],
  boneCreate: [['f', tile, 'green'], ['s', 'M12 7v10M7 12h10', 'white', 3]],
  boneAttach: [['s', 'M9 11.5h6', 'ink', 2.4], ['f', square(2, 8, 7) + square(15, 8, 7), 'green']],
  boneDetach: [['s', 'M10 11.5h1M13 11.5h1', 'dash', 2], ['f', square(2, 8, 7) + square(15, 8, 7), 'red']],
  softBind: [['f', bone, 'blue'], ['f', circle(18, 5.5, 4.5), 'green'], ['s', 'M18 3v5M15.5 5.5h5', 'white', 1.8]],
  hardBind: [['f', bone, 'blue'], ['f', circle(18, 5.5, 4), 'green']],
  detachVertices: [['s', 'M3 21 21 3', 'ink', 2.2], ['f', circle(4, 15, 2) + circle(8, 9, 2) + circle(12, 4, 2) + circle(15, 20, 2), 'red']],
  attachment: [['s', 'M12 8v11l-2 3M8 10h8', 'ink', 2], ['f', circle(12, 5, 3), 'red']],
  // Paint
  brush: [['f', 'M14 3.5l6.5 6.5-7 7-6.5-6.5Z', 'orange'], ['f', brushTip, 'blue']],
  stamp: [['f', 'M9 3h6v5l-1 3h-4l-1-3Z', 'orange'], ['f', round(4, 11, 16, 5, 1), 'ink'], ['f', 'M5 17h14v3.5H5Z', 'red']],
  erase: [['f', 'M3 15.5 12 6.5l7 7-6.5 6.5H7Z', 'ink'], ['f', 'M12 6.5l7 7 2-2-7-7Z', 'red'], ['s', 'M13 20.5h8', 'ink', 1.8]],
  smudge: [['s', 'M3 17c4-6 9-6 18-3', 'blue', 3.2], ['f', 'M13 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z', 'ink']],
  pick: [['s', 'M4 20l8.5-8.5', 'ink', 2.4], ['f', 'M11 10l3 3 5.5-5.5-3-3Z', 'ink'], ['f', circle(18, 6, 3), 'blue'], ['f', circle(4, 20, 1.8), 'red']],
  cut: [['s', 'M8 8.5 18 20M16 8.5 6 20', 'ink', 2.2], ['f', circle(7, 6, 2.8) + circle(17, 6, 2.8), 'red']],
  librarySave: [['f', 'M6 3h12v18l-6-4.5L6 21Z', 'blue'], ['s', 'M12 7v6M9 10h6', 'white', 2]],
  frame: [['s', frame, 'ink', 2.2], ['f', circle(12, 12, 4), 'ink']],
  // Forge
  addShape: [['f', 'M3.5 8 11 4.5 18.5 8v8.5L11 20l-7.5-3.5Z', 'ink'], ['f', circle(18, 17.5, 4.5), 'green'], ['s', 'M18 15v5M15.5 17.5h5', 'white', 1.8]],
  blendShapes: [['f', 'M3 6h9v12H3Z', 'blue'], ['f', 'M12 6h9v12h-9Z', 'yellow'], ['s', 'M12 6v12', 'dash', 1.8]],
  duplicate: [['f', 'M3 7 9 4l6 3v7l-6 3-6-3Z', 'ink'], ['f', 'M9 11l6-3 6 3v7l-6 3-6-3Z', 'blue']],
  inset: [['f', square(3, 3, 18), 'ink'], ['s', 'M3 3l5 5M21 3l-5 5M3 21l5-5M21 21l-5-5', 'ink', 1.4], ['f', square(8, 8, 8), 'blue']],
  shapeMode: [['f', 'M4 7 12 3l8 4v10l-8 4-8-4Z', 'ink'], ['s', 'M4 7l8 4 8-4M12 11v10', 'ink', 1.6]],
  edgeMode: [['s', 'M4 7 12 3l8 4v10l-8 4-8-4Z', 'dash', 1.5], ['s', 'M20 7v10', 'red', 2.6], ['f', square(18, 5, 4) + square(18, 15, 4), 'blue']],
  vertexMode: [['s', 'M5 5h14v14H5Z', 'dash', 1.5], ['f', square(3, 3, 4) + square(17, 3, 4) + square(3, 17, 4) + square(17, 17, 4), 'blue']],
  bend: [['s', 'M4 20v-9q0-7 7-7h9M8 20v-9q0-3 3-3h9', 'ink', 2.2], ['f', circle(6, 6, 2.2), 'orange']],
  bulge: [['s', 'M6 3Q1 12 6 21M18 3q5 9 0 18', 'ink', 2.2], ['s', 'M8 12h8M12 8v8', 'orange', 2.4]],
  taper: [['f', 'M4 21 9 3h6l5 18Z', 'ink'], ['s', 'M9 3h6', 'orange', 2.8]],
  bevel: [['f', 'M3 21V8l5-5h13v18Z', 'ink'], ['s', 'M3 8l5-5', 'orange', 2.8]],
  twist: [['s', 'M6 3c18 4-6 14 12 18M18 3C0 7 24 17 6 21', 'ink', 2], ['s', 'M6 3h12M6 21h12', 'orange', 2.4]],
});

// [fill, outline, line]; MDLVis's colours, a shade darker for the outline.
const COLOURS = Object.freeze({
  ink: ['color-mix(in srgb,currentColor 16%,transparent)', 'currentColor', 'currentColor'],
  solid: ['currentColor', 'currentColor', 'currentColor'],
  dash: ['none', 'currentColor', 'currentColor'],
  white: ['#fff', 'none', '#fff'],
  blue: ['#3d8bffdd', '#063d8c', '#2f7de1'],
  red: ['#ff4a3add', '#8f1208', '#e4231d'],
  orange: ['#ffa83add', '#8a4a00', '#e88a1a'],
  green: ['#43c25bdd', '#17621f', '#2e9a2e'],
  yellow: ['#ffd64ddd', '#805500', '#d9a800'],
});

export function hasToolIcon(name) { return !!ICONS[name]; }

export default function ToolIcon({ name, className = 'tool-icon', size }) {
  const parts = ICONS[name];
  if (!parts) return null;
  return <svg className={className} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">{parts.map(([kind, d, colour, width], index) => {
    const [fill, outline, line] = COLOURS[colour];
    const style = kind === 'f' ? { fill, stroke: outline, strokeWidth: 1.9 } : { fill: 'none', stroke: line, strokeWidth: width || 2, ...(colour === 'dash' ? { strokeDasharray: '2 2.4', opacity: .6 } : null) };
    return <path key={index} d={d} style={{ ...style, strokeLinecap: 'round', strokeLinejoin: 'round' }}/>;
  })}</svg>;
}
