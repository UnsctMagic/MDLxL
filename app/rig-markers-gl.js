import { Color, Matrix4, Vector3 } from 'three';
import { visualOptions } from '../src/preferences.js';
import { NODE_SYMBOLS, NODE_SYMBOL_COLORS } from './node-marker-symbols.js';

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

export function boneHighlightColors(nodes, selectedIds) {
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point]));
  const boneIds = new Set(nodes.filter(point => point.overlayKind === 'bones').map(point => point.node.ObjectId));
  const selected = new Set((selectedIds || []).filter(id => boneIds.has(id)));
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

export function markerStyle(point, byId, preferences, highlightColors = new Map(), vanilla = false) {
  const visual = visualOptions(preferences), highlighted = highlightColors.get(point.node.ObjectId);
  const symbolKind = point.overlayKind === 'events' ? ({SPL:'blood',FPT:'foot',UBR:'uber'}[point.node.Name?.slice(0,3).toUpperCase()]) : point.overlayKind;
  if (!vanilla && NODE_SYMBOL_COLORS[symbolKind]) return { shape:NODE_SYMBOLS[symbolKind], color:highlighted || NODE_SYMBOL_COLORS[symbolKind] };
  if (point.overlayKind === 'attachments') {
    const hasParentBone = byId.get(point.node.Parent)?.overlayKind === 'bones';
    return { shape: TETRA, color: highlighted || (hasParentBone ? visual.node : '#6666e5') };
  }
  if (point.overlayKind === 'particles' || vanilla && point.overlayKind === 'ribbons') return { shape: vanilla?TETRA:preferences?.emitterMarker==='tetrahedron'?TETRA:preferences?.emitterMarker==='cube'?CUBE:PENTAGRAM, color: highlighted || visual.particle };
  if (point.overlayKind === 'bones') {
    const hasParentBone = byId.get(point.node.Parent)?.overlayKind === 'bones';
    return { shape: CUBE, color: highlighted || (hasParentBone ? '#4cff59' : '#4cb259') };
  }
  if (point.helperNode) return { shape: CUBE, color: highlighted || visual.bone };
  if (point.eventNode) return { shape: TETRA, color: highlighted || visual.event };
  return { shape: TETRA, color: highlighted || point.displayColor || visual.node };
}

export function rigMarkerVisible(point, options, highlights) {
  const kind = point.overlayKind || 'nodes';
  return !!options[kind] || kind === 'bones' && !!options.focusedBoneMarkers && !!highlights.get(point.node.ObjectId);
}

export function rigMarkerSize(point, shape, options = {}) {
  const size = visualOptions(options.preferences).helperSize * 1.5, screenSize = point.unitsPerPixel * size;
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
export function rigMarkerGeometry(nodes, selectedIds, options = {}) {
  const byId = new Map(nodes.map(point => [point.node.ObjectId, point])), highlights = options.boneHighlights || boneHighlightColors(nodes, selectedIds);
  const markers = [];
  let triangleCount = 0, edgeCount = 0, emphasizedCount = 0;
  for (const point of nodes) {
    if (!point.visible || !rigMarkerVisible(point, options, highlights)) continue;
    const { shape, color } = markerStyle(point, byId, options.preferences, highlights, options.vanilla), topology = markerTopology(shape);
    const emphasized = highlights.get(point.node.ObjectId) === '#000000';
    markers.push({ point, shape, color, topology, emphasized });
    triangleCount += topology.triangles.length; edgeCount += topology.edges.length; if (emphasized) emphasizedCount += topology.edges.length;
  }
  const triangles = new Float32Array(triangleCount * 6), edges = new Float32Array(edgeCount * 6), emphasizedEdges = new Float32Array(emphasizedCount * 6);
  const vertex = new Vector3(), side = new Vector3(), normal = new Vector3(), shade = new Color(), rgb = [0,0,0];
  let t = 0, e = 0, m = 0;
  const write = (target, at, positions, id, color) => { target[at] = positions[id*3]; target[at+1] = positions[id*3+1]; target[at+2] = positions[id*3+2]; target[at+3] = color[0]; target[at+4] = color[1]; target[at+5] = color[2]; return at + 6; };
  for (const { point, shape, color, topology, emphasized } of markers) {
    const baseColor = new Color(color), edgeRgb = baseColor.clone().convertLinearToSRGB().toArray();
    const markerSize = rigMarkerSize(point, shape, options), rotation = shape.billboard ? (point.billboardRotation || point.rotation) : point.rotation;
    const positions = new Float64Array(shape.vertices.length * 3);
    shape.vertices.forEach((value, id) => { vertex.set(value[0], value[1], value[2]).multiplyScalar(markerSize).applyQuaternion(rotation).add(point.world); positions[id*3] = vertex.x; positions[id*3+1] = vertex.y; positions[id*3+2] = vertex.z; });
    // Shade in linear RGB, then encode for the canvas. Multiplying encoded
    // green made the side faces far darker than the fixed-angle reference.
    const flat = shape.billboard || color === '#ff0000' || color === '#ffff00';
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
      for (const end = corner + topology.faceTriangles[index] * 3; corner < end; corner++) t = write(triangles, t, positions, topology.triangles[corner], rgb);
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
  return {
    draw(camera, nodes, selectedIds, options) {
      const { triangles, edges, emphasizedEdges } = rigMarkerGeometry(nodes, selectedIds, options);
      const viewport = gl.getParameter(gl.VIEWPORT);
      const thickEdges = thickMarkerEdges(emphasizedEdges, camera, viewport[2], viewport[3]);
      const drawParentEdges = () => { gl.disable(gl.CULL_FACE); gl.bufferData(gl.ARRAY_BUFFER,thickEdges,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,thickEdges.length/6); };
      gl.useProgram(program); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.uniformMatrix4fv(transform,false,new Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).elements);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW); gl.disable(gl.BLEND); gl.disable(gl.SAMPLE_ALPHA_TO_COVERAGE); gl.depthMask(false);
      if (options.wireframeMarkers) {
        gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.bufferData(gl.ARRAY_BUFFER,triangles,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,triangles.length/6);
        if (thickEdges.length) drawParentEdges();
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.bindVertexArray(null); return;
      }
      // Mesh depth splits even partially occluded markers at fragment precision.
      gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.bufferData(gl.ARRAY_BUFFER,triangles,gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES,0,triangles.length/6); gl.depthMask(false);
      if (options.occludedMarkerEdges) {
        gl.bufferData(gl.ARRAY_BUFFER,edges,gl.DYNAMIC_DRAW); gl.lineWidth(1);
        gl.depthFunc(gl.GREATER); gl.drawArrays(gl.LINES,0,edges.length/6);
      }
      if (thickEdges.length) { if (options.occludedMarkerEdges) gl.disable(gl.DEPTH_TEST); else gl.depthFunc(gl.LEQUAL); drawParentEdges(); gl.enable(gl.DEPTH_TEST); }
      gl.depthMask(true); gl.bindVertexArray(null);
    },
    dispose() { gl.deleteBuffer(buffer); gl.deleteVertexArray(vao); gl.deleteProgram(program); gl.deleteShader(vs); gl.deleteShader(fs); },
  };
}
