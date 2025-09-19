$root = Resolve-Path .
$excludePatterns = 'node_modules','.next','.git'

# script-scoped guards
$script:populateRunning = $false
$script:lastPopulateAt = (Get-Date).AddYears(-1)

$w = New-Object System.IO.FileSystemWatcher
$w.Path = $root
$w.IncludeSubdirectories = $true
$w.Filter = '*.*'
$w.NotifyFilter = [IO.NotifyFilters]::FileName -bor [IO.NotifyFilters]::LastWrite

function Invoke-PopulateIfNeeded {
  try {
    if ($script:populateRunning) { Write-Output "populate already running; skipping"; return }
    $since = (Get-Date) - $script:lastPopulateAt
    if ($since.TotalSeconds -lt 8) { Write-Output "populate ran recently ($([int]$since.TotalSeconds)s); skipping"; return }
    $script:populateRunning = $true
    $script:lastPopulateAt = Get-Date
    $repo = (Get-Location).Path
    $scriptPath = Join-Path $repo 'scripts\populate-ids-from-log.js'
    if (-not (Test-Path $scriptPath)) { Write-Output "populate script not found: $scriptPath"; return }
    Write-Output "Running populate script: $scriptPath"
    try {
      # Run node synchronously and inherit streams for visibility
      Start-Process -FilePath 'node' -ArgumentList @($scriptPath) -NoNewWindow -Wait
      Write-Output "populate script finished"
    } catch {
      Write-Output "populate script error: $_"
    }
  } finally {
    Start-Sleep -Seconds 1
    $script:populateRunning = $false
  }
}

$action = {
  $p = $Event.SourceEventArgs.FullPath
  if ($p -match 'node_modules' -or $p -match '\.next' -or $p -match '\.git') { return }
  $t = (Get-Item $p -ErrorAction SilentlyContinue).LastWriteTime
  Write-Output "CHANGED: $p    ($t)"

  # Only react to files in tmp/ that the pipeline produces
  if ($p -match "\\tmp\\pipeline-rephraser\.log$" -or $p -match "\\tmp\\upserted-.*\.html$" -or $p -match "\\tmp\\selection-from-pipeline\.json$") {
    try { Invoke-PopulateIfNeeded } catch { Write-Output "Invoke-PopulateIfNeeded failed: $_" }
  }
}

Register-ObjectEvent -InputObject $w -EventName Changed -Action $action | Out-Null
Register-ObjectEvent -InputObject $w -EventName Created -Action $action | Out-Null
Register-ObjectEvent -InputObject $w -EventName Renamed -Action $action | Out-Null
$w.EnableRaisingEvents = $true
Write-Output "Watcher started at $(Get-Date)  watching $root (excluding node_modules/.next/.git)"
while ($true) { Start-Sleep -Seconds 1 }
