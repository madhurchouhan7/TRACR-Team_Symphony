'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Transaction {
  id: string
  from: string
  to: string
  amount: string
  status: 'SAFE' | 'SUSPICIOUS' | 'FRAUD'
  timestamp: string
  country: string
}

const SAFE_TRANSACTIONS: Omit<Transaction, 'id' | 'timestamp'>[] = [
  { from: 'USR_2183', to: 'USR_0419', amount: '₹3,50,000',  status: 'SAFE',       country: '🇮🇳' },
  { from: 'USR_7841', to: 'USR_3302', amount: '₹74,500',    status: 'SAFE',       country: '🇬🇧' },
  { from: 'USR_1109', to: 'USR_5567', amount: '₹10,42,000', status: 'SAFE',       country: '🇯🇵' },
  { from: 'USR_4420', to: 'USR_9981', amount: '₹26,800',    status: 'SAFE',       country: '🇸🇬' },
  { from: 'USR_6612', to: 'USR_1847', amount: '₹6,50,000',  status: 'SAFE',       country: '🇦🇪' },
  { from: 'USR_0332', to: 'USR_2211', amount: '₹45,90,000', status: 'SUSPICIOUS', country: '🇷🇺' },
  { from: 'USR_8810', to: 'USR_4430', amount: '₹1,65,800',  status: 'SAFE',       country: '🇩🇪' },
  { from: 'USR_3341', to: 'USR_7729', amount: '₹35,900',    status: 'SAFE',       country: '🇮🇳' },
  { from: 'USR_9920', to: 'USR_1108', amount: '₹19,20,000', status: 'SAFE',       country: '🇧🇷' },
]

const FRAUD_MESSAGES = [
  '⚠ CIRCULAR LOOP DETECTED | USR_0419 → USR_2183 → USR_0419',
  '⚠ SMURFING PATTERN | 43 micro-txn in 60s | HIGH RISK',
  '⚠ ANOMALY FLAGGED | Velocity +890% above baseline',
]

function getStatusColor(status: Transaction['status']) {
  if (status === 'SAFE') return 'text-emerald-400'
  if (status === 'SUSPICIOUS') return 'text-yellow-400'
  return 'text-red-400'
}

function getStatusBg(status: Transaction['status']) {
  if (status === 'SAFE') return 'bg-emerald-950/60 border-emerald-500/30'
  if (status === 'SUSPICIOUS') return 'bg-yellow-950/60 border-yellow-500/30'
  return 'bg-red-950/60 border-red-500/30'
}

export default function LiveFeed({ fraudActive }: { fraudActive: boolean }) {
  const [feed, setFeed] = useState<Transaction[]>([])
  const [fraudMsg, setFraudMsg] = useState<string | null>(null)
  const idRef = useRef(0)

  const addTransaction = useCallback(() => {
    const template = SAFE_TRANSACTIONS[Math.floor(Math.random() * SAFE_TRANSACTIONS.length)]
    const newTx: Transaction = {
      ...template,
      id: String(idRef.current++),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }
    // Keep max 8 items (was 12) — fewer DOM nodes = less paint
    setFeed((prev) => [newTx, ...prev].slice(0, 8))
  }, [])

  useEffect(() => {
    // Seed initial 4 items
    const initial: Transaction[] = SAFE_TRANSACTIONS.slice(0, 4).map((t) => ({
      ...t,
      id: String(idRef.current++),
      timestamp: new Date().toLocaleTimeString('en-US', { hour12: false }),
    }))
    setFeed(initial)

    // Slowed from 1800ms → 3000ms — visually still "live", half the re-renders
    const interval = setInterval(addTransaction, 3000)
    return () => clearInterval(interval)
  }, [addTransaction])

  useEffect(() => {
    if (!fraudActive) return
    const msg = FRAUD_MESSAGES[Math.floor(Math.random() * FRAUD_MESSAGES.length)]
    setFraudMsg(msg)
    const t = setTimeout(() => setFraudMsg(null), 3500)
    return () => clearTimeout(t)
  }, [fraudActive])

  return (
    <div
      className="glass rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(2, 6, 23, 0.75)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        width: '100%',
        maxWidth: '320px',
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(16,185,129,0.15)' }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold tracking-widest uppercase font-mono" style={{ color: '#10b981' }}>
            Live Intelligence Feed
          </span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full animate-blink" style={{ backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span className="text-xs font-mono" style={{ color: '#10b981' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* Fraud Alert — animate only this one element, not the whole list */}
      <AnimatePresence>
        {fraudMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mx-3 mt-3 rounded-lg px-3 py-2 overflow-hidden"
            style={{
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.5)',
              boxShadow: '0 0 20px rgba(239,68,68,0.2)',
            }}
          >
            <p className="text-xs font-mono font-semibold" style={{ color: '#ef4444' }}>
              🚨 ALERT: {fraudMsg}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed — CSS transition only, no per-item AnimatePresence */}
      <div className="px-3 py-3 space-y-2 overflow-y-auto" style={{ maxHeight: '340px' }}>
        {feed.map((tx, index) => (
          <div
            key={tx.id}
            className={`rounded-lg px-3 py-2 border ${getStatusBg(tx.status)}`}
            style={{
              opacity: index === 0 ? undefined : 1,
              animation: index === 0 ? 'feedIn 0.3s ease' : undefined,
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-mono text-slate-400">{tx.country} {tx.from} → {tx.to}</span>
              <span className="text-xs font-mono text-slate-500">{tx.timestamp}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold font-mono text-white">{tx.amount}</span>
              <span className={`text-xs font-mono font-bold ${getStatusColor(tx.status)}`}>
                [{tx.status}]
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer stats */}
      <div
        className="px-4 py-2 border-t grid grid-cols-3 gap-2"
        style={{ borderColor: 'rgba(16,185,129,0.1)', background: 'rgba(0,0,0,0.3)' }}
      >
        {[
          { label: 'TPS', value: '2.4K' },
          { label: 'Blocked', value: '12' },
          { label: 'Accuracy', value: '99.7%' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>{s.value}</p>
            <p className="text-xs font-mono text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
