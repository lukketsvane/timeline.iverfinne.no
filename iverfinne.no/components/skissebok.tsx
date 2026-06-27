'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// Digital sketchbook. Each drawing is named skb_YYYYMMDD_FORMAT_NR.png where
// FORMAT is `page` (single 13×21 leaf) or `spread` (full 26×21 open spread).
type Format = 'page' | 'spread'
type Drawing = { date: string; format: Format; nr: number; src: string }

const file = (date: string, format: Format, nr: number): Drawing => ({
  date,
  format,
  nr,
  src: `/skissebok/skb_${date}_${format}_${String(nr).padStart(2, '0')}.png`,
})

// Bundled seed — used until the Notion-backed drawings load (newest first).
const SEED: Drawing[] = [
  file('20260627', 'page', 1),
  file('20241028', 'page', 2),
  file('20241020', 'spread', 1),
  file('20241020', 'page', 3),
]

const COVER_SRC = '/skissebok/moleskine-cover.jpg'

// Moleskine Large proportions.
const PW = 1.3
const PH = 2.1
const DEPTH = 0.012
const GAP = 0.02
const SPREAD_AR = '26 / 21'

const formatDate = (d: string) => `${d.slice(6, 8)}.${d.slice(4, 6)}.${d.slice(0, 4)}`

// One 13×21 leaf face.
type Face =
  | { kind: 'cover'; side: 'front' | 'back' }
  | { kind: 'blank' }
  | { kind: 'page'; drawing: Drawing }

function buildFaces(drawings: Drawing[]): Face[] {
  const inner: Face[] = drawings.map((d) => ({ kind: 'page', drawing: d }))
  if (inner.length % 2 !== 0) inner.push({ kind: 'blank' })
  return [{ kind: 'cover', side: 'front' }, { kind: 'blank' }, ...inner, { kind: 'blank' }, { kind: 'cover', side: 'back' }]
}

const faceDate = (f?: Face): string | null => (f && f.kind === 'page' ? f.drawing.date : null)

// A leaf = front face (+z) and back face (−z), hinged at the spine (local x=0).
type Leaf = { group: THREE.Group; target: number }

function FlipBook({ drawings }: { drawings: Drawing[] }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const leavesRef = useRef<Leaf[]>([])
  const bookRef = useRef<THREE.Group | null>(null)
  const [turned, setTurned] = useState(0)
  const turnedRef = useRef(0)

  const faces = buildFaces(drawings)
  const leafCount = Math.floor(faces.length / 2)

  // ── Build the scene once per drawing set ────────────────────────────────
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 0, 5)

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    mount.appendChild(renderer.domElement)
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'

    const loader = new THREE.TextureLoader()
    const loadTex = (src: string, mirror = false) => {
      const tex = loader.load(src)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
      if (mirror) {
        tex.wrapS = THREE.RepeatWrapping
        tex.repeat.x = -1
      }
      return tex
    }

    // Unlit materials so the drawings and cover show at their true brightness.
    const paperMat = () => new THREE.MeshBasicMaterial({ color: 0xf3eedd })
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xddd5c0 })
    const coverMat = new THREE.MeshBasicMaterial({ color: 0x141414 })

    // A drawing sits on a plane in front of the paper, scaled to "contain" it.
    const drawingPlane = (src: string, back: boolean) => {
      const mat = new THREE.MeshBasicMaterial({ map: loadTex(src, back), transparent: true })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)
      // Fit to image aspect once the texture has loaded.
      const img = new Image()
      img.onload = () => {
        const ar = img.naturalWidth / img.naturalHeight
        const maxW = PW * 0.9
        const maxH = PH * 0.9
        let w = maxW
        let h = w / ar
        if (h > maxH) { h = maxH; w = h * ar }
        mesh.scale.set(w, h, 1)
      }
      img.src = src
      mesh.scale.set(PW * 0.9, PH * 0.9, 1)
      mesh.position.set(PW / 2, 0, back ? -(DEPTH / 2 + 0.001) : DEPTH / 2 + 0.001)
      if (back) mesh.rotation.y = Math.PI
      return mesh
    }

    const coverFace = (back: boolean) => {
      const mat = new THREE.MeshBasicMaterial({ map: loadTex(COVER_SRC, back) })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), mat)
      mesh.position.set(PW / 2, 0, back ? -(DEPTH / 2 + 0.001) : DEPTH / 2 + 0.001)
      if (back) mesh.rotation.y = Math.PI
      return mesh
    }

    const book = new THREE.Group()
    const leaves: Leaf[] = []

    for (let i = 0; i < leafCount; i++) {
      const front = faces[2 * i]
      const back = faces[2 * i + 1]
      const isCoverLeaf = front.kind === 'cover' || back.kind === 'cover'

      const group = new THREE.Group()

      // Board: paper for inner leaves, black for the cover leaves.
      const boardMat = isCoverLeaf ? coverMat : paperMat()
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(PW, PH, DEPTH),
        [edgeMat, edgeMat, edgeMat, edgeMat, boardMat, boardMat]
      )
      board.position.set(PW / 2, 0, 0)
      group.add(board)

      if (front.kind === 'page') group.add(drawingPlane(front.drawing.src, false))
      if (front.kind === 'cover') group.add(coverFace(false))
      if (back.kind === 'page') group.add(drawingPlane(back.drawing.src, true))
      if (back.kind === 'cover') group.add(coverFace(true))

      // Front cover carries the elastic closure band near the fore-edge.
      if (front.kind === 'cover' && front.side === 'front') {
        const band = new THREE.Mesh(
          new THREE.PlaneGeometry(0.045, PH),
          new THREE.MeshBasicMaterial({ color: 0x000000 })
        )
        band.position.set(PW * 0.9, 0, DEPTH / 2 + 0.002)
        group.add(band)
      }

      group.position.z = (leafCount - i) * GAP
      book.add(group)
      leaves.push({ group, target: 0 })
    }

    scene.add(book)
    bookRef.current = book
    leavesRef.current = leaves

    // ── Resize ────────────────────────────────────────────────────────────
    const resize = () => {
      const w = mount.clientWidth
      const h = mount.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(mount)

    // ── Animation loop ──────────────────────────────────────────────────────
    let raf = 0
    const tick = () => {
      const ls = leavesRef.current
      for (let i = 0; i < ls.length; i++) {
        const l = ls[i]
        l.group.rotation.y += (l.target - l.group.rotation.y) * 0.14
        // Lift the turning leaf in an arc so it clears the stack instead of
        // clipping through it; settle into left/right order at either end.
        const prog = Math.min(1, Math.abs(l.group.rotation.y) / Math.PI)
        const lift = Math.sin(prog * Math.PI) * 0.6
        const base = (l.target < 0 ? i : leafCount - i) * GAP
        l.group.position.z = base + lift
      }
      // Centre the closed cover; centre the spread once open.
      const t = turnedRef.current
      const targetX = t === 0 ? -PW / 2 : t === leafCount ? PW / 2 : 0
      book.position.x += (targetX - book.position.x) * 0.12
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    book.position.x = -PW / 2
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      renderer.dispose()
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material
          ;(Array.isArray(m) ? m : [m]).forEach((mm: THREE.Material & { map?: THREE.Texture }) => {
            mm.map?.dispose()
            mm.dispose()
          })
        }
      })
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawings])

  // ── Apply page turns imperatively ────────────────────────────────────────
  useEffect(() => {
    turnedRef.current = turned
    leavesRef.current.forEach((l, i) => { l.target = turned > i ? -Math.PI : 0 })
  }, [turned])

  const currentDate =
    turned === 0 || turned === leafCount ? null : faceDate(faces[2 * turned]) ?? faceDate(faces[2 * turned - 1])

  const flip = (dir: number) => setTurned((t) => Math.max(0, Math.min(leafCount, t + dir)))

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <div className="relative mx-auto w-full max-w-3xl" style={{ aspectRatio: SPREAD_AR }}>
        <div ref={mountRef} className="absolute inset-0" />
        {/* Click the left / right half to turn the leaves */}
        <button type="button" aria-label="Førre" onClick={() => flip(-1)} className="absolute inset-y-0 left-0 w-1/2 cursor-w-resize" />
        <button type="button" aria-label="Neste" onClick={() => flip(1)} className="absolute inset-y-0 right-0 w-1/2 cursor-e-resize" />
      </div>

      <div className="mx-auto h-5 w-full max-w-3xl">
        {currentDate && <span className="text-sm tabular-nums text-muted-foreground">{formatDate(currentDate)}</span>}
      </div>
    </div>
  )
}

export default function Skissebok() {
  const [drawings, setDrawings] = useState<Drawing[]>(SEED)

  useEffect(() => {
    let alive = true
    fetch('/api/skissebok')
      .then((r) => r.json())
      .then((d) => {
        if (alive && Array.isArray(d?.drawings) && d.drawings.length) setDrawings(d.drawings)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  return (
    <div className="mt-6 flex flex-col items-center gap-6">
      <FlipBook drawings={drawings} />
    </div>
  )
}
