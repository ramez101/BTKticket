@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
for %%R in ("%CD%") do set "PROJECT_ROOT=%%~fR"

if /i "%~1"=="cache-loop" goto cache_loop

echo ========================================
echo   BTKticket - serveur de developpement
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo Erreur: npm est introuvable. Installez Node.js puis relancez ce fichier.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Installation des dependances...
  call npm install
  if errorlevel 1 (
    echo.
    echo Erreur pendant npm install.
    pause
    exit /b 1
  )
)

call :clean_cache

echo Nettoyage automatique du cache active toutes les 24h.
start "BTK cache cleaner" /min "%~f0" cache-loop
echo.

echo Lancement sur http://localhost:3000
echo Gardez cette fenetre ouverte pour laisser le serveur actif.
echo.

call npm run dev

echo.
echo Le serveur s'est arrete.
pause
exit /b 0

:cache_loop
timeout /t 86400 /nobreak >nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000' -TimeoutSec 5; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 }; exit 1 } catch { exit 1 }"
if errorlevel 1 exit /b 0
call :clean_cache silent
goto cache_loop

:clean_cache
set "QUIET=%~1"
if /i not "%QUIET%"=="silent" (
  echo Nettoyage du cache...
)
call :clean_dir ".next\cache"
call :clean_dir "node_modules\.cache"
call :clean_file "tsconfig.tsbuildinfo"
if /i not "%QUIET%"=="silent" (
  echo Cache nettoye.
  echo.
)
exit /b 0

:clean_dir
set "TARGET_REL=%~1"
if not exist "!TARGET_REL!" exit /b 0
for %%T in ("!TARGET_REL!") do set "TARGET_FULL=%%~fT"
echo(!TARGET_FULL!| findstr /I /B /C:"!PROJECT_ROOT!\" >nul
if errorlevel 1 (
  if /i not "%QUIET%"=="silent" echo Chemin ignore par securite: !TARGET_FULL!
  exit /b 0
)
rmdir /s /q "!TARGET_FULL!" >nul 2>nul
exit /b 0

:clean_file
set "TARGET_REL=%~1"
if not exist "!TARGET_REL!" exit /b 0
for %%T in ("!TARGET_REL!") do set "TARGET_FULL=%%~fT"
echo(!TARGET_FULL!| findstr /I /B /C:"!PROJECT_ROOT!\" >nul
if errorlevel 1 (
  if /i not "%QUIET%"=="silent" echo Fichier ignore par securite: !TARGET_FULL!
  exit /b 0
)
del /f /q "!TARGET_FULL!" >nul 2>nul
exit /b 0
