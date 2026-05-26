import React, { useMemo, useState } from 'react'
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
  const [codeInput, setCodeInput] = useState('// Cole o codigo ou multiplos arquivos aqui para auditoria.')
  const [response, setResponse] = useState<AuditResponse | null>(null)
  const [analysis, setAnalysis] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentOutcome = view === 'generate' ? response : analysis
  const vulnerabilities = currentOutcome?.codeAnalysis?.vulnerabilities || []
  const showCodeComparison = Boolean(currentOutcome?.secureCode)
  const showGeneratedCode = Boolean(view === 'generate' && currentOutcome?.code && !showCodeComparison)
  const riskScore = currentOutcome?.codeAnalysis?.riskScore ?? 0
  const detectedLanguage = currentOutcome?.language || 'typescript'

  const executeGenerate = async () => {
    if (!scenarioDescription.trim()) {
      setError('Informe o sistema a ser gerado.')
      return
    }

    setLoading(true)
    setError('')
    setResponse(null)
    setAnalysis(null)

    try {
      const res = await axios.post('/api/generate', {
        prompt: scenarioDescription,
        safeMode: mode === 'secure',
      })
      setResponse(res.data)
      setCodeInput(res.data.code)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao gerar sistema')
    } finally {
      setLoading(false)
    }
  }

  const executeAnalyze = async () => {
    if (!codeInput.trim()) {
      setError('Cole codigo para auditar.')
      return
    }

    setLoading(true)
    setError('')
    setResponse(null)
    setAnalysis(null)

    try {
      const res = await axios.post('/api/analyze', {
        code: codeInput,
      })
      setAnalysis(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Falha ao auditar codigo')
    } finally {
      setLoading(false)
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Findings', value: vulnerabilities.length },
      { label: 'Modo de geracao', value: mode === 'secure' ? 'Seguro' : 'Vulneravel' },
      { label: 'Linguagem detectada', value: detectedLanguage.toUpperCase() },
    ],
    [vulnerabilities.length, mode, detectedLanguage]
  )

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
                <button type="button" onClick={() => setScenarioDescription(defaultScenario)} className="btn-secondary">
                  Exemplo
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <label className="text-sm font-semibold text-slate-200">Editor de Codigo</label>
                <span className="text-xs text-slate-400">Deteccao automatica: JS, TS, PHP, Python, SQL, HTML</span>
              </div>
              <CodeEditor
                value={codeInput}
                onValueChange={setCodeInput}
                language={detectedLanguage}
                placeholder="Cole aqui o codigo ou um conjunto de arquivos"
              />
              <button onClick={executeAnalyze} className="btn-primary" disabled={loading}>
                {loading ? 'Auditando...' : 'Iniciar auditoria'}
              </button>
            </div>
          )}
        </div>
      </section>

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
            Execute uma auditoria para listar vulnerabilidades, severidade, OWASP, arquivo afetado e mitigacao.
          </div>
        )}

        {currentOutcome && (
          <div className="grid gap-6">
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Risk score</p>
                  <h3 className="mt-2 text-3xl font-semibold text-white">{riskScore} / 100</h3>
                </div>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadge(riskScore)}`}>
                  {getSeverityLabel(riskScore)}
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {summaryCards.map((item) => (
                  <div key={item.label} className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-sm text-slate-400">{item.label}</p>
                    <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Vulnerabilidades</h3>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-400">OWASP</span>
              </div>
              {vulnerabilities.length ? (
                <div className="mt-4 space-y-4">
                  {vulnerabilities.map((item, index) => (
                    <div key={`${item.type}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">{item.type}</p>
                          <p className="text-sm text-slate-400 mt-1">{item.owaspCategory}</p>
                          <p className="text-xs text-slate-500 mt-1">Arquivo afetado: {formatFile(item)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getRiskBadge(item.severity)}`}>
                          {item.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                      {item.recommendation && (
                        <p className="mt-2 text-sm text-cyber-blue">{item.recommendation}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Nenhum finding detectado.</p>
              )}
            </div>

            {showGeneratedCode && currentOutcome && (
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                <h4 className="text-sm font-semibold text-slate-200">Codigo gerado</h4>
                <div className="mt-4">
                  <CodeEditor
                    value={currentOutcome.code}
                    onValueChange={() => undefined}
                    language={currentOutcome.language}
                    readOnly
                  />
                </div>
              </div>
            )}

            {showCodeComparison && (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <h4 className="text-sm font-semibold text-slate-200">Codigo original</h4>
                  <div className="mt-4">
                    <CodeEditor
                      value={currentOutcome.code}
                      onValueChange={() => undefined}
                      language={currentOutcome.language}
                      readOnly
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                  <h4 className="text-sm font-semibold text-slate-200">Mitigacao</h4>
                  <div className="mt-4">
                    <CodeEditor
                      value={currentOutcome.secureCode ?? ''}
                      onValueChange={() => undefined}
                      language={currentOutcome.language}
                      readOnly
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

const formatFile = (item: CodeVulnerability) => {
  const file = item.fileName || 'input'
  return item.lineNumber ? `${file}:${item.lineNumber}` : file
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

const getSeverityLabel = (score: number) => {
  if (score <= 25) return 'LOW'
  if (score <= 50) return 'MEDIUM'
  if (score <= 75) return 'HIGH'
  return 'CRITICAL'
}

export default ChatPage
