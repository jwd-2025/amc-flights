import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import dayjs from 'dayjs'

export default function NotificationBanner() {
  const { profile } = useAuth()
  const [notes, setNotes] = useState([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!profile) return
    fetchNotifications()
  }, [profile])

  async function fetchNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*, flight:flights(direction, flight_number, scheduled_time)')
      .eq('profile_id', profile.id)
      .eq('seen', false)
      .order('created_at', { ascending: false })

    // Only show for flights that haven't departed yet
    const upcoming = (data || []).filter(n => {
      if (!n.flight) return true
      const t = n.flight.scheduled_time
      return !t || dayjs(t).isAfter(dayjs())
    })
    setNotes(upcoming)
  }

  async function dismiss(id) {
    await supabase.from('notifications').update({ seen: true }).eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function dismissAll() {
    const ids = notes.map(n => n.id)
    await supabase.from('notifications').update({ seen: true }).in('id', ids)
    setNotes([])
    setDismissed(true)
  }

  if (!notes.length) return null

  return (
    <div className="space-y-2">
      {notes.map(n => (
        <div key={n.id} className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3 items-start">
          <span className="text-xl mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 font-medium">{n.message}</p>
            {n.flight && (
              <p className="text-xs text-amber-600 mt-0.5">
                {n.flight.direction === 'arrival' ? '🛬' : '🛫'} {n.flight.flight_number}
              </p>
            )}
          </div>
          <button
            onClick={() => dismiss(n.id)}
            className="text-amber-400 hover:text-amber-600 flex-shrink-0 mt-0.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
      {notes.length > 1 && (
        <button onClick={dismissAll} className="text-xs text-slate-500 hover:text-slate-700 w-full text-right">
          Dismiss all
        </button>
      )}
    </div>
  )
}
