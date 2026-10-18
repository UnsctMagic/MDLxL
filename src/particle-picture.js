import {visitTextureReferences} from './texture-references.js';
import {STARTER_TEXTURE} from './particle-starters.js';

export function particlePictureShared(model,emitter,index){
 let shared=false;visitTextureReferences(model,(value,set,owner)=>{if(value===index&&owner!==emitter)shared=true;});return shared;
}
export function removeParticlePicture(model,id,index){
 const emitter=model.ParticleEmitters2.find(node=>node.ObjectId===id);
 if(!emitter||!model.Textures[index])throw Error('Choose a particle picture first.');
 if(particlePictureShared(model,emitter,index))throw Error('This picture is also used by another emitter or material. Choose a different picture for this particle.');
 if(emitter.TextureID===index){
  let next=model.Textures.findIndex((t,i)=>i!==index&&t.Image&&!t.ReplaceableId);
  if(next<0)next=model.Textures.push({Image:STARTER_TEXTURE,ReplaceableId:0,Flags:0})-1;
  emitter.TextureID=next;emitter.ReplaceableId=0;
 }
 model.Textures.splice(index,1);
 visitTextureReferences(model,(value,set)=>{if(value>index)set(value-1);});
}

export const particleFrameGroups=[['Early sprites','LifeSpanUVAnim'],['Late sprites','DecayUVAnim'],['Early streaks','TailUVAnim'],['Late streaks','TailDecayUVAnim']];
export const particleBlendNames=['Blend','Additive','Modulate','Modulate 2×','Alpha Key'];
