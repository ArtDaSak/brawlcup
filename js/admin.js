import { CONFIG } from "./config.js";
import {
  createDefaultTournament,
  hydrateTournament,
  addTeam,
  removeTeam,
  updateTeam,
  updateRoundSchedule,
  drawRoundOneBye,
  resetRoundOneDraw,
  generateNextRound,
  resetRounds,
  updateMatchWinner,
  updatePerfectWinner,
  updateMatchStat,
  calculateStandings,
  calculateTeamExtra,
  getTeamName
} from "./tournament.js";

import {
  isMockApiConfigured,
  createTournamentOnMockApi,
  loadTournamentFromMockApi,
  saveTournamentToMockApi
} from "./api.js";

import "./navigation.js";

const LOCAL_KEY = "copa_brawl_sports_duos_state";
const REMOTE_ID_KEY = "copa_brawl_sports_duos_remote_id";

let tournament = loadLocalTournament();
let saveTimer = null;
let editingTeamId = null;

const $ = (selector) => document.querySelector(selector);

window.App = {
  addTeam: handleAddTeam,
  removeTeam: handleRemoveTeam,
  startTeamEdit: handleStartTeamEdit,
  cancelTeamEdit: handleCancelTeamEdit,
  saveTeamEdit: handleSaveTeamEdit,
  updateRoundSchedule: handleUpdateRoundSchedule,
  updateRoundDateTime: handleUpdateRoundDateTime,
  drawRoundOneBye: handleDrawRoundOneBye,
  resetRoundOneDraw: handleResetRoundOneDraw,
  generateNextRound: handleGenerateNextRound,
  resetRounds: handleResetRounds,
  updateWinner: handleUpdateWinner,
  updatePerfect: handleUpdatePerfect,
  updateStat: handleUpdateStat,
  decrementStat: handleDecrementStat,
  incrementStat: handleIncrementStat,
  createRemoteTournament: handleCreateRemoteTournament,
  loadRemoteFromInput: handleLoadRemoteFromInput,
  saveRemoteNow: handleSaveRemoteNow
};

init();

window.addEventListener("storage", (e) => {
  if (e.key === LOCAL_KEY) {
    tournament = loadLocalTournament();
    render();
  }
});

async function init() {
  const configuredId =
    CONFIG.TOURNAMENT_ID || localStorage.getItem(REMOTE_ID_KEY) || "";

  if (configuredId) {
    tournament.remoteId = configuredId;
    localStorage.setItem(REMOTE_ID_KEY, configuredId);
    saveLocal();
  }

  if (configuredId && isMockApiConfigured()) {
    try {
      setSyncStatus("Cargando...");
      const remote = await loadTournamentFromMockApi(configuredId);
      tournament = hydrateTournament(remote);

      localStorage.setItem(REMOTE_ID_KEY, tournament.remoteId);
      saveLocal();
      toast("Torneo cargado desde MockAPI");
    } catch (error) {
      toast(error.message);
    }
  }

  render();
}

function loadLocalTournament() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? hydrateTournament(JSON.parse(raw)) : createDefaultTournament();
  } catch {
    return createDefaultTournament();
  }
}

function saveLocal() {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(tournament));
}

function commit({ remote = CONFIG.AUTO_SAVE_TO_MOCKAPI } = {}) {
  saveLocal();
  render();

  if (remote) {
    queueRemoteSave();
  }
}

function queueRemoteSave() {
  if (!isMockApiConfigured() || !tournament.remoteId) return;

  clearTimeout(saveTimer);

  saveTimer = setTimeout(async () => {
    try {
      setSyncStatus("Guardando...");
      tournament = hydrateTournament(
        await saveTournamentToMockApi(tournament.remoteId, tournament)
      );
      saveLocal();
      setSyncStatus("Guardado en MockAPI");
    } catch (error) {
      setSyncStatus("Error al guardar");
      toast(error.message);
    }
  }, 700);
}

function handleAddTeam() {
  try {
    addTeam(tournament, {
      name: $("#teamName").value,
      memberOne: $("#memberOne").value,
      memberTwo: $("#memberTwo").value,
      notes: $("#teamNotes").value
    });

    $("#teamName").value = "";
    $("#memberOne").value = "";
    $("#memberTwo").value = "";
    $("#teamNotes").value = "";

    commit();
    toast("Dúo registrado");
  } catch (error) {
    toast(error.message);
  }
}

function handleRemoveTeam(teamId) {
  if (
    tournament.rounds.length > 0 &&
    !confirm("Ya hay rondas creadas. Si eliminas un equipo, conviene borrar las rondas. ¿Continuar?")
  ) {
    return;
  }

  removeTeam(tournament, teamId);
  commit();
}

function handleStartTeamEdit(teamId) {
  editingTeamId = teamId;
  render();
}

function handleCancelTeamEdit() {
  editingTeamId = null;
  render();
}

function handleSaveTeamEdit(teamId) {
  try {
    const name = $(`#edit-name-${teamId}`).value;
    const memberOne = $(`#edit-memberOne-${teamId}`).value;
    const memberTwo = $(`#edit-memberTwo-${teamId}`).value;
    const notes = $(`#edit-notes-${teamId}`).value;

    updateTeam(tournament, teamId, { name, memberOne, memberTwo, notes });

    editingTeamId = null;
    commit();
    toast("Dúo actualizado");
  } catch (error) {
    toast(error.message);
  }
}

function handleUpdateRoundSchedule(roundNumber, field, value) {
  updateRoundSchedule(tournament, roundNumber, field, value);
  commit();
}

function handleUpdateRoundDateTime(roundNumber, datetimeValue) {
  if (!datetimeValue) {
    updateRoundSchedule(tournament, roundNumber, 'date', '');
    updateRoundSchedule(tournament, roundNumber, 'time', '');
  } else {
    const [date, time] = datetimeValue.split('T');
    updateRoundSchedule(tournament, roundNumber, 'date', date);
    updateRoundSchedule(tournament, roundNumber, 'time', time || '00:00');
  }
  commit();
}

function handleDecrementStat(roundId, matchId, teamId, statKey) {
  const match = tournament.rounds.find(r => r.id === roundId)?.matches.find(m => m.id === matchId);
  if (!match || match.type === "bye") return;
  const current = Number(match.stats[teamId]?.[statKey] || 0);
  handleUpdateStat(roundId, matchId, teamId, statKey, Math.max(0, current - 1));
}

function handleIncrementStat(roundId, matchId, teamId, statKey) {
  const match = tournament.rounds.find(r => r.id === roundId)?.matches.find(m => m.id === matchId);
  if (!match || match.type === "bye") return;
  const current = Number(match.stats[teamId]?.[statKey] || 0);
  handleUpdateStat(roundId, matchId, teamId, statKey, Math.min(9, current + 1));
}

function handleDrawRoundOneBye() {
  try {
    drawRoundOneBye(tournament);
    commit();
    toast("Descanso de Ronda 1 sorteado");
  } catch (error) {
    toast(error.message);
  }
}

function handleResetRoundOneDraw() {
  try {
    resetRoundOneDraw(tournament);
    commit();
    toast("Sorteo reiniciado");
  } catch (error) {
    toast(error.message);
  }
}

function handleGenerateNextRound() {
  try {
    generateNextRound(tournament);
    commit();
    toast("Ronda creada");
  } catch (error) {
    toast(error.message);
  }
}

function handleResetRounds() {
  if (!confirm("¿Borrar rondas, enfrentamientos, puntos y sorteos?")) return;

  resetRounds(tournament);
  commit();
  toast("Rondas reiniciadas");
}

function handleUpdateWinner(roundId, matchId, winnerTeamId) {
  updateMatchWinner(tournament, roundId, matchId, winnerTeamId);
  commit();
}

function handleUpdatePerfect(roundId, matchId, value) {
  try {
    updatePerfectWinner(tournament, roundId, matchId, value);
    commit();
  } catch (error) {
    toast(error.message);
  }
}

function handleUpdateStat(roundId, matchId, teamId, statKey, value) {
  updateMatchStat(tournament, roundId, matchId, teamId, statKey, value);
  commit();
}

async function handleCreateRemoteTournament() {
  try {
    if (!isMockApiConfigured()) {
      toast("Configura MOCKAPI_BASE_URL en js/config.js");
      return;
    }

    tournament = hydrateTournament(await createTournamentOnMockApi(tournament));

    localStorage.setItem(REMOTE_ID_KEY, tournament.remoteId);
    saveLocal();

    render();
    toast(`Torneo creado en MockAPI con ID ${tournament.remoteId}`);
  } catch (error) {
    toast(error.message);
  }
}

async function handleLoadRemoteFromInput() {
  const id = $("#remoteIdInput").value.trim();

  if (!id) {
    toast("Escribe el ID del torneo");
    return;
  }

  try {
    tournament = hydrateTournament(await loadTournamentFromMockApi(id));

    localStorage.setItem(REMOTE_ID_KEY, tournament.remoteId);
    saveLocal();

    render();
    toast("Torneo cargado desde MockAPI");
  } catch (error) {
    toast(error.message);
  }
}

async function handleSaveRemoteNow() {
  try {
    if (!isMockApiConfigured()) {
      toast("Configura MOCKAPI_BASE_URL en js/config.js");
      return;
    }

    if (!tournament.remoteId) {
      tournament = hydrateTournament(await createTournamentOnMockApi(tournament));
      localStorage.setItem(REMOTE_ID_KEY, tournament.remoteId);
    } else {
      tournament = hydrateTournament(
        await saveTournamentToMockApi(tournament.remoteId, tournament)
      );
    }

    saveLocal();
    render();
    toast("Guardado en MockAPI");
  } catch (error) {
    toast(error.message);
  }
}

function render() {
  renderConnection();
  renderSchedule();
  renderTeams();
  renderDraw();
  renderMatchMap();
  renderStandings();
}

function renderConnection() {
  $("#remoteIdInput").value = tournament.remoteId || "";

  $("#remoteInfo").innerHTML = tournament.remoteId
    ? `Conectado al torneo <strong>#${escapeHtml(tournament.remoteId)}</strong>`
    : "Trabajando localmente";

  setSyncStatus(
    isMockApiConfigured()
      ? tournament.remoteId
        ? "Conectado"
        : "MockAPI configurado"
      : "Falta configurar MockAPI"
  );
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

      const dateTimeVal = round.date ? `${round.date}T${round.time || "00:00"}` : "";

      return `
        <article class="schedule-card">
          <header>
            <iconify-icon icon="${icon}"></iconify-icon>
            <div>
              <strong>Ronda ${round.number}</strong>
              <p class="muted">${escapeHtml(round.mode)}</p>
            </div>
          </header>

          <label>
            Fecha y Hora
            <div class="datetime-input-container">
              <input
                type="datetime-local"
                value="${dateTimeVal}"
                onchange="App.updateRoundDateTime(${round.number}, this.value)"
                onclick="this.showPicker?.()"
              >
              <div class="datetime-display">
                ${round.date
                  ? `<span><iconify-icon icon="mdi:calendar"></iconify-icon> ${formatDate(round.date, '')} ${round.time ? `· <iconify-icon icon="mdi:clock-outline"></iconify-icon> ${round.time}` : ''}</span>`
                  : `<span class="placeholder"><iconify-icon icon="mdi:calendar-plus"></iconify-icon> Definir fecha y hora</span>`
                }
                <iconify-icon icon="mdi:chevron-down" style="font-size: 1.1rem; color: var(--muted);"></iconify-icon>
              </div>
            </div>
          </label>

          <label>
            Notas
            <input
              value="${escapeHtml(round.notes)}"
              placeholder="Ej: inicia 7:30 p.m."
              onchange="App.updateRoundSchedule(${round.number}, 'notes', this.value)"
            >
          </label>
        </article>
      `;
    })
    .join("");
}

function renderTeams() {
  const container = $("#teamsList");

  if (!tournament.teams.length) {
    container.innerHTML = `<div class="empty">Registra los dúos antes de crear rondas</div>`;
    return;
  }

  container.innerHTML = tournament.teams
    .map(
      (team, index) => {
        if (team.id === editingTeamId) {
          return `
            <article class="team-card editing">
              <div class="edit-form-grid">
                <div style="font-weight: 900; font-size: 0.95rem; color: var(--cyan); margin-bottom: 0.25rem;">
                  Editar Dúo #${index + 1}
                </div>
                <div class="edit-form-row">
                  <label>
                    Nombre del dúo
                    <input id="edit-name-${team.id}" value="${escapeHtml(team.name)}">
                  </label>
                  <label>
                    Notas / contacto
                    <input id="edit-notes-${team.id}" value="${escapeHtml(team.notes || '')}">
                  </label>
                </div>
                <div class="edit-form-row">
                  <label>
                    Integrante 1
                    <input id="edit-memberOne-${team.id}" value="${escapeHtml(team.memberOne)}">
                  </label>
                  <label>
                    Integrante 2
                    <input id="edit-memberTwo-${team.id}" value="${escapeHtml(team.memberTwo)}">
                  </label>
                </div>
                <div class="edit-actions">
                  <button class="ghost small" onclick="App.cancelTeamEdit()">
                    Cancelar
                  </button>
                  <button class="small" onclick="App.saveTeamEdit('${team.id}')" style="background: var(--cyan); color: #000; border-color: var(--cyan);">
                    Guardar
                  </button>
                </div>
              </div>
            </article>
          `;
        }

        return `
          <article class="team-card">
            <div>
              <strong>${index + 1}. ${escapeHtml(team.name)}</strong>
              <small>
                ${escapeHtml(team.memberOne)} + ${escapeHtml(team.memberTwo)}
                ${team.notes ? ` · ${escapeHtml(team.notes)}` : ""}
              </small>
            </div>

            <div class="actions">
              <button class="ghost small" onclick="App.startTeamEdit('${team.id}')">
                Editar
              </button>
              <button class="ghost small" onclick="App.removeTeam('${team.id}')">
                Eliminar
              </button>
            </div>
          </article>
        `;
      }
    )
    .join("");
}

function renderDraw() {
  const container = $("#drawResult");
  const isOdd = tournament.teams.length % 2 === 1;
  const hasRoundOne = tournament.rounds.some((round) => round.number === 1);
  const draw = tournament.luckDraws.find(
    (item) => item.type === "round_one_bye"
  );

  if (tournament.teams.length < 3) {
    container.innerHTML = `<div class="empty">Necesitas mínimo 3 dúos para que exista descanso</div>`;
    return;
  }

  if (!isOdd) {
    container.innerHTML = `<div class="empty">La cantidad de dúos es par. No hay descanso en Ronda 1</div>`;
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
      <p class="cyan">${escapeHtml(getTeamName(tournament, draw.winnerTeamId))}</p>
      <p class="muted">
        Código del sorteo: ${escapeHtml(draw.code)}
        ${hasRoundOne ? " · Sorteo bloqueado porque la Ronda 1 ya fue creada" : ""}
      </p>
    </div>
  `;
}

function renderMatchMap() {
  const container = $("#matchMap");

  if (!tournament.rounds.length) {
    container.innerHTML = `
      <div class="empty">
        Aún no hay rondas creadas. Registra equipos y crea la primera ronda
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

  return `
    <article class="match-card">
      <div class="match-title">
        <span>${escapeHtml(teamAName)}</span>
        <span class="vs">VS</span>
        <span>${escapeHtml(teamBName)}</span>
      </div>

      <div class="match-controls">
        <label>
          Ganador
          <select onchange="App.updateWinner('${round.id}', '${match.id}', this.value)">
            <option value="">Ninguno / Empate</option>
            <option value="${match.teamAId}" ${match.winnerTeamId === match.teamAId ? "selected" : ""}>
              ${escapeHtml(teamAName)}
            </option>
            <option value="${match.teamBId}" ${match.winnerTeamId === match.teamBId ? "selected" : ""}>
              ${escapeHtml(teamBName)}
            </option>
          </select>
        </label>

        <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-weight: normal;">
          <input
            type="checkbox"
            ${match.perfectWinner ? "checked" : ""}
            onchange="App.updatePerfect('${round.id}', '${match.id}', this.checked)"
          >
          Victoria perfecta (+1 pt)
        </label>
      </div>

      <div class="stats-grid">
        <div class="stat-box">
          <h4 style="font-size:0.8rem; margin:0 0 0.5rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            ${escapeHtml(teamAName)}
          </h4>
          <div class="stat-fields">
            <label>
              Trick
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'trickOrThreeRebounds')">-</button>
                <span class="stepper-val">${statsA.trickOrThreeRebounds}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'trickOrThreeRebounds')">+</button>
              </div>
            </label>
            <label>
              Infil
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'infiltration')">-</button>
                <span class="stepper-val">${statsA.infiltration}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'infiltration')">+</button>
              </div>
            </label>
            <label>
              Pase+A
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'passAndScore')">-</button>
                <span class="stepper-val">${statsA.passAndScore}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamAId}', 'passAndScore')">+</button>
              </div>
            </label>
          </div>
          <div class="extra-preview">Extra: +${calculateTeamExtra(statsA)} pts</div>
        </div>

        <div class="stat-box">
          <h4 style="font-size:0.8rem; margin:0 0 0.5rem; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">
            ${escapeHtml(teamBName)}
          </h4>
          <div class="stat-fields">
            <label>
              Trick
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'trickOrThreeRebounds')">-</button>
                <span class="stepper-val">${statsB.trickOrThreeRebounds}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'trickOrThreeRebounds')">+</button>
              </div>
            </label>
            <label>
              Infil
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'infiltration')">-</button>
                <span class="stepper-val">${statsB.infiltration}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'infiltration')">+</button>
              </div>
            </label>
            <label>
              Pase+A
              <div class="stepper">
                <button type="button" class="stepper-btn" onclick="App.decrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'passAndScore')">-</button>
                <span class="stepper-val">${statsB.passAndScore}</span>
                <button type="button" class="stepper-btn" onclick="App.incrementStat('${round.id}', '${match.id}', '${match.teamBId}', 'passAndScore')">+</button>
              </div>
            </label>
          </div>
          <div class="extra-preview">Extra: +${calculateTeamExtra(statsB)} pts</div>
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
