'use client'
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  ZoomableGroup,
  Marker
} from 'react-simple-maps'
import { scaleLinear } from 'd3-scale'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, ShieldCheck } from 'lucide-react'

// Lazy-load Leaflet DrillDownMap (avoids SSR issues)
const DrillDownMap = lazy(() => import('./DrillDownMap'))

// Topology JSON for the world map
const GLOBAL_GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"

// --- Mock Data ---
const RISK_COUNTRIES = ['CYM', 'PAN', 'VGB', 'BHS', 'CHE', 'SGP']

// world-atlas 110m uses ISO 3166-1 numeric IDs — map to ISO2 for Leaflet drill-down
const numericToIso2: Record<string, string> = {
  '840': 'us',  // United States
  '826': 'gb',  // United Kingdom
  '356': 'in',  // India
  '756': 'ch',  // Switzerland
  '702': 'sg',  // Singapore
  '156': 'cn',  // China
  '392': 'jp',  // Japan
  '276': 'de',  // Germany
  '250': 'fr',  // France
  '036': 'au',  // Australia
  '076': 'br',  // Brazil
  '484': 'mx',  // Mexico
  '710': 'za',  // South Africa
  '566': 'ng',  // Nigeria
  '682': 'sa',  // Saudi Arabia
  '792': 'tr',  // Turkey
  '643': 'ru',  // Russia
}

const numericToName: Record<string, string> = {
  '840': 'United States', '826': 'United Kingdom', '356': 'India',
  '756': 'Switzerland', '702': 'Singapore', '156': 'China',
  '392': 'Japan', '276': 'Germany', '250': 'France', '036': 'Australia',
  '076': 'Brazil', '484': 'Mexico', '710': 'South Africa', '566': 'Nigeria',
  '682': 'Saudi Arabia', '792': 'Turkey', '643': 'Russia',
}

interface CountryData {
  iso: string
  name: string
  volume: number
  riskLevel: 'high' | 'low'
  flaggedAccounts: number
}

interface FlowArc {
  id: string
  src: [number, number]
  dst: [number, number]
  isFraud: boolean
}

interface DFSNode {
  id: string
  coordinates: [number, number]
  isHighRisk?: boolean
  isHub?: boolean
  label?: string
}

const mockData: CountryData[] = [
  { iso: 'USA', name: 'United States', volume: 5000000, riskLevel: 'low', flaggedAccounts: 12 },
  { iso: 'GBR', name: 'United Kingdom', volume: 3200000, riskLevel: 'low', flaggedAccounts: 5 },
  { iso: 'CYM', name: 'Cayman Islands', volume: 8000000, riskLevel: 'high', flaggedAccounts: 890 },
  { iso: 'SGP', name: 'Singapore', volume: 4500000, riskLevel: 'high', flaggedAccounts: 112 },
  { iso: 'CHE', name: 'Switzerland', volume: 6200000, riskLevel: 'high', flaggedAccounts: 45 },
  { iso: 'IND', name: 'India', volume: 1500000, riskLevel: 'low', flaggedAccounts: 2 },
  { iso: 'PAN', name: 'Panama', volume: 9500000, riskLevel: 'high', flaggedAccounts: 1540 },
  { iso: 'CHN', name: 'China', volume: 2200000, riskLevel: 'low', flaggedAccounts: 8 },
]

const mockFlows: FlowArc[] = [
  { id: '1', src: [-74.006, 40.7128], dst: [-81.2546, 19.3133], isFraud: true },  // US → Cayman
  { id: '2', src: [-0.1278, 51.5074], dst: [8.5417, 47.3769], isFraud: false },   // UK → SWZ
  { id: '3', src: [103.8198, 1.3521], dst: [-79.5199, 8.9824], isFraud: true },   // SGP → PAN
  { id: '4', src: [-0.1278, 51.5074], dst: [-74.006, 40.7128], isFraud: false },  // UK → US
  { id: '5', src: [-0.1278, 51.5074], dst: [103.8198, 1.3521], isFraud: false },  // UK → SGP
]

const dfsNodes: DFSNode[] = [
  { id: 'US', coordinates: [-74.006, 40.7128] },
  { id: 'CYM', coordinates: [-81.2546, 19.3133], isHighRisk: true, label: 'HIGH RISK: SHELL CORP XE' },
  { id: 'UK', coordinates: [-0.1278, 51.5074], isHub: true, label: 'PRIMARY HUB: AZ-902' },
  { id: 'SWZ', coordinates: [8.5417, 47.3769] },
  { id: 'SGP', coordinates: [103.8198, 1.3521], isHub: true },
  { id: 'PAN', coordinates: [-79.5199, 8.9824], isHighRisk: true },
]

const colorScale = scaleLinear<string>()
  .domain([0, 10000000])
  .range(['#064e3b', '#10b981'])

export default function GlobalHeatmap({ onCountryClick }: { onCountryClick?: (iso: string) => void }) {
  const [data, setData] = useState<CountryData[]>([])
  const [hoveredCountry, setHoveredCountry] = useState<CountryData | null>(null)
  const [activeFraud, setActiveFraud] = useState(false)

  // Drill-down: store selected country (ISO2 + name) — null = global view
  const [drillCountry, setDrillCountry] = useState<{ iso2: string; name: string } | null>(null)

  const [position, setPosition] = useState({ coordinates: [0, 10] as [number, number], zoom: 1 })
  const [filterActive, setFilterActive] = useState(false)

  useEffect(() => {
    setTimeout(() => setData(mockData), 500)
    const interval = setInterval(() => setActiveFraud(p => !p), 2000)

    const handleMessage = (e: MessageEvent) => {
      if (!e.data || !e.data.cmd) return;
      const cmd = e.data.cmd;
      if (cmd === 'zoom_in') setPosition(p => ({ ...p, zoom: Math.min(p.zoom * 1.5, 8) }))
      if (cmd === 'zoom_out') setPosition(p => ({ ...p, zoom: Math.max(p.zoom / 1.5, 1) }))
      if (cmd === 'zoom_reset') setPosition({ coordinates: [0, 10], zoom: 1 })
      if (cmd === 'toggle_filter') setFilterActive(prev => !prev)
    }
    window.addEventListener('message', handleMessage);

    return () => {
      clearInterval(interval)
      window.removeEventListener('message', handleMessage)
    }
  }, [])

  const dataMap = useMemo(() => {
    return data.reduce((acc, curr) => {
      acc[curr.iso] = curr
      return acc
    }, {} as Record<string, CountryData>)
  }, [data])

  return (
    <div className="relative w-full h-full min-h-[500px] bg-[#020617] rounded-xl overflow-hidden border border-emerald-900/30">

      {/* ── DRILL-DOWN LAYER (Leaflet) ─────────────────────────────────── */}
      <AnimatePresence>
        {drillCountry && (
          <motion.div
            key="drilldown"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="absolute inset-0 z-20"
          >
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center bg-[#020617]">
                <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            }>
              <DrillDownMap
                countryIso2={drillCountry.iso2}
                countryName={drillCountry.name}
                onBack={() => setDrillCountry(null)}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GLOBAL WORLD MAP (react-simple-maps) ──────────────────────── */}
      <AnimatePresence>
        {!drillCountry && (
          <motion.div
            key="globalmap"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0 z-10"
          >
            {/* Map Overlay Header */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <h3 className="text-emerald-400 font-mono text-sm tracking-widest uppercase mb-1">
                Global Fund Flow
              </h3>
              <div className="flex gap-4 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Standard Flow
                </div>
                <div className="flex items-center gap-2 text-rose-500">
                  <div className={`w-2 h-2 rounded-full bg-rose-500 ${activeFraud ? 'animate-ping' : ''}`} />
                  High-Risk/Flagged
                </div>
              </div>
            </div>

            {/* Click hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <span className="font-mono text-[10px] text-slate-500 tracking-widest uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Click any country to drill into its regional DFS network
              </span>
            </div>

            <ComposableMap
              projectionConfig={{ scale: 160 }}
              width={800}
              height={450}
              className="w-full h-full"
            >
              <defs>
                <marker id="arrow-fraud" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
                </marker>
                <marker id="arrow-safe" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#10b981" />
                </marker>
              </defs>
              <ZoomableGroup
                zoom={position.zoom}
                center={position.coordinates as [number, number]}
                onMoveEnd={({ coordinates, zoom }) => setPosition({ coordinates: coordinates as [number, number], zoom })}
              >
                <Geographies geography={GLOBAL_GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const numId = String(geo.id || '')
                      const countryIso = numId
                      const cData = dataMap[numId]
                      const isHighRisk = cData?.riskLevel === 'high' || false
                      const hasDrillDown = !!numericToIso2[numId]

                      let fill = cData ? colorScale(cData.volume) : '#0f172a'
                      let stroke = isHighRisk ? '#ef4444' : '#1e293b'

                      if (filterActive && !isHighRisk) {
                        fill = '#020617'
                        stroke = '#020617' // hide borders of clean countries to emphasize network
                      }

                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={isHighRisk ? 1.5 : 0.5}
                          style={{
                            default: {
                              outline: 'none',
                              transition: 'fill 200ms',
                              filter: isHighRisk
                                ? 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.4))'
                                : 'none',
                            },
                            hover: {
                              fill: isHighRisk ? '#991b1b' : (hasDrillDown ? '#0f766e' : '#1e3a5f'),
                              outline: 'none',
                              cursor: hasDrillDown ? 'pointer' : 'default',
                              filter: isHighRisk
                                ? 'drop-shadow(0 0 12px rgba(239, 68, 68, 0.8))'
                                : (hasDrillDown ? 'drop-shadow(0 0 8px rgba(20, 184, 166, 0.5))' : 'none'),
                            },
                            pressed: { fill: '#06b6d4', outline: 'none' },
                          }}
                          onMouseEnter={() => { if (cData) setHoveredCountry(cData) }}
                          onMouseLeave={() => setHoveredCountry(null)}
                          onClick={() => {
                            const iso2 = numericToIso2[numId]
                            const name = numericToName[numId] || (geo.properties as any).name || numId
                            if (iso2) setDrillCountry({ iso2, name })
                            if (onCountryClick && countryIso) onCountryClick(countryIso)
                          }}
                        />
                      )
                    })
                  }
                </Geographies>

                {/* Animated Flow Arcs */}
                {mockFlows
                  .filter(flow => !filterActive || flow.isFraud)
                  .map((flow) => (
                  <g key={flow.id}>
                    <Line
                      from={flow.src} to={flow.dst}
                      stroke={flow.isFraud ? '#7f1d1d' : '#064e3b'}
                      strokeWidth={1} strokeLinecap="round"
                      style={{ opacity: 0.3 }}
                    />
                    <Line
                      from={flow.src} to={flow.dst}
                      stroke={flow.isFraud ? '#ef4444' : '#10b981'}
                      strokeWidth={2} strokeLinecap="round"
                      markerEnd={flow.isFraud ? 'url(#arrow-fraud)' : 'url(#arrow-safe)'}
                      style={{
                        filter: `drop-shadow(0 0 6px ${flow.isFraud ? '#ef4444' : '#10b981'})`,
                        strokeDasharray: 200,
                        strokeDashoffset: activeFraud ? 0 : 200,
                        transition: 'stroke-dashoffset 2s linear',
                      }}
                    />
                  </g>
                ))}

                {/* DFS Nodes */}
                {dfsNodes
                  .filter(node => !filterActive || node.isHighRisk)
                  .map((node) => (
                  <Marker key={node.id} coordinates={node.coordinates}>
                    {node.isHighRisk && (
                      <circle r={8} fill="rgba(239, 68, 68, 0.3)" />
                    )}
                    <circle
                      r={node.isHub ? 5 : (node.isHighRisk ? 6 : 3)}
                      fill={node.isHighRisk ? '#ef4444' : (node.isHub ? '#3b82f6' : '#4f46e5')}
                      stroke="#ffffff" strokeWidth={1}
                    />
                    {node.label && (
                      <g transform={`translate(${node.isHighRisk ? -60 : 8}, ${node.isHighRisk ? 15 : -8})`}>
                        <rect x={0} y={0} width={node.isHighRisk ? 150 : 120} height={16} fill="#ffffff" rx={2} opacity={0.95} />
                        <circle cx={8} cy={8} r={2.5} fill={node.isHighRisk ? '#ef4444' : '#3b82f6'} />
                        <text
                          textAnchor="start" x={15} y={11}
                          style={{ fontSize: '7px', fill: node.isHighRisk ? '#ef4444' : '#1e293b', fontWeight: '800', fontFamily: 'monospace' }}
                        >
                          {node.label}
                        </text>
                      </g>
                    )}
                  </Marker>
                ))}
              </ZoomableGroup>
            </ComposableMap>

            {/* Hover Tooltip Panel */}
            <AnimatePresence>
              {hoveredCountry && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-6 right-6 z-50 p-4 rounded-xl border font-mono backdrop-blur-xl w-64 shadow-2xl pointer-events-none"
                  style={{
                    background: hoveredCountry.riskLevel === 'high' ? 'rgba(69, 10, 10, 0.8)' : 'rgba(2, 44, 34, 0.8)',
                    borderColor: hoveredCountry.riskLevel === 'high' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.4)',
                  }}
                >
                  <div className="flex justify-between items-start mb-3 border-b pb-2 border-white/10">
                    <h4 className="text-white font-bold tracking-wider">{hoveredCountry.name}</h4>
                    <span className="text-[10px] text-white/50">{hoveredCountry.iso}</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Volume</div>
                      <div className="text-lg font-bold text-white">${hoveredCountry.volume.toLocaleString()}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Risk Level</div>
                        <div className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${hoveredCountry.riskLevel === 'high' ? 'text-rose-500' : 'text-emerald-400'}`}>
                          {hoveredCountry.riskLevel === 'high' ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                          {hoveredCountry.riskLevel}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Flagged</div>
                        <div className={`text-sm font-bold ${hoveredCountry.flaggedAccounts > 100 ? 'text-rose-500' : 'text-emerald-400'}`}>
                          {hoveredCountry.flaggedAccounts}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
