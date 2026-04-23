import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// ── Sub-event definitions ────────────────────────────────────────────────────
const SUB_EVENTS = [
  {
    id: 'open',
    name: '2-Day Open Championship',
    emoji: '🏆',
    description: 'The flagship event of the SNZ Nationals. Two full days of spearfishing in pairs — six hours each day. The Open is the pinnacle of competitive spearfishing in Aotearoa. All scoring and placing is on a two-person team basis. No individual diving permitted.',
    format: 'Pairs · 2 days · 6 hrs/day · Standard SNZ scoring',
    prizes: 'Howe Cup (1st) · Dowling Cup (2nd) · Woolworths Cup (3rd) · Tomlin Trophy (Top NZ Team) · Carver Trophy (Most Meritorious Fish) · ISCO Cup (Largest Kingfish) · Russell George Trophy (Largest Snapper) · Milner Trophy (Most Species) · Lance Baker Trophy (1st Novice) · Plylite Cup (Top Club) · B Division Stewards Trophy (1st B Division) · Parent & Child Mug',
    eligibility: 'All active SNZ members. Both divers must be registered.',
    earlyBird: true,
    baseFee: false,
    feeCents: 0,
    color: '#2B6CB0',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
  },
  {
    id: 'womens',
    name: "Women's Championship",
    emoji: '🌸',
    description: "A dedicated championship for women's competitors, run as a separate event to the Open. At least one rest day is scheduled between the Women's event and the Open Championship.",
    format: 'Pairs · 1 day · Standard SNZ scoring',
    prizes: 'Eddie Davidson Cup (1st — NZ Women\'s Champion) · GHB Cup (2nd)',
    eligibility: 'Open to all women competitors. Both divers must be women.',
    baseFee: false,
    feeCents: 0,
    color: '#db2777',
    bgColor: '#fdf2f8',
    borderColor: '#fbcfe8',
  },
  {
    id: 'juniors',
    name: 'Junior Championship',
    emoji: '🌟',
    description: 'A dedicated championship for our next generation of spearfishers. Run concurrently with the Open, this event offers a focused competitive environment with its own trophies and recognition.',
    format: 'Pairs · Standard SNZ scoring',
    prizes: 'Daves Sports Centre Plate (NZ Junior Champion) · Trail Cup (2nd) · Underwater Sports Trophy (3rd) · Mayor Island Trophy (1st U/16) · Lifou Trophy (1st Junior Woman) · McCoy & Thomas Trophy (Largest Fish) · Wilkinson Trophy (Most Meritorious Fish U/18) · Shields Family Trophy (1st U/10) · Committee\'s Choice Cup',
    eligibility: 'Under 18 years of age on the day of competition.',
    baseFee: false,
    feeCents: 0,
    color: '#7c3aed',
    bgColor: '#faf5ff',
    borderColor: '#ddd6fe',
  },
  {
    id: 'photography',
    name: 'Snorkel Photography',
    emoji: '📸',
    description: 'Competitors swim in pairs and photograph as many eligible species as possible in up to four hours. Only the first 24 underwater exposures count (after an ID shot). A species list is published before the event.',
    format: 'Individual · Swim in pairs · Up to 4 hrs · Judged on species count',
    prizes: 'Rollie Cup (1st Most Species — NZ Champion Snorkel Photographer) · Bay of Islands Cup (2nd Most Species) · Nelson U/W Club Trophy (Best Photo) · Spence & Ross Cup (1st Junior Snorkel Photographer)',
    eligibility: 'All registered Nationals competitors. Competitors under 16 must swim with an adult.',
    baseFee: false,
    feeCents: 0,
    perDiver: true,
    color: '#0891b2',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
  },
  {
    id: 'finswim',
    name: 'Fin Swimming',
    emoji: '🐟',
    description: 'Test your speed and technique over a measured course. Fins only — no freestyle permitted. The distance is confirmed on the day of the race. A classic freediving discipline that rewards pure leg-power and technique.',
    format: 'Individual · Timed · Distance confirmed day of race · Fins only',
    prizes: 'Thornbury Cup (1st 200m) · NZ Swimfin Champion · NZ Swimfin Champion Team',
    eligibility: 'All registered Nationals competitors.',
    baseFee: false,
    feeCents: 0,
    perDiver: true,
    color: '#059669',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  {
    id: 'silveroldie',
    name: 'Silver Oldie',
    emoji: '🥈',
    description: 'Scored from the Open Spearfishing Competition. If a team member is 50 years of age or over at the time of competition, they are eligible. That individual\'s team score is used as the basis. If both members are over 50, the award goes to both.',
    format: 'Included with Open entry — scored from Open results · No additional fee',
    prizes: 'Silver Oldie Trophy',
    eligibility: 'At least one diver aged 50+ on day of competition. Cannot compete in both Silver and Golden Oldie.',
    baseFee: false,
    feeCents: 0,
    autoQualify: true,
    color: '#6b7280',
    bgColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  {
    id: 'goldenoldie',
    name: 'Golden Oldie',
    emoji: '🎖️',
    description: 'Same conditions as Silver Oldie but for competitors aged 60 and over. Proving that experience beats youth — these competitors bring decades of knowledge and technique.',
    format: 'Included with Open entry — scored from Open results · No additional fee',
    prizes: 'Golden Oldie Cup — Timbs & Davidson (60 years of age and over)',
    eligibility: 'At least one diver aged 60+ on day of competition. Cannot compete in both Silver and Golden Oldie.',
    baseFee: false,
    feeCents: 0,
    autoQualify: true,
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  {
    id: 'superdiver',
    name: 'Super Diver',
    emoji: '⭐',
    description: 'The ultimate all-round test. Competitors must enter all three nominated events: Snorkel Photography, Fin Swimming, and the Open Championship (A division). Scored on placing in each — 1st = 3pts, 2nd = 2pts, 3rd = 1pt. In a draw, the highest team placing in the Open decides.',
    format: 'No additional fee — automatically eligible when entered in all three: Open + Photography + Fin Swim · Aggregate scoring on placings',
    prizes: 'Super Diver Trophy — NZ Spearfishing Superdiver (Highest aggregate in snorkel photography, fin swim and spearfishing)',
    eligibility: 'Must be entered in Open Championship, Snorkel Photography, and Fin Swimming.',
    baseFee: false,
    feeCents: 0,
    autoQualify: true,
    color: '#b45309',
    bgColor: '#fefce8',
    borderColor: '#fef08a',
  },
]

// ── Nationals Public Page ────────────────────────────────────────────────────
export default function NationalsPage() {
  const navigate = useNavigate()
  const { member, session } = useMemberSession()
  const [nationals, setNationals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    supabase
      .from('competitions')
      .select('id, name, status, registration_cutoff, early_bird_cutoff')
      .ilike('name', '%nationals%2027%')
      .maybeSingle()
      .then(({ data }) => {
        setNationals(data)
        setLoading(false)
      })
  }, [])

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      {/* Header */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/nationals/admin')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ⚙ Admin
          </button>
          {!session && (
            <button onClick={() => navigate('/membership/login')}
              className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }} className="px-6 py-12 text-center">
        <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-2">Spearfishing New Zealand</p>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">National Championships</h1>
        <p className="text-white/80 text-lg mb-2">New Zealand's premier spearfishing event</p>
        <p className="text-white/60 text-sm mb-6">Tairua, Coromandel Peninsula · 19–24 January 2027</p>

        {/* Coming soon badge */}
        <div className="inline-flex items-center gap-2 bg-amber-400 text-amber-900 font-black text-sm px-4 py-2 rounded-full mb-6">
          📍 Tairua, Coromandel · 19–24 January 2027
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button onClick={() => setActiveTab('events')}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white border-2 border-white/40 hover:bg-white/10 transition">
            View Events
          </button>
          {nationals?.status === 'open' ? (
            <>
              <button onClick={() => navigate('/nationals/register')}
                className="px-6 py-2.5 rounded-xl text-sm font-black text-white border-2 border-white/40 hover:bg-white/10 transition">
                Register Team →
              </button>
              <button onClick={() => navigate('/nationals/register/individual')}
                className="px-6 py-2.5 rounded-xl text-sm font-bold text-white border-2 border-white/30 hover:bg-white/10 transition">
                Individual Entry →
              </button>
            </>
          ) : (
            <div className="px-6 py-2.5 rounded-xl text-sm font-black text-white/60 border-2 border-white/20 cursor-default">
              🔒 Registration Opens Soon
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <div className="flex gap-1 max-w-3xl mx-auto">
          {[['overview','Overview'],['events','Events'],['register','Register'],['results','Results']].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${activeTab===tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-3">About the Nationals</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                The SNZ National Championships are the pinnacle of competitive spearfishing in Aotearoa New Zealand.
                Held annually, Nationals brings together the country's best spearfishers for a week of competition,
                camaraderie, and celebration of our sport.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                The 2027 Nationals will be held at Tairua, Coromandel Peninsula, 19–24 January 2027.
                Registration details will be published here — follow SNZ on Facebook for announcements.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {[
                  { label: 'Location', value: 'Tairua, Coromandel', icon: '📍' },
                  { label: 'Dates', value: '19–24 Jan 2027', icon: '📅' },
                  { label: 'Events', value: '8 competitions', icon: '🏆' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-1">{item.icon}</p>
                    <p className="font-black text-gray-900 text-sm">{item.value}</p>
                    <p className="text-xs text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick event cards */}
            <div className="space-y-3">
              <h2 className="text-lg font-black text-gray-900 px-1">Events at a Glance</h2>
              {SUB_EVENTS.map(ev => (
                <div key={ev.id} className="bg-white border rounded-xl p-4 flex items-center gap-4"
                  style={{ borderColor: ev.borderColor }}>
                  <span className="text-2xl flex-shrink-0">{ev.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-gray-900 text-sm">{ev.name}</p>
                    <p className="text-xs text-gray-500 truncate">{ev.format}</p>
                  </div>
                  <button onClick={() => setActiveTab('events')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 flex-shrink-0">
                    Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Events tab */}
        {activeTab === 'events' && (
          <div className="space-y-6">
            <p className="text-gray-500 text-sm">Full event details, rules, and prize information will be published once confirmed by the committee.</p>
            {SUB_EVENTS.map(ev => (
              <div key={ev.id} className="bg-white border-2 rounded-2xl overflow-hidden"
                style={{ borderColor: ev.borderColor }}>
                <div className="px-5 py-4" style={{ background: ev.bgColor }}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{ev.emoji}</span>
                    <div>
                      <h3 className="font-black text-gray-900 text-lg">{ev.name}</h3>
                      <p className="text-xs font-semibold" style={{ color: ev.color }}>{ev.format}</p>
                    </div>
                    {ev.earlyBird && (
                      <span className="ml-auto text-xs font-black px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        🐦 Early bird pricing coming
                      </span>
                    )}
                    {ev.autoQualify && (
                      <span className="ml-auto text-xs font-black px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                        ✦ Auto-qualify
                      </span>
                    )}
                    {ev.perDiver && !ev.baseFee && !ev.autoQualify && (
                      <span className="ml-auto text-xs font-black px-2 py-1 rounded-full bg-teal-100 text-teal-700 border border-teal-200">
                        👤 Per diver
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-5 py-4 space-y-3">
                  <p className="text-sm text-gray-600 leading-relaxed">{ev.description}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Prizes</p>
                      <p className="text-sm text-gray-700">{ev.prizes}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Eligibility</p>
                      <p className="text-sm text-gray-700">{ev.eligibility}</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-bold text-amber-700">
                      {ev.feeCents > 0
                        ? `Entry fee: $${(ev.feeCents/100).toFixed(2)} ${ev.perDiver ? 'per diver' : 'per team'}`
                        : `Entry fee: TBC${ev.perDiver ? ' · charged per diver' : ' · charged per team'}`}
                    </p>
                    {ev.earlyBird && (
                      <p className="text-xs text-amber-600">🐦 Early bird discounts will be available — watch this space.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Register tab */}
        {activeTab === 'register' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-2">Team Registration</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Registration for the 2027 Nationals will open soon. When it opens, both divers must be active paid SNZ members to register.
                You'll select your events and pay the combined entry fee in a single checkout.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-black text-blue-900 mb-1">How entry works</p>
                <ul className="text-sm text-blue-800 space-y-1.5">
                  <li>• Both divers must be active SNZ members ($10/year)</li>
                  <li>• Pick and mix — enter any events you want, no minimum</li>
                  <li>• Juniors/Women's, Over 60s, and Open are selected per team</li>
                  <li>• 📸 Photography and 🐟 Fin Swim are per diver — one or both can enter independently</li>
                  <li>• You only pay for the events you choose</li>
                  <li>• One Stripe payment covers your full entry</li>
                  <li>• 🐦 Early bird pricing will be available — register early to save</li>
                  <li>• Merch orders can be placed at registration</li>
                </ul>
              </div>
              {nationals?.status === 'open' ? (
                <button onClick={() => navigate('/nationals/register')}
                  className="w-full py-3 rounded-xl font-black text-white text-sm"
                  style={{ background: SNZ_BLUE }}>
                  Register Your Team →
                </button>
              ) : (
                <>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-black text-amber-800">🗓 Registration opening date TBC — event 19–24 January 2027</p>
                    <p className="text-xs text-amber-700 mt-1">Make sure your SNZ membership is active so you're ready to register the moment entries open.</p>
                  </div>
                  {!session && (
                    <button onClick={() => navigate('/membership')}
                      className="w-full mt-4 py-3 rounded-xl font-black text-white text-sm"
                      style={{ background: SNZ_BLUE }}>
                      Join SNZ Now — Be Ready to Enter →
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Individual event entry */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-2">Individual Event Entry</h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Not entering the Open? You can enter individual events (Women's, Juniors, Photography, Fin Swim, Under 23) on their own with an optional safety diver.
              </p>
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-600 space-y-1.5 mb-4">
                <p>• Pick one or more individual events</p>
                <p>• Name a safety diver/observer (optional)</p>
                <p>• Same per-event pricing as team entries</p>
                <p>• SNZ membership still required</p>
              </div>
              <button onClick={() => navigate('/nationals/register/individual')}
                className="w-full py-3 rounded-xl font-black text-white text-sm"
                style={{ background: SNZ_BLUE }}>
                Register for Individual Events →
              </button>
            </div>
          </div>
        )}

        {/* Results tab */}
        {activeTab === 'results' && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <h2 className="text-xl font-black text-gray-900 mb-2">2027 Results</h2>
            <p className="text-gray-500 text-sm">Results will be published here during and after the event.</p>
          </div>
        )}

      </div>
    </div>
  )
}
