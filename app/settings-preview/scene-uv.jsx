/** UV Rotate and UV Zoom: a UV island on the texture grid, driven by uvTurn / uvZoom. */
import React from 'react';
import { normalizeUVDrag } from '../../src/uv-drag-settings.js';
import { uvTransformSensitivity } from '../../src/preferences.js';
import { Arc, Arrow, CursorPath, Ghost, Inputs, keyName, Readout, Ring, STROKE, toPoints } from './markers.jsx';
import { PIVOT, UV_PIECE, UV_PIECE_REACH, uvPresetTrack, uvRotateTrack, uvZoomTrack } from './tracks.js';

const DEG = 180 / Math.PI;
const piece = (turn, factor = 1, scale = 1) => { const c = Math.cos(turn), s = Math.sin(turn); return UV_PIECE.map(([x, y]) => [PIVOT[0] + (x * c - y * s) * factor * scale, PIVOT[1] + (x * s + y * c) * factor * scale]); };
const centreOf = (turn, factor, scale) => { const c = Math.cos(turn), s = Math.sin(turn), [x, y] = [2, -2]; return [PIVOT[0] + (x * c - y * s) * factor * scale, PIVOT[1] + (x * s + y * c) * factor * scale]; };

function UVGrid({ ctx }) {
  const { look } = ctx, lines = [];
  // Past the stage on purpose: the narrow-window strip shows more of it.
  for (let x = PIVOT[0] % 22 - 440; x <= 660; x += 22) lines.push(<line key={'x' + x} x1={x} x2={x} y1="-100" y2="265"/>);
  for (let y = PIVOT[1] % 22 - 88; y <= 253; y += 22) lines.push(<line key={'y' + y} y1={y} y2={y} x1="-440" x2="660"/>);
  return <g stroke={look.ink} strokeOpacity=".07" strokeWidth={STROKE.hair}>{lines}</g>;
}

function Island({ ctx, points, centre, noseLit = true }) {
  const { look } = ctx;
  return <g>
    <polygon points={toPoints(points)} fill={look.ink} fillOpacity=".14" stroke={look.ink} strokeWidth={STROKE.line} strokeLinejoin="round"/>
    <g stroke={look.ink} strokeOpacity=".28" strokeWidth={STROKE.hair}>{points.map((p, i) => <line key={i} x1={p[0].toFixed(1)} y1={p[1].toFixed(1)} x2={centre[0].toFixed(1)} y2={centre[1].toFixed(1)}/>)}</g>
    <g fill={look.ink}>{points.map((p, i) => <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r={1.6 * ctx.u}/>)}</g>
    {noseLit && <circle cx={points[3][0].toFixed(1)} cy={points[3][1].toFixed(1)} r={3 * ctx.u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.hair}/>}
  </g>;
}

function Centre({ ctx }) {
  const { look, u } = ctx, r = 3.5 * u, [x, y] = PIVOT;
  return <path d={`M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}`} stroke={look.ink} strokeWidth={STROKE.line} strokeLinecap="round"/>;
}

const unitsPerTick = (snap, focus) => focus === 'snap' && snap ? snap : 15;
const onCircle = () => (degrees, r) => [PIVOT[0] + r * Math.cos(degrees / DEG), PIVOT[1] + r * Math.sin(degrees / DEG)];

const turnReadout = (focus, settings, turnDegrees) => {
  if (focus === 'speed') return `${settings.rotateSpeed}%`;
  if (focus === 'zone') return `${settings.rotateZone} px`;
  if (focus === 'snap') return settings.rotateSnap ? `${settings.rotateSnap}°` : null;
  if (focus === 'bigPieces' || focus === 'reverse') return null;
  return `${Math.round(turnDegrees)}°`;
};

function trailOf(frames, from = 0) { return frames.slice(from).map(frame => [frame.x, frame.y]); }

export const uvRotateScene = {
  label: 'UV Rotate preview',
  duration: focus => focus === 'preset' ? 4000 : 3200,
  read: preferences => ({ settings: normalizeUVDrag(preferences?.uvDrag), uvSensitivity: uvTransformSensitivity(preferences), snapKey: keyName(preferences, 'drag.uv.snap') }),
  track: ({ settings, uvSensitivity }, focus) => focus === 'preset' ? uvPresetTrack(settings, uvSensitivity) : uvRotateTrack(settings, focus),
  draw({ value: { settings, snapKey }, focus, track, at, ctx, view, fade }) {
    const { frames } = track, frame = frames[at], { look } = ctx, preset = focus === 'preset';
    const turn = preset ? frame.turnNow : frame.applied, factor = preset ? frame.factorNow : 1, scale = track.scale ?? 1;
    const degrees = turn * DEG, partStart = preset && frame.part === 'zoom' ? track.parts[1] : 0;
    const leftRightPath = settings.rotateStyle === 'leftRight' || (focus === 'reverse' && settings.rotateStyle === 'circle');
    const start = frames[partStart], startAngle = leftRightPath || focus === 'zone' ? -90 : Math.atan2(start.y - PIVOT[1], start.x - PIVOT[0]) * DEG;
    const zone = focus === 'zone' ? settings.rotateZone : focus === 'bigPieces' ? (settings.rotateBigPieces ? track.reach : settings.rotateZone) : 0;
    const inZone = zone > 0 && Math.hypot(frame.x - PIVOT[0], frame.y - PIVOT[1]) < zone;
    const ghostTurn = focus === 'speed' ? frame.ghost : preset ? (frame.part === 'zoom' ? frame.turnNow : 0) : 0;
    const arcRadius = focus === 'zone' ? 66 : Math.min(56, UV_PIECE_REACH * scale * Math.max(factor, 1) + 10), turning = !preset || frame.part === 'turn';
    const showArc = turning && focus !== 'bigPieces';
    const snap = focus === 'snap' ? settings.rotateSnap : 0;
    const zoomKey = preset && frame.part === 'zoom' && settings.zoomStyle;
    return {
      stage: <>
        <UVGrid ctx={ctx}/>
        <Ring ctx={ctx} x={PIVOT[0]} y={PIVOT[1]} radius={zone} lit={inZone}/>
        <Ghost ctx={ctx} points={piece(ghostTurn, 1, scale)}/>
        {showArc && <Arc ctx={ctx} at={onCircle()} radius={arcRadius} from={startAngle} sweep={degrees} tickStep={snap || 15} tickSpan={snap ? Math.max(90, Math.abs(frames.at(-1).turn * DEG) + snap) : 0}/>}
        <Island ctx={ctx} points={piece(turn, factor, scale)} centre={centreOf(turn, factor, scale)}/>
        <Centre ctx={ctx}/>
        {leftRightPath && turning && <Arrow ctx={ctx} from={[PIVOT[0] - 76, 154]} to={[PIVOT[0] + 76, 154]} tone="push"/>}
        {zoomKey && <ZoomMarkers ctx={ctx} style={zoomKey}/>}
        <CursorPath ctx={ctx} trail={trailOf(frames, partStart)} at={at - partStart} opacity={fade}/>
      </>,
      hud: <>
        <Inputs view={view} button="left" keys={focus === 'snap' && settings.rotateSnap ? [{ label: snapKey, lit: frame.ctrl }] : []}/>
        <Readout x={view.right} y={view.top + 2} text={preset ? (frame.part === 'turn' ? `${Math.round(degrees)}°` : `${Math.round(factor * 100)}%`) : turnReadout(focus, settings, degrees)}/>
        {(focus === 'zone' || focus === 'speed' || focus === 'snap') && <Readout x={view.right} y={view.top + 22} text={`${Math.round(degrees)}°`}/>}
      </>,
    };
  },
};

function ZoomMarkers({ ctx, style, past = false }) {
  const [cx, cy] = PIVOT;
  if (style === 'upDown') return <><Arrow ctx={ctx} from={[192, cy + 44]} to={[192, cy - 50]} double/><Arrow ctx={ctx} from={[cx - 30, 154]} to={[cx + 30, 154]} double tone="ink" crossed opacity={.6}/></>;
  if (style === 'leftRight') return <><Arrow ctx={ctx} from={[cx - 62, 152]} to={[cx + 76, 152]} double/><Arrow ctx={ctx} from={[28, cy + 28]} to={[28, cy - 28]} double tone="ink" crossed opacity={.6}/></>;
  if (style === 'rightUp') return <Arrow ctx={ctx} from={[cx + 8, cy + 56]} to={[cx + 80, cy - 16]} double/>;
  const u = [.885, -.465];
  return <Arrow ctx={ctx} from={[cx + u[0] * (past ? 24 : 52), cy + u[1] * (past ? 24 : 52)]} to={[cx + u[0] * 86, cy + u[1] * 86]} double/>;
}

/** Everything has shrunk to one spot. */
function CollapseMarks({ ctx }) {
  const { look, u } = ctx, [x, y] = PIVOT, r = 16 * u, inner = 8 * u;
  return <g stroke={look.accent} strokeWidth={STROKE.strong} strokeLinecap="round" fill="none">
    <circle cx={x} cy={y} r={2.6 * u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.hair}/>
    {[17, 107, 197, 287].map(a => { const c = Math.cos(a / DEG), s = Math.sin(a / DEG); return <line key={a} x1={x + c * r} y1={y + s * r} x2={x + c * inner} y2={y + s * inner}/>; })}
  </g>;
}

export const uvZoomScene = {
  label: 'UV Zoom preview',
  duration: () => 3200,
  read: preferences => ({ settings: normalizeUVDrag(preferences?.uvDrag), uvSensitivity: uvTransformSensitivity(preferences), snapKey: keyName(preferences, 'drag.uv.snap') }),
  track: ({ settings, uvSensitivity }, focus) => uvZoomTrack(settings, focus, uvSensitivity),
  draw({ value: { settings, snapKey }, focus, track, at, ctx, view, fade }) {
    const { frames } = track, frame = frames[at], factor = frame.applied, collapsed = factor < .02;
    const ghostFactor = focus === 'speed' ? frame.ghost : 1, snap = focus === 'snap' ? settings.zoomSnap : 0;
    const lastZoom = frames.reduce((most, f) => Math.max(most, f.factor), 1);
    return {
      stage: <>
        <UVGrid ctx={ctx}/>
        <Ghost ctx={ctx} points={piece(0, ghostFactor)}/>
        {snap > 0 && <SizeRuler ctx={ctx} snap={snap} factor={factor} max={lastZoom}/>}
        {!collapsed && <Island ctx={ctx} points={piece(0, factor)} centre={centreOf(0, factor, 1)}/>}
        {collapsed ? <CollapseMarks ctx={ctx}/> : <Centre ctx={ctx}/>}
        {!snap && <ZoomMarkers ctx={ctx} style={settings.zoomStyle} past={settings.zoomStyle === 'centre' && collapsed}/>}
        <CursorPath ctx={ctx} trail={trailOf(frames)} at={at} opacity={fade}/>
      </>,
      hud: <>
        <Inputs view={view} button="left" keys={snap ? [{ label: snapKey, lit: frame.ctrl }] : []}/>
        <Readout x={view.right} y={view.top + 2} text={focus === 'speed' ? `${settings.zoomSpeed}%` : focus === 'snap' && snap ? `${snap}%` : `${Math.round(factor * 100)}%`}/>
      </>,
    };
  },
};

/** The steps a snapped size can land on, along the bottom edge. */
function SizeRuler({ ctx, snap, factor, max }) {
  const { look, u } = ctx, left = 30, right = 190, y = 152, top = Math.max(1.5, max), at = value => left + (right - left) * Math.min(value, top) / top, ticks = [];
  for (let value = 0; value <= top + 1e-6; value += snap / 100) ticks.push(value);
  return <g stroke={look.ink} strokeLinecap="round">
    <line x1={left} x2={right} y1={y} y2={y} strokeOpacity=".45" strokeWidth={STROKE.line}/>
    {ticks.map(value => <line key={value} x1={at(value)} x2={at(value)} y1={y - 3.5 * u} y2={y + 3.5 * u} strokeOpacity={Math.abs(value % 1) < 1e-6 ? .9 : .5} strokeWidth={STROKE.line}/>)}
    <circle cx={at(factor)} cy={y} r={3.2 * u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.hair}/>
  </g>;
}
