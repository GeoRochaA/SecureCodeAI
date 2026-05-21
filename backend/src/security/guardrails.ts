import { v4 as uuidv4 } from 'uuid';
import { run, query } from '../database/init.js';

export interface SecurityAnalysis {
  promptId?: string;
  isInjectionDetected: boolean;
  injectionType?: string;
  riskLevel: 'baixo' | 'médio' | 'alto' | 'crítico';
  details: string[];
}

export interface CodeVulnerability {
  type: string;
  description: string;
  owaspCategory: string;
  lineNumber?: number;
  severity: 'baixo' | 'médio' | 'alto' | 'crítico';
}

export interface CodeAnalysisResult {
  isVulnerable: boolean;
  vulnerabilities: CodeVulnerability[];
  riskScore: number;
}

// Padrões de detecção de Prompt Injection
const INJECTION_PATTERNS = [
  { pattern: /ignore\s+previous\s+instructions/i, type: 'ignore_instructions' },
  { pattern: /reveal\s+(?:system\s+)?prompt/i, type: 'reveal_prompt' },
  { pattern: /act\s+as\s+(?:administrator|admin|root)/i, type: 'privilege_escalation' },
  { pattern: /show\s+(?:hidden|secret|system)\s+config/i, type: 'config_disclosure' },
  { pattern: /forget\s+(?:your\s+)?instructions/i, type: 'instruction_override' },
  { pattern: /bypass\s+security|security\s+bypass/i, type: 'security_bypass' },
  { pattern: /execute\s+(?:shell|system)\s+command/i, type: 'command_injection' },
  { pattern: /create\s+(?:backdoor|malware|virus)/i, type: 'malware_request' },
  { pattern: /sql\s+injection|sqli/i, type: 'sql_injection_request' },
  { pattern: /cross[\s-]?site[\s-]?scripting|xss/i, type: 'xss_request' },
  { pattern: /csrf|cross[\s-]?site\s+request\s+forgery/i, type: 'csrf_request' },
  { pattern: /jwt|json\s+web\s+token/i, type: 'jwt_request' },
  { pattern: /session\s+fixation|session\s+hijack/i, type: 'session_attack' },
  { pattern: /unauthorized\s+access|access\s+denied/i, type: 'auth_bypass' },
];

// Padrões de detecção de código vulnerável
const VULNERABILITY_PATTERNS = [
  {
    pattern: /SELECT\s+.*FROM\s+.*WHERE\s+.*['"]?\$\{?(?:id|query|param)[\}']?/gi,
    type: 'SQL_INJECTION',
    description: 'SQL Injection: Concatenação direta de variáveis em queries SQL',
    owasp: 'A03:2021 - Injection',
    severity: 'crítico',
  },
  {
    pattern: /innerHTML\s*=|\.innerHTML\s*\+=/gi,
    type: 'XSS',
    description: 'Cross-Site Scripting (XSS): Uso inseguro de innerHTML',
    owasp: 'A07:2021 - Cross-Site Scripting (XSS)',
    severity: 'crítico',
  },
  {
    pattern: /eval\s*\(|exec\s*\(|Function\s*\(/gi,
    type: 'UNSAFE_CODE_EXECUTION',
    description: 'Execução dinâmica de código: eval, exec ou Function',
    owasp: 'A03:2021 - Injection',
    severity: 'crítico',
  },
  {
    pattern: /(?:const|let|var)\s+(?:password|apikey|secret|token)\s*=\s*['"]/gi,
    type: 'HARDCODED_SECRET',
    description: 'Segredo hardcoded (senha, API key, token, etc)',
    owasp: 'A02:2021 - Cryptographic Failures',
    severity: 'crítico',
  },
  {
    pattern: /require\s*\(\s*['"`]\$\{|require\s*\(\s*['"]\s*\+/gi,
    type: 'UNSAFE_REQUIRE',
    description: 'Require dinâmico: possibilidade de path traversal',
    owasp: 'A01:2021 - Broken Access Control',
    severity: 'alto',
  },
  {
    pattern: /child_process\.exec\s*\(|child_process\.spawn\s*\(/gi,
    type: 'COMMAND_INJECTION',
    description: 'Possível command injection via child_process',
    owasp: 'A03:2021 - Injection',
    severity: 'crítico',
  },
  {
    pattern: /document\.location|window\.location/gi,
    type: 'UNSAFE_REDIRECT',
    description: 'Redirecionamento não validado',
    owasp: 'A04:2021 - Insecure Deserialization',
    severity: 'médio',
  },
  {
    pattern: /fs\.readFileSync\s*\(\s*['"]\//gi,
    type: 'PATH_TRAVERSAL',
    description: 'Path traversal potencial em leitura de arquivos',
    owasp: 'A01:2021 - Broken Access Control',
    severity: 'alto',
  },
];

/**
 * Analisa um prompt de entrada para detectar tentativas de prompt injection
 */
export const analyzePromptSecurity = async (prompt: string): Promise<SecurityAnalysis> => {
  const details: string[] = [];
  let injectionType: string | undefined;
  let riskLevel: 'baixo' | 'médio' | 'alto' | 'crítico' = 'baixo';

  // Verifica padrões de injection
  for (const { pattern, type } of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      injectionType = type;
      details.push(`Padrão de prompt injection detectado: ${type}`);
      riskLevel = 'crítico';
      break;
    }
  }

  // Verifica comprimento suspeito
  if (prompt.length > 5000) {
    details.push('Prompt muito longo (possível obfuscação)');
    if (riskLevel === 'baixo') riskLevel = 'médio';
  }

  // Verifica múltiplas linhas com padrões suspeitos
  const suspiciousKeywords = [
    'admin', 'root', 'backdoor', 'malware', 'hack',
    'bypass', 'ignore', 'forget', 'reveal', 'secret'
  ];
  const suspiciousCount = suspiciousKeywords.filter(
    keyword => new RegExp(keyword, 'i').test(prompt)
  ).length;

  if (suspiciousCount >= 2) {
    details.push(`${suspiciousCount} palavras-chave suspeitas detectadas`);
    if (riskLevel === 'baixo') riskLevel = 'médio';
  }

  // Salvar análise no banco de dados
  const promptId = uuidv4();
  await run(
    `INSERT INTO prompts (id, user_input, risk_level, is_injection_detected, injection_type)
     VALUES (?, ?, ?, ?, ?)`,
    [promptId, prompt, riskLevel, injectionType ? 1 : 0, injectionType]
  );

  return {
    promptId,
    isInjectionDetected: !!injectionType,
    injectionType,
    riskLevel,
    details,
  };
};

/**
 * Analisa código gerado para detectar vulnerabilidades
 */
export const analyzeCodeSecurity = async (code: string, language: string): Promise<CodeAnalysisResult> => {
  const vulnerabilities: CodeVulnerability[] = [];
  let riskScore = 0;

  for (const vuln of VULNERABILITY_PATTERNS) {
    const matches = code.match(vuln.pattern);
    if (matches) {
      for (let i = 0; i < matches.length; i++) {
        const severity = vuln.severity as 'baixo' | 'médio' | 'alto' | 'crítico';
        vulnerabilities.push({
          type: vuln.type,
          description: vuln.description,
          owaspCategory: vuln.owasp,
          severity,
        });

        // Calcular risk score
        riskScore += severity === 'crítico' ? 25 : 
                     severity === 'alto' ? 15 : 
                     severity === 'médio' ? 8 : 3;
      }
    }
  }

  // Verificações adicionais específicas por linguagem
  if (language.toLowerCase() === 'php') {
    if (/\$_GET|\$_POST|\$_REQUEST/.test(code) && !code.includes('htmlspecialchars')) {
      vulnerabilities.push({
        type: 'INPUT_NOT_SANITIZED',
        description: 'Entrada do usuário não sanitizada em PHP',
        owaspCategory: 'A07:2021 - Cross-Site Scripting (XSS)',
        severity: 'alto',
      });
      riskScore += 15;
    }

    if (/mysql_query|mysql_/i.test(code)) {
      vulnerabilities.push({
        type: 'DEPRECATED_MYSQL',
        description: 'Uso de extensão mysql deprecated (usar mysqli ou PDO)',
        owaspCategory: 'A02:2021 - Cryptographic Failures',
        severity: 'médio',
      });
      riskScore += 8;
    }
  }

  if (language.toLowerCase() === 'python') {
    if (/os\.system|subprocess\.call|exec\s*\(|eval\s*\(/.test(code)) {
      vulnerabilities.push({
        type: 'UNSAFE_CODE_EXECUTION',
        description: 'Execução dinâmica de código em Python',
        owaspCategory: 'A03:2021 - Injection',
        severity: 'crítico',
      });
      riskScore += 25;
    }
  }

  // Normalizar risk score para 0-100
  riskScore = Math.min(riskScore, 100);

  return {
    isVulnerable: vulnerabilities.length > 0,
    vulnerabilities,
    riskScore,
  };
};

/**
 * Gera versão segura do código com correções
 */
export const generateSecureCode = (vulnerableCode: string, language: string): string => {
  let secureCode = vulnerableCode;

  if (language.toLowerCase() === 'sql') {
    // SQL: Converter para prepared statements
    secureCode = secureCode.replace(
      /SELECT\s+\*\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*['"]?\$\{?(\w+)[\}']?/gi,
      'SELECT * FROM $1 WHERE $2 = ?\n// Use prepared statements: connection.execute(sql, [param])'
    );
  }

  if (language.toLowerCase() === 'javascript' || language.toLowerCase() === 'typescript') {
    // XSS: Trocar innerHTML por textContent
    secureCode = secureCode.replace(
      /\.innerHTML\s*=\s*(.+)/g,
      '.textContent = $1  // Use textContent em vez de innerHTML'
    );

    // Remover eval
    secureCode = secureCode.replace(
      /eval\s*\(\s*(.+)\s*\)/g,
      '// eval() foi removido por motivos de segurança\n// Considere usar JSON.parse() para JSON seguro'
    );

    // Proteger innerHTML se necessário
    secureCode = secureCode.replace(
      /\.innerHTML\s*=/g,
      '.innerHTML = DOMPurify.sanitize'
    );
  }

  if (language.toLowerCase() === 'php') {
    // XSS: Adicionar htmlspecialchars
    secureCode = secureCode.replace(
      /echo\s+\$_GET\[['"](\w+)['"]\]/g,
      "echo htmlspecialchars($_GET['$1'], ENT_QUOTES, 'UTF-8')"
    );

    // SQL: Converter para prepared statements
    secureCode = secureCode.replace(
      /mysqli_query\s*\(\s*\$link,\s*['"]\s*SELECT.*FROM.*WHERE.*\$['"]/gi,
      '// Use prepared statements:\n$stmt = $link->prepare("SELECT * FROM users WHERE id = ?");\n$stmt->bind_param("i", $id);\n$stmt->execute();'
    );
  }

  if (language.toLowerCase() === 'python') {
    // SQL: Converter para parameterized queries
    secureCode = secureCode.replace(
      /cursor\.execute\s*\(\s*['"]\s*SELECT.*?['"]\s*%\s*\(/gi,
      'cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))  # Use parameterized queries'
    );

    // Command execution: Usar subprocess.run com shell=False
    secureCode = secureCode.replace(
      /os\.system\s*\(\s*(.+)\s*\)/g,
      'subprocess.run($1, shell=False)  # Usar shell=False para segurança'
    );
  }

  return secureCode;
};

/**
 * Registra evento de segurança
 */
export const logSecurityEvent = async (
  eventType: string,
  severity: 'baixo' | 'médio' | 'alto' | 'crítico',
  message: string,
  details?: any,
  ipAddress?: string
): Promise<void> => {
  const id = uuidv4();
  await run(
    `INSERT INTO security_logs (id, event_type, severity, message, ip_address, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      eventType,
      severity,
      message,
      ipAddress || '0.0.0.0',
      JSON.stringify(details || {}),
    ]
  );

  // Atualizar estatísticas
  if (eventType === 'injection_detected') {
    await run(`UPDATE statistics SET total_attacks_blocked = total_attacks_blocked + 1 WHERE id = 'stats'`);
  }
};

/**
 * Atualizar estatísticas
 */
export const updateStatistics = async (): Promise<void> => {
  const prompts = await query('SELECT COUNT(*) as count FROM prompts');
  const vulnerabilities = await query('SELECT COUNT(*) as count FROM code_corrections');
  
  await run(
    `UPDATE statistics SET 
     total_prompts = ?,
     total_vulnerabilities_detected = ?,
     last_updated = CURRENT_TIMESTAMP
     WHERE id = 'stats'`,
    [
      prompts[0]?.count || 0,
      vulnerabilities[0]?.count || 0,
    ]
  );
};
