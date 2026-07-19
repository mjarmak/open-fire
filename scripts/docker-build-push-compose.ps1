param(
  [string] $ImagePrefix = $(if ($env:DOCKER_IMAGE_PREFIX) { $env:DOCKER_IMAGE_PREFIX } else { "jeniustech/open-fire" }),
  [string] $ImageTag = $(if ($env:DOCKER_IMAGE_TAG) { $env:DOCKER_IMAGE_TAG } else { "" }),
  [int] $BackendPort = $(if ($env:BACKEND_PORT) { [int] $env:BACKEND_PORT } else { 8080 }),
  [int] $FrontendPort = $(if ($env:FRONTEND_PORT) { [int] $env:FRONTEND_PORT } else { 4200 }),
  [int] $BackendContainerPort = $(if ($env:BACKEND_CONTAINER_PORT) { [int] $env:BACKEND_CONTAINER_PORT } else { 8080 }),
  [string] $EnvFile = $(if ($env:APP_ENV_FILE) { $env:APP_ENV_FILE } else { "" }),
  [switch] $NoPush,
  [switch] $NoCache,
  [switch] $Pull,
  [switch] $NoWait,
  [switch] $PreflightOnly,
  [switch] $Help
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Show-Usage {
@"
Build, push, and run OpenFIRE with Docker Compose.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts/docker-build-push-compose.ps1 [options]

Options:
  -ImagePrefix <prefix>       Image prefix, for example ghcr.io/me/open-fire.
                              Defaults to DOCKER_IMAGE_PREFIX or jeniustech/open-fire.
  -ImageTag <tag>             Image tag. Defaults to DOCKER_IMAGE_TAG or the current git short SHA.
  -BackendPort <port>         Published backend port. Defaults to BACKEND_PORT or 8080.
  -FrontendPort <port>        Published frontend port. Defaults to FRONTEND_PORT or 4200.
  -BackendContainerPort <p>   Spring Boot container port. Defaults to BACKEND_CONTAINER_PORT or 8080.
  -EnvFile <path>             Runtime env file. Defaults to APP_ENV_FILE or docker/openfire.env.production.
  -NoPush                     Keep the images local instead of pushing them.
  -NoCache                    Build Docker images without cache.
  -Pull                       Pull newer Docker base images during image builds.
  -NoWait                     Skip compose --wait and rely on HTTP readiness checks.
  -PreflightOnly              Validate Docker and deployment inputs without building.
  -Help                       Show this help.

Examples:
  npm --prefix frontend run deploy:local
  powershell -ExecutionPolicy Bypass -File scripts/docker-build-push-compose.ps1 -NoPush
  powershell -ExecutionPolicy Bypass -File scripts/docker-build-push-compose.ps1 -ImagePrefix ghcr.io/me/open-fire
"@
}

function Write-Log {
  param([string] $Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host ""
  Write-Host "[$stamp] $Message"
}

function Stop-UserError {
  param([string] $Message)
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  exit 1
}

function Require-Command {
  param([string] $Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Stop-UserError "Missing required command: $Name"
  }
}

function Ensure-DockerConfig {
  if (-not [string]::IsNullOrWhiteSpace($env:DOCKER_CONFIG)) {
    return
  }

  $candidateProfiles = @($env:USERPROFILE, $HOME, [Environment]::GetFolderPath("UserProfile")) |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Select-Object -Unique

  foreach ($userProfile in $candidateProfiles) {
    $defaultConfig = Join-Path $userProfile ".docker\config.json"
    try {
      [void](Get-Item -LiteralPath $defaultConfig -ErrorAction Stop)
      [void](Get-Content -LiteralPath $defaultConfig -Raw -ErrorAction Stop)
      return
    }
    catch [System.Management.Automation.ItemNotFoundException] {
      continue
    }
    catch {
      $tempDockerConfig = Join-Path ([System.IO.Path]::GetTempPath()) "open-fire-docker-config"
      if (-not (Test-Path -LiteralPath $tempDockerConfig)) {
        New-Item -ItemType Directory -Path $tempDockerConfig -Force | Out-Null
      }
      $env:DOCKER_CONFIG = $tempDockerConfig
      Write-Log "Docker config is not readable; using temporary DOCKER_CONFIG at $tempDockerConfig"
      return
    }
  }
}

function Invoke-Native {
  param(
    [string] $Command,
    [string[]] $Arguments
  )

  Write-Host "> $Command $($Arguments -join ' ')"
  $previousErrorAction = $ErrorActionPreference
  $previousNativePreference = $null
  $usedNativePreference = $false
  try {
    $nativePreference = Get-Variable -Name "PSNativeCommandUseErrorActionPreference" -Scope Global -ErrorAction SilentlyContinue
    if ($null -ne $nativePreference) {
      $previousNativePreference = $global:PSNativeCommandUseErrorActionPreference
      $global:PSNativeCommandUseErrorActionPreference = $false
      $usedNativePreference = $true
    }

    $ErrorActionPreference = "Continue"
    $output = & $Command @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
    if ($usedNativePreference) {
      $global:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }

  @($output) | ForEach-Object { Write-Host "$_" }
  if ($exitCode -ne 0) {
    throw "$Command exited with code $exitCode"
  }
}

function Invoke-NativeCapture {
  param(
    [string] $Command,
    [string[]] $Arguments
  )

  $previousErrorAction = $ErrorActionPreference
  $previousNativePreference = $null
  $usedNativePreference = $false
  try {
    $nativePreference = Get-Variable -Name "PSNativeCommandUseErrorActionPreference" -Scope Global -ErrorAction SilentlyContinue
    if ($null -ne $nativePreference) {
      $previousNativePreference = $global:PSNativeCommandUseErrorActionPreference
      $global:PSNativeCommandUseErrorActionPreference = $false
      $usedNativePreference = $true
    }

    $ErrorActionPreference = "Continue"
    $output = & $Command @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousErrorAction
    if ($usedNativePreference) {
      $global:PSNativeCommandUseErrorActionPreference = $previousNativePreference
    }
  }

  return [pscustomobject]@{
    ExitCode = $exitCode
    Output = @($output | ForEach-Object { "$_" })
  }
}

function Test-ComposeWaitSupport {
  $result = Invoke-NativeCapture -Command "docker" -Arguments @("compose", "up", "--help")
  return $result.ExitCode -eq 0 -and (($result.Output -join "`n") -match "--wait")
}

function Wait-HttpResponse {
  param(
    [string] $Url,
    [int] $TimeoutSeconds = 90
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    }
    catch {
      $errorResponse = $_.Exception.Response
      if ($null -ne $errorResponse) {
        $statusCode = [int] $errorResponse.StatusCode
        if ($statusCode -ge 200 -and $statusCode -lt 500) {
          return
        }
      }
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)

  throw "Timed out waiting for $Url"
}

function Get-GitShortSha {
  $result = Invoke-NativeCapture -Command "git" -Arguments @("-c", "safe.directory=$Root", "rev-parse", "--short", "HEAD")
  if ($result.ExitCode -eq 0 -and $result.Output.Count -gt 0) {
    return $result.Output[0].Trim()
  }
  return "dev"
}

function Get-TailscaleIPv4 {
  $addresses = @()
  if (-not (Get-Command "tailscale" -ErrorAction SilentlyContinue)) {
    $addresses = @()
  }
  else {
    $result = Invoke-NativeCapture -Command "tailscale" -Arguments @("ip", "-4")
    if ($result.ExitCode -eq 0) {
      $addresses = @($result.Output | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "^\d{1,3}(\.\d{1,3}){3}$" })
    }
  }

  if ($addresses.Count -gt 0) {
    return $addresses
  }

  return @(Get-InterfaceIPv4 | Where-Object {
    $_.InterfaceName -like "*Tailscale*" -or (Test-TailscaleIPv4 -Address $_.Address)
  } | Select-Object -ExpandProperty Address -Unique)
}

function Get-InterfaceIPv4 {
  $results = @()
  foreach ($networkInterface in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
    if ($networkInterface.OperationalStatus -ne [System.Net.NetworkInformation.OperationalStatus]::Up) {
      continue
    }
    foreach ($unicastAddress in $networkInterface.GetIPProperties().UnicastAddresses) {
      if ($unicastAddress.Address.AddressFamily -ne [System.Net.Sockets.AddressFamily]::InterNetwork) {
        continue
      }
      $results += [pscustomobject]@{
        InterfaceName = $networkInterface.Name
        Address = $unicastAddress.Address.ToString()
      }
    }
  }
  return $results
}

function Test-TailscaleIPv4 {
  param([string] $Address)
  $parsed = $null
  if (-not [System.Net.IPAddress]::TryParse($Address, [ref] $parsed)) {
    return $false
  }
  $bytes = $parsed.GetAddressBytes()
  return $bytes.Length -eq 4 -and $bytes[0] -eq 100 -and $bytes[1] -ge 64 -and $bytes[1] -le 127
}

function Get-LanIPv4 {
  return @(Get-InterfaceIPv4 |
    Where-Object {
      $_.Address -notlike "127.*" -and
      $_.Address -notlike "169.254.*" -and
      -not (Test-TailscaleIPv4 -Address $_.Address)
    } |
    Select-Object -ExpandProperty Address -Unique)
}

if ($Help) {
  Show-Usage
  exit 0
}

$Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ComposeFile = Join-Path $Root "docker\openfire-docker-compose.yml"
if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $Root "docker\openfire.env.production"
}

Require-Command git
Require-Command npm.cmd
Require-Command mvn.cmd
Require-Command docker
Ensure-DockerConfig

$dockerInfo = Invoke-NativeCapture -Command "docker" -Arguments @("info")
if ($dockerInfo.ExitCode -ne 0) {
  Stop-UserError "Docker is not ready. Start Docker Desktop and make sure this shell can access the Docker engine."
}

$composeVersion = Invoke-NativeCapture -Command "docker" -Arguments @("compose", "version")
if ($composeVersion.ExitCode -ne 0) {
  Stop-UserError "Docker Compose is not available. Install the docker compose plugin."
}

if (-not (Test-Path -LiteralPath $ComposeFile)) {
  Stop-UserError "Missing compose file: $ComposeFile"
}

if (-not (Test-Path -LiteralPath $EnvFile)) {
  $exampleEnvFile = Join-Path $Root "docker\openfire.env.example"
  Copy-Item -LiteralPath $exampleEnvFile -Destination $EnvFile
  Stop-UserError "Created $EnvFile from docker/openfire.env.example. Fill in the local secrets and rerun the deploy."
}

$resolvedEnvFile = (Resolve-Path $EnvFile).Path
if (Select-String -LiteralPath $resolvedEnvFile -Pattern "=your_.*_here$" -Quiet) {
  Stop-UserError "$resolvedEnvFile still contains template placeholders. Fill in the local values before deploying."
}

if ([string]::IsNullOrWhiteSpace($ImageTag)) {
  $ImageTag = Get-GitShortSha
}

$normalizedPrefix = $ImagePrefix.Trim().TrimEnd("/").TrimEnd("-")
if ([string]::IsNullOrWhiteSpace($normalizedPrefix)) {
  Stop-UserError "ImagePrefix cannot be empty."
}

$env:BACKEND_IMAGE = "$normalizedPrefix-backend:${ImageTag}"
$env:FRONTEND_IMAGE = "$normalizedPrefix-frontend:${ImageTag}"
$env:APP_ENV_FILE = $resolvedEnvFile
$env:BACKEND_PORT = "$BackendPort"
$env:FRONTEND_PORT = "$FrontendPort"
$env:BACKEND_CONTAINER_PORT = "$BackendContainerPort"
$env:APP_CORS_ALLOWED_ORIGIN_PATTERNS = if ($env:APP_CORS_ALLOWED_ORIGIN_PATTERNS) { $env:APP_CORS_ALLOWED_ORIGIN_PATTERNS } else { "*" }

Write-Log "Deployment settings"
Write-Host "  Backend image: $env:BACKEND_IMAGE"
Write-Host "  Frontend image: $env:FRONTEND_IMAGE"
Write-Host "  Environment file: $resolvedEnvFile"
Write-Host "  Frontend port: $FrontendPort"
Write-Host "  Backend port: $BackendPort"
Write-Host "  Push enabled: $(-not $NoPush)"

if ($PreflightOnly) {
  Write-Log "Preflight complete. No application build, Docker build, push, or Compose action was run."
  exit 0
}

Write-Log "Building Angular application"
Invoke-Native -Command "npm.cmd" -Arguments @("--prefix", (Join-Path $Root "frontend"), "run", "build")

Write-Log "Building and testing Spring Boot application"
Invoke-Native -Command "mvn.cmd" -Arguments @("-f", (Join-Path $Root "backend\pom.xml"), "package")

$commonBuildArgs = @("build")
if ($Pull) {
  $commonBuildArgs += "--pull"
}
if ($NoCache) {
  $commonBuildArgs += "--no-cache"
}

Write-Log "Building backend Docker image"
Invoke-Native -Command "docker" -Arguments ($commonBuildArgs + @("-f", (Join-Path $Root "backend\Dockerfile"), "-t", $env:BACKEND_IMAGE, $Root))

Write-Log "Building frontend Docker image"
Invoke-Native -Command "docker" -Arguments ($commonBuildArgs + @("-f", (Join-Path $Root "frontend\Dockerfile"), "-t", $env:FRONTEND_IMAGE, $Root))

if ($NoPush) {
  Write-Log "Skipping image push because -NoPush was supplied"
}
else {
  Write-Log "Pushing Docker images"
  Invoke-Native -Command "docker" -Arguments @("push", $env:BACKEND_IMAGE)
  Invoke-Native -Command "docker" -Arguments @("push", $env:FRONTEND_IMAGE)
}

$compose = @(
  "compose",
  "--project-name", "open-fire",
  "--env-file", $resolvedEnvFile,
  "-f", $ComposeFile
)

Write-Log "Starting Docker Compose stack"
$upArgs = @("up", "-d", "--remove-orphans")
if (-not $NoWait -and (Test-ComposeWaitSupport)) {
  $upArgs += "--wait"
}
Invoke-Native -Command "docker" -Arguments ($compose + $upArgs)

Write-Log "Waiting for frontend and API proxy"
Wait-HttpResponse -Url "http://127.0.0.1:$FrontendPort" -TimeoutSeconds 90
Wait-HttpResponse -Url "http://127.0.0.1:$FrontendPort/api/portfolio" -TimeoutSeconds 90

Write-Log "Service status"
Invoke-Native -Command "docker" -Arguments ($compose + @("ps"))

Write-Log "Ready"
Write-Host "  Local: http://127.0.0.1:$FrontendPort"
foreach ($address in Get-LanIPv4) {
  Write-Host "  LAN: http://$address`:$FrontendPort"
}
$tailscaleAddresses = @(Get-TailscaleIPv4)
foreach ($address in $tailscaleAddresses) {
  Write-Host "  Tailscale: http://$address`:$FrontendPort"
}
if ($tailscaleAddresses.Count -eq 0) {
  Write-Host "  Tailscale: no active Tailscale IPv4 address detected"
}
