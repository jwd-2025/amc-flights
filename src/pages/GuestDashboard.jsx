import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import FlightCard from '../components/FlightCard'
import NotificationBanner from '../components/NotificationBanner'

export default function GuestDashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [flights, setFlights] = useState([])
  const [accommodation, setAccommodation] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (profile) loadAll()
  }, [profile])

  async function loadAll() {
    setLoading(true)
    const [fRes, aRes, tRes] = await Promise.all([
      supabase.from('flights').select('*').eq('profile_id', profile.id).order('scheduled_time'),
      supabase.from('accommodations').select('*').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('transfers')
        .select('*, driver:profiles!transfers_driver_id_fkey(name, phone), flight:flights(flight_number, direction)')
        .eq('profile_id', profile.id)
        .order('scheduled_time'),
    ])
    setFlights(fRes.data || [])
    setAccommodation(aRes.data)
    setTransfers(tRes.data || [])
    setLoading(false)
  }

  async function deleteFlight(id) {
    if (!confirm('Delete this flight?')) return
    await supabase.from('flights').delete().eq('id', id)
    setFlights(prev => prev.filter(f => f.id !== id))
  }

  const arrivals = flights.filter(f => f.direction === 'arrival')
  const departures = flights.filter(f => f.direction === 'departure')

  if (loading) return (
    <Layout title="My Flights">
      <div className="flex justify-center py-12"><div className="text-slate-400">Loading…</div></div>
    </Layout>
  )

  return (
    <Layout title="My Flights">
      <NotificationBanner />

      {/* Welcome */}
      <div className="card bg-blue-600 border-blue-600">
        <p className="text-blue-100 text-sm">Welcome back</p>
        <p className="text-white font-bold text-xl">{profile.name}</p>
      </div>

      {/* Accommodation summary */}
      {accommodation ? (
        <div
          className="card flex items-center gap-3 cursor-pointer hover:bg-slate-50"
          onClick={() => navigate('/accommodation')}
        >
          <span className="text-2xl">{accommodation.type === 'hotel' ? '🏨' : '🏠'}</span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-slate-800 truncate">{accommodation.name}</p>
            <p className="text-xs text-slate-500 truncate">{accommodation.address}</p>
          </div>
          <svg className="w-5 h-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ) : (
        <button
          className="card flex items-center gap-3 w-full text-left hover:bg-slate-50 border-dashed"
          onClick={() => navigate('/accommodation')}
        >
          <span className="text-2xl">🏨</span>
          <div>
            <p className="font-medium text-slate-600">Add your accommodation</p>
            <p className="text-xs text-slate-400">Hotel or local housing</p>
          </div>
        </button>
      )}

      {/* Arrivals */}
      <Section title="Arriving" icon="🛬" count={arrivals.length}>
        {arrivals.length === 0 ? (
          <EmptyFlight direction="arrival" onClick={() => navigate('/flights/new?dir=arrival')} />
        ) : (
          arrivals.map(f => (
            <FlightCard key={f.id} flight={f} onDelete={deleteFlight} showHistory />
          ))
        )}
        {arrivals.length > 0 && (
          <button className="btn-secondary" onClick={() => navigate('/flights/new?dir=arrival')}>
            + Add Arrival
          </button>
        )}
      </Section>

      {/* Departures */}
      <Section title="Departing" icon="🛫" count={departures.length}>
        {departures.length === 0 ? (
          <EmptyFlight direction="departure" onClick={() => navigate('/flights/new?dir=departure')} />
        ) : (
          departures.map(f => (
            <FlightCard key={f.id} flight={f} onDelete={deleteFlight} showHistory />
          ))
        )}
        {departures.length > 0 && (
          <button className="btn-secondary" onClick={() => navigate('/flights/new?dir=departure')}>
            + Add Departure
          </button>
        )}
      </Section>

      {/* Transfers */}
      {transfers.length > 0 && (
        <Section title="Your Rides" icon="🚗">
          {transfers.map(t => <TransferRow key={t.id} transfer={t} />)}
        </Section>
      )}
    </Layout>
  )
}

function Section({ title, icon, count, children }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h2 className="font-semibold text-slate-700">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="badge bg-slate-100 text-slate-500">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function EmptyFlight({ direction, onClick }) {
  return (
    <button
      onClick={onClick}
      className="card w-full text-left border-dashed flex items-center gap-3 hover:bg-slate-50"
    >
      <span className="text-3xl">{direction === 'arrival' ? '🛬' : '🛫'}</span>
      <div>
        <p className="font-medium text-slate-600">Add {direction} flight</p>
        <p className="text-xs text-slate-400">Tap to enter your flight details</p>
      </div>
    </button>
  )
}

function TransferRow({ transfer }) {
  const statusColor = {
    pending: 'bg-slate-100 text-slate-600',
    assigned: 'bg-blue-100 text-blue-700',
    in_progress: 'bg-amber-100 text-amber-700',
    completed: 'bg-green-100 text-green-700',
  }[transfer.status] || 'bg-slate-100 text-slate-600'

  return (
    <div className="card space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span>{transfer.transfer_type === 'pickup' ? '🚗↙' : '🚗↗'}</span>
          <span className="font-medium capitalize">{transfer.transfer_type}</span>
        </div>
        <span className={`badge ${statusColor} capitalize`}>{transfer.status}</span>
      </div>
      {transfer.pickup_location && (
        <p className="text-sm text-slate-600">
          <span className="text-slate-400">From: </span>{transfer.pickup_location}
        </p>
      )}
      {transfer.dropoff_location && (
        <p className="text-sm text-slate-600">
          <span className="text-slate-400">To: </span>{transfer.dropoff_location}
        </p>
      )}
      {transfer.driver && (
        <p className="text-sm text-slate-600">
          <span className="text-slate-400">Driver: </span>
          <span className="font-medium">{transfer.driver.name}</span>
          {' · '}{transfer.driver.phone}
        </p>
      )}
    </div>
  )
}
