"use client";

import { Bot, ChevronDown, Send, Sparkles, Trash2 } from "lucide-react";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { accounts, deals, leads, meetings, tasks } from "@/lib/crm-data";
import { ModuleKey } from "@/lib/types";
import { PublicUser } from "@/lib/users";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

const MODULE_LABELS: Partial<Record<ModuleKey, string>> = {
  home: "Home",
  reports: "Reports",
  leads: "Leads",
  accounts: "Clients",
  deals: "Loans",
  tradeFinance: "GTS",
  paymentService: "GPS",
  sustainableFinance: "SF",
  globalMarket: "GM",
  lifeInsurance: "Life Insurance",
  tasks: "Tasks",
  meetings: "Meetings",
};

const QUICK_PROMPTS: Partial<Record<ModuleKey, string[]>> = {
  home: ["Summarize today's priorities", "Which clients are at risk?", "Summarize the loan pipeline"],
  reports: ["Generate a business summary", "Analyze client risk", "Summarize the loan pipeline"],
  leads: ["Summarize lead activity", "Which leads need attention?", "Show converted leads"],
  accounts: ["Which clients are at risk?", "Show pending KYC reviews", "Summarize the client portfolio"],
  deals: ["Summarize the loan pipeline", "List loans closing soon", "Calculate weighted value"],
  tradeFinance: ["Summarize the trade finance pipeline", "List facilities by stage", "Calculate pipeline value"],
  paymentService: ["Summarize payment mandates", "Show evaluation cases", "List completed mandates"],
  sustainableFinance: ["Summarize sustainable finance pipeline", "List green facilities", "Calculate pipeline value"],
  globalMarket: ["Summarize global market deals", "List deals by stage", "Calculate pipeline value"],
  lifeInsurance: ["Summarize insurance cases", "List cases in evaluation", "Show completed cases"],
  tasks: ["What tasks are due today?", "List overdue tasks", "Show high-priority tasks"],
  meetings: ["What meetings are today?", "List upcoming meetings", "Summarize today's schedule"],
};

function initialMessage(name: string): ChatMessage {
  return {
    id: 1,
    role: "assistant",
    content: `Hi ${name}. I'm your CRM AI Assistant in demo mode. I can analyze clients, leads, loans, and tasks using the sample CRM data.`,
  };
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function generateMockReply(question: string, user: PublicUser) {
  const query = question.trim().toLowerCase();
  const today = "2026-07-30";

  const matchedAccount = accounts.find((account) =>
    query.includes(account.companyName.toLowerCase().replace(" (sample)", "")),
  );
  if (matchedAccount) {
    const relatedDeals = deals.filter((deal) => deal.account === matchedAccount.companyName);
    const relatedTasks = tasks.filter((task) => task.account === matchedAccount.companyName);
    return [
      `${matchedAccount.companyName} client summary:`,
      `• Status: ${matchedAccount.status}; client status: ${matchedAccount.clientStatus}; rating: ${matchedAccount.rating ?? "Not rated"}; risk: ${matchedAccount.riskRating ?? "Not rated"}`,
      `• KYC: ${matchedAccount.kycStatus ?? "Not set"}; relationship manager: ${matchedAccount.relationshipManager}`,
      `• Industry/region: ${matchedAccount.industry ?? "Not set"} / ${matchedAccount.region ?? "Not set"}`,
      `• Credit limit: ${matchedAccount.creditLimit || "Not set"}; related loans: ${relatedDeals.length}; open tasks: ${relatedTasks.filter((task) => task.status !== "Completed").length}`,
    ].join("\n");
  }

  if (/(风险|risk|kyc|合规)/.test(query)) {
    const riskAccounts = accounts.filter(
      (account) => account.riskRating === "High" || account.kycStatus === "Pending" || account.kycStatus === "Expired",
    );
    return [
      `${riskAccounts.length} clients require attention:`,
      ...riskAccounts.map(
        (account) =>
          `• ${account.companyName}: risk ${account.riskRating ?? "Not rated"}, KYC ${account.kycStatus ?? "Not set"}, relationship manager ${account.relationshipManager}`,
      ),
      "Prioritize reviewing the latest documentation for high-risk clients and pending KYC cases.",
    ].join("\n");
  }

  if (/(贷款|loan|deal|管道|pipeline|金额|加权)/.test(query)) {
    const total = deals.reduce((sum, deal) => sum + deal.amount, 0);
    const weighted = deals.reduce((sum, deal) => sum + deal.amount * (deal.probability / 100), 0);
    const urgent = deals.filter((deal) => deal.closingDate <= "2026-07-31");
    return [
      `The loan pipeline contains ${deals.length} loans totaling ${formatAmount(total)}, with a probability-weighted value of ${formatAmount(weighted)}.`,
      `${urgent.length} are expected to close by July 31:`,
      ...urgent.map(
        (deal) =>
          `• ${deal.name} — ${formatAmount(deal.amount)}, ${deal.stage}, ${deal.probability}% probability`,
      ),
    ].join("\n");
  }

  if (/(任务|task|待办|逾期|优先)/.test(query)) {
    const openTasks = tasks.filter((task) => task.status !== "Completed");
    const overdue = openTasks.filter((task) => task.dueDate < today);
    const todayTasks = openTasks.filter((task) => task.dueDate === today);
    const highPriority = openTasks.filter((task) => task.priority === "High");
    return [
      `You have ${openTasks.length} open tasks: ${todayTasks.length} due today, ${overdue.length} overdue, and ${highPriority.length} high priority.`,
      ...(overdue.length
        ? ["Overdue tasks:", ...overdue.map((task) => `• ${task.subject} (${task.account}, due ${task.dueDate})`)]
        : ["There are no overdue tasks."]),
    ].join("\n");
  }

  if (/(会议|meeting|日程|安排)/.test(query)) {
    const todayMeetings = meetings.filter((meeting) => meeting.from.startsWith(today));
    return [
      `You have ${todayMeetings.length} meetings on ${today}:`,
      ...todayMeetings.map(
        (meeting) => `• ${meeting.from.replace(`${today} `, "")} ${meeting.title} — ${meeting.relatedTo}`,
      ),
    ].join("\n");
  }

  if (/(线索|lead|跟进|转化)/.test(query)) {
    const byStatus = leads.reduce<Record<string, number>>((result, lead) => {
      result[lead.status] = (result[lead.status] ?? 0) + 1;
      return result;
    }, {});
    const priorityLeads = leads.filter((lead) => lead.status === "Qualified" || lead.status === "Contacted");
    return [
      `There are ${leads.length} leads: ${Object.entries(byStatus)
        .map(([status, count]) => `${status} ${count}`)
        .join(", ")}.`,
      "Recommended for priority follow-up:",
      ...priorityLeads.map((lead) => `• ${lead.name} (${lead.company}, ${lead.status})`),
    ].join("\n");
  }

  if (/(概览|摘要|总结|今天|业务)/.test(query)) {
    const openTasks = tasks.filter((task) => task.status !== "Completed");
    const todayMeetings = meetings.filter((meeting) => meeting.from.startsWith(today));
    const pipeline = deals.reduce((sum, deal) => sum + deal.amount, 0);
    return [
      `${user.displayName}, here is your CRM business overview:`,
      `• ${accounts.length} clients, including ${accounts.filter((account) => account.riskRating === "High").length} high-risk clients`,
      `• ${leads.length} leads, including ${leads.filter((lead) => lead.status === "Qualified").length} qualified leads`,
      `• ${deals.length} loans with a total pipeline value of ${formatAmount(pipeline)}`,
      `• ${openTasks.length} open tasks and ${todayMeetings.length} meetings today`,
    ].join("\n");
  }

  return "I'm a demo assistant running on sample CRM data. Try asking me to summarize today's priorities, identify at-risk clients, review the loan pipeline, or look up a client by name.";
}

const LAUNCHER_SIZE = 48;
const PANEL_WIDTH = 400;
const PANEL_HEIGHT = 640;
const VIEWPORT_MARGIN = 12;
const DRAG_THRESHOLD = 4;

function getWidgetSize(open: boolean) {
  if (!open || typeof window === "undefined") {
    return { width: LAUNCHER_SIZE, height: LAUNCHER_SIZE };
  }
  return {
    width: Math.min(PANEL_WIDTH, window.innerWidth - 32),
    height: Math.min(PANEL_HEIGHT, window.innerHeight - 48),
  };
}

function getDefaultPosition(open: boolean) {
  if (typeof window === "undefined") {
    return { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN };
  }
  const { width, height } = getWidgetSize(open);
  return {
    x: Math.max(VIEWPORT_MARGIN, window.innerWidth - 24 - width),
    y: Math.max(VIEWPORT_MARGIN, window.innerHeight - 24 - height),
  };
}

function clampPosition(position: { x: number; y: number }, open: boolean) {
  if (typeof window === "undefined") return position;
  const { width, height } = getWidgetSize(open);
  return {
    x: Math.min(Math.max(VIEWPORT_MARGIN, position.x), window.innerWidth - width - VIEWPORT_MARGIN),
    y: Math.min(Math.max(VIEWPORT_MARGIN, position.y), window.innerHeight - height - VIEWPORT_MARGIN),
  };
}

function getPanelPositionFromLauncher(launcherPosition: { x: number; y: number }) {
  const launcher = getWidgetSize(false);
  const panel = getWidgetSize(true);
  return clampPosition(
    {
      x: launcherPosition.x + launcher.width - panel.width,
      y: launcherPosition.y + launcher.height - panel.height,
    },
    true,
  );
}

export function AiChatWidget({ user, activeModule }: { user: PublicUser; activeModule: ModuleKey }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [initialMessage(user.displayName)]);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => getDefaultPosition(false));
  const [isDragging, setIsDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isThinkingRef = useRef(false);
  const launcherPositionRef = useRef(getDefaultPosition(false));
  const draggedWhileOpenRef = useRef(false);
  const hasCustomLauncherPositionRef = useRef(false);
  const positionRef = useRef(position);
  const dragStateRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const skipNextCloseRestoreRef = useRef(true);
  const prevOpenRef = useRef(open);
  const quickPrompts = useMemo(() => QUICK_PROMPTS[activeModule] ?? QUICK_PROMPTS.home!, [activeModule]);

  useEffect(() => {
    positionRef.current = position;
    const openJustChanged = prevOpenRef.current !== open;
    prevOpenRef.current = open;
    if (!open && !openJustChanged) {
      launcherPositionRef.current = position;
    }
  }, [position, open]);

  useEffect(() => {
    isThinkingRef.current = isThinking;
  }, [isThinking]);

  useEffect(() => {
    if (skipNextCloseRestoreRef.current) {
      skipNextCloseRestoreRef.current = false;
      return;
    }

    if (open) {
      draggedWhileOpenRef.current = false;
      setPosition((current) => {
        launcherPositionRef.current = current;
        return getPanelPositionFromLauncher(current);
      });
      return;
    }

    if (draggedWhileOpenRef.current) {
      const next = clampPosition(positionRef.current, false);
      launcherPositionRef.current = next;
      hasCustomLauncherPositionRef.current = true;
      setPosition(next);
      return;
    }

    setPosition(launcherPositionRef.current);
  }, [open]);

  useEffect(() => {
    function handleResize() {
      if (open) {
        setPosition(getPanelPositionFromLauncher(launcherPositionRef.current));
        return;
      }

      const next = hasCustomLauncherPositionRef.current
        ? clampPosition(launcherPositionRef.current, false)
        : getDefaultPosition(false);
      launcherPositionRef.current = next;
      setPosition(next);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [open]);

  function beginDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0) return;

    const target = event.target as HTMLElement | null;
    if (open && target?.closest(".ai-chat-header-actions button")) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: position.x,
      startY: position.y,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - drag.startClientX;
    const deltaY = event.clientY - drag.startClientY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    drag.moved = true;
    if (open) draggedWhileOpenRef.current = true;

    const next = clampPosition({ x: drag.startX + deltaX, y: drag.startY + deltaY }, open);
    setPosition(next);
    if (!open) {
      launcherPositionRef.current = next;
      hasCustomLauncherPositionRef.current = true;
    }
  }

  function finishDrag(event: React.PointerEvent<HTMLElement>, onClick?: () => void) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    const moved = drag.moved;
    dragStateRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!moved) onClick?.();
  }

  const sendMessage = useCallback(
    (value: string) => {
      const question = value.trim();
      if (!question || isThinkingRef.current) return;

      setMessages((current) => [...current, { id: Date.now(), role: "user", content: question }]);
      setInput("");
      setIsThinking(true);
      isThinkingRef.current = true;

      replyTimerRef.current = setTimeout(() => {
        setMessages((current) => [
          ...current,
          { id: Date.now() + 1, role: "assistant", content: generateMockReply(question, user) },
        ]);
        setIsThinking(false);
        isThinkingRef.current = false;
      }, 650);
    },
    [user],
  );

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, messages, isThinking]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target)) return;
      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    function handleExternalPrompt(event: Event) {
      const detail = (event as CustomEvent<{ prompt?: string }>).detail;
      const prompt = detail?.prompt?.trim();
      if (!prompt) return;
      setOpen(true);
      sendMessage(prompt);
    }

    window.addEventListener("crm-ai-chat", handleExternalPrompt);
    return () => window.removeEventListener("crm-ai-chat", handleExternalPrompt);
  }, [sendMessage]);

  useEffect(
    () => () => {
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    },
    [],
  );

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input);
    }
  }

  function clearConversation() {
    if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
    setIsThinking(false);
    isThinkingRef.current = false;
    setMessages([initialMessage(user.displayName)]);
    setInput("");
  }

  return (
    <div
      ref={rootRef}
      className={`ai-chat ${open ? "is-open" : ""} ${isDragging ? "is-dragging" : ""}`}
      style={{ left: position.x, top: position.y }}
    >
      {open ? (
        <section className="ai-chat-panel" role="dialog" aria-label="CRM AI Assistant">
          <header
            className="ai-chat-header"
            onPointerDown={beginDrag}
            onPointerMove={moveDrag}
            onPointerUp={(event) => finishDrag(event)}
            onPointerCancel={(event) => finishDrag(event)}
          >
            <span className="ai-chat-brand">
              <span className="ai-chat-brand-icon">
                <Sparkles size={17} />
              </span>
              <span>
                <strong>CRM AI Assistant</strong>
                <small>
                  <i /> Demo · {MODULE_LABELS[activeModule] ?? "Workspace"}
                </small>
              </span>
            </span>
            <span className="ai-chat-header-actions">
              <button type="button" onClick={clearConversation} title="Clear conversation" aria-label="Clear conversation">
                <Trash2 size={16} />
              </button>
              <button type="button" onClick={() => setOpen(false)} title="Minimize" aria-label="Minimize AI assistant">
                <ChevronDown size={18} />
              </button>
            </span>
          </header>

          <div className="ai-chat-messages" aria-live="polite">
            {messages.map((message) => (
              <div className={`ai-chat-message ${message.role}`} key={message.id}>
                {message.role === "assistant" ? (
                  <span className="ai-chat-avatar">
                    <Bot size={16} />
                  </span>
                ) : null}
                <p>{message.content}</p>
              </div>
            ))}
            {isThinking ? (
              <div className="ai-chat-message assistant">
                <span className="ai-chat-avatar">
                  <Bot size={16} />
                </span>
                <span className="ai-chat-typing" aria-label="AI is thinking">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </div>

          {messages.length === 1 ? (
            <div className="ai-chat-prompts">
              {quickPrompts.map((prompt) => (
                <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <form className="ai-chat-compose" onSubmit={handleSubmit}>
            <textarea
              ref={inputRef}
              value={input}
              rows={1}
              placeholder="Ask about your CRM data..."
              aria-label="Message CRM AI Assistant"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button type="submit" disabled={!input.trim() || isThinking} aria-label="Send message">
              <Send size={17} />
            </button>
          </form>
          <p className="ai-chat-disclaimer">Demo responses use sample CRM data and may be inaccurate.</p>
        </section>
      ) : (
        <button
          className="ai-chat-launcher"
          type="button"
          aria-label="Open CRM AI Assistant"
          onPointerDown={beginDrag}
          onPointerMove={moveDrag}
          onPointerUp={(event) => finishDrag(event, () => setOpen(true))}
          onPointerCancel={(event) => finishDrag(event)}
        >
          <span className="ai-chat-launcher-mark" aria-hidden="true">
            <Sparkles size={20} strokeWidth={1.9} />
          </span>
          <span className="ai-chat-launcher-tooltip" role="tooltip">Ask AI</span>
        </button>
      )}
    </div>
  );
}
