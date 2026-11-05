# MDLxL 0.38.3

- **Important OptimizeXL fix:** models saved after OptimizeXL could be corrupted and show long stretched spikes in Warcraft III, even though they looked fine in MDLxL. The same could happen after adding a model's first collision shapes, ribbons or attachments. MDLxL now saves every model in the order the game reads it. A model already saved this way is repaired the next time you change and save it.
- Recovery keeps saving after you leave Citadel Paint in the middle of a stroke, while you keep clicking in a large model, and while MDLxL closes.
- AI console: **Local workspace** lets the AI run its own checks and keep scratch files for a job, after asking with a Yes/No card. If you edit the model while the AI is working, choose **Open as new model** or **Merge**; a merge is one Undo step.
- Spanish, Russian and Chinese now translate every Hive checker finding.
- Copies older than 0.38.0 can update in the app again.
- The update window's Shredder stays hidden behind the edge he peeks around.

Update through Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
