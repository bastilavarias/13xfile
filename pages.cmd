@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0pages.ps1" %*
exit /b %ERRORLEVEL%
