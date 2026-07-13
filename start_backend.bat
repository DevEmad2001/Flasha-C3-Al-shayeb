@echo off
chcp 65001 >nul
title Backend - AlShaibHousing

:loop
echo إيقاف أي خادم سابق على port 5200...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5200"') do (
    if not "%%a"=="" taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo تشغيل الخادم الخلفي (Backend)...
cd /d "%~dp0backend"
dotnet run --project AlShaibHousing.Api.csproj --urls http://localhost:5200

echo.
echo [%date% %time%] الخادم الخلفي توقف. سيتم إعادة التشغيل بعد 3 ثوانٍ...
echo [%date% %time%] CRASH >> "%~dp0backend_crash.log"
timeout /t 3 /nobreak >nul
goto loop
