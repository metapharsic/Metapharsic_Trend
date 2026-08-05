"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm space-y-4"
      >
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trend MR</h1>
          <p className="text-sm text-gray-500 mt-1">Manager / Admin sign in</p>
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
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}
