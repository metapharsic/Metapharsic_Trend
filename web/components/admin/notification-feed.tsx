"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Bell, ShieldAlert, XCircle, Check } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Notif {
  id: string;
  code: string;
  severity: "CRITICAL" | "ERROR" | "WARNING" | "INFO";
  message: string;
  action: string | null;
  read: boolean;
  createdAt: string;
  employee: { id: string; name: string };
}

const ICONS: Record<string, React.ElementType> = { CRITICAL: ShieldAlert, ERROR: XCircle };
const STYLES: Record<string, string> = {
  CRITICAL: "bg-red-50 border-red-200 text-red-700",
  ERROR: "bg-amber-50 border-amber-200 text-amber-700",
};

export function NotificationFeed() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFeed = useCallback(() => {
    apiClient.get("/api/manager/notifications", { params: { unreadOnly: true } })
      .then((res) => setNotifs(res.data.data.notifications ?? []))
      .catch(() => setNotifs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const markRead = async (id: string) => {
    setNotifs((prev) => prev.filter((n) => n.id !== id));
    try {
      await apiClient.patch("/api/manager/notifications", { id });
    } catch {
      fetchFeed();
    }
  };

  if (loading) return null;
  if (notifs.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
        <h2 className="text-xs font-bold text-slate-800 flex items-center gap-2">
          <Bell size={14} /> Critical Alerts Across Field Force
        </h2>
        <span className="text-[11px] font-semibold text-slate-500">{notifs.length} unread</span>
      </div>
      <div className="divide-y divide-slate-100">
        {notifs.map((n) => {
          const Icon = ICONS[n.severity] ?? Bell;
          return (
            <div key={n.id} className={`px-4 py-3 flex items-start gap-3 ${STYLES[n.severity] ?? ""}`}>
              <Icon size={15} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold">{n.employee.name}: {n.message}</p>
                {n.action && <p className="text-xs mt-0.5 opacity-80">{n.action}</p>}
              </div>
              <button onClick={() => markRead(n.id)} className="text-slate-400 hover:text-emerald-600 p-1" title="Mark as read">
                <Check size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
