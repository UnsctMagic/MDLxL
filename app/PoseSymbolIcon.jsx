import React, { useId } from 'react';
import { isPoseMaskSet, poseSymbolLayers } from '../src/pose-symbol-sets.js';
import { poseMaskUrl } from './pose-masks.js';

/** The paths of one POSE symbol (24 x 24 units) in the symbol colour; gaps are drawn in `background`. The Modern set tints its PNG mask with the colour. */
export function PoseSymbolPaths({ set, name, color = 'currentColor', background = 'var(--ui-panel, #d4d0c8)', large = false }) {
  const id = 'pose-mask-' + useId().replace(/[^a-z0-9]/gi, '');
  if (isPoseMaskSet(set)) return <>
    <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24" style={{ maskType: 'alpha' }}><image href={poseMaskUrl(name, !large)} x="0" y="0" width="24" height="24"/></mask>
    <rect x="0" y="0" width="24" height="24" fill={color} mask={`url(#${id})`}/>
  </>;
  return poseSymbolLayers(set, name).map(({ kind, d, width }) => kind === 'fill'
    ? <path key={kind} d={d} fill={color} stroke="none"/>
    : <path key={kind} d={d} fill="none" stroke={kind === 'cut' ? background : color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"/>);
}

export default function PoseSymbolIcon(props) {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><PoseSymbolPaths large {...props}/></svg>;
}
