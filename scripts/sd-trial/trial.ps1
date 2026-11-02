# Runs one SD Brain trial on the hidden desktop (no windows appear):
#   trial.ps1 -Label sword -Prompt "make a sword" -Brain on [-Open D:\path\model.mdx] [-Pkg pkg-ai]
# Package first: pnpm run build, then node scripts/package.mjs --out out/<Pkg> --overwrite.
# Results (pictures from five sides, chat text, chat JSON, exported model): out/sd-trials/runs/<Label>.
param([string]$Label, [string]$Prompt, [string]$Brain = 'on', [string]$Open = '', [string]$Pkg = 'pkg-ai')
$env:MDLXL_TRIAL_PKG = $Pkg
$wt = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
New-Item -ItemType Directory -Force (Join-Path $wt 'out\sd-trials') | Out-Null
if (-not $env:MDLXL_PLAYWRIGHT_MODULE) { $env:MDLXL_PLAYWRIGHT_MODULE = 'D:/Claude/tools/node_modules/playwright-core' }
$q = $Prompt.Replace('"', '\"')
$cmd = "cmd /c node scripts\sd-trial\rig.cjs $Label `"$q`" $Brain"
if ($Open) { $cmd += " `"$Open`"" }
$env:MDLXL_HIDDEN_COMMAND = $cmd + " > out\sd-trials\$Label.out 2>&1"
powershell -NoProfile -ExecutionPolicy Bypass -File "$wt\scripts\hidden-run.ps1" -WorkDir $wt
