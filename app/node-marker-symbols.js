import { ShapeUtils, Vector2 } from 'three';

// Flat, camera-facing symbols use filled strips so Windows' one-pixel GL line
// limit does not erase the details. Every symbol has the same circular frame.
function symbol(draw) {
  const vertices = [], faces = [];
  const line = (a, b, width = .08) => {
    const length = Math.hypot(b[0]-a[0], b[1]-a[1]);
    if (!length) return;
    const x = -(b[1]-a[1])/length*width/2, y = (b[0]-a[0])/length*width/2, id = vertices.length;
    vertices.push([a[0]+x,a[1]+y,0],[a[0]-x,a[1]-y,0],[b[0]-x,b[1]-y,0],[b[0]+x,b[1]+y,0]);
    faces.push([id,id+1,id+2,id+3]);
  };
  const path = (points, width) => { for (let i=1;i<points.length;i++) line(points[i-1],points[i],width); };
  const fill = points => { const id=vertices.length; vertices.push(...points.map(([x,y])=>[x,y,0])); for(const triangle of ShapeUtils.triangulateShape(points.map(([x,y])=>new Vector2(x,y)),[]))faces.push(triangle.map(i=>id+i)); };
  const dot = (x,y,r) => fill(Array.from({length:16},(_,i)=>[x+Math.cos(i*Math.PI/8)*r,y+Math.sin(i*Math.PI/8)*r]));
  for (let i=0;i<40;i++) line([Math.cos(i*Math.PI/20),Math.sin(i*Math.PI/20)],[Math.cos((i+1)*Math.PI/20),Math.sin((i+1)*Math.PI/20)],.1);
  draw(path, line, fill, dot);
  return { vertices, faces, billboard:true };
}

export const NODE_SYMBOLS = {
  attachments: symbol((path,line) => {
    // Closed fist points left; the wrist and forearm extend to the right.
    path([[-.73,.43],[-.54,.51],[-.2,.51],[.02,.27],[.76,.27],[.76,-.27],[.03,-.27],[-.13,-.46],[-.39,-.46],[-.53,-.32],[-.71,-.32],[-.79,-.2],[-.79,.28],[-.73,.43]],.13);
    path([[-.23,.15],[-.43,.08],[-.51,-.08],[-.43,-.23],[-.18,-.27]],.12);
    line([-.77,.22],[-.54,.22],.11);
    line([-.79,-.02],[-.6,-.02],.11);
  }),
  ribbons: symbol((path,line,fill) => {
    // A gift bow: two broad loops, a knot and two hanging ribbon tails.
    path([[-.12,.08],[-.62,.12],[-.72,.42],[-.56,.66],[-.3,.61],[-.12,.08]],.13);
    path([[.12,.08],[.3,.61],[.56,.66],[.72,.42],[.62,.12],[.12,.08]],.13);
    fill([[-.14,-.03],[-.57,-.64],[-.22,-.55],[-.04,-.72],[.02,-.03]]);
    fill([[.02,-.03],[.12,-.7],[.32,-.53],[.62,-.59],[.16,-.03]]);
    fill([[-.16,-.12],[.16,-.12],[.16,.18],[-.16,.18]]);
  }),
  sounds: symbol((path,line,fill) => {
    fill([[-.68,-.23],[-.38,-.23],[-.38,.23],[-.68,.23]]);
    fill([[-.4,-.23],[.03,-.6],[.03,.6],[-.4,.23]]);
    path([[.24,-.28],[.37,-.14],[.41,0],[.37,.14],[.24,.28]],.12);
    path([[.45,-.51],[.64,-.26],[.71,0],[.64,.26],[.45,.51]],.12);
  }),
  blood: symbol((path,line,fill) => {
    fill([[0,.77],[-.48,.06],[-.5,-.25],[-.35,-.52],[0,-.67],[.35,-.52],[.5,-.25],[.48,.06]]);
  }),
  foot: symbol((path,line,fill,dot) => {
    fill([[-.18,-.73],[.1,-.74],[.23,-.59],[.17,-.3],[.3,-.03],[.31,.25],[.08,.37],[-.2,.27],[-.3,.03],[-.21,-.3],[-.31,-.55]]);
    dot(-.28,.56,.17); dot(.04,.65,.13); dot(.29,.57,.11); dot(.49,.43,.09);
  }),
  uber: symbol((path,line,fill) => {
    for(const x of [-.35,.35])fill([[x,.64],[x-.24,.08],[x-.25,-.25],[x-.16,-.5],[x,-.59],[x+.16,-.5],[x+.25,-.25],[x+.24,.08]]);
  }),
};

export const NODE_SYMBOL_COLORS = { attachments:'#ff39cf', ribbons:'#20c9ff', sounds:'#ffe52b', blood:'#ff174d', foot:'#23ffb1', uber:'#ff39b8' };
