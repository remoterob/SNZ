// Netlify Function: Comp Copilot — AI advisor for club competition organisers
// Grounded in SNZ rules + specific competition metadata
// Requires env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

const { createClient } = require('@supabase/supabase-js')

// Condensed SNZ rules — the operational subset Copilot needs to know about.
// Full rules at https://www.spearfishingnz.co.nz — refer people there for detail.
const SNZ_RULES_SUMMARY = `
# SPEARFISHING NEW ZEALAND — COMPETITION RULES (summary for AI context)

## Competitor Eligibility
- Open to any NZ or international visitors who satisfy the CD of their ability
- Under-16s may compete in Open with CD approval after assessing partner
- Competitors are solely responsible for their own medical fitness to compete
- All competitors and safety swimmers MUST attend competition briefings (roll-call or sign-in required)

## Equipment
- Muscular-loaded spearguns / pole spears / Hawaiian slings only (NO compressed gas, NO powerheads)
- Mask, snorkel, fins, knife, weight belt, torch, protective clothing allowed
- NO flashers, flasher rigs, or fish attraction devices
- Each pair must have a Compliant Float: bright colour (red/yellow/orange/pink), min 10L, dive flag 15x20cm, self-righting, two float lines (short ≤4m, long 6-40m)
- Every team must carry an Orange Safety Sausage OR Smoke Flare
- Every team must carry a knife
- Carry water, food, medications
- GPS watches OK on wrist; no other GPS devices (no phones, chart plotters)

## Safety (Critical)
- Assisted ascents/descents NOT permitted
- Hypoxic event protocol: immediately leave water, notify safety boat + medic + CD, 1-week stand down, physician clearance required before return
- Buddy must monitor every dive
- Safety boat must carry: approved dive flag 600x600mm, VHF, cellphone, medic with CPR + O2, scuba diver + full scuba set, O2 cylinder, first aid kit, marker buoy, spare water/food, torch, copy of safety plan
- Before every comp: contact Police/Coastguard/Local Authorities, obtain weather, identify emergency medical centre
- Have a written Plan of Action for accidents/emergencies

## Pairs Competition
- At all times at least one member on surface
- One holds long float line, one holds short line
- Max 40m between pair on surface
- Partner may assist to land a fish but one must remain surface

## Individual Events
- Must have a safety Observer
- Observer may NOT: berley, tow competitor, find fish, load guns (except 10 and under), spear, help land fish, dive beneath surface (except safety), give general advice on specific fish
- For juniors ≤10 and Women's Recreational grade: observer can assist except firing speargun

## Women's Championships
- Same as Open with exceptions: 4-6 hour duration (CD discretion)
- Pairs where possible; individual with safety diver allowed
- Women's Recreational grade available but not eligible for the championship prize

## Junior Championships
- Swum as individual competition
- Under 18 on day of competition
- 4-6 hour duration

## Weighing In
- Minimum weight 500g per fish (450g gutted/gilled at CD discretion)
- Self-draining screening table; electronic scales
- Each team sorts own catch, presents to Weighmaster; once presented cannot touch
- Once presented fish become property of SNZ
- Non-compliant fish = 100 point penalty (under 80% min weight / ineligible species / breaches MPI / over allowable number)
- Over 8kg: weighed separately and 8kg added to bulk

## Scoring
- 100 points per eligible fish
- 10 points per kg of total catch weight
- Fish over 8kg capped at 8kg for bulk weight
- Scale read to nearest 100g below
- Ties → placing shared

## Penalties (auto-disqualification for the day)
- Outside competition area
- Starting before start signal
- Returning to triangle after finish signal

## Competition Area
- Run as 'swim competitions' — all assemble in Start/Finish Triangle before start
- CD signals start and finish
- Competitors must start and finish inside triangle
- No loaded spearguns in triangle
- Competitors may land catch on boats near triangle
- Any safety boat entry: must re-enter water at same position
- All boats operate at safe speeds per NZ Maritime Regs

## Eligible Species List
- Must be notified 4 months before event
- Prepared by host organisers (may consult SNZ exec)
- Cannot infringe recreational fisheries limits
- Gamefish/Hapuku category required
- Max 1 Kingfish per day per pair/individual
- Typical Northern list: snapper, trevally, kahawai, kingfish (1), tarakihi, porae, koheru, blue maomao, blue moki, butterfish, john dory, pink maomao, giant boarfish, golden snapper (2 each)
- Typical Wellington list: blue cod, butterfish, banded parrotfish, blue moki, copper moki, kahawai, trevally, tarakihi, warehou, sweep, mackerel, red mullet, snapper, kingfish (1), telescope fish, butterfly perch

## Disputes Committee
- 2 elected competitors + CD (chairman)
- Must be lodged in writing to CD within 4 hours of competition end (no later than 1hr after results announced)
- Decision is final; rule-interpretation disputes can be appealed to SNZ Committee in writing

## CD Duties (Key)
- Overall event compliance
- Safety briefings
- Define Start/Finish Triangle + record sign-in/out
- Apply penalties / refer to Disputes Committee
- Record results + trophy awards
- Post-event: communicate results, Incident Report for any near-misses, report to authorities as needed

## Catfish Cull (Lake Taupō) — key differences
- Hawaiian Slings / Pole Spears only (NO spearguns)
- Only catfish eligible
- Pairs (groups of 3 allowed but ineligible for top prizes)
- Fresh water — remove one weight from belt to compensate
- Trout are illegal to shoot — could end the event
- Koura and eels belong to Ngati Tuwharetoa — not to be taken
- Stay 200m from fly fishers
- No official safety boat (swim ashore / 111 for emergencies)

## Best Practice Notes
- Notify competitors 4+ months ahead
- Hosts should partner with local iwi on fish auction / use of marine resources
- Fish auction proceeds typically go to community organisation (MPI permit required)
- Weigh-in should be efficient: adjoining presentation table, start as soon as first team ashore
- Ice should be available for competitors waiting in queue
`.trim()

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) }
  }

  try {
    const { competitionId, messages, mode, sessionId, quickActionId } = JSON.parse(event.body || '{}')
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No messages provided' }) }
    }

    // Fetch comp context from Supabase — with 5s timeout so we don't exhaust our budget
    let compContext = 'Competition details: not available (no ID provided).'
    if (competitionId && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      try {
        const withTimeout = (promise, ms) => Promise.race([
          promise,
          new Promise((_, rej) => setTimeout(() => rej(new Error('Supabase timeout')), ms))
        ])

        const { data: comp } = await withTimeout(
          supabase.from('competitions').select('*').eq('id', competitionId).single(),
          5000
        )

        if (comp) {
          const [teamsResult, fishResult] = await Promise.all([
            withTimeout(
              supabase.from('comp_teams').select('*', { count: 'exact', head: true }).eq('competition_id', competitionId),
              3000
            ),
            withTimeout(
              supabase.from('comp_fish').select('species_name, points, max_weight_kg, allow_multiples, max_count').eq('competition_id', competitionId).order('sort_order'),
              3000
            ),
          ])
          const teamCount = teamsResult.count || 0
          const fishList = fishResult.data || []

          // Format dates
          const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : null

          // Format category fees (Nationals multi-event or single entry fee)
          const EVENT_NAMES = {
            open: 'Open Championship',
            womens: "Women's Championship",
            juniors: 'Junior Championship',
            goldenoldie: 'Golden Oldie',
            photography: 'Snorkel Photography',
            under23: 'Under 23 Division',
            finswim: 'Fin Swimming',
          }
          let feesSection = ''
          if (comp.category_fees) {
            const lines = []
            for (const [key, val] of Object.entries(comp.category_fees)) {
              if (key === 'merch') {
                if (val.jacket?.price) lines.push(`  - Jacket: $${(val.jacket.price / 100).toFixed(2)}`)
                if (val.shirt?.price) lines.push(`  - Shirt: $${(val.shirt.price / 100).toFixed(2)}`)
              } else if (key === 'meal') {
                if (val.price) lines.push(`  - Gala dinner ticket: $${(val.price / 100).toFixed(2)}`)
              } else if (EVENT_NAMES[key]) {
                const std = val.standard != null ? `$${(val.standard / 100).toFixed(2)} pp` : 'TBC'
                const eb = val.early_bird != null ? ` (early bird: $${(val.early_bird / 100).toFixed(2)} pp)` : ''
                lines.push(`  - ${EVENT_NAMES[key]}: ${std}${eb}`)
              }
            }
            if (lines.length) feesSection = `- Entry fees per person:\n${lines.join('\n')}`
          } else if (comp.entry_fee_cents) {
            feesSection = `- Entry fee: $${(comp.entry_fee_cents / 100).toFixed(2)}`
          }

          // Fish list
          let fishSection = ''
          if (fishList.length > 0) {
            const fishLines = fishList.map(f => {
              const pts = f.points || 100
              const cap = f.max_weight_kg ? ` (weight capped at ${f.max_weight_kg}kg)` : ''
              const multi = f.allow_multiples && f.max_count ? ` — up to ${f.max_count} per team` : ''
              return `  - ${f.species_name}: ${pts} pts base${cap}${multi}`
            })
            fishSection = `- Eligible fish list:\n${fishLines.join('\n')}`
          } else if (comp.fish_list) {
            fishSection = `- Fish list: ${JSON.stringify(comp.fish_list).slice(0, 500)}`
          }

          compContext = `
## THIS COMPETITION'S DETAILS
- Name: ${comp.name || '(no name)'}
- Organiser/Club: ${comp.club_name || comp.host_club || '(not specified)'}
- Location: ${comp.location || '(not specified)'}
- Date: ${fmtDate(comp.date_start) || fmtDate(comp.start_date) || '(not specified)'}${(comp.date_end || comp.end_date) ? ` to ${fmtDate(comp.date_end || comp.end_date)}` : ''}
- Status: ${comp.status || '(not specified)'}
- Scoring: ${comp.scoring_mode === 'bingo' ? 'Fish Bingo (fixed points per species)' : 'Standard SNZ scoring (100 pts per fish + 10 pts/kg)'}
- Registered teams so far: ${teamCount}
${comp.registration_cutoff ? `- Entries close: ${fmtDate(comp.registration_cutoff)}` : ''}
${comp.early_bird_cutoff ? `- Early bird cutoff: ${fmtDate(comp.early_bird_cutoff)}` : ''}
${feesSection}
${fishSection}
${comp.description || comp.details ? `- Description: ${comp.description || comp.details}` : ''}
${comp.event_info ? `- Event info: ${comp.event_info}` : ''}
${comp.rules ? `- Competition rules/notes: ${comp.rules}` : ''}
${comp.notes ? `- Organiser notes: ${comp.notes}` : ''}
`.replace(/\n{3,}/g, '\n\n').trim()
        }
      } catch (dbErr) {
        console.error('Supabase lookup failed:', dbErr)
        compContext = `Competition lookup failed: ${dbErr.message}. Proceed without specific comp context.`
      }
    }

    const systemPrompt = mode === 'competitor'
      ? `You are a helpful competition assistant for Spearfishing New Zealand (SNZ). You answer questions from competitors who are entered in, or considering entering, a specific competition.

Your knowledge comes from two sources:
1. **SNZ Competition Rules** (provided below) — authoritative, always reference these for rule questions
2. **This specific competition's details** (provided below) — use for all comp-specific questions

${SNZ_RULES_SUMMARY}

---

${compContext}

---

## YOUR ROLE

Help competitors with:
- **What to bring**: mandatory safety gear, allowed equipment, what is and isn't permitted
- **Fish & scoring**: eligible species, limits, how points are calculated, weight bonuses
- **Weigh-in**: process, minimum weights, penalties for undersized or ineligible fish
- **Safety rules**: buddy requirements, float rules, hypoxic event protocol
- **Penalties & DQs**: what breaches the rules and what the consequences are
- **Competition area**: start/finish triangle, area boundaries, boat rules
- **General questions**: anything a first-time or returning competitor might want to know

## TONE & STYLE
- Friendly, encouraging, and clear — like a knowledgeable club member helping out a teammate
- NZ English spelling (organise, colour, etc)
- Concise. Use bullet points and short paragraphs
- Use markdown (**bold**, *italic*, bullets with -)
- Never overclaim — say "based on SNZ rules" or "confirm with the competition organiser" when uncertain

## CRITICAL BOUNDARIES
- NEVER give medical advice beyond "seek professional medical attention immediately"
- For hypoxic events / SWB, always be clear: leave the water immediately, 1-week stand-down minimum, physician clearance required before competing again
- Never encourage actions that would breach MPI fisheries rules
- For questions about specific comp logistics not covered by the details above (e.g. exact launch site, registration check-in time), direct them to contact the organiser directly

## IMPORTANT
- Always reference the specific competition's fish list and details when answering
- If a detail isn't in the competition info provided (e.g. exact start time), say so and suggest they check with the organiser`
      : `You are "Comp Copilot" — an AI advisor helping New Zealand spearfishing club organisers run safe, fair, and well-promoted competitions. You work for Spearfishing New Zealand (SNZ).

Your knowledge comes from two sources:
1. **SNZ Competition Rules** (provided below) — authoritative, always reference these for rule questions
2. **This specific competition's details** (provided below) — use for context when drafting anything specific

${SNZ_RULES_SUMMARY}

---

${compContext}

---

## YOUR ROLE

Help club organisers with:
- **Promotion**: Facebook posts, email drafts, community announcements
- **Pre-comp logistics**: briefings, safety checklists, weather decisions, permits, iwi partnerships
- **During-comp**: quick rule clarifications, penalty guidance, dispute handling
- **Post-comp**: results announcements, social media, incident reporting
- **Fish list**: suggesting considerations, referencing typical lists

## TONE & STYLE
- Friendly, practical, and direct — like a senior SNZ committee member
- NZ English spelling (organise, colour, etc)
- Concise. Use bullet points and short paragraphs
- Use markdown (**bold**, *italic*, bullets with -, \`code\`)
- Never overclaim — say "based on SNZ rules" or "you should confirm with the CD" when uncertain
- If someone asks a rule question you're not 100% sure on, point them to the full rules PDF on spearfishingnz.co.nz

## CRITICAL BOUNDARIES
- NEVER give medical advice beyond "seek professional medical attention"
- NEVER make legal or liability calls — defer to SNZ executive
- For hypoxic events / SWB, always reinforce: 1 week stand-down, physician clearance, CD approval before return
- For weather / postponement decisions, help them think through factors but don't make the call yourself — that's the CD's call
- For disputes, outline the process but don't pre-judge outcomes
- Never encourage actions that would breach MPI fisheries rules

## IMPORTANT
- When drafting promo or social posts, include realistic placeholders like [date], [entry link], [contact] where the user will need to fill in
- When giving checklists, be thorough but practical — 5-10 items is usually enough
- Always ground advice in the specific competition context provided above
- If competition details are missing something important, flag it (e.g. "You haven't set an entry fee yet — worth confirming before promoting")`

    const callStart = Date.now()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 22000) // 22s — leave buffer before 26s Netlify limit

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: [
          { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
        ],
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic API error:', res.status, errText)
      // Parse Anthropic error for clearer user message
      let detail = errText.slice(0, 200)
      try {
        const parsed = JSON.parse(errText)
        if (parsed.error?.message) detail = parsed.error.message
      } catch {}
      return { statusCode: 502, body: JSON.stringify({ error: `AI service error (${res.status}): ${detail}` }) }
    }

    const data = await res.json()
    const textBlock = data.content?.find(c => c.type === 'text')
    const reply = textBlock?.text?.trim() || '(no response)'

    // Log the conversation turn — fire and forget
    if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseLog = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const userMessage = messages[messages.length - 1]
      supabaseLog.from('copilot_events').insert({
        mode: mode || 'admin',
        competition_id: competitionId || null,
        session_id: sessionId || null,
        question: userMessage?.content || '',
        response_length_chars: reply.length,
        quick_action_id: quickActionId || null,
        response_time_ms: Date.now() - callStart,
      }).then(() => {})
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply }),
    }
  } catch (err) {
    console.error('Comp Copilot error:', err)
    if (err.name === 'AbortError') {
      return { statusCode: 504, body: JSON.stringify({ error: 'Response took too long. Try a shorter question or quick action.' }) }
    }
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
