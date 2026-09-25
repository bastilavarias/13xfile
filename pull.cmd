@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pull.ps1" %*
exit /b %ERRORLEVEL%
