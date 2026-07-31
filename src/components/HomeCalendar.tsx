"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Mail, Phone, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { calls as seedCalls, meetings as seedMeetings, tasks as seedTasks } from "@/lib/crm-data";
import { getHoliday } from "@/lib/holidays";
import { getPipelineLoansSnapshot, subscribePipelineLoans } from "@/lib/pipeline-loans";
import { ActivityStatus, Call, Deal, Meeting, ModuleKey, Task } from "@/lib/types";

type CalendarView = "day" | "week" | "month";
type PickerPanel = "days" | "months" | "years";
type ActivityCreateKind = "email" | "call" | "meeting" | "task";

type CalendarEmail = {
  id: string;
  to: string;
  subject: string;
  body: string;
  dateKey: string;
};

type CalendarEvent =
  | { kind: "meeting"; id: string; title: string; dateKey: string; timeLabel: string; record: Meeting }
  | { kind: "task"; id: string; title: string; dateKey: string; timeLabel: string; record: Task }
  | { kind: "call"; id: string; title: string; dateKey: string; timeLabel: string; record: Call }
  | { kind: "email"; id: string; title: string; dateKey: string; timeLabel: string; record: CalendarEmail };

type Urgency = "overdue" | "today" | "due-soon" | "none";

type OpenForm =
  | { kind: "meeting"; record: Meeting; mode: "create" | "edit" }
  | { kind: "task"; record: Task; mode: "create" | "edit" }
  | { kind: "call"; record: Call; mode: "create" | "edit" }
  | { kind: "email"; record: CalendarEmail; mode: "create" | "edit" };

const DUE_SOON_DAYS = 3;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
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
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDateKey(value: string): string | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function extractTimeLabel(value: string) {
  const match = value.trim().match(/(\d{1,2}:\d{2}\s*(?:AM|PM))/i);
  return match ? match[1].replace(/\s+/g, " ") : "";
}

function addDays(date: Date, delta: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfWeek(date: Date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(base, -((base.getDay() + 6) % 7));
}

function endOfWeek(date: Date) {
  return addDays(startOfWeek(date), 6);
}

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function formatShortDate(date: Date) {
  return `${pad2(date.getDate())} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function formatWeekTitle(date: Date) {
  return `${formatShortDate(startOfWeek(date))} – ${formatShortDate(endOfWeek(date))}`;
}

function formatCreateDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function blankMeeting(dateKey: string): Meeting {
  return {
    id: `meeting-${Date.now()}`,
    title: "",
    from: `${dateKey} 09:00 AM`,
    to: `${dateKey} 10:00 AM`,
    relatedTo: "",
    owner: "",
  };
}

function blankTask(dateKey: string): Task {
  return {
    id: `task-${Date.now()}`,
    subject: "",
    dueDate: dateKey,
    status: "Not Started",
    priority: "Normal",
    account: "",
  };
}

function blankCall(dateKey: string): Call {
  return {
    id: `call-${Date.now()}`,
    subject: "",
    type: "Outbound",
    startTime: `${dateKey} 09:00 AM`,
    duration: "00:15",
  };
}

function blankEmail(dateKey: string): CalendarEmail {
  return {
    id: `email-${Date.now()}`,
    to: "",
    subject: "",
    body: "",
    dateKey,
  };
}

function eventKindLabel(event: CalendarEvent) {
  switch (event.kind) {
    case "meeting":
      return "Meeting";
    case "task":
      return "Task";
    case "call":
      return "Call";
    case "email":
      return "Email";
  }
}

function buildEvents(
  meetingItems: Meeting[],
  taskItems: Task[],
  callItems: Call[],
  emailItems: CalendarEmail[],
): CalendarEvent[] {
  const meetingEvents: CalendarEvent[] = meetingItems.flatMap((meeting) => {
    const dateKey = parseDateKey(meeting.from);
    if (!dateKey) return [];
    return [
      {
        kind: "meeting" as const,
        id: meeting.id,
        title: meeting.title || "Untitled meeting",
        dateKey,
        timeLabel: extractTimeLabel(meeting.from),
        record: meeting,
      },
    ];
  });

  const taskEvents: CalendarEvent[] = taskItems.flatMap((task) => {
    const dateKey = parseDateKey(task.dueDate);
    if (!dateKey) return [];
    return [
      {
        kind: "task" as const,
        id: task.id,
        title: task.subject || "Untitled task",
        dateKey,
        timeLabel: "Due",
        record: task,
      },
    ];
  });

  const callEvents: CalendarEvent[] = callItems.flatMap((call) => {
    const dateKey = parseDateKey(call.startTime);
    if (!dateKey) return [];
    return [
      {
        kind: "call" as const,
        id: call.id,
        title: call.subject || "Untitled call",
        dateKey,
        timeLabel: extractTimeLabel(call.startTime) || call.type,
        record: call,
      },
    ];
  });

  const emailEvents: CalendarEvent[] = emailItems.map((email) => ({
    kind: "email" as const,
    id: email.id,
    title: email.subject || "Untitled email",
    dateKey: email.dateKey,
    timeLabel: "Email",
    record: email,
  }));

  return [...meetingEvents, ...taskEvents, ...callEvents, ...emailEvents].sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return a.timeLabel.localeCompare(b.timeLabel);
  });
}

function monthCells(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; inMonth: boolean }> = [];

  for (let i = 0; i < offset; i += 1) {
    cells.push({ date: new Date(year, month, -offset + i + 1), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: addDays(last, 1), inMonth: false });
  }
  return cells;
}

function upsertById<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}

function formatLoanAmount(amount: number) {
  return `CNY ${amount.toLocaleString("en-US")}`;
}

function monthPrefix(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
}

function isTaskOpen(task: Task) {
  return task.status !== "Completed";
}

function daysBetween(fromKey: string, toKey: string) {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function eventUrgency(event: CalendarEvent, todayKey: string): Urgency {
  if (event.kind === "task") {
    if (!isTaskOpen(event.record)) return "none";
    if (event.dateKey < todayKey) return "overdue";
    if (event.dateKey === todayKey) return "today";
    const ahead = daysBetween(todayKey, event.dateKey);
    if (ahead > 0 && ahead <= DUE_SOON_DAYS) return "due-soon";
    return "none";
  }
  if (event.dateKey === todayKey) return "today";
  return "none";
}

function eventDescription(event: CalendarEvent): string {
  if (event.kind === "meeting") {
    const lines = [
      event.title,
      event.record.relatedTo ? `Related to ${event.record.relatedTo}` : null,
      [event.record.from, event.record.to].filter(Boolean).join(" → ") || null,
      event.record.owner ? `Owner: ${event.record.owner}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  if (event.kind === "call") {
    const lines = [
      event.title,
      `${event.record.type} · ${event.record.startTime}`,
      event.record.duration ? `Duration ${event.record.duration}` : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  if (event.kind === "email") {
    const lines = [
      event.title,
      event.record.to ? `To ${event.record.to}` : null,
      event.record.body ? event.record.body.slice(0, 120) : null,
    ];
    return lines.filter(Boolean).join("\n");
  }

  const lines = [
    event.title,
    event.record.account ? `Account: ${event.record.account}` : null,
    `Due ${event.record.dueDate} · ${event.record.status} · ${event.record.priority}`,
  ];
  return lines.filter(Boolean).join("\n");
}

function CalendarEventChip({
  event,
  todayKey,
  onOpenEvent,
}: {
  event: CalendarEvent;
  todayKey: string;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const urgency = eventUrgency(event, todayKey);
  const description = eventDescription(event);
  const chipRef = useRef<HTMLSpanElement>(null);
  const [tipPos, setTipPos] = useState<{ top: number; left: number; place: "below" | "above" } | null>(
    null,
  );

  useEffect(() => {
    if (!tipPos) return;
    function hide() {
      setTipPos(null);
    }
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [tipPos]);

  function showTip() {
    const el = chipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const maxWidth = 240;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - maxWidth - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const place = spaceBelow < 96 ? "above" : "below";
    const top = place === "below" ? rect.bottom + 6 : Math.max(8, rect.top - 6);
    setTipPos({ top, left, place });
  }

  function hideTip() {
    setTipPos(null);
  }

  return (
    <span
      ref={chipRef}
      className={[
        "home-cal-event",
        `is-${event.kind}`,
        urgency !== "none" ? `is-${urgency}` : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        onOpenEvent(event);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
          e.preventDefault();
          onOpenEvent(event);
        }
      }}
      onMouseEnter={showTip}
      onMouseLeave={hideTip}
      onFocus={showTip}
      onBlur={hideTip}
      role="button"
      tabIndex={0}
      aria-label={description.replace(/\n/g, ". ")}
    >
      <span className="home-cal-event-text">{event.title}</span>
      {tipPos &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            className={`home-cal-event-tooltip is-portal is-${tipPos.place}`}
            role="tooltip"
            style={{ top: tipPos.top, left: tipPos.left }}
          >
            {description}
          </span>,
          document.body,
        )}
    </span>
  );
}

const CELL_VISIBLE_EVENTS = 2;

function DayOverflowMore({
  dateLabel,
  events,
  todayKey,
  overflowOverdue = 0,
  onOpenEvent,
}: {
  dateLabel: string;
  events: CalendarEvent[];
  todayKey: string;
  overflowOverdue?: number;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const btnRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; place: "below" | "above" } | null>(null);
  const overflow = Math.max(0, events.length - CELL_VISIBLE_EVENTS);

  useEffect(() => {
    if (!open) return;

    function placePanel() {
      const el = btnRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = 260;
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const estimatedHeight = Math.min(320, 56 + events.length * 52);
      const spaceBelow = window.innerHeight - rect.bottom;
      const place = spaceBelow < estimatedHeight && rect.top > estimatedHeight ? "above" : "below";
      const top = place === "below" ? rect.bottom + 4 : Math.max(8, rect.top - 4);
      setPos({ top, left, place });
    }

    placePanel();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (btnRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onReposition() {
      placePanel();
    }

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onReposition, true);
    window.addEventListener("resize", onReposition);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onReposition, true);
      window.removeEventListener("resize", onReposition);
    };
  }, [open, events.length]);

  if (overflow <= 0) return null;

  function toggleOpen() {
    setOpen((prev) => !prev);
  }

  return (
    <>
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        className={`home-cal-more${overflowOverdue > 0 ? " has-overdue" : ""}${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Show all ${events.length} activities`}
        onClick={(e) => {
          e.stopPropagation();
          toggleOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            toggleOpen();
          }
        }}
      >
        <span>
          +{overflow}
          {overflowOverdue > 0 ? ` · ${overflowOverdue} overdue` : ""}
        </span>
        <ChevronDown size={10} aria-hidden />
      </span>
      {open &&
        pos &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            className={`home-cal-more-popover is-${pos.place}`}
            role="dialog"
            aria-label={`Activities on ${dateLabel}`}
            style={{ top: pos.top, left: pos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="home-cal-more-popover-head">
              <strong>{dateLabel}</strong>
              <span className="muted">{events.length} activities</span>
            </div>
            <div className="home-cal-more-popover-list">
              {events.map((event) => {
                const urgency = eventUrgency(event, todayKey);
                return (
                  <button
                    key={`${event.kind}-${event.id}`}
                    type="button"
                    className={[
                      "home-cal-day-item",
                      `is-${event.kind}`,
                      urgency !== "none" ? `is-${urgency}` : "",
                      event.kind === "task" && event.record.status === "Completed" ? "is-completed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => {
                      setOpen(false);
                      onOpenEvent(event);
                    }}
                  >
                    <span className="home-cal-day-item-kind">
                      {eventKindLabel(event)}
                      {event.timeLabel ? ` · ${event.timeLabel}` : ""}
                    </span>
                    <strong>{event.title}</strong>
                    {urgency !== "none" && (
                      <span className={`home-cal-day-item-meta is-${urgency}`}>
                        {urgency === "overdue" ? "Overdue" : urgency === "today" ? "Today" : "Due soon"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function urgencyRank(urgency: Urgency) {
  switch (urgency) {
    case "overdue":
      return 0;
    case "today":
      return 1;
    case "due-soon":
      return 2;
    default:
      return 3;
  }
}

function sortEventsByUrgency(events: CalendarEvent[], todayKey: string) {
  return [...events].sort((a, b) => {
    const byUrgency = urgencyRank(eventUrgency(a, todayKey)) - urgencyRank(eventUrgency(b, todayKey));
    if (byUrgency !== 0) return byUrgency;
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return a.timeLabel.localeCompare(b.timeLabel);
  });
}

function countsAsActive(event: CalendarEvent) {
  return event.kind === "meeting" || event.kind === "call" || event.kind === "email" || (event.kind === "task" && isTaskOpen(event.record));
}

function dayHasOverdue(events: CalendarEvent[], todayKey: string) {
  return events.some((event) => eventUrgency(event, todayKey) === "overdue");
}

function urgencyLabel(event: CalendarEvent, todayKey: string, viewingToday: boolean) {
  const urgency = eventUrgency(event, todayKey);
  if (event.kind === "task" && event.record.status === "Completed") return "Completed";
  if (urgency === "overdue") {
    return viewingToday && event.dateKey !== todayKey ? `Overdue · ${event.dateKey}` : "Overdue";
  }
  if (urgency === "today") {
    if (event.kind === "task") return "Due today";
    if (event.kind === "call") return `Today · ${event.record.type}`;
    if (event.kind === "email") return "Email today";
    return "Today";
  }
  if (urgency === "due-soon") return event.kind === "task" ? "Due soon" : event.timeLabel || eventKindLabel(event);
  if (event.kind === "meeting") {
    return event.timeLabel || "Meeting";
  }
  if (event.kind === "call") {
    return `${event.record.type} · ${event.record.startTime}`;
  }
  if (event.kind === "email") {
    return event.record.to ? `To ${event.record.to}` : "Email";
  }
  return `Due ${event.record.dueDate}`;
}

export function HomeLoansClosing({
  onNavigate,
  onOpenRecord,
}: {
  onNavigate?: (module: ModuleKey, options?: { returnTo?: "home"; tab?: string }) => void;
  onOpenRecord?: (module: ModuleKey, recordId: string) => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const pipelineSnapshot = useSyncExternalStore(
    subscribePipelineLoans,
    getPipelineLoansSnapshot,
    getPipelineLoansSnapshot,
  );

  const monthLoans = useMemo(() => {
    const prefix = monthPrefix(today);
    return [...pipelineSnapshot.deals]
      .filter((deal) => deal.closingDate.startsWith(prefix))
      .sort((a, b) => a.closingDate.localeCompare(b.closingDate));
  }, [today, pipelineSnapshot]);

  const pipelineSummary = useMemo(() => {
    const totalAmount = monthLoans.reduce((sum, deal) => sum + deal.amount, 0);
    const stages: Array<{ stage: Deal["stage"]; count: number }> = [
      { stage: "Identification", count: 0 },
      { stage: "Evaluation", count: 0 },
      { stage: "Approval", count: 0 },
      { stage: "Execution", count: 0 },
      { stage: "Completion", count: 0 },
    ];
    for (const deal of monthLoans) {
      const entry = stages.find((item) => item.stage === deal.stage);
      if (entry) entry.count += 1;
    }
    return { totalAmount, stages: stages.filter((item) => item.count > 0) };
  }, [monthLoans]);

  return (
    <section className="home-quad home-quad-bl">
      <div className="home-quad-head">
        <div className="home-quad-label">Loans closing</div>
        {onNavigate && (
          <button
            type="button"
            className="home-cal-link"
            onClick={() => onNavigate("deals", { returnTo: "home", tab: "Kanban" })}
          >
            Open board
          </button>
        )}
      </div>
      <div className="home-pipeline-summary">
        <strong>{monthLoans.length}</strong>
        <span className="muted">this month</span>
        <strong className="home-pipeline-amount">{formatLoanAmount(pipelineSummary.totalAmount)}</strong>
        {pipelineSummary.stages.map((item) => (
          <span key={item.stage} className="home-pipeline-stage">
            {item.stage.split(" ")[0]} · {item.count}
          </span>
        ))}
      </div>
      <div className="home-pipeline-list">
        {monthLoans.length === 0 ? (
          <p className="muted">No loans closing this month.</p>
        ) : (
          monthLoans.slice(0, 6).map((deal) => (
            <button
              key={deal.id}
              type="button"
              className="home-pipeline-item"
              onClick={() => onOpenRecord?.("deals", deal.id)}
            >
              <strong>{deal.name}</strong>
              <span className="muted">
                {deal.closingDate.slice(5)} · {deal.stage}
              </span>
              <span className="home-pipeline-item-amount">{formatLoanAmount(deal.amount)}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

export function HomeCalendar({
  onOpenRecord,
}: {
  onNavigate?: (module: ModuleKey) => void;
  onOpenRecord?: (module: ModuleKey, recordId: string) => void;
}) {
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const [meetingItems, setMeetingItems] = useState<Meeting[]>(() => [...seedMeetings]);
  const [taskItems, setTaskItems] = useState<Task[]>(() => [...seedTasks]);
  const [callItems, setCallItems] = useState<Call[]>(() => [...seedCalls]);
  const [emailItems, setEmailItems] = useState<CalendarEmail[]>([]);
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date(today));
  const [openForm, setOpenForm] = useState<OpenForm | null>(null);
  const [createFor, setCreateFor] = useState<Date | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const pickerTriggerRef = useRef<HTMLButtonElement>(null);
  const pickerPopoverRef = useRef<HTMLDivElement>(null);
  const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

  function updatePickerPosition() {
    const el = pickerTriggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const width = 292;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    const top = Math.min(rect.bottom + 8, window.innerHeight - 320);
    setPickerPos({ top: Math.max(8, top), left });
  }

  const events = useMemo(
    () => buildEvents(meetingItems, taskItems, callItems, emailItems),
    [meetingItems, taskItems, callItems, emailItems],
  );
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.dateKey) ?? [];
      list.push(event);
      map.set(event.dateKey, list);
    }
    return map;
  }, [events]);

  const title = useMemo(() => {
    if (view === "day") return formatShortDate(cursor);
    if (view === "week") return formatWeekTitle(cursor);
    return `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;
  }, [cursor, view]);

  useEffect(() => {
    if (!pickerOpen) return;
    updatePickerPosition();

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (pickerRef.current?.contains(target) || pickerPopoverRef.current?.contains(target)) return;
      setPickerOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPickerOpen(false);
    }

    function onReposition() {
      updatePickerPosition();
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
  }, [pickerOpen]);

  function goToday() {
    setCursor(new Date(today));
    setView("day");
    setPickerOpen(false);
  }

  function applyCursor(date: Date) {
    setCursor(date);
    setPickerOpen(false);
  }

  function openEvent(event: CalendarEvent) {
    if (event.kind === "meeting") {
      setOpenForm({ kind: "meeting", record: event.record, mode: "edit" });
    } else if (event.kind === "task") {
      setOpenForm({ kind: "task", record: event.record, mode: "edit" });
    } else if (event.kind === "call") {
      setOpenForm({ kind: "call", record: event.record, mode: "edit" });
    } else {
      setOpenForm({ kind: "email", record: event.record, mode: "edit" });
    }
  }

  function selectDay(date: Date) {
    setCursor(date);
    setCreateFor(date);
  }

  function startCreate(kind: ActivityCreateKind, date: Date) {
    const dateKey = toDateKey(date);
    setCreateFor(null);
    if (kind === "meeting") {
      setOpenForm({ kind: "meeting", record: blankMeeting(dateKey), mode: "create" });
    } else if (kind === "task") {
      setOpenForm({ kind: "task", record: blankTask(dateKey), mode: "create" });
    } else if (kind === "call") {
      setOpenForm({ kind: "call", record: blankCall(dateKey), mode: "create" });
    } else {
      setOpenForm({ kind: "email", record: blankEmail(dateKey), mode: "create" });
    }
  }

  function focusDateKey(dateKey: string | null) {
    if (!dateKey) return;
    const [y, m, d] = dateKey.split("-").map(Number);
    setCursor(new Date(y, m - 1, d));
    setView("month");
  }

  function saveMeeting(record: Meeting) {
    setMeetingItems((prev) => upsertById(prev, record));
    focusDateKey(parseDateKey(record.from));
    setOpenForm(null);
  }

  function saveTask(record: Task) {
    setTaskItems((prev) => upsertById(prev, record));
    focusDateKey(parseDateKey(record.dueDate));
    setOpenForm(null);
  }

  function saveCall(record: Call) {
    setCallItems((prev) => upsertById(prev, record));
    focusDateKey(parseDateKey(record.startTime));
    setOpenForm(null);
  }

  function saveEmail(record: CalendarEmail) {
    setEmailItems((prev) => upsertById(prev, record));
    focusDateKey(record.dateKey);
    setOpenForm(null);
  }

  const dayKey = toDateKey(cursor);
  const todayKey = toDateKey(today);
  const dayEvents = useMemo(() => {
    const onCursor = eventsByDate.get(dayKey) ?? [];
    if (!sameDay(cursor, today)) {
      return sortEventsByUrgency(onCursor, todayKey);
    }
    const overdueCarry = events.filter(
      (event) => event.kind === "task" && isTaskOpen(event.record) && event.dateKey < todayKey,
    );
    return sortEventsByUrgency([...overdueCarry, ...onCursor], todayKey);
  }, [cursor, dayKey, events, eventsByDate, today, todayKey]);

  return (
    <>
      <section className="home-quad home-quad-tr home-calendar">
        <div className="home-quad-label home-calendar-section-label">My Calendar</div>
        <div className="home-calendar-head">
          <div className="home-calendar-controls">
            <div className="home-calendar-picker" ref={pickerRef}>
              <button
                ref={pickerTriggerRef}
                type="button"
                className={`home-calendar-picker-trigger${pickerOpen ? " is-open" : ""}`}
                aria-label="Open date picker"
                aria-expanded={pickerOpen}
                onClick={() => {
                  setPickerOpen((open) => {
                    if (!open) updatePickerPosition();
                    return !open;
                  });
                }}
              >
                <CalendarDays size={15} strokeWidth={1.75} />
              </button>
              {pickerOpen &&
                typeof document !== "undefined" &&
                createPortal(
                  <div
                    ref={pickerPopoverRef}
                    className="home-cal-nav-popover-portal"
                    style={{ top: pickerPos.top, left: pickerPos.left }}
                  >
                    <CalendarNavPicker mode={view} cursor={cursor} onSelect={applyCursor} />
                  </div>,
                  document.body,
                )}
            </div>
            <h3 className="home-calendar-title">{title}</h3>
            <button type="button" className="secondary-button home-calendar-today" onClick={goToday}>
              Today
            </button>
          </div>
          <div className="home-calendar-views" role="tablist" aria-label="Calendar view">
            {(
              [
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                className={`home-calendar-view-tab${view === key ? " is-active" : ""}`}
                onClick={() => {
                  setView(key);
                  setPickerOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {view === "month" && (
          <MonthView
            year={cursor.getFullYear()}
            month={cursor.getMonth()}
            today={today}
            selected={cursor}
            eventsByDate={eventsByDate}
            onSelectDay={selectDay}
            onOpenEvent={openEvent}
          />
        )}

        {view === "week" && (
          <WeekView
            cursor={cursor}
            today={today}
            eventsByDate={eventsByDate}
            onSelectDay={selectDay}
            onOpenEvent={openEvent}
          />
        )}

        {view === "day" && (
          <DayView
            date={cursor}
            today={today}
            events={dayEvents}
            onOpenEvent={openEvent}
            onCreate={(kind) => startCreate(kind, cursor)}
          />
        )}
      </section>

      {typeof document !== "undefined" &&
        createPortal(
          <>
            {createFor && (
              <CreatePickerModal
                date={createFor}
                today={today}
                events={sortEventsByUrgency(eventsByDate.get(toDateKey(createFor)) ?? [], todayKey)}
                onClose={() => setCreateFor(null)}
                onCreate={(kind) => startCreate(kind, createFor)}
                onOpenEvent={(event) => {
                  setCreateFor(null);
                  openEvent(event);
                }}
                onOpenDay={() => {
                  setCursor(createFor);
                  setCreateFor(null);
                  setView("day");
                }}
              />
            )}

            {openForm?.kind === "meeting" && (
              <MeetingFormModal
                meeting={openForm.record}
                mode={openForm.mode}
                onClose={() => setOpenForm(null)}
                onSave={saveMeeting}
              />
            )}
            {openForm?.kind === "task" && (
              <TaskFormModal
                task={openForm.record}
                mode={openForm.mode}
                onClose={() => setOpenForm(null)}
                onSave={saveTask}
              />
            )}
            {openForm?.kind === "call" && (
              <CallFormModal
                call={openForm.record}
                mode={openForm.mode}
                onClose={() => setOpenForm(null)}
                onSave={saveCall}
              />
            )}
            {openForm?.kind === "email" && (
              <SendEmailModal
                email={openForm.record}
                mode={openForm.mode}
                onClose={() => setOpenForm(null)}
                onSave={saveEmail}
              />
            )}
          </>,
          document.body,
        )}
    </>
  );
}

function CalendarNavPicker({
  mode,
  cursor,
  onSelect,
}: {
  mode: CalendarView;
  cursor: Date;
  onSelect: (date: Date) => void;
}) {
  const [panel, setPanel] = useState<PickerPanel>(mode === "month" ? "months" : "days");
  const [viewYear, setViewYear] = useState(cursor.getFullYear());
  const [viewMonth, setViewMonth] = useState(cursor.getMonth());

  useEffect(() => {
    setViewYear(cursor.getFullYear());
    setViewMonth(cursor.getMonth());
    setPanel(mode === "month" ? "months" : "days");
  }, [cursor, mode]);

  const cells = useMemo(() => monthCells(viewYear, viewMonth), [viewYear, viewMonth]);
  const weekStart = startOfWeek(cursor);
  const weekEnd = endOfWeek(cursor);
  const yearOptions = useMemo(() => {
    const start = viewYear - 5;
    return Array.from({ length: 12 }, (_, index) => start + index);
  }, [viewYear]);

  function shiftMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  function selectMonth(month: number) {
    if (mode === "month") {
      onSelect(new Date(viewYear, month, 1));
      return;
    }
    setViewMonth(month);
    setPanel("days");
  }

  function selectYear(year: number) {
    setViewYear(year);
    if (mode === "month") {
      setPanel("months");
      return;
    }
    setPanel("days");
  }

  function selectDay(date: Date) {
    if (mode === "week") {
      onSelect(startOfWeek(date));
      return;
    }
    onSelect(date);
  }

  function inSelectedWeek(date: Date) {
    const key = toDateKey(date);
    return key >= toDateKey(weekStart) && key <= toDateKey(weekEnd);
  }

  if (mode === "month") {
    return (
      <div className="home-cal-nav-popover" role="dialog" aria-label="Choose month">
        <div className="home-cal-nav-popover-head is-month-mode">
          <button
            type="button"
            className="home-cal-nav-year-box"
            onClick={() => setPanel(panel === "years" ? "months" : "years")}
            aria-label="Choose year"
          >
            {viewYear}
          </button>
          <div className="home-cal-nav-arrows">
            <button
              type="button"
              className="home-cal-nav-arrow"
              aria-label="Previous year"
              onClick={() => setViewYear((year) => year - 1)}
            >
              <ChevronLeft size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="home-cal-nav-arrow"
              aria-label="Next year"
              onClick={() => setViewYear((year) => year + 1)}
            >
              <ChevronRight size={14} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        {panel === "years" ? (
          <div className="home-cal-nav-months">
            {yearOptions.map((year) => (
              <button
                key={year}
                type="button"
                className={`home-cal-nav-month-cell${year === viewYear ? " is-selected" : ""}`}
                onClick={() => selectYear(year)}
              >
                {year}
              </button>
            ))}
          </div>
        ) : (
          <div className="home-cal-nav-months">
            {MONTH_SHORT.map((label, month) => (
              <button
                key={label}
                type="button"
                className={`home-cal-nav-month-cell${
                  month === cursor.getMonth() && viewYear === cursor.getFullYear() ? " is-selected" : ""
                }`}
                onClick={() => selectMonth(month)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="home-cal-nav-popover is-day-grid" role="dialog" aria-label="Choose date">
      <div className="home-cal-nav-popover-head">
        <div className="home-cal-nav-dropdowns">
          <button
            type="button"
            className="home-cal-nav-dropdown"
            onClick={() => setPanel((current) => (current === "months" ? "days" : "months"))}
            aria-label="Choose month"
          >
            {MONTH_NAMES[viewMonth]}
            <ChevronDown size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="home-cal-nav-dropdown"
            onClick={() => setPanel((current) => (current === "years" ? "days" : "years"))}
            aria-label="Choose year"
          >
            {viewYear}
            <ChevronDown size={13} strokeWidth={1.75} />
          </button>
        </div>
        <div className="home-cal-nav-arrows">
          <button
            type="button"
            className="home-cal-nav-arrow"
            aria-label="Previous month"
            onClick={() => {
              setPanel("days");
              shiftMonth(-1);
            }}
          >
            <ChevronLeft size={14} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            className="home-cal-nav-arrow"
            aria-label="Next month"
            onClick={() => {
              setPanel("days");
              shiftMonth(1);
            }}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {panel === "months" ? (
        <div className="home-cal-nav-months">
          {MONTH_SHORT.map((label, month) => (
            <button
              key={label}
              type="button"
              className={`home-cal-nav-month-cell${
                month === viewMonth && viewYear === cursor.getFullYear() ? " is-selected" : ""
              }`}
              onClick={() => selectMonth(month)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : panel === "years" ? (
        <div className="home-cal-nav-months">
          {yearOptions.map((year) => (
            <button
              key={year}
              type="button"
              className={`home-cal-nav-month-cell${year === viewYear ? " is-selected" : ""}`}
              onClick={() => selectYear(year)}
            >
              {year}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="home-cal-nav-weekdays">
            {WEEKDAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={`home-cal-nav-days${mode === "week" ? " is-week-mode" : ""}`}>
            {cells.map((cell) => {
              const dateKey = toDateKey(cell.date);
              const selected = sameDay(cell.date, cursor);
              const weekend = isWeekend(cell.date);
              const holiday = getHoliday(dateKey);
              const inWeek = mode === "week" && inSelectedWeek(cell.date);
              const isWeekStart = mode === "week" && sameDay(cell.date, weekStart);
              const isWeekEnd = mode === "week" && sameDay(cell.date, weekEnd);

              return (
                <button
                  key={dateKey}
                  type="button"
                  title={holiday && !weekend ? holiday.name : undefined}
                  className={[
                    "home-cal-nav-day",
                    cell.inMonth ? "" : "is-outside",
                    weekend ? "is-weekend" : "",
                    holiday ? "is-holiday" : "",
                    mode === "day" && selected ? "is-selected" : "",
                    inWeek ? "is-in-week" : "",
                    isWeekStart ? "is-week-start" : "",
                    isWeekEnd ? "is-week-end" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => selectDay(cell.date)}
                >
                  <span>{cell.date.getDate()}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MonthView({
  year,
  month,
  today,
  selected,
  eventsByDate,
  onSelectDay,
  onOpenEvent,
}: {
  year: number;
  month: number;
  today: Date;
  selected: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDay: (date: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const cells = monthCells(year, month);
  const todayKey = toDateKey(today);

  return (
    <div className="home-cal-month">
      <div className="home-cal-weekdays">
        {WEEKDAYS.map((day) => (
          <div className="home-cal-weekday" key={day}>
            {day.charAt(0)}
          </div>
        ))}
      </div>
      <div className="home-cal-month-grid">
        {cells.map((cell) => {
          const key = toDateKey(cell.date);
          const dayEvents = sortEventsByUrgency(eventsByDate.get(key) ?? [], todayKey);
          const isToday = sameDay(cell.date, today);
          const isSelected = sameDay(cell.date, selected);
          const weekend = isWeekend(cell.date);
          const holiday = getHoliday(key);
          const holidayLabel = holiday && !weekend ? holiday.shortName : null;
          const overdueCount = dayEvents.filter((event) => eventUrgency(event, todayKey) === "overdue").length;
          const hasOverdue = overdueCount > 0;
          const visible = dayEvents.slice(0, CELL_VISIBLE_EVENTS);
          const overflowOverdue = dayEvents
            .slice(CELL_VISIBLE_EVENTS)
            .filter((event) => eventUrgency(event, todayKey) === "overdue").length;

          return (
            <button
              key={key}
              type="button"
              className={[
                "home-cal-day",
                cell.inMonth ? "" : "is-outside",
                isToday ? "is-today" : "",
                isSelected ? "is-selected" : "",
                weekend ? "is-weekend" : "",
                holiday ? "is-holiday" : "",
                dayEvents.length ? "has-events" : "",
                hasOverdue ? "has-overdue" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay(cell.date)}
            >
              <div className="home-cal-day-head">
                {holidayLabel && holiday ? (
                  <span className="home-cal-holiday-name">
                    <span className="home-cal-holiday-label">{holidayLabel}</span>
                    <span className="home-cal-holiday-tooltip">{holiday.name}</span>
                  </span>
                ) : null}
                <span className="home-cal-day-num">{cell.date.getDate()}</span>
              </div>
              <div className="home-cal-day-events">
                {visible.map((event) => (
                  <CalendarEventChip
                    key={`${event.kind}-${event.id}`}
                    event={event}
                    todayKey={todayKey}
                    onOpenEvent={onOpenEvent}
                  />
                ))}
              </div>
              <DayOverflowMore
                dateLabel={formatCreateDateLabel(cell.date)}
                events={dayEvents}
                todayKey={todayKey}
                overflowOverdue={overflowOverdue}
                onOpenEvent={onOpenEvent}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({
  cursor,
  today,
  eventsByDate,
  onSelectDay,
  onOpenEvent,
}: {
  cursor: Date;
  today: Date;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDay: (date: Date) => void;
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const todayKey = toDateKey(today);
  const days = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }, [cursor]);

  return (
    <div className="home-cal-week">
      <div className="home-cal-week-grid">
        {days.map((date) => {
          const key = toDateKey(date);
          const dayEvents = sortEventsByUrgency(eventsByDate.get(key) ?? [], todayKey);
          const isToday = sameDay(date, today);
          const isSelected = sameDay(date, cursor);
          const weekend = isWeekend(date);
          const holiday = getHoliday(key);
          const holidayLabel = holiday && !weekend ? holiday.shortName : null;
          const hasOverdue = dayHasOverdue(dayEvents, todayKey);
          const visible = dayEvents.slice(0, CELL_VISIBLE_EVENTS);
          const overflowOverdue = dayEvents
            .slice(CELL_VISIBLE_EVENTS)
            .filter((event) => eventUrgency(event, todayKey) === "overdue").length;

          return (
            <button
              key={key}
              type="button"
              className={[
                "home-cal-week-day",
                isToday ? "is-today" : "",
                isSelected ? "is-selected" : "",
                hasOverdue ? "has-overdue" : "",
                weekend ? "is-weekend" : "",
                holiday ? "is-holiday" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSelectDay(date)}
            >
              <div className="home-cal-week-day-head">
                <span className="home-cal-week-weekday">{WEEKDAYS[(date.getDay() + 6) % 7]}</span>
                <span className="home-cal-week-day-num">{date.getDate()}</span>
              </div>
              {holidayLabel && holiday ? (
                <span className="home-cal-holiday-name">
                  <span className="home-cal-holiday-label">{holidayLabel}</span>
                  <span className="home-cal-holiday-tooltip">{holiday.name}</span>
                </span>
              ) : null}
              <div className="home-cal-week-day-events">
                {visible.map((event) => (
                  <CalendarEventChip
                    key={`${event.kind}-${event.id}`}
                    event={event}
                    todayKey={todayKey}
                    onOpenEvent={onOpenEvent}
                  />
                ))}
              </div>
              <DayOverflowMore
                dateLabel={formatCreateDateLabel(date)}
                events={dayEvents}
                todayKey={todayKey}
                overflowOverdue={overflowOverdue}
                onOpenEvent={onOpenEvent}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DayView({
  date,
  today,
  events,
  onOpenEvent,
  onCreate,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
  onCreate: (kind: ActivityCreateKind) => void;
}) {
  const todayKey = toDateKey(today);
  const viewingToday = sameDay(date, today);
  const overdueCount = events.filter((event) => eventUrgency(event, todayKey) === "overdue").length;
  const completedCount = events.filter(
    (event) => event.kind === "task" && event.record.status === "Completed",
  ).length;
  const openCount = events.length - completedCount;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuPanelRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function placeMenu() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 200);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top = Math.min(rect.bottom + 6, window.innerHeight - 220);
      setMenuPos({ top: Math.max(8, top), left, width });
    }

    placeMenu();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuPanelRef.current?.contains(target)) return;
      setMenuOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    function onReposition() {
      placeMenu();
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [menuOpen]);

  let summary = `No items on ${formatCreateDateLabel(date)}.`;
  if (events.length > 0) {
    const parts: string[] = [];
    if (overdueCount) parts.push(`${overdueCount} overdue`);
    if (viewingToday) {
      const todayItems = events.filter(
        (event) => event.dateKey === todayKey && countsAsActive(event),
      ).length;
      if (todayItems) parts.push(`${todayItems} today`);
    } else if (openCount) {
      parts.push(`${openCount} open`);
    }
    if (completedCount) parts.push(`${completedCount} done`);
    summary = parts.length ? parts.join(" · ") : `${events.length} item${events.length === 1 ? "" : "s"}`;
  }

  function chooseCreate(kind: ActivityCreateKind) {
    setMenuOpen(false);
    onCreate(kind);
  }

  return (
    <div className="home-cal-day-view">
      <div className="home-cal-day-create-row" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          className={`secondary-button home-cal-add-activity${menuOpen ? " is-open" : ""}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Plus size={14} /> Add Activity
          <ChevronDown size={14} />
        </button>
        {menuOpen &&
          menuPos &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              ref={menuPanelRef}
              className="home-cal-add-menu is-portal"
              role="menu"
              aria-label="Add activity"
              style={{ top: menuPos.top, left: menuPos.left, width: menuPos.width }}
            >
              <button
                type="button"
                className="home-cal-add-menu-item"
                role="menuitem"
                onClick={() => chooseCreate("email")}
              >
                <Mail size={14} />
                <span>Send Email</span>
              </button>
              <button
                type="button"
                className="home-cal-add-menu-item"
                role="menuitem"
                onClick={() => chooseCreate("call")}
              >
                <Phone size={14} />
                <span>Create Call</span>
              </button>
              <button
                type="button"
                className="home-cal-add-menu-item"
                role="menuitem"
                onClick={() => chooseCreate("meeting")}
              >
                <CalendarDays size={14} />
                <span>Create Meeting</span>
              </button>
              <button
                type="button"
                className="home-cal-add-menu-item"
                role="menuitem"
                onClick={() => chooseCreate("task")}
              >
                <ClipboardList size={14} />
                <span>Create Task</span>
              </button>
            </div>,
            document.body,
          )}
      </div>
      <p className="muted home-cal-day-summary">{summary}</p>
      <div className="home-cal-day-list">
        {events.map((event) => {
          const urgency = eventUrgency(event, todayKey);
          const completed = event.kind === "task" && event.record.status === "Completed";
          return (
            <button
              key={`${event.kind}-${event.id}`}
              type="button"
              className={[
                "home-cal-day-item",
                `is-${event.kind}`,
                urgency !== "none" ? `is-${urgency}` : "",
                completed ? "is-completed" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onOpenEvent(event)}
            >
              <span className="home-cal-day-item-kind">
                {eventKindLabel(event)}
              </span>
              <strong>{event.title}</strong>
              <span className={`home-cal-day-item-meta${urgency !== "none" ? ` is-${urgency}` : ""}`}>
                {event.kind === "meeting"
                  ? `${urgency === "today" ? "Today · " : ""}${event.record.from}${
                      event.record.to ? ` → ${event.record.to}` : ""
                    }`
                  : urgencyLabel(event, todayKey, viewingToday)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CreatePickerModal({
  date,
  today,
  events,
  onClose,
  onCreate,
  onOpenEvent,
  onOpenDay,
}: {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onClose: () => void;
  onCreate: (kind: ActivityCreateKind) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onOpenDay: () => void;
}) {
  const todayKey = toDateKey(today);

  return (
    <div className="modal-backdrop home-cal-modal-backdrop" onClick={onClose}>
      <section className="modal-card home-cal-create-picker" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <div>
            <h2>Create</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {formatCreateDateLabel(date)}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="home-cal-create-actions">
          <button type="button" className="home-cal-create-action" onClick={() => onCreate("email")}>
            <Mail size={18} />
            <span>
              <strong>Send Email</strong>
              <em>Compose an email for this day</em>
            </span>
          </button>
          <button type="button" className="home-cal-create-action" onClick={() => onCreate("call")}>
            <Phone size={18} />
            <span>
              <strong>Create Call</strong>
              <em>Log a call on this day</em>
            </span>
          </button>
          <button type="button" className="home-cal-create-action" onClick={() => onCreate("meeting")}>
            <CalendarDays size={18} />
            <span>
              <strong>Create Meeting</strong>
              <em>Schedule a meeting on this day</em>
            </span>
          </button>
          <button type="button" className="home-cal-create-action" onClick={() => onCreate("task")}>
            <ClipboardList size={18} />
            <span>
              <strong>Create Task</strong>
              <em>Create a task due on this day</em>
            </span>
          </button>
        </div>

        {events.length > 0 && (
          <div className="home-cal-create-existing">
            <div className="home-cal-create-existing-head">
              <p className="muted">Existing ({events.length})</p>
              <button type="button" className="home-cal-link" onClick={onOpenDay}>
                Day view
              </button>
            </div>
            <div className="home-cal-day-list">
              {events.map((event) => {
                const urgency = eventUrgency(event, todayKey);
                return (
                  <button
                    key={`${event.kind}-${event.id}`}
                    type="button"
                    className={[
                      "home-cal-day-item",
                      `is-${event.kind}`,
                      urgency !== "none" ? `is-${urgency}` : "",
                      event.kind === "task" && event.record.status === "Completed" ? "is-completed" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() => onOpenEvent(event)}
                  >
                    <span className="home-cal-day-item-kind">
                      {eventKindLabel(event)}
                      {event.timeLabel ? ` · ${event.timeLabel}` : ""}
                    </span>
                    <strong>{event.title}</strong>
                    {urgency !== "none" && (
                      <span className={`home-cal-day-item-meta is-${urgency}`}>
                        {urgency === "overdue" ? "Overdue" : urgency === "today" ? "Today" : "Due soon"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function MeetingFormModal({
  meeting,
  mode,
  onClose,
  onSave,
}: {
  meeting: Meeting;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (meeting: Meeting) => void;
}) {
  const [draft, setDraft] = useState(meeting);

  function update<K extends keyof Meeting>(key: K, value: Meeting[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop home-cal-modal-backdrop" onClick={onClose}>
      <section className="modal-card home-cal-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <h2>{mode === "create" ? "Create Meeting" : "Meeting"}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <label>Title</label>
            <input className="field" value={draft.title} onChange={(e) => update("title", e.target.value)} />
          </div>
          <div className="form-row">
            <label>Owner</label>
            <input className="field" value={draft.owner} onChange={(e) => update("owner", e.target.value)} />
          </div>
          <div className="form-row">
            <label>From</label>
            <input className="field" value={draft.from} onChange={(e) => update("from", e.target.value)} />
          </div>
          <div className="form-row">
            <label>To</label>
            <input className="field" value={draft.to} onChange={(e) => update("to", e.target.value)} />
          </div>
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Related To</label>
            <input
              className="field"
              value={draft.relatedTo}
              onChange={(e) => update("relatedTo", e.target.value)}
            />
          </div>
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function TaskFormModal({
  task,
  mode,
  onClose,
  onSave,
}: {
  task: Task;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [draft, setDraft] = useState(task);

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop home-cal-modal-backdrop" onClick={onClose}>
      <section className="modal-card home-cal-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <h2>{mode === "create" ? "Create Task" : "Task"}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Subject</label>
            <input className="field" value={draft.subject} onChange={(e) => update("subject", e.target.value)} />
          </div>
          <div className="form-row">
            <label>Due Date</label>
            <input className="field" value={draft.dueDate} onChange={(e) => update("dueDate", e.target.value)} />
          </div>
          <div className="form-row">
            <label>Account</label>
            <input className="field" value={draft.account} onChange={(e) => update("account", e.target.value)} />
          </div>
          <div className="form-row">
            <label>Status</label>
            <select
              className="field"
              value={draft.status}
              onChange={(e) => update("status", e.target.value as ActivityStatus)}
            >
              <option>Not Started</option>
              <option>Completed</option>
              <option>Deferred</option>
            </select>
          </div>
          <div className="form-row">
            <label>Priority</label>
            <select
              className="field"
              value={draft.priority}
              onChange={(e) => update("priority", e.target.value as Task["priority"])}
            >
              <option>High</option>
              <option>Normal</option>
              <option>Low</option>
            </select>
          </div>
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function CallFormModal({
  call,
  mode,
  onClose,
  onSave,
}: {
  call: Call;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (call: Call) => void;
}) {
  const [draft, setDraft] = useState(call);

  function update<K extends keyof Call>(key: K, value: Call[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop home-cal-modal-backdrop" onClick={onClose}>
      <section className="modal-card home-cal-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <h2>{mode === "create" ? "Create Call" : "Call"}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Subject</label>
            <input className="field" value={draft.subject} onChange={(e) => update("subject", e.target.value)} />
          </div>
          <div className="form-row">
            <label>Call Type</label>
            <select
              className="field"
              value={draft.type}
              onChange={(e) => update("type", e.target.value as Call["type"])}
            >
              <option>Outbound</option>
              <option>Inbound</option>
            </select>
          </div>
          <div className="form-row">
            <label>Duration</label>
            <input className="field" value={draft.duration} onChange={(e) => update("duration", e.target.value)} />
          </div>
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Call Start Time</label>
            <input className="field" value={draft.startTime} onChange={(e) => update("startTime", e.target.value)} />
          </div>
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

function SendEmailModal({
  email,
  mode,
  onClose,
  onSave,
}: {
  email: CalendarEmail;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (email: CalendarEmail) => void;
}) {
  const [draft, setDraft] = useState(email);

  return (
    <div className="modal-backdrop home-cal-modal-backdrop" onClick={onClose}>
      <section className="modal-card home-cal-form-modal" onClick={(event) => event.stopPropagation()}>
        <div className="page-header">
          <div>
            <h2>{mode === "create" ? "Send Email" : "Email"}</h2>
            <p className="muted" style={{ margin: "4px 0 0" }}>
              {draft.dateKey}
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>To</label>
            <input
              className="field"
              type="email"
              placeholder="recipient@example.com"
              value={draft.to}
              onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value }))}
            />
          </div>
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Subject</label>
            <input
              className="field"
              value={draft.subject}
              onChange={(e) => setDraft((prev) => ({ ...prev, subject: e.target.value }))}
            />
          </div>
          <div className="form-row" style={{ gridColumn: "1 / -1" }}>
            <label>Message</label>
            <textarea
              className="field"
              rows={6}
              value={draft.body}
              onChange={(e) => setDraft((prev) => ({ ...prev, body: e.target.value }))}
              style={{ resize: "vertical" }}
            />
          </div>
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(draft)}>
            {mode === "create" ? "Send" : "Save"}
          </button>
        </div>
      </section>
    </div>
  );
}
