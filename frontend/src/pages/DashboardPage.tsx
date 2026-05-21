import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface SecurityLog {
  id: string
  event_type: string
  severity: string
  message: string
  created_at: string
}

interface Statistics {
  overall?: {
    total_prompts: number
    total_attacks_blocked: number
    total_vulnerabilities_detected: number
    total_corrections: number
  }
  recentLogs?: SecurityLog[]
  vulnerabilitiesByType?: Array<{ vulnerability_type: string; count: number }>
  risksByLevel?: Array<{ risk_level: string; count: number }>
}

interface OWASPItem {
  id: string
  title: string
  description: string
}

const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('/api/statistics')
        setStats(res.data)
      } catch (err) {
        console.error('Erro ao carregar estatísticas:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 5000) // Atualizar a cada 5s
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-cyber-blue text-lg">Carregando painel de segurança...</div>
      </div>
    )
  }

  const overall = stats?.overall ?? {
    total_prompts: 0,
    total_attacks_blocked: 0,
    total_vulnerabilities_detected: 0,
    total_corrections: 0,
  }
  const logs = stats?.recentLogs || []
  const vulnTypes = stats?.vulnerabilitiesByType || []
  const riskLevels = stats?.risksByLevel || []

  const getSeverityBadge = (severity: string) => {
    const colors = {
      baixo: 'bg-cyber-green/20 text-cyber-green',
      médio: 'bg-cyber-yellow/20 text-cyber-yellow',
      alto: 'bg-orange-500/20 text-orange-400',
      crítico: 'bg-cyber-red/20 text-cyber-red',
    }
    return colors[severity as keyof typeof colors] || colors.baixo
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-cyber-blue mb-6">
        Painel de Segurança
      </h1>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="text-3xl font-bold text-cyber-blue">
            {overall.total_prompts || 0}
          </div>
          <p className="text-sm text-gray-400 mt-2">Auditorias Executadas</p>
        </div>

        <div className="card">
          <div className="text-3xl font-bold text-cyber-red">
            {overall.total_attacks_blocked || 0}
          </div>
          <p className="text-sm text-gray-400 mt-2">Ataques Bloqueados</p>
        </div>

        <div className="card">
          <div className="text-3xl font-bold text-cyber-yellow">
            {overall.total_vulnerabilities_detected || 0}
          </div>
          <p className="text-sm text-gray-400 mt-2">Vulnerabilidades Detectadas</p>
        </div>

        <div className="card">
          <div className="text-3xl font-bold text-cyber-green">
            {overall.total_corrections || 0}
          </div>
          <p className="text-sm text-gray-400 mt-2">Correções Aplicadas</p>
        </div>
      </div>

      {/* Vulnerability Types Chart */}
      <div className="card">
        <h2 className="text-xl font-bold text-cyber-blue mb-4">
          Vulnerabilidades por Tipo
        </h2>

        {vulnTypes.length > 0 ? (
          <div className="space-y-3">
            {vulnTypes.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm font-semibold">{item.vulnerability_type}</span>
                <div className="flex items-center gap-2 flex-1 ml-4">
                  <div className="flex-1 bg-cyber-darker rounded h-2">
                    <div
                      className="bg-cyber-purple h-2 rounded transition-all"
                      style={{
                        width: `${Math.min(
                          (item.count / Math.max(...vulnTypes.map((v) => v.count), 1)) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm font-bold text-cyber-blue w-12 text-right">
                    {item.count}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">Nenhuma vulnerabilidade detectada</p>
        )}
      </div>

      {/* Risk Levels Distribution */}
      <div className="card">
        <h2 className="text-xl font-bold text-cyber-blue mb-4">
          Distribuição de Riscos
        </h2>

        {riskLevels.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {riskLevels.map((item, i) => (
              <div
                key={i}
                className={`p-3 rounded text-center border-2 ${
                  item.risk_level === 'crítico'
                    ? 'border-cyber-red bg-cyber-red/10'
                    : item.risk_level === 'alto'
                      ? 'border-orange-400 bg-orange-400/10'
                      : item.risk_level === 'médio'
                        ? 'border-cyber-yellow bg-cyber-yellow/10'
                        : 'border-cyber-green bg-cyber-green/10'
                }`}
              >
                <div className="text-2xl font-bold capitalize">
                  {item.count}
                </div>
                <p className="text-xs capitalize text-gray-300 mt-1">
                  {item.risk_level}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">Nenhum dado disponível</p>
        )}
      </div>

      {/* Recent Security Events */}
      <div className="card">
        <h2 className="text-xl font-bold text-cyber-blue mb-4">
          Eventos Recentes
        </h2>

        {logs.length > 0 ? (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className={`p-3 rounded border-l-4 ${
                  log.severity === 'crítico'
                    ? 'border-cyber-red bg-cyber-red/10'
                    : log.severity === 'alto'
                      ? 'border-orange-400 bg-orange-400/10'
                      : log.severity === 'médio'
                        ? 'border-cyber-yellow bg-cyber-yellow/10'
                        : 'border-cyber-green bg-cyber-green/10'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {log.event_type.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{log.message}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${getSeverityBadge(log.severity)}`}>
                    {log.severity}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(log.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400">Nenhum evento registrado</p>
        )}
      </div>

      {/* OWASP Top 10 Reference */}
      <OWASPReference />
    </div>
  )
}

const OWASPReference: React.FC = () => {
  const [owaspList, setOwaspList] = useState<OWASPItem[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const fetchOWASP = async () => {
      try {
        const res = await axios.get('/api/owasp')
        setOwaspList(res.data)
      } catch (err) {
        console.error('Erro ao carregar OWASP:', err)
      }
    }
    fetchOWASP()
  }, [])

  return (
    <div className="card">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left font-bold text-cyber-blue mb-2 flex items-center justify-between hover:bg-cyber-blue/10 p-2 rounded transition"
      >
        <span>📚 OWASP Top 10 (2021)</span>
        <span>{expanded ? '▼' : '▶'}</span>
      </button>

      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          {owaspList.map((item) => (
            <div key={item.id} className="p-3 bg-cyber-darker rounded border border-cyber-blue/10">
              <div className="font-semibold text-cyber-purple">{item.id}: {item.title}</div>
              <p className="text-xs text-gray-400 mt-1">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default DashboardPage
