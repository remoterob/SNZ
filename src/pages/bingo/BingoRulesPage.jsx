const SECTIONS = [
  {
    title: '📅 Dates',
    body: <p>The competition runs <strong>1 November – 30 April</strong>. You can register early, but you will not be able to claim points until kickoff.</p>,
  },
  {
    title: '1️⃣ Participation & Risk',
    body: <p><strong>Participation in Fish Bingo is entirely at your own risk.</strong> Spearfishing and freediving are inherently dangerous activities that carry the risk of serious injury or death. By participating in Fish Bingo, you acknowledge you accept all risks, agree the organisers have no responsibility or liability for any injury, loss, or death, and confirm you will comply with all relevant laws and safety practices (including diving with a competent buddy and staying within your limits). Participants under 18 must be accompanied <em>in the water</em> and directly supervised by a parent or legal guardian. <strong>Dive safe, with a good buddy.</strong></p>,
  },
  {
    title: '2️⃣ Eligibility',
    body: <p>Open to active SNZ members. Fish must be speared in New Zealand waters only.</p>,
  },
  {
    title: '3️⃣ How to Play',
    body: <>
      <p>Find your fish and claim it in the app. 📸 Upload a pic against your claim within 7 days of catching the fish.</p>
      <p>Fish must be caught by you, while freediving (no tanks, no tackle).</p>
    </>,
  },
  {
    title: '4️⃣ Scoring',
    body: <>
      <p>Points are based on species difficulty. Points are <strong>doubled</strong> if it is truly the first time you have ever caught that species.</p>
      <p>Some species combinations unlock bonus rows for extra points.</p>
    </>,
  },
  {
    title: '5️⃣ Safety & Fair Play',
    body: <p>All local laws and size limits apply. Treat the ocean with respect – no waste, no overfishing.</p>,
  },
  {
    title: '6️⃣ Participation > Prizes',
    body: <p>This comp is about stoke, species, and community. By participating and uploading pictures, you give consent for us to share your pictures via SNZ social media.</p>,
  },
  {
    title: '7️⃣ The Spirit of Bingo',
    body: <p>Give your mate tips, bring them on trips, and help them target new species too. It is meant to be fun. Be safe, be honest, cheer on others, and remember: the ocean always wins in the end.</p>,
  },
]

export default function BingoRulesPage() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-1">🤿 Fish Bingo Rules</h1>
      <p className="text-sm text-gray-400 italic mb-6">(a.k.a. The Fine Print You Will Pretend to Read)</p>

      <div className="space-y-5">
        {SECTIONS.map(s => (
          <div key={s.title}>
            <h2 className="font-black text-gray-900 mb-1.5">{s.title}</h2>
            <div className="text-sm text-gray-600 leading-relaxed space-y-2">{s.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
