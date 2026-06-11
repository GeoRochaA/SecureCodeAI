# SecureCode AI

Plataforma acadêmica de auditoria de código com IA generativa. Demonstra geração de código seguro e vulnerável, detecção de prompt injection e análise automática de vulnerabilidades (OWASP Top 10).

---

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Banco de dados | SQLite |
| IA (análise e geração) | Ollama + **qwen2.5-coder:0.5b** (padrão) |
| IA alternativa | OpenAI API (gpt-3.5-turbo) |

A IA responsável por interpretar os prompts e gerar o código é executada localmente via **Ollama**, usando o modelo **qwen2.5-coder:0.5b**. Como alternativa, é possível usar a API da OpenAI configurando `AI_PROVIDER=openai` e fornecendo uma chave de API.

---

## Requisitos

- Docker e Docker Compose

---

## Como iniciar (Docker)

O Ollama roda no host e o Docker aponta para ele via `host-gateway`. Não há container separado para a IA.

**1. Instale o Ollama e baixe o modelo (uma vez só):**

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5-coder:0.5b
```

**2. Certifique-se de que o Ollama está rodando:**

```bash
ollama serve
```

**3. Suba os containers (novo terminal):**

```bash
docker compose up --build -d
```

**4. Acesse a aplicação:**

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

## Como iniciar (sem Docker)

**Pré-requisitos:** Node.js 20+, Ollama instalado localmente.

**1. Instale e inicie o Ollama:**

```bash
# Linux / WSL
curl -fsSL https://ollama.com/install.sh | sh

ollama pull qwen2.5-coder:0.5b
ollama serve
```

**2. Configure o backend:**

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

**3. Configure o frontend (novo terminal):**

```bash
cd frontend
npm install
npm run dev
```

**4. Acesse a aplicação:**

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

---

## Variáveis de ambiente (backend/.env)

```env
PORT=3000
NODE_ENV=development

AI_PROVIDER=ollama
AI_MODEL=qwen2.5-coder:0.5b
AI_BASE_URL=http://localhost:11434

# Alternativa OpenAI
# AI_PROVIDER=openai
# OPENAI_API_KEY=sua_chave_aqui

DATABASE_PATH=./data/securecode.db
CORS_ORIGIN=http://localhost:5173
```

---

## Autores

Geovanna Rocha & Henrique Zorzi — IFRO, Tópicos Especiais em Segurança
