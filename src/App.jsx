import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DataProvider } from './context/DataContext'
import Login from './pages/Login'
import Shell from './components/Shell'
import Overview from './pages/Overview'
import VoterRegister from './pages/VoterRegister'
import Booths from './pages/Booths'
import Schemes from './pages/Schemes'
import Reports from './pages/Reports'
import Staff from './pages/Staff'
import Settings from './pages/Settings'

const PAGES = {
  overview: Overview,
  register: VoterRegister,
  booths: Booths,
  schemes: Schemes,
  reports: Reports,
  staff: Staff,
  settings: Settings
}

function AuthenticatedApp() {
  const [page, setPage] = useState('overview')
  const { user } = useAuth()

  const resolvedPage = page === 'staff' && user?.role !== 'admin' ? 'overview' : page

  return (
    <DataProvider>
      <Shell page={resolvedPage} onNavigate={setPage}>
        {(() => {
          const Page = PAGES[resolvedPage] ?? Overview
          return <Page onNavigate={setPage} />
        })()}
      </Shell>
    </DataProvider>
  )
}

function Gate() {
  const { user } = useAuth()
  return user ? <AuthenticatedApp /> : <Login />
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  )
}
