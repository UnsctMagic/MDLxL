[CmdletBinding()]
param([ValidateSet('Acquire','Measure','Labels','Capture','Export')][string]$Stage = 'Export')
$ErrorActionPreference = 'Stop'
$researchRoot = 'D:\Codex\sd-research'
$researchRepo = Join-Path $researchRoot 'repo'
$researchTemp = Join-Path $researchRoot 'temp\regeneration'
New-Item -ItemType Directory -Force -Path $researchTemp | Out-Null
$env:TEMP = $researchTemp
$env:TMP = $researchTemp
$env:TMPDIR = $researchTemp
$env:PYTHONDONTWRITEBYTECODE = '1'
$env:SD_RESEARCH_ROOT = $researchRoot
$env:RESEARCH_ROOT = $researchRoot
Set-Location -LiteralPath $researchRepo
function Run-Node([string]$Script, [string[]]$Arguments = @()) {
    & node (Join-Path 'scripts\sd-research' $Script) @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Research step failed: $Script" }
}
function Run-Python([string]$Script) {
    & py -3 (Join-Path 'scripts\sd-research' $Script)
    if ($LASTEXITCODE -ne 0) { throw "Research step failed: $Script" }
}
# Stages are explicit: the default never redownloads or rerenders the corpus.
# Existing curated prose and visual annotations are evidence, not generated guesses.
switch ($Stage) {
    'Acquire' {
        Run-Node 'native-corpus.mjs'
        Run-Node 'world-editor-corpus.mjs'
        Run-Node 'world-editor-replaceables.mjs'
        Run-Node 'lpw-corpus.mjs'
        Run-Python 'lpw-study.py'
        Run-Node 'hive-corpus.mjs'
    }
    'Measure' {
        Run-Node 'measure-models.mjs' @('native','lpw','hive')
        Run-Node 'enrich-uv-sets.mjs'
        Run-Node 'category-norms.mjs'
        Run-Node 'lpw-colours.mjs'
        # Native-resolution pixel measurements require these decoded source images.
        Run-Node 'lpw-decode.mjs'
        Run-Node 'lpw-custom-decode.mjs'
        Run-Node 'study-effect-atlases.mjs' @('--tier','sd')
        Copy-Item -LiteralPath "$researchRoot\data\effect-atlases-sd.jsonl.gz" -Destination 'docs\SD-RESEARCH\data\effect-atlases-sd.jsonl.gz'
    }
    'Labels' {
        # Requires the retained fitted component capture.json files. See task note
        # for bounded capture commands if an individual evidence set is missing.
        Run-Node 'seed-native-observations.mjs'
        Run-Node 'observe-native-humanoids.mjs'
        Run-Node 'observe-native-undead.mjs'
        Run-Python 'observe-native-repurpose-sources.py'
        Run-Python 'environment-observations.py'
        Run-Python 'write-environment-study.py'
        Run-Python 'creature-observations.py'
        Run-Node 'reviewed-native-parts.mjs'
        Run-Python 'custom-painting-study.py'
        Run-Python 'lpw-semantics.py'
        Run-Python 'vampire-observations.py'
        Run-Python 'aspiring-observations.py'
        Run-Python 'lpw-owner-semantics.py'
        Run-Python 'lpw-selective-semantics.py'
        Run-Python 'lpw-semantic-expansion.py'
        Run-Python 'lpw-paint-coverage.py'
    }
    'Capture' {
        # Refreshes existing evidence; detailed component selection is preserved.
        # This stage's final plates use the retained/rebuilt Labels measurements.
        Run-Node 'render-study.mjs' @('--mode','textures','--tiers','sd')
        Run-Node 'render-study.mjs' @('--tiers','sd','--refresh-corrections','yes')
        Run-Node 'render-coverage.mjs'
        Run-Node 'render-gallery.mjs'
        Run-Node 'render-browse-contacts.mjs'
        Run-Python 'lpw-reuse-pictures.py'
    }
    'Export' {
        Run-Python 'export-study.py'
        Run-Python 'uv-library.py'
        & py -3 'scripts\sd-research\sanitize-permitted-references.py' --apply
        if ($LASTEXITCODE -ne 0) { throw 'Derived-reference sanitization failed' }
        Run-Python 'texture-region-gallery.py'
        Run-Node 'render-handbook.mjs'
    }
}
