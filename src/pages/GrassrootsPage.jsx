// Grassroots Spearo — the home for the video series and the NZ club map.
// Public data: clubs (active + show_on_map) and grassroots_episodes (migration 045).
// ?club=<slug> deep-links straight to a club's panel, for sharing on Facebook.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import GrassrootsMap from '../components/GrassrootsMap'
import { NZ_REGIONS, loadGrassrootsPublic, youtubeEmbed, youtubeThumb } from '../lib/grassroots'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const COMING_SOON = '#D97706'

export function GrassrootsShell({ children, wide = false }) {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 print:hidden">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← SNZ Hub
        </button>
        <button onClick={() => navigate('/grassroots')}
          className="text-white/80 hover:text-white text-xs font-semibold">
          Grassroots Spearo
        </button>
        <button onClick={() => navigate('/admin/grassroots')}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>
      <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-4 py-6 space-y-5`}>{children}</div>
    </div>
  )
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function ExtLink({ href, children }) {
  if (!href) return null
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
      style={{ color: SNZ_BLUE }}>
      {children} ↗
    </a>
  )
}

function ClubPanel({ club, episodes, onClose }) {
  const [playing, setPlaying] = useState(episodes[0]?.id || null)
  useEffect(() => { setPlaying(episodes[0]?.id || null) }, [club.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = episodes.find(e => e.id === playing)

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start gap-3 p-4 border-b border-gray-100">
        {club.logo_url
          ? <img src={club.logo_url} alt="" className="w-12 h-12 rounded-xl object-contain bg-white border border-gray-100 shrink-0" />
          : <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center text-white font-black text-lg" style={{ background: SNZ_BLUE }}>
              {club.name.charAt(0)}
            </div>}
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-gray-900 leading-tight">{club.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{[club.town, club.region].filter(Boolean).join(', ')}</p>
          <span className={`inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${club.is_affiliated ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {club.is_affiliated ? 'SNZ affiliated club' : 'Club'}
          </span>
        </div>
        <button onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700 text-xl leading-none px-1">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {current && (
          <div>
            <div className="aspect-video rounded-xl overflow-hidden bg-black">
              <iframe
                key={current.id}
                src={youtubeEmbed(current.youtube_video_id)}
                title={current.title}
                className="w-full h-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                loading="lazy"
                // Site-wide Referrer-Policy is no-referrer; YouTube refuses embeds
                // without one (Error 153), so send just our origin here.
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <p className="text-sm font-bold text-gray-900 mt-2">{current.title}</p>
            {current.published_at && <p className="text-xs text-gray-400">{fmtDate(current.published_at)}</p>}
            {current.summary && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{current.summary}</p>}
            {episodes.length > 1 && (
              <div className="mt-2 space-y-1">
                {episodes.map(e => (
                  <button key={e.id} onClick={() => setPlaying(e.id)}
                    className={`block w-full text-left text-xs px-2 py-1.5 rounded-lg ${e.id === playing ? 'bg-blue-50 font-bold text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}>
                    ▶ {e.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {club.about
          ? <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{club.about}</p>
          : !current && <p className="text-sm text-gray-400">More about this club coming soon.</p>}

        <div className="flex flex-wrap gap-2">
          {club.contact_email && (
            <a href={`mailto:${club.contact_email}`}
              className="inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ background: SNZ_BLUE }}>
              ✉ Contact the club
            </a>
          )}
          <ExtLink href={club.website}>Website</ExtLink>
          <ExtLink href={club.facebook_url}>Facebook</ExtLink>
          <ExtLink href={club.instagram_url}>Instagram</ExtLink>
        </div>

        {!current && club.episode_coming_soon && (
          <p className="text-sm font-bold rounded-lg p-3 bg-amber-50 text-amber-800">
            🎬 Grassroots episode coming soon. Watch this space.
          </p>
        )}
        {!current && !club.episode_coming_soon && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            No Grassroots episode for this club yet. Are you part of it?{' '}
            <a href="/grassroots/submit" className="font-bold" style={{ color: SNZ_BLUE }}>Get your club up here →</a>
          </p>
        )}
      </div>
    </div>
  )
}

export default function GrassrootsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [region, setRegion] = useState('')
  const [episodesOnly, setEpisodesOnly] = useState(false)
  const [view, setView] = useState('map')
  const mapRef = useRef(null)

  useEffect(() => {
    loadGrassrootsPublic().then(setData).catch(e => setError(e.message || 'Could not load clubs'))
  }, [])

  const clubs = data?.clubs || []
  const episodes = data?.episodes || []
  const episodesByClub = useMemo(() => {
    const m = new Map()
    for (const e of episodes) {
      if (!m.has(e.club_id)) m.set(e.club_id, [])
      m.get(e.club_id).push(e)
    }
    return m
  }, [episodes])
  const episodeClubIds = useMemo(() => new Set(episodesByClub.keys()), [episodesByClub])
  const comingSoonIds = useMemo(
    () => new Set(clubs.filter(c => c.episode_coming_soon && !episodeClubIds.has(c.id)).map(c => c.id)),
    [clubs, episodeClubIds]
  )
  const clubById = useMemo(() => new Map(clubs.map(c => [c.id, c])), [clubs])

  const filtered = useMemo(() => clubs.filter(c =>
    (!region || c.region === region) && (!episodesOnly || episodeClubIds.has(c.id) || comingSoonIds.has(c.id))
  ), [clubs, region, episodesOnly, episodeClubIds, comingSoonIds])

  const regionsInUse = useMemo(
    () => NZ_REGIONS.filter(r => clubs.some(c => c.region === r)),
    [clubs]
  )

  const selectedSlug = params.get('club')
  const selected = clubs.find(c => c.slug === selectedSlug) || null
  const select = (id) => {
    const c = clubById.get(id)
    const next = new URLSearchParams(params)
    if (c) next.set('club', c.slug); else next.delete('club')
    setParams(next, { replace: true })
  }
  const openFromList = (id) => {
    select(id)
    mapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const panel = selected && (
    <ClubPanel club={selected} episodes={episodesByClub.get(selected.id) || []} onClose={() => select(null)} />
  )

  return (
    <GrassrootsShell wide>
      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
        className="rounded-2xl px-6 py-10 sm:py-12 text-center">
        <img src="/grassroots/grassroots-spearo-logo.jpg" alt="Grassroots Spearo logo"
          width="1254" height="1254"
          className="w-36 h-36 sm:w-44 sm:h-44 mx-auto mb-5 rounded-full bg-white p-2 shadow-lg object-contain" />
        <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-3">Spearfishing New Zealand</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">Grassroots Spearo</h1>
        <p className="text-blue-100 text-base leading-relaxed max-w-2xl mx-auto">
          A video series about the clubs that make New Zealand spearfishing what it is. Each episode
          visits one club: the people holding it together, the water they dive, and why it matters.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button onClick={() => mapRef.current?.scrollIntoView({ behavior: 'smooth' })}
            className="px-5 py-2.5 rounded-xl font-black text-sm bg-white hover:opacity-90" style={{ color: SNZ_DARK }}>
            Find a club near you
          </button>
          <button onClick={() => navigate('/grassroots/submit')}
            className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-white/15 border border-white/30 hover:bg-white/25">
            Want your club up here?
          </button>
        </div>
      </div>

      {/* About */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <h2 className="font-black text-gray-900 text-lg">The series and the 2026 road trip</h2>
        <div className="text-sm text-gray-600 leading-relaxed space-y-3 mt-3">
          <p>
            Grassroots Spearo is an ongoing SNZ series. Every episode stands on its own and profiles one
            New Zealand spearfishing club through interviews and diving. We sit down with presidents,
            long-standing members and newcomers, then get in the water with them.
          </p>
          <p>
            The 2026 road trip is taking us to 12–13 clubs around the country. Episodes go up on YouTube,
            Facebook and in the SNZ newsletter, and every club we visit lands on the map below.
          </p>
          <p>
            Can't wait for the road trip to reach you? Clubs can film their own interviews and footage
            and we'll edit it into an episode. <a href="/grassroots/101" className="font-bold" style={{ color: SNZ_BLUE }}>See the Grassroots 101 guide →</a>
          </p>
        </div>
      </section>

      {/* Map + list */}
      <section ref={mapRef} className="bg-white border border-gray-200 rounded-2xl overflow-hidden scroll-mt-4">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <h2 className="font-black text-gray-900 text-lg mr-auto">Clubs around New Zealand</h2>
          <select value={region} onChange={e => setRegion(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm" aria-label="Filter by region">
            <option value="">All regions</option>
            {regionsInUse.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 px-1">
            <input type="checkbox" checked={episodesOnly} onChange={e => setEpisodesOnly(e.target.checked)} />
            Episodes and coming soon
          </label>
          <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-bold">
            {['map', 'list'].map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 capitalize ${view === v ? 'text-white' : 'text-gray-600 bg-white'}`}
                style={view === v ? { background: SNZ_BLUE } : undefined}>
                {v}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 sm:px-5 py-2 text-xs text-gray-500 border-b border-gray-100">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: SNZ_BLUE }} /> Grassroots episode</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full" style={{ background: COMING_SOON }} /> Episode coming soon</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500" /> Club</span>
          <span className="ml-auto">{filtered.length} club{filtered.length === 1 ? '' : 's'}</span>
        </div>

        {error && <p className="p-5 text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="p-5 text-sm text-gray-400">Loading clubs…</p>}

        {data && view === 'map' && (
          <div className="lg:grid lg:grid-cols-[1fr_380px]">
            <GrassrootsMap
              clubs={filtered}
              episodeClubIds={episodeClubIds}
              comingSoonIds={comingSoonIds}
              selectedId={selected?.id}
              onSelect={select}
              className="h-[62vh] lg:h-[620px] w-full"
            />
            {/* Desktop side panel */}
            <aside className="hidden lg:block border-l border-gray-100 h-[620px]">
              {panel || (
                <div className="h-full flex items-center justify-center p-8 text-center text-sm text-gray-400">
                  Tap a pin to see the club, its contacts and its Grassroots episode. Numbered bubbles are
                  groups of clubs — tap to zoom in.
                </div>
              )}
            </aside>
          </div>
        )}

        {data && view === 'list' && (
          <ul className="divide-y divide-gray-100">
            {filtered.length === 0 && <li className="p-5 text-sm text-gray-400">No clubs match.</li>}
            {filtered.map(c => (
              <li key={c.id}>
                <button onClick={() => { setView('map'); openFromList(c.id) }}
                  className="w-full text-left px-4 sm:px-5 py-3 hover:bg-gray-50 flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: episodeClubIds.has(c.id) ? SNZ_BLUE : comingSoonIds.has(c.id) ? COMING_SOON : '#64748b' }} />
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm text-gray-900">{c.name}</span>
                    <span className="block text-xs text-gray-500">{[c.town, c.region].filter(Boolean).join(', ') || 'Location to come'}</span>
                  </span>
                  {episodeClubIds.has(c.id) && <span className="text-xs font-bold" style={{ color: SNZ_BLUE }}>▶ Episode</span>}
                  {comingSoonIds.has(c.id) && <span className="text-xs font-bold" style={{ color: COMING_SOON }}>Coming soon</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Mobile bottom sheet */}
      {selected && view === 'map' && (
        <div className="lg:hidden fixed inset-0 z-[1000] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => select(null)} />
          <div className="relative bg-white rounded-t-2xl max-h-[82vh] flex flex-col shadow-2xl">
            <div className="mx-auto mt-2 w-10 h-1 rounded-full bg-gray-300" />
            {panel}
          </div>
        </div>
      )}

      {/* Episodes */}
      <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
        <h2 className="font-black text-gray-900 text-lg">Episodes</h2>
        {episodes.length === 0
          ? <p className="text-sm text-gray-400 mt-3">Episodes will appear here as they're published.</p>
          : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
              {episodes.map(e => {
                const club = clubById.get(e.club_id)
                return (
                  <button key={e.id} onClick={() => club && (setView('map'), openFromList(club.id))}
                    className="text-left group">
                    <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
                      <img src={youtubeThumb(e.youtube_video_id)} alt="" loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="w-12 h-12 rounded-full bg-black/60 text-white flex items-center justify-center text-lg">▶</span>
                      </span>
                    </div>
                    <p className="text-sm font-bold text-gray-900 mt-2 leading-snug">{e.title}</p>
                    <p className="text-xs text-gray-500">
                      {[club?.name, fmtDate(e.published_at)].filter(Boolean).join(' · ')}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
      </section>

      {/* CTA */}
      <section className="rounded-2xl p-6 sm:p-8 text-center border-2 border-dashed border-blue-200 bg-blue-50/50">
        <h2 className="font-black text-gray-900 text-xl">Want your club up here?</h2>
        <p className="text-sm text-gray-600 mt-2 max-w-xl mx-auto leading-relaxed">
          Film your club's interviews and diving using our guide, put the clips on YouTube, and send us
          the links. We'll edit it into a Grassroots episode and put your club on the map.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={() => navigate('/grassroots/submit')}
            className="px-5 py-2.5 rounded-xl font-black text-sm text-white" style={{ background: SNZ_BLUE }}>
            Put your club forward →
          </button>
          <button onClick={() => navigate('/grassroots/101')}
            className="px-5 py-2.5 rounded-xl font-black text-sm bg-white border border-gray-300 text-gray-700">
            Grassroots 101 guide
          </button>
        </div>
      </section>
    </GrassrootsShell>
  )
}
