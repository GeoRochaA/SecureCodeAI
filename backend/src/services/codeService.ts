import { v4 as uuidv4 } from 'uuid';
import { run, getOne, query } from '../database/init.js';
import {
  analyzePromptSecurity,
  analyzeCodeSecurity,
  type CodeVulnerability,
  generateSecureCode,
  logSecurityEvent,
  updateStatistics,
} from '../security/guardrails.js';
import { generateCodeWithAI } from '../ai/service.js';

export interface CodeGenerationRequest {
  prompt: string;
  safeMode: boolean;
  userIp?: string;
}

export interface CodeAuditRequest {
  code: string;
  language: string;
  userIp?: string;
}

export interface CodeGenerationResponse {
  id: string;
  prompt: string;
  code: string;
  language: string;
  explanation: string;
  securityAnalysis: {
    promptRiskLevel: string;
    isInjectionDetected: boolean;
    injectionType?: string;
    injectionDetails: string[];
  };
  codeAnalysis?: {
    isVulnerable: boolean;
    vulnerabilities: CodeVulnerability[];
    riskScore: number;
  };
  secureCode?: string;
  createdAt: string;
}

export interface CodeAuditResponse extends CodeGenerationResponse {}

interface StatisticsRow {
  id: string;
  total_prompts: number;
  total_attacks_blocked: number;
  total_vulnerabilities_detected: number;
  total_corrections: number;
  last_updated: string;
}

interface VulnerabilityTypeCount {
  vulnerability_type: string;
  count: number;
}

interface RiskLevelCount {
  risk_level: string;
  count: number;
}

interface SecurityLogRow {
  id: string;
  event_type: string;
  severity: string;
  message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  details: string | null;
  created_at: string;
}

interface SecurityStatistics {
  overall?: StatisticsRow;
  recentLogs: SecurityLogRow[];
  vulnerabilitiesByType: VulnerabilityTypeCount[];
  risksByLevel: RiskLevelCount[];
}

interface PromptHistoryRow {
  id: string;
  user_input: string;
  risk_level: string;
  is_injection_detected: number;
  injection_type: string | null;
  created_at: string;
  code_response_id: string | null;
  generated_code: string | null;
  language: string | null;
  is_vulnerable: number | null;
}

interface PromptRow {
  id: string;
  user_input: string;
  risk_level: string;
  is_injection_detected: number;
  injection_type: string | null;
  created_at: string;
}

interface CodeResponseRow {
  id: string;
  prompt_id: string;
  generated_code: string | null;
  language: string | null;
  is_vulnerable: number;
  vulnerabilities: string | null;
  created_at: string;
}

interface CodeCorrectionRow {
  id: string;
  response_id: string;
  vulnerability_type: string;
  vulnerability_description: string | null;
  secure_code: string | null;
  owasp_category: string | null;
  created_at: string;
}

type PromptDetails = PromptRow & {
  codeResponse?: CodeResponseRow;
  vulnerabilities: CodeCorrectionRow[];
};

const getErrorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

/**
 * Processa uma solicitação de geração de código
 */
export const processCodeGeneration = async (
  request: CodeGenerationRequest
): Promise<CodeGenerationResponse> => {
  const responseId = uuidv4();
  try {
    // 1. Análise de segurança do prompt
    const promptAnalysis = await analyzePromptSecurity(request.prompt);

    // Se detectou injection, bloquear imediatamente
    if (promptAnalysis.isInjectionDetected) {
      await logSecurityEvent(
        'injection_detected',
        'crítico',
        `Prompt injection detectado: ${promptAnalysis.injectionType}`,
        { prompt: request.prompt, type: promptAnalysis.injectionType },
        request.userIp
      );

      throw new Error(`🚨 ATAQUE BLOQUEADO: Prompt Injection detectada (${promptAnalysis.injectionType})`);
    }

    // Se risco é crítico, bloquear
    if (promptAnalysis.riskLevel === 'crítico') {
      await logSecurityEvent(
        'high_risk_prompt',
        'crítico',
        'Prompt com risco crítico detectado',
        { prompt: request.prompt },
        request.userIp
      );

      throw new Error('🚨 ATAQUE BLOQUEADO: Prompt com risco crítico detectado');
    }

    // 2. Gerar código com IA
    let aiResponse;
    try {
      aiResponse = await generateCodeWithAI(request.prompt, request.safeMode);
    } catch (aiError) {
      await logSecurityEvent(
        'ai_service_error',
        'médio',
        'Erro ao comunicar com serviço de IA',
        { error: String(aiError) },
        request.userIp
      );
      throw new Error('Erro ao gerar código. Verifique se Ollama está rodando em http://localhost:11434');
    }

    // 3. Análise de segurança do código gerado
    const codeAnalysis = await analyzeCodeSecurity(aiResponse.code, aiResponse.language);

    // Salvar resposta no banco
    await run(
      `INSERT INTO code_responses (id, prompt_id, generated_code, language, is_vulnerable, vulnerabilities)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        promptAnalysis.promptId,
        aiResponse.code,
        aiResponse.language,
        codeAnalysis.isVulnerable ? 1 : 0,
        JSON.stringify(codeAnalysis.vulnerabilities),
      ]
    );

    // 4. Se vulnerável, gerar código seguro
    let secureCode: string | undefined;
    if (codeAnalysis.isVulnerable && request.safeMode) {
      secureCode = generateSecureCode(aiResponse.code, aiResponse.language);

      // Salvar correções
      for (const vuln of codeAnalysis.vulnerabilities) {
        await run(
          `INSERT INTO code_corrections (id, response_id, vulnerability_type, vulnerability_description, owasp_category)
          VALUES (?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            responseId,
            vuln.type,
            vuln.description,
            vuln.owaspCategory,
          ]
        );
      }

      // Log de vulnerabilidades detectadas
      if (codeAnalysis.vulnerabilities.length > 0) {
        await logSecurityEvent(
          'vulnerability_detected',
          codeAnalysis.riskScore > 60 ? 'crítico' : codeAnalysis.riskScore > 40 ? 'alto' : 'médio',
          `${codeAnalysis.vulnerabilities.length} vulnerabilidade(s) detectada(s)`,
          {
            vulnerabilities: codeAnalysis.vulnerabilities.map((v) => v.type),
            riskScore: codeAnalysis.riskScore,
          },
          request.userIp
        );
      }
    }

    // Atualizar estatísticas
    await updateStatistics();

    return {
      id: responseId,
      prompt: request.prompt,
      code: aiResponse.code,
      language: aiResponse.language,
      explanation: aiResponse.explanation,
      securityAnalysis: {
        promptRiskLevel: promptAnalysis.riskLevel,
        isInjectionDetected: promptAnalysis.isInjectionDetected,
        injectionType: promptAnalysis.injectionType,
        injectionDetails: promptAnalysis.details,
      },
      codeAnalysis: {
        isVulnerable: codeAnalysis.isVulnerable,
        vulnerabilities: codeAnalysis.vulnerabilities,
        riskScore: codeAnalysis.riskScore,
      },
      secureCode,
      createdAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    // Log do erro
    const message = getErrorMessage(error);
    await logSecurityEvent(
      'code_generation_error',
      'médio',
      message,
      { prompt: request.prompt },
      request.userIp
    );

    throw error;
  }
};

export const analyzeExistingCode = async (
  request: CodeAuditRequest
): Promise<CodeAuditResponse> => {
  const responseId = uuidv4();

  const codeAnalysis = await analyzeCodeSecurity(request.code, request.language);
  let secureCode: string | undefined;

  if (codeAnalysis.isVulnerable) {
    secureCode = generateSecureCode(request.code, request.language);

    for (const vuln of codeAnalysis.vulnerabilities) {
      await run(
        `INSERT INTO code_corrections (id, response_id, vulnerability_type, vulnerability_description, owasp_category)
        VALUES (?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          responseId,
          vuln.type,
          vuln.description,
          vuln.owaspCategory,
        ]
      );
    }

    await logSecurityEvent(
      'code_audit_vulnerability',
      codeAnalysis.riskScore > 60 ? 'crítico' : codeAnalysis.riskScore > 40 ? 'alto' : 'médio',
      `${codeAnalysis.vulnerabilities.length} vulnerabilidade(s) detectada(s) durante auditoria de código`,
      {
        vulnerabilities: codeAnalysis.vulnerabilities.map((v) => v.type),
        riskScore: codeAnalysis.riskScore,
      },
      request.userIp
    );
  }

  await updateStatistics();

  return {
    id: responseId,
    prompt: `Auditoria de código em ${request.language}`,
    code: request.code,
    language: request.language,
    explanation: 'O código passou por uma auditoria de segurança com correções automáticas quando necessário.',
    securityAnalysis: {
      promptRiskLevel: codeAnalysis.isVulnerable ? 'alto' : 'baixo',
      isInjectionDetected: false,
      injectionDetails: [],
    },
    codeAnalysis: {
      isVulnerable: codeAnalysis.isVulnerable,
      vulnerabilities: codeAnalysis.vulnerabilities,
      riskScore: codeAnalysis.riskScore,
    },
    secureCode,
    createdAt: new Date().toISOString(),
  };
};

/**
 * Obtém estatísticas de segurança
 */
export const getSecurityStatistics = async (): Promise<SecurityStatistics> => {
  const stats = await getOne<StatisticsRow>('SELECT * FROM statistics WHERE id = ?', ['stats']);
  const recentLogs = await query<SecurityLogRow>('SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 10');

  // Contar vulnerabilidades por tipo
  const vulnByType = await query<VulnerabilityTypeCount>(`
    SELECT vulnerability_type, COUNT(*) as count FROM code_corrections
    GROUP BY vulnerability_type
    ORDER BY count DESC
  `);

  // Contar riscos por nível
  const riskByLevel = await query<RiskLevelCount>(`
    SELECT risk_level, COUNT(*) as count FROM prompts
    GROUP BY risk_level
  `);

  return {
    overall: stats,
    recentLogs,
    vulnerabilitiesByType: vulnByType,
    risksByLevel: riskByLevel,
  };
};

/**
 * Obtém histórico de prompts
 */
export const getPromptHistory = async (limit: number = 50): Promise<PromptHistoryRow[]> => {
  return await query<PromptHistoryRow>(
    `SELECT p.*, c.id as code_response_id, c.generated_code, c.language, c.is_vulnerable
    FROM prompts p
    LEFT JOIN code_responses c ON p.id = c.prompt_id
    ORDER BY p.created_at DESC
    LIMIT ?`,
    [limit]
  );
};

/**
 * Obtém detalhes de um prompt específico
 */
export const getPromptDetails = async (promptId: string): Promise<PromptDetails | null> => {
  const prompt = await getOne<PromptRow>('SELECT * FROM prompts WHERE id = ?', [promptId]);
  if (!prompt) return null;

  const codeResponse = await getOne<CodeResponseRow>(
    'SELECT * FROM code_responses WHERE prompt_id = ?',
    [promptId]
  );

  const vulnerabilities = codeResponse
    ? await query<CodeCorrectionRow>('SELECT * FROM code_corrections WHERE response_id = ?', [codeResponse.id])
    : [];

  return {
    ...prompt,
    codeResponse,
    vulnerabilities,
  };
};
