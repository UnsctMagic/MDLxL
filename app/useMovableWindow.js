import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createFrameCoalescer } from './viewport-performance.js';

/** Move the actual dialog by its title bar; controls keep their normal clicks. */
export default function useMovableWindow(ref, { contained = false, position: suppliedPosition, onPositionChange } = {}) {
  const [localPosition, setLocalPosition] = useState(null), drag = useRef(null);
  const position = suppliedPosition === undefined ? localPosition : suppliedPosition;
  const setPosition = onPositionChange || setLocalPosition;
  const clamp = (left, top) => {
    const element = ref.current, view = element?.ownerDocument.defaultView;
    const box = element?.getBoundingClientRect(), owner = contained ? element?.offsetParent?.getBoundingClientRect() : view;
    if (!box || !owner) return { left, top };
    const menu = parseFloat(view.getComputedStyle(element).getPropertyValue('--desktop-menu-height')) || 0;
    const topLimit = Math.max(0, menu - (contained ? owner.top : 0));
    return {
      left: Math.max(0, Math.min(left, (contained ? owner.width : owner.innerWidth) - box.width)),
      top: Math.max(topLimit, Math.min(top, (contained ? owner.height : owner.innerHeight) - box.height)),
    };
  };
  // The window follows the pointer once per frame, not on every pointer event.
  const follow = useRef(null), frame = useRef(null);
  follow.current = () => {
    const point = drag.current?.point; if (!point || !ref.current) return;
    const bounds = contained ? ref.current.offsetParent.getBoundingClientRect() : { left: 0, top: 0 };
    setPosition(clamp(point.x - bounds.left - drag.current.x, point.y - bounds.top - drag.current.y));
  };
  frame.current ||= createFrameCoalescer(() => follow.current());
  useEffect(() => () => frame.current.cancel(), []);
  useLayoutEffect(() => {
    if (!position) return;
    const next = clamp(position.left, position.top);
    if (next.left !== position.left || next.top !== position.top) setPosition(next);
  }, [position?.left, position?.top]);
  useEffect(() => {
    const owner = ref.current?.ownerDocument.defaultView;
    const resize = () => setPosition(old => old && clamp(old.left, old.top));
    owner?.addEventListener('resize', resize);
    return () => owner?.removeEventListener('resize', resize);
  }, []);
  return {
    style: position ? { position: contained ? 'absolute' : 'fixed', ...position, margin: 0, transform: 'none' } : undefined,
    handleProps: {
      style: { cursor: 'move', touchAction: 'none', userSelect: 'none' },
      onPointerDown: event => {
        if (event.button !== 0 || event.target.closest('button,input,select,a')) return;
        const box = ref.current.getBoundingClientRect();
        drag.current = { x: event.clientX - box.left, y: event.clientY - box.top };
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: event => { if (drag.current) { drag.current.point = { x: event.clientX, y: event.clientY }; frame.current.schedule(); } },
      onPointerUp: event => { frame.current.flush(); drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
      onPointerCancel: () => { frame.current.cancel(); drag.current = null; },
    },
  };
}
