@echo off
REM intern.pilot desktop launcher (production mode)
REM
REM One double-click = one app:
REM   - starts the Next.js production server (UI + API + scrapers, one process)
REM   - opens the app window (Chrome app-mode: no tabs, no URL bar)
REM   - supervises: when you CLOSE the app window, the server shuts down too
REM
REM   launch.bat         -> normal start (rebuilds automatically if code changed)
REM   launch.bat build   -> force a rebuild first (run this after code changes)
REM
REM If the server is already running, this just reopens the app window and
REM exits - the launcher that started the server keeps owning its lifecycle.
REM close.bat remains as the force-stop fallback.
REM
REM Implementation note: the window watch is a poll loop (does any chrome.exe
REM with our dedicated profile still exist?) rather than `start /wait` -
REM Chrome re-execs itself on launch, so the process `start /wait` waits on
REM can exit immediately while the real window lives on.

setlocal
cd /d "%~dp0"
set "LOG=%~dp0launcher.log"
echo [%date% %time%] launcher start > "%LOG%"

REM Look for Chrome in the usual places. Override by setting CHROME_EXE.
set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_EXE%" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"

REM ---- Reattach: if a server is already up, just open a window and exit ----
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/settings -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 (
  echo [%date% %time%] server already running - reattach >> "%LOG%"
  echo Server already running - opening app window.
  goto :openwindow_reattach
)

REM ---- Fresh start ----
if /i "%~1"=="build" goto :build
if not exist ".next\BUILD_ID" goto :build
REM Auto-rebuild: if any source file is newer than the last build, rebuild
REM first so the app always runs the latest code. Costs ~1-2 min only on
REM launches right after a code change; normal launches skip straight to serve.
powershell -NoProfile -Command "$b = (Get-Item '.next\BUILD_ID').LastWriteTime; $src = @(Get-ChildItem -Path app,lib -Recurse -File -Include *.ts,*.tsx,*.css,*.sql -ErrorAction SilentlyContinue) + @(Get-Item package.json,next.config.ts,tailwind.config.ts,instrumentation.ts -ErrorAction SilentlyContinue); if ($src | Where-Object { $_.LastWriteTime -gt $b }) { exit 1 } else { exit 0 }" >nul 2>&1
if errorlevel 1 (
  echo [%date% %time%] source newer than build - auto-rebuilding >> "%LOG%"
  goto :build
)
goto :serve

:build
echo [%date% %time%] building >> "%LOG%"
echo Building intern.pilot (production bundle)...
call npm run build >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [%date% %time%] build FAILED - see %LOG% >> "%LOG%"
  exit /b 1
)

:serve
REM Close any stale app window left from a previous run so the supervisor
REM below starts from a clean slate.
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match 'internpilot-chrome-profile' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo [%date% %time%] starting server (hidden) >> "%LOG%"
powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run start' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

REM Wait up to ~30s for the server to respond.
echo Waiting for server on http://localhost:3000 ...
set /a tries=0
:waitloop
set /a tries+=1
powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Uri http://localhost:3000/api/settings -TimeoutSec 2 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel%==0 goto :ready
if %tries% geq 30 (
  echo [%date% %time%] server never came up >> "%LOG%"
  echo Server didn't start in time. Open http://localhost:3000 manually once it boots.
  goto :openwindow_reattach
)
timeout /t 1 /nobreak >nul
goto :waitloop

:ready
echo [%date% %time%] server ready >> "%LOG%"
echo Ready.

if not exist "%CHROME_EXE%" (
  REM No Chrome: fall back to the default browser. We can't watch that
  REM window, so the server keeps running - stop it with close.bat.
  echo [%date% %time%] no chrome - default browser fallback >> "%LOG%"
  start "" http://localhost:3000/overview
  echo No Chrome found - opened default browser. Run close.bat to stop the server.
  goto :end
)

start "" "%CHROME_EXE%" --app=http://localhost:3000/overview --user-data-dir="%LOCALAPPDATA%\internpilot-chrome-profile"
echo [%date% %time%] app window launched - supervising >> "%LOG%"
echo App window open - the server stops when you close it.

REM ---- Supervisor: poll for the app-window process every 3s. ----
REM SEEN flips to 1 once the window has been observed; after that, zero
REM processes means the user closed it. Before first sighting, allow ~15s
REM of grace (5 misses) in case Chrome is slow to appear.
set /a SEEN=0
set /a MISSES=0
:supervise
timeout /t 3 /nobreak >nul
set "CHROME_COUNT="
for /f %%c in ('powershell -NoProfile -Command "(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' -and $_.CommandLine -match 'internpilot-chrome-profile' } | Measure-Object).Count"') do set "CHROME_COUNT=%%c"
if not "%CHROME_COUNT%"=="0" set /a SEEN=1
if not "%CHROME_COUNT%"=="0" goto :supervise
if "%SEEN%"=="1" goto :winclosed
set /a MISSES+=1
if %MISSES% geq 5 goto :winclosed
goto :supervise

:winclosed
echo [%date% %time%] app window closed - stopping server >> "%LOG%"
echo App window closed - stopping server...
REM Kill logic inlined rather than `call close.bat` - the call returned in
REM ~20ms without executing the child script in this context (cause unclear;
REM see launcher.log timestamps from 2026-06-10). Single-line PowerShell is
REM the same pattern the supervisor loop runs successfully every 3 seconds.
powershell -NoProfile -Command "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($p) { $p | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } }" >nul 2>&1
echo [%date% %time%] shutdown complete >> "%LOG%"
goto :end

:openwindow_reattach
if exist "%CHROME_EXE%" (
  start "" "%CHROME_EXE%" --app=http://localhost:3000/overview --user-data-dir="%LOCALAPPDATA%\internpilot-chrome-profile"
) else (
  start "" http://localhost:3000/overview
)

:end
endlocal
exit /b 0
