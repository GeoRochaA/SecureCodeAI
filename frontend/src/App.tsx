import { useState } from 'react'
import AuditPage from './pages/ChatPage'
import DashboardPage from './pages/DashboardPage'
import LogsPage from './pages/LogsPage'
import Header from './components/Header'
import './App.css'

type Page = 'scanner' | 'dashboard' | 'logs'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('scanner')

  const renderPage = () => {
    switch (currentPage) {
      case 'scanner':
        return <AuditPage />
      case 'dashboard':
        return <DashboardPage />
      case 'logs':
        return <LogsPage />
      default:
        return <AuditPage />
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header onNavigate={setCurrentPage} currentPage={currentPage} />
      <main className="container mx-auto py-6 px-4">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
