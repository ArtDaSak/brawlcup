export function createDefaultTournament() {
  return {
    version: 1,
    name: "Copa Brawl Sports Dúos",
    status: "draft",
    prize: "2 pases",
    remoteId: "",
    roundOneByeTeamId: "",
    teams: [],
    luckDraws: [],
    roundSettings: [
      {
        number: 1,
        mode: "Hockey Brawl",
        date: "",
        time: "",
        notes: ""
      },
      {
        number: 2,
        mode: "Basket Brawl",
        date: "",
        time: "",
        notes: ""
      },
      {
        number: 3,
        mode: "Balón Brawl",
        date: "",
        time: "",
        notes: ""
      }
    ],
    rounds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function hydrateTournament(data) {
  const base = createDefaultTournament();

  return {
    ...base,
    ...data,
    teams: Array.isArray(data?.teams) ? data.teams : [],
    luckDraws: Array.isArray(data?.luckDraws) ? data.luckDraws : [],
    rounds: Array.isArray(data?.rounds) ? data.rounds : [],
    roundSettings: base.roundSettings.map((round, index) => ({
      ...round,
      ...(data?.roundSettings?.[index] || {})
    }))
  };
}

export function makeId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36)}`;
}

export function randomIndex(max) {
  if (max <= 0) return 0;

  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    return values[0] % max;
  }

  return Math.floor(Math.random() * max);
}

export function shuffle(items) {
  const arr = [...items];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

export function getTeam(tournament, teamId) {
  return tournament.teams.find((team) => team.id === teamId);
}

export function getTeamName(tournament, teamId) {
  return getTeam(tournament, teamId)?.name || "Equipo eliminado";
}

export function addTeam(tournament, payload) {
  const name = payload.name.trim();
  const memberOne = payload.memberOne.trim();
  const memberTwo = payload.memberTwo.trim();
  const notes = payload.notes.trim();

  if (!name || !memberOne || !memberTwo) {
    throw new Error("El equipo necesita nombre y 2 integrantes");
  }

  const exists = tournament.teams.some(
    (team) => team.name.toLowerCase() === name.toLowerCase()
  );

  if (exists) {
    throw new Error("Ya existe un dúo con ese nombre");
  }

  tournament.teams.push({
    id: makeId("team"),
    name,
    memberOne,
    memberTwo,
    notes,
    createdAt: new Date().toISOString()
  });

  touch(tournament);
}

export function removeTeam(tournament, teamId) {
  tournament.teams = tournament.teams.filter((team) => team.id !== teamId);
  touch(tournament);
}

export function updateRoundSchedule(tournament, roundNumber, field, value) {
  const round = tournament.roundSettings.find(
    (item) => item.number === Number(roundNumber)
  );

  if (!round) return;

  round[field] = value;
  touch(tournament);
}

export function drawRoundOneBye(tournament) {
  if (tournament.rounds.length > 0) {
    throw new Error("No puedes sortear después de crear la Ronda 1");
  }

  if (tournament.teams.length < 3) {
    throw new Error("Necesitas al menos 3 dúos para que tenga sentido un descanso");
  }

  if (tournament.teams.length % 2 === 0) {
    throw new Error("No hay descanso porque la cantidad de equipos es par");
  }

  if (tournament.roundOneByeTeamId) {
    return tournament.roundOneByeTeamId;
  }

  const candidates = tournament.teams.map((team) => team.id);
  const winnerTeamId = candidates[randomIndex(candidates.length)];

  const draw = {
    id: makeId("draw"),
    roundNumber: 1,
    type: "round_one_bye",
    winnerTeamId,
    candidates,
    code: createDrawCode(),
    createdAt: new Date().toISOString()
  };

  tournament.roundOneByeTeamId = winnerTeamId;
  tournament.luckDraws.unshift(draw);

  touch(tournament);

  return winnerTeamId;
}

export function resetRoundOneDraw(tournament) {
  if (tournament.rounds.length > 0) {
    throw new Error("No puedes reiniciar el sorteo después de crear rondas");
  }

  tournament.roundOneByeTeamId = "";
  tournament.luckDraws = tournament.luckDraws.filter(
    (draw) => draw.type !== "round_one_bye"
  );

  touch(tournament);
}

function createDrawCode() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);

  const entropy = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `R1-${stamp}-${entropy}`;
}

export function canGenerateNextRound(tournament) {
  if (tournament.rounds.length >= 3) return false;
  if (tournament.teams.length < 2) return false;

  const previous = tournament.rounds[tournament.rounds.length - 1];

  if (!previous) return true;

  return previous.matches.every(
    (match) => match.type === "bye" || match.winnerTeamId
  );
}

export function generateNextRound(tournament) {
  if (tournament.teams.length < 2) {
    throw new Error("Necesitas al menos 2 dúos");
  }

  if (tournament.rounds.length >= 3) {
    throw new Error("Ya están creadas las 3 rondas oficiales");
  }

  if (!canGenerateNextRound(tournament)) {
    throw new Error("Completa la ronda anterior antes de crear la siguiente");
  }

  const roundNumber = tournament.rounds.length + 1;
  const roundConfig = tournament.roundSettings[roundNumber - 1];

  let teamIds = tournament.teams.map((team) => team.id);
  let byeTeamId = "";

  if (teamIds.length % 2 === 1) {
    if (roundNumber === 1) {
      byeTeamId = tournament.roundOneByeTeamId || drawRoundOneBye(tournament);
    } else {
      byeTeamId = selectLaterRoundBye(tournament);
    }

    teamIds = teamIds.filter((id) => id !== byeTeamId);
  }

  const pairs =
    roundNumber === 1
      ? createRandomPairs(teamIds)
      : createScoreBasedPairs(tournament, teamIds);

  const matches = pairs.map(([teamAId, teamBId]) =>
    createMatch(teamAId, teamBId)
  );

  if (byeTeamId) {
    matches.push({
      id: makeId("match"),
      type: "bye",
      byeTeamId
    });
  }

  tournament.rounds.push({
    id: makeId("round"),
    number: roundNumber,
    mode: roundConfig.mode,
    date: roundConfig.date,
    time: roundConfig.time,
    notes: roundConfig.notes,
    byeTeamId,
    matches,
    createdAt: new Date().toISOString()
  });

  touch(tournament);
}

function createRandomPairs(teamIds) {
  const shuffled = shuffle(teamIds);
  const pairs = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1]]);
  }

  return pairs;
}

function createScoreBasedPairs(tournament, teamIds) {
  const standings = calculateStandings(tournament);
  const scoreMap = new Map(standings.map((row) => [row.teamId, row]));

  let pool = shuffle(teamIds).sort((a, b) => {
    const teamA = scoreMap.get(a);
    const teamB = scoreMap.get(b);

    return (
      teamB.points - teamA.points ||
      teamB.wins - teamA.wins ||
      teamB.extraPoints - teamA.extraPoints
    );
  });

  const pairs = [];

  while (pool.length > 1) {
    const teamA = pool.shift();

    const options = pool.map((teamB, index) => ({
      teamB,
      index,
      repeated: havePlayed(tournament, teamA, teamB),
      difference: Math.abs(
        (scoreMap.get(teamA)?.points || 0) -
        (scoreMap.get(teamB)?.points || 0)
      )
    }));

    let available = options.filter((option) => !option.repeated);

    if (!available.length) {
      available = options;
    }

    available.sort((a, b) => a.difference - b.difference);

    const selected = available[0];
    const teamB = pool.splice(selected.index, 1)[0];

    pairs.push([teamA, teamB]);
  }

  return pairs;
}

function createMatch(teamAId, teamBId) {
  return {
    id: makeId("match"),
    type: "match",
    teamAId,
    teamBId,
    winnerTeamId: "",
    perfectWinner: false,
    stats: {
      [teamAId]: createEmptyStats(),
      [teamBId]: createEmptyStats()
    },
    notes: ""
  };
}

function createEmptyStats() {
  return {
    trickOrThreeRebounds: 0,
    infiltration: 0,
    passAndScore: 0
  };
}

function selectLaterRoundBye(tournament) {
  const standings = calculateStandings(tournament);

  let candidates = standings.filter((row) => row.byes === 0);

  if (!candidates.length) {
    candidates = standings;
  }

  const lowestPoints = Math.min(...candidates.map((row) => row.points));

  const lowestCandidates = candidates.filter(
    (row) => row.points === lowestPoints
  );

  return lowestCandidates[randomIndex(lowestCandidates.length)].teamId;
}

export function updateMatchWinner(tournament, roundId, matchId, winnerTeamId) {
  const match = findMatch(tournament, roundId, matchId);
  if (!match || match.type === "bye") return;

  match.winnerTeamId = winnerTeamId;

  if (!winnerTeamId) {
    match.perfectWinner = false;
  }

  touch(tournament);
}

export function updatePerfectWinner(tournament, roundId, matchId, value) {
  const match = findMatch(tournament, roundId, matchId);

  if (!match || match.type === "bye") return;

  if (value && !match.winnerTeamId) {
    throw new Error("Primero selecciona el ganador");
  }

  match.perfectWinner = Boolean(value);
  touch(tournament);
}

export function updateMatchStat(
  tournament,
  roundId,
  matchId,
  teamId,
  statKey,
  value
) {
  const match = findMatch(tournament, roundId, matchId);

  if (!match || match.type === "bye") return;

  if (!match.stats[teamId]) {
    match.stats[teamId] = createEmptyStats();
  }

  match.stats[teamId][statKey] = Math.max(0, Math.min(9, Number(value) || 0));

  touch(tournament);
}

function findMatch(tournament, roundId, matchId) {
  const round = tournament.rounds.find((item) => item.id === roundId);
  return round?.matches.find((item) => item.id === matchId);
}

export function resetRounds(tournament) {
  tournament.rounds = [];
  tournament.roundOneByeTeamId = "";
  tournament.luckDraws = [];
  touch(tournament);
}

export function calculateTeamExtra(stats = {}) {
  const raw =
    Number(stats.trickOrThreeRebounds || 0) * 2 +
    Number(stats.infiltration || 0) +
    Number(stats.passAndScore || 0);

  return Math.min(4, raw);
}

export function calculateSpecialActions(stats = {}) {
  return (
    Number(stats.trickOrThreeRebounds || 0) +
    Number(stats.infiltration || 0) +
    Number(stats.passAndScore || 0)
  );
}

export function calculateStandings(tournament) {
  const map = new Map();

  tournament.teams.forEach((team) => {
    map.set(team.id, {
      teamId: team.id,
      name: team.name,
      memberOne: team.memberOne,
      memberTwo: team.memberTwo,
      points: 0,
      wins: 0,
      losses: 0,
      byes: 0,
      extraPoints: 0,
      specialActions: 0
    });
  });

  tournament.rounds.forEach((round) => {
    round.matches.forEach((match) => {
      if (match.type === "bye") {
        const team = map.get(match.byeTeamId);

        if (team) {
          team.points += 3;
          team.byes += 1;
        }

        return;
      }

      if (!match.winnerTeamId) return;

      const teamA = map.get(match.teamAId);
      const teamB = map.get(match.teamBId);

      if (!teamA || !teamB) return;

      [teamA, teamB].forEach((team) => {
        const stats = match.stats[team.teamId] || {};
        const extra = calculateTeamExtra(stats);

        team.points += extra;
        team.extraPoints += extra;
        team.specialActions += calculateSpecialActions(stats);
      });

      const winner = map.get(match.winnerTeamId);
      const loser = match.winnerTeamId === match.teamAId ? teamB : teamA;

      winner.points += 5;
      winner.wins += 1;
      loser.losses += 1;

      if (match.perfectWinner) {
        winner.points += 1;
      }
    });
  });

  return [...map.values()].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;

    const direct = directWinner(tournament, a.teamId, b.teamId);

    if (direct === a.teamId) return -1;
    if (direct === b.teamId) return 1;

    if (a.byes !== b.byes) return a.byes - b.byes;
    if (b.extraPoints !== a.extraPoints) return b.extraPoints - a.extraPoints;
    if (b.specialActions !== a.specialActions) {
      return b.specialActions - a.specialActions;
    }

    return a.name.localeCompare(b.name);
  });
}

function havePlayed(tournament, teamAId, teamBId) {
  return tournament.rounds.some((round) =>
    round.matches.some((match) => {
      if (match.type === "bye") return false;

      return (
        (match.teamAId === teamAId && match.teamBId === teamBId) ||
        (match.teamAId === teamBId && match.teamBId === teamAId)
      );
    })
  );
}

function directWinner(tournament, teamAId, teamBId) {
  for (const round of tournament.rounds) {
    for (const match of round.matches) {
      if (match.type === "bye" || !match.winnerTeamId) continue;

      const sameMatch =
        (match.teamAId === teamAId && match.teamBId === teamBId) ||
        (match.teamAId === teamBId && match.teamBId === teamAId);

      if (sameMatch) {
        return match.winnerTeamId;
      }
    }
  }

  return "";
}

function touch(tournament) {
  tournament.updatedAt = new Date().toISOString();
}
