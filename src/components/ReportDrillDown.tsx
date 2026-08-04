"use client";

import { ArrowDown, ArrowUp, Download, Search, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Account, Call, Campaign, Deal, Lead, Meeting, Task } from "@/lib/types";

export type DrillMetric = { label: string; value: string };

/** Keeping rows tied to their entity lets the modal pick the right columns without casting. */
type DrillDataset =
  | { entity: "deals"; rows: Deal[] }
  | { entity: "accounts"; rows: Account[] }
  | { entity: "leads"; rows: Lead[] }
  | { entity: "campaigns"; rows: Campaign[] }
  | { entity: "tasks"; rows: Task[] }
  | { entity: "meetings"; rows: Meeting[] }
  | { entity: "calls"; rows: Call[] };

export type DrillRequest = DrillDataset & {
  /** Chart the click came from, shown as the modal eyebrow. */
  chart: string;
  /** Clicked series / slice label. */
  category: string;
  color?: string;
  metrics?: DrillMetric[];
};

type DrillEntity = DrillDataset["entity"];

const ENTITY_LABEL: Record<DrillEntity, { one: string; many: string }> = {
  deals: { one: "loan facility", many: "loan facilities" },
  accounts: { one: "client", many: "clients" },
  leads: { one: "lead", many: "leads" },
  campaigns: { one: "campaign", many: "campaigns" },
  tasks: { one: "task", many: "tasks" },
  meetings: { one: "meeting", many: "meetings" },
  calls: { one: "call", many: "calls" },
};

function countLabel(entity: DrillEntity, count: number) {
  const label = ENTITY_LABEL[entity];
  return `${count} ${count === 1 ? label.one : label.many}`;
}

type DrillColumn<T> = {
  key: string;
  label: string;
  numeric?: boolean;
  /** Raw value used for sorting, searching and CSV export. */
  get: (row: T) => string | number;
  render?: (row: T) => string;
};

function money(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const DEAL_COLUMNS: DrillColumn<Deal>[] = [
  { key: "facilityNumber", label: "Facility", get: (d) => d.facilityNumber },
  { key: "name", label: "Facility name", get: (d) => d.name },
  { key: "account", label: "Client", get: (d) => d.account },
  { key: "productType", label: "Product", get: (d) => d.productType },
  { key: "stage", label: "Stage", get: (d) => d.stage },
  { key: "facilityStatus", label: "Status", get: (d) => d.facilityStatus },
  { key: "riskGrade", label: "Risk", get: (d) => d.riskGrade },
  { key: "currency", label: "CCY", get: (d) => d.currency },
  { key: "amount", label: "Amount", numeric: true, get: (d) => d.amount, render: (d) => money(d.amount) },
  {
    key: "outstandingBalance",
    label: "Outstanding",
    numeric: true,
    get: (d) => d.outstandingBalance,
    render: (d) => money(d.outstandingBalance),
  },
  {
    key: "utilizationPct",
    label: "Util",
    numeric: true,
    get: (d) => d.utilizationPct,
    render: (d) => `${d.utilizationPct}%`,
  },
  {
    key: "probability",
    label: "Win",
    numeric: true,
    get: (d) => d.probability,
    render: (d) => `${d.probability}%`,
  },
  { key: "owner", label: "Owner", get: (d) => d.owner },
  { key: "maturityDate", label: "Maturity", get: (d) => d.maturityDate },
];

const ACCOUNT_COLUMNS: DrillColumn<Account>[] = [
  { key: "companyName", label: "Client", get: (a) => a.companyName },
  { key: "clientStatus", label: "Type", get: (a) => a.clientStatus },
  { key: "segment", label: "Segment", get: (a) => a.segment ?? "" },
  { key: "industry", label: "Industry", get: (a) => a.industry ?? "" },
  { key: "region", label: "Region", get: (a) => a.region ?? "" },
  { key: "country", label: "Country", get: (a) => a.country },
  { key: "riskRating", label: "Risk", get: (a) => a.riskRating ?? "" },
  { key: "kycStatus", label: "KYC", get: (a) => a.kycStatus ?? "" },
  { key: "rating", label: "Temperature", get: (a) => a.rating ?? "" },
  { key: "relationshipManager", label: "RM", get: (a) => a.relationshipManager },
  { key: "clientSince", label: "Client since", get: (a) => a.clientSince },
];

const LEAD_COLUMNS: DrillColumn<Lead>[] = [
  { key: "name", label: "Lead", get: (l) => l.name },
  { key: "company", label: "Company", get: (l) => l.company },
  { key: "status", label: "Status", get: (l) => l.status },
  { key: "owner", label: "Owner", get: (l) => l.owner },
  { key: "email", label: "Email", get: (l) => l.email },
  { key: "phone", label: "Phone", get: (l) => l.phone },
];

const CAMPAIGN_COLUMNS: DrillColumn<Campaign>[] = [
  { key: "code", label: "Code", get: (c) => c.code },
  { key: "name", label: "Campaign", get: (c) => c.name },
  { key: "type", label: "Type", get: (c) => c.type },
  { key: "channel", label: "Channel", get: (c) => c.channel },
  { key: "status", label: "Status", get: (c) => c.status },
  { key: "owner", label: "Owner", get: (c) => c.owner },
  {
    key: "budgetedCost",
    label: "Budget",
    numeric: true,
    get: (c) => c.budgetedCost,
    render: (c) => money(c.budgetedCost),
  },
  {
    key: "actualCost",
    label: "Actual",
    numeric: true,
    get: (c) => c.actualCost,
    render: (c) => money(c.actualCost),
  },
  {
    key: "expectedRevenue",
    label: "Expected revenue",
    numeric: true,
    get: (c) => c.expectedRevenue,
    render: (c) => money(c.expectedRevenue),
  },
  { key: "leadsGenerated", label: "Leads", numeric: true, get: (c) => c.leadsGenerated },
  { key: "convertedCount", label: "Converted", numeric: true, get: (c) => c.convertedCount },
  { key: "startDate", label: "Start", get: (c) => c.startDate },
  { key: "endDate", label: "End", get: (c) => c.endDate },
];

const TASK_COLUMNS: DrillColumn<Task>[] = [
  { key: "subject", label: "Subject", get: (t) => t.subject },
  { key: "account", label: "Related account", get: (t) => t.account },
  { key: "status", label: "Status", get: (t) => t.status },
  { key: "priority", label: "Priority", get: (t) => t.priority },
  { key: "dueDate", label: "Due", get: (t) => t.dueDate },
];

const MEETING_COLUMNS: DrillColumn<Meeting>[] = [
  { key: "title", label: "Meeting", get: (m) => m.title },
  { key: "relatedTo", label: "Related to", get: (m) => m.relatedTo },
  { key: "owner", label: "Owner", get: (m) => m.owner },
  { key: "from", label: "From", get: (m) => m.from },
  { key: "to", label: "To", get: (m) => m.to },
];

const CALL_COLUMNS: DrillColumn<Call>[] = [
  { key: "subject", label: "Subject", get: (c) => c.subject },
  { key: "type", label: "Direction", get: (c) => c.type },
  { key: "startTime", label: "Start", get: (c) => c.startTime },
  { key: "duration", label: "Duration", get: (c) => c.duration },
];

export function dealDrill(chart: string, category: string, rows: Deal[], color?: string): DrillRequest {
  const amount = rows.reduce((sum, d) => sum + d.amount, 0);
  const outstanding = rows.reduce((sum, d) => sum + d.outstandingBalance, 0);
  const weighted = rows.reduce((sum, d) => sum + (d.amount * d.probability) / 100, 0);
  return {
    entity: "deals",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Facility amount", value: money(amount) },
      { label: "Outstanding", value: money(outstanding) },
      { label: "Weighted pipeline", value: money(weighted) },
    ],
  };
}

export function accountDrill(chart: string, category: string, rows: Account[], color?: string): DrillRequest {
  return {
    entity: "accounts",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Active", value: String(rows.filter((a) => a.status === "Active").length) },
      { label: "High risk", value: String(rows.filter((a) => a.riskRating === "High").length) },
      { label: "KYC open", value: String(rows.filter((a) => a.kycStatus !== "Approved").length) },
    ],
  };
}

export function leadDrill(chart: string, category: string, rows: Lead[], color?: string): DrillRequest {
  const converted = rows.filter((l) => l.status === "Converted").length;
  return {
    entity: "leads",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Qualified", value: String(rows.filter((l) => l.status === "Qualified").length) },
      { label: "Converted", value: String(converted) },
      {
        label: "Conversion",
        value: rows.length ? `${Math.round((converted / rows.length) * 100)}%` : "—",
      },
    ],
  };
}

export function campaignDrill(chart: string, category: string, rows: Campaign[], color?: string): DrillRequest {
  return {
    entity: "campaigns",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Budget", value: money(rows.reduce((sum, c) => sum + c.budgetedCost, 0)) },
      { label: "Actual spend", value: money(rows.reduce((sum, c) => sum + c.actualCost, 0)) },
      { label: "Leads", value: String(rows.reduce((sum, c) => sum + c.leadsGenerated, 0)) },
      { label: "Converted", value: String(rows.reduce((sum, c) => sum + c.convertedCount, 0)) },
    ],
  };
}

export function taskDrill(chart: string, category: string, rows: Task[], color?: string): DrillRequest {
  return {
    entity: "tasks",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Open", value: String(rows.filter((t) => t.status !== "Completed").length) },
      { label: "Completed", value: String(rows.filter((t) => t.status === "Completed").length) },
      { label: "High priority", value: String(rows.filter((t) => t.priority === "High").length) },
    ],
  };
}

export function meetingDrill(chart: string, category: string, rows: Meeting[], color?: string): DrillRequest {
  return {
    entity: "meetings",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Owners", value: String(new Set(rows.map((m) => m.owner)).size) },
      { label: "Related records", value: String(new Set(rows.map((m) => m.relatedTo)).size) },
    ],
  };
}

export function callDrill(chart: string, category: string, rows: Call[], color?: string): DrillRequest {
  return {
    entity: "calls",
    rows,
    chart,
    category,
    color,
    metrics: [
      { label: "Inbound", value: String(rows.filter((c) => c.type === "Inbound").length) },
      { label: "Outbound", value: String(rows.filter((c) => c.type === "Outbound").length) },
    ],
  };
}

const DrillContext = createContext<(request: DrillRequest) => void>(() => {});

export function useReportDrill() {
  return useContext(DrillContext);
}

/**
 * Builds the recharts `onClick` handler for a series. Recharts reports the clicked index,
 * which is the only reliable way back to the source row once cells are coloured per index.
 */
export function makeDrillHandler(open: (request: DrillRequest) => void) {
  return function drill<T>(data: readonly T[], build: (item: T, index: number) => DrillRequest | null) {
    return (_: unknown, index: number) => {
      const item = data[index];
      if (!item) return;
      const request = build(item, index);
      if (request?.rows.length) open(request);
    };
  };
}

export function ReportDrillProvider({
  children,
  onOpenRecord,
}: {
  children: ReactNode;
  onOpenRecord?: (entity: DrillEntity, recordId: string) => void;
}) {
  const [request, setRequest] = useState<DrillRequest | null>(null);
  const open = useCallback((next: DrillRequest) => setRequest(next), []);
  const close = useCallback(() => setRequest(null), []);

  return (
    <DrillContext.Provider value={open}>
      {children}
      {request ? <DrillModal request={request} onClose={close} onOpenRecord={onOpenRecord} /> : null}
    </DrillContext.Provider>
  );
}

function DrillModal({
  request,
  onClose,
  onOpenRecord,
}: {
  request: DrillRequest;
  onClose: () => void;
  onOpenRecord?: (entity: DrillEntity, recordId: string) => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const shared = {
    fileStem: `${request.chart}-${request.category}`,
    entity: request.entity,
    onOpenRecord: onOpenRecord
      ? (recordId: string) => {
          onClose();
          onOpenRecord(request.entity, recordId);
        }
      : undefined,
  };

  return createPortal(
    <div className="modal-backdrop report-drill-backdrop" onClick={onClose}>
      <section
        className="modal-card report-drill-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${request.chart}: ${request.category}`}
        style={{ "--drill-accent": request.color ?? "var(--brand)" } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="report-drill-head">
          <div className="report-drill-heading">
            <span className="report-drill-swatch" />
            <div className="report-drill-titles">
              <p className="report-drill-eyebrow">{request.chart}</p>
              <h2>{request.category}</h2>
            </div>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="report-drill-metrics">
          <div className="report-drill-metric is-accent">
            <span>{ENTITY_LABEL[request.entity].many}</span>
            <strong>{request.rows.length}</strong>
          </div>
          {request.metrics?.map((metric) => (
            <div className="report-drill-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </div>
          ))}
        </div>

        {request.entity === "deals" ? <DrillTable {...shared} columns={DEAL_COLUMNS} rows={request.rows} /> : null}
        {request.entity === "accounts" ? (
          <DrillTable {...shared} columns={ACCOUNT_COLUMNS} rows={request.rows} />
        ) : null}
        {request.entity === "leads" ? <DrillTable {...shared} columns={LEAD_COLUMNS} rows={request.rows} /> : null}
        {request.entity === "campaigns" ? (
          <DrillTable {...shared} columns={CAMPAIGN_COLUMNS} rows={request.rows} />
        ) : null}
        {request.entity === "tasks" ? <DrillTable {...shared} columns={TASK_COLUMNS} rows={request.rows} /> : null}
        {request.entity === "meetings" ? (
          <DrillTable {...shared} columns={MEETING_COLUMNS} rows={request.rows} />
        ) : null}
        {request.entity === "calls" ? <DrillTable {...shared} columns={CALL_COLUMNS} rows={request.rows} /> : null}

        <footer className="report-drill-foot">
          <span>Click a column header to sort</span>
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

type SortState = { key: string; dir: "asc" | "desc" };

function DrillTable<T extends { id: string }>({
  columns,
  rows,
  fileStem,
  entity,
  onOpenRecord,
}: {
  columns: DrillColumn<T>[];
  rows: T[];
  fileStem: string;
  entity: DrillEntity;
  onOpenRecord?: (recordId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | null>(null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = needle
      ? rows.filter((row) => columns.some((col) => String(col.get(row)).toLowerCase().includes(needle)))
      : rows;
    if (!sort) return matched;
    const col = columns.find((item) => item.key === sort.key);
    if (!col) return matched;
    const direction = sort.dir === "asc" ? 1 : -1;
    return [...matched].sort((a, b) => {
      const left = col.get(a);
      const right = col.get(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right), "en") * direction;
    });
  }, [rows, columns, query, sort]);

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: "asc" };
      return current.dir === "asc" ? { key, dir: "desc" } : null;
    });
  }

  function exportCsv() {
    const header = columns.map((col) => csvCell(col.label)).join(",");
    const body = visible.map((row) => columns.map((col) => csvCell(col.get(row))).join(","));
    downloadCsv(`${slugify(fileStem)}.csv`, [header, ...body].join("\n"));
  }

  return (
    <>
      <div className="report-drill-toolbar">
        <label className="report-drill-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Filter these records"
            aria-label="Filter records"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="report-drill-count">
          {visible.length === rows.length
            ? countLabel(entity, rows.length)
            : `${visible.length} of ${countLabel(entity, rows.length)}`}
        </span>
        <button type="button" className="secondary-button" onClick={exportCsv} disabled={!visible.length}>
          <Download size={14} aria-hidden="true" />
          Export CSV
        </button>
      </div>

      <div className="report-drill-table-wrap">
        <table className="report-drill-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.numeric ? "is-numeric" : undefined} aria-sort={ariaSort(sort, col.key)}>
                  <button type="button" onClick={() => toggleSort(col.key)}>
                    <span>{col.label}</span>
                    {sort?.key === col.key ? (
                      sort.dir === "asc" ? (
                        <ArrowUp size={12} aria-hidden="true" />
                      ) : (
                        <ArrowDown size={12} aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={row.id}
                className={onOpenRecord ? "is-clickable" : undefined}
                tabIndex={onOpenRecord ? 0 : undefined}
                onClick={() => onOpenRecord?.(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenRecord?.(row.id);
                  }
                }}
              >
                {columns.map((col) => {
                  const text = col.render ? col.render(row) : String(col.get(row));
                  return (
                    <td key={col.key} className={col.numeric ? "is-numeric" : undefined}>
                      {text || "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length ? null : <p className="report-drill-empty">No records match “{query}”.</p>}
      </div>
    </>
  );
}

function ariaSort(sort: SortState | null, key: string) {
  if (sort?.key !== key) return "none" as const;
  return sort.dir === "asc" ? ("ascending" as const) : ("descending" as const);
}

function csvCell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report-drilldown"
  );
}

function downloadCsv(filename: string, csv: string) {
  // Excel needs the BOM to read UTF-8 without mangling non-ASCII labels.
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
