@echo off
cls

echo.
echo 0x[SecureCode AI - Setup Rapido]
echo ==================================
echo.

REM Check Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo X Node.js nao encontrado. Instale Node.js 18+
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo + Node.js %NODE_VERSION% detectado
echo.

REM Backend Setup
echo + Configurando Backend...
cd backend
if not exist .env (
    copy .env.example .env
)
call npm install
echo + Backend configurado
echo.
cd ..

REM Frontend Setup
echo + Configurando Frontend...
cd frontend
if not exist .env (
    copy .env.example .env
)
call npm install
echo + Frontend configurado
echo.
cd ..

echo.
echo + Setup concluido!
echo.
echo Proximos passos:
echo 1. Instale Ollama: https://ollama.ai
echo 2. Execute: ollama pull llama3
echo 3. Em um terminal: cd backend ^&^& npm run dev
echo 4. Em outro terminal: cd frontend ^&^& npm run dev
echo 5. Acesse: http://localhost:5173
echo.
echo Documentacao completa em: README.md
echo.
pause
