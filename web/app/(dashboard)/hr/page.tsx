"use client";

import React, { useEffect, useState } from "react";
import {
  Users2,
  UserCheck,
  UserPlus,
  UserX,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  IndianRupee,
  Receipt,
  ShieldAlert,
  GraduationCap,
  CircleCheck,
  CircleDashed,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface HrDashboard {
  workforce: {
    totalEmployees: number;
    activeEmployees: number;
    inactiveEmployees: number;
    newHiresThisMonth: number;
    byRole: { role: string; count: number }[];
  };
  attendance: { present: number; absent: number; onLeave: number; total: number };
  leave: { pending: number; approvedThisMonth: number; onLeaveToday: number };
  payroll: { month: string; generated: number; pending: number; totalPayout: number };
  compliance: { lockedAccounts: number };
  training: { completed: number; inProgress: number; notStarted: number; total: number };
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function HrDashboardPage() {
  const [data, setData] = useState<HrDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/api/manager/dashboard/hr")
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Failed to load HR dashboard:", err))
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
        <p className="text-gray-400 text-sm">Unable to load the HR dashboard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">HR Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Company-wide workforce, attendance, leave, payroll, training.</p>
      </div>

      <Section title="Workforce">
        <Tile icon={Users2} label="Total Employees" value={data.workforce.totalEmployees} />
        <Tile
          icon={UserCheck}
          label="Active"
          value={data.workforce.activeEmployees}
          sub={`${data.workforce.inactiveEmployees} inactive`}
        />
        <Tile icon={UserPlus} label="New Hires" value={data.workforce.newHiresThisMonth} sub="This month" />
        <Tile
          icon={Users2}
          label="Roles"
          value={data.workforce.byRole.length}
          sub={data.workforce.byRole
            .slice(0, 3)
            .map((r) => `${r.role} ${r.count}`)
            .join(", ")}
        />
      </Section>

      <Section title="Attendance (Today)">
        <Tile
          icon={UserCheck}
          label="Present"
          value={`${data.attendance.present}/${data.attendance.total}`}
          tone={data.attendance.present < data.attendance.total ? "warn" : "good"}
        />
        <Tile
          icon={UserX}
          label="Absent"
          value={data.attendance.absent}
          tone={data.attendance.absent > 0 ? "warn" : "good"}
        />
        <Tile icon={CalendarX} label="On Leave" value={data.attendance.onLeave} />
      </Section>

      <Section title="Leave">
        <Tile
          icon={CalendarClock}
          label="Pending Requests"
          value={data.leave.pending}
          tone={data.leave.pending > 0 ? "warn" : "good"}
        />
        <Tile icon={CalendarCheck} label="Approved" value={data.leave.approvedThisMonth} sub="This month" />
        <Tile icon={CalendarX} label="On Leave Today" value={data.leave.onLeaveToday} />
      </Section>

      <Section title="Payroll">
        <Tile
          icon={IndianRupee}
          label="Total Payout"
          value={currency(data.payroll.totalPayout)}
          sub="This month"
        />
        <Tile icon={Receipt} label="Generated" value={data.payroll.generated} />
        <Tile
          icon={Receipt}
          label="Pending"
          value={data.payroll.pending}
          tone={data.payroll.pending > 0 ? "warn" : "good"}
        />
      </Section>

      <Section title="Compliance & Training">
        <Tile
          icon={ShieldAlert}
          label="Locked Accounts"
          value={data.compliance.lockedAccounts}
          tone={data.compliance.lockedAccounts > 0 ? "warn" : "good"}
        />
        <Tile icon={GraduationCap} label="Enrollments" value={data.training.total} />
        <Tile icon={CircleCheck} label="Completed" value={data.training.completed} tone="good" />
        <Tile icon={CircleDashed} label="In Progress" value={data.training.inProgress} sub={`${data.training.notStarted} not started`} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{children}</div>
    </section>
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
