// The AI's off-screen pictures: the props its hidden preview gets for one picture. Drawing
// happens in app/AiOffscreenRender.jsx; everything here is plain data so it can be tested.

// Render modes a picture can ask for: the surface with its textures, mesh lines only, or plain
// shading (the editor's Surface View: one untextured grey, lit, cut-outs kept).
const PICTURE_MODES = ['textured', 'wireframe', 'solid'];

/** The hidden GamePreview's props for one AI picture job. The preview presentation reads the
 * render mode from previewMode (it overwrites mode), so wireframe and plain pictures set it there. */
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
    previewMode: PICTURE_MODES.includes(job.renderMode) ? job.renderMode : 'textured',
    view: job.view || 'perspective',
    hiddenGeosets: job.hiddenGeosets,
    overlays: { bones: false, nodes: false, particles: false, attachments: false },
  };
}
