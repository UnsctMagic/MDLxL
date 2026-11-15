// Card layers: flat quads carrying one native texture, each on a bone the stack owns. DOM-free.
// Fields, their defaults and bounds live here so the layer builder, the compiler and saved looks agree.

// across: the card stands across the part, which passes through its middle (a ring around a blade).
// twirl: no flat card but strands wound around the part, turning about it (the count is the number of strands).
// ring: cards that face the camera, evenly spaced on a ring about the part, turning about it (floating runes).
export const CARD_FACINGS=['camera','ground','part','across','twirl','ring'];
/** Defaults of every optional Card field. size and offset are fitted to the part by makeLayer. */
export const CARD_DEFAULTS=Object.freeze({facing:'camera',count:1,sizeMin:.83,sizeMax:1.17,spin:0,spinEased:true,jitter:0,rows:1,columns:1,frameMs:0,cell:0,strength:1,filter:3,unshaded:true,unfogged:true,twoSided:true});
/** [min,max] of each numeric Card field. */
export const CARD_BOUNDS=Object.freeze({count:[1,8],sizeMin:[.05,4],sizeMax:[.05,4],spin:[-16,16],jitter:[0,180],rows:[1,16],columns:[1,16],frameMs:[0,5000],cell:[0,255],strength:[0,1],loop:[100,20000],size:[.1,100000],
 // tilt: degrees an Across card leans out of its plane (it then turns about the part). turns, band, flow: a Twirl's
 // turns around the part, strand width as a share of its radius, texture passes along the strand per loop.
 tilt:[0,85],turns:[.5,8],band:[.05,3],flow:[-8,8]});
// Each card of a layer runs on its own loop: base × these, so neighbours never pulse in step (study: 1000/1133/1200/1300).
export const CARD_CLOCK_FACTORS=[1,1.133,1.2,1.3,1.433,1.567,1.7,1.833];
// Jitter clocks: fast, never dividing each other (study: 100/133).
export const CARD_JITTER_MS=[100,133,117,151,109,141,123,157];
// One eased turn: the native star flare's uneven angles at even times.
export const EASED_TURN=[0,61.7,102.7,179.3,234.5,279.4,360];
export const LINEAR_TURN=[0,90,180,270,360];

const clamp=(v,[lo,hi])=>Math.max(lo,Math.min(hi,v));
/** A Card layer with every field present and inside its bounds. Unknown values fall back to the defaults. */
export function cardFields(l){
 const out={...CARD_DEFAULTS,...l};
 if(!CARD_FACINGS.includes(out.facing))out.facing=CARD_DEFAULTS.facing;
 for(const [key,range] of Object.entries(CARD_BOUNDS)){
  if(!(key in out)||out[key]==null)continue;
  const v=Number(out[key]);out[key]=Number.isFinite(v)?clamp(v,range):CARD_DEFAULTS[key];
 }
 for(const key of ['count','rows','columns','cell'])if(typeof out[key]==='number')out[key]=Math.round(out[key]);
 if(out.sizeMax<out.sizeMin)out.sizeMax=out.sizeMin;
 out.spinEased=out.spinEased!==false;
 for(const key of ['unshaded','unfogged','twoSided'])out[key]=out[key]!==false;
 return out;
}
/** A saved Card layer with only its own fields, each moved inside its bounds (a look file may come from anywhere). */
export function boundedCard(l){
 const out={...l};
 if('facing' in out&&!CARD_FACINGS.includes(out.facing))out.facing=CARD_DEFAULTS.facing;
 for(const [key,range] of Object.entries(CARD_BOUNDS))if(key in out){
  const v=out[key];out[key]=typeof v==='number'&&Number.isFinite(v)?clamp(v,range):CARD_DEFAULTS[key]??range[0];
  if(['count','rows','columns','cell'].includes(key))out[key]=Math.round(out[key]);
 }
 if(typeof out.sizeMin==='number'&&typeof out.sizeMax==='number'&&out.sizeMax<out.sizeMin)out.sizeMax=out.sizeMin;
 if(!CARD_FACINGS.includes(out.facing??'camera'))out.facing='camera';
 return out;
}
/** Builds a Card spec for a look or the Add layer menu. Only the given fields are stored; the rest use CARD_DEFAULTS and the part's fit. */
export function cardSpec(label,image,fields={}){
 return {type:'Card',label,image,...fields};
}
/** Half-width of a ground card: wide enough to show around the feet of the part's unit. */
export function groundCardSize(basis){
 return Math.max(cardSize(basis),basis.length*.45,basis.radius*1.6);
}
/** Default half-width of a card on a part (the radius the preview's size handle shows). */
export function cardSize(basis){
 return Math.max(basis.unit*1.2,Math.min(basis.length*.18,basis.girth*2.2));
}
// Fly swarm (native Flies.mdx technique): a Card-like set of quads, one per fly, each on its own billboarded bone
// riding a closed native path. Flies come in sets of five (the five native paths); each further set runs on its own
// clock, turned, phased, scaled and raised, so the swarm never visibly repeats (study of 5- and 30-fly swarms).
export const FLY_SETS=Object.freeze([
 {clock:1,yaw:0,phase:0,width:1,height:0},{clock:1.16,yaw:119,phase:.38,width:1,height:0},
 {clock:.89,yaw:-85,phase:.78,width:1,height:0},{clock:1.05,yaw:60,phase:.15,width:.8,height:.08},
 {clock:.95,yaw:-174,phase:.56,width:.85,height:-.05},{clock:1.11,yaw:-41,phase:.9,width:.75,height:.12},
]);
/** Width of each of the five flies of a set, as a share of Fly size. */
export const FLY_SIZES=Object.freeze([.77,1.12,.78,1.47,.87]);
/** Where each of the five paths is centred around the swarm, in native units for a swarm of radius 88. */
export const FLY_SCATTER=Object.freeze([[54.6,4.3,-1.1],[47.9,4.3,10.2],[-13.2,37,-19.6],[-33.4,-64.8,30.3],[-56,19.1,-19.8]]);
/** [min,max] of the fly swarm's own fields: flies, fly width, Speed (multiplies every clock). */
export const FLY_BOUNDS=Object.freeze({amount:[5,30],spriteSize:[2,60],speed:[.25,4]});
/** One fly clock: native 1233 ms at radius 88, longer for a wider swarm (constant fly speed grows with the root of the radius). */
export const flyClock=(radius,set,speed=1)=>Math.max(100,Math.round(1233*Math.sqrt(Math.max(1,radius)/88)*FLY_SETS[set%FLY_SETS.length].clock/Math.max(.05,speed)));
// How a fly quad lies on its billboarded bone and which part of its picture each corner shows, measured from the
// native swarms: corners as [x,y,z] shares of half the fly width around the pivot (a turned diamond, not a square),
// one [u,v] per corner, the quad's normal; triangles 0,1,2 and 3,2,1.
export const FLY_PICTURES=Object.freeze({
 // The fly area of Abomination.blp, as reference swarms map it (the default).
 abomination:{image:'Textures\\Abomination.blp',corners:[[.039,-1,-.143],[.247,-.117,-.87],[-.247,.13,.87],[-.039,1,.143]],uv:[[.566,.315],[.575,.367],[.636,.33],[.611,.376]],normal:[.96,0,.28]},
 // Native Flies.mdx: Doodads0 cell 151 (12 rows, 16 columns).
 doodads:{image:'Textures\\Doodads0.blp',corners:[[0,-1,-.167],[0,-.182,-1],[0,.182,1],[0,1,.167]],uv:[[.4375,.75],[.4375,.8333],[.5,.75],[.5,.8333]],normal:[1,0,0]},
});
/** A square, upright picture for a swarm that is not flies (an orb, a rune): one area [u0,v0,w,h] of the texture, or all of it. */
export function squarePicture(rect=[0,0,1,1]){
 const [u,v,w,h]=rect;
 return {corners:[[0,-1,-1],[0,1,-1],[0,-1,1],[0,1,1]],uv:[[u,v+h],[u+w,v+h],[u,v],[u+w,v]],normal:[1,0,0]};
}
/** The corner layout and picture area for a fly picture; another picture shows whole on the native diamond. */
export function flyPicture(image,override){
 const key=String(image||'').toLowerCase().replace(/\//g,'\\');
 const known=Object.values(FLY_PICTURES).find(p=>p.image.toLowerCase()===key);
 if(known&&!override)return known;
 return {...FLY_PICTURES.doodads,uv:[[0,0],[0,1],[1,0],[1,1]]};
}
