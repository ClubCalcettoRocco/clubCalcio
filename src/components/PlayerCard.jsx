import { useMemo } from 'react'
import { Avatar } from './ui'


/* =========================================================
   UTILITY
========================================================= */

function clamp(value, min = 0, max = 99) {
  return Math.round(
    Math.min(max, Math.max(min, value))
  )
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)

  return Number.isFinite(n)
    ? n
    : fallback
}


/* =========================================================
   PERFORMANCE BASE
========================================================= */

function getRatingBase(stats) {
  const rating = safeNumber(
    stats?.media_voto,
    6
  )

  return clamp(
    5 + rating * 10
  )
}


/* =========================================================
   CONFIDENZA DATI
========================================================= */

function getExperienceFactor(stats) {
  const games = safeNumber(
    stats?.presenze,
    0
  )

  if (games <= 0) return 0.35
  if (games === 1) return 0.55
  if (games === 2) return 0.70
  if (games === 3) return 0.80
  if (games === 4) return 0.88

  return Math.min(
    1,
    0.90 + Math.min(games, 10) * 0.01
  )
}


/* =========================================================
   GOL
========================================================= */

function getGoalScore(stats) {
  const games = safeNumber(
    stats?.presenze,
    0
  )

  const goals = safeNumber(
    stats?.gol,
    0
  )

  if (games <= 0) {
    return 55
  }

  const perGame = goals / games

  return clamp(
    55 +
    Math.sqrt(perGame) * 32
  )
}


/* =========================================================
   ASSIST
========================================================= */

function getAssistScore(stats) {
  const games = safeNumber(
    stats?.presenze,
    0
  )

  const assists = safeNumber(
    stats?.assist,
    0
  )

  if (games <= 0) {
    return 55
  }

  const perGame = assists / games

  return clamp(
    55 +
    Math.sqrt(perGame) * 30
  )
}


/* =========================================================
   FISICO
========================================================= */

function getPhysicalScore(player, stats) {
  const height = safeNumber(
    player?.height_cm,
    0
  )

  const weight = safeNumber(
    player?.weight_kg,
    0
  )

  let score = 65


  /* Altezza */

  if (height > 0) {
    const heightDifference =
      height - 170

    score +=
      heightDifference * 0.10
  }


  /* Peso */

  if (weight > 0) {
    const weightDifference =
      weight - 67

    score +=
      weightDifference * 0.06
  }


  /* Performance */

  const performance =
    getRatingBase(stats)

  score +=
    (performance - 65) * 0.12


  return clamp(score)
}


/* =========================================================
   ATTRIBUTI
========================================================= */

function calculateAttributes(player, stats) {

  const base =
    getRatingBase(stats)

  const shooting =
    getGoalScore(stats)

  const passing =
    getAssistScore(stats)

  const physical =
    getPhysicalScore(
      player,
      stats
    )


  let PAC = base
  let SHO = base
  let PAS = base
  let DRI = base
  let DEF = base
  let PHY = physical


  /* =====================================================
     STILE DI GIOCO
  ===================================================== */

  switch (player?.play_style) {

    case 'Veloce':
      PAC += 7
      DRI += 2
      break

    case 'Tecnico':
      DRI += 7
      PAS += 2
      break

    case 'Regista':
      PAS += 7
      DRI += 2
      break

    case 'Difensivo':
      DEF += 7
      PHY += 2
      break

    case 'Offensivo':
      SHO += 5
      DRI += 4
      break

    case 'Fisico':
      PHY += 7
      break

    case 'Completo':
      PAC += 2
      SHO += 2
      PAS += 2
      DRI += 2
      DEF += 2
      PHY += 2
      break

    default:
      break
  }


  /* =====================================================
     STATISTICHE REALI
  ===================================================== */

  SHO +=
    (shooting - 55) * 0.32

  PAS +=
    (passing - 55) * 0.28


  /* =====================================================
     POSIZIONE
  ===================================================== */

  switch (player?.position) {

    case 'Attaccante':

      SHO += 7
      DRI += 4
      PAC += 3

      break


    case 'Centrocampista':

      PAS += 7
      DRI += 4
      SHO += 2

      break


    case 'Difensore':

      DEF += 8
      PHY += 4
      PAS += 3

      break


    case 'Portiere':

      DEF += 8
      PHY += 4

      break


    default:
      break
  }


  return {

    PAC: clamp(PAC),
    SHO: clamp(SHO),
    PAS: clamp(PAS),
    DRI: clamp(DRI),
    DEF: clamp(DEF),
    PHY: clamp(PHY)

  }
}


/* =========================================================
   OVERALL
========================================================= */

function calculateOverall(
  attributes,
  position
) {

  let overall


  /* ATTACCANTE */

  if (position === 'Attaccante') {

    overall =
      attributes.SHO * 0.38 +
      attributes.DRI * 0.24 +
      attributes.PAC * 0.18 +
      attributes.PAS * 0.10 +
      attributes.PHY * 0.10

  }


  /* CENTROCAMPISTA */

  else if (
    position === 'Centrocampista'
  ) {

    overall =
      attributes.PAS * 0.34 +
      attributes.DRI * 0.24 +
      attributes.SHO * 0.14 +
      attributes.DEF * 0.14 +
      attributes.PAC * 0.07 +
      attributes.PHY * 0.07

  }


  /* DIFENSORE */

  else if (
    position === 'Difensore'
  ) {

    overall =
      attributes.DEF * 0.40 +
      attributes.PHY * 0.24 +
      attributes.PAC * 0.14 +
      attributes.PAS * 0.14 +
      attributes.DRI * 0.08

  }


  /* PORTIERE */

  else if (
    position === 'Portiere'
  ) {

    overall =
      attributes.DEF * 0.45 +
      attributes.PHY * 0.25 +
      attributes.PAS * 0.15 +
      attributes.PAC * 0.15

  }


  /* POSIZIONE NON DEFINITA */

  else {

    overall =
      attributes.PAS * 0.25 +
      attributes.DEF * 0.20 +
      attributes.DRI * 0.20 +
      attributes.SHO * 0.15 +
      attributes.PAC * 0.10 +
      attributes.PHY * 0.10

  }


  return clamp(overall)
}


/* =========================================================
   RARITÀ AUTOMATICA
========================================================= */

function getRarity(overall) {

  if (overall >= 96) {
    return 'prime'
  }

  if (overall >= 89) {
    return 'toty'
  }

  if (overall >= 85) {
    return 'totw'
  }

  if (overall >= 72) {
    return 'gold'
  }

  if (overall >= 64) {
    return 'silver'
  }

  return 'bronze'
}


/* =========================================================
   VALIDAZIONE PREVIEW
========================================================= */

function getPreviewRarity(previewRarity) {

  const validRarities = [
    'bronze',
    'silver',
    'gold',
    'totw',
    'toty',
    'prime'
  ]

  if (
    validRarities.includes(
      previewRarity
    )
  ) {
    return previewRarity
  }

  return null
}


/* =========================================================
   FORM
========================================================= */

function getForm(
  playerId,
  matches
) {

  const ratings = matches
    .map(match => {

      const mp =
        match.match_players?.find(
          x =>
            x.player_id === playerId
        )

      return mp?.rating != null
        ? Number(mp.rating)
        : null
    })
    .filter(value =>
      Number.isFinite(value)
    )
    .slice(0, 5)


  if (!ratings.length) {
    return 70
  }


  const average =
    ratings.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / ratings.length


  return clamp(
    average * 10 + 10
  )
}


/* =========================================================
   PLAYER CARD
========================================================= */

export default function PlayerCard({
  player,
  stats,
  matches = [],
  playerId,

  /*
    previewRarity:

    null / undefined
      = rarità automatica

    'bronze'
    'silver'
    'gold'
    'totw'
    'toty'
    'prime'
      = forza la grafica scelta
  */

  previewRarity = null
}) {

  const data = useMemo(() => {

    /* -----------------------------------------------------
       ATTRIBUTI
    ----------------------------------------------------- */

    const attributes =
      calculateAttributes(
        player,
        stats
      )


    /* -----------------------------------------------------
       OVR PURO
    ----------------------------------------------------- */

    const rawOverall =
      calculateOverall(
        attributes,
        player?.position
      )


    /* -----------------------------------------------------
       STABILIZZAZIONE
    ----------------------------------------------------- */

    const experienceFactor =
      getExperienceFactor(stats)


    const stabilizedOverall =
      65 +
      (
        rawOverall - 65
      ) * experienceFactor


    const overall =
      clamp(
        stabilizedOverall
      )


    /* -----------------------------------------------------
       RARITÀ AUTOMATICA
    ----------------------------------------------------- */

    const automaticRarity =
      getRarity(overall)


    /* -----------------------------------------------------
       RARITÀ PREVIEW
    ----------------------------------------------------- */

    const forcedRarity =
      getPreviewRarity(
        previewRarity
      )


    /*
      Se previewRarity è valida,
      usiamo quella.

      Altrimenti utilizziamo
      la rarità reale.
    */

    const rarity =
      forcedRarity ||
      automaticRarity


    /* -----------------------------------------------------
       FORM
    ----------------------------------------------------- */

    const form =
      getForm(
        playerId,
        matches
      )


    return {

      attributes,

      overall,

      rarity,

      automaticRarity,

      form

    }

  }, [
    player,
    stats,
    matches,
    playerId,
    previewRarity
  ])


  const {
    attributes,
    overall,
    rarity,
    automaticRarity,
    form
  } = data


  /* =====================================================
     POSIZIONE
  ===================================================== */

  const positionShort =
    player?.position === 'Attaccante'
      ? 'ATT'

      : player?.position === 'Centrocampista'
        ? 'CEN'

        : player?.position === 'Difensore'
          ? 'DIF'

          : player?.position === 'Portiere'
            ? 'POR'

            : '---'


  /* =====================================================
     LABEL PREVIEW
  ===================================================== */

  const isPreview =
    Boolean(
      getPreviewRarity(
        previewRarity
      )
    )


  return (

    <div
      className={
        `fifa-card fifa-card-${rarity}`
      }
    >

      {/* =================================================
          GLOW
      ================================================= */}

      <div
        className="fifa-card-glow"
      />


      {/* =================================================
          SHINE
      ================================================= */}

      <div
        className="fifa-card-shine"
      />


      {/* =================================================
          TEXTURE
      ================================================= */}

      <div
        className="fifa-card-noise"
      />


      <div
        className="fifa-card-inner"
      >


        {/* ===============================================
            PREVIEW INDICATOR

            Mostrato solamente quando stai
            testando una rarità.
        =============================================== */}

        {isPreview && (

          <div
            className="fifa-card-preview-badge"
          >
            PREVIEW
          </div>

        )}


        {/* ===============================================
            RATING
        =============================================== */}

        <div
          className="fifa-card-rating"
        >

          <div
            className="fifa-overall"
          >
            {overall}
          </div>


          <div
            className="fifa-position"
          >
            {positionShort}
          </div>


          <div
            className="fifa-form"
          >

            <span>
              FORM
            </span>

            <strong>
              {form}
            </strong>

          </div>

        </div>


        {/* ===============================================
            FOTO
        =============================================== */}

        <div
          className="fifa-player-image"
        >

          <div
            className="fifa-player-photo"
          >

            <Avatar
              player={player}
              size={240}
            />

          </div>

        </div>


        {/* ===============================================
            NOME
        =============================================== */}

        <div
          className="fifa-player-name"
        >

          <span>
            {player?.first_name || ''}
          </span>

          <strong>
            {player?.last_name || ''}
          </strong>

        </div>


        {/* ===============================================
            DIVISORE
        =============================================== */}

        <div
          className="fifa-divider"
        />


        {/* ===============================================
            STATISTICHE
        =============================================== */}

        <div
          className="fifa-stats"
        >

          <FifaStat
            label="PAC"
            value={attributes.PAC}
          />

          <FifaStat
            label="SHO"
            value={attributes.SHO}
          />

          <FifaStat
            label="PAS"
            value={attributes.PAS}
          />

          <FifaStat
            label="DRI"
            value={attributes.DRI}
          />

          <FifaStat
            label="DEF"
            value={attributes.DEF}
          />

          <FifaStat
            label="PHY"
            value={attributes.PHY}
          />

        </div>


        {/* ===============================================
            FOOTER
        =============================================== */}

        <div
          className="fifa-card-footer"
        >

          <span>
            {player?.preferred_foot || '—'}
          </span>

          <span>
            {player?.play_style || 'Completo'}
          </span>

          <span>
            {player?.height_cm
              ? `${player.height_cm} CM`
              : '—'}
          </span>

        </div>


      </div>

    </div>
  )
}


/* =========================================================
   STATISTICA
========================================================= */

function FifaStat({
  label,
  value
}) {

  return (

    <div
      className="fifa-stat"
    >

      <strong>
        {value}
      </strong>

      <span>
        {label}
      </span>

    </div>

  )
}