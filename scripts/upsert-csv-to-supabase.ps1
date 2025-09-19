param(
  [Parameter(Mandatory=$true)] [string] $CsvPath,
  [int] $BatchSize = 100
)

if (-not (Test-Path $CsvPath)) { Write-Error "CSV file not found: $CsvPath"; exit 2 }

$supabaseUrl = $env:SUPABASE_URL
$supabaseKey = $env:SUPABASE_SERVICE_ROLE_KEY
if (-not $supabaseUrl -or -not $supabaseKey) { Write-Error 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment.'; exit 3 }

function Convert-RowToJson($row) {
  # Convert hashtable row to JSON, attempting to unquote JSON-like fields (e.g., tags)
  $obj = @{}
  foreach ($k in $row.Keys) {
    $v = $row[$k]
    if ($null -eq $v) { $obj[$k] = $null; continue }
    $trim = $v.Trim()
    # try to parse as JSON if it looks like an array or object
    if ($trim.StartsWith('{') -or $trim.StartsWith('[')) {
      try { $parsed = $trim | ConvertFrom-Json; $obj[$k] = $parsed; continue } catch {}
    }
    # try to parse numeric
    if ($trim -match '^[0-9]+$') { $obj[$k] = [int]$trim; continue }
    if ($trim -match '^[0-9]+\.[0-9]+$') { $obj[$k] = [double]$trim; continue }
    # booleans
    if ($trim.ToLower() -in @('true','false')) { $obj[$k] = $trim.ToLower() -eq 'true'; continue }
    $obj[$k] = $v
  }
  return $obj
}

try {
  Write-Host "Reading CSV: $CsvPath"
  $rows = Import-Csv -Path $CsvPath
  $total = $rows.Count
  Write-Host "Rows: $total"
  $i = 0
  while ($i -lt $total) {
    $batch = $rows[$i..([math]::Min($i + $BatchSize - 1, $total - 1))]
    $jsonArray = @()
    foreach ($r in $batch) { $jsonArray += (Convert-RowToJson $r) }
    $body = ($jsonArray | ConvertTo-Json -Depth 10)
    # Post to Articles endpoint with upsert by slug
    $uri = "$supabaseUrl/rest/v1/Article?on_conflict=slug"
    Write-Host "Posting batch $([int]($i/$BatchSize)+1) to $uri"
    try {
      $resp = Invoke-RestMethod -Method Post -Uri $uri -Headers @{ apikey = $supabaseKey; Authorization = "Bearer $supabaseKey"; Prefer = 'return=representation, resolution=merge-duplicates'; 'Content-Type' = 'application/json' } -Body $body
      Write-Host "Inserted/Upserted: $($resp.Count) rows"
    } catch {
      Write-Error "Batch POST failed: $($_.Exception.Message)"
      Write-Host "Response body: $body" -ForegroundColor Yellow
      exit 5
    }
    $i += $BatchSize
  }
  Write-Host 'Done.'
} catch {
  Write-Error $_.Exception.Message
  exit 6
}
