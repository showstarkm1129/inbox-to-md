@echo off
echo Starting Inbox-to-MD...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    pause
    exit /b 1
)

REM Optional: Install requirements if needed
REM echo Checking dependencies...
REM pip install -r requirements.txt --quiet

REM Start the application
python app.py

pause
