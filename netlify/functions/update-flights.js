// Netlify scheduled function — runs every 4 hours
// Schedule: "0 */4 * * *"
// Set SUPABASE_SERVICE_ROLE_KEY and AVIATIONSTACK_KEY in Netlify env vars

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const AVIATION_KEY = process.env.AVIATIONSTACK_KEY

export const handler = async () => {
  if (!AVIATION_KEY) {
    console.log('No AVIATIONSTACK_KEY set — skipping flight updates')
    return { statusCode: 200, body: 'No API key' }
  }

  // Fetch flights scheduled in the next 48 hours that haven't landed/cancelled
  const now = new Date().toISOString()
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: flights, error } = await supabase
    .from('flights')
    .select('*')
    .gte('scheduled_time', now)
    .lte('scheduled_time', cutoff)
    .not('status', 'in', '(landed,cancelled)')

  if (error) {
    console.error('Error fetching flights:', error)
    return { statusCode: 500, body: 'DB error' }
  }

  console.log(`Checking ${flights?.length || 0} upcoming flights`)

  const updates = []

  for (const flight of flights || []) {
    try {
      const res = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_KEY}&flight_iata=${flight.flight_number}`
      )
      const json = await res.json()
      const raw = json?.data?.[0]
      if (!raw) continue

      const newStatus = normalizeStatus(raw.flight_status)
      const newActual = flight.direction === 'arrival'
        ? (raw.arrival?.actual || raw.arrival?.estimated || null)
        : (raw.departure?.actual || raw.departure?.estimated || null)
      const newTerminal = flight.direction === 'arrival' ? raw.arrival?.terminal : raw.departure?.terminal
      const newGate = flight.direction === 'arrival' ? raw.arrival?.gate : raw.departure?.gate

      const changes = {}
      if (newStatus !== flight.status) changes.status = { old_value: flight.status, new_value: newStatus }
      if (newActual && newActual !== flight.actual_time) changes.actual_time = { old_value: flight.actual_time, new_value: newActual }
      if (newTerminal && newTerminal !== flight.terminal) changes.terminal = { old_value: flight.terminal, new_value: newTerminal }
      if (newGate && newGate !== flight.gate) changes.gate = { old_value: flight.gate, new_value: newGate }

      if (Object.keys(changes).length === 0) continue

      // Update flight
      await supabase.from('flights').update({
        status: newStatus,
        actual_time: newActual || flight.actual_time,
        terminal: newTerminal || flight.terminal,
        gate: newGate || flight.gate,
        api_last_checked: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', flight.id)

      // Record history
      await supabase.from('flight_history').insert({
        flight_id: flight.id,
        changed_by: null, // system update
        changes,
      })

      // Create notification for the guest
      const message = buildNotificationMessage(flight, changes)
      if (message) {
        await supabase.from('notifications').insert({
          profile_id: flight.profile_id,
          flight_id: flight.id,
          message,
          seen: false,
        })
      }

      updates.push(flight.flight_number)
    } catch (err) {
      console.error(`Error updating ${flight.flight_number}:`, err)
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ updated: updates }),
  }
}

function normalizeStatus(s) {
  const map = { scheduled: 'scheduled', active: 'in_air', landed: 'landed', cancelled: 'cancelled', diverted: 'diverted' }
  return map[s] || 'scheduled'
}

function buildNotificationMessage(flight, changes) {
  const parts = []
  if (changes.status) {
    const labels = { in_air: 'is now in the air', landed: 'has landed', cancelled: 'has been cancelled', diverted: 'has been diverted' }
    const msg = labels[changes.status.new_value]
    if (msg) parts.push(`Flight ${flight.flight_number} ${msg}`)
  }
  if (changes.actual_time && !changes.status) {
    const dir = flight.direction === 'arrival' ? 'arrival' : 'departure'
    parts.push(`Flight ${flight.flight_number} ${dir} time updated`)
  }
  if (changes.gate) {
    parts.push(`Gate changed to ${changes.gate.new_value}`)
  }
  return parts.join(' · ') || null
}
