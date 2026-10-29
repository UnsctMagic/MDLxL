// Small model builders for source tests (*.test.js). Adopt them when a test is next touched; existing local
// factories stay until then. Key vectors and tangents become Float32Array like parsed models.

// One keyframe. tangents: optional { InTan, OutTan } for Hermite/Bezier tracks.
export const key = (Frame, Vector, tangents = {}) => ({
  Frame, Vector: new Float32Array(Vector),
  ...(tangents.InTan ? { InTan: new Float32Array(tangents.InTan) } : {}),
  ...(tangents.OutTan ? { OutTan: new Float32Array(tangents.OutTan) } : {}),
});

// An animation track. LineType 0 none, 1 linear, 2 Hermite, 3 Bezier.
export const track = (Keys, LineType = 1, GlobalSeqId = null) => ({ Keys, LineType, GlobalSeqId });

export const sequence = (Name, Interval, extra = {}) => ({ Name, Interval, NonLooping: false, MoveSpeed: 0, Rarity: 0, ...extra });

export const bone = (ObjectId, extra = {}) => ({ ObjectId, Name: `Bone${ObjectId}`, Parent: null, PivotPoint: [0, 0, 0], GeosetId: null, GeosetAnimId: null, ...extra });

// The smallest model most animation and movement tests need: one Stand sequence, no geometry.
export const minimalModel = (overrides = {}) => ({
  Version: 800,
  Sequences: [sequence('Stand', [100, 1000])],
  GlobalSequences: [],
  Bones: [], Helpers: [], Attachments: [], Geosets: [], GeosetAnims: [], PivotPoints: [],
  Materials: [], Textures: [], TextureAnims: [],
  ...overrides,
});
