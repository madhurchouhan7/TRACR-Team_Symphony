'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

export default function HomePage() {
  const [fraudActive, setFraudActive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [GlobeComponent, setGlobeComponent] = useState<any>(null)

  // Auth form states
  const [email, setEmail] = useState('investigator.alpha@sentinel.ai')
  const [password, setPassword] = useState('••••••••••••')
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => { 
    setMounted(true)
    import('@/components/Globe3D').then((mod) => {
      setGlobeComponent(() => mod.default)
    })
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050505]">
      
      {/* Anti-gravity meshes */}
      <div className="absolute inset-0 mesh-bg opacity-70 pointer-events-none" />
      <div className="absolute inset-0 grid-overlay opacity-30 pointer-events-none" />

      {/* Global Context (Full Screen) */}
      <div className="absolute inset-0 z-0 opacity-100 mix-blend-screen">
        {GlobeComponent ? (
          <GlobeComponent onFraudDetected={setFraudActive} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="globe-loader"></div>
          </div>
        )}
      </div>

      {/* Vignette to smoothly darken the edges */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 50% 50%, transparent 15%, rgba(5,5,5,0.6) 60%, rgba(5,5,5,0.95) 100%)',
        }}
      />

      {/* Status Badge (Bottom Left) */}
      <motion.div
        initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="absolute bottom-8 left-8 sm:bottom-12 sm:left-12 z-20 glass flex items-center gap-3 px-5 py-2.5 rounded-full pointer-events-none border border-white/[0.05] bg-white/[0.02] backdrop-blur-3xl"
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${fraudActive ? 'animate-blink' : ''}`}
          style={{
            background: fraudActive ? 'var(--accent-alert)' : 'var(--accent-safe)',
            boxShadow: fraudActive ? 'var(--glow-alert)' : '0 0 12px rgba(52, 211, 153, 0.4)',
          }}
        />
        <span className="text-[10px] font-mono tracking-[0.15em] uppercase font-bold text-gray-300">
          {fraudActive ? 'Threat Detected' : 'Global Network Sync'}
        </span>
      </motion.div>

      {/* ── Centralized HUD Overlay (Directly On Globe) ── */}
      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center pointer-events-none">
        
        {/* Core Brand Centered Above Box */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1.2 }}
          className="flex flex-col items-center text-center mb-8 pointer-events-none select-none"
        >
          <h1
            className="font-semibold leading-none tracking-tight mb-2"
            style={{
              fontSize: 'clamp(3rem, 6vw, 4.5rem)',
              background: 'linear-gradient(180deg, #FFFFFF 0%, #A1A1AA 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.04em',
            }}
          >
            TRACR
          </h1>
          <p className="text-gray-400 text-[10px] md:text-xs font-medium tracking-[0.2em] uppercase">
            Antigravity Defense Network
          </p>
        </motion.div>

        {/* The Auth Box Dead Center */}
        <motion.div
           initial={{ opacity: 0, scale: 0.95, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           transition={{ delay: 0.2, duration: 1, ease: [0.16, 1, 0.3, 1] }}
           className="relative w-[90%] max-w-[400px] p-8 sm:p-10 rounded-[28px] border border-white/[0.08] backdrop-blur-[40px] bg-white/[0.02] shadow-[0_24px_80px_rgba(0,0,0,0.7)] pointer-events-auto"
        >
          {/* Subtle flare behind the box */}
          <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-tr from-transparent via-white/[0.02] to-transparent pointer-events-none rounded-[28px] z-0" />
          
          {/* Form Header */}
          <div className="relative mb-8 flex flex-col items-center text-center z-10 hidden">
             {/* Hid the secondary Secure Access header to prioritize the huge TRACR brand above */}
          </div>

          {/* Auth Form */}
          <div className="relative space-y-5 z-10 mt-2">
            <div className="space-y-1.5 flex flex-col">
              <label className="text-[11px] font-semibold tracking-wider text-gray-300 uppercase drop-shadow-sm">Analyst ID</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                suppressHydrationWarning
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 transition-all font-mono placeholder:text-gray-500 shadow-inner"
              />
            </div>
            
            <div className="space-y-1.5 flex flex-col">
              <label className="text-[11px] font-semibold tracking-wider text-gray-300 uppercase drop-shadow-sm">Clearance Key</label>
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suppressHydrationWarning
                className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3.5 text-[15px] text-white focus:outline-none focus:border-indigo-400/50 focus:ring-1 focus:ring-indigo-400/50 transition-all font-mono tracking-widest shadow-inner"
              />
            </div>

            <div className="pt-5 flex flex-col gap-3">
              <Link
                href="/app.html"
                onClick={() => setIsAuthenticating(true)}
                className="w-full relative overflow-hidden rounded-xl px-4 py-3.5 flex items-center justify-center gap-2 group transition-all duration-300 bg-white text-black font-semibold text-[15px] hover:shadow-[0_0_24px_rgba(255,255,255,0.2)] hover:scale-[1.02] active:scale-[0.98]"
                style={{ textDecoration: 'none' }}
              >
                {isAuthenticating ? (
                  <span className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Sign In</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1 duration-300"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                  </>
                )}
              </Link>

              <button suppressHydrationWarning className="w-full rounded-xl px-4 py-3.5 border border-white/5 bg-transparent text-gray-300 font-medium text-[14px] hover:bg-white/[0.06] hover:text-white transition-all duration-300 active:scale-[0.98]">
                Request Guest Access
              </button>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}
