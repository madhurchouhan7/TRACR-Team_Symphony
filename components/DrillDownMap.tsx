'use client'
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'

// Bounding boxes per country for Leaflet flyToBounds
const COUNTRY_BOUNDS: Record<string, [[number, number], [number, number]]> = {
  us: [[24.396308, -125.0], [49.384358, -66.93457]],
  gb: [[49.674, -8.175], [60.86, 1.762]],
  in: [[6.7, 68.1], [35.5, 97.4]],
  cn: [[18.2, 73.5], [53.5, 134.7]],
  sg: [[1.16, 103.6], [1.47, 104.0]],
  ch: [[45.8, 5.9], [47.8, 10.5]],
  jp: [[30.9, 129.4], [45.5, 145.8]],
  de: [[47.3, 5.9], [55.0, 15.0]],
  fr: [[41.3, -5.1], [51.1, 9.6]],
  au: [[-43.6, 113.3], [-10.6, 153.6]],
  br: [[-33.7, -73.9], [5.3, -34.7]],
  mx: [[14.5, -117.1], [32.7, -86.7]],
  za: [[-34.8, 16.4], [-22.1, 32.9]],
  ng: [[4.2, 2.7], [13.9, 14.7]],
  sa: [[16.4, 36.5], [32.2, 55.7]],
  tr: [[35.8, 25.7], [42.1, 44.8]],
  ru: [[41.2, 19.6], [81.9, 180.0]],
}

// Mock DFS node data per country (state-level network simulation)
const MOCK_STATE_NODES: Record<string, Array<{name: string; lat: number; lng: number; isHighRisk: boolean; isHub: boolean}>> = {
  us: [
    { name: 'New York', lat: 40.71, lng: -74.00, isHighRisk: true, isHub: true },
    { name: 'California', lat: 36.77, lng: -119.41, isHighRisk: false, isHub: false },
    { name: 'Texas', lat: 31.96, lng: -99.9, isHighRisk: true, isHub: false },
    { name: 'Florida', lat: 27.99, lng: -81.76, isHighRisk: true, isHub: false },
    { name: 'Illinois', lat: 40.63, lng: -89.39, isHighRisk: false, isHub: false },
    { name: 'Nevada', lat: 38.80, lng: -116.4, isHighRisk: true, isHub: false },
    { name: 'Delaware', lat: 38.91, lng: -75.52, isHighRisk: false, isHub: true },
  ],
  gb: [
    { name: 'London', lat: 51.50, lng: -0.12, isHighRisk: true, isHub: true },
    { name: 'Manchester', lat: 53.48, lng: -2.24, isHighRisk: false, isHub: false },
    { name: 'Edinburgh', lat: 55.95, lng: -3.19, isHighRisk: true, isHub: false },
    { name: 'Birmingham', lat: 52.48, lng: -1.90, isHighRisk: false, isHub: false },
    { name: 'Bristol', lat: 51.45, lng: -2.59, isHighRisk: true, isHub: false },
  ],
  in: [
    { name: 'Maharashtra', lat: 19.75, lng: 75.71, isHighRisk: false, isHub: true },
    { name: 'Delhi', lat: 28.65, lng: 77.22, isHighRisk: true, isHub: false },
    { name: 'Karnataka', lat: 15.31, lng: 75.71, isHighRisk: false, isHub: false },
    { name: 'Gujarat', lat: 22.25, lng: 71.19, isHighRisk: true, isHub: false },
    { name: 'Tamil Nadu', lat: 11.12, lng: 78.65, isHighRisk: false, isHub: false },
    { name: 'Kerala', lat: 10.85, lng: 76.27, isHighRisk: false, isHub: false },
    { name: 'Rajasthan', lat: 27.02, lng: 74.21, isHighRisk: true, isHub: false },
    { name: 'Punjab', lat: 31.14, lng: 75.34, isHighRisk: true, isHub: false },
    { name: 'Uttar Pradesh', lat: 26.84, lng: 80.94, isHighRisk: true, isHub: false },
    { name: 'Telangana', lat: 18.11, lng: 79.01, isHighRisk: false, isHub: false },
    { name: 'West Bengal', lat: 22.98, lng: 87.85, isHighRisk: true, isHub: false },
    { name: 'Madhya Pradesh', lat: 22.97, lng: 78.65, isHighRisk: false, isHub: false },
    { name: 'Assam', lat: 26.20, lng: 92.93, isHighRisk: false, isHub: false },
    { name: 'Odisha', lat: 20.95, lng: 85.09, isHighRisk: false, isHub: false },
    { name: 'Bihar', lat: 25.09, lng: 85.31, isHighRisk: false, isHub: false },
  ],
  cn: [
    { name: 'Shanghai', lat: 31.22, lng: 121.46, isHighRisk: true, isHub: true },
    { name: 'Guangdong', lat: 23.37, lng: 113.50, isHighRisk: false, isHub: false },
    { name: 'Beijing', lat: 39.90, lng: 116.40, isHighRisk: true, isHub: false },
    { name: 'Fujian', lat: 26.07, lng: 117.98, isHighRisk: false, isHub: false },
    { name: 'Yunnan', lat: 24.47, lng: 101.34, isHighRisk: true, isHub: false },
  ],
  jp: [
    { name: 'Tokyo', lat: 35.68, lng: 139.69, isHighRisk: true, isHub: true },
    { name: 'Osaka', lat: 34.69, lng: 135.50, isHighRisk: false, isHub: false },
    { name: 'Hokkaido', lat: 43.06, lng: 141.35, isHighRisk: false, isHub: false },
    { name: 'Fukuoka', lat: 33.59, lng: 130.40, isHighRisk: true, isHub: false },
  ],
  de: [
    { name: 'Berlin', lat: 52.52, lng: 13.40, isHighRisk: true, isHub: true },
    { name: 'Bavaria', lat: 48.79, lng: 11.49, isHighRisk: false, isHub: false },
    { name: 'Hamburg', lat: 53.55, lng: 10.00, isHighRisk: false, isHub: false },
    { name: 'Frankfurt', lat: 50.11, lng: 8.68, isHighRisk: true, isHub: false },
  ],
  default: [
    { name: 'Region Alpha', lat: 0, lng: 0, isHighRisk: true, isHub: true },
    { name: 'Region Beta', lat: 2, lng: 3, isHighRisk: false, isHub: false },
    { name: 'Region Gamma', lat: -2, lng: 5, isHighRisk: true, isHub: false },
    { name: 'Region Delta', lat: 4, lng: -2, isHighRisk: false, isHub: false },
  ],
}

interface DrillDownMapProps {
  countryIso2: string
  countryName: string
  onBack: () => void
}

// Extracted outside component to avoid SWC hot-reload parsing issues with
// template literals inside dynamic import callbacks
function buildMarkerHtml(name: string, size: number, color: string, pulseRing: boolean, isHighRisk: boolean, isHub: boolean): string {
  const pulse = pulseRing
    ? ['<div style="position:absolute;width:', size * 2.5, 'px;height:', size * 2.5, 'px;border-radius:50%;background:', color,
        '22;border:1px solid ', color, '55;animation:dfs-pulse 2s infinite;"></div>'].join('')
    : ''
  const badge = name + (isHighRisk ? ' \u26a0' : isHub ? ' \u25c9' : '')
  return [
    '<div style="position:relative;display:flex;align-items:center;justify-content:center;width:', size * 3, 'px;height:', size * 3, 'px;">',
    pulse,
    '<div style="width:', size, 'px;height:', size, 'px;border-radius:50%;background:', color, ';border:2px solid #fff;box-shadow:0 0 ',
    isHighRisk ? 10 : 5, 'px ', color, ';cursor:pointer;position:relative;z-index:10;"></div>',
    '<div style="position:absolute;bottom:', size + 8, 'px;left:50%;transform:translateX(-50%);background:rgba(2,6,23,0.93);border:1px solid ', color,
    '55;border-radius:3px;padding:2px 6px;font-size:9px;font-family:monospace;font-weight:800;color:', color,
    ';white-space:nowrap;text-transform:uppercase;letter-spacing:.08em;pointer-events:none;">', badge, '</div>',
    '</div>',
  ].join('')
}

function buildPopupHtml(name: string, idx: number, color: string, isHighRisk: boolean, isHub: boolean): string {
  const flaggedTxns = Math.floor(Math.random() * 500 + 10)
  const volume = (Math.random() * 5 + 0.5).toFixed(1)
  return [
    '<div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#020617;border:1px solid ', color,
    '44;padding:10px;border-radius:8px;min-width:160px;">',
    '<div style="font-weight:800;font-size:13px;color:', color, ';margin-bottom:4px;">', name, '</div>',
    '<div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;">DFS Node #', idx + 1, '</div>',
    '<div style="display:flex;align-items:center;gap:5px;">',
    '<div style="width:5px;height:5px;border-radius:50%;background:', color, '"></div>',
    '<span style="color:', isHighRisk ? '#ef4444' : '#10b981', ';font-size:10px;">', isHighRisk ? '\u26a0 HIGH RISK' : '\u2713 CLEAR', '</span>',
    '</div>',
    isHub ? '<div style="color:#3b82f6;margin-top:4px;font-size:9px;">\u29c1 PRIMARY HUB</div>' : '',
    '<div style="margin-top:6px;padding-top:6px;border-top:1px solid #1e293b;color:#64748b;font-size:9px;">',
    'Flagged Txns: ', flaggedTxns, '<br/>Volume: $', volume, 'M</div></div>',
  ].join('')
}

export default function DrillDownMap({ countryIso2, countryName, onBack }: DrillDownMapProps) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let destroyed = false

    // Inject Leaflet CSS if not already present
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }

    // Dynamically import Leaflet (SSR-safe) and topojson-client
    Promise.all([
      import('leaflet'),
      import('topojson-client'),
    ]).then(([L, { feature }]) => {
      if (destroyed || !mapContainerRef.current) return

      // Fix Leaflet default icon paths (Next.js webpack quirk)
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const bounds = COUNTRY_BOUNDS[countryIso2]
      const initialCenter: [number, number] = bounds
        ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
        : [20, 0]

      // Build Leaflet map with dark CartoDB tiles
      const map = L.map(mapContainerRef.current!, {
        center: initialCenter,
        zoom: 4,
        zoomControl: true,
        attributionControl: false,
        fadeAnimation: true,
        zoomAnimation: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map)

      mapRef.current = map

      // Animate flyTo country bounds
      if (bounds) {
        setTimeout(() => {
          if (!destroyed) map.flyToBounds(bounds, { duration: 1.2, easeLinearity: 0.25, padding: [30, 30] })
        }, 150)
      }

      // ── Load state boundaries from Highcharts TopoJSON (verified working) ──
      const stateTopoUrl = `https://code.highcharts.com/mapdata/countries/${countryIso2}/${countryIso2}-all.topo.json`

      fetch(stateTopoUrl)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
        .then((topo: any) => {
          if (destroyed || !map) return

          if (topo) {
            // Convert topojson → geojson for Leaflet
            const objKey = Object.keys(topo.objects)[0]
            const geojson = feature(topo, topo.objects[objKey]) as any

            L.geoJSON(geojson, {
              style: {
                color: '#10b981',
                weight: 1,
                opacity: 0.65,
                fillColor: '#052e16',
                fillOpacity: 0.45,
              },
              onEachFeature: (_feat: any, layer: any) => {
                const tooltipName = _feat.properties?.name || _feat.properties?.['hc-a2'] || ''
                if (tooltipName) {
                  const tooltipHtml = '<span style="font-family:monospace;font-size:9px;color:#10b981;text-transform:uppercase;letter-spacing:.1em">' + tooltipName + '</span>'
                  layer.bindTooltip(tooltipHtml, {
                    permanent: false,
                    sticky: true,
                    className: 'leaflet-dark-tooltip',
                    offset: [10, 0],
                  })
                }
                layer.on('mouseover', function (this: any) {
                  this.setStyle({ fillColor: '#064e3b', fillOpacity: 0.75, color: '#34d399', weight: 1.5 })
                })
                layer.on('mouseout', function (this: any) {
                  this.setStyle({ fillColor: '#052e16', fillOpacity: 0.45, color: '#10b981', weight: 1 })
                })
              },
            }).addTo(map)
          }

          // ── Plot Algorithmic Patterns (Circuling & Smurfing) ──
          const nodes = MOCK_STATE_NODES[countryIso2] || MOCK_STATE_NODES['default']

          // Helper to draw directed patterned edges
          const drawEdge = (src: any, dst: any, color: string, weight: number, dashArray?: string, opacity: number = 0.85) => {
            if (!src || !dst) return;
            
            // Render glow background layer
            L.polyline([[src.lat, src.lng], [dst.lat, dst.lng]], {
              color, weight: weight * 3.5, opacity: opacity * 0.25
            }).addTo(map)

            // Render primary sharply detailed foreground layer
            L.polyline([[src.lat, src.lng], [dst.lat, dst.lng]], {
              color, weight, opacity, dashArray,
              className: dashArray ? 'animated-edge-flow' : ''
            }).addTo(map)

            const midLat = (src.lat + dst.lat) / 2
            const midLng = (src.lng + dst.lng) / 2
            const angle = Math.atan2(src.lat - dst.lat, dst.lng - src.lng) * (180 / Math.PI)
            
            const arrowHtml = `<div style="transform: rotate(${angle}deg); width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; opacity: ${opacity};"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 4px ${color});"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>`
            const arrowIcon = L.divIcon({ className: '', html: arrowHtml, iconSize: [14, 14], iconAnchor: [7, 7] })
            L.marker([midLat, midLng], { icon: arrowIcon, interactive: false }).addTo(map)
          }

          // ALGORITHM 1: CIRCULAR TRADING (Layering Ring)
          const highRiskNodes = nodes.filter(n => n.isHighRisk)
          if (highRiskNodes.length >= 2) {
            for (let i = 0; i < highRiskNodes.length; i++) {
              const src = highRiskNodes[i]
              const dst = highRiskNodes[(i + 1) % highRiskNodes.length]
              drawEdge(src, dst, '#ef4444', 2.5, '4 6', 0.9) // Red dashed ring (Circular Trading)
            }
          }

          // ALGORITHM 2: SMURFING (Structuring into Hub)
          const originNode = nodes.find(n => !n.isHighRisk && !n.isHub)
          const hubNode = nodes.find(n => n.isHub) || nodes[0]
          const smurfs = nodes.filter(n => !n.isHighRisk && n !== originNode && n !== hubNode)

          if (originNode && hubNode && smurfs.length > 0) {
            smurfs.forEach(smurf => {
              // Origin -> Smurf (Placement)
              drawEdge(originNode, smurf, '#3b82f6', 1.5, '2 4', 0.6) 
              // Smurf -> Hub (Integration)
              drawEdge(smurf, hubNode, '#8b5cf6', 2, undefined, 0.9) 
            })
          }

          // Fallback connection for remaining disconnected nodes
          const connected = new Set([...highRiskNodes, originNode, hubNode, ...smurfs])
          nodes.forEach(n => {
            if (!connected.has(n)) {
               drawEdge(n, hubNode, '#10b981', 1.5, undefined, 0.7)
            }
          })

          // Draw DFS circle markers
          nodes.forEach((node, idx) => {
            const color = node.isHighRisk ? '#ef4444' : (node.isHub ? '#3b82f6' : '#8b5cf6')
            const size = node.isHub ? 14 : (node.isHighRisk ? 12 : 8)
            const pulseRing = node.isHighRisk || node.isHub

            const icon = L.divIcon({
              className: '',
              html: buildMarkerHtml(node.name, size, color, pulseRing, node.isHighRisk, node.isHub),
              iconSize: [size * 3, size * 3],
              iconAnchor: [size * 1.5, size * 1.5],
            })

            const marker = L.marker([node.lat, node.lng], { icon }).addTo(map)
            marker.bindPopup(
              buildPopupHtml(node.name, idx, color, node.isHighRisk, node.isHub),
              { className: 'leaflet-dark-popup', maxWidth: 220 }
            )
          })

          setIsLoaded(true)
        })
    })

    return () => {
      destroyed = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [countryIso2])

  return (
    <div className="relative w-full h-full">
      {/* Custom styles (Leaflet CSS loaded via link in useEffect) */}
      <style>{`
        .leaflet-container { background: #020617 !important; font-family: monospace; }
        .leaflet-dark-popup .leaflet-popup-content-wrapper {
          background: #020617 !important; border: 1px solid #1e293b !important;
          border-radius: 10px !important; box-shadow: 0 0 20px rgba(16,185,129,0.15) !important; padding: 0 !important;
        }
        .leaflet-dark-popup .leaflet-popup-tip-container { display: none; }
        .leaflet-dark-popup .leaflet-popup-content { margin: 0 !important; }
        .leaflet-dark-tooltip {
          background: rgba(2,6,23,0.9) !important; border: 1px solid #064e3b !important;
          border-radius: 3px !important; color: #10b981 !important; box-shadow: none !important;
          padding: 2px 6px !important; font-size: 9px !important;
        }
        .leaflet-dark-tooltip::before { display: none !important; }
        .leaflet-control-zoom { border: 1px solid #1e293b !important; background: #020617 !important; }
        .leaflet-control-zoom a { color: #10b981 !important; background: #020617 !important; border-color: #1e293b !important; line-height: 26px !important; }
        .leaflet-control-zoom a:hover { background: #052e16 !important; }
        @keyframes dfs-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.15; }
        }
        @keyframes dash-flow {
          to { stroke-dashoffset: -30; }
        }
        path.animated-edge-flow {
          animation: dash-flow 0.8s linear infinite;
        }
      `}</style>

      {/* Map canvas */}
      <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: 400, zIndex: 1 }} />

      {/* Loading spinner overlay */}
      <AnimatePresence>
        {!isLoaded && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.5 } }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#020617]"
          >
            <div className="w-9 h-9 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-mono text-xs text-emerald-400/70 tracking-widest uppercase">
              Loading {countryName} boundaries…
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header bar */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3 pointer-events-auto"
        style={{ background: 'linear-gradient(to bottom, rgba(2,6,23,0.97) 0%, rgba(2,6,23,0) 100%)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-xs text-slate-400 uppercase tracking-widest">DFS Network — Drill-Down</span>
          <span className="font-mono text-sm text-emerald-400 font-bold tracking-wider">{countryName}</span>
        </div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-1.5 bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-700/40 rounded-lg text-emerald-400 font-mono text-xs tracking-wider transition-colors shadow-lg backdrop-blur-md cursor-pointer"
        >
          <ArrowLeft size={13} />
          Global View
        </button>
      </motion.div>

      {/* Algorithmic Legend */}
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="absolute bottom-6 right-4 z-30 font-mono text-[10px] space-y-1.5 bg-[#020617]/90 border border-emerald-900/30 rounded-lg p-3 pointer-events-none"
      >
        <div className="text-slate-500 uppercase tracking-widest mb-2 text-[9px]">AML Algorithmic Detection</div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border border-white/30" />
          <span className="text-slate-400">Primary Hub/Shell</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-white/30" />
          <span className="text-red-400">Flagged Target</span>
        </div>
        <div className="flex items-center gap-2 pt-1 border-t border-white/10">
          <div className="w-5 h-px bg-red-500 opacity-90" style={{ borderTop: '2px dashed #ef4444', background: 'none' }} />
          <span className="text-red-400 font-bold">Circular Trading</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-px bg-blue-500 opacity-60" style={{ borderTop: '1.5px dashed #3b82f6', background: 'none' }} />
          <span className="text-blue-400">Smurfing (Placement)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-px bg-purple-500 opacity-90" />
          <span className="text-purple-400">Smurfing (Integration)</span>
        </div>
      </motion.div>
    </div>
  )
}
