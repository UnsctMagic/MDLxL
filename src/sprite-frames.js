import { gamePathKey } from './game-path.js';
import catalog from './sprite-sheet-frames.json' with {type:'json'};
/**
 * Sprite sheets: one picture holding several frames in a grid. Frames are only offered when the
 * picture really is one, and choosing frames is a single range that plays across the particle's life.
 */
const CANDIDATES=[1,2,3,4,5,6,8,10,16];

/** "Ink" of a pixel: visible brightness, so dark (additive) and transparent backgrounds both count as empty. */
function inkMap({width,height,data}){
 const ink=new Float32Array(width*height);
 for(let i=0;i<width*height;i++){const r=data[i*4],g=data[i*4+1],b=data[i*4+2],a=data[i*4+3];ink[i]=Math.max(r,g,b)/255*(a/255);}
 return ink;
}

/**
 * Finds the frame grid of a sprite sheet: cell borders are nearly empty and each cell has its own
 * picture in the middle. A single soft glow or star finds no grid (1 × 1).
 */
export function detectSpriteGrid(image){
 const {width,height}=image;if(!(width>=8&&height>=8))return {rows:1,columns:1};
 const ink=inkMap(image),at=(x,y)=>ink[Math.min(height-1,Math.max(0,y))*width+Math.min(width-1,Math.max(0,x))];
 let total=0;for(const v of ink)total+=v;const mean=total/ink.length;if(mean<1e-4)return {rows:1,columns:1};
 const line=(vertical,position)=>{let sum=0,count=0;for(let t=0;t<(vertical?height:width);t++)for(const d of [-1,0]){sum+=vertical?at(position+d,t):at(t,position+d);count++;}return sum/count;};
 // Largest split per axis whose every border line is nearly empty.
 const axis=(vertical,size)=>{let best=1;for(const n of CANDIDATES){if(n<2||size%n||size/n<4)continue;let ok=true;for(let k=1;k<n&&ok;k++)if(line(vertical,Math.round(k*size/n))>mean*.2)ok=false;if(ok)best=Math.max(best,n);}return best;};
 const columns=axis(true,width),rows=axis(false,height);
 if(rows*columns<2)return {rows:1,columns:1};
 // Every frame cell must hold a picture that is brighter inside than at its edges.
 const cw=width/columns,ch=height/rows;let filled=0;
 for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
  let inner=0,innerCount=0,edge=0,edgeCount=0;
  for(let y=Math.floor(r*ch);y<Math.floor((r+1)*ch);y++)for(let x=Math.floor(c*cw);x<Math.floor((c+1)*cw);x++){
   const u=(x-c*cw)/cw,v=(y-r*ch)/ch,value=at(x,y);
   if(u>.2&&u<.8&&v>.2&&v<.8){inner+=value;innerCount++;}else if(u<.08||u>.92||v<.08||v>.92){edge+=value;edgeCount++;}
  }
  if(inner/Math.max(1,innerCount)>Math.max(mean*.15,2*edge/Math.max(1,edgeCount)))filled++;
 }
 return filled>=Math.max(2,Math.ceil(rows*columns*.6))?{rows,columns}:{rows:1,columns:1};
}

/**
 * The chosen frames, first to last, read back from the emitter. A range stores its first frame and the
 * frame after its last one, as the Emitter Editor preview and the reference viewer play it.
 */
export function playedFrames(emitter){
 const count=Math.max(1,(emitter.Rows||1)*(emitter.Columns||1)),clamp=n=>Math.max(0,Math.min(count-1,n));
 const shown=range=>{const [a=0,b=0]=range||[];return b>a?[a,b-1]:[a,a];};
 const frames=[...shown(emitter.LifeSpanUVAnim),...shown(emitter.DecayUVAnim)];
 return {first:clamp(Math.min(...frames)),last:clamp(Math.max(...frames)),repeat:Math.max(1,emitter.LifeSpanUVAnim?.[2]||1)};
}

/**
 * Plays frames first..last once across the whole life: the frames up to the halfway point play
 * from Born to Halfway, the rest from Halfway to End. Streak frames follow the same frames.
 */
export function framesAcrossLife(emitter,first,last,repeat=1){
 const a=Math.min(first,last),b=Math.max(first,last),count=b-a+1,time=Math.min(1,Math.max(0,emitter.Time??.5));
 const split=count===1?1:Math.min(count-1,Math.max(1,Math.round(count*time)));
 const life=new Uint32Array([a,a+split,repeat]),decay=count===1?new Uint32Array([a,a+1,repeat]):new Uint32Array([a+split,b+1,repeat]);
 return {LifeSpanUVAnim:life,DecayUVAnim:decay,TailUVAnim:new Uint32Array(life),TailDecayUVAnim:new Uint32Array(decay)};
}

/** Switches a picture to a frame grid with every frame playing, or back to one plain picture. */
export function spriteGridValues(emitter,rows,columns){
 return {Rows:rows,Columns:columns,...framesAcrossLife(emitter,0,rows*columns-1,1)};
}

const fileName=name=>gamePathKey(name).split('\\').pop();
const byFile=new Map(Object.entries(catalog.sheets).map(([path,entry])=>[fileName(path),entry]));

/** How the game's own effects use this sprite sheet, most common first (empty for other pictures). */
export function suggestedSetups(picture){
 const entry=catalog.sheets[gamePathKey(picture)]||byFile.get(fileName(picture));
 if(!entry)return [];
 // Setups that only differ in streak frames look the same here; keep the most used one of each.
 const seen=new Map();
 for(const setup of entry.setups){const id=[setup.rows,setup.columns,...setup.life,...setup.decay].join(',');const known=seen.get(id);if(known){known.uses+=setup.uses;for(const example of setup.examples)if(known.examples.length<3&&!known.examples.includes(example))known.examples.push(example);}else seen.set(id,{...setup,examples:[...setup.examples]});}
 return [...seen.values()];
}

/** A game setup as the values it writes on the emitter. */
export function setupValues(setup){
 const values={Rows:setup.rows,Columns:setup.columns,LifeSpanUVAnim:new Uint32Array(setup.life),DecayUVAnim:new Uint32Array(setup.decay)};
 values.TailUVAnim=new Uint32Array(setup.tail||setup.life);values.TailDecayUVAnim=new Uint32Array(setup.tailDecay||setup.decay);
 return values;
}

/** A plain name for what a frame setup does on screen. */
export function patternName(setup){
 const total=setup.rows*setup.columns,[la,lb,lr=1]=setup.life,[da,db,dr=1]=setup.decay;
 const {first,last}=playedFrames({Rows:setup.rows,Columns:setup.columns,LifeSpanUVAnim:setup.life,DecayUVAnim:setup.decay});
 if(first===last)return 'Still frame';
 if(da>db)return 'Forward, then backward';
 if(Math.max(lr,dr)>=2)return Math.max(lr,dr)>=8?'Fast loop':'Looping';
 if(da<=la+1&&db>la+1)return 'Plays twice';
 if((last-first+1)/total>=.9)return 'Whole animation';
 if(last<total*.6)return 'First half';
 if(first>=total*.4)return 'Second half';
 return 'Part of the animation';
}

/** The game's patterns for this sheet as clear choices; look-alikes are merged, most used first. */
export function framePatterns(picture){
 const byName=new Map();
 for(const setup of suggestedSetups(picture)){const name=patternName(setup),known=byName.get(name);if(known)known.uses+=setup.uses;else byName.set(name,{name,uses:setup.uses,values:setupValues(setup)});}
 return [...byName.values()].sort((a,b)=>b.uses-a.uses);
}

/** Whether the emitter currently plays exactly these frame values. */
export function playsPattern(emitter,values){
 const same=(a,b)=>String(Array.from(a||[]).slice(0,3))===String(Array.from(b||[]).slice(0,3));
 return emitter.Rows===values.Rows&&emitter.Columns===values.Columns&&same(emitter.LifeSpanUVAnim,values.LifeSpanUVAnim)&&same(emitter.DecayUVAnim,values.DecayUVAnim);
}
