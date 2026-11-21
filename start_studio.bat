@echo off
title SmartEd Studio - Server Launcher
echo ========================================================
echo   Starting SmartEd Studio Backend and Frontend Servers
echo ========================================================
echo.

cd /d "%~dp0"

set PYTHON_EXE=C:\Users\krish\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "SmartEd Backend (Port 8000)" cmd /k "cd /d %~dp0backend && "%PYTHON_EXE%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/2] Starting Vite Frontend on http://localhost:3000 ...
start "SmartEd Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================================
echo   Servers are launching in separate windows!
echo   Open your browser at: http://localhost:3000
echo ========================================================
pause
