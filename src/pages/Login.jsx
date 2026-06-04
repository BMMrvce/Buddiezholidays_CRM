import { useState } from 'react'
import { supabase, AGENCY_NAME } from '../lib/supabase'
import logo from '../assets/logo.png'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signin')   // signin | reset
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState(null)          // { type, text }

  async function signIn(e) {
    e.preventDefault()
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (error) setMsg({ type: 'error', text: error.message })
    // on success the auth listener swaps the screen automatically
  }

  async function sendReset(e) {
    e.preventDefault()
    if (!email.trim()) { setMsg({ type: 'error', text: 'Enter your email first' }); return }
    setLoading(true); setMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    })
    setLoading(false)
    if (error) setMsg({ type: 'error', text: error.message })
    else setMsg({ type: 'ok', text: 'Password reset link sent to your email.' })
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-brand">
          <img src={logo} alt={AGENCY_NAME} className="auth-logo-img" />
          <div>
            <div className="auth-title">{AGENCY_NAME}</div>
            <div className="auth-sub">CRM · Staff sign in</div>
          </div>
        </div>

        <form onSubmit={mode === 'signin' ? signIn : sendReset}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@buddiezholidays.com" required />
          </div>

          {mode === 'signin' && (
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Password</label>
              <input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
          )}

          {msg && (
            <div className={`auth-msg ${msg.type === 'error' ? 'err' : 'ok'}`}>{msg.text}</div>
          )}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', minHeight: 44, marginTop: 4 }}>
            {loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>
        </form>

        <div className="auth-foot">
          {mode === 'signin'
            ? <button className="auth-link" onClick={() => { setMode('reset'); setMsg(null) }}>Forgot password?</button>
            : <button className="auth-link" onClick={() => { setMode('signin'); setMsg(null) }}>← Back to sign in</button>}
        </div>

        <div className="auth-note">
          Access is restricted to {AGENCY_NAME} staff. Accounts are created by your administrator in Supabase → Authentication.
        </div>
      </div>

      <div className="auth-powered">
        Powered by <a href="https://tantravruksha.in" target="_blank" rel="noreferrer">tantravruksha.in</a>
      </div>
    </div>
  )
}
