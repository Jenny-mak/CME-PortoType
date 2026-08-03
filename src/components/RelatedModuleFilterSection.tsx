"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ModuleKey } from "@/lib/types";
import {
  createDefaultRelatedFieldRule,
  createDefaultRelatedRules,
  getOneToManyRelatedModules,
  hasActiveRelatedRules,
  relatedFieldTypeToFieldType,
  type RelatedModuleFieldDef,
  type RelatedModuleFieldRule,
  type RelatedModuleRule,
} from "@/lib/related-module-filters";
import {
  type ColumnFilter,
  createEmptyFilter,
  filterOpNeedsSecondValue,
  filterOpNeedsValue,
  getFilterOperators,
} from "@/lib/table";

function sidebarOperatorLabel(label: string) {
  return label.toLowerCase();
}

export function RelatedModuleFilterSection({
  moduleKey,
  appliedRules,
  onApply,
  onClear,
}: {
  moduleKey: ModuleKey;
  appliedRules: RelatedModuleRule[];
  onApply: (rules: RelatedModuleRule[]) => void;
  onClear: () => void;
}) {
  const relatedModules = useMemo(() => getOneToManyRelatedModules(moduleKey), [moduleKey]);
  const [expanded, setExpanded] = useState(true);
  const [draftRules, setDraftRules] = useState<RelatedModuleRule[]>(() => createDefaultRelatedRules(moduleKey));

  useEffect(() => {
    setDraftRules((prev) => {
      const defaults = createDefaultRelatedRules(moduleKey);
      return defaults.map((item) => {
        const existing = prev.find((rule) => rule.relatedKey === item.relatedKey);
        const applied = appliedRules.find((rule) => rule.relatedKey === item.relatedKey);
        return applied ?? existing ?? item;
      });
    });
  }, [moduleKey, appliedRules]);

  if (relatedModules.length === 0) return null;

  function updateRule(relatedKey: string, patch: Partial<RelatedModuleRule>) {
    setDraftRules((prev) =>
      prev.map((rule) => (rule.relatedKey === relatedKey ? { ...rule, ...patch } : rule)),
    );
  }

  function updateFieldRule(relatedKey: string, fieldKey: string, patch: Partial<RelatedModuleFieldRule>) {
    setDraftRules((prev) =>
      prev.map((rule) => {
        if (rule.relatedKey !== relatedKey) return rule;
        return {
          ...rule,
          fieldRules: rule.fieldRules.map((fieldRule) =>
            fieldRule.fieldKey === fieldKey ? { ...fieldRule, ...patch } : fieldRule,
          ),
        };
      }),
    );
  }

  function updateFieldFilter(
    relatedKey: string,
    field: RelatedModuleFieldDef,
    patch: Partial<ColumnFilter>,
  ) {
    setDraftRules((prev) =>
      prev.map((rule) => {
        if (rule.relatedKey !== relatedKey) return rule;
        return {
          ...rule,
          fieldRules: rule.fieldRules.map((fieldRule) => {
            if (fieldRule.fieldKey !== field.key) return fieldRule;
            const current = fieldRule.filter ?? createEmptyFilter(relatedFieldTypeToFieldType(field.type));
            return { ...fieldRule, filter: { ...current, ...patch } as ColumnFilter };
          }),
        };
      }),
    );
  }

  function toggleModule(relatedKey: string, enabled: boolean) {
    updateRule(relatedKey, {
      enabled,
      showFields: false,
      fieldRules: [],
    });
  }

  function openFieldPicker(relatedKey: string) {
    const module = relatedModules.find((item) => item.key === relatedKey);
    if (!module) return;
    updateRule(relatedKey, {
      showFields: true,
      fieldRules: module.fields.map((field) => createDefaultRelatedFieldRule(field)),
    });
  }

  function removeFieldRule(relatedKey: string, field: RelatedModuleFieldDef) {
    updateFieldRule(relatedKey, field.key, createDefaultRelatedFieldRule(field));
  }

  return (
    <div className="related-module-filter-group">
      <button
        type="button"
        className="related-module-filter-heading"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <ChevronDown size={12} className={expanded ? "is-open" : ""} aria-hidden />
        <strong>Filter By Related Modules</strong>
      </button>

      {expanded ? (
        <div className="related-module-filter-body">
          {relatedModules.map((module) => {
            const rule = draftRules.find((item) => item.relatedKey === module.key);
            if (!rule) return null;

            return (
              <div key={module.key} className="related-module-filter-item">
                <label className="filter-option related-module-filter-option">
                  <input
                    type="checkbox"
                    checked={rule.enabled}
                    onChange={(event) => toggleModule(module.key, event.target.checked)}
                  />
                  {module.label}
                </label>

                {rule.enabled ? (
                  <div className="related-module-filter-rule">
                    {!rule.showFields ? (
                      <button
                        type="button"
                        className="related-module-filter-add-field"
                        onClick={() => openFieldPicker(module.key)}
                      >
                        <Plus size={12} />
                        Add Field
                      </button>
                    ) : (
                      <div className="related-module-field-list">
                        {module.fields.map((field) => {
                          const fieldRule = rule.fieldRules.find((item) => item.fieldKey === field.key);
                          if (!fieldRule) return null;

                          const fieldType = relatedFieldTypeToFieldType(field.type);
                          const filter = fieldRule.filter ?? createEmptyFilter(fieldType);
                          const operators = getFilterOperators(fieldType);
                          const needsValue = filterOpNeedsValue(filter.op);
                          const needsSecondValue = filterOpNeedsSecondValue(filter.op);

                          return (
                            <div key={field.key} className="related-module-field-item">
                              <label className="filter-option related-module-filter-option">
                                <input
                                  type="checkbox"
                                  checked={fieldRule.enabled}
                                  onChange={(event) =>
                                    updateFieldRule(module.key, field.key, { enabled: event.target.checked })
                                  }
                                />
                                {field.label}
                              </label>

                              {fieldRule.enabled ? (
                                <div className="related-module-filter-row related-module-filter-operator-row">
                                  <button
                                    type="button"
                                    className="related-module-filter-remove"
                                    aria-label={`Remove ${field.label} filter`}
                                    onClick={() => removeFieldRule(module.key, field)}
                                  >
                                    <Minus size={10} />
                                  </button>
                                  <select
                                    className="related-module-filter-select is-compact"
                                    value={filter.op}
                                    onChange={(event) => {
                                      const op = event.target.value;
                                      const next = createEmptyFilter(fieldType, op);
                                      const prev = fieldRule.filter;
                                      if (prev && prev.kind === next.kind) {
                                        updateFieldFilter(module.key, field, { op: next.op } as Partial<ColumnFilter>);
                                      } else {
                                        updateFieldRule(module.key, field.key, { filter: next });
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
                                      className="related-module-filter-select"
                                      value={filter.values[0] ?? ""}
                                      onChange={(event) =>
                                        updateFieldFilter(module.key, field, {
                                          kind: "enum",
                                          op: "is_any_of",
                                          values: event.target.value ? [event.target.value] : [],
                                        })
                                      }
                                    >
                                      <option value="">Select value</option>
                                      {(field.enumOptions ?? []).map((option) => (
                                        <option key={option} value={option}>
                                          {option}
                                        </option>
                                      ))}
                                    </select>
                                  ) : needsValue ? (
                                    <input
                                      className="related-module-filter-input"
                                      value={"value" in filter ? String(filter.value ?? "") : ""}
                                      placeholder="Enter value"
                                      onChange={(event) => {
                                        if (filter.kind === "text") {
                                          updateFieldFilter(module.key, field, {
                                            kind: "text",
                                            op: filter.op,
                                            value: event.target.value,
                                          });
                                        } else if (filter.kind === "number") {
                                          updateFieldFilter(module.key, field, {
                                            kind: "number",
                                            op: filter.op,
                                            value: event.target.value,
                                            valueTo: filter.valueTo,
                                          });
                                        }
                                      }}
                                    />
                                  ) : null}

                                  {needsSecondValue && filter.kind === "number" ? (
                                    <input
                                      className="related-module-filter-input"
                                      value={filter.valueTo ?? ""}
                                      placeholder="To"
                                      onChange={(event) =>
                                        updateFieldFilter(module.key, field, {
                                          ...filter,
                                          valueTo: event.target.value,
                                        })
                                      }
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}

          <div className="related-module-filter-actions">
            <button
              type="button"
              className="primary-button related-module-filter-apply"
              onClick={() =>
                onApply(
                  draftRules.filter(
                    (rule) =>
                      rule.enabled &&
                      rule.fieldRules.some((fieldRule) => fieldRule.enabled && fieldRule.fieldKey),
                  ),
                )
              }
            >
              Apply Filter
            </button>
            <button
              type="button"
              className="secondary-button related-module-filter-clear"
              onClick={() => {
                setDraftRules(createDefaultRelatedRules(moduleKey));
                onClear();
              }}
              disabled={!hasActiveRelatedRules(appliedRules) && !hasActiveRelatedRules(draftRules)}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
