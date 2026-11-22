@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Instale Python 3.10/3.11 e adicione-o ao PATH.&pause&exit /b 1)
set "PYTHON_CMD=py -3.11"
%PYTHON_CMD% --version >nul 2>nul
if errorlevel 1 set "PYTHON_CMD=py -3.10"
%PYTHON_CMD% --version >nul 2>nul
if errorlevel 1 (echo Python 3.10 ou 3.11 nao encontrado.&pause&exit /b 1)
%PYTHON_CMD% prepare_dataset.py --source samples --output dataset --style all --overwrite
if errorlevel 1 pause
