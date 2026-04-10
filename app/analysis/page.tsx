'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Activity, ShieldAlert, Network, ArrowLeft } from 'lucide-react'

const GlobalHeatmap = dynamic(() => import('@/components/GlobalHeatmap'), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center text-gray-400 font-mono text-sm animate-pulse">
      Initializing Map Engine...
    </div>
  )
})

export default function AnalysisPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-white p-4 sm:p-6 font-sans selection:bg-indigo-500/30 relative">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 mesh-bg opacity-40 pointer-events-none" />
      <div className="fixed inset-0 grid-overlay opacity-30 pointer-events-none" />

      {/* Top Navbar - Responsive and Glassmorphic */}
      <header className="relative z-20 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[var(--glass-border)] pb-4 sm:pb-6 mb-6 sm:mb-8 gap-4 sm:gap-0">
        
        {/* Left Side: Brand & Navigation */}
        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
          <Link 
            href="/"
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border)] text-gray-400 hover:text-white transition-all shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          
          <div className="flex flex-col">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-500">
              TRACR
            </h1>
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest text-gray-500 font-semibold mt-0.5">
              Command Center // Network Analysis
            </p>
          </div>
        </div>

        {/* Right Side: Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          <div className="flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl glass border border-[var(--glass-border)] text-indigo-400">
            <Activity size={14} className="text-indigo-400" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-200">Live Sync</span>
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-1" />
          </div>
          <div className="flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-4 py-2 rounded-xl glass border border-rose-900/40" style={{ background: 'rgba(251, 113, 133, 0.05)' }}>
            <ShieldAlert size={14} className="text-rose-400" />
            <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-rose-200">12 Threats</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar (Filters/Stats) */}
        <div className="col-span-1 space-y-6">
          <div className="p-5 rounded-2xl glass flex flex-col h-full sm:h-auto">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
              <Network size={14} />
              Global Telemetry
            </h3>
            
            <div className="space-y-6">
              <div className="pb-5 border-b border-[var(--glass-border)]">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Total Monitored Vol. (24h)</div>
                <div className="text-2xl sm:text-3xl font-light tracking-tight text-white">$34.2B</div>
              </div>
              <div className="pb-5 border-b border-[var(--glass-border)]">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Anomalous Transfers</div>
                <div className="text-xl sm:text-2xl font-light text-rose-400 flex items-center gap-2">
                  1,402 
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    +12%
                  </span>
                </div>
              </div>
              <div className="pb-2">
                <div className="text-[11px] font-medium text-gray-500 mb-1.5 uppercase tracking-wide">High-Risk Nodes</div>
                <div className="text-xl sm:text-2xl font-light text-amber-400">42</div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-2xl glass">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
              System Console
            </h3>
            <div className="h-40 font-mono text-[10px] text-gray-400 overflow-hidden flex flex-col justify-end space-y-1">
              <div className="text-gray-600">&gt; Authenticating connection... OK</div>
              <div className="text-gray-500">&gt; Establishing secure tunnel... OK</div>
              <div className="text-gray-400">&gt; Subscribing to node stream [x8f]... OK</div>
              <div className="text-indigo-300 font-medium">&gt; Network Analysis Module Initialized.</div>
              <div className="text-indigo-400 animate-pulse mt-2">_</div>
            </div>
          </div>
        </div>

        {/* Right Main Panel (Map) */}
        <div className="col-span-1 lg:col-span-3">
          <div className="w-full h-[500px] sm:h-[650px] rounded-2xl overflow-hidden shadow-2xl relative group glass !p-0 border-[var(--glass-border)]">
            
            {/* Map Container */}
            <div className="absolute inset-0 opacity-80 mix-blend-screen filter saturate-50">
              <GlobalHeatmap 
                onCountryClick={(iso) => console.log(`Drilling down on ${iso}`)}
              />
            </div>

            {/* Premium Soft Gradients Overlay to frame map */}
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#050505] to-transparent pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#050505] to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#050505] to-transparent pointer-events-none" />
            <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#050505] to-transparent pointer-events-none" />
            
          </div>
        </div>

      </div>
    </div>
  )
}
