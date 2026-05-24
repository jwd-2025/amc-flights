import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import dayjs from 'dayjs'

export default function DriverPage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('upcoming') // 'upcoming' | 'completed'

  useEffect(() => { if (profile) load() }, [profile])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('transfers')
      .select(`
        *,
        profile:profiles!transfers_profile_id_fkey(name, phone, email, accommodations(type, name, address, notes)),
        flight:flights(flight_number, direction, scheduled_time, actual_time, status, terminal, gate, origin_code, destination_code, airline)
      `)
      .eq('driver_id', profile.id)
      .order('scheduled_time', { ascending: true })
    setAssignments(data || [])
    setLoading(false)
  }

  async function markComplete(id) {
    await supabase.from('transfers').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', id)
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'completed', completed_at: new Date().toISOString() } : a))
  }

  async function markInProgress(id) {
    await supabase.from('transfers').update({ status: 'in_progress' }).eq('id', id)
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, status: 'in_progress' } : a))
  }

  const upcoming = assignments.filter(a => a.status !== 'completed')
  const completed = assignments.filter(a => a.status === 'completed')
  const shown = filter === 'upcoming' ? upcoming : completed

  if (loading) return (
    <Layout title="My Assignments">
      <div className="py-12 text-center text-slate-400">Loading…</div>
    </Layout>
  )

  return (
    <Layout title="My Assignments">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <TabBtn label={`Upcoming (${upcoming.length})`} active={filter === 'upcoming'} onClick={() => setFilter('upcoming')} />
        <TabBtn label={`Done (${completed.length})`} active={filter === 'completed'} onClick={() => setFilter('completed')} />
      </div>

      {shown.length === 0 && (
        <div className="card text-center py-8 text-slate-400">
          {filter === 'upcoming' ? 'No upcoming assignments' : 'No completed runs yet'}
        </div>
      )}

      {shown.map(a => (
        <AssignmentCard key={a.id} assignment={a} onComplete={() => markComplete(a.id)} onStart={() => markInProgress(a.id)} />
      ))}
    </Layout>
  )
}

function TabBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors
        ${active ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
    >
      {label}
    </button>
  )
}

function AssignmentCard({ assignment: a, onComplete, onStart }) {
  const [expanded, setExpanded] = useState(false)
  const isPickup = a.transfer_type === 'pickup'
  const flight = a.flight
  const guest = a.profile
  const accom = a.profile?.accommodations?.[0] || null

  const statusColor = {
    pending: 'bg-slate-100 text-slate-600',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  }[a.status] || 'bg-slate-100 text-slate-600'

  const flightTime = flight?.actual_time || flight?.scheduled_time
  const isFlightDelayed = flight?.actual_time && flight?.scheduled_time &&
    dayjs(flight.actual_time).isAfter(dayjs(flight.scheduled_time).add(10, 'minute'))

  return (
    <div className="card space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xl">{isPickup ? '🚗↙' : '🚗↗'}</span>
            <span className="font-semibold text-slate-800 capitalize">{a.transfer_type}</span>
          </div>
          {a.scheduled_time && (
            <p className="text-sm text-slate-500">{dayjs(a.scheduled_time).format('ddd MMM D · h:mm A')}</p>
          )}
        </div>
        <span className={`badge ${statusColor} capitalize shrink-0`}>{a.status.replace('_', ' ')}</span>
      </div>

      {/* Guest */}
      <div className="bg-slate-50 rounded-xl p-3 space-y-1">
        <p className="text-xs text-slate-400 uppercase tracking-wide">Passenger</p>
        <p className="font-semibold text-slate-800">{guest?.name}</p>
        <a href={`tel:${guest?.phone}`} className="text-sm text-blue-600 font-medium">{guest?.phone}</a>
        {guest?.email && <p className="text-xs text-slate-500">{guest.email}</p>}
      </div>

      {/* Route */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-slate-400 mb-1">From</p>
          <p className="font-medium text-slate-700">{a.pickup_location || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">To</p>
          <p className="font-medium text-slate-700">{a.dropoff_location || '—'}</p>
        </div>
      </div>

      {/* Flight info */}
      {flight && (
        <div
          className="border border-slate-100 rounded-xl p-3 space-y-1 cursor-pointer"
          onClick={() => setExpanded(e => !e)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{flight.direction === 'arrival' ? '🛬' : '🛫'}</span>
              <span className="font-semibold">{flight.flight_number}</span>
              <span className="text-xs text-slate-500">{flight.airline}</span>
            </div>
            <span className="text-xs text-slate-400">{expanded ? '▲' : '▼'}</span>
          </div>
          {expanded && (
            <div className="pt-2 space-y-1 text-sm">
              <p className="text-slate-600">
                {flight.origin_code} → {flight.destination_code}
              </p>
              {flightTime && (
                <p className={isFlightDelayed ? 'text-orange-600 font-medium' : 'text-slate-600'}>
                  {flight.direction === 'arrival' ? 'Arrives' : 'Departs'}: {dayjs(flightTime).format('h:mm A')}
                  {isFlightDelayed && ' (delayed)'}
                </p>
              )}
              {flight.terminal && <p className="text-slate-600">Terminal {flight.terminal}{flight.gate ? ` · Gate ${flight.gate}` : ''}</p>}
              {flight.status && <p className="text-slate-500 capitalize">Status: {flight.status}</p>}
            </div>
          )}
        </div>
      )}

      {/* Accommodation */}
      {accom && (
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-3">
          <span>{accom.type === 'hotel' ? '🏨' : '🏠'} </span>
          <span className="font-medium">{accom.name}</span>
          {accom.address && <span className="text-slate-400"> · {accom.address}</span>}
        </div>
      )}

      {a.notes && (
        <p className="text-sm text-slate-500 bg-amber-50 rounded-lg px-3 py-2">📝 {a.notes}</p>
      )}

      {/* Actions */}
      {a.status !== 'completed' && (
        <div className="flex gap-2 pt-1">
          {a.status === 'assigned' && (
            <button onClick={onStart} className="flex-1 py-2.5 bg-amber-500 text-white font-semibold rounded-xl text-sm hover:bg-amber-600">
              Start Run
            </button>
          )}
          {(a.status === 'in_progress' || a.status === 'assigned') && (
            <button onClick={onComplete} className="flex-1 py-2.5 bg-green-600 text-white font-semibold rounded-xl text-sm hover:bg-green-700">
              ✓ Mark Complete
            </button>
          )}
        </div>
      )}
      {a.status === 'completed' && a.completed_at && (
        <p className="text-xs text-green-600 text-center">Completed {dayjs(a.completed_at).format('MMM D h:mm A')}</p>
      )}
    </div>
  )
}
