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

const languages = ['javascript', 'typescript', 'python', 'php', 'sql', 'html', 'css']
const defaultScenario = 'Descreva um backend completo com autenticação, upload de arquivos e integração a banco de dados, incluindo entradas protegidas contra injeção e validação robusta.'

const ChatPage: React.FC = () => {
  const [mode, setMode] = useState<'secure' | 'vulnerable'>('secure')
  const [view, setView] = useState<'scan' | 'generate'>('scan')
  const [scenarioDescription, setScenarioDescription] = useState(defaultScenario)
  const [language, setLanguage] = useState('javascript')
  const [codeInput, setCodeInput] = useState('// Cole seu código aqui para análise de segurança.')
  const [response, setResponse] = useState<AuditResponse | null>(null)
  const [analysis, setAnalysis] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const currentOutcome = view === 'generate' ? response : analysis
  const vulnerabilities = currentOutcome?.codeAnalysis?.vulnerabilities || []
  const showCodeComparison = Boolean(currentOutcome?.secureCode)
  const riskScore = currentOutcome?.codeAnalysis?.riskScore ?? 0

  const executeGenerate = async () => {
    if (!scenarioDescription.trim()) {
      setError('Insira a descrição do sistema para gerar o código de teste.')
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao gerar o código de teste')
    } finally {
      setLoading(false)
    }
  }

  const executeAnalyze = async () => {
    if (!codeInput.trim()) {
      setError('Cole um código para análise antes de continuar.')
      return
    }

    setLoading(true)
    setError('')
    setResponse(null)
    setAnalysis(null)

    try {
      const res = await axios.post('/api/analyze', {
        code: codeInput,
        language,
      })
      setAnalysis(res.data)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao analisar o código')
    } finally {
      setLoading(false)
    }
  }

  const summaryCards = useMemo(
    () => [
      { label: 'Vulnerabilidades', value: vulnerabilities.length },
      { label: 'Modo de geração', value: mode === 'secure' ? 'Seguro' : 'Vulnerável' },
      { label: 'Injeção', value: currentOutcome?.securityAnalysis.isInjectionDetected ? 'Detectada' : 'Não detectada' },
    ],
    [vulnerabilities.length, mode, currentOutcome?.securityAnalysis.isInjectionDetected]
  )

  return (
    <div className="space-y-6">
      <section className="card">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-semibold text-cyber-blue">SecureCode Scanner</h1>
            <p className="text-sm text-slate-400 mt-2">Scanner profissional de vulnerabilidades para LLMs, prompt injection e código inseguro.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('generate')}
              className={`px-4 py-2 rounded-lg border ${view === 'generate' ? 'bg-cyber-blue text-slate-950 border-transparent' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
            >
              Simulação de Sistema
            </button>
            <button
              onClick={() => setView('scan')}
              className={`px-4 py-2 rounded-lg border ${view === 'scan' ? 'bg-cyber-blue text-slate-950 border-transparent' : 'border-slate-700 text-slate-200 hover:bg-slate-800'}`}
            >
              Scanner de Código
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
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
                      Modo Seguro
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
                      Modo Vulnerável
                    </label>
                    <span className="text-xs text-slate-500">Modo definido apenas para a geração de sistemas. A auditoria sempre executa análise completa.</span>
                  </div>
                  <div className="space-y-4">
                    <label className="text-sm font-semibold text-slate-200">Descrição do cenário</label>
                    <textarea
                      value={scenarioDescription}
                      onChange={(e) => setScenarioDescription(e.target.value)}
                      rows={6}
                      className="input-base w-full resize-none"
                    />
                    <div className="flex flex-wrap gap-3">
                      <button onClick={executeGenerate} className="btn-primary" disabled={loading}>
                        {loading ? 'Processando...' : 'Gerar sistema de teste'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setScenarioDescription(defaultScenario)}
                        className="btn-secondary"
                      >
                        Exemplo de cenário
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-200">Editor de Código</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Linguagem</span>
                      <select
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                        className="input-base bg-slate-900"
                      >
                        {languages.map((lang) => (
                          <option key={lang} value={lang}>{lang.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <CodeEditor
                    value={codeInput}
                    onValueChange={setCodeInput}
                    language={language}
                    placeholder="Cole aqui seu código para análise de segurança"
                  />
                  <button onClick={executeAnalyze} className="btn-primary" disabled={loading}>
                    {loading ? 'Auditar...' : 'Iniciar auditoria'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
              <p className="text-sm font-semibold text-white">Auditoria em tempo real</p>
              <p className="text-sm text-slate-400 mt-3">O scanner classifica, detecta e corrige vulnerabilidades sem dependência de modo.</p>
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
              <p className="text-sm font-semibold text-white">OWASP Top 10</p>
              <p className="text-sm text-slate-400 mt-3">Todas as análises exibem categorias OWASP e severidades associadas.</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="card space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-cyber-blue">Resultado da Auditoria</h2>
            <p className="text-sm text-slate-400">Relatório de vulnerabilidades, OWASP e recomendações de correção.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        )}

        {!currentOutcome && !error && (
          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-6 text-slate-400">
            Cole um código completo ou gere um sistema de teste para iniciar a auditoria de segurança.
          </div>
        )}

        {currentOutcome && (
          <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Score de risco</p>
                    <h3 className="mt-2 text-3xl font-semibold text-white">{riskScore} / 100</h3>
                  </div>
                  <div className="space-y-2 text-right">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getRiskBadge(riskScore)}`}>
                      {getSeverityLabel(riskScore)}
                    </span>
                    <span className="block text-sm text-slate-400">{currentOutcome.securityAnalysis.promptRiskLevel} risk</span>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {summaryCards.map((item) => (
                    <div key={item.label} className="rounded-2xl bg-slate-900 p-4">
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-4">
                  <p className="text-sm text-slate-400">Descrição da análise</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">{currentOutcome.explanation || 'Resultado detalhado da auditoria de segurança, com mitigação e correções.'}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-white">Vulnerabilidades detectadas</h3>
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
                          </div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getRiskBadge(item.severity)}`}>
                            {item.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-slate-300">{item.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-400">Nenhuma vulnerabilidade crítica identificada nesta análise.</p>
                )}
              </div>

              {showCodeComparison && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
                    <h4 className="text-sm font-semibold text-slate-200">Código original</h4>
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
                    <h4 className="text-sm font-semibold text-slate-200">Código seguro</h4>
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

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                <h3 className="text-lg font-semibold text-white">Mitigação automática</h3>
                <p className="mt-3 text-sm text-slate-400">Com o modo seguro ativo, o scanner aplica guardrails e corrige o código automaticamente.</p>
              </div>

              <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
                <h3 className="text-lg font-semibold text-white">Ataques de prompt</h3>
                <p className="mt-3 text-sm text-slate-400">Tentativas de ignorar instruções ou injetar comandos são bloqueadas e registradas.</p>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}

const getRiskBadge = (level: string | number) => {
  const normalized = String(level).toLowerCase()
  if (normalized.includes('crit') || normalized.includes('crítico') || normalized === 'critical' || Number(level) > 75) {
    return 'badge-critical'
  }
  if (normalized.includes('alto') || normalized.includes('high') || Number(level) > 50) {
    return 'badge-high'
  }
  if (normalized.includes('médio') || normalized.includes('medium') || Number(level) > 25) {
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
