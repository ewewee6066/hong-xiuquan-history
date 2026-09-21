# render.ps1 -- screenshot every slide of the deck with headless Chrome.
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\tools\render.ps1
#   powershell -ExecutionPolicy Bypass -File .\tools\render.ps1 -From 6 -To 10
# Notes:
#   * --no-sandbox is required in this environment, otherwise the GPU process
#     crashes with 0xC0000005 and Chrome exits before writing anything.
#   * ?static=1 turns on the deck's capture mode: entry animations are pinned to
#     their final state and canvas FX are skipped, so a screenshot can never
#     catch a half-faded slide.
#   * every run uses a fresh --user-data-dir so parallel runs do not fight.
param(
  [string]$Html = 'index.html',
  [string]$Out  = 'shots',
  [int]$From = 1,
  [int]$To = 0,
  [int]$Budget = 7000,
  [switch]$NoStatic
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$file = if ([System.IO.Path]::IsPathRooted($Html)) { $Html } else { Join-Path $root $Html }
if (-not (Test-Path $file)) { throw "html not found: $file" }
$outDir = if ([System.IO.Path]::IsPathRooted($Out)) { $Out } else { Join-Path $root $Out }
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$chromeCandidates = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'))
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Chrome not found' }

$raw  = Get-Content $file -Raw -Encoding UTF8
$total = ([regex]::Matches($raw, '<section class="slide')).Count
if ($total -eq 0) { throw 'no <section class="slide"> found' }
if ($To -le 0 -or $To -gt $total) { $To = $total }

$url = 'file:///' + ($file -replace '\\', '/' -replace ' ', '%20')
$suffix = if ($NoStatic) { '' } else { '?static=1' }
$flags = @(
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--hide-scrollbars', '--force-device-scale-factor=1',
  '--window-size=1920,1080', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  "--virtual-time-budget=$Budget")

$ok = 0; $fail = 0
for ($n = $From; $n -le $To; $n++) {
  $nn = $n.ToString('00')
  $png = Join-Path $outDir "s$nn.png"
  $ud  = Join-Path $env:TEMP ("crshot_" + [guid]::NewGuid().ToString('N').Substring(0, 8))
  # Chrome writes noisy warnings to stderr; keep them from aborting the script.
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  & $chrome @flags "--user-data-dir=$ud" "--screenshot=$png" "$url$suffix#/$n" 2>&1 | Out-Null
  $ErrorActionPreference = $prev
  if (Test-Path $png) { $ok++ } else { $fail++; Write-Host "FAILED slide $n" }
}
Write-Host "slides=$total  ok=$ok  failed=$fail"
Write-Host "output -> $outDir"
Get-ChildItem (Join-Path $outDir 's??.png') | Select-Object Name, Length | Format-Table -AutoSize
