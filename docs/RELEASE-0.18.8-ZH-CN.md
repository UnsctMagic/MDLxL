# MDLxL 0.18.8 — 修复 MDX 保存问题

- 含有空骨骼绑定组的模型现在可以保存为 MDX，不再出现误报的 `Save verification failed: serialization changed ... Geosets[n].Groups` 错误。
- 打开和重新打开 MDX 文件时，会保留空组、组顺序、骨骼 ID 和顶点的骨骼绑定。保存验证仍然启用。
- 包含 0.18.7 的全部更新，以及已合并的 [PR #109](https://github.com/UnsctMagic/MDLxL/pull/109) 中的保存修复。

下载 **MDLxL-0.18.8-win32-x64.zip**，解压整个 ZIP，然后运行 **MDLxL.exe**。请将所有文件夹放在一起。FFmpeg 对应源代码压缩包可在发布页面单独下载。
