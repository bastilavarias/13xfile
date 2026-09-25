@echo off
setlocal

where docker >nul 2>nul
if errorlevel 1 (
  echo Docker was not found in PATH. Install Docker Desktop and try again.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo Docker Compose is not available. Install or update Docker Desktop and try again.
  exit /b 1
)

echo Starting 13xfile local web stack with Docker...
echo.
echo   Main   http://127.0.0.1:8080/
echo   Feed   http://127.0.0.1:8081/
echo   Share  http://127.0.0.1:8082/
echo   API    http://127.0.0.1:8090/health
echo.
echo Press Ctrl+C to stop the stack.
echo.

docker compose up --build --remove-orphans
exit /b %ERRORLEVEL%
