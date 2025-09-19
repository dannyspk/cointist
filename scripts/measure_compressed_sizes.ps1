param(
  [string]$url = "http://localhost:3000/",
  [int]$port = 3000
)

if (-not $url) { $url = "http://localhost:$port/" }
Write-Output "Measuring (compressed transfer bytes): $url"

# Fetch decompressed HTML for parsing asset URLs
try {
  $htmlResp = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
} catch {
  Write-Output "ERROR_FETCH_HTML:$url -> $_"
  exit 2
}
$html = $htmlResp.Content
$htmlUncompressedBytes = [System.Text.Encoding]::UTF8.GetByteCount($html)
Write-Output "HTML_UNCOMPRESSED_BYTES:$htmlUncompressedBytes"

# Prepare an HttpClient that does NOT automatically decompress so we can measure compressed bytes
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.AutomaticDecompression = [System.Net.DecompressionMethods]::None
$client = New-Object System.Net.Http.HttpClient($handler)
$client.DefaultRequestHeaders.Remove('Accept-Encoding') > $null 2>&1
$client.DefaultRequestHeaders.Add('Accept-Encoding','br, gzip')

# Measure compressed HTML bytes
try{
  $resp = $client.GetAsync($url).Result
  $htmlCompressedBytes = ($resp.Content.ReadAsByteArrayAsync().Result).Length
  $htmlEnc = ($resp.Content.Headers.ContentEncoding -join ',') -replace '^$','identity'
  Write-Output "HTML_COMPRESSED_BYTES:$htmlCompressedBytes (encoding: $htmlEnc)"
} catch {
  Write-Output "ERROR_COMPRESSED_HTML:$url -> $_"
  $htmlCompressedBytes = 0
}

# Extract asset URLs from decompressed HTML
$pattern = @'
(?:src|href)=["']([^"']+)["']
'@
$matches = [regex]::Matches($html, $pattern) | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -and $_ -notmatch '^data:' } | Select-Object -Unique
Write-Output "ASSETS_FOUND: $($matches.Count)"

$totalCompressed = $htmlCompressedBytes
foreach ($l in $matches) {
  if ($l -match '^//') { $u = "http:$l" }
  elseif ($l -match '^/') { $u = "http://localhost:$port$l" }
  elseif ($l -match '^https?://(localhost|127\.0\.0\.1)') { $u = $l }
  else { continue }
  try {
    $r = $client.GetAsync($u).Result
    $bytes = ($r.Content.ReadAsByteArrayAsync().Result).Length
    $enc = ($r.Content.Headers.ContentEncoding -join ',') -replace '^$','identity'
    Write-Output "$u -> $bytes (encoding: $enc)"
    $totalCompressed += $bytes
  } catch {
    Write-Output "FAILED_COMPRESSED:$u -> $_"
  }
}
Write-Output "TOTAL_COMPRESSED_BYTES:$totalCompressed"

# Also print a small summary comparing uncompressed vs compressed HTML
if ($htmlUncompressedBytes -gt 0) {
  $ratio = [Math]::Round(($htmlCompressedBytes / $htmlUncompressedBytes) * 100, 1)
  Write-Output "HTML_COMP_RATIO:$ratio% (compressed / uncompressed)"
}

# Dispose client
$client.Dispose()
