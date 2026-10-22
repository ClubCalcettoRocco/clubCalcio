import { lazy, Suspense } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import ConnectionStatus from './ConnectionStatus'

const NotificationBell = lazy(() => import('./NotificationBell'))

const ITEMS = [
  ['/', 'Home', '⌂'],
  ['/partite', 'Partite', '⚽'],
  ['/sondaggi', 'Sondaggi', '📊'],
  ['/votazioni', 'Votazioni', '🗳️'],
  ['/classifiche', 'Classifiche', '🏆'],
  ['/giocatori', 'Giocatori', '👥'],
  ['/profilo', 'Profilo', '👤']
]

function getPageTitle(pathname) {
  if (pathname === '/') return 'Home'
  if (pathname === '/partite/nuova') return 'Nuova partita'
  if (pathname.endsWith('/risultato')) return 'Risultato partita'
  if (pathname.endsWith('/modifica')) return 'Modifica partita'
  if (pathname.startsWith('/partite/')) return 'Dettaglio partita'
  if (pathname === '/partite') return 'Partite'
  if (pathname === '/sondaggi/nuovo') return 'Nuovo sondaggio'
  if (pathname.startsWith('/sondaggi')) return 'Sondaggi'
  if (pathname === '/votazioni') return 'Votazioni'
  if (pathname === '/classifiche') return 'Classifiche'
  if (pathname === '/stagione') return 'Fine stagione'
  if (pathname.startsWith('/giocatori/')) return 'Profilo giocatore'
  if (pathname === '/giocatori') return 'Giocatori'
  if (pathname === '/profilo') return 'Il mio profilo'
  if (pathname.startsWith('/admin')) return 'Amministrazione'
  return 'Calcetto Club'
}

export default function Layout({ children }) {
  const { me, isAdmin, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="shell">
      <div className="shell-noise" aria-hidden="true" />

      {/* SIDEBAR DESKTOP */}
      <aside className="sidebar">
        <Link to="/" className="brand">
          <img className="brand-ball" src="/icons/icon-192.png" alt="" />
          <span className="brand-copy">
            <strong>Calcetto</strong>
            <small>CLUB · MATCHDAY</small>
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
            <span>CLUB CALCETTO</span>
            <i aria-hidden="true">/</i>
            <strong>{getPageTitle(location.pathname)}</strong>
          </div>

          <div className="topbar-actions">
            <time className="topbar-date" dateTime={new Date().toISOString()}>
              {new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date())}
            </time>
            <Link to="/sondaggi/nuovo" className="btn primary small poll-top-cta">
              + Sondaggio
            </Link>
            {isAdmin && (
              <Link
                to="/partite/nuova"
                className="btn primary small top-cta"
              >
                + Nuova partita
              </Link>
            )}
            <Suspense fallback={<span className="notification-bell-placeholder" aria-hidden="true" />}>
              <NotificationBell userId={me?.user_id} />
            </Suspense>
          </div>
        </header>

        <ConnectionStatus />

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
