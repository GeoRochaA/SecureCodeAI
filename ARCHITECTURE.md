# 🏗️ Arquitetura - SecureCode AI

## 📐 Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Pages: Chat, Dashboard, History                     │    │
│  │  Components: Header, CodeDisplay, RiskBadge, etc     │    │
│  │  Services: API Client                                │    │
│  └─────────────────────────────────────────────────────┘    │
│                      :5173                                   │
└─────────────────────────────────────────────────────────────┘
                           ↓ HTTP/REST
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Routes: /api/generate, /api/statistics, etc     │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │ Middleware                                     │    │    │
│  │  │ - Error Handler                               │    │    │
│  │  │ - CORS                                        │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │                                                        │    │
│  │  ┌──────────────────────────────────────────────┐    │    │
│  │  │ Services Layer                                │    │    │
│  │  │ - codeService (orquestração)                 │    │    │
│  │  └──────────────────────────────────────────────┘    │    │
│  │          ↓              ↓              ↓              │    │
│  │  ┌────────────────────────────────────────────────┐  │    │
│  │  │ Security Layer (Guardrails)                    │  │    │
│  │  │ - Prompt Injection Detection                   │  │    │
│  │  │ - Code Vulnerability Analysis                 │  │    │
│  │  │ - Secure Code Generation                       │  │    │
│  │  │ - Security Logging                             │  │    │
│  │  └────────────────────────────────────────────────┘  │    │
│  │          ↓                        ↓                    │    │
│  │  ┌──────────────────┐   ┌─────────────────────────┐  │    │
│  │  │ AI Service       │   │ Database Layer (SQLite) │  │    │
│  │  │ - Ollama/OpenAI  │   │ - Prompts              │  │    │
│  │  └──────────────────┘   │ - Code Responses       │  │    │
│  │         ↓                │ - Vulnerabilities      │  │    │
│  │  ┌──────────────────┐   │ - Security Logs        │  │    │
│  │  │ Ollama Server    │   │ - Statistics           │  │    │
│  │  │ :11434           │   └─────────────────────────┘  │    │
│  │  └──────────────────┘   ./data/securecode.db         │    │
│  │       OR                                              │    │
│  │  OpenAI API                                           │    │
│  │                                                        │    │
│  └─────────────────────────────────────────────────────┘    │
│                      :3000                                   │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Estrutura de Diretórios Detalhada

### Frontend
```
frontend/
├── src/
│   ├── components/
│   │   └── Header.tsx              # Navegação principal
│   ├── pages/
│   │   ├── ChatPage.tsx            # Geração de código + análise
│   │   ├── DashboardPage.tsx       # Estatísticas e logs
│   │   └── HistoryPage.tsx         # Histórico de prompts
│   ├── services/
│   │   └── api.ts                  # Cliente HTTP
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   ├── utils/
│   │   └── api.ts                  # Configuração Axios
│   ├── styles/
│   │   └── index.css               # Tailwind + custom CSS
│   ├── App.tsx                     # Componente raiz
│   ├── App.css                     # Estilos do App
│   └── main.tsx                    # Entrada da aplicação
├── index.html                      # HTML raiz
├── tsconfig.json                   # Configuração TypeScript
├── vite.config.ts                  # Configuração Vite
├── tailwind.config.js              # Configuração Tailwind
├── postcss.config.js               # Configuração PostCSS
├── .eslintrc.json                  # ESLint
└── package.json
```

### Backend
```
backend/
├── src/
│   ├── routes/
│   │   └── index.ts                # Todas as rotas da API
│   ├── middleware/
│   │   └── errorHandler.ts         # Tratamento de erros
│   ├── services/
│   │   └── codeService.ts          # Orquestração principal
│   ├── security/
│   │   └── guardrails.ts           # Sistema de segurança
│   │                               # - Detecção de injection
│   │                               # - Análise de código
│   │                               # - Geração de código seguro
│   ├── ai/
│   │   └── service.ts              # Integração Ollama/OpenAI
│   ├── database/
│   │   └── init.ts                 # SQLite setup e queries
│   ├── logs/
│   │   └── (estrutura para logs)
│   ├── utils/
│   │   └── (utilitários comuns)
│   └── server.ts                   # Express app principal
├── data/
│   └── securecode.db               # Banco SQLite (criado automaticamente)
├── tsconfig.json
├── .eslintrc.json
├── Dockerfile
└── package.json
```

## 🔄 Fluxo de Dados

### 1. Requisição de Geração de Código
```
1. Usuário digita prompt no ChatPage
2. Frontend submete POST /api/generate
3. Backend - codeService:
   a. Chama analyzePromptSecurity()
   b. Se injeção detectada → Bloqueia com erro
   c. Chama generateCodeWithAI()
   d. Chama analyzeCodeSecurity()
   e. Se vulnerável → Chama generateSecureCode()
   f. Salva tudo no banco de dados
   g. Retorna response com análise completa
4. Frontend exibe código, vulnerabilidades e code seguro
```

### 2. Atualização de Dashboard
```
1. DashboardPage mounted/polling
2. Faz GET /api/statistics
3. Backend query:
   a. Lê statistics table
   b. Lê últimos 10 logs
   c. Conta vulnerabilidades por tipo
   d. Agrupa riscos por nível
   e. Retorna JSON
4. Frontend renderiza gráficos e logs
```

### 3. Consulta de Histórico
```
1. HistoryPage mounted
2. Faz GET /api/history?limit=100
3. Backend query:
   a. SELECT * FROM prompts + code_responses
   b. JOIN para correlacionar dados
   c. ORDER BY created_at DESC
   d. Retorna array de prompts
4. Frontend renderiza lista expansível
```

## 🔐 Camada de Segurança (Guardrails)

### Detecção de Prompt Injection
```typescript
// Padrões detectados:
- /ignore\s+previous\s+instructions/i
- /reveal\s+(?:system\s+)?prompt/i
- /act\s+as\s+(?:administrator|admin|root)/i
- /show\s+(?:hidden|secret|system)\s+config/i
- E mais 15+ padrões...

// Score de risco:
- Crítico se padrão encontrado
- Alto se múltiplas palavras suspeitas
- Médio se prompt muito longo
```

### Análise de Vulnerabilidades de Código
```typescript
// Vulnerabilidades detectadas:
1. SQL_INJECTION       - Concatenação direta em queries
2. XSS                 - innerHTML inseguro
3. UNSAFE_CODE_EXEC    - eval(), exec(), Function()
4. HARDCODED_SECRET    - Senhas hardcoded
5. UNSAFE_REQUIRE      - Require dinâmico
6. COMMAND_INJECTION   - child_process.exec()
7. UNSAFE_REDIRECT     - Redirecionamento não validado
8. PATH_TRAVERSAL      - Leitura de arquivos insegura
9. INPUT_NOT_SANITIZED - PHP sem htmlspecialchars
10. DEPRECATED_MYSQL   - Extensão MySQL antiga

// Severity levels:
- Crítico: 25 pontos
- Alto: 15 pontos
- Médio: 8 pontos
- Baixo: 3 pontos
// Score normalizado 0-100
```

### Geração de Código Seguro
```typescript
// Conversões automáticas:
- SQL: Concatenação → Prepared statements
- JS/TS: innerHTML → textContent
- JS/TS: eval() → JSON.parse()
- PHP: Direto → htmlspecialchars()
- Python: os.system() → subprocess.run(shell=False)
```

## 💾 Modelo de Dados SQLite

### Tabela: prompts
```sql
CREATE TABLE prompts (
  id TEXT PRIMARY KEY,
  user_input TEXT NOT NULL,
  risk_level TEXT,
  is_injection_detected BOOLEAN,
  injection_type TEXT,
  created_at DATETIME
)
```

### Tabela: code_responses
```sql
CREATE TABLE code_responses (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  generated_code TEXT,
  language TEXT,
  is_vulnerable BOOLEAN,
  vulnerabilities TEXT (JSON),
  created_at DATETIME,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id)
)
```

### Tabela: code_corrections
```sql
CREATE TABLE code_corrections (
  id TEXT PRIMARY KEY,
  response_id TEXT NOT NULL,
  vulnerability_type TEXT,
  vulnerability_description TEXT,
  secure_code TEXT,
  owasp_category TEXT,
  created_at DATETIME,
  FOREIGN KEY (response_id) REFERENCES code_responses(id)
)
```

### Tabela: security_logs
```sql
CREATE TABLE security_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  severity TEXT,
  message TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT (JSON),
  created_at DATETIME
)
```

### Tabela: statistics
```sql
CREATE TABLE statistics (
  id TEXT PRIMARY KEY,
  total_prompts INTEGER,
  total_attacks_blocked INTEGER,
  total_vulnerabilities_detected INTEGER,
  total_corrections INTEGER,
  last_updated DATETIME
)
```

## 🌐 API Endpoints

### POST /api/generate
**Request:**
```json
{
  "prompt": "Crie um login em PHP",
  "safeMode": true
}
```

**Response:**
```json
{
  "id": "uuid",
  "prompt": "...",
  "code": "...",
  "language": "php",
  "explanation": "...",
  "securityAnalysis": {
    "promptRiskLevel": "baixo",
    "isInjectionDetected": false,
    "injectionDetails": []
  },
  "codeAnalysis": {
    "isVulnerable": false,
    "vulnerabilities": [],
    "riskScore": 15
  },
  "secureCode": "...",
  "createdAt": "2024-..."
}
```

### GET /api/statistics
**Response:**
```json
{
  "overall": {
    "total_prompts": 42,
    "total_attacks_blocked": 3,
    "total_vulnerabilities_detected": 12,
    "total_corrections": 8
  },
  "recentLogs": [...],
  "vulnerabilitiesByType": [...],
  "risksByLevel": [...]
}
```

### GET /api/history?limit=50
**Response:**
```json
[
  {
    "id": "uuid",
    "user_input": "Crie um login",
    "risk_level": "médio",
    "is_injection_detected": false,
    "created_at": "2024-..."
  }
]
```

## 🎨 Paleta de Cores

```css
--color-cyber-dark: #0a0e27    /* Fundo escuro */
--color-cyber-darker: #050811  /* Muito escuro */
--color-cyber-blue: #00d4ff    /* Azul cyber */
--color-cyber-purple: #7c3aed  /* Roxo */
--color-cyber-green: #10b981   /* Verde */
--color-cyber-red: #ef4444     /* Vermelho */
--color-cyber-yellow: #f59e0b  /* Amarelo */
```

## 📦 Dependências Principais

### Frontend
- **react**: UI library
- **axios**: HTTP client
- **vite**: Build tool
- **tailwindcss**: CSS framework

### Backend
- **express**: Web framework
- **sqlite3**: Database
- **axios**: HTTP client
- **uuid**: ID generation
- **dotenv**: Environment config

## 🔄 CI/CD (Docker)

### Dockerfile Backend
- Node 18 Alpine
- Multi-stage build
- Compilação TypeScript
- Runtime otimizado

### Dockerfile Frontend
- Node 18 Alpine (build)
- Nginx Alpine (serve)
- Build otimizado

### docker-compose.yml
- Ollama service
- Backend service
- Frontend service
- Volumes compartilhados
- Networking automático

---

**Arquitetura moderna, escalável e segura! 🔒**
