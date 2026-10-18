import React from 'react';

// Long names keep their last characters (version, extension) visible, since many models share a prefix.
function TabName({ name }) {
  return name.length > 14 ? <span className="model-tab-name"><span>{name.slice(0, -8)}</span><span>{name.slice(-8)}</span></span> : <span className="model-tab-name"><span>{name}</span></span>;
}

/**
 * The strip of open model tabs. Tabs shrink to a compact width with an ellipsis;
 * when they still do not fit, the strip scrolls with the mouse wheel or the two
 * small arrows that appear only then. The active tab is always scrolled into view.
 */
export default function ModelTabs({ sessions, session, activateSession, sessionDirty, requestCloseSession }) {
  const strip = React.useRef(null);
  const [scroll, setScroll] = React.useState({ overflow: false, start: true, end: true });
  const measure = React.useCallback(() => {
    const element = strip.current;
    if (!element) return;
    const overflow = element.scrollWidth > element.clientWidth + 1;
    const start = element.scrollLeft <= 1, end = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    setScroll(previous => previous.overflow === overflow && previous.start === start && previous.end === end ? previous : { overflow, start, end });
  }, []);
  React.useEffect(() => {
    const element = strip.current;
    if (!element) return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    for (const tab of element.children) observer.observe(tab);
    return () => observer.disconnect();
  }, [measure, sessions]);
  // Reveal the active tab; rerun when the arrows appear, since they narrow the strip.
  React.useLayoutEffect(() => {
    const element = strip.current, tab = element?.querySelector('.model-tab.active');
    if (!tab) return;
    // Scroll only the strip (it is the tabs' offsetParent); scrollIntoView could also shift the clipped page.
    const left = tab.offsetLeft, right = left + tab.offsetWidth;
    if (left < element.scrollLeft) element.scrollLeft = left;
    else if (right > element.scrollLeft + element.clientWidth) element.scrollLeft = right - element.clientWidth;
    measure();
  }, [session, sessions, measure, scroll.overflow]);
  const scrollBy = direction => {
    const element = strip.current;
    if (element) element.scrollLeft += direction * Math.max(80, element.clientWidth * .6);
  };
  return <div className="model-tabs-bar">
    <div ref={strip} className="model-tabs" role="tablist" aria-label="Open models" onScroll={measure} onWheel={event => { if (strip.current) strip.current.scrollLeft += event.deltaY || event.deltaX; }}>{sessions.map(item => <div className={`model-tab${item === session ? ' active' : ''}`} key={item.id}><button type="button" role="tab" aria-selected={item === session} title={item.path || item.doc.name} onClick={() => activateSession(item)}><span className="model-tab-dirty" aria-hidden="true">{sessionDirty(item) ? '●' : ''}</span><TabName name={item.doc.name}/></button><button type="button" className="model-tab-close" aria-label={`Close ${item.doc.name}`} title={`Close ${item.doc.name}`} onClick={event => { event.stopPropagation(); requestCloseSession(item); }}>×</button></div>)}</div>
    {scroll.overflow && <><button type="button" className="model-tabs-scroll previous" title="Scroll model tabs left" aria-label="Scroll model tabs left" disabled={scroll.start} onClick={() => scrollBy(-1)}>◀</button><button type="button" className="model-tabs-scroll next" title="Scroll model tabs right" aria-label="Scroll model tabs right" disabled={scroll.end} onClick={() => scrollBy(1)}>▶</button></>}
  </div>;
}
