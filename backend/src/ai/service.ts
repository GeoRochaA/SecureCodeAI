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
  const normalizedPrompt = userPrompt.toLowerCase();
  const language = normalizedPrompt.includes('python') ? 'python' : 'javascript';

  if (language === 'python') {
    return {
      code: isSafeMode ? safePythonFallback : vulnerablePythonFallback,
      language,
      explanation: isSafeMode ? 'Secure fallback system.' : 'Vulnerable fallback system.',
    };
  }

  return {
    code: isSafeMode ? safeTypeScriptFallback : vulnerableTypeScriptFallback,
    language,
    explanation: isSafeMode ? 'Secure fallback system.' : 'Vulnerable fallback system.',
  };
};

const vulnerableTypeScriptFallback = `// file: src/server.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { db } from './db';

const app = express();
const upload = multer({ dest: 'uploads/' });
const JWT_SECRET = 'secret123';

app.use(express.json());

app.post('/login', async (req, res) => {
  const sql = "SELECT * FROM users WHERE email = '" + req.body.email + "' AND password = '" + req.body.password + "'";
  const users = await db.query(sql);
  const user = users[0];
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '365d' });
  res.json({ token, user });
});

app.post('/admin/users/:id/delete', async (req, res) => {
  await db.query(\`DELETE FROM users WHERE id = \${req.params.id}\`);
  res.json({ ok: true });
});

app.post('/upload', upload.single('file'), (req, res) => {
  res.json({ file: req.file });
});

app.listen(3000);

// file: src/db.ts
export const db = {
  async query(sql: string) {
    return [{ id: 1, email: 'admin@example.com', password: 'admin123', role: 'admin', sql }];
  },
};

// file: public/profile.html
<div id="profile"></div>
<script>
  const params = new URLSearchParams(location.search);
  document.getElementById('profile').innerHTML = params.get('name');
</script>`;

const safeTypeScriptFallback = `// file: src/server.ts
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import multer from 'multer';
import { z } from 'zod';
import { db } from './db';
import { requireAuth, requireRole } from './middleware/auth';

const app = express();
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/png', 'image/jpeg'].includes(file.mimetype)),
});

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(12) });

app.use(express.json());

app.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await db.getUserByEmail(input.email);
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }
  const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '15m' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});

app.delete('/admin/users/:id', requireAuth, requireRole('admin'), async (req, res) => {
  await db.deleteUser(req.params.id);
  res.status(204).send();
});

app.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  res.json({ fileId: req.file?.filename });
});

app.listen(3000);

// file: src/middleware/auth.ts
export const requireAuth = (req, res, next) => next();
export const requireRole = (role: string) => (req, res, next) => req.user?.role === role ? next() : res.sendStatus(403);

// file: src/db.ts
export const db = {
  async getUserByEmail(email: string) {
    return { id: '1', email, passwordHash: '$2b$12$validHash', role: 'admin' };
  },
  async deleteUser(id: string) {
    return { id };
  },
};`;

const vulnerablePythonFallback = `# file: app.py
import os
import jwt
import sqlite3
from flask import Flask, request, jsonify

app = Flask(__name__)
JWT_SECRET = "secret123"

@app.post("/login")
def login():
    email = request.json["email"]
    password = request.json["password"]
    conn = sqlite3.connect("app.db")
    sql = "SELECT * FROM users WHERE email = '%s' AND password = '%s'" % (email, password)
    user = conn.execute(sql).fetchone()
    token = jwt.encode({"id": user[0], "role": user[3]}, JWT_SECRET, algorithm="HS256")
    return jsonify({"token": token, "user": user})

@app.post("/run")
def run_command():
    os.system(request.json["cmd"])
    return jsonify({"ok": True})`;

const safePythonFallback = `# file: app.py
import os
import jwt
import sqlite3
import subprocess
from flask import Flask, request, jsonify
from werkzeug.security import check_password_hash

app = Flask(__name__)

@app.post("/login")
def login():
    payload = request.get_json()
    email = payload.get("email", "")
    password = payload.get("password", "")
    if "@" not in email or len(password) < 12:
      return jsonify({"error": "invalid_input"}), 400
    conn = sqlite3.connect("app.db")
    user = conn.execute("SELECT id, email, password_hash, role FROM users WHERE email = ?", (email,)).fetchone()
    if not user or not check_password_hash(user[2], password):
      return jsonify({"error": "invalid_credentials"}), 401
    token = jwt.encode({"sub": user[0], "role": user[3]}, os.environ["JWT_SECRET"], algorithm="HS256")
    return jsonify({"token": token, "user": {"id": user[0], "email": user[1], "role": user[3]}})

@app.post("/run")
def run_command():
    command = request.json.get("cmd")
    if command not in ["status"]:
      return jsonify({"error": "forbidden"}), 403
    subprocess.run(["systemctl", "status", "app"], shell=False, check=True)
    return jsonify({"ok": True})`;

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
