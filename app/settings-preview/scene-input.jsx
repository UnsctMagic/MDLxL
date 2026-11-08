/** Mouse and keyboard scenes: pointer speed, camera buttons, the wheel and Learn keycaps. */
import React from 'react';
import { CAMERA_PRESETS, uvTransformSensitivity } from '../../src/preferences.js';
import { pointerSensitivityValue, sensitivityValue } from '../viewport-performance.js';
import { clamp01, ease, gestureAt } from './clock.js';
import { Arc, Arrow, AxisTriad, CursorPath, Inputs, keyName, keyBadgeWidth, MouseGlyph, Readout, STROKE } from './markers.jsx';
import { Block } from './scene-gizmo.jsx';
import { PIVOT, pointerTrack, ringPoint, turnVector, viewBasis, wheelAdjustSteps, wheelNotchFactor } from './tracks.js';

const AXIS = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };

/* ---- Pointer ------------------------------------------------------------- */

const RULER = { left: 30, width: 160 };
function Ruler({ ctx, y, value, children }) {
  const { look, u } = ctx, ticks = [];
  for (let at = 0; at <= RULER.width; at += 20) ticks.push(at);
  return <g>
    <g stroke={look.ink} strokeLinecap="round">
      <line x1={RULER.left} x2={RULER.left + RULER.width} y1={y} y2={y} strokeOpacity=".55" strokeWidth={STROKE.line}/>
      {ticks.map(at => <line key={at} x1={RULER.left + at} x2={RULER.left + at} y1={y - (at % 40 ? 2.5 : 4.5) * u} y2={y + (at % 40 ? 2.5 : 4.5) * u} strokeOpacity=".55" strokeWidth={STROKE.line}/>)}
    </g>
    <line x1={RULER.left} x2={RULER.left + Math.min(RULER.width, value)} y1={y} y2={y} stroke={look.accent} strokeWidth="2.6" strokeLinecap="round"/>
    {children}
  </g>;
}

function UVPointDraw({ value, track, at, ctx, view, fade }) {
  const { look, u } = ctx, frame = track.frames[at], square = { x: 52, y: 25, size: 116 }, start = [square.x + 18, square.y + square.size - 20], diagonal = [.78, -.62];
  const point = [start[0] + diagonal[0] * frame.moved, start[1] + diagonal[1] * frame.moved], trail = track.frames.map(f => [start[0] + diagonal[0] * f.x, start[1] + diagonal[1] * f.x]), lines = [];
  for (let i = 1; i < 4; i++) lines.push(square.size * i / 4);
  return {
    stage: <>
      <rect x={square.x} y={square.y} width={square.size} height={square.size} fill={look.ink} fillOpacity=".06" stroke={look.ink} strokeOpacity=".4" strokeWidth={STROKE.line}/>
      <g stroke={look.ink} strokeOpacity=".14" strokeWidth={STROKE.hair}>{lines.map(l => <g key={l}><line x1={square.x + l} x2={square.x + l} y1={square.y} y2={square.y + square.size}/><line x1={square.x} x2={square.x + square.size} y1={square.y + l} y2={square.y + l}/></g>)}</g>
      <circle cx={start[0]} cy={start[1]} r={4 * u} fill="none" stroke={look.ink} strokeOpacity=".6" strokeWidth={STROKE.line} strokeDasharray="2.5 2.5"/>
      <rect x={point[0] - 3.5 * u} y={point[1] - 3.5 * u} width={7 * u} height={7 * u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.hair}/>
      <CursorPath ctx={ctx} trail={trail} at={at} opacity={fade}/>
    </>,
    hud: <><Inputs view={view} button="left"/><Readout x={view.right} y={view.top + 2} text={`×${value.gain.toFixed(2)}`}/></>,
  };
}

export const pointerGainScene = {
  label: 'Pointer speed preview',
  duration: () => 3000,
  read: (preferences, entry) => {
    const focus = entry.focus;
    return { gain: focus === 'uv' ? uvTransformSensitivity(preferences) : focus === 'fine' ? 1 : pointerSensitivityValue(preferences?.pointerSensitivity), fine: Number(preferences?.fineSensitivity) || .2, fineKey: keyName(preferences, 'drag.uv.fine') };
  },
  track: ({ gain, fine }, focus) => ({ frames: focus === 'fine' ? pointerTrack(gain, { travel: 80, fineFrom: .5, fine }) : focus === 'uv' ? pointerTrack(gain, { travel: 70 }) : pointerTrack(gain, { travel: 40 }) }),
  draw(props) {
    const { value, focus, track, at, ctx, view, fade } = props;
    if (focus === 'uv') return UVPointDraw(props);
    const { look, u } = ctx, frame = track.frames[at], mouseY = 56, resultY = 112, fine = focus === 'fine', cursorX = RULER.left + frame.x, resultX = RULER.left + Math.min(RULER.width + 8, frame.moved);
    return {
      stage: <>
        <Ruler ctx={ctx} y={mouseY} value={frame.x}/>
        <Ruler ctx={ctx} y={resultY} value={frame.moved}>
          <rect x={resultX - 5 * u} y={resultY - 15 * u} width={10 * u} height={10 * u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.hair}/>
        </Ruler>
        <CursorPath ctx={ctx} trail={[[cursorX, mouseY - 2]]} at={0} opacity={fade}/>
        <path d={`M${cursorX} ${mouseY + 8}L${resultX} ${resultY - 18}`} stroke={look.ink} strokeOpacity=".3" strokeWidth={STROKE.hair} strokeDasharray="2 3"/>
      </>,
      hud: <>
        <Inputs view={view} button="left" keys={fine ? [{ label: value.fineKey, lit: frame.slow }] : []}/>
        <Readout x={view.right} y={view.top + 2} text={`×${(fine ? value.fine : value.gain).toFixed(2)}`} lit={fine && frame.slow}/>
      </>,
    };
  },
};

/* ---- Camera buttons ------------------------------------------------------ */

function cameraAction(action, t, ctx, basis) {
  const [cx, cy] = PIVOT;
  if (action === 'pan') return { offset: [-46 + 92 * t, 0], cursor: [cx - 46 + 92 * t, 142], arrow: [[cx - 62, 154], [cx + 62, 154]], yaw: 0, scale: 1 };
  if (action === 'rotate') return { offset: [0, 0], cursor: [cx - 56 + 112 * t, 142], yaw: 120 * t, scale: 1, arc: true };
  if (action === 'zoom') return { offset: [0, 0], cursor: [190, cy + 40 - 80 * t], arrow: [[204, cy + 54], [204, cy - 54]], double: true, yaw: 0, scale: .7 + .8 * t };
  return { offset: [0, 0], cursor: [cx - 56 + 112 * t, 142], yaw: 0, scale: 1, nothing: true };
}

function CrossedDot({ ctx, x, y }) {
  const { look, u } = ctx, c = 6 * u, d = `M${x - c} ${y - c}L${x + c} ${y + c}M${x + c} ${y - c}L${x - c} ${y + c}`;
  return <g fill="none" strokeLinecap="round"><path d={d} stroke={look.paper} strokeWidth="4"/><path d={d} stroke={look.ink} strokeWidth="1.75"/></g>;
}

/** Middle-click flips between turning the view and working on the model. */
function ModeSwitch({ view, rotating }) {
  const x = view.right - 44, y = view.top + 2, slot = (at, lit, draw) => <g transform={`translate(${at} ${y})`}><rect width="20" height="16" rx="3" className={lit ? 'settings-preview-readout is-lit' : 'settings-preview-readout'}/><g className="settings-preview-mode-glyph">{draw}</g></g>;
  return <>{slot(x, rotating, <path d="M14.5 5.2A5 5 0 1 0 15 8.5M14.8 2.6V5.6H11.8"/>)}{slot(x + 24, !rotating, <path d="M10 3.2V12.8M5.2 8H14.8"/>)}</>;
}

export const mouseCameraScene = {
  label: 'Camera buttons preview',
  duration: (focus, value) => value.preset ? 4000 : 3000,
  read: (preferences, entry) => {
    const preset = entry.options?.preset, bindings = preset ? CAMERA_PRESETS[preset].cameraBindings : preferences?.cameraBindings || CAMERA_PRESETS.classic.cameraBindings;
    return { right: bindings.right, middle: bindings.middle, preset: preset || null };
  },
  draw({ value, focus, phase, ctx, view, fade }) {
    const { look } = ctx, part = value.preset ? (phase < .5 ? 'right' : 'middle') : focus, local = value.preset ? (phase < .5 ? phase * 2 : (phase - .5) * 2) : phase, action = value[part], t = ease(gestureAt(local)), basis = viewBasis();
    if (action === 'toggle') {
      const clicked = gestureAt(local) >= .45, spot = [PIVOT[0] + 40, PIVOT[1] + 44], pressing = Math.abs(gestureAt(local) - .45) < .1;
      return {
        stage: <><Block ctx={ctx} basis={basis} pose={[{ axis: 'Z', degrees: clicked ? 0 : 0 }]}/><CursorPath ctx={ctx} trail={[spot]} at={0} opacity={fade} pressed={pressing}/></>,
        hud: <><MouseGlyph x={view.left} y={view.top} button={pressing ? 'middle' : null}/><ModeSwitch view={view} rotating={!clicked}/><AxisTriad ctx={ctx} x={view.left + 18} y={view.bottom - 18} project={basis.triad}/></>,
      };
    }
    const move = cameraAction(action, t, ctx, basis), pose = move.yaw ? [{ axis: 'Z', degrees: move.yaw }] : [];
    const start = cameraAction(action, 0, ctx, basis), cursorTrail = Array.from({ length: 41 }, (_, i) => cameraAction(action, i / 40, ctx, basis).cursor), head = Math.round(t * 40);
    const triad = axis => { const v = pose.reduce((p, s) => turnVector(p, AXIS.Z, s.degrees), AXIS[axis]), [sx, sy] = basis.project(v); return { dx: sx - PIVOT[0], dy: sy - PIVOT[1], z: basis.depth(v) }; };
    return {
      stage: <>
        <Block ctx={ctx} basis={basis} offset={start.offset} scale={start.scale} ghost/>
        <Block ctx={ctx} basis={basis} pose={pose} offset={move.offset} scale={move.scale}/>
        {move.arc && <Arc ctx={ctx} at={(degrees, radius) => basis.project(ringPoint('Z', degrees, radius))} radius={60} from={-80} sweep={move.yaw}/>}
        {move.arrow && <Arrow ctx={ctx} from={move.arrow[0]} to={move.arrow[1]} double={move.double}/>}
        {move.nothing && <CrossedDot ctx={ctx} x={PIVOT[0]} y={PIVOT[1]}/>}
        <CursorPath ctx={ctx} trail={cursorTrail} at={head} opacity={fade}/>
      </>,
      hud: <><MouseGlyph x={view.left} y={view.top} button={part}/><AxisTriad ctx={ctx} x={view.left + 18} y={view.bottom - 18} project={triad}/></>,
    };
  },
};

/* ---- Wheel --------------------------------------------------------------- */

function ValueBar({ ctx, x, y, width, value, min, max, notches }) {
  const { look, u } = ctx, at = v => x + width * Math.log(v / min) / Math.log(max / min);
  return <g strokeLinecap="round">
    <line x1={x} x2={x + width} y1={y} y2={y} stroke={look.ink} strokeOpacity=".3" strokeWidth="4"/>
    <line x1={x} x2={at(value)} y1={y} y2={y} stroke={look.accent} strokeWidth="4"/>
    <line x1={at(notches[0])} x2={at(notches[0])} y1={y - 6 * u} y2={y + 6 * u} stroke={look.ink} strokeOpacity=".7" strokeWidth={STROKE.line}/>
    <circle cx={at(value)} cy={y} r={4.5 * u} fill={look.accent} stroke={look.paper} strokeWidth={STROKE.line}/>
  </g>;
}

const NOTCHES = 2;
export const wheelScene = {
  label: 'Mouse wheel preview',
  duration: () => 3200,
  read: (preferences, entry) => {
    const focus = entry.focus, sensitivity = sensitivityValue(preferences?.scrollSensitivity);
    const kind = focus === 'pointer' ? 'pointer' : 'scroll', held = focus === 'rightScroll';
    return { sensitivity, factor: wheelNotchFactor(sensitivity), adjust: held && preferences?.rightScrollAdjust === false ? null : focus === 'sensitivity' || focus === 'normal' ? null : wheelAdjustSteps({ scrollSensitivity: sensitivity, pointerSensitivity: pointerSensitivityValue(preferences?.pointerSensitivity), rightScrollAdjust: true }, kind, 3, held) };
  },
  draw({ value, focus, phase, ctx, view }) {
    const { look } = ctx, basis = viewBasis(), gesture = gestureAt(phase), held = focus === 'rightScroll';
    const stepFloat = gesture * (value.adjust ? value.adjust.length - 1 : NOTCHES), notch = Math.min(Math.floor(stepFloat + .001), value.adjust ? value.adjust.length - 1 : NOTCHES), rolling = gesture > 0 && gesture < 1;
    if (value.adjust) {
      const min = focus === 'pointer' ? .01 : .1, max = focus === 'pointer' ? 4 : 10, current = value.adjust[notch], released = held && gesture >= 1;
      return {
        stage: <>
          <Block ctx={ctx} basis={basis} offset={[0, -22]}/>
          <ValueBar ctx={ctx} x={38} y={138} width={144} value={current} min={min} max={max} notches={value.adjust}/>
        </>,
        hud: <><MouseGlyph x={view.left} y={view.top + 6} button={held && !released ? 'right' : null} wheel={rolling || !held ? 'up' : null}/><Readout x={view.right} y={view.top + 2} text={`×${current.toFixed(2)}`} lit={rolling}/></>,
      };
    }
    const crossed = held;
    const factor = crossed ? 1 : value.factor ** notch, grown = Math.min(2.4, .55 * factor);
    return {
      stage: <>
        <Block ctx={ctx} basis={basis} scale={.55} ghost/>
        <Block ctx={ctx} basis={basis} scale={grown}/>
        {crossed && <CrossedDot ctx={ctx} x={PIVOT[0]} y={PIVOT[1]}/>}
        {!crossed && <NotchMarks ctx={ctx} count={NOTCHES} done={notch}/>}
      </>,
      hud: <><MouseGlyph x={view.left} y={view.top + 6} button={held ? 'right' : null} wheel={rolling || !held ? 'up' : null}/>{focus === 'sensitivity' && <Readout x={view.right} y={view.top + 2} text={`×${value.factor.toFixed(2)}`}/>}</>,
    };
  },
};

function NotchMarks({ ctx, count, done }) {
  const { look, u } = ctx, x = PIVOT[0] - (count - 1) * 7, items = [];
  for (let i = 0; i < count; i++) items.push(<circle key={i} cx={x + i * 14} cy={152} r={3 * u} fill={i < done ? look.accent : 'none'} stroke={look.accent} strokeWidth={STROKE.line}/>);
  return <g>{items}</g>;
}

/* ---- Learn keycaps and pressed keys -------------------------------------- */

const KEYCAP_SIZE = { small: 10, medium: 14, large: 21 };
function Keycap({ x, y, label, size = 'medium', anchor = 'middle', flash = 0, u = 1, accent }) {
  const font = KEYCAP_SIZE[size] * Math.min(1.25, Math.sqrt(u)), padX = font * .65, padY = font * .3, width = label.length * font * .62 + padX * 2, height = font * 1.35 + padY, left = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  return <g>
    {flash > 0 && <rect x={left - 2.5} y={y - height / 2 - 2.5} width={width + 5} height={height + 5} rx="6" fill="none" stroke={accent} strokeWidth="2" strokeOpacity={flash}/>}
    <rect x={left} y={y - height / 2} width={width} height={height} rx="4" fill={flash > .5 ? accent : '#151a22'} fillOpacity={flash > .5 ? 1 : .88} stroke="#ffffff" strokeOpacity=".4" strokeWidth=".75"/>
    <text translate="no" x={left + width / 2} y={y + font * .36} textAnchor="middle" fill="#ffffff" fontSize={font} fontWeight="600">{label}</text>
  </g>;
}

const WINDOW = { x: 22, y: 20, width: 176, height: 124 };
const KEYCAP_SPOT = {
  control: () => [PIVOT[0] + 4, WINDOW.y + 42],
  bottom: () => [PIVOT[0], WINDOW.y + WINDOW.height - 20],
  top: () => [PIVOT[0], WINDOW.y + 44],
  'bottom-right': () => [WINDOW.x + WINDOW.width - 34, WINDOW.y + WINDOW.height - 20],
  'bottom-left': () => [WINDOW.x + 34, WINDOW.y + WINDOW.height - 20],
};

function MiniWindow({ ctx, press }) {
  const { look, u } = ctx, top = WINDOW.y, buttons = [0, 1, 2, 3, 4];
  return <g>
    <rect x={WINDOW.x} y={top} width={WINDOW.width} height={WINDOW.height} rx="4" className="settings-preview-ui-panel"/>
    <rect x={WINDOW.x + .5} y={top + 22} width={WINDOW.width - 1} height={WINDOW.height - 22.5} fill={look.stage}/>
    <line x1={WINDOW.x} x2={WINDOW.x + WINDOW.width} y1={top + 22} y2={top + 22} className="settings-preview-ui-line"/>
    {buttons.map(i => <rect key={i} x={WINDOW.x + 8 + i * 22} y={top + 4} width="17" height="14" rx="2.5" className={i === 2 && press ? 'settings-preview-key is-lit' : 'settings-preview-key'}/>)}
  </g>;
}

const buttonSpot = () => [WINDOW.x + 8 + 2 * 22 + 8, WINDOW.y + 12];
export const keycapScene = {
  label: 'Key reminder preview',
  duration: () => 3200,
  read: (preferences, entry) => ({ learn: preferences?.learn || {}, showKeys: !!preferences?.showPressedKeys, focus: entry.focus }),
  draw({ value, focus, phase, ctx, view, fade }) {
    const { look, u } = ctx, learn = value.learn, t = gestureAt(phase), [bx, by] = buttonSpot();
    if (focus === 'pressedKeys') {
      const keys = ['Ctrl', 'S'], down = value.showKeys ? keys.filter((_, i) => t > .15 + i * .22) : [], width = keys.reduce((sum, key) => sum + keyBadgeWidth(key) * 1.6 + 4, 0);
      return {
        stage: <><MiniWindow ctx={ctx} press={false}/>{down.map((key, i) => <Keycap key={key} u={u} x={PIVOT[0] - width / 2 + keys.slice(0, i).reduce((s, k) => s + keyBadgeWidth(k) * 1.6 + 4, 0) + keyBadgeWidth(key) * .8} y={WINDOW.y + WINDOW.height - 22} label={key} size="small" accent={look.accent}/>)}</>,
        hud: null,
      };
    }
    const clickAt = .22, clicked = t >= clickAt, arrive = ease(clamp01(t / clickAt)), cursorPoint = [bx + 58 - 58 * arrive, by + 72 - 72 * arrive];
    const enabled = focus === 'enabled' ? learn.enabled !== false : true, position = learn.position || 'control', [sx, sy] = (focus === 'where' ? KEYCAP_SPOT[position] : KEYCAP_SPOT.control)();
    const size = focus === 'size' ? learn.size || 'medium' : 'medium', duration = Number(learn.duration ?? 5);
    const life = clicked ? clamp01((t - clickAt) / (1 - clickAt)) : 0;
    const flash = focus === 'look' && learn.style === 'flash' ? (phase >= 1 ? .9 : Math.abs(Math.sin(life * Math.PI * 4))) : 0;
    const shown = clicked && enabled;
    const stage = [];
    if (focus === 'duration' && shown) {
      const width = 90, left = sx - width / 2, y = sy + 20, left01 = duration === 0 ? 1 : 1 - life;
      stage.push(<g key="bar" strokeLinecap="round"><line x1={left} x2={left + width} y1={y} y2={y} stroke={look.ink} strokeOpacity=".3" strokeWidth="3"/><line x1={left} x2={left + width * left01} y1={y} y2={y} stroke={look.accent} strokeWidth="3"/></g>);
    }
    if (focus === 'uses') {
      const uses = Number(learn.learnUses ?? 5), filled = Math.floor(t * (uses + 1)), left = PIVOT[0] - (uses - 1) * 6.5, y = WINDOW.y + WINDOW.height - 22;
      for (let i = 0; i < uses; i++) stage.push(<circle key={i} cx={left + i * 13} cy={y} r={3.6 * Math.min(1.25, u)} fill={i < filled ? look.accent : 'none'} stroke={look.accent} strokeWidth={STROKE.line}/>);
      return { stage: <><MiniWindow ctx={ctx} press={clicked}/>{filled <= uses && t < .95 && <Keycap u={u} x={sx} y={sy} label="F7" accent={look.accent}/>}{stage}<CursorPath ctx={ctx} trail={[cursorPoint]} at={0} opacity={fade} pressed={clicked}/></>, hud: <Readout x={view.right} y={view.top + 2} text={String(uses)}/> };
    }
    if (focus === 'quiet') {
      const hours = Number(learn.quietHours ?? 24), left = WINDOW.x + 18, width = WINDOW.width - 36, y = WINDOW.y + WINDOW.height - 26, scale = width / 72;
      return { stage: <><MiniWindow ctx={ctx} press={false}/><g strokeLinecap="round"><line x1={left} x2={left + width} y1={y} y2={y} stroke={look.ink} strokeOpacity=".3" strokeWidth="4"/><line x1={left} x2={left + Math.min(hours * scale, width) * clamp01(t * 1.4)} y1={y} y2={y} stroke={look.accent} strokeWidth="4"/>{[0, 24, 48, 72].map(h => <line key={h} x1={left + h * scale} x2={left + h * scale} y1={y - 6} y2={y + 6} stroke={look.ink} strokeOpacity=".55" strokeWidth={STROKE.line}/>)}</g><Keycap u={u} x={PIVOT[0]} y={WINDOW.y + 56} label="F7" accent={look.accent}/></>, hud: <Readout x={view.right} y={view.top + 2} text={`${hours} h`}/> };
    }
    const readout = focus === 'duration' ? (duration === 0 ? '∞' : `${duration} s`) : null;
    return {
      stage: <><MiniWindow ctx={ctx} press={clicked}/>{shown && <Keycap u={u} x={sx} y={sy} label="F7" size={size} flash={flash} accent={look.accent}/>}{stage}<CursorPath ctx={ctx} trail={[cursorPoint]} at={0} opacity={fade} pressed={clicked}/></>,
      hud: <Readout x={view.right} y={view.top + 2} text={readout}/>,
    };
  },
};
