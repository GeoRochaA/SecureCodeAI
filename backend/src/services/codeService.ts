import { v4 as uuidv4 } from 'uuid';
import { run, getOne, query } from '../database/init.js';
import {
  analyzePromptSecurity,
  analyzeCodeSecurity,
  detectCodeLanguage,
  type CodeVulnerability,
  generateSecureCode,
  logSecurityEvent,
  updateStatistics,
} from '../security/guardrails.js';
import { codeMatchesPromptSpec, generateCodeWithAI, generateFallbackResponse } from '../ai/service.js';

export interface CodeGenerationRequest {
  prompt: string;
  safeMode: boolean;
  userIp?: string;
}

export interface CodeAuditRequest {
  code: string;
  language?: string;
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
  code_response_id?: string | null;
  generated_code?: string | null;
  language?: string | null;
  is_vulnerable?: number | null;
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

const buildAuditExplanation = (vulnerabilities: CodeVulnerability[], riskScore: number): string => {
  const riskLabel = riskScore <= 25 ? 'LOW' : riskScore <= 50 ? 'MEDIUM' : riskScore <= 75 ? 'HIGH' : 'CRITICAL';
  if (vulnerabilities.length === 0) {
    return `Audit complete. Risk ${riskLabel} (${riskScore}/100). No findings detected.`;
  }

  const topFindings = vulnerabilities
    .slice(0, 3)
    .map((vulnerability) => `${vulnerability.severity.toUpperCase()} ${vulnerability.type}`)
    .join(' | ');

  return `Audit complete. Risk ${riskLabel} (${riskScore}/100). Findings: ${vulnerabilities.length}. ${topFindings}.`;
};

const persistFindings = async (responseId: string, vulnerabilities: CodeVulnerability[]) => {
  for (const vuln of vulnerabilities) {
    await run(
      `INSERT INTO code_corrections (id, response_id, vulnerability_type, vulnerability_description, owasp_category)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), responseId, vuln.type, vuln.description, vuln.owaspCategory]
    );
  }
};

const riskSeverity = (riskScore: number): 'low' | 'medium' | 'high' | 'critical' => {
  if (riskScore > 60) return 'critical';
  if (riskScore > 40) return 'high';
  if (riskScore > 0) return 'medium';
  return 'low';
};

export const processCodeGeneration = async (
  request: CodeGenerationRequest
): Promise<CodeGenerationResponse> => {
  const responseId = uuidv4();

  try {
    const promptAnalysis = await analyzePromptSecurity(request.prompt, {
      allowSecurityAuditRequests: !request.safeMode,
    });

    if (promptAnalysis.isInjectionDetected || promptAnalysis.riskLevel === 'critical') {
      await logSecurityEvent(
        promptAnalysis.isInjectionDetected ? 'injection_detected' : 'high_risk_prompt',
        'critical',
        promptAnalysis.injectionType || 'High Risk Prompt',
        { prompt: request.prompt, details: promptAnalysis.details },
        request.userIp
      );

      throw new Error('Prompt blocked by guardrails');
    }

    let aiResponse;
    try {
      aiResponse = await generateCodeWithAI(request.prompt, request.safeMode);
    } catch (aiError) {
      await logSecurityEvent(
        'ai_service_error',
        'medium',
        'AI service unavailable',
        { error: String(aiError) },
        request.userIp
      );
      throw new Error('AI service unavailable. Check Ollama at http://localhost:11434');
    }

    let detectedLanguage = detectCodeLanguage(aiResponse.code);
    const generatedAnalysis = await analyzeCodeSecurity(aiResponse.code, detectedLanguage);

    if (request.safeMode && generatedAnalysis.isVulnerable) {
      aiResponse = generateFallbackResponse(request.prompt, true, 'to satisfy the selected security mode');
      detectedLanguage = detectCodeLanguage(aiResponse.code);
    }

    if (!request.safeMode && generatedAnalysis.riskScore < 35) {
      aiResponse = generateFallbackResponse(request.prompt, false, 'to satisfy the selected security mode');
      detectedLanguage = detectCodeLanguage(aiResponse.code);
    }

    if (!codeMatchesPromptSpec(request.prompt, aiResponse.code, detectedLanguage)) {
      aiResponse = generateFallbackResponse(request.prompt, request.safeMode, 'to match the requested language and fields');
      detectedLanguage = detectCodeLanguage(aiResponse.code);
    }

    await run(
      `INSERT INTO code_responses (id, prompt_id, generated_code, language, is_vulnerable, vulnerabilities)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        promptAnalysis.promptId,
        aiResponse.code,
        detectedLanguage,
        0,
        JSON.stringify([]),
      ]
    );

    await updateStatistics();

    return {
      id: responseId,
      prompt: request.prompt,
      code: aiResponse.code,
      language: detectedLanguage,
      explanation: aiResponse.explanation || 'System generated.',
      securityAnalysis: {
        promptRiskLevel: promptAnalysis.riskLevel,
        isInjectionDetected: promptAnalysis.isInjectionDetected,
        injectionType: promptAnalysis.injectionType,
        injectionDetails: promptAnalysis.details,
      },
      createdAt: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const message = getErrorMessage(error);
    await logSecurityEvent('code_generation_error', 'medium', message, { prompt: request.prompt }, request.userIp);
    throw error;
  }
};

export const analyzeExistingCode = async (
  request: CodeAuditRequest
): Promise<CodeAuditResponse> => {
  const responseId = uuidv4();
  const detectedLanguage = request.language || detectCodeLanguage(request.code);
  const codeAnalysis = await analyzeCodeSecurity(request.code, detectedLanguage);
  const secureCode = codeAnalysis.isVulnerable ? generateSecureCode(request.code, detectedLanguage) : undefined;

  if (codeAnalysis.isVulnerable) {
    await persistFindings(responseId, codeAnalysis.vulnerabilities);
    await logSecurityEvent(
      'code_audit_vulnerability',
      riskSeverity(codeAnalysis.riskScore),
      `${codeAnalysis.vulnerabilities.length} findings detected during code audit`,
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
    prompt: `Code audit (${detectedLanguage})`,
    code: request.code,
    language: detectedLanguage,
    explanation: buildAuditExplanation(codeAnalysis.vulnerabilities, codeAnalysis.riskScore),
    securityAnalysis: {
      promptRiskLevel: codeAnalysis.isVulnerable ? 'high' : 'low',
      isInjectionDetected: false,
      injectionDetails: [],
    },
    codeAnalysis,
    secureCode,
    createdAt: new Date().toISOString(),
  };
};

export const getSecurityStatistics = async (): Promise<SecurityStatistics> => {
  const stats = await getOne<StatisticsRow>('SELECT * FROM statistics WHERE id = ?', ['stats']);
  const recentLogs = await query<SecurityLogRow>('SELECT * FROM security_logs ORDER BY created_at DESC LIMIT 10');

  const vulnByType = await query<VulnerabilityTypeCount>(`
    SELECT vulnerability_type, COUNT(*) as count FROM code_corrections
    GROUP BY vulnerability_type
    ORDER BY count DESC
  `);

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
