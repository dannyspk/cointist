# PowerShell wrapper: .\generate-static-sitemap.ps1
param([string]$site = 'https://cointist.net')
$env:SITE_URL = $site
node .\scripts\generate-static-sitemap.js
