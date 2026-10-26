// Runs inside rotation-interaction's hidden production package and isolated profile.
module.exports = async function rotationLocal({ app, page, check, settle, snap, menu, waitMatrix }) {
  const { ObjectLoader, Quaternion, Vector3, Matrix4 } = await import('three');
  const { projectMovementNodes, movementAxisHandles } = await import('../app/movement-overlay.js');
  const { projectPoseHandles } = await import('../app/pose-overlay.js');
  await page.evaluate(() => {
    window.rotationController = () => {
      const el = document.querySelector('.movement-controller');
      for (let fiber = el?.[Object.keys(el).find(key => key.startsWith('__reactFiber'))]; fiber; fiber = fiber.return) {
        if (fiber.memoizedProps?.onTransformSpace) return fiber.memoizedProps;
      }
      throw Error('Movement controller missing');
    };
  });
  // Local has no visible switch. Use its existing controller setter only for
  // setup; all measured rotations below use real canvas pointer gestures.
  await page.evaluate(() => rotationController().onTransformSpace('local'));
  const configure = async behavior => {
    await menu('settings'); const d = page.getByRole('dialog', { name: 'Settings', exact: true });
    await d.getByRole('tab', { name: 'Mouse', exact: true }).click();
    await d.getByRole('navigation', { name: 'Mouse pages' }).getByRole('button', { name: 'Rotation', exact: true }).click();
    await d.getByLabel('Rotation editor', { exact: true }).selectOption('movement');
    await d.getByLabel('Rotational Behavior', { exact: true }).selectOption(behavior);
    await d.getByLabel('Use default rotation sensitivity').check();
    await d.getByRole('button', { name: 'Close Settings', exact: true }).click(); await settle();
  };
  const workplane = page.getByLabel('Workplane', { exact: true });
  const controls = async () => {
    const data = await page.evaluate(() => {
      const { runtime, props } = rotationProbe(), canvas = document.querySelector('[data-clean-model-canvas]');
      return { camera: runtime.controls.object.toJSON(), model: props.model, pose: props.poseConfig,
        frame: runtime.native.getFrame(), sequence: props.sequenceIndex, width: canvas.clientWidth, height: canvas.clientHeight,
        radius: runtime.captureApi.showcaseView().radius, space: props.transformSpace };
    });
    const camera = new ObjectLoader().parse(data.camera); camera.updateMatrixWorld(true); camera.updateProjectionMatrix();
    const active = data.pose?.enabled
      ? projectPoseHandles(data.model, data.pose, data.frame, data.sequence, camera, data.width, data.height, data.frame, undefined, undefined, 'rotate').find(h => h.selected)
      : projectMovementNodes(data.model, data.frame, data.sequence, camera, data.width, data.height).find(h => h.node.ObjectId === 0);
    return { active, view: camera.getWorldDirection(new Vector3()), space: data.space,
      handle: movementAxisHandles(active, camera, data.width, data.height, data.radius, data.space, 'rotate').find(h => h.axis === 'X') };
  };
  const rotate = async (label, behavior, plane = false, local = true) => {
    await configure(behavior); await workplane.setChecked(plane);
    if (plane) await page.locator('[data-hotkey="plane:yz"]').check();
    await page.getByLabel('View direction', { exact: true }).selectOption('perspective'); await settle();
    const { active, handle, view, space } = await controls(), before = await snap();
    const box = await page.locator('[data-clean-model-canvas]').boundingBox();
    const start = plane ? { x: active.x + 120, y: active.y + 40 } : handle;
    const x = Math.round(box.x + start.x), y = Math.round(box.y + start.y);
    const px = x - box.x - active.x, py = y - box.y - active.y;
    check(label + ' fixture has Local axes and a reversed X axis', space === 'local' && active.rotation.clone().normalize().dot(new Quaternion(0, 1, 0, 0)) ** 2 > .999 && Math.hypot(px, py) >= 12);
    await page.mouse.move(x, y); await page.mouse.down();
    for (let step = 1; step <= 12; step++) {
      const angle = step * Math.PI / 24;
      await page.mouse.move(behavior === 'pivot' ? box.x + active.x + px * Math.cos(angle) - py * Math.sin(angle) : x + step * 2.5,
        behavior === 'pivot' ? box.y + active.y + px * Math.sin(angle) + py * Math.cos(angle) : y);
    }
    await page.mouse.up(); await settle(); const after = await snap();
    const baseline = new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(before.matrix)).normalize();
    const actual = new Quaternion().setFromRotationMatrix(new Matrix4().fromArray(after.matrix)).normalize();
    const axis = new Vector3(1, 0, 0); if (local) axis.applyQuaternion(baseline);
    const angle = behavior === 'pivot' ? Math.sign(axis.dot(view)) * Math.PI / 2 : Math.PI / 6;
    const expected = new Quaternion().setFromAxisAngle(axis, angle).multiply(baseline);
    check(label + (behavior === 'pivot' ? ' follows the clockwise mouse quarter-circle' : ' keeps the Linear 30 degree rule'), Math.abs(actual.dot(expected)) > 1 - 1e-4,
      { actual: actual.toArray(), expected: expected.toArray(), cameraDirection: view.toArray() });
    check(label + ' commits one Undo step and preserves other data', after.undo === before.undo + 1 && after.preserved === before.preserved);
    if (after.undo > before.undo) { await menu('undo'); await settle(); await waitMatrix(before.matrix); }
    check(label + ' exact Undo', (await snap()).model === before.model);
  };
  await rotate('Movement Local Pivot', 'pivot');
  await rotate('Movement Local Linear', 'linear');
  await rotate('Movement workplane uses World normal', 'pivot', true, false);
  // A minimal isolated POSE fixture tests input dispatch without changing solvers.
  for (const kind of ['body', 'node']) {
    await page.evaluate(kind => {
      const p = rotationController();
      p.onPoseChange({ ...p.poseConfig, enabled: true, restrict: false, chains: [], pins: [], body: kind === 'body' ? 0 : 1,
        nodes: [0], target: kind === 'body' ? { kind } : { kind, id: 0 }, picking: null });
    }, kind);
    await page.getByRole('group', { name: 'Movement tool', exact: true }).getByRole('button', { name: 'Rotate', exact: true }).click(); await settle();
    await rotate('POSE ' + kind + ' Local Pivot', 'pivot');
    await rotate('POSE ' + kind + ' Local workplane Pivot', 'pivot', true);
  }
  await page.evaluate(() => { const p = rotationController(); p.onPoseChange({ ...p.poseConfig, enabled: false, target: null }); p.onTransformSpace('world'); });
  await workplane.uncheck(); await configure('');
};
