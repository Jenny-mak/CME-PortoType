import { productPipelineData } from "./crm-data";
import type { ProductPipelineModuleKey } from "./product-pipeline";
import type { Deal } from "./types";

export type PipelineLoanSnapshot = Record<ProductPipelineModuleKey, Deal[]>;

const MODULE_KEYS = Object.keys(productPipelineData) as ProductPipelineModuleKey[];

function cloneSnapshot(): PipelineLoanSnapshot {
  return MODULE_KEYS.reduce((acc, key) => {
    acc[key] = productPipelineData[key].map((deal) => ({ ...deal }));
    return acc;
  }, {} as PipelineLoanSnapshot);
}

let snapshot = cloneSnapshot();
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
