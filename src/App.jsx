import { lazy, Suspense } from 'react'
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation
} from 'react-router-dom'

import {
  useAuth,
  AuthProvider
} from './lib/auth'

import { DataProvider } from './lib/data'

import Layout from './components/Layout'

import { ActionError, Spinner } from './components/ui'
import PwaUpdatePrompt from './components/PwaUpdatePrompt'

const Login = lazy(() => import('./pages/Login'))
const Home = lazy(() => import('./pages/Home'))
const Matches = lazy(() => import('./pages/Matches'))
const MatchDetail = lazy(() => import('./pages/MatchDetail'))
const MatchForm = lazy(() => import('./pages/MatchForm'))
const Polls = lazy(() => import('./pages/Polls'))
const MatchResult = lazy(() => import('./pages/MatchResult'))
const Rankings = lazy(() => import('./pages/Rankings'))
const Players = lazy(() => import('./pages/Players'))
const PlayerProfile = lazy(() => import('./pages/PlayerProfile'))
const AdminPlayers = lazy(() => import('./pages/AdminPlayers'))
const Votazioni = lazy(() => import('./pages/Votazioni'))
const SeasonSummary = lazy(() => import('./pages/SeasonSummary'))


function Protected() {
  const location = useLocation()
  const {
    session,
    me,
    loading,
    profileError,
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
        state={{ from: location }}
      />
    )
  }

  if (profileError) {
    return (
      <div className="center page-pad">
        <div className="card data-error-card">
          <h2>Profilo non raggiungibile</h2>
          <ActionError message={profileError} onRetry={() => window.location.reload()} />
          <button className="btn ghost" onClick={signOut}>Esci e accedi di nuovo</button>
        </div>
      </div>
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


export default function App({ updateServiceWorker }) {
  return (
    <BrowserRouter>

      <PwaUpdatePrompt updateServiceWorker={updateServiceWorker} />

      <AuthProvider>
        <Suspense fallback={<Spinner label="Caricamento pagina…" />}>
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

            <Route path="/sondaggi" element={<Polls />} />
            <Route path="/sondaggi/nuovo" element={<Polls />} />

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
              path="/stagione"
              element={<SeasonSummary />}
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
        </Suspense>

      </AuthProvider>

    </BrowserRouter>
  )
}
