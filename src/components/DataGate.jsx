import { ActionError, Spinner } from './ui'
import { useData } from '../lib/data'

export default function DataGate({ children }) {
  const { loading, error, reload } = useData()

  if (loading) {
    return <Spinner label="Caricamento dati…" />
  }

  if (error) {
    return (
      <div className="center page-pad">
        <div className="card data-error-card">
          <h2>Non riesco a caricare il club</h2>
          <ActionError message={error} onRetry={reload} />
        </div>
      </div>
    )
  }

  return children
}
