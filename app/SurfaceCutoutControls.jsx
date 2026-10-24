import React from 'react';

export default function SurfaceCutoutControls({ tool }) {
  const { plan, seeds } = tool;
  return <div className="uv-cutout-popup" role="dialog" aria-label="Low-poly cutout">
    <div className="uv-cutout-row"><strong>Low-poly cutout</strong>
      <select aria-label="Cutout draw mode" value={tool.mode} onChange={event => { tool.setMode(event.target.value); tool.onContour([]); }}>
        <option value="lasso">Lasso</option><option value="polygon">Polygon</option><option value="ellipse">Ellipse</option>
      </select>
      <select aria-label="Cutout outline" title="Auto compares total triangle counts within the texel tolerance. Corners sets a reviewed complexity budget." value={tool.outlineMode} onChange={event => tool.setOutlineMode(event.target.value)}><option value="auto">Auto</option><option value="corners">Corners</option></select>
      {(tool.outlineMode === 'corners' || tool.mode === 'ellipse') && <input aria-label="Cutout corners" type="number" min="3" max="32" value={tool.corners} onChange={event => { tool.setCorners(Math.max(3, Math.min(32, Number(event.target.value) || 8))); tool.onContour([]); }}/>}
      <button onClick={tool.cancel}>Cancel</button><button className="primary" disabled={plan?.status !== 'ready' || plan.needsApproximation && !tool.accepted} onClick={tool.apply}>Cut &amp; Separate</button>
    </div>
    <p>{seeds.length ? seeds.map(s => 'Geoset ' + (s.index + 1) + ' / face ' + (s.triangleIndex + 1)).join(' · ') : 'Pick the intended surface in the live model preview.'}</p>
    <p>{tool.mode === 'polygon' ? 'Click corners. Click the first point or press Enter to finish. Backspace removes a point.' : tool.mode === 'lasso' ? 'Draw around the patch. Release to close it.' : 'Drag around the detail to set an ellipse.'}</p>
    {plan && <output aria-label="Cutout triangle counts">{plan.statistics.extractedTriangles} piece triangles · +{plan.statistics.netTriangleIncrease} total triangles</output>}
    {tool.error && <p role="status" data-alert="">{tool.error}</p>}
    {plan?.motion && <p role="status">Sampled rig deviation: {plan.motion.maximumError.toFixed(4)} model units across {plan.motion.schedule.length} poses. Sampling does not guarantee every animation frame.</p>}
    {plan?.needsApproximation && <label><input aria-label="Accept sampled rig approximation" type="checkbox" checked={tool.accepted} onChange={event => tool.setAccepted(event.target.checked)}/>Accept sampled rig approximation</label>}
    {plan?.status === 'ready' && <div className="uv-cutout-row">
      <select aria-label="Cutout inspection view" value={tool.view} onChange={event => tool.setView(event.target.value)}><option value="all">Assembled model</option><option value="source">Remaining surface only</option><option value="piece">Cutout only</option></select>
      <label><input type="checkbox" checked={tool.contrast} onChange={event => tool.setContrast(event.target.checked)}/>Contrast preview</label>
      <label><input type="checkbox" checked={tool.wires} onChange={event => tool.setWires(event.target.checked)}/>Wireframe</label>
    </div>}
    <details><summary>Cutout settings</summary><div className="uv-cutout-row">
      <label title="Repeat the outline only on surfaces you explicitly pick."><input type="checkbox" checked={tool.addSurface} onChange={event => tool.setAddSurface(event.target.checked)}/>Add picked surface</label>
      <label title="Maximum two-sided outline deviation in native texture pixels, independent of zoom.">Texel tolerance <input aria-label="Cutout texel tolerance" type="number" min=".01" max="16" step=".1" value={tool.tolerance} onChange={event => tool.setTolerance(Math.max(.01, Number(event.target.value) || .5))}/></label>
      <label title="Keep alpha and death visibility. Only the new piece's RGB becomes neutral."><input type="checkbox" checked={tool.untinted} onChange={event => tool.setUntinted(event.target.checked)}/>Keep extracted piece untinted</label>
      <label title="Strict mode stops on mixed bindings. Approximation uses an existing corner binding and requires review of measured motion deviation."><input type="checkbox" checked={tool.approximate} onChange={event => tool.setApproximate(event.target.checked)}/>Approximate existing rig</label>
    </div></details>
  </div>;
}
