"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/services/api";
import { useAuthStore } from "@/store/auth.store";

type RoleType =
  | "MD"
  | "NSM"
  | "ZSM"
  | "RM"
  | "ASM"
  | "MR"
  | "DISTRIBUTOR"
  | "DOCTOR"
  | "ADMIN"
  | "HR"
  | "FINANCE"
  | "WAREHOUSE"
  | "MARKETING";

const ROLE_PRESETS: Record<RoleType, { email: string; pass: string }> = {
  MD: { email: "md@mrtracker.com", pass: "md12345" },
  NSM: { email: "nsm@mrtracker.com", pass: "nsm12345" },
  ZSM: { email: "zsm@mrtracker.com", pass: "zsm12345" },
  RM: { email: "rm@mrtracker.com", pass: "rm12345" },
  ASM: { email: "asm@mrtracker.com", pass: "asm123" },
  MR: { email: "mr@mrtracker.com", pass: "mr12345" },
  DISTRIBUTOR: { email: "distributor@mrtracker.com", pass: "distributor12345" },
  DOCTOR: { email: "doctor@mrtracker.com", pass: "doctor12345" },
  ADMIN: { email: "admin@mrtracker.com", pass: "admin123" },
  HR: { email: "hr@mrtracker.com", pass: "hr12345" },
  FINANCE: { email: "finance@mrtracker.com", pass: "finance12345" },
  WAREHOUSE: { email: "warehouse@mrtracker.com", pass: "warehouse12345" },
  MARKETING: { email: "marketing@mrtracker.com", pass: "marketing12345" },
};

export function ManagerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [role, setRole] = useState<RoleType>("ADMIN");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceUuid, setDeviceUuid] = useState("device-local-uuid-99");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Apply default credential presets when selecting a role
  useEffect(() => {
    const preset = ROLE_PRESETS[role];
    if (preset) {
      setEmail(preset.email);
      setPassword(preset.pass);
    }
  }, [role]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const payload: any = { email, password, role };
      if (role === "MR") {
        payload.deviceUuid = deviceUuid;
      }

      const res = await api.post("/auth/login", payload);
      const data = res.data.data;
      setAuth(data.user, { accessToken: data.accessToken, refreshToken: data.refreshToken });

      // Dynamic redirection route based on Role type
      let destination = searchParams.get("from");
      if (!destination) {
        switch (role) {
          case "ADMIN":
            destination = "/admin";
            break;
          case "HR":
            destination = "/hrms";
            break;
          case "FINANCE":
            destination = "/expenses";
            break;
          case "MD":
          case "NSM":
          case "ZSM":
          case "RM":
          case "ASM":
          default:
            destination = "/dashboard";
            break;
        }
      }
      router.replace(destination);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Select Login Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as RoleType)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary-500 focus:outline-none"
        >
          <option value="ADMIN">Admin Manager</option>
          <option value="MD">Managing Director (MD)</option>
          <option value="NSM">National Sales Manager (NSM)</option>
          <option value="ZSM">Zonal Sales Manager (ZSM)</option>
          <option value="RM">Regional Manager (RM)</option>
          <option value="ASM">Area Sales Manager (ASM)</option>
          <option value="MR">Medical Representative (MR)</option>
          <option value="HR">HR Representative</option>
          <option value="FINANCE">Finance Officer</option>
          <option value="WAREHOUSE">Warehouse Logistics</option>
          <option value="MARKETING">Marketing Lead</option>
          <option value="DISTRIBUTOR">Distributor</option>
          <option value="DOCTOR">Doctor Portal</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Email Address</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required
        />
      </div>

      {role === "MR" && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Device Hardware UUID</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 shadow-sm focus:border-primary-500 focus:outline-none"
            type="text"
            value={deviceUuid}
            onChange={(e) => setDeviceUuid(e.target.value)}
            placeholder="Device UUID"
            required
          />
        </div>
      )}

      {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition shadow disabled:opacity-60"
      >
        {loading ? "Signing in..." : `Sign in as ${role}`}
      </button>
    </form>
  );
}
