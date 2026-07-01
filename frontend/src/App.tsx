import ChatPage from './pages/ChatPage'
import Header from './components/Header'
import './App.css'

function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="container mx-auto py-6 px-4">
        <ChatPage />
      </main>
    </div>
  )
}

export default App
