// Tipos da aplicação

export interface CodeVulnerability {
  type: string
  description: string
  owaspCategory: string
  severity: 'baixo' | 'médio' | 'alto' | 'crítico'
}

export interface SecurityAnalysis {
  promptRiskLevel: string
  isInjectionDetected: boolean
  injectionType?: string
  injectionDetails: string[]
}

export interface CodeAnalysis {
  isVulnerable: boolean
  vulnerabilities: CodeVulnerability[]
  riskScore: number
}

export interface CodeGenerationResponse {
  id: string
  prompt: string
  code: string
  language: string
  explanation: string
  securityAnalysis: SecurityAnalysis
  codeAnalysis?: CodeAnalysis
  secureCode?: string
  createdAt: string
}

export interface SecurityStatistics {
  overall: {
    total_prompts: number
    total_attacks_blocked: number
    total_vulnerabilities_detected: number
    total_corrections: number
  }
  recentLogs: Array<{
    id: string
    event_type: string
    severity: string
    message: string
    created_at: string
  }>
  vulnerabilitiesByType: Array<{
    vulnerability_type: string
    count: number
  }>
  risksByLevel: Array<{
    risk_level: string
    count: number
  }>
}

export interface PromptHistoryItem {
  id: string
  user_input: string
  risk_level: string
  is_injection_detected: boolean
  injection_type?: string
  created_at: string
  code_response_id?: string
  generated_code?: string
  language?: string
  is_vulnerable?: boolean
}

export interface OWASPItem {
  id: string
  title: string
  description: string
}
