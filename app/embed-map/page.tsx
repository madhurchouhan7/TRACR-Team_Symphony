'use client'

import { useState, useEffect } from 'react'

export default function EmbedMapPage() {
  const [HeatmapComponent, setHeatmapComponent] = useState<any>(null)

  useEffect(() => {
    import('@/components/GlobalHeatmap').then((mod) => {
      setHeatmapComponent(() => mod.default)
    })
  }, [])

  return (
    <div className="w-full h-screen bg-[#020617] m-0 p-0 overflow-hidden">
      {HeatmapComponent ? (
        <HeatmapComponent 
          onCountryClick={(iso: string) => {
            // You can use standard Window messages to communicate up to the vanilla JS!
            window.parent.postMessage({ type: 'COUNTRY_CLICK', payload: iso }, '*')
          }} 
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-emerald-500 font-mono animate-pulse">
          Initializing Map Connect...
        </div>
      )}
    </div>
  )
}
