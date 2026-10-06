function getStats(context) {
  return context?.stats || {}
}

function getHistory(context) {
  return Array.isArray(context?.history)
    ? context.history
    : []
}

function getPlayerId(context) {
  return context?.playerId || null
}

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/*
 * ============================================================
 * MATCH PLAYER
 * ============================================================
 */

function getPlayerMatch(match, playerId) {
  return (
    match?.match_players?.find(
      mp => mp.player_id === playerId
    ) || null
  )
}

/*
 * ============================================================
 * SQUADRA DEL GIOCATORE
 * ============================================================
 *
 * Supportiamo diversi nomi possibili del campo.
 * Normalmente dovrebbe essere "team" con valore A/B.
 */

function normalizeTeam(value) {
  if (value === null || value === undefined) {
    return null
  }

  const v = String(value)
    .trim()
    .toLowerCase()

  if (
    v === 'a' ||
    v === 'team_a' ||
    v === 'team a'
  ) {
    return 'A'
  }

  if (
    v === 'b' ||
    v === 'team_b' ||
    v === 'team b'
  ) {
    return 'B'
  }

  return null
}

function getPlayerTeam(match, playerId) {
  const mp = getPlayerMatch(
    match,
    playerId
  )

  if (!mp) {
    return null
  }

  if (
    mp.team_a === true ||
    mp.is_team_a === true
  ) {
    return 'A'
  }

  if (
    mp.team_b === true ||
    mp.is_team_b === true
  ) {
    return 'B'
  }

  return normalizeTeam(
    mp.team ??
      mp.team_id ??
      mp.side ??
      mp.team_name
  )
}

/*
 * ============================================================
 * RISULTATO DELLA PARTITA
 * ============================================================
 */

function getTeamScore(match, team) {
  if (team === 'A') {
    return num(match?.score_a)
  }

  if (team === 'B') {
    return num(match?.score_b)
  }

  return null
}

function getPlayerResult(match, playerId) {
  const team =
    getPlayerTeam(match, playerId)

  if (!team) {
    return null
  }

  const ownScore =
    getTeamScore(match, team)

  const opponentScore =
    getTeamScore(
      match,
      team === 'A' ? 'B' : 'A'
    )

  if (
    ownScore === null ||
    opponentScore === null
  ) {
    return null
  }

  return {
    team,
    ownScore,
    opponentScore,
    win: ownScore > opponentScore,
    draw: ownScore === opponentScore,
    loss: ownScore < opponentScore
  }
}

/*
 * ============================================================
 * GOL E ASSIST
 * ============================================================
 */

function getGoals(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  if (!playerId) {
    return 0
  }

  return history.reduce(
    (total, match) => {
      const goals =
        Array.isArray(match?.goals)
          ? match.goals
          : []

      return (
        total +
        goals.filter(
          goal =>
            goal?.scorer_id === playerId &&
            !goal?.own_goal
        ).length
      )
    },
    0
  )
}

function getAssists(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  if (!playerId) {
    return 0
  }

  return history.reduce(
    (total, match) => {
      const goals =
        Array.isArray(match?.goals)
          ? match.goals
          : []

      return (
        total +
        goals.filter(
          goal =>
            goal?.assist_id === playerId
        ).length
      )
    },
    0
  )
}

/*
 * ============================================================
 * PRESENZE
 * ============================================================
 */

function getAppearances(context) {
  return getHistory(context).length
}

/*
 * ============================================================
 * MEDIA VOTO
 * ============================================================
 */

function getAverageRating(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  const ratings = history
    .map(match => {
      const mp =
        getPlayerMatch(
          match,
          playerId
        )

      return mp?.rating
    })
    .filter(
      rating =>
        rating !== null &&
        rating !== undefined &&
        Number.isFinite(Number(rating))
    )
    .map(Number)

  if (!ratings.length) {
    return 0
  }

  const total = ratings.reduce(
    (sum, rating) =>
      sum + rating,
    0
  )

  return total / ratings.length
}

/*
 * ============================================================
 * MVP
 * ============================================================
 *
 * Se match_players contiene un campo MVP lo leggiamo
 * direttamente dallo storico.
 *
 * Se invece il tuo database conserva l'MVP solamente
 * in player_stats, utilizziamo quel valore come fallback.
 */

function isPlayerMvp(match, playerId) {
  const mp =
    getPlayerMatch(
      match,
      playerId
    )

  if (!mp) {
    return false
  }

  return Boolean(
    mp.mvp === true ||
    mp.is_mvp === true ||
    mp.man_of_match === true ||
    mp.is_man_of_match === true
  )
}

function getMvp(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  const hasMvpField =
    history.some(match =>
      Array.isArray(
        match?.match_players
      )
        ? match.match_players.some(
            mp =>
              Object.prototype.hasOwnProperty.call(
                mp,
                'mvp'
              ) ||
              Object.prototype.hasOwnProperty.call(
                mp,
                'is_mvp'
              ) ||
              Object.prototype.hasOwnProperty.call(
                mp,
                'man_of_match'
              ) ||
              Object.prototype.hasOwnProperty.call(
                mp,
                'is_man_of_match'
              )
          )
        : false
    )

  if (hasMvpField) {
    return history.filter(
      match =>
        isPlayerMvp(
          match,
          playerId
        )
    ).length
  }

  return num(
    getStats(context).mvp
  )
}

/*
 * ============================================================
 * ORDINE DEI GOL
 * ============================================================
 *
 * Proviamo a usare:
 *
 * minute
 * goal_minute
 * created_at
 * timestamp
 * id
 *
 * Se nessuno di questi esiste, manteniamo l'ordine
 * restituito da Supabase.
 */

function getOrderedGoals(match) {
  const goals = Array.isArray(
    match?.goals
  )
    ? [...match.goals]
    : []

  const hasMinute = goals.some(
    goal =>
      goal?.minute !== undefined ||
      goal?.goal_minute !== undefined
  )

  const hasDate = goals.some(
    goal =>
      goal?.created_at ||
      goal?.timestamp
  )

  if (hasMinute) {
    return goals.sort(
      (a, b) => {
        const aMinute = num(
          a?.minute ??
            a?.goal_minute
        )

        const bMinute = num(
          b?.minute ??
            b?.goal_minute
        )

        return aMinute - bMinute
      }
    )
  }

  if (hasDate) {
    return goals.sort(
      (a, b) => {
        const aDate = new Date(
          a?.created_at ??
            a?.timestamp
        ).getTime()

        const bDate = new Date(
          b?.created_at ??
            b?.timestamp
        ).getTime()

        return aDate - bDate
      }
    )
  }

  return goals
}

/*
 * ============================================================
 * HAT-TRICK
 * ============================================================
 */

function hasHatTrick(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  return history.some(match => {
    const goals =
      Array.isArray(match?.goals)
        ? match.goals
        : []

    const playerGoals =
      goals.filter(
        goal =>
          goal?.scorer_id === playerId &&
          !goal?.own_goal
      )

    return playerGoals.length >= 3
  })
}

/*
 * ============================================================
 * 3 ASSIST
 * ============================================================
 */

function hasThreeAssists(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  return history.some(match => {
    const goals =
      Array.isArray(match?.goals)
        ? match.goals
        : []

    const playerAssists =
      goals.filter(
        goal =>
          goal?.assist_id === playerId
      )

    return playerAssists.length >= 3
  })
}

/*
 * ============================================================
 * 5 VITTORIE CONSECUTIVE
 * ============================================================
 */

function hasFiveWinsStreak(context) {
  const history = [
    ...getHistory(context)
  ]
    .sort(
      (a, b) =>
        new Date(a.kickoff) -
        new Date(b.kickoff)
    )

  const playerId =
    getPlayerId(context)

  let streak = 0

  for (const match of history) {
    const result =
      getPlayerResult(
        match,
        playerId
      )

    if (!result) {
      streak = 0
      continue
    }

    if (result.win) {
      streak += 1

      if (streak >= 5) {
        return true
      }
    } else {
      streak = 0
    }
  }

  return false
}

/*
 * ============================================================
 * CLUTCH
 * ============================================================
 *
 * Il giocatore ha segnato un gol durante una vittoria
 * che ha dato alla sua squadra un vantaggio destinato
 * a rimanere fino al termine della partita.
 */

function hasDecisiveGoal(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  for (const match of history) {
    const result =
      getPlayerResult(
        match,
        playerId
      )

    if (!result?.win) {
      continue
    }

    const team =
      result.team

    const goals =
      getOrderedGoals(match)

    if (!goals.length) {
      continue
    }

    let scoreA = 0
    let scoreB = 0

    for (let i = 0; i < goals.length; i++) {
      const goal = goals[i]

      if (goal?.own_goal) {
        continue
      }

      const scorerId =
        goal?.scorer_id

      const goalTeam =
        getGoalTeam(
          match,
          scorerId
        )

      if (!goalTeam) {
        continue
      }

      if (goalTeam === 'A') {
        scoreA += 1
      } else if (goalTeam === 'B') {
        scoreB += 1
      }

      if (
        scorerId === playerId &&
        goalTeam === team
      ) {
        const currentlyWinning =
          team === 'A'
            ? scoreA > scoreB
            : scoreB > scoreA

        if (!currentlyWinning) {
          continue
        }

        let staysAhead = true

        for (
          let j = i + 1;
          j < goals.length;
          j++
        ) {
          const laterGoal =
            goals[j]

          if (laterGoal?.own_goal) {
            continue
          }

          const laterTeam =
            getGoalTeam(
              match,
              laterGoal?.scorer_id
            )

          if (!laterTeam) {
            continue
          }

          if (laterTeam === 'A') {
            scoreA += 1
          } else if (
            laterTeam === 'B'
          ) {
            scoreB += 1
          }

          const stillWinning =
            team === 'A'
              ? scoreA > scoreB
              : scoreB > scoreA

          if (!stillWinning) {
            staysAhead = false
            break
          }
        }

        if (staysAhead) {
          return true
        }
      }
    }
  }

  return false
}

/*
 * ============================================================
 * SQUADRA DI CHI HA SEGNATO
 * ============================================================
 */

function getGoalTeam(
  match,
  scorerId
) {
  if (!scorerId) {
    return null
  }

  return getPlayerTeam(
    match,
    scorerId
  )
}

/*
 * ============================================================
 * CLEAN SHEET
 * ============================================================
 */

function hasCleanSheet(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  return history.some(match => {
    const result =
      getPlayerResult(
        match,
        playerId
      )

    if (!result) {
      return false
    }

    return (
      result.win &&
      result.opponentScore === 0
    )
  })
}

/*
 * ============================================================
 * RIMONTA
 * ============================================================
 *
 * La squadra del giocatore deve essere stata sotto
 * almeno una volta durante la partita e deve poi aver
 * vinto la partita.
 */

function hasComeback(context) {
  const history = getHistory(context)
  const playerId = getPlayerId(context)

  for (const match of history) {
    const result =
      getPlayerResult(
        match,
        playerId
      )

    if (!result?.win) {
      continue
    }

    const goals =
      getOrderedGoals(match)

    if (!goals.length) {
      continue
    }

    let scoreA = 0
    let scoreB = 0
    let wasBehind = false

    for (const goal of goals) {
      if (goal?.own_goal) {
        continue
      }

      const team =
        getGoalTeam(
          match,
          goal?.scorer_id
        )

      if (team === 'A') {
        scoreA += 1
      }

      if (team === 'B') {
        scoreB += 1
      }

      if (result.team === 'A') {
        if (scoreA < scoreB) {
          wasBehind = true
        }
      }

      if (result.team === 'B') {
        if (scoreB < scoreA) {
          wasBehind = true
        }
      }
    }

    if (wasBehind) {
      return true
    }
  }

  return false
}

/*
 * ============================================================
 * BADGE DEFINITIONS
 * ============================================================
 */

const PLATINUM_TARGET = 19

export const BADGES = [
  {
    id: 'primo-gol',
    name: 'Primo Gol',
    category: 'Gol',
    description: 'Segna il tuo primo gol.',
    image: '/badges/primo-gol.png',

    target: 1,

    requirement: context =>
      getGoals(context) >= 1,

    progress: context =>
      Math.min(
        getGoals(context),
        1
      ),

    progressLabel: context =>
      `${Math.min(
        getGoals(context),
        1
      )} / 1`
  },

  {
    id: 'bomber',
    name: 'Bomber',
    category: 'Gol',
    description: 'Segna almeno 10 gol.',
    image: '/badges/bomber.png',

    target: 10,

    requirement: context =>
      getGoals(context) >= 10,

    progress: context =>
      Math.min(
        getGoals(context),
        10
      ),

    progressLabel: context =>
      `${Math.min(
        getGoals(context),
        10
      )} / 10`
  },

  {
    id: 'cannoniere',
    name: 'Cannoniere',
    category: 'Gol',
    description: 'Segna almeno 25 gol.',
    image: '/badges/cannoniere.png',

    target: 25,

    requirement: context =>
      getGoals(context) >= 25,

    progress: context =>
      Math.min(
        getGoals(context),
        25
      ),

    progressLabel: context =>
      `${Math.min(
        getGoals(context),
        25
      )} / 25`
  },

  {
    id: 'rapace',
    name: 'Rapace',
    category: 'Gol',
    description: 'Realizza una tripletta.',
    image: '/badges/rapace.png',

    target: 1,

    requirement: hasHatTrick,

    progress: context =>
      hasHatTrick(context) ? 1 : 0,

    progressLabel: context =>
      hasHatTrick(context)
        ? 'Completato'
        : 'Realizza una tripletta'
  },

  {
    id: 'assistman',
    name: 'Assistman',
    category: 'Assist',
    description: 'Realizza almeno 10 assist.',
    image: '/badges/assistman.png',

    target: 10,

    requirement: context =>
      getAssists(context) >= 10,

    progress: context =>
      Math.min(
        getAssists(context),
        10
      ),

    progressLabel: context =>
      `${Math.min(
        getAssists(context),
        10
      )} / 10`
  },

  {
    id: 'playmaker',
    name: 'Playmaker',
    category: 'Assist',
    description: 'Realizza almeno 25 assist.',
    image: '/badges/playmaker.png',

    target: 25,

    requirement: context =>
      getAssists(context) >= 25,

    progress: context =>
      Math.min(
        getAssists(context),
        25
      ),

    progressLabel: context =>
      `${Math.min(
        getAssists(context),
        25
      )} / 25`
  },

  {
    id: 'regista',
    name: 'Regista',
    category: 'Assist',
    description: 'Realizza 3 assist nella stessa partita.',
    image: '/badges/regista.png',

    target: 1,

    requirement: hasThreeAssists,

    progress: context =>
      hasThreeAssists(context)
        ? 1
        : 0,

    progressLabel: context =>
      hasThreeAssists(context)
        ? 'Completato'
        : '3 assist in una partita'
  },

  {
    id: 'mvp',
    name: 'MVP',
    category: 'Prestazioni',
    description: 'Vinci il premio MVP per la prima volta.',
    image: '/badges/mvp.png',

    target: 1,

    requirement: context =>
      getMvp(context) >= 1,

    progress: context =>
      Math.min(
        getMvp(context),
        1
      ),

    progressLabel: context =>
      `${Math.min(
        getMvp(context),
        1
      )} / 1`
  },

  {
    id: 'uomo-partita',
    name: 'Uomo Partita',
    category: 'Prestazioni',
    description: 'Ottieni almeno 5 MVP.',
    image: '/badges/uomo-partita.png',

    target: 5,

    requirement: context =>
      getMvp(context) >= 5,

    progress: context =>
      Math.min(
        getMvp(context),
        5
      ),

    progressLabel: context =>
      `${Math.min(
        getMvp(context),
        5
      )} / 5`
  },

  {
    id: 'fenomeno',
    name: 'Fenomeno',
    category: 'Prestazioni',
    description: 'Ottieni almeno 10 MVP.',
    image: '/badges/fenomeno.png',

    target: 10,

    requirement: context =>
      getMvp(context) >= 10,

    progress: context =>
      Math.min(
        getMvp(context),
        10
      ),

    progressLabel: context =>
      `${Math.min(
        getMvp(context),
        10
      )} / 10`
  },

  {
    id: '7-plus',
    name: '7+',
    category: 'Prestazioni',
    description: 'Mantieni una media voto di almeno 7.',
    image: '/badges/7-plus.png',

    target: 7,

    requirement: context =>
      getAverageRating(context) >= 7,

    progress: context =>
      Math.min(
        getAverageRating(context),
        7
      ),

    progressLabel: context =>
      `${getAverageRating(context).toFixed(1)} / 7`
  },

  {
    id: 'esordiente',
    name: 'Esordiente',
    category: 'Presenze',
    description: 'Gioca la tua prima partita.',
    image: '/badges/esordiente.png',

    target: 1,

    requirement: context =>
      getAppearances(context) >= 1,

    progress: context =>
      Math.min(
        getAppearances(context),
        1
      ),

    progressLabel: context =>
      `${Math.min(
        getAppearances(context),
        1
      )} / 1`
  },

  {
    id: 'veterano',
    name: 'Veterano',
    category: 'Presenze',
    description: 'Raggiungi 15 presenze.',
    image: '/badges/veterano.png',

    target: 15,

    requirement: context =>
      getAppearances(context) >= 15,

    progress: context =>
      Math.min(
        getAppearances(context),
        15
      ),

    progressLabel: context =>
      `${Math.min(
        getAppearances(context),
        15
      )} / 15`
  },

  {
    id: 'bandiera',
    name: 'Bandiera',
    category: 'Presenze',
    description: 'Raggiungi 30 presenze.',
    image: '/badges/bandiera.png',

    target: 30,

    requirement: context =>
      getAppearances(context) >= 30,

    progress: context =>
      Math.min(
        getAppearances(context),
        30
      ),

    progressLabel: context =>
      `${Math.min(
        getAppearances(context),
        30
      )} / 30`
  },

  {
    id: 'fedelissimo',
    name: 'Fedelissimo',
    category: 'Presenze',
    description: 'Raggiungi 50 presenze.',
    image: '/badges/fedelissimo.png',

    target: 50,

    requirement: context =>
      getAppearances(context) >= 50,

    progress: context =>
      Math.min(
        getAppearances(context),
        50
      ),

    progressLabel: context =>
      `${Math.min(
        getAppearances(context),
        50
      )} / 50`
  },

  {
    id: 'invincibile',
    name: 'Invincibile',
    category: 'Vittorie',
    description: 'Vinci 5 partite consecutive.',
    image: '/badges/invincibile.png',

    target: 1,

    requirement: hasFiveWinsStreak,

    progress: context =>
      hasFiveWinsStreak(context)
        ? 1
        : 0,

    progressLabel: context =>
      hasFiveWinsStreak(context)
        ? 'Completato'
        : '5 vittorie consecutive'
  },

  {
    id: 'clutch',
    name: 'Clutch',
    category: 'Prestazioni',
    description: 'Segna un gol decisivo in una vittoria.',
    image: '/badges/clutch.png',

    target: 1,

    requirement: hasDecisiveGoal,

    progress: context =>
      hasDecisiveGoal(context)
        ? 1
        : 0,

    progressLabel: context =>
      hasDecisiveGoal(context)
        ? 'Completato'
        : 'Segna un gol decisivo'
  },

  {
    id: 'clean-sheet',
    name: 'Clean Sheet',
    category: 'Difesa',
    description: 'Vinci una partita senza subire gol.',
    image: '/badges/clean-sheet.png',

    target: 1,

    requirement: hasCleanSheet,

    progress: context =>
      hasCleanSheet(context)
        ? 1
        : 0,

    progressLabel: context =>
      hasCleanSheet(context)
        ? 'Completato'
        : 'Vittoria senza subire gol'
  },

  {
    id: 'rimonta',
    name: 'Rimonta',
    category: 'Prestazioni',
    description: 'Rimonta uno svantaggio e vinci la partita.',
    image: '/badges/rimonta.png',

    target: 1,

    requirement: hasComeback,

    progress: context =>
      hasComeback(context)
        ? 1
        : 0,

    progressLabel: context =>
      hasComeback(context)
        ? 'Completato'
        : 'Rimonta e vinci'
  },

  {
    id: 'leggenda-del-club',
    name: 'Leggenda del Club',
    category: 'PLATINO',
    description: 'Sblocca tutti gli altri badge del club.',
    image: '/badges/leggenda-del-club.png',

    target: PLATINUM_TARGET,

    platinum: true,

    requirement: context => {
      const otherBadges =
        BADGES.filter(
          badge =>
            badge.id !==
            'leggenda-del-club'
        )

      return (
        otherBadges.length ===
          PLATINUM_TARGET &&
        otherBadges.every(
          badge =>
            badge.requirement(
              context
            )
        )
      )
    },

    progress: context => {
      const otherBadges =
        BADGES.filter(
          badge =>
            badge.id !==
            'leggenda-del-club'
        )

      return otherBadges.filter(
        badge =>
          badge.requirement(
            context
          )
      ).length
    },

    progressLabel: context => {
      const otherBadges =
        BADGES.filter(
          badge =>
            badge.id !==
            'leggenda-del-club'
        )

      const unlocked =
        otherBadges.filter(
          badge =>
            badge.requirement(
              context
            )
        ).length

      return `${unlocked} / ${PLATINUM_TARGET}`
    }
  }
]