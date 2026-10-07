param([string]$PlanFile)
$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path -Parent $PlanFile) 'install.ps1'
$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $script + '"'), ('"' + $PlanFile + '"'))
Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WindowStyle Hidden
