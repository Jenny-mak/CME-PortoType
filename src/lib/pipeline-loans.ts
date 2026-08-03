import { productPipelineData } from "./crm-data";
import type { ProductPipelineModuleKey } from "./product-pipeline";
import type { Deal } from "./types";

export type PipelineLoanSnapshot = Record<ProductPipelineModuleKey, Deal[]>;

const MODULE_KEYS = Object.keys(productPipelineData) as ProductPipelineModuleKey[];
const STORAGE_KEY = "crm-demo-pipeline-loans";

function cloneSnapshot(): PipelineLoanSnapshot {
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = productPipelineData[key].map((deal) => ({ ...deal }));
    return acc;
  }, {} as PipelineLoanSnapshot);
}

function loadPersistedSnapshot(): PipelineLoanSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PipelineLoanSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    for (const key of MODULE_KEYS) {
      if (!Array.isArray(parsed[key])) return null;
    }
    return MODULE_KEYS.reduce((acc, key) => {
      acc[key] = parsed[key].map((deal) => ({ ...deal }));
      return acc;
    }, {} as PipelineLoanSnapshot);
  } catch {
    return null;
  }
}

function savePersistedSnapshot(next: PipelineLoanSnapshot) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors so the CRM keeps working without persistence.
  }
}

let snapshot = loadPersistedSnapshot() ?? cloneSnapshot();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getPipelineLoans(moduleKey: ProductPipelineModuleKey): Deal[] {
  return snapshot[moduleKey];
}

export function setPipelineLoans(moduleKey: ProductPipelineModuleKey, loans: Deal[]) {
  snapshot = {
    ...snapshot,
    [moduleKey]: loans.map((deal) => ({ ...deal })),
  };
  savePersistedSnapshot(snapshot);
  emit();
}

export function getAllPipelineLoans(
  source: PipelineLoanSnapshot = snapshot,
): Array<{ module: ProductPipelineModuleKey; loan: Deal }> {
  return MODULE_KEYS.flatMap((module) =>
    source[module].map((loan) => ({ module, loan })),
  );
}

export function subscribePipelineLoans(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPipelineLoansSnapshot() {
  return snapshot;
}
