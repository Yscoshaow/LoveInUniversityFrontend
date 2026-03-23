@echo off
setlocal

REM Auto-detect git commit SHA
for /f "tokens=*" %%i in ('git rev-parse --short HEAD 2^>nul') do set GIT_SHA=%%i
if "%GIT_SHA%"=="" set GIT_SHA=unknown

echo Building with Git SHA: %GIT_SHA%

docker build ^
  --build-arg GIT_COMMIT_SHA=%GIT_SHA% ^
  --build-arg VITE_API_BASE_URL=%VITE_API_BASE_URL% ^
  %* ^
  -t lovein-university-web .

endlocal
