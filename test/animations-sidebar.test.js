import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Rotate camera mode carried in from another tab keeps the Animations controls', () => {
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  const sidebar = readFileSync(new URL('../app/AppSidebar.jsx', import.meta.url), 'utf8');
  // Only a live camera drag swaps the Animations controls for the geoset list.
  assert.match(sidebar, /mode === 'animation' && \(!cameraGesture \|\| animationPanel === 'movement'\)/);
  assert.match(app, /\(mode !== 'animation' \|\| animationPanel === 'movement' \|\| cameraGesture\) && geosetPicker/);
  assert.doesNotMatch(sidebar, /!cameraRotating \|\| animationPanel/);
  // Switching between Movement and Animations ends any unfinished drag.
  assert.match(app, /useEffect\(\(\)=>setCameraGesture\(false\),\[animationPanel\]\);/);
});
