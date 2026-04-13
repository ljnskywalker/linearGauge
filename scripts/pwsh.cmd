@echo off
REM Local shim for environments without PowerShell 7 'pwsh' in PATH.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass %*
