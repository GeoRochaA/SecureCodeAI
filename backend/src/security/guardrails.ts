import { v4 as uuidv4 } from 'uuid';
import { run, query } from '../database/init.js';

export interface SecurityAnalysis {
  promptId: string;
  isInjectionDetected: boolean;
  injectionType?: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  details: string[];
}

export interface CodeVulnerability {
  type: string;
  description: string;
  owaspCategory: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  fileName?: string;
  lineNumber?: number;
  recommendation?: string;
  vulnerableSnippet?: string;
  fixedSnippet?: string;
}

export interface CodeAnalysisResult {
  isVulnerable: boolean;
  vulnerabilities: CodeVulnerability[];
  riskScore: number;
}

type DetectedLanguage = 'javascript' | 'typescript' | 'php' | 'python' | 'sql' | 'html';

interface SourceFile {
  name: string;
  code: string;
  language: DetectedLanguage;
}

interface VulnerabilityRule {
  pattern: RegExp;
  type: string;
  description: string;
  owasp: string;
  severity: CodeVulnerability['severity'];
  recommendation: string;
  languages?: DetectedLanguage[];
  shouldFlag?: (source: string, match: RegExpMatchArray) => boolean;
}

const INJECTION_PATTERNS = [
  { pattern: /ignore\s+previous\s+instructions/i, type: 'Instruction Override' },
  { pattern: /reveal\s+(?:system\s+)?prompt/i, type: 'System Prompt Disclosure' },
  { pattern: /act\s+as\s+(?:administrator|admin|root)/i, type: 'Privilege Escalation' },
  { pattern: /show\s+(?:hidden|secret|system)\s+config/i, type: 'Configuration Disclosure' },
  { pattern: /forget\s+(?:your\s+)?instructions/i, type: 'Instruction Override' },
  { pattern: /bypass\s+security|security\s+bypass/i, type: 'Security Bypass' },
  { pattern: /execute\s+(?:shell|system)\s+command/i, type: 'Command Execution Request' },
  { pattern: /create\s+(?:backdoor|malware|virus)/i, type: 'Malware Request' },
];

const LEGITIMATE_SECURITY_TERMS = /\b(?:jwt|csrf|xss|sql injection|sqli|auth|authentication|authorization|upload|middleware|owasp|vulnerability|vulnerable|secure)\b/i;

const FILE_HEADER_PATTERN = /(?:^|\n)\s*(?:\/\/|#|--|<!--)\s*(?:file|arquivo|path):\s*([^\n>-]+)\s*(?:-->)?/gi;

const detectLanguage = (source: string, fileName = ''): DetectedLanguage => {
  const name = fileName.toLowerCase();
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'typescript';
  if (name.endsWith('.php')) return 'php';
  if (name.endsWith('.py')) return 'python';
  if (name.endsWith('.sql')) return 'sql';
  if (name.endsWith('.html') || name.endsWith('.htm')) return 'html';
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'javascript';

  if (/<\?php|mysqli_|PDO|\$_(?:GET|POST|REQUEST|FILES|SESSION)/i.test(source)) return 'php';
  if (/from\s+\w+\s+import|def\s+\w+\(|Flask\(|Django|cursor\.execute|subprocess|os\.system/i.test(source)) return 'python';
  if (/\b(interface|type)\s+\w+|:\s*(?:string|number|boolean)\b|as\s+\w+/i.test(source)) return 'typescript';
  if (/<(?:html|script|form|input|div|span)\b|innerHTML|document\./i.test(source)) return 'html';
  if (/\bSELECT\b[\s\S]+\bFROM\b|\bINSERT\s+INTO\b|\bUPDATE\b[\s\S]+\bSET\b/i.test(source)) return 'sql';
  return 'javascript';
};

const splitSourceFiles = (code: string): SourceFile[] => {
  const matches = [...code.matchAll(FILE_HEADER_PATTERN)];
  if (matches.length === 0) {
    return [{ name: 'input', code, language: detectLanguage(code) }];
  }

  return matches
    .map((match, index) => {
      const next = matches[index + 1];
      const start = (match.index || 0) + match[0].length;
      const end = next?.index ?? code.length;
      const name = match[1].trim();
      const fileCode = code.slice(start, end).trim();
      return { name, code: fileCode, language: detectLanguage(fileCode, name) };
    })
    .filter((file) => file.code.length > 0);
};

const lineNumberForIndex = (source: string, index: number): number => {
  return source.slice(0, index).split('\n').length;
};

const getContext = (source: string, index: number, radius = 450): string => {
  return source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius));
};

const hasPreparedStatement = (context: string): boolean => {
  return /\?\s*[,)]|execute\s*\([^)]*,\s*\[|query\s*\([^)]*,\s*\[|prepare\s*\(|bind_param\s*\(|cursor\.execute\s*\([^)]*,\s*\(/i.test(context);
};

const hasValidation = (context: string): boolean => {
  return /\b(?:zod|joi|yup|validator|sanitize|escape|schema|parse|safeParse|validate|validation|checkSchema|body\s*\(|param\s*\(|query\s*\()\b/i.test(context);
};

const hasUploadValidation = (context: string): boolean => {
  return /fileFilter\s*:|limits\s*:|fileSize\s*:|mimetype|mime|allowedTypes|allowedMime|extension|extname/i.test(context);
};

const hasAuthMiddleware = (routeCall: string): boolean => {
  return /requireAuth|authenticate|authorize|requireRole|isAdmin|verifyToken|authMiddleware|passport\.authenticate/i.test(routeCall);
};

const isPublicAuthRoute = (routeCall: string): boolean => {
  return /['"`][^'"`]*(?:login|register|signup|refresh|logout|forgot-password|reset-password)[^'"`]*['"`]/i.test(routeCall);
};

const getRouteCall = (source: string, index: number): string => {
  const end = source.indexOf('\n', index);
  return source.slice(index, end === -1 ? Math.min(source.length, index + 320) : Math.min(source.length, end + 320));
};

const cleanSnippet = (snippet: string): string => {
  return snippet
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join('\n');
};

const buildFixedSnippet = (type: string, vulnerableSnippet: string): string => {
  const fallback = 'Aplicar validacao, controle de acesso e sanitizacao conforme o contexto.';
  const examples: Record<string, string> = {
    'SQL Injection': 'SELECT * FROM users WHERE id = ?',
    'Reflected XSS': 'element.textContent = safeValue',
    'Unsafe Code Execution': 'Use operacoes permitidas por whitelist',
    'Hardcoded Credential': 'const secret = process.env.SECRET',
    'Unsafe JWT Secret': 'jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" })',
    'Missing CSRF Protection': 'app.use(csrfProtection)',
    'Missing Authorization': 'app.delete("/admin/users/:id", requireAuth, requireRole("admin"), handler)',
    'Unsafe File Upload': 'multer({ limits, fileFilter, storage: safeStorage })',
    'Sensitive Data Exposure': 'res.json({ id: user.id, email: user.email, role: user.role })',
    'Weak Password Hashing': 'bcrypt.hash(password, 12)',
    'Missing Input Validation': 'const input = schema.parse(req.body)',
  };

  if (type === 'Reflected XSS' && vulnerableSnippet.includes('innerHTML')) {
    return cleanSnippet(vulnerableSnippet.replace(/innerHTML/g, 'textContent'));
  }

  return examples[type] || fallback;
};

const VULNERABILITY_RULES: VulnerabilityRule[] = [
  {
    pattern: /\b(?:query|execute|raw|mysql_query|mysqli_query)\s*\([^)]*(?:\+|\$\{|%|format\s*\()/gi,
    type: 'SQL Injection',
    description: 'Dynamic SQL query uses untrusted input.',
    owasp: 'OWASP A03: Injection',
    severity: 'high',
    recommendation: 'Use prepared statements and parameter binding.',
    shouldFlag: (source, match) => !hasPreparedStatement(getContext(source, match.index || 0)),
  },
  {
    pattern: /\bSELECT\b[\s\S]{0,160}\bWHERE\b[\s\S]{0,120}(?:\$\{|'.*\+|\+.*'|%s|%\(.*\)s)/gi,
    type: 'SQL Injection',
    description: 'SQL statement is built with string interpolation.',
    owasp: 'OWASP A03: Injection',
    severity: 'high',
    recommendation: 'Replace string concatenation with bound parameters.',
    shouldFlag: (source, match) => !hasPreparedStatement(getContext(source, match.index || 0)),
  },
  {
    pattern: /\.innerHTML\s*(?:=|\+=)|dangerouslySetInnerHTML|document\.write\s*\(/gi,
    type: 'Reflected XSS',
    description: 'Unsafe HTML sink receives dynamic content.',
    owasp: 'OWASP A03: Injection',
    severity: 'high',
    recommendation: 'Use textContent or sanitize HTML with a trusted allowlist.',
  },
  {
    pattern: /\b(?:eval|Function|exec)\s*\(|os\.system\s*\(|subprocess\.(?:call|Popen|run)\s*\([^)]*shell\s*=\s*True/gi,
    type: 'Unsafe Code Execution',
    description: 'Runtime code or shell execution is exposed.',
    owasp: 'OWASP A03: Injection',
    severity: 'critical',
    recommendation: 'Remove dynamic execution and use explicit allowlisted operations.',
  },
  {
    pattern: /\b(?:password|passwd|pwd|secret|api[_-]?key|token|jwt[_-]?secret|private[_-]?key)\b\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    type: 'Hardcoded Credential',
    description: 'Secret value is embedded in source code.',
    owasp: 'OWASP A02: Cryptographic Failures',
    severity: 'critical',
    recommendation: 'Move secrets to environment variables or a secrets manager.',
    shouldFlag: (_source, match) => !/process\.env|import\.meta\.env|Deno\.env|getenv|os\.environ/i.test(match[0]),
  },
  {
    pattern: /jwt\.sign\s*\([^)]*,\s*['"][^'"]{1,16}['"]|algorithm\s*:\s*['"]none['"]|expiresIn\s*:\s*['"]?(?:365d|999d|never)/gi,
    type: 'Unsafe JWT Secret',
    description: 'JWT uses weak secret, unsafe algorithm, or excessive lifetime.',
    owasp: 'OWASP A07: Identification and Authentication Failures',
    severity: 'high',
    recommendation: 'Use a strong environment-backed secret, approved algorithm, and short expiry.',
    shouldFlag: (source, match) => {
      const context = getContext(source, match.index || 0);
      return !/process\.env|import\.meta\.env|Deno\.env|getenv|os\.environ/i.test(context);
    },
  },
  {
    pattern: /csrf\s*:\s*false|app\.use\s*\([^)]*cookieParser[^)]*\)(?![\s\S]{0,300}csrf)/gi,
    type: 'Missing CSRF Protection',
    description: 'State-changing web flow lacks CSRF protection.',
    owasp: 'OWASP A01: Broken Access Control',
    severity: 'medium',
    recommendation: 'Enable CSRF tokens for cookie-based sessions.',
  },
  {
    pattern: /app\.(?:post|put|patch|delete)\s*\([^)]*,\s*(?:async\s*)?\([^)]*\)\s*=>/gi,
    type: 'Missing Authorization',
    description: 'State-changing route has no visible authorization middleware.',
    owasp: 'OWASP A01: Broken Access Control',
    severity: 'medium',
    recommendation: 'Require authentication and resource-level authorization middleware.',
    languages: ['javascript', 'typescript'],
    shouldFlag: (source, match) => {
      const routeCall = getRouteCall(source, match.index || 0);
      return !isPublicAuthRoute(routeCall) && !hasAuthMiddleware(routeCall);
    },
  },
  {
    pattern: /multer\s*\(\s*\{|upload\.single\s*\(|\$_FILES|move_uploaded_file/gi,
    type: 'Unsafe File Upload',
    description: 'Upload handling lacks explicit type, size, or storage validation.',
    owasp: 'OWASP A05: Security Misconfiguration',
    severity: 'high',
    recommendation: 'Validate MIME, extension, size, storage path, and scan uploaded files.',
    shouldFlag: (source, match) => {
      const context = getContext(source, match.index || 0, 700);
      return !hasUploadValidation(context) && !hasUploadValidation(source);
    },
  },
  {
    pattern: /res\.json\s*\(\s*(?:user|users|req\.user)|SELECT\s+\*\s+FROM\s+users|return\s+jsonify\s*\(\s*user/gi,
    type: 'Sensitive Data Exposure',
    description: 'User object or broad query may expose sensitive fields.',
    owasp: 'OWASP A02: Cryptographic Failures',
    severity: 'medium',
    recommendation: 'Return explicit fields and exclude password hashes, tokens, and secrets.',
  },
  {
    pattern: /bcrypt\.hash\s*\([^)]*,\s*[0-7]\)|md5\s*\(|sha1\s*\(|createHash\s*\(\s*['"](?:md5|sha1)['"]\s*\)/gi,
    type: 'Weak Password Hashing',
    description: 'Password hashing uses weak algorithm or low work factor.',
    owasp: 'OWASP A02: Cryptographic Failures',
    severity: 'high',
    recommendation: 'Use bcrypt or Argon2 with an adequate work factor.',
  },
  {
    pattern: /req\.(?:body|query|params)(?![\s\S]{0,240}(?:zod|joi|yup|validator|sanitize|escape|schema|validate))/gi,
    type: 'Missing Input Validation',
    description: 'Request input is consumed without nearby validation.',
    owasp: 'OWASP A04: Insecure Design',
    severity: 'medium',
    recommendation: 'Validate and normalize all request fields at the boundary.',
    languages: ['javascript', 'typescript'],
    shouldFlag: (source, match) => !hasValidation(getContext(source, match.index || 0, 700)),
  },
  {
    pattern: /\$_(?:GET|POST|REQUEST)(?![\s\S]{0,160}(?:filter_input|htmlspecialchars|sanitize|intval|prepare))/gi,
    type: 'Missing Input Validation',
    description: 'PHP superglobal is used without validation or sanitization.',
    owasp: 'OWASP A04: Insecure Design',
    severity: 'medium',
    recommendation: 'Use filter_input, prepared statements, and contextual output escaping.',
    languages: ['php'],
    shouldFlag: (source, match) => !hasValidation(getContext(source, match.index || 0, 500)) && !/filter_input|htmlspecialchars|sanitize|intval|prepare/i.test(getContext(source, match.index || 0, 500)),
  },
];

export const analyzePromptSecurity = async (prompt: string): Promise<SecurityAnalysis> => {
  const details: string[] = [];
  let injectionType: string | undefined;
  let riskLevel: SecurityAnalysis['riskLevel'] = 'low';
  const isSecurityAuditRequest = LEGITIMATE_SECURITY_TERMS.test(prompt);

  for (const { pattern, type } of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      injectionType = type;
      details.push(type);
      riskLevel = 'critical';
      break;
    }
  }

  if (prompt.length > 5000) {
    details.push('Oversized Prompt');
    if (riskLevel === 'low') riskLevel = 'medium';
  }

  const suspiciousKeywords = ['backdoor', 'malware', 'bypass', 'ignore', 'reveal'];
  const suspiciousCount = suspiciousKeywords.filter((keyword) => new RegExp(keyword, 'i').test(prompt)).length;
  if (suspiciousCount >= 2 && riskLevel === 'low' && !isSecurityAuditRequest) {
    details.push('Suspicious Prompt Tokens');
    riskLevel = 'medium';
  }

  const promptId = uuidv4();
  await run(
    `INSERT INTO prompts (id, user_input, risk_level, is_injection_detected, injection_type)
     VALUES (?, ?, ?, ?, ?)`,
    [promptId, prompt, riskLevel, injectionType ? 1 : 0, injectionType ?? null]
  );

  return {
    promptId,
    isInjectionDetected: !!injectionType,
    injectionType,
    riskLevel,
    details,
  };
};

export const analyzeCodeSecurity = async (code: string, language?: string): Promise<CodeAnalysisResult> => {
  const vulnerabilities: CodeVulnerability[] = [];
  let riskScore = 0;
  const files = splitSourceFiles(code);

  for (const file of files) {
    const effectiveLanguage = language ? detectLanguage(file.code, `input.${language}`) : file.language;

    for (const rule of VULNERABILITY_RULES) {
      if (rule.languages && !rule.languages.includes(effectiveLanguage)) continue;

      const matches = [...file.code.matchAll(rule.pattern)];
      for (const match of matches) {
        if (rule.shouldFlag && !rule.shouldFlag(file.code, match)) {
          continue;
        }

        vulnerabilities.push({
          type: rule.type,
          description: rule.description,
          owaspCategory: rule.owasp,
          severity: rule.severity,
          fileName: file.name,
          lineNumber: lineNumberForIndex(file.code, match.index || 0),
          recommendation: rule.recommendation,
          vulnerableSnippet: cleanSnippet(match[0]),
          fixedSnippet: buildFixedSnippet(rule.type, match[0]),
        });

        riskScore += rule.severity === 'critical' ? 25 :
          rule.severity === 'high' ? 15 :
          rule.severity === 'medium' ? 8 : 3;
      }
    }
  }

  return {
    isVulnerable: vulnerabilities.length > 0,
    vulnerabilities,
    riskScore: Math.min(riskScore, 100),
  };
};

export const detectCodeLanguage = (code: string): DetectedLanguage => {
  const files = splitSourceFiles(code);
  const counts = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.language] = (acc[file.language] || 0) + file.code.length;
    return acc;
  }, {});

  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as DetectedLanguage) || detectLanguage(code);
};

export const generateSecureCode = (vulnerableCode: string, language?: string): string => {
  const detected = language || detectCodeLanguage(vulnerableCode);
  let secureCode = vulnerableCode;

  if (detected === 'javascript' || detected === 'typescript' || detected === 'html') {
    secureCode = secureCode
      .replace(/\.innerHTML\s*=\s*(.+)/g, '.textContent = $1')
      .replace(/eval\s*\([^)]*\)/g, '/* removed: unsafe dynamic execution */')
      .replace(/jwt\.sign\s*\(([^,]+),\s*['"][^'"]+['"]/g, 'jwt.sign($1, process.env.JWT_SECRET')
      .replace(/bcrypt\.hash\s*\(([^,]+),\s*[0-7]\)/g, 'bcrypt.hash($1, 12)');
  }

  if (detected === 'php') {
    secureCode = secureCode
      .replace(/echo\s+\$_GET\[['"](\w+)['"]\]/g, "echo htmlspecialchars($_GET['$1'], ENT_QUOTES, 'UTF-8')")
      .replace(/mysql_query|mysqli_query/gi, 'prepared_statement_execute');
  }

  if (detected === 'python') {
    secureCode = secureCode
      .replace(/os\.system\s*\((.+)\)/g, 'subprocess.run($1, shell=False, check=True)')
      .replace(/exec\s*\([^)]*\)|eval\s*\([^)]*\)/g, '# removed: unsafe dynamic execution');
  }

  return secureCode;
};

export const logSecurityEvent = async (
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: string,
  details?: unknown,
  ipAddress?: string
): Promise<void> => {
  const id = uuidv4();
  await run(
    `INSERT INTO security_logs (id, event_type, severity, message, ip_address, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, eventType, severity, message, ipAddress || '0.0.0.0', JSON.stringify(details || {})]
  );

  if (eventType === 'injection_detected') {
    await run(`UPDATE statistics SET total_attacks_blocked = total_attacks_blocked + 1 WHERE id = 'stats'`);
  }
};

export const updateStatistics = async (): Promise<void> => {
  const prompts = await query<{ count: number }>('SELECT COUNT(*) as count FROM prompts');
  const vulnerabilities = await query<{ count: number }>('SELECT COUNT(*) as count FROM code_corrections');

  await run(
    `UPDATE statistics SET
     total_prompts = ?,
     total_vulnerabilities_detected = ?,
     last_updated = CURRENT_TIMESTAMP
     WHERE id = 'stats'`,
    [prompts[0]?.count || 0, vulnerabilities[0]?.count || 0]
  );
};
