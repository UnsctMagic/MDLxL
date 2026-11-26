// Flat drawing of AI console notes on 2D canvases (UV Wrapper map, Movement
// preview). Notes are display only; the model is never touched.

const cursorSvg = svg => `url("data:image/svg+xml,${encodeURIComponent(svg)}") 12 12, crosshair`;
const PEN_CURSOR = cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="3" fill="#fff" stroke="#000" stroke-width="1.2"/></svg>');
export const SKETCH_CURSORS = {
  pen: PEN_CURSOR,
  arrow: PEN_CURSOR,
  hold: PEN_CURSOR,
  hit: PEN_CURSOR,
  marker: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="8" fill="#ffd60a66" stroke="#000" stroke-width="1"/><circle cx="12" cy="12" r="1.2" fill="#000"/></svg>'),
  eraser: cursorSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="10" fill="#ffffff55" stroke="#000" stroke-width="1.2" stroke-dasharray="3 2"/></svg>'),
};

export const SKETCH_PEN_PIXELS = 3.2;
export const SKETCH_MARKER_PIXELS = 18;
export const SKETCH_ERASE_PIXELS = 14;
export const SKETCH_SPACING_PIXELS = 2.5;

function line(context, points) {
  context.beginPath();
  points.forEach(([x, y], i) => (i ? context.lineTo(x, y) : context.moveTo(x, y)));
  if (points.length === 1) context.lineTo(points[0][0] + 0.01, points[0][1]);
  context.stroke();
}

function arrowHead(context, points, size) {
  const tip = points.at(-1);
  // Aim from a point a little way back, so a wobble at the very end does not swing the head.
  let from = points[0];
  for (let i = points.length - 2; i >= 0; i--)
    if (Math.hypot(tip[0] - points[i][0], tip[1] - points[i][1]) >= size * 1.5) {
      from = points[i];
      break;
    }
  const angle = Math.atan2(tip[1] - from[1], tip[0] - from[0]);
  context.beginPath();
  context.moveTo(tip[0], tip[1]);
  context.lineTo(tip[0] - size * Math.cos(angle - 0.45), tip[1] - size * Math.sin(angle - 0.45));
  context.lineTo(tip[0] - size * Math.cos(angle + 0.45), tip[1] - size * Math.sin(angle + 0.45));
  context.closePath();
  context.fill();
}

function holdPin(context, [x, y]) {
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, 9, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.arc(x, y, 4, 0, Math.PI * 2);
  context.fill();
  context.beginPath();
  context.moveTo(x, y + 9);
  context.lineTo(x, y + 17);
  context.moveTo(x - 6, y + 17);
  context.lineTo(x + 6, y + 17);
  context.stroke();
}

function hitBurst(context, [x, y]) {
  context.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 ? 5 : 13,
      a = (i * Math.PI) / 8;
    context[i ? 'lineTo' : 'moveTo'](x + r * Math.cos(a), y + r * Math.sin(a));
  }
  context.closePath();
  context.fill();
  context.stroke();
}

/**
 * Draw notes already projected to screen points. Each item: { tool, colorValue,
 * screen: [[x, y], ...], width (marker, px), alpha, ticks: [[x, y], ...] }.
 */
export function drawSketchNotes(context, items) {
  context.save();
  context.lineCap = context.lineJoin = 'round';
  for (const item of items) {
    if (!item.screen?.length) continue;
    context.globalAlpha = item.alpha ?? 1;
    context.strokeStyle = context.fillStyle = item.colorValue;
    if (item.tool === 'marker') {
      context.globalAlpha = (item.alpha ?? 1) * 0.45;
      context.lineWidth = item.width || SKETCH_MARKER_PIXELS;
      line(context, item.screen);
      continue;
    }
    if (item.tool === 'hold' || item.tool === 'hit') {
      context.strokeStyle = '#000';
      context.lineWidth = 1;
      if (item.tool === 'hit') hitBurst(context, item.screen[0]);
      else {
        context.strokeStyle = item.colorValue;
        holdPin(context, item.screen[0]);
      }
      if (item.label) {
        context.font = '11px sans-serif';
        context.fillStyle = '#fff';
        context.strokeStyle = '#000';
        context.lineWidth = 3;
        context.strokeText(item.label, item.screen[0][0] + 14, item.screen[0][1] - 8);
        context.fillText(item.label, item.screen[0][0] + 14, item.screen[0][1] - 8);
      }
      continue;
    }
    // A dark edge keeps a line readable on any texture or background.
    context.strokeStyle = '#000';
    context.globalAlpha = (item.alpha ?? 1) * 0.5;
    context.lineWidth = SKETCH_PEN_PIXELS + 2;
    line(context, item.screen);
    context.globalAlpha = item.alpha ?? 1;
    context.strokeStyle = item.colorValue;
    context.lineWidth = SKETCH_PEN_PIXELS;
    line(context, item.screen);
    if (item.tool === 'arrow' && item.screen.length > 1) {
      arrowHead(context, item.screen, 13);
      // Spacing ticks: equal steps of time, so close ticks mean slow and far ticks fast.
      for (const [x, y] of item.ticks || []) {
        context.beginPath();
        context.arc(x, y, 2.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    if (item.label) {
      const [x, y] = item.screen[0];
      context.font = '11px sans-serif';
      context.fillStyle = '#fff';
      context.strokeStyle = '#000';
      context.lineWidth = 3;
      context.strokeText(item.label, x + 8, y - 8);
      context.fillText(item.label, x + 8, y - 8);
    }
  }
  context.restore();
}

/** Whether a screen point is within reach of a note's projected points. */
export function noteNearPoint(item, x, y, reach = SKETCH_ERASE_PIXELS) {
  const extra = item.tool === 'marker' ? reach * 0.6 : item.tool === 'hold' || item.tool === 'hit' ? 8 : 0;
  return item.screen.some(([px, py]) => Math.hypot(px - x, py - y) <= reach + extra);
}
