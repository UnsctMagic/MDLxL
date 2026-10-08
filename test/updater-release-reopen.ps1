param([string]$Root,[string]$Cycle)
$ErrorActionPreference='Stop'
$config=Get-Content -LiteralPath (Join-Path $Root 'config.json') -Raw | ConvertFrom-Json
$exe=Join-Path $config.target 'MDLxL.exe'
$lock=Join-Path $config.target '.mdlxl-installing'
$deadline=[DateTime]::UtcNow.AddMinutes(6)
while (!(Test-Path -LiteralPath $lock)) { if([DateTime]::UtcNow -gt $deadline){throw 'No installation lock observed'};Start-Sleep -Milliseconds 15 }
$started=[DateTime]::UtcNow.ToString('o')
$owner=Get-Content -LiteralPath (Join-Path $lock 'owner.json') -Raw | ConvertFrom-Json
$plan=Get-Content -LiteralPath $owner.planFile -Raw | ConvertFrom-Json
$plan | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Root ($Cycle+'-plan.json')) -Encoding utf8
while (Get-Process -Id $owner.pid -ErrorAction SilentlyContinue) {Start-Sleep -Milliseconds 10}
$env:MDLXL_PROFILE=$config.profile
$env:TEMP=Join-Path $Root 'temp'
$env:TMP=$env:TEMP
$attempts=@()
for($n=0;$n -lt 35;$n++){
 if(!(Test-Path -LiteralPath $lock)){break}
 $entry=@{at=[DateTime]::UtcNow.ToString('o');lockPresent=$true;version=(Get-Content -LiteralPath (Join-Path $config.target 'resources/app/package.json') -Raw|ConvertFrom-Json).version;windows=@()}
 $reopen=Start-Process -FilePath $exe -WorkingDirectory $config.target -WindowStyle Hidden -PassThru
 $entry.pid=$reopen.Id
 for($j=0;$j -lt 150 -and !$reopen.HasExited;$j++){ $reopen.Refresh();if($reopen.MainWindowHandle -ne 0){$entry.windows+=@{handle=$reopen.MainWindowHandle.ToInt64();title=$reopen.MainWindowTitle}};Start-Sleep -Milliseconds 20 }
 $entry.exited=$reopen.HasExited
 if($reopen.HasExited){$entry.exitCode=$reopen.ExitCode}
 $attempts+=$entry; Start-Sleep -Milliseconds 500
}
@{cycle=$Cycle;lockSeenAt=$started;ownerPid=$owner.pid;attempts=$attempts} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Root ($Cycle+'-relaunch.json')) -Encoding utf8
if(!($attempts.Count -gt 0) -or @($attempts|Where-Object{!$_.exited -or $_.windows.Count -gt 0}).Count -gt 0){throw 'A relaunch did not exit cleanly without an editor window'}
Write-Output ('PASS '+$Cycle+' relaunches: '+$attempts.Count)

