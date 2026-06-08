import { CONFIG } from "./config.js";
import { createDefaultTournament } from "./tournament.js";

function cleanBaseUrl() {
  return CONFIG.MOCKAPI_BASE_URL.replace(/\/+$/, "");
}

export function isMockApiConfigured() {
  return (
    CONFIG.MOCKAPI_BASE_URL &&
    !CONFIG.MOCKAPI_BASE_URL.includes("TU-PROYECTO")
  );
}

function resourceUrl() {
  return `${cleanBaseUrl()}/${CONFIG.RESOURCE_NAME}`;
}

function packTournament(tournament) {
  return {
    name: tournament.name,
    status: tournament.status,
    payload: JSON.stringify(tournament),
    updatedAt: new Date().toISOString()
  };
}

function unpackTournament(record) {
  if (!record) {
    throw new Error("El registro es nulo o inválido");
  }

  let tournamentData;
  if (!record.payload) {
    tournamentData = createDefaultTournament();
  } else {
    try {
      tournamentData = JSON.parse(record.payload);
    } catch {
      tournamentData = createDefaultTournament();
    }
  }

  return {
    ...tournamentData,
    remoteId: record.id
  };
}

export async function createTournamentOnMockApi(tournament) {
  if (!isMockApiConfigured()) {
    throw new Error("Configura MOCKAPI_BASE_URL en js/config.js");
  }

  const response = await fetch(resourceUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(packTournament(tournament))
  });

  if (!response.ok) {
    throw new Error("No se pudo crear el torneo en MockAPI");
  }

  const record = await response.json();
  return unpackTournament(record);
}

export async function loadTournamentFromMockApi(id) {
  if (!isMockApiConfigured()) {
    throw new Error("Configura MOCKAPI_BASE_URL en js/config.js");
  }

  const response = await fetch(`${resourceUrl()}/${id}`);

  if (!response.ok) {
    throw new Error("No se pudo cargar el torneo desde MockAPI");
  }

  const record = await response.json();
  return unpackTournament(record);
}

export async function saveTournamentToMockApi(id, tournament) {
  if (!isMockApiConfigured()) {
    throw new Error("Configura MOCKAPI_BASE_URL en js/config.js");
  }

  if (!id) {
    throw new Error("Falta el ID del torneo en MockAPI");
  }

  const response = await fetch(`${resourceUrl()}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(packTournament(tournament))
  });

  if (!response.ok) {
    throw new Error("No se pudo guardar el torneo en MockAPI");
  }

  const record = await response.json();
  return unpackTournament(record);
}
