"use client";

import { Maximize2, Minimize2 } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type HomePanelKey = "attention" | "loans" | "calendar" | "quickAccess";

/** Controlled when both args are provided; otherwise manages its own expand state. */
export function useHomePanel(
  controlledExpanded?: boolean,
  onExpandedChange?: (expanded: boolean) => void,
) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const controlled = onExpandedChange != null;
  const expanded = controlled ? Boolean(controlledExpanded) : localExpanded;

  const setExpanded = useCallback(
    (next: boolean) => {
      if (onExpandedChange) onExpandedChange(next);
      else setLocalExpanded(next);
    },
    [onExpandedChange],
  );

  useEffect(() => {
    if (!expanded) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      // A record form opened from inside the panel owns Escape first.
      if (document.querySelector(".modal-backdrop")) return;
      setExpanded(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded, setExpanded]);

  const toggle = useCallback(() => setExpanded(!expanded), [expanded, setExpanded]);
  const exit = useCallback(() => setExpanded(false), [setExpanded]);

  return { expanded, toggle, exit, setExpanded, modifier: expanded ? " is-fullscreen" : "" };
}

export function HomePanelExpandButton({
  expanded,
  label,
  onToggle,
}: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="home-quad-expand"
      aria-label={expanded ? `Exit full screen for ${label}` : `Show ${label} full screen`}
      title={expanded ? "Exit full screen (Esc)" : "Full screen"}
      onClick={onToggle}
    >
      {expanded ? <Minimize2 size={14} strokeWidth={1.9} /> : <Maximize2 size={14} strokeWidth={1.9} />}
    </button>
  );
}

export function HomePanelHost({
  expanded,
  onExit,
  children,
}: {
  expanded: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  if (!expanded || typeof document === "undefined") return <>{children}</>;

  return createPortal(
    <div
      className="home-panel-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onExit();
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
