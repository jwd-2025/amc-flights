import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import LoginPage from './pages/LoginPage'
import GuestDashboard from './pages/GuestDashboard'
import FlightFormPage from './pages/FlightFormPage'
import AccommodationPage from './pages/AccommodationPage'
import AdminPage from './pages/AdminPage'
import AdminGuestDetail from './pages/AdminGuestDetail'
import DriverPage from './pages/DriverPage'

function RequireAuth({ children, allowedRoles }) {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  if (!profile) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>
  if (!profile) return <Navigate to="/login" replace />
  if (profile.role === 'admin') return <Navigate to="/admin" replace />
  if (profile.role === 'driver') return <Navigate to="/driver" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Guest routes */}
          <Route path="/dashboard" element={
            <RequireAuth allowedRoles={['guest', 'admin']}>
              <GuestDashboard />
            </RequireAuth>
          } />
          <Route path="/flights/new" element={
            <RequireAuth allowedRoles={['guest', 'admin']}>
              <FlightFormPage />
            </RequireAuth>
          } />
          <Route path="/flights/:id/edit" element={
            <RequireAuth allowedRoles={['guest', 'admin']}>
              <FlightFormPage />
            </RequireAuth>
          } />
          <Route path="/accommodation" element={
            <RequireAuth allowedRoles={['guest', 'admin']}>
              <AccommodationPage />
            </RequireAuth>
          } />

          {/* Admin routes */}
          <Route path="/admin" element={
            <RequireAuth allowedRoles={['admin']}>
              <AdminPage />
            </RequireAuth>
          } />
          <Route path="/admin/guest/:id" element={
            <RequireAuth allowedRoles={['admin']}>
              <AdminGuestDetail />
            </RequireAuth>
          } />

          {/* Driver routes */}
          <Route path="/driver" element={
            <RequireAuth allowedRoles={['driver', 'admin']}>
              <DriverPage />
            </RequireAuth>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
