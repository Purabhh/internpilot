@echo off
REM intern.pilot force-stop
REM
REM Normally you DON'T need this: closing the app window shuts the server
REM down automatically (launch.bat supervises the window and cleans up).
REM Use this when something is left behind anyway - e.g. the default-browser
REM fallback was used, the launcher console was killed, or things look stuck.
REM
REM Stops: any intern.pilot app window AND the server on port 3000.
REM Single-line PowerShell only - cmd mangles multi-line ^-continued commands
REM when this script is CALLed from another batch (launch.bat does exactly
REM that), which once made this script a silent no-op.

setlocal
echo [%date% %time%] close.bat invoked >> "%~dp0launcher.log"

echo Closing intern.pilot app window (if open)...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match 'internpilot-chrome-profile' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo Stopping the server on port 3000...
powershell -NoProfile -Command "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($p) { $p | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }; Write-Host 'Server stopped.' } else { Write-Host 'Nothing was listening on port 3000.' }"

endlocal
exit /b 0
