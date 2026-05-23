import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('amc_profile')
    if (stored) {
      try { setProfile(JSON.parse(stored)) } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  async function loginWithPhone(phone) {
    const normalized = normalizePhone(phone)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', normalized)
      .maybeSingle()

    if (error) throw error
    if (!data) return null // phone not found

    localStorage.setItem('amc_profile', JSON.stringify(data))
    setProfile(data)
    return data
  }

  async function register({ phone, name, email }) {
    const normalized = normalizePhone(phone)
    const { data, error } = await supabase
      .from('profiles')
      .insert({ phone: normalized, name, email, role: 'guest' })
      .select()
      .single()

    if (error) throw error
    localStorage.setItem('amc_profile', JSON.stringify(data))
    setProfile(data)
    return data
  }

  async function refreshProfile() {
    if (!profile) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.id)
      .single()
    if (data) {
      localStorage.setItem('amc_profile', JSON.stringify(data))
      setProfile(data)
    }
  }

  function logout() {
    localStorage.removeItem('amc_profile')
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ profile, loading, loginWithPhone, register, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return `+${digits}`
}
