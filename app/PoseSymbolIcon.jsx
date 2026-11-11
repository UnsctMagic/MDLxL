import React from 'react';
import { poseSymbolLayers } from '../src/pose-symbol-sets.js';

/** The paths of one POSE symbol (24 x 24 units) in the symbol colour; gaps are drawn in `background`. */
export function PoseSymbolPaths({ set, name, color = 'currentColor', background = 'var(--ui-panel, #d4d0c8)' }) {
  return poseSymbolLayers(set, name).map(({ kind, d, width }) => kind === 'fill'
    ? <path key={kind} d={d} fill={color} stroke="none"/>
    : <path key={kind} d={d} fill="none" stroke={kind === 'cut' ? background : color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>);
}

export default function PoseSymbolIcon(props) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><PoseSymbolPaths {...props}/></svg>;
}
