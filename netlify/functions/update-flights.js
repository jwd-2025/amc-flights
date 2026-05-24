// Netlify scheduled function — runs every 30 minutes
// Schedule: "*/30 * * * *"
// Checks flights on a tiered schedule based on proximity:
//   < 6 hrs out  → check every run (every 30 min)
//   6–24 hrs out → check if not checked in the last 60 min
//   24–48 hrs out → check if not checked in the last 4 hrs
//   > 48 hrs out → skip

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const AVIATION_KEY = process.env.AVIATIONSTACK_KEY

const HOUR = 60 * 60 * 1000

export const handler = async () => {
  if (!AVIATION_KEY) {
    console.log('No AVIATIONSTACK_KEY set — skipping flight updates')
    return { statusCode: 200, body: 'No API key' }
  }

  const now = Date.now()
  const cutoff = new Date(now + 48 * HOUR).toISOString()

  // Load admin profile IDs once — they get notified of all changes
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
  const adminIds = (admins || []).map(a => a.id)

  const { data: flights, error } = await supabase
    .from('flights')
    .select('*')
    .gte('scheduled_time', new Date(now).toISOString())
    .lte('scheduled_time', cutoff)
    .not('status', 'in', '(landed,cancelled)')

  if (error) {
    console.error('Error fetching flights:', error)
    return { statusCode: 500, body: 'DB error' }
  }

  // Filter by tiered staleness
  const toCheck = (flights || []).filter(flight => {
    const hoursOut = (new Date(flight.scheduled_time) - now) / HOUR
    const lastChecked = flight.api_last_checked ? (now - new Date(flight.api_last_checked)) : Infinity

    if (hoursOut < 6)  return true                    // always check
    if (hoursOut < 24) return lastChecked > 1 * HOUR  // check if stale > 1 hr
    return lastChecked > 4 * HOUR                     // check if stale > 4 hrs
  })

  console.log(`${flights?.length || 0} upcoming flights, checking ${toCheck.length}`)

  const updates = []

  for (const flight of toCheck) {
    try {
      const res = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_KEY}&flight_iata=${flight.flight_number}`
      )
      const json = await res.json()
      const raw = json?.data?.[0]

      // Always update api_last_checked even if nothing changed
      await supabase.from('flights')
        .update({ api_last_checked: new Date().toISOString() })
        .eq('id', flight.id)

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

      await supabase.from('flights').update({
        status: newStatus,
        actual_time: newActual || flight.actual_time,
        terminal: newTerminal || flight.terminal,
        gate: newGate || flight.gate,
        updated_at: new Date().toISOString(),
      }).eq('id', flight.id)

      await supabase.from('flight_history').insert({
        flight_id: flight.id,
        changed_by: null,
        changes,
      })

      const message = buildNotificationMessage(flight, changes)
      if (message) {
        // Find the assigned driver for this flight's transfer (if any)
        const { data: transfer } = await supabase
          .from('transfers')
          .select('driver_id')
          .eq('flight_id', flight.id)
          .not('driver_id', 'is', null)
          .maybeSingle()

        // Collect unique recipient IDs: guest + admins + assigned driver
        const recipients = new Set([
          flight.profile_id,
          ...adminIds,
          ...(transfer?.driver_id ? [transfer.driver_id] : []),
        ])
        // Don't double-notify the guest if they're also an admin
        const rows = [...recipients].map(profile_id => ({
          profile_id,
          flight_id: flight.id,
          message,
          seen: false,
        }))
        await supabase.from('notifications').insert(rows)
      }

      updates.push(flight.flight_number)
    } catch (err) {
      console.error(`Error updating ${flight.flight_number}:`, err)
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ checked: toCheck.length, updated: updates }),
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
