import {STARTER_TEXTURE,RIBBON_TEXTURE} from '../src/particle-starters.js';
const smooth=t=>{t=Math.min(1,Math.max(0,t));return t*t*(3-2*t);};
/** Test-only picture bytes (64×64 TGA): a soft disc, or a trail fading toward its tail for the ribbon. The app itself uses the stock game pictures. */
export function starterTextureAsset(name=STARTER_TEXTURE) {
  const size=64,bytes=new Uint8Array(18+size*size*4),ribbon=name===RIBBON_TEXTURE;
  bytes[2]=2;bytes[12]=size;bytes[14]=size;bytes[16]=32;bytes[17]=40;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const radius=Math.hypot((x+.5-size/2)/(size/2),(y+.5-size/2)/(size/2)),v=(y+.5)/size;
    const alpha=Math.round(255*(ribbon?(1-(x+.5)/size)**1.5*smooth(v/.15)*smooth((1-v)/.15):Math.max(0,1-radius)**2));
    const i=18+(y*size+x)*4;bytes[i]=bytes[i+1]=bytes[i+2]=255;bytes[i+3]=alpha;
  }
  return {name,bytes};
}
