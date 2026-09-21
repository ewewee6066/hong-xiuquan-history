param(
  [int]$From = 1,
  [int]$To = 7
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$shots = Join-Path $projectRoot 'shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null

$browsers = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe'
)
$browser = $browsers | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome or Edge was not found.' }

$indexPath = (Join-Path $projectRoot 'index.html').Replace('\', '/')
for ($i = $From; $i -le $To; $i++) {
  $url = "file:///${indexPath}?static=1#/$i"
  $out = Join-Path $shots ('s{0:d2}.png' -f $i)
  & $browser --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --window-size=1920,1080 --screenshot=$out $url | Out-Null
  if (-not (Test-Path -LiteralPath $out)) { throw "Slide $i failed to render." }
  Write-Output "Rendered $out"
}
