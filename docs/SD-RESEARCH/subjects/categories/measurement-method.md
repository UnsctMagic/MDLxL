# Meaning and limits of these measurements

[category-models.json](../../data/category-models.json) keeps exact model paths, content hashes, official object uses, sequence durations and attachment names. UnitUI, UnitData, UnitSkin, item, doodad and destructible tables supply object identity. The active set contains 4,207 models: 3,431 native SD, 130 LowPolyWorks and 646 permitted Hive. Seventeen base-namespace art exceptions are preserved separately and omitted from these populations; see [base-namespace-art-exceptions.json](../../data/base-namespace-art-exceptions.json). Explicit asset paths distinguish projectiles, portraits, UI, Glues, cinematic and support models; dummy-object uses remain recorded separately.

- File triangles count all stored geosets, hidden states and additional LODs.
- Sample body LOD0 includes visible geosets with absent/shared/zero LevelOfDetail and excludes materials using Replaceable ID 2. Generated particles are separate.
- The sampled pose is the first Stand-named sequence at 20%; otherwise it is the first sequence at 20%. GreatHall therefore samples Stand Work. Exact names and frames are retained.
- Hidden LOD0 means sampled geoset/material alpha is below threshold. Upgrade, corpse or effect purpose is not inferred from the count alone.
- Diffuse paths are normalized TextureID paths used by sampled visible LOD0 layers. Normal, ORM and emissive slots are recorded separately. Content-identical path aliases are not collapsed in this count.
- File KiB is model bytes divided by 1024. External textures are separate.
- Raw height divides sampled non-glow LOD0 mesh height by Footman's 98.26 model-unit height. UnitSkin modelscale remains a separate field. Missing body bounds remain unavailable, not zero.
- p10, median and p90 are measured ranks, not recommended limits. Content aliases count once per tier. The four-race Normal palette is a narrower baseline than every installed model.

Pictures are offline links into D:/Codex/sd-research/captures/models. No third-party geometry or texture pixels are committed. These measurements do not establish Warcraft III runtime acceptance.
