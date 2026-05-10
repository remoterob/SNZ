// Intercepts /competitions/[id] requests from search engine bots and social
// preview scrapers. Returns fully-rendered HTML with meta tags + JSON-LD so
// Google, Facebook, WhatsApp etc. see real content. Real users pass through
// to the SPA as normal.

const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|curl|wget|python-requests|axios/i

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default async function handler(request, context) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_PATTERN.test(ua)) return context.next()

  const url  = new URL(request.url)
  const compId = url.pathname.split('/')[2]
  if (!compId) return context.next()

  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
  const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseKey) return context.next()

  let comp
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/competitions?id=eq.${encodeURIComponent(compId)}&select=id,name,club_name,date_start,date_end,location,details,cover_image_url,status&limit=1`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const data = await res.json()
    comp = data?.[0]
  } catch {
    return context.next()
  }

  if (!comp) return context.next()

  const siteUrl  = 'https://spearfishingnz.netlify.app'
  const pageUrl  = `${siteUrl}/competitions/${comp.id}`
  const imageUrl = comp.cover_image_url || `${siteUrl}/snz-og-default.jpg`

  const dateRange = comp.date_end && comp.date_end !== comp.date_start
    ? `${fmtDate(comp.date_start)} – ${fmtDate(comp.date_end)}`
    : fmtDate(comp.date_start)

  const title = `${comp.name} | Spearfishing NZ`
  const description = comp.details
    ? comp.details.replace(/<[^>]+>/g, '').substring(0, 160)
    : `${comp.name} — organised by ${comp.club_name || 'Spearfishing NZ'}. ${comp.location ? comp.location + '. ' : ''}${dateRange}`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: comp.name,
    description,
    startDate: comp.date_start,
    endDate: comp.date_end || comp.date_start,
    location: { '@type': 'Place', name: comp.location || 'New Zealand', address: comp.location || 'New Zealand' },
    organizer: { '@type': 'SportsOrganization', name: comp.club_name || 'Spearfishing New Zealand', url: siteUrl },
    url: pageUrl,
    image: imageUrl,
    sport: 'Spearfishing',
    eventStatus: comp.status === 'active' ? 'https://schema.org/EventScheduled' : 'https://schema.org/EventScheduled',
  })

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <link rel="canonical" href="${pageUrl}" />

  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:image" content="${esc(imageUrl)}" />
  <meta property="og:site_name" content="Spearfishing New Zealand" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(title)}" />
  <meta name="twitter:description" content="${esc(description)}" />
  <meta name="twitter:image" content="${esc(imageUrl)}" />

  <script type="application/ld+json">${jsonLd}</script>
</head>
<body>
  <h1>${esc(comp.name)}</h1>
  <p><strong>Organiser:</strong> ${esc(comp.club_name || 'Spearfishing New Zealand')}</p>
  ${comp.location ? `<p><strong>Location:</strong> ${esc(comp.location)}</p>` : ''}
  <p><strong>Date:</strong> ${esc(dateRange)}</p>
  ${comp.details ? `<p>${esc(comp.details.replace(/<[^>]+>/g, ''))}</p>` : ''}
  <p><a href="${pageUrl}">View full competition details on Spearfishing NZ</a></p>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
