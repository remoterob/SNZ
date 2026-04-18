import { useState } from 'react'
import CompCopilot from './CompCopilot'

const SNZ_BLUE = '#2B6CB0'

// Drop this anywhere on a competition admin page.
// It renders a floating action button bottom-right. Click to open the Copilot drawer.
// Usage:
//   <CompCopilotFAB competitionId={id} competitionName={comp.name} />
export default function CompCopilotFAB({ competitionId, competitionName }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-30 rounded-full shadow-2xl hover:scale-105 transition text-white font-black text-sm px-5 py-3 flex items-center gap-2 border-2 border-white"
          style={{ background: SNZ_BLUE }}
          title="Open Comp Copilot"
        >
          <span className="text-lg">🤖</span>
          <span className="hidden sm:inline">Comp Copilot</span>
        </button>
      )}
      <CompCopilot
        competitionId={competitionId}
        competitionName={competitionName}
        isOpen={open}
        onClose={() => setOpen(false)}
      />
    </>
  )
}
