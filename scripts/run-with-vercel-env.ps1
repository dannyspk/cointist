<#
Load environment variables from a Vercel-exported `.vercel.env` file and run
the full daily pipeline in non-interactive auto mode. This avoids pasting
secrets into the shell manually.

Usage:
  1) Place the `.vercel.env` file you exported from Vercel in the project root.
  2) From PowerShell (project root):
       .\scripts\run-with-vercel-env.ps1

Notes:
  - This script will NOT log secret values. It will print which keys were set.
  - The pipeline runs in `--auto` mode (selects top items automatically). It
    will NOT publish unless you pass --publish as an argument to this script.
  - Example to run with publish: .\scripts\run-with-vercel-env.ps1 --publish
#>

param(
  [switch]$Publish,
  [switch]$Auto,
  [int]$Count = 5,
  [string]$Input = '.\tmp\trending.json'
)

Set-StrictMode -Version Latest
Push-Location (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent) > $null
Pop-Location > $null

$root = Resolve-Path ..\ | Select-Object -ExpandProperty Path
Set-Location $root

$vercelEnvPath = Join-Path $root '.vercel.env'
if (-not (Test-Path $vercelEnvPath)){
  Write-Error "Missing .vercel.env in project root. Export your Vercel env to .vercel.env and try again."
  exit 1
}

Write-Output "Loading environment variables from .vercel.env (sensitive values hidden)"
Get-Content $vercelEnvPath | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  # handle KEY=VALUE (VALUE may contain '=' — split on first '=')
  $idx = $line.IndexOf('=')
  if ($idx -lt 0) { return }
  $key = $line.Substring(0,$idx).Trim()
  $value = $line.Substring($idx+1).Trim()
  # strip surrounding quotes if present
  if ($value.StartsWith('"') -and $value.EndsWith('"')){ $value = $value.Substring(1,$value.Length-2) }
  if ($value.StartsWith("'") -and $value.EndsWith("'")){ $value = $value.Substring(1,$value.Length-2) }
  # set env variable in this session
  Set-Item -Path Env:$key -Value $value
  Write-Output "Set env: $key"
}


# Build pipeline command (interactive by default; pass -Auto to run non-interactive)
$args = @('--in=' + $Input, '--count=' + $Count)
if ($Auto) { $args += '--auto' }
if ($Publish) { $args += '--publish' }

Write-Output "Running pipeline: node scripts/full-daily-pipeline.js $($args -join ' ')"
Write-Output "(This run will use Supabase if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .vercel.env)"

& node "scripts/full-daily-pipeline.js" $args

if ($LASTEXITCODE -ne 0) { Write-Error "Pipeline exited with code $LASTEXITCODE"; exit $LASTEXITCODE }
Write-Output "Pipeline finished with exit code $LASTEXITCODE"
