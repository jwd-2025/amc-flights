import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import dayjs from 'dayjs'

export default function AdminPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [guests, setGuests] = useState([])
  const [drivers, setDrivers] = useState([])
  const [transfers, setTransfers] = useState([])
  const [tab, setTab] = useState('guests') // 'guests' | 'transfers' | 'drivers'
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [gRes, dRes, tRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, flights(*), accommodations(*)')
        .eq('role', 'guest')
        .order('name'),
      supabase.from('profiles').select('*').in('role', ['driver', 'admin']).order('name'),
      supabase
        .from('transfers')
        .select('*, profile:profiles!transfers_profile_id_fkey(name, phone), flight:flights(flight_number, direction, scheduled_time), driver:profiles!transfers_driver_id_fkey(name, phone)')
        .order('scheduled_time'),
    ])
    setGuests(gRes.data || [])
    setDrivers(dRes.data || [])
    setTransfers(tRes.data || [])
    setLoading(false)
  }

  const filtered = guests.filter(g =>
    !search || g.name?.toLowerCase().includes(search.toLowerCase()) || g.phone?.includes(search)
  )

  if (loading) return <Layout title="Admin"><div className="flex justify-center py-12 text-slate-400">Loading…</div></Layout>

  return (
    <Layout title="Admin Dashboard">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {[['guests', '👥', 'Guests'], ['transfers', '🚗', 'Transfers'], ['drivers', '🚘', 'Drivers']].map(([key, icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
              ${tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === 'guests' && (
        <div className="space-y-3">
          <input
            className="input"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{filtered.length} guests</p>
            <button
              onClick={() => navigate('/admin/guest/new')}
              className="text-sm text-blue-600 font-medium"
            >
              + Add Guest
            </button>
          </div>
          {filtered.map(g => <GuestRow key={g.id} guest={g} onClick={() => navigate(`/admin/guest/${g.id}`)} />)}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{transfers.length} transfers</p>
            <button onClick={() => navigate('/admin/transfer/new')} className="text-sm text-blue-600 font-medium">
              + Add Transfer
            </button>
          </div>
          {transfers.map(t => <TransferAdminRow key={t.id} transfer={t} drivers={drivers} onUpdate={loadAll} />)}
        </div>
      )}

      {tab === 'drivers' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">{drivers.length} drivers</p>
            <button onClick={() => navigate('/admin/driver/new')} className="text-sm text-blue-600 font-medium">
              + Add Driver
            </button>
          </div>
          {drivers.map(d => (
            <div key={d.id} className="card flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg font-bold text-green-700">
                {(d.name || '?')[0]}
              </div>
              <div className="flex-1">
                <p className="font-medium">{d.name}</p>
                <p className="text-sm text-slate-500">{d.phone}</p>
              </div>
              <button
                onClick={() => navigate(`/admin/profile/${d.id}`)}
                className="text-sm text-blue-600"
              >
                Edit
              </button>
            </div>
          ))}
          {drivers.length === 0 && (
            <p className="text-center text-slate-400 py-6">No drivers yet. Add one above.</p>
          )}
        </div>
      )}
    </Layout>
  )
}

function GuestRow({ guest, onClick }) {
  const arrivals = (guest.flights || []).filter(f => f.direction === 'arrival')
  const departures = (guest.flights || []).filter(f => f.direction === 'departure')
  const accom = guest.accommodations?.[0]

  return (
    <button onClick={onClick} className="card w-full text-left space-y-2 hover:bg-slate-50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-lg font-bold text-blue-700">
          {(guest.name || '?')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 truncate">{guest.name || 'Unnamed'}</p>
          <p className="text-xs text-slate-500">{guest.phone} {guest.email ? `· ${guest.email}` : ''}</p>
        </div>
        <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      <div className="flex gap-3 text-xs text-slate-500 flex-wrap">
        {arrivals.length > 0 && (
          <span>🛬 {arrivals.map(f => f.flight_number).join(', ')}</span>
        )}
        {departures.length > 0 && (
          <span>🛫 {departures.map(f => f.flight_number).join(', ')}</span>
        )}
        {accom && (
          <span>{accom.type === 'hotel' ? '🏨' : '🏠'} {accom.name}</span>
        )}
        {!arrivals.length && !departures.length && !accom && (
          <span className="text-slate-300">No info yet</span>
        )}
      </div>
    </button>
  )
}

function TransferAdminRow({ transfer, drivers, onUpdate }) {
  const [driverId, setDriverId] = useState(transfer.driver_id || '')
  const [saving, setSaving] = useState(false)

  async function assignDriver(e) {
    const val = e.target.value
    setDriverId(val)
    setSaving(true)
    await supabase.from('transfers').update({ driver_id: val || null, status: val ? 'assigned' : 'pending' }).eq('id', transfer.id)
    setSaving(false)
    onUpdate()
  }

  const statusColor = {
    pending: 'bg-slate-100 text-slate-600',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  }[transfer.status] || 'bg-slate-100 text-slate-600'

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-800">{transfer.profile?.name}</p>
          <p className="text-xs text-slate-500">{transfer.profile?.phone}</p>
        </div>
        <span className={`badge ${statusColor} capitalize shrink-0`}>{transfer.status}</span>
      </div>

      <div className="text-sm space-y-1">
        <div className="flex gap-2">
          <span className="text-slate-400 w-16 shrink-0">{transfer.transfer_type === 'pickup' ? 'From' : 'To'}:</span>
          <span className="text-slate-700">{transfer.pickup_location || '—'}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-slate-400 w-16 shrink-0">{transfer.transfer_type === 'pickup' ? 'To' : 'From'}:</span>
          <span className="text-slate-700">{transfer.dropoff_location || '—'}</span>
        </div>
        {transfer.flight && (
          <div className="flex gap-2">
            <span className="text-slate-400 w-16 shrink-0">Flight:</span>
            <span className="text-slate-700">
              {transfer.flight.direction === 'arrival' ? '🛬' : '🛫'} {transfer.flight.flight_number}
              {transfer.flight.scheduled_time && ` · ${dayjs(transfer.flight.scheduled_time).format('MMM D h:mm A')}`}
            </span>
          </div>
        )}
      </div>

      <div>
        <label className="label">Assigned Driver</label>
        <select className="input text-sm" value={driverId} onChange={assignDriver} disabled={saving}>
          <option value="">— Unassigned —</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
          ))}
        </select>
      </div>
    </div>
  )
}
