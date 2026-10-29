import { useEffect, useState } from 'react';
import { defaultPoseDisplay, saveEditorDisplay, storedEditorDisplay } from './display-overlays.js';

export default function useEditorDisplay(visUI, { mode, displayMode, poseViewActive, poseView: savedPoseView, changePoseView, storedWorkplane }) {
  const [xlCleanViews, setXLCleanViews] = useState({}), [visCleanViews, setVISCleanViews] = useState({});
  const [xlOverlayModes, setXLOverlayModes] = useState(()=>storedEditorDisplay()), [visOverlayModes, setVISOverlayModes] = useState(()=>storedEditorDisplay(true));
  useEffect(() => saveEditorDisplay(xlOverlayModes, visOverlayModes), [xlOverlayModes, visOverlayModes]);
  const normalCleanViews = visUI ? visCleanViews : xlCleanViews, setNormalCleanViews = visUI ? setVISCleanViews : setXLCleanViews;
  const normalOverlayModes = visUI ? visOverlayModes : xlOverlayModes, setNormalOverlayModes = visUI ? setVISOverlayModes : setXLOverlayModes;
  const poseView = savedPoseView || { overlays: defaultPoseDisplay(normalOverlayModes.movement), cleanView: false, workplaneEnabled: false, workplane: storedWorkplane };
  const cleanViews = poseViewActive ? { ...normalCleanViews, [mode]: poseView.cleanView } : normalCleanViews;
  const overlayModes = poseViewActive ? { ...normalOverlayModes, [displayMode]: poseView.overlays } : normalOverlayModes;
  const setCleanViews = next => poseViewActive ? changePoseView({ cleanView: (typeof next === 'function' ? next(cleanViews) : next)[mode] }) : setNormalCleanViews(next);
  const setOverlayModes = next => poseViewActive ? changePoseView({ overlays: (typeof next === 'function' ? next(overlayModes) : next)[displayMode] }) : setNormalOverlayModes(next);
  const cleanView = !!cleanViews[mode], storedOverlays = mode === 'showcase' || mode === 'manager' ? {} : cleanView ? Object.fromEntries(Object.keys(overlayModes[displayMode]).map(key => [key, false])) : overlayModes[displayMode];
  const visibleOverlays = visUI ? { ...storedOverlays, bones: true, helpers: true, attachments: true } : storedOverlays;
  const overlays = visibleOverlays.cameras ? { ...visibleOverlays, cameras: false } : visibleOverlays;
  const panelOverlays = overlays;
  return { poseView, cleanViews, overlayModes, setCleanViews, setOverlayModes, cleanView, overlays, panelOverlays };
}
