// Existing authored stacks include the emitter layers chosen before empty defaults.
import {newStack,makeLayer} from '../../src/global-animation-looks.js';
export const authoredStack=(look,frame,owner)=>({...newStack(look,frame,owner),layers:look.layers.map((spec,i)=>makeLayer(spec,frame,look.palette,i+1))});
