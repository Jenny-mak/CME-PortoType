import type { ColorGroupId } from "./option-colors";
import type { Deal, ModuleKey, PipelineStage } from "./types";

export type ProductPipelineModuleKey =
  | "deals"
  | "tradeFinance"
  | "paymentService"
  | "sustainableFinance"
  | "globalMarket"
  | "lifeInsurance";

export type ProductPipelineConfig = {
  key: ProductPipelineModuleKey;
  label: string;
  recordLabel: string;
  facilityPrefix: string;
  stages: PipelineStage[];
  stageProbability: Partial<Record<PipelineStage, number>>;
};

const FULL_PIPELINE: PipelineStage[] = [
  "Identification",
  "Evaluation",
  "Approval",
  "Execution",
  "Completion",
];

const FULL_PROBABILITY: Record<PipelineStage, number> = {
  Identification: 10,
  Evaluation: 25,
  Approval: 50,
  Execution: 75,
  Completion: 100,
};

function probabilityFor(stages: PipelineStage[]): Partial<Record<PipelineStage, number>> {
  const map: Partial<Record<PipelineStage, number>> = {};
  for (const stage of stages) map[stage] = FULL_PROBABILITY[stage];
  return map;
}

export const PRODUCT_PIPELINE_CONFIGS: Record<ProductPipelineModuleKey, ProductPipelineConfig> = {
  deals: {
    key: "deals",
    label: "Loans",
    recordLabel: "Loan",
    facilityPrefix: "LN",
    stages: FULL_PIPELINE,
    stageProbability: FULL_PROBABILITY,
  },
  tradeFinance: {
    key: "tradeFinance",
    label: "GTRF",
    recordLabel: "Facility",
    facilityPrefix: "TF",
    stages: FULL_PIPELINE,
    stageProbability: FULL_PROBABILITY,
  },
  paymentService: {
    key: "paymentService",
    label: "GPS",
    recordLabel: "Mandate",
    facilityPrefix: "PS",
    stages: ["Identification", "Evaluation", "Completion"],
    stageProbability: probabilityFor(["Identification", "Evaluation", "Completion"]),
  },
  sustainableFinance: {
    key: "sustainableFinance",
    label: "SF",
    recordLabel: "Facility",
    facilityPrefix: "SF",
    stages: ["Identification", "Evaluation", "Approval", "Completion"],
    stageProbability: probabilityFor(["Identification", "Evaluation", "Approval", "Completion"]),
  },
  globalMarket: {
    key: "globalMarket",
    label: "GM",
    recordLabel: "Deal",
    facilityPrefix: "GM",
    stages: FULL_PIPELINE,
    stageProbability: FULL_PROBABILITY,
  },
  lifeInsurance: {
    key: "lifeInsurance",
    label: "Life Insurance",
    recordLabel: "Case",
    facilityPrefix: "LI",
    stages: ["Identification", "Evaluation", "Completion"],
    stageProbability: probabilityFor(["Identification", "Evaluation", "Completion"]),
  },
};

export const PRODUCT_PIPELINE_MODULE_KEYS = Object.keys(
  PRODUCT_PIPELINE_CONFIGS,
) as ProductPipelineModuleKey[];

export function isProductPipelineModule(key: ModuleKey): key is ProductPipelineModuleKey {
  return key in PRODUCT_PIPELINE_CONFIGS;
}

/** Monday-style stage palettes — same cool default as Loans. */
export const PIPELINE_STAGE_COLORS: Record<
  ColorGroupId,
  { label: string; colors: Record<PipelineStage, string> }
> = {
  cool: {
    label: "Pipeline",
    colors: {
      Identification: "#A25DDC",
      Evaluation: "#579BFC",
      Approval: "#66CCFF",
      Execution: "#00D2D2",
      Completion: "#00C875",
    },
  },
  vivid: {
    label: "Vivid",
    colors: {
      Identification: "#8B5CF6",
      Evaluation: "#3B82F6",
      Approval: "#0EA5E9",
      Execution: "#14B8A6",
      Completion: "#10B981",
    },
  },
  soft: {
    label: "Soft",
    colors: {
      Identification: "#9B7EDE",
      Evaluation: "#6FA8DC",
      Approval: "#5DADE2",
      Execution: "#48C9B0",
      Completion: "#58D68D",
    },
  },
  warm: {
    label: "Warm",
    colors: {
      Identification: "#F43F5E",
      Evaluation: "#F97316",
      Approval: "#F59E0B",
      Execution: "#EAB308",
      Completion: "#84CC16",
    },
  },
};

export const DEFAULT_PIPELINE_STAGE_THEME: ColorGroupId = "cool";

export function getPipelineStageColor(
  themeId: ColorGroupId,
  stage: PipelineStage,
): string {
  const theme = PIPELINE_STAGE_COLORS[themeId] ?? PIPELINE_STAGE_COLORS[DEFAULT_PIPELINE_STAGE_THEME];
  return theme.colors[stage];
}

export function groupDealsByStage(
  deals: Deal[],
  stages: PipelineStage[],
): Record<PipelineStage, Deal[]> {
  const grouped = Object.fromEntries(stages.map((stage) => [stage, [] as Deal[]])) as Record<
    PipelineStage,
    Deal[]
  >;
  for (const deal of deals) {
    if (grouped[deal.stage]) grouped[deal.stage].push(deal);
  }
  return grouped;
}

export function formatKanbanAmount(currency: Deal["currency"], amount: number): string {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted = millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1);
    return `${currency} ${formatted}M`;
  }
  if (amount >= 1_000) {
    return `${currency} ${(amount / 1_000).toFixed(0)}K`;
  }
  return `${currency} ${amount.toLocaleString("en-US")}`;
}

export function formatKanbanDate(isoDate: string): string {
  if (!isoDate) return "";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ownerInitials(owner: string): string {
  const parts = owner.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
