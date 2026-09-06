"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post("/api/auth/login/manager", { email, password });
      localStorage.setItem("accessToken", res.data.data.accessToken);
      const role = res.data.data.user.role;
      const roleRoutes: Record<string, string> = {
        ADMIN: "/admin",
        MD: "/md",
        NSM: "/nsm",
        ZSM: "/zsm",
        RM: "/rm",
        ASM: "/asm",
        HR: "/hr",
        FINANCE: "/finance",
        WAREHOUSE: "/warehouse",
        MARKETING: "/marketing",
        DOCTOR: "/doctor",
        DISTRIBUTOR: "/distributor",
        MR: "/mr",
      };
      const redirectPath = roleRoutes[role] || "/territories";
      router.push(redirectPath);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center bg-gray-50 px-4"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm space-y-4"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trend MR</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Password
            </label>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium select-none"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white rounded-lg py-3 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 active:scale-[0.99] transition-transform shadow-sm"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">⚡ Quick 1-Click Role Logins:</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setEmail("admin@mrtracker.com");
                setPassword("Password@123");
              }}
              className="px-2 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-left transition flex flex-col"
            >
              <span className="font-semibold truncate">👑 Admin</span>
              <span className="text-[10px] text-slate-500 truncate">Password@123 / admin123</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("md@mrtracker.com");
                setPassword("Password@123");
              }}
              className="px-2 py-2 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 text-left transition flex flex-col"
            >
              <span className="font-semibold truncate">👔 MD (Director)</span>
              <span className="text-[10px] text-blue-500 truncate">Password@123</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("asm@mrtracker.com");
                setPassword("Password@123");
              }}
              className="px-2 py-2 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-left transition flex flex-col"
            >
              <span className="font-semibold truncate">💼 ASM (Manager)</span>
              <span className="text-[10px] text-emerald-500 truncate">Password@123 / asm123</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail("abdulmannan@mrtracker.com");
                setPassword("Password@123");
              }}
              className="px-2 py-2 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 text-left transition flex flex-col"
            >
              <span className="font-semibold truncate">🩺 MR (Mannan)</span>
              <span className="text-[10px] text-purple-500 truncate">Password@123</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
