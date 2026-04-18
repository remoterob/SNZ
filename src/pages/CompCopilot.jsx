import { useState, useRef, useEffect } from 'react'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// Pre-built quick-action prompts
const QUICK_ACTIONS = [
  { id: 'promo', label: '📣 Draft Facebook Promo', prompt: 'Draft a Facebook post to promote this competition. Include the key details (date, location, entry deadline, fees), a compelling hook, and a call-to-action. Tone: friendly, energetic, community-focused.' },
  { id: 'briefing', label: '🎤 Pre-Comp Briefing', prompt: 'Draft pre-competition briefing notes the Competition Director can read out. Cover: safety essentials from SNZ rules, competition area, timing, fish list reminder, weigh-in procedure, and emergency contacts. Keep it concise but comprehensive.' },
  { id: 'safety', label: '🛟 Safety Checklist', prompt: 'Generate a morning-of safety checklist for the CD — safety boats, medic, VHF, roll call, weather check, emergency contacts. Based on SNZ safety rules.' },
  { id: 'results', label: '🏆 Results Announcement', prompt: 'Draft a results announcement post (Facebook/Instagram). Placeholder for top 3 teams and largest fish — make it ready to fill in. Upbeat, thank competitors and sponsors.' },
  { id: 'weather', label: '🌦️ Weather Postponement', prompt: 'Weather is looking marginal. Help me think through whether to postpone. What factors should I consider? How should I communicate a postponement to competitors?' },
  { id: 'fishlist', label: '🐟 Fish List Advice', prompt: 'Suggest considerations for setting the eligible species list for this competition — abundance, fairness, scoring balance. Reference SNZ rules.' },
]

export default function CompCopilot({ competitionId, competitionName, isOpen, onClose }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Welcome message on first open
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm Comp Copilot. I know the SNZ competition rules and I can see the details of **${competitionName || 'this competition'}**.\n\nI can help you with:\n• Promoting your comp on social media\n• Pre-comp briefings and safety checklists\n• Weather calls and postponement decisions\n• Results announcements\n• Fish list and scoring questions\n\nAsk me anything — or use the quick actions below to get started.`
      }])
    }
  }, [isOpen, competitionName, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async (text) => {
    const userMessage = text.trim()
    if (!userMessage || loading) return
    setInput('')
    setError('')

    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/.netlify/functions/comp-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Copilot error')
      setMessages([...newMessages, { role: 'assistant', content: data.reply }])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 w-full lg:w-[480px] bg-white z-50 flex flex-col shadow-2xl border-l border-gray-200">
        {/* Header */}
        <div style={{ background: SNZ_DARK }} className="px-5 py-4 flex items-center justify-between text-white flex-shrink-0">
          <div>
            <h3 className="font-black text-lg flex items-center gap-2">🤖 Comp Copilot</h3>
            <p className="text-xs text-white/60">AI advisor grounded in SNZ rules</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 text-xl">×</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-gray-50">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
              }`}>
                <MarkdownLite text={m.content} />
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-gray-500">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </span>
              </div>
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">{error}</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick actions */}
        <div className="border-t border-gray-200 px-3 py-2 bg-white flex-shrink-0">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {QUICK_ACTIONS.map(a => (
              <button key={a.id} onClick={() => send(a.prompt)} disabled={loading}
                className="flex-shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap disabled:opacity-50">
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-4 py-3 bg-white flex gap-2 flex-shrink-0">
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
            placeholder="Ask anything about running this comp…"
            rows={1}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            style={{ minHeight: 40, maxHeight: 120 }}
          />
          <button onClick={() => send(input)} disabled={loading || !input.trim()}
            className="px-4 rounded-xl text-sm font-black text-white disabled:opacity-40"
            style={{ background: SNZ_BLUE }}>
            →
          </button>
        </div>

        <div className="px-4 py-1.5 text-[10px] text-gray-400 text-center bg-gray-50 border-t border-gray-100 flex-shrink-0">
          AI assistant · Always verify critical decisions with SNZ exec
        </div>
      </div>
    </>
  )
}

// Small markdown renderer — just bold, italic, line breaks, bullets
function MarkdownLite({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        const isBullet = /^\s*[•\-\*]\s/.test(line)
        const cleaned = line.replace(/^\s*[•\-\*]\s/, '')
        const html = cleaned
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded text-xs">$1</code>')
        return (
          <div key={i} className={isBullet ? 'flex gap-2' : ''}>
            {isBullet && <span className="flex-shrink-0">•</span>}
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        )
      })}
    </div>
  )
}
