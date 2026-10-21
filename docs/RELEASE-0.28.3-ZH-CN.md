# MDLxL 0.28.3 - 热修复

**修复**

- Collect Bit：当 BitsAndParts 中同一路径已存在不同纹理时，保存不再失败。收集的部件只保存 MDX，并完整保留源模型中的原始纹理路径，不复制或覆盖纹理文件。
- 即使纹理尚未加载，也可以收集部件。几何体、材质、UV 和 RGB 动画轨道均保持不变。

**更新**  在 0.28.2 中打开 Settings > Configuration > Search for updates > Update and restart。
