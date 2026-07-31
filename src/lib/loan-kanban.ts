/**
 * Loan kanban helpers — thin compatibility layer over the shared product pipeline.
 */
import type { ColorGroupId } from "./option-colors";
import {
  DEFAULT_PIPELINE_STAGE_THEME,
  formatKanbanAmount,
  formatKanbanDate,
  getPipelineStageColor,
  groupDealsByStage,
  ownerInitials,
  PIPELINE_STAGE_COLORS,
  PRODUCT_PIPELINE_CONFIGS,
  type ProductPipelineConfig,
} from "./product-pipeline";
import type { Deal, PipelineStage } from "./types";

export type LoanStage = PipelineStage;

export const LOAN_KANBAN_STAGES: LoanStage[] = [...PRODUCT_PIPELINE_CONFIGS.deals.stages];

export const LOAN_STAGE_THEMES = PIPELINE_STAGE_COLORS;

export const DEFAULT_LOAN_STAGE_THEME = DEFAULT_PIPELINE_STAGE_THEME;

export function getLoanStageColor(themeId: ColorGroupId, stage: LoanStage): string {
  return getPipelineStageColor(themeId, stage);
}

export function groupLoansByStage(
  loans: Deal[],
  stages: LoanStage[] = LOAN_KANBAN_STAGES,
): Record<LoanStage, Deal[]> {
  return groupDealsByStage(loans, stages);
}

export { formatKanbanAmount, formatKanbanDate, ownerInitials };
export type { ProductPipelineConfig };
