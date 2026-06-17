#Requires -Version 5.1
<#
.SYNOPSIS
    Manually check for and apply AMS Biometric Sync updates.

.DESCRIPTION
    Uses the installed app under %ProgramData%\AMSBioSync\app\ and the config in
    %ProgramData%\AMSBioSync\.env. Restarts the AMSBioSync service when an update
    is applied.

    Run from any directory:

        .\update.ps1
        .\update.ps1 -CheckOnly
#>

param(
    [switch]$CheckOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ProgramDataDir = Join-Path $env:ProgramData "AMSBioSync"
$AppDir = Join-Path $ProgramDataDir "app"

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

if (-not (Test-Path -LiteralPath $AppDir -PathType Container)) {
    throw "Installed app directory not found: $AppDir. Run install.ps1 first."
}

$python = Resolve-PythonCommand
if ($null -eq $python) {
    throw "Python 3.9+ not found."
}

# Run the updater without changing into the install dir — that would lock files
# during the directory swap on Windows.
$env:PYTHONPATH = $AppDir

if ($CheckOnly) {
    & $python.Command @($python.Args + @("-m", "ebio_sync.updater", "--check"))
}
else {
    & $python.Command @($python.Args + @("-m", "ebio_sync.updater", "--apply"))
}

if ($LASTEXITCODE -ne 0) {
    throw "Update command failed (exit $LASTEXITCODE)."
}
