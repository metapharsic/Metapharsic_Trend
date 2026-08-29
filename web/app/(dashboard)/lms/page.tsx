"use client";

import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  PlayCircle,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  type LucideIcon,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface Course {
  id: string;
  title: string;
  description?: string;
  _count?: { enrollments: number };
  userEnrollment?: {
    progressPercent: number;
    completed: boolean;
    quizScore?: number | null;
  } | null;
}

interface LmsKpis {
  totalCourses: number;
  enrolledCourses: number;
  completedCourses: number;
  hoursLearning: number;
  certificatesEarned: number;
  totalEnrollmentsAcrossTeam: number;
}

export default function LmsDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [kpis, setKpis] = useState<LmsKpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourses = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get("/api/lms/courses")
      .then((res) => {
        setCourses(res.data.data.courses ?? []);
        setKpis(res.data.data.kpis ?? null);
      })
      .catch((err) => {
        console.error("Failed to load LMS courses:", err);
        setError("Failed to load courses from database.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  if (loading && courses.length === 0) {
    return (
      <div className="flex justify-center items-center py-32">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (error && courses.length === 0) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
          <h2 className="text-lg font-bold text-rose-900">Training Portal Unavailable</h2>
          <p className="text-sm text-rose-700">{error}</p>
          <button
            onClick={fetchCourses}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl"
          >
            Retry Sync
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Training & Development</h1>
          <p className="text-sm text-slate-500 mt-1">Live pharmaceutical detailing courses and product knowledge certifications</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCourses}
            className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile
          icon={GraduationCap}
          label="Enrolled Courses"
          value={kpis?.enrolledCourses ?? 0}
          tone="neutral"
        />
        <KpiTile
          icon={Clock}
          label="Hours Learning"
          value={`${kpis?.hoursLearning ?? 0} hrs`}
          tone="purple"
        />
        <KpiTile
          icon={Award}
          label="Certificates Earned"
          value={kpis?.certificatesEarned ?? 0}
          tone="good"
        />
      </div>

      {/* Course Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No Training Courses Published Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Courses created by ASMs, HR, or Admins will appear here in real-time.
            </p>
          </div>
        ) : (
          courses.map((course) => {
            const isCompleted = course.userEnrollment?.completed ?? false;
            const progress = course.userEnrollment?.progressPercent ?? (isCompleted ? 100 : 0);

            return (
              <div
                key={course.id}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-purple-300 hover:shadow-md transition-all group flex flex-col justify-between"
              >
                <div className="h-32 bg-slate-100 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-indigo-50 flex items-center justify-center text-purple-300">
                    <PlayCircle
                      size={48}
                      className="opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all cursor-pointer text-purple-600"
                    />
                  </div>
                  {isCompleted && (
                    <div className="absolute top-3 right-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                      <CheckCircle2 size={12} /> Certified
                    </div>
                  )}
                </div>

                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">
                      Pharmaceutical Detailing Module
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-2">
                      {course.title}
                    </h3>
                    {course.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {course.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {course.userEnrollment && (
                      <div>
                        <div className="flex justify-between text-[11px] font-semibold text-slate-600 mb-1">
                          <span>Progress</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <BookOpen size={12} /> {course._count?.enrollments ?? 0} enrolled
                      </span>
                      <span className="text-purple-600 font-bold hover:underline cursor-pointer">
                        {isCompleted ? "Review" : "Launch Course"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: string;
}) {
  const toneClass =
    tone === "purple"
      ? "bg-purple-100 text-purple-600"
      : tone === "good"
      ? "bg-emerald-100 text-emerald-600"
      : "bg-slate-100 text-slate-600";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClass}`}>
        <Icon size={20} />
      </div>
      <p className="text-3xl font-display font-bold text-slate-900 mt-4">{value}</p>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
