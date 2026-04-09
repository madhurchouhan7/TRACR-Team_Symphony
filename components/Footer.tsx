'use client'

import { motion } from 'framer-motion'

const SYSTEMS = [
  { label: 'AI Engine', value: 'Active', color: '#10b981' },
  { label: 'Graph DB', value: 'Operational', color: '#10b981' },
  { label: 'Node Count', value: '4.2M', color: '#06b6d4' },
  { label: 'Avg Latency', value: '38ms', color: '#06b6d4' },
  { label: 'Uptime', value: '99.97%', color: '#10b981' },
  { label: 'Threats Blocked (24h)', value: '1,847', color: '#ef4444' },
]

export default function Footer() {
  return (
    <footer
      className="relative border-t"
      style={{
        borderColor: 'rgba(16,185,129,0.15)',
        background: 'rgba(2,6,23,0.95)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Top scan line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, #10b981, #06b6d4, #10b981, transparent)',
        }}
      />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="flex items-center gap-3"
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center font-bold font-mono text-sm"
              style={{
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#020617',
              }}
            >
              T
            </div>
            <div>
              <span className="text-white font-bold text-lg tracking-tight">TRACR</span>
              <p className="text-xs font-mono text-slate-500">v2.4.1 — Production Build</p>
            </div>
          </motion.div>

          {/* Status Grid */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {SYSTEMS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="flex items-center gap-2"
              >
                <div
                  className="w-1.5 h-1.5 rounded-full animate-blink"
                  style={{ backgroundColor: s.color, boxShadow: `0 0 6px ${s.color}` }}
                />
                <span className="text-xs font-mono text-slate-400">{s.label}:</span>
                <span className="text-xs font-mono font-semibold" style={{ color: s.color }}>
                  {s.value}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Right: Sentinel Link + copyright */}
          <div className="text-right">
            <a
              href="http://localhost:5500/app.html"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg mb-3 text-xs font-mono font-semibold uppercase tracking-widest transition-all duration-200"
              style={{
                color: '#10b981',
                border: '1px solid rgba(16,185,129,0.3)',
                background: 'rgba(16,185,129,0.06)',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.15)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 16px rgba(16,185,129,0.25)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(16,185,129,0.06)'
                ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-blink" />
              Open Sentinel Dashboard →
            </a>
            <p
              className="text-xs font-mono font-semibold uppercase tracking-widest"
              style={{ color: '#10b981' }}
            >
              System Status:{' '}
              <span className="animate-blink">Operational</span>
            </p>
            <p className="text-xs font-mono text-slate-600 mt-1">© 2026 TRACR · Sentinel AML Platform</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
