import { modules } from "./crm-data";
import { getAllPipelineLoans } from "./pipeline-loans";
import type { ProductPipelineModuleKey } from "./product-pipeline";
import type { Deal, ModuleKey } from "./types";

export const STALE_LOAN_DAYS = 7;

export type AppNotification = {
  id: string;
  /**
   * Changes whenever the alert's underlying state does, so dismissing an alert only
   * silences the state it was raised for instead of hiding the record forever.
   */
  signature: string;
  type: "stale_loan" | "overdue_review";
  title: string;
  body: string;
  module: ModuleKey;
  recordId: string;
  createdAt: string;
  severity: "warning" | "info";
};

function moduleLabel(module: ProductPipelineModuleKey) {
  return modules.find((item) => item.key === module)?.label ?? module;
}

function daysBetween(fromMs: number, toMs: number) {
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

function formatDaysAgo(days: number) {
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function parseDateOnly(value: string) {
  if (!value.trim()) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function buildLoanNotifications(
  entries: Array<{ module: ProductPipelineModuleKey; loan: Deal }> = getAllPipelineLoans(),
  now = Date.now(),
): AppNotification[] {
  const notifications: AppNotification[] = [];

  for (const { module, loan } of entries) {
    const label = moduleLabel(module);
    const updatedMs = Date.parse(loan.updatedAt);
    if (Number.isFinite(updatedMs)) {
      const staleDays = daysBetween(updatedMs, now);
      if (staleDays >= STALE_LOAN_DAYS) {
        notifications.push({
          id: `stale:${module}:${loan.id}`,
          signature: `stale:${module}:${loan.id}:${loan.updatedAt}:${staleDays}`,
          type: "stale_loan",
          title: `Idle for ${staleDays} days`,
          body: `${label} · ${loan.name || loan.facilityNumber} has not been updated since ${formatDaysAgo(staleDays)}.`,
          module,
          recordId: loan.id,
          createdAt: loan.updatedAt,
          severity: "warning",
        });
      }
    }

    const reviewMs = parseDateOnly(loan.nextReviewDate);
    if (reviewMs != null && reviewMs < now) {
      const overdueDays = daysBetween(reviewMs, now);
      notifications.push({
        id: `review:${module}:${loan.id}`,
        signature: `review:${module}:${loan.id}:${loan.nextReviewDate}:${overdueDays}`,
        type: "overdue_review",
        title: `Review overdue`,
        body: `${label} · ${loan.name || loan.facilityNumber} next review was due ${formatDaysAgo(overdueDays)}.`,
        module,
        recordId: loan.id,
        createdAt: loan.nextReviewDate,
        severity: "warning",
      });
    }
  }

  return notifications.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "warning" ? -1 : 1;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}
