"use client";

import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import { ownerInitials } from "@/lib/product-pipeline";
import type { Account, ClientKycStatus } from "@/lib/types";

/** Clients are grouped by their KYC workflow, mirroring the deal pipeline board. */
const KYC_COLUMNS: { key: ClientKycStatus | "Unassigned"; color: string }[] = [
  { key: "Unassigned", color: "#8a8f98" },
  { key: "Pending", color: "#8a6914" },
  { key: "In Progress", color: "#9d3d72" },
  { key: "Approved", color: "#3d6e3a" },
  { key: "Expired", color: "#8b4f3f" },
];

export function ClientKanbanBoard({
  clients,
  onOpenClient,
}: {
  clients: Account[];
  onOpenClient?: (client: Account) => void;
}) {
  const grouped = useMemo(() => {
    const buckets = new Map<string, Account[]>(KYC_COLUMNS.map((column) => [column.key, []]));
    for (const client of clients) {
      const bucket = buckets.get(client.kycStatus ?? "Unassigned");
      if (bucket) bucket.push(client);
    }
    return buckets;
  }, [clients]);

  return (
    <section className="loan-kanban">
      <div className="loan-kanban-board">
        {KYC_COLUMNS.map((column, index) => {
          const columnClients = grouped.get(column.key) ?? [];
          const activeCount = columnClients.filter((client) => client.status === "Active").length;
          return (
            <section
              key={column.key}
              className={`loan-kanban-column ${index === 0 ? "is-first" : ""} ${
                index === KYC_COLUMNS.length - 1 ? "is-last" : ""
              }`}
              style={{ ["--stage-color" as string]: column.color }}
            >
              <header className="loan-kanban-column-header">
                <div className="loan-kanban-column-title">
                  <strong>{column.key}</strong>
                  <span>{columnClients.length}</span>
                </div>
                <div className="loan-kanban-column-summary">
                  <strong>{activeCount}</strong>
                  <span>active</span>
                </div>
              </header>
              <div className="loan-kanban-cards">
                {columnClients.map((client) => (
                  <ClientKanbanCard
                    key={client.id}
                    client={client}
                    stageColor={column.color}
                    onOpen={onOpenClient}
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

function ClientKanbanCard({
  client,
  stageColor,
  onOpen,
}: {
  client: Account;
  stageColor: string;
  onOpen?: (client: Account) => void;
}) {
  return (
    <article
      className="loan-kanban-card"
      onClick={() => onOpen?.(client)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(client);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <strong className="loan-kanban-card-title">{client.companyName}</strong>
      <div className="loan-kanban-card-meta">
        {client.segment ? (
          <span className="loan-kanban-pill loan-kanban-pill-amount">{client.segment}</span>
        ) : null}
        {client.riskRating ? (
          <span
            className={`loan-kanban-pill client-meta-risk-${client.riskRating.toLowerCase()}`}
          >
            {client.riskRating} risk
          </span>
        ) : null}
      </div>
      <footer className="loan-kanban-card-footer">
        <span className="loan-kanban-card-people">
          {client.relationshipManager ? (
            <span
              className="loan-kanban-avatar"
              title={client.relationshipManager}
              style={{ ["--stage-color" as string]: stageColor }}
            >
              {ownerInitials(client.relationshipManager)}
            </span>
          ) : null}
          {client.region ? <span className="loan-kanban-card-date">{client.region}</span> : null}
        </span>
        {client.clientStatus ? (
          <span className="loan-kanban-pill loan-kanban-pill-owner">
            <ArrowUpRight size={12} aria-hidden="true" />
            {client.clientStatus}
          </span>
        ) : null}
      </footer>
    </article>
  );
}
