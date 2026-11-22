@echo off
setlocal
cd /d "%~dp0"
set "PORT=8765"
where py >nul 2>nul
if %errorlevel%==0 goto use_py
where python >nul 2>nul
if %errorlevel%==0 goto use_python
 echo Python 3 nao foi encontrado no PATH.
 echo Instale Python 3 ou inicie um servidor HTTP local nesta pasta.
 pause
 exit /b 1
:use_py
start "MangaCut Studio 2.0 - Servidor" /min cmd /k "cd /d ""%~dp0"" && py -3 -m http.server %PORT% --bind 127.0.0.1"
goto open_browser
:use_python
start "MangaCut Studio 2.0 - Servidor" /min cmd /k "cd /d ""%~dp0"" && python -m http.server %PORT% --bind 127.0.0.1"
:open_browser
timeout /t 2 /nobreak >nul
start "" "http://localhost:%PORT%/"
echo Mantenha a janela do servidor aberta enquanto usa o editor.
exit /b 0
