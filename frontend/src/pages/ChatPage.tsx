import React, { useState } from 'react'

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

interface CodeAnalysisResponse {
  id: string
  language: string
  explanation: string
  codeAnalysis: {
    isVulnerable: boolean
    vulnerabilities: CodeVulnerability[]
    riskScore: number
  }
}

const ChatPage: React.FC = () => {
  const [codeInput, setCodeInput] = useState('// Cole código aqui para análise')
  const [analysis, setAnalysis] = useState<CodeAnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const vulnerabilities = analysis?.codeAnalysis?.vulnerabilities || []

  const executeAnalyze = async () => {
    if (!codeInput.trim()) {
      setError('Cole código para analisar.')
      return
    }

    setLoading(true)
    setError('')
    setAnalysis(null)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao analisar código')
      }

      const data = await res.json()
      setAnalysis(data)
    } catch (err: any) {
      setError(err.message || 'Erro ao analisar código')
    } finally {
      setLoading(false)
    }
  }

  const getRiskBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500/20 text-red-200',
      high: 'bg-orange-500/20 text-orange-200',
      medium: 'bg-yellow-500/20 text-yellow-200',
      low: 'bg-green-500/20 text-green-200',
    }
    return colors[severity] || colors.low
  }

  return (
    <div className="space-y-6">
      <section className="card">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>
        )}

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4 space-y-3">
          <label htmlFor="code-input" className="text-sm font-semibold text-slate-200">Seu Código</label>
          <textarea
            id="code-input"
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder="Cole seu código aqui..."
            className="w-full min-h-[320px] resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={executeAnalyze}
            disabled={loading}
            className="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold transition-colors"
          >
            {loading ? 'Analisando...' : 'Analisar'}
          </button>
        </div>
      </section>

      {analysis && (
        <section className="card space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Resultado</h3>
            <p className="text-sm text-slate-400">{analysis.language.toUpperCase()}</p>
          </div>

          <p className="text-slate-300">{analysis.explanation}</p>

          {vulnerabilities.length > 0 && (
            <div>
              <h4 className="font-semibold text-white mb-3">Vulnerabilidades ({vulnerabilities.length})</h4>
              <div className="space-y-3">
                {vulnerabilities.map((vuln, idx) => (
                  <div key={idx} className="border border-slate-700 rounded-lg p-3 bg-slate-900">
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div>
                        <p className="font-semibold text-white">{vuln.type}</p>
                        <p className="text-xs text-slate-400">{vuln.owaspCategory}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${getRiskBadge(vuln.severity)}`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-300 mb-2">{vuln.description}</p>
                    {vuln.recommendation && <p className="text-xs text-green-400">✓ {vuln.recommendation}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!analysis.codeAnalysis.isVulnerable && (
            <div className="border border-green-500/30 bg-green-500/10 rounded-lg p-3 text-green-200 text-sm">
              ✓ Nenhuma vulnerabilidade detectada
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default ChatPage
