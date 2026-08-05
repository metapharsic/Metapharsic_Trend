"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Claim {
  id: string;
  amount: string;
  category: string;
  description: string | null;
  status: string;
  receiptUrl: string | null;
  createdAt: string;
  employee: { id: string; firstName: string; lastName: string };
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-gray-50 text-gray-600",
  PENDING_ASM: "bg-amber-50 text-amber-600",
  PENDING_RM: "bg-amber-50 text-amber-600",
  PENDING_FINANCE: "bg-amber-50 text-amber-600",
  APPROVED: "bg-primary-50 text-primary-700",
  REJECTED: "bg-red-50 text-red-600",
};

export default function ExpensesPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await apiClient.get("/api/expenses/claims");
      setClaims(res.data.data.claims || []);
    } catch (err) {
      console.error("Failed to fetch expense claims:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const decide = async (id: string, status: "APPROVED" | "REJECTED") => {
    setActingId(id);
    try {
      await apiClient.put(`/api/expenses/claims/${id}/review`, { status });
      await fetchData();
    } catch (err) {
      alert("Failed to review expense claim.");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Expense Claims</h1>
        <p className="text-sm text-gray-500 mt-1">Daily mileage and expense claim approvals.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : claims.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-gray-400 text-sm">No expense claims submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-gray-800">
                  {claim.employee.firstName} {claim.employee.lastName} · {claim.category}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(
                    Number(claim.amount)
                  )}
                  {claim.description ? ` · ${claim.description}` : ""}
                </p>
                {claim.receiptUrl && (
                  <a
                    href={claim.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary-600 hover:underline mt-1 inline-block"
                  >
                    View receipt
                  </a>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_STYLES[claim.status] ?? "bg-gray-50 text-gray-600"}`}
                >
                  {claim.status.replace("_", " ")}
                </span>
                {claim.status === "PENDING_ASM" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(claim.id, "APPROVED")}
                      disabled={actingId !== null}
                      className="bg-primary-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide(claim.id, "REJECTED")}
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
    </div>
  );
}
