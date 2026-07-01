import { randomUUID } from 'crypto';
import {
  analyzeCodeSecurity,
  detectCodeLanguage,
  type CodeVulnerability,
} from '../security/guardrails.js';

export interface CodeAuditRequest {
  code: string;
  language?: string;
}

export interface CodeAnalysisResponse {
  id: string;
  language: string;
  explanation: string;
  codeAnalysis: {
    isVulnerable: boolean;
    vulnerabilities: CodeVulnerability[];
    riskScore: number;
  };
}

const buildAuditExplanation = (vulnerabilities: CodeVulnerability[], riskScore: number): string => {
  const riskLabel = riskScore <= 25 ? 'LOW' : riskScore <= 50 ? 'MEDIUM' : riskScore <= 75 ? 'HIGH' : 'CRITICAL';
  if (vulnerabilities.length === 0) {
    return `No findings detected. Risk: ${riskLabel} (${riskScore}/100).`;
  }
  const topFindings = vulnerabilities
    .slice(0, 3)
    .map((v) => `${v.severity.toUpperCase()} ${v.type}`)
    .join(' | ');
  return `${vulnerabilities.length} finding(s). Risk: ${riskLabel} (${riskScore}/100). ${topFindings}.`;
};

export const analyzeExistingCode = async (request: CodeAuditRequest): Promise<CodeAnalysisResponse> => {
  const detectedLanguage = request.language || detectCodeLanguage(request.code);
  const codeAnalysis = await analyzeCodeSecurity(request.code, detectedLanguage);

  return {
    id: randomUUID(),
    language: detectedLanguage,
    explanation: buildAuditExplanation(codeAnalysis.vulnerabilities, codeAnalysis.riskScore),
    codeAnalysis,
  };
};
