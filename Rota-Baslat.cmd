@echo off
cd /d "%~dp0"
if not exist ".next\BUILD_ID" (
  echo Once npm run build komutunu calistirin.
  pause
  exit /b 1
)
echo Rota: http://127.0.0.1:3000
echo Uygulama acik kalmasi icin bu pencereyi kapatmayin.
call npm.cmd start
pause
