import { CONFIG } from "./config.js";
import {
  hydrateTournament,
  calculateStandings,
  calculateTeamExtra,
  getTeamName
} from "./tournament.js";

import {
  isMockApiConfigured,
  loadTournamentFromMockApi
} from "./api.js";

import "./navigation.js";

const LOCAL_KEY = "copa_brawl_sports_duos_state";
const REMOTE_ID_KEY = "copa_brawl_sports_duos_remote_id";

let tournament = null;

const $ = (selector) => document.querySelector(selector);

init();

window.addEventListener("storage", (e) => {
  if (e.key === LOCAL_KEY) {
    tournament = loadLocalTournament();
    render();
  }
});

async function init() {
  // Primero cargamos de localStorage
  tournament = loadLocalTournament();
  render();

  const configuredId =
    CONFIG.TOURNAMENT_ID || localStorage.getItem(REMOTE_ID_KEY) || "";

  if (configuredId && isMockApiConfigured()) {
    if (tournament.remoteId !== configuredId) {
      tournament.remoteId = configuredId;
      saveLocal();
    }

    try {
      setSyncStatus("Sincronizando...");
      const remote = await loadTournamentFromMockApi(configuredId);
      tournament = hydrateTournament(remote);

      localStorage.setItem(REMOTE_ID_KEY, tournament.remoteId);
      saveLocal();
      setSyncStatus("Sincronizado");
      render();
    } catch (error) {
      setSyncStatus("Error de sincronización");
      toast("Error al cargar estado remoto: " + error.message);
    }

    startPolling(configuredId);
  }
}

function startPolling(configuredId) {
  setInterval(async () => {
    try {
      const remote = await loadTournamentFromMockApi(configuredId);
      const remoteTournament = hydrateTournament(remote);

      if (remoteTournament.updatedAt !== tournament.updatedAt) {
        tournament = remoteTournament;
        saveLocal();
        setSyncStatus("Sincronizado");
        render();
      }
    } catch (error) {
      console.warn("Error checking for updates:", error);
    }
  }, 8000);
}

function loadLocalTournament() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? hydrateTournament(JSON.parse(raw)) : hydrateTournament({});
  } catch {
    return hydrateTournament({});
  }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tournament));
}

function render() {
  if (!tournament) return;
  renderConnection();
  renderSchedule();
  renderTeams();
  renderDraw();
  renderMatchMap();
  renderStandings();
}

function renderConnection() {
  const syncStatusEl = $("#syncStatus");
  if (syncStatusEl) {
    setSyncStatus(
      isMockApiConfigured()
        ? tournament.remoteId
          ? "Conectado"
          : "MockAPI configurado"
        : "Trabajando en modo local"
    );
  }

  const remoteInfoEl = $("#remoteInfo");
  if (remoteInfoEl) {
    remoteInfoEl.innerHTML = tournament.remoteId
      ? `Conectado al torneo remoto <strong>#${escapeHtml(tournament.remoteId)}</strong>`
      : "Trabajando en modo local (Los datos se leen del navegador)";
  }
}

function renderSchedule() {
  $("#roundSchedule").innerHTML = tournament.roundSettings
    .map((round) => {
      const icon =
        round.number === 1
          ? "mdi:hockey-puck"
          : round.number === 2
            ? "mdi:basketball"
            : "mdi:soccer";

      const dateStr = round.date ? formatDate(round.date, "") : "Por definir";
      const timeStr = round.time || "Por definir";

      return `
        <article class="schedule-card">
          <header>
            <iconify-icon icon="${icon}"></iconify-icon>
            <div>
              <strong>Ronda ${round.number}</strong>
              <p class="muted">${escapeHtml(round.mode)}</p>
            </div>
          </header>

          <div>
            <span class="muted" style="font-size:0.8rem; font-weight:800; display:block;">Fecha</span>
            <span style="font-size:0.95rem;">${escapeHtml(dateStr)}</span>
          </div>

          <div>
            <span class="muted" style="font-size:0.8rem; font-weight:800; display:block;">Hora</span>
            <span style="font-size:0.95rem;">${escapeHtml(timeStr)}</span>
          </div>

          <div>
            <span class="muted" style="font-size:0.8rem; font-weight:800; display:block;">Notas</span>
            <span style="font-size:0.9rem; font-style:italic;">${escapeHtml(round.notes || "Sin notas")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderTeams() {
  const container = $("#teamsList");

  if (!tournament.teams.length) {
    container.innerHTML = `<div class="empty">No hay dúos registrados.</div>`;
    return;
  }

  container.innerHTML = tournament.teams
    .map(
      (team, index) => `
      <article class="team-card">
        <div>
          <strong>${index + 1}. ${escapeHtml(team.name)}</strong>
          <small>
            ${escapeHtml(team.memberOne)} + ${escapeHtml(team.memberTwo)}
            ${team.notes ? ` · ${escapeHtml(team.notes)}` : ""}
          </small>
        </div>
      </article>
    `
    )
    .join("");
}

function renderDraw() {
  const container = $("#drawResult");
  const isOdd = tournament.teams.length % 2 === 1;
  const draw = tournament.luckDraws.find(
    (item) => item.type === "round_one_bye"
  );

  if (tournament.teams.length < 3) {
    container.innerHTML = `<div class="empty">Se necesitan mínimo 3 dúos para que exista descanso.</div>`;
    return;
  }

  if (!isOdd) {
    container.innerHTML = `<div class="empty">La cantidad de dúos es par. No hay descansos en Ronda 1.</div>`;
    return;
  }

  if (!draw) {
    container.innerHTML = `
      <div class="rule-note">
        <strong>Candidatos al descanso:</strong>
        <p class="muted">${tournament.teams.map((team) => escapeHtml(team.name)).join(", ")}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="rule-note">
      <strong>Descansa en Ronda 1:</strong>
      <p class="cyan" style="font-weight:900; font-size:1.1rem; margin:0.3rem 0;">${escapeHtml(getTeamName(tournament, draw.winnerTeamId))}</p>
      <p class="muted" style="font-size:0.8rem; margin:0;">
        Código del sorteo: ${escapeHtml(draw.code)}
      </p>
    </div>
  `;
}

function renderMatchMap() {
  const container = $("#matchMap");

  if (!tournament.rounds.length) {
    container.innerHTML = `
      <div class="empty">
        Aún no hay rondas creadas en el torneo.
      </div>
    `;
    return;
  }

  const columns = [1, 2, 3].map((roundNumber) => {
    const round = tournament.rounds.find((item) => item.number === roundNumber);
    const config = tournament.roundSettings[roundNumber - 1];

    if (!round) {
      return `
        <section class="round-column">
          <header>
            <div>
              <h3>Ronda ${roundNumber}</h3>
              <p class="muted">${escapeHtml(config.mode)}</p>
            </div>
            <iconify-icon icon="mdi:lock-outline"></iconify-icon>
          </header>

          <div class="empty">Pendiente</div>
        </section>
      `;
    }

    return `
      <section class="round-column">
        <header>
          <div>
            <h3>Ronda ${round.number}</h3>
            <p class="muted">
              ${escapeHtml(round.mode)}
              ${round.date ? ` · ${formatDate(round.date, round.time)}` : ""}
            </p>
          </div>

          <iconify-icon icon="${getRoundIcon(round.number)}"></iconify-icon>
        </header>

        ${round.matches.map((match) => renderMatch(round, match)).join("")}
      </section>
    `;
  });

  container.innerHTML = columns.join("");
}

function renderStandings() {
  const standings = calculateStandings(tournament);
  const tbody = $("#standingsTable");

  if (!standings.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="empty">No hay equipos registrados</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = standings
    .map(
      (row, index) => `
      <tr>
        <td class="rank">${index + 1}</td>
        <td>
          <strong>${escapeHtml(row.name)}</strong>
          <br>
          <small class="muted">${escapeHtml(row.memberOne)} + ${escapeHtml(row.memberTwo)}</small>
          <div class="mobile-stats-summary">
            V: ${row.wins} · D: ${row.losses} · Desc: ${row.byes} · Ext: +${row.extraPoints} · Esp: ${row.specialActions}
          </div>
        </td>
        <td class="cyan">${row.points}</td>
        <td class="green">${row.wins}</td>
        <td class="red">${row.losses}</td>
        <td>${row.byes}</td>
        <td>+${row.extraPoints}</td>
        <td>${row.specialActions}</td>
      </tr>
    `
    )
    .join("");
}

// Helpers
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDate(dateStr, timeStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const formattedDate = dateObj.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short"
  });
  return timeStr ? `${formattedDate} ${timeStr}` : formattedDate;
}

function getRoundIcon(roundNumber) {
  return roundNumber === 1
    ? "mdi:hockey-puck"
    : roundNumber === 2
      ? "mdi:basketball"
      : "mdi:soccer";
}

function renderMatch(round, match) {
  if (match.type === "bye") {
    return `
      <article class="bye-card">
        <div>
          <small class="muted">Descansa</small>
          <strong>${escapeHtml(getTeamName(tournament, match.byeTeamId))}</strong>
        </div>
        <iconify-icon icon="mdi:sofa" style="color: var(--orange)"></iconify-icon>
      </article>
    `;
  }

  const teamAName = getTeamName(tournament, match.teamAId);
  const teamBName = getTeamName(tournament, match.teamBId);
  const statsA = match.stats[match.teamAId] || { trickOrThreeRebounds: 0, infiltration: 0, passAndScore: 0 };
  const statsB = match.stats[match.teamBId] || { trickOrThreeRebounds: 0, infiltration: 0, passAndScore: 0 };

  const winnerName = match.winnerTeamId ? getTeamName(tournament, match.winnerTeamId) : "Empate / Pendiente";

  return `
    <article class="match-card">
      <div class="match-title">
        <span class="${match.winnerTeamId === match.teamAId ? 'green' : ''}">${escapeHtml(teamAName)}</span>
        <span class="vs">VS</span>
        <span class="${match.winnerTeamId === match.teamBId ? 'green' : ''}">${escapeHtml(teamBName)}</span>
      </div>

      <div style="margin-top:0.75rem; border-top:1px solid rgba(255,255,255,0.06); padding-top:0.5rem; font-size:0.85rem;">
        <div>
          <strong>Ganador:</strong>
          <span class="${match.winnerTeamId ? 'cyan' : 'muted'}">${escapeHtml(winnerName)}</span>
          ${match.perfectWinner ? ' <small class="green" style="font-weight:900;">(Perfecta +1 pt)</small>' : ''}
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-box" style="padding:0.5rem;">
          <h4 style="font-size:0.78rem; margin:0 0 0.3rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            ${escapeHtml(teamAName)}
          </h4>
          <div style="font-size:0.72rem; color:var(--muted); line-height:1.4;">
            <div>Tricks: ${statsA.trickOrThreeRebounds}</div>
            <div>Infil: ${statsA.infiltration}</div>
            <div>Pase+A: ${statsA.passAndScore}</div>
          </div>
          <div class="extra-preview" style="font-size:0.72rem; margin-top:0.3rem;">Extra: +${calculateTeamExtra(statsA)} pts</div>
        </div>

        <div class="stat-box" style="padding:0.5rem;">
          <h4 style="font-size:0.78rem; margin:0 0 0.3rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            ${escapeHtml(teamBName)}
          </h4>
          <div style="font-size:0.72rem; color:var(--muted); line-height:1.4;">
            <div>Tricks: ${statsB.trickOrThreeRebounds}</div>
            <div>Infil: ${statsB.infiltration}</div>
            <div>Pase+A: ${statsB.passAndScore}</div>
          </div>
          <div class="extra-preview" style="font-size:0.72rem; margin-top:0.3rem;">Extra: +${calculateTeamExtra(statsB)} pts</div>
        </div>
      </div>
    </article>
  `;
}

function toast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(el.timer);
  el.timer = setTimeout(() => {
    el.classList.remove("show");
  }, 3000);
}

function setSyncStatus(status) {
  const el = $("#syncStatus");
  if (el) {
    el.textContent = status;
  }
}
