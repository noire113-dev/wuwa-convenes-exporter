param([ValidateSet('Prepare', 'Apply', 'Launch')][string]$Mode, [string]$ConfigFile)
$ErrorActionPreference = 'Stop'
$cfg = Get-Content -LiteralPath $ConfigFile -Raw -Encoding UTF8 | ConvertFrom-Json
$taskDir = Split-Path -Parent $ConfigFile
$target = [IO.Path]::GetFullPath($cfg.target)
$stage = [IO.Path]::GetFullPath($cfg.stage)
$backup = [IO.Path]::GetFullPath($cfg.backup)
$parent = Split-Path -Parent $target
if ((Split-Path -Parent $stage) -ne $parent -or (Split-Path -Parent $backup) -ne $parent -or !(Split-Path -Leaf $stage).StartsWith('.wuwa-update-') -or !$backup.StartsWith($target + '.backup-') -or $cfg.exe -ne 'WuWa Convenes Exporter.exe') { throw 'Invalid update paths' }

if ($Mode -eq 'Launch') {
  $helperArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"'), '-Mode', 'Apply', '-ConfigFile', ('"' + $ConfigFile + '"'))
  $helper = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -ArgumentList $helperArgs -WorkingDirectory $taskDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $taskDir 'helper-out.log') -RedirectStandardError (Join-Path $taskDir 'helper-error.log')
  Write-Output $helper.Id
  exit 0
}

if ($Mode -eq 'Prepare') {
  if (Test-Path -LiteralPath $stage) { throw 'Stage already exists' }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($cfg.archive)
  try {
    $root = 'WuWa Convenes Exporter-win32-x64/'
    $total = 0L
    foreach ($entry in $zip.Entries) {
      $name = $entry.FullName.Replace('\', '/')
      if (!$name.StartsWith($root, [StringComparison]::Ordinal)) { throw 'Unexpected archive layout' }
      $relative = $name.Substring($root.Length)
      if (!$relative) { continue }
      if ($relative.Contains(':') -or $relative -match '(^|/)\.\.(/|$)') { throw 'Unsafe archive path' }
      $dest = [IO.Path]::GetFullPath((Join-Path $stage $relative))
      if (!$dest.StartsWith($stage + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Archive escapes staging directory' }
      if ($relative -match '^(?i:userData)(/|$)') { throw 'Release must not contain userData' }
      $total += $entry.Length
      if ($total -gt 2GB) { throw 'Archive too large' }
    }
    New-Item -ItemType Directory -Path $stage | Out-Null
    foreach ($entry in $zip.Entries) {
      $relative = $entry.FullName.Replace('\', '/').Substring($root.Length)
      if (!$relative) { continue }
      $dest = Join-Path $stage $relative
      if ($relative.EndsWith('/')) { New-Item -ItemType Directory -Force -Path $dest | Out-Null }
      else {
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $dest) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $false)
      }
    }
    if (!(Test-Path -LiteralPath (Join-Path $stage $cfg.exe)) -or !(Test-Path -LiteralPath (Join-Path $stage 'resources\app.asar'))) { throw 'Incomplete update package' }
    $actual = [Diagnostics.FileVersionInfo]::GetVersionInfo((Join-Path $stage $cfg.exe)).ProductVersion
    if ($actual -ne $cfg.version) { throw "Package version mismatch: $actual" }
  } catch {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    throw
  } finally { $zip.Dispose() }
  exit 0
}

$movedOld = $false
$installed = $false
try {
  if (!(Test-Path -LiteralPath (Join-Path $stage $cfg.exe)) -or (Test-Path -LiteralPath $backup)) { throw 'Update staging is unavailable' }
  # Signal readiness before waiting for Electron to quit.
  [IO.File]::WriteAllText((Join-Path $taskDir 'helper-ready'), 'ready')
  $running = Get-Process -Id $cfg.pid -ErrorAction SilentlyContinue
  if ($running) { Wait-Process -Id $cfg.pid -Timeout 60 }
  # Other instances can hold files or write records during replacement.
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    $others = Get-Process | Where-Object { $_.Path -eq (Join-Path $target $cfg.exe) }
    if (!$others) { break }
    Start-Sleep -Milliseconds 250
  }
  if ($others) { throw 'Another application instance is still running' }
  $data = Join-Path $target 'userData'
  if (Test-Path -LiteralPath $data) { Copy-Item -LiteralPath $data -Destination (Join-Path $stage 'userData') -Recurse -Force }
  # Move on the same volume; preserve the complete old installation for rollback.
  Move-Item -LiteralPath $target -Destination $backup
  $movedOld = $true
  Move-Item -LiteralPath $stage -Destination $target
  $installed = $true
  Start-Process -FilePath (Join-Path $target $cfg.exe) -WorkingDirectory $target -WindowStyle Normal
} catch {
  $problem = $_.Exception.Message
  if ($installed) { Move-Item -LiteralPath $target -Destination $stage }
  if ($movedOld) { Move-Item -LiteralPath $backup -Destination $target }
  [IO.File]::WriteAllText((Join-Path $taskDir 'error.txt'), $problem)
  if (Test-Path -LiteralPath (Join-Path $target $cfg.exe)) { Start-Process -FilePath (Join-Path $target $cfg.exe) -WorkingDirectory $target -WindowStyle Normal }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show("Update failed. The previous version was kept.`n$problem`nLog: $taskDir", 'WuWa Convenes Exporter') | Out-Null
  exit 1
}
