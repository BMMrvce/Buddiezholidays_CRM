import { useState } from 'react'
import { supabase, AGENCY_NAME } from '../lib/supabase'
import { useAuth } from '../lib/auth.jsx'
import { useToast } from '../lib/hooks.jsx'
import { useInstallPrompt } from '../lib/pwa.js'
import logo from '../assets/logo.png'

export default function Settings() {
  const { user, displayName } = useAuth()
  const { show, Toast } = useToast()
  const { canInstall, installed, isIos, promptInstall } = useInstallPrompt()

  const [name, setName] = useState(displayName || '')
  const [savingName, setSavingName] = useState(false)

  const [pwd, setPwd] = useState('')
  const [pwd2, setPwd2] = useState('')
  const [savingPwd, setSavingPwd] = useState(false)

  async function saveName(e) {
    e.preventDefault()
    if (!name.trim()) { show('Name cannot be empty', 'error'); return }
    setSavingName(true)
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setSavingName(false)
    if (error) show('Error: ' + error.message, 'error')
    else show('Display name updated ✓ — it will refresh on your next greeting')
  }

  async function savePassword(e) {
    e.preventDefault()
    if (pwd.length < 6) { show('Password must be at least 6 characters', 'error'); return }
    if (pwd !== pwd2) { show('Passwords do not match', 'error'); return }
    setSavingPwd(true)
    const { error } = await supabase.auth.updateUser({ password: pwd })
    setSavingPwd(false)
    if (error) show('Error: ' + error.message, 'error')
    else { show('Password changed ✓'); setPwd(''); setPwd2('') }
  }

  return (
    <div className="page">
      {Toast}
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">{AGENCY_NAME} — your account</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }} className="settings-grid">

        {/* Account overview */}
        <div className="card" style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <img src={logo} alt={AGENCY_NAME} style={{ height: 56, width: 'auto' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{displayName || '—'}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)' }}>{user?.email}</div>
          </div>
        </div>

        {/* Display name */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>Display name</div>
          <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>
            This name appears in your dashboard greeting.
          </p>
          <form onSubmit={saveName}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Your name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Manjunath" autoComplete="name" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingName}>{savingName ? 'Saving…' : 'Save name'}</button>
          </form>
        </div>

        {/* Password */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>Change password</div>
          <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>
            Use at least 6 characters. You stay signed in after changing it.
          </p>
          <form onSubmit={savePassword}>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>New password</label>
              <input type="password" value={pwd} onChange={e => setPwd(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Confirm new password</label>
              <input type="password" value={pwd2} onChange={e => setPwd2(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={savingPwd}>{savingPwd ? 'Updating…' : 'Update password'}</button>
          </form>
        </div>

        {/* Install app (PWA) */}
        <div className="card" style={{ gridColumn: '1/-1' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 15 }}>Install app</div>
          <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 14, lineHeight: 1.6 }}>
            Install the CRM on your device for a full-screen, app-like experience that works offline.
          </p>
          {installed ? (
            <div className="pill pill-paid" style={{ fontSize: 13, padding: '6px 14px' }}>✓ Installed — you're using the app</div>
          ) : isIos ? (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              On iPhone/iPad: tap the <strong>Share</strong> button in Safari, then choose <strong>“Add to Home Screen”</strong>.
            </div>
          ) : canInstall ? (
            <button className="btn btn-primary" onClick={async () => { const ok = await promptInstall(); if (!ok) show('Install dismissed') }}>⬇ Install app</button>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
              Your browser will offer an install option shortly. In Chrome/Edge you can also use the <strong>install icon</strong> in the address bar, or the menu → <strong>“Install app”</strong>.
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
