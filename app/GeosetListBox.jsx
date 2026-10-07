import React, { useRef, useState } from 'react';
import './geoset-list-box.css';

export default function GeosetListBox({ children, overlay }) {
  const list = useRef(null), drag = useRef(null);
  const [height, setHeight] = useState(null);
  const stop = event => {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
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
        setHeight(Math.max(drag.current.minimum, drag.current.height + event.clientY - drag.current.y));
        event.preventDefault(); event.stopPropagation();
      }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={() => { drag.current = null; }}><span/></div>
  </div>;
}
