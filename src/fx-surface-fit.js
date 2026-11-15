// The frozen surface-fit inputs, without three.js: preferences.js (main process) reaches this
// through fx-own-looks.js, and the packaged app ships no node_modules.
import {clamp} from './math.js';

export const SURFACE_FIT_VERSION=1;

/** Freeze the recipe inputs that determine the default site count and clearance. */
export function surfaceFitInputs(layer,basis) {
 const spec=layer.nativeSpec;
 const radius=clamp(basis.length*.48,2,55);
 const sizes=layer.native?.ParticleScaling || spec?.size?.map(size=>size*radius*layer.size) || [layer.size];
 const alpha=layer.native?.Alpha || spec?.alpha;
 const visible=Array.from(sizes).filter((_,i)=>!alpha||alpha[i]>0);
 const footprint=Math.max(1,...(visible.length?visible:sizes));
 const rate=spec?(spec.rate??8)*layer.amount/24:layer.amount;
 const liveParticles=rate*(spec?.life??layer.lasts);
 // A compact multi-emitter recipe shares one surface anchor across its layers.
 if(layer.focusedEmitter)return {version:SURFACE_FIT_VERSION,footprint:Math.max(1,basis.length*.1),liveParticles:4};
 return {version:SURFACE_FIT_VERSION,footprint,liveParticles};
}
