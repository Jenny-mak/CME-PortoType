"use client";

import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type ColumnFilter,
  type ColumnFilters,
  createEmptyFilter,
  filterOpNeedsSecondValue,
  filterOpNeedsValue,
  getFilterOperators,
  isColumnFilterable,
} from "@/lib/table";

function sidebarOperatorLabel(label: string) {
  return label.toLowerCase();
}

export function FieldFilterSection({
  columns,
  filters,
  searchQuery = "",
  onFilterChange,
}: {
  columns: ColumnDef[];
  filters: ColumnFilters;
  searchQuery?: string;
  onFilterChange: (key: string, next: ColumnFilter | undefined) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const filterableColumns = useMemo(
    () => columns.filter((column) => column.type !== "checkbox" && isColumnFilterable(column)),
    [columns],
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleColumns = useMemo(() => {
    if (!normalizedQuery) return filterableColumns;
    return filterableColumns.filter((column) => column.header.toLowerCase().includes(normalizedQuery));
  }, [filterableColumns, normalizedQuery]);

  function isEnabled(key: string) {
    return filters[key] != null;
  }

  function toggleField(column: ColumnDef, enabled: boolean) {
    if (enabled) {
      onFilterChange(column.key, filters[column.key] ?? createEmptyFilter(column.type));
      return;
    }
    onFilterChange(column.key, undefined);
  }

  function updateFilter(column: ColumnDef, patch: Partial<ColumnFilter>) {
    const current = filters[column.key] ?? createEmptyFilter(column.type);
    onFilterChange(column.key, { ...current, ...patch } as ColumnFilter);
  }

  return (
    <div className="filter-group field-filter-group">
      <button
        type="button"
        className="related-module-filter-heading"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDown size={12} className={expanded ? "is-open" : ""} aria-hidden />
        <strong>Filter By Fields</strong>
      </button>

      {expanded ? (
        <div className="field-filter-body">
          {visibleColumns.map((column) => {
            const enabled = isEnabled(column.key);
            const filter = filters[column.key] ?? createEmptyFilter(column.type);
            const operators = getFilterOperators(column.type);
            const needsValue = filterOpNeedsValue(filter.op);
            const needsSecondValue = filterOpNeedsSecondValue(filter.op);

            return (
              <div key={column.key} className="field-filter-item">
                <label className="filter-option field-filter-option">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => toggleField(column, event.target.checked)}
                  />
                  {column.header}
                </label>

                {enabled ? (
                  <div className="field-filter-rule">
                    <select
                      className="field-filter-select is-compact"
                      value={filter.op}
                      onChange={(event) => {
                        const op = event.target.value;
                        const next = createEmptyFilter(column.type, op);
                        const prev = filters[column.key];
                        if (prev && prev.kind === next.kind) {
                          onFilterChange(column.key, { ...prev, op: next.op } as ColumnFilter);
                        } else {
                          onFilterChange(column.key, next);
                        }
                      }}
                    >
                      {operators.map((option) => (
                        <option key={option.value} value={option.value}>
                          {sidebarOperatorLabel(option.label)}
                        </option>
                      ))}
                    </select>

                    {filter.kind === "enum" && filter.op === "is_any_of" ? (
                      <select
                        className="field-filter-select"
                        value={filter.values[0] ?? ""}
                        onChange={(event) =>
                          updateFilter(column, {
                            kind: "enum",
                            op: "is_any_of",
                            values: event.target.value ? [event.target.value] : [],
                          })
                        }
                      >
                        <option value="">Select value</option>
                        {(column.enumOptions ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : needsValue ? (
                      <input
                        className="field-filter-input"
                        value={"value" in filter ? String(filter.value ?? "") : ""}
                        placeholder="Enter value"
                        onChange={(event) => {
                          if (filter.kind === "text") {
                            updateFilter(column, { kind: "text", op: filter.op, value: event.target.value });
                          } else if (filter.kind === "number" || filter.kind === "duration") {
                            updateFilter(column, {
                              kind: filter.kind,
                              op: filter.op,
                              value: event.target.value,
                              valueTo: filter.valueTo,
                            });
                          } else if (filter.kind === "date") {
                            updateFilter(column, {
                              kind: "date",
                              op: filter.op,
                              value: event.target.value,
                              valueTo: filter.valueTo,
                            });
                          }
                        }}
                      />
                    ) : null}

                    {needsSecondValue && (filter.kind === "number" || filter.kind === "date" || filter.kind === "duration") ? (
                      <input
                        className="field-filter-input"
                        value={filter.valueTo ?? ""}
                        placeholder="To"
                        onChange={(event) =>
                          updateFilter(column, {
                            ...filter,
                            valueTo: event.target.value,
                          } as ColumnFilter)
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
