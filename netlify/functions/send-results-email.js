export const handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    }
  }

  try {
    const { 
      emails, 
      teamNumber, 
      teamNames, 
      catfishCount, 
      division, 
      heaviestFish, 
      lightestFish, 
      eligible 
    } = JSON.parse(event.body)

    // Construct email content
    const eligibilityNote = !eligible 
      ? '⚠️ Note: 3-person teams are not eligible for prizes or placements\n\n' 
      : ''

    const prizeFishText = []
    if (heaviestFish) prizeFishText.push(`🏆 Heaviest Fish: ${heaviestFish}g`)
    if (lightestFish) prizeFishText.push(`🏆 Lightest Fish: ${lightestFish}g`)

    const emailContent = `
Hi ${teamNames},

Great diving today! Here are your ${eligible ? 'PROVISIONAL' : ''} results:

${eligibilityNote}⚠️ IMPORTANT: These results are provisional and subject to 
protests and official review. Final results will be announced 
at prizegiving.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Team Number: #${teamNumber}
Division: ${division}
Catfish Count: ${catfishCount}
${prizeFishText.length > 0 ? '\n' + prizeFishText.join('\n') : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ Protest Period: Until 5:00 PM today
Final results announced at prizegiving: 6:30 PM

View the live leaderboard: ${process.env.URL || 'https://catfish-cull.netlify.app'}

See you at prizegiving!

Spearfishing New Zealand
Motuoapa Fishing & Boating Club
Lake Taupō
    `.trim()

    // For development/testing without Resend API
    if (!process.env.VITE_RESEND_API_KEY) {
      console.log('Email would be sent to:', emails)
      console.log('Content:', emailContent)
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'Email simulated (no API key configured)',
          emails,
          content: emailContent
        })
      }
    }

    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Catfish Cull <noreply@catfishcull.co.nz>',
        to: emails,
        subject: `Your Catfish Cull Results - Team #${teamNumber} [PROVISIONAL]`,
        text: emailContent
      })
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Resend API error:', data)
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data })
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Email sent successfully',
        data 
      })
    }

  } catch (error) {
    console.error('Function error:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}
