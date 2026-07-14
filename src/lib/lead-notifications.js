import { useEffect, useRef } from 'react'
import { supabase } from './supabase'

const ICON = '/icon-192.png'

async function askPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function showNotification(lead) {
  const title = '🔔 New Lead — Buddiez Holidays'
  const body = [
    lead.full_name,
    lead.phone,
    lead.destination ? `📍 ${lead.destination}` : null,
    lead.source === 'website' ? 'via website form' : `via ${lead.source}`,
  ].filter(Boolean).join(' · ')

  const opts = { body, icon: ICON, badge: ICON, tag: `lead-${lead.id}`, renotify: true, vibrate: [200, 100, 200] }

  // Use service worker if available (works even when screen is off on Android)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, opts))
  } else {
    const n = new Notification(title, opts)
    n.onclick = () => { window.focus(); n.close() }
  }
}

// Call once when user logs in to request permission and start listening
export function useLeadNotifications(enabled) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!enabled) return

    let active = true

    askPermission().then(granted => {
      if (!granted || !active) return

      const channel = supabase
        .channel('crm-lead-alerts')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'leads' },
          (payload) => {
            if (active) showNotification(payload.new)
          }
        )
        .subscribe()

      channelRef.current = channel
    })

    return () => {
      active = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [enabled])
}
