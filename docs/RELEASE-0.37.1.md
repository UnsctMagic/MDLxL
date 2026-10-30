# MDLxL 0.37.1 - UV rotation hotfix

Hotfix due to 3D rotation leaking into 2D UV rotation, was too annoying!

- **UV Wrapper > Rotate** works like before 0.36.0 again: the selection follows the mouse around its centre, near or far, and keeps turning as you circle, so a full turn or more is easy. The 3D rotation rules in **Settings > Mouse > Rotation** no longer apply to the flat UV map; rotation everywhere else is unchanged. Non-square textures turn without stretching.
- **Save** is back on the toolbar.
- **Sort My Mess** keeps the camera where you left it when you change a choice.
- **AI with an API key:** the model list loads as soon as the key is saved and the Model box becomes a dropdown (**Other model ID…** still lets you type one). OpenAI's newer models work through the API, and key errors say how to fix them.
- **Updates:** while an update installs, a small window shows the progress with the Shredder bird. It first appears when updating *from* 0.37.1.

**Update** Open Settings > Configuration > Search for updates > Update and restart, or download the full portable ZIP from the MDLxL page.
