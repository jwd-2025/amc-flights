import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { supabase } from '../lib/supabase'

const STATUS_STYLE = {
  scheduled:  { cls: 'bg-blue-100 text-blue-700',   label: 'Scheduled' },
  in_air:     { cls: 'bg-sky-100 text-sky-700',     label: 'In Air' },
  landed:     { cls: 'bg-green-100 text-green-700', label: 'Landed' },
  cancelled:  { cls: 'bg-red-100 text-red-700',     label: 'Cancelled' },
  diverted:   { cls: 'bg-orange-100 text-orange-700', label: 'Diverted' },
  delayed:    { cls: 'bg-amber-100 text-amber-700', label: 'Delayed' },
}

export default function FlightCard({ flight, onDelete, showHistory = false, backTo }) {
  const navigate = useNavigate()
  const [showHist, setShowHist] = useState(false)
  const [history, setHistory] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const isArrival = flight.direction === 'arrival'
  const time = flight.actual_time || flight.scheduled_time
  const isDelayed = flight.actual_time && flight.scheduled_time &&
    dayjs(flight.actual_time).isAfter(dayjs(flight.scheduled_time).add(10, 'minute'))
  const status = STATUS_STYLE[flight.status] || STATUS_STYLE.scheduled

  async function loadHistory() {
    if (showHist) { setShowHist(false); return }
    setLoadingHist(true)
    const { data } = await supabase
      .from('flight_history')
      .select('*, changed_by_profile:profiles(name)')
      .eq('flight_id', flight.id)
      .order('changed_at', { ascending: false })
    setHistory(data || [])
    setShowHist(true)
    setLoadingHist(false)
  }

  return (
    <div className="card space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{isArrival ? '🛬' : '🛫'}</span>
          <div>
            <a
              href={`https://flightaware.com/live/flight/${flight.flight_number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-blue-700 text-lg leading-tight hover:underline"
            >
              {flight.flight_number}
            </a>
            <p className="text-xs text-slate-500">{flight.airline}</p>
          </div>
        </div>
        <span className={`badge ${status.cls} mt-1`}>{status.label}</span>
      </div>

      {/* Route */}
      <div className="flex items-center gap-2 text-sm">
        <div className="text-center">
          <p className="font-bold text-base">{flight.origin_code || '—'}</p>
          <p className="text-xs text-slate-500 truncate max-w-[80px]">{flight.origin_name}</p>
        </div>
        <div className="flex-1 flex items-center gap-1 text-slate-300">
          <div className="flex-1 border-t border-dashed border-slate-300" />
          <span className="text-xs text-slate-400">✈</span>
          <div className="flex-1 border-t border-dashed border-slate-300" />
        </div>
        <div className="text-center">
          <p className="font-bold text-base">{flight.destination_code || '—'}</p>
          <p className="text-xs text-slate-500 truncate max-w-[80px]">{flight.destination_name}</p>
        </div>
      </div>

      {/* Time details */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <Detail label="Scheduled" value={flight.scheduled_time ? dayjs(flight.scheduled_time).format('ddd, MMM D h:mm A') : '—'} />
        {isDelayed && (
          <Detail label="Actual" value={dayjs(flight.actual_time).format('h:mm A')} accent="text-orange-600" />
        )}
        {flight.terminal && <Detail label="Terminal" value={flight.terminal} />}
        {flight.gate && <Detail label="Gate" value={flight.gate} />}
        {flight.baggage_claim && <Detail label="Baggage" value={flight.baggage_claim} />}
      </div>

      {flight.notes && (
        <p className="text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">{flight.notes}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-slate-100">
        <button
          onClick={() => navigate(`/flights/${flight.id}/edit${backTo ? `?back=${encodeURIComponent(backTo)}` : ''}`)}
          className="flex-1 text-sm text-blue-600 font-medium hover:text-blue-800 py-1"
        >
          Edit
        </button>
        {showHistory && (
          <button
            onClick={loadHistory}
            className="flex-1 text-sm text-slate-500 hover:text-slate-700 py-1"
          >
            {loadingHist ? '…' : showHist ? 'Hide history' : 'History'}
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(flight.id)}
            className="text-sm text-red-400 hover:text-red-600 py-1 px-2"
          >
            Delete
          </button>
        )}
      </div>

      {/* History panel */}
      {showHist && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          {history.length === 0 && <p className="text-xs text-slate-400">No changes recorded</p>}
          {history.map(h => (
            <div key={h.id} className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
              <div className="flex justify-between mb-1">
                <span className="font-medium">{h.changed_by_profile?.name || 'System'}</span>
                <span className="text-slate-400">{dayjs(h.changed_at).format('MMM D, h:mm A')}</span>
              </div>
              {Object.entries(h.changes || {}).map(([field, { old_value, new_value }]) => (
                <div key={field} className="text-slate-500">
                  <span className="font-medium text-slate-700">{friendlyField(field)}: </span>
                  <span className="line-through text-red-400">{old_value || 'none'}</span>
                  {' → '}
                  <span className="text-green-600">{new_value || 'none'}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Detail({ label, value, accent }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`font-medium ${accent || 'text-slate-800'}`}>{value}</p>
    </div>
  )
}

function friendlyField(f) {
  return {
    status: 'Status', actual_time: 'Actual time', scheduled_time: 'Scheduled',
    gate: 'Gate', terminal: 'Terminal', flight_number: 'Flight #',
    baggage_claim: 'Baggage', notes: 'Notes',
  }[f] || f
}
