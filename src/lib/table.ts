import type { ColorGroupId } from "./option-colors";

export type FieldType =
  | "checkbox"
  | "text"
  | "email"
  | "phone"
  | "url"
  | "date"
  | "datetime"
  | "enum"
  | "duration"
  | "number";

export type ColumnDef = {
  key: string;
  header: string;
  type: FieldType;
  sortable?: boolean;
  filterable?: boolean;
  enumOptions?: string[];
  /** Whether enum cells expose and use option colors. Defaults to true. */
  colorable?: boolean;
  /** Color palette group for single-select (enum) cells in list views. */
  colorGroup?: ColorGroupId;
  /** Optional per-option palette index overrides within the color group. */
  optionColors?: Record<string, number>;
};

export type SortDirection = "asc" | "desc";

export type SortState = {
  key: string;
  direction: SortDirection;
} | null;

export type TextFilterOp =
  | "contains"
  | "equals"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty";

export type NumberFilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_empty"
  | "is_not_empty";

export type DateFilterOp =
  | "on"
  | "before"
  | "after"
  | "between"
  | "is_empty"
  | "is_not_empty";

export type EnumFilterOp = "is_any_of" | "is_empty" | "is_not_empty";

export type TextFilter = { kind: "text"; op: TextFilterOp; value: string };
export type EnumFilter = { kind: "enum"; op: EnumFilterOp; values: string[] };
export type NumberFilter = { kind: "number"; op: NumberFilterOp; value: string; valueTo?: string };
export type DateFilter = { kind: "date"; op: DateFilterOp; value: string; valueTo?: string };
export type DurationFilter = { kind: "duration"; op: NumberFilterOp; value: string; valueTo?: string };

export type ColumnFilter = TextFilter | EnumFilter | NumberFilter | DateFilter | DurationFilter;

export type ColumnFilters = Record<string, ColumnFilter | undefined>;

export type FilterOperatorOption = {
  value: string;
  label: string;
};

const TEXT_OPS: FilterOperatorOption[] = [
  { value: "contains", label: "Contains" },
  { value: "equals", label: "Equals" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

const NUMBER_OPS: FilterOperatorOption[] = [
  { value: "eq", label: "Equals" },
  { value: "neq", label: "Does not equal" },
  { value: "gt", label: "Greater than" },
  { value: "gte", label: "Greater than or equal" },
  { value: "lt", label: "Less than" },
  { value: "lte", label: "Less than or equal" },
  { value: "between", label: "Between" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

const DATE_OPS: FilterOperatorOption[] = [
  { value: "on", label: "Is" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "between", label: "Between" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

const ENUM_OPS: FilterOperatorOption[] = [
  { value: "is_any_of", label: "Is any of" },
  { value: "is_empty", label: "Is empty" },
  { value: "is_not_empty", label: "Is not empty" },
];

export function isColumnSortable(column: ColumnDef) {
  if (column.type === "checkbox") return false;
  return column.sortable !== false;
}

export function isColumnFilterable(column: ColumnDef) {
  if (column.type === "checkbox") return false;
  return column.filterable !== false;
}

export function getFilterOperators(type: FieldType): FilterOperatorOption[] {
  if (type === "enum") return ENUM_OPS;
  if (type === "number" || type === "duration") return NUMBER_OPS;
  if (type === "date" || type === "datetime") return DATE_OPS;
  if (type === "text" || type === "email" || type === "phone" || type === "url") return TEXT_OPS;
  return TEXT_OPS;
}

export function defaultFilterOp(type: FieldType): string {
  return getFilterOperators(type)[0]?.value ?? "contains";
}

export function filterOpNeedsValue(op: string) {
  return op !== "is_empty" && op !== "is_not_empty" && op !== "is_any_of";
}

export function filterOpNeedsSecondValue(op: string) {
  return op === "between";
}

export function createEmptyFilter(type: FieldType, op = defaultFilterOp(type)): ColumnFilter {
  if (type === "enum") {
    return { kind: "enum", op: op as EnumFilterOp, values: [] };
  }
  if (type === "number") {
    return { kind: "number", op: op as NumberFilterOp, value: "", valueTo: "" };
  }
  if (type === "duration") {
    return { kind: "duration", op: op as NumberFilterOp, value: "", valueTo: "" };
  }
  if (type === "date" || type === "datetime") {
    return { kind: "date", op: op as DateFilterOp, value: "", valueTo: "" };
  }
  return { kind: "text", op: op as TextFilterOp, value: "" };
}

export function hasActiveFilter(filter: ColumnFilter | undefined) {
  if (!filter) return false;
  if (filter.kind === "text") {
    if (filter.op === "is_empty" || filter.op === "is_not_empty") return true;
    return filter.value.trim().length > 0;
  }
  if (filter.kind === "enum") {
    if (filter.op === "is_empty" || filter.op === "is_not_empty") return true;
    return filter.values.length > 0;
  }
  if (filter.op === "is_empty" || filter.op === "is_not_empty") return true;
  if (filter.op === "between") {
    return filter.value.trim().length > 0 && (filter.valueTo ?? "").trim().length > 0;
  }
  return filter.value.trim().length > 0;
}

function parseLooseDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return Number.NaN;
  const normalized = trimmed
    .replace(/\b(\d{1,2}):(\d{2})\s*(AM|PM)\b/i, (_, h, m, ap) => {
      let hour = Number(h);
      const ampm = String(ap).toUpperCase();
      if (ampm === "PM" && hour < 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return `${String(hour).padStart(2, "0")}:${m}`;
    })
    .replace(/-/g, "/");
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

function parseDurationSeconds(value: string) {
  const parts = value.trim().split(":").map(Number);
  if (parts.some((part) => Number.isNaN(part))) return Number.NaN;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return Number.NaN;
}

function toComparable(value: string | number, type: FieldType) {
  if (typeof value === "number") return value;
  const text = String(value ?? "");
  if (type === "number") {
    const n = Number(text.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(n) ? text.toLowerCase() : n;
  }
  if (type === "date" || type === "datetime") {
    const ts = parseLooseDate(text);
    return Number.isNaN(ts) ? text.toLowerCase() : ts;
  }
  if (type === "duration") {
    const seconds = parseDurationSeconds(text);
    return Number.isNaN(seconds) ? text.toLowerCase() : seconds;
  }
  return text.toLowerCase();
}

function isBlank(raw: string | number) {
  return String(raw ?? "").trim().length === 0;
}

function parseNumber(raw: string | number) {
  if (typeof raw === "number") return raw;
  const n = Number(String(raw).replace(/[^0-9.-]/g, ""));
  return Number.isNaN(n) ? Number.NaN : n;
}

function compareNumberOp(n: number, op: NumberFilterOp, value: string, valueTo = "") {
  if (op === "is_empty" || op === "is_not_empty") return true;
  const left = Number(value);
  if (Number.isNaN(left) && op !== "between") return true;
  switch (op) {
    case "eq":
      return n === left;
    case "neq":
      return n !== left;
    case "gt":
      return n > left;
    case "gte":
      return n >= left;
    case "lt":
      return n < left;
    case "lte":
      return n <= left;
    case "between": {
      const right = Number(valueTo);
      if (Number.isNaN(left) || Number.isNaN(right)) return true;
      const lo = Math.min(left, right);
      const hi = Math.max(left, right);
      return n >= lo && n <= hi;
    }
    default:
      return true;
  }
}

function endOfDay(ts: number) {
  return ts + 24 * 60 * 60 * 1000 - 1;
}

function matchesFilter(raw: string | number, type: FieldType, filter: ColumnFilter) {
  const text = String(raw ?? "");

  if (filter.kind === "text") {
    if (filter.op === "is_empty") return isBlank(raw);
    if (filter.op === "is_not_empty") return !isBlank(raw);
    const needle = filter.value.trim().toLowerCase();
    if (!needle) return true;
    const hay = text.toLowerCase();
    if (filter.op === "contains") return hay.includes(needle);
    if (filter.op === "equals") return hay === needle;
    if (filter.op === "starts_with") return hay.startsWith(needle);
    if (filter.op === "ends_with") return hay.endsWith(needle);
    return true;
  }

  if (filter.kind === "enum") {
    if (filter.op === "is_empty") return isBlank(raw);
    if (filter.op === "is_not_empty") return !isBlank(raw);
    if (filter.values.length === 0) return true;
    return filter.values.includes(text);
  }

  if (filter.op === "is_empty") return isBlank(raw);
  if (filter.op === "is_not_empty") return !isBlank(raw);

  if (filter.kind === "number") {
    const n = parseNumber(raw);
    if (Number.isNaN(n)) return false;
    return compareNumberOp(n, filter.op, filter.value, filter.valueTo ?? "");
  }

  if (filter.kind === "duration") {
    const seconds = parseDurationSeconds(text);
    if (Number.isNaN(seconds)) return false;
    const minSeconds = filter.value.trim() ? parseDurationSeconds(filter.value) : Number.NaN;
    const maxSeconds = (filter.valueTo ?? "").trim() ? parseDurationSeconds(filter.valueTo ?? "") : Number.NaN;
    if (filter.op === "between") {
      if (Number.isNaN(minSeconds) || Number.isNaN(maxSeconds)) return true;
      const lo = Math.min(minSeconds, maxSeconds);
      const hi = Math.max(minSeconds, maxSeconds);
      return seconds >= lo && seconds <= hi;
    }
    if (Number.isNaN(minSeconds)) return true;
    switch (filter.op) {
      case "eq":
        return seconds === minSeconds;
      case "neq":
        return seconds !== minSeconds;
      case "gt":
        return seconds > minSeconds;
      case "gte":
        return seconds >= minSeconds;
      case "lt":
        return seconds < minSeconds;
      case "lte":
        return seconds <= minSeconds;
      default:
        return true;
    }
  }

  // date / datetime
  const ts = parseLooseDate(text);
  if (Number.isNaN(ts)) return false;
  const valueTs = filter.value.trim() ? parseLooseDate(filter.value) : Number.NaN;
  const valueToTs = (filter.valueTo ?? "").trim() ? parseLooseDate(filter.valueTo ?? "") : Number.NaN;

  if (filter.op === "between") {
    if (Number.isNaN(valueTs) || Number.isNaN(valueToTs)) return true;
    const lo = Math.min(valueTs, valueToTs);
    const hiRaw = Math.max(valueTs, valueToTs);
    const hi = /^\d{4}-\d{2}-\d{2}$/.test((filter.valueTo ?? filter.value).trim()) ? endOfDay(hiRaw) : hiRaw;
    return ts >= lo && ts <= hi;
  }

  if (Number.isNaN(valueTs)) return true;
  if (filter.op === "on") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(filter.value.trim())) {
      return ts >= valueTs && ts <= endOfDay(valueTs);
    }
    return ts === valueTs;
  }
  if (filter.op === "before") return ts < valueTs;
  if (filter.op === "after") {
    const after = /^\d{4}-\d{2}-\d{2}$/.test(filter.value.trim()) ? endOfDay(valueTs) : valueTs;
    return ts > after;
  }
  return true;
}

export function applyColumnSortFilter<T>(
  data: T[],
  columns: ColumnDef[],
  sort: SortState,
  filters: ColumnFilters,
  getCellValue: (row: T, key: string) => string | number,
) {
  const columnByKey = new Map(columns.map((column) => [column.key, column]));
  let next = data.filter((row) =>
    columns.every((column) => {
      if (!isColumnFilterable(column)) return true;
      const filter = filters[column.key];
      if (!hasActiveFilter(filter)) return true;
      return matchesFilter(getCellValue(row, column.key), column.type, filter!);
    }),
  );

  if (sort) {
    const column = columnByKey.get(sort.key);
    if (column && isColumnSortable(column)) {
      const direction = sort.direction === "asc" ? 1 : -1;
      next = [...next].sort((a, b) => {
        const left = toComparable(getCellValue(a, sort.key), column.type);
        const right = toComparable(getCellValue(b, sort.key), column.type);
        if (left < right) return -1 * direction;
        if (left > right) return 1 * direction;
        return 0;
      });
    }
  }

  return next;
}

export function nextSortState(current: SortState, key: string): SortState {
  if (!current || current.key !== key) return { key, direction: "asc" };
  if (current.direction === "asc") return { key, direction: "desc" };
  return null;
}
