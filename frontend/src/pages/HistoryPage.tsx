import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface PromptHistory {
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

const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<PromptHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await axios.get('/api/history?limit=100')
        setHistory(res.data)
      } catch (err) {
        console.error('Erro ao carregar histórico:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-cyber-blue text-lg">⏳ Carregando histórico...</div>
      </div>
    )
  }

  const getRiskBadge = (level: string) => {
    const badgeClasses = {
      baixo: 'bg-cyber-green/20 text-cyber-green',
      médio: 'bg-cyber-yellow/20 text-cyber-yellow',
      alto: 'bg-orange-500/20 text-orange-400',
      crítico: 'bg-cyber-red/20 text-cyber-red',
    }
    return badgeClasses[level as keyof typeof badgeClasses] || 'bg-cyber-green/20 text-cyber-green'
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-cyber-blue mb-6">
        📜 Histórico de Prompts
      </h1>

      {history.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 text-lg">Nenhum prompt no histórico</p>
          <p className="text-gray-500 text-sm mt-2">
            Comece gerando código na página de Chat
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="card cursor-pointer hover:border-cyber-blue/50 transition-all"
            >
              <button
                onClick={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
                className="w-full text-left"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <p className="font-semibold text-white line-clamp-2">
                      {item.user_input}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(item.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {item.is_injection_detected && (
                      <span className="badge-critical">INJECTION</span>
                    )}
                    <span className={getRiskBadge(item.risk_level)}>
                      {item.risk_level.toUpperCase()}
                    </span>
                    <span className="text-gray-400">
                      {expandedId === item.id ? '▼' : '▶'}
                    </span>
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {expandedId === item.id && (
                <div className="mt-4 pt-4 border-t border-cyber-blue/20 space-y-4">
                  {/* Injection Detection */}
                  {item.is_injection_detected && (
                    <div className="p-3 bg-cyber-red/10 border border-cyber-red/50 rounded">
                      <p className="font-semibold text-cyber-red text-sm">
                        🚨 Prompt Injection Detectado
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Tipo: {item.injection_type || 'Desconhecido'}
                      </p>
                    </div>
                  )}

                  {/* Generated Code */}
                  {item.generated_code && (
                    <div>
                      <p className="font-semibold text-cyber-blue text-sm mb-2">
                        💻 Código Gerado ({item.language})
                      </p>
                      <pre className="bg-cyber-darker rounded p-3 overflow-x-auto text-xs text-cyan-300 border border-cyber-blue/20 max-h-48">
                        <code>{item.generated_code}</code>
                      </pre>
                    </div>
                  )}

                  {/* Vulnerability Status */}
                  {item.code_response_id && (
                    <div className="p-3 rounded border border-cyber-blue/20 bg-cyber-darker">
                      <p className="font-semibold text-sm">
                        {item.is_vulnerable ? '⚠️ Vulnerável' : '✅ Seguro'}
                      </p>
                    </div>
                  )}

                  {/* Copy Button */}
                  <button
                    onClick={() => {
                      if (item.generated_code) {
                        navigator.clipboard.writeText(item.generated_code)
                        alert('Código copiado!')
                      }
                    }}
                    className="btn-secondary w-full text-sm"
                    disabled={!item.generated_code}
                  >
                    📋 Copiar Código
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default HistoryPage
