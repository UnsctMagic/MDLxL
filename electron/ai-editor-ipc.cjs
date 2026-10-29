const path = require('node:path');
const { CANCELLED } = require('./ai-providers.cjs');

function registerAiEditorIpc(service, getWindow, handle) {
  const { readModel, writeModel } = service;
  handle('ai:capture', async rect => {
    if (rect && !['x', 'y', 'width', 'height'].every(k => Number.isInteger(rect[k]) && rect[k] >= 0))
      throw Error('Invalid capture rectangle.');
    return (await getWindow().webContents.capturePage(rect)).toDataURL();
  });
  handle('ai:gesture', async ({ requestId, points, button = 'left', modifiers = [] }) => {
    const request = service.pending.get(requestId),
      win = getWindow();
    if (!request) throw Error('The input request is no longer active.');
    const [width, height] = win.getContentSize();
    if (
      !Array.isArray(points) ||
      !points.length ||
      points.length > 300 ||
      points.some(
        p =>
          !Array.isArray(p) ||
          p.length !== 2 ||
          p.some((v, i) => !Number.isInteger(v) || v < 0 || v >= (i ? height : width)),
      )
    )
      throw Error('Invalid editor gesture.');
    if (
      !['left', 'middle', 'right'].includes(button) ||
      modifiers.some(m => !['shift', 'control', 'alt', 'meta'].includes(m))
    )
      throw Error('Invalid mouse button or modifiers.');
    const mouse = (type, point) =>
      win.webContents.sendInputEvent({
        type,
        x: point[0],
        y: point[1],
        button,
        clickCount: 1,
        modifiers: [...modifiers, ...(type === 'mouseMove' ? [button + 'buttondown'] : [])],
      });
    let last = points[0];
    if (request.signal?.aborted) throw Error(CANCELLED);
    mouse('mouseMove', last);
    mouse('mouseDown', last);
    try {
      for (const point of points.slice(1)) {
        if (request.signal?.aborted) throw Error(CANCELLED);
        last = point;
        mouse('mouseMove', point);
        await new Promise(resolve => setTimeout(resolve, 16));
      }
    } finally {
      if (!win.isDestroyed()) mouse('mouseUp', last);
    }
    return { performed: true };
  });
  handle('ai:readModel', async ({ path: file }) => {
    if (!path.isAbsolute(file || '') || !['.mdx', '.mdl'].includes(path.extname(file).toLowerCase()))
      throw Error('Choose an absolute MDL or MDX path.');
    return readModel(file);
  });
  handle('ai:writeModel', async ({ path: file, bytes, overwrite, format, forgeAssets }) => {
    if (!path.isAbsolute(file || '') || !['.mdx', '.mdl'].includes(path.extname(file).toLowerCase()))
      throw Error('Choose an absolute MDL or MDX output path.');
    return writeModel({
      path: file,
      bytes,
      format,
      forgeAssets,
      overwrite: overwrite === true,
      export: true,
    });
  });
}

module.exports = { registerAiEditorIpc };
