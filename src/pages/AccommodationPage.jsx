import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'

const BLANK = {
  type: 'hotel',
  name: '',
  address: '',
  notes: '',
  check_in: '',
  check_out: '',
  contact_info: '',
}

export default function AccommodationPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(BLANK)
  const [existing, setExisting] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (profile) load()
  }, [profile])

  async function load() {
    const { data } = await supabase
      .from('accommodations')
      .select('*')
      .eq('profile_id', profile.id)
      .maybeSingle()
    if (data) {
      setExisting(data)
      setForm({
        type: data.type || 'hotel',
        name: data.name || '',
        address: data.address || '',
        notes: data.notes || '',
        check_in: data.check_in || '',
        check_out: data.check_out || '',
        contact_info: data.contact_info || '',
      })
    }
  }

  function set(field, val) { setForm(f => ({ ...f, [field]: val })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const payload = { ...form, profile_id: profile.id, updated_at: new Date().toISOString() }
    try {
      if (existing) {
        const { error: uErr } = await supabase.from('accommodations').update(payload).eq('id', existing.id)
        if (uErr) throw uErr
      } else {
        const { error: iErr } = await supabase.from('accommodations').insert(payload)
        if (iErr) throw iErr
      }
      setSaved(true)
      setTimeout(() => navigate('/dashboard'), 1000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title="My Accommodation" showBack backTo="/dashboard">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type selector */}
        <div>
          <label className="label">Staying At</label>
          <div className="grid grid-cols-2 gap-2">
            {[['hotel', '🏨', 'Hotel'], ['local_housing', '🏠', 'Local Housing']].map(([val, icon, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => set('type', val)}
                className={`py-3 rounded-xl border font-medium text-sm transition-colors
                  ${form.type === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">{form.type === 'hotel' ? 'Hotel Name' : 'Host / Address Name'}</label>
          <input
            className="input"
            placeholder={form.type === 'hotel' ? 'Marriott DFW' : 'Smith Residence'}
            value={form.name}
            onChange={e => set('name', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Address</label>
          <input
            className="input"
            placeholder="123 Main St, Irving TX"
            value={form.address}
            onChange={e => set('address', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Check-in</label>
            <input className="input" type="date" value={form.check_in} onChange={e => set('check_in', e.target.value)} />
          </div>
          <div>
            <label className="label">Check-out</label>
            <input className="input" type="date" value={form.check_out} onChange={e => set('check_out', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Contact / Confirmation #</label>
          <input
            className="input"
            placeholder="Booking ref or host phone"
            value={form.contact_info}
            onChange={e => set('contact_info', e.target.value)}
          />
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Room number, access codes, parking, etc."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        {saved && <p className="text-sm text-green-600 bg-green-50 rounded-lg p-3">Saved! Redirecting…</p>}

        <button className="btn-primary" type="submit" disabled={loading || saved}>
          {loading ? 'Saving…' : existing ? 'Update Accommodation' : 'Save Accommodation'}
        </button>
      </form>
    </Layout>
  )
}
