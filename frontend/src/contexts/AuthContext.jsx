import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'
import { applyAccentColor } from '../data/accentColors'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const stored = localStorage.getItem('user')

    if (token && stored) {
      const storedUser = JSON.parse(stored)
      setUser(storedUser)
      applyAccentColor(storedUser?.accent_color || 'blue')

      // Refresh user data from backend (picks up admin changes, etc.)
      api.get('/auth/me').then(({ data }) => {
        localStorage.setItem('user', JSON.stringify(data))
        setUser(data)
        applyAccentColor(data.accent_color || 'blue')
      }).catch(() => {
        // Token expired or invalid
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      }).finally(() => setLoading(false))
    } else {
      applyAccentColor(localStorage.getItem('accent_color') || 'blue')
      setLoading(false)
    }
  }, [])

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    applyAccentColor(data.user.accent_color || 'blue')
    return data.user
  }

  const register = async (userData) => {
    const { data } = await api.post('/auth/register', userData)
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    setUser(data.user)
    applyAccentColor(data.user.accent_color || 'blue')
    return data.user
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  const updateUser = async (updates) => {
    const { data } = await api.put('/users/me', updates)
    localStorage.setItem('user', JSON.stringify(data))
    setUser(data)
    return data
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export { applyAccentColor }
