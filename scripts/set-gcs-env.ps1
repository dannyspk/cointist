<#
Persist GCS-related environment variables for current user using setx.
Usage (PowerShell as normal user):
  .\scripts\set-gcs-env.ps1 -Bucket my-bucket -ProjectId my-project -CredPath 'C:\path\to\service-account.json'

This will call `setx` and make the variables available for future PowerShell sessions.
You still need to start Next in a session that has these envs (or restart your shell).
Warning: do NOT store service-account JSON contents in plain envs in shared machines.
#>
param(
  [Parameter(Mandatory=$false)] [string]$Bucket,
  [Parameter(Mandatory=$false)] [string]$ProjectId,
  [Parameter(Mandatory=$false)] [string]$CredPath,
  [Parameter(Mandatory=$false)] [switch]$SetKeyJson
)

function AskIfEmpty([string]$val, [string]$prompt) {
  if (-not $val) { return Read-Host $prompt } else { return $val }
}

$bucket = AskIfEmpty $Bucket "GCS bucket name (e.g. cointist-images)"
$project = AskIfEmpty $ProjectId "GCS project id (optional)"
# If you downloaded the service-account JSON to the default Downloads path, use it as a convenience default.
$defaultCredPath = 'C:\Users\Danish\Downloads\cointist-cc502bbafba0.json'
$cred = AskIfEmpty $CredPath "Path to service-account JSON file (recommended)"
if (-not $cred -and (Test-Path $defaultCredPath)) {
  Write-Host "Found a local service account JSON at $defaultCredPath; using that as the default credential path."
  $cred = $defaultCredPath
}

Write-Host "About to persist the following envs for the current user:"
Write-Host "  STORAGE_PROVIDER = gcs"
Write-Host "  GCS_BUCKET       = $bucket"
if ($project) { Write-Host "  GCS_PROJECT_ID   = $project" }
if ($cred) { Write-Host "  GOOGLE_APPLICATION_CREDENTIALS = $cred" }

$confirm = Read-Host "Proceed and write these to the user environment variables? (Y/N)"
if ($confirm -ne 'Y' -and $confirm -ne 'y') { Write-Host 'Aborted'; exit 1 }

# setx writes to the user environment. Note: changes show up in new shells only.
setx STORAGE_PROVIDER "gcs" | Out-Null
setx GCS_BUCKET "$bucket" | Out-Null
if ($project) { setx GCS_PROJECT_ID "$project" | Out-Null }
if ($cred) { setx GOOGLE_APPLICATION_CREDENTIALS "$cred" | Out-Null }

if ($SetKeyJson.IsPresent) {
  Write-Host "You requested to set GCS_KEY_JSON as well. This will place the JSON into your user env (be careful)."
  $jsonPath = $cred
  if (-not $jsonPath) { $jsonPath = Read-Host "Path to JSON file to read into GCS_KEY_JSON" }
  try {
    $content = Get-Content -Raw -Path $jsonPath
    setx GCS_KEY_JSON $content | Out-Null
  } catch {
    Write-Host "Failed to read JSON file: $_"; exit 1
  }
}

Write-Host "Environment variables written. Restart your terminal or start a new PowerShell session to pick them up."
Write-Host "Start the dev server in that new session: npm run dev"
