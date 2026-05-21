# SecureCode AI - Instruções para Copilot

SecureCode AI é uma aplicação fullstack para demonstrar riscos de segurança em LLMs e como guardrails podem detectar e bloquear vulnerabilidades.

## Stack Utilizado
- **Frontend**: React + Vite + TypeScript + TailwindCSS
- **Backend**: Node.js + Express + TypeScript
- **IA**: Ollama (Llama3) ou OpenAI API
- **Banco**: SQLite

## Estrutura do Projeto
```
SecureCode AI/
├── frontend/          # Aplicação React
├── backend/           # API Node.js + Express
├── .github/           # Arquivos de configuração
├── docker-compose.yml # Orquestração (opcional)
└── README.md          # Documentação
```

## Convenções do Projeto
- TypeScript strict mode ativado
- Componentes React funcionais com hooks
- Código organizado por features/funcionalidades
- TailwindCSS para estilos
- Comentários explicativos em áreas críticas de segurança

## Próximos Passos
1. Instalar dependências (npm install)
2. Configurar variáveis de ambiente
3. Executar migrations de banco de dados
4. Iniciar servidores (frontend + backend)
