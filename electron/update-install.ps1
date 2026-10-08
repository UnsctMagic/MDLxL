param([string]$PlanFile)
$ErrorActionPreference = 'Stop'
$plan = Get-Content -LiteralPath $PlanFile -Raw -Encoding UTF8 | ConvertFrom-Json
$stage = [IO.Path]::GetFullPath((Split-Path -Parent $PlanFile))
$target = [IO.Path]::GetFullPath($plan.target).TrimEnd('\')
$source = [IO.Path]::GetFullPath($plan.source).TrimEnd('\')
$backup = Join-Path $stage 'rollback'
$changed = New-Object System.Collections.Generic.List[object]
$previous = Join-Path $target '.mdlxl-previous'
$oldSnapshot = Join-Path $stage 'old-snapshot'
$snapshotMoved = $false
$snapshotWritten = $false
$lock = Join-Path $target '.mdlxl-installing'
$ownsLock = $false
function FileHash($file) {
    if (!(Test-Path -LiteralPath $file)) { return $null }
    $stream = [IO.File]::OpenRead($file)
    $algorithm = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $algorithm.Dispose() }
}
function ReplaceFile($from, $to) {
    # Publish complete files atomically, including the EXE and startup modules.
    # A relaunch that is exiting through the startup guard may briefly hold the EXE.
    $temporary = Join-Path (Split-Path -Parent $to) ([IO.Path]::GetRandomFileName())
    [IO.File]::Copy($from, $temporary, $false)
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    try {
        while ($true) {
            try {
                if (Test-Path -LiteralPath $to) { [IO.File]::Replace($temporary, $to, [NullString]::Value) }
                else { [IO.File]::Move($temporary, $to) }
                return
            } catch [IO.IOException] {
                if ([DateTime]::UtcNow -ge $deadline) { throw }
                Start-Sleep -Milliseconds 100
            }
        }
    } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary } }
}
function SafePath($root, $relative) {
    if (!$relative -or $relative -match '(^|/)(\.|\.\.)(/|$)|[\\:\x00-\x1f<>"|?*]' -or $relative -match '^(resources/app/profile|profile|Showcase Recordings)(/|$)') { throw 'Invalid installation path.' }
    $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
    if (!$full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Installation path escapes its root.' }
    $check = $full
    while ($check -and $check.Length -ge $root.Length) {
        if ((Test-Path -LiteralPath $check) -and ((Get-Item -LiteralPath $check -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Linked installation path.' }
        $check = Split-Path -Parent $check
    }
    return $full
}
try {
    if (!$source.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase) -or $target -eq [IO.Path]::GetPathRoot($target)) { throw 'Invalid update roots.' }
    if ($plan.pid -gt 0) {
        $null = SafePath $target '.mdlxl-installing/owner.json'
        $lockOwner = Get-Content -LiteralPath (Join-Path $lock 'owner.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($lockOwner.planFile -ne $PlanFile -or $lockOwner.pid -ne $plan.pid) { throw 'Update installation lock changed.' }
        $ownsLock = $true
        [IO.File]::WriteAllText((Join-Path $stage 'installer-ready'), [string]$PID)
        $owner = Get-Process -Id $plan.pid -ErrorAction SilentlyContinue
        if ($owner -and $owner.Path -ne $plan.executable) { throw 'Update process identity changed.' }
        if ($owner) { $owner.WaitForExit() }
    }
    # Recheck every destination after the editor has flushed and exited.
    foreach ($operation in $plan.operations) {
        $destination = SafePath $target $operation.relative
        if ((FileHash $destination) -ne $operation.before) { throw ('File changed before installation: ' + $operation.relative) }
        if ($operation.hash -and (FileHash (SafePath $source $operation.relative)) -ne $operation.hash) { throw 'Staged update verification failed.' }
    }
    if ($plan.mode -eq 'update') {
        $snapshot = Get-Content -LiteralPath (Join-Path $plan.snapshotRoot 'snapshot.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($file in $snapshot.files.PSObject.Properties) {
            if ((FileHash (SafePath $target $file.Name)) -ne $file.Value -or (FileHash (SafePath $plan.snapshotRoot $file.Name)) -ne $file.Value) { throw 'Previous version changed before installation.' }
        }
    }
    if (Test-Path -LiteralPath $previous) {
        $null = SafePath $target '.mdlxl-previous/snapshot.json'
        $retained = Get-Content -LiteralPath (Join-Path $previous 'snapshot.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($retained.schema -ne 1 -or $retained.product -ne 'mdlxl') { throw 'Invalid previous version snapshot.' }
    }
    # File verification can take several seconds. A desktop launch during that
    # time can lock the EXE again, so check immediately before replacing files.
    if ($plan.pid -gt 0) {
        $processName = [IO.Path]::GetFileNameWithoutExtension($plan.executable)
        foreach ($process in (Get-Process -Name $processName -ErrorAction SilentlyContinue)) {
            if ($process.Path -eq $plan.executable) { $process.WaitForExit() }
        }
    }
    foreach ($operation in $plan.operations) {
        $destination = SafePath $target $operation.relative
        if ($operation.before) {
            $saved = SafePath $backup $operation.relative
            [IO.Directory]::CreateDirectory((Split-Path -Parent $saved)) | Out-Null
            Copy-Item -LiteralPath $destination -Destination $saved
        }
        $changed.Add($operation)
        if ($operation.hash) {
            [IO.Directory]::CreateDirectory((Split-Path -Parent $destination)) | Out-Null
            ReplaceFile (SafePath $source $operation.relative) $destination
            if ((FileHash $destination) -ne $operation.hash) { throw 'Installed update verification failed.' }
        } else { Remove-Item -LiteralPath $destination }
    }
    if ($plan.mode -eq 'update' -or $plan.mode -eq 'revert') {
        if (Test-Path -LiteralPath $previous) { Move-Item -LiteralPath $previous -Destination $oldSnapshot; $snapshotMoved = $true }
        if ($plan.mode -eq 'update') {
            $snapshotWritten = $true
            Copy-Item -LiteralPath $plan.snapshotRoot -Destination $previous -Recurse
            foreach ($file in $snapshot.files.PSObject.Properties) {
                if ((FileHash (SafePath $previous $file.Name)) -ne $file.Value) { throw 'Previous version snapshot verification failed.' }
            }
        }
    }
    [IO.Directory]::CreateDirectory($plan.profile) | Out-Null
    [IO.File]::WriteAllText($plan.result, '{"ok":true}')
} catch {
    $failure = $_.Exception.Message
    if ($snapshotWritten) { $null = SafePath $target '.mdlxl-previous/snapshot.json'; Remove-Item -LiteralPath $previous -Recurse -Force }
    if ($snapshotMoved) { Move-Item -LiteralPath $oldSnapshot -Destination $previous }
    for ($index = $changed.Count - 1; $index -ge 0; $index--) {
        $operation = $changed[$index]
        $destination = SafePath $target $operation.relative
        if ($operation.before) {
            # A rejected copy may leave the destination unchanged and still locked.
            if ((FileHash $destination) -ne $operation.before) { ReplaceFile (SafePath $backup $operation.relative) $destination }
            if ((FileHash $destination) -ne $operation.before) { throw 'Rollback verification failed; installation remains locked.' }
        }
        elseif (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination }
    }
    [IO.Directory]::CreateDirectory($plan.profile) | Out-Null
    [IO.File]::WriteAllText($plan.result, (@{ok = $false; error = $failure} | ConvertTo-Json -Compress))
}
# Drain launches that loaded the old executable before it was replaced. They must
# finish the startup guard before the lock is released and the new app is started.
if ($ownsLock) {
    foreach ($process in (Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($plan.executable)) -ErrorAction SilentlyContinue)) {
        if ($process.Path -eq $plan.executable) { $process.WaitForExit() }
    }
}
# Release only after installation or verified rollback, never over partial files.
if ($ownsLock) { Remove-Item -LiteralPath $lock -Recurse -Force }
if ($plan.pid -gt 0 -and $ownsLock) {
    $env:MDLXL_PROFILE = $plan.profile
    Start-Process -FilePath $plan.executable -WorkingDirectory $target -WindowStyle Hidden
}
# Only this updater's verified temporary staging directory is disposable.
if ((Split-Path -Leaf $stage) -match '^mdlxl-update-' -and $stage -ne $target -and !$target.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase)) {
    Remove-Item -LiteralPath $stage -Recurse -Force
}
