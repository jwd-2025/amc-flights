// Proxy for AviationStack API (free tier requires HTTP, not HTTPS — we call it server-side)
// URL: /.netlify/functions/flight-lookup?flight=AA1234

export const handler = async (event) => {
  const key = process.env.AVIATIONSTACK_KEY
  if (!key) return { statusCode: 503, body: JSON.stringify({ error: 'No API key configured' }) }

  const flightNumber = event.queryStringParameters?.flight
  if (!flightNumber) return { statusCode: 400, body: JSON.stringify({ error: 'Missing flight param' }) }

  try {
    const res = await fetch(
      `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${encodeURIComponent(flightNumber)}`
    )
    const json = await res.json()
    const flight = json?.data?.[0] || null

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flight),
    }
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ error: 'Upstream error' }) }
  }
}
