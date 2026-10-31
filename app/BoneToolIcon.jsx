import React from 'react';
import ToolIcon from './ToolIcon.jsx';

// The Bones tab's tools, drawn with the shared ToolIcon set.
const KINDS = Object.freeze({
  delete: 'boneDelete', create: 'boneCreate', attach: 'boneAttach', detach: 'boneDetach',
  soft: 'softBind', hard: 'hardBind', detachVertices: 'detachVertices', bone: 'bone', attachment: 'attachment',
});

export default function BoneToolIcon({ kind, size = 20 }) {
  return <ToolIcon name={KINDS[kind]} size={size}/>;
}
