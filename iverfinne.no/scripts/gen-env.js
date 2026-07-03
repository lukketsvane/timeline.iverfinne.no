// Generate a tiny equirect Radiance .hdr: black everywhere (zero ambient)
// with two gaussian hotspots = two directional lights (key + fill).
const fs = require('fs')

const W = 128, H = 64

// Light directions (azimuth rad, elevation rad), radiance, colour
const LIGHTS = [
  // Key: upper front-left, warm-ish white, hard
  { az: 0.9, el: 0.7, sigma: 0.14, L: 135, col: [1.0, 0.98, 0.92] },
  // Fill: opposite side, lower, cool, soft and dim
  { az: 0.9 + Math.PI, el: 0.25, sigma: 0.25, L: 20, col: [0.85, 0.9, 1.0] },
]

function dirFromAzEl(az, el) {
  return [Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)]
}
const lightDirs = LIGHTS.map(l => dirFromAzEl(l.az, l.el))

function rgbe(r, g, b) {
  const m = Math.max(r, g, b)
  if (m < 1e-9) return [0, 0, 0, 0]
  let e = Math.floor(Math.log2(m)) + 1
  const scale = 256 / 2 ** e
  return [
    Math.min(255, Math.round(r * scale)),
    Math.min(255, Math.round(g * scale)),
    Math.min(255, Math.round(b * scale)),
    e + 128,
  ]
}

const pixels = Buffer.alloc(W * H * 4)
for (let y = 0; y < H; y++) {
  const phi = ((y + 0.5) / H) * Math.PI // 0 = up
  for (let x = 0; x < W; x++) {
    const theta = ((x + 0.5) / W) * 2 * Math.PI
    const d = [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)]
    let r = 0, g = 0, b = 0
    LIGHTS.forEach((l, i) => {
      const ld = lightDirs[i]
      const dot = Math.min(1, d[0] * ld[0] + d[1] * ld[1] + d[2] * ld[2])
      const ang = Math.acos(dot)
      const w = Math.exp(-(ang * ang) / (2 * l.sigma * l.sigma)) * l.L
      r += w * l.col[0]; g += w * l.col[1]; b += w * l.col[2]
    })
    const [R, G, B, E] = rgbe(r, g, b)
    const o = (y * W + x) * 4
    pixels[o] = R; pixels[o + 1] = G; pixels[o + 2] = B; pixels[o + 3] = E
  }
}

const header = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'ascii')
fs.writeFileSync(process.argv[2], Buffer.concat([header, pixels]))
console.log('wrote', process.argv[2], header.length + pixels.length, 'bytes')
