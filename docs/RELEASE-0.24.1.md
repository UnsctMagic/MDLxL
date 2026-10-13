# MDLxL 0.24.1 - Smooth animation speed

## Animation speed

- Dragging an animation speed slider no longer lags. The animation is retimed once, when you release the slider, and each drag is one undo step.
- Every speed slider (Animation Actual Speed, Master Controller and each animation in Adjust All Speed) now has a number box. Type a speed from 1 to 300% and press Enter.
- A thin bar under the slider shows while the new speed is being written.
- Remember Original Timing is removed. A speed change is saved as the model's real timing only, with no extra MDLxL data in the file, so a reopened model shows its speeds as 100%. Timing data saved by earlier versions is removed the next time the model is saved.

## Update

In 0.24.0, open Settings > Configuration > Search for updates > Update and restart.
