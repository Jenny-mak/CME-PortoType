"use client";

import { ArrowUpRight, Check } from "lucide-react";
import { useMemo, useState } from "react";
import {
  DEFAULT_PIPELINE_STAGE_THEME,
  formatKanbanAmount,
  formatKanbanDate,
  getPipelineStageColor,
  groupDealsByStage,
  ownerInitials,
  PRODUCT_PIPELINE_CONFIGS,
} from "@/lib/product-pipeline";
import type { Deal, PipelineStage } from "@/lib/types";

const STAGE_SHORT: Partial<Record<PipelineStage, string>> = {
  Identification: "Ident.",
  Evaluation: "Eval",
  Approval: "Appr.",
  Execution: "Exec",
  Completion: "Done",
};

export function LoanFormStageTrail({
  stages,
  current,
  probabilities,
  onSelect,
}: {
  stages: PipelineStage[];
  current: PipelineStage;
  probabilities: Partial<Record<PipelineStage, number>>;
  onSelect: (stage: PipelineStage) => void;
}) {
  const themeId = DEFAULT_PIPELINE_STAGE_THEME;
  const currentIndex = Math.max(0, stages.indexOf(current));
  const progress =
    stages.length <= 1 ? 100 : (currentIndex / (stages.length - 1)) * 100;

  return (
    <div
      className="loan-form-stage-trail"
      role="list"
      aria-label="Pipeline stage progress"
      style={{
        ["--stage-progress" as string]: `${progress}%`,
        ["--stage-count" as string]: stages.length,
      }}
    >
      <div className="loan-form-stage-track" aria-hidden="true">
        <div className="loan-form-stage-track-fill" />
      </div>
      <div className="loan-form-stage-steps">
        {stages.map((stage, index) => {
          const color = getPipelineStageColor(themeId, stage);
          const state =
            index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
          const probability = probabilities[stage];
          return (
            <button
              key={stage}
              type="button"
              role="listitem"
              className={`loan-form-stage-step is-${state}`}
              style={{ ["--stage-color" as string]: color }}
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`${stage}${probability != null ? `, ${probability}%` : ""}${
                state === "current" ? ", current stage" : state === "done" ? ", completed" : ""
              }`}
              onClick={() => onSelect(stage)}
            >
              <span className="loan-form-stage-node">
                {state === "done" ? <Check size={12} strokeWidth={2.6} aria-hidden /> : null}
                {state === "current" ? <span className="loan-form-stage-pulse" aria-hidden /> : null}
                {state === "upcoming" ? <span className="loan-form-stage-dot" aria-hidden /> : null}
              </span>
              <span className="loan-form-stage-copy">
                <span className="loan-form-stage-name" data-full={stage}>
                  <span className="loan-form-stage-name-full">{stage}</span>
                  <span className="loan-form-stage-name-short">{STAGE_SHORT[stage] ?? stage}</span>
                </span>
                {probability != null ? (
                  <span className="loan-form-stage-pct">{probability}%</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function LoanStageBar({
  loans,
  stages = PRODUCT_PIPELINE_CONFIGS.deals.stages,
  ariaLabel = "Pipeline stages",
}: {
  loans: Deal[];
  stages?: PipelineStage[];
  ariaLabel?: string;
}) {
  const [activeStage, setActiveStage] = useState<PipelineStage | null>(null);
  const grouped = useMemo(() => groupDealsByStage(loans, stages), [loans, stages]);
  const themeId = DEFAULT_PIPELINE_STAGE_THEME;

  return (
    <div
      className="loan-stage-bar"
      role="group"
      aria-label={ariaLabel}
      onMouseLeave={() => setActiveStage(null)}
    >
      {stages.map((stage, index) => {
        const count = grouped[stage].length;
        const color = getPipelineStageColor(themeId, stage);
        const isActive = activeStage === stage;
        const isFirst = index === 0;
        const isLast = index === stages.length - 1;
        return (
          <button
            key={stage}
            type="button"
            className={`loan-stage-segment ${isActive ? "is-active" : ""} ${isFirst ? "is-first" : ""} ${
              isLast ? "is-last" : ""
            }`}
            style={{ ["--stage-color" as string]: color }}
            aria-label={`${stage}: ${count} items`}
            aria-pressed={isActive}
            onMouseEnter={() => setActiveStage(stage)}
            onFocus={() => setActiveStage(stage)}
            onBlur={() => setActiveStage(null)}
            onClick={() => setActiveStage(stage)}
          >
            {isActive ? (
              <span className="loan-stage-tooltip">
                {stage} / {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function LoanKanbanBoard({
  loans,
  onOpenLoan,
  stages = PRODUCT_PIPELINE_CONFIGS.deals.stages,
}: {
  loans: Deal[];
  onOpenLoan?: (loan: Deal) => void;
  stages?: PipelineStage[];
}) {
  const grouped = useMemo(() => groupDealsByStage(loans, stages), [loans, stages]);
  const themeId = DEFAULT_PIPELINE_STAGE_THEME;

  return (
    <section className="loan-kanban">
      <div className="loan-kanban-board">
        {stages.map((stage, index) => {
          const stageLoans = grouped[stage];
          const color = getPipelineStageColor(themeId, stage);
          const totalsByCurrency = stageLoans.reduce((totals, loan) => {
            totals.set(loan.currency, (totals.get(loan.currency) ?? 0) + loan.amount);
            return totals;
          }, new Map<Deal["currency"], number>());
          const stageTotalLabel =
            Array.from(totalsByCurrency, ([currency, total]) => formatKanbanAmount(currency, total)).join(
              " · ",
            ) || "—";
          return (
            <section
              key={stage}
              className={`loan-kanban-column ${index === 0 ? "is-first" : ""} ${
                index === stages.length - 1 ? "is-last" : ""
              }`}
              style={{ ["--stage-color" as string]: color }}
            >
              <header className="loan-kanban-column-header">
                <div className="loan-kanban-column-title">
                  <strong>{stage}</strong>
                  <span>{stageLoans.length}</span>
                </div>
                <div className="loan-kanban-column-summary">
                  <strong title={stageTotalLabel}>{stageTotalLabel}</strong>
                  <span>sum</span>
                </div>
              </header>
              <div className="loan-kanban-cards">
                {stageLoans.map((loan) => (
                  <LoanKanbanCard
                    key={loan.id}
                    loan={loan}
                    stageColor={color}
                    onOpen={onOpenLoan}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

function LoanKanbanCard({
  loan,
  stageColor,
  onOpen,
}: {
  loan: Deal;
  stageColor: string;
  onOpen?: (loan: Deal) => void;
}) {
  const dateLabel = formatKanbanDate(loan.closingDate || loan.applicationDate);

  return (
    <article
      className="loan-kanban-card"
      onClick={() => onOpen?.(loan)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(loan);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <strong className="loan-kanban-card-title">{loan.name}</strong>
      <div className="loan-kanban-card-meta">
        <span className="loan-kanban-pill loan-kanban-pill-amount">
          {formatKanbanAmount(loan.currency, loan.amount)}
        </span>
        <span className="loan-kanban-pill loan-kanban-pill-owner">
          <ArrowUpRight size={12} aria-hidden="true" />
          {loan.owner}
        </span>
      </div>
      <footer className="loan-kanban-card-footer">
        <span className="loan-kanban-card-people">
          <span
            className="loan-kanban-avatar"
            title={loan.owner}
            style={{ ["--stage-color" as string]: stageColor }}
          >
            {ownerInitials(loan.owner)}
          </span>
          {dateLabel ? <span className="loan-kanban-card-date">{dateLabel}</span> : null}
        </span>
      </footer>
    </article>
  );
}
