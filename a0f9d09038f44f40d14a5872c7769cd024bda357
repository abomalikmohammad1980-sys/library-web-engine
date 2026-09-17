import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(root, { recursive: true })

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let value = n
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
function crc32(data) {
  let crc = 0xffffffff
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}
function roundedRect(x, y, inset, radius) {
  const dx = Math.max(inset - x, 0, x - (1 - inset))
  const dy = Math.max(inset - y, 0, y - (1 - inset))
  return dx * dx + dy * dy <= radius * radius
}
function segmentDistance(x, y, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy)))
  return Math.hypot(x - (ax + t * vx), y - (ay + t * vy))
}
function makeIcon(size, maskable) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  const lines = [
    [.5,.31,.38,.26], [.38,.26,.25,.27], [.25,.27,.25,.72], [.25,.72,.38,.71], [.38,.71,.5,.77],
    [.5,.31,.62,.26], [.62,.26,.75,.27], [.75,.27,.75,.72], [.75,.72,.62,.71], [.62,.71,.5,.77], [.5,.31,.5,.77],
  ]
  for (let py = 0; py < size; py++) {
    raw[py * stride] = 0
    for (let px = 0; px < size; px++) {
      const x = (px + .5) / size, y = (py + .5) / size
      const inside = maskable || roundedRect(x, y, .06, .16)
      const book = inside && lines.some(([ax, ay, bx, by]) => segmentDistance(x, y, ax, ay, bx, by) < .018)
      const offset = py * stride + 1 + px * 4
      raw[offset] = book ? 255 : 47
      raw[offset + 1] = book ? 255 : 111
      raw[offset + 2] = book ? 255 : 84
      raw[offset + 3] = inside ? 255 : 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

for (const size of [192, 512]) {
  writeFileSync(resolve(root, `icon-${size}.png`), makeIcon(size, false))
  writeFileSync(resolve(root, `icon-maskable-${size}.png`), makeIcon(size, true))
}

