import {
  initialCampaigns,
  initialCohorts,
  initialOpportunities,
} from "../tanot/src/data.js";
import {
  loadRuntimeState,
  saveRuntimeState,
  storageStatus,
} from "./runtime-store.mjs";

export const DOGRA_STATE_KEY = "dogra-unit";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function defaultDograState() {
  return {
    schemaVersion: 1,
    seeded: false,
    campaigns: clone(initialCampaigns),
    opportunities: clone(initialOpportunities),
    cohorts: clone(initialCohorts),
    actionState: {},
    reportHistory: [],
    updatedAt: null,
  };
}

function cappedArray(value, fallback, limit) {
  return Array.isArray(value) ? value.slice(0, limit) : clone(fallback);
}

export function normalizeDograState(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    schemaVersion: 1,
    seeded: raw.seeded === true,
    campaigns: cappedArray(raw.campaigns, initialCampaigns, 1_000),
    opportunities: cappedArray(raw.opportunities, initialOpportunities, 5_000),
    cohorts: cappedArray(raw.cohorts, initialCohorts, 2_000),
    actionState: raw.actionState && typeof raw.actionState === "object" && !Array.isArray(raw.actionState)
      ? raw.actionState
      : {},
    reportHistory: cappedArray(raw.reportHistory, [], 24),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
  };
}

export function summarizeDograState(state) {
  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const opportunities = Array.isArray(state.opportunities) ? state.opportunities : [];
  const contractedStages = new Set(["Contracted", "Studio allocated", "Mobilisation", "Live"]);
  const targeted = campaigns.reduce((sum, item) => sum + Number(item.contacts || 0), 0);
  const engaged = campaigns.reduce((sum, item) => sum + Number(item.engaged || 0), 0);
  const qualified = campaigns.reduce((sum, item) => sum + Number(item.qualified || 0), 0);
  const contracted = opportunities
    .filter((item) => contractedStages.has(item.stage))
    .reduce((sum, item) => sum + Number(item.committed || 0), 0);
  const live = opportunities.reduce((sum, item) => sum + Number(item.live || 0), 0);
  return {
    targeted,
    engaged,
    qualified,
    contracted,
    live,
    activationGap: Math.max(0, contracted - live),
    activeOpportunities: opportunities.filter((item) => item.stage !== "Live").length,
  };
}

export async function readDograState() {
  const loaded = await loadRuntimeState(DOGRA_STATE_KEY, defaultDograState());
  const state = normalizeDograState(loaded.value);
  return {
    product: "dogra",
    unit: "Dogra Unit",
    state,
    summary: summarizeDograState(state),
    version: loaded.version,
    storage: await storageStatus(DOGRA_STATE_KEY),
  };
}

export async function writeDograState(value, expectedVersion) {
  const version = Number(expectedVersion);
  if (!Number.isInteger(version) || version < 0) {
    return { ok: false, status: 400, error: "invalid_version" };
  }
  const state = normalizeDograState({
    ...value,
    seeded: true,
    updatedAt: new Date().toISOString(),
  });
  const saved = await saveRuntimeState(DOGRA_STATE_KEY, state, version);
  if (!saved.ok) {
    return { ok: false, status: 409, error: "state_conflict", current: await readDograState() };
  }
  return {
    ok: true,
    status: 200,
    product: "dogra",
    unit: "Dogra Unit",
    state,
    summary: summarizeDograState(state),
    version: saved.version,
    storage: await storageStatus(DOGRA_STATE_KEY),
  };
}
