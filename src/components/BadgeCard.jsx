export default function BadgeCard({
  badge,
  context
}) {
  const unlocked =
    badge.requirement(context)

  const progress =
    typeof badge.progress === 'function'
      ? badge.progress(context)
      : 0

  const percentage =
    badge.target > 0
      ? Math.min(
          (progress / badge.target) * 100,
          100
        )
      : 0

  return (
    <div
      className={`badge-card ${
        unlocked
          ? 'badge-unlocked'
          : 'badge-locked'
      } ${
        badge.platinum
          ? 'badge-platinum'
          : ''
      }`}
    >
      <div className="badge-image-wrap">
        <img
          src={badge.image}
          alt={badge.name}
          className="badge-image"
        />

        {!unlocked && (
          <div className="badge-lock">
            🔒
          </div>
        )}
      </div>

      <div className="badge-content">
        <span className="badge-category">
          {badge.category}
        </span>

        <h3>
          {badge.name}
        </h3>

        <p>
          {badge.description}
        </p>

        {!unlocked && (
          <>
            <div className="badge-progress">
              <div
                className="badge-progress-fill"
                style={{
                  width: `${percentage}%`
                }}
              />
            </div>

            <span className="badge-progress-text">
              {badge.progressLabel(context)}
            </span>
          </>
        )}

        {unlocked && (
          <span className="badge-unlocked-label">
            ✓ SBLOCCATO
          </span>
        )}
      </div>
    </div>
  )
}