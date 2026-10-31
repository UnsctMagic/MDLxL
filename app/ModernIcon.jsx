import React from 'react';
import ToolIcon from './ToolIcon.jsx';

// The classic button names (public/classic) drawn with the shared ToolIcon set.
const icons = Object.freeze({
  'new-document': 'new', sb_open: 'open', sb_save: 'save', sb_select: 'select',
  sb_move: 'move', sb_rot: 'rotate', sb_zoom: 'scale', sb_cross: 'work',
  sb_undo: 'undo', sb_redo: 'redo', sb_copy: 'copy', sb_paste: 'paste',
  sb_del: 'delete', sb_mirror: 'mirror', b_extrude: 'extrude', b_detach: 'detach',
  sb_triangle: 'triangle', sb_deltr: 'deleteTriangles', sb_uncouple: 'uncouple', sb_nrot: 'normalRotate',
  sb_nsmooth: 'smoothNormals', sb_nrestore: 'restoreNormals', sb_selbone: 'bone', sb_bonemove: 'move',
  sb_bonerot: 'rotate', sb_bonescale: 'scale', sb_play: 'play', sb_stop: 'stop',
  sb_begattach: 'boneAttach', sb_vattach: 'boneAttach', sb_endattach: 'boneDetach', sb_vdetach: 'boneDetach',
  sb_animcopy: 'copy', sb_animpaste: 'paste',
  // The UV Wrapper tool row.
  uv_select: 'select', uv_move: 'move', uv_rotate: 'rotate', uv_scale: 'scale',
  uv_mirrorX: 'mirrorX', uv_mirrorY: 'mirrorY', uv_uncouple: 'uncouple', uv_fold: 'fold',
});

export function hasModernIcon(name) { return !!icons[name]; }

export default function ModernIcon({ name, flip = false }) {
  const resolved = flip && name === 'sb_undo' ? 'sb_redo' : name;
  return icons[resolved] ? <ToolIcon name={icons[resolved]} className="modern-retro-icon"/> : null;
}
