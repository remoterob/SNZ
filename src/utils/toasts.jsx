import { useState, useEffect } from 'react'

const ToastBus = {
  subs: new Set(),
  push(msg) { this.subs.forEach(fn => fn(msg)) }
}

export function notify(text, type = 'info') {
  ToastBus.push({ id: Date.now() + Math.random(), text, type })
}

export function Toasts() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const sub = (m) => {
      setItems(prev => [...prev, m])
      setTimeout(() => setItems(prev => prev.filter(x => x.id !== m.id)), 3500)
    }
    ToastBus.subs.add(sub)
    return () => ToastBus.subs.delete(sub)
  }, [])
  return (
    <div style={{ position: 'fixed', left: 0, right: 0, bottom: 12, display: 'grid', placeItems: 'center', pointerEvents: 'none', zIndex: 9999 }}>
      <div style={{ display: 'grid', gap: 8, width: 'min(520px, 92vw)' }}>
        {items.map(m => (
          <div key={m.id} role="status"
            style={{
              pointerEvents: 'auto',
              background: m.type === 'error' ? '#b00020' : m.type === 'success' ? '#2e7d32' : '#37474f',
              color: '#fff', padding: '10px 14px', borderRadius: 10, boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
              fontSize: 14, fontWeight: 500,
            }}>
            {m.text}
          </div>
        ))}
      </div>
    </div>
  )
}
