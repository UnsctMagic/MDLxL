import { useEffect, useState } from 'react';
import { normalizeBackdropLook } from './portrait-background.js';

export default function usePortraitState(sessionId) {
  const [portraitEnabled, setPortraitEnabled] = useState(false), [portraitCameraIndex, setPortraitCameraIndex] = useState(0);
  const [controlModelIds, setControlModelIds] = useState([]);
  const [controlModelGroup, setControlModelGroup] = useState('all');
  useEffect(() => { setControlModelGroup('all'); setControlModelIds([]); }, [sessionId]);
  useEffect(() => { setPortraitCameraIndex(0); setPortraitPreviewChanged(false); }, [sessionId]);
  const [portraitSnapRevision, setPortraitSnapRevision] = useState(0);
  const [portraitSettings, setPortraitSettings] = useState({ lighting: true, dncLights: false, composition: false, thirds: false, mask: .65 });
  const [portraitPreviewChanged, setPortraitPreviewChanged] = useState(false), [portraitLightingStatus, setPortraitLightingStatus] = useState('');
  // The last look placed from Background options also shapes the next Add.
  const lastBackdropLook = () => { try { return normalizeBackdropLook(JSON.parse(localStorage.getItem('mdlxl-portrait-background-look') || 'null')); } catch { return normalizeBackdropLook(null); } };
  const rememberBackdropLook = look => {
    if (look) try { localStorage.setItem('mdlxl-portrait-background-look', JSON.stringify(normalizeBackdropLook(look))); } catch { /* the look still applies now */ }
  };
  return { portraitEnabled, setPortraitEnabled, portraitCameraIndex, setPortraitCameraIndex, portraitSnapRevision, setPortraitSnapRevision, portraitSettings, setPortraitSettings, portraitPreviewChanged, setPortraitPreviewChanged, portraitLightingStatus, setPortraitLightingStatus, controlModelIds, setControlModelIds, controlModelGroup, setControlModelGroup, lastBackdropLook, rememberBackdropLook };
}
