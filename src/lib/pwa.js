import { useEffect, useState } from 'react'

// Tracks the beforeinstallprompt event and install state so we can show
// a reliable in-app "Install" button (the native mini-infobar is often
// suppressed by browsers until engagement heuristics are met).
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' &&
    window.matchMedia?.('(display-mode: standalone)').matches
  )

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault()
      setDeferred(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const isIos = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent)

  async function promptInstall() {
    if (!deferred) return false
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setDeferred(null)
    return outcome === 'accepted'
  }

  return { canInstall: !!deferred, installed, isIos, promptInstall }
}
