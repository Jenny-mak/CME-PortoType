import { contacts, deals, loanFacilities } from "./crm-data";
import {
  createEmptyFilter,
  matchesFieldFilter,
  type ColumnFilter,
  type FieldType,
} from "./table";
import type { Contact, Deal, LoanFacility, ModuleKey } from "./types";
import { isProductPipelineModule } from "./product-pipeline";

export type RelatedFieldType = "text" | "enum" | "number";

export type RelatedModuleFieldDef = {
  key: string;
  label: string;
  type: RelatedFieldType;
  enumOptions?: string[];
};

export type RelatedModuleDef = {
  key: string;
  label: string;
  /** One parent record has many related records. */
  cardinality: "one-to-many";
  fields: RelatedModuleFieldDef[];
  getRelatedRecords: (parentId: string) => Record<string, unknown>[];
  getFieldValue: (record: Record<string, unknown>, fieldKey: string) => string | number;
};

export type RelatedCountMode = "any";

export type RelatedModuleFieldRule = {
  fieldKey: string;
  enabled: boolean;
  filter: ColumnFilter;
};

export function relatedFieldTypeToFieldType(type: RelatedFieldType): FieldType {
  if (type === "enum") return "enum";
  if (type === "number") return "number";
  return "text";
}

export function createDefaultRelatedFieldRule(field: RelatedModuleFieldDef): RelatedModuleFieldRule {
  return {
    fieldKey: field.key,
    enabled: false,
    filter: createEmptyFilter(relatedFieldTypeToFieldType(field.type)),
  };
}

export type RelatedModuleRule = {
  relatedKey: string;
  enabled: boolean;
  countMode: RelatedCountMode;
  showFields: boolean;
  fieldRules: RelatedModuleFieldRule[];
};

const LOAN_FACILITY_FIELDS: RelatedModuleFieldDef[] = [
  { key: "name", label: "Facility Name", type: "text" },
  { key: "tranche", label: "Tranche", type: "text" },
  { key: "facilityType", label: "Facility Type", type: "text" },
  { key: "greenLoanIndicator", label: "Green Loan Indicator", type: "enum", enumOptions: ["Yes", "No"] },
  { key: "sllIndicator", label: "SLL Indicator", type: "enum", enumOptions: ["Yes", "No"] },
  { key: "creditConnectIndicator", label: "Credit Connect Indicator", type: "enum", enumOptions: ["Yes", "No"] },
  { key: "newIndustrySector", label: "New Industry Sector", type: "text" },
  { key: "dealType", label: "Deal Type", type: "text" },
  { key: "currency", label: "Loan Currency", type: "enum", enumOptions: ["CNY", "HKD", "USD", "SGD"] },
  { key: "amount", label: "Amount", type: "number" },
  { key: "status", label: "Status", type: "enum", enumOptions: ["Pipeline", "Committed", "Drawn", "Fully Repaid", "Cancelled"] },
];

const LOAN_FIELDS: RelatedModuleFieldDef[] = [
  { key: "name", label: "Loan Name", type: "text" },
  { key: "facilityNumber", label: "Facility Number", type: "text" },
  { key: "stage", label: "Stage", type: "text" },
  { key: "productType", label: "Product Type", type: "text" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "currency", label: "Currency", type: "enum", enumOptions: ["CNY", "HKD", "USD", "SGD"] },
  { key: "facilityStatus", label: "Facility Status", type: "enum", enumOptions: ["Pipeline", "Committed", "Drawn", "Fully Repaid", "Cancelled"] },
  { key: "owner", label: "Owner", type: "text" },
  { key: "businessUnit", label: "Business Unit", type: "text" },
];

const CONTACT_FIELDS: RelatedModuleFieldDef[] = [
  { key: "name", label: "Contact Name", type: "text" },
  { key: "title", label: "Title", type: "text" },
  { key: "department", label: "Department", type: "text" },
  { key: "email", label: "Email", type: "text" },
  { key: "phone", label: "Phone", type: "text" },
  { key: "status", label: "Status", type: "enum", enumOptions: ["Active", "Inactive"] },
  { key: "role", label: "Role", type: "text" },
];

function asFacility(record: Record<string, unknown>) {
  return record as LoanFacility;
}

function asDeal(record: Record<string, unknown>) {
  return record as Deal;
}

function asContact(record: Record<string, unknown>) {
  return record as Contact;
}

const LOAN_FACILITY_MODULE: RelatedModuleDef = {
  key: "loanFacility",
  label: "Loan Facility",
  cardinality: "one-to-many",
  fields: LOAN_FACILITY_FIELDS,
  getRelatedRecords: (parentId) => loanFacilities.filter((item) => item.loanId === parentId),
  getFieldValue: (record, fieldKey) => {
    const facility = asFacility(record);
    const value = facility[fieldKey as keyof LoanFacility];
    return value == null ? "" : (value as string | number);
  },
};

const LOANS_MODULE: RelatedModuleDef = {
  key: "loans",
  label: "Loans",
  cardinality: "one-to-many",
  fields: LOAN_FIELDS,
  getRelatedRecords: (parentId) => deals.filter((item) => item.accountId === parentId),
  getFieldValue: (record, fieldKey) => {
    const deal = asDeal(record);
    const value = deal[fieldKey as keyof Deal];
    return value == null ? "" : (value as string | number);
  },
};

const CONTACTS_MODULE: RelatedModuleDef = {
  key: "contacts",
  label: "Contacts",
  cardinality: "one-to-many",
  fields: CONTACT_FIELDS,
  getRelatedRecords: (parentId) => contacts.filter((item) => item.accountId === parentId),
  getFieldValue: (record, fieldKey) => {
    const contact = asContact(record);
    const value = contact[fieldKey as keyof Contact];
    return value == null ? "" : (value as string | number);
  },
};

const RELATED_MODULES_BY_PARENT: Partial<Record<ModuleKey, RelatedModuleDef[]>> = {
  accounts: [LOANS_MODULE, CONTACTS_MODULE],
  deals: [LOAN_FACILITY_MODULE],
  tradeFinance: [LOAN_FACILITY_MODULE],
  paymentService: [LOAN_FACILITY_MODULE],
  sustainableFinance: [LOAN_FACILITY_MODULE],
  globalMarket: [LOAN_FACILITY_MODULE],
  lifeInsurance: [LOAN_FACILITY_MODULE],
};

export function getOneToManyRelatedModules(moduleKey: ModuleKey | undefined): RelatedModuleDef[] {
  if (!moduleKey) return [];
  return RELATED_MODULES_BY_PARENT[moduleKey] ?? [];
}

export function createDefaultRelatedRules(moduleKey: ModuleKey | undefined): RelatedModuleRule[] {
  return getOneToManyRelatedModules(moduleKey).map((module) => ({
    relatedKey: module.key,
    enabled: false,
    countMode: "any",
    showFields: false,
    fieldRules: [],
  }));
}

function getRelatedModuleDef(moduleKey: ModuleKey, relatedKey: string): RelatedModuleDef | undefined {
  return getOneToManyRelatedModules(moduleKey).find((item) => item.key === relatedKey);
}

function matchesRelatedRule(
  parentId: string,
  rule: RelatedModuleRule,
  def: RelatedModuleDef,
): boolean {
  const related = def.getRelatedRecords(parentId);
  if (related.length === 0) return false;

  const activeFieldRules = rule.fieldRules.filter((fieldRule) => fieldRule.enabled && fieldRule.fieldKey);
  if (activeFieldRules.length === 0) return related.length > 0;

  return related.some((record) =>
    activeFieldRules.every((fieldRule) => {
      const fieldDef = def.fields.find((field) => field.key === fieldRule.fieldKey);
      const fieldType = relatedFieldTypeToFieldType(fieldDef?.type ?? "text");
      const raw = def.getFieldValue(record, fieldRule.fieldKey);
      return matchesFieldFilter(raw, fieldType, fieldRule.filter);
    }),
  );
}

export function applyRelatedModuleFilters<T extends { id: string }>(
  rows: T[],
  moduleKey: ModuleKey | undefined,
  rules: RelatedModuleRule[],
): T[] {
  if (!moduleKey) return rows;
  const activeRules = rules.filter((rule) => rule.enabled);
  if (activeRules.length === 0) return rows;

  return rows.filter((row) =>
    activeRules.every((rule) => {
      const def = getRelatedModuleDef(moduleKey, rule.relatedKey);
      if (!def) return true;
      return matchesRelatedRule(row.id, rule, def);
    }),
  );
}

export function hasActiveRelatedRules(rules: RelatedModuleRule[]) {
  return rules.some(
    (rule) => rule.enabled && rule.fieldRules.some((fieldRule) => fieldRule.enabled && fieldRule.fieldKey),
  );
}

export function isPipelineModuleWithRelatedFilters(moduleKey: ModuleKey | undefined) {
  return moduleKey != null && isProductPipelineModule(moduleKey);
}
