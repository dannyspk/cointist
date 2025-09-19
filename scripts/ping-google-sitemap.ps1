# PowerShell wrapper: .\ping-google-sitemap.ps1 [sitemapUrl]
param(
  [string]$sitemap = 'https://cointist.net/sitemap.xml'
)
$env:SITEMAP_URL = $sitemap
Write-Output "Pinging Google for sitemap: $sitemap"
node .\scripts\ping-google-sitemap.js
