// Social share cards for competition teams.
//
// Extracted from CompAdmin's Socials tab so Nationals can render the identical
// 1080×1080 card. The hero image is the team's catch photo where there is one,
// falling back to their weigh-station team photo.

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const loadImage = (src) => new Promise((resolve, reject) => {
  const i = new Image()
  i.crossOrigin = 'anonymous'
  i.onload = () => resolve(i)
  i.onerror = reject
  i.src = src
})

/**
 * Draws a 1080×1080 card and returns a JPEG data URL.
 *
 * heroUrl      — main background image (catch photo, else team photo)
 * teamPhotoUrl — small rounded thumbnail bottom-left; skipped if it's the hero
 * teamName     — headline
 * subtitle     — member names, or division
 * statLine     — small grey line (e.g. "6 fish · Open")
 * scoreLine    — amber highlight (e.g. "1,240 pts")
 * compName     — watermark top-right under the logo
 */
export async function generateTeamCard({
  heroUrl, teamPhotoUrl, teamName = '', subtitle = '', statLine = '', scoreLine = '', compName = '',
}) {
  if (!heroUrl) throw new Error('No image available for this team')

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')

  // Rounded-rect helper (fallback for browsers without roundRect)
  const rRect = (x, y, w, h, r) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.arcTo(x + w, y, x + w, y + r, r)
    ctx.lineTo(x + w, y + h - r)
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
    ctx.lineTo(x + r, y + h)
    ctx.arcTo(x, y + h, x, y + h - r, r)
    ctx.lineTo(x, y + r)
    ctx.arcTo(x, y, x + r, y, r)
    ctx.closePath()
  }

  // Hero (cover). Loaded with crossOrigin='anonymous' so the canvas stays
  // untainted and can be exported — Supabase storage sends
  // Access-Control-Allow-Origin, so uploaded photos are fine. A failure here
  // means the image is missing or unreachable; say so rather than surfacing a
  // bare network error.
  let img
  try {
    img = await loadImage(heroUrl)
  } catch (_) {
    throw new Error("couldn't load the photo — it may have been removed. Try re-uploading it at weigh-in.")
  }
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
  const w = img.width * scale, h = img.height * scale
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)

  // Dark gradient so text stays legible over any photo
  const overlayH = 310
  const grad = ctx.createLinearGradient(0, canvas.height - overlayH, 0, canvas.height)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.3, 'rgba(0,0,0,0.65)')
  grad.addColorStop(1, 'rgba(0,0,0,0.93)')
  ctx.fillStyle = grad
  ctx.fillRect(0, canvas.height - overlayH, canvas.width, overlayH)

  // Team thumbnail — pointless when it's already the hero image
  const pad = 44
  const ts = 120
  const tx = pad
  const ty = canvas.height - pad - ts
  let thumbDrawn = false
  if (teamPhotoUrl && teamPhotoUrl !== heroUrl) {
    try {
      const ti = await loadImage(teamPhotoUrl)
      ctx.save()
      rRect(tx, ty, ts, ts, 14)
      ctx.clip()
      ctx.drawImage(ti, tx, ty, ts, ts)
      ctx.restore()
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      rRect(tx, ty, ts, ts, 14)
      ctx.stroke()
      thumbDrawn = true
    } catch (_) { /* thumbnail is decorative — never fail the card for it */ }
  }

  const textX = thumbDrawn ? tx + ts + 20 : pad
  const maxW = canvas.width - textX - pad
  const truncate = (text, font) => {
    ctx.font = font
    if (ctx.measureText(text).width <= maxW) return text
    let t = text
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  const nameFont = 'bold 50px system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.font = nameFont
  ctx.fillText(truncate(teamName, nameFont), textX, canvas.height - 178)

  const subFont = 'bold 32px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = subFont
  ctx.fillText(truncate(subtitle, subFont), textX, canvas.height - 120)

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '26px system-ui, sans-serif'
  ctx.fillText(truncate(statLine, '26px system-ui, sans-serif'), textX, canvas.height - 76)

  ctx.fillStyle = '#F6E05E'
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText(scoreLine, textX, canvas.height - 34)

  if (SNZ_LOGO) {
    try {
      const logo = await loadImage(SNZ_LOGO)
      const logoH = 72
      const logoW = Math.round(logo.width * (logoH / logo.height))
      const lx = canvas.width - pad - logoW
      const ly = pad
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      if (ctx.roundRect) {
        ctx.beginPath()
        ctx.roundRect(lx - 12, ly - 8, logoW + 24, logoH + 16, 12)
        ctx.fill()
      } else {
        rRect(lx - 12, ly - 8, logoW + 24, logoH + 16, 12)
        ctx.fill()
      }
      ctx.drawImage(logo, lx, ly, logoW, logoH)
    } catch (_) { /* logo is decorative */ }
  }

  if (compName) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)'
    ctx.font = 'bold 22px system-ui, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(compName, canvas.width - pad, pad + 110)
    ctx.textAlign = 'left'
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

export const cardFilename = (compName, teamName, suffix = '') =>
  [compName, teamName, suffix]
    .filter(Boolean)
    .map(s => String(s).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase())
    .join('-') + '.jpg'

// ── Download helpers ─────────────────────────────────────────────────────────

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const dataUrlToBytes = (dataUrl) => {
  const b64 = dataUrl.split(',')[1]
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

const crc32 = (bytes) => {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

/**
 * Minimal ZIP writer (STORE, no compression). JPEGs are already compressed, so
 * deflate would buy almost nothing — and this avoids pulling in a zip library.
 * Browsers block long runs of individual downloads, so bulk export needs this.
 */
export function buildZip(files) {
  const enc = new TextEncoder()
  const chunks = []
  const central = []
  let offset = 0

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF]
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]

  for (const { name, dataUrl } of files) {
    const nameBytes = enc.encode(name)
    const data = dataUrlToBytes(dataUrl)
    const crc = crc32(data)

    const local = [
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),                    // mod time/date — zeroed
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]
    chunks.push(new Uint8Array(local), nameBytes, data)

    central.push([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(offset),
      ...Array.from(nameBytes),
    ])
    offset += local.length + nameBytes.length + data.length
  }

  const centralBytes = new Uint8Array(central.flat())
  const eocd = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(centralBytes.length), ...u32(offset), ...u16(0),
  ])

  return new Blob([...chunks, centralBytes, eocd], { type: 'application/zip' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
