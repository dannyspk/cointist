param([int]$port = 3001)

$url = "http://localhost:$port/"
Write-Output "Measuring: $url"
try {
  $resp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
} catch {
  Write-Output "ERROR_FETCH:$url -> $_"
  exit 2
}
$html = $resp.Content
$htmlBytes = [System.Text.Encoding]::UTF8.GetByteCount($html)
Write-Output "HTML_BYTES:$htmlBytes"

# Regex to extract src/href attribute values (keep quotes escaped correctly)
# Use a here-string to avoid escaping quotes inside the pattern
$pattern = @'
(?:src|href)=["']([^"']+)["']
'@
$matches = [regex]::Matches($html, $pattern) | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -and $_ -notmatch '^data:' } | Select-Object -Unique

$total = $htmlBytes
Write-Output "ASSETS_FOUND: $($matches.Count)"
foreach ($l in $matches) {
  if ($l -match '^//') { $u = "http:$l" }
  elseif ($l -match '^/') { $u = "http://localhost:$port$l" }
  elseif ($l -match '^https?://(localhost|127\.0\.0\.1)') { $u = $l }
  else { continue }
  try {
    $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 15
    $len = $r.RawContentLength
    if (-not $len) { $len = [System.Text.Encoding]::UTF8.GetByteCount($r.Content) }
    Write-Output "$u -> $len"
    $total += $len
  } catch {
    Write-Output "FAILED:$u -> $_"
  }
}
Write-Output "TOTAL_BYTES:$total"
