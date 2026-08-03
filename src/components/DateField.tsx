"use client";

import { Calendar, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DateFieldProps = {
  id?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(year: number, monthIndex: number, day: number) {
  return `${year}-${pad2(monthIndex + 1)}-${pad2(day)}`;
}

function parseIso(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, monthIndex: month - 1, day };
}

function toDisplay(iso: string) {
  const parsed = parseIso(iso);
  if (!parsed) return iso;
  return `${pad2(parsed.monthIndex + 1)} / ${pad2(parsed.day)} / ${parsed.year}`;
}

function startOfMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex, 1);
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function todayIso() {
  const now = new Date();
  return toIso(now.getFullYear(), now.getMonth(), now.getDate());
}

type CalendarCell = {
  iso: string;
  day: number;
  inMonth: boolean;
};

function buildMonthCells(year: number, monthIndex: number): CalendarCell[] {
  const first = startOfMonth(year, monthIndex);
  const leading = first.getDay();
  const total = daysInMonth(year, monthIndex);
  const cells: CalendarCell[] = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push({ iso: "", day: 0, inMonth: false });
  }

  for (let day = 1; day <= total; day += 1) {
    cells.push({
      iso: toIso(year, monthIndex, day),
      day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ iso: "", day: 0, inMonth: false });
  }

  return cells;
}

export function DateField({
  id,
  className = "field",
  value,
  onChange,
  placeholder = "mm / dd / yyyy",
}: DateFieldProps) {
  const buttonId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"days" | "months">("days");
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });

  const selected = parseIso(value);
  const initialView = selected ?? (() => {
    const now = new Date();
    return { year: now.getFullYear(), monthIndex: now.getMonth(), day: now.getDate() };
  })();
  const [viewYear, setViewYear] = useState(initialView.year);
  const [viewMonth, setViewMonth] = useState(initialView.monthIndex);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = todayIso();

  function updatePosition() {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = Math.max(280, Math.min(320, rect.width));
    const left = Math.min(rect.left, window.innerWidth - width - 8);
    const below = rect.bottom + 6;
    const popoverHeight = 300;
    const top =
      below + popoverHeight > window.innerHeight - 8 && rect.top > popoverHeight
        ? rect.top - popoverHeight - 6
        : below;
    setPosition({ top: Math.max(8, top), left: Math.max(8, left), width });
  }

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
      setViewMode("days");
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setViewMode("days");
      }
    }

    function onReposition() {
      updatePosition();
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  function openPicker() {
    if (selected) {
      setViewYear(selected.year);
      setViewMonth(selected.monthIndex);
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setViewMode("days");
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function selectDate(iso: string) {
    onChange(iso);
    setOpen(false);
    setViewMode("days");
  }

  const popover =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={popoverRef}
            className="date-picker-popover"
            role="dialog"
            aria-label="Choose date"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="date-picker-header">
              <button
                type="button"
                className="date-picker-month-btn"
                onClick={() => setViewMode((mode) => (mode === "days" ? "months" : "days"))}
                aria-label="Choose month"
              >
                <span>
                  {MONTHS[viewMonth]} {viewYear}
                </span>
                <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
              </button>
              <div className="date-picker-nav">
                <button
                  type="button"
                  className="date-picker-nav-btn"
                  onClick={() => (viewMode === "months" ? setViewYear((y) => y - 1) : shiftMonth(-1))}
                  aria-label={viewMode === "months" ? "Previous year" : "Previous month"}
                >
                  <ChevronLeft size={16} strokeWidth={1.75} aria-hidden />
                </button>
                <button
                  type="button"
                  className="date-picker-nav-btn"
                  onClick={() => (viewMode === "months" ? setViewYear((y) => y + 1) : shiftMonth(1))}
                  aria-label={viewMode === "months" ? "Next year" : "Next month"}
                >
                  <ChevronRight size={16} strokeWidth={1.75} aria-hidden />
                </button>
              </div>
            </div>

            {viewMode === "months" ? (
              <div className="date-picker-months">
                {MONTHS.map((month, index) => (
                  <button
                    key={month}
                    type="button"
                    className={`date-picker-month-cell${index === viewMonth ? " is-active" : ""}`}
                    onClick={() => {
                      setViewMonth(index);
                      setViewMode("days");
                    }}
                  >
                    {month.slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="date-picker-weekdays">
                  {WEEKDAYS.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="date-picker-grid">
                  {cells.map((cell, index) => {
                    if (!cell.inMonth) {
                      return <span key={`pad-${index}`} className="date-picker-day is-empty" />;
                    }
                    const isSelected = cell.iso === value;
                    const isToday = cell.iso === today;
                    return (
                      <button
                        key={cell.iso}
                        type="button"
                        className={[
                          "date-picker-day",
                          isSelected ? "is-selected" : "",
                          isToday ? "is-today" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        onClick={() => selectDate(cell.iso)}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="date-picker-footer">
              <button
                type="button"
                className="date-picker-action"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                  setViewMode("days");
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="date-picker-action"
                onClick={() => {
                  const iso = todayIso();
                  const parsed = parseIso(iso);
                  if (parsed) {
                    setViewYear(parsed.year);
                    setViewMonth(parsed.monthIndex);
                  }
                  selectDate(iso);
                }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`date-field ${className}`}>
      <button
        id={id ?? buttonId}
        type="button"
        className="date-field-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : openPicker())}
      >
        <span className={value ? "date-field-value" : "date-field-placeholder"}>
          {value ? toDisplay(value) : placeholder}
        </span>
        <Calendar className="date-field-icon" size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {popover}
    </div>
  );
}
