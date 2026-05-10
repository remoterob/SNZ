export const handler = async () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

  let comps = []
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/competitions?select=id,name,date_start,updated_at&order=date_start.desc`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    )
    comps = await res.json()
    if (!Array.isArray(comps)) comps = []
  } catch {
    comps = []
  }

  const base = 'https://spearfishingnz.netlify.app'
  const today = new Date().toISOString().split('T')[0]

  const staticUrls = [
    { loc: `${base}/`,            changefreq: 'weekly',  priority: '1.0', lastmod: today },
    { loc: `${base}/records`,     changefreq: 'weekly',  priority: '0.8', lastmod: today },
    { loc: `${base}/competitions`,changefreq: 'daily',   priority: '0.9', lastmod: today },
    { loc: `${base}/nationals`,   changefreq: 'monthly', priority: '0.7', lastmod: today },
    { loc: `${base}/big-fish`,    changefreq: 'daily',   priority: '0.7', lastmod: today },
    { loc: `${base}/inspiration`, changefreq: 'weekly',  priority: '0.6', lastmod: today },
  ]

  const compUrls = comps.map(c => ({
    loc: `${base}/competitions/${c.id}`,
    changefreq: 'weekly',
    priority: '0.7',
    lastmod: c.updated_at ? c.updated_at.split('T')[0] : today,
  }))

  const allUrls = [...staticUrls, ...compUrls]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>`

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
    body: xml,
  }
}
