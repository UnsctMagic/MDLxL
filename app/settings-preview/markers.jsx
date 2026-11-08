/** The eight marker parts every scene is built from. Stage parts work in stage
 * units; `ctx.u` undoes the stage scale so handles and heads keep their size in
 * the narrow-window strip. HUD parts work in real pixels and use theme tokens. */
import React from 'react';
import { modifierLabel } from '../../src/modifier-bindings.js';
import { legible } from './palette.js';

export const STROKE = { hair: .75, line: 1.25, strong: 1.75 };
const n = value => Math.round(value * 100) / 100;
export const toPoints = list => list.map(([x, y]) => `${n(x)},${n(y)}`).join(' ');
const CHAR = 5.7;
/** The key shown for one mouse-drag meaning, in the user's current binding; '' when it has none. */
export const keyName = (preferences, id) => modifierLabel(id, preferences);

const ARROWHEAD = [7.5, 4.5];
function headPoints([x, y], [ux, uy], u) {
  const [back, side] = [ARROWHEAD[0] * u, ARROWHEAD[1] * u];
  return [[x - ux * back - uy * side, y - uy * back + ux * side], [x, y], [x - ux * back + uy * side, y - uy * back - ux * side]];
}

/** Dashed trail plus the moving pointer; a small ring marks the button being held. */
export function CursorPath({ ctx, trail, at, pressed = true, opacity = 1, showTrail = true }) {
  const { look, u } = ctx, shown = trail.slice(0, at + 1).filter((_, i) => i % 3 === 0 || i === at), head = trail[at];
  if (!head) return null;
  return <g opacity={opacity}>
    {showTrail && shown.length > 1 && <polyline points={toPoints(shown)} fill="none" stroke={look.accent} strokeWidth={STROKE.line} strokeDasharray="1.5 3.5" strokeLinecap="round" strokeLinejoin="round"/>}
    {pressed && <circle cx={n(head[0])} cy={n(head[1])} r={n(5.5 * u)} fill={look.accent} fillOpacity=".22" stroke={look.accent} strokeWidth={STROKE.hair}/>}
    <path transform={`translate(${n(head[0])} ${n(head[1])}) scale(${n(u)})`} d="M0 0V12.6L3.1 9.8L5.3 14.7L7.7 13.6L5.5 8.9H9.8Z" fill="#ffffff" stroke="#16191e" strokeWidth=".9" strokeLinejoin="round"/>
  </g>;
}

/** Straight arrow. `tone="push"` is the app's own yellow drag arrow. */
export function Arrow({ ctx, from, to, double = false, tone = 'accent', crossed = false, opacity = 1 }) {
  const { look, u } = ctx, length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const unit = [(to[0] - from[0]) / length, (to[1] - from[1]) / length], back = [-unit[0], -unit[1]];
  const d = [`M${n(from[0])} ${n(from[1])}L${n(to[0])} ${n(to[1])}`, `M${toPoints(headPoints(to, unit, u)).replace(/ /g, 'L')}`];
  if (double) d.push(`M${toPoints(headPoints(from, back, u)).replace(/ /g, 'L')}`);
  const path = d.join('');
  const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], c = 5 * u;
  const main = tone === 'push' ? look.push : tone === 'ink' ? look.ink : look.accent;
  return <g opacity={opacity} fill="none" strokeLinecap="round" strokeLinejoin="round">
    {tone === 'push' && <path d={path} stroke={look.casing} strokeWidth="4.6"/>}
    <path d={path} stroke={main} strokeWidth={tone === 'push' ? 2.3 : STROKE.strong}/>
    {crossed && <path d={`M${n(middle[0] - c)} ${n(middle[1] - c)}L${n(middle[0] + c)} ${n(middle[1] + c)}M${n(middle[0] + c)} ${n(middle[1] - c)}L${n(middle[0] - c)} ${n(middle[1] + c)}`} stroke={look.paper} strokeWidth="3.4"/>}
    {crossed && <path d={`M${n(middle[0] - c)} ${n(middle[1] - c)}L${n(middle[0] + c)} ${n(middle[1] + c)}M${n(middle[0] + c)} ${n(middle[1] - c)}L${n(middle[0] - c)} ${n(middle[1] + c)}`} stroke={look.ink} strokeWidth={STROKE.strong}/>}
  </g>;
}

/** Swept angle: a soft wedge, its rim, and degree ticks. `at(degrees, radius)` maps
 * the angle to the stage, so one part draws flat circles and 3D ellipses alike. */
export function Arc({ ctx, at, radius, from = 0, sweep, tickStep = 15, tickSpan = 0, tone = 'accent', tickOutward = 1, band = 8, head = true }) {
  const { look, u } = ctx, color = tone === 'push' ? look.push : look.accent, shown = Math.sign(sweep) * Math.min(359.5, Math.abs(sweep));
  const steps = Math.max(2, Math.ceil(Math.abs(shown) / 4)), rim = [], inside = [];
  for (let i = 0; i <= steps; i++) { rim.push(at(from + shown * i / steps, radius)); inside.push(at(from + shown * i / steps, Math.max(1, radius - band * u))); }
  const span = tickSpan || Math.abs(shown), ticks = [], direction = sweep < 0 ? -1 : 1;
  if (tickStep > 0) for (let d = 0; d <= Math.min(360, span) + 1e-6; d += tickStep) {
    const a = from + direction * d, passed = d <= Math.abs(shown) + 1e-6, out = tickOutward * (d % (tickStep * 3) < 1e-6 ? 6.5 : 4.2) * u;
    const start = at(a, radius), end = at(a, radius + out);
    ticks.push(<line key={d} x1={n(start[0])} y1={n(start[1])} x2={n(end[0])} y2={n(end[1])} stroke={color === look.push ? look.casing : color} strokeWidth={STROKE.line} strokeOpacity={passed ? 1 : .35} strokeLinecap="round"/>);
  }
  return <g fill="none" strokeLinecap="round">
    {band > 0 && Math.abs(shown) > .2 && <polygon points={toPoints([...rim, ...inside.reverse()])} fill={color} fillOpacity=".24" stroke="none"/>}
    {ticks}
    {rim.length > 1 && Math.abs(shown) > .2 && <polyline points={toPoints(rim)} stroke={color} strokeWidth={STROKE.strong} strokeLinejoin="round"/>}
    {head && Math.abs(shown) > 16 && (() => {
      const end = rim.at(-1), before = rim.at(-2), length = Math.hypot(end[0] - before[0], end[1] - before[1]) || 1, unit = [(end[0] - before[0]) / length, (end[1] - before[1]) / length];
      return <polyline points={toPoints(headPoints(end, unit, u))} stroke={color} strokeWidth={STROKE.strong} strokeLinejoin="round"/>;
    })()}
  </g>;
}

/** X Y Z in the user's axis colours; `active` is the axis being turned. `project` maps an axis to its screen direction. */
export function AxisTriad({ ctx, x, y, size = 16, project, active }) {
  const { look } = ctx, color = axis => legible(look.axes[axis], look.stage, 2.4);
  const axes = ['X', 'Y', 'Z'].map(axis => ({ axis, ...project(axis) })).sort((a, b) => a.z - b.z);
  return <g strokeLinecap="round">
    {axes.map(({ axis, dx, dy }) => {
      const lit = axis === active, tipX = x + dx * size, tipY = y + dy * size;
      return <g key={axis} opacity={active && !lit ? .5 : 1}>
        {lit && <line x1={n(x)} y1={n(y)} x2={n(tipX)} y2={n(tipY)} stroke={look.paper} strokeOpacity=".75" strokeWidth="4.5"/>}
        <line x1={n(x)} y1={n(y)} x2={n(tipX)} y2={n(tipY)} stroke={color(axis)} strokeWidth={lit ? 2.4 : STROKE.line}/>
        <text translate="no" x={n(x + dx * (size + 6.5))} y={n(y + dy * (size + 6.5) + 3)} textAnchor="middle" className="settings-preview-axis" fill={color(axis)} style={{ paintOrder: 'stroke', stroke: look.paper, strokeOpacity: .7, strokeWidth: 2.5 }}>{axis}</text>
      </g>;
    })}
  </g>;
}

export const keyBadgeWidth = label => Math.max(16, label.length * CHAR + 9);
/** A kbd-style modifier key, lit while it is held. */
function KeyBadge({ x, y, label, lit = false, opacity = 1 }) {
  const width = keyBadgeWidth(label), height = 16;
  return <g opacity={opacity}>
    <rect x={n(x)} y={y} width={n(width)} height={height} rx="3" className={lit ? 'settings-preview-key is-lit' : 'settings-preview-key'}/>
    <line x1={n(x + 2.5)} x2={n(x + width - 2.5)} y1={y + height - .5} y2={y + height - .5} className="settings-preview-key-edge"/>
    <text translate="no" x={n(x + width / 2)} y={y + 11.5} textAnchor="middle" className={lit ? 'settings-preview-key-text is-lit' : 'settings-preview-key-text'}>{label}</text>
  </g>;
}

/** A mouse with the button or wheel being used lit. */
export function MouseGlyph({ x, y, button = null, wheel = null }) {
  const lit = part => part ? 'settings-preview-mouse-part is-lit' : 'settings-preview-mouse-part';
  return <g transform={`translate(${n(x)} ${n(y)})`}>
    <path d="M1 8A6.5 7 0 0 1 7 1V11H1Z" className={lit(button === 'left')}/>
    <path d="M14 8A6.5 7 0 0 0 8 1V11H14Z" className={lit(button === 'right')}/>
    <path d="M1 12H14V16A6.5 7 0 0 1 1 16Z" className="settings-preview-mouse-part"/>
    <rect x="6" y="3" width="3" height="6.5" rx="1.5" className={lit(button === 'middle' || wheel)}/>
    {wheel === 'up' && <path d="M4.5 -3L7.5 -6L10.5 -3" className="settings-preview-mouse-chevron"/>}
    {wheel === 'down' && <path d="M4.5 26L7.5 29L10.5 26" className="settings-preview-mouse-chevron"/>}
  </g>;
}

/** The "before" outline. */
export function Ghost({ ctx, points, closed = true, opacity = .6 }) {
  const { look } = ctx, Tag = closed ? 'polygon' : 'polyline';
  return <Tag points={toPoints(points)} fill="none" stroke={look.ink} strokeOpacity={opacity} strokeWidth={STROKE.line} strokeDasharray="3 3" strokeLinejoin="round"/>;
}

/** A dashed circle: a deadzone, a reach or a pick distance. */
export function Ring({ ctx, x, y, radius, lit = false }) {
  const { look } = ctx;
  if (!(radius > 0)) return null;
  return <circle cx={n(x)} cy={n(y)} r={n(radius)} fill={lit ? look.accent : 'none'} fillOpacity=".12" stroke={lit ? look.accent : look.ink} strokeOpacity={lit ? 1 : .55} strokeWidth={STROKE.line} strokeDasharray="4 4"/>;
}

const readoutWidth = text => text.length * CHAR + 10;
/** A short value chip. Numbers are never translated. */
export function Readout({ x, y, text, anchor = 'end', lit = false }) {
  if (text === null || text === undefined || text === '') return null;
  const width = readoutWidth(String(text)), left = anchor === 'end' ? x - width : anchor === 'middle' ? x - width / 2 : x;
  return <g>
    <rect x={n(left)} y={y} width={n(width)} height="16" rx="3" className={lit ? 'settings-preview-readout is-lit' : 'settings-preview-readout'}/>
    <text translate="no" x={n(left + width / 2)} y={y + 11.5} textAnchor="middle" className={lit ? 'settings-preview-readout-text is-lit' : 'settings-preview-readout-text'}>{text}</text>
  </g>;
}

/** The inputs of a gesture, top left: the mouse, then any keys. */
export function Inputs({ view, button, wheel, keys = [] }) {
  let x = view.left + 19;
  return <g>
    {(button || wheel) && <MouseGlyph x={view.left} y={view.top} button={button} wheel={wheel}/>}
    {keys.filter(key => key.label).map(key => { const at = x; x += keyBadgeWidth(key.label) + 4; return <KeyBadge key={key.label} x={at} y={view.top + 2} label={key.label} lit={key.lit}/>; })}
  </g>;
}
