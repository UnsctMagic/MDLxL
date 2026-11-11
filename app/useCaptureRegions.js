import { useEffect } from 'react';
import { desktop } from './desktop.js';

export function useCaptureRegions(viewport, toolbox, enabled) {
  useEffect(() => {
    if (!desktop?.setCaptureRegions) return;
    if (!enabled) {
      desktop.setCaptureRegions(Array(8).fill(0));
      return;
    }

    const regions = [viewport.current, toolbox.current];
    const send = () => {
      const scale = window.devicePixelRatio;
      desktop.setCaptureRegions(regions.flatMap(region => {
        if (!region) return [0, 0, 0, 0];
        const { left, top, right, bottom } = region.getBoundingClientRect();
        return [left, top, right, bottom].map(edge => Math.max(0, Math.round(edge * scale)));
      }));
    };
    let resolution;
    const watchResolution = () => {
      resolution?.removeEventListener('change', watchResolution);
      resolution = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      resolution.addEventListener('change', watchResolution);
      send();
    };
    const observer = new ResizeObserver(send);
    for (const region of regions) if (region) observer.observe(region);
    window.addEventListener('resize', send);
    watchResolution();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', send);
      resolution.removeEventListener('change', watchResolution);
    };
  }, [viewport, toolbox, enabled]);
}
