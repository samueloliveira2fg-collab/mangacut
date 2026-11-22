@echo off
setlocal
cd /d "%~dp0"
echo ================================================
echo MangaCut Studio - Anime Segmentation (ISNet)
echo ================================================
where py >nul 2>nul
if errorlevel 1 (
  echo Python nao encontrado. Instale Python 3.10 ou 3.11 e marque Add Python to PATH.
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  py -3.11 -m venv .venv 2>nul
  if errorlevel 1 py -3.10 -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
  echo Nao foi possivel criar o ambiente virtual.
  pause
  exit /b 1
)
call ".venv\Scripts\activate.bat"
python -m pip install --upgrade pip
python -m pip install -r requirements-ai.txt
if errorlevel 1 (
  echo Falha ao instalar dependencias. Verifique a conexao e tente novamente.
  pause
  exit /b 1
)
echo.
echo Servico iniciado. Mantenha esta janela aberta enquanto usa o MangaCut.
echo O modelo oficial de aproximadamente 176 MB sera baixado na primeira inferencia.
python ai_service.py
pause
