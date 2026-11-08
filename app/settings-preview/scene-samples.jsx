/** Appearance scenes: small samples drawn in the user's own colours and sizes. */
import React from 'react';
import { GRAPHICS_PRESETS, GRID_PRESETS } from '../../src/preferences.js';
import { CAPTURE_QUALITIES } from '../../src/capture-settings.js';
import { controllerShapePoints } from '../../src/controller-appearance.js';
import { backgroundImageRect } from '../../src/viewport-appearance.js';
import { FOLDER_COLORS, NODE_COLORS } from '../../src/tree-appearance.js';
import { wireDashArray } from '../../src/wire-pattern.js';
import { gestureAt } from './clock.js';
import { luminance, mix } from './palette.js';
import { Readout, STROKE, toPoints } from './markers.jsx';
import { PIVOT, viewBasis } from './tracks.js';

const hashId = text => { let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return 'sp' + (h >>> 0).toString(36); };

/* ---- Render settings: one lit ball, drawn pixel by pixel ------------------ */

const toByte = value => Math.max(0, Math.min(255, Math.round(value)));
/** One block of the ball. Light from upper left; a band pattern stands in for the texture. */
function shade(nx, ny, graphics) {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), lit = graphics.lighting ? Math.max(.12, -.42 * nx - .52 * ny + .74 * nz) : .72;
  const band = graphics.textures ? (Math.sin((nx + ny * .4) * 11) > 0 ? 1 : .62) : .86, base = graphics.textures ? [205, 140, 72] : [176, 178, 184];
  const specular = graphics.lighting ? Math.max(0, -.3 * nx - .4 * ny + .87 * nz) ** 22 * 95 : 0;
  return `rgb(${base.map(c => toByte(c * band * lit + specular)).join(',')})`;
}
/** Right half at `after`, left half at `before`: a split on the same ball. */
function SplitBall({ ctx, before, after }) {
  const { look } = ctx, radius = 52, [cx, cy] = [PIVOT[0], PIVOT[1] + 4], cells = [];
  const drawHalf = (graphics, side) => {
    const size = 4 / graphics.pixelRatio;
    for (let y = -radius; y < radius; y += size) for (let x = side < 0 ? -radius : 0; side < 0 ? x < 0 : x < radius; x += size) {
      const mx = x + size / 2, my = y + size / 2, d = Math.hypot(mx, my), edge = radius - d;
      if (edge <= (graphics.antialias ? -size * .7 : 0)) continue;
      cells.push(<rect key={`${side}${x}${y}`} x={cx + x} y={cy + y} width={size + .35} height={size + .35} fill={shade(mx / radius * Math.min(1, radius / d), my / radius * Math.min(1, radius / d), graphics)} fillOpacity={graphics.antialias ? Math.min(1, edge / (size * 1.4) + .5) : 1}/>);
    }
  };
  drawHalf(before, -1); drawHalf(after, 1);
  return <g shapeRendering="crispEdges">{cells}</g>;
}
const SPARKS = [[-44, -60], [-20, -68], [10, -64], [38, -58], [-58, -36], [58, -30], [-32, -74], [26, -74]];
function Divider({ ctx, activeRight }) {
  const { look, u } = ctx, x = PIVOT[0], side = activeRight ? 1 : -1;
  return <g>
    <line x1={x} x2={x} y1="14" y2="151" stroke={look.ink} strokeWidth={STROKE.line} strokeDasharray="4 4"/>
    <path d={`M${x + side * 30 - 5 * u} ${156 - 5 * u}L${x + side * 30} ${156 - 11 * u}L${x + side * 30 + 5 * u} ${156 - 5 * u}`} fill="none" stroke={look.accent} strokeWidth={STROKE.strong} strokeLinecap="round" strokeLinejoin="round"/>
  </g>;
}

function BandStrip({ x, width, y, height, bands }) {
  const cells = [], from = '#3f6fd1', to = '#f2c14e';
  for (let i = 0; i < bands; i++) cells.push(<rect key={i} x={x + width * i / bands} y={y} width={width / bands + .4} height={height} fill={mix(from, to, i / Math.max(1, bands - 1))}/>);
  return <g shapeRendering="crispEdges">{cells}</g>;
}

const QUALITY_BANDS = { low: 7, medium: 18, high: 44 };

export const compareScene = {
  label: 'Quality comparison preview',
  duration: focus => focus === 'fps' || focus === 'captureFps' ? 3200 : null,
  read: (preferences, entry) => ({ graphics: preferences?.graphics || {}, capture: preferences?.capture || {}, preset: entry.options?.preset || null }),
  draw({ value, focus, phase, ctx, view }) {
    const { look, u } = ctx, graphics = value.graphics, full = { pixelRatio: graphics.pixelRatio ?? 1.5, antialias: !!graphics.antialias, textures: graphics.textures !== false, lighting: graphics.lighting !== false, particles: graphics.particles !== false };
    if (focus === 'fps' || focus === 'captureFps') {
      const fps = focus === 'fps' ? Number(graphics.maxFps ?? 60) : Number(value.capture.fps ?? 30), width = 172, left = 24, y = 92, count = Math.max(1, Math.round(fps * 0.4)), ticks = [];
      for (let i = 0; i <= count; i++) ticks.push(<line key={i} x1={left + width * i / count} x2={left + width * i / count} y1={y - 8} y2={y + 8} stroke={look.ink} strokeOpacity={count > 34 ? .3 : .55} strokeWidth={STROKE.hair}/>);
      const t = gestureAt(phase), at = phase >= 1 ? count : Math.floor(t * count + 1e-6), x = left + width * at / count;
      return { stage: <>
        <g strokeLinecap="round"><line x1={left} x2={left + width} y1={y} y2={y} stroke={look.ink} strokeOpacity=".35" strokeWidth={STROKE.line}/>{ticks}</g>
        <circle cx={x} cy={y} r={7 * Math.min(1.25, u)} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.line}/>
      </>, hud: <Readout x={view.right} y={view.top + 2} text={`${fps} fps`}/> };
    }
    if (focus === 'recordingQuality' || focus === 'screenshotQuality') {
      const key = focus === 'recordingQuality' ? 'recordingQuality' : 'screenshotQuality', quality = value.capture[key] || 'medium', info = CAPTURE_QUALITIES[quality], left = 34, width = 152;
      const size = focus === 'recordingQuality' ? info.gifSize : info.screenshotSize, text = focus === 'recordingQuality' ? `${size} px ${info.colors}` : `${size} px`;
      return { stage: <>
        <BandStrip ctx={ctx} x={left} width={width} y={44} height={34} bands={QUALITY_BANDS.low}/>
        <BandStrip ctx={ctx} x={left} width={width} y={90} height={34} bands={QUALITY_BANDS[quality]}/>
      </>, hud: <Readout x={view.right} y={view.top + 2} text={text}/> };
    }
    if (focus === 'pauseHidden') {
      const paused = graphics.pauseWhenHidden !== false, x = 110 + (paused ? 0 : 44 * Math.sin(phase * Math.PI * 2));
      return { stage: <>
        <rect x="36" y="46" width="148" height="74" rx="4" fill={look.ink} fillOpacity=".06" stroke={look.ink} strokeOpacity=".4" strokeWidth={STROKE.line} strokeDasharray="4 3"/>
        <circle cx={x} cy="83" r="12" fill={look.accent}/>
        {paused && <g fill={look.paper}><rect x="104" y="76" width="4" height="14"/><rect x="112" y="76" width="4" height="14"/></g>}
      </>, hud: null };
    }
    const preset = value.preset ? GRAPHICS_PRESETS[value.preset] : null;
    if (preset) return { stage: <><SplitBall ctx={ctx} before={full} after={{ ...preset }}/>{preset.particles && <Sparks ctx={ctx} side={1}/>}{full.particles && <Sparks ctx={ctx} side={-1}/>}<Divider ctx={ctx} activeRight/></>, hud: <Readout x={view.right} y={view.top + 2} text={`${preset.pixelRatio}× ${preset.maxFps}`}/> };
    const SWITCHES = { antialias: true, textures: true, lighting: true, particles: true };
    if (SWITCHES[focus]) {
      const on = { ...full, [focus]: true }, off = { ...full, [focus]: false };
      return { stage: <><SplitBall ctx={ctx} before={off} after={on}/>{focus === 'particles' && <Sparks ctx={ctx} side={1}/>}<Divider ctx={ctx} activeRight={!!full[focus]}/></>, hud: null };
    }
    return { stage: <><SplitBall ctx={ctx} before={{ ...full, pixelRatio: 1 }} after={full}/><Divider ctx={ctx} activeRight/></>, hud: <Readout x={view.right} y={view.top + 2} text={`${full.pixelRatio}×`}/> };
  },
};

function Sparks({ ctx, side }) {
  const { look, u } = ctx;
  return <g>{SPARKS.filter(([x]) => x * side > 0).map(([x, y], i) => <circle key={i} cx={PIVOT[0] + x} cy={PIVOT[1] + 4 + y * .95} r={(2 + i % 2) * u} fill="#ffb347" stroke="#c9601e" strokeWidth={STROKE.hair}/>)}</g>;
}

/* ---- Lit sphere and platform --------------------------------------------- */

export const litSampleScene = {
  label: 'Lighting preview',
  read: preferences => ({ lighting: preferences?.lighting || {}, platform: preferences?.platform || {} }),
  draw({ value, focus, ctx, view }) {
    const { look } = ctx, { lighting, platform } = value, ambient = lighting.ambient || [128, 128, 128], diffuse = lighting.diffuse || [192, 192, 192], specular = lighting.specular || [0, 0, 0], power = Number(lighting.power) || 1;
    const cx = PIVOT[0], cy = PIVOT[1] - 8, radius = 44, id = hashId(JSON.stringify(lighting)), light = [-.42, -.52, .74], stops = [];
    for (let i = 0; i <= 10; i++) {
      const angle = i / 10 * Math.PI * .92, nl = Math.max(0, Math.cos(angle)), spec = nl > 0 ? nl ** power : 0;
      stops.push(<stop key={i} offset={i / 10} stopColor={`rgb(${[0, 1, 2].map(c => toByte(ambient[c] * .6 + diffuse[c] * nl + specular[c] * spec)).join(',')})`}/>);
    }
    const size = Math.min(1, .55 + Number(platform.size ?? 1.5) * .22), height = Math.max(-14, Math.min(14, Number(platform.height) || 0)), py = PIVOT[1] + 54 - height;
    const shapes = { square: 4, hexagon: 6, disc: 40 }, sides = shapes[platform.shape] ?? 4, rx = 92 * size, ry = 24 * size, ring = [];
    for (let i = 0; i < sides; i++) { const a = (i + (sides === 6 ? .5 : 0)) / sides * Math.PI * 2; ring.push([cx + Math.cos(a) * rx, py + Math.sin(a) * ry]); }
    return { stage: <>
      {(platform.enabled || focus === 'platform') && <polygon points={toPoints(ring)} fill={platform.color || '#303030'} fillOpacity={platform.enabled ? 1 : .22} stroke={look.ink} strokeOpacity=".45" strokeWidth={STROKE.line} strokeLinejoin="round"/>}
      <ellipse cx={cx} cy={py} rx={radius * .75} ry={radius * .17} fill="#000000" fillOpacity=".22"/>
      <defs><radialGradient id={id} cx={.5 + light[0] * .5} cy={.5 + light[1] * .5} r=".98">{stops}</radialGradient></defs>
      <circle cx={cx} cy={cy} r={radius} fill={`url(#${id})`} stroke={look.ink} strokeOpacity=".4" strokeWidth={STROKE.hair}/>
    </>, hud: focus === 'power' ? <Readout x={view.right} y={view.top + 2} text={`${power}`}/> : null };
  },
};

/* ---- Viewport sample: wires, vertices, background ------------------------ */

const CUBE = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z => [x, y, z])));
const EDGES = [[0, 1], [0, 2], [0, 4], [3, 1], [3, 2], [3, 7], [5, 1], [5, 4], [5, 7], [6, 2], [6, 4], [6, 7]];

/** Convex outline of a point set. */
function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]), turn = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const walk = list => { const out = []; for (const p of list) { while (out.length > 1 && turn(out.at(-2), out.at(-1), p) <= 0) out.pop(); out.push(p); } out.pop(); return out; };
  return [...walk(sorted), ...walk([...sorted].reverse())];
}

function Cube({ ctx, basis, half, center = [0, 0], wire, hiddenLine, occluded = 1, fill, markers, markerBack = false }) {
  const points = CUBE.map(v => { const [x, y] = basis.project(v.map(c => c * half)); return { at: [x + center[0], y + center[1]], depth: basis.depth(v) }; });
  const back = edge => edge.some(i => points[i].depth === Math.min(...points.map(p => p.depth)));
  const dash = wireDashArray(wire).join(' ') || undefined;
  return <g fill="none" strokeLinecap={wire.style === 'dotted' ? 'round' : 'butt'} strokeLinejoin="round">
    {fill && <polygon points={toPoints(hull(points.map(p => p.at)))} fill={fill} fillOpacity=".55" stroke="none"/>}
    {EDGES.map(([a, b], i) => { const behind = back([a, b]); return <line key={i} x1={points[a].at[0]} y1={points[a].at[1]} x2={points[b].at[0]} y2={points[b].at[1]} stroke={wire.color} strokeWidth={wire.thickness} strokeOpacity={wire.opacity * (behind ? occluded * (hiddenLine ? .5 : 1) : 1)} strokeDasharray={hiddenLine && behind ? '2 3' : dash}/>; })}
    {markers && points.map((p, i) => (markerBack || p.depth > Math.min(...points.map(q => q.depth))) && <Marker key={i} marker={markers} x={p.at[0]} y={p.at[1]}/>)}
  </g>;
}

function Marker({ marker, x, y }) {
  const half = marker.size / 2;
  if (marker.style === 'circle') return <circle cx={x} cy={y} r={half} fill={marker.color} stroke="none"/>;
  if (marker.style === 'diamond') return <polygon points={`${x},${y - half} ${x + half},${y} ${x},${y + half} ${x - half},${y}`} fill={marker.color} stroke="none"/>;
  return <rect x={x - half} y={y - half} width={marker.size} height={marker.size} fill={marker.color} stroke="none"/>;
}

function SampleImage({ ctx, id, rect, opacity }) {
  return <g opacity={opacity}>
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6d9dd6"/><stop offset=".62" stopColor="#c8ddef"/><stop offset=".62" stopColor="#6e8c5a"/><stop offset="1" stopColor="#47603d"/></linearGradient></defs>
    <rect x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={`url(#${id})`} stroke="#ffffff" strokeOpacity=".8" strokeWidth={STROKE.hair}/>
    <polygon points={toPoints([[rect.x + rect.width * .18, rect.y + rect.height * .62], [rect.x + rect.width * .42, rect.y + rect.height * .24], [rect.x + rect.width * .66, rect.y + rect.height * .62]])} fill="#54667a"/>
  </g>;
}

export const viewportSampleScene = {
  label: 'Viewport appearance preview',
  read: preferences => ({ appearance: preferences?.viewportAppearance, wireMode: preferences?.viewportAppearance?.wireMode, xray: !!preferences?.viewportAppearance?.xrayVertices, occluded: preferences?.visuals?.occludedOpacity ?? 1, paint: preferences?.citadelPaint || preferences?.viewportAppearance?.citadelPaint || {} }),
  draw({ value, focus, ctx, view }) {
    const { look, u } = ctx, { appearance } = value, basis = viewBasis(), selected = appearance.selectedGeoset, other = appearance.otherGeoset, highlight = appearance.geosetHighlight || {};
    const hud = null;
    if (focus === 'background') {
      const bg = appearance.background, showImage = bg.type === 'image';
      const rect = backgroundImageRect(150, 100, 220, 165, bg.display || 'fit');
      return { stage: <>
        {showImage && <SampleImage ctx={ctx} id={hashId('bg' + bg.display)} rect={rect} opacity={bg.opacity ?? .7}/>}
        <Cube ctx={ctx} basis={basis} half={30} wire={selected}/>
      </>, hud: showImage ? <Readout x={view.right} y={view.top + 2} text={`${Math.round((bg.opacity ?? .7) * 100)}%`}/> : hud };
    }
    if (focus === 'quadImage') {
      const bg = appearance.quadView?.background || {}, rect = backgroundImageRect(150, 100, 220, 165, bg.display || 'fit');
      return { stage: <><rect width="220" height="165" fill={bg.color || look.stage}/><SampleImage ctx={ctx} id={hashId('qv' + bg.display)} rect={rect} opacity={bg.opacity ?? .7}/></>, hud };
    }
    if (focus === 'highlight') {
      const type = highlight.type || 'wire-vertices', wire = { color: highlight.color || '#39ff14', thickness: 1.5, opacity: 1, style: 'solid' }, marker = type === 'wire-vertices' ? { color: highlight.color || '#39ff14', size: 5 } : null;
      return { stage: <>
        <Cube ctx={ctx} basis={basis} half={22} center={[-40, 6]} wire={other}/>
        <Cube ctx={ctx} basis={basis} half={22} center={[40, 6]} wire={wire} fill={type === 'fill' ? highlight.color : null} markers={marker}/>
      </>, hud };
    }
    if (focus === 'vertices') {
      const sel = appearance.selectedVertex, unsel = appearance.unselectedVertex;
      return { stage: <>
        <Cube ctx={ctx} basis={basis} half={22} center={[-40, 6]} wire={other} markers={unsel} markerBack={value.xray}/>
        <Cube ctx={ctx} basis={basis} half={22} center={[40, 6]} wire={selected} markers={sel} markerBack={value.xray}/>
      </>, hud };
    }
    if (focus === 'hidden') {
      return { stage: <Cube ctx={ctx} basis={basis} half={34} wire={selected} hiddenLine={value.wireMode === 'hidden-line'} occluded={value.occluded}/>, hud };
    }
    if (focus === 'citadel') {
      const paint = value.paint, x = PIVOT[0] + 34, y = PIVOT[1] + 10;
      return { stage: <>
        <Cube ctx={ctx} basis={basis} half={32} center={[-14, 4]} wire={{ color: paint.geosetBorder || '#35d9ff', thickness: paint.borderThickness || 2, opacity: 1, style: 'solid' }} fill={paint.geosetSelection}/>
        <circle cx={x} cy={y} r="18" fill="none" stroke={paint.brushCursor || '#ffffff'} strokeWidth={STROKE.strong}/>
        <circle cx={x} cy={y} r="4" fill={luminance(look.stage) > .3 ? paint.brushTipLight || '#242424' : paint.brushTipDark || '#f1eee7'}/>
        <circle cx={PIVOT[0] - 66} cy={PIVOT[1] - 44} r="7" fill={paint.lampSelection || '#ffc34b'} stroke="#16191e" strokeWidth={STROKE.hair}/>
      </>, hud };
    }
    return { stage: <>
      <Cube ctx={ctx} basis={basis} half={24} center={[-42, 6]} wire={other} markers={appearance.unselectedVertex}/>
      <Cube ctx={ctx} basis={basis} half={24} center={[42, 6]} wire={selected} markers={appearance.selectedVertex}/>
    </>, hud };
  },
};

/* ---- Rig: bones, influence, controllers, helper markers ------------------ */

const JOINTS = [[30, 118], [88, 66], [150, 92], [196, 40]];
function boneLink(a, b, width, shape, fill, outline) {
  if (shape === 'shaded' || shape === 'stick') return <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={fill} strokeWidth={shape === 'stick' ? width * 2 : width}/>;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length, half = (shape === 'cone' ? Math.max(10, width * 3.4) : width * 1.7) / 2;
  return <polygon points={toPoints([[a[0] + nx * half, a[1] + ny * half], [b[0] + nx * .5, b[1] + ny * .5], [b[0] - nx * .5, b[1] - ny * .5], [a[0] - nx * half, a[1] - ny * half]])} fill={fill} stroke={shape === 'cone' ? outline : 'none'} strokeWidth=".8"/>;
}
function ShapeAt({ shape, x, y, radius, stroke, fill, strokeWidth = 2 }) {
  const points = controllerShapePoints(shape, radius);
  return points ? <polygon points={toPoints(points.map(([px, py]) => [x + px, y + py]))} stroke={stroke} fill={fill} strokeWidth={strokeWidth} strokeLinejoin="round"/> : <circle cx={x} cy={y} r={radius} stroke={stroke} fill={fill} strokeWidth={strokeWidth}/>;
}

export const rigSampleScene = {
  label: 'Skeleton and handles preview',
  read: preferences => ({ appearance: preferences?.viewportAppearance, visuals: preferences?.visuals, emitter: preferences?.emitterMarker || 'pentagram' }),
  draw({ value, focus, ctx, view }) {
    const { look, u } = ctx, { appearance, visuals } = value;
    if (focus === 'bones') {
      const bones = appearance.bones, id = hashId('bone' + JSON.stringify(bones)), fills = [bones.root, bones.parent, bones.selected, bones.child], outline = '#000000';
      const shaded = bones.connector === 'shaded' || bones.connector === 'tapered' || bones.connector === 'cone' ? `url(#${id})` : bones.bone;
      return { stage: <>
        <defs><linearGradient id={id} gradientUnits="userSpaceOnUse" x1={JOINTS[0][0]} y1={JOINTS[0][1]} x2={JOINTS[1][0]} y2={JOINTS[1][1]}><stop offset="0" stopColor="#000000"/><stop offset="1" stopColor="#ffffff"/></linearGradient></defs>
        {boneLink(JOINTS[0], JOINTS[1], bones.thickness, bones.connector, shaded, outline)}
        {boneLink(JOINTS[1], JOINTS[2], bones.highlightThickness, bones.connector, bones.selected, outline)}
        {boneLink(JOINTS[2], JOINTS[3], bones.highlightThickness, bones.connector, bones.child, outline)}
        {JOINTS.map(([x, y], i) => bones.style === 'diamond' ? <polygon key={i} points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`} fill={fills[i]} stroke="#111111" strokeWidth=".7"/> : <rect key={i} x={x - 6} y={y - 6} width="12" height="12" fill={fills[i]} stroke="#111111" strokeWidth=".7"/>)}
      </>, hud: null };
    }
    if (focus === 'influence') {
      const inf = appearance.boneInfluence, block = (x, w, fill, opacity = 1) => <rect x={x} y="60" width={w} height="46" fill={fill} fillOpacity={opacity} stroke={look.ink} strokeOpacity=".45" strokeWidth={STROKE.hair}/>;
      return { stage: <>
        {block(26, 56, inf.ghost, inf.opacity)}{block(82, 56, inf.direct)}{block(138, 56, inf.follow)}
        <line x1="82" x2="166" y1="83" y2="83" stroke={look.ink} strokeWidth={STROKE.strong} strokeLinecap="round"/>
        <rect x="76" y="77" width="12" height="12" fill={appearance.bones.selected} stroke="#111111" strokeWidth=".7"/><rect x="160" y="77" width="12" height="12" fill={appearance.bones.child} stroke="#111111" strokeWidth=".7"/>
      </>, hud: <Readout x={view.right} y={view.top + 2} text={`${Math.round(inf.opacity * 100)}%`}/> };
    }
    if (focus === 'controllers') {
      const c = appearance.controllers, r = c.size, spots = [[52, 66, 'shape', c.color], [110, 66, 'bodyShape', c.selected], [168, 66, 'bendShape', c.color]], pinW = c.pinStyle === 'label' ? 54 : 30;
      return { stage: <>
        <rect x="8" y="24" width="204" height="84" rx="3" fill={c.background} stroke="none"/>
        <line x1="52" x2="168" y1="66" y2="66" stroke={c.skeleton} strokeWidth="2"/>
        {spots.map(([x, y, key, stroke]) => <ShapeAt key={key} shape={c[key]} x={x} y={y} radius={r} stroke={stroke} fill={c.background}/>)}
        <g transform="translate(110 134)" stroke={c.pinned} fill="none" strokeWidth="2">{c.pinStyle === 'round' ? <circle r="15"/> : <rect x={-pinW / 2} y="-14" width={pinW} height="28" rx="3"/>}<path d="M-5-8H5L3-2L7 2V4H-7V2L-3-2ZM0 4V12"/></g>
        <g strokeWidth="2.4" strokeLinecap="round"><line x1="24" x2="52" y1="148" y2="148" stroke={c.axisX}/><line x1="32" x2="32" y1="120" y2="148" stroke={c.axisZ}/><line x1="32" x2="48" y1="148" y2="134" stroke={c.axisY}/></g>
      </>, hud: <Readout x={view.right} y={view.top + 2} text={`${r} px`}/> };
    }
    const size = visuals.keyframeSize ?? 10, helper = visuals.helperSize ?? 6, ticks = [28, 68, 112, 150, 192];
    const star = (x, y, r) => { const points = []; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } return points; };
    const emitter = (x, y) => value.emitter === 'pentagram' ? <g fill="none" stroke={visuals.particle} strokeWidth={STROKE.line}><circle cx={x} cy={y} r="13"/><polygon points={toPoints(star(x, y, 13))}/></g> : value.emitter === 'cube' ? <rect x={x - 9} y={y - 9} width="18" height="18" fill="none" stroke={visuals.particle} strokeWidth={STROKE.line}/> : <polygon points={toPoints([[x, y - 12], [x + 11, y + 8], [x - 11, y + 8]])} fill="none" stroke={visuals.particle} strokeWidth={STROKE.line}/>;
    return { stage: <>
      <line x1="16" x2="204" y1="134" y2="134" stroke={look.ink} strokeOpacity=".45" strokeWidth={STROKE.line}/>
      {ticks.map((x, i) => <rect key={x} x={x - size / 2} y={134 - size / 2} width={size} height={size} transform={`rotate(45 ${x} 134)`} fill={i === 2 ? visuals.activeKeyframe : visuals.keyframe}/>)}
      {[[42, 44, visuals.bone], [86, 62, visuals.node], [176, 44, visuals.event]].map(([x, y, fill], i) => <rect key={i} x={x - helper} y={y - helper} width={helper * 2} height={helper * 2} fill={fill} stroke="#111111" strokeWidth=".6"/>)}
      {emitter(132, 48)}
      <rect x="60" y="30" width="96" height="60" fill={visuals.selection} fillOpacity=".12" stroke={visuals.selection} strokeWidth={STROKE.line} strokeDasharray="4 3"/>
      <polygon points={toPoints([[20, 96], [46, 88], [52, 108], [26, 114]])} fill={visuals.uvSelection} fillOpacity=".3" stroke={visuals.uvSelection} strokeWidth={STROKE.line}/>
    </>, hud: null };
  },
};

/* ---- Grids --------------------------------------------------------------- */

export const gridSampleScene = {
  label: 'Grid preview',
  read: (preferences, entry) => {
    const preset = entry.options?.preset;
    return { grid: preset ? GRID_PRESETS[preset] : preferences?.grid, visuals: preferences?.visuals, quad: preferences?.viewportAppearance?.quadView };
  },
  draw({ value, focus, ctx, view }) {
    const { look } = ctx, { grid, visuals, quad } = value;
    if (focus === 'quad') {
      const q = quad.grid, cell = Math.max(10, Math.min(64, q.spacing)), lines = [], left = 110 % cell, top = 82.5 % cell;
      if (q.enabled !== false) {
        for (let i = 0, x = left; x <= 220; i++, x += cell) { const major = Math.round((x - 110) / cell) % q.majorEvery === 0; lines.push(<line key={'v' + i} x1={x} x2={x} y1="0" y2="165" stroke={major ? q.majorColor : q.minorColor} strokeOpacity={major ? q.majorOpacity : q.opacity} strokeWidth={q.thickness}/>); }
        for (let i = 0, y = top; y <= 165; i++, y += cell) { const major = Math.round((y - 82.5) / cell) % q.majorEvery === 0; lines.push(<line key={'h' + i} y1={y} y2={y} x1="0" x2="220" stroke={major ? q.majorColor : q.minorColor} strokeOpacity={major ? q.majorOpacity : q.opacity} strokeWidth={q.thickness}/>); }
        lines.push(<line key="ax" x1="110" x2="110" y1="0" y2="165" stroke={q.axisColor} strokeWidth={q.thickness + .5}/>, <line key="ay" y1="82.5" y2="82.5" x1="0" x2="220" stroke={q.axisColor} strokeWidth={q.thickness + .5}/>);
      }
      return { stage: <><rect width="220" height="165" fill={quad.background.color}/>{lines}</>, hud: <Readout x={view.right} y={view.top + 2} text={`${q.spacing} px`}/> };
    }
    // A fixed window of 96 model units either side, so spacing and extent read as they are.
    const basis = viewBasis(), PX_PER_UNIT = 72 / 96, reach = Math.min(grid.extent, 96), span = reach * PX_PER_UNIT, every = Math.max(1, Math.round(grid.majorEvery)), count = Math.floor(reach / grid.spacing), stride = Math.max(1, Math.ceil(3 / (grid.spacing * PX_PER_UNIT)));
    const plane = (name, axisA, axisB) => {
      const lines = [], a = v => basis.project(axisA.map((c, i) => c * v[0] + axisB[i] * v[1]));
      for (let i = -count; i <= count; i++) {
        const major = i % every === 0; if (!major && (!grid.small || i % stride !== 0)) continue;
        const at = i * grid.spacing * PX_PER_UNIT, p1 = a([at, -span]), p2 = a([at, span]), q1 = a([-span, at]), q2 = a([span, at]), stroke = major ? visuals.gridMajor : visuals.gridMinor, opacity = major ? grid.majorOpacity : grid.opacity;
        lines.push(<line key={name + 'a' + i} x1={p1[0]} y1={p1[1]} x2={p2[0]} y2={p2[1]} stroke={stroke} strokeOpacity={opacity * (major ? .75 : .5)} strokeWidth={STROKE.hair}/>, <line key={name + 'b' + i} x1={q1[0]} y1={q1[1]} x2={q2[0]} y2={q2[1]} stroke={stroke} strokeOpacity={opacity * (major ? .75 : .5)} strokeWidth={STROKE.hair}/>);
      }
      return lines;
    };
    const axes = [['x', [1, 0, 0], visuals.axisX], ['y', [0, 1, 0], visuals.axisY], ['z', [0, 0, 1], visuals.axisZ]];
    return { stage: <>
      {grid.planes.xy && plane('xy', [1, 0, 0], [0, 1, 0])}
      {grid.planes.xz && plane('xz', [1, 0, 0], [0, 0, 1])}
      {grid.planes.yz && plane('yz', [0, 1, 0], [0, 0, 1])}
      {axes.map(([key, dir, color]) => { if (!grid.axes[key]) return null; const a = basis.project(dir.map(c => c * -span)), b = basis.project(dir.map(c => c * span)); return <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={STROKE.strong}/>; })}
    </>, hud: null };
  },
};

/* ---- Interface: window chrome, tree rows, toolbar ------------------------ */

function MiniToolbar({ ctx, mode, active }) {
  const left = 22, width = 176, top = 28;
  if (mode === 'hidden') return <g><rect x={left} y={top} width={width} height="4" rx="1" className="settings-preview-ui-field" strokeDasharray="3 2"/><rect x={left + 62} y={top + 40} width={width - 124} height="20" rx="4" className={active ? 'settings-preview-key is-lit' : 'settings-preview-key'}/><g className="settings-preview-mode-glyph" transform={`translate(${left + 76} ${top + 44})`}><path d="M0 2H24M0 6H24M0 10H16"/></g></g>;
  const slim = mode === 'trim', row1 = slim ? 13 : 26, row2 = slim ? 12 : 22, items = [];
  for (let i = 0; i < 7; i++) items.push(<rect key={'t' + i} x={left + 6 + i * (slim ? 17 : 24)} y={top + 3} width={slim ? 14 : 20} height={row1 - 6} rx="2" className={slim ? 'settings-preview-ui-field' : 'settings-preview-key'}/>);
  for (let i = 0; i < (slim ? 9 : 7); i++) items.push(<rect key={'d' + i} x={left + 6 + i * (slim ? 18 : 24)} y={top + row1 + 2} width={slim ? 15 : 20} height={row2 - 4} rx="2" className={slim ? 'settings-preview-ui-surface' : i === 1 ? 'settings-preview-key is-lit' : 'settings-preview-key'}/>);
  return <g><rect x={left} y={top} width={width} height={row1 + row2} rx="2" className="settings-preview-ui-panel"/><line x1={left} x2={left + width} y1={top + row1} y2={top + row1} className="settings-preview-ui-line"/>{items}</g>;
}

export const uiSampleScene = {
  label: 'Interface preview',
  read: preferences => ({ accent: preferences?.accent, toolHighlight: preferences?.toolHighlight, panelWidth: preferences?.panelWidth ?? 240, panelScale: preferences?.panelScale ?? 1, toolbarMode: preferences?.toolbarMode || 'graphic', tree: preferences?.viewportAppearance?.tree, geosetSet: preferences?.viewportAppearance?.geosetSet }),
  draw({ value, focus, ctx, view }) {
    const { look, u } = ctx;
    if (focus === 'toolbar') {
      const mode = value.toolbarMode, top = mode === 'trim' ? 54 : mode === 'hidden' ? 34 : 76;
      return { stage: <>
        <rect x="22" y="28" width="176" height="116" rx="3" fill={look.ink} fillOpacity=".05" stroke={look.ink} strokeOpacity=".4" strokeWidth={STROKE.line}/>
        <MiniToolbar ctx={ctx} mode={mode} active={mode === 'hidden'}/>
        <rect x="30" y={top + 4} width="160" height={140 - top - 4} fill={look.ink} fillOpacity=".06"/>
      </>, hud: null };
    }
    if (focus === 'folders' || focus === 'nodes') {
      const t = value.tree, folders = focus === 'folders', rows = folders ? FOLDER_COLORS : NODE_COLORS, colors = folders ? t.folders : t.nodes, perColumn = Math.ceil(rows.length / 2), rowHeight = 116 / perColumn;
      return { stage: <>
        <rect x="16" y="22" width="188" height="122" fill={t.background} stroke={t.border} strokeWidth={STROKE.line}/>
        {rows.map(([key], i) => {
          const x = 24 + (i < perColumn ? 0 : 92), y = 25 + i % perColumn * rowHeight + rowHeight / 2;
          return <g key={key} fill={colors[key]}>
            {folders ? <path d={`M${x} ${y - 5}h5l2 2h7v8h-14z`}/> : <circle cx={x + 7} cy={y} r="5"/>}
            <rect x={x + 18} y={y - 3} width="58" height="6" rx="2" fillOpacity=".78"/>
          </g>;
        })}
      </>, hud: null };
    }
    if (focus === 'tree') {
      const t = value.tree, rows = [[t.background, t.text, 'bone', false], [t.hover, t.text, 'helper', false], [t.selected, t.selectedText, 'attachment', true], [t.background, t.text, 'emitter', false]], rowHeight = Math.max(20, t.fontSize + 12), left = 28, width = 164, start = 82.5 - rowHeight * 2;
      return { stage: <>
        <rect x={left - 1} y={start - 1} width={width + 2} height={rowHeight * 4 + 2} fill={t.background} stroke={t.border} strokeWidth={STROKE.line}/>
        {rows.map(([bg, color, kind, selected], i) => <g key={i}>
          <rect x={left} y={start + i * rowHeight} width={width} height={rowHeight} fill={bg}/>
          {selected && <rect x={left} y={start + i * rowHeight} width="3" height={rowHeight} fill={t.accent}/>}
          <line x1={left + 14} x2={left + 22} y1={start + i * rowHeight + rowHeight / 2} y2={start + i * rowHeight + rowHeight / 2} stroke={t.guide} strokeWidth={STROKE.line}/>
          <circle cx={left + 30} cy={start + i * rowHeight + rowHeight / 2} r="4.5" fill={t.nodes?.[kind === 'attachment' ? 'attachment' : kind] || t.accent}/>
          <rect x={left + 42} y={start + i * rowHeight + rowHeight / 2 - t.fontSize * .32} width={i * 14 + 62} height={t.fontSize * .64} rx="2" fill={color} fillOpacity=".78"/>
          <rect x={left + width - 44} y={start + i * rowHeight + rowHeight / 2 - t.fontSize * .24} width="32" height={t.fontSize * .48} rx="2" fill={t.muted} fillOpacity=".78"/>
        </g>)}
      </>, hud: <Readout x={view.right} y={view.top + 2} text={`${t.fontSize} px`}/> };
    }
    const glow = /^#[0-9a-f]{6}$/i.test(value.toolHighlight) ? value.toolHighlight : value.accent, width = Math.round(value.panelWidth / 640 * 92), scale = value.panelScale, geoset = value.geosetSet;
    return { stage: <>
      <rect x="20" y="24" width="180" height="118" rx="3" className="settings-preview-ui-surface"/>
      <rect x="20" y="24" width="180" height="16" rx="3" className="settings-preview-ui-panel"/>
      <rect x="20.5" y="40" width={width} height="102" className="settings-preview-ui-panel"/>
      {[0, 1, 2, 3].map(i => <g key={i}><rect x={26} y={46 + i * 22 * scale} width={18 * scale} height={18 * scale} rx="3" className={i === 1 ? 'settings-preview-key is-lit' : 'settings-preview-key'} style={i === 1 ? { stroke: glow, strokeWidth: 2 } : undefined}/><rect x={30 + 18 * scale} y={52 + i * 22 * scale} width={Math.max(4, width - 28 * scale - 6)} height="6" rx="2" className="settings-preview-ui-muted" opacity=".6"/></g>)}
      <rect x={20.5 + width + 8} y="50" width={Math.max(30, 172 - width - 16)} height="8" rx="3" fill={value.accent}/>
      {geoset && [0, 1, 2, 3, 4].map(i => <rect key={i} x={20.5 + width + 8 + i * 14} y="68" width="11" height="11" rx="2" fill={geoset.style === 'classic' ? 'none' : geoset.color} stroke={geoset.color} strokeWidth={STROKE.line}/>)}
    </>, hud: focus === 'width' ? <Readout x={view.right} y={view.top + 2} text={`${value.panelWidth} px`}/> : focus === 'scale' ? <Readout x={view.right} y={view.top + 2} text={`×${value.panelScale.toFixed(2)}`}/> : null };
  },
};
