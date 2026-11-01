import {particleSweepPath,addParticleDemonstration} from './particle-sweep.js';
/** Only the disposable preview model is changed; recipes/export never see this. */
export function prepareParticleLibraryMotion(model,sample){
  const ribbons=model.RibbonEmitters||[];
  if(!ribbons.length)return false;
  const interval=Array.from(model.Sequences[sample.sequence]?.Interval||[0,5000]);
  const moving=ribbons.every(node=>{
    const points=particleSweepPath(model,node.ObjectId,sample.sequence,interval,null,17);
    return points.some(point=>point.world.some((value,index)=>Math.abs(value-points[0].world[index])>1));
  });
  if(moving)return false;
  addParticleDemonstration(model,interval);return true;
}
