// PWA Install Prompt
// - Android/Chrome: shows native "Add to Home Screen" prompt
// - iOS/Safari: shows manual instructions banner
import { useState, useEffect } from 'react'

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (window.navigator.standalone) return // iOS already installed

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    if (ios) {
      // Show iOS instructions after a short delay
      const dismissed = localStorage.getItem('snz_pwa_dismissed')
      if (!dismissed) setTimeout(() => setShow(true), 3000)
    } else {
      // Android — listen for browser install prompt
      window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault()
        setDeferredPrompt(e)
        const dismissed = localStorage.getItem('snz_pwa_dismissed')
        if (!dismissed) setTimeout(() => setShow(true), 3000)
      })
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShow(false)
      setDeferredPrompt(null)
    }
  }

  const dismiss = () => {
    setShow(false)
    localStorage.setItem('snz_pwa_dismissed', '1')
  }

  if (!show) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6">
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-3">
            <img src="/icons/icon-192.png" alt="SNZ" className="w-10 h-10 rounded-xl" />
            <div>
              <p className="font-black text-gray-900 text-sm">Add SNZ Hub to Home Screen</p>
              <p className="text-xs text-gray-400">Quick access to membership & competitions</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {isIOS ? (
          <div className="px-4 pb-4">
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-800 space-y-1.5">
              <p>1. Tap the <strong>Share</strong> button <span className="text-base">⎋</span> at the bottom of Safari</p>
              <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              <p>3. Tap <strong>"Add"</strong> — SNZ Hub will appear on your home screen</p>
            </div>
            <button onClick={dismiss}
              className="w-full mt-3 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: '#2B6CB0' }}>
              Got it
            </button>
          </div>
        ) : (
          <div className="px-4 pb-4 flex gap-2">
            <button onClick={dismiss}
              className="flex-1 py-2 rounded-xl text-sm font-bold border border-gray-300 text-gray-600">
              Not now
            </button>
            <button onClick={handleInstall}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: '#2B6CB0' }}>
              Install App
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
