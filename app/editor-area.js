import { useLayoutEffect } from 'react';

/**
 * Places a tool window over the whole editor area (like the UV Wrapper): under the toolbars, across
 * the viewport and the sidebar (`main.classic-workspace`). It follows that area's size through the
 * CSS variables --xf-x/--xf-y/--xf-w/--xf-h on the window; the window's CSS uses them, so moving or
 * resizing it by hand still wins. Used by Transfer and its pick sheet.
 */
export function useEditorArea(windowRef) {
  useLayoutEffect(() => {
    const element = windowRef.current, area = element?.ownerDocument.querySelector('main.classic-workspace');
    if (!element || !area) return undefined;
    const place = () => { const box = area.getBoundingClientRect(); if (box.width < 200 || box.height < 200) return; for (const [name, value] of [['--xf-x', box.left], ['--xf-y', box.top], ['--xf-w', box.width], ['--xf-h', box.height]]) element.style.setProperty(name, `${Math.round(value)}px`); };
    place();
    const observer = new ResizeObserver(place); observer.observe(area);
    return () => observer.disconnect();
  }, []);
}
