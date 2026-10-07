@echo off
setlocal EnableExtensions

cd /d "%~dp0"
for %%R in ("%CD%") do set "PROJECT_ROOT=%%~fR"
set "PORTABLE_NODE=%PROJECT_ROOT%\.tools\node-runtime\node-v24.21.0-win-x64"
if exist "%PORTABLE_NODE%\node.exe" (
  set "PATH=%PORTABLE_NODE%;%PORTABLE_NODE%\node_modules\npm\bin;%PATH%"
)
echo ========================================
echo   BTKticket - installation XAMPP/MySQL
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo Erreur: Node.js/npm est introuvable.
  echo Installez Node.js LTS puis relancez ce fichier.
  pause
  exit /b 1
)

if not exist "C:\xampp\mysql\bin\mysql.exe" (
  echo Erreur: MySQL XAMPP est introuvable dans C:\xampp.
  pause
  exit /b 1
)

echo Verification de MySQL XAMPP...
"C:\xampp\mysql\bin\mysqladmin.exe" -h 127.0.0.1 -P 3306 -u root ping >nul 2>nul
if errorlevel 1 (
  echo Erreur: demarrez MySQL dans XAMPP puis relancez ce fichier.
  pause
  exit /b 1
)

echo Creation de la base btkticket...
echo CREATE DATABASE IF NOT EXISTS btkticket CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; | "C:\xampp\mysql\bin\mysql.exe" -h 127.0.0.1 -P 3306 -u root
if errorlevel 1 goto failure

if not exist "node_modules" (
  echo Installation des dependances npm...
  call npm install
  if errorlevel 1 goto failure
)

echo Generation du client Prisma MySQL...
call npx prisma generate
if errorlevel 1 goto failure

echo Creation/mise a jour des tables...
call npx prisma db push
if errorlevel 1 goto failure

echo Import des donnees initiales...
call npm run db:seed
if errorlevel 1 goto failure

echo.
echo Installation terminee. Lancez lancer-serveur.bat pour demarrer le serveur.
pause
exit /b 0

:failure
echo.
echo Installation interrompue. Consultez le message ci-dessus.
pause
exit /b 1
