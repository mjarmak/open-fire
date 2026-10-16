[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent $PSScriptRoot
$resDir = Join-Path $repoRoot 'android\app\src\main\res'
[xml]$icon = Get-Content -LiteralPath (Join-Path $resDir 'mipmap-anydpi-v26\ic_launcher.xml') -Raw
$ns = [System.Xml.XmlNamespaceManager]::new($icon.NameTable)
$ns.AddNamespace('android', 'http://schemas.android.com/apk/res/android')
$background = $icon.SelectSingleNode('/adaptive-icon/background/@android:drawable', $ns)
$foreground = $icon.SelectSingleNode('/adaptive-icon/foreground/inset', $ns)
if ($null -eq $background -or $background.Value -ne '@color/launcher_background' -or $null -eq $foreground) {
  throw 'The adaptive icon needs a solid launcher background and an inset foreground logo.'
}
$insetValue = $foreground.GetAttribute('inset', $ns.LookupNamespace('android'))
if ($insetValue -notmatch '^([0-9]+(?:\.[0-9]+)?)%$') {
  throw 'Use a percentage foreground inset so the logo scales consistently at every launcher size.'
}
$inset = [double]::Parse($Matches[1], [Globalization.CultureInfo]::InvariantCulture) / 100
if ($inset -le 0 -or $inset -ge 0.5) { throw 'Invalid foreground inset.' }
if ($foreground.GetAttribute('drawable', $ns.LookupNamespace('android')) -ne '@mipmap/ic_maskable') {
  throw 'Unexpected adaptive foreground artwork.'
}
[xml]$colors = Get-Content -LiteralPath (Join-Path $resDir 'values\colors.xml') -Raw
$colorValue = $colors.SelectSingleNode('/resources/color[@name="launcher_background"]').InnerText
$backgroundColor = [System.Drawing.ColorTranslator]::FromHtml($colorValue)
$images = @(Get-ChildItem -Path (Join-Path $resDir 'mipmap-*\ic_maskable.png'))
if ($images.Count -ne 5) { throw 'Expected foreground artwork for all five launcher densities.' }

foreach ($file in $images) {
  $bitmap = [System.Drawing.Bitmap]::new($file.FullName)
  try {
    if ($bitmap.Width -ne $bitmap.Height) { throw "Non-square icon: $($file.FullName)" }
    $maxRadius = 0.0
    $artPixels = 0
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
      for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $pixel = $bitmap.GetPixel($x, $y)
        $difference = [Math]::Max([Math]::Abs([int]$pixel.R - $backgroundColor.R),
          [Math]::Max([Math]::Abs([int]$pixel.G - $backgroundColor.G), [Math]::Abs([int]$pixel.B - $backgroundColor.B)))
        if ($pixel.A -lt 200 -or $difference -lt 40) { continue }
        # Android's 108-unit adaptive layer guarantees the central 66-unit circle.
        $dx = ((($x + 0.5) / $bitmap.Width) - 0.5) * 108 * (1 - 2 * $inset)
        $dy = ((($y + 0.5) / $bitmap.Height) - 0.5) * 108 * (1 - 2 * $inset)
        $maxRadius = [Math]::Max($maxRadius, [Math]::Sqrt($dx * $dx + $dy * $dy))
        $artPixels++
      }
    }
    if ($artPixels -eq 0 -or $maxRadius -gt 33) {
      throw "Launcher artwork exceeds Android's safe area in $($file.Directory.Name): radius $maxRadius / 33."
    }
    if ($maxRadius -gt 26) {
      throw "Launcher artwork needs more breathing room in $($file.Directory.Name): radius $maxRadius / 26."
    }
    $corner = $bitmap.GetPixel(0, 0)
    if ($corner.ToArgb() -ne $backgroundColor.ToArgb()) {
      throw "Foreground canvas and adaptive background colors differ in $($file.Directory.Name)."
    }
    Write-Host ('{0}: artwork radius {1:F2}/33, safe area passed.' -f $file.Directory.Name, $maxRadius)
  } finally {
    $bitmap.Dispose()
  }
}
