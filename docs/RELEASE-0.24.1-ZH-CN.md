# MDLxL 0.24.1 - 流畅的动画速度调整

## 动画速度

- 拖动动画速度滑块不再卡顿。松开滑块时动画只重新计时一次，每次拖动只算一步撤销。
- 每个速度滑块（Animation Actual Speed、Master Controller 以及 Adjust All Speed 中的每个动画）现在都有一个数字框。输入 1 到 300% 的速度并按 Enter。
- 写入新速度时，滑块下方会显示一条细进度条。
- 已移除 Remember Original Timing。速度更改只保存为模型的实际时间，文件中不再写入额外的 MDLxL 数据，因此重新打开模型时速度显示为 100%。旧版本保存的时间数据会在下次保存模型时删除。

## 更新

在 0.24.0 中，打开设置 > Configuration > 检查更新 > 更新并重启。
