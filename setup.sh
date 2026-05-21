#!/bin/bash

echo "🔒 SecureCode AI - Setup Rápido"
echo "================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor, instale Node.js 18+"
    exit 1
fi

echo "✅ Node.js $(node -v) detectado"
echo ""

# Backend Setup
echo "📦 Configurando Backend..."
cd backend
cp .env.example .env
npm install
echo "✅ Backend configurado"
echo ""

# Frontend Setup
echo "📦 Configurando Frontend..."
cd ../frontend
cp .env.example .env
npm install
echo "✅ Frontend configurado"
echo ""

echo "🚀 Setup concluído!"
echo ""
echo "Próximos passos:"
echo "1. Instale Ollama: https://ollama.ai"
echo "2. Execute: ollama pull llama3"
echo "3. Em um terminal: cd backend && npm run dev"
echo "4. Em outro terminal: cd frontend && npm run dev"
echo "5. Acesse: http://localhost:5173"
echo ""
echo "Documentação completa em: README.md"
