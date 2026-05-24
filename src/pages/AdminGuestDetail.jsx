import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import FlightCard from '../components/FlightCard'
import dayjs from 'dayjs'

export default function AdminGuestDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { profile: admin } = useAuth()
  const isNew = id === 'new'
  const defaultRole = searchParams.get('role') || 'guest'

  const [guest, setGuest] = useState(null)
  const [flights, setFlights] = useState([])
  const [accommodation, setAccommodation] = useState(null)
  const [transfers, setTransfers] = useState([])
  const [drivers, setDrivers] = useState([])
  const [loading, setLoading] = useState(!isNew)
  const [editInfo, setEditInfo] = useState(false)
  const [info, setInfo] = useState({ name: '', phone: '', email: '', role: defaultRole })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('*').in('role', ['driver', 'admin']).order('name').then(r => setDrivers(r.data || []))
    if (!isNew) loadGuest()
    else setLoading(false)
  }, [id])

  async function loadGuest() {
    setLoading(true)
    const [gRes, fRes, aRes, tRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('flights').select('*').eq('profile_id', id).order('scheduled_time'),
      supabase.from('accommodations').select('*').eq('profile_id', id).maybeSingle(),
      supabase.from('transfers')
        .select('*, driver:profiles!transfers_driver_id_fkey(name, phone)')
        .eq('profile_id', id),
    ])
    if (gRes.data) {
      setGuest(gRes.data)
      setInfo({ name: gRes.data.name || '', phone: gRes.data.phone || '', email: gRes.data.email || '', role: gRes.data.role || 'guest' })
    }
    setFlights(fRes.data || [])
    setAccommodation(aRes.data)
    setTransfers(tRes.data || [])
    setLoading(false)
  }

  async function saveInfo(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (isNew) {
        const normalized = info.phone.replace(/\D/g, '')
        const phone = normalized.length === 10 ? `+1${normalized}` : `+${normalized}`
        const { error: err } = await supabase.from('profiles').insert({ ...info, phone })
        if (err) throw err
        navigate('/admin')
      } else {
        const { error: err } = await supabase.from('profiles').update(info).eq('id', id)
        if (err) throw err
        setGuest(g => ({ ...g, ...info }))
        setEditInfo(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addTransfer() {
    const { data } = await supabase
      .from('transfers')
      .insert({
        profile_id: id,
        transfer_type: 'pickup',
        status: 'pending',
        pickup_location: accommodation?.address || '',
        dropoff_location: '',
      })
      .select()
      .single()
    if (data) setTransfers(prev => [...prev, data])
  }

  async function deleteTransfer(tid) {
    if (!confirm('Delete this transfer?')) return
    await supabase.from('transfers').delete().eq('id', tid)
    setTransfers(prev => prev.filter(t => t.id !== tid))
  }

  if (loading) return <Layout title="Guest" showBack backTo="/admin"><div className="py-12 text-center text-slate-400">Loading…</div></Layout>

  if (isNew) return (
    <Layout title={defaultRole === 'driver' ? 'Add Driver' : 'Add Guest'} showBack backTo="/admin">
      <form onSubmit={saveInfo} className="space-y-4">
        <InfoFields info={info} setInfo={setInfo} />
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Creating…' : defaultRole === 'driver' ? 'Create Driver' : 'Create Guest'}</button>
      </form>
    </Layout>
  )

  return (
    <Layout title={guest?.name || 'Guest'} showBack backTo="/admin">
      {/* Profile section */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Profile</h2>
          <button onClick={() => setEditInfo(e => !e)} className="text-sm text-blue-600">{editInfo ? 'Cancel' : 'Edit'}</button>
        </div>
        {editInfo ? (
          <form onSubmit={saveInfo} className="space-y-3">
            <InfoFields info={info} setInfo={setInfo} />
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</p>}
            <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
          </form>
        ) : (
          <div className="space-y-1 text-sm">
            <Row label="Name" value={guest?.name} />
            <Row label="Phone" value={guest?.phone} />
            <Row label="Email" value={guest?.email} />
            <Row label="Role" value={guest?.role} />
          </div>
        )}
      </div>

      {/* Accommodation */}
      <AccommodationEdit
        profileId={id}
        existing={accommodation}
        onSave={updated => setAccommodation(updated)}
      />

      {/* Flights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Flights ({flights.length})</h2>
          <button onClick={() => navigate(`/flights/new?profileId=${id}&back=/admin/guest/${id}`)} className="text-sm text-blue-600">+ Add</button>
        </div>
        {flights.map(f => (
          <FlightCard key={f.id} flight={f} showHistory backTo={`/admin/guest/${id}`}
            onDelete={async fid => {
              if (!confirm('Delete flight?')) return
              await supabase.from('flights').delete().eq('id', fid)
              setFlights(prev => prev.filter(fl => fl.id !== fid))
            }}
          />
        ))}
        {flights.length === 0 && <p className="text-sm text-slate-400">No flights entered</p>}
      </div>

      {/* Transfers */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">Transfers ({transfers.length})</h2>
          <button onClick={addTransfer} className="text-sm text-blue-600">+ Add</button>
        </div>
        {transfers.map(t => (
          <AdminTransferEdit
            key={t.id}
            transfer={t}
            drivers={drivers}
            flights={flights}
            profileId={id}
            onDelete={() => deleteTransfer(t.id)}
            onUpdate={loadGuest}
          />
        ))}
        {transfers.length === 0 && <p className="text-sm text-slate-400">No transfers scheduled</p>}
      </div>
    </Layout>
  )
}

function InfoFields({ info, setInfo }) {
  return (
    <>
      <div>
        <label className="label">Full Name</label>
        <input className="input" value={info.name} onChange={e => setInfo(i => ({ ...i, name: e.target.value }))} placeholder="Jane Smith" required />
      </div>
      <div>
        <label className="label">Phone</label>
        <input className="input" type="tel" value={info.phone} onChange={e => setInfo(i => ({ ...i, phone: e.target.value }))} placeholder="555-000-0000" required />
      </div>
      <div>
        <label className="label">Email</label>
        <input className="input" type="email" value={info.email} onChange={e => setInfo(i => ({ ...i, email: e.target.value }))} placeholder="jane@example.com" />
      </div>
      <div>
        <label className="label">Role</label>
        <select className="input" value={info.role} onChange={e => setInfo(i => ({ ...i, role: e.target.value }))}>
          <option value="guest">Guest</option>
          <option value="driver">Driver</option>
          <option value="admin">Admin</option>
        </select>
      </div>
    </>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-400 w-20 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value || '—'}</span>
    </div>
  )
}

function AccommodationEdit({ profileId, existing, onSave }) {
  const BLANK = { type: 'hotel', name: '', address: '', contact_info: '', check_in: '', check_out: '', notes: '' }
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(existing
    ? { type: existing.type || 'hotel', name: existing.name || '', address: existing.address || '', contact_info: existing.contact_info || '', check_in: existing.check_in || '', check_out: existing.check_out || '', notes: existing.notes || '' }
    : BLANK)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(f, v) { setForm(p => ({ ...p, [f]: v })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, profile_id: profileId, updated_at: new Date().toISOString() }
      if (existing) {
        const { data, error: err } = await supabase.from('accommodations').update(payload).eq('id', existing.id).select().single()
        if (err) throw err
        onSave(data)
      } else {
        const { data, error: err } = await supabase.from('accommodations').insert(payload).select().single()
        if (err) throw err
        onSave(data)
      }
      setOpen(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-slate-700">Accommodation</h2>
        <button onClick={() => setOpen(o => !o)} className="text-sm text-blue-600">
          {open ? 'Cancel' : existing ? 'Edit' : '+ Add'}
        </button>
      </div>

      {!open && existing && (
        <div className="text-sm space-y-1">
          <Row label="Type" value={existing.type} />
          <Row label="Name" value={existing.name} />
          <Row label="Address" value={existing.address} />
          {existing.check_in && <Row label="Check-in" value={existing.check_in} />}
          {existing.check_out && <Row label="Check-out" value={existing.check_out} />}
          {existing.contact_info && <Row label="Contact" value={existing.contact_info} />}
          {existing.notes && <Row label="Notes" value={existing.notes} />}
        </div>
      )}

      {!open && !existing && (
        <p className="text-sm text-slate-400">No accommodation entered</p>
      )}

      {open && (
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {[['hotel', '🏨', 'Hotel'], ['local_housing', '🏠', 'Local Housing']].map(([val, icon, label]) => (
              <button key={val} type="button" onClick={() => set('type', val)}
                className={`py-2 rounded-xl border text-sm font-medium transition-colors
                  ${form.type === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Name</label>
            <input className="input text-sm" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Marriott DFW" />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input text-sm" value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St, Irving TX" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Check-in</label>
              <input className="input text-sm" type="date" value={form.check_in} onChange={e => set('check_in', e.target.value)} />
            </div>
            <div>
              <label className="label">Check-out</label>
              <input className="input text-sm" type="date" value={form.check_out} onChange={e => set('check_out', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Contact / Confirmation #</label>
            <input className="input text-sm" value={form.contact_info} onChange={e => set('contact_info', e.target.value)} placeholder="Booking ref or host phone" />
          </div>
          <div>
            <label className="label">Notes</label>
            <input className="input text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Room number, parking, etc." />
          </div>
          {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">{error}</p>}
          <button className="btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Update Accommodation' : 'Save Accommodation'}
          </button>
        </form>
      )}
    </div>
  )
}

function AdminTransferEdit({ transfer, drivers, flights, profileId, onDelete, onUpdate }) {
  const [form, setForm] = useState({
    transfer_type: transfer.transfer_type || 'pickup',
    pickup_location: transfer.pickup_location || '',
    dropoff_location: transfer.dropoff_location || '',
    driver_id: transfer.driver_id || '',
    flight_id: transfer.flight_id || '',
    status: transfer.status || 'pending',
    notes: transfer.notes || '',
    scheduled_time: transfer.scheduled_time ? dayjs(transfer.scheduled_time).format('YYYY-MM-DDTHH:mm') : '',
  })
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  async function save() {
    setSaving(true)
    await supabase.from('transfers').update({
      ...form,
      scheduled_time: form.scheduled_time || null,
      driver_id: form.driver_id || null,
      flight_id: form.flight_id || null,
      updated_at: new Date().toISOString(),
    }).eq('id', transfer.id)
    setSaving(false)
    onUpdate()
  }

  return (
    <div className="card space-y-3 border-l-4 border-blue-400">
      <div className="grid grid-cols-2 gap-2">
        {['pickup', 'dropoff'].map(t => (
          <button key={t} type="button" onClick={() => set('transfer_type', t)}
            className={`py-2 rounded-lg text-sm font-medium capitalize border transition-colors
              ${form.transfer_type === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {t === 'pickup' ? '↙ Pickup' : 'Dropoff ↗'}
          </button>
        ))}
      </div>
      <div>
        <label className="label">From</label>
        <input className="input text-sm" value={form.pickup_location} onChange={e => set('pickup_location', e.target.value)} placeholder="Airport / address" />
      </div>
      <div>
        <label className="label">To</label>
        <input className="input text-sm" value={form.dropoff_location} onChange={e => set('dropoff_location', e.target.value)} placeholder="Hotel / address" />
      </div>
      <div>
        <label className="label">Linked Flight</label>
        <select className="input text-sm" value={form.flight_id} onChange={e => set('flight_id', e.target.value)}>
          <option value="">— None —</option>
          {flights.map(f => (
            <option key={f.id} value={f.id}>{f.direction === 'arrival' ? '🛬' : '🛫'} {f.flight_number}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Scheduled Time</label>
        <input className="input text-sm" type="datetime-local" value={form.scheduled_time} onChange={e => set('scheduled_time', e.target.value)} />
      </div>
      <div>
        <label className="label">Driver</label>
        <select className="input text-sm" value={form.driver_id} onChange={e => set('driver_id', e.target.value)}>
          <option value="">— Unassigned —</option>
          {drivers.map(d => <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>)}
        </select>
      </div>
      <div>
        <label className="label">Status</label>
        <select className="input text-sm" value={form.status} onChange={e => set('status', e.target.value)}>
          {['pending', 'assigned', 'in_progress', 'completed'].map(s => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input text-sm" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any special instructions…" />
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving} className="btn-success text-sm px-4 py-2 flex-1">
          {saving ? 'Saving…' : 'Save Transfer'}
        </button>
        <button onClick={onDelete} className="btn-danger">Delete</button>
      </div>
    </div>
  )
}
