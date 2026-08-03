import type { Deal } from "./types";
import {
  applyColumnSortFilter,
  type ColumnDef,
  type ColumnFilters,
} from "./table";

export const LOAN_PUBLIC_VIEWS = [
  "All Loans",
  "Loans Closing This Month",
  "Loans Closing Next Month",
  "My Loan Book",
  "New Loan Applications",
  "Recently Updated Loans",
] as const;

export type LoanPublicView = (typeof LOAN_PUBLIC_VIEWS)[number];

export type LoanCustomView = {
  id: string;
  name: string;
  /** Column keys to show in the table (excluding the select checkbox). */
  visibleFields: string[];
  /** Saved column filters applied when this view is active. */
  filters: ColumnFilters;
};

/** Public view row that can carry saved field/filter overrides after Edit. */
export type LoanPublicViewItem = {
  id: string;
  name: string;
  visibleFields?: string[];
  filters?: ColumnFilters;
  /** When true, table uses saved column filters instead of built-in public view logic. */
  useColumnFilters?: boolean;
};

function parseDateOnly(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameMonth(date: Date, year: number, month: number) {
  return date.getFullYear() === year && date.getMonth() === month;
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDateRange(year: number, monthIndex: number) {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { start: formatDateOnly(start), end: formatDateOnly(end) };
}

export function defaultLoanVisibleFields(columns: ColumnDef[]): string[] {
  return columns.filter((column) => column.key !== "select").map((column) => column.key);
}

/** Defaults shown in the Edit View modal for public or custom views. */
export function getLoanViewEditorState(
  view: {
    id: string;
    name: string;
    visibleFields?: string[];
    filters?: ColumnFilters;
    useColumnFilters?: boolean;
  },
  columns: ColumnDef[],
  options: {
    kind: "public" | "custom";
    currentOwner?: string | null;
    now?: Date;
  },
): LoanCustomView {
  const visibleFields = view.visibleFields?.length
    ? view.visibleFields
    : defaultLoanVisibleFields(columns);

  if (options.kind === "custom" || view.useColumnFilters) {
    return {
      id: view.id,
      name: view.name,
      visibleFields,
      filters: view.filters ?? {},
    };
  }

  const now = options.now ?? new Date();
  const today = startOfDay(now);
  const currentOwner = options.currentOwner?.trim() || "Jenny";
  let filters: ColumnFilters = {};

  switch (view.id) {
    case "Loans Closing This Month": {
      const range = monthDateRange(today.getFullYear(), today.getMonth());
      filters = {
        closingDate: { kind: "date", op: "between", value: range.start, valueTo: range.end },
      };
      break;
    }
    case "Loans Closing Next Month": {
      const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
      const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
      const range = monthDateRange(nextYear, nextMonth);
      filters = {
        closingDate: { kind: "date", op: "between", value: range.start, valueTo: range.end },
      };
      break;
    }
    case "My Loan Book":
      filters = {
        owner: { kind: "text", op: "equals", value: currentOwner },
      };
      break;
    default:
      filters = {};
  }

  return {
    id: view.id,
    name: view.name,
    visibleFields,
    filters,
  };
}

export function applyLoanCustomViewFilters(
  loans: Deal[],
  view: LoanCustomView,
  columns: ColumnDef[],
  getCellValue: (deal: Deal, key: string) => string | number,
): Deal[] {
  return applyColumnSortFilter(loans, columns, null, view.filters, getCellValue);
}

/** Filter loan rows for a public list view. Custom views are handled separately. */
export function filterLoansByView(
  loans: Deal[],
  view: string,
  options: { currentOwner?: string | null; now?: Date } = {},
): Deal[] {
  const now = options.now ?? new Date();
  const today = startOfDay(now);
  const currentOwner = options.currentOwner?.trim() || "Jenny";

  switch (view) {
    case "All Loans":
      return loans;

    case "Loans Closing This Month":
      return loans.filter((loan) => {
        const closing = parseDateOnly(loan.closingDate);
        return closing ? isSameMonth(closing, today.getFullYear(), today.getMonth()) : false;
      });

    case "Loans Closing Next Month": {
      const nextMonth = today.getMonth() === 11 ? 0 : today.getMonth() + 1;
      const nextYear = today.getMonth() === 11 ? today.getFullYear() + 1 : today.getFullYear();
      return loans.filter((loan) => {
        const closing = parseDateOnly(loan.closingDate);
        return closing ? isSameMonth(closing, nextYear, nextMonth) : false;
      });
    }

    case "My Loan Book":
      return loans.filter(
        (loan) => loan.owner.trim().toLowerCase() === currentOwner.toLowerCase(),
      );

    case "New Loan Applications": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 7);
      return loans.filter((loan) => {
        const applied = parseDateOnly(loan.applicationDate);
        return applied ? applied >= cutoff && applied <= today : false;
      });
    }

    case "Recently Updated Loans": {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 14);
      return loans.filter((loan) => {
        const updated = parseDateOnly(loan.updatedAt);
        return updated ? updated >= cutoff && updated <= today : false;
      });
    }

    default:
      return loans;
  }
}

const LOAN_VIEWS_STORAGE_KEY = "crm-loan-views-v1";

type LoanViewsStorage = {
  publicViews: LoanPublicViewItem[];
  customViews: LoanCustomView[];
  selectedViewId: string;
  selectedViewLabel: string;
};

function defaultPublicViews(): LoanPublicViewItem[] {
  return LOAN_PUBLIC_VIEWS.map((name) => ({ id: name, name }));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeCustomView(value: unknown): LoanCustomView | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (!Array.isArray(value.visibleFields)) return null;
  const visibleFields = value.visibleFields.filter((item): item is string => typeof item === "string");
  const filters =
    isObject(value.filters) ? (value.filters as ColumnFilters) : ({} as ColumnFilters);
  return {
    id: value.id,
    name: value.name,
    visibleFields,
    filters,
  };
}

function normalizePublicView(value: unknown): LoanPublicViewItem | null {
  if (!isObject(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  const item: LoanPublicViewItem = { id: value.id, name: value.name };
  if (Array.isArray(value.visibleFields)) {
    item.visibleFields = value.visibleFields.filter((entry): entry is string => typeof entry === "string");
  }
  if (isObject(value.filters)) {
    item.filters = value.filters as ColumnFilters;
  }
  if (typeof value.useColumnFilters === "boolean") {
    item.useColumnFilters = value.useColumnFilters;
  }
  return item;
}

export function loadLoanViewsState(): LoanViewsStorage {
  const fallback: LoanViewsStorage = {
    publicViews: defaultPublicViews(),
    customViews: [],
    selectedViewId: LOAN_PUBLIC_VIEWS[0],
    selectedViewLabel: LOAN_PUBLIC_VIEWS[0],
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(LOAN_VIEWS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return fallback;

    const customViews = Array.isArray(parsed.customViews)
      ? parsed.customViews.map(normalizeCustomView).filter((item): item is LoanCustomView => item != null)
      : [];

    const storedPublic = Array.isArray(parsed.publicViews)
      ? parsed.publicViews.map(normalizePublicView).filter((item): item is LoanPublicViewItem => item != null)
      : [];
    // Prefer the saved list so deletions / renames survive refresh.
    const publicViews = storedPublic.length > 0 ? storedPublic : defaultPublicViews();

    const selectedViewId =
      typeof parsed.selectedViewId === "string" ? parsed.selectedViewId : LOAN_PUBLIC_VIEWS[0];
    const selectedViewLabel =
      typeof parsed.selectedViewLabel === "string" ? parsed.selectedViewLabel : selectedViewId;
    const knownIds = new Set([
      ...publicViews.map((item) => item.id),
      ...customViews.map((item) => item.id),
    ]);
    if (!knownIds.has(selectedViewId)) {
      return {
        publicViews,
        customViews,
        selectedViewId: LOAN_PUBLIC_VIEWS[0],
        selectedViewLabel: LOAN_PUBLIC_VIEWS[0],
      };
    }

    return {
      publicViews,
      customViews,
      selectedViewId,
      selectedViewLabel,
    };
  } catch {
    return fallback;
  }
}

export function saveLoanViewsState(state: {
  publicViews: LoanPublicViewItem[];
  customViews: LoanCustomView[];
  selectedViewId: string;
  selectedViewLabel: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload: LoanViewsStorage = {
      publicViews: state.publicViews,
      customViews: state.customViews,
      selectedViewId: state.selectedViewId,
      selectedViewLabel: state.selectedViewLabel,
    };
    window.localStorage.setItem(LOAN_VIEWS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private mode write failures.
  }
}
