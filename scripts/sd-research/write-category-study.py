"""Write measured category comparisons. Run after category-norms.mjs."""
from pathlib import Path
import json, os

ROOT = Path(os.environ.get("SD_RESEARCH_ROOT", "D:/Codex/sd-research"))
DOC = Path(__file__).resolve().parents[2] / "docs" / "SD-RESEARCH"
OUT = DOC / "subjects" / "categories"
OUT.mkdir(parents=True, exist_ok=True)
rows = json.loads((ROOT / "data/category-models.json").read_text(encoding="utf-8-sig"))

def norm(s):
    return str(s or "").split(":")[-1].replace("/", "\\").lower()
def native(tier="sd"):
    return [r for r in rows if r["source"] == "blizzard" and r["tier"] == tier]
def find(p, tier="sd"):
    return next((r for r in native(tier) if norm(r["path"]) == norm(p)), None)
def compact(rs):
    return [r for r in rs if r]
def names(rs):
    return ", ".join("**" + norm(r["path"]) + "**" for r in compact(rs))
def number(x):
    return f"{x:,}" if isinstance(x, (int, float)) else "—"
def decimal(x):
    return f"{x:.2f}" if isinstance(x, (int, float)) else "—"
def table(head, records):
    result = "| " + " | ".join(head) + " |\n| " + " | ".join("---" for _ in head) + " |\n"
    return result + "\n".join("| " + " | ".join(str(v if v is not None else "—").replace("|", "/").replace("\n", " ") for v in row) + " |" for row in records) + "\n"
def picture(r):
    return f"[pictures](D:/Codex/sd-research/captures/models/{r['id']}/index.html)"
def models(rs):
    return table(["Source model", "File triangles", "Sample body LOD0", "Hidden LOD0", "Diffuse paths", "File KiB", "Raw height / Footman", "Evidence"],
                 [[norm(r["path"]), number(r["wholeFileTriangles"]), number(r["sampleBodyTrianglesLod0"]), number(r["hiddenTrianglesLod0"]), r["diffuseSheets"], decimal(r["bytes"]/1024), decimal(r["rawBodyHeightFootman"]), picture(r)] for r in compact(rs)])
def sequences(rs):
    return table(["Source model", "Authored sequence / milliseconds"], [[norm(r["path"]), "; ".join(s["name"] + " " + number(s["durationMs"]) for s in r["sequences"])] for r in compact(rs)])
def quant(rs, key, p):
    a = sorted(r[key] for r in rs if isinstance(r.get(key), (int, float)))
    return a[int((len(a)-1)*p)] if a else None
def ranges(rs):
    groups = sorted(set((r["source"], r["tier"]) for r in rs))
    cells = []
    for source, tier in groups:
        group = [r for r in rs if r["source"] == source and r["tier"] == tier]
        cells.append([source + "/" + tier, len(group), " / ".join(number(quant(group, "sampleBodyTrianglesLod0", p)) for p in [.1, .5, .9]), quant(group, "diffuseSheets", .5), decimal(quant(group, "bytes", .5)/1024)])
    return table(["Measured set", "Models", "Body triangles p10 / median / p90", "Median diffuse paths", "Median file KiB"], cells)
def sources(rs):
    return "\nSource records: " + ", ".join(r["id"] for r in compact(rs)) + ". Exact values and complete category membership are in [category-models.json](../../data/category-models.json) and [category-norms.json](../../data/category-norms.json).\n"
def write(name, text):
    (OUT / (name + ".md")).write_text(text, encoding="utf-8")
def category(c):
    return [r for r in rows if r["category"] == c]

footman = find(r"units\human\footman\footman.mdx")
grunt = find(r"units\orc\grunt\grunt.mdx")
archer = find(r"units\nightelf\archer\archer.mdx")
ghoul = find(r"units\undead\ghoul\ghoul.mdx")
soldiers = compact([footman, grunt, archer, ghoul])
standard = [r for r in native() if r["standardFourRacePalette"] and r["category"] == "unit"]
write("units", f"""# Units: the body, the corpse and the file are different budgets

The four ordinary race references {names(soldiers)} use {", ".join(number(r["sampleBodyTrianglesLod0"]) for r in soldiers)} triangles for their sampled bodies, respectively. Their complete files contain {", ".join(number(r["wholeFileTriangles"]) for r in soldiers)}. The difference is measured hidden geometry at this pose. The sequence table below preserves the authored death and decay states; a hidden-at-Stand count does not establish that those parts are dispensable.

{models(soldiers)}
The installed four-race Normal palette subset contains {len(standard)} measured contents. Its body-triangle p10/median/p90 are {" / ".join(number(quant(standard, "sampleBodyTrianglesLod0", p)) for p in [.1,.5,.9])}. This is narrower than the broader comparison below, which also includes campaign units, special models and the selected community collections.

{ranges(category("unit"))}
{sequences(soldiers)}
Footman's raw sampled non-glow LOD0 body is {decimal(footman["rawSampleBodyHeight"])} model units high. Grunt's installed SD modelscale is 1.1, while Footman's is 1; the raw-height column does not apply object-table scale. The raw mesh and the map's configured size are different measurements. Sources: these two models and official UnitSkin objects hfoo and ogru.
{sources(soldiers)}""")

archmage = find(r"units\human\heroarchmage\heroarchmage.mdx")
blade = find(r"units\orc\heroblademaster\heroblademaster.mdx")
deathknight = find(r"units\undead\herodeathknight\herodeathknight.mdx")
demon = find(r"units\nightelf\herodemonhunter\herodemonhunter.mdx")
heroes = compact([archmage, blade, deathknight, demon])
write("heroes", f"""# Heroes: identity and animation do not require thousands of body triangles

{names(heroes)} allocate {", ".join(number(r["sampleBodyTrianglesLod0"]) for r in heroes)} triangles to their sampled bodies. Their model files occupy {", ".join(decimal(r["bytes"]/1024)+" KiB" for r in heroes)} and carry {", ".join(str(len(r["sequences"])) for r in heroes)} named sequences. Polygon count and authored animation data measure different resources.

{models(heroes)}
{sequences(heroes)}
{names([r for r in heroes if r["dissipate"]])} contain explicit Dissipate sequences; the table preserves their durations. Hero identity comes from official object IDs and palette entries. The four-triangle HeroBloodSphere effect is kept outside this category despite its filename.

{ranges(category("hero"))}
{sources(heroes)}""")

town = find(r"buildings\human\townhall\townhall.mdx")
hall = find(r"buildings\orc\greathall\greathall.mdx")
necro = find(r"buildings\undead\necropolis\necropolis.mdx")
tree = find(r"buildings\nightelf\treeoflife\treeoflife.mdx")
buildings = compact([town, hall, necro, tree])
write("buildings", f"""# Buildings: several building stages can occupy one MDX

{names([town,hall,necro])} contain {", ".join(number(r["wholeFileTriangles"]) for r in [town,hall,necro])} triangles in their files, while the sampled bodies use {", ".join(number(r["sampleBodyTrianglesLod0"]) for r in [town,hall,necro])}. Their authored sequence names include Upgrade First and Upgrade Second. Counting every geoset as one visible building overstates these samples by factors of {", ".join(decimal(r["wholeFileTriangles"]/r["sampleBodyTrianglesLod0"]) for r in [town,hall,necro])}.

{models(buildings)}
{sequences(buildings)}
TownHall's Birth, Birth Upgrade First and Birth Upgrade Second each last 60,000 milliseconds. Necropolis names a BirthLink attachment and Sprite RallyPoint Ref; TownHall names Sprite First Ref through Sprite Fifth Ref plus its rally point. These explicit hooks accompany the painted structure and staged forms.

{ranges(category("building"))}
GreatHall's sample is Stand Work, the first authored Stand variant. This comparison describes the recorded poses; it is not a claim that every upgrade or animation frame has the same visible triangle count.
{sources(buildings)}""")

mounts = [r for r in native() if r["mountedReference"] and "_teen." not in r["path"]]
knight = find(r"units\human\knight\knight.mdx")
bat = find(r"units\orc\battroll\battroll.mdx")
write("mounts", f"""# Mounted units: rider and mount have separate attachment vocabularies

{names([archmage,deathknight,knight,find(r"units\orc\wolfrider\wolfrider.mdx")])} name rider anchors such as Hand Right Ref and mount anchors such as Head Mount, Chest Mount and rear feet. Their composite body counts are below. These are whole mounted models; they are not isolated horse or wolf budgets.

{models(mounts)}
{table(["Source model","Mount / rear-foot attachments"],[[norm(r["path"]),"; ".join(a["name"] for a in r["attachments"] if "mount" in a["name"].lower() or "rear" in a["name"].lower())] for r in mounts])}
This named reference subset uses official objects hkni, hgry, orai, okod, otbr, esen, ehpr, Hamg, Udea, Ofar and Emoo. It does not claim automatic recognition of every rider. Knight has {len(knight["attachments"])} attachments; BatTroll has {len(bat["attachments"])}. The differing lists are preserved rather than replaced with a universal mount template.
{sources(mounts)}""")

for cat in ["doodad","destructible"]:
    a = sorted([r for r in native() if r["category"] == cat],key=lambda r:r["sampleBodyTrianglesLod0"])
    refs = [a[int(len(a)*p)] for p in [.25,.5,.75]] + [a[-1]]
    title = "Doodads" if cat == "doodad" else "Destructibles"
    distinction = "Official Doodads and skin tables supply this identity; animation names alone do not establish gameplay destructibility." if cat == "doodad" else "Official DestructableData and skin tables supply this identity; the presence of a Death sequence alone is insufficient."
    write(cat+"s", f"""# {title}: palette identity and animation are separate evidence

{distinction} In this active SD-art set, {sum(bool(r["death"]) for r in a)} of {len(a)} contents have a Death sequence. The named references {names(refs)} show distinct stored states.

{models(refs)}
{sequences(refs)}
{ranges(category(cat))}
The largest named reference, {names([refs[-1]])}, has {number(refs[-1]["wholeFileTriangles"])} file triangles and {number(refs[-1]["sampleBodyTrianglesLod0"])} sampled LOD0 body triangles. This source remains in the active set after the recorded art-tier exceptions are removed. Its measured size is a population example, not a proposed polygon target.
{sources(refs)}""")

items = sorted([r for r in native() if r["category"] == "item"],key=lambda r:r["sampleBodyTrianglesLod0"])
irefs = [items[0],items[len(items)//2],items[-1]]
write("items", f"""# Items: a small object can carry several painted layers and a life cycle

All {len(items)} measured native item contents have an authored Death sequence. {names(irefs)} span {number(items[0]["sampleBodyTrianglesLod0"])} to {number(items[-1]["sampleBodyTrianglesLod0"])} sampled body triangles, with different animation and attachment arrangements.

{models(items)}
{sequences(irefs)}
Glyph and RunicObject each reference four diffuse paths in the sampled pose and carry Origin Ref, Overhead Ref and Chest Ref. OrcCaptureFlag references one diffuse path and has no attachment nodes. These named examples disprove a universal description of native items as one-sheet, unrigged static props.

{ranges(category("item"))}
{sources(items)}""")

for cat,title in [("missile","Missiles"),("effect","Effects"),("spawn","Spawn models")]:
    a = sorted([r for r in native() if r["category"] == cat],key=lambda r:r["sampleBodyTrianglesLod0"])
    zero = next((r for r in a if r["wholeFileTriangles"] == 0 and any(r["emitterCounts"].values())),a[0])
    refs = [zero,a[len(a)//2],a[-1]]
    write(cat+"s", f"""# {title}: zero stored triangles is not zero authored content

{names([refs[0]])} stores {number(refs[0]["wholeFileTriangles"])} mesh triangles and the emitter counts shown below. {names([refs[-1]])} stores {number(refs[-1]["wholeFileTriangles"])} triangles. These are different authoring mechanisms within the same broad use category.

{models(refs)}
{table(["Source model","Legacy emitters","ParticleEmitter2","Popcorn","Ribbon emitters","Sequences"],[[norm(r["path"]),r["emitterCounts"]["legacy"],r["emitterCounts"]["particles2"],r["emitterCounts"]["popcorn"],r["emitterCounts"]["ribbons"],"; ".join(s["name"]+" "+number(s["durationMs"])+"ms" for s in r["sequences"])] for r in refs])}
{ranges(category(cat))}
The body count excludes particles generated during playback. It describes stored mesh in {names(refs)}; it does not estimate peak particles, translucent overdraw or a short flash that falls outside the sampled frame.
{sources(refs)}""")

portraits = compact([find(norm(r["path"]).replace(".mdx","_portrait.mdx")) for r in soldiers])
write("portraits",f"""# Portraits: separate presentation rather than a cropped unit count

{names(portraits)} contain {", ".join(number(r["sampleBodyTrianglesLod0"]) for r in portraits)} sampled body triangles. Their corresponding field models are {names(soldiers)}. Each portrait file carries its own animation and camera data.

{models(portraits)}
{sequences(portraits)}
{table(["Portrait","Cameras","Attachments","Replaceable ID 2 present"],[[norm(r["path"]),r["cameras"],"; ".join(a["name"] for a in r["attachments"]),"yes" if r["heroGlow"] else "no"] for r in portraits])}
Replaceable ID 2 is recorded as a format fact. Its presence in these portrait files is not proof of a hero aura; the body metric excludes that material while the pictures preserve its actual presentation.

{ranges(category("portrait"))}
{sources(portraits)}""")

glues = compact([find(p) for p in [r"ui\glues\singleplayer\humancampaign3d\humancampaign3d.mdx",r"ui\glues\singleplayer\orccampaign3d\orccampaign3d.mdx",r"ui\glues\singleplayer\undeadcampaign3d\undeadcampaign3d.mdx",r"ui\glues\singleplayer\humanrecampaign3d\humanrecampaign3d.mdx"]])
write("glue-scenes",f"""# Campaign and menu scenes: an intentionally different scale of asset

{names(glues)} contain {", ".join(number(r["wholeFileTriangles"]) for r in glues)} file triangles and {", ".join(str(r["declaredTexturePaths"]) for r in glues)} declared texture paths. These are scene assets outside the unit battlefield presentation. Their painted sheets remain available to the material study and the owner's cross-purpose reuse.

{models(glues)}
{sequences(glues)}
The original base-namespace inventory contains 72 Glues paths, reducing to 71 distinct contents after alias grouping. HumanReCampaign3D is preserved outside the active SD-art scope, leaving 70 active contents. This namespace also includes tiny login and menu elements, so its global median does not describe a complete campaign scene.
{sources(glues)}""")

ui = compact([find(p) for p in [r"ui\feedback\goldcredit\goldcredit.mdx",r"ui\minimap\minimap-questobjectivebonus.mdx",r"ui\feedback\autocast\ui-modalbuttonon.mdx"]])
write("ui-models",f"""# UI models: mesh, painted cards and particle feedback share the format

{names(ui)} contain {", ".join(number(r["wholeFileTriangles"]) for r in ui)} mesh triangles, respectively. GoldCredit is a 102-triangle object, the minimap objective is a two-triangle card, and the autocast example stores no mesh. UI is a use category rather than a single geometric construction.

{models(ui)}
{sequences(ui)}
{table(["Source model","ParticleEmitter2","Diffuse paths at sample"],[[norm(r["path"]),r["emitterCounts"]["particles2"],"; ".join(r["sampleDiffusePaths"])] for r in ui])}
{sources(ui)}""")

env = compact([find(p) for p in [r"environment\dnc\dnclordaeron\dnclordaeronunit\dnclordaeronunit.mdx",r"environment\sky\lordaeronsummersky\lordaeronsummersky.mdx",r"sharedmodels\feather1.mdx",r"sharedmodels\bones1.mdx",r"sharedmodels\illidanimprisoned.mdx"]])
write("support-assets",f"""# Shared pieces and environment rigs stay in the corpus

{names(env)} have file triangle counts of {", ".join(number(r["wholeFileTriangles"]) for r in env)}. The day/night rig stores timed data without a renderable mesh, the shared feather is eight triangles, and the imprisoned character is a complete authored model. These named objects remain separately indexed rather than being forced into the unit category.

{models(env)}
{sequences(env)}
The shared fragment records establish reusable source pieces. They do not by themselves prove that a LowPolyWorks part copied them; that separate claim requires geometry or credit evidence.
{sources(env)}""")

scenes = [r for r in native() if r["category"] == "cinematic-scene"]
effects = [r for r in native() if r["category"] == "cinematic-effect"]
cameras = [r for r in native() if r["category"] == "cinematic-camera"]
write("cinematics",f"""# Cinematic namespace: separate modern scenes from SD reference data

Eight dense scene models in the base namespace are preserved as supplementary findings, outside active SD category statistics. Their explicit source evidence is recorded in [base-namespace-art-exceptions.json](../../data/base-namespace-art-exceptions.json). Storage under war3.w3mod does not establish a Classic SD art style.

The retained cinematic-scene category contains {len(scenes)} environment records, with {sum(r["wholeFileTriangles"] for r in scenes)} stored mesh triangles in total. The separate cinematic-effect category contains {len(effects)} records, and cinematic-camera contains {len(cameras)}. Zero mesh triangles describe the stored mesh only; emitter, lighting, external-particle and camera data require their own interpretation.

{models(scenes)}
{sequences(scenes)}
These named environment records are not creature, building or battlefield-unit geometry budgets. The prior dense-scene measurements and captures remain on D: for the owner; they have not been deleted or presented as SD norms.
{sources(scenes)}""")

write("measurement-method",f"""# Meaning and limits of these measurements

[category-models.json](../../data/category-models.json) keeps exact model paths, content hashes, official object uses, sequence durations and attachment names. UnitUI, UnitData, UnitSkin, item, doodad and destructible tables supply object identity. The active set contains 4,207 models: 3,431 native SD, 130 LowPolyWorks and 646 permitted Hive. Seventeen base-namespace art exceptions are preserved separately and omitted from these populations; see [base-namespace-art-exceptions.json](../../data/base-namespace-art-exceptions.json). Explicit asset paths distinguish projectiles, portraits, UI, Glues, cinematic and support models; dummy-object uses remain recorded separately.

- File triangles count all stored geosets, hidden states and additional LODs.
- Sample body LOD0 includes visible geosets with absent/shared/zero LevelOfDetail and excludes materials using Replaceable ID 2. Generated particles are separate.
- The sampled pose is the first Stand-named sequence at 20%; otherwise it is the first sequence at 20%. GreatHall therefore samples Stand Work. Exact names and frames are retained.
- Hidden LOD0 means sampled geoset/material alpha is below threshold. Upgrade, corpse or effect purpose is not inferred from the count alone.
- Diffuse paths are normalized TextureID paths used by sampled visible LOD0 layers. Normal, ORM and emissive slots are recorded separately. Content-identical path aliases are not collapsed in this count.
- File KiB is model bytes divided by 1024. External textures are separate.
- Raw height divides sampled non-glow LOD0 mesh height by Footman's {decimal(footman["rawSampleBodyHeight"])} model-unit height. UnitSkin modelscale remains a separate field. Missing body bounds remain unavailable, not zero.
- p10, median and p90 are measured ranks, not recommended limits. Content aliases count once per tier. The four-race Normal palette is a narrower baseline than every installed model.

Pictures are offline links into D:/Codex/sd-research/captures/models. No third-party geometry or texture pixels are committed. These measurements do not establish Warcraft III runtime acceptance.
""")
print(json.dumps({"pages":len(list(OUT.glob("*.md"))),"models":len(rows)}))
