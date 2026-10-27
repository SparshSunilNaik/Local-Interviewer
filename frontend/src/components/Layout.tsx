import { History, Home, Settings, Sparkles } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return <div className="app-shell">
    <header className="topbar">
      <NavLink to="/" className="brand"><span className="brand-mark"><Sparkles size={17}/></span><span>Local Interviewer</span></NavLink>
      <nav aria-label="Primary navigation">
        <NavLink to="/" aria-label="Home"><Home size={18}/><span>Home</span></NavLink>
        <NavLink to="/history"><History size={18}/><span>History</span></NavLink>
        <NavLink to="/settings"><Settings size={18}/><span>Settings</span></NavLink>
      </nav>
    </header>
    <main><Outlet/></main>
    <footer>Private by design · Your interviews stay on this machine</footer>
  </div>
}
