import { Route, Routes } from 'react-router-dom'
import { AppShell } from './layouts/app-shell'
import { HomePage } from './pages/home'
import { RepositoryPage } from './pages/repository'
import { ChatPage } from './pages/chat'
import { NotFoundPage } from './pages/not-found'

function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/repository" element={<RepositoryPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  )
}

export default App
