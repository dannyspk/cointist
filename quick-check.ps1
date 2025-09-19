param([string[]]$urls)
if(-not $urls) { $urls = @('https://cointist.net/','https://cointist.net/guides','https://cointist.net/analysis','https://cointist.net/advertise') }
foreach($u in $urls){
  Write-Output "Checking: $u"
  try{
    $r = Invoke-WebRequest -Uri $u -Headers @{ 'User-Agent' = 'Googlebot/2.1 (+http://www.google.com/bot.html)'} -UseBasicParsing -MaximumRedirection 10 -ErrorAction Stop
    $html = $r.Content
    $canon = (Select-String -InputObject $html -Pattern '<link[^>]*rel=[\"\'']canonical[\"\''][^>]*>' -AllMatches).Matches | ForEach-Object { $_.Value } | Out-String
    $robots = (Select-String -InputObject $html -Pattern '<meta[^>]*name=[\"\'']robots[\"\''][^>]*>' -AllMatches).Matches | ForEach-Object { $_.Value } | Out-String
    Write-Output "  canonical: $canon"
    Write-Output "  robots: $robots"
  } catch { $msg = $_.Exception.Message -replace '"','""'; Write-Warning ("Failed {0}: {1}" -f $u, $msg) }
}
