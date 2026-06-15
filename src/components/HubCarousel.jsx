import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const INTERVAL = 5000

const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function HubCarousel() {
  const [slides,  setSlides]  = useState([])
  const [current, setCurrent] = useState(0)
  const [paused,  setPaused]  = useState(false)
  const touchStartX = useRef(null)

  useEffect(() => {
    async function loadSlides() {
      const [carouselRes, weighinsRes, bigfishRes] = await Promise.all([
        supabase.from('snz_carousel').select('id, photo_url').eq('is_active', true),
        supabase.from('comp_weighins').select('id, catch_photo_url').not('catch_photo_url', 'is', null),
        supabase.from('bigfish_entries').select('id, photo_glory_url').not('photo_glory_url', 'is', null),
      ])

      // Uploaded carousel pics are the curated content; weigh-in + big fish
      // photos are member catches that can vastly outnumber them.
      const carousel = (carouselRes.data || [])
        .map(r => ({ id: r.id, photo_url: r.photo_url }))
        .filter(s => s.photo_url)
      const catches = [
        ...(weighinsRes.data || []).map(r => ({ id: `w-${r.id}`, photo_url: r.catch_photo_url })),
        ...(bigfishRes.data || []).map(r => ({ id: `b-${r.id}`, photo_url: r.photo_glory_url })),
      ].filter(s => s.photo_url)

      // Keep uploaded carousel pics at ~75% of the rotation: cap catches at a
      // quarter of the total (carousel / 3). Each load picks a fresh subset.
      let all
      if (!carousel.length) {
        all = shuffle(catches)
      } else {
        const catchQuota = Math.round(carousel.length / 3)
        all = shuffle([...carousel, ...shuffle(catches).slice(0, catchQuota)])
      }

      if (!all.length) return
      setSlides(all)
      all.forEach(s => { const img = new Image(); img.src = s.photo_url })
    }

    loadSlides()
  }, [])

  const next = useCallback(() => setCurrent(c => (c + 1) % slides.length), [slides.length])
  const prev = useCallback(() => setCurrent(c => (c - 1 + slides.length) % slides.length), [slides.length])

  useEffect(() => {
    if (slides.length < 2 || paused) return
    const t = setInterval(next, INTERVAL)
    return () => clearInterval(t)
  }, [slides.length, paused, next])

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX }
  const onTouchEnd   = (e) => {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) dx < 0 ? next() : prev()
    touchStartX.current = null
  }

  if (!slides.length) return null

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ height: 'clamp(220px, 42vw, 480px)', background: '#111' }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((s, i) => (
        <div
          key={s.id}
          className="absolute inset-0 transition-opacity duration-700 flex items-center justify-center"
          style={{ opacity: i === current ? 1 : 0, zIndex: i === current ? 1 : 0 }}
        >
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${s.photo_url})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(18px) brightness(0.45)',
              transform: 'scale(1.08)',
            }}
          />
          <img
            src={s.photo_url}
            alt=""
            className="relative z-10 max-w-full max-h-full"
            style={{ objectFit: 'contain', height: '100%', width: '100%' }}
            loading="eager"
          />
        </div>
      ))}

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 right-5 z-20 flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all duration-300 focus:outline-none"
              style={{
                width:  i === current ? 20 : 8,
                height: 8,
                background: i === current ? '#fff' : 'rgba(255,255,255,0.45)',
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Prev / Next arrows */}
      {slides.length > 1 && (
        <>
          <button onClick={prev} aria-label="Previous"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button onClick={next} aria-label="Next"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      )}
    </div>
  )
}
