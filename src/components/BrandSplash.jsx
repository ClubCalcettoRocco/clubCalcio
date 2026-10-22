export default function BrandSplash({ exiting = false }) {
  return (
    <div
      className={`brand-splash${exiting ? ' is-exiting' : ''}`}
      role="status"
      aria-label="Caricamento Club Calcetto"
    >
      <div className="brand-splash-glow" aria-hidden="true" />
      <div className="brand-splash-content">
        <div className="brand-splash-orbit" aria-hidden="true">
          <img className="brand-splash-ball" src="/club-ball.png" alt="" draggable="false" />
        </div>
        <div className="brand-splash-wordmark" aria-hidden="true">
          <strong>CALCETTO</strong>
          <span>CLUB</span>
        </div>
        <p className="brand-splash-caption">Si scende in campo</p>
        <div className="brand-splash-progress" aria-hidden="true"><span /></div>
      </div>
    </div>
  )
}
