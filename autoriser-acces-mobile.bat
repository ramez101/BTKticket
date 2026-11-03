@echo off
setlocal

net session >nul 2>&1
if not "%errorlevel%"=="0" (
  echo Demande des droits administrateur...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b 0
)

echo Autorisation de l'API BTK Easy sur le reseau local...
netsh advfirewall firewall delete rule name="BTK Easy API 3000" >nul 2>&1
netsh advfirewall firewall add rule name="BTK Easy API 3000" dir=in action=allow protocol=TCP localport=3000 remoteip=any profile=any

if errorlevel 1 (
  echo Echec de la configuration du pare-feu.
  pause
  exit /b 1
)

echo Autorisation active pour le port 3000 sur le reseau local.
echo Relance ensuite Expo Go avec le nouveau QR code.
pause
