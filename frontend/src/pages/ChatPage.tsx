import React, { useState } from 'react'
import axios from 'axios'
import CodeEditor from '../components/CodeEditor'

interface SecurityAnalysis {
  promptRiskLevel: string
  isInjectionDetected: boolean
  injectionType?: string
  injectionDetails: string[]
}

interface CodeVulnerability {
  type: string
  description: string
  owaspCategory: string
  severity: string
  recommendation?: string
  fileName?: string
  lineNumber?: number
  vulnerableSnippet?: string
  fixedSnippet?: string
}

interface CodeAnalysis {
  isVulnerable: boolean
  vulnerabilities: CodeVulnerability[]
  riskScore: number
}

interface AuditResponse {
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

const defaultScenario = 'Gere um sistema completo com login, JWT, banco de dados, rotas administrativas e upload de arquivos.'

const ChatPage: React.FC = () => {
  const [mode, setMode] = useState<'secure' | 'vulnerable'>('secure')
  const [view, setView] = useState<'scan' | 'generate'>('scan')
  const [scenarioDescription, setScenarioDescription] = useState(defaultScenario)
  const [generatedCode, setGeneratedCode] = useState('')
  const [generatedLanguage, setGeneratedLanguage] = useState('typescript')
  const [codeInput, setCodeInput] = useState('// Cole o código ou múltiplos arquivos aqui para auditoria.')
  const [analysis, setAnalysis] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentOutcome = analysis
  const vulnerabilities = currentOutcome?.codeAnalysis?.vulnerabilities || []
  const detectedLanguage = currentOutcome?.language || 'typescript'

  const executeGenerate = async () => {
    if (!scenarioDescription.trim()) {
      setError('Informe o sistema a ser gerado.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const res = await axios.post('/api/generate', {
        prompt: scenarioDescription,
        safeMode: mode === 'secure',
      })
      setGeneratedCode(res.data.code)
      setGeneratedLanguage(res.data.language || 'typescript')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao gerar sistema')
    } finally {
      setLoading(false)
    }
  }

  const sendGeneratedCodeToScanner = () => {
    if (!generatedCode.trim()) return
    setCodeInput(generatedCode)
    setAnalysis(null)
    setError('')
    setView('scan')
  }

  const executeAnalyze = async () => {
    if (!codeInput.trim()) {
      setError('Cole código para auditar.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const res = await axios.post('/api/analyze', {
        code: codeInput,
      })
      setAnalysis(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao auditar código')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-end gap-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('generate')}
              className={`px-4 py-2 rounded-lg border ${view === 'generate' ? 'bg-cyber-blue text-slate-950 border-transparent' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
            >
              Gerar Sistema
            </button>
            <button
              onClick={() => setView('scan')}
              className={`px-4 py-2 rounded-lg border ${view === 'scan' ? 'bg-cyber-blue text-slate-950 border-transparent' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
            >
              Scanner
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6">
          {view === 'generate' ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center mb-6">
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="mode"
                    value="secure"
                    checked={mode === 'secure'}
                    onChange={() => setMode('secure')}
                    className="accent-cyber-blue"
                  />
                  Seguro
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="radio"
                    name="mode"
                    value="vulnerable"
                    checked={mode === 'vulnerable'}
                    onChange={() => setMode('vulnerable')}
                    className="accent-cyber-red"
                  />
                  Vulneravel
                </label>
              </div>

              <label className="text-sm font-semibold text-slate-200">Sistema</label>
              <textarea
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                rows={6}
                className="input-base w-full resize-none"
              />
              <div className="flex flex-wrap gap-3">
                <button onClick={executeGenerate} className="btn-primary" disabled={loading}>
                  {loading ? 'Processando...' : 'Gerar'}
                </button>
                {generatedCode && (
                  <button type="button" onClick={sendGeneratedCodeToScanner} className="btn-secondary">
                    Enviar para Scanner
                  </button>
                )}
              </div>
              {generatedCode && (
                <div className="pt-2">
                  <CodeEditor
                    value={generatedCode}
                    onValueChange={() => undefined}
                    language={generatedLanguage}
                    readOnly
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="text-sm font-semibold text-slate-200">Editor de Código</label>
              </div>
              <CodeEditor
                value={codeInput}
                onValueChange={setCodeInput}
                language={detectedLanguage}
                placeholder="Cole aqui o código ou um conjunto de arquivos"
              />
              <button onClick={executeAnalyze} className="btn-primary" disabled={loading}>
                {loading ? 'Auditando...' : 'Iniciar auditoria'}
              </button>
            </div>
          )}
        </div>
      </section>

      {view === 'scan' && (
      <section className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-cyber-blue">Auditoria</h2>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        {!currentOutcome && !error && (
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-slate-400">
            Execute uma auditoria para visualizar vulnerabilidades e correções.
          </div>
        )}

        {currentOutcome && (
          <div className="grid gap-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Vulnerabilidades</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">OWASP</span>
              </div>
              {vulnerabilities.length ? (
                <div className="mt-4 space-y-4">
                  {vulnerabilities.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{translateVulnerability(item.type)}</p>
                          <p className="text-sm text-slate-400 mt-1">{item.owaspCategory}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getRiskBadge(item.severity)}`}>
                          {translateSeverity(item.severity)}
                        </span>
                      </div>
                      <div className="mt-4 grid gap-3 lg:grid-cols-2">
                        <SnippetBlock title="Vulnerável" tone="danger" code={getVulnerableSnippet(item)} />
                        <SnippetBlock title="Corrigido" tone="safe" code={getFixedSnippet(item)} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Nenhum finding detectado.</p>
              )}
            </div>

          </div>
        )}
      </section>
      )}
    </div>
  )
}

interface SnippetBlockProps {
  title: string
  tone: 'danger' | 'safe'
  code: string
}

const SnippetBlock: React.FC<SnippetBlockProps> = ({ title, tone, code }) => {
  const color = tone === 'danger' ? 'text-red-300 border-red-500/20 bg-red-500/5' : 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5'
  const dot = tone === 'danger' ? 'bg-red-400' : 'bg-emerald-400'

  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {title}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs leading-5 text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  )
}

const translateVulnerability = (type: string) => {
  const labels: Record<string, string> = {
    'SQL Injection': 'Injeção SQL',
    'Reflected XSS': 'XSS Refletido',
    'Unsafe Code Execution': 'Execução Insegura de Código',
    'Hardcoded Credential': 'Credencial Hardcoded',
    'Unsafe JWT Secret': 'JWT Inseguro',
    'Missing CSRF Protection': 'Falta de Proteção CSRF',
    'Missing Authorization': 'Falta de Autorização',
    'Unsafe File Upload': 'Upload Inseguro de Arquivos',
    'Sensitive Data Exposure': 'Exposição de Dados Sensíveis',
    'Weak Password Hashing': 'Hash de Senha Fraco',
    'Missing Input Validation': 'Falta de Validação de Entrada',
  }

  return labels[type] || type
}

const translateSeverity = (severity: string) => {
  const labels: Record<string, string> = {
    low: 'BAIXO',
    medium: 'MÉDIO',
    high: 'ALTO',
    critical: 'CRÍTICO',
  }

  return labels[severity.toLowerCase()] || severity.toUpperCase()
}

const getVulnerableSnippet = (item: CodeVulnerability) => {
  return item.vulnerableSnippet || item.description || 'Trecho vulnerável detectado.'
}

const getFixedSnippet = (item: CodeVulnerability) => {
  return item.fixedSnippet || item.recommendation || 'Aplicar mitigação recomendada.'
}

const getRiskBadge = (level: string | number) => {
  const normalized = String(level).toLowerCase()
  if (normalized.includes('crit') || normalized === 'critical' || Number(level) > 75) {
    return 'badge-critical'
  }
  if (normalized.includes('alto') || normalized.includes('high') || Number(level) > 50) {
    return 'badge-high'
  }
  if (normalized.includes('medio') || normalized.includes('medium') || Number(level) > 25) {
    return 'badge-medium'
  }
  return 'badge-low'
}

export default ChatPage
