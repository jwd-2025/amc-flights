import React, { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { lookupFlight, normalizeFlightData, flightApiAvailable } from '../lib/flightApi'
import Layout from '../components/Layout'
import dayjs from 'dayjs'

const BLANK = {
  direction: 'arrival',
  flight_number: '',
  airline: '',
  origin_code: '',
  origin_name: '',
  destination_code: '',
  destination_name: '',
  scheduled_time: '',
  actual_time: '',
  status: 'scheduled',
  terminal: '',
  gate: '',
  baggage_claim: '',
  notes: '',
}

export default function FlightFormPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isEdit = Boolean(id)

  const [form, setForm] = useState({ ...BLANK, direction: searchParams.get('dir') || 'arrival' })
  const [loading, setLoading] = useState(false)
  const [lookingUp, setLookingUp] = useState(false)
  const [error, setError] = useState('')
  const [originalFlight, setOriginalFlight] = useState(null)

  useEffect(() => {
    if (isEdit) loadFlight()
  }, [id])

  async function loadFlight() {
    const { data } = await supabase.from('flights').select('*').eq('id', id).single()
    if (data) {
      setOriginalFlight(data)
      setForm({
        direction: data.direction,
        flight_number: data.flight_number || '',
        airline: data.airline || '',
        origin_code: data.origin_code || '',
        origin_name: data.origin_name || '',
        destination_code: data.destination_code || '',
        destination_name: data.destination_name || '',
        scheduled_time: data.scheduled_time ? dayjs(data.scheduled_time).format('YYYY-MM-DDTHH:mm') : '',
        actual_time: data.actual_time ? dayjs(data.actual_time).format('YYYY-MM-DDTHH:mm') : '',
        status: data.status || 'scheduled',
        terminal: data.terminal || '',
        gate: data.gate || '',
        baggage_claim: data.baggage_claim || '',
        notes: data.notes || '',
      })
    }
  }

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleLookup() {
    if (!form.flight_number.trim()) return
    setLookingUp(true)
    setError('')
    try {
      const raw = await lookupFlight(form.flight_number)
      if (!raw) {
        setError('Flight not found. You can still enter details manually.')
        setLookingUp(false)
        return
      }
      const n = normalizeFlightData(raw)
      setForm(f => ({
        ...f,
        airline: n.airline || f.airline,
        origin_code: n.origin_code || f.origin_code,
        origin_name: n.origin_name || f.origin_name,
        destination_code: n.destination_code || f.destination_code,
        destination_name: n.destination_name || f.destination_name,
        scheduled_time: (f.direction === 'arrival' ? n.scheduled_arrival : n.scheduled_departure)
          ? dayjs(f.direction === 'arrival' ? n.scheduled_arrival : n.scheduled_departure).format('YYYY-MM-DDTHH:mm')
          : f.scheduled_time,
        status: n.status || f.status,
        terminal: (f.direction === 'arrival' ? n.terminal_arrival : n.terminal_departure) || f.terminal,
        gate: (f.direction === 'arrival' ? n.gate_arrival : n.gate_departure) || f.gate,
        baggage_claim: n.baggage_claim || f.baggage_claim,
      }))
    } catch {
      setError('Lookup failed. Enter details manually.')
    } finally {
      setLookingUp(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.flight_number.trim()) { setError('Flight number is required'); return }
    setLoading(true)

    const payload = {
      profile_id: profile.id,
      direction: form.direction,
      flight_number: form.flight_number.toUpperCase().trim(),
      airline: form.airline,
      origin_code: form.origin_code.toUpperCase(),
      origin_name: form.origin_name,
      destination_code: form.destination_code.toUpperCase(),
      destination_name: form.destination_name,
      scheduled_time: form.scheduled_time || null,
      actual_time: form.actual_time || null,
      status: form.status,
      terminal: form.terminal,
      gate: form.gate,
      baggage_claim: form.baggage_claim,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    }

    try {
      if (isEdit) {
        // Build change history
        const changes = buildChanges(originalFlight, payload)
        const { error: uErr } = await supabase.from('flights').update(payload).eq('id', id)
        if (uErr) throw uErr
        if (Object.keys(changes).length > 0) {
          await supabase.from('flight_history').insert({
            flight_id: id,
            changed_by: profile.id,
            changes,
          })
        }
      } else {
        const { error: iErr } = await supabase.from('flights').insert(payload)
        if (iErr) throw iErr
      }
      navigate('/dashboard')
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Layout title={isEdit ? 'Edit Flight' : 'Add Flight'} showBack backTo="/dashboard">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Direction */}
        <div>
          <label className="label">Flight Direction</label>
          <div className="grid grid-cols-2 gap-2">
            {['arrival', 'departure'].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => set('direction', d)}
                className={`py-3 rounded-xl border font-medium capitalize transition-colors text-sm
                  ${form.direction === d
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'}`}
              >
                {d === 'arrival' ? '🛬' : '🛫'} {d}
              </button>
            ))}
          </div>
        </div>

        {/* Flight number + lookup */}
        <div>
          <label className="label">Flight Number *</label>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="AA1234"
              value={form.flight_number}
              onChange={e => set('flight_number', e.target.value)}
              required
            />
            {flightApiAvailable && (
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookingUp || !form.flight_number.trim()}
                className="px-4 py-3 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm
                           hover:bg-blue-100 disabled:opacity-50 whitespace-nowrap"
              >
                {lookingUp ? '…' : 'Look up'}
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="label">Airline</label>
          <input className="input" placeholder="American Airlines" value={form.airline} onChange={e => set('airline', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">From (IATA)</label>
            <input className="input" placeholder="ORD" maxLength={3} value={form.origin_code} onChange={e => set('origin_code', e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className="label">To (IATA)</label>
            <input className="input" placeholder="DFW" maxLength={3} value={form.destination_code} onChange={e => set('destination_code', e.target.value.toUpperCase())} />
          </div>
        </div>

        <div>
          <label className="label">Scheduled {form.direction === 'arrival' ? 'Arrival' : 'Departure'}</label>
          <input className="input" type="datetime-local" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Terminal</label>
            <input className="input" placeholder="A" value={form.terminal} onChange={e => set('terminal', e.target.value)} />
          </div>
          <div>
            <label className="label">Gate</label>
            <input className="input" placeholder="A12" value={form.gate} onChange={e => set('gate', e.target.value)} />
          </div>
        </div>

        {form.direction === 'arrival' && (
          <div>
            <label className="label">Baggage Claim</label>
            <input className="input" placeholder="Carousel 3" value={form.baggage_claim} onChange={e => set('baggage_claim', e.target.value)} />
          </div>
        )}

        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="scheduled">Scheduled</option>
            <option value="in_air">In Air</option>
            <option value="landed">Landed</option>
            <option value="delayed">Delayed</option>
            <option value="cancelled">Cancelled</option>
            <option value="diverted">Diverted</option>
          </select>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Any extra info for this flight…"
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}

        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Flight'}
        </button>
      </form>
    </Layout>
  )
}

function buildChanges(original, updated) {
  const trackFields = ['flight_number', 'airline', 'scheduled_time', 'actual_time', 'status', 'terminal', 'gate', 'baggage_claim', 'notes']
  const changes = {}
  for (const field of trackFields) {
    const oldVal = original?.[field] ?? null
    const newVal = updated[field] ?? null
    if (String(oldVal) !== String(newVal)) {
      changes[field] = { old_value: oldVal, new_value: newVal }
    }
  }
  return changes
}
