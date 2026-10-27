import { motion } from 'motion/react'

export function AstraOrb({ state = 'IDLE', level = 0 }: {state?: string; level?: number}) {
  const active = ['SPEAKING','LISTENING','THINKING'].includes(state)
  return <div className={`orb-wrap ${state.toLowerCase()}`} aria-label={`Astra is ${state.toLowerCase()}`} role="img">
    <motion.div className="orb-halo" animate={{ scale: active ? [1, 1.08 + level * .08, 1] : 1, opacity: active ? [.35,.7,.35] : .25 }} transition={{duration: state === 'THINKING' ? 2.4 : 1.3, repeat: Infinity}}/>
    <motion.svg className="orb" viewBox="0 0 240 240" animate={{rotate: state === 'THINKING' ? 360 : 0}} transition={{duration:12, repeat:Infinity, ease:'linear'}}>
      <defs><radialGradient id="core"><stop stopColor="#d8e7ff"/><stop offset=".32" stopColor="#6698ff"/><stop offset=".75" stopColor="#6655e8"/><stop offset="1" stopColor="#121a40"/></radialGradient></defs>
      <circle cx="120" cy="120" r="76" fill="url(#core)"/>
      <path d="M43 120c30-42 49-58 77-58s48 17 77 58c-29 41-49 58-77 58s-47-16-77-58Z" fill="none" stroke="rgba(190,220,255,.6)" strokeWidth="1.5"/>
      <ellipse cx="120" cy="120" rx="36" ry="76" fill="none" stroke="rgba(255,255,255,.35)"/>
    </motion.svg>
  </div>
}
