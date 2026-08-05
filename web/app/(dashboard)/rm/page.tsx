"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  IndianRupee,
  Target,
  Trophy,
  TrendingUp,
  TrendingDown,
  Package,
  Users2,
  UserCheck,
  Activity,
  CalendarCheck,
  Stethoscope,
  Store,
  Building2,
  PhoneMissed,
  CalendarClock,
  MapPinned,
  UserPlus,
  Receipt,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface RmDashboard {
  manager: { id: string; name: string; regions: string[] };
  kpis: {
    regionalSales: { amount: number };
    targetAchievement: { percent: number; target: number; achieved: number };
    regionRanking: { rank: number | null; totalRegions: number; region: string | null };
    monthlyGrowth: { percent: number | null; current: number; previous: number };
    productPerformance: { topProducts: { name: string; revenue: number }[]; totalProducts: number };
  };
  team: {
    totalAsms: number;
    totalMrs: number;
    attendance: { present: number; total: number };
    activeUsers: number;
  };
  fieldActivities: {
    todaysVisits: number;
    doctorCalls: number;
    chemistCalls: number;
    hospitalCalls: number;
    missedCalls: number;
    followUpsDue: number;
  };
  coverage: {
    doctorCoverage: { visited: number; total: number; percent: number };
    chemistCoverage: { visited: number; total: number; percent: number };
    territoryCoverage: { visited: number; total: number; percent: number };
    newDoctorRegistration: number;
  };
  expense: { regionalExpenses: number; pendingClaims: number; approvedClaims: number };
  approvals: {
    dcrApproval: number;
    tourPlanApproval: number;
    leaveApproval: number;
    expenseApproval: number;
    total: number;
  };
  charts: {
    asmRanking: { name: string; visits: number; teamSize: number }[];
    mrRanking: { name: string; visits: number }[];
    productSales: { name: string; sku: string; revenue: number }[];
    areaSales: { name: string; revenue: number }[];
    dailyTrend: { date: string; label: string; visits: number; sales: number }[];
  };
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

const CHART_COLOR = "#15845a";
const CHART_ALT = "#7bdaac";

export default function RmDashboardPage() {
  const [data, setData] = useState<RmDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/manager/dashboard/rm")
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Failed to load RM dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
        <p className="text-gray-400 text-sm">Unable to load the regional dashboard.</p>
      </div>
    );
  }

  const growth = data.kpis.monthlyGrowth.percent;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">
          Regional Manager Dashboard
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {data.manager.name}
          {data.manager.regions.length > 0
            ? ` · ${data.manager.regions.join(", ")}`
            : " · no territories assigned"}
        </p>
      </div>

      <Section title="Key Performance">
        <Tile
          icon={IndianRupee}
          label="Regional Sales"
          value={currency(data.kpis.regionalSales.amount)}
          sub="This month"
        />
        <Tile
          icon={Target}
          label="Target Achievement"
          value={`${data.kpis.targetAchievement.percent}%`}
          sub={
            data.kpis.targetAchievement.target > 0
              ? `of ${currency(data.kpis.targetAchievement.target)}`
              : "No target set"
          }
          tone={data.kpis.targetAchievement.percent >= 100 ? "good" : "warn"}
        />
        <Tile
          icon={Trophy}
          label="Region Ranking"
          value={data.kpis.regionRanking.rank ? `#${data.kpis.regionRanking.rank}` : "—"}
          sub={
            data.kpis.regionRanking.rank
              ? `of ${data.kpis.regionRanking.totalRegions} regions`
              : "No sales recorded"
          }
        />
        <Tile
          icon={growth !== null && growth < 0 ? TrendingDown : TrendingUp}
          label="Monthly Growth"
          value={growth === null ? "n/a" : `${growth > 0 ? "+" : ""}${growth}%`}
          sub={
            growth === null
              ? "No sales last month"
              : `vs ${currency(data.kpis.monthlyGrowth.previous)}`
          }
          tone={growth === null ? "neutral" : growth >= 0 ? "good" : "warn"}
        />
        <Tile
          icon={Package}
          label="Product Performance"
          value={data.kpis.productPerformance.totalProducts}
          sub={
            data.kpis.productPerformance.topProducts[0]
              ? `Top: ${data.kpis.productPerformance.topProducts[0].name}`
              : "No sales this month"
          }
        />
      </Section>

      <Section title="Team">
        <Tile icon={Users2} label="Total ASMs" value={data.team.totalAsms} />
        <Tile icon={Users2} label="Total MRs" value={data.team.totalMrs} />
        <Tile
          icon={UserCheck}
          label="Attendance"
          value={`${data.team.attendance.present}/${data.team.attendance.total}`}
          sub="Present today"
          tone={
            data.team.attendance.total > 0 &&
            data.team.attendance.present < data.team.attendance.total
              ? "warn"
              : "good"
          }
        />
        <Tile
          icon={Activity}
          label="Active Users"
          value={data.team.activeUsers}
          sub="Accounts enabled"
        />
      </Section>

      <Section title="Field Activities">
        <Tile icon={CalendarCheck} label="Today's Visits" value={data.fieldActivities.todaysVisits} />
        <Tile icon={Stethoscope} label="Doctor Calls" value={data.fieldActivities.doctorCalls} sub="Today" />
        <Tile icon={Store} label="Chemist Calls" value={data.fieldActivities.chemistCalls} sub="Today" />
        <Tile icon={Building2} label="Hospital Calls" value={data.fieldActivities.hospitalCalls} sub="Today" />
        <Tile
          icon={PhoneMissed}
          label="Missed Calls"
          value={data.fieldActivities.missedCalls}
          sub="Planned, not visited"
          tone={data.fieldActivities.missedCalls > 0 ? "warn" : "good"}
        />
        <Tile
          icon={CalendarClock}
          label="Follow-ups Due"
          value={data.fieldActivities.followUpsDue}
          tone={data.fieldActivities.followUpsDue > 0 ? "warn" : "good"}
        />
      </Section>

      <Section title="Coverage">
        <CoverageTile
          icon={Stethoscope}
          label="Doctor Coverage"
          visited={data.coverage.doctorCoverage.visited}
          total={data.coverage.doctorCoverage.total}
          percent={data.coverage.doctorCoverage.percent}
        />
        <CoverageTile
          icon={Store}
          label="Chemist Coverage"
          visited={data.coverage.chemistCoverage.visited}
          total={data.coverage.chemistCoverage.total}
          percent={data.coverage.chemistCoverage.percent}
        />
        <CoverageTile
          icon={MapPinned}
          label="Territory Coverage"
          visited={data.coverage.territoryCoverage.visited}
          total={data.coverage.territoryCoverage.total}
          percent={data.coverage.territoryCoverage.percent}
        />
        <Tile
          icon={UserPlus}
          label="New Doctor Registration"
          value={data.coverage.newDoctorRegistration}
          sub="Added this month"
        />
      </Section>

      <Section title="Expense">
        <Tile
          icon={IndianRupee}
          label="Regional Expenses"
          value={currency(data.expense.regionalExpenses)}
          sub="This month"
        />
        <Tile
          icon={Receipt}
          label="Pending Claims"
          value={data.expense.pendingClaims}
          tone={data.expense.pendingClaims > 0 ? "warn" : "good"}
        />
        <Tile
          icon={ClipboardCheck}
          label="Approved Claims"
          value={data.expense.approvedClaims}
          sub="This month"
        />
      </Section>

      <Section
        title={`Approvals${data.approvals.total > 0 ? ` (${data.approvals.total} pending)` : ""}`}
      >
        <Tile
          icon={ClipboardCheck}
          label="DCR Approval"
          value={data.approvals.dcrApproval}
          sub="Flagged visits to review"
          tone={data.approvals.dcrApproval > 0 ? "warn" : "good"}
        />
        <Tile
          icon={CalendarCheck}
          label="Tour Plan Approval"
          value={data.approvals.tourPlanApproval}
          tone={data.approvals.tourPlanApproval > 0 ? "warn" : "good"}
        />
        <Tile
          icon={CalendarClock}
          label="Leave Approval"
          value={data.approvals.leaveApproval}
          tone={data.approvals.leaveApproval > 0 ? "warn" : "good"}
        />
        <Tile
          icon={Receipt}
          label="Expense Approval"
          value={data.approvals.expenseApproval}
          tone={data.approvals.expenseApproval > 0 ? "warn" : "good"}
        />
      </Section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
          Performance Charts
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCard title="ASM Ranking" empty={data.charts.asmRanking.length === 0}>
            <BarChart data={data.charts.asmRanking} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} visits`, "Team visits"]} />
              <Bar dataKey="visits" fill={CHART_COLOR} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="MR Ranking" empty={data.charts.mrRanking.length === 0}>
            <BarChart data={data.charts.mrRanking} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [`${v} visits`, "Visits"]} />
              <Bar dataKey="visits" fill={CHART_ALT} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Product Sales" empty={data.charts.productSales.length === 0}>
            <BarChart data={data.charts.productSales} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={54}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [currency(v), "Revenue"]} />
              <Bar dataKey="revenue" fill={CHART_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Area-wise Sales" empty={data.charts.areaSales.length === 0}>
            <BarChart data={data.charts.areaSales} margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={54}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => [currency(v), "Revenue"]} />
              <Bar dataKey="revenue" fill={CHART_ALT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>

        <ChartCard title="Daily Trend (14 days)" empty={false} height={260}>
          <LineChart data={data.charts.dailyTrend} margin={{ left: 8, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) =>
                name === "sales" ? [currency(value), "Sales"] : [value, "Visits"]
              }
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="visits"
              stroke={CHART_COLOR}
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sales"
              stroke={CHART_ALT}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartCard>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {children}
      </div>
    </section>
  );
}

function ChartCard({
  title,
  children,
  empty,
  height = 240,
}: {
  title: string;
  children: React.ReactElement;
  empty: boolean;
  height?: number;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-bold text-gray-800 text-sm mb-4">{title}</h3>
      {empty ? (
        <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
          No data for this period.
        </div>
      ) : (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function Tile({
  icon: Icon,
  label,
  value,
  sub,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "good" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "bg-amber-50 text-amber-600"
      : tone === "good"
        ? "bg-primary-50 text-primary-600"
        : "bg-gray-50 text-gray-500";

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-2xl font-display font-bold text-gray-900 mt-3">{value}</p>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CoverageTile({
  icon: Icon,
  label,
  visited,
  total,
  percent,
}: {
  icon: LucideIcon;
  label: string;
  visited: number;
  total: number;
  percent: number;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
        <Icon size={18} />
      </div>
      <p className="text-2xl font-display font-bold text-gray-900 mt-3">
        {visited}
        <span className="text-base text-gray-400 font-normal">/{total}</span>
      </p>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mt-1">{label}</p>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
        <div
          className="h-full bg-primary-600 rounded-full transition-all"
          style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 mt-1">{percent}% this month</p>
    </div>
  );
}
