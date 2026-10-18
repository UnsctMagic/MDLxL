import { useEffect, useRef, useState } from 'react';

/** Move the actual dialog by its title bar; controls keep their normal clicks. */
export default function useMovableWindow(ref, { contained = false, position: suppliedPosition, onPositionChange } = {}) {
  const [localPosition, setLocalPosition] = useState(null), drag = useRef(null);
  const position = suppliedPosition === undefined ? localPosition : suppliedPosition;
  const setPosition = onPositionChange || setLocalPosition;
  const clamp = (left, top) => {
    const box = ref.current?.getBoundingClientRect(), owner = contained ? ref.current?.offsetParent?.getBoundingClientRect() : ref.current?.ownerDocument.defaultView;
    return box && owner ? { left: Math.max(0, Math.min(left, (contained ? owner.width : owner.innerWidth) - box.width)), top: Math.max(0, Math.min(top, (contained ? owner.height : owner.innerHeight) - box.height)) } : { left, top };
  };
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
      onPointerMove: event => { if (drag.current) { const bounds = contained ? ref.current.offsetParent.getBoundingClientRect() : { left: 0, top: 0 }; setPosition(clamp(event.clientX - bounds.left - drag.current.x, event.clientY - bounds.top - drag.current.y)); } },
      onPointerUp: event => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); },
      onPointerCancel: () => { drag.current = null; },
    },
  };
}
