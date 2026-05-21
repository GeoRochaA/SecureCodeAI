import React, { useEffect, useState } from 'react'
import axios from 'axios'

interface LogItem {
  id: string
  event_type: string
  severity: string
  message: string
  created_at: string
}

const LogsPage: React.FC = () => {
  const [logs, setLogs] = useState<LogItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get('/api/statistics')
        setLogs(res.data.recentLogs || [])
      } catch (err) {
        console.error('Erro ao carregar logs:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLogs()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-cyber-blue">Registro de Eventos de Segurança</h1>
          <p className="text-sm text-slate-400">Auditoria de vulnerabilidades, ataques bloqueados e logs de mitigação.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-cyber-blue">Eventos do sistema</h2>
            <span className="text-xs text-gray-400">Últimas 10 entradas</span>
          </div>

          {loading ? (
            <div className="text-cyber-blue">Carregando...</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-400">Nenhum log disponível.</div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="p-4 rounded-lg border border-cyber-blue/20 bg-cyber-darker">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-white">{log.event_type.replace(/_/g, ' ').toUpperCase()}</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded ${getSeverityClass(log.severity)}`}>
                      {log.severity.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-2">{log.message}</p>
                  <p className="text-xs text-gray-500 mt-2">{new Date(log.created_at).toLocaleString('pt-BR')}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="font-semibold text-cyber-blue mb-3">Legenda de Severidade</h2>
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-cyber-green" />Baixo</div>
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-cyber-yellow" />Médio</div>
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-orange-400" />Alto</div>
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-cyber-red" />Crítico</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const getSeverityClass = (severity: string) => {
  switch (severity) {
    case 'crítico':
      return 'bg-cyber-red/10 text-cyber-red'
    case 'alto':
      return 'bg-orange-400/10 text-orange-400'
    case 'médio':
      return 'bg-cyber-yellow/10 text-cyber-yellow'
    default:
      return 'bg-cyber-green/10 text-cyber-green'
  }
}

export default LogsPage
