import { Path, ShapeUtils, Vector2 } from 'three';

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

// Selected icon artwork uses a 100-unit drawing with a 46-unit circle radius.
const markerPoints = curve => curve.getPoints(8).map(({x,y}) => [(x-50)/46,(50-y)/46]);
const dropOutline = () => new Path().moveTo(50,18)
  .bezierCurveTo(44,30,30,44,30,57).bezierCurveTo(30,72,39,81,50,81)
  .bezierCurveTo(61,81,70,72,70,57).bezierCurveTo(70,44,56,30,50,18);

export const NODE_SYMBOLS = {
  attachments: symbol((path,line) => {
    // Closed fist points left; the wrist and forearm extend to the right.
    path([[-.73,.43],[-.54,.51],[-.2,.51],[.02,.27],[.76,.27],[.76,-.27],[.03,-.27],[-.13,-.46],[-.39,-.46],[-.53,-.32],[-.71,-.32],[-.79,-.2],[-.79,.28],[-.73,.43]],.13);
    path([[-.23,.15],[-.43,.08],[-.51,-.08],[-.43,-.23],[-.18,-.27]],.12);
    line([-.77,.22],[-.54,.22],.11);
    line([-.79,-.02],[-.6,-.02],.11);
  }),
  ribbons: symbol((path,line,fill,dot) => {
    const curl = markerPoints(new Path().moveTo(27,24)
      .quadraticCurveTo(64,9,71,31).quadraticCurveTo(78,53,43,55)
      .quadraticCurveTo(24,54,31,40).quadraticCurveTo(39,26,64,44)
      .quadraticCurveTo(86,61,54,71).quadraticCurveTo(31,78,35,86));
    path(curl,9/46);
    for (const [x,y] of curl) dot(x,y,4.5/46);
    for (const [a,b] of [[[28,22],[21,31]],[[35,85],[46,77]]]) {
      const points=[a,b].map(([x,y])=>[(x-50)/46,(50-y)/46]);
      path(points,6/46);for(const [x,y] of points)dot(x,y,3/46);
    }
  }),
  sounds: symbol((path,line,fill) => {
    fill([[21,40],[34,40],[51,25],[51,75],[34,60],[21,60]].map(([x,y])=>[(x-50)/46,(50-y)/46]));
    path(markerPoints(new Path().moveTo(62,39).quadraticCurveTo(77,50,62,61)),4.8/46);
    path(markerPoints(new Path().moveTo(72,29).quadraticCurveTo(95,50,72,71)),4.8/46);
  }),
  blood: symbol((path,line,fill) => {
    fill(markerPoints(dropOutline()));
  }),
  foot: symbol((path,line,fill,dot) => {
    fill(markerPoints(new Path().moveTo(48,39).bezierCurveTo(38,37,29,44,31,54)
      .lineTo(39,67).bezierCurveTo(34,75,37,84,47,84)
      .bezierCurveTo(57,84,61,77,57,68).lineTo(65,51)
      .bezierCurveTo(69,42,57,36,48,39)));
    for(const [x,y,r] of [[30,31,8],[45,24,6],[57,27,5],[67,33,4],[74,42,3.5]])dot((x-50)/46,(50-y)/46,r/46);
  }),
  uber: symbol((path,line,fill) => {
    for(const [offsetX,offsetY,scale] of [[-4,1,.89],[47,27,.49]])
      fill(dropOutline().getPoints(8).map(({x,y})=>[(offsetX+x*scale-50)/46,(50-offsetY-y*scale)/46]));
  }),
};

export const NODE_SYMBOL_COLORS = { attachments:'#ff39cf', ribbons:'#20c9ff', sounds:'#ffe52b', blood:'#ff174d', foot:'#23ffb1', uber:'#ff39b8' };
