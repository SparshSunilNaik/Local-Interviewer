import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ConfigurePage } from './pages/ConfigurePage'
import { HistoryPage } from './pages/HistoryPage'
import { HomePage } from './pages/HomePage'
import { InterviewPage } from './pages/InterviewPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { ReportPage } from './pages/ReportPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return <Routes><Route element={<Layout/>}>
    <Route index element={<HomePage/>}/><Route path="onboarding" element={<OnboardingPage/>}/>
    <Route path="new" element={<ConfigurePage/>}/><Route path="interview/:id" element={<InterviewPage/>}/>
    <Route path="history" element={<HistoryPage/>}/><Route path="report/:id" element={<ReportPage/>}/>
    <Route path="settings" element={<SettingsPage/>}/>
  </Route></Routes>
}
