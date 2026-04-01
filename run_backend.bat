@echo off
echo Starting ATMOSCHAIN WORK Backend...
cd /d "%~dp0backend"
call ..\.venv\Scripts\activate
pip install -r requirements.txt -q
echo.
echo Backend running at http://localhost:8000
uvicorn main:app --reload
