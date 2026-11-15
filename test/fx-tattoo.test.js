import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {TATTOO_DESIGNS,tattooTriangles,tattooPieces} from '../src/fx-tattoo.js';

const EPS=1e-6;
const signedArea=t=>((t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]))/2;
const designArea=design=>tattooTriangles(design).reduce((sum,t)=>sum+signedArea(t),0);
const pieceArea=piece=>Math.abs(signedArea(piece.points));

// A flat square skin of side 4 in the plane z=0 (two triangles), facing +z, and a roof folded along its diagonal.
const FLAT={positions:[-2,-2,0, 2,-2,0, 2,2,0, -2,2,0],faces:[0,1,2, 0,2,3]};
const ROOF={positions:[-2,-2,0, 2,-2,0, 2,2,.6, -2,2,0],faces:[0,1,2, 0,2,3]};
const anchor=new Vector3(0,0,0),normal=new Vector3(0,0,1),up=new Vector3(0,1,0);

test('Every design lies inside the square -1..1 with counter-clockwise triangles of real area',()=>{
 assert.ok(TATTOO_DESIGNS.length>=6,'the designs of the library exist');
 for(const design of TATTOO_DESIGNS){
  const triangles=tattooTriangles(design);
  assert.ok(triangles.length>0,design+': has triangles');
  for(const [i,t] of triangles.entries()){
   for(const [x,y] of t)assert.ok(Math.abs(x)<=1+EPS&&Math.abs(y)<=1+EPS,design+' triangle '+i+': corner ('+x+', '+y+') is outside the square');
   assert.ok(signedArea(t)>0,design+' triangle '+i+': not counter-clockwise or no area ('+signedArea(t)+')');
  }
  assert.ok(designArea(design)>.05,design+': total area '+designArea(design)+' is too small to see');
 }
});

test('Every piece lies on the skin triangle it names: weights are inside it and sum to one',()=>{
 for(const [name,skin] of [['flat',FLAT],['roof',ROOF]])for(const design of TATTOO_DESIGNS){
  const pieces=tattooPieces(skin.positions,skin.faces,anchor,normal,up,1,design);
  assert.ok(pieces.length>0,name+' '+design+': the design lands on the skin');
  for(const piece of pieces){
   assert.ok(piece.face>=0&&piece.face<skin.faces.length&&piece.face%3===0,name+' '+design+': face '+piece.face+' is not a triangle of the skin');
   assert.equal(piece.weights.length,3);
   for(const w of piece.weights){
    assert.equal(w.length,3);
    for(const v of w)assert.ok(v>=-EPS&&v<=1+EPS,name+' '+design+': weight '+v+' is outside the skin triangle');
    assert.ok(Math.abs(w[0]+w[1]+w[2]-1)<EPS,name+' '+design+': weights sum to '+(w[0]+w[1]+w[2]));
   }
   assert.ok(pieceArea(piece)>0,name+' '+design+': a piece without area');
  }
 }
});

test('A skin facing away from the design gets no pieces',()=>{
 for(const design of TATTOO_DESIGNS){
  const away=tattooPieces(FLAT.positions,FLAT.faces,anchor,normal.clone().negate(),up,1,design);
  assert.equal(away.length,0,design+': pieces on skin that faces away from the normal');
  // The same skin wound the other way round faces away from +z.
  const flipped=tattooPieces(FLAT.positions,[0,2,1, 0,3,2],anchor,normal,up,1,design);
  assert.equal(flipped.length,0,design+': pieces on a triangle wound the other way');
 }
});

// The corner of a piece in the model's space, from its weights in the skin triangle it names.
const corner=(skin,piece,k)=>{
 const out=new Vector3(),at=new Vector3();
 piece.weights[k].forEach((w,j)=>out.addScaledVector(at.fromArray(skin.positions,skin.faces[piece.face+j]*3),w));
 return out;
};
const area3=(skin,piece)=>{
 const a=corner(skin,piece,0),b=corner(skin,piece,1),c=corner(skin,piece,2);
 return b.sub(a).cross(c.sub(a)).length()/2;
};

test('On a flat skin larger than the design the pieces add up to the own area of the design times size squared',()=>{
 for(const design of TATTOO_DESIGNS)for(const size of [1,.5]){
  const total=tattooPieces(FLAT.positions,FLAT.faces,anchor,normal,up,size,design).reduce((sum,piece)=>sum+area3(FLAT,piece),0);
  const wanted=designArea(design)*size*size;
  assert.ok(Math.abs(total-wanted)<wanted*.02,design+' size '+size+': pieces cover '+total+' of the skin, the design is '+wanted);
 }
});
