/**
 * Plain-language hover help for the MDL text of emitters. Short, one idea each, no code words.
 * Family-specific entries (ribbon:, particle:, old:, popcorn:) win over the shared ones.
 */
const shared={
 ObjectId:'This thing\'s ID number in the model. Leave it as it is: other parts point to it.',
 Parent:'The ID of the bone this follows. It moves, turns and scales with that bone.',
 static:'One fixed value for the whole model, not animated.',
 Visibility:'On/off. 1 = shows, 0 = hidden. Keys below say when it switches.',
 DontInterp:'Jumps straight to each key\'s value. No smooth change in between.',
 Linear:'Changes smoothly, at an even pace, from one key to the next.',
 Hermite:'Changes smoothly along a curve between keys. The InTan/OutTan lines shape the curve.',
 Bezier:'Changes smoothly along a curve between keys. The InTan/OutTan lines shape the curve.',
 InTan:'Curve handle coming into this key. Only matters for Hermite or Bezier.',
 OutTan:'Curve handle leaving this key. Only matters for Hermite or Bezier.',
 GlobalSeqId:'Uses a separate looping clock that runs in every animation, instead of the animation\'s own time.',
 Translation:'Moves it away from where it starts. Three numbers: X, Y, Z.',
 Rotation:'Turns it. Four numbers together describe one turn. Easiest to change with the tools, not by typing.',
 Scaling:'Makes it bigger or smaller. Three numbers: X, Y, Z. 1 = normal size.',
 Billboarded:'Always turns to face the camera.',
 BillboardedLockX:'Faces the camera, but only turns around the X axis.',
 BillboardedLockY:'Faces the camera, but only turns around the Y axis.',
 BillboardedLockZ:'Faces the camera, but only turns around the Z axis.',
 CameraAnchored:'Stays fixed to the camera.',
 DontInherit:'Ignores some of the parent bone\'s movement (listed inside).',
 EmissionRate:'How many are made per second.',
 LifeSpan:'How long each one lasts, in seconds.',
 Gravity:'Pulls them down while they live. 0 = no pull. Negative floats up.',
 Speed:'How fast they shoot out.',
 Alpha:'How see-through it is.',
 Color:'Tint color. Written Blue, Green, Red (backwards!). 1 = full, 0 = none.',
 ReplaceableId:'Uses a game picture instead of a file. 1 = team color, 2 = team glow.',
 Unshaded:'Ignores lighting: always full brightness.',
 Unfogged:'Not hidden by the game\'s fog.',
 SortPrimsFarZ:'Draws far pieces first, so see-through pieces overlap correctly.',
 Rows:'How many rows of small pictures the picture file is split into.',
 Columns:'How many columns of small pictures the picture file is split into.',
 MaterialID:'Which material (look) it uses, counted from 0 in the Materials list.',
 TextureID:'Which picture it uses, counted from 0 in the Textures list.',
 PriorityPlane:'Draw order against other effects. Higher draws on top.',
};
const ribbon={
 RibbonEmitter:'A ribbon: a glowing strip that trails behind its bone, like a sword swing.',
 HeightAbove:'How far the ribbon reaches up from its center along the weapon.',
 HeightBelow:'How far the ribbon reaches down from its center along the weapon.',
 Alpha:'How strongly the ribbon shows. 1 = full, 0 = invisible.',
 TextureSlot:'Which small picture to use when the picture is split into rows and columns. Usually 0.',
 EmissionRate:'Trail pieces made per second. More = a smoother curve in fast swings.',
 LifeSpan:'How long, in seconds, the trail stays behind before it fades. Longer = longer trail.',
 Gravity:'Pulls the trail down as it fades. 0 = it stays where the weapon was.',
};
const particle={
 ParticleEmitter2:'A particle emitter: shoots out many small pictures (sparks, smoke, glow).',
 Speed:'How fast particles shoot out.',
 Variation:'Randomness of the speed. 0 = all the same, 0.5 = up to half faster or slower.',
 Latitude:'Spread angle in degrees. 0 = a straight line, 180 = in every direction.',
 Width:'Width of the area particles start from.',
 Length:'Length of the area particles start from.',
 Gravity:'Pulls particles down. Negative numbers make them rise.',
 SegmentColor:'Particle color at birth, middle and end of life. Each line is Blue, Green, Red.',
 Alpha:'See-through amount at birth, middle and end of life. 0 = invisible, 255 = solid.',
 ParticleScaling:'Particle size at birth, middle and end of life.',
 Time:'When the "middle of life" is, from 0 (birth) to 1 (end).',
 LifeSpanUVAnim:'Which small pictures play during the first part of life: start, end, repeats.',
 DecayUVAnim:'Which small pictures play during the second part of life: start, end, repeats.',
 TailUVAnim:'Like LifeSpanUVAnim, but for the streak (tail) look.',
 TailDecayUVAnim:'Like DecayUVAnim, but for the streak (tail) look.',
 TailLength:'How long the streak is, compared to the particle\'s speed.',
 Squirt:'Burst mode: particles come out in one puff at each amount key, instead of a steady stream.',
 Head:'Draws each particle as a flat picture.',
 Tail:'Draws each particle as a streak along its movement.',
 Both:'Draws each particle as a picture plus a streak.',
 ModelSpace:'Particles move along with the model after they are made, instead of being left behind.',
 XYQuad:'Particles lie flat on the ground instead of facing the camera.',
 LineEmitter:'Particles start along a line instead of an area.',
 Blend:'Normal see-through look.',
 Additive:'Adds light: glowing, bright look. Black becomes invisible.',
 AddAlpha:'Glowing look that also respects the picture\'s see-through parts.',
 Modulate:'Darkens what is behind it.',
 Modulate2x:'Darkens or brightens what is behind it.',
 AlphaKey:'Hard cut-out edges: pixels are either solid or invisible.',
};
const old={
 ParticleEmitter:'An old-style emitter that shoots out small models.',
 EmitterUsesMDL:'The particles are small model files.',
 EmitterUsesTGA:'The particles are picture files.',
 Particle:'The settings for each particle.',
 Path:'The file used for each particle.',
 Longitude:'Spread angle around the up axis, in degrees.',
 Latitude:'Spread angle from straight up, in degrees.',
 InitVelocity:'Starting speed of each particle.',
};
const popcorn={
 ParticleEmitterPopcorn:'A Reforged-style emitter that plays a particle file.',
 Path:'The particle file it plays.',
 AnimVisibilityGuide:'Which animations show it, by name.',
 Alpha:'How see-through it is. 1 = solid, 0 = invisible.',
 Color:'Tint color. Written Blue, Green, Red. 1 = full, 0 = none.',
};
const byFamily={RibbonEmitters:ribbon,ParticleEmitters2:particle,ParticleEmitters:{...particle,...old},ParticleEmitterPopcorns:popcorn};

/** The explanation for one word in this emitter's text, or null. */
export function explainMdlWord(word,family){
 return byFamily[family]?.[word]??shared[word]??null;
}


/** Splits text into pieces with explanations, for the hover layer under the editor. */
export function mdlHoverPieces(text,family){
 const pieces=[];
 const words=rest=>{
  for(const part of rest.split(/([A-Za-z][A-Za-z0-9]*)/)){
   if(!part)continue;
   const tip=/^[A-Za-z]/.test(part)?explainMdlWord(part,family):null;
   pieces.push(tip?{text:part,tip}:{text:part});
  }
 };
 for(const [i,line]of text.split('\n').entries()){
  if(i)pieces.push({text:'\n'});
  let rest=line;
  const frame=line.match(/^(\s*)(-?\d+):/);
  if(frame){pieces.push({text:frame[1]},{text:frame[2]+':',tip:`At frame ${frame[2]} of the timeline, the value becomes what follows on this line.`});rest=line.slice(frame[0].length);}
  const count=!frame&&line.match(/^(\s*[A-Za-z]+\s+)(\d+)(\s*\{.*)$/);
  if(count){words(count[1]);pieces.push({text:count[2],tip:`${count[2]} key${count[2]==='1'?'':'s'} follow below, one per line: "frame: value".`});rest=count[3];}
  words(rest);
 }
 return pieces;
}
