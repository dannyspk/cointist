# Save as check-sitemap.ps1 and run: .\check-sitemap.ps1
$site = 'https://cointist.net'
$sitemapUrl = "$site/sitemap.xml"
$outFile = Join-Path (Get-Location) 'sitemap-check-report.csv'

Write-Output "Fetching sitemap: $sitemapUrl"
try {
  $smap = Invoke-WebRequest -Uri $sitemapUrl -UseBasicParsing -ErrorAction Stop
} catch {
  Write-Error "Failed to fetch sitemap: $_"
  exit 1
}

[xml]$xml = $smap.Content
$urls = @()
if ($xml.urlset) {
  $urls = $xml.urlset.url | ForEach-Object { $_.loc.Trim() }
} elseif ($xml.sitemapindex) {
  # sitemapindex: fetch each sitemap listed
  $sitemaps = $xml.sitemapindex.sitemap | ForEach-Object { $_.loc.Trim() }
  foreach ($sm in $sitemaps) {
    try {
      $r = Invoke-WebRequest -Uri $sm -UseBasicParsing -ErrorAction Stop
      [xml]$sx = $r.Content
      $sx.urlset.url | ForEach-Object { $urls += $_.loc.Trim() }
    } catch {
      $msg = $_.Exception.Message -replace '"','""'
      Write-Warning ("Failed to fetch child sitemap {0}: {1}" -f $sm, $msg)
    }
  }
}

Write-Output ("Found {0} URLs in sitemap" -f $urls.Count)
# CSV header
"source_url,final_url,status_code,canonical,meta_robots,notes" | Out-File -FilePath $outFile -Encoding UTF8

# Loop and inspect
foreach ($u in $urls) {
  Write-Output "Checking $u"
  try {
    $resp = Invoke-WebRequest -Uri $u -Headers @{ 'User-Agent' = 'Googlebot/2.1 (+http://www.google.com/bot.html)'} -UseBasicParsing -MaximumRedirection 10 -ErrorAction Stop
    $final = $resp.BaseResponse.ResponseUri.AbsoluteUri
    $status = $resp.StatusCode.value__
    $html = $resp.Content
    # extract canonical
    $canonical = ''
    $m = Select-String -InputObject $html -Pattern '<link[^>]*rel=[\"\'']canonical[\"\''][^>]*>' -AllMatches
    if ($m) { $canonical = ($m.Matches | ForEach-Object { $_.Value }) -join ' | ' }
    # extract meta robots
    $meta = ''
    $mr = Select-String -InputObject $html -Pattern '<meta[^>]*name=[\"\'']robots[\"\''][^>]*>' -AllMatches
    if ($mr) { $meta = ($mr.Matches | ForEach-Object { $_.Value }) -join ' | ' }
    $notes = @()
    if ($final -ne $u) { $notes += 'redirected' }
    if ($canonical -and ($canonical -notmatch [regex]::Escape($u))) { $notes += 'canonical-differs' }
    if ($meta -match 'noindex') { $notes += 'meta-noindex' }
    $line = ('"{0}","{1}",{2},"{3}","{4}","{5}"' -f $u,$final,$status,$canonical,$meta,($notes -join ';'))
    $line | Out-File -FilePath $outFile -Append -Encoding UTF8
  } catch {
    $err = $_.Exception.Message -replace '"','""'
    ('"{0}","","","", "", "error: {1}"' -f $u,$err) | Out-File -FilePath $outFile -Append -Encoding UTF8
  }
}

Write-Output "Completed. Report saved to: $outFile"
