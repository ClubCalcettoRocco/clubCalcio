import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ITEMS = [
  ['/', 'Home', '⌂'],
  ['/partite', 'Partite', '⚽'],
  ['/votazioni', 'Votazioni', '🗳️'],
  ['/classifiche', 'Classifiche', '🏆'],
  ['/giocatori', 'Giocatori', '👥'],
  ['/profilo', 'Profilo', '👤']
]

export default function Layout({ children }) {
  const { me, isAdmin, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="shell">
      <div className="shell-noise" aria-hidden="true" />

      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-ball">⚽</span>
          <span>
            <strong>Calcetto</strong>
            <small>Club</small>
          </span>
        </Link>

        <nav className="sidebar-nav">
          {ITEMS.map(([to, label, icon]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
            >
              <span className="nav-icon">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* ADMIN DESKTOP */}
        {isAdmin && (
          <NavLink
            className="admin-nav"
            to="/admin/giocatori"
          >
            <span className="nav-icon">⚙</span>
            <span>Amministrazione</span>
          </NavLink>
        )}

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="mini-avatar">
              {(me?.first_name?.[0] || '?').toUpperCase()}
            </div>

            <div className="grow">
              <b>{me?.first_name || 'Utente'}</b>
              <span>{isAdmin ? 'Admin' : 'Giocatore'}</span>
            </div>

            <span className="online-dot" />
          </div>

          <button
            className="btn ghost block"
            onClick={() => signOut()}
          >
            Esci
          </button>
        </div>
      </aside>

      {/* CONTENUTO */}
      <main className="content">
        <header className="topbar">
          <div className="breadcrumbs">
            {location.pathname === '/' ? 'Dashboard' : 'Calcetto Club'}
          </div>

          {isAdmin && (
            <Link
              to="/partite/nuova"
              className="btn primary small top-cta"
            >
              + Nuova partita
            </Link>
          )}
        </header>

        <div className="page-wrap">
          {children}
        </div>
      </main>

      {/* NAVIGAZIONE MOBILE */}
      <nav className="mobile-nav">
        {ITEMS.map(([to, label, icon]) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
          >
            <span>{icon}</span>
            <small>{label}</small>
          </NavLink>
        ))}

        {/* ADMIN MOBILE */}
        {isAdmin && (
          <NavLink
            to="/admin/giocatori"
            className="mobile-admin"
          >
            <span>⚙</span>
            <small>Admin</small>
          </NavLink>
        )}
      </nav>
    </div>
  )
}
