'use client'

import { useRef, useMemo, useEffect, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Helpers ────────────────────────────────────────────────────────────────

function latLng(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  )
}

// ─── Minimal inline TopoJSON decoder (no extra package) ─────────────────────

type TopoJSON = {
  transform: { scale: [number, number]; translate: [number, number] }
  objects: {
    countries: {
      geometries: Array<{
        type: 'Polygon' | 'MultiPolygon'
        arcs: number[][][] | number[][][][]
      }>
    }
  }
  arcs: number[][][]
}

function decodeTopo(topo: TopoJSON): [number, number][][] {
  const { scale, translate } = topo.transform

  // Delta-decode integer arcs → [lng, lat] pairs
  const decoded: [number, number][][] = topo.arcs.map(arc => {
    let x = 0, y = 0
    return arc.map(([dx, dy]) => {
      x += dx; y += dy
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as [number, number]
    })
  })

  const rings: [number, number][][] = []

  for (const geom of topo.objects.countries.geometries) {
    const polys: number[][][] =
      geom.type === 'Polygon'
        ? [geom.arcs as unknown as number[][]]
        : (geom.arcs as unknown as number[][][])

    for (const poly of polys) {
      for (const ring of poly) {
        const pts: [number, number][] = []
        for (const idx of ring) {
          const arc = idx >= 0 ? decoded[idx] : [...decoded[~idx]].reverse()
          pts.push(...arc.slice(0, -1))          // drop last (overlap with next)
        }
        if (pts.length) rings.push(pts)
      }
    }
  }
  return rings
}

// ─── World Map Lines ─────────────────────────────────────────────────────────

function WorldMapLines() {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null)

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(r => r.json())
      .then((topo: TopoJSON) => {
        const rings = decodeTopo(topo)
        const pts: THREE.Vector3[] = []

        for (const ring of rings) {
          for (const [lng, lat] of ring)
            pts.push(latLng(lat, lng, 1.003))
          // Close ring + NaN break so lines don't connect across countries
          if (ring.length) pts.push(latLng(ring[0][1], ring[0][0], 1.003))
          pts.push(new THREE.Vector3(NaN, NaN, NaN))
        }

        const g = new THREE.BufferGeometry().setFromPoints(pts)
        // Manually set bounding sphere — NaN break-points make auto-compute fail
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2)
        setGeo(g)
      })
      .catch(() => {/* fail silently */ })
  }, [])

  if (!geo) return null

  return (
    // @ts-expect-error: line JSX element
    <line geometry={geo}>
      <lineBasicMaterial color="#10b981" transparent opacity={0.28} depthWrite={false} />
    </line>
  )
}

// ─── City nodes ──────────────────────────────────────────────────────────────

const CITIES = [
  { lat: 40.7128, lng: -74.006 },
  { lat: 51.5074, lng: -0.1278 },
  { lat: 35.6762, lng: 139.6503 },
  { lat: 48.8566, lng: 2.3522 },
  { lat: 22.3193, lng: 114.1694 },
  { lat: 1.3521, lng: 103.8198 },
  { lat: 55.7558, lng: 37.6173 },
  { lat: 19.076, lng: 72.8777 },
  { lat: -23.5505, lng: -46.6333 },
  { lat: 37.7749, lng: -122.4194 },
  { lat: 52.52, lng: 13.405 },
  { lat: 25.2048, lng: 55.2708 },
  { lat: 39.9042, lng: 116.4074 },
  { lat: -33.8688, lng: 151.2093 },
  { lat: 34.0522, lng: -118.2437 },
  { lat: 41.9028, lng: 12.4964 },
]

function CityDots() {
  const positions = useMemo(() => {
    const arr = new Float32Array(CITIES.length * 3)
    CITIES.forEach(({ lat, lng }, i) => {
      const v = latLng(lat, lng, 1.015)
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z
    })
    return arr
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.028} color="#10b981" transparent opacity={1}
        sizeAttenuation depthWrite={false}
      />
    </points>
  )
}

// Outer ring halos around city dots for extra glow
function CityHalos() {
  const positions = useMemo(() => {
    const arr = new Float32Array(CITIES.length * 3)
    CITIES.forEach(({ lat, lng }, i) => {
      const v = latLng(lat, lng, 1.016)
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z
    })
    return arr
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06} color="#10b981" transparent opacity={0.2}
        sizeAttenuation depthWrite={false}
      />
    </points>
  )
}

// ─── Transaction arcs ────────────────────────────────────────────────────────

const NUM_ARCS = 18
const ARC_PTS = 52

type ArcDef = {
  points: THREE.Vector3[]
  buf: Float32Array
  isFraud: boolean
  startT: number
  duration: number
  color: THREE.Color
}

const ARCS: ArcDef[] = (() => {
  const list: ArcDef[] = []
  for (let i = 0; i < NUM_ARCS; i++) {
    const src = CITIES[Math.floor(Math.random() * CITIES.length)]
    let dst = CITIES[Math.floor(Math.random() * CITIES.length)]
    while (dst === src) dst = CITIES[Math.floor(Math.random() * CITIES.length)]

    const s = latLng(src.lat, src.lng, 1.01)
    const d = latLng(dst.lat, dst.lng, 1.01)
    const mid = new THREE.Vector3().addVectors(s, d).multiplyScalar(0.5)
    mid.normalize().multiplyScalar(mid.length() + 0.32 + Math.random() * 0.2)

    const pts: THREE.Vector3[] = []
    for (let j = 0; j <= ARC_PTS; j++) {
      const t = j / ARC_PTS, u = 1 - t
      pts.push(new THREE.Vector3(
        u * u * s.x + 2 * u * t * mid.x + t * t * d.x,
        u * u * s.y + 2 * u * t * mid.y + t * t * d.y,
        u * u * s.z + 2 * u * t * mid.z + t * t * d.z,
      ))
    }

    const isFraud = Math.random() < 0.18
    list.push({
      points: pts,
      buf: new Float32Array((ARC_PTS + 1) * 3),
      isFraud,
      startT: Math.random() * 8,
      duration: 2.8 + Math.random() * 2.5,
      color: new THREE.Color(isFraud ? '#ef4444' : (i % 2 === 0 ? '#10b981' : '#06b6d4')),
    })
  }
  return list
})()

function Arcs() {
  const groupRef = useRef<THREE.Group>(null)
  const clock = useRef(0)

  const lines = useMemo(() => ARCS.map(arc => {
    const geo = new THREE.BufferGeometry()
    const attr = new THREE.BufferAttribute(arc.buf, 3)
    attr.setUsage(THREE.DynamicDrawUsage)
    geo.setAttribute('position', attr)
    const mat = new THREE.LineBasicMaterial({
      color: arc.color, transparent: true, opacity: 0, depthWrite: false,
    })
    return { line: new THREE.Line(geo, mat), arc, attr }
  }), [])

  useEffect(() => {
    const g = groupRef.current; if (!g) return
    lines.forEach(({ line }) => g.add(line))
    return () => { lines.forEach(({ line }) => g.remove(line)) }
  }, [lines])

  useFrame((_, delta) => {
    clock.current += delta
    const t = clock.current
    lines.forEach(({ line, arc, attr }) => {
      const elapsed = (t - arc.startT + 30) % (arc.duration + 2)
      const progress = Math.max(0, Math.min(1, elapsed / arc.duration))
      const visible = Math.max(2, Math.floor(progress * arc.points.length))
      const mat = line.material as THREE.LineBasicMaterial

      for (let j = 0; j < visible; j++) {
        const p = arc.points[j]
        arc.buf[j * 3] = p.x; arc.buf[j * 3 + 1] = p.y; arc.buf[j * 3 + 2] = p.z
      }
      attr.needsUpdate = true
      line.geometry.setDrawRange(0, visible)

      const fade = progress < 0.12 ? progress / 0.12
        : progress > 0.82 ? (1 - progress) / 0.18 : 1
      mat.opacity = arc.isFraud && progress > 0.88
        ? Math.abs(Math.sin(t * 7)) * 1
        : fade * (arc.isFraud ? 1 : 0.85)
    })
  })

  return <group ref={groupRef} />
}

// ─── Graticule ───────────────────────────────────────────────────────────────

function Graticule() {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = []
    const R = 1.001

    for (let lat = -60; lat <= 60; lat += 30) {
      for (let lng = 0; lng <= 360; lng += 1.5)
        pts.push(latLng(lat, lng - 180, R))
      pts.push(new THREE.Vector3(NaN, NaN, NaN))
    }
    for (let lng = 0; lng < 360; lng += 30) {
      for (let lat = -90; lat <= 90; lat += 1.5)
        pts.push(latLng(lat, lng - 180, R))
      pts.push(new THREE.Vector3(NaN, NaN, NaN))
    }

    const g = new THREE.BufferGeometry().setFromPoints(pts)
    // Manually set bounding sphere — NaN break-points make auto-compute fail
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2)
    return g
  }, [])

  return (
    // @ts-expect-error
    <line geometry={geo}>
      <lineBasicMaterial color="#06b6d4" transparent opacity={0.07} depthWrite={false} />
    </line>
  )
}

// ─── Starfield ───────────────────────────────────────────────────────────────

function Stars() {
  const ref = useRef<THREE.Points>(null)
  const positions = useMemo(() => {
    const count = 1400
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return arr
  }, [])

  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.004 })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.009} color="#ffffff" transparent opacity={0.3}
        sizeAttenuation depthWrite={false}
      />
    </points>
  )
}

// ─── Globe mesh ──────────────────────────────────────────────────────────────

function GlobeMesh({ onFraud }: { onFraud: (v: boolean) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const { mouse } = useThree()
  const timer = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Base constant rotation
    const baseRotationY = delta * 0.055
    groupRef.current.rotation.y += baseRotationY

    // Add mouse interaction - more pronounced
    // Target rotations based on mouse position (-1 to 1)
    const targetX = mouse.y * 0.4  // Increased tilt range
    const targetY = mouse.x * 0.5  // Added horizontal influence

    // Smoothly interpolate current rotation towards target
    // We keep the constant Y rotation by letting X target be absolute, 
    // but Y target is added as an offset to a continuously increasing value
    groupRef.current.rotation.x += (targetX - groupRef.current.rotation.x) * 0.5 // Faster lerp

    // For Y, we need a separate track for the mouse offset, but for simplicity, 
    // just add a portion of the distance to the target offset
    // This allows the globe to keep spinning but lean towards the mouse
    const currentMouseOffsetY = groupRef.current.userData.mouseOffsetY || 0
    const newMouseOffsetY = currentMouseOffsetY + (targetY - currentMouseOffsetY) * 0.5
    groupRef.current.userData.mouseOffsetY = newMouseOffsetY

    groupRef.current.rotation.y += newMouseOffsetY - currentMouseOffsetY

    timer.current += delta
    if (timer.current > 10) {
      timer.current = 0
      onFraud(true)
      setTimeout(() => onFraud(false), 2800)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Dark core sphere */}
      <mesh>
        <sphereGeometry args={[1, 48, 48]} />
        <meshPhongMaterial
          color="#020c1a"
          emissive="#031020"
          specular="#10b981"
          shininess={15}
        />
      </mesh>

      {/* Country border map lines */}
      <WorldMapLines />

      {/* Lat/lng graticule */}
      <Graticule />

      {/* City dots + halos */}
      <CityDots />
      <CityHalos />

      {/* Transaction arcs */}
      <Arcs />

      {/* Atmosphere */}
      <mesh>
        <sphereGeometry args={[1.13, 32, 32]} />
        <meshBasicMaterial color="#06b6d4" transparent opacity={0.022} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Green rim glow */}
      <mesh>
        <sphereGeometry args={[1.005, 32, 32]} />
        <meshBasicMaterial color="#10b981" transparent opacity={0.035} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  )
}

// ─── Public export ───────────────────────────────────────────────────────────

export default function Globe3D({
  onFraudDetected,
}: {
  onFraudDetected: (v: boolean) => void
}) {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 48 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        dpr={[1, 1.5]}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.2} />
        <directionalLight position={[5, 3, 5]} intensity={0.6} color="#10b981" />
        <directionalLight position={[-5, -2, -4]} intensity={0.18} color="#06b6d4" />

        <Suspense fallback={null}>
          <Stars />
          <GlobeMesh onFraud={onFraudDetected} />
        </Suspense>
      </Canvas>
    </div>
  )
}
