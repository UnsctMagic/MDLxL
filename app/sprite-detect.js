import {detectSpriteGrid} from '../src/sprite-frames.js';
import {particlePictureCanvas} from './particle-picture-canvas.js';

/** A grid written in the file name, such as Clouds8x8 or Smoke_4x4. */
export function gridFromName(name){
 const match=String(name||'').match(/(\d{1,2})\s*x\s*(\d{1,2})(?!.*\d\s*x\s*\d)/i);
 if(!match)return null;
 const columns=Number(match[1]),rows=Number(match[2]);
 return rows>=1&&columns>=1&&rows*columns>1&&rows<=16&&columns<=16?{rows,columns}:null;
}

/** Looks at the picture (and its file name) to see whether it is a sprite sheet. */
export async function detectPictureGrid(asset,{name,replaceableId=0}={}){
 const named=gridFromName(name||asset?.name);if(named)return named;
 if(replaceableId||!asset)return {rows:1,columns:1};
 const source=await particlePictureCanvas(asset);
 const width=Math.min(512,source.width),height=Math.min(512,source.height),canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,0,0,width,height);
 return detectSpriteGrid(context.getImageData(0,0,width,height));
}
