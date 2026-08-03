"use client";

import { AlertCircle, Check, CheckCircle2, Download, FileSpreadsheet, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  IMPORT_ACCEPTED_EXTENSIONS,
  IMPORT_MAX_FILE_BYTES,
  IMPORT_MAX_RECORDS,
  IMPORT_STEPS,
  buildImportHeaderMap,
  coerceImportValue,
  downloadImportTemplate,
  normalizeImportHeader,
  parseCsv,
  type ImportFieldDef,
  type ImportMatchMode,
  type ImportSummary,
  type ParsedImportFile,
} from "@/lib/csv-import";

export function ImportRecordsModal<T extends { id: string }, K extends string>({
  moduleLabel,
  recordLabel,
  fields,
  matchKey,
  matchLabel,
  existing,
  getMatchValue,
  createEmpty,
  makeId,
  templateFilename,
  onClose,
  onImport,
}: {
  moduleLabel: string;
  recordLabel: string;
  fields: ImportFieldDef<K>[];
  matchKey: K;
  matchLabel: string;
  existing: T[];
  getMatchValue: (record: T) => string;
  createEmpty: () => T;
  makeId: (index: number) => string;
  templateFilename: string;
  onClose: () => void;
  onImport: (created: T[], updated: T[]) => void;
}) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<(K | "")[]>([]);
  const [matchMode, setMatchMode] = useState<ImportMatchMode>("skip");
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const fieldByKey = useMemo(() => new Map(fields.map((field) => [field.key, field])), [fields]);
  const fieldByHeader = useMemo(() => buildImportHeaderMap(fields), [fields]);
  const matchColumn = mapping.indexOf(matchKey);

  const existingByMatch = useMemo(() => {
    const map = new Map<string, T>();
    existing.forEach((record) => {
      const key = getMatchValue(record).trim().toLowerCase();
      if (key) map.set(key, record);
    });
    return map;
  }, [existing, getMatchValue]);

  const matchCount = useMemo(() => {
    if (!parsed || matchColumn < 0) return 0;
    return parsed.records.filter((record) =>
      existingByMatch.has((record[matchColumn] ?? "").trim().toLowerCase()),
    ).length;
  }, [parsed, matchColumn, existingByMatch]);

  function resetFile() {
    setFile(null);
    setParsed(null);
    setMapping([]);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadTemplate() {
    downloadImportTemplate(templateFilename, fields);
  }

  async function acceptFiles(candidates: File[]) {
    if (candidates.length === 0) return;
    if (candidates.length > 1) {
      setError("You can't upload more than 1 file.");
      return;
    }
    const candidate = candidates[0];
    const name = candidate.name.toLowerCase();
    if (!IMPORT_ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension))) {
      setError("Unsupported file type. Upload a .csv, .xlsx, or .xls file.");
      return;
    }
    if (candidate.size > IMPORT_MAX_FILE_BYTES) {
      setError("File can be a max of 5 MB.");
      return;
    }

    if (!name.endsWith(".csv")) {
      setError(null);
      setFile(candidate);
      setParsed(null);
      setMapping([]);
      return;
    }

    const [headers = [], ...records] = parseCsv(await candidate.text());
    if (headers.length === 0 || records.length === 0) {
      setError("This file has no data rows. Fill in the template and upload it again.");
      return;
    }
    if (records.length > IMPORT_MAX_RECORDS) {
      setError(
        `You can import a max of ${IMPORT_MAX_RECORDS.toLocaleString()} records to the ${moduleLabel} module.`,
      );
      return;
    }
    setError(null);
    setFile(candidate);
    setParsed({ headers, records });
    setMapping(headers.map((header) => fieldByHeader.get(normalizeImportHeader(header)) ?? ""));
  }

  function runImport() {
    if (!parsed) return;
    const created: T[] = [];
    const updated: T[] = [];
    let skipped = 0;
    let ignored = 0;

    parsed.records.forEach((record, index) => {
      const values: Partial<Record<K, string | number | boolean>> = {};
      mapping.forEach((key, column) => {
        if (!key) return;
        const raw = (record[column] ?? "").trim();
        if (!raw) return;
        const field = fieldByKey.get(key);
        if (!field) return;
        const coerced = coerceImportValue(raw, field);
        if (!coerced.ok) {
          ignored += 1;
          return;
        }
        values[key] = coerced.value;
      });

      const matchRaw = values[matchKey];
      const matchValue = matchRaw == null ? "" : String(matchRaw).trim();
      if (!matchValue) {
        skipped += 1;
        return;
      }

      const duplicate = existingByMatch.get(matchValue.toLowerCase());
      if (duplicate) {
        if (matchMode === "skip") {
          skipped += 1;
          return;
        }
        if (matchMode === "update") {
          updated.push({ ...duplicate, ...values });
          return;
        }
      }
      created.push({ ...createEmpty(), ...values, id: makeId(index) });
    });

    onImport(created, updated);
    setSummary({ created: created.length, updated: updated.length, skipped, ignored });
    setStep(4);
  }

  const canLeaveUpload = Boolean(file);
  const canLeaveMapping = Boolean(parsed) && matchColumn >= 0;
  const recordWord = recordLabel.toLowerCase();

  return (
    <div className="modal-backdrop import-modal-backdrop" onClick={onClose}>
      <section className="modal-card import-modal" onClick={(event) => event.stopPropagation()}>
        <header className="import-header">
          <div className="import-header-top">
            <div className="import-header-title">
              <p className="client-form-eyebrow">{moduleLabel}</p>
              <h2>Import to {moduleLabel}</h2>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
              <X size={16} />
            </button>
          </div>
          <ol className="import-steps">
            {IMPORT_STEPS.map((label, index) => {
              const value = index + 1;
              const state = value === step ? "is-active" : value < step ? "is-done" : "";
              return (
                <li key={label} className={`import-step ${state}`}>
                  <span className="import-step-index">
                    {value < step ? <Check size={13} /> : value}
                  </span>
                  <span className="import-step-label">{label}</span>
                </li>
              );
            })}
          </ol>
        </header>

        <div className="import-body">
          {step === 1 ? (
            <>
              <div
                className={`import-dropzone ${dragging ? "is-dragging" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void acceptFiles(Array.from(event.dataTransfer.files));
                }}
              >
                <button type="button" className="primary-button" onClick={() => inputRef.current?.click()}>
                  Browse
                </button>
                <input
                  ref={inputRef}
                  className="import-file-input"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(event) => {
                    const chosen = Array.from(event.target.files ?? []);
                    event.target.value = "";
                    void acceptFiles(chosen);
                  }}
                />
                <p className="import-dropzone-title">or drag and drop a CSV file</p>
                <p className="import-dropzone-hint">(.csv, .xlsx, and .xls file types are supported)</p>
              </div>

              <ul className="import-notes">
                <li>
                  File can be a max of 5 MB. You can import a max of {IMPORT_MAX_RECORDS.toLocaleString()} records to
                  the {moduleLabel} module.
                </li>
                <li>You can&apos;t upload more than 1 file.</li>
              </ul>

              {error ? (
                <p className="import-alert" role="alert">
                  <AlertCircle size={14} />
                  {error}
                </p>
              ) : null}

              {file ? (
                <div className="import-file-card">
                  <FileSpreadsheet size={18} />
                  <div className="import-file-meta">
                    <strong>{file.name}</strong>
                    <span>
                      {(file.size / 1024).toFixed(1)} KB
                      {parsed ? ` · ${parsed.records.length} record${parsed.records.length === 1 ? "" : "s"}` : ""}
                    </span>
                  </div>
                  <button type="button" className="icon-button" aria-label="Remove file" onClick={resetFile}>
                    <X size={14} />
                  </button>
                </div>
              ) : null}

              <div className="import-template">
                <div>
                  <strong>Not sure how to format your file?</strong>
                  <p>
                    Download the template, fill in your {recordWord} data, then upload it here.
                  </p>
                </div>
                <button type="button" className="secondary-button" onClick={downloadTemplate}>
                  <Download size={14} />
                  Download template
                </button>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            parsed ? (
              <>
                <p className="import-step-hint">
                  We matched the columns in <strong>{file?.name}</strong> to {recordLabel} fields. Adjust any
                  column that should map somewhere else.
                </p>
                {matchColumn < 0 ? (
                  <p className="import-alert" role="alert">
                    <AlertCircle size={14} />
                    Map a column to {matchLabel} to continue.
                  </p>
                ) : null}
                <div className="import-map-table">
                  <div className="import-map-head">
                    <span>Column in file</span>
                    <span>Sample value</span>
                    <span>{recordLabel} field</span>
                  </div>
                  {parsed.headers.map((header, index) => (
                    <div className="import-map-row" key={`${header}-${index}`}>
                      <span className="import-map-column">{header || `Column ${index + 1}`}</span>
                      <span className="import-map-sample">{parsed.records[0]?.[index] || "—"}</span>
                      <select
                        className="field"
                        aria-label={`Map ${header || `column ${index + 1}`}`}
                        value={mapping[index] ?? ""}
                        onChange={(event) =>
                          setMapping((prev) => {
                            const next = [...prev];
                            next[index] = event.target.value as K | "";
                            return next;
                          })
                        }
                      >
                        <option value="">Do not import</option>
                        {fields.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.required ? `${field.label} *` : field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="import-empty-state">
                <AlertCircle size={18} />
                <div>
                  <strong>Column preview is only available for CSV files.</strong>
                  <p>Save {file?.name} as CSV — or start from the template — and upload it again.</p>
                </div>
                <button type="button" className="secondary-button" onClick={downloadTemplate}>
                  <Download size={14} />
                  Download template
                </button>
              </div>
            )
          ) : null}

          {step === 3 ? (
            <>
              <p className="import-step-hint">
                {moduleLabel} records are matched on <strong>{matchLabel}</strong>. {matchCount} of{" "}
                {parsed?.records.length ?? 0} record{matchCount === 1 ? "" : "s"} in this file already exist.
              </p>
              <div className="import-choice-list">
                {(
                  [
                    [
                      "skip",
                      "Skip matching records",
                      `Keep existing ${recordWord}s untouched and import only new ones.`,
                    ],
                    [
                      "update",
                      "Update matching records",
                      `Overwrite the mapped fields on existing ${recordWord}s.`,
                    ],
                    [
                      "create",
                      "Create as new records",
                      `Import everything, even when a ${recordWord} already exists.`,
                    ],
                  ] as [ImportMatchMode, string, string][]
                ).map(([value, label, description]) => (
                  <label key={value} className={`import-choice ${matchMode === value ? "is-selected" : ""}`}>
                    <input
                      type="radio"
                      name="import-match-mode"
                      value={value}
                      checked={matchMode === value}
                      onChange={() => setMatchMode(value)}
                    />
                    <span>
                      <strong>{label}</strong>
                      <em>{description}</em>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : null}

          {step === 4 && summary ? (
            <div className="import-summary">
              <CheckCircle2 size={26} />
              <h3>Import complete</h3>
              <p>{file?.name} has been processed.</p>
              <div className="import-summary-grid">
                <div>
                  <strong>{summary.created}</strong>
                  <span>Created</span>
                </div>
                <div>
                  <strong>{summary.updated}</strong>
                  <span>Updated</span>
                </div>
                <div>
                  <strong>{summary.skipped}</strong>
                  <span>Skipped</span>
                </div>
                <div>
                  <strong>{summary.ignored}</strong>
                  <span>Ignored values</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <footer className="client-form-footer import-footer">
          <span className="import-footer-step">
            Step {step} of {IMPORT_STEPS.length}
          </span>
          {step > 1 && step < 4 ? (
            <button type="button" className="secondary-button" onClick={() => setStep((prev) => prev - 1)}>
              Back
            </button>
          ) : null}
          {step < 4 ? (
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
          ) : null}
          {step === 1 ? (
            <button
              type="button"
              className="primary-button"
              disabled={!canLeaveUpload}
              onClick={() => setStep(2)}
            >
              Next
            </button>
          ) : null}
          {step === 2 ? (
            <button
              type="button"
              className="primary-button"
              disabled={!canLeaveMapping}
              onClick={() => setStep(3)}
            >
              Next
            </button>
          ) : null}
          {step === 3 ? (
            <button type="button" className="primary-button" onClick={runImport}>
              Import
            </button>
          ) : null}
          {step === 4 ? (
            <button type="button" className="primary-button" onClick={onClose}>
              Done
            </button>
          ) : null}
        </footer>
      </section>
    </div>
  );
}
