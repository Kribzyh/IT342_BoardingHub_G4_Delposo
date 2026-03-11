@echo off
REM Enable TLS 1.2 and build with Maven wrapper
REM This script attempts to work around Maven wrapper network issues

setlocal enabledelayedexpansion

REM Set TLS security protocol
powershell -NoProfile -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 -bor [Net.SecurityProtocolType]::Tls11}"

REM Try to run Maven wrapper with verbose output
echo Attempting to build with Maven wrapper...
call mvnw.cmd clean install -DskipTests -X

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Maven wrapper failed with network error.
    echo Trying alternative approach...
    echo.
    
    REM Try to download Maven manually
    echo Downloading Maven from Apache repository...
    powershell -NoProfile -Command "^ $ErrorActionPreference = 'Continue'; ^ [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^ if (-not (Test-Path 'C:\Maven')) { mkdir 'C:\Maven' }; ^ $url = 'https://archive.apache.org/dist/maven/maven-3/3.9.11/binaries/apache-maven-3.9.11-bin.zip'; ^ $outPath = 'C:\Maven\maven.zip'; ^ try { ^ Write-Host 'Downloading Maven...'; ^ [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; ^ (New-Object Net.WebClient).DownloadFile($url, $outPath); ^ Write-Host 'Download complete'; ^ } catch { Write-Host 'Download failed: $_' } ^ "
    
    echo.
    echo Please follow the QUICK_START.md guide for manual setup instructions.
)

endlocal
