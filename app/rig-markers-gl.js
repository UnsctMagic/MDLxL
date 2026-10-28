import { Color, Matrix4, Vector3 } from 'three';
import { visualOptions } from '../src/preferences.js';
import { NODE_SYMBOLS, NODE_SYMBOL_COLORS } from './node-marker-symbols.js';
import { boneDisplayColor, boneDisplayOptions, BONE_DIAMOND } from './bone-display.js';

const CUBE = { vertices: [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]], faces: [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]] };
const TETRA = { vertices: [[1,1,1],[-1,-1,1],[-1,1,-1],[1,-1,-1]], faces: [[0,2,1],[0,1,3],[0,3,2],[1,2,3]] };
// Thin filled strips remain legible with ANGLE's one-pixel GL line limit.
const PENTAGRAM = (() => {
  const vertices=[],faces=[],line=(a,b,thickness=.1)=>{
    const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),x=-dy/length*thickness/2,y=dx/length*thickness/2,id=vertices.length;
    vertices.push([a[0]+x,a[1]+y,0],[a[0]-x,a[1]-y,0],[b[0]-x,b[1]-y,0],[b[0]+x,b[1]+y,0]);faces.push([id,id+1,id+2,id+3]);
  };
  const point=(i,count,r=1)=>[Math.cos(Math.PI/2+i*Math.PI*2/count)*r,Math.sin(Math.PI/2+i*Math.PI*2/count)*r];
  for(let i=0;i<32;i++)line(point(i,32),point(i+1,32),.11);
  for(let i=0;i<5;i++)line(point(i,5,.87),point(i+2,5,.87),.09);
  return {vertices,faces,billboard:true};
})();
const MARKER_LIGHT = new Vector3(-.35, -.45, 1.2).normalize();
// Highlighted bones (Focused Skeleton, or a double-clicked chain) are long bone
// shapes from their pivot (the thick end) to their child, so turning shows.
// One light quarter shows which way the bone rolls.
const BONE_SHAPE = { vertices: Array.from({ length: 6 }, () => [0, 0, 0]), faces: [[1,2,3],[1,3,4],[1,4,5],[1,5,2],[0,3,2],[0,4,3],[0,5,4],[0,2,5]] };
const BONE_SHAPE_FIN = new Set([0, 4]);

/** Where each highlighted bone's shape ends: a highlighted child, else any child bone, else a stub. */
export function boneShapeTails(nodes, highlights) {
  const shaped = point => point.visible && (point.overlayKind === 'bones' || point.helperNode) && !!highlights.get(point.node.ObjectId);
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point])), children = new Map(), tails = new Map();
  for (const point of nodes) if (point.visible && (point.overlayKind === 'bones' || point.helperNode)) { const list = children.get(point.node.Parent) || []; list.push(point); children.set(point.node.Parent, list); }
  for (const point of nodes) {
    if (!shaped(point)) continue;
    const apart = (children.get(point.node.ObjectId) || []).filter(other => other.world.distanceTo(point.world) > 1e-4);
    const child = apart.find(shaped) || apart[0];
    if (child) { tails.set(point.node.ObjectId, { tail: child.world, childId: child.node.ObjectId }); continue; }
    const parent = byId.get(point.node.Parent);
    const direction = parent && parent.world.distanceTo(point.world) > 1e-4 ? point.world.clone().sub(parent.world) : new Vector3(1, 0, 0).applyQuaternion(point.rotation);
    tails.set(point.node.ObjectId, { tail: point.world.clone().add(direction.setLength(point.unitsPerPixel * 60)), childId: null });
  }
  return tails;
}

/** Head, tail and a square ring near the head that turns with the bone. */
export function boneShapePositions(point, tail, markerSize) {
  const direction = tail.clone().sub(point.world), length = direction.length(); direction.normalize();
  const width = Math.min(length * .25, Math.max(length * .1, markerSize));
  const side = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map(axis => axis.applyQuaternion(point.rotation))
    .reduce((best, axis) => Math.abs(axis.dot(direction)) < Math.abs(best.dot(direction)) ? axis : best);
  side.addScaledVector(direction, -side.dot(direction)).normalize();
  const up = direction.clone().cross(side), ring = point.world.clone().addScaledVector(direction, length * .2);
  return [point.world.clone(), tail.clone(), ring.clone().addScaledVector(side, width), ring.clone().addScaledVector(up, width), ring.clone().addScaledVector(side, -width), ring.clone().addScaledVector(up, -width)];
}

export function boneHighlightColors(nodes, selectedIds) {
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point]));
  const boneIds = new Set(nodes.filter(point => point.overlayKind === 'bones').map(point => point.node.ObjectId));
  const selectableIds = new Set(nodes.filter(point => point.overlayKind === 'bones' || point.overlayKind === 'attachments').map(point => point.node.ObjectId));
  const selected = new Set((selectedIds || []).filter(id => selectableIds.has(id)));
  if (!selected.size) return new Map();
  const parents = new Set(), children = new Set(), byParent = new Map();
  for (const point of nodes) {
    const list = byParent.get(point.node.Parent) || []; list.push(point.node.ObjectId); byParent.set(point.node.Parent, list);
  }
  for (const id of selected) {
    const parent = byId.get(byId.get(id)?.node.Parent); if (parent && boneIds.has(parent.node.ObjectId)) parents.add(parent.node.ObjectId);
    const pending = [...(byParent.get(id) || [])];
    while (pending.length) { const child = pending.pop(); if (children.has(child)) continue; children.add(child); pending.push(...(byParent.get(child) || [])); }
  }
  const colors = new Map();
  for (const point of nodes) {
    const id = point.node.ObjectId;
    if (selected.has(id)) colors.set(id, '#ff0000');
    else if (parents.has(id) && boneIds.has(id)) colors.set(id, '#000000');
    else if (children.has(id)) colors.set(id, '#ffff00');
    else if (boneIds.has(id)) colors.set(id, null);
  }
  return colors;
}

/** A double-clicked chain: every bone from the clicked spot up to the root. */
export function chainHighlightColors(nodes, chainIds, selectedIds) {
  const chain = new Set(chainIds), selected = new Set(selectedIds || []), colors = new Map();
  for (const point of nodes) if (point.overlayKind === 'bones') colors.set(point.node.ObjectId, !chain.has(point.node.ObjectId) ? null : selected.has(point.node.ObjectId) ? '#ff0000' : '#ffff00');
  return colors;
}

export function markerStyle(point, byId, preferences, highlightColors = new Map(), vanilla = false, visual = visualOptions(preferences)) {
  const highlighted = highlightColors.get(point.node.ObjectId);
  const symbolKind = point.overlayKind === 'events' ? ({SPL:'blood',FPT:'foot',UBR:'uber'}[point.node.Name?.slice(0,3).toUpperCase()]) : point.overlayKind;
  const bones = boneDisplayOptions(preferences);
  if (point.overlayKind === 'attachments') return { shape: vanilla ? TETRA : NODE_SYMBOLS.attachments, color: highlighted ? boneDisplayColor(bones, highlighted, false) : bones.ref };
  if (point.helperNode) return { shape: bones.style === 'diamond' ? BONE_DIAMOND : CUBE, color: highlighted ? boneDisplayColor(bones, highlighted, false) : bones.helper };
  if (!vanilla && NODE_SYMBOL_COLORS[symbolKind]) return { shape:NODE_SYMBOLS[symbolKind], color:highlighted || NODE_SYMBOL_COLORS[symbolKind] };
  if (point.overlayKind === 'particles' || vanilla && point.overlayKind === 'ribbons') return { shape: vanilla?TETRA:preferences?.emitterMarker==='tetrahedron'?TETRA:preferences?.emitterMarker==='cube'?CUBE:PENTAGRAM, color: highlighted || visual.particle };
  if (point.overlayKind === 'bones') {
    const hasParentBone = byId.get(point.node.Parent)?.overlayKind === 'bones';
    return { shape: bones.style === 'diamond' ? BONE_DIAMOND : CUBE, color: boneDisplayColor(bones, highlighted, hasParentBone) };
  }
  if (point.eventNode) return { shape: TETRA, color: highlighted || visual.event };
  return { shape: TETRA, color: highlighted || point.displayColor || visual.node };
}

export function rigMarkerVisible(point, options, highlights) {
  const kind = point.overlayKind || 'nodes';
  return (point.helperNode ? !!(options.helpers ?? options.bones) : !!options[kind]) || kind === 'bones' && !!options.focusedBoneMarkers && !!highlights.get(point.node.ObjectId);
}

export function rigMarkerSize(point, shape, options = {}, visual = visualOptions(options.preferences)) {
  const size = visual.helperSize * 1.5, screenSize = point.unitsPerPixel * size;
  if (!shape.billboard || options.vanilla) return screenSize;
  const modelSize = options.modelRadius == null ? screenSize * 1.5 : options.modelRadius * .035 * size / 9;
  // Keep circled symbols readable when zoomed out, with the existing close-up cap.
  return Math.max(screenSize * 1.1, Math.min(screenSize * 1.5, modelSize));
}

// A shape's triangles and unique edges never change, only where it is placed.
// The attachment hand alone has ~2,500 vertices, so rebuilding this every
// frame per marker made XL view stutter with a few attachments shown.
const shapeTopology = new WeakMap();
function markerTopology(shape) {
  let topology = shapeTopology.get(shape);
  if (topology) return topology;
  const triangles = [], faceTriangles = [], edges = [], seen = new Set();
  for (const face of shape.faces) {
    faceTriangles.push(face.length - 2);
    for (let i = 1; i + 1 < face.length; i++) triangles.push(face[0], face[i], face[i+1]);
    for (let i = 0; i < face.length; i++) {
      const a = face[i], b = face[(i+1)%face.length], key = a < b ? a * 65536 + b : b * 65536 + a;
      if (seen.has(key)) continue; seen.add(key); edges.push(a, b);
    }
  }
  topology = { triangles: Uint32Array.from(triangles), faceTriangles, edges: Uint32Array.from(edges) };
  shapeTopology.set(shape, topology);
  return topology;
}

/** Actual world-space polyhedra, shared by the editor and Warcraft GL contexts. */
export function rigMarkerGeometry(nodes, selectedIds, options = {}, visual = visualOptions(options.preferences), byId = new Map(nodes.map(point => [point.node.ObjectId, point]))) {
  const highlights = options.boneHighlights || boneHighlightColors(nodes, selectedIds);
  const markers = [];
  let triangleCount = 0, edgeCount = 0, emphasizedCount = 0;
  for (const point of nodes) {
    if (!point.visible || !rigMarkerVisible(point, options, highlights)) continue;
    const style = markerStyle(point, byId, options.preferences, highlights, options.vanilla, visual), tail = options.boneShapeTails?.get(point.node.ObjectId)?.tail;
    const shape = tail ? BONE_SHAPE : style.shape, color = style.color, topology = markerTopology(shape);
    const role = highlights.get(point.node.ObjectId), emphasized = role === '#000000';
    // Selected and child highlights stay flat (unshaded), whatever colour the user picked.
    markers.push({ point, shape, color, topology, emphasized, tail, flat: shape.billboard || role === '#ff0000' || role === '#ffff00' });
    triangleCount += topology.triangles.length; edgeCount += topology.edges.length; if (emphasized) emphasizedCount += topology.edges.length;
  }
  const triangles = new Float32Array(triangleCount * 6), edges = new Float32Array(edgeCount * 6), emphasizedEdges = new Float32Array(emphasizedCount * 6);
  const vertex = new Vector3(), side = new Vector3(), normal = new Vector3(), shade = new Color(), rgb = [0,0,0];
  let t = 0, e = 0, m = 0;
  const write = (target, at, positions, id, color) => { target[at] = positions[id*3]; target[at+1] = positions[id*3+1]; target[at+2] = positions[id*3+2]; target[at+3] = color[0]; target[at+4] = color[1]; target[at+5] = color[2]; return at + 6; };
  for (const { point, shape, color, topology, emphasized, flat, tail } of markers) {
    const baseColor = new Color(color), edgeRgb = baseColor.clone().convertLinearToSRGB().toArray();
    const markerSize = rigMarkerSize(point, shape, options, visual), rotation = shape.billboard ? (point.billboardRotation || point.rotation) : point.rotation;
    const positions = new Float64Array(shape.vertices.length * 3);
    if (tail) boneShapePositions(point, tail, markerSize).forEach((value, id) => value.toArray(positions, id * 3));
    else shape.vertices.forEach((value, id) => { vertex.set(value[0], value[1], value[2]).multiplyScalar(markerSize).applyQuaternion(rotation).add(point.world); positions[id*3] = vertex.x; positions[id*3+1] = vertex.y; positions[id*3+2] = vertex.z; });
    const finRgb = tail && new Color(baseColor.r * .299 + baseColor.g * .587 + baseColor.b * .114 > .35 ? '#2a2a2a' : '#ffffff').convertLinearToSRGB().toArray();
    // Shade in linear RGB, then encode for the canvas. Multiplying encoded
    // green made the side faces far darker than the fixed-angle reference.
    if (flat) shade.copy(baseColor).convertLinearToSRGB().toArray(rgb);
    let corner = 0;
    shape.faces.forEach((face, index) => {
      if (!flat) {
        // Face illumination stays in model space while the camera moves.
        const [a, b, c] = face;
        vertex.set(positions[b*3] - positions[a*3], positions[b*3+1] - positions[a*3+1], positions[b*3+2] - positions[a*3+2]);
        side.set(positions[c*3] - positions[a*3], positions[c*3+1] - positions[a*3+1], positions[c*3+2] - positions[a*3+2]);
        normal.copy(vertex).cross(side).normalize();
        shade.copy(baseColor).multiplyScalar(Math.min(1, .72 + .30 * Math.max(0, normal.dot(MARKER_LIGHT)))).convertLinearToSRGB().toArray(rgb);
      }
      const faceRgb = finRgb && BONE_SHAPE_FIN.has(index) ? finRgb : rgb;
      for (const end = corner + topology.faceTriangles[index] * 3; corner < end; corner++) t = write(triangles, t, positions, topology.triangles[corner], faceRgb);
    });
    for (const id of topology.edges) { e = write(edges, e, positions, id, edgeRgb); if (emphasized) m = write(emphasizedEdges, m, positions, id, edgeRgb); }
  }
  return { triangles, edges, emphasizedEdges };
}

// ANGLE commonly clamps GL line width to one pixel. Expand parent edges to
// screen-space quads so their doubled thickness is real on Windows.
export function thickMarkerEdges(edges, camera, width, height, pixels = 2) {
  const out = [];
  for (let i = 0; i < edges.length; i += 12) {
    const a = new Vector3().fromArray(edges, i).project(camera), b = new Vector3().fromArray(edges, i + 6).project(camera);
    if (Math.abs(a.z) > 1 || Math.abs(b.z) > 1) continue;
    const dx = (b.x - a.x) * width, dy = (b.y - a.y) * height, length = Math.hypot(dx, dy);
    if (length < .0001) continue;
    const ox = -dy / length * pixels / width, oy = dx / length * pixels / height;
    const corners = [a.clone().add(new Vector3(ox,oy,0)), a.clone().sub(new Vector3(ox,oy,0)), b.clone().add(new Vector3(ox,oy,0)), b.clone().sub(new Vector3(ox,oy,0))];
    const worldCorners = corners.map(corner => corner.unproject(camera).toArray());
    for (const index of [0,1,2,2,1,3]) out.push(...worldCorners[index], ...edges.slice(i+3,i+6));
  }
  return new Float32Array(out);
}

export function createRigMarkersGL(gl) {
  const compile = (type, source) => { const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader)); return shader; };
  const vs = compile(gl.VERTEX_SHADER, '#version 300 es\nin vec3 position; in vec3 color; uniform mat4 transform; out vec3 tint; void main(){gl_Position=transform*vec4(position,1.);tint=color;}');
  const fs = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; in vec3 tint; out vec4 result; void main(){result=vec4(tint,1.);}');
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  const buffer = gl.createBuffer(), vao = gl.createVertexArray(), transform = gl.getUniformLocation(program, 'transform');
  gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  for (const [name, offset] of [['position',0],['color',12]]) { const location = gl.getAttribLocation(program,name); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,3,gl.FLOAT,false,24,offset); }
  gl.bindVertexArray(null);
  // Flat symbols retain their exact topology on the GPU. Only their pose,
  // screen/model size and colour change; do not expand every hand icon into
  // megabytes of world-space triangle/edge arrays on every animation frame.
  const symbolVs = compile(gl.VERTEX_SHADER, `#version 300 es
    in vec3 position; uniform mat4 transform; uniform vec3 world;
    uniform vec4 rotation; uniform float size;
    void main(){
      vec3 p=position*size, t=2.*cross(rotation.xyz,p);
      p+=rotation.w*t+cross(rotation.xyz,t);
      gl_Position=transform*vec4(p+world,1.);
    }`);
  const symbolFs = compile(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; uniform vec3 tint; out vec4 result; void main(){result=vec4(tint,1.);}');
  const symbolProgram = gl.createProgram(); gl.attachShader(symbolProgram,symbolVs); gl.attachShader(symbolProgram,symbolFs); gl.linkProgram(symbolProgram);
  if (!gl.getProgramParameter(symbolProgram,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(symbolProgram));
  const symbolUniforms = Object.fromEntries(['transform','world','rotation','size','tint'].map(name => [name,gl.getUniformLocation(symbolProgram,name)]));
  const symbols = new Map();
  const symbolGeometry = shape => {
    let cached = symbols.get(shape);
    if (cached) return cached;
    const topology = markerTopology(shape), data = new Float32Array((topology.triangles.length + topology.edges.length) * 3);
    let offset = 0;
    for (const indices of [topology.triangles,topology.edges]) for (const id of indices) { data.set(shape.vertices[id],offset); offset += 3; }
    const buffer = gl.createBuffer(), vao = gl.createVertexArray();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const location = gl.getAttribLocation(symbolProgram,'position'); gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location,3,gl.FLOAT,false,12,0);
    cached = { buffer,vao,triangles:topology.triangles.length,edges:topology.edges.length }; symbols.set(shape,cached);
    return cached;
  };
  return {
    draw(camera, nodes, selectedIds, options) {
      const visual = visualOptions(options.preferences), byId = new Map(nodes.map(point => [point.node.ObjectId,point]));
      const highlights = options.boneHighlights || boneHighlightColors(nodes,selectedIds), ordinary = [], draws = [];
      let triangleOffset = 0, edgeOffset = 0;
      for (const point of nodes) {
        if (!point.visible || !rigMarkerVisible(point,options,highlights)) continue;
        const style = markerStyle(point,byId,options.preferences,highlights,options.vanilla,visual), color = style.color;
        const shape = options.boneShapeTails?.has(point.node.ObjectId) ? BONE_SHAPE : style.shape;
        // Emphasized parent edges retain the existing screen-space expansion.
        if (shape.billboard && highlights.get(point.node.ObjectId) !== '#000000') {
          draws.push({ symbol:symbolGeometry(shape), world:point.world.toArray(), rotation:(point.billboardRotation || point.rotation).toArray(),
            size:rigMarkerSize(point,shape,options,visual), tint:new Color(color).convertLinearToSRGB().toArray() });
        } else {
          ordinary.push(point);
          const topology = markerTopology(shape), previous = draws.at(-1);
          if (previous && !previous.symbol) { previous.triangles += topology.triangles.length; previous.edges += topology.edges.length; }
          else draws.push({ triangleOffset,edgeOffset,triangles:topology.triangles.length,edges:topology.edges.length });
          triangleOffset += topology.triangles.length; edgeOffset += topology.edges.length;
        }
      }
      const { triangles, edges, emphasizedEdges } = rigMarkerGeometry(ordinary,selectedIds,{ ...options,boneHighlights:highlights },visual,byId);
      const viewport = gl.getParameter(gl.VIEWPORT);
      const thickEdges = thickMarkerEdges(emphasizedEdges, camera, viewport[2], viewport[3]);
      const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements;
      const bindOrdinary = () => { gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.uniformMatrix4fv(transform,false,matrix); };
      const drawPass = mode => {
        bindOrdinary(); gl.bufferData(gl.ARRAY_BUFFER,mode === gl.TRIANGLES ? triangles : edges,gl.DYNAMIC_DRAW);
        // Keep node order and the original all-faces-then-hidden-edges passes,
        // including equal-depth overlaps between symbols and bone markers.
        for (const item of draws) {
          if (item.symbol) {
            gl.useProgram(symbolProgram); gl.bindVertexArray(item.symbol.vao);
            gl.uniformMatrix4fv(symbolUniforms.transform,false,matrix); gl.uniform3fv(symbolUniforms.world,item.world);
            gl.uniform4fv(symbolUniforms.rotation,item.rotation); gl.uniform1f(symbolUniforms.size,item.size); gl.uniform3fv(symbolUniforms.tint,item.tint);
            gl.drawArrays(mode,mode === gl.TRIANGLES ? 0 : item.symbol.triangles,mode === gl.TRIANGLES ? item.symbol.triangles : item.symbol.edges);
          } else { bindOrdinary(); gl.drawArrays(mode,mode === gl.TRIANGLES ? item.triangleOffset : item.edgeOffset,mode === gl.TRIANGLES ? item.triangles : item.edges); }
        }
      };
      const drawParentEdges = () => { bindOrdinary(); gl.disable(gl.CULL_FACE); gl.bufferData(gl.ARRAY_BUFFER,thickEdges,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,thickEdges.length/6); };
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.depthMask(false);
      if (options.wireframeMarkers) {
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); drawPass(gl.TRIANGLES);
        if (thickEdges.length) drawParentEdges();
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.bindVertexArray(null); return;
      }
      // Mesh depth splits even partially occluded markers at fragment precision.
      gl.depthFunc(gl.LEQUAL); gl.depthMask(true); drawPass(gl.TRIANGLES); gl.depthMask(false);
      if (options.occludedMarkerEdges) {
        gl.lineWidth(1); gl.depthFunc(gl.GREATER); drawPass(gl.LINES);
      }
      if (thickEdges.length) { if (options.occludedMarkerEdges) gl.disable(gl.DEPTH_TEST); else gl.depthFunc(gl.LEQUAL); drawParentEdges(); gl.enable(gl.DEPTH_TEST); }
      gl.depthMask(true); gl.bindVertexArray(null);
    },
    dispose() {
      for (const symbol of symbols.values()) { gl.deleteBuffer(symbol.buffer); gl.deleteVertexArray(symbol.vao); }
      symbols.clear(); gl.deleteProgram(symbolProgram); gl.deleteShader(symbolVs); gl.deleteShader(symbolFs);
      gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs);
    },
  };
}
