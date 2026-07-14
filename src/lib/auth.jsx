import { createContext, useContext, useState } from 'react'

const ADMIN_EMAIL    = 'admin@buddiezholidays.com'
const ADMIN_PASSWORD = '123456'

const AuthContext = createContext({ user: null, loading: false, signOut: () => {} })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('crm_user')) } catch { return null }
  })

  function signIn(email, password) {
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      const u = { email: ADMIN_EMAIL, display_name: 'Admin' }
      sessionStorage.setItem('crm_user', JSON.stringify(u))
      setUser(u)
      return { error: null }
    }
    return { error: { message: 'Invalid email or password' } }
  }

  function signOut() {
    sessionStorage.removeItem('crm_user')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading: false, displayName: 'Admin', signOut, signIn }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
