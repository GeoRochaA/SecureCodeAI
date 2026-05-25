import axios from 'axios';

export interface AIResponse {
  code: string;
  language: string;
  explanation: string;
}

const AI_PROVIDER = process.env.AI_PROVIDER || 'ollama';
const AI_MODEL = process.env.AI_MODEL || 'llama3';
const AI_BASE_URL = process.env.AI_BASE_URL || 'http://localhost:11434';
const AI_REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS || 300000);
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 900);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

/**
 * Gera codigo usando IA (Ollama ou OpenAI).
 */
export const generateCodeWithAI = async (
  prompt: string,
  isSafeMode: boolean = true
): Promise<AIResponse> => {
  const systemPrompt = isSafeMode
    ? `Voce e um assistente de programacao experiente focado em SEGURANCA. Sempre gere respostas completas e consistentes. Ao produzir codigo, inclua:
- Validacao de entrada de usuario
- Sanitizacao de dados
- Protecao contra SQL Injection e XSS
- Autenticacao segura e gerenciamento de sessao
- Truques como prepared statements e escapes de HTML
- Nenhum segredo hardcoded
- Comentarios de seguranca quando apropriado

Retorne no formato:
[LANGUAGE]javascript[/LANGUAGE]
[CODE]
codigo_aqui
[/CODE]
[EXPLANATION]explicacao_aqui[/EXPLANATION]`
    : `Voce e um assistente de programacao. Gere codigo completo e funcional com base no prompt do usuario. Use comentarios apenas quando necessarios. Retorne no formato:
[LANGUAGE]javascript[/LANGUAGE]
[CODE]
codigo_aqui
[/CODE]
[EXPLANATION]explicacao_aqui[/EXPLANATION]`;

  try {
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      return await generateWithOpenAI(prompt, systemPrompt);
    }

    return await generateWithOllama(prompt, systemPrompt);
  } catch (error) {
    console.error('Erro ao gerar codigo com IA:', error);

    if (AI_PROVIDER !== 'openai') {
      console.warn('Ollama indisponivel. Usando fallback local para manter a demo funcionando.');
      return generateFallbackResponse(prompt, isSafeMode);
    }

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
      temperature: 0.7,
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
    max_tokens: 2000,
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
  const wantsLogin = /login|auth|autentic|senha|usuario|user/.test(normalizedPrompt);
  const language = normalizedPrompt.includes('python') ? 'python' : 'javascript';

  if (language === 'python') {
    const code = wantsLogin
      ? `from werkzeug.security import generate_password_hash, check_password_hash

users = {}

def create_user(username: str, password: str) -> None:
    if not username or not password:
        raise ValueError("Username and password are required")
    users[username] = generate_password_hash(password)

def login(username: str, password: str) -> bool:
    password_hash = users.get(username)
    if not password_hash:
        return False
    return check_password_hash(password_hash, password)`
      : `def handle_request(value: str) -> dict:
    if not value or len(value) > 500:
        raise ValueError("Invalid input")

    safe_value = value.strip()
    return {"result": safe_value}`;

    return {
      code,
      language,
      explanation: `Fallback local usado porque o Ollama nao respondeu. O exemplo inclui validacao basica${isSafeMode ? ' e evita segredos hardcoded.' : '.'}`,
    };
  }

  const code = wantsLogin
    ? `import bcrypt from 'bcrypt';

const users = new Map();

export async function createUser(username, password) {
  if (!username || !password) {
    throw new Error('Username and password are required');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  users.set(username, { username, passwordHash });
}

export async function login(username, password) {
  const user = users.get(username);
  if (!user) return false;

  return bcrypt.compare(password, user.passwordHash);
}`
    : `export function handleRequest(input) {
  if (typeof input !== 'string' || input.length > 500) {
    throw new Error('Invalid input');
  }

  const safeInput = input.trim();
  return { result: safeInput };
}`;

  return {
    code,
    language,
    explanation: `Fallback local usado porque o Ollama nao respondeu. O exemplo inclui validacao basica${isSafeMode ? ' e evita padroes inseguros comuns.' : '.'}`,
  };
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
  const explanation = explanationMatch ? explanationMatch[1].trim() : 'Código gerado sem explicação detalhada.';

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
