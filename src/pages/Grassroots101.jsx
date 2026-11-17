// Grassroots 101 — how a club films its own Grassroots Spearo episode.
// "Download PDF" uses the browser's print-to-PDF; print styles hide the chrome.
import { useNavigate } from 'react-router-dom'
import { GrassrootsShell } from './GrassrootsPage'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

export const INTERVIEW_QUESTIONS = [
  { group: 'About the club', start: 1, qs: [
    "Who are you, what's your role here, and how long have you been part of it?",
    "How did the club get started, and how long's it been going?",
    "Who's in it now: how many of you, and what does the mix look like?",
  ] },
  { group: 'What you do', start: 4, qs: [
    'Walk me through a typical year. The comps, the trips, the events.',
    "What's the one thing on the calendar everyone turns up for?",
  ] },
  { group: 'The water', start: 6, qs: [
    "Describe the diving here to someone who's never put their head under it.",
    'What are you typically targeting? Is there a fish that says this is our patch?',
  ] },
  { group: 'The people', start: 8, qs: [
    'Every club has a few people quietly holding it together. Who are yours, and what do they do that no one else does?',
    "Tell me about a day on the water here you'll never forget.",
  ] },
  { group: 'The harder ground', start: 10, qs: [
    "What's changed out there since you started diving this coast?",
    "What's the hardest part of keeping a club going right now?",
  ] },
  { group: 'Forward', start: 12, qs: [
    'Someone watches this and wants in. What do they do, and what do their first few months look like?',
    'What would help your club most, from SNZ or from anyone?',
  ] },
  { group: 'The closer (ask everyone, same words every time)', start: 14, qs: [
    'In one sentence: why does this club matter?',
  ] },
]

const ALLOCATION = [
  ['President or club captain', '1, 2, 3, 11, 13'],
  ['A long-standing member', '6, 7, 9, 10'],
  ['A newer member', '1, 12'],
  ['Everyone except the person who is the answer', '8'],
  ['Everyone', '14'],
]

const SHOOTING_TIPS = [
  ['Film landscape', 'Turn the phone sideways. Every time.'],
  ['Quiet room', 'No fridges, fans, traffic or wind. Background noise can\'t be fixed in the edit.'],
  ['Plain background', 'A wall, a shed, the clubrooms. Avoid bright windows behind the person.'],
  ['Frame chest-up', 'Eyes about a third of the way down the frame, a little space above the head.'],
  ['Use a clip-on mic', 'A cheap lapel mic plugged into the phone beats the built-in mic by a mile.'],
  ['GoPro in Linear mode', 'If you use a GoPro for interviews, Linear mode stops the fish-eye bend.'],
  ['Don\'t talk over answers', 'Let the person finish and pause before the next question — it gives us clean cuts.'],
  ['Ask the question back', 'Ask people to repeat the question in their answer ("The club started in…"), so it stands on its own.'],
]

const B_ROLL = [
  'Diving: entries, descents, fish, the reef, the surface between dives',
  'Pool sessions and training nights',
  'Club days, comps, weigh-ins and prize-givings',
  'Catches on the boat and at the cleaning table',
  'People: faces, laughter, gear prep, the car park chat',
  'The place: the coastline, the boat ramp, the town sign, from the air if you have a drone',
]

function Card({ title, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 break-inside-avoid print:border-0 print:p-0 print:mt-6">
      <h2 className="font-black text-gray-900 text-lg">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default function Grassroots101() {
  const navigate = useNavigate()
  return (
    <GrassrootsShell>
      <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
        className="rounded-2xl px-6 py-9 text-center print:bg-none print:text-black print:p-0">
        <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-2 print:text-gray-500">Grassroots Spearo</p>
        <h1 className="text-3xl font-black text-white leading-tight print:text-black">Grassroots 101</h1>
        <p className="text-blue-100 text-sm leading-relaxed max-w-xl mx-auto mt-3 print:text-gray-700">
          How to film your club's own Grassroots episode. Follow this and send us the clips — we'll do the edit.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3 print:hidden">
          <button onClick={() => window.print()}
            className="px-5 py-2.5 rounded-xl font-black text-sm bg-white hover:opacity-90" style={{ color: SNZ_DARK }}>
            ⬇ Download / print PDF
          </button>
          <button onClick={() => navigate('/grassroots/submit')}
            className="px-5 py-2.5 rounded-xl font-black text-sm text-white bg-white/15 border border-white/30 hover:bg-white/25">
            Send us your club →
          </button>
        </div>
      </div>

      <Card title="The short version">
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1.5 leading-relaxed">
          <li>Pick three or four people: the president or captain, a long-standing member, a newer member.</li>
          <li>Interview each of them using the questions below, filmed with the shooting tips.</li>
          <li>Film plenty of supporting footage: diving, club days, people.</li>
          <li>Upload everything to YouTube as <strong>unlisted</strong> videos.</li>
          <li>Send us the links through the <a href="/grassroots/submit" className="font-bold" style={{ color: SNZ_BLUE }}>club form</a>.</li>
        </ol>
      </Card>

      <Card title="Interview questions">
        <p className="text-sm text-gray-600 leading-relaxed">
          These are the same fourteen questions SNZ uses at every Grassroots stop. Spread them across three or
          four people rather than asking all fourteen of one person.
        </p>
        <div className="mt-4 space-y-4">
          {INTERVIEW_QUESTIONS.map(g => (
            <div key={g.group} className="break-inside-avoid">
              <p className="text-xs font-black uppercase tracking-wider text-gray-500">{g.group}</p>
              <ol start={g.start} className="list-decimal pl-6 mt-1.5 space-y-1.5 text-sm text-gray-800 leading-relaxed">
                {g.qs.map(q => <li key={q}>{q}</li>)}
              </ol>
            </div>
          ))}
        </div>
        <div className="mt-5 break-inside-avoid">
          <p className="text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Who answers what</p>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {ALLOCATION.map(([who, qs]) => (
                <tr key={who}><td className="py-1.5 pr-3 text-gray-700">{who}</td><td className="py-1.5 font-bold text-gray-900 whitespace-nowrap">{qs}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Shooting tips">
        <ul className="space-y-2.5">
          {SHOOTING_TIPS.map(([t, d]) => (
            <li key={t} className="text-sm leading-relaxed">
              <span className="font-bold text-gray-900">{t}.</span> <span className="text-gray-600">{d}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Supporting footage">
        <p className="text-sm text-gray-600 leading-relaxed mb-2">
          Interviews carry the story; this is what we cut to while people talk. More is better — 20 minutes of
          footage might make 20 seconds of the episode, and that's normal.
        </p>
        <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
          {B_ROLL.map(b => <li key={b}>{b}</li>)}
        </ul>
      </Card>

      <Card title="How to send it">
        <ol className="list-decimal pl-5 text-sm text-gray-700 space-y-1.5 leading-relaxed">
          <li>Upload each clip to YouTube. Set visibility to <strong>Unlisted</strong> — only people with the link can see it.</li>
          <li>Upload at the highest quality you have. Don't trim or add music; we'll do that.</li>
          <li>Name each clip with who's in it (e.g. "Interview – Sarah, president").</li>
          <li>Paste the links into the <a href="/grassroots/submit" className="font-bold" style={{ color: SNZ_BLUE }}>Grassroots club form</a>. You can send more later by replying to our confirmation email.</li>
        </ol>
      </Card>

      <Card title="What good looks like">
        <p className="text-sm text-gray-600 leading-relaxed">
          Watch any of the published episodes on the <a href="/grassroots" className="font-bold" style={{ color: SNZ_BLUE }}>Grassroots page</a> —
          they were all built from exactly this: a handful of interviews and a lot of footage of people diving and
          being a club.
        </p>
      </Card>
    </GrassrootsShell>
  )
}
