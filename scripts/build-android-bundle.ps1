[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot 'android'
$keyPath = Join-Path $androidDir 'app-signing\open-fire-upload.keystore'
$unsignedBundle = Join-Path $androidDir 'app\build\outputs\bundle\release\app-release.aab'
$bundle = Join-Path $androidDir 'app-release-bundle.aab'
$keyAlias = 'open-fire-upload'

if (-not (Test-Path -LiteralPath $keyPath)) {
  throw "Missing OpenFIRE upload key at $keyPath. Restore the established key; do not generate a replacement."
}
if ([string]::IsNullOrWhiteSpace($env:BUBBLEWRAP_KEYSTORE_PASSWORD)) {
  throw 'Set BUBBLEWRAP_KEYSTORE_PASSWORD before building the signed bundle.'
}
if ([string]::IsNullOrWhiteSpace($env:BUBBLEWRAP_KEY_PASSWORD)) {
  throw 'Set BUBBLEWRAP_KEY_PASSWORD before building the signed bundle.'
}
if ([string]::IsNullOrWhiteSpace($env:JAVA_HOME)) {
  throw 'Set JAVA_HOME to a JDK 17 installation before building the signed bundle.'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
  throw 'Set ANDROID_HOME to the Android SDK before building the signed bundle.'
}

$gradle = Join-Path $androidDir 'gradlew.bat'
$jarsigner = Join-Path $env:JAVA_HOME 'bin\jarsigner.exe'
if (-not (Test-Path -LiteralPath $jarsigner)) {
  throw "Missing jarsigner at $jarsigner."
}

Push-Location $androidDir
try {
  & $gradle bundleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw "Gradle build failed with exit code $LASTEXITCODE." }
} finally {
  Pop-Location
}

if (-not (Test-Path -LiteralPath $unsignedBundle)) {
  throw "Gradle did not produce $unsignedBundle."
}

Copy-Item -LiteralPath $unsignedBundle -Destination $bundle -Force
& $jarsigner `
  -keystore $keyPath `
  -storepass:env BUBBLEWRAP_KEYSTORE_PASSWORD `
  -keypass:env BUBBLEWRAP_KEY_PASSWORD `
  -sigalg SHA256withRSA `
  -digestalg SHA-256 `
  $bundle `
  $keyAlias
if ($LASTEXITCODE -ne 0) { throw "Bundle signing failed with exit code $LASTEXITCODE." }

$verification = (& $jarsigner -verify -verbose -certs $bundle 2>&1) -join [Environment]::NewLine
if ($LASTEXITCODE -ne 0 -or $verification -notmatch 'jar verified\.' -or $verification -match 'jar is unsigned\.') {
  throw "Bundle signature verification failed.`n$verification"
}
Write-Host 'Bundle signature verified.'

$hash = (Get-FileHash -LiteralPath $bundle -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "Signed Android App Bundle: $bundle"
Write-Host "SHA-256: $hash"
