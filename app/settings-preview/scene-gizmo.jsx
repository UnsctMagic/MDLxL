/** 3D Rotate: a block turned by the app's own gesture code, with the handles the user drew. */
import React from 'react';
import { normalizeRotationPreferences, rotationBehavior } from '../../src/rotation-drag.js';
import { pointerSensitivityValue } from '../viewport-performance.js';
import { Arc, Arrow, AxisTriad, CursorPath, Ghost, Inputs, keyName, Readout, Ring, STROKE, toPoints } from './markers.jsx';
import { BLOCK_HALF as HALF, GIZMO_RADIUS, gizmoPresetTrack, gizmoScript, gizmoTrack, moveGizmoTrack, PIVOT, ringBasis, ringPoint, turnVector, viewBasis } from './tracks.js';

const AXIS = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const CORNERS = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x * HALF[0], y * HALF[1], z * HALF[2]])));
const FACES = [
  { corners: [4, 6, 7, 5], normal: [1, 0, 0], tint: true }, { corners: [0, 1, 3, 2], normal: [-1, 0, 0] },
  { corners: [2, 3, 7, 6], normal: [0, 1, 0] }, { corners: [0, 4, 5, 1], normal: [0, -1, 0] },
  { corners: [1, 5, 7, 3], normal: [0, 0, 1] }, { corners: [0, 2, 6, 4], normal: [0, 0, -1] },
];
const posed = (v, pose) => pose.reduce((point, step) => step.axis ? turnVector(point, AXIS[step.axis], step.degrees) : point, v);
const poseOf = frame => [...(frame.before ? [frame.before] : []), { axis: frame.axis, degrees: frame.degrees }];

/** The part being edited. One tinted end keeps its turn readable. */
export function Block({ ctx, basis, pose = [], scale = 1, ghost = false, offset = [0, 0] }) {
  const { look } = ctx, place = v => { const [x, y] = basis.project(v); return [x + offset[0], y + offset[1]]; };
  const points = CORNERS.map(v => posed(v.map(c => c * scale), pose));
  const faces = FACES.map(face => ({ ...face, normal: posed(face.normal, pose) })).filter(face => basis.depth(face.normal) > 1e-3);
  if (ghost) return <>{faces.map((face, i) => <Ghost key={i} ctx={ctx} points={face.corners.map(c => place(points[c]))} opacity={.5}/>)}</>;
  return <g strokeLinejoin="round">
    {faces.map((face, i) => <polygon key={i} points={toPoints(face.corners.map(c => place(points[c])))}
      fill={face.tint ? look.accent : look.ink} fillOpacity={face.tint ? .62 : .07 + .15 * (1 - Math.max(0, face.normal[2]))} stroke={look.ink} strokeWidth={STROKE.line}/>)}
  </g>;
}

function ringHalves(axis, basis, radius, start, end) {
  const near = [], far = [], count = 56;
  for (let i = 0; i <= count; i++) { const point = ringPoint(axis, start + (end - start) * i / count, radius); (basis.depth(point) >= 0 ? near : far).push(basis.project(point)); }
  return { near, far };
}

/** The rotate handles in the user's own style; `active` is the one being dragged. */
export function RotateHandles({ ctx, basis, style, active, lever, leverPose }) {
  const { look, u } = ctx, axes = ['X', 'Y', 'Z'].sort((a, b) => basis.depth(AXIS[a]) - basis.depth(AXIS[b]));
  return <g fill="none" strokeLinecap="round">
    {axes.map(axis => {
      const lit = axis === active, opacity = active && !lit ? .45 : 1;
      if (style === 'lines') {
        const tip = basis.project(posed(AXIS[axis].map(c => c * GIZMO_RADIUS), axis === lever ? leverPose : []));
        return <g key={axis} opacity={opacity}>
          {lit && <line x1={PIVOT[0]} y1={PIVOT[1]} x2={tip[0]} y2={tip[1]} stroke={look.casing} strokeWidth="4.6"/>}
          <line x1={PIVOT[0]} y1={PIVOT[1]} x2={tip[0]} y2={tip[1]} stroke={lit ? look.push : look.handles[axis]} strokeWidth={lit ? 2.3 : STROKE.strong}/>
          <circle cx={tip[0]} cy={tip[1]} r={6.5 * Math.min(1.2, u)} fill={lit ? look.push : look.handles[axis]} stroke={look.casing} strokeWidth={STROKE.hair}/>
          <text translate="no" x={tip[0]} y={tip[1] + 3} textAnchor="middle" className="settings-preview-axis" fill={lit ? look.casing : '#ffffff'}>{axis}</text>
        </g>;
      }
      const { near, far } = ringHalves(axis, basis, GIZMO_RADIUS, 0, style === 'arcs' ? 90 : 360);
      return <g key={axis} opacity={opacity}>
        {far.length > 1 && <polyline points={toPoints(far)} stroke={lit ? look.push : look.handles[axis]} strokeOpacity={lit ? .9 : .4} strokeWidth={STROKE.hair}/>}
        {lit && near.length > 1 && <polyline points={toPoints(near)} stroke={look.casing} strokeWidth="4.6"/>}
        {near.length > 1 && <polyline points={toPoints(near)} stroke={lit ? look.push : look.handles[axis]} strokeWidth={lit ? 2.3 : STROKE.strong}/>}
      </g>;
    })}
  </g>;
}

function Workplane({ ctx, basis, axis }) {
  const { look } = ctx, [a, b] = ['X', 'Y', 'Z'].filter(name => name !== axis), size = 52;
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([p, q]) => basis.project(AXIS[a].map((c, i) => c * p * size + AXIS[b][i] * q * size)));
  return <polygon points={toPoints(corners)} fill={look.ink} fillOpacity=".05" stroke={look.ink} strokeOpacity=".28" strokeWidth={STROKE.hair} strokeLinejoin="round"/>;
}

/** The dashed ellipse the turn runs on. */
function TurnRing({ ctx, basis, axis, radius, push = false }) {
  const { look } = ctx, points = [];
  for (let i = 0; i < 72; i++) points.push(basis.project(ringPoint(axis, i * 5, radius)));
  return <polygon points={toPoints(points)} fill="none" stroke={push ? look.push : look.ink} strokeOpacity={push ? 1 : .32} strokeWidth={push ? 1.5 : STROKE.hair}/>;
}

const onRing = (axis, basis) => (degrees, radius) => basis.project(ringPoint(axis, degrees, radius));
/** The angle on the ring under a screen position (the same solve the app's drag wedge uses, keeping its sign). */
function ringAngleUnder(axis, basis, [x, y]) {
  const [u, v] = ringBasis(axis), offset = world => { const [sx, sy] = basis.project(world); return [sx - PIVOT[0], sy - PIVOT[1]]; };
  const a = offset(u), b = offset(v), gx = x - PIVOT[0], gy = y - PIVOT[1], d = a[0] * b[1] - a[1] * b[0] || 1;
  return Math.atan2((a[0] * gy - a[1] * gx) / d, (gx * b[1] - gy * b[0]) / d) * 180 / Math.PI;
}

const live = frame => `${frame.axis || '–'} ${Math.round(frame.degrees)}°`;
function focusReadout(focus, how, frame, pointer) {
  switch (focus) {
    case 'sensitivity': case 'apply': case 'inherit': return `×${how.sensitivity.toFixed(2)}`;
    case 'precision': return `×${how.precision.toFixed(2)}`;
    case 'handleSpeed': return `×${(how.handleSensitivity ?? how.sensitivity).toFixed(2)}`;
    case 'zone': return `${how.centerZone}`;
    case 'leverPick': return `${how.leverPick} px`;
    case 'snap': return how.snap ? `${how.snap}°` : null;
    case 'shift': return how.shift === 'snap' ? '15°' : `×${how.precision.toFixed(2)}`;
    case 'dpi': return `DPI ×${how.useDPI ? pointer.toFixed(2) : '1.00'}`;
    default: return live(frame);
  }
}
const SECOND_READOUT = new Set(['sensitivity', 'apply', 'inherit', 'precision', 'handleSpeed', 'shift', 'dpi']);

function rotateDraw({ value, focus, track, at, ctx, view, fade }) {
  const { preferences, fineKey, snapKey, editor } = value, how = rotationBehavior(preferences, editor), { frames } = track, frame = frames[at];
  const part = track.parts ? (frame.part ? track.second : track.first) : track, partStart = frame.part ? track.parts[1] : 0;
  const basis = viewBasis(part.view), pose = poseOf(frame), trail = frames.slice(partStart).map(f => [f.x, f.y]);
  const axisNow = frame.axis || part.picked?.axis || null, big = focus === 'bigSelections' ? 2.2 : 1;
  const zoneRing = focus === 'zone' ? part.ringRadius : focus === 'bigSelections' ? part.ringRadius : focus === 'leverPick' ? part.leverPick : 0;
  const zoneAt = focus === 'leverPick' ? part.start : PIVOT, inZone = zoneRing > 0 && Math.hypot(frame.x - zoneAt[0], frame.y - zoneAt[1]) < zoneRing;
  const snapStep = focus === 'snap' && how.snap ? how.snap : focus === 'shift' && how.shift === 'snap' ? 15 : 0;
  // Swept rules show the angle; straight rules show the yellow push arrow.
  const showArc = axisNow && !part.inert && (!part.straight || snapStep > 0), arcAxis = axisNow || 'Z', arcRadius = part.lines ? GIZMO_RADIUS - 8 : 60;
  const arcFrom = (() => {
    if (!axisNow) return 0;
    if (part.lever) { const [u, v] = ringBasis(arcAxis), arm = AXIS[part.lever]; return Math.atan2(arm[0] * v[0] + arm[1] * v[1] + arm[2] * v[2], arm[0] * u[0] + arm[1] * u[1] + arm[2] * u[2]) * 180 / Math.PI; }
    return ringAngleUnder(arcAxis, basis, part.start);
  })();
  const keys = [];
  if (focus === 'precision' || focus === 'shift') keys.push({ label: fineKey, lit: frame.shift });
  if (focus === 'snap' && how.snap) keys.push({ label: snapKey, lit: frame.ctrl });
  const workplane = part.mode === 'workplane', straightLine = part.straight ? { from: part.start, to: [part.start[0] + part.direction[0] * part.travel, part.start[1] + part.direction[1] * part.travel] } : null;
  const double = workplane ? part.how.workplaneDrag === 'leftRight' : part.how.handleDrag === 'leftRight';
  const ghostPose = frame.reference !== undefined ? [...(frame.before ? [frame.before] : []), { axis: frame.axis, degrees: frame.reference }] : frame.before ? [frame.before] : [];
  return {
    stage: <>
      {workplane && <Workplane ctx={ctx} basis={basis} axis={axisNow || 'X'}/>}
      {part.ringRule && <TurnRing ctx={ctx} basis={basis} axis={axisNow} radius={GIZMO_RADIUS - 10} push/>}
      {showArc && <TurnRing ctx={ctx} basis={basis} axis={arcAxis} radius={arcRadius}/>}
      <Ring ctx={ctx} x={zoneAt[0]} y={zoneAt[1]} radius={zoneRing} lit={inZone}/>
      <Block ctx={ctx} basis={basis} pose={ghostPose} ghost scale={big}/>
      <Block ctx={ctx} basis={basis} pose={pose} scale={big}/>
      {part.mode === 'handle' && <RotateHandles ctx={ctx} basis={basis} style={part.drawn} active={part.lever || part.grabbed} lever={part.lever} leverPose={pose}/>}
      {showArc && <Arc ctx={ctx} at={onRing(arcAxis, basis)} radius={arcRadius} from={arcFrom} sweep={frame.degrees} tickStep={snapStep || 15} tickSpan={snapStep ? Math.max(Math.abs(frames.at(-1).degrees) + snapStep, 60) : 0}/>}
      {part.inert && <NothingHappens ctx={ctx}/>}
      {straightLine && <Arrow ctx={ctx} from={straightLine.from} to={straightLine.to} double={double} tone="push"/>}
      <CursorPath ctx={ctx} trail={trail} at={at - partStart} opacity={fade} showTrail={!part.straight}/>
    </>,
    hud: <>
      <Inputs view={view} button="left" keys={keys}/>
      <Readout x={view.right} y={view.top + 2} text={focusReadout(focus, how, frame, part.pointer)} lit={focus === 'dpi' && how.useDPI}/>
      {SECOND_READOUT.has(focus) && <Readout x={view.right} y={view.top + 22} text={live(frame)}/>}
      <AxisTriad ctx={ctx} x={view.left + 18} y={view.bottom - 18} project={basis.triad} active={axisNow}/>
    </>,
  };
}

/** Move gizmo: three axis arrows in the chosen weight; the pointer drags one. */
const MOVE_WEIGHT = { classic: { line: 1, head: 6, base: 3 }, today: { line: 2, head: 10, base: 4.5, casing: 3.5 }, bold: { line: 4, head: 14, base: 7, casing: 6 } };
function moveDraw({ value, track, at, ctx, view, fade }) {
  const { look, u } = ctx, frame = track.frames[at], basis = viewBasis(), weight = MOVE_WEIGHT[value.moveGizmo] || MOVE_WEIGHT.classic, trail = track.frames.map(f => [f.x, f.y]);
  const origin = [PIVOT[0] + frame.dx, PIVOT[1] + frame.dy], axes = ['X', 'Y', 'Z'].sort((a, b) => basis.depth(AXIS[a]) - basis.depth(AXIS[b]));
  return {
    stage: <>
      <Block ctx={ctx} basis={basis} ghost/>
      <Block ctx={ctx} basis={basis} offset={[frame.dx, frame.dy]}/>
      <g strokeLinecap="round" strokeLinejoin="round">
        {axes.map(axis => {
          const end = basis.project(AXIS[axis].map(c => c * 60)), tip = [end[0] + frame.dx, end[1] + frame.dy], dir = [tip[0] - origin[0], tip[1] - origin[1]], size = Math.hypot(...dir) || 1, ux = dir[0] / size, uy = dir[1] / size, lit = axis === 'X';
          const color = lit ? look.push : look.handles[axis], b = [tip[0] - ux * weight.head, tip[1] - uy * weight.head];
          return <g key={axis}>
            {weight.casing && <line x1={origin[0]} y1={origin[1]} x2={b[0]} y2={b[1]} stroke={look.casing} strokeWidth={weight.casing}/>}
            <line x1={origin[0]} y1={origin[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={weight.line}/>
            <polygon points={toPoints([tip, [b[0] - uy * weight.base, b[1] + ux * weight.base], [b[0] + uy * weight.base, b[1] - ux * weight.base]])} fill={color} stroke={weight.casing ? look.casing : 'none'} strokeWidth={STROKE.hair}/>
          </g>;
        })}
      </g>
      <CursorPath ctx={ctx} trail={trail} at={at} opacity={fade}/>
    </>,
    hud: <>
      <Inputs view={view} button="left"/>
      <AxisTriad ctx={ctx} x={view.left + 18} y={view.bottom - 18} project={basis.triad} active="X"/>
    </>,
  };
}

function withReference(preferences, script, editor) {
  const { reference, ...options } = script, track = gizmoTrack(preferences, { editor, ...options });
  if (!reference) return track;
  const other = gizmoTrack(preferences, { editor, ...options, changes: { ...options.changes, ...reference } });
  track.frames.forEach((frame, i) => { frame.reference = other.frames[i].degrees; });
  return track;
}

export const gizmoRotateScene = {
  label: '3D Rotate preview',
  duration: focus => focus === 'preset' ? 4000 : 3200,
  read: (preferences, entry, { editor = 'all' } = {}) => ({
    preferences: { rotation: normalizeRotationPreferences(preferences?.rotation), pointerSensitivity: pointerSensitivityValue(preferences?.pointerSensitivity), viewportAppearance: { controllers: { rotateHandles: preferences?.viewportAppearance?.controllers?.rotateHandles || 'lines' } } },
    moveGizmo: preferences?.viewportAppearance?.controllers?.moveGizmo || 'classic',
    editor, fineKey: keyName(preferences, 'drag.rotate.fine'), snapKey: keyName(preferences, 'drag.rotate.snap'),
  }),
  track({ preferences, editor }, focus) {
    if (focus === 'moveGizmo') return moveGizmoTrack();
    if (focus === 'preset') return gizmoPresetTrack(preferences, editor);
    return withReference(preferences, gizmoScript(focus, rotationBehavior(preferences, editor), preferences), editor);
  },
  draw: props => props.focus === 'moveGizmo' ? moveDraw(props) : rotateDraw(props),
};

function NothingHappens({ ctx }) {
  const { look, u } = ctx, c = 9 * u, [x, y] = PIVOT, d = `M${x - c} ${y - c}L${x + c} ${y + c}M${x + c} ${y - c}L${x - c} ${y + c}`;
  return <g strokeLinecap="round" fill="none"><path d={d} stroke={look.paper} strokeWidth="4.6"/><path d={d} stroke={look.ink} strokeWidth="2"/></g>;
}
