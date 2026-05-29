# Creates a Desktop shortcut for intern.pilot that double-clicks open
# the launcher (launch.bat). Run once with:
#   powershell -ExecutionPolicy Bypass -File install-desktop-shortcut.ps1

$ErrorActionPreference = "Stop"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$launchBat  = Join-Path $projectDir "launch.bat"
$desktop    = [Environment]::GetFolderPath("Desktop")
$shortcut   = Join-Path $desktop "intern.pilot.lnk"

if (-not (Test-Path $launchBat)) {
    throw "launch.bat not found at $launchBat"
}

$wsh = New-Object -ComObject WScript.Shell
$sc  = $wsh.CreateShortcut($shortcut)
$sc.TargetPath       = $launchBat
$sc.WorkingDirectory = $projectDir
$sc.WindowStyle      = 7   # minimized — keeps the console tucked away
$sc.Description      = "intern.pilot - personal job application tracker"

# Use Chrome's icon if available so the shortcut looks like a real app.
$chrome = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe" }
if (Test-Path $chrome) { $sc.IconLocation = "$chrome,0" }

$sc.Save()

Write-Host ""
Write-Host "Done. Shortcut created at:" -ForegroundColor Green
Write-Host "  $shortcut"
Write-Host ""
Write-Host "Double-click it to launch intern.pilot."
