[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourceLogo = Join-Path $repoRoot 'frontend\public\openfire-logo-dark-v2-512.png'
$assetDir = Join-Path $repoRoot 'store-listing\assets'
$output = Join-Path $assetDir 'feature-graphic.png'
New-Item -ItemType Directory -Path $assetDir -Force | Out-Null

$canvas = New-Object System.Drawing.Bitmap 1024, 500
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit

$background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(16, 16, 16))
$accent = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(29, 31, 34))
$white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(202, 208, 216))
$titleFont = New-Object System.Drawing.Font 'Segoe UI', 68, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
$taglineFont = New-Object System.Drawing.Font 'Segoe UI', 27, ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel)
$logo = [System.Drawing.Image]::FromFile($sourceLogo)

try {
  $graphics.FillRectangle($background, 0, 0, 1024, 500)
  $graphics.FillRectangle($accent, 0, 0, 392, 500)
  $graphics.DrawImage($logo, 36, 46, 356, 356)
  $graphics.DrawString('OpenFIRE', $titleFont, $white, 438, 150)
  $graphics.DrawString('Plan, invest, and track your path', $taglineFont, $muted, 443, 250)
  $graphics.DrawString('to financial independence.', $taglineFont, $muted, 443, 289)
  $canvas.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
  $logo.Dispose()
  $titleFont.Dispose()
  $taglineFont.Dispose()
  $background.Dispose()
  $accent.Dispose()
  $white.Dispose()
  $muted.Dispose()
  $graphics.Dispose()
  $canvas.Dispose()
}

Write-Host "Created $output"
