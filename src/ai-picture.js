// The AI's off-screen pictures: the props its hidden preview gets for one picture. Drawing
// happens in app/AiOffscreenRender.jsx; everything here is plain data so it can be tested.

/** The hidden GamePreview's props for one AI picture job. The preview presentation reads the
 * render mode from previewMode (it overwrites mode), so a wireframe picture sets it there. */
export function aiPictureProps(job, { preferences, teamColor } = {}) {
  return {
    presentation: 'preview',
    model: job.model,
    revision: job.revision || 0,
    textureAssets: job.assets,
    modelPath: job.path,
    preferences,
    teamColor,
    sequenceIndex: job.sequence ?? -1,
    globalSeqId: job.globalSequence ?? null,
    time: job.frame || 0,
    playing: false,
    showGrid: false,
    showParticles: job.showParticles,
    mode: job.renderMode || 'textured',
    previewMode: job.renderMode === 'wireframe' ? 'wireframe' : 'textured',
    view: job.view || 'perspective',
    hiddenGeosets: job.hiddenGeosets,
    overlays: { bones: false, nodes: false, particles: false, attachments: false },
  };
}
