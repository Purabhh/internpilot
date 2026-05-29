@echo off
REM intern.pilot desktop launcher
REM   1. cd into project
REM   2. start the Next.js server in the background (Turbopack)
REM   3. wait for the server to be ready
REM   4. open Chrome in app-mode (no tabs, no URL bar — looks like a desktop app)
REM   5. when the Chrome window is closed, optionally kill the server (Ctrl+C in the
REM      console window that pops up, or close it)

setlocal
cd /d "%~dp0"

REM Look for Chrome in the usual places. Override by setting CHROME_EXE.
set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

REM Start the dev server in a new minimized console window.
start "intern.pilot · server" /min cmd /c "npm run dev"

REM Wait up to ~30s for the server to respond.
echo Waiting for server on http://localhost:3000 ...
set /a tries=0
:waitloop
set /a tries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/settings -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto :ready
if %tries% geq 30 (
  echo Server didn't start in time. Open http://localhost:3000 manually once it boots.
  goto :openbrowser
)
timeout /t 1 /nobreak >nul
goto :waitloop

:ready
echo Ready.

:openbrowser
if exist "%CHROME_EXE%" (
  REM Open in app-mode: dedicated window, no tabs, no address bar, taskbar icon.
  start "" "%CHROME_EXE%" --app=http://localhost:3000/overview --user-data-dir="%LOCALAPPDATA%\internpilot-chrome-profile"
) else (
  REM Fallback: default browser.
  start "" http://localhost:3000/overview
)

endlocal
exit /b 0
