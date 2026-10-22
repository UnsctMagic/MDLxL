# Next release — unreleased changes

- Portrait view (Movement and Animations): new **Add Background** button. It
  adds a Warcraft-style team-color backdrop behind the model, placed for the
  selected camera the way Blizzard's SD portraits do it (measured from 152
  SD portrait backdrops and 26 unit models): facing the camera, centred,
  behind the subject at about 2.4× the camera distance and filling the whole
  game crop. It is shown only in Portrait animations. When the model already
  has a background the button reads **Refresh Background** and re-places that
  one for the current camera, keeping its size and height, and fixes its
  visibility. One Undo step.
- **▾** beside it opens Background options: a small preview of the game crop
  with **Size** (Spotlight keeps black around the portrait, Fill covers it)
  and **Height** sliders, **Blizzard default**, and the place button. The last
  look you place is reused for the next Add.
