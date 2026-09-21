# render.ps1 — 把 index.html 逐页渲染成 1920x1080 PNG
# 用法：
#   pwsh -File tools\render.ps1                     # 全部页 -> shots\s01.png ...
#   pwsh -File tools\render.ps1 -From 3 -To 5       # 只渲染第 3~5 页
#   pwsh -File tools\render.ps1 -Prefix probe      # 换前缀，方便对比
param(
  [string]$Html   = 'index.html',
  [string]$OutDir = 'shots',
  [int]$From      = 1,
  [int]$To        = 0,
  [int]$VirtualTime = 3000,
  [string]$Prefix = 's'
)
$ErrorActionPreference = 'Stop'

$base     = Split-Path -Parent $PSScriptRoot
$htmlPath = Join-Path $base $Html
$outPath  = Join-Path $base $OutDir
New-Item -ItemType Directory -Force -Path $outPath | Out-Null

$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
if (-not (Test-Path -LiteralPath $chrome)){ throw "找不到 Chrome: $chrome" }

$total = (Select-String -LiteralPath $htmlPath -Pattern '<section class="slide' -AllMatches).Count
if ($total -eq 0){ throw ("在 {0} 里没有找到 section.slide" -f $Html) }
if ($To -le 0 -or $To -gt $total){ $To = $total }

# 本机 Chrome 的 GPU 进程起不来，必须用下面这几个开关（已实测）
# 每次都用全新的 profile：避免和上一次没退干净的 Chrome 抢同一个目录（会静默不出图）
$profile = Join-Path $env:TEMP ('codex-hxq-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$uri     = ([System.Uri]$htmlPath).AbsoluteUri

Write-Host ("渲染 " + $Html + " 第 " + $From + "-" + $To + " 页，共 " + $total + " 页")
for ($i = $From; $i -le $To; $i++){
  $name = Join-Path $outPath ('{0}{1:00}.png' -f $Prefix, $i)
  if (Test-Path -LiteralPath $name){ Remove-Item -LiteralPath $name -Force }
  $chromeArgs = @(
    '--headless=new','--no-sandbox','--in-process-gpu','--disable-gpu-compositing',
    '--hide-scrollbars','--no-first-run','--disable-extensions',
    "--user-data-dir=$profile",
    '--window-size=1920,1080',
    "--virtual-time-budget=$VirtualTime",
    "--screenshot=$name",
    "${uri}?still=1#/$i"
  )
  # 自己拼命令行：Start-Process 不会替我们给带空格的参数加引号
  $argLine = ($chromeArgs | ForEach-Object {
      if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
    }) -join ' '
  $proc = Start-Process -FilePath $chrome -ArgumentList $argLine -NoNewWindow -Wait -PassThru
  $code = $proc.ExitCode
  $size = 0
  if (Test-Path -LiteralPath $name){ $size = (Get-Item -LiteralPath $name).Length }
  if ($size -eq 0){
    Write-Host ("  ! " + $i + " 页没有出图，Chrome 最后输出：")
    $log | Select-Object -Last 4 | ForEach-Object { Write-Host ("    " + $_) }
  }
  '{0,3}  exit={1}  {2,8:N0} KB' -f $i, $code, ($size / 1KB)
}
Write-Host '完成。'
