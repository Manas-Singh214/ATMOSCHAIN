@echo off
echo Starting ATMOSCHAIN WORK Frontend...
cd /d "%~dp0frontend"
echo.
echo Frontend will be available at http://localhost:5173
npm run dev
