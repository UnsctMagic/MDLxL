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

test('Bones picked in Movement or Bones do not take Visibility & Color from the checked geosets', () => {
  const app = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
  // Entering Animations parks the carried bones; leaving gives them back.
  assert.match(app, /if \(panel === 'animations' && !\(mode === 'animation' && animationPanel === 'animations'\)\) parkNodeSelection\(\);/);
  assert.match(app, /if \(panel === 'movement' && !returnParkedNodes\(\) && !selectedNodeIds\.length/);
  assert.match(app, /if \(next !== 'animation'\) returnParkedNodes\(\);/);
  // Neither step is an undo entry.
  assert.match(app, /session\.parkedNodeIds = selectedNodeIds; poseSelectionOnly\.current = true;/);
  assert.match(app, /poseSelectionOnly\.current = true; setSelectedNodeIdsState\(ids\);/);
});
