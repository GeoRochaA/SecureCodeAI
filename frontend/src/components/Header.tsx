import React from 'react'

interface HeaderProps {
  onNavigate: (page: 'scanner' | 'dashboard' | 'logs') => void
  currentPage: 'scanner' | 'dashboard' | 'logs'
}

const Header: React.FC<HeaderProps> = ({ onNavigate, currentPage }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="text-2xl font-semibold text-slate-100">SecureCode Scanner</div>
            <span className="text-sm text-slate-400">Enterprise vulnerability scanner for LLM security</span>
          </div>

          <nav className="flex gap-3 flex-wrap">
            <button
              onClick={() => onNavigate('scanner')}
              className={`px-4 py-2 rounded transition-colors ${
                currentPage === 'scanner'
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              Scanner
            </button>
            <button
              onClick={() => onNavigate('dashboard')}
              className={`px-4 py-2 rounded transition-colors ${
                currentPage === 'dashboard'
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              Risk Center
            </button>
            <button
              onClick={() => onNavigate('logs')}
              className={`px-4 py-2 rounded transition-colors ${
                currentPage === 'logs'
                  ? 'bg-slate-100 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              Logs
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}

export default Header
