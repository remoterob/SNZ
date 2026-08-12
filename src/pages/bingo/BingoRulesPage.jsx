import { nzFormat } from '../../lib/bingo/helpers'

// Fallback used only if a compCfg row predates the rules_sections column
// (empty array) — keeps the page non-blank rather than showing nothing.
const FALLBACK_SECTIONS = [
  { title: '1️⃣ Participation & Risk', body: '**Participation in Fish Bingo is entirely at your own risk.** Spearfishing and freediving are inherently dangerous activities that carry the risk of serious injury or death. By participating in Fish Bingo, you acknowledge you accept all risks, agree the organisers have no responsibility or liability for any injury, loss, or death, and confirm you will comply with all relevant laws and safety practices (including diving with a competent buddy and staying within your limits). Participants under 18 must be accompanied *in the water* and directly supervised by a parent or legal guardian. **Dive safe, with a good buddy.**' },
  { title: '2️⃣ Eligibility', body: 'Open to active SNZ members. Fish must be speared in New Zealand waters only.' },
  { title: '3️⃣ How to Play', body: 'Find your fish and claim it in the app. 📸 Upload a pic against your claim within 7 days of catching the fish.\n\nFish must be caught by you, while freediving (no tanks, no tackle).' },
  { title: '4️⃣ Scoring', body: 'Points are based on species difficulty. Points are **doubled** if it is truly the first time you have ever caught that species, *or* if it was caught with a pole spear.\n\nSome species combinations unlock bonus rows for extra points.' },
  { title: '5️⃣ Safety & Fair Play', body: 'All local laws and size limits apply. Treat the ocean with respect – no waste, no overfishing.' },
  { title: '6️⃣ Participation > Prizes', body: 'This comp is about stoke, species, and community. By participating and uploading pictures, you give consent for us to share your pictures via SNZ social media.' },
  { title: '7️⃣ The Spirit of Bingo', body: 'Give your mate tips, bring them on trips, and help them target new species too. It is meant to be fun. Be safe, be honest, cheer on others, and remember: the ocean always wins in the end.' },
]

// Minimal markdown renderer — bold, italic, line breaks. Mirrors the same
// small pattern used for tips text elsewhere in the app (FishIDPage.jsx).
export function RuleBody({ text }) {
  const lines = (text || '').split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        const html = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </div>
  )
}

export default function BingoRulesPage({ compCfg }) {
  const sections = compCfg?.rules_sections?.length ? compCfg.rules_sections : FALLBACK_SECTIONS

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-black text-gray-900 mb-1">🤿 Fish Bingo Rules</h1>
      <p className="text-sm text-gray-400 italic mb-6">(a.k.a. The Fine Print You Will Pretend to Read)</p>

      <div className="space-y-5">
        {compCfg?.comp_start && compCfg?.comp_end && (
          <div>
            <h2 className="font-black text-gray-900 mb-1.5">📅 Dates</h2>
            <div className="text-sm text-gray-600 leading-relaxed">
              <p>The competition runs <strong>{nzFormat(compCfg.comp_start)} – {nzFormat(compCfg.comp_end)}</strong>. You can register early, but you will not be able to claim points until kickoff.</p>
            </div>
          </div>
        )}
        {sections.map(s => (
          <div key={s.title}>
            <h2 className="font-black text-gray-900 mb-1.5">{s.title}</h2>
            <div className="text-sm text-gray-600 leading-relaxed">
              <RuleBody text={s.body} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
