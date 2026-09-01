"use client";

import React, { useState } from "react";
import { ShieldAlert, Activity } from "lucide-react";
import { SystemDiagnosticsModal } from "@/components/system-diagnostics-modal";

export default function AdminDiagnosticsPage() {
  const [modalOpen, setModalOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <ShieldAlert size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">System Health &amp; Diagnostics</h1>
              <p className="text-slate-400 text-xs mt-0.5">
                Complete diagnostic intelligence, live database latency, and forensic error reporting
              </p>
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Launch Diagnostics Inspector
          </button>
        </div>
      </div>

      <SystemDiagnosticsModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
