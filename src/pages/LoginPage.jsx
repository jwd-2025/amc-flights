import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { loginWithPhone, register } = useAuth()
  const navigate = useNavigate()
  const [phone, setPhone] = useState('')
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const p = await loginWithPhone(phone)
      if (!p) {
        setMode('register')
        setLoading(false)
        return
      }
      redirectByRole(p.role)
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e) {
    e.preventDefault()
    setError('')
    if (!form.name.trim()) { setError('Name is required'); return }
    setLoading(true)
    try {
      const p = await register({ phone, name: form.name, email: form.email })
      redirectByRole(p.role)
    } catch (err) {
      setError(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  function redirectByRole(role) {
    if (role === 'admin') navigate('/admin')
    else if (role === 'driver') navigate('/driver')
    else navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-700 to-blue-900 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">✈️</div>
          <h1 className="text-3xl font-bold text-white">AMC Flights</h1>
          <p className="text-blue-200 mt-1">Event Flight Tracker</p>
        </div>

        <div className="card">
          {mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">Welcome</h2>
                <p className="text-sm text-slate-500">Enter your phone number to continue</p>
              </div>
              <div>
                <label className="label">Phone Number</label>
                <input
                  className="input"
                  type="tel"
                  placeholder="(555) 000-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 mb-1">New Here?</h2>
                <p className="text-sm text-slate-500">
                  We don't have <span className="font-medium">{phone}</span> on file yet. Let's get you set up.
                </p>
              </div>
              <div>
                <label className="label">Full Name *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Email Address (optional)</label>
                <input
                  className="input"
                  type="email"
                  placeholder="jane@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? 'Registering…' : 'Create My Profile'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setMode('login'); setError('') }}
              >
                Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
