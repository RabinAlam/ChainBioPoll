import { Routes, Route } from 'react-router-dom'
import { WalletProvider } from './context/WalletContext'
import { ContractProvider } from './context/ContractContext'
import { ToastProvider } from './components/Toast'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import AdminDashboard from './pages/AdminDashboard'
import VoterDashboard from './pages/VoterDashboard'
import PublicResults from './pages/PublicResults'

export default function App() {
  return (
    <WalletProvider>
      <ContractProvider>
        <ToastProvider>
          <div className="min-h-screen bg-dark-950 bg-mesh">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/voter" element={<VoterDashboard />} />
                <Route path="/results" element={<PublicResults />} />
              </Routes>
            </main>
          </div>
        </ToastProvider>
      </ContractProvider>
    </WalletProvider>
  )
}
