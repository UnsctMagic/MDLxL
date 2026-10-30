# Real-use AI fixtures

`helmet.mdx` is a neutral-name copy of the owner-authorized helmet. Inspection found
only generic model/bone names and Warcraft III texture paths, no personal paths,
chat content or personal data. The original is never modified. Required textures
are read from a local Warcraft III CASC installation into disposable run scratch.
The helmet has a plated band (displayed Geoset 6) and eight studs (Geoset 7).
Scenario JSON uses zero-based indices internally; prompts use displayed IDs.

`stud-reference.jpg` is the Cleveland Museum of Art's open-access photograph of
*War Hat (or Kettle Hat)*, c. 1475–1500, workshop of Antonio Missaglia, accession
1916.1565, Gift of Mr. and Mrs. John L. Severance. CC0/open access; the museum
permits copying, modification and distribution without permission.
Source: https://www.clevelandart.org/art/1916.1565
Image: https://www.clevelandart.org/_next/image?q=75&url=https%3A%2F%2Fpiction.clevelandart.org%2Fcma%2Fump.di%3Fe%3DE30C3D6E4ED982B7B9EEDE359ABC0063E664273D786A7BB142DE77FED77158FD%26s%3D24247294%26se%3D399313166%26v%3D1%26f%3D1916.1565_o5.jpg&w=640

Simplify/weld scenarios split triangle corners using the project's `gatherStreams`.
This creates redundant, attribute-identical points without altering the surface,
UVs, textures, normals or bindings. The example cases select a compatible group
in the lower right and invoke MDLxL's real Weld command before sending the prompt.
The saved evidence includes geometry immediately before and after that demonstration.
