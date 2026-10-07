param([string]$Archive, [string]$Destination)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$root = [IO.Path]::GetFullPath($Destination).TrimEnd('\') + '\'
$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
try {
    $seen = @{}
    $expanded = 0L
    foreach ($entry in $zip.Entries) {
        $expanded += $entry.Length
        if ($expanded -gt 3GB -or $zip.Entries.Count -gt 30000) { throw 'Update archive exceeds its size limit.' }
        $name = $entry.FullName.Replace('\', '/').TrimEnd('/')
        if (!$name) { continue }
        if ($name -ne 'MDLxL-win32-x64' -and !$name.StartsWith('MDLxL-win32-x64/')) { throw 'Invalid update archive root.' }
        foreach ($part in $name.Split('/')) {
            if (!$part -or $part -eq '.' -or $part -eq '..' -or $part -match '[:\x00-\x1f<>"|?*]' -or $part -match '[. ]$' -or $part -match '^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)') { throw 'Invalid update archive path.' }
        }
        if ($seen.ContainsKey($name.ToLowerInvariant())) { throw 'Duplicate update archive entry.' }
        $seen[$name.ToLowerInvariant()] = $true
        $full = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $name))
        if (!$full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw 'Update archive escapes extraction folder.' }
        if (($entry.ExternalAttributes -band 0x400) -ne 0 -or (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000) { throw 'Linked update archive entry.' }
    }
} finally { $zip.Dispose() }
[IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Destination)
