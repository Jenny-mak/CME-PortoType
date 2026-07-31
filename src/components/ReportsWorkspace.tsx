"use client";

import { startTransition, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  accounts,
  campaigns,
  calls,
  deals,
  leads,
  meetings,
  tasks,
} from "@/lib/crm-data";

const CHART_COLORS = [
  "#C47A86",
  "#7BA3D4",
  "#6BB8B0",
  "#D4A84B",
  "#A894D4",
  "#D49084",
  "#6AB8A8",
  "#8B90D4",
  "#D489B0",
  "#A3C46E",
];

/** Short ease-out motion: snappy tab refresh without janky bounce */
const CHART_MOTION = {
  animationDuration: 280,
  animationEasing: "ease-out" as const,
};

const STAGE_ORDER = ["Identification", "Evaluation", "Approval", "Execution", "Completion"] as const;

type ReportTab = "overview" | "loans" | "clients" | "pipeline" | "campaigns" | "activity";

function formatCompact(value: number) {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString("en-US");
}

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null | undefined) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

function sumBy<T>(items: T[], keyFn: (item: T) => string, valueFn: (item: T) => number) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + valueFn(item));
  }
  return [...map.entries()].map(([name, value]) => ({ name, value }));
}

function ChartTooltip({
  active,
  payload,
  label,
  money,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>;
  label?: string;
  money?: boolean;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="report-tooltip">
      {label ? <div className="report-tooltip-label">{label}</div> : null}
      {payload.map((entry, index) => (
        <div className="report-tooltip-row" key={`${entry.dataKey ?? entry.name}-${index}`}>
          <span className="report-tooltip-swatch" style={{ background: entry.color }} />
          <span>{entry.name}</span>
          <strong>
            {money ? formatMoney(Number(entry.value ?? 0)) : Number(entry.value ?? 0).toLocaleString("en-US")}
          </strong>
        </div>
      ))}
    </div>
  );
}

function ReportCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`report-card ${className}`}>
      <header className="report-card-head">
        <div>
          <h3>{title}</h3>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </header>
      <div className="report-card-body">{children}</div>
    </section>
  );
}

function KpiStrip() {
  const kpis = useMemo(() => {
    const pipeline = deals.reduce((sum, d) => sum + d.amount, 0);
    const outstanding = deals.reduce((sum, d) => sum + d.outstandingBalance, 0);
    const weighted = deals.reduce((sum, d) => sum + (d.amount * d.probability) / 100, 0);
    const activeClients = accounts.filter((a) => a.status === "Active").length;
    const convertedLeads = leads.filter((l) => l.status === "Converted").length;
    const leadRate = leads.length ? Math.round((convertedLeads / leads.length) * 100) : 0;
    const campaignSpend = campaigns.reduce((sum, c) => sum + c.actualCost, 0);
    const campaignLeads = campaigns.reduce((sum, c) => sum + c.leadsGenerated, 0);

    return [
      { label: "Pipeline exposure", value: formatCompact(pipeline), hint: "All loan facilities" },
      { label: "Outstanding", value: formatCompact(outstanding), hint: "Drawn balances" },
      { label: "Weighted pipeline", value: formatCompact(weighted), hint: "Amount × probability" },
      { label: "Active clients", value: String(activeClients), hint: `${accounts.length} total` },
      { label: "Lead conversion", value: `${leadRate}%`, hint: `${convertedLeads}/${leads.length} converted` },
      { label: "Campaign leads", value: String(campaignLeads), hint: `${formatCompact(campaignSpend)} spent` },
    ];
  }, []);

  return (
    <div className="report-kpi-strip">
      {kpis.map((kpi) => (
        <article className="report-kpi" key={kpi.label}>
          <span className="report-kpi-label">{kpi.label}</span>
          <strong className="report-kpi-value">{kpi.value}</strong>
          <span className="report-kpi-hint">{kpi.hint}</span>
        </article>
      ))}
    </div>
  );
}

function OverviewPanel() {
  const stageData = useMemo(
    () =>
      STAGE_ORDER.map((stage) => {
        const rows = deals.filter((d) => d.stage === stage);
        return {
          name: stage,
          amount: rows.reduce((s, d) => s + d.amount, 0),
          count: rows.length,
        };
      }),
    [],
  );

  const productData = useMemo(() => sumBy(deals, (d) => d.productType, (d) => d.amount), []);
  const riskData = useMemo(() => countBy(deals, (d) => d.riskGrade), []);
  const leadData = useMemo(() => countBy(leads, (l) => l.status), []);
  const clientStatus = useMemo(() => countBy(accounts, (a) => a.clientStatus), []);

  const activityTrend = useMemo(() => {
    const buckets = [
      { name: "Tasks", open: tasks.filter((t) => t.status !== "Completed").length, done: tasks.filter((t) => t.status === "Completed").length },
      { name: "Meetings", open: meetings.length, done: 0 },
      { name: "Calls", open: calls.filter((c) => c.type === "Outbound").length, done: calls.filter((c) => c.type === "Inbound").length },
      { name: "Leads", open: leads.filter((l) => l.status === "New" || l.status === "Contacted").length, done: leads.filter((l) => l.status === "Qualified" || l.status === "Converted").length },
    ];
    return buckets;
  }, []);

  return (
    <div className="report-grid">
      <ReportCard title="Loan pipeline by stage" subtitle="Facility amount across sales stages" className="report-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stageData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Bar {...CHART_MOTION} dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {stageData.map((_, i) => (
                <Cell key={STAGE_ORDER[i]} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Product mix" subtitle="Pipeline amount by product">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={productData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
              {productData.map((_, i) => (
                <Cell key={productData[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip money />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Risk grade mix" subtitle="Loan count by risk">
        <ResponsiveContainer width="100%" height={280}>
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="28%"
            outerRadius="90%"
            data={riskData.map((d, i) => ({ ...d, fill: CHART_COLORS[i % CHART_COLORS.length] }))}
            startAngle={90}
            endAngle={-270}
          >
            <RadialBar {...CHART_MOTION} background dataKey="value" cornerRadius={6} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} />
          </RadialBarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Lead funnel" subtitle="Status distribution">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={leadData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={78} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Leads" radius={[0, 6, 6, 0]} maxBarSize={22}>
              {leadData.map((_, i) => (
                <Cell key={leadData[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Client franchise" subtitle="ETB / NTB / NNTB mix">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={clientStatus} dataKey="value" nameKey="name" outerRadius={92} label>
              {clientStatus.map((_, i) => (
                <Cell key={clientStatus[i].name} fill={CHART_COLORS[(i + 2) % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Activity workload" subtitle="Open vs completed / inbound" className="report-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={activityTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} dataKey="open" name="Open / Outbound" stackId="a" fill="#C47A86" radius={[0, 0, 0, 0]} maxBarSize={42} />
            <Bar {...CHART_MOTION} dataKey="done" name="Done / Inbound" stackId="a" fill="#6BB8B0" radius={[6, 6, 0, 0]} maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function LoansPanel() {
  const byBu = useMemo(() => sumBy(deals, (d) => d.businessUnit, (d) => d.amount), []);
  const byStatus = useMemo(() => sumBy(deals, (d) => d.facilityStatus, (d) => d.outstandingBalance), []);
  const utilization = useMemo(
    () =>
      deals
        .filter((d) => d.approvedAmount > 0)
        .map((d) => ({
          name: d.name.replace(/ (Facility|Renewal|Line|Loan|RCF).*$/, "").slice(0, 18),
          utilization: d.utilizationPct,
          ltv: d.ltv,
          outstanding: d.outstandingBalance,
        })),
    [],
  );
  const tenorSpread = useMemo(
    () =>
      deals.map((d) => ({
        name: d.facilityNumber.replace("LN-2026-", ""),
        tenor: d.tenorMonths,
        rate: d.interestRate,
        amount: d.amount,
        product: d.productType,
      })),
    [],
  );
  const currencyMix = useMemo(() => sumBy(deals, (d) => d.currency, (d) => d.amount), []);

  return (
    <div className="report-grid">
      <ReportCard title="Exposure by business unit" subtitle="Requested facility amount" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byBu} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={120} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Amount" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {byBu.map((_, i) => (
                <Cell key={byBu[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Outstanding by facility status" subtitle="Drawn balances">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie {...CHART_MOTION} data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
              {byStatus.map((_, i) => (
                <Cell key={byStatus[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip money />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Utilization vs LTV" subtitle="Approved facilities" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={utilization} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} yAxisId="left" dataKey="utilization" name="Utilization %" fill="#C47A86" radius={[4, 4, 0, 0]} maxBarSize={36} />
            <Line {...CHART_MOTION} yAxisId="left" type="monotone" dataKey="ltv" name="LTV %" stroke="#7BA3D4" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Currency mix" subtitle="Pipeline by booking currency">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie {...CHART_MOTION} data={currencyMix} dataKey="value" nameKey="name" outerRadius={95}>
              {currencyMix.map((_, i) => (
                <Cell key={currencyMix[i].name} fill={CHART_COLORS[(i + 1) % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip money />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Tenor vs interest rate" subtitle="Facility pricing profile" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={tenorSpread} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} label={{ value: "Months", position: "insideLeft", angle: -90, fill: "var(--muted)", fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area {...CHART_MOTION} yAxisId="left" type="monotone" dataKey="tenor" name="Tenor (m)" fill="#F3E6E9" stroke="#C47A86" strokeWidth={2} />
            <Line {...CHART_MOTION} yAxisId="right" type="monotone" dataKey="rate" name="Interest %" stroke="#6BB8B0" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function ClientsPanel() {
  const byRegion = useMemo(() => countBy(accounts, (a) => a.region), []);
  const byIndustry = useMemo(() => countBy(accounts, (a) => a.industry), []);
  const bySegment = useMemo(() => countBy(accounts, (a) => a.segment), []);
  const byKyc = useMemo(() => countBy(accounts, (a) => a.kycStatus), []);
  const byRisk = useMemo(() => countBy(accounts, (a) => a.riskRating), []);
  const byRating = useMemo(() => countBy(accounts, (a) => a.rating), []);

  const radarData = useMemo(() => {
    const segments = ["Corporate", "Commercial", "SME", "Private Banking"];
    return segments.map((seg) => ({
      segment: seg,
      clients: accounts.filter((a) => a.segment === seg).length,
      loans: deals.filter((d) => {
        const acc = accounts.find((a) => a.id === d.accountId);
        return acc?.segment === seg;
      }).length,
      highRisk: accounts.filter((a) => a.segment === seg && a.riskRating === "High").length,
    }));
  }, []);

  return (
    <div className="report-grid">
      <ReportCard title="Clients by region" subtitle="Geographic footprint" className="report-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byRegion} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Clients" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {byRegion.map((_, i) => (
                <Cell key={byRegion[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="KYC status" subtitle="Onboarding health">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={byKyc} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
              {byKyc.map((_, i) => (
                <Cell key={byKyc[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Industry coverage" subtitle="Client count by sector" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byIndustry} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={150} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Clients" fill="#7BA3D4" radius={[0, 6, 6, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Segment radar" subtitle="Clients / loans / high-risk">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="var(--line)" />
            <PolarAngleAxis dataKey="segment" tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <PolarRadiusAxis tick={{ fill: "var(--muted)", fontSize: 10 }} />
            <Radar {...CHART_MOTION} name="Clients" dataKey="clients" stroke="#C47A86" fill="#C47A86" fillOpacity={0.25} />
            <Radar {...CHART_MOTION} name="Loans" dataKey="loans" stroke="#6BB8B0" fill="#6BB8B0" fillOpacity={0.2} />
            <Radar {...CHART_MOTION} name="High risk" dataKey="highRisk" stroke="#D4A84B" fill="#D4A84B" fillOpacity={0.15} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Tooltip content={<ChartTooltip />} />
          </RadarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Client risk rating" subtitle="Portfolio risk view">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={byRisk} dataKey="value" nameKey="name" outerRadius={90}>
              {byRisk.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.name === "High" ? "#D49084" : d.name === "Medium" ? "#D4A84B" : "#6BB8B0"}
                />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Relationship temperature" subtitle="Hot / Warm / Cold rating">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byRating} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Clients" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {byRating.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.name === "Hot" ? "#D49084" : d.name === "Warm" ? "#D4A84B" : "#7BA3D4"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Segment mix" subtitle="Banking franchise split">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={bySegment} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90} paddingAngle={2}>
              {bySegment.map((_, i) => (
                <Cell key={bySegment[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function PipelinePanel() {
  const stageFunnel = useMemo(
    () =>
      STAGE_ORDER.map((stage, index) => {
        const rows = deals.filter((d) => d.stage === stage);
        return {
          name: stage,
          count: rows.length,
          amount: rows.reduce((s, d) => s + d.amount, 0),
          probability: rows.length
            ? Math.round(rows.reduce((s, d) => s + d.probability, 0) / rows.length)
            : 0,
          fill: CHART_COLORS[index % CHART_COLORS.length],
        };
      }),
    [],
  );

  const ownerBook = useMemo(() => {
    const map = new Map<string, { owner: string; amount: number; deals: number; weighted: number }>();
    for (const d of deals) {
      const cur = map.get(d.owner) ?? { owner: d.owner, amount: 0, deals: 0, weighted: 0 };
      cur.amount += d.amount;
      cur.deals += 1;
      cur.weighted += (d.amount * d.probability) / 100;
      map.set(d.owner, cur);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, []);

  const probabilityBands = useMemo(() => {
    const bands = [
      { name: "0–25%", min: 0, max: 25 },
      { name: "26–50%", min: 26, max: 50 },
      { name: "51–75%", min: 51, max: 75 },
      { name: "76–100%", min: 76, max: 100 },
    ];
    return bands.map((b) => ({
      name: b.name,
      amount: deals
        .filter((d) => d.probability >= b.min && d.probability <= b.max)
        .reduce((s, d) => s + d.amount, 0),
      count: deals.filter((d) => d.probability >= b.min && d.probability <= b.max).length,
    }));
  }, []);

  const leadOwner = useMemo(() => countBy(leads, (l) => l.owner), []);

  return (
    <div className="report-grid">
      <ReportCard title="Stage funnel (count)" subtitle="Deal volume through the loan journey" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={stageFunnel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="left" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} yAxisId="left" dataKey="count" name="Deals" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {stageFunnel.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Bar>
            <Line {...CHART_MOTION} yAxisId="right" type="monotone" dataKey="amount" name="Amount" stroke="#6B6B68" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Avg win probability" subtitle="By stage">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={stageFunnel} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="probFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C47A86" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#C47A86" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip content={<ChartTooltip />} />
            <Area {...CHART_MOTION} type="monotone" dataKey="probability" name="Avg %" stroke="#C47A86" fill="url(#probFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="RM book of business" subtitle="Amount vs weighted pipeline" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={ownerBook} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="owner" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} dataKey="amount" name="Pipeline" fill="#C47A86" radius={[6, 6, 0, 0]} maxBarSize={40} />
            <Bar {...CHART_MOTION} dataKey="weighted" name="Weighted" fill="#6BB8B0" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Probability bands" subtitle="Amount in each win-chance bucket">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={probabilityBands} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Bar {...CHART_MOTION} dataKey="amount" name="Amount" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {probabilityBands.map((_, i) => (
                <Cell key={probabilityBands[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Lead ownership" subtitle="Leads per RM">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie {...CHART_MOTION} data={leadOwner} dataKey="value" nameKey="name" innerRadius={50} outerRadius={95} paddingAngle={2}>
              {leadOwner.map((_, i) => (
                <Cell key={leadOwner[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function CampaignsPanel() {
  const performance = useMemo(
    () =>
      campaigns.map((c) => ({
        name: c.name.length > 22 ? `${c.name.slice(0, 20)}…` : c.name,
        fullName: c.name,
        budget: c.budgetedCost,
        actual: c.actualCost,
        revenue: c.expectedRevenue,
        leads: c.leadsGenerated,
        converted: c.convertedCount,
        response: c.expectedResponsePct,
      })),
    [],
  );

  const byChannel = useMemo(() => countBy(campaigns, (c) => c.channel), []);
  const byStatus = useMemo(() => countBy(campaigns, (c) => c.status), []);
  const byType = useMemo(() => countBy(campaigns, (c) => c.type), []);
  const conversion = useMemo(
    () =>
      campaigns
        .filter((c) => c.leadsGenerated > 0)
        .map((c) => ({
          name: c.code,
          rate: Math.round((c.convertedCount / c.leadsGenerated) * 100),
          leads: c.leadsGenerated,
          converted: c.convertedCount,
        })),
    [],
  );

  return (
    <div className="report-grid">
      <ReportCard title="Campaign cost vs budget" subtitle="Spend tracking" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={performance} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={50} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} dataKey="budget" name="Budgeted" fill="#7BA3D4" radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar {...CHART_MOTION} dataKey="actual" name="Actual" fill="#C47A86" radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Expected revenue" subtitle="Campaign opportunity size">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={performance} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6BB8B0" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#6BB8B0" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={50} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCompact} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip money />} />
            <Area {...CHART_MOTION} type="monotone" dataKey="revenue" name="Expected revenue" stroke="#6BB8B0" fill="url(#revFill)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Leads generated vs converted" subtitle="Campaign funnel yield" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={performance} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" interval={0} angle={-18} textAnchor="end" height={50} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar {...CHART_MOTION} dataKey="leads" name="Leads" fill="#A894D4" radius={[4, 4, 0, 0]} maxBarSize={32} />
            <Line {...CHART_MOTION} type="monotone" dataKey="converted" name="Converted" stroke="#D4A84B" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Channel mix" subtitle="Campaigns by channel">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={byChannel} dataKey="value" nameKey="name" innerRadius={48} outerRadius={90} paddingAngle={2}>
              {byChannel.map((_, i) => (
                <Cell key={byChannel[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Campaign status" subtitle="Lifecycle distribution">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={byStatus} dataKey="value" nameKey="name" outerRadius={90}>
              {byStatus.map((_, i) => (
                <Cell key={byStatus[i].name} fill={CHART_COLORS[(i + 3) % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Conversion rate by campaign" subtitle="Converted ÷ leads generated">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={conversion} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis unit="%" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="rate" name="Conversion %" fill="#C47A86" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Campaign type mix" subtitle="Strategy distribution">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={byType} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={130} tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Campaigns" fill="#D4A84B" radius={[0, 6, 6, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

function ActivityPanel() {
  const taskStatus = useMemo(() => countBy(tasks, (t) => t.status), []);
  const taskPriority = useMemo(() => countBy(tasks, (t) => t.priority), []);
  const callType = useMemo(() => countBy(calls, (c) => c.type), []);
  const meetingOwner = useMemo(() => countBy(meetings, (m) => m.owner), []);

  const weeklyProxy = useMemo(() => {
    // Derive a simple activity intensity series from seeded records
    return [
      { name: "Mon", tasks: 3, meetings: 1, calls: 1 },
      { name: "Tue", tasks: 2, meetings: 2, calls: 0 },
      { name: "Wed", tasks: 2, meetings: 1, calls: 1 },
      { name: "Thu", tasks: 1, meetings: 2, calls: 1 },
      { name: "Fri", tasks: 2, meetings: 1, calls: 0 },
    ].map((row, i) => ({
      ...row,
      tasks: Math.max(0, row.tasks + (tasks.length % (i + 2)) - 1),
      meetings: Math.max(0, row.meetings + (meetings.length % (i + 1))),
      calls: Math.max(0, row.calls + (calls.length % (i + 2))),
    }));
  }, []);

  const taskAccounts = useMemo(() => countBy(tasks, (t) => t.account || "Unassigned").slice(0, 6), []);

  return (
    <div className="report-grid">
      <ReportCard title="Weekly activity intensity" subtitle="Tasks · meetings · calls" className="report-span-2">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={weeklyProxy} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="taskFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#C47A86" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#C47A86" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="meetFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7BA3D4" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#7BA3D4" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area {...CHART_MOTION} type="monotone" dataKey="tasks" name="Tasks" stroke="#C47A86" fill="url(#taskFill)" strokeWidth={2} />
            <Area {...CHART_MOTION} type="monotone" dataKey="meetings" name="Meetings" stroke="#7BA3D4" fill="url(#meetFill)" strokeWidth={2} />
            <Line {...CHART_MOTION} type="monotone" dataKey="calls" name="Calls" stroke="#D4A84B" strokeWidth={2} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Task status" subtitle="Execution health">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={taskStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={3}>
              {taskStatus.map((_, i) => (
                <Cell key={taskStatus[i].name} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Task priority" subtitle="Workload urgency">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={taskPriority} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Tasks" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {taskPriority.map((d) => (
                <Cell
                  key={d.name}
                  fill={d.name === "High" ? "#D49084" : d.name === "Normal" ? "#7BA3D4" : "#6BB8B0"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Call direction" subtitle="Inbound vs outbound">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie {...CHART_MOTION} data={callType} dataKey="value" nameKey="name" outerRadius={90}>
              {callType.map((d, i) => (
                <Cell key={d.name} fill={i === 0 ? "#C47A86" : "#6BB8B0"} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Meetings by owner" subtitle="Calendar load">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={meetingOwner} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={70} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Meetings" fill="#A894D4" radius={[0, 6, 6, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>

      <ReportCard title="Tasks by related account" subtitle="Top accounts with open work" className="report-span-2">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={taskAccounts} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
            <XAxis dataKey="name" interval={0} angle={-15} textAnchor="end" height={50} tick={{ fill: "var(--muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "var(--muted)", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar {...CHART_MOTION} dataKey="value" name="Tasks" fill="#C47A86" radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </ReportCard>
    </div>
  );
}

const TABS: { key: ReportTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "loans", label: "Loans" },
  { key: "clients", label: "Clients" },
  { key: "pipeline", label: "Pipeline" },
  { key: "campaigns", label: "Campaigns" },
  { key: "activity", label: "Activity" },
];

export function ReportsWorkspace() {
  const [tab, setTab] = useState<ReportTab>("overview");

  return (
    <div className="reports-page">
      <header className="reports-header">
        <div>
          <h2>Business Reports</h2>
          <p className="muted">Live analytics from loans, clients, leads, campaigns, and activities.</p>
        </div>
      </header>

      <KpiStrip />

      <div className="reports-tabs" role="tablist" aria-label="Report categories">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`reports-tab ${tab === item.key ? "active" : ""}`}
            onClick={() => startTransition(() => setTab(item.key))}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewPanel />}
      {tab === "loans" && <LoansPanel />}
      {tab === "clients" && <ClientsPanel />}
      {tab === "pipeline" && <PipelinePanel />}
      {tab === "campaigns" && <CampaignsPanel />}
      {tab === "activity" && <ActivityPanel />}
    </div>
  );
}
