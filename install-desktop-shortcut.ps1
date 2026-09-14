# Installs intern.pilot shortcuts (Desktop + Start Menu) that launch the app
# SILENTLY - no console window, just the app - with the custom pink-star icon.
#
#   powershell -ExecutionPolicy Bypass -File install-desktop-shortcut.ps1
#
# How it works: the shortcut runs internpilot.vbs via wscript.exe, which starts
# launch.bat with a hidden console. launch.bat in turn starts the server hidden,
# so the only window that ever appears is the Chrome app-mode window.

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$vbs   = Join-Path $projectDir "internpilot.vbs"
$ico   = Join-Path $projectDir "internpilot.ico"
$maker = Join-Path $projectDir "make-icon.ps1"

if (-not (Test-Path $vbs)) { throw "internpilot.vbs not found at $vbs" }

# Generate the icon on first run if it's missing.
if (-not (Test-Path $ico)) {
    if (Test-Path $maker) { & $maker } else { throw "internpilot.ico missing and make-icon.ps1 not found" }
}

$wscript = Join-Path $env:WINDIR "System32\wscript.exe"

function New-IpShortcut([string]$path) {
    $wsh = New-Object -ComObject WScript.Shell
    $sc  = $wsh.CreateShortcut($path)
    $sc.TargetPath       = $wscript
    $sc.Arguments        = '"' + $vbs + '"'
    $sc.WorkingDirectory = $projectDir
    $sc.WindowStyle      = 1
    $sc.Description      = "intern.pilot - personal job application tracker"
    $sc.IconLocation     = "$ico,0"
    $sc.Save()
    Write-Host "  $path"
}

$targets = @(
    (Join-Path ([Environment]::GetFolderPath("Desktop"))  "intern.pilot.lnk"),
    (Join-Path ([Environment]::GetFolderPath("Programs")) "intern.pilot.lnk")
)

Write-Host "Creating shortcuts:" -ForegroundColor Green
foreach ($t in $targets) { New-IpShortcut $t }

Write-Host ""
Write-Host "Done. The pink-star shortcut launches intern.pilot with no terminal window." -ForegroundColor Green
Write-Host "Tip: right-click the Start-menu entry to Pin to taskbar / Pin to Start."
