import axios from 'axios';

export interface AIResponse {
  code: string;
  language: string;
  explanation: string;
}

const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const AI_MODEL = process.env.AI_MODEL || 'qwen2.5-coder:0.5b';
const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434';
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 300000);
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 1800);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Gera codigo usando IA (Ollama ou OpenAI).
 */
export const generateCodeWithAI = async (
  prompt: string,
  isSafeMode: boolean = true
): Promise<AIResponse> => {
  const systemPrompt = isSafeMode
    ? `Voce gera sistemas seguros e multi-arquivo para uma demonstracao academica de auditoria de codigo gerado por IA.
Regras:
- Gere um sistema realista, organizado e completo, com backend, rotas, middlewares, validacao e persistencia simulada ou SQL.
- Use marcadores de arquivo: // file: src/server.ts
- Use bcrypt, prepared statements, validacao de entrada, JWT com segredo via ambiente, autorizacao e upload validado quando aplicavel.
- Nao use segredos hardcoded, eval, innerHTML inseguro, queries concatenadas ou autenticacao fraca.
- A explicacao deve ser curta e tecnica.

Retorne exatamente neste formato:
[LANGUAGE]typescript[/LANGUAGE]
[CODE]
codigo_aqui
[/CODE]
[EXPLANATION]Secure generated system.[/EXPLANATION]`
    : `Voce gera sistemas multi-arquivo propositalmente vulneraveis para uma demonstracao academica de auditoria defensiva.
Regras:
- Gere um sistema realista, organizado e completo, com backend, rotas, autenticacao, banco de dados e frontend simples quando fizer sentido.
- Use marcadores de arquivo: // file: src/server.ts
- Inclua vulnerabilidades intencionais: SQL Injection, JWT fraco, segredo hardcoded, validacao ausente, autorizacao ausente e exposicao de dados.
- Nao explique as vulnerabilidades dentro do codigo.
- A explicacao deve ser curta e tecnica.

Retorne exatamente neste formato:
[LANGUAGE]typescript[/LANGUAGE]
[CODE]
codigo_aqui
[/CODE]
[EXPLANATION]Vulnerable generated system.[/EXPLANATION]`;

  try {
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      return await generateWithOpenAI(prompt, systemPrompt);
    }

    return await generateWithOllama(prompt, systemPrompt);
  } catch (error) {
    if (AI_PROVIDER !== 'openai') {
      console.warn('Ollama indisponivel em http://localhost:11434. Usando fallback local.');
      return generateFallbackResponse(prompt, isSafeMode);
    }

    console.error('Erro ao gerar codigo com IA:', error);
    throw new Error('Erro ao comunicar com servico de IA');
  }
};

/**
 * Gera codigo usando Ollama local.
 */
const generateWithOllama = async (userPrompt: string, systemPrompt: string): Promise<AIResponse> => {
  const fullPrompt = `${systemPrompt}\n\nUsuario: ${userPrompt}`;

  const response = await axios.post(`${AI_BASE_URL}/api/generate`, {
    model: AI_MODEL,
    prompt: fullPrompt,
    stream: false,
    options: {
      temperature: 0.3,
      top_p: 0.9,
      num_predict: AI_MAX_TOKENS,
    },
  }, {
    timeout: AI_REQUEST_TIMEOUT_MS,
  });

  const generatedText = response.data.response || '';
  return parseAIResponse(generatedText);
};

/**
 * Gera codigo usando OpenAI API.
 */
const generateWithOpenAI = async (userPrompt: string, systemPrompt: string): Promise<AIResponse> => {
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: AI_MAX_TOKENS,
  }, {
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
  });

  const generatedText = response.data.choices[0]?.message?.content || '';
  return parseAIResponse(generatedText);
};

const generateFallbackResponse = (userPrompt: string, isSafeMode: boolean): AIResponse => {
  const spec = inferFallbackSpec(userPrompt);

  if (spec.language === 'python') {
    return {
      code: buildPythonFallback(spec, isSafeMode),
      language: spec.language,
      explanation: isSafeMode
        ? 'Secure fallback generated from the user prompt because the AI service is offline.'
        : 'Vulnerable fallback generated from the user prompt because the AI service is offline.',
    };
  }

  return {
    code: buildTypeScriptFallback(spec, isSafeMode),
    language: spec.language,
    explanation: isSafeMode
      ? 'Secure fallback generated from the user prompt because the AI service is offline.'
      : 'Vulnerable fallback generated from the user prompt because the AI service is offline.',
  };
};

interface FallbackSpec {
  appName: string;
  entityName: string;
  entityPlural: string;
  routeBase: string;
  promptSummary: string;
  language: 'typescript' | 'python';
  needsAuth: boolean;
  needsUpload: boolean;
}

const inferFallbackSpec = (userPrompt: string): FallbackSpec => {
  const normalizedPrompt = normalizePrompt(userPrompt);
  const language = normalizedPrompt.includes('python') || normalizedPrompt.includes('flask') ? 'python' : 'typescript';

  const domains = [
    { match: ['loja', 'ecommerce', 'e-commerce', 'produto', 'carrinho'], appName: 'StoreApi', entityName: 'product', entityPlural: 'products', routeBase: 'products' },
    { match: ['tarefa', 'todo', 'kanban'], appName: 'TaskApi', entityName: 'task', entityPlural: 'tasks', routeBase: 'tasks' },
    { match: ['blog', 'post', 'noticia', 'artigo'], appName: 'BlogApi', entityName: 'post', entityPlural: 'posts', routeBase: 'posts' },
    { match: ['clinica', 'consulta', 'paciente', 'medico'], appName: 'ClinicApi', entityName: 'appointment', entityPlural: 'appointments', routeBase: 'appointments' },
    { match: ['financeiro', 'financa', 'pagamento', 'transacao'], appName: 'FinanceApi', entityName: 'transaction', entityPlural: 'transactions', routeBase: 'transactions' },
    { match: ['curso', 'aula', 'aluno', 'escola'], appName: 'CourseApi', entityName: 'course', entityPlural: 'courses', routeBase: 'courses' },
  ];

  const domain = domains.find((candidate) => candidate.match.some((term) => normalizedPrompt.includes(term))) ?? {
    appName: 'CustomApi',
    entityName: 'item',
    entityPlural: 'items',
    routeBase: 'items',
  };

  return {
    ...domain,
    promptSummary: sanitizeComment(userPrompt),
    language,
    needsAuth: /login|jwt|auth|usuario|usu[aá]rio|admin|senha|cadastro/i.test(userPrompt),
    needsUpload: /upload|arquivo|imagem|foto|documento/i.test(userPrompt),
  };
};

const normalizePrompt = (value: string): string => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

const sanitizeComment = (value: string): string => {
  return value.replace(/\*\//g, '').replace(/\r?\n/g, ' ').trim().slice(0, 180) || 'Custom system requested by the user.';
};

const buildTypeScriptFallback = (spec: FallbackSpec, isSafeMode: boolean): string => {
  return isSafeMode ? buildSafeTypeScriptFallback(spec) : buildVulnerableTypeScriptFallback(spec);
};

const buildSafeTypeScriptFallback = (spec: FallbackSpec): string => {
  const authRoutes = spec.needsAuth
    ? `
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(12) });

app.post('/auth/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.findUserByEmail(input.email);
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  return res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});
`
    : '';
  const uploadRoute = spec.needsUpload
    ? `
app.post('/${spec.routeBase}/:id/files', requireAuth, upload.single('file'), (req, res) => {
  return res.status(201).json({ fileId: req.file?.filename, ${spec.entityName}Id: req.params.id });
});
`
    : '';

  return `// Prompt: ${spec.promptSummary}
// file: src/server.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { z } from 'zod';
import { db } from './db';
import { requireAuth, requireRole } from './middleware/auth';

const app = express();
const ${spec.entityName}Schema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(1000).optional(),
});
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg', 'application/pdf'].includes(file.mimetype)),
});

app.use(express.json());
${authRoutes}
app.get('/${spec.routeBase}', requireAuth, async (req, res) => {
  const items = await db.list${capitalize(spec.entityPlural)}({ ownerId: req.user.id });
  return res.json(items);
});

app.post('/${spec.routeBase}', requireAuth, async (req, res) => {
  const input = ${spec.entityName}Schema.parse(req.body);
  const created = await db.create${capitalize(spec.entityName)}({ ...input, ownerId: req.user.id });
  return res.status(201).json(created);
});

app.delete('/admin/${spec.routeBase}/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.delete${capitalize(spec.entityName)}(req.params.id);
  return res.status(204).send();
});
${uploadRoute}
app.listen(3000);

// file: src/middleware/auth.ts
export const requireAuth = (req, res, next) => {
  req.user = { id: 'user_1', role: 'admin' };
  return next();
};
export const requireRole = (role: string) => (req, res, next) => req.user?.role === role ? next() : res.sendStatus(403);

// file: src/db.ts
export const db = {
  async findUserByEmail(email: string) {
    return { id: 'user_1', email, passwordHash: '$2b$12$validHash', role: 'admin' };
  },
  async list${capitalize(spec.entityPlural)}(filter: { ownerId: string }) {
    return [{ id: '${spec.entityName}_1', title: '${capitalize(spec.entityName)} demo', ownerId: filter.ownerId }];
  },
  async create${capitalize(spec.entityName)}(input: unknown) {
    return { id: '${spec.entityName}_2', ...input };
  },
  async delete${capitalize(spec.entityName)}(id: string) {
    return { id };
  },
};`;
};

const buildVulnerableTypeScriptFallback = (spec: FallbackSpec): string => {
  const authRoutes = spec.needsAuth
    ? `
const JWT_SECRET = 'secret123';

app.post('/auth/login', async (req, res) => {
  const sql = "SELECT * FROM users WHERE email = '" + req.body.email + "' AND password = '" + req.body.password + "'";
  const users = await db.query(sql);
  const user = users[0];
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '365d' });
  return res.json({ token, user });
});
`
    : '';
  const uploadRoute = spec.needsUpload
    ? `
app.post('/${spec.routeBase}/:id/files', upload.single('file'), (req, res) => {
  return res.json({ file: req.file, ${spec.entityName}Id: req.params.id });
});
`
    : '';

  return `// Prompt: ${spec.promptSummary}
// file: src/server.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { db } from './db';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
${authRoutes}
app.get('/${spec.routeBase}/search', async (req, res) => {
  const sql = "SELECT * FROM ${spec.entityPlural} WHERE title LIKE '%" + req.query.q + "%'";
  const rows = await db.query(sql);
  return res.json(rows);
});

app.post('/${spec.routeBase}', async (req, res) => {
  const sql = "INSERT INTO ${spec.entityPlural} (title, description) VALUES ('" + req.body.title + "', '" + req.body.description + "')";
  await db.query(sql);
  return res.json({ ok: true, input: req.body });
});

app.post('/admin/${spec.routeBase}/:id/delete', async (req, res) => {
  await db.query("DELETE FROM ${spec.entityPlural} WHERE id = " + req.params.id);
  return res.json({ ok: true });
});
${uploadRoute}
app.listen(3000);

// file: src/db.ts
export const db = {
  async query(sql: string) {
    return [{ id: 1, title: '${capitalize(spec.entityName)} demo', sql }];
  },
};

// file: public/${spec.routeBase}.html
<div id="${spec.entityName}"></div>
<script>
  const params = new URLSearchParams(location.search);
  document.getElementById('${spec.entityName}').innerHTML = params.get('title');
</script>`;
};

const buildPythonFallback = (spec: FallbackSpec, isSafeMode: boolean): string => {
  return isSafeMode ? buildSafePythonFallback(spec) : buildVulnerablePythonFallback(spec);
};

const buildVulnerablePythonFallback = (spec: FallbackSpec): string => {
  const authRoutes = spec.needsAuth
    ? `
JWT_SECRET = "secret123"

@app.post("/auth/login")
def login():
    email = request.json["email"]
    password = request.json["password"]
    sql = "SELECT * FROM users WHERE email = '%s' AND password = '%s'" % (email, password)
    user = query(sql)[0]
    token = jwt.encode({"id": user["id"], "role": user["role"]}, JWT_SECRET, algorithm="HS256")
    return jsonify({"token": token, "user": user})
`
    : '';

  return `# Prompt: ${spec.promptSummary}
# file: app.py
import os
import jwt
import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)
${authRoutes}
@app.get("/${spec.routeBase}/search")
def search_${spec.routeBase}():
    sql = "SELECT * FROM ${spec.entityPlural} WHERE title LIKE '%%%s%%'" % request.args.get("q", "")
    return jsonify(query(sql))

@app.post("/${spec.routeBase}")
def create_${spec.entityName}():
    payload = request.json
    sql = "INSERT INTO ${spec.entityPlural} (title, description) VALUES ('%s', '%s')" % (payload["title"], payload.get("description", ""))
    query(sql)
    return jsonify({"ok": True, "input": payload})

@app.post("/run")
def run_command():
    os.system(request.json["cmd"])
    return jsonify({"ok": True})

def query(sql):
    conn = sqlite3.connect("app.db")
    return [{"id": 1, "title": "${capitalize(spec.entityName)} demo", "sql": sql}]`;
};

const buildSafePythonFallback = (spec: FallbackSpec): string => {
  const authRoutes = spec.needsAuth
    ? `
@app.post("/auth/login")
def login():
    payload = request.get_json()
    email = payload.get("email", "")
    password = payload.get("password", "")
    if "@" not in email or len(password) < 12:
        return jsonify({"error": "invalid_input"}), 400
    user = query_one("SELECT id, email, password_hash, role FROM users WHERE email = ?", (email,))
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "invalid_credentials"}), 401
    token = jwt.encode({"sub": user["id"], "role": user["role"]}, os.environ["JWT_SECRET"], algorithm="HS256")
    return jsonify({"token": token, "user": {"id": user["id"], "email": user["email"], "role": user["role"]}})
`
    : '';

  return `# Prompt: ${spec.promptSummary}
# file: app.py
import os
import jwt
import sqlite3
import subprocess
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash

app = Flask(__name__)
${authRoutes}
@app.get("/${spec.routeBase}")
def list_${spec.routeBase}():
    owner_id = require_user()["id"]
    rows = query_all("SELECT id, title, description FROM ${spec.entityPlural} WHERE owner_id = ?", (owner_id,))
    return jsonify(rows)

@app.post("/${spec.routeBase}")
def create_${spec.entityName}():
    user = require_user()
    payload = request.get_json()
    title = payload.get("title", "").strip()
    if len(title) < 3:
        return jsonify({"error": "invalid_title"}), 400
    query_one(
        "INSERT INTO ${spec.entityPlural} (title, description, owner_id) VALUES (?, ?, ?)",
        (title, payload.get("description", ""), user["id"]),
    )
    return jsonify({"ok": True}), 201

@app.post("/run")
def run_command():
    command = request.json.get("cmd")
    if command not in ["status"]:
        return jsonify({"error": "forbidden"}), 403
    subprocess.run(["systemctl", "status", "app"], shell=False, check=True)
    return jsonify({"ok": True})

def require_user():
    return {"id": "user_1", "role": "admin"}

def query_all(sql, params):
    conn = sqlite3.connect("app.db")
    return [{"id": "${spec.entityName}_1", "title": "${capitalize(spec.entityName)} demo", "params": list(params)}]

def query_one(sql, params):
    return {"id": "user_1", "email": params[0] if params else "admin@example.com", "password_hash": "valid_hash", "role": "admin"}`;
};

const capitalize = (value: string): string => {
  return value.charAt(0).toUpperCase() + value.slice(1);
};

/**
 * Parse da resposta da IA.
 */
const parseAIResponse = (text: string): AIResponse => {
  const languageMatch = text.match(/\[LANGUAGE\]([a-zA-Z0-9_+-]+)\[\/LANGUAGE\]/i);
  const language = languageMatch ? languageMatch[1].toLowerCase() : 'javascript';

  const codeMatch = text.match(/\[CODE\]([\s\S]*?)\[\/CODE\]/i);
  const legacyCodeMatch = text.match(/\[LANGUAGE\]([\s\S]*?)\[\/LANGUAGE\]/i);
  const code = codeMatch
    ? codeMatch[1].trim()
    : legacyCodeMatch && !languageMatch
      ? legacyCodeMatch[1].trim()
      : text.trim();

  const explanationMatch = text.match(/\[EXPLANATION\]([\s\S]*?)\[\/EXPLANATION\]/i);
  const explanation = explanationMatch ? explanationMatch[1].trim() : '';

  return {
    code,
    language,
    explanation,
  };
};

/**
 * Verifica se o servico de IA esta disponivel.
 */
export const checkAIServiceHealth = async (): Promise<boolean> => {
  try {
    if (AI_PROVIDER === 'openai') {
      return !!OPENAI_API_KEY;
    }

    const response = await axios.get(`${AI_BASE_URL}/api/tags`, {
      timeout: 5000,
    });
    return response.status === 200;
  } catch {
    return false;
  }
};
