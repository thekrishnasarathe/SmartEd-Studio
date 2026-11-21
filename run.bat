@echo off
title AstraGrade v3.0 - Smart Answer Sheet Evaluator
cd /d "%~dp0"

echo ======================================================================
echo   AstraGrade v3.0 - Full-Stack Launcher
echo   FastAPI Backend (:8000) + Vite React Frontend (:3000)
echo ======================================================================
echo.

set PYTHON_EXE=C:\Users\krish\AppData\Local\Programs\Python\Python312\python.exe
if not exist "%PYTHON_EXE%" (
    set PYTHON_EXE=python
)

"%PYTHON_EXE%" start.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [Error] AstraGrade launcher exited with code %ERRORLEVEL%.
    pause
) else (
    echo.
    echo [AstraGrade] Shutdown complete.
    pause
)
