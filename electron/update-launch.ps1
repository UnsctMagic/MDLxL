param([string]$PlanFile)
$ErrorActionPreference = 'Stop'
$script = Join-Path (Split-Path -Parent $PlanFile) 'install.ps1'
$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $script + '"'), ('"' + $PlanFile + '"'))
$installer = Start-Process -PassThru -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $arguments -WindowStyle Hidden

$ready = Join-Path (Split-Path -Parent $PlanFile) 'installer-ready'
$deadline = [DateTime]::UtcNow.AddSeconds(30)
while (!(Test-Path -LiteralPath $ready)) {
    if ($installer.HasExited) { throw 'The update installer exited before startup.' }
    if ([DateTime]::UtcNow -gt $deadline) {
        $installer.Kill()
        $installer.WaitForExit()
        throw 'The update installer did not acknowledge startup.'
    }
    Start-Sleep -Milliseconds 50
}
