# make-icon.ps1 - generates internpilot.ico from the same geometry as app/icon.svg
# (hot-pink rounded tile, ink border, hard offset shadow, cream 5-point star).
# Produces a multi-resolution, PNG-compressed .ico so the Windows shortcut and
# taskbar stay crisp from 16px up to 256px.
#
#   powershell -ExecutionPolicy Bypass -File make-icon.ps1
param(
  [string]$OutPath = (Join-Path (Split-Path -Parent $MyInvocation.MyCommand.Definition) 'internpilot.ico')
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$pink  = [System.Drawing.Color]::FromArgb(255, 0xff, 0x1f, 0x6e)
$ink   = [System.Drawing.Color]::FromArgb(255, 0x0a, 0x0a, 0x0a)
$cream = [System.Drawing.Color]::FromArgb(255, 0xf4, 0xf0, 0xe6)
# Star outline vertices in the 512x512 viewBox (outer/inner alternating).
$star  = @(239,98, 271,189, 367,191, 290,250, 318,342, 239,287, 160,342, 187,250, 111,191, 207,189)

function New-RoundRect([double]$x, [double]$y, [double]$w, [double]$h, [double]$r) {
  $d = $r * 2
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-IconPng([int]$S) {
  $sc = $S / 512.0
  $bmp = New-Object System.Drawing.Bitmap($S, $S, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  # hard offset shadow
  $g.FillPath((New-Object System.Drawing.SolidBrush($ink)), (New-RoundRect (62*$sc) (60*$sc) (386*$sc) (386*$sc) (88*$sc)))

  # pink tile + chunky ink border
  $tile = New-RoundRect (46*$sc) (42*$sc) (386*$sc) (386*$sc) (88*$sc)
  $g.FillPath((New-Object System.Drawing.SolidBrush($pink)), $tile)
  $pen = New-Object System.Drawing.Pen($ink, [float](14*$sc))
  $pen.Alignment = [System.Drawing.Drawing2D.PenAlignment]::Center
  $g.DrawPath($pen, $tile)

  # cream star
  $pts = New-Object 'System.Collections.Generic.List[System.Drawing.PointF]'
  for ($i = 0; $i -lt $star.Length; $i += 2) {
    $pts.Add((New-Object System.Drawing.PointF([float]($star[$i]*$sc), [float]($star[$i+1]*$sc))))
  }
  $g.FillPolygon((New-Object System.Drawing.SolidBrush($cream)), $pts.ToArray())

  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return ,$ms.ToArray()
}

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$blobs = @()
foreach ($s in $sizes) { $blobs += , (New-IconPng $s) }

# Pack the PNGs into an ICO container (Vista+ supports PNG-compressed frames).
$out = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($out)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)  # ICONDIR
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $s = $sizes[$i]; $len = $blobs[$i].Length
  $dim = if ($s -ge 256) { 0 } else { $s }   # 0 means 256 in the ICO spec
  $bw.Write([Byte]$dim); $bw.Write([Byte]$dim); $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$len); $bw.Write([UInt32]$offset)
  $offset += $len
}
foreach ($b in $blobs) { $bw.Write($b) }
$bw.Flush()
[System.IO.File]::WriteAllBytes($OutPath, $out.ToArray())
$bw.Dispose(); $out.Dispose()
Write-Host ("Wrote {0} ({1:N1} KB, sizes: {2})" -f $OutPath, ((Get-Item $OutPath).Length / 1KB), ($sizes -join ', '))
