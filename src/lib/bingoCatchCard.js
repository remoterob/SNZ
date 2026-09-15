// Social share card for a single Fish Bingo catch photo — SNZ logo banner
// across the top, diver name + club stamped at the bottom. Used by
// BingoPhotoExportAdmin so admins can grab ready-to-post images for Facebook.

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
 * photoUrl    — the claim's catch photo (required)
 * diverName   — headline
 * club        — subtitle, paired with speciesName
 * speciesName — subtitle, paired with club
 * tagLine     — small grey line under the name (e.g. "Fish Bingo 2026-27")
 */
export async function generateCatchCard({
  photoUrl, diverName = 'Diver', club = '', speciesName = '', tagLine = '',
}) {
  if (!photoUrl) throw new Error('No photo for this claim')

  const canvas = document.createElement('canvas')
  canvas.width = 1080
  canvas.height = 1080
  const ctx = canvas.getContext('2d')

  // Photo (cover). Loaded with crossOrigin='anonymous' so the canvas stays
  // untainted and can be exported — Supabase storage sends
  // Access-Control-Allow-Origin, so uploaded photos are fine.
  let img
  try {
    img = await loadImage(photoUrl)
  } catch (_) {
    throw new Error("couldn't load the photo — it may have been removed.")
  }
  const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
  const w = img.width * scale, h = img.height * scale
  ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h)

  // Top banner — dark fade so the logo stays legible over any photo
  const bannerH = 170
  const bannerGrad = ctx.createLinearGradient(0, 0, 0, bannerH)
  bannerGrad.addColorStop(0, 'rgba(0,0,0,0.72)')
  bannerGrad.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = bannerGrad
  ctx.fillRect(0, 0, canvas.width, bannerH)

  if (SNZ_LOGO) {
    try {
      const logo = await loadImage(SNZ_LOGO)
      const logoH = 90
      const logoW = Math.round(logo.width * (logoH / logo.height))
      const lx = (canvas.width - logoW) / 2
      const ly = 32
      ctx.drawImage(logo, lx, ly, logoW, logoH)
    } catch (_) { /* logo is decorative — never fail the card for it */ }
  }

  // Bottom gradient so name/club stay legible over any photo
  const overlayH = 260
  const grad = ctx.createLinearGradient(0, canvas.height - overlayH, 0, canvas.height)
  grad.addColorStop(0, 'rgba(0,0,0,0)')
  grad.addColorStop(0.35, 'rgba(0,0,0,0.65)')
  grad.addColorStop(1, 'rgba(0,0,0,0.9)')
  ctx.fillStyle = grad
  ctx.fillRect(0, canvas.height - overlayH, canvas.width, overlayH)

  const pad = 44
  const maxW = canvas.width - pad * 2
  const truncate = (text, font) => {
    ctx.font = font
    if (ctx.measureText(text).width <= maxW) return text
    let t = text
    while (t.length > 0 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
    return t + '…'
  }

  const nameFont = 'bold 54px system-ui, sans-serif'
  ctx.fillStyle = '#ffffff'
  ctx.font = nameFont
  ctx.fillText(truncate(diverName, nameFont), pad, canvas.height - 150)

  const subtitle = [club, speciesName].filter(Boolean).join(' · ')
  const subFont = 'bold 32px system-ui, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.85)'
  ctx.font = subFont
  ctx.fillText(truncate(subtitle, subFont), pad, canvas.height - 96)

  if (tagLine) {
    const tagFont = '26px system-ui, sans-serif'
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.font = tagFont
    ctx.fillText(truncate(tagLine, tagFont), pad, canvas.height - 50)
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

export const catchCardFilename = (diverName, speciesName) =>
  ['fish-bingo', diverName, speciesName]
    .filter(Boolean)
    .map(s => String(s).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase())
    .join('-') + '.jpg'
