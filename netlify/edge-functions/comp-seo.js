// Intercepts competition pages requested by search engine bots and social
// preview scrapers. Returns fully-rendered HTML with meta tags + JSON-LD so
// Google, Facebook, WhatsApp etc. see real content. Real users pass through
// to the SPA as normal.
//
// Covers three routes:
//   /competitions/:id  — any competition, looked up by id
//   /nationals         — the current Nationals, looked up by name
//   /catfish           — the current Catfish Cull, looked up by name
//
// The two named routes are the event landing pages people actually search for
// and enter through. Without this they returned the generic SPA shell, so
// Google indexed them as "SNZ Hub" with no event content at all.

const BOT_PATTERN = /googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|curl|wget|python-requests|axios/i

const SITE_URL = 'https://spearfishingnz.netlify.app'
const SELECT = 'id,name,club_name,date_start,date_end,location,details,cover_image_url,status,entry_fee_cents,registration_cutoff,category_fees'

// Named landing pages. `match` is a PostgREST ilike pattern; the most recent
// edition wins, so next season's event takes over without a code change.
const NAMED_ROUTES = {
  '/nationals': {
    match: '*national*',
    fallbackDesc: 'The SNZ National Spearfishing Championships. Open, Juniors, Golden Oldie, Under 23, Snorkel Photography and Fin Swimming. Entries open to active SNZ members.',
  },
  '/catfish': {
    match: '*catfish*',
    fallbackDesc: 'The Rosemergy Catfish Cull, an annual freshwater pest removal competition on Lake Taupo. Hawaiian slings and pole spears only, shore diving, pairs and trios welcome.',
  },
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function fmtDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Entry fees are stored inconsistently: the Catfish Cull holds cents
// (5000 = $50) while Nationals holds whole dollars (145 = $145), despite the
// column being named entry_fee_cents. Publishing the wrong one puts "$1.45"
// in a Google result, so infer the unit instead of trusting the name. Real
// entry fees sit well under $1000, and the same fee in cents is well over
// 1000, which separates the two cleanly.
function toDollars(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 1000 ? Math.round(n / 100) : Math.round(n)
}

// Cheapest way in, so the offer reflects "from $X" rather than the dearest
// category. Skips merch and meal, which aren't entry fees.
function lowestEntryDollars(comp) {
  const skip = new Set(['merch', 'meal'])
  const prices = []
  const fees = comp.category_fees
  if (fees && typeof fees === 'object') {
    for (const [key, val] of Object.entries(fees)) {
      if (skip.has(key.toLowerCase()) || !val || typeof val !== 'object') continue
      for (const k of ['early_bird', 'standard']) {
        const d = toDollars(val[k])
        if (d) prices.push(d)
      }
    }
  }
  const flat = toDollars(comp.entry_fee_cents)
  if (flat) prices.push(flat)
  return prices.length ? Math.min(...prices) : null
}

function eventStatusUrl(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'cancelled' || s === 'canceled') return 'https://schema.org/EventCancelled'
  if (s === 'postponed') return 'https://schema.org/EventPostponed'
  return 'https://schema.org/EventScheduled'
}

export default async function handler(request, context) {
  const ua = request.headers.get('user-agent') || ''
  if (!BOT_PATTERN.test(ua)) return context.next()

  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'

  const supabaseUrl = Deno.env.get('VITE_SUPABASE_URL')
  const supabaseKey = Deno.env.get('VITE_SUPABASE_ANON_KEY')
  if (!supabaseUrl || !supabaseKey) return context.next()

  const named = NAMED_ROUTES[path]
  let query
  let canonicalPath

  if (named) {
    query = `name=ilike.${encodeURIComponent(named.match)}&order=date_start.desc&limit=1`
    canonicalPath = path
  } else {
    const compId = path.split('/')[2]
    if (!compId) return context.next()
    query = `id=eq.${encodeURIComponent(compId)}&limit=1`
    canonicalPath = `/competitions/${compId}`
  }

  let comp
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/competitions?${query}&select=${SELECT}`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    const data = await res.json()
    comp = data?.[0]
  } catch {
    return context.next()
  }

  if (!comp) return context.next()

  const pageUrl = `${SITE_URL}${canonicalPath}`
  const imageUrl = comp.cover_image_url || `${SITE_URL}/snz-og-default.jpg`

  const dateRange = comp.date_end && comp.date_end !== comp.date_start
    ? `${fmtDate(comp.date_start)} – ${fmtDate(comp.date_end)}`
    : fmtDate(comp.date_start)

  // Lead with the location as well as the name: people search "catfish cull
  // taupo" and "spearfishing nationals 2027" far more than the bare title.
  const title = comp.location
    ? `${comp.name} | ${comp.location} | Spearfishing NZ`
    : `${comp.name} | Spearfishing NZ`

  const plainDetails = comp.details ? comp.details.replace(/<[^>]+>/g, '').trim() : ''
  const description = (plainDetails || named?.fallbackDesc ||
    `${comp.name}, organised by ${comp.club_name || 'Spearfishing NZ'}. ${comp.location ? comp.location + '. ' : ''}${dateRange}`
  ).substring(0, 300)

  const fromPrice = lowestEntryDollars(comp)
  const offers = {
    '@type': 'Offer',
    url: pageUrl,
    availability: 'https://schema.org/InStock',
    priceCurrency: 'NZD',
    // price is required alongside priceCurrency; 0 legitimately means free entry
    price: String(fromPrice ?? 0),
    ...(comp.registration_cutoff ? { validThrough: comp.registration_cutoff } : {}),
  }

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'SportsEvent',
    name: comp.name,
    description,
    startDate: comp.date_start,
    endDate: comp.date_end || comp.date_start,
    eventStatus: eventStatusUrl(comp.status),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: comp.location || 'New Zealand',
      address: { '@type': 'PostalAddress', addressLocality: comp.location || 'New Zealand', addressCountry: 'NZ' },
    },
    organizer: { '@type': 'SportsOrganization', name: comp.club_name || 'Spearfishing New Zealand', url: SITE_URL },
    offers,
    url: pageUrl,
    image: imageUrl,
    sport: 'Spearfishing',
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
  ${fromPrice !== null ? `<p><strong>Entry:</strong> from $${fromPrice} NZD per competitor</p>` : ''}
  ${comp.registration_cutoff ? `<p><strong>Entries close:</strong> ${esc(fmtDate(comp.registration_cutoff))}</p>` : ''}
  <p>${esc(description)}</p>
  <p><a href="${pageUrl}">View full event details and enter on Spearfishing NZ</a></p>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  })
}
