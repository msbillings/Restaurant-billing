# Master Build Script for MS Billings Desktop (.exe) & Mobile (.apk)
$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " 1/2 BUILDING DESKTOP APP (.EXE)...       " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location "d:\restaurant\Restaurant-billing\Desktop"
node build.js
npx electron-builder --win

# Ensure builds directory exists
$buildsDir = "d:\restaurant\Restaurant-billing\builds"
if (-not (Test-Path $buildsDir)) {
    New-Item -ItemType Directory -Path $buildsDir | Out-Null
}

$latestExe = Get-ChildItem -Path "d:\restaurant\Restaurant-billing\Desktop\dist\*.exe" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($latestExe) {
    Copy-Item -Path $latestExe.FullName -Destination $buildsDir -Force
    Write-Host "Desktop EXE build finished: $($latestExe.Name)" -ForegroundColor Green
}

Write-Host "`n==========================================" -ForegroundColor Cyan
Write-Host " 2/2 BUILDING ANDROID APK (.APK)...        " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

Set-Location "d:\restaurant\Restaurant-billing\Frontend"
npx cap sync android

Set-Location "d:\restaurant\Restaurant-billing\Frontend\android"
$env:JAVA_HOME = "d:\restaurant\Restaurant-billing\tools\jdk21\jdk-21.0.6+7"
$env:PATH = "$($env:JAVA_HOME)\bin;" + $env:PATH

cmd.exe /c "gradlew.bat assembleRelease --no-daemon"

$apkSrc = "d:\restaurant\Restaurant-billing\Frontend\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkSrc) {
    Copy-Item -Path $apkSrc -Destination "$buildsDir\msbilling-restaurant.apk" -Force
    Copy-Item -Path $apkSrc -Destination "d:\restaurant\Restaurant-billing\msbilling-restaurant.apk" -Force
    Write-Host "Android APK build finished: msbilling-restaurant.apk" -ForegroundColor Green
}

Write-Host "`n ALL BUILDS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
