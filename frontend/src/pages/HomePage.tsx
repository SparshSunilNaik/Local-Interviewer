import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Clock3, Cpu, Mic2, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AstraOrb } from '../components/AstraOrb'
import { api } from '../services/api'

export function HomePage() {
  const {data: health} = useQuery({queryKey:['health'], queryFn:api.health, retry:false})
  const {data: interviews=[]} = useQuery({queryKey:['history'], queryFn:api.history})
  const scored = interviews.filter(item=>item.overall_score != null)
  return <div className="page home-page">
    <section className="hero">
      <div className="eyebrow"><span className={`status-dot ${health ? 'online':''}`}/>{health ? 'Local engine ready' : 'Backend unavailable'}</div>
      <h1>Practice the interview.<br/><span>Own the conversation.</span></h1>
      <p>A private, voice-first interview studio powered by models running on your hardware. Meet Astra—focused, adaptive, and ready when you are.</p>
      <div className="hero-actions"><Link className="button primary" to="/new">Start an interview <ArrowRight size={18}/></Link><Link className="button secondary" to="/history">View history</Link></div>
      <div className="trust-row"><span><ShieldCheck/>100% local</span><span><Mic2/>Natural voice</span><span><Cpu/>Ollama powered</span></div>
      <div className="hero-orb"><AstraOrb state="IDLE"/></div>
    </section>
    <section className="dashboard-strip">
      <div><span className="metric-icon"><Clock3/></span><p>Practice sessions</p><strong>{interviews.length}</strong></div>
      <div><span className="metric-icon purple"><TrendingUp/></span><p>Latest score</p><strong>{scored[0]?.overall_score ? `${Math.round(scored[0].overall_score!)}%` : '—'}</strong></div>
      <div><span className="metric-icon blue"><Sparkles/></span><p>Privacy</p><strong>On-device</strong></div>
    </section>
    <section className="section-head"><div><span className="kicker">GET STARTED</span><h2>Choose your next move</h2></div></section>
    <section className="action-grid">
      <Link to="/new" className="action-card featured"><Mic2/><h3>Full interview</h3><p>A structured, adaptive session with voice or text.</p><span>Configure session <ArrowRight/></span></Link>
      <Link to="/new?quick=true" className="action-card"><Sparkles/><h3>Quick practice</h3><p>Sharpen one topic in a focused ten-minute round.</p><span>Start practice <ArrowRight/></span></Link>
      <Link to="/settings" className="action-card"><Cpu/><h3>Connect your model</h3><p>Configure local or private remote Ollama profiles.</p><span>Open settings <ArrowRight/></span></Link>
    </section>
  </div>
}
