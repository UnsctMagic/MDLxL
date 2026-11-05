# MDLxL 0.38.3

- **重要的 OptimizeXL 修复：**使用 OptimizeXL 后保存的模型可能损坏，在《魔兽争霸 III》中出现长长的拉伸尖刺，而在 MDLxL 中看起来却正常。首次为模型添加碰撞体、飘带或附着点后也可能出现同样问题。MDLxL 现在按游戏读取的顺序保存每个模型。已按这种方式保存的模型，会在你下次修改并保存时自动修复。
- 在笔触中途离开 Citadel Paint、在大型模型中连续点击以及关闭 MDLxL 时，恢复数据仍会继续保存。
- AI 控制台：**Local workspace** 允许 AI 在用“是/否”卡片询问你之后，为任务运行自己的检查并保留临时文件。如果在 AI 工作时编辑了模型，可选择 **Open as new model** 或 **Merge**；合并只需一次 Undo 即可撤销。
- 西班牙语、俄语和中文现已翻译 Hive 检查器的全部结果。
- 早于 0.38.0 的版本可以再次在程序内更新。
- 更新窗口中的 Shredder 会一直藏在他探头的边缘后面。

通过 Settings > Configuration > Search for updates > Update and restart 更新，或从 MDLxL 页面下载完整便携 ZIP。
