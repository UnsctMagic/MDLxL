import React, { useEffect, useRef, useState } from 'react';
import { createFrameCoalescer } from './viewport-performance.js';
import './geoset-list-box.css';

export default function GeosetListBox({ children, overlay }) {
  const list = useRef(null), drag = useRef(null);
  const [height, setHeight] = useState(null), frame = useRef(null);
  // A drag records the pointer; the list height changes once per frame. Frames come from
  // the list's own window: OptimizeXL shows it in a separate window.
  const owner = () => list.current?.ownerDocument.defaultView || window;
  frame.current ||= createFrameCoalescer(() => { const d = drag.current; if (d?.to !== undefined) setHeight(Math.max(d.minimum, d.height + d.to - d.y)); },
    { request: callback => owner().requestAnimationFrame(callback), cancel: id => owner().cancelAnimationFrame(id) });
  useEffect(() => () => frame.current.cancel(), []);
  const stop = event => {
    if (drag.current?.pointerId !== event.pointerId) return;
    frame.current.flush(); drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="geoset-tab-box geoset-list-box">
    {React.cloneElement(children, { ref: list, style: { ...children.props.style, ...(height === null ? {} : { height, maxHeight: 'none' }) } })}
    {overlay}
    <div className="geoset-list-resize" role="separator" aria-label="Resize geoset list" aria-orientation="horizontal" title="Drag down for more geoset space"
      onPointerDown={event => {
        if (event.button !== 0) return;
        const element = list.current;
        drag.current = { pointerId: event.pointerId, y: event.clientY, height: element.getBoundingClientRect().height, minimum: parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).minHeight) || 0 };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault(); event.stopPropagation();
      }}
      onPointerMove={event => {
        if (drag.current?.pointerId !== event.pointerId) return;
        drag.current.to = event.clientY; frame.current.schedule();
        event.preventDefault(); event.stopPropagation();
      }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { frame.current.flush(); drag.current = null; }}><span/></div>
  </div>;
}
