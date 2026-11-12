import React from 'react';
/** The word a handle shows while hovered or focused (CSS hides it otherwise). */
export const HandleWord=({point,word})=>word?<text className="pe-handle-word" x={point[0]+12} y={point[1]-12}>{word}</text>:null;
/** The same hit target and appearance for ribbon ends and effect placement. */
export default function ParticleStageHandle({point,label,word,...events}){
 return point&&<g role="slider" tabIndex={0} aria-label={label} {...events}><circle cx={point[0]} cy={point[1]} r="7"/><HandleWord point={point} word={word}/><title>{label}</title></g>;
}
