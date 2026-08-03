"use client";

import {
  ArrowDown,
  ArrowUp,
  Bell,
  Briefcase,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleDollarSign,
  CircleHelp,
  ClipboardList,
  Clock3,
  CreditCard,
  Download,
  FileText,
  Filter,
  GripVertical,
  HeartPulse,
  Landmark,
  LayoutGrid,
  Leaf,
  LineChart,
  List,
  Megaphone,
  Monitor,
  Moon,
  MoreHorizontal,
  Phone,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Ship,
  Sparkles,
  Sun,
  Users,
  X,
} from "lucide-react";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AiChatWidget } from "@/components/AiChatWidget";
import { ImportRecordsModal } from "@/components/ImportRecordsModal";
import { ClientKanbanBoard } from "@/components/ClientKanbanBoard";
import { DateField } from "@/components/DateField";
import { HomeCalendar, HomeLoansClosing } from "@/components/HomeCalendar";
import {
  HomePanelExpandButton,
  HomePanelHost,
  useHomePanel,
  type HomePanelKey,
} from "@/components/HomePanel";
import { LoanFormStageTrail, LoanKanbanBoard, LoanStageBar } from "@/components/LoanKanbanBoard";
import { LoginPage } from "@/components/LoginPage";
import { ReportsWorkspace } from "@/components/ReportsWorkspace";
import { HeaderSelectCheckbox, RowSelectCell, RowSelectionProvider } from "@/components/RowActions";
import { TrainingVideos } from "@/components/TrainingVideos";
import { clearSessionUser, loadSessionUser, saveSessionUser } from "@/lib/auth";
import {
  accounts,
  callFilters,
  calls,
  campaigns,
  contacts,
  deals,
  leadFilters,
  leads,
  loanFacilities,
  meetings,
  modules,
  productPipelineData,
  systemFilters,
  taskFilters,
  tasks,
  timeline,
  workflowRules,
} from "@/lib/crm-data";
import { buildLoanNotifications, type AppNotification } from "@/lib/notifications";
import {
  getAllPipelineLoans,
  getPipelineLoans,
  getPipelineLoansSnapshot,
  setPipelineLoans,
  subscribePipelineLoans,
} from "@/lib/pipeline-loans";
import {
  PRODUCT_PIPELINE_CONFIGS,
  type ProductPipelineConfig,
  type ProductPipelineModuleKey,
} from "@/lib/product-pipeline";
import { exportRecordsCsv, type ImportFieldDef } from "@/lib/csv-import";
import { resolveOptionColor } from "@/lib/option-colors";
import {
  applyColumnSortFilter,
  ColumnDef,
  ColumnFilter,
  ColumnFilters,
  createEmptyFilter,
  filterOpNeedsSecondValue,
  filterOpNeedsValue,
  getFilterOperators,
  hasActiveFilter,
  isColumnFilterable,
  isColumnSortable,
  SortState,
} from "@/lib/table";
import {
  Account,
  Call,
  Campaign,
  CampaignChannel,
  CampaignStatus,
  CampaignType,
  ClientIndustry,
  ClientKycStatus,
  ClientProductInterest,
  ClientRating,
  ClientRegion,
  ClientRiskRating,
  ClientSegment,
  ClientStatus,
  AccountStatus,
  Contact,
  ContactPreferredChannel,
  ContactRole,
  ContactStatus,
  Deal,
  DemoUser,
  Lead,
  LegalEntityType,
  LoanBusinessUnit,
  Meeting,
  ModuleKey,
  PipelineStage,
  PrimaryIdType,
  Task,
  UserProfile,
  UserRole,
  UserStatus,
} from "@/lib/types";
import {
  demoUsers,
  PublicUser,
  USER_BU_OPTIONS,
  USER_DEPARTMENT_OPTIONS,
  USER_PROFILE_OPTIONS,
  USER_ROLE_OPTIONS,
  USER_STATUS_OPTIONS,
} from "@/lib/users";

type AppearanceMode = "day" | "night" | "auto";
type ThemeTone = "dark" | "lite";
type WorkspaceView = "modules" | "admin" | "users";
type OpenRecordIntent = {
  recordId: string;
  id: number;
  returnTo?: "home";
};

const createRecordOptions: Array<{ label: string; module: ModuleKey }> = [
  { label: "Lead", module: "leads" },
  { label: "Contact", module: "contacts" },
  { label: "Client", module: "accounts" },
  { label: "Loan", module: "deals" },
  { label: "GTS", module: "tradeFinance" },
  { label: "GPS", module: "paymentService" },
  { label: "SF", module: "sustainableFinance" },
  { label: "GM", module: "globalMarket" },
  { label: "Life Insurance", module: "lifeInsurance" },
  { label: "Task", module: "tasks" },
  { label: "Meeting", module: "meetings" },
  { label: "Call", module: "calls" },
  { label: "Campaign", module: "campaigns" },
];

type QuickCreateField = {
  key: string;
  label: string;
  type?: "text" | "email" | "tel" | "date" | "number" | "select";
  options?: string[];
  placeholder?: string;
};

type AccentColor = { key: string; label: string; value: string; mark?: string };

const accentColors = [
  { key: "crimson", label: "Crimson", value: "#a31d31", mark: "#cf4651" },
  { key: "oceanBlue", label: "Ocean Blue", value: "#004b97" },
  { key: "ledgerGreen", label: "Ledger Green", value: "#00875a" },
  { key: "vividBlue", label: "Vivid Blue", value: "#1677ff" },
  { key: "signalRed", label: "Signal Red", value: "#b81020" },
  { key: "skyBlue", label: "Sky Blue", value: "#288cfa" },
  { key: "cloudGray", label: "Cloud Gray", value: "#f8f8f8", mark: "#8a8f98" },
] as const satisfies ReadonlyArray<AccentColor>;

type AccentKey = (typeof accentColors)[number]["key"];

function getAccentMark(entry: AccentColor | undefined, accent: string, isNight: boolean) {
  const mark = entry?.mark;
  if (isNight) return lighten(mark ?? accent, 40);
  return mark ?? lighten(accent, 48);
}

function mixHex(hex: string, target: string, ratio: number) {
  const parse = (value: string) => {
    const raw = value.replace("#", "");
    const num = Number.parseInt(raw, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255] as const;
  };
  const [r1, g1, b1] = parse(hex);
  const [r2, g2, b2] = parse(target);
  const mix = (a: number, b: number) => Math.round(a * (1 - ratio) + b * ratio);
  return `#${[mix(r1, r2), mix(g1, g2), mix(b1, b2)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixWithWhite(hex: string, ratio: number) {
  return mixHex(hex, "#ffffff", ratio);
}

function lighten(hex: string, amount: number) {
  return mixWithWhite(hex, Math.min(1, Math.max(0, amount / 255)));
}

/** WCAG relative luminance, used to detect accents too light to carry white text. */
function relativeLuminance(hex: string) {
  const raw = hex.replace("#", "");
  const num = Number.parseInt(raw, 16);
  const channel = (value: number) => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((num >> 16) & 255) +
    0.7152 * channel((num >> 8) & 255) +
    0.0722 * channel(num & 255)
  );
}

function darken(hex: string, amount: number) {
  const raw = hex.replace("#", "");
  const num = Number.parseInt(raw, 16);
  const r = Math.max(0, ((num >> 16) & 255) - amount);
  const g = Math.max(0, ((num >> 8) & 255) - amount);
  const b = Math.max(0, (num & 255) - amount);
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

const moduleIcons: Record<Exclude<ModuleKey, "home" | "reports">, React.ReactNode> = {
  leads: <Briefcase size={18} strokeWidth={1.6} />,
  contacts: <Users size={18} strokeWidth={1.6} />,
  accounts: <Landmark size={18} strokeWidth={1.6} />,
  deals: <CircleDollarSign size={18} strokeWidth={1.6} />,
  tradeFinance: <Ship size={18} strokeWidth={1.6} />,
  paymentService: <CreditCard size={18} strokeWidth={1.6} />,
  sustainableFinance: <Leaf size={18} strokeWidth={1.6} />,
  globalMarket: <LineChart size={18} strokeWidth={1.6} />,
  lifeInsurance: <HeartPulse size={18} strokeWidth={1.6} />,
  tasks: <ClipboardList size={18} strokeWidth={1.6} />,
  meetings: <CalendarDays size={18} strokeWidth={1.6} />,
  calls: <Phone size={18} strokeWidth={1.6} />,
  campaigns: <Megaphone size={18} strokeWidth={1.6} />,
  documents: <FileText size={18} strokeWidth={1.6} />,
};

const adminGroups = [
  { title: "General", items: ["Personal Settings", "Users", "Company Settings"] },
  { title: "Security Control", items: ["Profiles", "Roles and Sharing", "Compliance Settings", "Support Access", "Audit Log"] },
  { title: "Channels", items: ["Email", "Notification SMS", "Webforms", "Chat"] },
  { title: "Customization", items: ["Modules and Fields", "Wizards", "Customize Home page", "Templates"] },
  { title: "Automation", items: ["Workflow Rules", "Actions"] },
  { title: "Data Administration", items: ["Import", "Export", "Data Backup", "Storage", "Recycle Bin"] },
  { title: "Marketplace", items: ["CRM Marketplace", "Microsoft", "Extension Builder"] },
  { title: "Developer Hub", items: ["MCP for AI Agents", "APIs and SDKs", "Catalyst Solutions"] },
];

function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Interlocking chain links (Creative Cloud–style) */}
      <g
        transform="translate(14 14) rotate(-45)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <rect x="-10.1" y="-3.9" width="12.8" height="7.8" rx="3.9" />
        <rect x="-2.7" y="-3.9" width="12.8" height="7.8" rx="3.9" />
      </g>
    </svg>
  );
}

function LogoDrawLoader() {
  const links = [
    { x: -19.2, y: -7.4, width: 24.2, height: 14.8, rx: 7.4 },
    { x: -5, y: -7.4, width: 24.2, height: 14.8, rx: 7.4 },
  ] as const;

  return (
    <div className="logo-draw-loader">
      <svg
        className="logo-loader-icon"
        width={56}
        height={56}
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g
          className="logo-loader-links"
          transform="translate(28 28) rotate(-45)"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3.6"
        >
          <g className="logo-loader-solid">
            {links.map((link) => (
              <rect key={`solid-${link.x}`} x={link.x} y={link.y} width={link.width} height={link.height} rx={link.rx} />
            ))}
          </g>
          {(["red", "green", "blue", "yellow"] as const).map((tone) => (
            <g key={tone} className={`logo-loader-paint logo-loader-paint-${tone}`}>
              {links.map((link) => (
                <rect
                  key={`${tone}-${link.x}`}
                  className="logo-loader-seg"
                  x={link.x}
                  y={link.y}
                  width={link.width}
                  height={link.height}
                  rx={link.rx}
                />
              ))}
            </g>
          ))}
        </g>
      </svg>
      <p className="logo-loading-text">Loading</p>
    </div>
  );
}

function SidebarToggleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.75"
        y="3.75"
        width="16.5"
        height="16.5"
        rx="3.25"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M9 4.5V19.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TableViewIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {[5.5, 12, 18.5].map((y) => (
        <g key={y}>
          <rect x="3" y={y - 1.5} width="3" height="3" rx="0.9" fill="var(--brand)" />
          <path
            d={`M9 ${y}H21`}
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
          />
        </g>
      ))}
    </svg>
  );
}

function KanbanViewIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="4.4"
        y="3.6"
        width="6.4"
        height="16.8"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <rect
        x="13.2"
        y="3.6"
        width="6.4"
        height="10.6"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HomeIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M4.2 10.4 12 3.8l7.8 6.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.4 9.7V18.1c0 1.05.85 1.9 1.9 1.9h7.4c1.05 0 1.9-.85 1.9-1.9V9.7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 20v-5.1c0-.6.5-1.1 1.1-1.1h1.8c.6 0 1.1.5 1.1 1.1V20"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ReportsIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3.25"
        y="3.25"
        width="17.5"
        height="17.5"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8.2 15.4V12.6M12 15.4V10.2M15.8 15.4V8.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModulesIcon({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="modules-icon"
    >
      <rect
        x="7.35"
        y="7.55"
        width="5.5"
        height="5.5"
        rx="1.05"
        transform="rotate(-16 10.1 10.3)"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="15.15" y="7.25" width="5.5" height="5.5" rx="1.05" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="7.35" y="15.15" width="5.5" height="5.5" rx="1.05" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="15.15" y="15.15" width="5.5" height="5.5" rx="1.05" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function CRMWorkspace() {
  const [sessionUser, setSessionUser] = useState<PublicUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeModule, setActiveModule] = useState<ModuleKey>("deals");
  const [detailTab, setDetailTab] = useState<"overview" | "timeline">("overview");
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(198);
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("modules");
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>("auto");
  const [themeTone, setThemeTone] = useState<ThemeTone>("dark");
  const [accentKey, setAccentKey] = useState<AccentKey>("crimson");
  const [adminQuery, setAdminQuery] = useState("");
  const [bootLoading, setBootLoading] = useState(false);
  const [createIntent, setCreateIntent] = useState<{ module: ModuleKey; id: number } | null>(null);
  const [recordIntent, setRecordIntent] = useState<(OpenRecordIntent & { module: ModuleKey }) | null>(null);
  const [moduleReturnHome, setModuleReturnHome] = useState(false);
  /** Survives leave/return so a fullscreen Home panel can be restored via Back. */
  const [homeExpandedPanel, setHomeExpandedPanel] = useState<HomePanelKey | null>(null);
  const [moduleTabIntent, setModuleTabIntent] = useState<string | null>(null);
  const [accountsView, setAccountsView] = useState<"All Clients" | "Active Clients">("All Clients");
  const [navToken, setNavToken] = useState(0);

  useEffect(() => {
    const user = loadSessionUser();
    setSessionUser(user);
    setAuthReady(true);
    if (user) setBootLoading(true);
  }, []);

  useEffect(() => {
    if (!bootLoading) return;
    const timer = window.setTimeout(() => setBootLoading(false), 1800);
    return () => window.clearTimeout(timer);
  }, [bootLoading]);

  function handleLogin(user: PublicUser) {
    saveSessionUser(user.username);
    setSessionUser(user);
    setBootLoading(true);
  }

  function handleLogout() {
    clearSessionUser();
    setSessionUser(null);
    setBootLoading(false);
    setWorkspaceView("modules");
    setActiveModule("deals");
  }

  const pageTitle =
    workspaceView === "admin"
      ? "Setup"
      : workspaceView === "users"
        ? "Users"
        : activeModule === "home"
          ? "Home"
          : activeModule === "reports"
            ? "Reports"
            : (modules.find((module) => module.key === activeModule)?.label ??
              activeModule.charAt(0).toUpperCase() + activeModule.slice(1));

  useEffect(() => {
    document.title = sessionUser ? `${pageTitle} - CRM` : "Sign in - CRM";
  }, [pageTitle, sessionUser]);

  useEffect(() => {
    if (!sessionUser) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const root = document.documentElement;
    const accentEntry = accentColors.find((item) => item.key === accentKey);
    const accent = accentEntry?.value ?? "#8a5a40";

    const applyTheme = (resolvedMode: "day" | "night") => {
      const isNight = resolvedMode === "night";
      const dayNav = themeTone === "lite" ? mixWithWhite(accent, 0.18) : accent;
      // Night: sidebar matches the dark shell; accent only tints it lightly.
      const nightNav =
        themeTone === "lite"
          ? mixHex(accent, "#34333c", 0.78)
          : mixHex(accent, "#2c2b34", 0.88);
      const nav = isNight ? nightNav : dayNav;
      // A near-white sidebar cannot carry the white nav text/logo, so flip its
      // foreground to ink and keep --brand dark for the white-on-brand buttons.
      const isLightNav = !isNight && relativeLuminance(nav) > 0.6;
      const ink = mixHex(accent, "#33373f", 0.9);
      const brand = isNight ? lighten(accent, 58) : isLightNav ? ink : dayNav;
      const brandSoft = isNight
        ? mixHex(accent, "#34323c", 0.7)
        : isLightNav
          ? mixWithWhite(ink, 0.9)
          : mixWithWhite(accent, 0.88);
      const brandMark = isLightNav ? ink : getAccentMark(accentEntry, accent, isNight);

      root.setAttribute("data-mode", resolvedMode);
      if (isLightNav) {
        root.setAttribute("data-light-nav", "true");
        root.style.setProperty("--nav-text", "rgb(0 0 0 / 62%)");
        root.style.setProperty("--nav-hover-text", ink);
        root.style.setProperty("--nav-active", "rgb(0 0 0 / 8%)");
        root.style.setProperty("--nav-hover", "rgb(0 0 0 / 5%)");
      } else {
        root.removeAttribute("data-light-nav");
        ["--nav-text", "--nav-hover-text", "--nav-active", "--nav-hover"].forEach((key) =>
          root.style.removeProperty(key),
        );
      }

      root.style.setProperty("--nav", nav);
      root.style.setProperty(
        "--nav-soft",
        isNight ? mixHex(nav, "#1e1d24", 0.35) : darken(nav, isLightNav ? 8 : 14),
      );
      root.style.setProperty("--brand", brand);
      root.style.setProperty("--brand-soft", brandSoft);
      root.style.setProperty("--brand-mark", brandMark);
      root.style.setProperty("--accent", isNight ? lighten(accent, 46) : mixWithWhite(accent, 0.25));
      root.style.setProperty("--create-border", brand);
      root.style.setProperty("--account-header", isNight ? mixHex(accent, "#2c2b34", 0.45) : dayNav);
    };

    const resolveMode = () =>
      appearanceMode === "auto" ? (media.matches ? "night" : "day") : appearanceMode;

    applyTheme(resolveMode());

    if (appearanceMode !== "auto") return;

    const onChange = () => applyTheme(media.matches ? "night" : "day");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [appearanceMode, themeTone, accentKey, sessionUser]);

  function openModule(module: ModuleKey, options?: { returnTo?: "home"; tab?: string }) {
    setActiveModule(module);
    setWorkspaceView("modules");
    setModuleReturnHome(options?.returnTo === "home");
    setModuleTabIntent(options?.tab ?? null);
    if (module !== "home" && options?.returnTo !== "home") {
      setHomeExpandedPanel(null);
    }
  }

  // Sidebar navigation always lands on the module's list view, even when a record
  // form is open, so bump the token that remounts the workspace body.
  function navigateFromSidebar(module: ModuleKey) {
    setCreateIntent(null);
    setRecordIntent(null);
    setHomeExpandedPanel(null);
    setNavToken((token) => token + 1);
    openModule(module);
  }

  function openRecord(module: ModuleKey, recordId: string) {
    setCreateIntent(null);
    openModule(module, { returnTo: "home" });
    setRecordIntent({ module, recordId, id: Date.now(), returnTo: "home" });
  }

  function returnToHome() {
    openModule("home");
  }

  function requestCreate(module: ModuleKey) {
    setRecordIntent(null);
    openModule(module);
    setCreateIntent({ module, id: Date.now() });
  }

  if (!authReady) {
    return <div className="auth-boot" aria-busy="true" aria-label="Loading" />;
  }

  if (!sessionUser) {
    return <LoginPage onSuccess={handleLogin} />;
  }

  return (
    <main
      className={`app ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}
      style={
        sidebarExpanded
          ? ({ ["--sidebar-width" as string]: `${sidebarWidth}px` } as React.CSSProperties)
          : undefined
      }
    >
      {bootLoading ? (
        <div className="boot-loading-overlay" role="status" aria-live="polite" aria-label="Loading">
          <div className="boot-loading-shell">
            <aside className="boot-skel-sidebar" style={{ width: sidebarExpanded ? sidebarWidth : 60 }}>
              <div className="boot-skel-block boot-skel-logo" />
              {Array.from({ length: 10 }).map((_, index) => (
                <div className="boot-skel-row" key={index}>
                  <span className="boot-skel-dot" />
                  <span className="boot-skel-line" />
                </div>
              ))}
            </aside>
            <div className="boot-loading-main">
              <div className="boot-skel-topbar">
                <span className="boot-skel-search" />
                <span className="boot-skel-dot" />
                <span className="boot-skel-dot" />
                <span className="boot-skel-dot" />
              </div>
              <div className="boot-loading-center">
                <LogoDrawLoader />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Sidebar
        activeModule={activeModule}
        expanded={sidebarExpanded}
        width={sidebarWidth}
        onWidthChange={setSidebarWidth}
        onChange={navigateFromSidebar}
        onToggle={() => setSidebarExpanded((value) => !value)}
      />
      <section className="main">
        <Topbar
          user={sessionUser}
          appearanceMode={appearanceMode}
          themeTone={themeTone}
          accentKey={accentKey}
          onAppearanceModeChange={setAppearanceMode}
          onThemeToneChange={setThemeTone}
          onAccentChange={setAccentKey}
          onLogout={handleLogout}
          onRequestCreate={requestCreate}
          onOpenNotification={(notification) => {
            openRecord(notification.module, notification.recordId);
          }}
        />
        <div className="content">
          {workspaceView === "admin" ? (
            <AdminWorkspace
              query={adminQuery}
              onQueryChange={setAdminQuery}
              onShowWorkflow={() => setShowWorkflowModal(true)}
              onOpenUsers={() => setWorkspaceView("users")}
            />
          ) : workspaceView === "users" ? (
            <UsersWorkspace onBack={() => setWorkspaceView("admin")} />
          ) : (
            <ModuleViewActionsProvider>
              {activeModule !== "home" && activeModule !== "reports" ? (
                <ModuleViewHeader
                  key={activeModule}
                  activeModule={activeModule}
                  accountsView={accountsView}
                  onAccountsViewChange={setAccountsView}
                  initialTab={moduleTabIntent}
                  onReturnHome={moduleReturnHome ? returnToHome : undefined}
                />
              ) : null}
              <Fragment key={`${activeModule}-${navToken}`}>
                {activeModule === "home" && (
                  <HomeDashboard
                    expandedPanel={homeExpandedPanel}
                    onExpandedPanelChange={setHomeExpandedPanel}
                    onNavigate={openModule}
                    onOpenRecord={openRecord}
                  />
                )}
                {activeModule === "leads" && (
                  <LeadsWorkspace
                    detailTab={detailTab}
                    setDetailTab={setDetailTab}
                    createIntentId={createIntent?.module === "leads" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "leads" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "accounts" && (
                  <AccountsWorkspace
                    view={accountsView}
                    createIntentId={createIntent?.module === "accounts" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "accounts" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "deals" && (
                  <DealsWorkspace
                    moduleKey="deals"
                    createIntentId={createIntent?.module === "deals" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "deals" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "tradeFinance" && (
                  <DealsWorkspace
                    moduleKey="tradeFinance"
                    createIntentId={createIntent?.module === "tradeFinance" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "tradeFinance" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "paymentService" && (
                  <DealsWorkspace
                    moduleKey="paymentService"
                    createIntentId={createIntent?.module === "paymentService" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "paymentService" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "sustainableFinance" && (
                  <DealsWorkspace
                    moduleKey="sustainableFinance"
                    createIntentId={createIntent?.module === "sustainableFinance" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "sustainableFinance" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "globalMarket" && (
                  <DealsWorkspace
                    moduleKey="globalMarket"
                    createIntentId={createIntent?.module === "globalMarket" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "globalMarket" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "lifeInsurance" && (
                  <DealsWorkspace
                    moduleKey="lifeInsurance"
                    createIntentId={createIntent?.module === "lifeInsurance" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "lifeInsurance" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "tasks" && (
                  <TasksWorkspace
                    createIntentId={createIntent?.module === "tasks" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "tasks" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "meetings" && (
                  <MeetingsWorkspace
                    createIntentId={createIntent?.module === "meetings" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "meetings" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "calls" && (
                  <CallsWorkspace
                    createIntentId={createIntent?.module === "calls" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                  />
                )}
                {activeModule === "campaigns" && (
                  <CampaignWorkspace
                    createIntentId={createIntent?.module === "campaigns" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "campaigns" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "reports" && <ReportsWorkspace />}
                {activeModule === "contacts" && (
                  <ContactsWorkspace
                    createIntentId={createIntent?.module === "contacts" ? createIntent.id : null}
                    onCreateHandled={() => setCreateIntent(null)}
                    openRecordIntent={recordIntent?.module === "contacts" ? recordIntent : null}
                    onRecordHandled={() => setRecordIntent(null)}
                    onReturnHome={returnToHome}
                  />
                )}
                {activeModule === "documents" && <Placeholder title="Documents" />}
              </Fragment>
            </ModuleViewActionsProvider>
          )}
        </div>
      </section>
      {showWorkflowModal && <WorkflowModal onClose={() => setShowWorkflowModal(false)} />}
      <AiChatWidget user={sessionUser} activeModule={activeModule} />
    </main>
  );
}

const ModuleViewActionsHostContext = createContext<HTMLElement | null>(null);
const ModuleViewActionsHostSetterContext = createContext<(el: HTMLElement | null) => void>(
  () => {},
);
const ModuleViewTabContext = createContext<{
  activeTab: string;
  setActiveTab: (tab: string) => void;
}>({
  activeTab: "Main table",
  setActiveTab: () => {},
});
const ModuleFilterPanelContext = createContext<{
  filtersOpen: boolean;
  toggleFilters: () => void;
}>({
  filtersOpen: false,
  toggleFilters: () => {},
});

function ModuleViewActionsProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState("Main table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelValue = useMemo(
    () => ({ filtersOpen, toggleFilters: () => setFiltersOpen((open) => !open) }),
    [filtersOpen],
  );
  return (
    <ModuleViewTabContext.Provider value={{ activeTab, setActiveTab }}>
      <ModuleFilterPanelContext.Provider value={filterPanelValue}>
        <ModuleViewActionsHostSetterContext.Provider value={setHost}>
          <ModuleViewActionsHostContext.Provider value={host}>{children}</ModuleViewActionsHostContext.Provider>
        </ModuleViewActionsHostSetterContext.Provider>
      </ModuleFilterPanelContext.Provider>
    </ModuleViewTabContext.Provider>
  );
}

const MODULE_VIEW_TABS: Partial<Record<ModuleKey, string[]>> = {
  accounts: ["Main table", "Kanban"],
  contacts: ["Main table", "Summary", "Form", "Calendar"],
  deals: ["Main table", "Kanban"],
  tradeFinance: ["Main table", "Kanban"],
  paymentService: ["Main table", "Kanban"],
  sustainableFinance: ["Main table", "Kanban"],
  globalMarket: ["Main table", "Kanban"],
  lifeInsurance: ["Main table", "Kanban"],
  campaigns: ["Main table", "Report", "Form", "Calendar"],
  leads: ["Main table", "Sales report", "Pipeline", "Form", "Kanban", "Calendar"],
  tasks: ["Main table", "Form", "Kanban", "Calendar"],
  meetings: ["Main table", "Form", "Calendar"],
  calls: ["Main table", "Form"],
  documents: ["Main table", "Files"],
};

const MODULE_VIEW_TAB_ICONS: Record<string, React.ReactNode> = {
  "Main table": <TableViewIcon size={17} />,
  Kanban: <KanbanViewIcon size={17} />,
};

/** Modules that use the Clients-style icon chrome: Main table + Kanban only, no “add view”. */
const ICON_VIEW_MODULES = new Set<ModuleKey>([
  "accounts",
  "deals",
  "tradeFinance",
  "paymentService",
  "sustainableFinance",
  "globalMarket",
  "lifeInsurance",
]);

function ModuleViewHeader({
  activeModule,
  accountsView = "All Clients",
  onAccountsViewChange,
  initialTab = null,
  onReturnHome,
}: {
  activeModule: Exclude<ModuleKey, "home" | "reports">;
  accountsView?: "All Clients" | "Active Clients";
  onAccountsViewChange?: (view: "All Clients" | "Active Clients") => void;
  initialTab?: string | null;
  onReturnHome?: () => void;
}) {
  const moduleMeta = modules.find((module) => module.key === activeModule);
  const moduleLabel = moduleMeta?.label ?? activeModule;
  const useIconTabs = ICON_VIEW_MODULES.has(activeModule);
  const tabs = useIconTabs
    ? ["Main table", "Kanban"]
    : (MODULE_VIEW_TABS[activeModule] ?? ["Main table"]);
  const { activeTab, setActiveTab } = useContext(ModuleViewTabContext);
  const viewOptions =
    activeModule === "accounts"
      ? (["All Clients", "Active Clients"] as const)
      : ([`All ${moduleLabel}`] as const);
  const [internalView, setInternalView] = useState<string>(viewOptions[0]);
  const selectedView = activeModule === "accounts" ? accountsView : internalView;
  const viewPickerRef = useRef<HTMLDetailsElement>(null);
  const setActionsHost = useContext(ModuleViewActionsHostSetterContext);
  const { filtersOpen, toggleFilters } = useContext(ModuleFilterPanelContext);

  useEffect(() => {
    const availableTabs = useIconTabs
      ? ["Main table", "Kanban"]
      : (MODULE_VIEW_TABS[activeModule] ?? ["Main table"]);
    setActiveTab(initialTab && availableTabs.includes(initialTab) ? initialTab : "Main table");
  }, [activeModule, setActiveTab, initialTab, useIconTabs]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const details = viewPickerRef.current;
      if (!details?.open) return;
      if (!details.contains(event.target as Node)) {
        details.removeAttribute("open");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        viewPickerRef.current?.removeAttribute("open");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="module-view-header">
      <div className="module-view-title-row">
        {onReturnHome ? (
          <button
            type="button"
            className="module-view-back"
            aria-label="Back"
            onClick={onReturnHome}
          >
            <ChevronLeft size={18} />
          </button>
        ) : null}
        <details className="module-title-select" ref={viewPickerRef}>
          <summary aria-label={`${moduleLabel} view`}>
            <span>{selectedView}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </summary>
          <div className="module-view-menu" role="listbox" aria-label={`${moduleLabel} views`}>
            {viewOptions.map((view) => (
              <button
                key={view}
                type="button"
                role="option"
                aria-selected={selectedView === view}
                className={selectedView === view ? "is-selected" : ""}
                onClick={() => {
                  if (activeModule === "accounts") {
                    onAccountsViewChange?.(view as "All Clients" | "Active Clients");
                  } else {
                    setInternalView(view);
                  }
                  viewPickerRef.current?.removeAttribute("open");
                }}
              >
                {view}
              </button>
            ))}
          </div>
        </details>
      </div>
      <div className="module-view-tabs-row">
        <nav className="module-view-tabs" aria-label={`${moduleLabel} views`}>
          {tabs.map((tab) => {
            const icon = useIconTabs ? MODULE_VIEW_TAB_ICONS[tab] : undefined;
            return (
              <button
                key={tab}
                type="button"
                className={`module-view-tab ${icon ? "is-icon-tab" : ""} ${tab === activeTab ? "is-active" : ""}`}
                onClick={() => setActiveTab(tab)}
                aria-label={icon ? tab : undefined}
                title={icon ? tab : undefined}
              >
                {icon ?? tab}
              </button>
            );
          })}
          {!useIconTabs ? (
            <button type="button" className="module-view-add" aria-label={`Add ${moduleLabel} view`}>
              <Plus size={16} />
            </button>
          ) : null}
          <button
            type="button"
            className={`module-view-filter-toggle ${filtersOpen ? "is-active" : ""}`}
            aria-label={filtersOpen ? "Hide filters" : "Show filters"}
            aria-pressed={filtersOpen}
            title={filtersOpen ? "Hide filters" : "Show filters"}
            onClick={toggleFilters}
          >
            <Filter size={15} />
          </button>
        </nav>
        <div className="module-view-actions" ref={setActionsHost} />
      </div>
    </header>
  );
}

function ModuleNavButton({
  module,
  active,
  onSelect,
}: {
  module: (typeof modules)[number];
  active: boolean;
  onSelect: (key: Exclude<ModuleKey, "home" | "reports">) => void;
}) {
  const tip = module.title && module.title !== module.label ? module.title : null;
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);

  return (
    <>
      <button
        type="button"
        className={`nav-item ${active ? "active" : ""}`}
        onMouseEnter={(event) => {
          if (!tip) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setTipPos({ top: rect.top + rect.height / 2, left: rect.right + 2 });
        }}
        onMouseLeave={() => setTipPos(null)}
        onClick={() => onSelect(module.key)}
      >
        {moduleIcons[module.key]}
        <span>{module.label}</span>
      </button>
      {tip && tipPos
        ? createPortal(
            <span
              className="nav-module-tooltip"
              role="tooltip"
              style={{ top: tipPos.top, left: tipPos.left }}
            >
              {tip}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}

function Sidebar({
  activeModule,
  expanded,
  width,
  onWidthChange,
  onChange,
  onToggle,
}: {
  activeModule: ModuleKey;
  expanded: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onChange: (module: ModuleKey) => void;
  onToggle: () => void;
}) {
  const [moduleQuery, setModuleQuery] = useState("");
  const [modulesOpen, setModulesOpen] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [handleY, setHandleY] = useState<number | null>(null);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const resizerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isRecordModule = modules.some((module) => module.key === activeModule);
  const filteredModules = modules.filter((module) => {
    const query = moduleQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      module.label.toLowerCase().includes(query) ||
      (module.title?.toLowerCase().includes(query) ?? false)
    );
  });

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!sidebarRef.current?.contains(event.target as Node)) {
        setModulesOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const next = Math.min(360, Math.max(148, drag.startWidth + (event.clientX - drag.startX)));
      onWidthChange(next);
    };

    const onUp = () => {
      dragRef.current = null;
      setResizing(false);
      setHandleY(null);
      document.body.classList.remove("is-sidebar-resizing");
    };

    document.body.classList.add("is-sidebar-resizing");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.body.classList.remove("is-sidebar-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizing, onWidthChange]);

  function selectModule(module: ModuleKey) {
    onChange(module);
    setModulesOpen(false);
  }

  function handleToggle() {
    setModulesOpen(false);
    onToggle();
  }

  return (
    <aside className={`sidebar ${expanded ? "is-expanded" : "is-collapsed"}`} ref={sidebarRef}>
      {expanded ? (
        <>
          <div className="brand-row">
            <div className="brand">
              <span className="brand-mark">
                <BrandMark size={28} />
              </span>
              <span>CRM</span>
            </div>
            <button
              className="sidebar-toggle"
              onClick={handleToggle}
              aria-label="Hide Menu"
              title="Hide Menu"
              type="button"
            >
              <SidebarToggleIcon size={25} />
            </button>
          </div>

          <div className="sidebar-scroll">
            <button className={`nav-item ${activeModule === "home" ? "active" : ""}`} onClick={() => selectModule("home")}>
              <HomeIcon size={22} />
              <span>Home</span>
            </button>
            <button
              className={`nav-item ${activeModule === "reports" ? "active" : ""}`}
              onClick={() => selectModule("reports")}
            >
              <ReportsIcon size={22} />
              <span>Reports</span>
            </button>

            <div className="nav-section">
              <div className="modules-heading">
                <ModulesIcon size={26} />
                <span>Modules</span>
              </div>
              <div className="nav-search-wrap">
                <Search size={14} />
                <input
                  className="nav-search"
                  placeholder="Search"
                  value={moduleQuery}
                  onChange={(event) => setModuleQuery(event.target.value)}
                />
              </div>
              {filteredModules.map((module) => (
                <ModuleNavButton
                  key={module.key}
                  module={module}
                  active={activeModule === module.key}
                  onSelect={selectModule}
                />
              ))}
            </div>
          </div>

          <div
            ref={resizerRef}
            className={`sidebar-resizer ${resizing ? "is-active" : ""}`}
            onMouseDown={(event) => {
              event.preventDefault();
              const rect = resizerRef.current?.getBoundingClientRect();
              const y = rect ? event.clientY - rect.top : event.clientY;
              dragRef.current = { startX: event.clientX, startWidth: width };
              setHandleY(y);
              setResizing(true);
            }}
            role="separator"
            aria-orientation="vertical"
            aria-valuenow={width}
            aria-valuemin={148}
            aria-valuemax={360}
            aria-label="Resize sidebar"
          >
            <span
              className="sidebar-resizer-handle"
              aria-hidden="true"
              style={handleY !== null ? { top: handleY } : undefined}
            />
          </div>
        </>
      ) : (
        <>
          <div className="rail-header">
            <span className="rail-brand-mark">
              <BrandMark size={28} />
            </span>
            <button
              className="sidebar-toggle rail-toggle"
              onClick={handleToggle}
              aria-label="Show Menu"
              type="button"
            >
              <SidebarToggleIcon size={25} />
              <span className="menu-tooltip">Show Menu</span>
            </button>
          </div>

          <button
            className={`rail-item ${activeModule === "home" ? "active" : ""}`}
            onClick={() => selectModule("home")}
          >
            <HomeIcon size={28} />
            <span>Home</span>
          </button>
          <button
            className={`rail-item ${activeModule === "reports" ? "active" : ""}`}
            onClick={() => selectModule("reports")}
          >
            <ReportsIcon size={28} />
            <span>Reports</span>
          </button>
          <div
            className="modules-rail-group"
            onMouseEnter={() => setModulesOpen(true)}
            onMouseLeave={() => setModulesOpen(false)}
          >
            <button
              className={`rail-item ${modulesOpen || isRecordModule ? "active modules-active" : ""}`}
              onClick={() => setModulesOpen(true)}
              type="button"
            >
              <span className="modules-icon-wrap">
                <ModulesIcon size={28} />
              </span>
              <span>Modules</span>
            </button>

            {modulesOpen && (
              <div className="modules-flyout">
                <div className="nav-search-wrap">
                  <Search size={14} />
                  <input
                    className="nav-search"
                    placeholder="Search"
                    value={moduleQuery}
                    onChange={(event) => setModuleQuery(event.target.value)}
                  />
                </div>
                {filteredModules.map((module) => (
                  <ModuleNavButton
                    key={module.key}
                    module={module}
                    active={activeModule === module.key}
                    onSelect={selectModule}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  );
}

function Topbar({
  user,
  appearanceMode,
  themeTone,
  accentKey,
  onAppearanceModeChange,
  onThemeToneChange,
  onAccentChange,
  onLogout,
  onRequestCreate,
  onOpenNotification,
}: {
  user: PublicUser;
  appearanceMode: AppearanceMode;
  themeTone: ThemeTone;
  accentKey: AccentKey;
  onAppearanceModeChange: (mode: AppearanceMode) => void;
  onThemeToneChange: (tone: ThemeTone) => void;
  onAccentChange: (accent: AccentKey) => void;
  onLogout: () => void;
  onRequestCreate: (module: ModuleKey) => void;
  onOpenNotification: (notification: AppNotification) => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [createQuery, setCreateQuery] = useState("");
  const [dismissedSignatures, setDismissedSignatures] = useState<string[]>([]);
  const [greetingDate, setGreetingDate] = useState(() => formatHomeDate());
  const [greetingTime, setGreetingTime] = useState(() => formatHomeTime());
  const profileRef = useRef<HTMLDivElement | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const pipelineSnapshot = useSyncExternalStore(
    subscribePipelineLoans,
    getPipelineLoansSnapshot,
    getPipelineLoansSnapshot,
  );

  const notifications = useMemo(
    () =>
      buildLoanNotifications(getAllPipelineLoans(pipelineSnapshot)).filter(
        (item) => !dismissedSignatures.includes(item.signature),
      ),
    [pipelineSnapshot, dismissedSignatures],
  );

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
      if (!createRef.current?.contains(event.target as Node)) {
        setCreateOpen(false);
      }
      if (!notificationsRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  // Setting the formatted strings lets React bail out on ticks that do not
  // change the visible label, so the second-level timer stays cheap.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = new Date();
      setGreetingDate(formatHomeDate(now));
      setGreetingTime(formatHomeTime(now));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const filteredCreateOptions = createRecordOptions.filter((option) =>
    option.label.toLowerCase().includes(createQuery.trim().toLowerCase()),
  );

  return (
    <header className="topbar">
      <div className="topbar-greeting">
        <span className="topbar-greeting-name">Hi {user.displayName}</span>
        <span className="topbar-greeting-date">{greetingDate}</span>
        <span className="topbar-greeting-time">{greetingTime}</span>
      </div>
      <div className="topbar-actions">
        <div className="create-menu-anchor" ref={createRef}>
          <button
            className={`create-button ${createOpen ? "active" : ""}`}
            aria-label="Create"
            aria-expanded={createOpen}
            onClick={() => {
              setCreateOpen((value) => {
                const next = !value;
                if (next) setCreateQuery("");
                return next;
              });
              setProfileOpen(false);
              setNotificationsOpen(false);
            }}
          >
            <Plus size={15} />
          </button>
          {createOpen && (
            <div className="create-records-panel">
              <div className="create-records-title">Create Records</div>
              <div className="create-records-search">
                <Search size={14} className="create-records-search-icon" />
                <input
                  className="create-records-search-input"
                  placeholder="Search"
                  value={createQuery}
                  onChange={(event) => setCreateQuery(event.target.value)}
                  autoFocus
                />
              </div>
              <div className="create-records-list">
                {filteredCreateOptions.length === 0 ? (
                  <p className="create-records-empty">No matches</p>
                ) : (
                  filteredCreateOptions.map((option) => (
                    <button
                      key={option.module}
                      type="button"
                      className="create-records-item"
                      onClick={() => {
                        onRequestCreate(option.module);
                        setCreateOpen(false);
                        setCreateQuery("");
                      }}
                    >
                      <Plus size={14} className="create-records-item-plus" />
                      <span>{option.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="notifications-anchor" ref={notificationsRef}>
          <button
            className={`notifications-button ${notificationsOpen ? "active" : ""}`}
            aria-label="Notifications"
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((value) => !value);
              setCreateOpen(false);
              setProfileOpen(false);
            }}
          >
            <Bell size={15} />
            {notifications.length > 0 ? (
              <span className="notifications-badge">
                {notifications.length > 9 ? "9+" : notifications.length}
              </span>
            ) : null}
          </button>
          {notificationsOpen && (
            <div className="notifications-panel">
              <div className="notifications-panel-header">
                <div>
                  <div className="notifications-panel-title">Notifications</div>
                  <p className="notifications-panel-subtitle">
                    Stale loans and overdue reviews
                  </p>
                </div>
                {notifications.length > 0 ? (
                  <button
                    type="button"
                    className="notifications-clear"
                    onClick={() =>
                      setDismissedSignatures((prev) => [
                        ...new Set([...prev, ...notifications.map((item) => item.signature)]),
                      ])
                    }
                  >
                    Clear all
                  </button>
                ) : null}
              </div>
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <p className="notifications-empty">You are all caught up.</p>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      type="button"
                      className={`notifications-item severity-${notification.severity}`}
                      onClick={() => {
                        onOpenNotification(notification);
                        setDismissedSignatures((prev) =>
                          prev.includes(notification.signature)
                            ? prev
                            : [...prev, notification.signature],
                        );
                        setNotificationsOpen(false);
                      }}
                    >
                      <span className="notifications-item-icon" aria-hidden>
                        {notification.type === "stale_loan" ? (
                          <Clock3 size={15} />
                        ) : (
                          <CircleAlert size={15} />
                        )}
                      </span>
                      <span className="notifications-item-copy">
                        <strong>{notification.title}</strong>
                        <span>{notification.body}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="profile-anchor" ref={profileRef}>
          <button
            className={`avatar-button ${profileOpen ? "active" : ""}`}
            aria-label="Account menu"
            onClick={() => {
              setProfileOpen((value) => !value);
              setCreateOpen(false);
              setNotificationsOpen(false);
            }}
          >
            <span className="avatar-initials">{getInitials(user.displayName)}</span>
          </button>
          {profileOpen && (
            <AccountPanel
              user={user}
              appearanceMode={appearanceMode}
              themeTone={themeTone}
              accentKey={accentKey}
              onAppearanceModeChange={onAppearanceModeChange}
              onThemeToneChange={onThemeToneChange}
              onAccentChange={onAccentChange}
              onClose={() => setProfileOpen(false)}
              onLogout={onLogout}
            />
          )}
        </div>
      </div>
    </header>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

function AccountPanel({
  user,
  appearanceMode,
  themeTone,
  accentKey,
  onAppearanceModeChange,
  onThemeToneChange,
  onAccentChange,
  onClose,
  onLogout,
}: {
  user: PublicUser;
  appearanceMode: AppearanceMode;
  themeTone: ThemeTone;
  accentKey: AccentKey;
  onAppearanceModeChange: (mode: AppearanceMode) => void;
  onThemeToneChange: (tone: ThemeTone) => void;
  onAccentChange: (accent: AccentKey) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <div className="account-panel">
      <button className="account-close" onClick={onClose} aria-label="Close">
        <X size={14} />
      </button>
      <div className="account-header">
        <div className="account-avatar">
          <span className="avatar-initials large">{getInitials(user.displayName)}</span>
        </div>
        <div>
          <strong>{user.displayName}</strong>
          <p>
            User Id: {user.id} <CircleHelp size={12} />
          </p>
          <div className="profile-meta">
            <span>BU: {user.bu}</span>
            <span>Role: {user.role}</span>
            <span>Outlook: {user.outlookEmail}</span>
          </div>
        </div>
      </div>

      <div className="account-settings">
        <div className="settings-block">
          <strong>Mode</strong>
          <div className="mode-toggle">
            <button
              className={appearanceMode === "day" ? "active" : ""}
              onClick={() => onAppearanceModeChange("day")}
            >
              <Sun size={14} /> Day
            </button>
            <button
              className={appearanceMode === "night" ? "active" : ""}
              onClick={() => onAppearanceModeChange("night")}
            >
              <Moon size={14} /> Night
            </button>
            <button
              className={appearanceMode === "auto" ? "active" : ""}
              onClick={() => onAppearanceModeChange("auto")}
            >
              <Monitor size={14} /> Auto <CircleHelp size={12} />
            </button>
          </div>
        </div>

        <div className="settings-block themes-block">
          <div className="themes-heading">
            <strong>Themes</strong>
            <div className="tone-options">
              <label className={themeTone === "dark" ? "active" : ""}>
                <input
                  type="radio"
                  name="theme-tone"
                  checked={themeTone === "dark"}
                  onChange={() => onThemeToneChange("dark")}
                />
                Dark
              </label>
              <label className={themeTone === "lite" ? "active" : ""}>
                <input
                  type="radio"
                  name="theme-tone"
                  checked={themeTone === "lite"}
                  onChange={() => onThemeToneChange("lite")}
                />
                Lite
              </label>
            </div>
          </div>
          <div className="accent-swatches">
            {accentColors.map((color) => (
              <button
                key={color.key}
                type="button"
                className={`accent-swatch ${relativeLuminance(color.value) > 0.6 ? "is-light" : ""} ${
                  accentKey === color.key ? "active" : ""
                }`}
                style={{ background: color.value }}
                data-label={color.label}
                aria-label={color.label}
                onClick={() => onAccentChange(color.key)}
              >
                {accentKey === color.key ? <Check size={12} /> : null}
                <span className="accent-tooltip">{color.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <button className="need-help">Need Help?</button>
      <button
        className="sign-out-button"
        type="button"
        onClick={() => {
          onClose();
          onLogout();
        }}
      >
        Sign Out
      </button>
    </div>
  );
}

function formatHomeDate(date = new Date()) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHomeTime(date = new Date()) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

type AttentionItem = {
  id: string;
  recordId: string;
  kind: "kyc" | "client" | "lead";
  title: string;
  detail: string;
  module: ModuleKey;
};

function buildAttentionItems(): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const account of accounts) {
    if (account.kycStatus === "Pending" || account.kycStatus === "In Progress" || account.kycStatus === "Expired") {
      items.push({
        id: `kyc-${account.id}`,
        recordId: account.id,
        kind: "kyc",
        title: account.companyName,
        detail: `KYC ${account.kycStatus} · ${account.clientStatus}`,
        module: "accounts",
      });
    }
  }

  for (const account of accounts) {
    if (account.rating !== "Hot" && account.rating !== "Warm") continue;
    if (account.kycStatus === "Pending" || account.kycStatus === "In Progress" || account.kycStatus === "Expired") {
      continue;
    }
    items.push({
      id: `client-${account.id}`,
      recordId: account.id,
      kind: "client",
      title: account.companyName,
      detail: `${account.rating} · ${account.segment ?? "Client"} · Follow up`,
      module: "accounts",
    });
  }

  for (const lead of leads) {
    if (lead.status !== "New" && lead.status !== "Contacted") continue;
    items.push({
      id: `lead-${lead.id}`,
      recordId: lead.id,
      kind: "lead",
      title: lead.name.replace(" (Sample)", ""),
      detail: `${lead.status} · ${lead.company}`,
      module: "leads",
    });
  }

  const kindOrder = { kyc: 0, lead: 1, client: 2 } as const;
  return items.sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind]);
}

function HomeDashboard({
  expandedPanel,
  onExpandedPanelChange,
  onNavigate,
  onOpenRecord,
}: {
  expandedPanel: HomePanelKey | null;
  onExpandedPanelChange: (panel: HomePanelKey | null) => void;
  onNavigate: (module: ModuleKey, options?: { returnTo?: "home"; tab?: string }) => void;
  onOpenRecord: (module: ModuleKey, recordId: string) => void;
}) {
  const [homeView, setHomeView] = useState<"dashboard" | "training">("dashboard");
  const attentionPanel = useHomePanel(expandedPanel === "attention", (next) =>
    onExpandedPanelChange(next ? "attention" : null),
  );
  const quickAccessPanel = useHomePanel(expandedPanel === "quickAccess", (next) =>
    onExpandedPanelChange(next ? "quickAccess" : null),
  );
  const attentionItems = useMemo(() => buildAttentionItems(), []);
  const quickAccessItems = useMemo(() => {
    const kycActions = accounts.filter(
      (account) =>
        account.kycStatus === "Pending" ||
        account.kycStatus === "In Progress" ||
        account.kycStatus === "Expired",
    ).length;
    const activeLeads = leads.filter(
      (lead) => lead.status === "New" || lead.status === "Contacted",
    ).length;
    const openTasks = tasks.filter((task) => task.status !== "Completed").length;

    const descriptions: Partial<Record<ModuleKey, string>> = {
      accounts: kycActions > 0 ? `${kycActions} KYC to review` : "Client records",
      contacts: `${contacts.length} contact records`,
      deals: `${deals.length} active loans`,
      tradeFinance: `${productPipelineData.tradeFinance.length} trade facilities`,
      paymentService: `${productPipelineData.paymentService.length} payment mandates`,
      sustainableFinance: `${productPipelineData.sustainableFinance.length} green facilities`,
      globalMarket: `${productPipelineData.globalMarket.length} market deals`,
      lifeInsurance: `${productPipelineData.lifeInsurance.length} insurance cases`,
      campaigns: "Campaign workspace",
      leads: activeLeads > 0 ? `${activeLeads} need follow-up` : "Lead records",
      tasks: openTasks > 0 ? `${openTasks} open tasks` : "Task list",
      meetings: `${meetings.length} scheduled`,
      calls: `${calls.length} call records`,
      documents: "Document library",
    };

    return modules.map((module) => ({
      ...module,
      description: descriptions[module.key] ?? "Open module",
    }));
  }, []);

  if (homeView === "training") {
    return <TrainingVideos onBack={() => setHomeView("dashboard")} />;
  }

  return (
    <div className="home-page">
      <div className="home-cross">
        <div className="home-cross-col home-cross-left">
          <HomePanelHost expanded={attentionPanel.expanded} onExit={attentionPanel.exit}>
            <section className={`home-quad home-quad-left${attentionPanel.modifier}`}>
              <div className="home-quad-head">
                <div className="home-quad-label">Needs attention</div>
                <div className="home-quad-actions">
                  <span className="home-quad-meta">
                    {attentionItems.length} items
                  </span>
                  <HomePanelExpandButton
                    expanded={attentionPanel.expanded}
                    label="Needs attention"
                    onToggle={attentionPanel.toggle}
                  />
                </div>
              </div>
              <div className="home-attention-list">
                {attentionItems.length === 0 ? (
                  <p className="muted">Nothing needs attention right now.</p>
                ) : (
                  attentionItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`home-attention-item is-${item.kind}`}
                      onClick={() => onOpenRecord(item.module, item.recordId)}
                    >
                      <span className="home-attention-kind">
                        {item.kind === "kyc" ? "KYC" : item.kind === "lead" ? "Lead" : "Client"}
                      </span>
                      <span className="home-attention-body">
                        <strong>{item.title}</strong>
                        <span className="muted">{item.detail}</span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            </section>
          </HomePanelHost>
          <HomeLoansClosing
            expanded={expandedPanel === "loans"}
            onExpandedChange={(next) => onExpandedPanelChange(next ? "loans" : null)}
            onNavigate={onNavigate}
            onOpenRecord={onOpenRecord}
          />
        </div>
        <div className="home-cross-col home-cross-right">
          <HomeCalendar
            expanded={expandedPanel === "calendar"}
            onExpandedChange={(next) => onExpandedPanelChange(next ? "calendar" : null)}
            onNavigate={onNavigate}
            onOpenRecord={onOpenRecord}
          />
          <HomePanelHost expanded={quickAccessPanel.expanded} onExit={quickAccessPanel.exit}>
            <section
              className={`home-quad home-quad-br home-quick-access${quickAccessPanel.modifier}`}
              aria-labelledby="home-quick-access-title"
            >
              <div className="home-quad-head">
                <div className="home-quad-label" id="home-quick-access-title">
                  Quick access
                </div>
                <div className="home-quad-actions">
                  <HomePanelExpandButton
                    expanded={quickAccessPanel.expanded}
                    label="Quick access"
                    onToggle={quickAccessPanel.toggle}
                  />
                </div>
              </div>
              <div className="home-quick-access-list">
                <button
                  className="home-quick-access-item is-training"
                  type="button"
                  title="Training · 8 video courses"
                  onClick={() => {
                    onExpandedPanelChange(null);
                    setHomeView("training");
                  }}
                >
                  <span className="home-quick-access-icon">
                    <Play size={18} strokeWidth={1.6} />
                  </span>
                  <span className="home-quick-access-text">
                    <span className="home-quick-access-label">Training</span>
                    {quickAccessPanel.expanded && (
                      <span className="home-quick-access-desc">8 video courses</span>
                    )}
                  </span>
                </button>
                {quickAccessItems.map((module) => (
                  <button
                    className="home-quick-access-item"
                    key={module.key}
                    title={`${module.title ?? module.label} · ${module.description}`}
                    onClick={() => onNavigate(module.key, { returnTo: "home" })}
                    type="button"
                  >
                    <span className="home-quick-access-icon">{moduleIcons[module.key]}</span>
                    <span className="home-quick-access-text">
                      <span className="home-quick-access-label">{module.label}</span>
                      {quickAccessPanel.expanded && (
                        <span className="home-quick-access-desc">{module.description}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </section>
          </HomePanelHost>
        </div>
      </div>
    </div>
  );
}

function QuickCreateModal({
  title,
  fields,
  initialValues,
  onClose,
  onSave,
}: {
  title: string;
  fields: QuickCreateField[];
  initialValues?: Record<string, string>;
  onClose: () => void;
  onSave: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const field of fields) {
      base[field.key] = initialValues?.[field.key] ?? (field.type === "select" ? (field.options?.[0] ?? "") : "");
    }
    return base;
  });

  function update(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card quick-create-modal" onClick={(event) => event.stopPropagation()}>
        <div className="page-header" style={{ marginBottom: 14 }}>
          <h2>{title}</h2>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div className="form-grid">
          {fields.map((field) => (
            <div className="form-row" key={field.key}>
              <label htmlFor={`qc-${field.key}`}>{field.label}</label>
              {field.type === "select" ? (
                <select
                  id={`qc-${field.key}`}
                  className="field"
                  value={values[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id={`qc-${field.key}`}
                  className="field"
                  type={field.type ?? "text"}
                  placeholder={field.placeholder ?? field.label}
                  value={values[field.key]}
                  onChange={(event) => update(field.key, event.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={() => onSave(values)}>
            Save
          </button>
        </div>
      </section>
    </div>
  );
}

const leadColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "name", header: "Lead Name", type: "text" },
  { key: "company", header: "Company", type: "text" },
  { key: "email", header: "Email", type: "email" },
  { key: "phone", header: "Phone", type: "phone" },
];

function getLeadCellValue(lead: Lead, key: string) {
  if (key === "name") return lead.name;
  if (key === "company") return lead.company;
  if (key === "email") return lead.email;
  if (key === "phone") return lead.phone;
  return "";
}


const LEAD_STATUS_OPTIONS: Lead["status"][] = ["New", "Contacted", "Qualified", "Converted"];

type LeadImportFieldKey = Exclude<keyof Lead, "id" | "tag">;

const LEAD_IMPORT_FIELDS: ImportFieldDef<LeadImportFieldKey>[] = [
  { key: "name", label: "Lead Name", required: true, sample: "Alex Chen" },
  { key: "company", label: "Company", sample: "Everbright Trading Ltd" },
  { key: "email", label: "Email", required: true, sample: "alex.chen@example.com" },
  { key: "phone", label: "Phone", sample: "+852 2500 1234" },
  { key: "owner", label: "Owner", sample: "Jenny" },
  { key: "status", label: "Status", options: LEAD_STATUS_OPTIONS, sample: "New" },
];

function createEmptyLead(): Lead {
  return {
    id: `lead-${Date.now()}`,
    name: "",
    company: "",
    email: "",
    phone: "",
    owner: "Jenny",
    status: "New",
  };
}

function exportLeads(rows: Lead[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`leads-export-${stamp}.csv`, LEAD_IMPORT_FIELDS, rows);
}

function ImportLeadsModal({
  existing,
  onClose,
  onImport,
}: {
  existing: Lead[];
  onClose: () => void;
  onImport: (created: Lead[], updated: Lead[]) => void;
}) {
  return (
    <ImportRecordsModal
      moduleLabel="Leads"
      recordLabel="Lead"
      fields={LEAD_IMPORT_FIELDS}
      matchKey="email"
      matchLabel="Email"
      existing={existing}
      getMatchValue={(lead) => lead.email}
      createEmpty={createEmptyLead}
      makeId={(index) => `lead-import-${Date.now()}-${index}`}
      templateFilename="leads-import-template.csv"
      onClose={onClose}
      onImport={onImport}
    />
  );
}

function LeadsWorkspace({
  detailTab,
  setDetailTab,
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  detailTab: "overview" | "timeline";
  setDetailTab: (tab: "overview" | "timeline") => void;
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState(() => [...leads]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [returnToHome, setReturnToHome] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing(null);
    setCreating(true);
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = rows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setCreating(false);
      setEditing({ ...record });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setCreating(false);
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  return (
    <>
      <RecordListShell
        title="All Leads"
        filters={leadFilters}
        data={rows}
        columns={leadColumns}
        getCellValue={getLeadCellValue}
        createLabel="Create Lead"
        importLabel="Import Leads"
        onCreate={() => {
          setEditing(null);
          setCreating(true);
          setReturnToHome(false);
        }}
        onImport={() => setImportOpen(true)}
        onExport={exportLeads}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((lead) => (
              <tr
                key={lead.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setCreating(false);
                  setEditing({ ...lead });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        <RowSelectCell
                          context={{
                            id: lead.id,
                            label: lead.name,
                            email: lead.email,
                            phone: lead.phone,
                            relatedTo: lead.company,
                          }}
                          onEdit={() => {
                            setCreating(false);
                            setEditing({ ...lead });
                            setReturnToHome(false);
                          }}
                          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== lead.id))}
                        />
                      </td>
                    );
                  }
                  if (column.key === "name") {
                    return (
                      <td key={column.key}>
                        {lead.tag && (
                          <span className={`row-tag ${lead.tag.includes("Jul") ? "green" : ""}`}>{lead.tag}</span>
                        )}
                        <a
                          href={`#lead-${lead.id}`}
                          onClick={(event) => {
                            event.preventDefault();
                            setCreating(false);
                            setEditing({ ...lead });
                            setReturnToHome(false);
                          }}
                        >
                          {lead.name}
                        </a>
                      </td>
                    );
                  }
                  if (column.key === "company") return <td key={column.key}>{lead.company}</td>;
                  if (column.key === "email") return <td key={column.key}>{lead.email}</td>;
                  if (column.key === "phone") return <td key={column.key}>{lead.phone}</td>;
                  return <td key={column.key} />;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      <LeadDetail detailTab={detailTab} setDetailTab={setDetailTab} />
      {importOpen ? (
        <ImportLeadsModal
          existing={rows}
          onClose={() => setImportOpen(false)}
          onImport={(created, updated) => {
            setRows((prev) => {
              const updatedById = new Map(updated.map((lead) => [lead.id, lead]));
              const merged = prev.map((lead) => updatedById.get(lead.id) ?? lead);
              return [...created, ...merged];
            });
          }}
        />
      ) : null}
      {creating || editing ? (
        <QuickCreateModal
          key={editing?.id ?? "create-lead"}
          title={editing ? "Edit Lead" : "Create Lead"}
          fields={[
            { key: "name", label: "Name" },
            { key: "company", label: "Company" },
            { key: "email", label: "Email", type: "email" },
            { key: "phone", label: "Phone", type: "tel" },
          ]}
          initialValues={
            editing
              ? {
                  name: editing.name,
                  company: editing.company,
                  email: editing.email,
                  phone: editing.phone,
                }
              : undefined
          }
          onClose={dismissForm}
          onSave={(values) => {
            if (editing) {
              setRows((prev) =>
                prev.map((item) =>
                  item.id === editing.id
                    ? {
                        ...item,
                        name: values.name.trim() || item.name,
                        company: values.company.trim(),
                        email: values.email.trim(),
                        phone: values.phone.trim(),
                      }
                    : item,
                ),
              );
            } else {
              setRows((prev) => [
                {
                  id: `lead-${Date.now()}`,
                  name: values.name.trim() || "Untitled Lead",
                  company: values.company.trim(),
                  email: values.email.trim(),
                  phone: values.phone.trim(),
                  owner: "Jenny",
                  status: "New",
                },
                ...prev,
              ]);
            }
            dismissForm();
          }}
        />
      ) : null}
    </>
  );
}

function LeadDetail({
  detailTab,
  setDetailTab,
}: {
  detailTab: "overview" | "timeline";
  setDetailTab: (tab: "overview" | "timeline") => void;
}) {
  return (
    <section className="detail-shell">
      <aside className="related-list">
        <strong>Related List</strong>
        {["Notes 2", "Attachments 2", "Open Activities", "Closed Activities", "Invited Meetings", "Emails", "Campaigns", "Social"].map((item) => (
          <a key={item}>{item}</a>
        ))}
      </aside>
      <div className="detail-content">
        <div className="page-header" style={{ marginBottom: 14 }}>
          <div>
            <p className="muted">Lead</p>
            <h2 className="page-title">rere - tetss</h2>
          </div>
          <div className="pill-tabs">
            <button className="primary-button">Send Email</button>
            <button className="secondary-button">Convert</button>
            <button className="secondary-button">Edit</button>
          </div>
        </div>
        <div className="pill-tabs" style={{ marginBottom: 14 }}>
          <button className={`pill ${detailTab === "overview" ? "active" : ""}`} onClick={() => setDetailTab("overview")}>
            Overview
          </button>
          <button className={`pill ${detailTab === "timeline" ? "active" : ""}`} onClick={() => setDetailTab("timeline")}>
            Timeline
          </button>
        </div>
        {detailTab === "overview" ? <LeadOverview /> : <LeadTimeline />}
      </div>
    </section>
  );
}

function LeadOverview() {
  return (
    <>
      <div className="related-card">
        <strong>Notes</strong>
        <input className="field" placeholder="Add a note" style={{ marginTop: 12 }} />
      </div>
      <div className="related-card">
        <div className="section-header" style={{ padding: 0 }}>
          <strong>Attachments</strong>
          <button className="secondary-button">Attach</button>
        </div>
        <p className="muted">No Attachment</p>
      </div>
      <div className="related-card">
        <div className="section-header" style={{ padding: 0 }}>
          <strong>Open Activities</strong>
          <button className="secondary-button">Add New</button>
        </div>
        <p className="muted">No records found</p>
      </div>
      <div className="related-card">
        <div className="section-header" style={{ padding: 0 }}>
          <strong>Emails</strong>
          <button className="secondary-button">Compose Email</button>
        </div>
        <div className="pill-tabs" style={{ marginTop: 12 }}>
          <span className="pill active">Mails</span>
          <span className="pill">Drafts</span>
          <span className="pill">Scheduled</span>
        </div>
      </div>
    </>
  );
}

function LeadTimeline() {
  return (
    <div className="related-card">
      <div className="section-header" style={{ padding: 0, marginBottom: 16 }}>
        <strong>Timeline History</strong>
        <button className="secondary-button">Show Upcoming Automated Actions</button>
      </div>
      <div className="timeline">
        {timeline.map((item) => (
          <div className="timeline-item" key={item.id}>
            <p className="muted">{item.time}</p>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDefaultColumnWidths(columns: ColumnDef[], dataWidth = 180) {
  return Object.fromEntries(
    columns.map((column) => [column.key, column.type === "checkbox" ? 72 : dataWidth]),
  ) as Record<string, number>;
}

function reorderColumns(columns: ColumnDef[], fromKey: string, toKey: string) {
  if (fromKey === toKey) return columns;
  const fromIndex = columns.findIndex((column) => column.key === fromKey);
  const toIndex = columns.findIndex((column) => column.key === toKey);
  if (fromIndex < 0 || toIndex < 0) return columns;
  if (columns[fromIndex]?.type === "checkbox" || columns[toIndex]?.type === "checkbox") return columns;
  const next = [...columns];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function SortIcon({ sort, columnKey }: { sort: SortState; columnKey: string }) {
  if (!sort || sort.key !== columnKey) return <ChevronDown size={13} />;
  if (sort.direction === "asc") return <ArrowUp size={13} />;
  return <ArrowDown size={13} />;
}

function ColumnFieldMenu({
  column,
  filter,
  sort,
  onFilterChange,
  onSortChange,
  onClose,
  anchorRect,
}: {
  column: ColumnDef;
  filter: ColumnFilter | undefined;
  sort: SortState;
  onFilterChange: (next: ColumnFilter | undefined) => void;
  onSortChange: (next: SortState) => void;
  onClose: () => void;
  anchorRect: DOMRect;
}) {
  const sortable = isColumnSortable(column);
  const filterable = isColumnFilterable(column);
  const operators = getFilterOperators(column.type);
  const draft = filter ?? createEmptyFilter(column.type);
  const op = draft.op;
  const needsValue = filterOpNeedsValue(op);
  const needsSecond = filterOpNeedsSecondValue(op);
  const sortedAsc = sort?.key === column.key && sort.direction === "asc";
  const sortedDesc = sort?.key === column.key && sort.direction === "desc";
  const menuWidth = column.type === "enum" ? 248 : 220;
  const left = Math.max(8, Math.min(anchorRect.left, window.innerWidth - menuWidth - 8));
  const top = Math.min(anchorRect.bottom + 4, window.innerHeight - 12);

  function setOp(nextOp: string) {
    const next = createEmptyFilter(column.type, nextOp);
    if (draft.kind === "text" && next.kind === "text") next.value = draft.value;
    if (draft.kind === "enum" && next.kind === "enum") next.values = draft.values;
    if (
      (draft.kind === "number" || draft.kind === "duration" || draft.kind === "date") &&
      (next.kind === "number" || next.kind === "duration" || next.kind === "date")
    ) {
      next.value = draft.value;
      next.valueTo = draft.valueTo ?? "";
    }
    onFilterChange(next);
  }

  const textValue = draft.kind === "text" ? draft.value : "";
  const enumValues = draft.kind === "enum" ? draft.values : [];
  const primaryValue =
    draft.kind === "number" || draft.kind === "duration" || draft.kind === "date" ? draft.value : "";
  const secondaryValue =
    draft.kind === "number" || draft.kind === "duration" || draft.kind === "date" ? (draft.valueTo ?? "") : "";

  return (
    <div
      className="th-field-menu"
      style={{ left, top, width: menuWidth }}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {sortable ? (
        <div className="th-field-sort-list">
          <button
            type="button"
            className={`th-field-sort-item ${sortedAsc ? "is-active" : ""}`}
            onClick={() => onSortChange(sortedAsc ? null : { key: column.key, direction: "asc" })}
          >
            <ArrowUp size={13} />
            Ascending
            {sortedAsc ? <Check size={13} className="th-field-check" /> : null}
          </button>
          <button
            type="button"
            className={`th-field-sort-item ${sortedDesc ? "is-active" : ""}`}
            onClick={() => onSortChange(sortedDesc ? null : { key: column.key, direction: "desc" })}
          >
            <ArrowDown size={13} />
            Descending
            {sortedDesc ? <Check size={13} className="th-field-check" /> : null}
          </button>
        </div>
      ) : null}

      {sortable && filterable ? <div className="th-field-menu-divider" /> : null}

      {filterable ? (
        <div className="th-field-filter">
          <select
            className="field th-field-op"
            value={op}
            onChange={(event) => setOp(event.target.value)}
            aria-label="Filter condition"
          >
            {operators.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          {(column.type === "text" || column.type === "email" || column.type === "phone" || column.type === "url") &&
            needsValue && (
              <input
                className="field"
                autoFocus
                value={textValue}
                placeholder="Enter value"
                onChange={(event) => {
                  onFilterChange({
                    kind: "text",
                    op: op as "contains" | "equals" | "starts_with" | "ends_with" | "is_empty" | "is_not_empty",
                    value: event.target.value,
                  });
                }}
              />
            )}

          {column.type === "enum" && op === "is_any_of" && (
            <div className="th-filter-enum">
              {(column.enumOptions ?? []).map((option) => {
                const checked = enumValues.includes(option);
                return (
                  <label className="th-filter-enum-item" key={option}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const values = checked
                          ? enumValues.filter((item) => item !== option)
                          : [...enumValues, option];
                        onFilterChange({ kind: "enum", op: "is_any_of", values });
                      }}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          )}

          {(column.type === "date" || column.type === "datetime") && needsValue && (
            <div className={needsSecond ? "th-filter-stack" : undefined}>
              <DateField
                value={primaryValue}
                onChange={(value) => {
                  onFilterChange({
                    kind: "date",
                    op: op as "on" | "before" | "after" | "between" | "is_empty" | "is_not_empty",
                    value,
                    valueTo: secondaryValue,
                  });
                }}
              />
              {needsSecond ? (
                <DateField
                  value={secondaryValue}
                  onChange={(valueTo) => {
                    onFilterChange({
                      kind: "date",
                      op: "between",
                      value: primaryValue,
                      valueTo,
                    });
                  }}
                />
              ) : null}
            </div>
          )}

          {column.type === "number" && needsValue && (
            <div className={needsSecond ? "th-filter-pair" : undefined}>
              <input
                className="field"
                type="number"
                placeholder={needsSecond ? "Min" : "Value"}
                value={primaryValue}
                onChange={(event) => {
                  onFilterChange({
                    kind: "number",
                    op: op as "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "is_empty" | "is_not_empty",
                    value: event.target.value,
                    valueTo: secondaryValue,
                  });
                }}
              />
              {needsSecond ? (
                <>
                  <span className="th-filter-pair-sep">–</span>
                  <input
                    className="field"
                    type="number"
                    placeholder="Max"
                    value={secondaryValue}
                    onChange={(event) => {
                      onFilterChange({
                        kind: "number",
                        op: "between",
                        value: primaryValue,
                        valueTo: event.target.value,
                      });
                    }}
                  />
                </>
              ) : null}
            </div>
          )}

          {column.type === "duration" && needsValue && (
            <div className={needsSecond ? "th-filter-pair" : undefined}>
              <input
                className="field"
                placeholder={needsSecond ? "Min" : "mm:ss"}
                value={primaryValue}
                onChange={(event) => {
                  onFilterChange({
                    kind: "duration",
                    op: op as "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "is_empty" | "is_not_empty",
                    value: event.target.value,
                    valueTo: secondaryValue,
                  });
                }}
              />
              {needsSecond ? (
                <>
                  <span className="th-filter-pair-sep">–</span>
                  <input
                    className="field"
                    placeholder="Max"
                    value={secondaryValue}
                    onChange={(event) => {
                      onFilterChange({
                        kind: "duration",
                        op: "between",
                        value: primaryValue,
                        valueTo: event.target.value,
                      });
                    }}
                  />
                </>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      <div className="th-filter-actions">
        <button
          type="button"
          className="th-field-clear"
          onClick={() => {
            onFilterChange(undefined);
            if (sort?.key === column.key) onSortChange(null);
            onClose();
          }}
        >
          Clear
        </button>
        <button type="button" className="th-field-done" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}

function ResizableTable({
  columns,
  children,
  dataWidth = 180,
  sort,
  filters,
  onSortChange,
  onFilterChange,
  onColumnsReorder,
}: {
  columns: ColumnDef[];
  children: React.ReactNode;
  dataWidth?: number;
  sort: SortState;
  filters: ColumnFilters;
  onSortChange: (next: SortState) => void;
  onFilterChange: (key: string, next: ColumnFilter | undefined) => void;
  onColumnsReorder: (next: ColumnDef[]) => void;
}) {
  const columnsIdentity = useMemo(
    () =>
      [...columns.map((column) => column.key)]
        .sort()
        .join("\0"),
    [columns],
  );
  const [widths, setWidths] = useState(() => getDefaultColumnWidths(columns, dataWidth));
  const [activeDivider, setActiveDivider] = useState<string | null>(null);
  const [resizingKey, setResizingKey] = useState<string | null>(null);
  const [openFilterKey, setOpenFilterKey] = useState<string | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<DOMRect | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dropKey, setDropKey] = useState<string | null>(null);
  const dragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const dragPointerXRef = useRef<number | null>(null);
  const autoScrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    setWidths((prev) => {
      const defaults = getDefaultColumnWidths(columns, dataWidth);
      const next: Record<string, number> = {};
      for (const column of columns) {
        next[column.key] = prev[column.key] ?? defaults[column.key];
      }
      return next;
    });
    setActiveDivider(null);
    setResizingKey(null);
    setOpenFilterKey(null);
    setFilterAnchor(null);
    setDragKey(null);
    setDropKey(null);
    dragRef.current = null;
  }, [columnsIdentity, dataWidth, columns]);

  useEffect(() => {
    if (!dragKey) return;

    const EDGE = 56;
    const MAX_SPEED = 28;

    document.body.classList.add("is-col-reordering");

    const onDragOver = (event: DragEvent) => {
      dragPointerXRef.current = event.clientX;
    };

    const tick = () => {
      const wrap = tableWrapRef.current;
      const x = dragPointerXRef.current;
      if (wrap && x !== null) {
        const rect = wrap.getBoundingClientRect();
        let delta = 0;
        if (x < rect.left + EDGE) {
          const intensity = Math.max(0, Math.min(1, 1 - (x - rect.left) / EDGE));
          delta = -Math.ceil(MAX_SPEED * intensity);
        } else if (x > rect.right - EDGE) {
          const intensity = Math.max(0, Math.min(1, 1 - (rect.right - x) / EDGE));
          delta = Math.ceil(MAX_SPEED * intensity);
        }
        if (delta !== 0) {
          wrap.scrollLeft += delta;
        }
      }
      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    document.addEventListener("dragover", onDragOver);
    autoScrollRafRef.current = requestAnimationFrame(tick);

    return () => {
      document.body.classList.remove("is-col-reordering");
      document.removeEventListener("dragover", onDragOver);
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
      dragPointerXRef.current = null;
    };
  }, [dragKey]);

  useEffect(() => {
    if (resizingKey === null) return;

    const onMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const column = columns.find((item) => item.key === drag.key);
      const minWidth = column?.type === "checkbox" ? 64 : 72;
      const nextWidth = Math.max(minWidth, drag.startWidth + (event.clientX - drag.startX));
      setWidths((prev) => {
        if (prev[drag.key] === nextWidth) return prev;
        return { ...prev, [drag.key]: nextWidth };
      });
    };

    const onUp = () => {
      dragRef.current = null;
      setResizingKey(null);
      setActiveDivider(null);
      document.body.classList.remove("is-col-resizing");
    };

    document.body.classList.add("is-col-resizing");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.body.classList.remove("is-col-resizing");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [resizingKey, columns]);

  useEffect(() => {
    if (!openFilterKey) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(".th-field-menu") || target.closest(".th-field-btn")) return;
      setOpenFilterKey(null);
      setFilterAnchor(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFilterKey(null);
        setFilterAnchor(null);
      }
    };
    const onReposition = () => {
      setOpenFilterKey(null);
      setFilterAnchor(null);
    };
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
  }, [openFilterKey]);

  const tableWidth = columns.reduce((sum, column) => sum + (widths[column.key] ?? dataWidth), 0);
  const resizingIndex = resizingKey === null ? -1 : columns.findIndex((column) => column.key === resizingKey);
  const guideLeft =
    resizingIndex < 0
      ? 0
      : columns
          .slice(0, resizingIndex + 1)
          .reduce((sum, column) => sum + (widths[column.key] ?? dataWidth), 0);

  const renderColgroup = () => (
    <colgroup>
      {columns.map((column) => (
        <col key={column.key} style={{ width: widths[column.key] ?? dataWidth }} />
      ))}
    </colgroup>
  );

  return (
    <div
      className={`table-wrap ${resizingKey !== null ? "is-resizing-cols" : ""} ${dragKey ? "is-reordering-cols" : ""}`}
    >
      <div
        ref={tableWrapRef}
        className="table-x-scroll"
        onScroll={(event) => {
          event.currentTarget.style.setProperty("--table-scroll-left", `${event.currentTarget.scrollLeft}px`);
        }}
      >
        <div className="table-resize-plane" style={{ width: tableWidth, minWidth: tableWidth }}>
          <table className="list-table list-table-header" style={{ width: tableWidth, minWidth: tableWidth }}>
            {renderColgroup()}
            <thead>
              <tr>
                {columns.map((column, index) => {
                  const sortable = isColumnSortable(column);
                  const filterable = isColumnFilterable(column);
                  const filterActive = hasActiveFilter(filters[column.key]);
                  const sorted = sort?.key === column.key;
                  const canReorder = column.type !== "checkbox";
                  const width = widths[column.key] ?? dataWidth;
                  const filterOpen = openFilterKey === column.key;

                  return (
                    <th
                      key={column.key}
                      style={{ width }}
                      className={[
                        column.type === "checkbox" ? "is-checkbox-col" : "",
                        dropKey === column.key && dragKey && dragKey !== column.key ? "is-col-drop-target" : "",
                        dragKey === column.key ? "is-col-dragging" : "",
                        filterOpen ? "is-filter-open" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDragOver={(event) => {
                        if (!canReorder || !dragKey || dragKey === column.key) return;
                        event.preventDefault();
                        setDropKey(column.key);
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!dragKey) return;
                        onColumnsReorder(reorderColumns(columns, dragKey, column.key));
                        setDragKey(null);
                        setDropKey(null);
                      }}
                      onDragLeave={() => {
                        if (dropKey === column.key) setDropKey(null);
                      }}
                    >
                      {column.type === "checkbox" ? (
                        <HeaderSelectCheckbox />
                      ) : (
                        <div className="th-content">
                          <span
                            className="th-drag-handle"
                            draggable
                            title="Drag to reorder column"
                            onDragStart={(event) => {
                              setDragKey(column.key);
                              setDropKey(null);
                              dragPointerXRef.current = event.clientX;
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", column.key);
                            }}
                            onDragEnd={() => {
                              setDragKey(null);
                              setDropKey(null);
                              dragPointerXRef.current = null;
                            }}
                          >
                            <GripVertical size={12} />
                          </span>
                          <button
                            type="button"
                            className={`th-field-btn ${sorted || filterActive || filterOpen ? "is-active" : ""}`}
                            aria-label={`${column.header} field options`}
                            aria-expanded={filterOpen}
                            title={`Sort and filter ${column.header}`}
                            onClick={(event) => {
                              if (!sortable && !filterable) return;
                              event.stopPropagation();
                              const button = event.currentTarget;
                              setOpenFilterKey((current) => {
                                if (current === column.key) {
                                  setFilterAnchor(null);
                                  return null;
                                }
                                setFilterAnchor(button.getBoundingClientRect());
                                return column.key;
                              });
                            }}
                            disabled={!sortable && !filterable}
                          >
                            <span className="th-label">{column.header}</span>
                            {filterActive ? <span className="th-filter-dot" aria-hidden /> : null}
                            <span className={`th-sort-icon ${sorted || filterOpen ? "is-active" : ""}`}>
                              <SortIcon sort={sort} columnKey={column.key} />
                            </span>
                          </button>
                        </div>
                      )}
                      <span
                        className={`col-resizer ${index === columns.length - 1 ? "is-last" : ""} ${activeDivider === column.key || resizingKey === column.key ? "is-active" : ""}`}
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          dragRef.current = {
                            key: column.key,
                            startX: event.clientX,
                            startWidth: width,
                          };
                          setResizingKey(column.key);
                          setActiveDivider(column.key);
                        }}
                        onMouseEnter={() => setActiveDivider(column.key)}
                        onMouseLeave={() => {
                          if (resizingKey === null) setActiveDivider(null);
                        }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
          </table>
          <div className="table-body-scroll">
            <table className="list-table list-table-body" style={{ width: tableWidth, minWidth: tableWidth }}>
              {renderColgroup()}
              {children}
            </table>
          </div>
          {resizingKey !== null ? <div className="col-resize-guide" style={{ left: guideLeft }} /> : null}
        </div>
      </div>
      {openFilterKey && filterAnchor
        ? (() => {
            const filterColumn = columns.find((column) => column.key === openFilterKey);
            if (!filterColumn) return null;
            return createPortal(
              <ColumnFieldMenu
                column={filterColumn}
                filter={filters[openFilterKey]}
                sort={sort}
                anchorRect={filterAnchor}
                onFilterChange={(next) => onFilterChange(openFilterKey, next)}
                onSortChange={onSortChange}
                onClose={() => {
                  setOpenFilterKey(null);
                  setFilterAnchor(null);
                }}
              />,
              document.body,
            );
          })()
        : null}
    </div>
  );
}

/** Split create button: primary action plus a caret menu for bulk import. */
function ListCreateButton({
  createLabel,
  importLabel,
  onCreate,
  onImport,
}: {
  createLabel: string;
  importLabel?: string;
  onCreate?: () => void;
  onImport?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="list-create-split" ref={menuRef}>
      <button
        className="list-create-main"
        type="button"
        onClick={onCreate}
        aria-label={createLabel}
      >
        + New
      </button>
      <button
        className={`list-create-caret ${menuOpen ? "active" : ""}`}
        type="button"
        aria-label={`More ${createLabel} options`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <ChevronDown size={14} />
      </button>
      {menuOpen ? (
        <div className="list-create-menu" role="menu">
          <button
            className="list-create-menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              onImport?.();
            }}
          >
            {importLabel}
            <Sparkles className="list-create-menu-sparkle" size={14} />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RecordListShell<T extends { id: string }>({
  title,
  filters,
  columns,
  data,
  getCellValue,
  renderRows,
  onCreate,
  createLabel,
  importLabel,
  onImport,
  onExport,
}: {
  title: string;
  filters: string[];
  columns: ColumnDef[];
  data: T[];
  getCellValue: (row: T, key: string) => string | number;
  renderRows: (rows: T[], orderedColumns: ColumnDef[]) => React.ReactNode;
  onCreate?: () => void;
  /** When set, replaces the plain "+ New" button with a split create button. */
  createLabel?: string;
  importLabel?: string;
  onImport?: () => void;
  /** Receives the rows currently visible in the table, after sort and filters. */
  onExport?: (rows: T[]) => void;
}) {
  const columnsIdentity = useMemo(
    () =>
      [...columns.map((column) => column.key)]
        .sort()
        .join("\0"),
    [columns],
  );
  const [orderedColumns, setOrderedColumns] = useState(columns);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortState>(null);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [page, setPage] = useState(1);
  const pageSize = 50;

  useEffect(() => {
    setOrderedColumns(columns);
  }, [columnsIdentity, columns]);

  const visibleRows = useMemo(
    () => applyColumnSortFilter(data, orderedColumns, sort, columnFilters, getCellValue),
    [data, orderedColumns, sort, columnFilters, getCellValue],
  );

  const total = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const pageEnd = Math.min(total, currentPage * pageSize);
  const pagedRows = useMemo(
    () => visibleRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [visibleRows, currentPage, pageSize],
  );
  const pageIds = useMemo(() => pagedRows.map((row) => row.id), [pagedRows]);
  const allIds = useMemo(() => data.map((row) => row.id), [data]);
  useEffect(() => {
    setPage(1);
  }, [sort, columnFilters, data]);

  const actionsHost = useContext(ModuleViewActionsHostContext);
  const { filtersOpen } = useContext(ModuleFilterPanelContext);

  function handleRefresh() {
    if (refreshing) return;
    setRefreshing(true);
    window.setTimeout(() => setRefreshing(false), 3000);
  }

  const listActions = (
    <>
      {createLabel ? (
        <ListCreateButton
          createLabel={createLabel}
          importLabel={importLabel}
          onCreate={onCreate}
          onImport={onImport}
        />
      ) : (
        <button className="list-new-button" type="button" onClick={onCreate}>
          + New
        </button>
      )}
      {onExport ? (
        <button
          className="secondary-button"
          type="button"
          onClick={() => onExport(visibleRows)}
          disabled={visibleRows.length === 0}
          title={`Export ${visibleRows.length} record${visibleRows.length === 1 ? "" : "s"} as CSV`}
        >
          <Download size={15} />
          Export
        </button>
      ) : null}
      <button
        className={`icon-button ${refreshing ? "is-refreshing" : ""}`}
        aria-label="Refresh"
        onClick={handleRefresh}
        disabled={refreshing}
      >
        <RefreshCcw size={16} />
      </button>
      <button className="icon-button" aria-label="More actions">
        <MoreHorizontal size={16} />
      </button>
    </>
  );

  return (
    <div className={`record-layout ${filtersOpen ? "" : "is-filters-hidden"}`}>
      {filtersOpen ? (
        <FilterPanel title={`Filter ${title.replace("All ", "")} by`} filters={filters} />
      ) : null}
      <section className="list-shell">
        {actionsHost
          ? createPortal(listActions, actionsHost)
          : (
            <div className="list-actions">{listActions}</div>
          )}
        <div className="list-shell-body">
          <RowSelectionProvider pageIds={pageIds} allIds={allIds}>
            <ResizableTable
              columns={orderedColumns}
              sort={sort}
              filters={columnFilters}
              onSortChange={setSort}
              onColumnsReorder={setOrderedColumns}
              onFilterChange={(key, next) => {
                setColumnFilters((prev) => {
                  const copy = { ...prev };
                  if (!next) delete copy[key];
                  else copy[key] = next;
                  return copy;
                });
              }}
            >
              {renderRows(pagedRows, orderedColumns)}
            </ResizableTable>
          </RowSelectionProvider>
          {refreshing ? (
            <div className="logo-loading-overlay" role="status" aria-live="polite" aria-label="Loading">
              <LogoDrawLoader />
            </div>
          ) : null}
        </div>
        <div className="footer-row">
          <span className="pagination-total">
            Total Records <strong>{total}</strong>
          </span>
          <div className="pagination-nav" role="navigation" aria-label="Pagination">
            <button
              type="button"
              className="pagination-nav-btn"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="pagination-range" aria-live="polite">
              <strong>{pageStart}</strong>
              <span> to </span>
              <strong>{pageEnd}</strong>
            </span>
            <button
              type="button"
              className="pagination-nav-btn"
              aria-label="Next page"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function FilterPanel({ title, filters }: { title: string; filters: string[] }) {
  return (
    <aside className="filter-panel">
      <strong>{title}</strong>
      <input className="filter-search" placeholder="Search" style={{ marginTop: 12 }} />
      <div className="filter-group">
        <strong>System Defined Filters</strong>
        {systemFilters.map((filter) => (
          <label className="filter-option" key={filter}>
            <input type="checkbox" /> {filter}
          </label>
        ))}
      </div>
      <div className="filter-group">
        <strong>Filter By Fields</strong>
        {filters.map((filter) => (
          <label className="filter-option" key={filter}>
            <input type="checkbox" /> {filter}
          </label>
        ))}
      </div>
    </aside>
  );
}

const ACCOUNT_STATUS_OPTIONS: AccountStatus[] = ["Active", "Inactive"];
const CLIENT_STATUS_OPTIONS: ClientStatus[] = ["ETB", "NTB", "NNTB"];
const PRIMARY_ID_TYPE_OPTIONS: PrimaryIdType[] = ["BR Number", "Type X", "C Number"];
const INDUSTRY_OPTIONS: ClientIndustry[] = [
  "Banking & Financial Services",
  "Manufacturing",
  "Technology",
  "Healthcare",
  "Retail & Consumer",
  "Real Estate",
  "Energy & Resources",
  "Professional Services",
  "Transportation & Logistics",
  "Telecommunications",
];
const RATING_OPTIONS: ClientRating[] = ["Hot", "Warm", "Cold"];
const SEGMENT_OPTIONS: ClientSegment[] = ["Corporate", "Commercial", "SME", "Private Banking"];
const RISK_RATING_OPTIONS: ClientRiskRating[] = ["Low", "Medium", "High"];
const KYC_STATUS_OPTIONS: ClientKycStatus[] = ["Pending", "In Progress", "Approved", "Expired"];
const REGION_OPTIONS: ClientRegion[] = [
  "Hong Kong",
  "Singapore",
  "Mainland China",
  "Asia Pacific",
  "Europe",
  "Americas",
];
const LEGAL_ENTITY_OPTIONS: LegalEntityType[] = [
  "Limited Company",
  "Partnership",
  "Sole Proprietor",
  "Listed Company",
  "Branch",
];
const PRODUCT_INTEREST_OPTIONS: ClientProductInterest[] = [
  "Loans",
  "Trade Finance",
  "Payments",
  "Cash Management",
  "FX / Global Markets",
  "Sustainable Finance",
  "Life Insurance",
  "Wealth Management",
];
const CLIENT_CHANNEL_OPTIONS: ContactPreferredChannel[] = [
  "Email",
  "Phone",
  "Mobile",
  "In-Person",
  "WeChat / Instant Message",
];
const YES_NO_OPTIONS = ["Yes", "No"] as const;

function optionSlug(option: string) {
  return option
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Full-cell single-select fill props for list/view tables. */
function getEnumFillProps(column: ColumnDef, value: string | null | undefined) {
  const color = resolveOptionColor(column.colorGroup, value, column.enumOptions, column.optionColors);
  const empty = value == null || value === "";
  return {
    className: empty ? "is-enum-fill is-enum-empty" : "is-enum-fill",
    style: {
      ["--enum-bg" as string]: color.bg,
      ["--enum-fg" as string]: color.fg,
    },
    label: empty ? "" : String(value),
  };
}

function EnumFillTd({
  column,
  value,
}: {
  column: ColumnDef;
  value: string | null | undefined;
}) {
  const fill = getEnumFillProps(column, value);
  return (
    <td className={fill.className} style={fill.style}>
      {fill.label ? <span className="enum-pill">{fill.label}</span> : null}
    </td>
  );
}

/** Theme-aware Risk Rating cell — shares colors with the form color bar. */
function RiskRatingTd({ value }: { value: string | null | undefined }) {
  const empty = value == null || value === "";
  if (empty) {
    return <td className="is-enum-fill is-enum-empty client-meta-risk-none" />;
  }
  return (
    <td className={`is-enum-fill client-meta-risk-${optionSlug(String(value))}`}>
      <span className="enum-pill">{value}</span>
    </td>
  );
}

/** Stage-style Client Status cell. */
function ClientStatusTd({ value }: { value: string | null | undefined }) {
  const empty = value == null || value === "";
  if (empty) {
    return <td className="is-enum-fill is-enum-empty" />;
  }
  return (
    <td className={`is-enum-fill client-meta-status-${optionSlug(String(value))}`}>
      <span className="enum-pill">{value}</span>
    </td>
  );
}

/** Stage-style KYC Status cell. */
function KycStatusTd({ value }: { value: string | null | undefined }) {
  const empty = value == null || value === "";
  if (empty) {
    return <td className="is-enum-fill is-enum-empty" />;
  }
  return (
    <td className={`is-enum-fill client-meta-kyc-${optionSlug(String(value))}`}>
      <span className="enum-pill">{value}</span>
    </td>
  );
}

/** Stage-style Account Status cell (Active / Inactive). */
function AccountStatusTd({ value }: { value: string | null | undefined }) {
  const empty = value == null || value === "";
  if (empty) {
    return <td className="is-enum-fill is-enum-empty" />;
  }
  return (
    <td className={`is-enum-fill client-meta-account-${optionSlug(String(value))}`}>
      <span className="enum-pill">{value}</span>
    </td>
  );
}

const accountColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "companyName", header: "Company Name", type: "text" },
  {
    key: "riskRating",
    header: "Risk Rating",
    type: "enum",
    enumOptions: [...RISK_RATING_OPTIONS],
    // Semantic colors via CSS (client-meta-risk-*) — matches form and follows theme
    colorable: false,
  },
  {
    key: "primaryIdType",
    header: "Primary ID Type",
    type: "enum",
    enumOptions: [...PRIMARY_ID_TYPE_OPTIONS],
    colorable: false,
  },
  { key: "primaryIdNumber", header: "Primary ID Number", type: "text" },
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: [...ACCOUNT_STATUS_OPTIONS],
    colorable: false,
  },
  {
    key: "clientStatus",
    header: "Client Status",
    type: "enum",
    enumOptions: [...CLIENT_STATUS_OPTIONS],
    // Soft cool palette via CSS (client-meta-status-*) — distinct from Risk / KYC
    colorable: false,
  },
  {
    key: "segment",
    header: "Segment",
    type: "enum",
    enumOptions: [...SEGMENT_OPTIONS],
    colorable: false,
  },
  { key: "relationshipManager", header: "Relationship Manager", type: "text" },
  {
    key: "productsOfInterest",
    header: "Products of Interest",
    type: "text",
  },
  {
    key: "preferredChannels",
    header: "Preferred Channels",
    type: "text",
  },
  { key: "phone", header: "Company Phone 1", type: "phone" },
  { key: "phone2", header: "Company Phone 2", type: "phone" },
  { key: "email", header: "Company Email", type: "email" },
  { key: "sicCode", header: "SIC Code", type: "text" },
  {
    key: "industry",
    header: "Industry Name",
    type: "enum",
    enumOptions: [...INDUSTRY_OPTIONS],
    colorable: false,
  },
  {
    key: "creIndicator",
    header: "CRE Indicator",
    type: "enum",
    enumOptions: [...YES_NO_OPTIONS],
    colorable: false,
  },
  { key: "countryRegionCampaignCode", header: "Country/Region/Campaign Code", type: "text" },
  { key: "referralDate", header: "Referral Date", type: "date" },
  {
    key: "existingClientReferral",
    header: "Existing Client Referral",
    type: "enum",
    enumOptions: [...YES_NO_OPTIONS],
    colorable: false,
  },
  { key: "hacnBuddyingRegionBranch", header: "HACN Buddying Region/Branch", type: "text" },
  {
    key: "rating",
    header: "Rating",
    type: "enum",
    enumOptions: [...RATING_OPTIONS],
    colorable: false,
  },
  {
    key: "kycStatus",
    header: "KYC Status",
    type: "enum",
    enumOptions: [...KYC_STATUS_OPTIONS],
    // Soft process palette via CSS (client-meta-kyc-*) — distinct from Risk / Client Status
    colorable: false,
  },
  {
    key: "region",
    header: "Region",
    type: "enum",
    enumOptions: [...REGION_OPTIONS],
    colorable: false,
  },
  {
    key: "legalEntityType",
    header: "Legal Entity",
    type: "enum",
    enumOptions: [...LEGAL_ENTITY_OPTIONS],
    colorable: false,
  },
  { key: "country", header: "Country", type: "text" },
  { key: "city", header: "City", type: "text" },
  { key: "annualRevenue", header: "Annual Revenue", type: "text" },
  { key: "creditLimit", header: "Credit Limit", type: "text" },
  { key: "employeeCount", header: "Employees", type: "text" },
  { key: "clientSince", header: "Client Since", type: "date" },
  { key: "parentGroup", header: "Parent Group", type: "text" },
  { key: "website", header: "Website", type: "url" },
];

function getAccountCellValue(account: Account, key: string) {
  const value = account[key as keyof Account];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function createEmptyAccount(): Account {
  return {
    id: `acc-${Date.now()}`,
    companyName: "",
    status: "Active",
    clientStatus: "ETB",
    relationshipManager: "",
    phone: "",
    phone2: "",
    email: "",
    website: "",
    sicCode: "",
    industry: null,
    creIndicator: null,
    countryRegionCampaignCode: "",
    referralDate: "",
    existingClientReferral: null,
    hacnBuddyingRegionBranch: "",
    rating: null,
    segment: null,
    riskRating: null,
    kycStatus: null,
    region: null,
    legalEntityType: null,
    country: "",
    city: "",
    address: "",
    annualRevenue: "",
    employeeCount: "",
    creditLimit: "",
    clientSince: "",
    parentGroup: "",
    primaryIdType: null,
    primaryIdNumber: "",
    productsOfInterest: [],
    preferredChannels: [],
  };
}

function yesNoValue(value: boolean | null): "Yes" | "No" | null {
  if (value === null) return null;
  return value ? "Yes" : "No";
}

function parseYesNo(value: "Yes" | "No" | null): boolean | null {
  if (value === null) return null;
  return value === "Yes";
}

function primaryIdTypeClass(type: PrimaryIdType) {
  if (type === "BR Number") return "br-number";
  if (type === "Type X") return "type-x";
  return "c-number";
}

type ClientFormDraft = Omit<
  Account,
  | "status"
  | "clientStatus"
  | "primaryIdType"
  | "industry"
  | "rating"
  | "segment"
  | "riskRating"
  | "kycStatus"
  | "region"
  | "legalEntityType"
> & {
  status: AccountStatus | null;
  clientStatus: ClientStatus | null;
  primaryIdType: PrimaryIdType | null;
  industry: ClientIndustry | null;
  rating: ClientRating | null;
  segment: ClientSegment | null;
  riskRating: ClientRiskRating | null;
  kycStatus: ClientKycStatus | null;
  region: ClientRegion | null;
  legalEntityType: LegalEntityType | null;
};

function toggleChoice<T>(current: T | null, next: T): T | null {
  return current === next ? null : next;
}

function RiskRatingField({
  value,
  onChange,
  invalid = false,
}: {
  value: ClientRiskRating | null;
  onChange: (value: ClientRiskRating | null) => void;
  invalid?: boolean;
}) {
  return (
    <div
      className={`risk-rating-bar ${invalid ? "is-invalid" : ""}`}
      role="radiogroup"
      aria-label="Risk Rating"
      aria-invalid={invalid}
    >
      {RISK_RATING_OPTIONS.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option}
            className={`risk-rating-segment client-meta-risk-${optionSlug(option)} ${selected ? "is-selected" : ""}`}
            onClick={() => onChange(toggleChoice(value, option))}
          >
            {selected ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
            <span className="risk-rating-tooltip" role="tooltip">
              {option}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        aria-label="-None-"
        className={`risk-rating-segment risk-rating-segment-none ${value === null ? "is-selected" : ""}`}
        onClick={() => onChange(null)}
      >
        {value === null ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
        <span className="risk-rating-tooltip" role="tooltip">
          -None-
        </span>
      </button>
    </div>
  );
}

type ChoiceDisplayMode = "collapsed" | "expanded";

function ChoiceField<T extends string>({
  name,
  options,
  value,
  onChange,
  ariaLabel,
  invalid = false,
  allowClear = true,
  placeholder = "-None-",
  getOptionClass,
  groupClassName = "",
  variant = "default",
}: {
  name: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  ariaLabel: string;
  invalid?: boolean;
  allowClear?: boolean;
  placeholder?: string;
  getOptionClass?: (option: T) => string;
  groupClassName?: string;
  variant?: "default" | "labels";
}) {
  const [mode, setMode] = useState<ChoiceDisplayMode>("collapsed");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setFilter("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) filterInputRef.current?.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [filter, options]);

  function selectOption(option: T | null) {
    onChange(option);
    setOpen(false);
    setFilter("");
  }

  function optionClass(option: T) {
    return getOptionClass?.(option) ?? "";
  }

  return (
    <div
      className={`choice-field ${variant === "labels" ? "is-label-menu" : ""} ${invalid ? "is-invalid" : ""}`}
      ref={rootRef}
    >
      {mode === "collapsed" ? (
        <div className={`choice-select ${open ? "is-open" : ""} ${invalid ? "is-invalid" : ""}`}>
          <div className="choice-select-control">
            {variant === "default" ? (
              <button
                type="button"
                className="choice-mode-toggle"
                aria-pressed={false}
                title="Expand options"
                onClick={() => {
                  setMode("expanded");
                  setOpen(false);
                  setFilter("");
                }}
              >
                <LayoutGrid size={13} />
              </button>
            ) : null}
            <button
              type="button"
              className="choice-select-trigger field"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={ariaLabel}
              aria-invalid={invalid}
              onClick={() => setOpen((prev) => !prev)}
            >
              {value ? (
                <span className={`choice-select-value ${optionClass(value)}`}>
                  <span className="choice-chip-label">{value}</span>
                </span>
              ) : (
                <span className="choice-select-placeholder">{placeholder}</span>
              )}
              <ChevronDown size={14} />
            </button>
          </div>
          {open ? (
            <div className="choice-select-menu" role="listbox" aria-label={ariaLabel}>
              {variant === "default" ? (
                <div className="choice-select-filter">
                  <Search size={13} />
                  <input
                    ref={filterInputRef}
                    value={filter}
                    placeholder="Filter options"
                    aria-label={`Filter ${ariaLabel}`}
                    onChange={(event) => setFilter(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              ) : null}
              <div className="choice-select-options">
                {allowClear ? (
                  <button
                    type="button"
                    className={`choice-select-option choice-select-clear ${value === null ? "is-selected" : ""}`}
                    role="option"
                    aria-selected={value === null}
                    onClick={() => selectOption(null)}
                  >
                    {placeholder}
                  </button>
                ) : null}
                {filteredOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`choice-select-option ${optionClass(option)} ${value === option ? "is-selected" : ""}`}
                    role="option"
                    aria-selected={value === option}
                    onClick={() => selectOption(option)}
                  >
                    <span className="choice-chip-check" aria-hidden="true">
                      <Check size={12} strokeWidth={2.5} />
                    </span>
                    <span className="choice-chip-label">{option}</span>
                  </button>
                ))}
                {filteredOptions.length === 0 ? (
                  <p className="choice-select-empty">No matching options</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="choice-expanded">
          <button
            type="button"
            className="choice-mode-toggle"
            aria-pressed={true}
            title="Merge into dropdown"
            onClick={() => {
              setMode("collapsed");
              setOpen(false);
              setFilter("");
            }}
          >
            <List size={13} />
          </button>
          <div
            className={`choice-group ${groupClassName} ${invalid ? "is-invalid" : ""}`}
            role="radiogroup"
            aria-label={ariaLabel}
            aria-invalid={invalid}
          >
            {options.map((option) => (
              <label
                key={option}
                className={`choice-chip ${optionClass(option)} ${value === option ? "is-selected" : ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  onChange(allowClear ? toggleChoice(value, option) : option);
                }}
              >
                <input type="radio" name={name} value={option} checked={value === option} readOnly tabIndex={-1} />
                <span className="choice-chip-check" aria-hidden="true">
                  <Check size={12} strokeWidth={2.5} />
                </span>
                <span className="choice-chip-label">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Searchable multi-select with removable chips — keeps the menu open while toggling. */
function MultiChoiceField<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  placeholder = "Select…",
  searchPlaceholder = "Search options",
}: {
  options: readonly T[];
  value: readonly T[];
  onChange: (value: T[]) => void;
  ariaLabel: string;
  placeholder?: string;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);
  const selected = useMemo(() => new Set(value), [value]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setFilter("");
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setFilter("");
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) filterInputRef.current?.focus();
  }, [open]);

  const filteredOptions = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [filter, options]);

  const orderedSelected = useMemo(
    () => options.filter((option) => selected.has(option)),
    [options, selected],
  );

  function toggleOption(option: T) {
    if (selected.has(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  }

  function removeOption(option: T) {
    onChange(value.filter((item) => item !== option));
  }

  function selectFiltered() {
    const next = new Set(value);
    for (const option of filteredOptions) next.add(option);
    onChange(options.filter((option) => next.has(option)));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className={`multi-choice-field ${open ? "is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="multi-choice-trigger field"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        {orderedSelected.length === 0 ? (
          <span className="multi-choice-placeholder">{placeholder}</span>
        ) : (
          <span className="multi-choice-chips">
            {orderedSelected.map((option) => (
              <span
                key={option}
                className="multi-choice-chip"
                onClick={(event) => {
                  event.stopPropagation();
                }}
              >
                <span className="multi-choice-chip-label">{option}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="multi-choice-chip-remove"
                  aria-label={`Remove ${option}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeOption(option);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      event.stopPropagation();
                      removeOption(option);
                    }
                  }}
                >
                  <X size={11} strokeWidth={2.4} />
                </span>
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={14} className="multi-choice-caret" />
      </button>

      {open ? (
        <div className="multi-choice-menu" role="listbox" aria-multiselectable="true" aria-label={ariaLabel}>
          <div className="multi-choice-filter">
            <Search size={13} />
            <input
              ref={filterInputRef}
              value={filter}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              onChange={(event) => setFilter(event.target.value)}
              onClick={(event) => event.stopPropagation()}
            />
            {filter ? (
              <button
                type="button"
                className="multi-choice-filter-clear"
                aria-label="Clear search"
                onClick={() => setFilter("")}
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          <div className="multi-choice-toolbar">
            <span className="multi-choice-count">
              {value.length === 0 ? "None selected" : `${value.length} selected`}
            </span>
            <div className="multi-choice-toolbar-actions">
              <button
                type="button"
                className="multi-choice-action"
                disabled={filteredOptions.length === 0 || filteredOptions.every((option) => selected.has(option))}
                onClick={selectFiltered}
              >
                {filter.trim() ? "Select matches" : "Select all"}
              </button>
              <button
                type="button"
                className="multi-choice-action"
                disabled={value.length === 0}
                onClick={clearAll}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="multi-choice-options">
            {filteredOptions.map((option) => {
              const isSelected = selected.has(option);
              return (
                <button
                  key={option}
                  type="button"
                  className={`multi-choice-option ${isSelected ? "is-selected" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggleOption(option)}
                >
                  <span className="multi-choice-check" aria-hidden="true">
                    {isSelected ? <Check size={12} strokeWidth={2.6} /> : null}
                  </span>
                  <span className="multi-choice-option-label">{option}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 ? (
              <p className="multi-choice-empty">No matching options</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ClientFormPage({
  account,
  mode,
  onClose,
  onSave,
}: {
  account: Account;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (next: Account) => void;
}) {
  const [draft, setDraft] = useState<ClientFormDraft>(() => ({
    ...(mode === "create" ? { ...account, status: null, clientStatus: null } : account),
    productsOfInterest: [...(account.productsOfInterest ?? [])],
    preferredChannels: [...(account.preferredChannels ?? [])],
  }));
  const [attempted, setAttempted] = useState(false);

  const companyNameError = attempted && !draft.companyName.trim();
  const statusError = attempted && !draft.status;
  const clientStatusError = attempted && !draft.clientStatus;

  function update<K extends keyof ClientFormDraft>(key: K, value: ClientFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setAttempted(true);
    const companyName = draft.companyName.trim();
    if (!companyName || !draft.status || !draft.clientStatus) return;
    onSave({
      ...draft,
      companyName,
      status: draft.status,
      clientStatus: draft.clientStatus,
    });
    onClose();
  }

  return (
    <section className="client-form-page">
      <header className="client-form-header">
        <div>
          <button type="button" className="client-form-back" onClick={onClose}>
            <ChevronLeft size={14} />
            Clients
          </button>
          <h2>{mode === "create" ? "Create Client" : account.companyName.trim() || "Edit Client"}</h2>
        </div>
        <div className="client-form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </header>

      <div className="client-form-body">
        <section className={`client-form-section ${clientStatusError ? "is-invalid" : ""}`}>
          <div className="client-form-section-head">
            <strong>Overview</strong>
            <span>Core client identity and referral details</span>
          </div>
          <div className="client-form-grid">
            <div className={`form-row ${companyNameError ? "is-invalid" : ""}`}>
              <label htmlFor="client-company-name">
                Company Name <span className="field-required">*</span>
              </label>
              <input
                id="client-company-name"
                className={`field ${companyNameError ? "is-invalid" : ""}`}
                value={draft.companyName}
                aria-required="true"
                aria-invalid={companyNameError}
                onChange={(event) => update("companyName", event.target.value)}
              />
              {companyNameError ? <p className="field-error">Company Name is required.</p> : null}
            </div>
            <div className="form-row">
              <label htmlFor="client-sic">SIC Code</label>
              <input
                id="client-sic"
                className="field"
                value={draft.sicCode}
                onChange={(event) => update("sicCode", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label>Industry Name</label>
              <ChoiceField
                name="industry"
                options={INDUSTRY_OPTIONS}
                value={draft.industry}
                onChange={(next) => update("industry", next)}
                ariaLabel="Industry Name"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label>
                Client Status <span className="field-required">*</span>
              </label>
              <ChoiceField
                name="clientStatus"
                options={CLIENT_STATUS_OPTIONS}
                value={draft.clientStatus}
                onChange={(next) => update("clientStatus", next)}
                ariaLabel="Client Status"
                invalid={clientStatusError}
                groupClassName="choice-group-status"
                getOptionClass={(option) => `choice-chip-status-${option.toLowerCase()}`}
                placeholder=""
              />
              {clientStatusError ? <p className="field-error">Client Status is required.</p> : null}
            </div>
            <div className="form-row">
              <label>Commercial Real Estate (CRE) Indicator</label>
              <ChoiceField
                name="creIndicator"
                options={[...YES_NO_OPTIONS]}
                value={yesNoValue(draft.creIndicator)}
                onChange={(next) => update("creIndicator", parseYesNo(next))}
                ariaLabel="Commercial Real Estate (CRE) Indicator"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-rm">Relationship Manager</label>
              <input
                id="client-rm"
                className="field"
                value={draft.relationshipManager}
                onChange={(event) => update("relationshipManager", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-email">Company Email</label>
              <input
                id="client-email"
                className="field"
                type="email"
                value={draft.email}
                onChange={(event) => update("email", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-phone">Company Phone 1</label>
              <input
                id="client-phone"
                className="field"
                type="tel"
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-phone-2">Company Phone 2</label>
              <input
                id="client-phone-2"
                className="field"
                type="tel"
                value={draft.phone2}
                onChange={(event) => update("phone2", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-campaign-code">Country/Region/Campaign Code</label>
              <input
                id="client-campaign-code"
                className="field"
                value={draft.countryRegionCampaignCode}
                onChange={(event) => update("countryRegionCampaignCode", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-referral-date">Referral Date</label>
              <DateField
                id="client-referral-date"
                value={draft.referralDate}
                onChange={(value) => update("referralDate", value)}
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label>Existing Client Referral</label>
              <ChoiceField
                name="existingClientReferral"
                options={[...YES_NO_OPTIONS]}
                value={yesNoValue(draft.existingClientReferral)}
                onChange={(next) => update("existingClientReferral", parseYesNo(next))}
                ariaLabel="Existing Client Referral"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-hacn-buddying">HACN Buddying Region/Branch</label>
              <input
                id="client-hacn-buddying"
                className="field"
                value={draft.hacnBuddyingRegionBranch}
                onChange={(event) => update("hacnBuddyingRegionBranch", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className={`client-form-section ${statusError ? "is-invalid" : ""}`}>
          <div className="client-form-section-head">
            <strong>
              Status <span className="field-required">*</span>
            </strong>
            <span>Record and banking relationship</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row">
              <label>
                Status <span className="field-required">*</span>
              </label>
              <ChoiceField
                name="status"
                options={ACCOUNT_STATUS_OPTIONS}
                value={draft.status}
                onChange={(next) => update("status", next)}
                ariaLabel="Status"
                invalid={statusError}
                getOptionClass={(option) => `choice-chip-account-status choice-chip-account-status-${optionSlug(option)}`}
                placeholder=""
              />
              {statusError ? <p className="field-error">Status is required.</p> : null}
            </div>
            <div className="form-row">
              <label>Segment</label>
              <ChoiceField
                name="segment"
                options={SEGMENT_OPTIONS}
                value={draft.segment}
                onChange={(next) => update("segment", next)}
                ariaLabel="Segment"
                placeholder=""
              />
            </div>
          </div>
        </section>

        <section className="client-form-section">
          <div className="client-form-section-head">
            <strong>Coverage & Engagement</strong>
            <span>Products of interest and preferred channels</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row client-form-span-2">
              <label>Products of Interest</label>
              <MultiChoiceField
                options={PRODUCT_INTEREST_OPTIONS}
                value={draft.productsOfInterest}
                onChange={(next) => update("productsOfInterest", next)}
                ariaLabel="Products of Interest"
                placeholder=""
                searchPlaceholder="Search products"
              />
            </div>
            <div className="form-row client-form-span-2">
              <label>Preferred Channels</label>
              <MultiChoiceField
                options={CLIENT_CHANNEL_OPTIONS}
                value={draft.preferredChannels}
                onChange={(next) => update("preferredChannels", next)}
                ariaLabel="Preferred Channels"
                placeholder=""
                searchPlaceholder="Search channels"
              />
            </div>
          </div>
        </section>

        <section className="client-form-section">
          <div className="client-form-section-head">
            <strong>Classification</strong>
            <span>Rating and risk</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row">
              <label>Rating</label>
              <ChoiceField
                name="rating"
                options={RATING_OPTIONS}
                value={draft.rating}
                onChange={(next) => update("rating", next)}
                ariaLabel="Rating"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label>Risk Rating</label>
              <RiskRatingField
                value={draft.riskRating}
                onChange={(next) => update("riskRating", next)}
              />
            </div>
            <div className="form-row">
              <label>KYC Status</label>
              <ChoiceField
                name="kycStatus"
                options={KYC_STATUS_OPTIONS}
                value={draft.kycStatus}
                onChange={(next) => update("kycStatus", next)}
                ariaLabel="KYC Status"
                getOptionClass={(option) => `choice-chip-kyc choice-chip-kyc-${optionSlug(option)}`}
                variant="labels"
                placeholder=""
              />
            </div>
          </div>
        </section>

        <section className="client-form-section">
          <div className="client-form-section-head">
            <strong>Location & Entity</strong>
            <span>Region and legal profile</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row">
              <label>Region</label>
              <ChoiceField
                name="region"
                options={REGION_OPTIONS}
                value={draft.region}
                onChange={(next) => update("region", next)}
                ariaLabel="Region"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label>Legal Entity Type</label>
              <ChoiceField
                name="legalEntityType"
                options={LEGAL_ENTITY_OPTIONS}
                value={draft.legalEntityType}
                onChange={(next) => update("legalEntityType", next)}
                ariaLabel="Legal Entity Type"
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-country">Country</label>
              <input
                id="client-country"
                className="field"
                value={draft.country}
                onChange={(event) => update("country", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-city">City</label>
              <input
                id="client-city"
                className="field"
                value={draft.city}
                onChange={(event) => update("city", event.target.value)}
              />
            </div>
            <div className="form-row client-form-span-2">
              <label htmlFor="client-address">Address</label>
              <input
                id="client-address"
                className="field"
                value={draft.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="client-form-section">
          <div className="client-form-section-head">
            <strong>Financial Profile</strong>
            <span>Scale and credit</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row">
              <label htmlFor="client-annual-revenue">Annual Revenue</label>
              <input
                id="client-annual-revenue"
                className="field"
                value={draft.annualRevenue}
                onChange={(event) => update("annualRevenue", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-credit-limit">Credit Limit</label>
              <input
                id="client-credit-limit"
                className="field"
                value={draft.creditLimit}
                onChange={(event) => update("creditLimit", event.target.value)}
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-employees">Employees</label>
              <input
                id="client-employees"
                className="field"
                value={draft.employeeCount}
                onChange={(event) => update("employeeCount", event.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="client-form-section">
          <div className="client-form-section-head">
            <strong>Primary Identification</strong>
            <span>ID type and number</span>
          </div>
          <div className="client-form-grid">
            <div className="form-row">
              <label>Primary ID Type</label>
              <ChoiceField
                name="primaryIdType"
                options={PRIMARY_ID_TYPE_OPTIONS}
                value={draft.primaryIdType}
                onChange={(next) => update("primaryIdType", next)}
                ariaLabel="Primary ID Type"
                groupClassName="choice-group-id-type"
                getOptionClass={(option) => `choice-chip-id-${primaryIdTypeClass(option)}`}
                placeholder=""
              />
            </div>
            <div className="form-row">
              <label htmlFor="client-primary-id-number">Primary ID Number</label>
              <input
                id="client-primary-id-number"
                className="field"
                value={draft.primaryIdNumber}
                onChange={(event) => update("primaryIdNumber", event.target.value)}
              />
            </div>
          </div>
        </section>
      </div>
    </section>
  );
}

type ImportFieldKey = Exclude<keyof Account, "id">;

const CLIENT_IMPORT_FIELDS: ImportFieldDef<ImportFieldKey>[] = [
  { key: "companyName", label: "Company Name", required: true, sample: "Everbright Trading Ltd" },
  { key: "status", label: "Status", options: ACCOUNT_STATUS_OPTIONS, sample: "Active" },
  { key: "clientStatus", label: "Client Status", options: CLIENT_STATUS_OPTIONS, sample: "ETB" },
  { key: "segment", label: "Segment", options: SEGMENT_OPTIONS, sample: "Corporate" },
  { key: "relationshipManager", label: "Relationship Manager", sample: "Alice Chan" },
  { key: "phone", label: "Phone", sample: "+852 2500 1234" },
  { key: "email", label: "Email", sample: "treasury@everbright.com" },
  { key: "website", label: "Website", sample: "https://www.everbright.com" },
  { key: "sicCode", label: "SIC Code", sample: "5199" },
  { key: "industry", label: "Industry", options: INDUSTRY_OPTIONS, sample: "Retail & Consumer" },
  { key: "rating", label: "Rating", options: RATING_OPTIONS, sample: "Warm" },
  { key: "riskRating", label: "Risk Rating", options: RISK_RATING_OPTIONS, sample: "Low" },
  { key: "kycStatus", label: "KYC Status", options: KYC_STATUS_OPTIONS, sample: "Approved" },
  { key: "region", label: "Region", options: REGION_OPTIONS, sample: "Hong Kong" },
  { key: "legalEntityType", label: "Legal Entity", options: LEGAL_ENTITY_OPTIONS, sample: "Limited Company" },
  { key: "country", label: "Country", sample: "Hong Kong" },
  { key: "city", label: "City", sample: "Kowloon" },
  { key: "address", label: "Address", sample: "Unit 1203, 12/F, Kowloon Bay" },
  { key: "annualRevenue", label: "Annual Revenue", sample: "HKD 120M" },
  { key: "employeeCount", label: "Employees", sample: "180" },
  { key: "creditLimit", label: "Credit Limit", sample: "HKD 20M" },
  { key: "clientSince", label: "Client Since", sample: "2021-06-15" },
  { key: "parentGroup", label: "Parent Group", sample: "Everbright Holdings" },
  { key: "primaryIdType", label: "Primary ID Type", options: PRIMARY_ID_TYPE_OPTIONS, sample: "BR Number" },
  { key: "primaryIdNumber", label: "Primary ID Number", sample: "BR-88213345" },
];

/** Exports clients using the import template layout so the file can be re-imported. */
function exportClients(clients: Account[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`clients-export-${stamp}.csv`, CLIENT_IMPORT_FIELDS, clients);
}

function ImportClientsModal({
  existing,
  onClose,
  onImport,
}: {
  existing: Account[];
  onClose: () => void;
  onImport: (created: Account[], updated: Account[]) => void;
}) {
  return (
    <ImportRecordsModal
      moduleLabel="Clients"
      recordLabel="Client"
      fields={CLIENT_IMPORT_FIELDS}
      matchKey="companyName"
      matchLabel="Company Name"
      existing={existing}
      getMatchValue={(account) => account.companyName}
      createEmpty={createEmptyAccount}
      makeId={(index) => `acc-import-${Date.now()}-${index}`}
      templateFilename="clients-import-template.csv"
      onClose={onClose}
      onImport={onImport}
    />
  );
}

function AccountsWorkspace({
  view = "All Clients",
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  view?: "All Clients" | "Active Clients";
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState<Account[]>(() => [...accounts]);
  const [editing, setEditing] = useState<{ account: Account; mode: "create" | "edit" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [returnToHome, setReturnToHome] = useState(false);
  const viewRows = view === "Active Clients" ? rows.filter((account) => account.status === "Active") : rows;
  const { activeTab } = useContext(ModuleViewTabContext);
  const actionsHost = useContext(ModuleViewActionsHostContext);
  const { filtersOpen } = useContext(ModuleFilterPanelContext);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing({ account: createEmptyAccount(), mode: "create" });
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const account = rows.find((item) => item.id === openRecordIntent.recordId);
    if (account) {
      setEditing({ account: { ...account }, mode: "edit" });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  function handleSave(next: Account) {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }

  function renderAccountCell(account: Account, column: ColumnDef) {
    if (column.key === "select") {
      return (
        <RowSelectCell
          context={{
            id: account.id,
            label: account.companyName,
            email: account.email,
            phone: account.phone,
            url: account.website,
            relatedTo: account.companyName,
          }}
          onEdit={() => {
            setEditing({ account: { ...account }, mode: "edit" });
            setReturnToHome(false);
          }}
          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== account.id))}
        />
      );
    }
    const value = getAccountCellValue(account, column.key);
    return value === "" ? "" : String(value);
  }

  if (editing) {
    return (
      <ClientFormPage
        account={editing.account}
        mode={editing.mode}
        onClose={dismissForm}
        onSave={handleSave}
      />
    );
  }

  function startCreate() {
    setEditing({ account: createEmptyAccount(), mode: "create" });
    setReturnToHome(false);
  }

  const clientModals = importOpen ? (
    <ImportClientsModal
      existing={rows}
      onClose={() => setImportOpen(false)}
      onImport={(created, updated) => {
        setRows((prev) => {
          const updatedById = new Map(updated.map((account) => [account.id, account]));
          const merged = prev.map((account) => updatedById.get(account.id) ?? account);
          return [...created, ...merged];
        });
      }}
    />
  ) : null;

  if (activeTab === "Kanban") {
    return (
      <>
        {actionsHost
          ? createPortal(
              <ListCreateButton
                createLabel="Create Client"
                importLabel="Import Clients"
                onCreate={startCreate}
                onImport={() => setImportOpen(true)}
              />,
              actionsHost,
            )
          : null}
        <div className={`record-layout ${filtersOpen ? "" : "is-filters-hidden"}`}>
          {filtersOpen ? (
            <FilterPanel
              title="Filter Clients by"
              filters={["Company Name", "Status", "Client Status", "Segment", "Risk Rating", "Region"]}
            />
          ) : null}
          <ClientKanbanBoard
            clients={viewRows}
            onOpenClient={(client) => {
              setEditing({ account: { ...client }, mode: "edit" });
              setReturnToHome(false);
            }}
          />
        </div>
        {clientModals}
      </>
    );
  }

  return (
    <>
      <RecordListShell
        title={view}
        filters={[
          "Company Name",
          "Status",
          "Client Status",
          "Segment",
          "Relationship Manager",
          "Phone",
          "Email",
          "SIC Code",
          "Industry",
          "Rating",
          "Risk Rating",
          "KYC Status",
          "Region",
          "Legal Entity",
          "Country",
          "City",
          "Annual Revenue",
          "Credit Limit",
          "Parent Group",
          "Primary ID Type",
          "Primary ID Number",
        ]}
        data={viewRows}
        columns={accountColumns}
        getCellValue={getAccountCellValue}
        createLabel="Create Client"
        importLabel="Import Clients"
        onCreate={startCreate}
        onImport={() => setImportOpen(true)}
        onExport={exportClients}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((account) => (
              <tr
                key={account.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setEditing({ account: { ...account }, mode: "edit" });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        {renderAccountCell(account, column)}
                      </td>
                    );
                  }
                  if (column.key === "riskRating") {
                    const raw = account.riskRating;
                    return <RiskRatingTd key={column.key} value={raw} />;
                  }
                  if (column.key === "status") {
                    return <AccountStatusTd key={column.key} value={account.status} />;
                  }
                  if (column.key === "clientStatus") {
                    const raw = account.clientStatus;
                    return <ClientStatusTd key={column.key} value={raw} />;
                  }
                  if (column.key === "kycStatus") {
                    const raw = account.kycStatus;
                    return <KycStatusTd key={column.key} value={raw} />;
                  }
                  if (column.type === "enum" && column.colorable !== false) {
                    const raw = account[column.key as keyof Account];
                    const value = raw == null || raw === "" ? null : String(raw);
                    return <EnumFillTd key={column.key} column={column} value={value} />;
                  }
                  return <td key={column.key}>{renderAccountCell(account, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {clientModals}
    </>
  );
}

const taskColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "subject", header: "Subject", type: "text" },
  { key: "dueDate", header: "Due Date", type: "date" },
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: ["Not Started", "Completed", "Deferred"],
    colorGroup: "soft",
  },
  {
    key: "priority",
    header: "Priority",
    type: "enum",
    enumOptions: ["High", "Normal", "Low"],
    colorGroup: "soft",
    optionColors: { High: 11, Normal: 8, Low: 7 },
  },
];

function getTaskCellValue(task: Task, key: string) {
  if (key === "subject") return task.subject;
  if (key === "dueDate") return task.dueDate;
  if (key === "status") return task.status;
  if (key === "priority") return task.priority;
  return "";
}


const TASK_STATUS_OPTIONS: Task["status"][] = ["Not Started", "Completed", "Deferred"];
const TASK_PRIORITY_OPTIONS: Task["priority"][] = ["High", "Normal", "Low"];

type TaskImportFieldKey = Exclude<keyof Task, "id">;

const TASK_IMPORT_FIELDS: ImportFieldDef<TaskImportFieldKey>[] = [
  { key: "subject", label: "Subject", required: true, sample: "Follow up with client" },
  { key: "dueDate", label: "Due Date", sample: "2026-08-15" },
  { key: "status", label: "Status", options: TASK_STATUS_OPTIONS, sample: "Not Started" },
  { key: "priority", label: "Priority", options: TASK_PRIORITY_OPTIONS, sample: "Normal" },
  { key: "account", label: "Account", sample: "King (Sample)" },
];

function exportTasks(rows: Task[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`tasks-export-${stamp}.csv`, TASK_IMPORT_FIELDS, rows);
}

function TasksWorkspace({
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState(() => [...tasks]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [returnToHome, setReturnToHome] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing(null);
    setCreating(true);
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = rows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setCreating(false);
      setEditing({ ...record });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setCreating(false);
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  return (
    <>
      <RecordListShell
        title="All Tasks"
        filters={taskFilters}
        data={rows}
        columns={taskColumns}
        getCellValue={getTaskCellValue}
        onCreate={() => {
          setEditing(null);
          setCreating(true);
          setReturnToHome(false);
        }}
        onExport={exportTasks}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((task) => (
              <tr
                key={task.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setCreating(false);
                  setEditing({ ...task });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        <RowSelectCell
                          context={{
                            id: task.id,
                            label: task.subject,
                            relatedTo: task.account,
                          }}
                          onEdit={() => {
                            setCreating(false);
                            setEditing({ ...task });
                            setReturnToHome(false);
                          }}
                          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== task.id))}
                        />
                      </td>
                    );
                  }
                  if (column.key === "subject") return <td key={column.key}>{task.subject}</td>;
                  if (column.key === "dueDate") return <td key={column.key}>{task.dueDate}</td>;
                  if (column.key === "status") {
                    return <EnumFillTd key={column.key} column={column} value={task.status} />;
                  }
                  if (column.key === "priority") {
                    return <EnumFillTd key={column.key} column={column} value={task.priority} />;
                  }
                  return <td key={column.key} />;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {creating || editing ? (
        <QuickCreateModal
          title={editing ? "Edit Task" : "Create Task"}
          fields={[
            { key: "subject", label: "Subject" },
            { key: "dueDate", label: "Due Date", type: "date" },
            { key: "account", label: "Account" },
            {
              key: "status",
              label: "Status",
              type: "select",
              options: ["Not Started", "Completed", "Deferred"],
            },
            {
              key: "priority",
              label: "Priority",
              type: "select",
              options: ["High", "Normal", "Low"],
            },
          ]}
          initialValues={
            editing
              ? {
                  subject: editing.subject,
                  dueDate: editing.dueDate,
                  account: editing.account,
                  status: editing.status,
                  priority: editing.priority,
                }
              : { status: "Not Started", priority: "Normal" }
          }
          onClose={dismissForm}
          onSave={(values) => {
            if (editing) {
              setRows((prev) =>
                prev.map((item) =>
                  item.id === editing.id
                    ? {
                        ...item,
                        subject: values.subject.trim() || item.subject,
                        dueDate: values.dueDate.trim(),
                        account: values.account.trim(),
                        status: (values.status as Task["status"]) || item.status,
                        priority: (values.priority as Task["priority"]) || item.priority,
                      }
                    : item,
                ),
              );
            } else {
              setRows((prev) => [
                {
                  id: `task-${Date.now()}`,
                  subject: values.subject.trim() || "Untitled Task",
                  dueDate: values.dueDate.trim(),
                  account: values.account.trim(),
                  status: (values.status as Task["status"]) || "Not Started",
                  priority: (values.priority as Task["priority"]) || "Normal",
                },
                ...prev,
              ]);
            }
            dismissForm();
          }}
        />
      ) : null}
    </>
  );
}

const meetingColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "title", header: "Title", type: "text" },
  { key: "from", header: "From", type: "datetime" },
  { key: "to", header: "To", type: "datetime" },
  { key: "relatedTo", header: "Related To", type: "text" },
];

function getMeetingCellValue(meeting: Meeting, key: string) {
  if (key === "title") return meeting.title;
  if (key === "from") return meeting.from;
  if (key === "to") return meeting.to;
  if (key === "relatedTo") return meeting.relatedTo;
  return "";
}


function MeetingsWorkspace({
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState(() => [...meetings]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [returnToHome, setReturnToHome] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing(null);
    setCreating(true);
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = rows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setCreating(false);
      setEditing({ ...record });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setCreating(false);
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  return (
    <>
      <RecordListShell
        title="All Meetings"
        filters={["All day", "Check-In Address", "Check-In By", "Check-In City", "Check-In Country", "Check-In State"]}
        data={rows}
        columns={meetingColumns}
        getCellValue={getMeetingCellValue}
        onCreate={() => {
          setEditing(null);
          setCreating(true);
          setReturnToHome(false);
        }}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((meeting) => (
              <tr
                key={meeting.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setCreating(false);
                  setEditing({ ...meeting });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        <RowSelectCell
                          context={{
                            id: meeting.id,
                            label: meeting.title,
                            relatedTo: meeting.relatedTo,
                          }}
                          onEdit={() => {
                            setCreating(false);
                            setEditing({ ...meeting });
                            setReturnToHome(false);
                          }}
                          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== meeting.id))}
                        />
                      </td>
                    );
                  }
                  if (column.key === "title") return <td key={column.key}>{meeting.title}</td>;
                  if (column.key === "from") return <td key={column.key}>{meeting.from}</td>;
                  if (column.key === "to") return <td key={column.key}>{meeting.to}</td>;
                  if (column.key === "relatedTo") return <td key={column.key}>{meeting.relatedTo}</td>;
                  return <td key={column.key} />;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      <CalendarWorkspace />
      {creating || editing ? (
        <QuickCreateModal
          key={editing?.id ?? "create-meeting"}
          title={editing ? "Edit Meeting" : "Create Meeting"}
          fields={[
            { key: "title", label: "Title" },
            { key: "from", label: "From", placeholder: "YYYY-MM-DD HH:MM AM" },
            { key: "to", label: "To", placeholder: "YYYY-MM-DD HH:MM AM" },
            { key: "relatedTo", label: "Related To" },
            { key: "owner", label: "Owner" },
          ]}
          initialValues={
            editing
              ? {
                  title: editing.title,
                  from: editing.from,
                  to: editing.to,
                  relatedTo: editing.relatedTo,
                  owner: editing.owner,
                }
              : { owner: "Jenny" }
          }
          onClose={dismissForm}
          onSave={(values) => {
            if (editing) {
              setRows((prev) =>
                prev.map((item) =>
                  item.id === editing.id
                    ? {
                        ...item,
                        title: values.title.trim() || item.title,
                        from: values.from.trim(),
                        to: values.to.trim(),
                        relatedTo: values.relatedTo.trim(),
                        owner: values.owner.trim() || item.owner,
                      }
                    : item,
                ),
              );
            } else {
              setRows((prev) => [
                {
                  id: `meeting-${Date.now()}`,
                  title: values.title.trim() || "Untitled Meeting",
                  from: values.from.trim(),
                  to: values.to.trim(),
                  relatedTo: values.relatedTo.trim(),
                  owner: values.owner.trim() || "Jenny",
                },
                ...prev,
              ]);
            }
            dismissForm();
          }}
        />
      ) : null}
    </>
  );
}

const callColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "subject", header: "Subject", type: "text" },
  {
    key: "type",
    header: "Call Type",
    type: "enum",
    enumOptions: ["Inbound", "Outbound"],
    colorGroup: "cool",
  },
  { key: "startTime", header: "Call Start Time", type: "datetime" },
  { key: "duration", header: "Call Duration", type: "duration" },
];

function getCallCellValue(call: Call, key: string) {
  if (key === "subject") return call.subject;
  if (key === "type") return call.type;
  if (key === "startTime") return call.startTime;
  if (key === "duration") return call.duration;
  return "";
}


function CallsWorkspace({
  createIntentId = null,
  onCreateHandled,
}: {
  createIntentId?: number | null;
  onCreateHandled?: () => void;
}) {
  const [rows, setRows] = useState(() => [...calls]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setCreating(true);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  return (
    <>
      <RecordListShell
        title="All Calls"
        filters={callFilters}
        data={rows}
        columns={callColumns}
        getCellValue={getCallCellValue}
        onCreate={() => setCreating(true)}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((call) => (
              <tr key={call.id}>
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        <RowSelectCell
                          context={{
                            id: call.id,
                            label: call.subject,
                          }}
                          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== call.id))}
                        />
                      </td>
                    );
                  }
                  if (column.key === "subject") return <td key={column.key}>{call.subject}</td>;
                  if (column.key === "type") {
                    return <EnumFillTd key={column.key} column={column} value={call.type} />;
                  }
                  if (column.key === "startTime") return <td key={column.key}>{call.startTime}</td>;
                  if (column.key === "duration") return <td key={column.key}>{call.duration}</td>;
                  return <td key={column.key} />;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      <CallForm />
      {creating ? (
        <QuickCreateModal
          title="Create Call"
          fields={[
            { key: "subject", label: "Subject" },
            {
              key: "type",
              label: "Call Type",
              type: "select",
              options: ["Inbound", "Outbound"],
            },
            { key: "startTime", label: "Call Start Time", placeholder: "YYYY-MM-DD HH:MM AM" },
            { key: "duration", label: "Call Duration", placeholder: "00:00" },
          ]}
          initialValues={{ type: "Outbound", duration: "00:00" }}
          onClose={() => setCreating(false)}
          onSave={(values) => {
            setRows((prev) => [
              {
                id: `call-${Date.now()}`,
                subject: values.subject.trim() || "Untitled Call",
                type: (values.type as Call["type"]) || "Outbound",
                startTime: values.startTime.trim(),
                duration: values.duration.trim() || "00:00",
              },
              ...prev,
            ]);
            setCreating(false);
          }}
        />
      ) : null}
    </>
  );
}

function CallForm() {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h3>Log a call</h3>
      <div className="form-grid">
        {["Voice Recording", "Call Purpose", "Call Agenda", "Call Result", "Description"].map((field) => (
          <div className="form-row" key={field}>
            <label>{field}</label>
            <input className="field" placeholder={field === "Call Purpose" || field === "Call Result" ? "-None-" : ""} />
          </div>
        ))}
      </div>
      <div className="pill-tabs" style={{ justifyContent: "flex-end", marginTop: 18 }}>
        <button className="secondary-button">Cancel</button>
        <button className="primary-button">Save</button>
      </div>
    </section>
  );
}

const LOAN_PRODUCT_OPTIONS: Deal["productType"][] = [
  "Term Loan",
  "Revolving Credit",
  "Overdraft",
  "Trade Finance",
  "Mortgage",
];
const LOAN_PURPOSE_OPTIONS: Deal["purpose"][] = [
  "Working Capital",
  "Asset Purchase",
  "Refinancing",
  "Property Finance",
  "Trade Finance",
  "Other",
];
const LOAN_CURRENCY_OPTIONS: Deal["currency"][] = ["CNY", "HKD", "USD", "SGD"];
const LOAN_REPAYMENT_OPTIONS: Deal["repaymentFrequency"][] = ["Monthly", "Quarterly", "Semi-annual", "Bullet"];
const LOAN_COLLATERAL_OPTIONS: Deal["collateralType"][] = [
  "Unsecured",
  "Property",
  "Cash Deposit",
  "Receivables",
  "Guarantee",
  "Other",
];
const LOAN_RISK_OPTIONS: Deal["riskGrade"][] = ["Low", "Medium", "High"];
const LOAN_RATE_TYPE_OPTIONS: Deal["rateType"][] = ["Fixed", "Floating"];
const LOAN_BUSINESS_UNIT_OPTIONS: Deal["businessUnit"][] = [
  "Corporate Banking",
  "Commercial Banking",
  "SME Banking",
  "Private Banking",
  "Trade Finance",
];
const LOAN_FACILITY_STATUS_OPTIONS: Deal["facilityStatus"][] = [
  "Pipeline",
  "Committed",
  "Drawn",
  "Fully Repaid",
  "Cancelled",
];
const LOAN_APPROVAL_AUTHORITY_OPTIONS: Deal["approvalAuthority"][] = [
  "RM Discretion",
  "Credit Committee",
  "Regional Credit",
  "Head Office",
];

type DealImportFieldKey = Exclude<keyof Deal, "id" | "accountId" | "probability" | "remarks">;

function buildDealImportFields(config: ProductPipelineConfig): ImportFieldDef<DealImportFieldKey>[] {
  return [
    { key: "name", label: `${config.recordLabel} Name`, required: true, sample: `${config.recordLabel} Sample` },
    {
      key: "facilityNumber",
      label: "Facility Number",
      required: true,
      sample: `${config.facilityPrefix}-${new Date().getFullYear()}-0001`,
    },
    { key: "account", label: "Client", sample: "Everbright Trading Ltd" },
    { key: "contact", label: "Contact", sample: "Alice Chan" },
    { key: "owner", label: "Owner", sample: "Jenny" },
    { key: "businessUnit", label: "Business Unit", options: LOAN_BUSINESS_UNIT_OPTIONS, sample: "Corporate Banking" },
    { key: "bookingBranch", label: "Booking Branch", sample: "Hong Kong Main" },
    { key: "productType", label: "Product Type", options: LOAN_PRODUCT_OPTIONS, sample: "Term Loan" },
    { key: "purpose", label: "Purpose", options: LOAN_PURPOSE_OPTIONS, sample: "Working Capital" },
    { key: "currency", label: "Currency", options: LOAN_CURRENCY_OPTIONS, sample: "HKD" },
    { key: "amount", label: "Amount", kind: "number", sample: "10000000" },
    { key: "approvedAmount", label: "Approved Amount", kind: "number", sample: "10000000" },
    { key: "outstandingBalance", label: "Outstanding Balance", kind: "number", sample: "7500000" },
    { key: "tenorMonths", label: "Tenor (Months)", kind: "number", sample: "36" },
    { key: "repaymentFrequency", label: "Repayment Frequency", options: LOAN_REPAYMENT_OPTIONS, sample: "Quarterly" },
    { key: "rateType", label: "Rate Type", options: LOAN_RATE_TYPE_OPTIONS, sample: "Floating" },
    { key: "interestRate", label: "Interest Rate", kind: "number", sample: "4.25" },
    { key: "benchmarkRate", label: "Benchmark Rate", sample: "LPR 1Y" },
    { key: "spreadBps", label: "Spread (bps)", kind: "number", sample: "120" },
    { key: "arrangementFeeBps", label: "Arrangement Fee (bps)", kind: "number", sample: "25" },
    { key: "commitmentFeeBps", label: "Commitment Fee (bps)", kind: "number", sample: "15" },
    { key: "utilizationPct", label: "Utilization %", kind: "number", sample: "75" },
    { key: "collateralType", label: "Collateral Type", options: LOAN_COLLATERAL_OPTIONS, sample: "Property" },
    { key: "collateralValue", label: "Collateral Value", kind: "number", sample: "15000000" },
    { key: "ltv", label: "LTV", kind: "number", sample: "65" },
    { key: "guarantor", label: "Guarantor", sample: "Everbright Holdings" },
    { key: "riskGrade", label: "Risk Grade", options: LOAN_RISK_OPTIONS, sample: "Medium" },
    { key: "internalRating", label: "Internal Rating", sample: "BBB" },
    { key: "facilityStatus", label: "Facility Status", options: LOAN_FACILITY_STATUS_OPTIONS, sample: "Pipeline" },
    { key: "approvalAuthority", label: "Approval Authority", options: LOAN_APPROVAL_AUTHORITY_OPTIONS, sample: "Credit Committee" },
    { key: "syndicated", label: "Syndicated", kind: "boolean", sample: "No" },
    { key: "applicationDate", label: "Application Date", sample: "2026-01-15" },
    { key: "approvalDate", label: "Approval Date", sample: "2026-02-20" },
    { key: "drawdownDate", label: "Drawdown Date", sample: "2026-03-01" },
    { key: "maturityDate", label: "Maturity Date", sample: "2029-03-01" },
    { key: "closingDate", label: "Closing Date", sample: "2026-03-05" },
    { key: "nextReviewDate", label: "Next Review Date", sample: "2027-03-01" },
    { key: "stage", label: "Stage", options: config.stages, sample: config.stages[0] ?? "Identification" },
  ];
}

function exportDeals(config: ProductPipelineConfig, rows: Deal[]) {
  const fields = buildDealImportFields(config);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = config.key.replace(/([A-Z])/g, "-$1").toLowerCase();
  exportRecordsCsv(`${slug}-export-${stamp}.csv`, fields, rows, (record, key) => {
    const value = record[key];
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  });
}

function ImportDealsModal({
  config,
  existing,
  onClose,
  onImport,
}: {
  config: ProductPipelineConfig;
  existing: Deal[];
  onClose: () => void;
  onImport: (created: Deal[], updated: Deal[]) => void;
}) {
  const fields = useMemo(() => buildDealImportFields(config), [config]);
  const slug = config.key.replace(/([A-Z])/g, "-$1").toLowerCase();
  return (
    <ImportRecordsModal
      moduleLabel={config.label}
      recordLabel={config.recordLabel}
      fields={fields}
      matchKey="facilityNumber"
      matchLabel="Facility Number"
      existing={existing}
      getMatchValue={(deal) => deal.facilityNumber}
      createEmpty={() => createEmptyLoan(config)}
      makeId={(index) => `${config.key}-import-${Date.now()}-${index}`}
      templateFilename={`${slug}-import-template.csv`}
      onClose={onClose}
      onImport={onImport}
    />
  );
}


function buildDealColumns(config: ProductPipelineConfig): ColumnDef[] {
  return [
    { key: "select", header: "", type: "checkbox" },
    { key: "name", header: `${config.recordLabel} Name`, type: "text" },
    {
      key: "stage",
      header: "Stage",
      type: "enum",
      enumOptions: [...config.stages],
      colorGroup: "soft",
      optionColors: {
        Identification: 1,
        Evaluation: 0,
        Approval: 3,
        Execution: 4,
        Completion: 2,
      },
    },
    { key: "facilityNumber", header: "Facility Number", type: "text" },
    { key: "account", header: "Client", type: "text" },
    {
      key: "businessUnit",
      header: "Business Unit",
      type: "enum",
      enumOptions: [...LOAN_BUSINESS_UNIT_OPTIONS],
      colorable: false,
    },
    {
      key: "productType",
      header: "Product Type",
      type: "enum",
      enumOptions: [...LOAN_PRODUCT_OPTIONS],
      colorable: false,
    },
    { key: "amount", header: "Amount", type: "text" },
    {
      key: "currency",
      header: "Currency",
      type: "enum",
      enumOptions: [...LOAN_CURRENCY_OPTIONS],
      colorable: false,
    },
    {
      key: "facilityStatus",
      header: "Facility Status",
      type: "enum",
      enumOptions: [...LOAN_FACILITY_STATUS_OPTIONS],
      colorGroup: "soft",
      optionColors: {
        Pipeline: 6,
        Committed: 1,
        Drawn: 0,
        "Fully Repaid": 3,
        Cancelled: 4,
      },
    },
    {
      key: "riskGrade",
      header: "Risk Grade",
      type: "enum",
      enumOptions: [...LOAN_RISK_OPTIONS],
      colorable: false,
    },
    { key: "internalRating", header: "Internal Rating", type: "text" },
    { key: "owner", header: "Owner", type: "text" },
    { key: "bookingBranch", header: "Booking Branch", type: "text" },
    { key: "guarantor", header: "Guarantor", type: "text" },
    { key: "utilizationPct", header: "Utilization %", type: "text" },
    { key: "closingDate", header: "Closing Date", type: "date" },
    { key: "nextReviewDate", header: "Next Review", type: "date" },
    { key: "interestRate", header: "Interest Rate", type: "text" },
    {
      key: "purpose",
      header: "Purpose",
      type: "enum",
      enumOptions: [...LOAN_PURPOSE_OPTIONS],
      colorable: false,
    },
    {
      key: "approvalAuthority",
      header: "Approval Authority",
      type: "enum",
      enumOptions: [...LOAN_APPROVAL_AUTHORITY_OPTIONS],
      colorable: false,
    },
    { key: "syndicated", header: "Syndicated", type: "text" },
    { key: "contact", header: "Contact", type: "text" },
    {
      key: "rateType",
      header: "Rate Type",
      type: "enum",
      enumOptions: [...LOAN_RATE_TYPE_OPTIONS],
      colorable: false,
    },
    { key: "tenorMonths", header: "Tenor (Months)", type: "text" },
  ];
}

function buildDealFilters(config: ProductPipelineConfig) {
  return [
    `${config.recordLabel} Name`,
    "Facility Number",
    "Client",
    "Business Unit",
    "Product Type",
    "Amount",
    "Currency",
    "Stage",
    "Facility Status",
    "Risk Grade",
    "Internal Rating",
    "Owner",
    "Booking Branch",
    "Guarantor",
    "Utilization %",
    "Closing Date",
    "Next Review",
    "Interest Rate",
    "Purpose",
    "Approval Authority",
    "Syndicated",
    "Contact",
    "Rate Type",
    "Tenor (Months)",
  ];
}

function buildKanbanDealFilters(config: ProductPipelineConfig) {
  return [
    `${config.recordLabel} Name`,
    "Facility Number",
    "Client",
    "Business Unit",
    "Product Type",
    "Amount",
    "Currency",
    "Stage",
    "Facility Status",
    "Risk Grade",
    "Internal Rating",
  ];
}

function formatLoanAmount(currency: Deal["currency"], amount: number) {
  return `${currency} ${amount.toLocaleString("en-US")}.00`;
}

function getDealCellValue(deal: Deal, key: string) {
  if (key === "amount") return deal.amount;
  if (key === "interestRate") return deal.interestRate;
  if (key === "tenorMonths") return deal.tenorMonths;
  if (key === "utilizationPct") return deal.utilizationPct;
  if (key === "syndicated") return deal.syndicated ? "Yes" : "No";
  const value = deal[key as keyof Deal];
  if (value == null) return "";
  return value as string | number;
}

function createEmptyLoan(config: ProductPipelineConfig): Deal {
  const firstStage = config.stages[0] ?? "Identification";
  return {
    id: `${config.key}-${Date.now()}`,
    name: "",
    facilityNumber: `${config.facilityPrefix}-${new Date().getFullYear()}-`,
    accountId: "",
    account: "",
    contact: "",
    owner: "Jenny",
    businessUnit: "Corporate Banking",
    bookingBranch: "",
    productType: "Term Loan",
    purpose: "Working Capital",
    currency: "CNY",
    amount: 0,
    approvedAmount: 0,
    outstandingBalance: 0,
    tenorMonths: 12,
    repaymentFrequency: "Monthly",
    rateType: "Floating",
    interestRate: 0,
    benchmarkRate: "LPR 1Y",
    spreadBps: 0,
    arrangementFeeBps: 0,
    commitmentFeeBps: 0,
    utilizationPct: 0,
    collateralType: "Unsecured",
    collateralValue: 0,
    ltv: 0,
    guarantor: "",
    riskGrade: "Medium",
    internalRating: "",
    facilityStatus: "Pipeline",
    approvalAuthority: "Credit Committee",
    syndicated: false,
    applicationDate: "",
    approvalDate: "",
    drawdownDate: "",
    maturityDate: "",
    closingDate: "",
    nextReviewDate: "",
    stage: firstStage,
    probability: config.stageProbability[firstStage] ?? 10,
    remarks: "",
    updatedAt: new Date().toISOString(),
  };
}

function LoanFormPage({
  loan,
  mode,
  config,
  onClose,
  onSave,
}: {
  loan: Deal;
  mode: "create" | "edit";
  config: ProductPipelineConfig;
  onClose: () => void;
  onSave: (loan: Deal) => void;
}) {
  const [draft, setDraft] = useState<Deal>(() => ({ ...loan }));
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !draft.name.trim();
  const accountError = attempted && !draft.account.trim();
  const amountError = attempted && draft.amount <= 0;

  function update<K extends keyof Deal>(key: K, value: Deal[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateNumber(
    key:
      | "amount"
      | "approvedAmount"
      | "outstandingBalance"
      | "tenorMonths"
      | "interestRate"
      | "spreadBps"
      | "arrangementFeeBps"
      | "commitmentFeeBps"
      | "utilizationPct"
      | "collateralValue"
      | "ltv",
    value: string,
  ) {
    update(key, Number(value) || 0);
  }

  function handleClientChange(accountId: string) {
    const client = accounts.find((item) => item.id === accountId);
    if (!client) {
      setDraft((prev) => ({ ...prev, accountId: "", account: "" }));
      return;
    }
    setDraft((prev) => ({
      ...prev,
      accountId: client.id,
      account: client.companyName,
      owner: client.relationshipManager || prev.owner,
      businessUnit:
        client.segment === "Private Banking"
          ? "Private Banking"
          : client.segment === "SME"
            ? "SME Banking"
            : client.segment === "Commercial"
              ? "Commercial Banking"
              : prev.businessUnit === "Trade Finance"
                ? prev.businessUnit
                : "Corporate Banking",
      riskGrade: client.riskRating ?? prev.riskGrade,
    }));
  }

  const stageIndex = config.stages.indexOf(draft.stage);
  const isCompletion = draft.stage === "Completion" || stageIndex === config.stages.length - 1;
  const nextStage =
    stageIndex >= 0 && stageIndex < config.stages.length - 1 ? config.stages[stageIndex + 1] : null;

  function setStage(stage: PipelineStage) {
    setDraft((prev) => ({
      ...prev,
      stage,
      probability: config.stageProbability[stage] ?? prev.probability,
    }));
  }

  function buildSavedLoan(overrides: Partial<Deal> = {}): Deal | null {
    setAttempted(true);
    if (!draft.name.trim() || !draft.account.trim() || draft.amount <= 0) return null;
    return {
      ...draft,
      ...overrides,
      name: draft.name.trim(),
      facilityNumber: draft.facilityNumber.trim(),
      account: draft.account.trim(),
      contact: draft.contact.trim(),
      owner: draft.owner.trim() || "Jenny",
      bookingBranch: draft.bookingBranch.trim(),
      guarantor: draft.guarantor.trim(),
      internalRating: draft.internalRating.trim(),
      remarks: draft.remarks.trim(),
      updatedAt: new Date().toISOString(),
    };
  }

  function handleSave() {
    const saved = buildSavedLoan();
    if (!saved) return;
    onSave(saved);
    onClose();
  }

  function handleNextStage() {
    if (!nextStage) return;
    setStage(nextStage);
  }

  function handleFinish() {
    const saved = buildSavedLoan({
      stage: "Completion",
      probability: config.stageProbability.Completion ?? 100,
      facilityStatus: draft.facilityStatus === "Pipeline" ? "Committed" : draft.facilityStatus,
    });
    if (!saved) return;
    onSave(saved);
    onClose();
  }

  return (
    <section className="client-form-page">
      <header className="client-form-header">
        <div>
          <button type="button" className="client-form-back" onClick={onClose}>
            <ChevronLeft size={14} />
            {config.label}
          </button>
          <h2>
            {mode === "create"
              ? `Create ${config.recordLabel}`
              : loan.name.trim() || `Edit ${config.recordLabel}`}
          </h2>
        </div>
        <div className="client-form-actions">
          <span className="loan-form-probability">{draft.probability}% probability</span>
          {isCompletion ? (
            <button type="button" className="loan-form-finish-button" onClick={handleFinish}>
              <Check size={15} strokeWidth={2.4} />
              Finish
            </button>
          ) : (
            <button
              type="button"
              className="loan-form-next-button"
              onClick={handleNextStage}
              disabled={!nextStage}
            >
              Next Stage
              <ChevronRight size={15} strokeWidth={2.4} />
            </button>
          )}
          <button type="button" className="primary-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </header>

      <div className="loan-form-stage-rail">
        <LoanFormStageTrail
          stages={config.stages}
          current={draft.stage}
          probabilities={config.stageProbability}
          onSelect={setStage}
        />
      </div>

      <div className="client-form-body">
          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>{config.recordLabel} Overview</strong>
              <span>Borrower and ownership</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${nameError ? "is-invalid" : ""}`}>
                <label htmlFor="loan-name">{config.recordLabel} Name <span className="field-required">*</span></label>
                <input id="loan-name" className={`field ${nameError ? "is-invalid" : ""}`} value={draft.name}
                  placeholder="e.g. Working Capital Facility" onChange={(event) => update("name", event.target.value)} />
                {nameError ? <p className="field-error">{config.recordLabel} Name is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="loan-facility-number">Facility Number</label>
                <input id="loan-facility-number" className="field" value={draft.facilityNumber}
                  placeholder={`${config.facilityPrefix}-2026-001`} onChange={(event) => update("facilityNumber", event.target.value)} />
              </div>
              <div className={`form-row ${accountError ? "is-invalid" : ""}`}>
                <label htmlFor="loan-account">Borrower / Client <span className="field-required">*</span></label>
                <select
                  id="loan-account"
                  className={`field ${accountError ? "is-invalid" : ""}`}
                  value={draft.accountId}
                  onChange={(event) => handleClientChange(event.target.value)}
                >
                  <option value="">Select client</option>
                  {accounts.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
                {accountError ? <p className="field-error">Borrower / Client is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="loan-contact">Primary Contact</label>
                <input id="loan-contact" className="field" value={draft.contact}
                  placeholder="Enter contact name" onChange={(event) => update("contact", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-owner">Relationship Manager</label>
                <input id="loan-owner" className="field" value={draft.owner}
                  placeholder="Enter owner" onChange={(event) => update("owner", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-business-unit">Business Unit</label>
                <select id="loan-business-unit" className="field" value={draft.businessUnit}
                  onChange={(event) => update("businessUnit", event.target.value as Deal["businessUnit"])}>
                  {LOAN_BUSINESS_UNIT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-booking-branch">Booking Branch</label>
                <input id="loan-booking-branch" className="field" value={draft.bookingBranch}
                  placeholder="e.g. HK Central Corporate"
                  onChange={(event) => update("bookingBranch", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-facility-status">Facility Status</label>
                <select id="loan-facility-status" className="field" value={draft.facilityStatus}
                  onChange={(event) => update("facilityStatus", event.target.value as Deal["facilityStatus"])}>
                  {LOAN_FACILITY_STATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Facility Terms</strong>
              <span>Product, amount and repayment</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label htmlFor="loan-product">Product Type</label>
                <select id="loan-product" className="field" value={draft.productType}
                  onChange={(event) => update("productType", event.target.value as Deal["productType"])}>
                  {LOAN_PRODUCT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-purpose">Loan Purpose</label>
                <select id="loan-purpose" className="field" value={draft.purpose}
                  onChange={(event) => update("purpose", event.target.value as Deal["purpose"])}>
                  {LOAN_PURPOSE_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-currency">Currency</label>
                <select id="loan-currency" className="field" value={draft.currency}
                  onChange={(event) => update("currency", event.target.value as Deal["currency"])}>
                  {LOAN_CURRENCY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className={`form-row ${amountError ? "is-invalid" : ""}`}>
                <label htmlFor="loan-amount">Requested Amount <span className="field-required">*</span></label>
                <input id="loan-amount" className={`field ${amountError ? "is-invalid" : ""}`} type="number" min="0"
                  value={draft.amount || ""} placeholder="0" onChange={(event) => updateNumber("amount", event.target.value)} />
                {amountError ? <p className="field-error">Requested Amount must be greater than 0.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="loan-approved">Approved Amount</label>
                <input id="loan-approved" className="field" type="number" min="0" value={draft.approvedAmount || ""}
                  placeholder="0" onChange={(event) => updateNumber("approvedAmount", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-outstanding">Outstanding Balance</label>
                <input id="loan-outstanding" className="field" type="number" min="0" value={draft.outstandingBalance || ""}
                  placeholder="0" onChange={(event) => updateNumber("outstandingBalance", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-utilization">Utilization (%)</label>
                <input id="loan-utilization" className="field" type="number" min="0" max="100"
                  value={draft.utilizationPct || ""} placeholder="0"
                  onChange={(event) => updateNumber("utilizationPct", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-tenor">Tenor (Months)</label>
                <input id="loan-tenor" className="field" type="number" min="1" value={draft.tenorMonths || ""}
                  onChange={(event) => updateNumber("tenorMonths", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-repayment">Repayment Frequency</label>
                <select id="loan-repayment" className="field" value={draft.repaymentFrequency}
                  onChange={(event) => update("repaymentFrequency", event.target.value as Deal["repaymentFrequency"])}>
                  {LOAN_REPAYMENT_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-syndicated">Syndicated</label>
                <select id="loan-syndicated" className="field" value={draft.syndicated ? "Yes" : "No"}
                  onChange={(event) => update("syndicated", event.target.value === "Yes")}>
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Pricing & Credit Risk</strong>
              <span>Rate, fees, collateral and risk grade</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label htmlFor="loan-rate-type">Rate Type</label>
                <select id="loan-rate-type" className="field" value={draft.rateType}
                  onChange={(event) => update("rateType", event.target.value as Deal["rateType"])}>
                  <option>Fixed</option><option>Floating</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-interest-rate">Interest Rate (%)</label>
                <input id="loan-interest-rate" className="field" type="number" min="0" step="0.01"
                  value={draft.interestRate || ""} placeholder="0.00"
                  onChange={(event) => updateNumber("interestRate", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-benchmark">Benchmark Rate</label>
                <input id="loan-benchmark" className="field" value={draft.benchmarkRate}
                  placeholder="e.g. LPR 1Y / HIBOR 3M" onChange={(event) => update("benchmarkRate", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-spread">Spread (bps)</label>
                <input id="loan-spread" className="field" type="number" min="0" value={draft.spreadBps || ""}
                  placeholder="0" onChange={(event) => updateNumber("spreadBps", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-arrangement-fee">Arrangement Fee (bps)</label>
                <input id="loan-arrangement-fee" className="field" type="number" min="0"
                  value={draft.arrangementFeeBps || ""} placeholder="0"
                  onChange={(event) => updateNumber("arrangementFeeBps", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-commitment-fee">Commitment Fee (bps)</label>
                <input id="loan-commitment-fee" className="field" type="number" min="0"
                  value={draft.commitmentFeeBps || ""} placeholder="0"
                  onChange={(event) => updateNumber("commitmentFeeBps", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-collateral">Collateral Type</label>
                <select id="loan-collateral" className="field" value={draft.collateralType}
                  onChange={(event) => update("collateralType", event.target.value as Deal["collateralType"])}>
                  {LOAN_COLLATERAL_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-collateral-value">Collateral Value</label>
                <input id="loan-collateral-value" className="field" type="number" min="0"
                  value={draft.collateralValue || ""} placeholder="0"
                  onChange={(event) => updateNumber("collateralValue", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-ltv">LTV (%)</label>
                <input id="loan-ltv" className="field" type="number" min="0" max="100" value={draft.ltv || ""}
                  placeholder="0" onChange={(event) => updateNumber("ltv", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-guarantor">Guarantor</label>
                <input id="loan-guarantor" className="field" value={draft.guarantor}
                  placeholder="Enter guarantor name" onChange={(event) => update("guarantor", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-risk">Credit Risk Grade</label>
                <select id="loan-risk" className="field" value={draft.riskGrade}
                  onChange={(event) => update("riskGrade", event.target.value as Deal["riskGrade"])}>
                  <option>Low</option><option>Medium</option><option>High</option>
                </select>
              </div>
              <div className="form-row">
                <label htmlFor="loan-internal-rating">Internal Rating</label>
                <input id="loan-internal-rating" className="field" value={draft.internalRating}
                  placeholder="e.g. BBB+ / A-" onChange={(event) => update("internalRating", event.target.value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-approval-authority">Approval Authority</label>
                <select id="loan-approval-authority" className="field" value={draft.approvalAuthority}
                  onChange={(event) => update("approvalAuthority", event.target.value as Deal["approvalAuthority"])}>
                  {LOAN_APPROVAL_AUTHORITY_OPTIONS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Key Dates</strong>
              <span>Application through review</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label htmlFor="loan-application-date">Application Date</label>
                <DateField id="loan-application-date" value={draft.applicationDate}
                  onChange={(value) => update("applicationDate", value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-closing-date">Target Closing Date</label>
                <DateField id="loan-closing-date" value={draft.closingDate}
                  onChange={(value) => update("closingDate", value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-approval-date">Approval Date</label>
                <DateField id="loan-approval-date" value={draft.approvalDate}
                  onChange={(value) => update("approvalDate", value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-drawdown-date">Drawdown Date</label>
                <DateField id="loan-drawdown-date" value={draft.drawdownDate}
                  onChange={(value) => update("drawdownDate", value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-maturity-date">Maturity Date</label>
                <DateField id="loan-maturity-date" value={draft.maturityDate}
                  onChange={(value) => update("maturityDate", value)} />
              </div>
              <div className="form-row">
                <label htmlFor="loan-next-review">Next Review Date</label>
                <DateField id="loan-next-review" value={draft.nextReviewDate}
                  onChange={(value) => update("nextReviewDate", value)} />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Remarks</strong>
              <span>Credit notes and deal context</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row" style={{ gridColumn: "1 / -1" }}>
                <label htmlFor="loan-remarks">Remarks</label>
                <textarea
                  id="loan-remarks"
                  className="field"
                  rows={3}
                  value={draft.remarks}
                  placeholder="Key credit considerations, syndication notes, conditions precedent..."
                  onChange={(event) => update("remarks", event.target.value)}
                />
              </div>
            </div>
          </section>
      </div>
    </section>
  );
}

function DealsWorkspace({
  moduleKey = "deals",
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  moduleKey?: ProductPipelineModuleKey;
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const config = PRODUCT_PIPELINE_CONFIGS[moduleKey];
  const columns = useMemo(() => buildDealColumns(config), [config]);
  const filters = useMemo(() => buildDealFilters(config), [config]);
  const kanbanFilters = useMemo(() => buildKanbanDealFilters(config), [config]);
  const { activeTab } = useContext(ModuleViewTabContext);
  const actionsHost = useContext(ModuleViewActionsHostContext);
  const { filtersOpen } = useContext(ModuleFilterPanelContext);
  const [dealRows, setDealRows] = useState(() => [...getPipelineLoans(moduleKey)]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deal | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [returnToHome, setReturnToHome] = useState(false);
  const facilityCountByLoanId = useMemo(() => {
    if (moduleKey !== "deals") return null;
    const counts = new Map<string, number>();
    for (const facility of loanFacilities) {
      counts.set(facility.loanId, (counts.get(facility.loanId) ?? 0) + 1);
    }
    return counts;
  }, [moduleKey]);

  // The shared store needs the resolved rows, so track them in a ref rather than
  // reading the render-scoped state, which would drop batched updates.
  const committedDealRows = useRef(dealRows);

  function commitDealRows(updater: Deal[] | ((prev: Deal[]) => Deal[])) {
    const next = typeof updater === "function" ? updater(committedDealRows.current) : updater;
    committedDealRows.current = next;
    setDealRows(next);
    setPipelineLoans(moduleKey, next);
  }

  useEffect(() => {
    const rows = [...getPipelineLoans(moduleKey)];
    committedDealRows.current = rows;
    setDealRows(rows);
    setCreating(false);
    setEditing(null);
    setImportOpen(false);
  }, [moduleKey]);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing(null);
    setCreating(true);
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = dealRows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setCreating(false);
      setEditing({ ...record });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, dealRows]);

  function dismissForm() {
    setCreating(false);
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  function renderDealCell(deal: Deal, column: ColumnDef) {
    if (column.key === "select") {
      return (
        <RowSelectCell
          context={{
            id: deal.id,
            label: deal.name,
            relatedTo: deal.account,
          }}
          onEdit={() => {
            setCreating(false);
            setEditing({ ...deal });
            setReturnToHome(false);
          }}
          onDelete={() => commitDealRows((prev) => prev.filter((item) => item.id !== deal.id))}
        />
      );
    }
    if (column.key === "amount") return formatLoanAmount(deal.currency, deal.amount);
    if (column.key === "interestRate") return `${deal.interestRate}%`;
    if (column.key === "utilizationPct") return `${deal.utilizationPct}%`;
    if (column.key === "tenorMonths") return String(deal.tenorMonths);
    if (column.key === "syndicated") return deal.syndicated ? "Yes" : "No";
    const value = deal[column.key as keyof Deal];
    return value == null || value === "" ? "" : String(value);
  }

  if (creating || editing) {
    return (
      <LoanFormPage
        key={editing?.id ?? `create-${moduleKey}`}
        loan={editing ?? createEmptyLoan(config)}
        mode={editing ? "edit" : "create"}
        config={config}
        onClose={dismissForm}
        onSave={(next) => {
          commitDealRows((prev) => {
            const index = prev.findIndex((item) => item.id === next.id);
            if (index < 0) return [next, ...prev];
            const copy = [...prev];
            copy[index] = next;
            return copy;
          });
        }}
      />
    );
  }

  const dealModals = importOpen ? (
    <ImportDealsModal
      config={config}
      existing={dealRows}
      onClose={() => setImportOpen(false)}
      onImport={(created, updated) => {
        const sync = (deal: Deal): Deal => ({
          ...deal,
          probability: config.stageProbability[deal.stage] ?? deal.probability,
        });
        commitDealRows((prev) => {
          const updatedById = new Map(updated.map((deal) => [deal.id, sync(deal)]));
          const merged = prev.map((deal) => updatedById.get(deal.id) ?? deal);
          return [...created.map(sync), ...merged];
        });
      }}
    />
  ) : null;

  if (activeTab === "Kanban") {
    return (
      <>
        {actionsHost
          ? createPortal(
              <>
                <ListCreateButton
                  createLabel={`Create ${config.recordLabel}`}
                  importLabel={`Import ${config.label}`}
                  onCreate={() => {
                    setEditing(null);
                    setCreating(true);
                    setReturnToHome(false);
                  }}
                  onImport={() => setImportOpen(true)}
                />
                <LoanStageBar loans={dealRows} stages={config.stages} ariaLabel={`${config.label} stages`} />
              </>,
              actionsHost,
            )
          : null}
        <div className={`record-layout ${filtersOpen ? "" : "is-filters-hidden"}`}>
          {filtersOpen ? (
            <FilterPanel title={`Filter ${config.label} by`} filters={kanbanFilters} />
          ) : null}
          <LoanKanbanBoard
            loans={dealRows}
            stages={config.stages}
            onOpenLoan={(loan) => {
              setCreating(false);
              setEditing({ ...loan });
              setReturnToHome(false);
            }}
          />
        </div>
        {dealModals}
      </>
    );
  }

  return (
    <>
      <RecordListShell
        title={`All ${config.label}`}
        filters={filters}
        data={dealRows}
        columns={columns}
        getCellValue={getDealCellValue}
        createLabel={`Create ${config.recordLabel}`}
        importLabel={`Import ${config.label}`}
        onCreate={() => {
          setEditing(null);
          setCreating(true);
          setReturnToHome(false);
        }}
        onImport={() => setImportOpen(true)}
        onExport={(rows) => exportDeals(config, rows)}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((deal) => (
              <tr
                key={deal.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setCreating(false);
                  setEditing({ ...deal });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        {renderDealCell(deal, column)}
                      </td>
                    );
                  }
                  if (column.key === "name" && facilityCountByLoanId) {
                    const facilityCount = facilityCountByLoanId.get(deal.id) ?? 0;
                    return (
                      <td key={column.key}>
                        <span className="loan-name-with-count">
                          {deal.name}
                          {facilityCount > 0 ? (
                            <span
                              className="loan-facility-count"
                              title={`${facilityCount} Loan Facilit${facilityCount === 1 ? "y" : "ies"}`}
                            >
                              {facilityCount}
                            </span>
                          ) : null}
                        </span>
                      </td>
                    );
                  }
                  if (column.type === "enum" && column.colorable !== false) {
                    const raw = deal[column.key as keyof Deal];
                    const value = raw == null || raw === "" ? null : String(raw);
                    return <EnumFillTd key={column.key} column={column} value={value} />;
                  }
                  return <td key={column.key}>{renderDealCell(deal, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {dealModals}
    </>
  );
}

function CalendarWorkspace() {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);
  return (
    <section className="card" style={{ padding: 18 }}>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <h3>My Calendar · July 2026</h3>
        <div className="pill-tabs">
          <span className="pill">Day</span>
          <span className="pill">Week</span>
          <span className="pill active">Month</span>
          <button className="primary-button">Create</button>
          <button className="secondary-button">Options</button>
        </div>
      </div>
      <div className="calendar-grid">
        {["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map((day) => (
          <div className="calendar-cell" key={day}>
            <strong>{day}</strong>
          </div>
        ))}
        {days.map((day) => (
          <div className="calendar-cell" key={day}>
            <span>{day}</span>
            {day === 28 && <p className="row-tag green">3 meetings</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

const CAMPAIGN_TYPE_OPTIONS: CampaignType[] = [
  "Product Launch",
  "Client Acquisition",
  "Cross-Sell / Upsell",
  "Event / Seminar",
  "Digital / Email",
  "Partner Referral",
  "Conference",
  "Telemarketing",
  "Other",
];

const CAMPAIGN_STATUS_OPTIONS: CampaignStatus[] = [
  "Planning",
  "Active",
  "Inactive",
  "Completed",
  "Aborted",
];

const CAMPAIGN_CHANNEL_OPTIONS: CampaignChannel[] = [
  "Email",
  "Webinar",
  "In-Person Event",
  "Phone",
  "Partner",
  "Social / Digital Ads",
  "Direct Mail",
  "Mixed",
];

const campaignColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "name", header: "Campaign Name", type: "text" },
  { key: "code", header: "Campaign Code", type: "text" },
  {
    key: "type",
    header: "Type",
    type: "enum",
    enumOptions: [...CAMPAIGN_TYPE_OPTIONS],
    colorGroup: "soft",
  },
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: [...CAMPAIGN_STATUS_OPTIONS],
    colorable: false,
  },
  {
    key: "channel",
    header: "Channel",
    type: "enum",
    enumOptions: [...CAMPAIGN_CHANNEL_OPTIONS],
    colorable: false,
  },
  {
    key: "businessUnit",
    header: "Business Unit",
    type: "enum",
    enumOptions: [...LOAN_BUSINESS_UNIT_OPTIONS],
    colorable: false,
  },
  {
    key: "targetSegment",
    header: "Target Segment",
    type: "enum",
    enumOptions: [...SEGMENT_OPTIONS],
    colorGroup: "soft",
  },
  {
    key: "targetRegion",
    header: "Target Region",
    type: "enum",
    enumOptions: [...REGION_OPTIONS],
    colorable: false,
  },
  {
    key: "targetProduct",
    header: "Target Product",
    type: "enum",
    enumOptions: [...LOAN_PRODUCT_OPTIONS],
    colorable: false,
  },
  { key: "expectedRevenue", header: "Expected Revenue", type: "text" },
  { key: "budgetedCost", header: "Budgeted Cost", type: "text" },
  { key: "actualCost", header: "Actual Cost", type: "text" },
  { key: "leadsGenerated", header: "Leads Generated", type: "text" },
  { key: "convertedCount", header: "Converted", type: "text" },
  { key: "expectedResponsePct", header: "Expected Response %", type: "text" },
  { key: "startDate", header: "Start Date", type: "date" },
  { key: "endDate", header: "End Date", type: "date" },
  { key: "owner", header: "Campaign Owner", type: "text" },
];

const campaignFilters = [
  "Campaign Name",
  "Campaign Code",
  "Type",
  "Status",
  "Channel",
  "Business Unit",
  "Target Segment",
  "Target Region",
  "Target Product",
  "Expected Revenue",
  "Budgeted Cost",
  "Actual Cost",
  "Leads Generated",
  "Converted",
  "Expected Response %",
  "Start Date",
  "End Date",
  "Campaign Owner",
];

function formatCampaignMoney(currency: Campaign["currency"], amount: number) {
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

function getCampaignCellValue(row: Campaign, key: string) {
  if (key === "expectedRevenue") return row.expectedRevenue;
  if (key === "budgetedCost") return row.budgetedCost;
  if (key === "actualCost") return row.actualCost;
  if (key === "leadsGenerated") return row.leadsGenerated;
  if (key === "convertedCount") return row.convertedCount;
  if (key === "expectedResponsePct") return row.expectedResponsePct;
  if (key === "numSent") return row.numSent;
  const value = row[key as keyof Campaign];
  if (value == null) return "";
  return value as string | number;
}

function createEmptyCampaign(): Campaign {
  const year = new Date().getFullYear();
  return {
    id: `camp-${Date.now()}`,
    name: "",
    code: `CMP-${year}-`,
    owner: "Jenny",
    type: "Client Acquisition",
    status: "Planning",
    channel: "Mixed",
    businessUnit: "Corporate Banking",
    targetSegment: null,
    targetRegion: null,
    targetProduct: null,
    currency: "HKD",
    startDate: "",
    endDate: "",
    expectedRevenue: 0,
    budgetedCost: 0,
    actualCost: 0,
    expectedResponsePct: 0,
    numSent: 0,
    leadsGenerated: 0,
    convertedCount: 0,
    description: "",
  };
}

type CampaignImportFieldKey = Exclude<keyof Campaign, "id">;

const CAMPAIGN_IMPORT_FIELDS: ImportFieldDef<CampaignImportFieldKey>[] = [
  { key: "name", label: "Campaign Name", required: true, sample: "SME Working Capital Drive" },
  { key: "code", label: "Campaign Code", required: true, sample: "CMP-2026-001" },
  { key: "owner", label: "Campaign Owner", sample: "Jenny" },
  { key: "type", label: "Type", options: CAMPAIGN_TYPE_OPTIONS, sample: "Client Acquisition" },
  { key: "status", label: "Status", options: CAMPAIGN_STATUS_OPTIONS, sample: "Planning" },
  { key: "channel", label: "Channel", options: CAMPAIGN_CHANNEL_OPTIONS, sample: "Email" },
  {
    key: "businessUnit",
    label: "Business Unit",
    options: LOAN_BUSINESS_UNIT_OPTIONS,
    sample: "Corporate Banking",
  },
  { key: "targetSegment", label: "Target Segment", options: SEGMENT_OPTIONS, sample: "SME" },
  { key: "targetRegion", label: "Target Region", options: REGION_OPTIONS, sample: "Hong Kong" },
  {
    key: "targetProduct",
    label: "Target Product",
    options: LOAN_PRODUCT_OPTIONS,
    sample: "Term Loan",
  },
  { key: "currency", label: "Currency", options: LOAN_CURRENCY_OPTIONS, sample: "HKD" },
  { key: "startDate", label: "Start Date", sample: "2026-08-01" },
  { key: "endDate", label: "End Date", sample: "2026-09-30" },
  { key: "expectedRevenue", label: "Expected Revenue", kind: "number", sample: "5000000" },
  { key: "budgetedCost", label: "Budgeted Cost", kind: "number", sample: "250000" },
  { key: "actualCost", label: "Actual Cost", kind: "number", sample: "120000" },
  { key: "expectedResponsePct", label: "Expected Response %", kind: "number", sample: "8" },
  { key: "numSent", label: "Num Sent", kind: "number", sample: "1200" },
  { key: "leadsGenerated", label: "Leads Generated", kind: "number", sample: "96" },
  { key: "convertedCount", label: "Converted", kind: "number", sample: "18" },
  { key: "description", label: "Description", sample: "Outbound campaign for SME working capital." },
];

function exportCampaigns(rows: Campaign[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`event-trigger-export-${stamp}.csv`, CAMPAIGN_IMPORT_FIELDS, rows);
}

function ImportCampaignsModal({
  existing,
  onClose,
  onImport,
}: {
  existing: Campaign[];
  onClose: () => void;
  onImport: (created: Campaign[], updated: Campaign[]) => void;
}) {
  return (
    <ImportRecordsModal
      moduleLabel="Event Trigger"
      recordLabel="Campaign"
      fields={CAMPAIGN_IMPORT_FIELDS}
      matchKey="code"
      matchLabel="Campaign Code"
      existing={existing}
      getMatchValue={(campaign) => campaign.code}
      createEmpty={createEmptyCampaign}
      makeId={(index) => `camp-import-${Date.now()}-${index}`}
      templateFilename="event-trigger-import-template.csv"
      onClose={onClose}
      onImport={onImport}
    />
  );
}

type CampaignFormDraft = Omit<
  Campaign,
  "type" | "status" | "channel" | "businessUnit" | "targetSegment" | "targetRegion" | "targetProduct" | "currency"
> & {
  type: CampaignType | null;
  status: CampaignStatus | null;
  channel: CampaignChannel | null;
  businessUnit: LoanBusinessUnit | null;
  targetSegment: ClientSegment | null;
  targetRegion: ClientRegion | null;
  targetProduct: Deal["productType"] | null;
  currency: Deal["currency"] | null;
};

function CampaignFormPage({
  campaign,
  mode,
  onClose,
  onSave,
}: {
  campaign: Campaign;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (campaign: Campaign) => void;
}) {
  const [draft, setDraft] = useState<CampaignFormDraft>(() => ({ ...campaign }));
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !draft.name.trim();
  const typeError = attempted && draft.type == null;
  const statusError = attempted && draft.status == null;

  function update<K extends keyof CampaignFormDraft>(key: K, value: CampaignFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function updateNumber(
    key:
      | "expectedRevenue"
      | "budgetedCost"
      | "actualCost"
      | "expectedResponsePct"
      | "numSent"
      | "leadsGenerated"
      | "convertedCount",
    value: string,
  ) {
    update(key, Number(value) || 0);
  }

  function handleSave() {
    setAttempted(true);
    if (!draft.name.trim() || draft.type == null || draft.status == null) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      type: draft.type,
      status: draft.status,
      channel: draft.channel ?? "Mixed",
      businessUnit: draft.businessUnit ?? "Corporate Banking",
      currency: draft.currency ?? "HKD",
    });
    onClose();
  }

  return (
    <section className="client-form-page">
      <header className="client-form-header">
        <div>
          <button type="button" className="client-form-back" onClick={onClose}>
            <ChevronLeft size={14} />
            Campaigns
          </button>
          <h2>
            {mode === "create" ? "Create Campaign" : campaign.name.trim() || "Edit Campaign"}
          </h2>
        </div>
        <div className="client-form-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            Save
          </button>
        </div>
      </header>

      <div className="client-form-body">
          <section className={`client-form-section ${nameError || typeError || statusError ? "is-invalid" : ""}`}>
            <div className="client-form-section-head">
              <strong>Campaign Information</strong>
              <span>Identity, ownership and lifecycle</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${nameError ? "is-invalid" : ""}`}>
                <label htmlFor="camp-name">
                  Campaign Name <span className="field-required">*</span>
                </label>
                <input
                  id="camp-name"
                  className={`field ${nameError ? "is-invalid" : ""}`}
                  value={draft.name}
                  placeholder="e.g. Q3 Working Capital Drive"
                  onChange={(event) => update("name", event.target.value)}
                />
                {nameError ? <p className="field-error">Campaign Name is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="camp-code">Campaign Code</label>
                <input
                  id="camp-code"
                  className="field"
                  value={draft.code}
                  placeholder="CMP-2026-001"
                  onChange={(event) => update("code", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-owner">Campaign Owner</label>
                <input
                  id="camp-owner"
                  className="field"
                  value={draft.owner}
                  placeholder="Enter owner"
                  onChange={(event) => update("owner", event.target.value)}
                />
              </div>
              <div className={`form-row ${typeError ? "is-invalid" : ""}`}>
                <label>
                  Type <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="camp-type"
                  options={CAMPAIGN_TYPE_OPTIONS}
                  value={draft.type}
                  onChange={(value) => update("type", value)}
                  ariaLabel="Campaign Type"
                  invalid={typeError}
                  allowClear={false}
                />
                {typeError ? <p className="field-error">Type is required.</p> : null}
              </div>
              <div className={`form-row ${statusError ? "is-invalid" : ""}`}>
                <label>
                  Status <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="camp-status"
                  options={CAMPAIGN_STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(value) => update("status", value)}
                  ariaLabel="Campaign Status"
                  invalid={statusError}
                  allowClear={false}
                />
                {statusError ? <p className="field-error">Status is required.</p> : null}
              </div>
              <div className="form-row">
                <label>Channel</label>
                <ChoiceField
                  name="camp-channel"
                  options={CAMPAIGN_CHANNEL_OPTIONS}
                  value={draft.channel}
                  onChange={(value) => update("channel", value)}
                  ariaLabel="Campaign Channel"
                />
              </div>
              <div className="form-row">
                <label>Start Date</label>
                <DateField
                  id="camp-start-date"
                  value={draft.startDate}
                  onChange={(value) => update("startDate", value)}
                />
              </div>
              <div className="form-row">
                <label>End Date</label>
                <DateField
                  id="camp-end-date"
                  value={draft.endDate}
                  onChange={(value) => update("endDate", value)}
                />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Targeting</strong>
              <span>Audience, product and coverage</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label>Business Unit</label>
                <ChoiceField
                  name="camp-bu"
                  options={LOAN_BUSINESS_UNIT_OPTIONS}
                  value={draft.businessUnit}
                  onChange={(value) => update("businessUnit", value)}
                  ariaLabel="Business Unit"
                />
              </div>
              <div className="form-row">
                <label>Target Segment</label>
                <ChoiceField
                  name="camp-segment"
                  options={SEGMENT_OPTIONS}
                  value={draft.targetSegment}
                  onChange={(value) => update("targetSegment", value)}
                  ariaLabel="Target Segment"
                />
              </div>
              <div className="form-row">
                <label>Target Region</label>
                <ChoiceField
                  name="camp-region"
                  options={REGION_OPTIONS}
                  value={draft.targetRegion}
                  onChange={(value) => update("targetRegion", value)}
                  ariaLabel="Target Region"
                />
              </div>
              <div className="form-row">
                <label>Target Product</label>
                <ChoiceField
                  name="camp-product"
                  options={LOAN_PRODUCT_OPTIONS}
                  value={draft.targetProduct}
                  onChange={(value) => update("targetProduct", value)}
                  ariaLabel="Target Product"
                />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Budget & Performance</strong>
              <span>Cost, revenue and conversion metrics</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label>Currency</label>
                <ChoiceField
                  name="camp-currency"
                  options={LOAN_CURRENCY_OPTIONS}
                  value={draft.currency}
                  onChange={(value) => update("currency", value)}
                  ariaLabel="Currency"
                  allowClear={false}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-expected-revenue">Expected Revenue</label>
                <input
                  id="camp-expected-revenue"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.expectedRevenue || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("expectedRevenue", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-budgeted-cost">Budgeted Cost</label>
                <input
                  id="camp-budgeted-cost"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.budgetedCost || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("budgetedCost", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-actual-cost">Actual Cost</label>
                <input
                  id="camp-actual-cost"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.actualCost || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("actualCost", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-expected-response">Expected Response %</label>
                <input
                  id="camp-expected-response"
                  className="field"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.expectedResponsePct || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("expectedResponsePct", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-num-sent">Num Sent</label>
                <input
                  id="camp-num-sent"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.numSent || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("numSent", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-leads">Leads Generated</label>
                <input
                  id="camp-leads"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.leadsGenerated || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("leadsGenerated", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="camp-converted">Converted</label>
                <input
                  id="camp-converted"
                  className="field"
                  type="number"
                  min={0}
                  value={draft.convertedCount || ""}
                  placeholder="0"
                  onChange={(event) => updateNumber("convertedCount", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Description</strong>
              <span>Campaign brief and notes</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row client-form-span-2">
                <label htmlFor="camp-description">Description</label>
                <textarea
                  id="camp-description"
                  className="field"
                  style={{ minHeight: 88 }}
                  value={draft.description}
                  placeholder="Describe campaign objective, audience and key messaging…"
                  onChange={(event) => update("description", event.target.value)}
                />
              </div>
            </div>
          </section>
      </div>
    </section>
  );
}

function CampaignWorkspace({
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState<Campaign[]>(() => [...campaigns]);
  const [editing, setEditing] = useState<{ campaign: Campaign; mode: "create" | "edit" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [returnToHome, setReturnToHome] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing({ campaign: createEmptyCampaign(), mode: "create" });
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = rows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setEditing({ campaign: { ...record }, mode: "edit" });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  function handleSave(next: Campaign) {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }

  function startCreate() {
    setEditing({ campaign: createEmptyCampaign(), mode: "create" });
    setReturnToHome(false);
  }

  function renderCampaignCell(row: Campaign, column: ColumnDef) {
    if (column.key === "select") {
      return (
        <RowSelectCell
          context={{
            id: row.id,
            label: row.name,
            relatedTo: row.name,
          }}
          onEdit={() => {
            setEditing({ campaign: { ...row }, mode: "edit" });
            setReturnToHome(false);
          }}
          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
        />
      );
    }
    if (column.key === "expectedRevenue") return formatCampaignMoney(row.currency, row.expectedRevenue);
    if (column.key === "budgetedCost") return formatCampaignMoney(row.currency, row.budgetedCost);
    if (column.key === "actualCost") return formatCampaignMoney(row.currency, row.actualCost);
    if (column.key === "expectedResponsePct") return `${row.expectedResponsePct}%`;
    const value = row[column.key as keyof Campaign];
    return value == null || value === "" ? "" : String(value);
  }

  if (editing) {
    return (
      <CampaignFormPage
        key={editing.mode === "create" ? "create-campaign" : editing.campaign.id}
        campaign={editing.campaign}
        mode={editing.mode}
        onClose={dismissForm}
        onSave={handleSave}
      />
    );
  }

  return (
    <>
      <RecordListShell
        title="All Campaigns"
        filters={campaignFilters}
        data={rows}
        columns={campaignColumns}
        getCellValue={getCampaignCellValue}
        createLabel="Create Campaign"
        importLabel="Import Campaigns"
        onCreate={startCreate}
        onImport={() => setImportOpen(true)}
        onExport={exportCampaigns}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setEditing({ campaign: { ...row }, mode: "edit" });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        {renderCampaignCell(row, column)}
                      </td>
                    );
                  }
                  if (column.type === "enum" && column.colorable !== false) {
                    const raw = row[column.key as keyof Campaign];
                    const value = raw == null || raw === "" ? null : String(raw);
                    return <EnumFillTd key={column.key} column={column} value={value} />;
                  }
                  return <td key={column.key}>{renderCampaignCell(row, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {importOpen ? (
        <ImportCampaignsModal
          existing={rows}
          onClose={() => setImportOpen(false)}
          onImport={(created, updated) => {
            setRows((prev) => {
              const updatedById = new Map(updated.map((campaign) => [campaign.id, campaign]));
              const merged = prev.map((campaign) => updatedById.get(campaign.id) ?? campaign);
              return [...created, ...merged];
            });
          }}
        />
      ) : null}
    </>
  );
}

const userColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "displayName", header: "Display Name", type: "text" },
  { key: "username", header: "Username", type: "text" },
  { key: "id", header: "User Id", type: "text" },
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: [...USER_STATUS_OPTIONS],
    colorGroup: "soft",
    optionColors: { Active: 0, Inactive: 6 },
  },
  {
    key: "role",
    header: "Role",
    type: "enum",
    enumOptions: [...USER_ROLE_OPTIONS],
    colorGroup: "vivid",
  },
  {
    key: "profile",
    header: "Profile",
    type: "enum",
    enumOptions: [...USER_PROFILE_OPTIONS],
    colorable: false,
  },
  {
    key: "bu",
    header: "BU",
    type: "enum",
    enumOptions: [...USER_BU_OPTIONS],
    colorable: false,
  },
  {
    key: "department",
    header: "Department",
    type: "enum",
    enumOptions: [...USER_DEPARTMENT_OPTIONS],
    colorable: false,
  },
  { key: "manager", header: "Manager", type: "text" },
  { key: "outlookEmail", header: "Outlook", type: "email" },
  { key: "mobile", header: "Mobile", type: "phone" },
  { key: "lastLogin", header: "Last Login", type: "text" },
];

function getUserCellValue(user: DemoUser, key: string) {
  if (key === "password") return "";
  const value = user[key as keyof DemoUser];
  if (value == null) return "";
  return value;
}

function createEmptyUser(): DemoUser {
  const nextId = String(100000 + Math.floor(Math.random() * 900000));
  return {
    id: nextId,
    username: "",
    password: "",
    displayName: "",
    bu: "CBA-A-A1",
    role: "RM",
    profile: "Standard",
    status: "Active",
    outlookEmail: "",
    mobile: "",
    manager: "",
    department: "Corporate Banking",
    lastLogin: "",
  };
}

type UserFormDraft = Omit<DemoUser, "status" | "role" | "profile" | "bu" | "department"> & {
  status: UserStatus | null;
  role: UserRole | null;
  profile: UserProfile | null;
  bu: (typeof USER_BU_OPTIONS)[number] | null;
  department: (typeof USER_DEPARTMENT_OPTIONS)[number] | null;
};

function UserFormModal({
  user,
  mode,
  onClose,
  onSave,
}: {
  user: DemoUser;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (next: DemoUser) => void;
}) {
  const [draft, setDraft] = useState<UserFormDraft>(() => {
    if (mode === "create") {
      return { ...user, status: null, role: null, profile: null, bu: null, department: null };
    }
    return {
      ...user,
      password: "",
      bu: (USER_BU_OPTIONS as readonly string[]).includes(user.bu)
        ? (user.bu as (typeof USER_BU_OPTIONS)[number])
        : null,
      department: (USER_DEPARTMENT_OPTIONS as readonly string[]).includes(user.department)
        ? (user.department as (typeof USER_DEPARTMENT_OPTIONS)[number])
        : null,
    };
  });
  const [attempted, setAttempted] = useState(false);

  const displayNameError = attempted && !draft.displayName.trim();
  const usernameError = attempted && !draft.username.trim();
  const statusError = attempted && !draft.status;
  const roleError = attempted && !draft.role;
  const profileError = attempted && !draft.profile;
  const buError = attempted && !draft.bu;
  const outlookError = attempted && !draft.outlookEmail.trim();
  const passwordError = attempted && mode === "create" && !draft.password.trim();

  function update<K extends keyof UserFormDraft>(key: K, value: UserFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    setAttempted(true);
    const displayName = draft.displayName.trim();
    const username = draft.username.trim();
    const outlookEmail = draft.outlookEmail.trim();
    const password = draft.password.trim();
    if (
      !displayName ||
      !username ||
      !draft.status ||
      !draft.role ||
      !draft.profile ||
      !draft.bu ||
      !outlookEmail ||
      (mode === "create" && !password)
    ) {
      return;
    }
    onSave({
      ...draft,
      displayName,
      username,
      outlookEmail,
      password: password || user.password,
      status: draft.status,
      role: draft.role,
      profile: draft.profile,
      bu: draft.bu,
      department: draft.department ?? "",
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card client-form-modal" onClick={(event) => event.stopPropagation()}>
        <header className="client-form-header">
          <div>
            <p className="client-form-eyebrow">Users</p>
            <h2>{mode === "create" ? "Create User" : "Edit User"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="client-form-body">
          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Identity</strong>
              <span>Login and display details</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${displayNameError ? "is-invalid" : ""}`}>
                <label htmlFor="user-display-name">
                  Display Name <span className="field-required">*</span>
                </label>
                <input
                  id="user-display-name"
                  className={`field ${displayNameError ? "is-invalid" : ""}`}
                  placeholder="Enter display name"
                  value={draft.displayName}
                  aria-required="true"
                  aria-invalid={displayNameError}
                  onChange={(event) => update("displayName", event.target.value)}
                />
                {displayNameError ? <p className="field-error">Display Name is required.</p> : null}
              </div>
              <div className={`form-row ${usernameError ? "is-invalid" : ""}`}>
                <label htmlFor="user-username">
                  Username <span className="field-required">*</span>
                </label>
                <input
                  id="user-username"
                  className={`field ${usernameError ? "is-invalid" : ""}`}
                  placeholder="Enter username"
                  value={draft.username}
                  aria-required="true"
                  aria-invalid={usernameError}
                  onChange={(event) => update("username", event.target.value)}
                />
                {usernameError ? <p className="field-error">Username is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="user-id">User Id</label>
                <input
                  id="user-id"
                  className="field"
                  value={draft.id}
                  readOnly
                  aria-readonly="true"
                />
              </div>
              <div className={`form-row ${passwordError ? "is-invalid" : ""}`}>
                <label htmlFor="user-password">
                  Password {mode === "create" ? <span className="field-required">*</span> : null}
                </label>
                <input
                  id="user-password"
                  className={`field ${passwordError ? "is-invalid" : ""}`}
                  type="password"
                  placeholder={mode === "create" ? "Set password" : "Leave blank to keep current"}
                  value={draft.password}
                  aria-required={mode === "create"}
                  aria-invalid={passwordError}
                  onChange={(event) => update("password", event.target.value)}
                />
                {passwordError ? <p className="field-error">Password is required.</p> : null}
              </div>
            </div>
          </section>

          <section
            className={`client-form-section ${statusError || roleError || profileError || buError ? "is-invalid" : ""}`}
          >
            <div className="client-form-section-head">
              <strong>
                Organization <span className="field-required">*</span>
              </strong>
              <span>Business unit, role, and access profile</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label>
                  Status <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="userStatus"
                  options={USER_STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(next) => update("status", next)}
                  ariaLabel="Status"
                  invalid={statusError}
                  getOptionClass={(option) =>
                    `choice-chip-account-status choice-chip-account-status-${optionSlug(option)}`
                  }
                />
                {statusError ? <p className="field-error">Status is required.</p> : null}
              </div>
              <div className="form-row">
                <label>
                  Role <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="userRole"
                  options={USER_ROLE_OPTIONS}
                  value={draft.role}
                  onChange={(next) => update("role", next)}
                  ariaLabel="Role"
                  invalid={roleError}
                />
                {roleError ? <p className="field-error">Role is required.</p> : null}
              </div>
              <div className="form-row">
                <label>
                  Profile <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="userProfile"
                  options={USER_PROFILE_OPTIONS}
                  value={draft.profile}
                  onChange={(next) => update("profile", next)}
                  ariaLabel="Profile"
                  invalid={profileError}
                />
                {profileError ? <p className="field-error">Profile is required.</p> : null}
              </div>
              <div className="form-row">
                <label>
                  BU <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="userBu"
                  options={USER_BU_OPTIONS}
                  value={draft.bu}
                  onChange={(next) => update("bu", next)}
                  ariaLabel="BU"
                  invalid={buError}
                />
                {buError ? <p className="field-error">BU is required.</p> : null}
              </div>
              <div className="form-row">
                <label>Department</label>
                <ChoiceField
                  name="userDepartment"
                  options={USER_DEPARTMENT_OPTIONS}
                  value={draft.department}
                  onChange={(next) => update("department", next)}
                  ariaLabel="Department"
                />
              </div>
              <div className="form-row">
                <label htmlFor="user-manager">Manager</label>
                <input
                  id="user-manager"
                  className="field"
                  placeholder="Enter manager display name"
                  value={draft.manager}
                  onChange={(event) => update("manager", event.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Contact</strong>
              <span>Outlook and mobile</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${outlookError ? "is-invalid" : ""}`}>
                <label htmlFor="user-outlook">
                  Outlook <span className="field-required">*</span>
                </label>
                <input
                  id="user-outlook"
                  className={`field ${outlookError ? "is-invalid" : ""}`}
                  type="email"
                  placeholder="name@cba.outlook.com"
                  value={draft.outlookEmail}
                  aria-required="true"
                  aria-invalid={outlookError}
                  onChange={(event) => update("outlookEmail", event.target.value)}
                />
                {outlookError ? <p className="field-error">Outlook is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="user-mobile">Mobile</label>
                <input
                  id="user-mobile"
                  className="field"
                  type="tel"
                  placeholder="+852 9000 0000"
                  value={draft.mobile}
                  onChange={(event) => update("mobile", event.target.value)}
                />
              </div>
              {mode === "edit" ? (
                <div className="form-row">
                  <label htmlFor="user-last-login">Last Login</label>
                  <input
                    id="user-last-login"
                    className="field"
                    value={draft.lastLogin || "—"}
                    readOnly
                    aria-readonly="true"
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <footer className="client-form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            {mode === "create" ? "Create User" : "Save"}
          </button>
        </footer>
      </section>
    </div>
  );
}


type UserImportFieldKey = Exclude<keyof DemoUser, "id" | "password" | "lastLogin">;

const USER_IMPORT_FIELDS: ImportFieldDef<UserImportFieldKey>[] = [
  { key: "displayName", label: "Display Name", required: true, sample: "Alice Chan" },
  { key: "username", label: "Username", required: true, sample: "alice.chan" },
  { key: "status", label: "Status", options: USER_STATUS_OPTIONS, sample: "Active" },
  { key: "role", label: "Role", options: USER_ROLE_OPTIONS, sample: "RM" },
  { key: "profile", label: "Profile", options: USER_PROFILE_OPTIONS, sample: "Standard" },
  { key: "bu", label: "BU", options: USER_BU_OPTIONS, sample: "CBA-A-A1" },
  { key: "department", label: "Department", options: USER_DEPARTMENT_OPTIONS, sample: "Corporate Banking" },
  { key: "manager", label: "Manager", sample: "Jenny" },
  { key: "outlookEmail", label: "Outlook", sample: "alice.chan@example.com" },
  { key: "mobile", label: "Mobile", sample: "+852 9000 2002" },
];

function exportUsers(rows: DemoUser[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`users-export-${stamp}.csv`, USER_IMPORT_FIELDS, rows);
}

function ImportUsersModal({
  existing,
  onClose,
  onImport,
}: {
  existing: DemoUser[];
  onClose: () => void;
  onImport: (created: DemoUser[], updated: DemoUser[]) => void;
}) {
  return (
    <ImportRecordsModal
      moduleLabel="Users"
      recordLabel="User"
      fields={USER_IMPORT_FIELDS}
      matchKey="username"
      matchLabel="Username"
      existing={existing}
      getMatchValue={(user) => user.username}
      createEmpty={createEmptyUser}
      makeId={(index) => String(200000 + index)}
      templateFilename="users-import-template.csv"
      onClose={onClose}
      onImport={onImport}
    />
  );
}

function UsersWorkspace({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<DemoUser[]>(() => demoUsers.map((user) => ({ ...user })));
  const [editing, setEditing] = useState<{ user: DemoUser; mode: "create" | "edit" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  function handleSave(next: DemoUser) {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }

  function renderUserCell(user: DemoUser, column: ColumnDef) {
    if (column.key === "select") {
      return (
        <RowSelectCell
          context={{
            id: user.id,
            label: user.displayName,
            email: user.outlookEmail,
            phone: user.mobile,
            relatedTo: user.username,
          }}
          onEdit={() => setEditing({ user: { ...user }, mode: "edit" })}
          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== user.id))}
        />
      );
    }
    const value = user[column.key as keyof DemoUser];
    return value == null || value === "" ? "" : String(value);
  }

  return (
    <>
      <div className="page-header" style={{ marginBottom: 14 }}>
        <div>
          <button
            type="button"
            className="secondary-button"
            onClick={onBack}
            style={{ marginBottom: 8, display: "inline-flex", alignItems: "center", gap: 4 }}
          >
            <ChevronLeft size={14} /> Setup
          </button>
          <h2 style={{ margin: 0 }}>Users</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            All CRM users, organization assignment, and access profiles.
          </p>
        </div>
      </div>
      <RecordListShell
        title="All Users"
        filters={[
          "Display Name",
          "Username",
          "User Id",
          "Status",
          "Role",
          "Profile",
          "BU",
          "Department",
          "Manager",
          "Outlook",
          "Mobile",
        ]}
        data={rows}
        columns={userColumns}
        getCellValue={getUserCellValue}
        createLabel="Create User"
        importLabel="Import Users"
        onCreate={() => setEditing({ user: createEmptyUser(), mode: "create" })}
        onImport={() => setImportOpen(true)}
        onExport={exportUsers}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((user) => (
              <tr
                key={user.id}
                className="is-row-interactive"
                onDoubleClick={() => setEditing({ user: { ...user }, mode: "edit" })}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        {renderUserCell(user, column)}
                      </td>
                    );
                  }
                  if (column.type === "enum" && column.colorable !== false) {
                    const raw = user[column.key as keyof DemoUser];
                    const value = raw == null || raw === "" ? null : String(raw);
                    return <EnumFillTd key={column.key} column={column} value={value} />;
                  }
                  return <td key={column.key}>{renderUserCell(user, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {importOpen ? (
        <ImportUsersModal
          existing={rows}
          onClose={() => setImportOpen(false)}
          onImport={(created, updated) => {
            setRows((prev) => {
              const updatedById = new Map(updated.map((user) => [user.id, user]));
              const merged = prev.map((user) => updatedById.get(user.id) ?? user);
              return [...created, ...merged];
            });
          }}
        />
      ) : null}
      {editing ? (
        <UserFormModal
          user={editing.user}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}
    </>
  );
}

function AdminWorkspace({
  query,
  onQueryChange,
  onShowWorkflow,
  onOpenUsers,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onShowWorkflow: () => void;
  onOpenUsers: () => void;
}) {
  const filteredGroups = adminGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const needle = query.trim().toLowerCase();
        if (!needle) return true;
        return group.title.toLowerCase().includes(needle) || item.toLowerCase().includes(needle);
      }),
    }))
    .filter((group) => group.items.length > 0);

  function handleAdminItem(item: string) {
    if (item === "Workflow Rules") onShowWorkflow();
    if (item === "Users") onOpenUsers();
  }

  return (
    <section>
      <div className="admin-toolbar">
        <div style={{ position: "relative", width: 280 }}>
          <Search size={15} style={{ color: "var(--muted)", left: 10, position: "absolute", top: 10 }} />
          <input
            className="toolbar-search"
            placeholder="Search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
      </div>
      <div className="admin-grid">
        {filteredGroups.map((group) => (
          <article className="admin-card" key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <p key={item}>
                <button
                  type="button"
                  onClick={
                    item === "Workflow Rules" || item === "Users"
                      ? () => handleAdminItem(item)
                      : undefined
                  }
                >
                  {item}
                </button>
              </p>
            ))}
          </article>
        ))}
      </div>
    </section>
  );
}


function WorkflowModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <section className="modal-card">
        <div className="page-header">
          <h2>Select Template</h2>
          <button className="icon-button" onClick={onClose}>
            x
          </button>
        </div>
        <div className="form-grid">
          <select className="field">
            <option>All Templates</option>
          </select>
          <input className="field" placeholder="Search templates" />
        </div>
        <p className="muted" style={{ margin: "36px 0", textAlign: "center" }}>
          No results found
        </p>
        <div className="related-card">
          <strong>Rule preview</strong>
          {workflowRules.map((rule) => (
            <p key={rule.name}>
              {rule.module}: {rule.condition} → {rule.action}
            </p>
          ))}
        </div>
        <div className="pill-tabs" style={{ justifyContent: "flex-end" }}>
          <button className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button">Save and Associate</button>
        </div>
      </section>
    </div>
  );
}

const CONTACT_STATUS_OPTIONS: ContactStatus[] = ["Active", "Inactive"];

const CONTACT_ROLE_OPTIONS: ContactRole[] = [
  "Primary Contact",
  "Decision Maker",
  "Treasury",
  "CFO / Finance",
  "Legal / Compliance",
  "Operations",
  "Other",
];

const CONTACT_CHANNEL_OPTIONS: ContactPreferredChannel[] = [
  "Email",
  "Phone",
  "Mobile",
  "In-Person",
  "WeChat / Instant Message",
];

const contactColumns: ColumnDef[] = [
  { key: "select", header: "", type: "checkbox" },
  { key: "name", header: "Contact Name", type: "text" },
  { key: "title", header: "Job Title", type: "text" },
  { key: "account", header: "Client", type: "text" },
  {
    key: "status",
    header: "Status",
    type: "enum",
    enumOptions: [...CONTACT_STATUS_OPTIONS],
    colorable: false,
  },
  {
    key: "role",
    header: "Role",
    type: "enum",
    enumOptions: [...CONTACT_ROLE_OPTIONS],
    colorable: false,
  },
  { key: "email", header: "Email", type: "email" },
  { key: "phone", header: "Phone", type: "phone" },
  { key: "mobile", header: "Mobile", type: "phone" },
  { key: "department", header: "Department", type: "text" },
  {
    key: "preferredChannel",
    header: "Preferred Channel",
    type: "enum",
    enumOptions: [...CONTACT_CHANNEL_OPTIONS],
    colorable: false,
  },
  {
    key: "region",
    header: "Region",
    type: "enum",
    enumOptions: [...REGION_OPTIONS],
    colorable: false,
  },
  { key: "decisionMaker", header: "Decision Maker", type: "text" },
  { key: "owner", header: "Owner", type: "text" },
  { key: "lastContacted", header: "Last Contacted", type: "date" },
];

const contactFilters = [
  "Contact Name",
  "Job Title",
  "Client",
  "Status",
  "Role",
  "Email",
  "Phone",
  "Mobile",
  "Department",
  "Preferred Channel",
  "Region",
  "Decision Maker",
  "Owner",
  "Last Contacted",
];

function getContactCellValue(row: Contact, key: string) {
  if (key === "decisionMaker") return row.decisionMaker ? "Yes" : "No";
  const value = row[key as keyof Contact];
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function createEmptyContact(): Contact {
  return {
    id: `con-${Date.now()}`,
    name: "",
    title: "",
    department: "",
    accountId: "",
    account: "",
    email: "",
    phone: "",
    mobile: "",
    owner: "Jenny",
    status: "Active",
    role: null,
    preferredChannel: null,
    region: null,
    decisionMaker: false,
    lastContacted: "",
    notes: "",
  };
}


type ContactImportFieldKey = Exclude<keyof Contact, "id" | "accountId">;

const CONTACT_IMPORT_FIELDS: ImportFieldDef<ContactImportFieldKey>[] = [
  { key: "name", label: "Contact Name", required: true, sample: "Art Venere" },
  { key: "title", label: "Job Title", sample: "CFO" },
  { key: "account", label: "Client", sample: "King (Sample)" },
  { key: "status", label: "Status", options: CONTACT_STATUS_OPTIONS, sample: "Active" },
  { key: "role", label: "Role", options: CONTACT_ROLE_OPTIONS, sample: "Primary Contact" },
  { key: "email", label: "Email", required: true, sample: "art.venere@example.com" },
  { key: "phone", label: "Phone", sample: "+852 2500 1001" },
  { key: "mobile", label: "Mobile", sample: "+852 9000 1001" },
  { key: "department", label: "Department", sample: "Finance" },
  {
    key: "preferredChannel",
    label: "Preferred Channel",
    options: CONTACT_CHANNEL_OPTIONS,
    sample: "Email",
  },
  { key: "region", label: "Region", options: REGION_OPTIONS, sample: "Hong Kong" },
  { key: "decisionMaker", label: "Decision Maker", kind: "boolean", sample: "Yes" },
  { key: "owner", label: "Owner", sample: "Jenny" },
  { key: "lastContacted", label: "Last Contacted", sample: "2026-07-15" },
  { key: "notes", label: "Notes", sample: "Key contact for credit reviews." },
];

function exportContacts(rows: Contact[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  exportRecordsCsv(`contacts-export-${stamp}.csv`, CONTACT_IMPORT_FIELDS, rows, (record, key) => {
    const value = record[key];
    if (value == null) return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
  });
}

function ImportContactsModal({
  existing,
  onClose,
  onImport,
}: {
  existing: Contact[];
  onClose: () => void;
  onImport: (created: Contact[], updated: Contact[]) => void;
}) {
  return (
    <ImportRecordsModal
      moduleLabel="Contacts"
      recordLabel="Contact"
      fields={CONTACT_IMPORT_FIELDS}
      matchKey="email"
      matchLabel="Email"
      existing={existing}
      getMatchValue={(contact) => contact.email}
      createEmpty={createEmptyContact}
      makeId={(index) => `con-import-${Date.now()}-${index}`}
      templateFilename="contacts-import-template.csv"
      onClose={onClose}
      onImport={onImport}
    />
  );
}

type ContactFormDraft = Omit<Contact, "status" | "role" | "preferredChannel" | "region"> & {
  status: ContactStatus | null;
  role: ContactRole | null;
  preferredChannel: ContactPreferredChannel | null;
  region: ClientRegion | null;
};

function ContactFormModal({
  contact,
  mode,
  onClose,
  onSave,
}: {
  contact: Contact;
  mode: "create" | "edit";
  onClose: () => void;
  onSave: (contact: Contact) => void;
}) {
  const [draft, setDraft] = useState<ContactFormDraft>(() =>
    mode === "create" ? { ...contact, status: null } : contact,
  );
  const [attempted, setAttempted] = useState(false);
  const nameError = attempted && !draft.name.trim();
  const accountError = attempted && !draft.accountId;
  const statusError = attempted && draft.status == null;

  function update<K extends keyof ContactFormDraft>(key: K, value: ContactFormDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleClientChange(accountId: string) {
    const client = accounts.find((item) => item.id === accountId);
    if (!client) {
      setDraft((prev) => ({ ...prev, accountId: "", account: "", region: null }));
      return;
    }
    setDraft((prev) => ({
      ...prev,
      accountId: client.id,
      account: client.companyName,
      owner: client.relationshipManager || prev.owner,
      region: client.region ?? prev.region,
    }));
  }

  function handleSave() {
    setAttempted(true);
    if (!draft.name.trim() || !draft.accountId || draft.status == null) return;
    onSave({
      ...draft,
      name: draft.name.trim(),
      title: draft.title.trim(),
      department: draft.department.trim(),
      account: draft.account.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      mobile: draft.mobile.trim(),
      owner: draft.owner.trim() || "Jenny",
      status: draft.status,
      notes: draft.notes.trim(),
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card client-form-modal" onClick={(event) => event.stopPropagation()}>
        <header className="client-form-header">
          <div>
            <p className="client-form-eyebrow">Contacts</p>
            <h2>{mode === "create" ? "Create Contact" : "Edit Contact"}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        <div className="client-form-body">
          <section className={`client-form-section ${nameError || statusError ? "is-invalid" : ""}`}>
            <div className="client-form-section-head">
              <strong>Identity</strong>
              <span>Name, title and lifecycle</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${nameError ? "is-invalid" : ""}`}>
                <label htmlFor="contact-name">
                  Contact Name <span className="field-required">*</span>
                </label>
                <input
                  id="contact-name"
                  className={`field ${nameError ? "is-invalid" : ""}`}
                  value={draft.name}
                  placeholder="e.g. Art Venere"
                  aria-required="true"
                  aria-invalid={nameError}
                  onChange={(event) => update("name", event.target.value)}
                />
                {nameError ? <p className="field-error">Contact Name is required.</p> : null}
              </div>
              <div className="form-row">
                <label htmlFor="contact-title">Job Title</label>
                <input
                  id="contact-title"
                  className="field"
                  value={draft.title}
                  placeholder="e.g. Group Treasurer"
                  onChange={(event) => update("title", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="contact-department">Department</label>
                <input
                  id="contact-department"
                  className="field"
                  value={draft.department}
                  placeholder="e.g. Treasury"
                  onChange={(event) => update("department", event.target.value)}
                />
              </div>
              <div className={`form-row ${statusError ? "is-invalid" : ""}`}>
                <label>
                  Status <span className="field-required">*</span>
                </label>
                <ChoiceField
                  name="contact-status"
                  options={CONTACT_STATUS_OPTIONS}
                  value={draft.status}
                  onChange={(value) => update("status", value)}
                  ariaLabel="Contact Status"
                  invalid={statusError}
                  allowClear={false}
                />
                {statusError ? <p className="field-error">Status is required.</p> : null}
              </div>
            </div>
          </section>

          <section className={`client-form-section ${accountError ? "is-invalid" : ""}`}>
            <div className="client-form-section-head">
              <strong>Client Link</strong>
              <span>Borrower relationship and influence</span>
            </div>
            <div className="client-form-grid">
              <div className={`form-row ${accountError ? "is-invalid" : ""}`}>
                <label htmlFor="contact-account">
                  Client <span className="field-required">*</span>
                </label>
                <select
                  id="contact-account"
                  className={`field ${accountError ? "is-invalid" : ""}`}
                  value={draft.accountId}
                  aria-required="true"
                  aria-invalid={accountError}
                  onChange={(event) => handleClientChange(event.target.value)}
                >
                  <option value="">Select client</option>
                  {accounts.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.companyName}
                    </option>
                  ))}
                </select>
                {accountError ? <p className="field-error">Client is required.</p> : null}
              </div>
              <div className="form-row">
                <label>Role</label>
                <ChoiceField
                  name="contact-role"
                  options={CONTACT_ROLE_OPTIONS}
                  value={draft.role}
                  onChange={(value) => update("role", value)}
                  ariaLabel="Contact Role"
                />
              </div>
              <div className="form-row">
                <label>Region</label>
                <ChoiceField
                  name="contact-region"
                  options={REGION_OPTIONS}
                  value={draft.region}
                  onChange={(value) => update("region", value)}
                  ariaLabel="Contact Region"
                />
              </div>
              <div className="form-row">
                <label htmlFor="contact-decision-maker">Decision Maker</label>
                <select
                  id="contact-decision-maker"
                  className="field"
                  value={draft.decisionMaker ? "Yes" : "No"}
                  onChange={(event) => update("decisionMaker", event.target.value === "Yes")}
                >
                  <option>No</option>
                  <option>Yes</option>
                </select>
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Communication</strong>
              <span>How RMs reach this contact</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label htmlFor="contact-email">Email</label>
                <input
                  id="contact-email"
                  className="field"
                  type="email"
                  value={draft.email}
                  placeholder="name@company.com"
                  onChange={(event) => update("email", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="contact-phone">Phone</label>
                <input
                  id="contact-phone"
                  className="field"
                  type="tel"
                  value={draft.phone}
                  placeholder="Office phone"
                  onChange={(event) => update("phone", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label htmlFor="contact-mobile">Mobile</label>
                <input
                  id="contact-mobile"
                  className="field"
                  type="tel"
                  value={draft.mobile}
                  placeholder="Mobile number"
                  onChange={(event) => update("mobile", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Preferred Channel</label>
                <ChoiceField
                  name="contact-channel"
                  options={CONTACT_CHANNEL_OPTIONS}
                  value={draft.preferredChannel}
                  onChange={(value) => update("preferredChannel", value)}
                  ariaLabel="Preferred Channel"
                />
              </div>
            </div>
          </section>

          <section className="client-form-section">
            <div className="client-form-section-head">
              <strong>Ownership & Engagement</strong>
              <span>RM coverage and notes</span>
            </div>
            <div className="client-form-grid">
              <div className="form-row">
                <label htmlFor="contact-owner">Owner</label>
                <input
                  id="contact-owner"
                  className="field"
                  value={draft.owner}
                  placeholder="Relationship manager"
                  onChange={(event) => update("owner", event.target.value)}
                />
              </div>
              <div className="form-row">
                <label>Last Contacted</label>
                <DateField
                  id="contact-last-contacted"
                  value={draft.lastContacted}
                  onChange={(value) => update("lastContacted", value)}
                />
              </div>
              <div className="form-row client-form-span-2">
                <label htmlFor="contact-notes">Notes</label>
                <textarea
                  id="contact-notes"
                  className="field"
                  style={{ minHeight: 88 }}
                  value={draft.notes}
                  placeholder="Engagement preferences, influence on credit decisions…"
                  onChange={(event) => update("notes", event.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <footer className="client-form-footer">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleSave}>
            {mode === "create" ? "Save Contact" : "Save Changes"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ContactsWorkspace({
  createIntentId = null,
  onCreateHandled,
  openRecordIntent = null,
  onRecordHandled,
  onReturnHome,
}: {
  createIntentId?: number | null;
  onCreateHandled?: () => void;
  openRecordIntent?: OpenRecordIntent | null;
  onRecordHandled?: () => void;
  onReturnHome?: () => void;
}) {
  const [rows, setRows] = useState<Contact[]>(() => [...contacts]);
  const [editing, setEditing] = useState<{ contact: Contact; mode: "create" | "edit" } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [returnToHome, setReturnToHome] = useState(false);

  useEffect(() => {
    if (createIntentId == null) return;
    setEditing({ contact: createEmptyContact(), mode: "create" });
    setReturnToHome(false);
    onCreateHandled?.();
  }, [createIntentId, onCreateHandled]);

  useEffect(() => {
    if (openRecordIntent == null) return;
    const record = rows.find((item) => item.id === openRecordIntent.recordId);
    if (record) {
      setEditing({ contact: { ...record }, mode: "edit" });
      setReturnToHome(openRecordIntent.returnTo === "home");
    }
    onRecordHandled?.();
  }, [openRecordIntent, onRecordHandled, rows]);

  function dismissForm() {
    setEditing(null);
    if (returnToHome) {
      setReturnToHome(false);
      onReturnHome?.();
    }
  }

  function handleSave(next: Contact) {
    setRows((prev) => {
      const index = prev.findIndex((item) => item.id === next.id);
      if (index >= 0) {
        const copy = [...prev];
        copy[index] = next;
        return copy;
      }
      return [next, ...prev];
    });
  }

  function startCreate() {
    setEditing({ contact: createEmptyContact(), mode: "create" });
    setReturnToHome(false);
  }

  function renderContactCell(row: Contact, column: ColumnDef) {
    if (column.key === "select") {
      return (
        <RowSelectCell
          context={{
            id: row.id,
            label: row.name,
            email: row.email,
            phone: row.phone,
            relatedTo: row.account,
          }}
          onEdit={() => {
            setEditing({ contact: { ...row }, mode: "edit" });
            setReturnToHome(false);
          }}
          onDelete={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
        />
      );
    }
    if (column.key === "decisionMaker") return row.decisionMaker ? "Yes" : "No";
    const value = row[column.key as keyof Contact];
    return value == null || value === "" ? "" : String(value);
  }

  const contactModals = (
    <>
      {importOpen ? (
        <ImportContactsModal
          existing={rows}
          onClose={() => setImportOpen(false)}
          onImport={(created, updated) => {
            setRows((prev) => {
              const updatedById = new Map(updated.map((contact) => [contact.id, contact]));
              const merged = prev.map((contact) => updatedById.get(contact.id) ?? contact);
              return [...created, ...merged];
            });
          }}
        />
      ) : null}
      {editing ? (
        <ContactFormModal
          key={editing.mode === "create" ? "create-contact" : editing.contact.id}
          contact={editing.contact}
          mode={editing.mode}
          onClose={dismissForm}
          onSave={handleSave}
        />
      ) : null}
    </>
  );

  return (
    <>
      <RecordListShell
        title="All Contacts"
        filters={contactFilters}
        data={rows}
        columns={contactColumns}
        getCellValue={getContactCellValue}
        createLabel="Create Contact"
        importLabel="Import Contacts"
        onCreate={startCreate}
        onImport={() => setImportOpen(true)}
        onExport={exportContacts}
        renderRows={(visibleRows, orderedColumns) => (
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className="is-row-interactive"
                onDoubleClick={() => {
                  setEditing({ contact: { ...row }, mode: "edit" });
                  setReturnToHome(false);
                }}
              >
                {orderedColumns.map((column) => {
                  if (column.key === "select") {
                    return (
                      <td key={column.key} className="is-row-actions-col">
                        {renderContactCell(row, column)}
                      </td>
                    );
                  }
                  if (column.type === "enum" && column.colorable !== false) {
                    const raw = row[column.key as keyof Contact];
                    const value = raw == null || raw === "" ? null : String(raw);
                    return <EnumFillTd key={column.key} column={column} value={value} />;
                  }
                  return <td key={column.key}>{renderContactCell(row, column)}</td>;
                })}
              </tr>
            ))}
          </tbody>
        )}
      />
      {contactModals}
    </>
  );
}

function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <section className="card" style={{ padding: 24 }}>
      <h2>{title}</h2>
      <p className="muted">{description ?? "This module is reserved in the navigation and data model."}</p>
    </section>
  );
}
