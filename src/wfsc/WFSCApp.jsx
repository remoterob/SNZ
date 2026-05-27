import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { Flag } from './components/Flag'
import { usePairs, useWeighins, useProtests, buildLeaderboard, specialAwards } from './lib/hooks'
import { ADMIN_PASSWORD, DIVISIONS, DIVISION_COLORS, COUNTRIES, countryByName, calcRawScore } from './lib/constants'
import { WETTIE_LOGO, DESOLVE_LOGO, SNZ_LOGO } from './lib/logos'

// User tracking utilities
const getUserId = () => {
  let userId = localStorage.getItem('wfsc_user_id')
  if (!userId) {
    userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem('wfsc_user_id', userId)
  }
  return userId
}

const getSessionId = () => {
  let sessionId = sessionStorage.getItem('wfsc_session_id')
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    sessionStorage.setItem('wfsc_session_id', sessionId)
  }
  return sessionId
}

const trackPageView = async (page) => {
  try {
    await supabase.from('user_analytics').insert({
      user_id: getUserId(),
      session_id: getSessionId(),
      page_view: page,
      user_agent: navigator.userAgent,
      referrer: document.referrer || 'direct'
    })
  } catch (err) {
    console.error('Tracking error:', err)
  }
}


const css = `
  @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
  @keyframes shake   { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
  @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .fade-in { animation: fadeIn 0.3s ease both; }
  .shake   { animation: shake 0.35s ease; }
  * { box-sizing: border-box; }
  @media (min-width: 601px) {
    .lb-card { display: none !important; }
    .wi-card { display: none !important; }
    .mobile-only { display: none !important; }
  }
  @media (max-width: 600px) {
    .hide-mobile { display: none !important; }
    .desktop-only { display: none !important; }
    .mobile-card { padding: 10px !important; }
    body { -webkit-text-size-adjust: 100%; }
    input, select, textarea { font-size: 16px !important; }
    button { min-height: 44px; }
    .lb-card { display:flex !important; align-items:center; gap:10px; padding:10px 12px; border-bottom:1px solid #0d2040; }
    .lb-rank { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:900; min-width:38px; text-align:center; }
    .lb-info { flex:1; min-width:0; }
    .lb-name { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; line-height:1.2; }
    .lb-meta { font-family:'Barlow Condensed',sans-serif; font-size:12px; color:#4a7a9b; margin-top:2px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
    .lb-score { font-family:'Barlow Condensed',sans-serif; font-size:26px; font-weight:900; text-align:right; white-space:nowrap; }
    .lb-pct { font-family:'Barlow Condensed',sans-serif; font-size:11px; color:#4a7a9b; text-align:right; line-height:1.3; }
    .wi-card { display:flex !important; align-items:center; gap:8px; padding:10px 12px; border-bottom:1px solid #0d2040; }
    .wi-info { flex:1; min-width:0; }
    .wi-name { font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:700; line-height:1.2; }
    .wi-stats { display:flex; gap:6px; align-items:center; margin-top:4px; font-size:12px; color:#4a7a9b; flex-wrap:wrap; }
    .wi-pts { font-family:'Barlow Condensed',sans-serif; font-size:22px; font-weight:900; text-align:right; min-width:60px; }
  }
    .wi-stats { font-family:'Barlow Condensed',sans-serif; font-size:13px; color:#4a7a9b; margin-top:2px; }
    .wi-pts { font-family:'Barlow Condensed',sans-serif; font-size:20px; font-weight:900; color:#f59e0b; white-space:nowrap; }
  }
  ::-webkit-scrollbar { width:6px; height:6px; }
  ::-webkit-scrollbar-track { background:#060d1a; }
  ::-webkit-scrollbar-thumb { background:#0d2a3d; border-radius:3px; }
  input[type=text],input[type=number],input[type=password],select,textarea {
    background:#071526; border:1px solid #0d2a3d; color:#fff;
    padding:10px 14px; border-radius:8px; font-family:'Barlow',sans-serif;
    font-size:15px; width:100%; outline:none; transition:border-color 0.2s;
  }
  input:focus,select:focus,textarea:focus { border-color:#00d4ff; }
  input[type=checkbox] { width:auto!important; cursor:pointer; }
  select option { background:#071526; }
  button { cursor:pointer; font-family:'Barlow Condensed',sans-serif; }
  .carr { display:flex; gap:12px; overflow-x:auto; padding-bottom:8px; scroll-snap-type:x mandatory; }
  .carr::-webkit-scrollbar { height:4px; }
  .carr img { scroll-snap-align:start; border-radius:10px; object-fit:cover; flex-shrink:0; }
`

// ── Ocean Deep palette ────────────────────────────────────────────────────────
const C = {
  bg:      '#060d1a',   // page background
  bgCard:  '#080f1e',   // card background
  bgDeep:  '#040a12',   // deepest background
  bgInput: '#071526',   // input background
  border:  '#0d2040',   // border
  border2: '#0a1a30',   // subtle border
  accent:  '#00d4ff',   // electric cyan — primary accent
  accentD: '#0099bb',   // darker cyan for hover states
  accentBg:'#00d4ff18', // cyan tint background
  gold:    '#ffd700',   // gold for 1st place
  silver:  '#94a3b8',   // silver for 2nd
  bronze:  '#b45309',   // bronze for 3rd
  muted:   '#2d5a7a',   // muted text
  muted2:  '#1a3a52',   // very muted text
  text:    '#e2f0ff',   // primary text (slightly blue-white)
  textSub: '#4a7a9b',   // secondary text
}

const S = {
  app:   { minHeight:'100vh', background:C.bg, color:C.text, fontFamily:"'Barlow',sans-serif" },
  hdr:   { background:`linear-gradient(180deg,#0a1628 0%,${C.bg} 100%)`, borderBottom:`1px solid ${C.border}`, padding:'0 24px' },
  hi:    { maxWidth:1280, margin:'0 auto', display:'flex', alignItems:'center', gap:16, padding:'14px 0' },
  logo:  { fontFamily:"'Barlow Condensed'", fontSize:28, fontWeight:900, letterSpacing:2 },
  nav:   { display:'flex', gap:4, overflowX:'auto', background:C.bgDeep, borderBottom:`1px solid ${C.border}`, padding:'0 24px' },
  nb:    a => ({ padding:'12px 20px', border:'none', background:'none', color:a?'#fff':C.textSub, fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:700, letterSpacing:1, borderBottom:a?`3px solid ${C.accent}`:'3px solid transparent', cursor:'pointer', whiteSpace:'nowrap', transition:'all 0.15s' }),
  main:  { maxWidth:1280, margin:'0 auto', padding:'clamp(12px, 3vw, 24px)' },
  card:  { background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, padding:24, marginBottom:16 },
  h2:    { fontFamily:"'Barlow Condensed'", fontSize:32, fontWeight:900, letterSpacing:2, marginBottom:16 },
  h3:    { fontFamily:"'Barlow Condensed'", fontSize:20, fontWeight:700, marginBottom:12 },
  tbl:   { width:'100%', borderCollapse:'collapse' },
  th:    { padding:'10px 14px', textAlign:'left', color:C.muted, fontFamily:"'Barlow Condensed'", fontSize:13, letterSpacing:1, fontWeight:600, borderBottom:`1px solid ${C.border}` },
  td:    { padding:'11px 14px', borderBottom:`1px solid ${C.bgDeep}` },
  btn:   (c=C.accent) => ({ background:c, border:'none', color: c===C.accent?C.bgDeep:'#fff', padding:'10px 20px', borderRadius:8, fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:700, letterSpacing:1, cursor:'pointer' }),
  bsm:   (c=C.border) => ({ background:c, border:'none', color: c===C.accent?C.bgDeep:'#fff', padding:'6px 14px', borderRadius:6, fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700, cursor:'pointer' }),
  badge: c => ({ display:'inline-block', padding:'3px 10px', borderRadius:20, fontSize:13, fontWeight:700, background:c+'22', color:c, border:`1px solid ${c}44`, fontFamily:"'Barlow Condensed'" }),
  lbl:   { display:'block', color:C.muted, fontSize:12, marginBottom:5, fontWeight:600, letterSpacing:0.8, textTransform:'uppercase' },
  g2:    { display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(280px, 1fr))', gap:16 },
  live:  { display:'inline-flex', alignItems:'center', gap:6, fontSize:12, color:C.accent, fontWeight:700 },
  dot:   { width:8, height:8, borderRadius:'50%', background:C.accent, animation:'pulse 2s infinite' },
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  mbox:  (w=500) => ({ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:16, padding:'20px 18px', width:'100%', maxWidth:w, maxHeight:'92vh', overflowY:'auto' }),
  // Diver name pair — both identical, displayed on separate lines same colour/weight
  d1:    { fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, color:C.text },
  d2:    { fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, color:C.text },
}

// Field + Modal - defined at module level (never inside another component)
function Field({ label, children }) {
  return <div><label style={S.lbl}>{label}</label>{children}</div>
}

function Modal({ onClose, title, children, width=500 }) {
  return (
    <div style={S.overlay} onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{ ...S.mbox(width), maxWidth:'95vw' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900 }}>{title}</div>
          <button style={{ ...S.bsm(C.border), fontSize:18, padding:'4px 10px' }} onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// Lightbox for photo viewing
function Lightbox({ photos, startIndex=0, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const [imgError, setImgError] = useState(false)
  const photo = photos[idx]
  if (!photo) return null
  
  const prev = () => {setIdx(i => (i - 1 + photos.length) % photos.length); setImgError(false)}
  const next = () => {setIdx(i => (i + 1) % photos.length); setImgError(false)}
  
  const url = photoUrl(photo.storage_path)
  
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }} onClick={onClose}>
      <button style={{ position:'absolute', top:16, right:16, ...S.bsm(C.border), fontSize:20, padding:'6px 14px', zIndex:2001 }} onClick={onClose}>✕</button>
      {photos.length > 1 && (
        <>
          <button style={{ position:'absolute', left:16, top:'50%', transform:'translateY(-50%)', ...S.bsm(C.border), fontSize:28, padding:'6px 16px', zIndex:2001 }} onClick={e=>{e.stopPropagation();prev()}}>‹</button>
          <button style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', ...S.bsm(C.border), fontSize:28, padding:'6px 16px', zIndex:2001 }} onClick={e=>{e.stopPropagation();next()}}>›</button>
        </>
      )}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, padding:16, maxWidth:'90vw', maxHeight:'80vh', overflow:'hidden' }} onClick={e=>e.stopPropagation()}>
        {imgError ? (
          <div style={{ color:'#ef4444', padding:32, background:C.bgCard, borderRadius:12, maxWidth:400, textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:8 }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>Photo Failed to Load</div>
            <div style={{ fontSize:12, color:C.muted, fontFamily:'monospace', wordBreak:'break-all', background:C.bgDeep, padding:8, borderRadius:6, marginTop:8 }}>
              {photo.storage_path}
            </div>
          </div>
        ) : (
          <>
            <img 
              src={url} 
              alt={photo.caption||'Catch'} 
              style={{ display:'block', width:'auto', height:'auto', maxWidth:'70vw', maxHeight:'300px', objectFit:'contain', borderRadius:8 }}
              onError={()=>setImgError(true)}
            />
            {photo.caption && <div style={{ color:C.text, fontSize:13 }}>{photo.caption}</div>}
            <div style={{ color:C.textSub, fontSize:12 }}>Photo {idx+1} of {photos.length}</div>
          </>
        )}
      </div>
    </div>
  )
}

function DivBadge({ div }) {
  return <span style={S.badge(DIVISION_COLORS[div]||C.textSub)}>{div}</span>
}

// Team photo thumbnail with lightbox on click
function TeamPhotoThumb({ url, name, size=48 }) {
  if (!url) return null
  return (
    <img
      src={url}
      alt={name||'Team'}
      onClick={() => window.open(url, '_blank')}
      style={{ width:size, height:size, objectFit:'cover', borderRadius:6, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.5)', flexShrink:0, display:'inline-block', verticalAlign:'middle' }}
      onError={e=>{e.target.style.display='none'}}
    />
  )
}

function Country({ name, size=24, showName=false, country2=null }) {
  const c = countryByName(name)
  
  // For Hawaii: show Hawaiian flag but display "USA" as the text
  const displayCountry = c.parentCountry ? countryByName(c.parentCountry) : c
  const label = showName ? displayCountry.name : displayCountry.short
  
  // Handle mixed nationality pairs
  if (country2 && country2 !== name) {
    const c2 = countryByName(country2)
    const displayCountry2 = c2.parentCountry ? countryByName(c2.parentCountry) : c2
    const label2 = showName ? displayCountry2.name : displayCountry2.short
    
    return (
      <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
        <Flag name={name} size={size}/>
        <Flag name={country2} size={size}/>
        <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, letterSpacing:1 }}>
          {label}/{label2}
        </span>
      </span>
    )
  }
  
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
      <Flag name={name} size={size}/>
      <span style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, letterSpacing:1 }}>{label}</span>
    </span>
  )
}

// Photo hooks
function usePhotos() {
  const [photos, setPhotos] = useState([])
  const fetch = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('catch_photos').select('*').order('uploaded_at',{ascending:false})
      if (!error && data) setPhotos(data)
    } catch(e) { /* table may not exist yet */ }
  }, [])
  useEffect(() => {
    fetch()
    let ch
    try {
      ch = supabase.channel('photos-ch')
        .on('postgres_changes',{event:'*',schema:'public',table:'catch_photos'},fetch)
        .subscribe()
    } catch(e) { /* ignore channel errors */ }
    return () => {try{ch?.unsubscribe()}catch(e){}}
  }, [fetch])
  return { photos, refetch:fetch }
}

function useSettings() {
  const [settings, setSettings] = useState({})
  const fetch = useCallback(async () => {
    try {
      const { data } = await supabase.from('competition_settings').select('*')
      if (data) {
        const obj = {}
        data.forEach(row => obj[row.key] = row.value)
        setSettings(obj)
      }
    } catch(e) { /* table may not exist yet */ }
  }, [])
  useEffect(() => {
    fetch()
    let ch
    try {
      ch = supabase.channel('settings-ch')
        .on('postgres_changes',{event:'*',schema:'public',table:'competition_settings'},fetch)
        .subscribe()
    } catch(e) {}
    return () => { try { if(ch) supabase.removeChannel(ch) } catch(e){} }
  }, [fetch])
  return { settings, refetch:fetch }
}

function photoUrl(path) {
  const { data } = supabase.storage.from('catch-photos').getPublicUrl(path)
  return data?.publicUrl || ''
}

// Carousel
function CatchCarousel({ photos, pairs }) {
  const ref = useRef(null)
  if (!photos.length) return null
  const scroll = d => ref.current?.scrollBy({ left:d*200, behavior:'smooth' })
  return (
    <div style={{ ...S.card, marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:20, fontWeight:900 }}>
          📸 CATCH PHOTOS <span style={{ color:C.textSub, fontSize:15, fontWeight:400 }}>({photos.length})</span>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={S.bsm()} onClick={() => scroll(-1)}>‹</button>
          <button style={S.bsm()} onClick={() => scroll(1)}>›</button>
        </div>
      </div>
      <div className="carr" ref={ref}>
        {photos.map(ph => {
          const pair = pairs.find(p => p.id===ph.pair_id)
          return (
            <div key={ph.id} style={{ flexShrink:0, width:'min(220px, calc(50vw - 40px))' }}>
              <img src={photoUrl(ph.storage_path)} alt={ph.caption||'Catch'} style={{ width:'100%', height:'auto', aspectRatio:'4/3', objectFit:'cover', borderRadius:8 }} onError={e=>{e.target.style.display='none'}}/>
              <div style={{ marginTop:6 }}>
                <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13 }}>{pair?`${pair.diver1} + ${pair.diver2}`:''}</div>
                {pair && <Country name={pair.country} country2={pair.country2} size={16}/>}
                {ph.caption && <div style={{ color:C.textSub, fontSize:11, marginTop:2 }}>{ph.caption}</div>}
                <div style={{ color:C.muted2, fontSize:11 }}>Day {ph.day}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Photo uploader
function PhotoUploader({ pairId, weighinId, day, onUploaded, hideCaption = false }) {
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState('')
  const fileRef = useRef(null)

  const compressImage = async (file) => {
    // Only compress if > 1MB
    if (file.size < 1024 * 1024) return file
    
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          let width = img.width
          let height = img.height
          
          // Scale down if too large (max 1920px width)
          const maxWidth = 1920
          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          canvas.toBlob((blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }))
          }, 'image/jpeg', 0.85)
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  const upload = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    
    try {
      // Compress image before upload
      const compressedFile = await compressImage(file)
      const ext = 'jpg' // Always use jpg after compression
      const path = `day${day}/pair${pairId}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('catch-photos').upload(path, compressedFile, { upsert:true })
      
      if (!error) {
        await supabase.from('catch_photos').insert({ weighin_id:weighinId||null, pair_id:pairId, day, storage_path:path, caption: hideCaption ? '' : caption })
        onUploaded?.()
        setCaption('')
        if (fileRef.current) fileRef.current.value=''
      } else { 
        alert('Upload failed: '+error.message) 
      }
    } catch (err) {
      alert('Upload error: ' + err.message)
    }
    
    setUploading(false)
  }

  return (
    <div style={{ background:C.bgDeep, borderRadius:6, padding:10, marginTop:8 }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:13, fontWeight:700, marginBottom:8 }}>📸 ADD CATCH PHOTO</div>
      {!hideCaption && (
        <Field label="Caption (optional)">
          <input type="text" value={caption} onChange={e=>setCaption(e.target.value)} placeholder="e.g. Two big cats at 8m"/>
        </Field>
      )}
      <div style={{ marginTop: hideCaption ? 0 : 8 }}>
        <label style={S.lbl}>Photo file</label>
        <input ref={fileRef} type="file" accept="image/*" onChange={upload} disabled={uploading}
          style={{ background:C.bgCard, border:`1px solid ${C.border}`, color:C.muted, padding:'6px 10px', borderRadius:6, fontSize:13, width:'100%' }}/>
      </div>
      {uploading && <div style={{ color:C.accent, fontSize:12, fontFamily:"'Barlow Condensed'", marginTop:6 }}>UPLOADING...</div>}
    </div>
  )
}

// Sponsor bar
function SponsorBar() {
  return (
    <div style={{ background:C.bgDeep, borderTop:'1px solid #1e2d4a', padding:'16px 12px', display:'flex', alignItems:'center', justifyContent:'center', gap:16, flexWrap:'wrap' }}>
      <span className="hide-mobile" style={{ color:C.textSub, fontSize:10, fontWeight:700, letterSpacing:3 }}>PROUD SPONSORS</span>
      <img src={WETTIE_LOGO} alt="Wettie" style={{ height:48, maxWidth:'30vw', objectFit:'contain' }}/>
      <img src={DESOLVE_LOGO} alt="Desolve" style={{ height:42, maxWidth:'30vw', objectFit:'contain' }}/>
      <img src={SNZ_LOGO} alt="Spearfishing NZ" style={{ height:64, maxWidth:'30vw', objectFit:'contain', opacity:0.9 }}/>
    </div>
  )
}

// Login
function LoginScreen({ onLogin }) {
  const [pw, setPw] = useState('')
  const [shake, setShake] = useState(false)
  const [err, setErr] = useState('')
  const attempt = () => {
    if (pw===ADMIN_PASSWORD) { onLogin() }
    else { setShake(true); setErr('Incorrect password'); setTimeout(()=>setShake(false),400) }
  }
  return (
    <div style={{ minHeight:'100vh', background:C.bg, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:24 }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:52, fontWeight:900, letterSpacing:4 }}>WFSC <span style={{color:C.accent}}>2026</span></div>
      <div style={{ color:C.textSub, letterSpacing:2, fontSize:13 }}>ADMIN ACCESS</div>
      <div className={shake?'shake':''} style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:16, padding:40, width:360 }}>
        <label style={S.lbl}>Admin Password</label>
        <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setErr('')}} onKeyDown={e=>e.key==='Enter'&&attempt()} placeholder="Enter password" autoFocus/>
        {err && <div style={{ color:'#ef4444', fontSize:13, marginTop:8 }}>{err}</div>}
        <button style={{ ...S.btn(), width:'100%', marginTop:16, padding:13, fontSize:18 }} onClick={attempt}>UNLOCK ADMIN</button>
      </div>
    </div>
  )
}

// Auto-scrolling team photo carousel
function TeamCarousel({ pairs }) {
  const withPhotos = pairs.filter(p => p.team_photo_url)
  if (!withPhotos.length) return null

  // Duplicate for seamless loop
  const items = [...withPhotos, ...withPhotos]
  const duration = withPhotos.length * 6 // ~6s per photo

  return (
    <div style={{ ...S.card, marginBottom:24, overflow:'hidden' }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:20, fontWeight:900, marginBottom:14 }}>
        🏊 TEAM PHOTOS <span style={{ color:C.textSub, fontSize:15, fontWeight:400 }}>({withPhotos.length})</span>
      </div>
      <style>{`
        @keyframes teamScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .team-scroll-inner {
          display: flex;
          gap: 16px;
          animation: teamScroll ${duration}s linear infinite;
          width: max-content;
        }
        .team-scroll-inner:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div style={{ overflow:'hidden' }}>
        <div className="team-scroll-inner">
          {items.map((p, i) => {
            const url = supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl
            return (
              <div key={`${p.id}-${i}`} style={{ flexShrink:0, width:180, cursor:'pointer' }} onClick={() => window.open(url, '_blank')}>
                <img
                  src={url}
                  alt={`${p.diver1} & ${p.diver2}`}
                  style={{ width:180, height:135, objectFit:'cover', borderRadius:8, display:'block', boxShadow:'0 2px 10px rgba(0,0,0,0.5)' }}
                  onError={e=>{e.target.closest('div').style.display='none'}}
                />
                <div style={{ marginTop:6 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {p.diver1}
                  </div>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                    {p.diver2}
                  </div>
                  <Country name={p.country} country2={p.country2} size={14}/>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TeamPhotoCarousel({ pairs }) {
  const trackRef = useRef(null)
  const animRef = useRef(null)
  const posRef = useRef(0)

  const pairsWithPhotos = useMemo(() =>
    pairs.filter(p => p.team_photo_url).map(p => ({
      ...p,
      tpUrl: supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl
    })), [pairs])

  const items = useMemo(() => [...pairsWithPhotos, ...pairsWithPhotos], [pairsWithPhotos])

  useEffect(() => {
    if (!trackRef.current || pairsWithPhotos.length === 0) return
    const speed = 0.4
    const animate = () => {
      posRef.current += speed
      const halfWidth = trackRef.current.scrollWidth / 2
      if (posRef.current >= halfWidth) posRef.current = 0
      trackRef.current.style.transform = `translateX(-${posRef.current}px)`
      animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [pairsWithPhotos])

  if (pairsWithPhotos.length === 0) return null

  return (
    <div style={{ ...S.card, marginBottom:24, overflow:'hidden' }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:20, fontWeight:900, marginBottom:14 }}>
        🤿 TEAM PHOTOS <span style={{ color:C.textSub, fontSize:15, fontWeight:400 }}>({pairsWithPhotos.length})</span>
      </div>
      <div style={{ overflow:'hidden' }}>
        <div ref={trackRef} style={{ display:'flex', gap:16, width:'max-content', willChange:'transform' }}>
          {items.map((p, i) => (
            <div key={`${p.id}-${i}`} style={{ flexShrink:0, width:160, cursor:'pointer' }} onClick={() => window.open(p.tpUrl, '_blank')}>
              <img
                src={p.tpUrl}
                alt={`${p.diver1} & ${p.diver2}`}
                style={{ width:160, height:120, objectFit:'cover', borderRadius:8, display:'block' }}
                onError={e=>{e.target.parentElement.style.display='none'}}
              />
              <div style={{ marginTop:6 }}>
                <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, lineHeight:1.2 }}>{p.diver1}</div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13, lineHeight:1.2 }}>{p.diver2}</div>
                <div style={{ marginTop:3 }}><Country name={p.country} country2={p.country2} size={14}/></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Dashboard
function Dashboard({ pairs, weighins, photos }) {
  // Memoize expensive calculations
  const confirmed = useMemo(() => pairs.filter(p=>p.confirmed), [pairs])
  const checkedIn = useMemo(() => pairs.filter(p=>p.checked_in_d1||p.checked_in_d2), [pairs])
  const totalFish = useMemo(() => weighins.reduce((a,w)=>a+(w.fish_count||0),0), [weighins])
  const totalKg = useMemo(() => weighins.reduce((a,w)=>a+parseFloat(w.total_kg||0),0), [weighins])

  const Stat = ({ label, value, sub, color=C.accent }) => (
    <div style={{ background:C.bgDeep, border:`1px solid ${color}33`, borderRadius:12, padding:24, textAlign:'center' }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:52, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      <div style={{ color:C.muted, fontSize:13, marginTop:4, fontWeight:600 }}>{label}</div>
      {sub && <div style={{ color:C.textSub, fontSize:12, marginTop:3 }}>{sub}</div>}
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div style={S.h2}>EVENT DASHBOARD</div>
        <div style={S.live}><div style={S.dot}/>LIVE</div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:24 }}>
        <Stat label="CONFIRMED PAIRS" value={confirmed.length} sub={`${pairs.filter(p=>!p.confirmed).length} pending`} color="#3b82f6"/>
        <Stat label="CHECKED IN"      value={checkedIn.length} sub="total pairs" color="#22c55e"/>
        <Stat label="FISH SPEARED"    value={totalFish} sub={`${totalKg.toFixed(1)} kg total`} color="#f59e0b"/>
        <Stat label="CATCH PHOTOS"    value={photos.length} sub="uploaded" color="#ec4899"/>
      </div>
      <TeamPhotoCarousel pairs={pairs}/>
      <div style={S.g2}>
        <div style={S.card}>
          <div style={S.h3}>BY DIVISION</div>
          {DIVISIONS.map(d => (
            <div key={d} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
              <DivBadge div={d}/>
              <span style={{ color:C.textSub, fontSize:14 }}>{pairs.filter(p=>p.division===d).length} pairs · <span style={{color:C.accent}}>{pairs.filter(p=>p.division===d&&p.confirmed).length} confirmed</span></span>
            </div>
          ))}
        </div>
        <div style={S.card}>
          <div style={S.h3}>BY NATION</div>
          {COUNTRIES
            .filter(c => !c.parentCountry)
            .map(c => {
              const children = COUNTRIES.filter(ch => ch.parentCountry === c.name).map(ch => ch.name)
              const all = [c.name, ...children]
              const count = pairs.filter(p => all.includes(p.country) || all.includes(p.country2)).length
              return count > 0 ? (
                <div key={c.name} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                  <Country name={c.name} showName/>
                  <span style={{ color:C.textSub, fontSize:14 }}>{count} pairs</span>
                </div>
              ) : null
            })}
        </div>
      </div>
    </div>
  )
}

// Leaderboard
function LeaderboardView({ pairs, weighins, photos, setLightbox }) {
  const [div, setDiv] = useState('All')
  
  // Memoize expensive calculations
  const lb = useMemo(() => buildLeaderboard(pairs, weighins), [pairs, weighins])
  const filtered = useMemo(() => {
    return div === 'All' ? lb : lb.filter(p => p.division === div)
  }, [lb, div, pairs])
  const sorted = useMemo(() => [...filtered].sort((a,b)=>b.total-a.total), [filtered])
  
  const medals = ['🥇','🥈','🥉']

  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={S.h2}>LEADERBOARD</div>
        <div style={S.live}><div style={S.dot}/>LIVE</div>
      </div>
      <CatchCarousel photos={photos} pairs={pairs}/>
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        {['All',...DIVISIONS].map(t=>(
          <button key={t} style={{ ...S.bsm(t===div?DIVISION_COLORS[t]||C.accent:C.border), padding:'8px 18px', fontSize:15 }} onClick={()=>setDiv(t)}>
            {t==='All'?'ALL':t.toUpperCase()}
          </button>
        ))}
      </div>
      {sorted.length===0
        ? <div style={{ ...S.card, textAlign:'center', color:C.textSub, padding:48 }}>No scores yet — check back once weigh-in begins.</div>
        : <>
            {/* Desktop table */}
            <div className="hide-mobile" style={S.card}>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={S.th}>#</th>
                  <th style={S.th}>PAIR</th>
                  <th style={S.th}>DIV</th>
                  <th style={S.th}>NATION</th>
                  <th style={{ ...S.th, textAlign:'right' }}>DAY 1</th>
                  <th style={{ ...S.th, textAlign:'right' }}>DAY 2</th>
                  <th style={{ ...S.th, textAlign:'right' }}>TOTAL</th>
                  <th style={{ ...S.th, textAlign:'center' }}>📸</th>
                </tr></thead>
                <tbody>
                  {sorted.map((p,i)=>{
                    const pairPhotos = photos.filter(ph=>ph.pair_id===p.id)
                    const pair = pairs.find(pr=>pr.id===p.id)
                    const tpUrl = pair?.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(pair.team_photo_url).data.publicUrl : null
                    return (
                      <tr key={p.id} style={{ background:i<3?'#071a2e':'transparent' }}>
                        <td style={{ ...S.td, fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, color:i<3?DIVISION_COLORS[p.division]:C.textSub, width:48 }}>
                          {p.total > 0 ? (medals[i] || i+1) : (i+1)}
                        </td>
                        <td style={S.td}>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <div>
                              <div style={S.d1}>{p.diver1}</div>
                              <div style={S.d1}>{p.diver2}</div>
                            </div>
                            {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={48}/>}
                          </div>
                        </td>
                        <td style={S.td}><DivBadge div={p.division}/></td>
                        <td style={S.td}><Country name={p.country} country2={p.country2}/></td>
                        <td style={{ ...S.td, textAlign:'right' }}>
                          {p.d1Data ? (
                            <div>
                              <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:700 }}>{p.d1pct.toFixed(1)}%</div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{p.d1Data.fish_count}🐟 {parseFloat(p.d1Data.total_kg).toFixed(1)}kg</div>
                            </div>
                          ) : <span style={{color:C.border}}>—</span>}
                        </td>
                        <td style={{ ...S.td, textAlign:'right' }}>
                          {p.d2Data ? (
                            <div>
                              <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:700 }}>{p.d2pct.toFixed(1)}%</div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>{p.d2Data.fish_count}🐟 {parseFloat(p.d2Data.total_kg).toFixed(1)}kg</div>
                            </div>
                          ) : <span style={{color:C.border}}>—</span>}
                        </td>
                        <td style={{ ...S.td, textAlign:'right' }}>
                          {p.total > 0 ? (
                            <div>
                              <div style={{ fontFamily:"'Barlow Condensed'", fontSize:26, fontWeight:900, color:i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':'#fff' }}>{p.total.toFixed(1)}</div>
                              <div style={{ fontSize:13, fontWeight:600, color:'#fff' }}>
                                {((p.d1Data?.fish_count || 0) + (p.d2Data?.fish_count || 0))}🐟 {((parseFloat(p.d1Data?.total_kg || 0)) + (parseFloat(p.d2Data?.total_kg || 0))).toFixed(1)}kg
                              </div>
                            </div>
                          ) : <span style={{color:C.border}}>—</span>}
                        </td>
                        <td style={{ ...S.td, textAlign:'center' }}>
                          {pairPhotos.length > 0 && (
                            <button style={{ ...S.bsm('#ec4899'), fontSize:12, padding:'4px 10px' }} onClick={()=>setLightbox(pairPhotos)}>
                              📸 {pairPhotos.length}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
              {sorted.map((p,i)=>{
                const rankColor = i===0?'#f59e0b':i===1?'#94a3b8':i===2?'#b45309':C.textSub
                const pairPhotos = photos.filter(ph=>ph.pair_id===p.id)
                const pair = pairs.find(pr=>pr.id===p.id)
                const tpUrl = pair?.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(pair.team_photo_url).data.publicUrl : null
                return (
                  <div key={p.id} className="lb-card" style={{ background:i<3?'#071a2e':'transparent' }}>
                    <div className="lb-rank" style={{ color:rankColor }}>
                      {p.total > 0 ? (medals[i] || i+1) : (i+1)}
                    </div>
                    <div className="lb-info">
                      <div className="lb-name">{p.diver1}</div>
                      <div className="lb-name">{p.diver2}</div>
                      <div className="lb-meta">
                        <DivBadge div={p.division}/>
                        <Country name={p.country} country2={p.country2} size={16}/>
                        {pairPhotos.length > 0 && (
                          <button style={{ ...S.bsm('#ec4899'), fontSize:10, padding:'2px 6px' }} onClick={()=>setLightbox(pairPhotos)}>
                            📸 {pairPhotos.length}
                          </button>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>
                        {p.d1Data && <span style={{ color:'#fff', fontWeight:600 }}>D1: {p.d1Data.fish_count}🐟 {parseFloat(p.d1Data.total_kg).toFixed(1)}kg</span>}
                        {p.d1Data && p.d2Data && <span> · </span>}
                        {p.d2Data && <span style={{ color:'#fff', fontWeight:600 }}>D2: {p.d2Data.fish_count}🐟 {parseFloat(p.d2Data.total_kg).toFixed(1)}kg</span>}
                        {(p.d1Data || p.d2Data) && (
                          <span style={{ marginLeft:8, color:'#fff', fontWeight:600 }}>
                            TOTAL: {((p.d1Data?.fish_count || 0) + (p.d2Data?.fish_count || 0))}🐟 {((parseFloat(p.d1Data?.total_kg || 0)) + (parseFloat(p.d2Data?.total_kg || 0))).toFixed(1)}kg
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
                      {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={44}/>}
                      <div className="lb-score" style={{ color:rankColor }}>{p.total>0?p.total.toFixed(1):'—'}</div>
                      <div className="lb-pct">{p.d1pct!==null?p.d1pct.toFixed(0)+'%':'—'} · {p.d2pct!==null?p.d2pct.toFixed(0)+'%':'—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
      }
    </div>
  )
}

// Check-In
function CheckInView({ pairs, refetchPairs }) {
  const [day, setDay] = useState(1)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(null)
  const key = day===1?'checked_in_d1':'checked_in_d2'
  const filtered = pairs.filter(p=>p.confirmed).filter(p=>!search||`${p.diver1} ${p.diver2}`.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>a.division.localeCompare(b.division)||a.diver1.localeCompare(b.diver1))
  const toggle = async pair => { setSaving(pair.id); await supabase.from('pairs').update({[key]:!pair[key]}).eq('id',pair.id); await refetchPairs(); setSaving(null) }
  const checked = pairs.filter(p=>p.confirmed&&p[key]).length
  const total   = pairs.filter(p=>p.confirmed).length
  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:20, flexWrap:'wrap' }}>
        <div style={S.h2}>CHECK-IN</div>
        <div style={{ marginLeft:'auto', fontFamily:"'Barlow Condensed'", fontSize:32, fontWeight:900, color:C.accent }}>{checked}/{total}</div>
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[1,2].map(d=><button key={d} style={S.bsm(d===day?C.accent:C.border)} onClick={()=>setDay(d)}>DAY {d} — {d===1?'FRI 13 MAR':'SAT 14 MAR'}</button>)}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search diver..." 
          style={{ flex:'1 1 200px', minWidth:0, padding:'6px 12px', background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:6, color:C.text, fontSize:14 }}/>
      </div>
      
      {/* Desktop table */}
      <div className="hide-mobile" style={S.card}>
        <table style={S.tbl}>
          <thead><tr>
            <th style={S.th}>PAIR</th><th style={S.th}>DIV</th><th style={S.th}>NATION</th>
            <th style={{ ...S.th, textAlign:'center' }}>STATUS</th><th style={{ ...S.th, textAlign:'center' }}>ACTION</th>
          </tr></thead>
          <tbody>
            {filtered.map(p=>{
              const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
              return (
              <tr key={p.id}>
                <td style={S.td}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div>
                      <div style={S.d1}>{p.diver1}</div>
                      <div style={S.d1}>{p.diver2}</div>
                    </div>
                    {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={48}/>}
                  </div>
                </td>
                <td style={S.td}><DivBadge div={p.division}/></td>
                <td style={S.td}><Country name={p.country} country2={p.country2}/></td>
                <td style={{ ...S.td, textAlign:'center' }}><span style={S.badge(p[key]?'#22c55e':'#334155')}>{p[key]?'✓ IN':'ABSENT'}</span></td>
                <td style={{ ...S.td, textAlign:'center' }}>
                  <button disabled={saving===p.id} style={S.bsm(p[key]?'#7f1d1d':'#14532d')} onClick={()=>toggle(p)}>
                    {saving===p.id?'...':p[key]?'UNDO':'CHECK IN'}
                  </button>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>
      
      {/* Mobile cards */}
      <div style={{ display:'grid', gap:12 }} className="mobile-only">
        {filtered.map(p=>{
          const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
          return (
          <div key={p.id} style={S.card} className="mobile-card">
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, marginBottom:3 }}>{p.diver1}</div>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, marginBottom:6 }}>{p.diver2}</div>
                </div>
                {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={56}/>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <DivBadge div={p.division}/>
                <Country name={p.country} country2={p.country2}/>
              </div>
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, marginTop:8, display:'flex', alignItems:'center', gap:8, justifyContent:'space-between' }}>
              <span style={S.badge(p[key]?'#22c55e':'#334155')}>{p[key]?'✓ IN':'ABSENT'}</span>
              <button disabled={saving===p.id} style={S.bsm(p[key]?'#7f1d1d':'#14532d')} onClick={()=>toggle(p)}>
                {saving===p.id?'...':p[key]?'UNDO':'CHECK IN'}
              </button>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}

// WeighIn Modal - module level to prevent focus loss
function WeighInModal({ pair, day, existing, onSave, onClose, photos, refetchPhotos }) {
  const [form, setForm] = useState({
    fish_count: existing?.fish_count??0,
    total_kg: existing?.total_kg??'',
    largest_fish_kg: existing?.largest_fish_kg??'',
    largest_fish_who: existing?.largest_fish_who??'',
    smallest_cat_kg: existing?.smallest_cat_kg??'',
    smallest_cat_who: existing?.smallest_cat_who??'',
  })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const save = async () => {
    setSaving(true)
    await onSave({
      fish_count: parseInt(form.fish_count)||0,
      total_kg: parseFloat(form.total_kg)||0,
      largest_fish_kg: parseFloat(form.largest_fish_kg)||0,
      largest_fish_who: form.largest_fish_who||'',
      smallest_cat_kg: parseFloat(form.smallest_cat_kg)||0,
      smallest_cat_who: form.smallest_cat_who||'',
      notes: '',
    })
    setSaving(false)
  }

  const pairPhotos = photos.filter(ph=>ph.pair_id===pair.id&&ph.day===day)
  const [showPhoto, setShowPhoto] = useState(false)

  return (
    <Modal onClose={onClose} title={`WEIGH-IN — DAY ${day}`} width={520}>
      <div style={{ color:C.textSub, marginBottom:8, fontFamily:"'Barlow Condensed'", fontSize:13 }}>
        {pair.diver1} + {pair.diver2} · <Country name={pair.country} country2={pair.country2}/>
      </div>
      
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:6 }}>
        <Field label="Fish Count"><input type="number" min="0" value={form.fish_count} onChange={set('fish_count')}/></Field>
        <Field label="Total Weight (kg)"><input type="number" min="0" step="0.1" value={form.total_kg} onChange={set('total_kg')}/></Field>
      </div>
      
      <div style={{ margin:'6px 0', padding:6, background:C.bgDeep, borderRadius:4, fontFamily:"'Barlow Condensed'", fontSize:16, color:'#f59e0b', textAlign:'center' }}>
        RAW SCORE: {calcRawScore(parseInt(form.fish_count)||0, parseFloat(form.total_kg)||0)} pts
      </div>
      
      <div style={{ background:C.bgDeep, padding:8, borderRadius:4, marginBottom:6 }}>
        <div style={{ fontSize:11, color:C.textSub, marginBottom:4, fontFamily:"'Barlow Condensed'" }}>🏅 LARGEST FISH (for individual award)</div>
        <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:6 }}>
          <Field label="Weight (kg)"><input type="number" min="0" step="0.01" value={form.largest_fish_kg} onChange={set('largest_fish_kg')}/></Field>
          <Field label="Who">
            <select value={form.largest_fish_who} onChange={set('largest_fish_who')}>
              <option value="">--</option>
              <option value={pair.diver1}>{pair.diver1.split(' ')[0]}</option>
              <option value={pair.diver2}>{pair.diver2.split(' ')[0]}</option>
            </select>
          </Field>
        </div>
      </div>
      
      <div style={{ background:C.bgDeep, padding:8, borderRadius:4, marginBottom:6 }}>
        <div style={{ fontSize:11, color:C.textSub, marginBottom:4, fontFamily:"'Barlow Condensed'" }}>🐱 SMALLEST CATFISH (for individual award)</div>
        <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:6 }}>
          <Field label="Weight (kg)"><input type="number" min="0" step="0.001" value={form.smallest_cat_kg} onChange={set('smallest_cat_kg')}/></Field>
          <Field label="Who">
            <select value={form.smallest_cat_who} onChange={set('smallest_cat_who')}>
              <option value="">--</option>
              <option value={pair.diver1}>{pair.diver1.split(' ')[0]}</option>
              <option value={pair.diver2}>{pair.diver2.split(' ')[0]}</option>
            </select>
          </Field>
        </div>
      </div>
      
      <div style={{ display:'flex', gap:6, marginTop:10 }}>
        <button style={{ ...S.btn('#22c55e'), flex:1 }} onClick={save} disabled={saving}>{saving?'SAVING...':'SAVE SCORES'}</button>
        <button style={{ ...S.btn('#0a2030'), flex:1 }} onClick={onClose}>CANCEL</button>
      </div>
      
      <div style={{ marginTop:8 }}>
        <button style={{ ...S.bsm(showPhoto?C.accent:C.border), width:'100%', padding:'5px', fontSize:11 }} onClick={()=>setShowPhoto(s=>!s)}>
          📸 {showPhoto?'HIDE PHOTO UPLOAD':'ADD CATCH PHOTO'} {pairPhotos.length>0?`(${pairPhotos.length})`:''}
        </button>
        {showPhoto && (
          <>
            <PhotoUploader pairId={pair.id} weighinId={existing?.id} day={day} onUploaded={refetchPhotos} hideCaption/>
            {pairPhotos.length>0 && (
              <div style={{ marginTop:6, display:'flex', gap:3, flexWrap:'wrap' }}>
                {pairPhotos.map(ph=><img key={ph.id} src={photoUrl(ph.storage_path)} alt="" style={{ width:50, height:38, objectFit:'cover', borderRadius:3 }} onError={e=>{e.target.style.display='none'}}/>)}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

function WeighInView({ pairs, weighins, refetchWeighins, photos=[], refetchPhotos, editing, setEditing, weighinDay, setWeighinDay }) {
  const confirmed = pairs.filter(p=>p.confirmed)
  const getW = (pairId, d) => weighins.find(w=>w.pair_id===pairId&&w.day===d)
  
  const printScoresheet = (day) => {
    const divisionOrder = ['Mens','Womens','Mixed','Masters','Juniors']
    const byDiv = {}
    divisionOrder.forEach(d => byDiv[d] = [])
    confirmed.forEach(p => {
      const div = p.division || 'Mens'
      if (!byDiv[div]) byDiv[div] = []
      byDiv[div].push(p)
    })

    const divRows = divisionOrder.flatMap(div => {
      const teams = byDiv[div]
      if (!teams.length) return []
      return [
        `<tr class="div-header"><td colspan="7">${div.toUpperCase()} PAIRS</td></tr>`,
        ...teams.map((p, i) => {
          const w = getW(p.id, day)
          const nation = p.country2 ? `${p.country} / ${p.country2}` : p.country
          return `<tr class="${i%2===0?'even':'odd'}">
            <td class="team">${p.diver1}<br/><span class="diver2">${p.diver2}</span></td>
            <td class="nation">${nation}</td>
            <td class="data">${w?.fish_count ?? ''}</td>
            <td class="data">${w?.total_kg ? parseFloat(w.total_kg).toFixed(2) : ''}</td>
            <td class="data">${w?.largest_fish_kg ? parseFloat(w.largest_fish_kg).toFixed(2) : ''}</td>
            <td class="data">${w?.smallest_cat_kg ? parseFloat(w.smallest_cat_kg).toFixed(3) : ''}</td>
            <td class="notes"></td>
          </tr>`
        })
      ]
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>WFSC 2026 – Day ${day} Scoresheet</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Arial Narrow', Arial, sans-serif; font-size: 11px; color: #000; background: #fff; padding: 12mm; }
    .header { text-align: center; margin-bottom: 8mm; border-bottom: 2px solid #000; padding-bottom: 4mm; }
    .header h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
    .header h2 { font-size: 14px; font-weight: 700; color: #444; margin-top: 2px; }
    .header .meta { font-size: 10px; color: #666; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 4mm; }
    th { background: #1a1a2e; color: #fff; padding: 5px 6px; text-align: center; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
    th.left { text-align: left; }
    td { padding: 5px 6px; border-bottom: 1px solid #ddd; vertical-align: middle; }
    tr.div-header td { background: #e8f0fe; color: #1a1a2e; font-weight: 900; font-size: 12px; letter-spacing: 1px; padding: 6px 8px; border-top: 2px solid #1a1a2e; border-bottom: 1px solid #1a1a2e; }
    tr.even { background: #fff; }
    tr.odd { background: #f8f9fa; }
    td.team { font-weight: 700; font-size: 11px; min-width: 120px; }
    td.team .diver2 { font-weight: 400; color: #555; font-size: 10px; }
    td.nation { color: #444; font-size: 10px; min-width: 80px; }
    td.data { text-align: center; font-weight: 700; font-size: 12px; min-width: 52px; border-left: 1px solid #e0e0e0; color: #1a1a2e; }
    td.notes { min-width: 60px; border-left: 1px solid #ccc; }
    .totals-row td { font-weight: 900; background: #f0f4ff; border-top: 2px solid #1a1a2e; }
    .footer { margin-top: 8mm; display: flex; justify-content: space-between; font-size: 10px; color: #666; border-top: 1px solid #ccc; padding-top: 3mm; }
    .legend { margin-top: 4mm; font-size: 9px; color: #888; }
    @media print {
      body { padding: 8mm; }
      @page { size: A4 landscape; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🌊 World Freshwater Spearfishing Championships 2026</h1>
    <h2>DAY ${day} SCORESHEET — ${day===1?'FRIDAY 13TH MARCH':'SATURDAY 14TH MARCH'} — LAKE TAUPŌ, NEW ZEALAND</h2>
    <div class="meta">Motuoapa Boating &amp; Fishing Hall &nbsp;|&nbsp; Weigh-in from 3:30pm &nbsp;|&nbsp; Last call 4:30pm</div>
  </div>

  <table>
    <thead>
      <tr>
        <th class="left" style="width:18%">TEAM (Diver 1 / Diver 2)</th>
        <th class="left" style="width:11%">NATION</th>
        <th style="width:8%">FISH<br/>COUNT</th>
        <th style="width:10%">TOTAL<br/>WEIGHT (kg)</th>
        <th style="width:10%">LARGEST<br/>FISH (kg)</th>
        <th style="width:10%">SMALLEST<br/>CATFISH (kg)</th>
        <th style="width:14%">NOTES</th>
      </tr>
    </thead>
    <tbody>
      ${divRows}
    </tbody>
  </table>

  <div class="legend">
    Scoring: 100 pts per fish + 10 pts per kg total weight &nbsp;|&nbsp; Largest fish &amp; smallest catfish recorded for individual awards
  </div>
  <div class="footer">
    <span>Weigh Master: ___________________________</span>
    <span>Recorder: ___________________________</span>
    <span>Printed: ${new Date().toLocaleDateString('en-NZ', {day:'numeric',month:'long',year:'numeric'})}</span>
  </div>
</body>
</html>`

    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  const exportWeighIns = () => {
    // Build CSV data
    const headers = ['Division', 'Diver 1', 'Diver 2', 'Country', 'Country 2', 'Combined Nations', 
                     'Day 1 Fish Count', 'Day 1 Weight (kg)', 'Day 1 Smallest (kg)', 'Day 1 Largest (kg)',
                     'Day 2 Fish Count', 'Day 2 Weight (kg)', 'Day 2 Smallest (kg)', 'Day 2 Largest (kg)',
                     'Total Fish Count', 'Total Weight (kg)']
    
    const rows = confirmed.map(p => {
      const w1 = getW(p.id, 1)
      const w2 = getW(p.id, 2)
      const totalFish = (w1?.fish_count || 0) + (w2?.fish_count || 0)
      const totalKg = (parseFloat(w1?.total_kg || 0)) + (parseFloat(w2?.total_kg || 0))
      
      return [
        p.division,
        p.diver1,
        p.diver2,
        p.country,
        p.country2 || '',
        p.combined_nations ? 'Yes' : 'No',
        w1?.fish_count || '',
        w1?.total_kg || '',
        w1?.smallest_fish_kg || '',
        w1?.largest_fish_kg || '',
        w2?.fish_count || '',
        w2?.total_kg || '',
        w2?.smallest_fish_kg || '',
        w2?.largest_fish_kg || '',
        totalFish || '',
        totalKg ? totalKg.toFixed(1) : ''
      ]
    })
    
    // Create CSV
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n')
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `WFSC2026_WeighIn_Export_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }
  
  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div style={S.h2}>WEIGH-IN</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button style={{ ...S.btn('#1e3a5f'), fontSize:13 }} onClick={()=>printScoresheet(1)}>🖨️ PRINT DAY 1 SHEET</button>
          <button style={{ ...S.btn('#1e3a5f'), fontSize:13 }} onClick={()=>printScoresheet(2)}>🖨️ PRINT DAY 2 SHEET</button>
          <button style={{ ...S.btn('#22c55e'), fontSize:13 }} onClick={exportWeighIns}>📊 EXPORT CSV</button>
        </div>
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[1,2].map(d=><button key={d} style={S.bsm(d===weighinDay?C.accent:C.border)} onClick={()=>setWeighinDay(d)}>DAY {d} — {d===1?'FRI 13 MAR':'SAT 14 MAR'}</button>)}
      </div>
      {/* Desktop table */}
      <div className="hide-mobile" style={S.card}>
        <table style={S.tbl}>
          <thead><tr>
            <th style={S.th}>PAIR</th><th style={S.th}>DIV</th>
            <th style={{ ...S.th, textAlign:'right' }}>DAY {weighinDay} FISH</th>
            <th style={{ ...S.th, textAlign:'right' }}>DAY {weighinDay} KG</th>
            <th style={{ ...S.th, textAlign:'right' }}>TOTAL FISH</th>
            <th style={{ ...S.th, textAlign:'right' }}>TOTAL KG</th>
            <th style={{ ...S.th, textAlign:'right' }}>RAW PTS</th>
            <th style={{ ...S.th, textAlign:'center' }}>PHOTOS</th>
            <th style={{ ...S.th, textAlign:'center' }}>ACTION</th>
          </tr></thead>
          <tbody>
            {confirmed.sort((a,b)=>{
              const aWeighed = !!getW(a.id, weighinDay)
              const bWeighed = !!getW(b.id, weighinDay)
              // Unweighed first
              if (aWeighed !== bWeighed) return aWeighed ? 1 : -1
              // Then by division
              return a.division.localeCompare(b.division)
            }).map(p=>{
              const w = getW(p.id,weighinDay)
              const w1 = getW(p.id, 1)
              const w2 = getW(p.id, 2)
              const totalFish = (w1?.fish_count || 0) + (w2?.fish_count || 0)
              const totalKg = (parseFloat(w1?.total_kg) || 0) + (parseFloat(w2?.total_kg) || 0)
              const pp = photos.filter(ph=>ph.pair_id===p.id&&ph.day===weighinDay)
              const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
              return (
                <tr key={p.id}>
                  <td style={S.td}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div>
                        <div style={S.d1}>{p.diver1}</div>
                        <div style={S.d1}>{p.diver2}</div>
                        <div style={{ marginTop:4 }}><Country name={p.country} country2={p.country2} size={18}/></div>
                      </div>
                      {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={52}/>}
                    </div>
                  </td>
                  <td style={S.td}><DivBadge div={p.division}/></td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:"'Barlow Condensed'", fontSize:28, fontWeight:900, color:'#00d4ff' }}>{w?w.fish_count:<span style={{color:C.border,fontSize:22}}>—</span>}</td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:700, color:'#00d4ff' }}>{w?parseFloat(w.total_kg).toFixed(1):<span style={{color:C.border}}>—</span>}</td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:"'Barlow Condensed'", fontSize:28, fontWeight:900 }}>{totalFish > 0 ? totalFish : <span style={{color:C.border,fontSize:22}}>—</span>}</td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:700 }}>{totalKg > 0 ? totalKg.toFixed(1) : <span style={{color:C.border}}>—</span>}</td>
                  <td style={{ ...S.td, textAlign:'right', fontFamily:"'Barlow Condensed'", fontSize:20, color:'#f59e0b', fontWeight:700 }}>{w?calcRawScore(w.fish_count,w.total_kg):<span style={{color:C.border}}>—</span>}</td>
                  <td style={{ ...S.td, textAlign:'center', color:pp.length?'#ec4899':'#334155', fontFamily:"'Barlow Condensed'", fontWeight:700, fontSize:13 }}>{pp.length?`📸 ${pp.length}`:'—'}</td>
                  <td style={{ ...S.td, textAlign:'center' }}><button style={S.bsm(w?'#7c3aed':'#1e3050')} onClick={()=>setEditing(p)}>{w?'✎ EDIT':'+ ENTER'}</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div style={{ background:C.bgCard, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginBottom:16 }}>
        {confirmed.sort((a,b)=>{
          const aWeighed = !!getW(a.id, weighinDay)
          const bWeighed = !!getW(b.id, weighinDay)
          // Unweighed first
          if (aWeighed !== bWeighed) return aWeighed ? 1 : -1
          // Then by division
          return a.division.localeCompare(b.division)
        }).map(p=>{
          const w = getW(p.id,weighinDay)
          const w1 = getW(p.id, 1)
          const w2 = getW(p.id, 2)
          const totalFish = (w1?.fish_count || 0) + (w2?.fish_count || 0)
          const totalKg = (parseFloat(w1?.total_kg) || 0) + (parseFloat(w2?.total_kg) || 0)
          const pp = photos.filter(ph=>ph.pair_id===p.id&&ph.day===weighinDay)
          const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
          return (
            <div key={p.id} className="wi-card">
              {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={48}/>}
              <div className="wi-info">
                <div className="wi-name">{p.diver1} + {p.diver2}</div>
                <div className="wi-stats">
                  <Country name={p.country} country2={p.country2} size={16}/>
                  <DivBadge div={p.division}/>
                  {w && <span style={{color:'#00d4ff',fontWeight:900,fontSize:16}}>{w.fish_count} fish · {parseFloat(w.total_kg).toFixed(1)}kg</span>}
                  {totalFish > 0 && <span style={{fontWeight:900,fontSize:14,marginLeft:4}}>TOTAL: {totalFish} fish · {totalKg.toFixed(1)}kg</span>}
                  {pp.length>0 && <span style={{color:'#ec4899',marginLeft:6}}>📸{pp.length}</span>}
                </div>
              </div>
              {w && <div className="wi-pts">{calcRawScore(w.fish_count,w.total_kg)}</div>}
              <button style={{ ...S.bsm(w?'#7c3aed':'#1e3050'), marginLeft:8, padding:'8px 12px', fontSize:13 }} onClick={()=>setEditing(p)}>{w?'EDIT':'ENTER'}</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// PairModal at module level - prevents focus loss in Teams view
function PairModal({ title, initial, onSave, onClose, saving }) {
  const [form, setForm] = useState(initial)
  const [uploading, setUploading] = useState(false)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))

  const uploadTeamPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    try {
      // Compress image
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })
      
      // Max 800px wide
      const maxWidth = 800
      const scale = Math.min(1, maxWidth / img.width)
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85))
      const filename = `${initial.id || Date.now()}_${Date.now()}.jpg`
      
      const { error } = await supabase.storage
        .from('team-photos')
        .upload(filename, blob, { upsert: true })
      
      if (error) throw error
      
      const { data: { publicUrl } } = supabase.storage
        .from('team-photos')
        .getPublicUrl(filename)
      
      setForm(f => ({ ...f, team_photo_url: filename }))
    } catch (err) {
      console.error('Upload failed:', err)
      alert('Photo upload failed')
    } finally {
      setUploading(false)
    }
  }

  const removeTeamPhoto = async () => {
    if (!form.team_photo_url) return
    try {
      await supabase.storage.from('team-photos').remove([form.team_photo_url])
      setForm(f => ({ ...f, team_photo_url: null }))
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const getPhotoUrl = (path) => {
    if (!path) return null
    const { data } = supabase.storage.from('team-photos').getPublicUrl(path)
    return data.publicUrl
  }

  return (
    <Modal onClose={onClose} title={title}>
      <div style={{ display:'grid', gap:14 }}>
        <Field label="Division">
          <select value={form.division} onChange={set('division')}>{DIVISIONS.map(d=><option key={d}>{d}</option>)}</select>
        </Field>
        <Field label="Country">
          <select value={form.country||'New Zealand'} onChange={set('country')}>{COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}</select>
        </Field>
        <Field label="Country 2 (mixed nationality pairs only)">
          <select value={form.country2||''} onChange={e=>setForm(f=>({...f,country2:e.target.value||null}))}>
            <option value="">-- Same country --</option>
            {COUNTRIES.map(c=><option key={c.name} value={c.name}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Diver 1 (full name)">
          <input type="text" value={form.diver1||''} onChange={set('diver1')}/>
        </Field>
        <Field label="Diver 2 (full name)">
          <input type="text" value={form.diver2||''} onChange={set('diver2')}/>
        </Field>
        
        <Field label="Team Photo">
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {form.team_photo_url && (
              <div style={{ position:'relative' }}>
                <img src={getPhotoUrl(form.team_photo_url)} alt="Team" style={{ width:80, height:80, objectFit:'cover', borderRadius:8 }} />
                <button 
                  onClick={removeTeamPhoto}
                  style={{ position:'absolute', top:-8, right:-8, background:'#ef4444', border:'none', color:'#fff', borderRadius:'50%', width:24, height:24, cursor:'pointer', fontSize:12 }}
                >×</button>
              </div>
            )}
            <label style={{ ...S.btn(uploading?'#334155':'#3b82f6'), cursor:uploading?'wait':'pointer', fontSize:13, padding:'8px 16px' }}>
              {uploading ? 'Uploading...' : (form.team_photo_url ? 'Change Photo' : '📸 Upload Photo')}
              <input type="file" accept="image/*" onChange={uploadTeamPhoto} disabled={uploading} style={{display:'none'}} />
            </label>
          </div>
        </Field>
        
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <input type="checkbox" id="conf-cb" checked={!!form.confirmed} onChange={e=>setForm(f=>({...f,confirmed:e.target.checked}))}/>
          <label htmlFor="conf-cb" style={{ color:C.muted, fontSize:14, cursor:'pointer' }}>Confirmed entry</label>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>

        </div>
      </div>
      <div style={{ display:'flex', gap:12, marginTop:20 }}>
        <button style={{ ...S.btn('#22c55e'), flex:1 }} onClick={()=>onSave(form)} disabled={saving||uploading}>{saving?'SAVING...':'SAVE'}</button>
        <button style={{ ...S.btn('#0a2030'), flex:1 }} onClick={onClose}>CANCEL</button>
      </div>
    </Modal>
  )
}

function TeamsView({ pairs, refetchPairs, teamEditing, setTeamEditing, teamAdding, setTeamAdding }) {
  const [filter, setFilter] = useState('All')
  const [sortBy, setSortBy] = useState('diver1')
  const [sortDir, setSortDir] = useState('asc')
  const [toggling, setToggling] = useState(null) // 'pairId:field'

  const toggleField = async (pair, field) => {
    const key = `${pair.id}:${field}`
    setToggling(key)
    await supabase.from('pairs').update({ [field]: !pair[field] }).eq('id', pair.id)
    await refetchPairs()
    setToggling(null)
  }

  const CheckBox = ({ pair, field, label, color }) => {
    const key = `${pair.id}:${field}`
    const checked = !!pair[field]
    const busy = toggling === key
    return (
      <button
        onClick={() => toggleField(pair, field)}
        disabled={busy}
        title={label}
        style={{
          display:'flex', alignItems:'center', gap:5, background:'none', border:'none',
          cursor: busy ? 'wait' : 'pointer', padding:'2px 0', opacity: busy ? 0.5 : 1
        }}
      >
        <div style={{
          width:18, height:18, borderRadius:4, flexShrink:0,
          border: `2px solid ${checked ? color : '#334155'}`,
          background: checked ? color : 'transparent',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all 0.15s'
        }}>
          {checked && <span style={{ color:'#fff', fontSize:11, lineHeight:1, fontWeight:900 }}>✓</span>}
        </div>
        <span style={{ fontSize:11, color: checked ? color : C.muted, fontFamily:"'Barlow Condensed'", fontWeight:700, whiteSpace:'nowrap' }}>{label}</span>
      </button>
    )
  }
  
  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('asc')
    }
  }
  
  const filtered = pairs
    .filter(p => filter === 'All' || p.division === filter)
    .sort((a, b) => {
      let aVal, bVal
      if (sortBy === 'diver1') {
        aVal = a.diver1?.toLowerCase() || ''
        bVal = b.diver1?.toLowerCase() || ''
      } else if (sortBy === 'division') {
        aVal = a.division
        bVal = b.division
      } else if (sortBy === 'country') {
        aVal = a.country?.toLowerCase() || ''
        bVal = b.country?.toLowerCase() || ''
      } else if (sortBy === 'status') {
        aVal = a.confirmed ? 1 : 0
        bVal = b.confirmed ? 1 : 0

      }
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  
  const SortIcon = ({ field }) => {
    if (sortBy !== field) return <span style={{ color: C.muted, fontSize: 10 }}>▼</span>
    return <span style={{ color: C.accent }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }
  
  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        <div style={S.h2}>TEAMS</div>
        <button style={{ ...S.btn('#22c55e'), marginLeft:'auto' }} onClick={()=>setTeamAdding(true)}>+ ADD PAIR</button>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
        {['All',...DIVISIONS].map(d=><button key={d} style={S.bsm(d===filter?DIVISION_COLORS[d]||C.accent:C.border)} onClick={()=>setFilter(d)}>{d.toUpperCase()}</button>)}
      </div>
      
      {/* Desktop table */}
      <div className="hide-mobile" style={S.card}>
        <table style={S.tbl}>
          <thead><tr>
            <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggleSort('diver1')}>
              DIVERS <SortIcon field="diver1" />
            </th>
            <th style={S.th}>📸</th>
            <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggleSort('division')}>
              DIV <SortIcon field="division" />
            </th>
            <th style={{ ...S.th, cursor: 'pointer' }} onClick={() => toggleSort('country')}>
              NATION <SortIcon field="country" />
            </th>

            <th style={{ ...S.th, textAlign: 'center', cursor: 'pointer' }} onClick={() => toggleSort('status')}>
              STATUS <SortIcon field="status" />
            </th>
            <th style={{ ...S.th, textAlign: 'center' }}>REGISTERED</th>
            <th style={{ ...S.th, textAlign: 'center' }}>WAIVER</th>
            <th style={{ ...S.th, textAlign: 'center' }}>EDIT</th>
          </tr></thead>
          <tbody>
            {filtered.map(p=>{
              const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
              return (
              <tr key={p.id}>
                <td style={S.td}><div style={S.d1}>{p.diver1}</div><div style={S.d1}>{p.diver2}</div></td>
                <td style={{ ...S.td, textAlign:'center' }}>
                  {tpUrl
                    ? <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={50}/>
                    : <span style={{ color:C.border, fontSize:10 }}>—</span>
                  }
                </td>
                <td style={S.td}><DivBadge div={p.division}/></td>
                <td style={S.td}><Country name={p.country} country2={p.country2}/></td>
                <td style={{ ...S.td, textAlign:'center' }}><span style={S.badge(p.confirmed?'#22c55e':'#f59e0b')}>{p.confirmed?'✓':'⏳'}</span></td>
                <td style={{ ...S.td, textAlign:'center' }}><CheckBox pair={p} field="registered" label="Registered" color="#22c55e"/></td>
                <td style={{ ...S.td, textAlign:'center' }}><CheckBox pair={p} field="waiver_signed" label="Waiver" color="#f59e0b"/></td>
                <td style={{ ...S.td, textAlign:'center' }}><button style={S.bsm()} onClick={()=>setTeamEditing(p)}>✎ EDIT</button></td>
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div style={{ display:'grid', gap:12 }} className="mobile-only">
        {filtered.map(p=>{
          const tpUrl = p.team_photo_url ? supabase.storage.from('team-photos').getPublicUrl(p.team_photo_url).data.publicUrl : null
          return (
          <div key={p.id} style={S.card} className="mobile-card">
            <div style={{ marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, marginBottom:3 }}>{p.diver1}</div>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:17, fontWeight:700, marginBottom:6 }}>{p.diver2}</div>
                </div>
                {tpUrl && <TeamPhotoThumb url={tpUrl} name={`${p.diver1} & ${p.diver2}`} size={56}/>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <DivBadge div={p.division}/>
                <Country name={p.country} country2={p.country2}/>

              </div>
            </div>
            <div style={{ borderTop:`1px solid ${C.border}`, paddingTop:8, marginTop:8, display:'flex', alignItems:'center', gap:8, justifyContent:'space-between', flexWrap:'wrap' }}>
              <span style={S.badge(p.confirmed?'#22c55e':'#f59e0b')}>{p.confirmed?'✓ CONFIRMED':'⏳ PENDING'}</span>
              <div style={{ display:'flex', gap:12 }}>
                <CheckBox pair={p} field="registered" label="Registered" color="#22c55e"/>
                <CheckBox pair={p} field="waiver_signed" label="Waiver" color="#f59e0b"/>
              </div>
              <button style={S.bsm()} onClick={()=>setTeamEditing(p)}>EDIT</button>
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}

function NationsView({ pairs, weighins }) {
  const lb = buildLeaderboard(pairs, weighins)
  
  // Exclude combined nations pairs from national standings
  const nationalPairs = pairs.filter(p => !p.combined_nations)
  const nationalLb = lb.filter(p => {
    const pair = pairs.find(pr => pr.id === p.id)
    return !pair?.combined_nations
  })
  
  // Group Hawaii pairs under USA for display
  const nations = COUNTRIES
    .filter(c => !c.parentCountry) // Only show parent countries
    .map(c => {
      // Get pairs for this country AND any child countries (like Hawaii under USA)
      const childCountries = COUNTRIES.filter(child => child.parentCountry === c.name).map(child => child.name)
      const allCountries = [c.name, ...childCountries]
      
      // Include pairs where country OR country2 matches (but exclude combined nations)
      const cp = nationalLb.filter(p => allCountries.includes(p.country) || allCountries.includes(p.country2))
      const fish = weighins.filter(w => 
        nationalPairs.find(p => p.id === w.pair_id && (allCountries.includes(p.country) || allCountries.includes(p.country2)))
      ).reduce((a, w) => a + w.fish_count, 0)
      const best = cp.length ? Math.max(0, ...cp.map(p => p.total)) : 0
      const totalPairs = nationalPairs.filter(p => allCountries.includes(p.country) || allCountries.includes(p.country2)).length
      
      return { ...c, count: totalPairs, confirmed: cp.filter(p => p.confirmed).length, fish, best }
    })
    .filter(c => c.count > 0)
    .sort((a, b) => b.best - a.best)
    
  return (
    <div className="fade-in">
      <div style={S.h2}>NATIONS</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
        {nations.map((c,i)=>(
          <div key={c.name} style={{ ...S.card, borderColor:i===0?'#f59e0b44':'#1e2d4a' }}>
            <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
              <Flag name={c.name} size={44}/>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:26, fontWeight:900 }}>{c.name}</div>
                <div style={{ color:C.textSub, fontSize:13 }}>{c.short}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, textAlign:'center' }}>
              {[['PAIRS',c.confirmed],['FISH',c.fish],['BEST',c.best>0?c.best.toFixed(1):'—']].map(([l,v])=>(
                <div key={l} style={{ background:C.bgDeep, borderRadius:8, padding:10 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:26, fontWeight:700, color:C.accent }}>{v}</div>
                  <div style={{ color:C.textSub, fontSize:11, fontWeight:600 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AwardsView({ pairs, weighins, resultsFinalized, isAdmin }) {
  const lb = buildLeaderboard(pairs, weighins)
  const { largest, smallest } = specialAwards(pairs, weighins)
  
  // Show placeholder if results not finalized (unless admin)
  if (!resultsFinalized && !isAdmin) {
    return (
      <div className="fade-in">
        <div style={S.h2}>AWARDS</div>
        <div style={{ ...S.card, textAlign:'center', padding:80 }}>
          <div style={{ fontSize:64, marginBottom:16 }}>🏆</div>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:28, fontWeight:900, marginBottom:12 }}>
            Results Coming Soon
          </div>
          <div style={{ color:C.textSub, fontSize:16, maxWidth:400, margin:'0 auto' }}>
            Final awards and rankings will be announced after Day 2 competition concludes and results are verified.
          </div>
        </div>
      </div>
    )
  }
  
  const Podium = ({ title, color, entries }) => (
    <div style={{ ...S.card, borderColor:color+'44' }}>
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:20, fontWeight:900, color, marginBottom:16 }}>{title}</div>
      {entries.length===0
        ? <div style={{ color:C.muted2, textAlign:'center', padding:20 }}>No scores yet</div>
        : entries.slice(0,3).map((p,i)=>(
          <div key={p.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${C.bgDeep}` }}>
            <div style={{ fontFamily:"'Barlow Condensed'", fontSize:26, fontWeight:900, width:32 }}>{['🥇','🥈','🥉'][i]}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:700 }}>{p.diver1} + {p.diver2}</div>
              <Country name={p.country} country2={p.country2}/>
            </div>
            <div style={{ fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, color }}>{p.total.toFixed(1)}</div>
          </div>
        ))
      }
    </div>
  )
  const openTop = [...lb].sort((a,b)=>b.total-a.total).slice(0,3)


  return (
    <div className="fade-in">
      <div style={S.h2}>AWARDS</div>
      <div style={{ ...S.g2, marginBottom:20 }}>
        <div style={{ ...S.card, borderColor:'#f59e0b44' }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:900, color:'#f59e0b', marginBottom:12 }}>🏆 LARGEST FISH</div>
          {largest?<><div style={{ fontFamily:"'Barlow Condensed'", fontSize:52, fontWeight:900, color:'#f59e0b' }}>{largest.kg} kg</div><div style={{ fontSize:16, marginTop:4 }}>{largest.who}</div><div style={{ color:C.textSub, fontSize:13 }}>with {largest.pair.diver1===largest.who?largest.pair.diver2:largest.pair.diver1} · <Country name={largest.pair.country} country2={largest.pair.country2}/> · Day {largest.day}</div></>:<div style={{ color:C.muted2, padding:20, textAlign:'center' }}>Not yet awarded</div>}
        </div>
        <div style={{ ...S.card, borderColor:'#8b5cf644' }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:900, color:'#8b5cf6', marginBottom:12 }}>🐱 SMALLEST CATFISH</div>
          {smallest?<><div style={{ fontFamily:"'Barlow Condensed'", fontSize:52, fontWeight:900, color:'#8b5cf6' }}>{smallest.kg} kg</div><div style={{ fontSize:16, marginTop:4 }}>{smallest.who||'Unknown'}</div><div style={{ color:C.textSub, fontSize:13 }}><Country name={smallest.pair.country} country2={smallest.pair.country2}/> · Day {smallest.day}</div></>:<div style={{ color:C.muted2, padding:20, textAlign:'center' }}>Not yet awarded</div>}
        </div>
      </div>
      <Podium title="🌏 OPEN CHAMPION (all divisions)" color="#f59e0b" entries={openTop}/>
      <div style={S.g2}>{DIVISIONS.map(div=>{
        const entries = [...lb]
          .filter(p => {
            const pair = pairs.find(pr => pr.id === p.id)
            return p.division === div
          })
          .sort((a,b)=>b.total-a.total)
        return <Podium key={div} title={div.toUpperCase()} color={DIVISION_COLORS[div]} entries={entries}/>
      })}</div>

    </div>
  )
}

function ProtestsView({ protests, refetchProtests }) {
  const [form, setForm] = useState({ team_name:'', against_team:'', description:'', deposit_paid:false })
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(null)
  const set = k => e => setForm(f=>({...f,[k]:e.target.value}))
  const submit = async () => {
    if (!form.team_name||!form.against_team||!form.description) return
    setSaving(true)
    await supabase.from('protests').insert({...form,status:'pending'})
    await refetchProtests()
    setForm({ team_name:'', against_team:'', description:'', deposit_paid:false })
    setSaving(false)
  }
  const updateStatus = async (id, status) => { setUpdating(id); await supabase.from('protests').update({status}).eq('id',id); await refetchProtests(); setUpdating(null) }
  const sc = { pending:'#f59e0b', upheld:'#22c55e', dismissed:'#ef4444' }
  return (
    <div className="fade-in">
      <div style={S.h2}>PROTESTS</div>
      <div style={S.card}>
        <div style={S.h3}>LODGE PROTEST</div>
        <div style={{ display:'grid', gap:12 }}>
          <div style={S.g2}>
            <Field label="Team Lodging"><input type="text" value={form.team_name} onChange={set('team_name')} placeholder="Your team"/></Field>
            <Field label="Protest Against"><input type="text" value={form.against_team} onChange={set('against_team')} placeholder="Their team"/></Field>
          </div>
          <Field label="Description"><textarea rows={3} value={form.description} onChange={set('description')} placeholder="Describe the rule breach..." style={{ resize:'vertical' }}/></Field>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <input type="checkbox" id="dep" checked={form.deposit_paid} onChange={e=>setForm(f=>({...f,deposit_paid:e.target.checked}))}/>
            <label htmlFor="dep" style={{ color:C.muted, fontSize:14, cursor:'pointer' }}>$100 NZD deposit received</label>
          </div>
          <button style={S.btn('#ef4444')} onClick={submit} disabled={saving}>{saving?'SUBMITTING...':'LODGE PROTEST'}</button>
        </div>
      </div>
      {protests.length===0
        ? <div style={{ ...S.card, textAlign:'center', color:C.textSub, padding:48 }}>No protests lodged</div>
        : protests.map(p=>(
          <div key={p.id} style={{ ...S.card, borderColor:sc[p.status]+'33' }}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16 }}>
              <div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:700 }}>{p.team_name} <span style={{color:C.textSub}}>vs</span> {p.against_team}</div>
                <div style={{ color:C.muted, fontSize:14, marginTop:6 }}>{p.description}</div>
                <div style={{ color:C.textSub, fontSize:12, marginTop:6 }}>{new Date(p.created_at).toLocaleString()} · Deposit: {p.deposit_paid?'✓ Paid':'✗ Not paid'}</div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'flex-end', flexShrink:0 }}>
                <span style={S.badge(sc[p.status])}>{p.status.toUpperCase()}</span>
                {p.status==='pending' && (
                  <div style={{ display:'flex', gap:8 }}>
                    <button style={S.bsm('#14532d')} onClick={()=>updateStatus(p.id,'upheld')} disabled={updating===p.id}>UPHOLD</button>
                    <button style={S.bsm('#7f1d1d')} onClick={()=>updateStatus(p.id,'dismissed')} disabled={updating===p.id}>DISMISS</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// Settings (Admin only)
function SettingsView({ settings, refetchSettings }) {
  const [saving, setSaving] = useState(false)
  const resultsFinalized = settings?.results_finalized === 'true'
  const currentDay = settings?.current_day || '0'

  const toggleResults = async () => {
    setSaving(true)
    const newValue = resultsFinalized ? 'false' : 'true'
    await supabase.from('competition_settings').update({ value: newValue }).eq('key', 'results_finalized')
    await refetchSettings()
    setSaving(false)
  }

  const setDay = async (day) => {
    setSaving(true)
    await supabase.from('competition_settings').update({ value: String(day) }).eq('key', 'current_day')
    await refetchSettings()
    setSaving(false)
  }

  return (
    <div className="fade-in">
      <div style={S.h2}>COMPETITION SETTINGS</div>
      
      <div style={S.card}>
        <div style={S.h3}>COMPETITION DAY</div>
        <div style={{ color:C.textSub, fontSize:14, marginBottom:16 }}>Current competition day (affects check-in and weigh-in flows)</div>
        <div style={{ display:'flex', gap:8 }}>
          {[0, 1, 2].map(d => (
            <button 
              key={d} 
              style={{ ...S.btn(currentDay === String(d) ? C.accent : C.border), flex:1 }} 
              onClick={() => setDay(d)}
              disabled={saving}
            >
              {d === 0 ? 'PRE-EVENT' : `DAY ${d}`}
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.h3}>AWARDS & RESULTS</div>
        <div style={{ color:C.textSub, fontSize:14, marginBottom:16 }}>
          Control when final awards and rankings are visible to the public. Turn this ON after Day 2 results are confirmed.
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:16, background:C.bgDeep, borderRadius:8, border:`1px solid ${C.border}` }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:700 }}>
              Results Finalized
            </div>
            <div style={{ color:C.textSub, fontSize:13, marginTop:4 }}>
              {resultsFinalized ? 'Awards page is PUBLIC' : 'Awards page is HIDDEN from public'}
            </div>
          </div>
          <button 
            style={{ ...S.btn(resultsFinalized ? '#22c55e' : '#ef4444'), minWidth:120 }}
            onClick={toggleResults}
            disabled={saving}
          >
            {saving ? 'SAVING...' : resultsFinalized ? '✓ ON' : '✗ OFF'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Analytics View
function AnalyticsView() {
  const [analytics, setAnalytics] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('24h')

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true)
      try {
        let query = supabase.from('user_analytics').select('*').order('timestamp', { ascending: false })
        
        // Apply time filter
        const now = new Date()
        if (timeRange === '24h') {
          const yesterday = new Date(now - 24 * 60 * 60 * 1000)
          query = query.gte('timestamp', yesterday.toISOString())
        } else if (timeRange === '7d') {
          const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)
          query = query.gte('timestamp', weekAgo.toISOString())
        }
        
        // Paginate through all rows in batches of 1000
        let allData = []
        let from = 0
        const batchSize = 1000
        while (true) {
          const { data, error } = await query.range(from, from + batchSize - 1)
          if (error) {
            console.error('Analytics fetch error:', error)
            alert('Failed to load analytics: ' + error.message + '\n\nCheck that RLS policies allow SELECT on user_analytics table.')
            break
          }
          allData = [...allData, ...(data || [])]
          if (!data || data.length < batchSize) break
          from += batchSize
        }
        console.log('Analytics loaded:', allData.length, 'records')
        setAnalytics(allData)
      } catch (e) {
        console.error('Analytics fetch exception:', e)
        alert('Analytics error: ' + e.message)
      }
      setLoading(false)
    }
    fetchAnalytics()
  }, [timeRange])

  const uniqueUsers = useMemo(() => new Set(analytics.map(a => a.user_id)).size, [analytics])
  const uniqueSessions = useMemo(() => new Set(analytics.map(a => a.session_id)).size, [analytics])
  const pageViews = useMemo(() => {
    const counts = {}
    analytics.forEach(a => counts[a.page_view] = (counts[a.page_view] || 0) + 1)
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [analytics])

  const Stat = ({ label, value, color = C.accent }) => (
    <div style={{ background: C.bgDeep, border: `1px solid ${color}33`, borderRadius: 12, padding: 24, textAlign: 'center' }}>
      <div style={{ fontFamily: "'Barlow Condensed'", fontSize: 52, fontWeight: 900, color, lineHeight: 1 }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 13, marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  )

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div style={S.h2}>USER ANALYTICS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['24h', '7d', 'all'].map(t => (
            <button key={t} style={S.bsm(t === timeRange ? C.accent : C.border)} onClick={() => setTimeRange(t)}>
              {t === '24h' ? 'LAST 24H' : t === '7d' ? 'LAST 7 DAYS' : 'ALL TIME'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: C.textSub, padding: 80, fontFamily: "'Barlow Condensed'", fontSize: 24 }}>LOADING...</div>
      ) : analytics.length === 0 ? (
        <div style={S.card}>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
            <div style={{ color: C.text, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No Analytics Data Found</div>
            <div style={{ color: C.textSub, fontSize: 14, marginBottom: 16 }}>
              Data is being recorded but cannot be retrieved.
            </div>
            <div style={{ background: C.bgDeep, padding: 16, borderRadius: 8, textAlign: 'left', fontSize: 13, fontFamily: 'monospace' }}>
              <div style={{ color: C.muted, marginBottom: 8 }}>Possible causes:</div>
              <div style={{ color: C.text }}>1. RLS policy blocking SELECT queries</div>
              <div style={{ color: C.text }}>2. Table permissions not set correctly</div>
              <div style={{ color: C.text, marginTop: 12 }}>Fix: Run fix_analytics_rls.sql in Supabase</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <Stat label="UNIQUE USERS" value={uniqueUsers} color="#3b82f6" />
            <Stat label="SESSIONS" value={uniqueSessions} color="#22c55e" />
            <Stat label="PAGE VIEWS" value={analytics.length} color="#f59e0b" />
          </div>

          <div style={S.g2}>
            <div style={S.card}>
              <div style={S.h3}>PAGE POPULARITY</div>
              {pageViews.length === 0 ? (
                <div style={{ color: C.textSub, fontSize: 14, padding: 20, textAlign: 'center' }}>No data yet</div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  {pageViews.map(([page, count]) => (
                    <div key={page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, padding: 8, background: C.bgDeep, borderRadius: 6 }}>
                      <span style={{ fontFamily: "'Barlow Condensed'", fontSize: 15, fontWeight: 700, textTransform: 'uppercase' }}>{page}</span>
                      <span style={{ color: C.accent, fontSize: 15, fontWeight: 700 }}>{count} views</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={S.card}>
              <div style={S.h3}>RECENT ACTIVITY</div>
              <div style={{ marginTop: 12, maxHeight: 400, overflowY: 'auto' }}>
                {analytics.slice(0, 20).map(a => (
                  <div key={a.id} style={{ fontSize: 13, color: C.textSub, marginBottom: 8, padding: 8, background: C.bgDeep, borderRadius: 6 }}>
                    <div style={{ color: C.text, fontWeight: 600, marginBottom: 2 }}>
                      {a.page_view.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {new Date(a.timestamp).toLocaleString()} · User: {a.user_id.slice(-8)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Socials View - Download photos with team names and flags
function SocialsView({ pairs, photos }) {
  const [day, setDay] = useState(1)
  const [selected, setSelected] = useState(new Set())
  const [processing, setProcessing] = useState(false)
  
  const dayPhotos = useMemo(() => photos.filter(p => p.day === day), [photos, day])
  
  const toggleSelect = (photoId) => {
    const newSelected = new Set(selected)
    if (newSelected.has(photoId)) {
      newSelected.delete(photoId)
    } else {
      newSelected.add(photoId)
    }
    setSelected(newSelected)
  }
  
  const selectAll = () => {
    setSelected(new Set(dayPhotos.map(p => p.id)))
  }
  
  const clearAll = () => {
    setSelected(new Set())
  }
  
  const downloadSelected = async () => {
    if (selected.size === 0) {
      alert('Please select at least one photo')
      return
    }
    
    setProcessing(true)
    
    try {
      const photosToProcess = dayPhotos.filter(p => selected.has(p.id))
      
      // For single photo, download directly
      if (photosToProcess.length === 1) {
        await downloadPhotoWithOverlay(photosToProcess[0], pairs)
        alert('Photo downloaded!')
        clearAll()
        setProcessing(false)
        return
      }
      
      // For multiple photos, create ZIP (mobile-friendly)
      const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default
      const zip = new JSZip()
      
      for (let i = 0; i < photosToProcess.length; i++) {
        const photo = photosToProcess[i]
        const blob = await createPhotoWithOverlay(photo, pairs)
        const arrayBuffer = await blob.arrayBuffer()
        const pair = pairs.find(p => p.id === photo.pair_id)
        const safeName = pair ? `${pair.country}_${pair.diver1.replace(/\s+/g, '_')}` : `photo_${i+1}`
        const filename = `WFSC2026_Day${photo.day}_${safeName}_${i+1}.jpg`
        zip.file(filename, arrayBuffer)
      }
      
      // Generate and download ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `WFSC2026_Day${day}_Photos.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      alert(`Downloaded ${selected.size} photo(s) as ZIP!`)
      clearAll()
    } catch (err) {
      console.error('Download error:', err)
      alert('Error downloading photos. Check console.')
    } finally {
      setProcessing(false)
    }
  }
  
  return (
    <div className="fade-in">
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={S.h2}>SOCIAL MEDIA DOWNLOADS</div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={S.bsm(day===1?C.accent:C.border)} onClick={()=>setDay(1)}>DAY 1</button>
          <button style={S.bsm(day===2?C.accent:C.border)} onClick={()=>setDay(2)}>DAY 2</button>
        </div>
      </div>
      
      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ color:C.textSub, fontSize:14 }}>
            {selected.size} of {dayPhotos.length} selected
          </div>
          <button style={S.bsm(C.accent)} onClick={selectAll}>SELECT ALL</button>
          <button style={S.bsm(C.border)} onClick={clearAll}>CLEAR</button>
          <button 
            style={{ ...S.bsm('#10b981'), marginLeft:'auto' }} 
            onClick={downloadSelected}
            disabled={processing || selected.size === 0}
          >
            {processing ? '⏳ PROCESSING...' : `📥 DOWNLOAD ${selected.size || ''}`}
          </button>
        </div>
      </div>
      
      {dayPhotos.length === 0 ? (
        <div style={{ ...S.card, textAlign:'center', color:C.textSub, padding:48 }}>
          No photos uploaded for Day {day} yet.
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
          {dayPhotos.map(photo => {
            const pair = pairs.find(p => p.id === photo.pair_id)
            if (!pair) return null
            
            const isSelected = selected.has(photo.id)
            
            // Debug: log photo URL
            if (!photo.storage_path) {
              console.warn('Photo missing storage_path:', photo)
            }
            
            const photoURL = photoUrl(photo.storage_path)
            
            return (
              <div 
                key={photo.id} 
                style={{ 
                  ...S.card, 
                  padding:0, 
                  cursor:'pointer',
                  borderColor: isSelected ? C.accent : C.border,
                  borderWidth: isSelected ? 2 : 1,
                  position:'relative'
                }}
                onClick={() => toggleSelect(photo.id)}
              >
                {isSelected && (
                  <div style={{
                    position:'absolute',
                    top:8,
                    right:8,
                    width:32,
                    height:32,
                    borderRadius:'50%',
                    background:C.accent,
                    display:'flex',
                    alignItems:'center',
                    justifyContent:'center',
                    fontSize:18,
                    zIndex:1
                  }}>✓</div>
                )}
                {photoURL ? (
                  <img 
                    src={photoURL} 
                    alt="Catch" 
                    style={{ 
                      width:'100%', 
                      height:200, 
                      objectFit:'cover',
                      display:'block',
                      backgroundColor: C.bgDeep
                    }}
                    onError={(e) => {
                      console.error('Image failed to load:', photoURL)
                      e.target.style.display = 'none'
                      e.target.nextElementSibling.style.display = 'flex'
                    }}
                  />
                ) : null}
                <div style={{ 
                  width:'100%', 
                  height:200, 
                  display:'none',
                  alignItems:'center',
                  justifyContent:'center',
                  backgroundColor:C.bgDeep,
                  color:C.muted,
                  fontSize:14
                }}>
                  📷 Image unavailable
                </div>
                <div style={{ padding:12 }}>
                  <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>
                    {pair.diver1} + {pair.diver2}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                    <Country name={pair.country} country2={pair.country2} size={18}/>
                    <DivBadge div={pair.division}/>
                  </div>
                  {photo.caption && (
                    <div style={{ fontSize:12, color:C.textSub, marginTop:8 }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Helper function to create photo with overlay and return as blob
async function createPhotoWithOverlay(photo, pairs) {
  const pair = pairs.find(p => p.id === photo.pair_id)
  if (!pair) throw new Error('Pair not found')

  // Fetch image as blob to avoid CORS canvas taint issues
  const imageUrl = photoUrl(photo.storage_path)
  const imageResp = await fetch(imageUrl)
  if (!imageResp.ok) throw new Error('Failed to fetch image: ' + imageUrl)
  const imageBlob = await imageResp.blob()
  const imageBlobUrl = URL.createObjectURL(imageBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(imageBlobUrl)

        const overlayHeight = Math.max(80, img.height * 0.08)
        const padding = 16
        const flagSize = overlayHeight * 0.5

        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
        ctx.fillRect(0, img.height - overlayHeight, img.width, overlayHeight)

        // Load flags sequentially so flagX advances correctly
        let flagX = padding
        const countries = [pair.country, pair.country2].filter(Boolean)
        for (const country of countries) {
          const flagImg = await loadFlag(country)
          if (flagImg) {
            ctx.drawImage(flagImg, flagX, img.height - overlayHeight + (overlayHeight - flagSize) / 2, flagSize * 1.5, flagSize)
            flagX += flagSize * 1.5 + 12
          }
        }

        const fontSize = Math.max(16, overlayHeight * 0.25)
        ctx.fillStyle = '#ffffff'
        ctx.font = `bold ${fontSize}px 'Barlow Condensed', sans-serif`
        ctx.textBaseline = 'middle'
        ctx.fillText(`${pair.diver1} + ${pair.diver2}`, flagX, img.height - overlayHeight / 2)

        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('canvas.toBlob returned null'))
          resolve(blob)
        }, 'image/jpeg', 0.95)
      } catch (err) {
        reject(err)
      }
    }
    img.onerror = (e) => reject(new Error('Image load failed'))
    img.src = imageBlobUrl
  })
}

// Helper function to download photo with overlay (single file)
async function downloadPhotoWithOverlay(photo, pairs) {
  const pair = pairs.find(p => p.id === photo.pair_id)
  if (!pair) return
  
  const blob = await createPhotoWithOverlay(photo, pairs)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `WFSC2026_Day${photo.day}_${pair.country}_${pair.diver1.replace(/\s+/g, '_')}_${pair.diver2.replace(/\s+/g, '_')}.jpg`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Helper to load flag images
function loadFlag(countryName) {
  return new Promise((resolve) => {
    const flagMap = {
      'New Zealand': 'new-zealand',
      'Australia': 'australia',
      'USA': 'usa',
      'United States': 'usa',
      'Hawaii': 'hawaii',
      'Guam': 'guam',
      'Guam, USA': 'guam',
      'Cuba': 'cuba',
      'Singapore': 'singapore',
      'Portugal': 'portugal',
      'England': 'england',
      'Ghana': 'ghana',
      'China': 'china',
    }
    
    const flagFile = flagMap[countryName]
    if (!flagFile) {
      resolve(null)
      return
    }
    
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = `/flags/${flagFile}.jpg`
  })
}

// Merch View - Supabase backed
function MerchView() {
  const [orders, setOrders] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [search, setSearch] = useState('')
  const [filterExtra, setFilterExtra] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterCollected, setFilterCollected] = useState('all')
  const [reqForm, setReqForm] = useState({ name:'', type:'T-Shirt', size:'', notes:'' })
  const [reqSaving, setReqSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [{ data: ord }, { data: req }] = await Promise.all([
        supabase.from('merch_orders').select('*').order('person'),
        supabase.from('merch_requests').select('*').order('created_at')
      ])
      if (ord) setOrders(ord)
      if (req) setRequests(req)
    } catch(e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const toggleCollected = async (id, current) => {
    setToggling(id)
    const newVal = !current
    // Optimistic update
    setOrders(prev => prev.map(r => r.id === id ? {...r, allocated: newVal} : r))
    try {
      await supabase.from('merch_orders').update({ allocated: newVal }).eq('id', id)
    } catch(e) {
      // Revert on error
      setOrders(prev => prev.map(r => r.id === id ? {...r, allocated: current} : r))
    }
    setToggling(null)
  }

  const sizeOrder = ['Child 8','Child 14','Female 8','Female 10','Female 12','Female 14','Female 16','Male S','Male M','Male L','Male XL','Male 2XL','S','M','L','XL','2XL']
  const sortSizes = obj => Object.entries(obj).sort((a,b) => (sizeOrder.indexOf(a[0]) - sizeOrder.indexOf(b[0])) || a[0].localeCompare(b[0]))

  // Size summary — total and remaining (uncollected)
  const shirtTotal = {}, shirtLeft = {}
  const jacketTotal = {}, jacketLeft = {}
  orders.forEach(r => {
    if (r.item_type === 'T-Shirt') {
      shirtTotal[r.size] = (shirtTotal[r.size]||0)+1
      if (!r.allocated) shirtLeft[r.size] = (shirtLeft[r.size]||0)+1
    } else {
      jacketTotal[r.size] = (jacketTotal[r.size]||0)+1
      if (!r.allocated) jacketLeft[r.size] = (jacketLeft[r.size]||0)+1
    }
  })

  const totalShirts = orders.filter(r=>r.item_type==='T-Shirt').length
  const totalJackets = orders.filter(r=>r.item_type==='Jacket').length
  const collectedShirts = orders.filter(r=>r.item_type==='T-Shirt'&&r.allocated).length
  const collectedJackets = orders.filter(r=>r.item_type==='Jacket'&&r.allocated).length

  // Filtered rows
  const q = search.toLowerCase()
  const filtered = orders.filter(r => {
    const matchSearch = !q || r.person.toLowerCase().includes(q) || (r.booker||'').toLowerCase().includes(q)
    const matchExtra = filterExtra==='all' || (filterExtra==='extra' ? r.is_extra : !r.is_extra)
    const matchType = filterType==='all' || r.item_type===filterType
    const matchCollected = filterCollected==='all' || (filterCollected==='collected' ? r.allocated : !r.allocated)
    return matchSearch && matchExtra && matchType && matchCollected
  })

  const addRequest = async () => {
    if (!reqForm.name || !reqForm.size) return
    setReqSaving(true)
    try {
      await supabase.from('merch_requests').insert([{
        name: reqForm.name, item_type: reqForm.type, size: reqForm.size, notes: reqForm.notes, status: 'pending'
      }])
      setReqForm({ name:'', type:'T-Shirt', size:'', notes:'' })
      await fetchAll()
    } catch(e) { console.error(e) }
    finally { setReqSaving(false) }
  }

  const updateStatus = async (id, status) => {
    await supabase.from('merch_requests').update({ status }).eq('id', id)
    setRequests(prev => prev.map(r => r.id===id ? {...r, status} : r))
  }

  const deleteRequest = async (id) => {
    await supabase.from('merch_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id!==id))
  }

  const tagStyle = (extra) => ({
    display:'inline-block', padding:'1px 6px', borderRadius:3, fontSize:10, fontWeight:700,
    background: extra ? '#1e3a1e' : '#1e293b',
    color: extra ? '#4ade80' : '#60a5fa',
    border: `1px solid ${extra ? '#4ade8044' : '#60a5fa44'}`
  })
  const statusColors = { pending:'#f59e0b', allocated:'#22c55e', waitlist:'#a78bfa' }

  if (loading) return <div style={{ padding:40, textAlign:'center', color:C.muted }}>Loading merch data...</div>

  return (
    <div className="fade-in">
      <div style={S.h2}>MERCH</div>

      {/* Size summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        {[
          { label:'👕 T-SHIRTS', color:'#60a5fa', total: shirtTotal, left: shirtLeft, tot: totalShirts, col: collectedShirts },
          { label:'🧥 JACKETS',  color:'#f59e0b', total: jacketTotal, left: jacketLeft, tot: totalJackets, col: collectedJackets }
        ].map(({ label, color, total, left, tot, col }) => (
          <div key={label} style={S.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:900, color }}>{label}</div>
              <div style={{ fontSize:12, color: col===tot ? '#22c55e' : C.textSub }}>
                <span style={{ fontWeight:700, color: col===tot ? '#22c55e' : '#fff' }}>{col}</span>
                <span style={{ color:C.muted }}>/{tot} collected</span>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ height:4, background:'#0d2040', borderRadius:2, marginBottom:10, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${tot ? (col/tot)*100 : 0}%`, background: col===tot ? '#22c55e' : color, borderRadius:2, transition:'width 0.3s' }}/>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {sortSizes(total).map(([size, count]) => {
                const remaining = left[size] || 0
                const allGone = remaining === 0
                return (
                  <div key={size} style={{ background: allGone ? '#0d2d0d' : '#0d2040', borderRadius:4, padding:'4px 10px', fontFamily:"'Barlow Condensed'", fontSize:14, border: allGone ? '1px solid #22c55e44' : '1px solid transparent' }}>
                    <span style={{ color:C.textSub }}>{size}</span>
                    {' '}
                    <span style={{ fontWeight:900, color: allGone ? '#22c55e' : '#fff' }}>{remaining}</span>
                    {remaining < count && <span style={{ color:C.muted, fontSize:11 }}>/{count}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Filters + Search */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
        <div style={{ position:'relative', gridColumn:'1/-1' }}>
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:C.muted, fontSize:14, pointerEvents:'none' }}>🔍</span>
          <input
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search by name or booker..."
            style={{ ...S.inp, width:'100%', paddingLeft:30, fontSize:13 }}
          />
          {search && (
            <button onClick={()=>setSearch('')} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:C.muted, cursor:'pointer', fontSize:16, lineHeight:1 }}>×</button>
          )}
        </div>
        <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={{ ...S.inp, padding:'6px 10px', fontSize:13 }}>
          <option value="all">All items</option>
          <option value="T-Shirt">T-Shirts</option>
          <option value="Jacket">Jackets</option>
        </select>
        <select value={filterExtra} onChange={e=>setFilterExtra(e.target.value)} style={{ ...S.inp, padding:'6px 10px', fontSize:13 }}>
          <option value="all">Included + Extra</option>
          <option value="included">Included only</option>
          <option value="extra">Extra only</option>
        </select>
        <select value={filterCollected} onChange={e=>setFilterCollected(e.target.value)} style={{ ...S.inp, padding:'6px 10px', fontSize:13 }}>
          <option value="all">All statuses</option>
          <option value="pending">Not collected</option>
          <option value="collected">Collected</option>
        </select>
        <div style={{ display:'flex', alignItems:'center', paddingLeft:4, fontSize:13, color:C.textSub }}>{filtered.length} item{filtered.length!==1?'s':''}</div>
      </div>

      {/* Main table */}
      <div style={{ ...S.card, padding:0, overflow:'hidden', marginBottom:24 }}>
        {/* Desktop header */}
        <div className="desktop-only" style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 90px 80px 90px 60px', background:'#0d2040', padding:'8px 16px', fontFamily:"'Barlow Condensed'", fontSize:12, fontWeight:700, color:C.textSub, letterSpacing:1 }}>
          <div>PERSON</div><div>BOOKER</div><div>ITEM</div><div>SIZE</div><div>TYPE</div><div style={{ textAlign:'center' }}>✓</div>
        </div>
        {filtered.length === 0
          ? <div style={{ padding:32, textAlign:'center', color:C.muted }}>{search ? `No results for "${search}"` : 'No items'}</div>
          : filtered.map((r, i) => (
            <div key={r.id} style={{ borderBottom:`1px solid #0d2040`, background: r.allocated ? '#071d0711' : (i%2===0 ? 'transparent' : '#071a2e11'), opacity: r.allocated ? 0.7 : 1 }}>
              {/* Desktop row */}
              <div className="desktop-only" style={{ display:'grid', gridTemplateColumns:'1.6fr 1fr 90px 80px 90px 60px', padding:'8px 16px', alignItems:'center', gap:8 }}>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700, textDecoration: r.allocated ? 'line-through' : 'none', color: r.allocated ? C.muted : C.text }}>{r.person}</div>
                <div style={{ fontSize:12, color:C.textSub }}>{r.booker && r.booker!==r.person ? r.booker : <span style={{ color:'#ffffff33' }}>—</span>}</div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:13 }}>{r.item_type==='T-Shirt' ? '👕' : '🧥'} {r.item_type}</div>
                <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700 }}>{r.size}</div>
                <div><span style={tagStyle(r.is_extra)}>{r.is_extra ? 'EXTRA' : 'INCLUDED'}</span></div>
                <div style={{ textAlign:'center' }}>
                  <button onClick={() => toggleCollected(r.id, r.allocated)} disabled={toggling===r.id}
                    style={{ width:28, height:28, borderRadius:6, border:'none', cursor:'pointer', background: r.allocated ? '#22c55e' : '#1e293b', color: r.allocated ? '#fff' : C.muted, fontSize:16, display:'inline-flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', opacity: toggling===r.id ? 0.5 : 1 }}>
                    {r.allocated ? '✓' : '○'}
                  </button>
                </div>
              </div>
              {/* Mobile card */}
              <div className="mobile-only" style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }}>
                {/* Collect button - big and prominent on left */}
                <button onClick={() => toggleCollected(r.id, r.allocated)} disabled={toggling===r.id}
                  style={{ flexShrink:0, width:44, height:44, borderRadius:8, border:'none', cursor:'pointer', background: r.allocated ? '#22c55e' : '#1e293b', color: r.allocated ? '#fff' : '#475569', fontSize:22, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s', opacity: toggling===r.id ? 0.5 : 1 }}>
                  {r.allocated ? '✓' : '○'}
                </button>
                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:15, fontWeight:700, textDecoration: r.allocated ? 'line-through' : 'none', color: r.allocated ? C.muted : C.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r.person}</div>
                  {r.booker && r.booker!==r.person && <div style={{ fontSize:11, color:C.muted, marginTop:1 }}>Booked by {r.booker}</div>}
                  <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                    <span style={{ fontFamily:"'Barlow Condensed'", fontSize:13 }}>{r.item_type==='T-Shirt' ? '👕' : '🧥'} {r.item_type}</span>
                    <span style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:900, color:'#fff', background:'#0d2040', borderRadius:4, padding:'1px 7px' }}>{r.size}</span>
                    <span style={tagStyle(r.is_extra)}>{r.is_extra ? 'EXTRA' : 'INCLUDED'}</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* Late / Additional Requests */}
      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, color:C.accent, marginBottom:12 }}>
        📋 LATE / ADDITIONAL REQUESTS
      </div>
      <div style={{ fontSize:13, color:C.textSub, marginBottom:12 }}>
        Capture requests from people who missed the ordering window.
      </div>

      <div style={{ ...S.card, marginBottom:16 }}>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:15, fontWeight:700, marginBottom:10, color:'#fff' }}>ADD REQUEST</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>NAME</div>
            <input value={reqForm.name} onChange={e=>setReqForm(f=>({...f,name:e.target.value}))}
              placeholder="Person's name" style={{ ...S.inp, width:'100%', fontSize:13 }}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div>
              <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>ITEM</div>
              <select value={reqForm.type} onChange={e=>setReqForm(f=>({...f,type:e.target.value}))} style={{ ...S.inp, width:'100%', fontSize:13 }}>
                <option>T-Shirt</option><option>Jacket</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>SIZE</div>
              <input value={reqForm.size} onChange={e=>setReqForm(f=>({...f,size:e.target.value}))}
                placeholder="e.g. Male L" style={{ ...S.inp, width:'100%', fontSize:13 }}/>
            </div>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
          <div>
            <div style={{ fontSize:11, color:C.textSub, marginBottom:3 }}>NOTES (optional)</div>
            <input value={reqForm.notes} onChange={e=>setReqForm(f=>({...f,notes:e.target.value}))}
              placeholder="Any notes..." style={{ ...S.inp, width:'100%', fontSize:13 }}/>
          </div>
          <button onClick={addRequest} disabled={reqSaving||!reqForm.name||!reqForm.size}
            style={{ ...S.btn, padding:'8px 20px', fontSize:13, alignSelf:'flex-end' }}>
            {reqSaving ? '...' : '+ ADD'}
          </button>
        </div>
      </div>

      {requests.length === 0
        ? <div style={{ ...S.card, textAlign:'center', color:C.muted, padding:24 }}>No late requests yet</div>
        : (
          <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
            <div className="desktop-only" style={{ display:'grid', gridTemplateColumns:'1.4fr 80px 80px 1fr 120px 100px', background:'#0d2040', padding:'8px 16px', fontFamily:"'Barlow Condensed'", fontSize:12, fontWeight:700, color:C.textSub, letterSpacing:1 }}>
              <div>NAME</div><div>ITEM</div><div>SIZE</div><div>NOTES</div><div>STATUS</div><div>ACTIONS</div>
            </div>
            {requests.map(r => (
              <div key={r.id} style={{ borderBottom:`1px solid #0d2040` }}>
                {/* Desktop row */}
                <div className="desktop-only" style={{ display:'grid', gridTemplateColumns:'1.4fr 80px 80px 1fr 120px 100px', padding:'8px 16px', alignItems:'center', gap:8 }}>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700 }}>{r.name}</div>
                  <div style={{ fontSize:13 }}>{r.item_type==='T-Shirt' ? '👕' : '🧥'} {r.item_type}</div>
                  <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700 }}>{r.size}</div>
                  <div style={{ fontSize:12, color:C.textSub }}>{r.notes||'—'}</div>
                  <div>
                    <select value={r.status} onChange={e=>updateStatus(r.id, e.target.value)}
                      style={{ ...S.inp, fontSize:12, padding:'3px 6px', color: statusColors[r.status]||C.text }}>
                      <option value="pending">Pending</option>
                      <option value="allocated">Allocated</option>
                      <option value="waitlist">Waitlist</option>
                    </select>
                  </div>
                  <div>
                    <button onClick={()=>deleteRequest(r.id)} style={{ ...S.bsm('#7f1d1d'), fontSize:11, padding:'3px 8px' }}>Remove</button>
                  </div>
                </div>
                {/* Mobile card */}
                <div className="mobile-only" style={{ padding:'10px 14px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                    <div>
                      <div style={{ fontFamily:"'Barlow Condensed'", fontSize:15, fontWeight:700 }}>{r.name}</div>
                      <div style={{ display:'flex', gap:6, marginTop:3, alignItems:'center' }}>
                        <span style={{ fontSize:13 }}>{r.item_type==='T-Shirt' ? '👕' : '🧥'} {r.item_type}</span>
                        <span style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:900, background:'#0d2040', borderRadius:4, padding:'1px 7px' }}>{r.size}</span>
                      </div>
                      {r.notes && <div style={{ fontSize:12, color:C.muted, marginTop:3 }}>{r.notes}</div>}
                    </div>
                    <button onClick={()=>deleteRequest(r.id)} style={{ ...S.bsm('#7f1d1d'), fontSize:11, padding:'4px 10px', flexShrink:0 }}>✕</button>
                  </div>
                  <select value={r.status} onChange={e=>updateStatus(r.id, e.target.value)}
                    style={{ ...S.inp, fontSize:13, padding:'5px 8px', width:'100%', color: statusColors[r.status]||C.text }}>
                    <option value="pending">Pending</option>
                    <option value="allocated">Allocated</option>
                    <option value="waitlist">Waitlist</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

function InfoView() {
  const dayStyle = { fontFamily:"'Barlow Condensed'", fontSize:22, fontWeight:900, color:'#f59e0b', marginBottom:8, marginTop:4 }
  const itemStyle = { fontSize:14, color:C.text, lineHeight:1.6, marginBottom:4 }
  const boldStyle = { fontWeight:700, color:'#fff' }
  return (
    <div className="fade-in">
      <div style={S.h2}>EVENT INFORMATION</div>

      {/* Header card */}
      <div style={{ ...S.card, textAlign:'center', background:'linear-gradient(135deg,#0d2040 0%,#071a2e 100%)', borderColor:'#f59e0b44', marginBottom:12 }}>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:13, letterSpacing:3, color:C.textSub, marginBottom:4 }}>FRESHWATER SPEARFISHING</div>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:32, fontWeight:900, color:'#fff', lineHeight:1 }}>WORLD CHAMPS</div>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:28, fontWeight:900, color:'#f59e0b', margin:'4px 0' }}>2026 — LAKE TAUPŌ</div>
        <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, letterSpacing:2, color:C.textSub }}>NEW ZEALAND</div>
        <div style={{ marginTop:12, fontSize:13, color:C.textSub }}>
          <strong style={{ color:'#fff' }}>Entry Fee Per Person: $450 NZD</strong><br/>
          Includes competition entry, lake usage fee, competition jacket + t-shirt,<br/>all food supplied while at the hall mentioned in the program
        </div>
      </div>

      {/* Schedule */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:12, marginBottom:12 }}>

        <div style={S.card}>
          <div style={dayStyle}>📅 Tuesday 10th March</div>
          <div style={itemStyle}><span style={boldStyle}>5pm – 7pm</span> Informal get together</div>
          <div style={itemStyle}>Motuoapa Boating and Fishing Hall<br/>8 Arapaho Street, Motuoapa</div>
        </div>

        <div style={S.card}>
          <div style={dayStyle}>📅 Thursday 12th March</div>
          <div style={itemStyle}><span style={boldStyle}>4pm</span> Gathering at Motuoapa Boating and Fishing Hall, 8 Arapaho Street, Motuoapa</div>
          <div style={itemStyle}><span style={boldStyle}>5pm</span> Whakatau greeting (Māori welcome to all teams). Right of reply.</div>
          <div style={itemStyle}><span style={boldStyle}>6pm</span> Safety Briefing, roll call — <span style={boldStyle}>compulsory for all competitors!</span></div>
          <div style={itemStyle}>Fish, chips and sausages provided. Bar open.</div>
        </div>

        <div style={S.card}>
          <div style={dayStyle}>🏊 Friday 13th March — Day 1</div>
          <div style={itemStyle}><span style={boldStyle}>7:30am SHARP!</span> Compulsory roll call for all competitors, safety brief, weather report.</div>
          <div style={itemStyle}><span style={{ ...boldStyle, color:'#00d4ff' }}>Comp start 8:30am</span></div>
          <div style={itemStyle}>Exit water <span style={boldStyle}>2:30pm</span>, comp ends.</div>
          <div style={itemStyle}>Weigh-in starts <span style={boldStyle}>3:30pm</span>, last call for competitors <span style={boldStyle}>4:30pm</span>.</div>
          <div style={itemStyle}>Snacks provided at weigh-in for competitors, bar open.</div>
        </div>

        <div style={S.card}>
          <div style={dayStyle}>🏊 Saturday 14th March — Day 2</div>
          <div style={itemStyle}><span style={boldStyle}>7:30am SHARP!</span> Day two. Compulsory roll call for all competitors.</div>
          <div style={itemStyle}><span style={{ ...boldStyle, color:'#00d4ff' }}>Comp start 8:30am</span></div>
          <div style={itemStyle}>Exit water <span style={boldStyle}>2:30pm</span>, comp ends.</div>
          <div style={itemStyle}>Weigh-in starts <span style={boldStyle}>3:30pm</span>, last call for competitors <span style={boldStyle}>4:30pm</span>.</div>
          <div style={itemStyle}>Dinner and prize giving start <span style={boldStyle}>6:30pm onwards</span><br/>Motuoapa Boat and Fishing Hall, 8 Arapaho Street, Motuoapa</div>
        </div>

      </div>

      {/* Bonus + Sponsors row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:12 }}>
        <div style={{ ...S.card, borderColor:'#f59e0b88', background:'#1a0a00', textAlign:'center' }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:26, fontWeight:900, color:'#f59e0b' }}>🎣 BONUS!</div>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:18, fontWeight:900, color:'#fff', marginBottom:8 }}>CATFISH COOKING COMPETITION</div>
          <div style={itemStyle}>Saturday evening before the prizegiving — cook at home &amp; bring along for judging.</div>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:14, fontWeight:700, color:'#f59e0b', marginTop:8 }}>Prizes for 1st, 2nd, 3rd place</div>
        </div>



        <div style={{ ...S.card }}>
          <div style={{ fontFamily:"'Barlow Condensed'", fontSize:16, fontWeight:900, color:C.textSub, marginBottom:8, letterSpacing:1 }}>📍 VENUE</div>
          <div style={itemStyle}>Motuoapa Boating and Fishing Hall<br/>8 Arapaho Street, Motuoapa</div>
          <div style={{ marginTop:8, ...itemStyle }}>40 min south of Taupō · 10 min north of Turangi</div>
          <div style={{ marginTop:8, ...itemStyle }}><span style={boldStyle}>Contact:</span> spearfishingnewzealand@gmail.com<br/>+64 27 361 6656</div>
        </div>
      </div>

    </div>
  )
}

export default function WFSCApp() {
  const navigate = useNavigate()
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState('dashboard')
  const [weighinEditing, setWeighinEditing] = useState(null)
  const [weighinDay, setWeighinDay] = useState(1)
  const [teamEditing, setTeamEditing] = useState(null)
  const [teamAdding, setTeamAdding] = useState(false)
  const [teamSaving, setTeamSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const { pairs, loading:pL, refetch:refetchPairs }       = usePairs()
  const { weighins, loading:wL, refetch:refetchWeighins }  = useWeighins()
  const { protests, refetch:refetchProtests }              = useProtests()
  const { photos, refetch:refetchPhotos }                  = usePhotos()
  const { settings, refetch:refetchSettings }              = useSettings()

  const adminTabs = [
    {id:'dashboard',label:'Dashboard'},{id:'leaderboard',label:'Leaderboard'},
    {id:'checkin',label:'Check-In'},{id:'weighin',label:'Weigh-In'},
    {id:'teams',label:'Teams'},
    {id:'awards',label:'Awards'},{id:'protests',label:'Protests'},
    {id:'merch',label:'Merch'},{id:'settings',label:'Settings'},
    {id:'analytics',label:'Analytics'},{id:'socials',label:'Socials'},
  ]
  const tabs = isAdmin===true ? adminTabs : [{id:'dashboard',label:'Dashboard'},{id:'leaderboard',label:'Leaderboard'},{id:'awards',label:'Awards'},{id:'info',label:'Info'}]

  // Track page views
  useEffect(() => {
    trackPageView(tab)
  }, [tab])

  if (isAdmin==='pending') return <LoginScreen onLogin={()=>setIsAdmin(true)}/>

  return (
    <>
      <style>{css}</style>
      <div style={S.app}>
        <header style={S.hdr}>
          <div style={S.hi}>
            <button onClick={() => navigate('/')} style={{ ...S.bsm(C.border), flexShrink:0, marginRight:12 }}>← SNZ Hub</button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.logo}>
                WFSC <span style={{color:C.accent}}>2026</span>
                <span className="hide-mobile" style={{ fontSize:12, color:C.textSub, fontWeight:400, letterSpacing:1, marginLeft:10 }}>
                  WORLD FRESHWATER SPEARFISHING CHAMPIONSHIPS
                </span>
              </div>
              <div className="hide-mobile" style={{ color:C.textSub, fontSize:12, marginTop:2 }}>Lake Taupō, New Zealand · 13–14 March 2026</div>
            </div>
            <div style={{ flexShrink: 0 }}>
              {isAdmin===true
                ? <button style={S.bsm('#7f1d1d')} onClick={()=>{setIsAdmin(false);setTab('dashboard')}}>🔓 SIGN OUT</button>
                : <button style={S.bsm(C.border)} onClick={()=>setIsAdmin('pending')}>🔐 ADMIN</button>
              }
            </div>
          </div>
        </header>
        <nav style={S.nav}>
          {tabs.map(t=><button key={t.id} style={S.nb(tab===t.id)} onClick={()=>setTab(t.id)}>{t.label.toUpperCase()}</button>)}
        </nav>
        <main style={S.main}>
          {pL||wL
            ? <div style={{ textAlign:'center', color:C.textSub, padding:80, fontFamily:"'Barlow Condensed'", fontSize:24 }}>LOADING...</div>
            : <>
                {tab==='dashboard'   && <Dashboard    pairs={pairs} weighins={weighins} photos={photos}/>}
                {tab==='leaderboard' && <LeaderboardView pairs={pairs} weighins={weighins} photos={photos} setLightbox={setLightbox}/>}
                {tab==='checkin'     && <CheckInView   pairs={pairs} refetchPairs={refetchPairs}/>}
                {tab==='weighin'     && <WeighInView   pairs={pairs} weighins={weighins} refetchWeighins={refetchWeighins} photos={photos} refetchPhotos={refetchPhotos} editing={weighinEditing} setEditing={setWeighinEditing} weighinDay={weighinDay} setWeighinDay={setWeighinDay}/>}
                {tab==='teams'       && <TeamsView     pairs={pairs} refetchPairs={refetchPairs} teamEditing={teamEditing} setTeamEditing={setTeamEditing} teamAdding={teamAdding} setTeamAdding={setTeamAdding}/>}

                {tab==='awards'      && <AwardsView    pairs={pairs} weighins={weighins} resultsFinalized={settings.results_finalized === 'true'} isAdmin={isAdmin}/>}
                {tab==='info'        && <InfoView/>}
                {tab==='protests'    && <ProtestsView  protests={protests} refetchProtests={refetchProtests}/>}
                {tab==='settings'    && <SettingsView  settings={settings} refetchSettings={refetchSettings}/>}
                {tab==='merch'       && <MerchView/>}
                {tab==='analytics'   && <AnalyticsView/>}
                {tab==='socials'     && <SocialsView   pairs={pairs} photos={photos}/>}
              </>
          }
          {/* Modal rendered at App level — survives any child re-renders */}
          {weighinEditing && (() => {
            const getW = (pairId, d) => weighins.find(w=>w.pair_id===pairId&&w.day===d)
            const handleSave = async data => {
              const existing = getW(weighinEditing.id, weighinDay)
              const payload = { pair_id:weighinEditing.id, day:weighinDay, ...data }
              if (existing) await supabase.from('weighins').update(payload).eq('id',existing.id)
              else await supabase.from('weighins').insert(payload)
              await refetchWeighins()
              setWeighinEditing(null)
            }
            return <WeighInModal pair={weighinEditing} day={weighinDay} existing={getW(weighinEditing.id,weighinDay)} onSave={handleSave} onClose={()=>setWeighinEditing(null)} photos={photos} refetchPhotos={refetchPhotos}/>
          })()}
          {lightbox && <Lightbox photos={lightbox} onClose={()=>setLightbox(null)}/>}
          {teamAdding && <PairModal title="ADD NEW PAIR" initial={{ division:'Mens', country:'New Zealand', country2:null, diver1:'', diver2:'', confirmed:false, combined_nations:false, team_photo_url:null }} onSave={async form => { if(!form.diver1) return; setTeamSaving(true); await supabase.from('pairs').insert({ division:form.division,country:form.country,country2:form.country2||null,diver1:form.diver1,diver2:form.diver2,confirmed:form.confirmed,combined_nations:form.combined_nations||false,team_photo_url:form.team_photo_url }); await refetchPairs(); setTeamSaving(false); setTeamAdding(false) }} onClose={()=>setTeamAdding(false)} saving={teamSaving}/>}
          {teamEditing && <PairModal title="EDIT PAIR" initial={teamEditing} onSave={async form => { setTeamSaving(true); await supabase.from('pairs').update({ division:form.division,country:form.country,country2:form.country2||null,diver1:form.diver1,diver2:form.diver2,confirmed:form.confirmed,combined_nations:form.combined_nations||false,team_photo_url:form.team_photo_url }).eq('id',teamEditing.id); await refetchPairs(); setTeamSaving(false); setTeamEditing(null) }} onClose={()=>setTeamEditing(null)} saving={teamSaving}/>}
        </main>
        <SponsorBar/>
      </div>
    </>
  )
}
