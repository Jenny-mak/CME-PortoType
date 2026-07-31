"use client";

import { Check, ChevronRight, MoreHorizontal, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { DateField } from "@/components/DateField";

export type RowActionContext = {
  id: string;
  label: string;
  email?: string;
  phone?: string;
  url?: string;
  relatedTo?: string;
};

type RowActionForm =
  | "email"
  | "task"
  | "meeting"
  | "scheduleCall"
  | "logCall"
  | "edit"
  | "delete"
  | null;

type Flyout = "more" | "createCall" | null;

type MenuItem =
  | { kind: "action"; label: string; action: () => void }
  | { kind: "flyout"; label: string; flyout: Exclude<Flyout, null> };

type Props = {
  context: RowActionContext;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function RowActions({ context, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [flyout, setFlyout] = useState<Flyout>(null);
  const [form, setForm] = useState<RowActionForm>(null);
  const [copied, setCopied] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const [moreRect, setMoreRect] = useState<DOMRect | null>(null);
  const [callRect, setCallRect] = useState<DOMRect | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-row-menu="${menuId}"]`) || target.closest(`[data-row-trigger="${menuId}"]`)) {
        return;
      }
      setOpen(false);
      setFlyout(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setFlyout(null);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuId]);

  function openMenu(event: ReactMouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAnchor(rect);
    setOpen((value) => !value);
    setFlyout(null);
    setCopied(false);
  }

  function runAndClose(action: () => void) {
    action();
    setOpen(false);
    setFlyout(null);
  }

  function handleCopyUrl() {
    const value = context.url?.trim() || (typeof window !== "undefined" ? window.location.href : "");
    if (!value) return;
    void navigator.clipboard?.writeText(value).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    });
  }

  const rootItems: MenuItem[] = [
    {
      kind: "action",
      label: "Edit",
      action: () => {
        if (onEdit) onEdit();
        else setForm("edit");
      },
    },
    { kind: "action", label: "Send Email", action: () => setForm("email") },
    { kind: "action", label: "Create Task", action: () => setForm("task") },
    {
      kind: "action",
      label: "Delete",
      action: () => setForm("delete"),
    },
    { kind: "action", label: copied ? "Copied" : "Copy URL", action: handleCopyUrl },
    { kind: "flyout", label: "More...", flyout: "more" },
  ];

  const moreItems: MenuItem[] = [
    { kind: "flyout", label: "Create Call", flyout: "createCall" },
    { kind: "action", label: "Create Meeting", action: () => setForm("meeting") },
  ];

  const callItems: MenuItem[] = [
    { kind: "action", label: "Schedule a call", action: () => setForm("scheduleCall") },
    { kind: "action", label: "Log a call", action: () => setForm("logCall") },
  ];

  return (
    <>
      <button
        type="button"
        className="row-action-trigger"
        data-row-trigger={menuId}
        aria-label={`Actions for ${context.label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={openMenu}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <MoreHorizontal size={14} />
      </button>

      {open && anchor
        ? createPortal(
            <>
              <MenuPanel
                menuId={menuId}
                items={rootItems}
                anchor={anchor}
                activeFlyout={flyout}
                onHoverFlyout={(next, rect) => {
                  setFlyout(next);
                  if (next === "more") setMoreRect(rect);
                  if (next === null) {
                    setMoreRect(null);
                    setCallRect(null);
                  }
                }}
                onAction={(action) => runAndClose(action)}
              />
              {flyout === "more" || flyout === "createCall"
                ? moreRect && (
                    <MenuPanel
                      menuId={menuId}
                      items={moreItems}
                      anchor={moreRect}
                      placement="right"
                      activeFlyout={flyout === "createCall" ? "createCall" : null}
                      onHoverFlyout={(next, rect) => {
                        if (next === "createCall") {
                          setFlyout("createCall");
                          setCallRect(rect);
                        } else if (next === "more") {
                          setFlyout("more");
                          setCallRect(null);
                        } else {
                          setFlyout("more");
                          setCallRect(null);
                        }
                      }}
                      onAction={(action) => runAndClose(action)}
                    />
                  )
                : null}
              {flyout === "createCall" && callRect
                ? (
                    <MenuPanel
                      menuId={menuId}
                      items={callItems}
                      anchor={callRect}
                      placement="right"
                      activeFlyout={null}
                      onHoverFlyout={() => undefined}
                      onAction={(action) => runAndClose(action)}
                    />
                  )
                : null}
            </>,
            document.body,
          )
        : null}

      {form === "email" ? (
        <EmailFormModal
          context={context}
          onClose={() => setForm(null)}
        />
      ) : null}
      {form === "task" ? (
        <TaskFormModal context={context} onClose={() => setForm(null)} />
      ) : null}
      {form === "meeting" ? (
        <MeetingFormModal context={context} onClose={() => setForm(null)} />
      ) : null}
      {form === "scheduleCall" ? (
        <CallFormModal kind="schedule" context={context} onClose={() => setForm(null)} />
      ) : null}
      {form === "logCall" ? (
        <CallFormModal kind="log" context={context} onClose={() => setForm(null)} />
      ) : null}
      {form === "edit" ? (
        <EditRecordModal context={context} onClose={() => setForm(null)} />
      ) : null}
      {form === "delete" ? (
        <DeleteConfirmModal
          context={context}
          onClose={() => setForm(null)}
          onConfirm={() => {
            onDelete?.();
            setForm(null);
          }}
        />
      ) : null}
    </>
  );
}

function MenuPanel({
  menuId,
  items,
  anchor,
  placement = "below",
  activeFlyout,
  onHoverFlyout,
  onAction,
}: {
  menuId: string;
  items: MenuItem[];
  anchor: DOMRect;
  placement?: "below" | "right";
  activeFlyout: Flyout;
  onHoverFlyout: (next: Flyout, rect: DOMRect) => void;
  onAction: (action: () => void) => void;
}) {
  const width = 168;
  const left =
    placement === "right"
      ? Math.min(anchor.right + 4, window.innerWidth - width - 8)
      : Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top =
    placement === "right"
      ? Math.min(anchor.top, window.innerHeight - 12)
      : Math.min(anchor.bottom + 4, window.innerHeight - 12);

  return (
    <div
      className="row-action-menu"
      data-row-menu={menuId}
      style={{ left, top, width }}
      role="menu"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {items.map((item) => {
        if (item.kind === "flyout") {
          const active = activeFlyout === item.flyout || (item.flyout === "more" && activeFlyout === "createCall");
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-action-item has-submenu ${active ? "is-active" : ""}`}
              onMouseEnter={(event) => onHoverFlyout(item.flyout, event.currentTarget.getBoundingClientRect())}
              onClick={(event) => onHoverFlyout(item.flyout, event.currentTarget.getBoundingClientRect())}
            >
              <span>{item.label}</span>
              <ChevronRight size={14} />
            </button>
          );
        }
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="row-action-item"
            onMouseEnter={() => {
              if (placement === "below") onHoverFlyout(null, anchor);
            }}
            onClick={() => {
              if (item.label === "Copy URL" || item.label === "Copied") {
                item.action();
                return;
              }
              onAction(item.action);
            }}
          >
            {item.label === "Copied" ? (
              <>
                <Check size={14} /> Copied
              </>
            ) : (
              item.label
            )}
          </button>
        );
      })}
    </div>
  );
}

function FormShell({
  title,
  subtitle,
  onClose,
  children,
  onSubmit,
  submitLabel = "Save",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card row-action-form-modal" onClick={(event) => event.stopPropagation()}>
        <header className="row-action-form-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="row-action-form-body">{children}</div>
        <footer className="row-action-form-foot">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={onSubmit}>
            {submitLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function EmailFormModal({ context, onClose }: { context: RowActionContext; onClose: () => void }) {
  const [to, setTo] = useState(context.email ?? "");
  const [subject, setSubject] = useState(`Follow up: ${context.label}`);
  const [body, setBody] = useState("");

  return (
    <FormShell
      title="Send Email"
      subtitle={context.label}
      onClose={onClose}
      submitLabel="Send"
      onSubmit={onClose}
    >
      <label className="form-row">
        <span>To</span>
        <input className="field" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Subject</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Message</span>
        <textarea className="field row-action-textarea" rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
    </FormShell>
  );
}

function TaskFormModal({ context, onClose }: { context: RowActionContext; onClose: () => void }) {
  const [subject, setSubject] = useState(`Follow up with ${context.label}`);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("Normal");

  return (
    <FormShell title="Create Task" subtitle={context.label} onClose={onClose} onSubmit={onClose}>
      <label className="form-row">
        <span>Subject</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Due Date</span>
        <DateField value={dueDate} onChange={setDueDate} />
      </label>
      <label className="form-row">
        <span>Related To</span>
        <input className="field" value={context.relatedTo ?? context.label} readOnly />
      </label>
      <label className="form-row">
        <span>Priority</span>
        <select className="field" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option>High</option>
          <option>Normal</option>
          <option>Low</option>
        </select>
      </label>
    </FormShell>
  );
}

function MeetingFormModal({ context, onClose }: { context: RowActionContext; onClose: () => void }) {
  const [title, setTitle] = useState(`Meeting with ${context.label}`);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <FormShell title="Create Meeting" subtitle={context.label} onClose={onClose} onSubmit={onClose}>
      <label className="form-row">
        <span>Title</span>
        <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="form-row">
        <span>From</span>
        <DateField value={from} onChange={setFrom} />
      </label>
      <label className="form-row">
        <span>To</span>
        <DateField value={to} onChange={setTo} />
      </label>
      <label className="form-row">
        <span>Related To</span>
        <input className="field" value={context.relatedTo ?? context.label} readOnly />
      </label>
    </FormShell>
  );
}

function CallFormModal({
  kind,
  context,
  onClose,
}: {
  kind: "schedule" | "log";
  context: RowActionContext;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(
    kind === "schedule" ? `Call with ${context.label}` : `Call logged: ${context.label}`,
  );
  const [type, setType] = useState("Outbound");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("00:15");
  const [notes, setNotes] = useState("");

  return (
    <FormShell
      title={kind === "schedule" ? "Schedule a call" : "Log a call"}
      subtitle={context.label}
      onClose={onClose}
      submitLabel={kind === "schedule" ? "Schedule" : "Log"}
      onSubmit={onClose}
    >
      <label className="form-row">
        <span>Subject</span>
        <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Call Type</span>
        <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
          <option>Outbound</option>
          <option>Inbound</option>
        </select>
      </label>
      <label className="form-row">
        <span>{kind === "schedule" ? "Scheduled For" : "Start Time"}</span>
        <DateField value={when} onChange={setWhen} />
      </label>
      {kind === "log" ? (
        <label className="form-row">
          <span>Duration</span>
          <input className="field" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="mm:ss" />
        </label>
      ) : null}
      <label className="form-row">
        <span>Phone</span>
        <input className="field" value={context.phone ?? ""} readOnly={Boolean(context.phone)} placeholder="Enter phone" />
      </label>
      <label className="form-row">
        <span>Notes</span>
        <textarea className="field row-action-textarea" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
    </FormShell>
  );
}

function EditRecordModal({ context, onClose }: { context: RowActionContext; onClose: () => void }) {
  const [name, setName] = useState(context.label);
  const [email, setEmail] = useState(context.email ?? "");
  const [phone, setPhone] = useState(context.phone ?? "");

  return (
    <FormShell title="Edit" subtitle={context.label} onClose={onClose} onSubmit={onClose}>
      <label className="form-row">
        <span>Name</span>
        <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Email</span>
        <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="form-row">
        <span>Phone</span>
        <input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </label>
    </FormShell>
  );
}

function DeleteConfirmModal({
  context,
  onClose,
  onConfirm,
}: {
  context: RowActionContext;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card row-action-form-modal is-compact" onClick={(event) => event.stopPropagation()}>
        <header className="row-action-form-head">
          <div>
            <h2>Delete record</h2>
            <p className="muted">
              Delete <strong>{context.label}</strong>? This action cannot be undone.
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <footer className="row-action-form-foot">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button row-action-danger" onClick={onConfirm}>
            Delete
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function RowSelectCell({
  context,
  onEdit,
  onDelete,
}: {
  context: RowActionContext;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const selection = useRowSelection();
  const checked = selection?.isSelected(context.id) ?? false;

  return (
    <div className="row-lead-controls" onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
      <RowActions context={context} onEdit={onEdit} onDelete={onDelete} />
      <input
        type="checkbox"
        className="row-select-checkbox"
        aria-label={`Select ${context.label}`}
        checked={checked}
        onChange={(event) => selection?.setSelected(context.id, event.target.checked)}
      />
    </div>
  );
}

export function HeaderSelectCheckbox() {
  const selection = useRowSelection();
  const ref = useRef<HTMLInputElement>(null);
  const allSelected = selection?.allPageSelected ?? false;
  const someSelected = selection?.somePageSelected ?? false;

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  return (
    <div className="row-lead-controls is-header">
      <span className="row-action-spacer" aria-hidden />
      <input
        ref={ref}
        type="checkbox"
        className="row-select-checkbox"
        aria-label="Select all rows on this page"
        checked={allSelected}
        onChange={(event) => selection?.setPageSelected(event.target.checked)}
      />
    </div>
  );
}

type RowSelectionValue = {
  isSelected: (id: string) => boolean;
  setSelected: (id: string, checked: boolean) => void;
  setPageSelected: (checked: boolean) => void;
  allPageSelected: boolean;
  somePageSelected: boolean;
};

const RowSelectionContext = createContext<RowSelectionValue | null>(null);

function useRowSelection() {
  return useContext(RowSelectionContext);
}

export function RowSelectionProvider({
  pageIds,
  allIds,
  children,
}: {
  pageIds: string[];
  allIds: string[];
  children: ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const allKey = allIds.join("\0");

  useEffect(() => {
    const valid = new Set(allIds);
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (valid.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [allKey, allIds]);

  const value = useMemo<RowSelectionValue>(() => {
    const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    const somePageSelected = pageIds.some((id) => selectedIds.has(id));
    return {
      isSelected: (id) => selectedIds.has(id),
      setSelected: (id, checked) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          if (checked) next.add(id);
          else next.delete(id);
          return next;
        });
      },
      setPageSelected: (checked) => {
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (const id of pageIds) {
            if (checked) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      allPageSelected,
      somePageSelected,
    };
  }, [pageIds, selectedIds]);

  return <RowSelectionContext.Provider value={value}>{children}</RowSelectionContext.Provider>;
}
