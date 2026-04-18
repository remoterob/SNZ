// useAnalytics — lightweight page view tracking
// Fires on every route change, captures device/browser info
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from './supabase'

// Parse user agent into useful fields
function parseUA() {
  const ua = navigator.userAgent
  // Device type
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua)
  const tablet = /iPad|Android(?!.*Mobile)/i.test(ua)
  const deviceType = tablet ? 'tablet' : mobile ? 'mobile' : 'desktop'

  // Browser
  let browser = 'Unknown'
  if (/Edg\//i.test(ua)) browser = 'Edge'
  else if (/OPR\//i.test(ua)) browser = 'Opera'
  else if (/Chrome\//i.test(ua)) browser = 'Chrome'
  else if (/Firefox\//i.test(ua)) browser = 'Firefox'
  else if (/Safari\//i.test(ua)) browser = 'Safari'

  // OS
  let os = 'Unknown'
  if (/Windows NT/i.test(ua)) os = 'Windows'
  else if (/Mac OS X/i.test(ua) && !/iPhone|iPad/i.test(ua)) os = 'macOS'
  else if (/iPhone/i.test(ua)) os = 'iOS'
  else if (/iPad/i.test(ua)) os = 'iPadOS'
  else if (/Android/i.test(ua)) os = 'Android'
  else if (/Linux/i.test(ua)) os = 'Linux'

  return { deviceType, browser, os }
}

// Get or create a session ID (persists for browser session)
function getSessionId() {
  let id = sessionStorage.getItem('snz_analytics_session')
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem('snz_analytics_session', id)
  }
  return id
}

// Skip tracking for admin/internal paths
const SKIP_PATHS = ['/admin', '/admin/login', '/membership/admin']

export function useAnalytics(memberId) {
  const location = useLocation()
  const entryTimeRef = useRef(Date.now())
  const lastViewIdRef = useRef(null)

  useEffect(() => {
    const path = location.pathname
    if (SKIP_PATHS.some(p => path.startsWith(p))) return

    const { deviceType, browser, os } = parseUA()
    const sessionId = getSessionId()
    const now = Date.now()

    // Update duration on previous page view
    if (lastViewIdRef.current) {
      const duration = now - entryTimeRef.current
      supabase.from('page_views')
        .update({ duration_ms: duration })
        .eq('id', lastViewIdRef.current)
        .then(() => {})
    }

    entryTimeRef.current = now

    // Insert new page view
    supabase.from('page_views').insert({
      path,
      referrer: document.referrer || null,
      member_id: memberId || null,
      session_id: sessionId,
      device_type: deviceType,
      browser,
      os,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    }).select('id').single().then(({ data }) => {
      if (data) lastViewIdRef.current = data.id
    })
  }, [location.pathname, memberId])
}
