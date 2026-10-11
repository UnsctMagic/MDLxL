# MDLxL 0.23.0 - POSE、资源档案与性能

## POSE 与 Movement

- 复制/Ctrl+C 捕获当前帧的完整姿势；粘贴/Ctrl+V 可在另一帧恢复姿势，并通过一次撤销还原。移动手或脚时，可以轻柔地带动相连的身体。
- 肘部和膝部旋转保持手或脚的位置及朝向。Focused Skeleton 显示已映射的控制器和肢体关节。
- Setup 旁的 Restrict 可在移动手或脚时保持身体不动。Pin 更易点击，保持在指针下方，支持空格/Enter，并保留可见的固定标记。
- Controller 默认展开，Highlight KF 和 Highlight Chain 位于 Controller type 下拉框上方。Restrictions 默认折叠。
- 控制器、骨架、操纵器和 Pin 的外观可独立设置。默认使用 Lordaeron；各 Appearance 区域有独立预设选择器，除 Presets 外默认折叠。
- Bones 和 Movement 中的 Multiselect from List 位于 Object 下方，并通过分隔线与详细设置分开。Multiselect 和 Billboarded 提供通俗的悬停说明。
- 各轴和工作平面的旋转拖动响应更一致。可见手柄端点优先被选中，数字旋转仍可用；Escape、窗口失焦或失去指针捕获会取消未完成的编辑。

## Warcraft 资源档案

- 设置 > Warcraft III 可添加并记住 CASC 文件夹和 MPQ 文件，也可单独移除条目。
- 自定义档案的纹理和事件资源优先于已安装游戏数据；模型旁的纹理保持最高优先级。正常的游戏自动发现仍然可用。

## 发射器库与视口

- 发射器库会自动开始或继续未完成的索引。索引在独立进程中运行，会重试 Windows 临时文件锁，并避免随进度反复重载整个目录。
- 后续库页面可加载预览；索引期间从效果返回库仍保持响应。
- 视口 FPS 限制器不再反复跳过显示刷新。动画播放继续使用实际经过的时间。

## 更新

在 0.22.1 中，打开设置 > 鼠标 > 搜索更新 > 更新并重启。更新后，Updates 位于设置 > Configuration 顶部。也可从 [Low Polyworks](https://www.lowpolyworks.com/mdlxl) 下载完整 Windows 便携 ZIP，解压整个文件夹并运行 MDLxL.exe。
