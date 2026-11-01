import React from 'react';
/** The same hit target and appearance for ribbon ends and effect placement. */
export default function ParticleStageHandle({point,label,...events}){
 return point&&<g role="slider" tabIndex={0} aria-label={label} {...events}><circle cx={point[0]} cy={point[1]} r="7"/><title>{label}</title></g>;
}
