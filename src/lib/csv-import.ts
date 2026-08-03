export const IMPORT_STEPS = ["Upload", "Map columns", "Handle matches", "Import"] as const;
export const IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_RECORDS = 1000;
export const IMPORT_ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"] as const;

export type ImportFieldKind = "string" | "number" | "boolean";

export type ImportFieldDef<K extends string = string> = {
  key: K;
  label: string;
  required?: boolean;
  options?: readonly string[];
  sample: string;
  kind?: ImportFieldKind;
};

export type ParsedImportFile = { headers: string[]; records: string[][] };
export type ImportMatchMode = "skip" | "update" | "create";
export type ImportSummary = { created: number; updated: number; skipped: number; ignored: number };

export function normalizeImportHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function toCsvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** BOM keeps non-ASCII values readable when the file is reopened in Excel. */
export function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\r\n");
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importHeaderRow<K extends string>(fields: ImportFieldDef<K>[]) {
  return fields.map((field) => (field.required ? `${field.label} *` : field.label));
}

export function downloadImportTemplate<K extends string>(
  filename: string,
  fields: ImportFieldDef<K>[],
) {
  downloadCsv(filename, [importHeaderRow(fields), fields.map((field) => field.sample)]);
}

export function exportRecordsCsv<T, K extends keyof T & string>(
  filename: string,
  fields: ImportFieldDef<K>[],
  records: T[],
  formatValue?: (record: T, key: K) => string,
) {
  const rows = records.map((record) =>
    fields.map((field) => {
      if (formatValue) return formatValue(record, field.key);
      const value = record[field.key];
      if (value == null) return "";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      return String(value);
    }),
  );
  downloadCsv(filename, [importHeaderRow(fields), ...rows]);
}

export function parseCsv(text: string) {
  const input = text.replace(/^\ufeff/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char !== '"') {
        cell += char;
      } else if (input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = false;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else {
      cell += char;
    }
  }
  row.push(cell);
  rows.push(row);

  return rows.filter((entry) => entry.some((value) => value.trim() !== ""));
}

export function buildImportHeaderMap<K extends string>(fields: ImportFieldDef<K>[]) {
  return new Map<string, K>(
    fields.flatMap((field) => [
      [normalizeImportHeader(field.label), field.key] as [string, K],
      [normalizeImportHeader(field.key), field.key] as [string, K],
    ]),
  );
}

export function coerceImportValue(
  raw: string,
  field: ImportFieldDef,
): { ok: true; value: string | number | boolean } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  if (field.options) {
    const option = field.options.find((entry) => entry.toLowerCase() === trimmed.toLowerCase());
    if (!option) return { ok: false };
    return { ok: true, value: option };
  }

  if (field.kind === "number") {
    const normalized = trimmed.replace(/,/g, "");
    const num = Number(normalized);
    if (!Number.isFinite(num)) return { ok: false };
    return { ok: true, value: num };
  }

  if (field.kind === "boolean") {
    const lower = trimmed.toLowerCase();
    if (["yes", "true", "1", "y"].includes(lower)) return { ok: true, value: true };
    if (["no", "false", "0", "n"].includes(lower)) return { ok: true, value: false };
    return { ok: false };
  }

  return { ok: true, value: trimmed };
}
