import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes
} from 'react-router-dom'

import {
  useAuth,
  AuthProvider
} from './lib/auth'

import { DataProvider } from './lib/data'

import Layout from './components/Layout'

import { Spinner } from './components/ui'

import Login from './pages/Login'
import Home from './pages/Home'
import Matches from './pages/Matches'
import MatchDetail from './pages/MatchDetail'
import MatchForm from './pages/MatchForm'
import MatchResult from './pages/MatchResult'
import Rankings from './pages/Rankings'
import Players from './pages/Players'
import PlayerProfile from './pages/PlayerProfile'
import AdminPlayers from './pages/AdminPlayers'
import Votazioni from './pages/Votazioni'


function Protected() {
  const {
    session,
    me,
    loading,
    signOut
  } = useAuth()

  if (loading) {
    return <Spinner />
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  if (!me) {
    return (
      <div className="center">
        <p className="error">
          Profilo non trovato. Effettua di nuovo
          la registrazione o contatta
          l'amministratore.
        </p>

        <button
          className="btn"
          onClick={signOut}
        >
          Esci
        </button>
      </div>
    )
  }

  if (!me.approved) {
    return (
      <div className="center page-pad">
        <div className="card narrow">

          <div className="logo">
            ⚽
          </div>

          <h2>
            Account in attesa
          </h2>

          <p className="muted">
            Il tuo account esiste, ma deve essere
            approvato dall'amministratore del gruppo.
          </p>

          <button
            className="btn"
            onClick={signOut}
          >
            Esci
          </button>

        </div>
      </div>
    )
  }

  return (
    <DataProvider>
      <Layout>
        <Outlet />
      </Layout>
    </DataProvider>
  )
}


function AdminOnly({ children }) {
  const { isAdmin } = useAuth()

  return isAdmin
    ? children
    : <Navigate to="/" replace />
}


export default function App() {
  return (
    <BrowserRouter>

      <AuthProvider>

        <Routes>

          <Route
            path="/login"
            element={<Login />}
          />

          <Route element={<Protected />}>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/partite"
              element={<Matches />}
            />

            <Route
              path="/votazioni"
              element={<Votazioni />}
            />

            <Route
              path="/partite/nuova"
              element={
                <AdminOnly>
                  <MatchForm />
                </AdminOnly>
              }
            />

            <Route
              path="/partite/:id"
              element={<MatchDetail />}
            />

            <Route
              path="/partite/:id/modifica"
              element={
                <AdminOnly>
                  <MatchForm />
                </AdminOnly>
              }
            />

            <Route
              path="/partite/:id/risultato"
              element={
                <AdminOnly>
                  <MatchResult />
                </AdminOnly>
              }
            />

            <Route
              path="/classifiche"
              element={<Rankings />}
            />

            <Route
              path="/giocatori"
              element={<Players />}
            />

            <Route
              path="/giocatori/:id"
              element={<PlayerProfile />}
            />

            <Route
              path="/profilo"
              element={<PlayerProfile self />}
            />

            <Route
              path="/admin/giocatori"
              element={
                <AdminOnly>
                  <AdminPlayers />
                </AdminOnly>
              }
            />

          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to="/"
                replace
              />
            }
          />

        </Routes>

      </AuthProvider>

    </BrowserRouter>
  )
}