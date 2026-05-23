import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children, title, showBack = false, backTo }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  function handleBack() {
    if (backTo) navigate(backTo)
    else navigate(-1)
  }

  const roleBadge = {
    admin: { label: 'Admin', cls: 'bg-purple-100 text-purple-700' },
    driver: { label: 'Driver', cls: 'bg-green-100 text-green-700' },
    guest: { label: 'Guest', cls: 'bg-blue-100 text-blue-700' },
  }[profile?.role] || { label: '', cls: '' }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto">
      {/* Top bar */}
      <header className="bg-blue-700 text-white sticky top-0 z-20 shadow-md">
        <div className="flex items-center gap-3 px-4 py-3">
          {showBack && (
            <button onClick={handleBack} className="text-blue-200 hover:text-white p-1 -ml-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="flex-1 font-semibold text-lg truncate">{title || 'AMC Flights'}</h1>
          <div className="flex items-center gap-2">
            {profile && (
              <span className={`badge ${roleBadge.cls} hidden sm:inline-flex`}>
                {roleBadge.label}
              </span>
            )}
            {profile && (
              <button
                onClick={logout}
                className="text-blue-200 hover:text-white text-sm"
              >
                Out
              </button>
            )}
          </div>
        </div>
        {profile && (
          <div className="px-4 pb-2 text-xs text-blue-200 truncate">
            {profile.name} · {profile.phone}
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-5 space-y-4">
        {children}
      </main>

      {/* Bottom nav for guests */}
      {profile?.role === 'guest' && (
        <nav className="bg-white border-t border-slate-200 flex sticky bottom-0 z-20">
          <NavTab icon="🏠" label="Home" to="/dashboard" current={location.pathname === '/dashboard'} onClick={() => navigate('/dashboard')} />
          <NavTab icon="✈️" label="Flights" to="/flights/new" current={location.pathname.startsWith('/flights')} onClick={() => navigate('/flights/new')} />
          <NavTab icon="🏨" label="Stay" to="/accommodation" current={location.pathname === '/accommodation'} onClick={() => navigate('/accommodation')} />
        </nav>
      )}
    </div>
  )
}

function NavTab({ icon, label, current, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center py-2.5 text-xs font-medium transition-colors
        ${current ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
      <span className="text-xl mb-0.5">{icon}</span>
      {label}
    </button>
  )
}
