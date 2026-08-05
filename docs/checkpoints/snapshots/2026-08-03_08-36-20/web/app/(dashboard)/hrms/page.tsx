"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  type: string;
  status: string;
  reason: string | null;
  employee: { id: string; firstName: string; lastName: string };
}

interface Payroll {
  id: string;
  month: string;
  basicSalary: string;
  incentives: string;
  netPayable: string;
  employee: { id: string; firstName: string; lastName: string };
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-600",
  APPROVED: "bg-primary-50 text-primary-700",
  REJECTED: "bg-red-50 text-red-600",
};

function currency(value: string | number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function HrmsPage() {
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [leaveRes, payrollRes] = await Promise.all([
        apiClient.get("/api/hrms/leave"),
        apiClient.get("/api/hrms/payroll"),
      ]);
      setLeaveRequests(leaveRes.data.data.leaveRequests || []);
      setPayrolls(payrollRes.data.data.payrolls || []);
    } catch (err) {
      console.error("Failed to fetch HRMS data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const decide = async (leaveRequestId: string, status: "APPROVED" | "REJECTED") => {
    setActingId(leaveRequestId);
    try {
      await apiClient.put("/api/hrms/leave", { leaveRequestId, status });
      await fetchData();
    } catch (err) {
      alert("Failed to review leave request.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">HRMS</h1>
        <p className="text-sm text-gray-500 mt-1">Leave approvals and payroll records.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Leave Requests</h2>
            {leaveRequests.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No leave requests submitted.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaveRequests.map((lr) => (
                  <div
                    key={lr.id}
                    className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex justify-between items-center gap-4"
                  >
                    <div>
                      <p className="font-bold text-gray-800">
                        {lr.employee.firstName} {lr.employee.lastName} · {lr.type}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(lr.startDate).toLocaleDateString("en-IN")} –{" "}
                        {new Date(lr.endDate).toLocaleDateString("en-IN")}
                        {lr.reason ? ` · ${lr.reason}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[lr.status] ?? "bg-gray-50 text-gray-600"}`}
                      >
                        {lr.status}
                      </span>
                      {lr.status === "PENDING" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(lr.id, "APPROVED")}
                            disabled={actingId !== null}
                            className="bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => decide(lr.id, "REJECTED")}
                            disabled={actingId !== null}
                            className="bg-white border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Payroll</h2>
            {payrolls.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <p className="text-gray-400 text-sm">No payroll records generated.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                      <th className="px-6 py-3">Employee</th>
                      <th className="px-6 py-3">Month</th>
                      <th className="px-6 py-3">Basic</th>
                      <th className="px-6 py-3">Incentives</th>
                      <th className="px-6 py-3">Net Payable</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map((p) => (
                      <tr key={p.id} className="border-b border-gray-50 last:border-0">
                        <td className="px-6 py-4 font-medium text-gray-800">
                          {p.employee.firstName} {p.employee.lastName}
                        </td>
                        <td className="px-6 py-4 text-gray-600">
                          {new Date(p.month).toLocaleDateString("en-IN", {
                            month: "long",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4 text-gray-600">{currency(p.basicSalary)}</td>
                        <td className="px-6 py-4 text-primary-600 font-semibold">
                          {currency(p.incentives)}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-800">
                          {currency(p.netPayable)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
