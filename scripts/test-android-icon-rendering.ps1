[CmdletBinding()]
param(
  [string]$Device = 'emulator-5582'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$work = Join-Path $repoRoot 'android\build\icon-validation'
$source = Join-Path $PSScriptRoot 'android-icon-validation'
$tools = Join-Path $env:ANDROID_HOME 'build-tools\35.0.0'
$platform = Join-Path $env:ANDROID_HOME 'platforms\android-35\android.jar'
$adb = Join-Path $env:ANDROID_HOME 'platform-tools\adb.exe'
$javaBin = Join-Path $env:JAVA_HOME 'bin'
$classes = Join-Path $work 'qa-classes'
$dex = Join-Path $work 'qa-dex'
$unsigned = Join-Path $work 'icon-qa-unsigned.apk'
$signed = Join-Path $work 'icon-qa.apk'
$qaKey = Join-Path $work 'icon-qa.keystore'
New-Item -ItemType Directory -Path $classes, $dex -Force | Out-Null

function Invoke-Checked {
  param([string]$Command, [string[]]$Arguments)
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Command failed with exit code $LASTEXITCODE" }
}

Invoke-Checked (Join-Path $javaBin 'javac.exe') @('-source', '8', '-target', '8', '-classpath', $platform,
  '-d', $classes, (Join-Path $source 'IconValidationActivity.java'))
$classJar = Join-Path $work 'icon-qa-classes.jar'
Invoke-Checked (Join-Path $javaBin 'jar.exe') @('cf', $classJar, '-C', $classes, '.')
Invoke-Checked (Join-Path $tools 'd8.bat') @('--lib', $platform, '--min-api', '26', '--output', $dex, $classJar)
Invoke-Checked (Join-Path $tools 'aapt2.exe') @('link', '-I', $platform, '--manifest',
  (Join-Path $source 'AndroidManifest.xml'), '--min-sdk-version', '26', '--target-sdk-version', '35', '-o', $unsigned)
Invoke-Checked (Join-Path $javaBin 'jar.exe') @('uf', $unsigned, '-C', $dex, 'classes.dex')
if (-not (Test-Path -LiteralPath $qaKey)) {
  # This disposable test-only key never signs the OpenFIRE release or an upload.
  Invoke-Checked (Join-Path $javaBin 'keytool.exe') @('-genkeypair', '-keystore', $qaKey, '-alias', 'icon-qa',
    '-storepass', 'android', '-keypass', 'android', '-keyalg', 'RSA', '-validity', '2', '-dname', 'CN=Local Icon QA')
}
Invoke-Checked (Join-Path $tools 'apksigner.bat') @('sign', '--ks', $qaKey, '--ks-key-alias', 'icon-qa',
  '--ks-pass', 'pass:android', '--key-pass', 'pass:android', '--out', $signed, $unsigned)
Invoke-Checked $adb @('-s', $Device, 'install', '-r', '-t', $signed)
$runId = [Guid]::NewGuid().ToString('N')
Invoke-Checked $adb @('-s', $Device, 'shell', 'am', 'force-stop', 'com.jenius.openfire.iconvalidation')
Invoke-Checked $adb @('-s', $Device, 'shell', 'am', 'start', '-W', '-n',
  'com.jenius.openfire.iconvalidation/.IconValidationActivity', '--es', 'runId', $runId)
$result = (& $adb -s $Device logcat -d -s 'OpenFireIconQA:I' '*:S') -join "`n"
Write-Host $result
if ($result -notmatch "RESULT PASS run=$runId " -or $result -match "RESULT FAIL run=$runId") {
  throw 'Compiled Android icon rendering did not pass.'
}
Invoke-Checked $adb @('-s', $Device, 'pull',
  '/sdcard/Android/data/com.jenius.openfire.iconvalidation/files/icon-masks.png', (Join-Path $work 'icon-masks.png'))
