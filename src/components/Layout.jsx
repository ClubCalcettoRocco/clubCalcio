import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const ITEMS = [
  ['/', 'Home', '⌂'],
  ['/partite', 'Partite', '⚽'],
  ['/classifiche', 'Classifiche', '🏆'],
  ['/giocatori', 'Giocatori', '👥'],
  ['/profilo', 'Profilo', '👤']
]

export default function Layout({ children }) {
  const { me, isAdmin, signOut } = useAuth()
  const location = useLocation()

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand"><span className="brand-ball">⚽</span><span>Calcetto Club</span></Link>
        <nav>{ITEMS.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><span className="nav-icon">{icon}</span><span>{label}</span></NavLink>)}</nav>
        {isAdmin && (
          <NavLink to="/admin/giocatori"><span className="nav-icon">⚙️</span><span>Amministrazione</span></NavLink>
        )}
        <div className="sidebar-bottom">
          <div className="user-mini"><div className="mini-avatar">{(me?.first_name?.[0] || '?').toUpperCase()}</div><div className="grow"><b>{me?.first_name || 'Utente'}</b><span>{isAdmin ? 'Admin' : 'Giocatore'}</span></div></div>
          <button className="btn ghost block" onClick={() => signOut()}>Esci</button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <div className="breadcrumbs">{location.pathname === '/' ? 'Home' : 'Calcetto Club'}</div>
          {isAdmin && <Link to="/partite/nuova" className="btn primary small top-cta">+ Partita</Link>}
        </header>
        <div className="page-wrap">{children}</div>
      </main>
      <nav className="mobile-nav">
        {ITEMS.map(([to, label, icon]) => <NavLink key={to} to={to} end={to === '/'}><span>{icon}</span><small>{label}</small></NavLink>)}
      </nav>
    </div>
  )
}
