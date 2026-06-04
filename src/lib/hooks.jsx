import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

export function useTable(table, query = {}) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    setLoading(true)
    let q = supabase.from(table).select('*').order('created_at', { ascending: false })
    if (query.eq) Object.entries(query.eq).forEach(([k, v]) => { q = q.eq(k, v) })
    if (query.limit) q = q.limit(query.limit)
    const { data: rows, error: err } = await q
    setData(rows || [])
    setError(err)
    setLoading(false)
  }, [table])

  useEffect(() => { fetch() }, [fetch])
  return { data, loading, error, refetch: fetch, setData }
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }
  const Toast = toast ? (
    <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>{toast.msg}</div>
  ) : null
  return { show, Toast }
}
