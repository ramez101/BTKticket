@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
for %%R in ("%CD%") do set "PROJECT_ROOT=%%~fR"

set "LAN_IP="
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /C:"IPv4"') do if not defined LAN_IP set "LAN_IP=%%I"
for /f "tokens=* delims= " %%I in ("!LAN_IP!") do set "LAN_IP=%%I"
if not defined LAN_IP (
  echo Impossible de trouver l'adresse IPv4 du PC.
  pause
  exit /b 1
)

echo BTK Easy - configuration reseau automatique
echo Adresse du PC : !LAN_IP!

powershell -NoProfile -ExecutionPolicy Bypass -Command "$envFile = Join-Path -Path '%PROJECT_ROOT%' -ChildPath 'mobile\.env'; Set-Content -LiteralPath $envFile -Value 'EXPO_PUBLIC_API_URL=http://!LAN_IP!:3000' -Encoding utf8"

echo Demarrage du serveur web sur http://!LAN_IP!:3000
start "BTK Web Server" "%ComSpec%" /k call "%PROJECT_ROOT%\lancer-serveur.bat"

timeout /t 3 /nobreak >nul

echo Demarrage d'Expo Go sur exp://!LAN_IP!:8083
start "BTK Expo Go" powershell -NoProfile -ExecutionPolicy Bypass -NoExit -Command "$env:REACT_NATIVE_PACKAGER_HOSTNAME='!LAN_IP!'; Set-Location -LiteralPath '%PROJECT_ROOT%\mobile'; npm.cmd run start -- --clear --go --lan --port 8083"

echo.
echo Site web : http://!LAN_IP!:3000
echo Scannez le nouveau QR code Expo Go.
echo Gardez les deux fenetres ouvertes.
pause
