# MDLxL 0.19.0 — Forge、Shape 与编辑器改进

- **Forge：**使用直观的形状按钮，可调整尺寸、厚度和适度的复杂度。立方体最低为 12 个三角形。普通形状的每个三角形显示完整的 BTNTemp 图标。ThumperXL 取代 Monkey，以黑灰色 MDLxL 头盔和红色三角形眼睛呈现。Projector 用于纹理和本地图片，裁切与边框选项按需展开。
- **SHAPE：**打开后立即预览中部弯曲。选择 Curve、Fold、Twist、Dome、Roll 或 Taper，调整 Amount、Across/Up-down、Reverse 与 Start/Middle/End。简单平面自动获得必要的支撑行。Original 和 Reset 便于比较；顶点中心、精确轴和局部影响位于 More controls。
- **BITZ：**Replace Part 默认打开 Quad View 放置，并继承骨骼绑定。支持移动、旋转、缩放、缩放视图及 Normal View 工作平面。收集的零件保留各动画的 RGB 调色信息。库中只显示模型及相关文件夹，隐藏纹理文件夹杂项。
- **Sort My Mess：**在材质和纹理管理器中直观合并资源，提供独立的 Before/After 预览及 RGB、队伍颜色、渲染差异选择。完成后可一步撤销。
- **UV Wrapper：**临时纹理不再阻止正常顶点与三角形编辑。Revert texture 保留几何和 UV 修改。替换纹理时保留原有材质设置，并提供直接过滤模式。队伍颜色不再覆盖 UV 背景，初始滚动速度提高 30%。
- **EMTR：**库效果以独立副本打开。纹理路径冲突时，为新图片分配独立名称，保留现有图片字节。
- **编辑器：**几何组列表可垂直调整。Animations 显示粒子和飘带而不显示编辑标记，并遵循原有可见性动画。
- **GIF：**临时帧保存在录制目标磁盘，避免系统临时磁盘空间不足导致失败。

包含 PR #111–#116 和 #118–#123。PR #117 的便携自动更新功能已撤回，不包含在此版本中。

下载 **MDLxL-0.19.0-win32-x64.zip**，完整解压并运行 **MDLxL.exe**。请将各文件夹保留在一起。FFmpeg 对应源码另以压缩包提供。
