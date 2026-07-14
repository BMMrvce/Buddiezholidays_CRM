import { useState } from 'react'
import { useAuth } from '../lib/auth.jsx'
import { AGENCY_NAME } from '../lib/supabase'
import logo from '../assets/logo.png'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const result = signIn(email.trim(), password)
    setLoading(false)
    if (result.error) setError(result.error.message)
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

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@buddiezholidays.com" required />
          </div>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          {error && <div className="auth-msg err">{error}</div>}

          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center', minHeight: 44, marginTop: 4 }}>
            {loading ? 'Please wait…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-note" style={{ marginTop: 16 }}>
          Access is restricted to {AGENCY_NAME} staff.
        </div>
      </div>
    </div>
  )
}
