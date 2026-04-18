// Netlify Function: identify fish species from image using Claude vision
// Requires env var: ANTHROPIC_API_KEY

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' })
    }
  }

  try {
    const { imageBase64, mediaType } = JSON.parse(event.body || '{}')
    if (!imageBase64) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No image provided' }) }
    }

    const prompt = `You are a New Zealand marine fish identification expert. A spearfisher has photographed a fish and needs accurate species identification.

Analyse the image carefully and systematically. Before giving your answer, think through:
1. Body shape and proportions (elongated, deep-bodied, round)
2. Fin structure and position (dorsal fin shape, caudal/tail fin shape — forked, rounded, lunate)
3. Head features (mouth shape and size, eye position, operculum)
4. Colour and pattern (base colour, markings, iridescence)
5. Scale size and texture
6. Relative size if there's scale reference
7. Habitat clues visible in the photo

Common NZ spearfishing species to consider:
- Snapper (Chrysophrys auratus) — pinkish-red with blue spots, deep body, single dorsal fin
- Trevally (Pseudocaranx georgianus) — silvery-green, elongated, yellow stripe, forked tail, black spot near gill
- Kahawai (Arripis trutta) — elongated silvery body with greenish back, often with spots on upper flanks
- Kingfish (Seriola lalandi) — streamlined, yellow lateral stripe, yellow tail, blue-green back
- Blue cod (Parapercis colias) — blue-grey, elongated, large pectoral fins, found on sandy bottoms
- Butterfish / greenbone (Odax pullus) — long slender body, small mouth, green or bronze
- Parore (Girella tricuspidata) — grey-silver with dark vertical bars, deep body, small mouth
- Moki (Latridopsis ciliaris) — elongated silvery-grey body with diagonal dark bars
- Tarakihi (Nemadactylus macropterus) — silvery, elongated, distinctive black bar behind head
- John Dory (Zeus faber) — deep laterally-compressed body, large mouth, black "thumbprint" spot
- Hapuku / groper (Polyprion oxygeneios) — large, grey-brown, robust
- Kelpfish / marblefish (Aplodactylus spp.) — elongated, mottled pattern
- Leatherjacket (Parika scaber) — small triangular body, single dorsal spine
- Red moki (Cheilodactylus spectabilis) — reddish with dark vertical bars
- Crayfish (Jasus edwardsii) — red/orange spiny lobster, not a fish
- Kina (Evechinus chloroticus) — sea urchin, not a fish

Common misidentifications to watch for:
- Trevally vs Kahawai — trevally has deeper body, bold yellow stripe, and black spot near gill; kahawai is more elongated with spots and no yellow stripe
- Snapper vs red moki — snapper has blue spots on pink-red body; red moki has dark vertical bars
- Blue cod vs blue moki — blue cod is found on sandy bottom with large pectoral fins; blue moki is silvery grey with dark bars

Respond ONLY with a valid JSON object (no markdown code fences, no preamble) in this exact shape:

{
  "commonName": "NZ common name",
  "scientificName": "Latin binomial",
  "confidence": "high" | "medium" | "low",
  "distinguishingFeatures": "1-2 sentences describing the specific features you see in the image that identify it",
  "alternativeSpecies": ["list 1-3 other NZ species it could be confused with"],
  "notes": "any relevant NZ-specific notes — minimum legal size varies by QMA, protected status, commonly confused species, etc. Keep under 2 sentences."
}

Rules:
- If the fish fills <20% of the image or is blurry: set confidence to "low" and mention the image quality in notes.
- If you cannot narrow to one species, give your best guess and list 2-3 alternatives.
- If the image is not a fish: return commonName="Not a fish" and explain in notes.
- Never hallucinate — if unsure, say so.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType || 'image/jpeg',
                  data: imageBase64,
                },
              },
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('Anthropic API error:', res.status, errText)
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `AI service error (${res.status})` })
      }
    }

    const data = await res.json()
    const textBlock = data.content?.find(c => c.type === 'text')
    const rawText = textBlock?.text?.trim() || ''

    // Strip markdown code fences if present
    let cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    // Sometimes the model emits prose before JSON — extract the first { ... } block
    const jsonStart = cleaned.indexOf('{')
    const jsonEnd = cleaned.lastIndexOf('}')
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      cleaned = cleaned.slice(jsonStart, jsonEnd + 1)
    }

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('Failed to parse Claude response:', rawText)
      return {
        statusCode: 502,
        body: JSON.stringify({
          error: 'AI returned malformed response',
          raw: rawText.slice(0, 500),
        })
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    }

  } catch (err) {
    console.error('Fish ID error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    }
  }
}
