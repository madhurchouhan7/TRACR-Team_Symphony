'use client'

import dynamic from 'next/dynamic'

const GlobalHeatmap = dynamic(() => import('@/components/GlobalHeatmap'), { 
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center text-emerald-500 font-mono animate-pulse">Initializing Map...</div>
})
import Link from 'next/link'
import { Activity, ShieldAlert, Network, ArrowLeft } from 'lucide-react'

export default function AnalysisPage() {
  return (
    <div className="min-h-screen bg-[#020617] text-white p-6 font-mono selection:bg-emerald-500/30">
      
      {/* Top Navbar */}
      <header className="flex items-center justify-between border-b border-emerald-900/30 pb-6 mb-8">
        <div className="flex items-center gap-6">
          <Link 
            href="/"
            className="flex items-center justify-center w-10 h-10 rounded-lg hover:bg-emerald-900/20 text-emerald-500 transition-colors border border-emerald-900/0 hover:border-emerald-500/30"
          >
            <ArrowLeft size={18} />
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold tracking-[0.15em] text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              TRACR
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-emerald-500/60 font-bold mt-1">
              Command Center // Network Analysis
            </p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-950/30 border border-emerald-900/40">
            <Activity size={14} className="text-emerald-400" />
            <span className="text-xs uppercase tracking-wider text-emerald-100">Live Sync</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-2" />
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-950/30 border border-rose-900/40">
            <ShieldAlert size={14} className="text-rose-400" />
            <span className="text-xs uppercase tracking-wider text-rose-100">12 Threats</span>
          </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Sidebar (Filters/Stats) */}
        <div className="col-span-1 space-y-6">
          <div className="p-5 rounded-xl border border-emerald-900/30 bg-[#061121]/50 backdrop-blur-md">
            <h3 className="text-xs uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
              <Network size={14} />
              Global Telemetry
            </h3>
            
            <div className="space-y-4">
              <div className="pb-4 border-b border-emerald-900/20">
                <div className="text-[10px] text-slate-500 mb-1">Total Monitored Vol. (24h)</div>
                <div className="text-2xl font-light tracking-tight">$34.2B</div>
              </div>
              <div className="pb-4 border-b border-emerald-900/20">
                <div className="text-[10px] text-slate-500 mb-1">Anomalous Transfers</div>
                <div className="text-xl font-light text-rose-400">1,402 <span className="text-xs text-rose-500/50">+12%</span></div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 mb-1">High-Risk Nodes</div>
                <div className="text-xl font-light text-amber-400">42</div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-emerald-900/30 bg-[#061121]/50 backdrop-blur-md">
            <h3 className="text-xs uppercase tracking-widest text-slate-400 mb-4">
              System Console
            </h3>
            <div className="h-48 font-mono text-[10px] text-emerald-500/60 overflow-hidden flex flex-col justify-end">
              <div className="opacity-40">&gt; Authenticating connection... OK</div>
              <div className="opacity-60">&gt; Establishing secure tunnel... OK</div>
              <div className="opacity-80">&gt; Subscribing to node stream [x8f]... OK</div>
              <div className="text-emerald-400">&gt; Network Analysis Module Initialized.</div>
              <div className="text-emerald-400 animate-pulse mt-2">_</div>
            </div>
          </div>
        </div>

        {/* Right Main Panel (Map) */}
        <div className="col-span-1 lg:col-span-3">
          <div className="w-full h-[650px] rounded-xl overflow-hidden shadow-2xl relative group">
            
            {/* Map Container */}
            <GlobalHeatmap 
              onCountryClick={(iso) => console.log(`Drilling down on ${iso}`)}
            />
            
            {/* Decorative Corner Borders */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-emerald-500/50 rounded-tl-xl pointer-events-none" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-emerald-500/50 rounded-tr-xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-emerald-500/50 rounded-bl-xl pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-emerald-500/50 rounded-br-xl pointer-events-none" />
          </div>
        </div>

      </div>
    </div>
  )
}
