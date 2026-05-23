// AviationStack API wrapper (free tier: 500 req/mo)
// Docs: https://aviationstack.com/documentation
// Free tier limitation: HTTP only (no HTTPS) — we proxy through Netlify function in production
// In dev with VITE key set, calls go through the Netlify dev server function

const AVIATION_KEY = import.meta.env.VITE_AVIATIONSTACK_KEY

export const flightApiAvailable = Boolean(AVIATION_KEY)

// Fetch flight info by flight number (e.g. "AA1234")
// Returns normalized flight object or null
export async function lookupFlight(flightNumber) {
  if (!AVIATION_KEY) return null

  const num = flightNumber.replace(/\s+/g, '').toUpperCase()

  try {
    const res = await fetch(`/api/flight-lookup?flight=${encodeURIComponent(num)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data || null
  } catch {
    return null
  }
}

// Normalize AviationStack response to our internal shape
export function normalizeFlightData(raw) {
  if (!raw) return null
  return {
    flight_number: raw.flight?.iata || '',
    airline: raw.airline?.name || '',
    origin_code: raw.departure?.iata || '',
    origin_name: raw.departure?.airport || '',
    destination_code: raw.arrival?.iata || '',
    destination_name: raw.arrival?.airport || '',
    scheduled_departure: raw.departure?.scheduled || null,
    scheduled_arrival: raw.arrival?.scheduled || null,
    actual_departure: raw.departure?.actual || null,
    actual_arrival: raw.arrival?.actual || null,
    status: normalizeStatus(raw.flight_status),
    terminal_arrival: raw.arrival?.terminal || null,
    gate_arrival: raw.arrival?.gate || null,
    terminal_departure: raw.departure?.terminal || null,
    gate_departure: raw.departure?.gate || null,
    baggage_claim: raw.arrival?.baggage || null,
  }
}

function normalizeStatus(s) {
  const map = {
    scheduled: 'scheduled',
    active: 'in_air',
    landed: 'landed',
    cancelled: 'cancelled',
    incident: 'cancelled',
    diverted: 'diverted',
  }
  return map[s] || 'scheduled'
}
