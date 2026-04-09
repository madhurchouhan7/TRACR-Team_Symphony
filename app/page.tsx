'use client'

import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'

// We avoid next/dynamic here due to a known Turbopack bug with passing callbacks 
// to dynamically-loaded client components. Instead, we manually import the module on mount.

export default function HomePage() {
  const [fraudActive, setFraudActive] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [GlobeComponent, setGlobeComponent] = useState<any>(null)

  useEffect(() => { 
    setMounted(true)
    import('@/components/Globe3D').then((mod) => {
      setGlobeComponent(() => mod.default)
    })
  }, [])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020617]">

      {/* ── Full-bleed Globe ── */}
      <div className="absolute inset-0 z-0">
        {GlobeComponent ? (
          <GlobeComponent onFraudDetected={setFraudActive} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* ── Radial vignette so text reads over globe ── */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, rgba(2,6,23,0.55) 75%, rgba(2,6,23,0.9) 100%)',
        }}
      />

      {/* ── Fraud pulse ring ── */}
      <AnimatePresence>
        {fraudActive && (
          <motion.div
            key="pulse"
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeOut' }}
            className="absolute z-10 rounded-full pointer-events-none"
            style={{
              width: 240, height: 240,
              border: '1.5px solid #ef4444',
              boxShadow: '0 0 40px rgba(239,68,68,0.5)',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Minimal centered overlay ── */}
      {mounted && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center pointer-events-none select-none">

          {/* Status badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full pointer-events-auto"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: fraudActive ? '#ef4444' : '#10b981',
                boxShadow: fraudActive
                  ? '0 0 8px #ef4444'
                  : '0 0 8px #10b981',
                transition: 'all 0.4s ease',
                animation: 'blink 1.4s ease-in-out infinite',
              }}
            />
            <span
              className="text-xs font-mono tracking-[0.2em] uppercase"
              style={{ color: fraudActive ? '#ef4444' : '#10b981', transition: 'color 0.4s ease' }}
            >
              {fraudActive ? 'Threat Detected' : 'AI Shield · Active'}
            </span>
          </motion.div>

          {/* Brand name */}
          <motion.h1
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-black leading-none tracking-tight mb-5"
            style={{
              fontSize: 'clamp(5rem, 14vw, 11rem)',
              background: 'linear-gradient(135deg, #ffffff 0%, #a7f3d0 45%, #06b6d4 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 0 48px rgba(16,185,129,0.28))',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            TRACR
          </motion.h1>

          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.3, duration: 0.7 }}
            className="text-slate-400 text-base md:text-lg font-mono tracking-wide mb-10"
            style={{ textShadow: '0 0 20px rgba(0,0,0,0.8)' }}
          >
            Your AI-Powered Financial Guardian
          </motion.p>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.6 }}
            className="pointer-events-auto"
          >
            <CTAButton />
          </motion.div>
        </div>
      )}

      {/* ── Fraud ALERT toast (top-center) ── */}
      <AnimatePresence>
        {fraudActive && (
          <motion.div
            key="alert"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl font-mono text-xs tracking-widest uppercase"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.45)',
              backdropFilter: 'blur(12px)',
              color: '#ef4444',
              boxShadow: '0 0 24px rgba(239,68,68,0.25)',
            }}
          >
            🚨 &nbsp;Fraud Loop Detected — Neutralizing…
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Scroll cue (bottom center) ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.4 }}
        transition={{ delay: 2.4, duration: 1 }}
        className="absolute bottom-7 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      >
        <motion.div
          animate={{ y: [0, 7, 0] }}
          transition={{ duration: 1.6, repeat: Infinity }}
          className="w-5 h-8 rounded-full border border-emerald-900 flex items-start justify-center pt-1.5"
        >
          <div className="w-1 h-1.5 rounded-full bg-emerald-500" />
        </motion.div>
      </motion.div>
    </div>
  )
}

// ─── CTA Button ───────────────────────────────────────────────────────────────
function CTAButton() {
  const [hov, setHov] = useState(false)
  return (
    <Link
      href="/app.html"
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className="relative overflow-hidden rounded-2xl px-10 py-3.5 font-bold font-mono text-sm tracking-[0.15em] uppercase transition-all duration-300 inline-block text-center"
      style={{
        background: hov ? 'linear-gradient(135deg,#10b981,#06b6d4)' : 'rgba(16,185,129,0.1)',
        color: hov ? '#020617' : '#10b981',
        border: '1px solid rgba(16,185,129,0.5)',
        boxShadow: hov
          ? '0 0 48px rgba(16,185,129,0.5), 0 0 100px rgba(16,185,129,0.15)'
          : '0 0 20px rgba(16,185,129,0.2)',
        transform: hov ? 'scale(1.04)' : 'scale(1)',
        backdropFilter: 'blur(12px)',
        textDecoration: 'none'
      }}
    >
      {/* scan line */}
      {hov && (
        <span
          className="absolute inset-x-0 h-0.5 pointer-events-none"
          style={{
            background: 'rgba(2,6,23,0.5)',
            animation: 'scan 1.6s ease-in-out infinite',
          }}
        />
      )}
      <span className="relative z-10">Enter Command Center</span>
    </Link>
  )
}
