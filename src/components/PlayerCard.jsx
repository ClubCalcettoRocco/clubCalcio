import { useId, useMemo, useRef, useState } from 'react'
import { Avatar } from './ui'

export const CARD_STYLE_OPTIONS = [
  { id: 'auto', label: 'Classica', note: 'Stile automatico' },
  { id: 'gold', label: 'Oro', note: 'Gold Rare' },
  { id: 'silver', label: 'Argento', note: 'Silver Rare' },
  { id: 'bronze', label: 'Bronzo', note: 'Bronze Rare' },
  { id: 'totw', label: 'TOTW', note: 'Team of the Week' },
  { id: 'toty', label: 'TOTY', note: 'Team of the Year' },
  { id: 'futurestar', label: 'Future Star', note: 'Future Stars' },
  { id: 'shape', label: 'Shape', note: 'Shapeshifters' },
  { id: 'hero', label: 'Hero', note: 'Ultimate Team Hero' },
  { id: 'prime', label: 'Icona', note: 'Icon Moments' }
]

const CARD_STYLE_LABELS = {
  bronze: 'BRONZO',
  silver: 'ARGENTO',
  gold: 'ORO',
  totw: 'TOTW',
  toty: 'TOTY',
  futurestar: 'FUTURE STAR',
  shape: 'SHAPE',
  hero: 'HERO',
  prime: 'ICONA'
}

const PLAYSTYLE_DETAILS = {
  cassaforte: {
    name: 'Cassaforte',
    description: 'Rende quasi impossibile sottrarre la sfera mentre protegge palla di spalle. Mantiene l’equilibrio anche sotto la pressione dei difensori più fisici.',
    image: '/playstyles/safe.webp'
  },
  batteria: {
    name: 'Batteria',
    description: 'Riduce drasticamente il consumo di resistenza. Mantiene lucidità e reattività anche nei minuti di recupero e ai supplementari.',
    image: '/playstyles/battery.webp'
  },
  lavatrice: {
    name: 'Lavatrice',
    description: 'Ha una corsa caratteristica a testa bassa e un baricentro basso, che riduce l’impatto dei contatti laterali mentre accelera.',
    image: '/playstyles/washer.webp'
  },
  rapido: {
    name: 'Rapido',
    description: 'Mantiene un’elevata velocità di punta negli allunghi palla al piede e nei tagli senza pallone.',
    image: '/playstyles/runner.webp'
  },
  dribbling: {
    name: 'Dribbling',
    description: 'Esegue con fluidità cambi di direzione e finte, rendendo imprevedibile l’uno contro uno.',
    image: '/playstyles/runner.webp'
  },
  primoPasso: {
    name: 'Razzetto',
    description: 'Garantisce un’esplosività eccezionale nei primi metri, permettendo di staccare subito il marcatore.',
    image: '/playstyles/rocket.webp'
  },
  procione: {
    name: 'Ladro',
    description: 'Aumenta il raggio d’azione per intercettare i passaggi e la capacità di leggere in anticipo le traiettorie.',
    image: '/playstyles/raccoon.webp'
  },
  fortuna: {
    name: 'Fortuna',
    description: 'Aumenta la probabilità di vincere rimpalli favorevoli, deviazioni fortunate e giocate decisive.',
    image: '/playstyles/luck.webp'
  },
  tecnica: {
    name: 'Jolly',
    description: 'Esegue con fluidità e rapidità cambi di direzione e finte, rendendo imprevedibile l’uno contro uno.',
    image: '/playstyles/jester.webp'
  },
  tiroAGiro: {
    name: 'Tiro a giro',
    description: 'Dà effetto e precisione ai tiri dal limite o da posizione defilata, rendendo la traiettoria imprevedibile.',
    image: '/playstyles/curve-shot.webp'
  },
  muscoletto: {
    name: 'Muscoletto',
    description: 'Aumenta la forza nei contrasti e la probabilità di vincere i duelli fisici, strappando il pallone agli avversari.',
    image: '/playstyles/muscle.webp'
  },
  scudo: {
    name: 'Guanto',
    description: 'Aumenta riflessi e reattività tra i pali, migliora la presa sui tiri potenti e le uscite ravvicinate.',
    image: '/playstyles/glove.webp'
  },
  passaggioEsterno: {
    name: 'Tiki-Taka',
    description: 'Aumenta la precisione nei passaggi corti e di prima intenzione e la qualità dei filtranti per servire assist.',
    image: '/playstyles/arrows.webp'
  },
  schiena: {
    name: 'Panchinaro',
    description: 'Giocatore con attributi base ridotti, che necessita di minutaggio e allenamento per sbloccare il suo potenziale.',
    image: '/playstyles/schiena.webp'
  },
  tiroPotenza: {
    name: 'Tiro di potenza',
    description: 'Scaglia conclusioni potenti, capaci di impensierire il portiere anche dalla distanza.',
    image: '/playstyles/runner.webp'
  }
}

function normalizePlayerName(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function getAssignedPlaystyle(player) {
  const firstName = normalizePlayerName(player?.first_name)
  const lastName = normalizePlayerName(player?.last_name)
  const fullName = normalizePlayerName(`${player?.first_name || ''} ${player?.last_name || ''}`)

  if (fullName.includes('marco oddone')) return PLAYSTYLE_DETAILS.scudo
  if ((firstName === 'marco c' || fullName === 'marco c') || (firstName === 'marco' && (lastName === 'c' || lastName.startsWith('c ')))) {
    return PLAYSTYLE_DETAILS.cassaforte
  }

  if (fullName.includes('alberto ciaglia')) return PLAYSTYLE_DETAILS.dribbling
  if (fullName.includes('alessandro catalano')) return PLAYSTYLE_DETAILS.cassaforte
  if (fullName.includes('andrea grossi') || fullName.includes('daniele bonelli')) return PLAYSTYLE_DETAILS.batteria
  if (fullName.includes('domenico rosa')) return PLAYSTYLE_DETAILS.lavatrice
  if (fullName.includes('donatello angarola')) return PLAYSTYLE_DETAILS.rapido
  if (fullName.includes('emanuele di santo')) return PLAYSTYLE_DETAILS.primoPasso
  if (fullName.includes('gabriele rescigno')) return PLAYSTYLE_DETAILS.procione
  if (fullName.includes('giuseppe guidone')) return PLAYSTYLE_DETAILS.fortuna
  if (fullName.includes('giuseppe calderola')) return PLAYSTYLE_DETAILS.tecnica
  if (fullName.includes('leonardo ciaglia')) return PLAYSTYLE_DETAILS.tiroAGiro
  if (fullName.includes('loris guglielmi') || fullName.includes('stefano giuzio')) return PLAYSTYLE_DETAILS.muscoletto
  if (fullName.includes('marco oddone')) return PLAYSTYLE_DETAILS.scudo
  if (fullName.includes('marco c')) return PLAYSTYLE_DETAILS.cassaforte
  if (fullName.includes('nazzareno sabia')) return PLAYSTYLE_DETAILS.passaggioEsterno
  if (fullName.includes('paolo musicante')) return PLAYSTYLE_DETAILS.schiena
  if (fullName.includes('simone pomarico')) return PLAYSTYLE_DETAILS.tiroPotenza

  return null
}

function PlaystyleBadge({ playstyle, playerName }) {
  const [open, setOpen] = useState(false)
  const descriptionId = useId()
  const triggerRef = useRef(null)

  if (!playstyle) return null

  return (
    <div className={`fifa-playstyle${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="fifa-playstyle-trigger"
        aria-label={`Playstyle ${playstyle.name} di ${playerName}. Apri spiegazione`}
        aria-expanded={open}
        aria-controls={descriptionId}
        ref={triggerRef}
        onClick={() => setOpen(value => !value)}
        onKeyDown={event => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        <img src={playstyle.image} alt="" loading="lazy" decoding="async" />
      </button>
      <div
        className="fifa-playstyle-info"
        id={descriptionId}
        role="dialog"
        aria-label={`Playstyle ${playstyle.name}`}
        onBlur={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
        }}
      >
        <button
          type="button"
          className="fifa-playstyle-close"
          aria-label="Chiudi spiegazione"
          onClick={() => {
            setOpen(false)
            triggerRef.current?.focus()
          }}
        >
          ×
        </button>
        <strong>{playstyle.name}</strong>
        <p>{playstyle.description}</p>
      </div>
    </div>
  )
}


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
    'auto',
    'bronze',
    'silver',
    'gold',
    'totw',
    'toty',
    'futurestar',
    'shape',
    'hero',
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

    const normalizedName = [player?.first_name, player?.last_name]
      .filter(Boolean)
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLocaleLowerCase('it')
    const isIconaPlayer = normalizedName === 'paolo musicante'
    const isTotyPlayer = normalizedName === 'leonardo ciaglia'

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


    const calculatedOverall =
      clamp(
        stabilizedOverall
      )


    /* -----------------------------------------------------
       RARITÀ AUTOMATICA
    ----------------------------------------------------- */

    const automaticRarity =
      getRarity(calculatedOverall)


    /* -----------------------------------------------------
       RARITÀ PREVIEW
    ----------------------------------------------------- */

    const forcedRarity =
      getPreviewRarity(
        previewRarity
      )
    const storedRarity = getPreviewRarity(player?.card_style)
    const defaultRarity = isIconaPlayer
      ? 'prime'
      : isTotyPlayer
        ? 'toty'
        : automaticRarity
    const selectedRarity = forcedRarity === 'auto'
      ? defaultRarity
      : forcedRarity || (storedRarity && storedRarity !== 'auto' ? storedRarity : defaultRarity)

    // La scelta cambia esclusivamente la grafica della carta.
    const overall = isIconaPlayer ? 99 : calculatedOverall
    const rarity = selectedRarity
    const isIconaCard = rarity === 'prime'
    const isTotyCard = rarity === 'toty'
    const isHeroCard = rarity === 'hero'


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

      isIconaCard,

      isTotyCard,

      isHeroCard,


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
    isIconaCard,
    isHeroCard,
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

  const cardSurname = player?.last_name || player?.first_name || ''
  const assignedPlaystyle = getAssignedPlaystyle(player)
  const fullPlayerName = [player?.first_name, player?.last_name].filter(Boolean).join(' ').trim()
  const surnameFontSize = Math.max(
    15,
    Math.min(28, Math.floor(285 / Math.max(cardSurname.length, 1)))
  )


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
        `fifa-card fifa-card-${rarity}${data.isIconaCard ? ' fifa-card-icona' : ''}${data.isTotyCard ? ' fifa-card-toty-special' : ''}`
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

        <div className={`fifa-card-style-label fifa-card-style-label-${rarity}`}>
          {CARD_STYLE_LABELS[rarity] || 'CLASSICA'}
        </div>


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

          <div className="fifa-form">
            <span>FORMA</span>
            <strong>{form}</strong>
          </div>

          <div
            className="fifa-position"
          >
            {positionShort}
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
          <strong style={{ '--card-surname-font-size': `${surnameFontSize}px` }}>
            {cardSurname}
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
          <span>{player?.play_style || 'Completo'}</span>

        </div>


      </div>

      <PlaystyleBadge playstyle={assignedPlaystyle} playerName={fullPlayerName || 'giocatore'} />

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
