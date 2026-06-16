#Requires -Version 5.1
<#
.SYNOPSIS
    Interactive installer for the AMS Biometric Sync Windows service.

.DESCRIPTION
    Prompts for configuration, writes %ProgramData%\AMSBioSync\.env, installs Python
    dependencies, and registers + starts the AMSBioSync Windows service.

    Run from an elevated (Administrator) PowerShell session:

        cd path\to\ams\scripts
        .\install.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$ProgramDataDir = Join-Path $env:ProgramData "AMSBioSync"
$EnvFile = Join-Path $ProgramDataDir ".env"
$LogDir = Join-Path $ProgramDataDir "logs"
$RequirementsFile = Join-Path $ScriptDir "requirements.txt"
$ServiceModule = "ebio_sync.service"

function Test-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Info([string]$Message) {
    Write-Host "    $Message" -ForegroundColor DarkGray
}

function Read-ConfigValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Prompt,

        [string]$Default = "",

        [switch]$Required,

        [switch]$Secret
    )

    $displayDefault = if ($Default) { " [$Default]" } else { "" }
    $line = Read-Host "$Prompt$displayDefault"

    if ([string]::IsNullOrWhiteSpace($line)) {
        if ($Required -and [string]::IsNullOrWhiteSpace($Default)) {
            throw "Value is required: $Prompt"
        }
        return $Default
    }

    if ($Secret) {
        return $line
    }

    return $line.Trim()
}

function Format-EnvLine {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Key,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $escaped = $Value -replace '\\', '\\' -replace '"', '\"'
    return "$Key=`"$escaped`""
}

function Resolve-PythonCommand {
    $candidates = @(
        @{ Command = "py"; Args = @("-3") },
        @{ Command = "py"; Args = @() },
        @{ Command = "python"; Args = @() },
        @{ Command = "python3"; Args = @() }
    )

    foreach ($candidate in $candidates) {
        try {
            $versionOutput = & $candidate.Command @($candidate.Args + @("-c", "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")) 2>$null
            if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($versionOutput)) {
                continue
            }

            $parts = $versionOutput.Trim().Split(".")
            $major = [int]$parts[0]
            $minor = [int]$parts[1]
            if ($major -lt 3 -or ($major -eq 3 -and $minor -lt 9)) {
                continue
            }

            return @{
                Command = $candidate.Command
                Args = $candidate.Args
            }
        }
        catch {
            continue
        }
    }

    return $null
}

function Invoke-Python {
    param(
        [Parameter(Mandatory = $true)]
        [hashtable]$Python,

        [Parameter(Mandatory = $true)]
        [string[]]$ScriptArgs
    )

    & $Python.Command @($Python.Args + $ScriptArgs)
    if ($LASTEXITCODE -ne 0) {
        throw "Python command failed (exit $LASTEXITCODE): $($Python.Command) $($Python.Args -join ' ') $($ScriptArgs -join ' ')"
    }
}

function Test-MdbPath([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Access database not found: $Path"
    }

    if ($Path -notmatch '\.(mdb|accdb)$') {
        Write-Warning "Expected a .mdb or .accdb file: $Path"
    }
}

function Get-ServiceStatusSafe([string]$ServiceName) {
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($null -eq $service) {
        return $null
    }
    return $service
}

if (-not (Test-Administrator)) {
    Write-Error @"
This installer must run as Administrator (required to register a Windows service).

Right-click PowerShell -> Run as administrator, then:

    cd `"$ScriptDir`"
    .\install.ps1
"@
    exit 1
}

Write-Host ""
Write-Host "AMS Biometric Sync — Service Installer" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Info "Scripts directory: $ScriptDir"
Write-Info "Config directory:  $ProgramDataDir"

if (-not (Test-Path -LiteralPath $RequirementsFile)) {
    throw "requirements.txt not found: $RequirementsFile"
}

$python = Resolve-PythonCommand
if ($null -eq $python) {
    throw "Python 3.9+ not found. Install Python from https://www.python.org/downloads/ and ensure 'py' or 'python' is on PATH."
}

Write-Info "Using Python: $($python.Command) $($python.Args -join ' ')"

Write-Step "Configuration (press Enter to accept defaults)"

$defaultMdbPath = "C:\Users\shara\Desktop\AMT\attendance_db.mdb"
$defaultMdbPassword = "attendance@123"
$defaultTimezone = "Asia/Karachi"
$defaultSyncInterval = "900"
$defaultCompanySlugs = "xorora,crest-led"
$defaultNameMatchThreshold = "85"
$defaultEmailDomainXorora = "xorora.com"
$defaultEmailDomainCrestLed = "crestled.com"

$databaseUrl = Read-ConfigValue -Prompt "Neon DATABASE_URL" -Required
$mdbPath = Read-ConfigValue -Prompt "Path to attendance_db.mdb (EBIO_MDB_PATH)" -Default $defaultMdbPath -Required
$mdbPassword = Read-ConfigValue -Prompt "Access DB password (EBIO_MDB_PASSWORD)" -Default $defaultMdbPassword -Required -Secret
$timezone = Read-ConfigValue -Prompt "Punch timezone (EBIO_TIMEZONE)" -Default $defaultTimezone -Required
$syncInterval = Read-ConfigValue -Prompt "Sync interval in seconds (EBIO_SYNC_INTERVAL)" -Default $defaultSyncInterval -Required
$companySlugs = Read-ConfigValue -Prompt "Company slugs, comma-separated (EBIO_COMPANY_SLUGS)" -Default $defaultCompanySlugs -Required
$newEmployeeCompanySlug = Read-ConfigValue -Prompt "Company slug for auto-created employees (EBIO_NEW_EMPLOYEE_COMPANY_SLUG)" -Default ($companySlugs.Split(",")[0].Trim())
$emailDomainXorora = Read-ConfigValue -Prompt "Email domain for xorora (EBIO_EMAIL_DOMAIN_XORORA)" -Default $defaultEmailDomainXorora -Required
$emailDomainCrestLed = Read-ConfigValue -Prompt "Email domain for crest-led (EBIO_EMAIL_DOMAIN_CREST_LED)" -Default $defaultEmailDomainCrestLed -Required
$nameMatchThreshold = Read-ConfigValue -Prompt "Fuzzy name match threshold 0-100 (EBIO_NAME_MATCH_THRESHOLD)" -Default $defaultNameMatchThreshold -Required

if ($databaseUrl -notmatch '^postgres(ql)?://') {
    throw "DATABASE_URL should be a PostgreSQL connection string (postgresql://...)."
}

Test-MdbPath -Path $mdbPath

$parsedSyncInterval = 0
if (-not [int]::TryParse($syncInterval, [ref]$parsedSyncInterval)) {
    throw "EBIO_SYNC_INTERVAL must be an integer (seconds)."
}

$parsedNameMatchThreshold = 0
if (-not [int]::TryParse($nameMatchThreshold, [ref]$parsedNameMatchThreshold)) {
    throw "EBIO_NAME_MATCH_THRESHOLD must be an integer."
}

if ($parsedNameMatchThreshold -lt 0 -or $parsedNameMatchThreshold -gt 100) {
    throw "EBIO_NAME_MATCH_THRESHOLD must be between 0 and 100."
}

Write-Step "Creating directories"
New-Item -ItemType Directory -Force -Path $ProgramDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
Write-Info "Created $ProgramDataDir"
Write-Info "Created $LogDir"

Write-Step "Writing configuration"
$envLines = @(
    "# AMS Biometric Sync — generated by install.ps1 on $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "# Scripts source: $ScriptDir",
    "",
    Format-EnvLine -Key "DATABASE_URL" -Value $databaseUrl,
    Format-EnvLine -Key "EBIO_MDB_PATH" -Value $mdbPath,
    Format-EnvLine -Key "EBIO_MDB_PASSWORD" -Value $mdbPassword,
    Format-EnvLine -Key "EBIO_TIMEZONE" -Value $timezone,
    Format-EnvLine -Key "EBIO_SYNC_INTERVAL" -Value $syncInterval,
    Format-EnvLine -Key "EBIO_COMPANY_SLUGS" -Value $companySlugs,
    Format-EnvLine -Key "EBIO_NEW_EMPLOYEE_COMPANY_SLUG" -Value $newEmployeeCompanySlug,
    Format-EnvLine -Key "EBIO_EMAIL_DOMAIN_XORORA" -Value $emailDomainXorora,
    Format-EnvLine -Key "EBIO_EMAIL_DOMAIN_CREST_LED" -Value $emailDomainCrestLed,
    Format-EnvLine -Key "EBIO_NAME_MATCH_THRESHOLD" -Value $nameMatchThreshold
)

$envContent = ($envLines -join [Environment]::NewLine) + [Environment]::NewLine
Set-Content -LiteralPath $EnvFile -Value $envContent -Encoding UTF8 -NoNewline
Write-Info "Wrote $EnvFile"

Write-Step "Installing Python dependencies"
Push-Location $ScriptDir
try {
    Invoke-Python -Python $python -ScriptArgs @("-m", "pip", "install", "-r", $RequirementsFile)
}
finally {
    Pop-Location
}

Write-Step "Registering Windows service"
Push-Location $ScriptDir
try {
    $existingService = Get-ServiceStatusSafe -ServiceName "AMSBioSync"
    if ($null -ne $existingService) {
        Write-Info "Existing AMSBioSync service found (status: $($existingService.Status))."
        if ($existingService.Status -eq "Running") {
            Write-Info "Stopping service..."
            Invoke-Python -Python $python -ScriptArgs @("-m", $ServiceModule, "stop")
        }
        Write-Info "Removing previous service registration..."
        Invoke-Python -Python $python -ScriptArgs @("-m", $ServiceModule, "remove")
    }

    Write-Info "Installing service..."
    Invoke-Python -Python $python -ScriptArgs @("-m", $ServiceModule, "install")

    Write-Info "Starting service..."
    Invoke-Python -Python $python -ScriptArgs @("-m", $ServiceModule, "start")
}
finally {
    Pop-Location
}

$service = Get-ServiceStatusSafe -ServiceName "AMSBioSync"
$statusText = if ($null -ne $service) { $service.Status } else { "unknown" }

Write-Host ""
Write-Host "Installation complete." -ForegroundColor Green
Write-Host ""
Write-Host "  Service:     AMS Biometric Sync (AMSBioSync)" -ForegroundColor White
Write-Host "  Status:      $statusText" -ForegroundColor White
Write-Host "  Config:      $EnvFile" -ForegroundColor White
Write-Host "  Logs:        $(Join-Path $LogDir 'sync.log')" -ForegroundColor White
Write-Host ""
Write-Host "Manual test (from this scripts folder):" -ForegroundColor Yellow
Write-Host "  $($python.Command) $($python.Args -join ' ') ebio_sync.py --once --verbose" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Uninstall:" -ForegroundColor Yellow
Write-Host "  $($python.Command) $($python.Args -join ' ') -m $ServiceModule remove" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Note: The service runs as Local System by default. If it cannot read the" -ForegroundColor DarkYellow
Write-Host "Access database (e.g. under a user Desktop), open services.msc, set the" -ForegroundColor DarkYellow
Write-Host "AMSBioSync logon account to the desktop user that owns attendance_db.mdb." -ForegroundColor DarkYellow
Write-Host ""
