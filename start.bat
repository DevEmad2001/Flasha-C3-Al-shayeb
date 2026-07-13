@echo off
chcp 65001 >nul
title AlShaibHousing System

echo ============================================
echo  AlShaibHousing - تشغيل النظام
echo ============================================

echo.
echo [1/4] إيقاف أي خادم سابق على port 5200...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5200"') do (
    if not "%%a"=="" taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo.
echo [2/4] تشغيل الخادم الخلفي (Backend) على port 5200...
start /min "Backend" cmd /c "cd /d "%~dp0backend" && dotnet run --project AlShaibHousing.Api.csproj --urls http://localhost:5200"

echo [3/4] انتظار جاهزية الخادم الخلفي...
:wait
timeout /t 3 /nobreak >nul
>nul 2>&1 netstat -ano | findstr ":5200" || goto wait

echo     الخادم الخلفي جاهز على http://localhost:5200
echo.
echo [4/4] تشغيل الواجهة الأمامية (Frontend)...
echo.

npm run dev

echo.
echo تم إيقاف النظام.
pause