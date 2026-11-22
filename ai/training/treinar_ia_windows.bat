@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Instale Python 3.10/3.11 e adicione-o ao PATH.&pause&exit /b 1)
set "PYTHON_CMD=py -3.11"
%PYTHON_CMD% --version >nul 2>nul
if errorlevel 1 set "PYTHON_CMD=py -3.10"
%PYTHON_CMD% --version >nul 2>nul
if errorlevel 1 (
  echo Python 3.10 ou 3.11 nao encontrado.
  pause
  exit /b 1
)
%PYTHON_CMD% -c "import torch" >nul 2>nul
if errorlevel 1 (
  echo PyTorch nao instalado.
  echo Instale a versao compativel com seu computador em https://pytorch.org/get-started/locally/
  echo Depois volte e execute este arquivo novamente.
  pause
  exit /b 1
)
%PYTHON_CMD% -m pip install -r requirements-training.txt
if errorlevel 1 (echo Falha ao instalar dependencias.&pause&exit /b 1)
%PYTHON_CMD% run_finetune.py --dataset dataset --style all --epochs 12 --batch-size 1 --workers 1
pause
