const visible = point => point?.every(Number.isFinite) && point[2] >= -1 && point[2] <= 1;
/** Draw a collision snapshot (collision-stage.js) onto an existing preview overlay. No model edits. */
export function drawCollisionShapes(ctx, snapshot) {
  ctx.save(); ctx.strokeStyle = '#51d7ff';
  for (const row of snapshot.rows) for (const [lines, width, alpha] of [[row.guides, 1, .45], [row.outlines, 1.5, 1]]) {
    ctx.lineWidth = width; ctx.globalAlpha = alpha;
    for (const line of lines) {
      ctx.beginPath(); let connected = false;
      for (const p of line) {
        if (!visible(p)) { connected = false; continue; }
        if (connected) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        connected = true;
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}
