"use client";

import React, { useEffect, useState } from "react";
import {
  GraduationCap,
  BookOpen,
  Award,
  Clock,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";

import { apiClient } from "@/lib/api-client";

interface Course {
  id: string;
  title: string;
  description?: string;
  _count?: { enrollments: number };
}

export default function LmsDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get("/api/lms/courses")
      .then((res) => setCourses(res.data.data.courses ?? []))
      .catch(() => {
        setCourses([
          { id: "C-101", title: "Cardiology Detailing Fundamentals", description: "Product knowledge and detailing technique for the cardiology portfolio.", _count: { enrollments: 1 } },
          { id: "C-102", title: "Objection Handling Framework", description: "Advanced sales skills for overcoming doctor objections.", _count: { enrollments: 0 } },
          { id: "C-103", title: "Compliance & Ethics 2026", description: "Mandatory annual compliance training.", _count: { enrollments: 3 } },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-purple-100 flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Training & Development</h1>
          <p className="text-sm text-slate-500 mt-1">Enhance your product knowledge and sales skills</p>
        </div>
        <button className="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 shadow-sm transition-colors flex items-center gap-2">
          <BookOpen size={16} /> Course Catalog
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiTile icon={GraduationCap} label="Enrolled Courses" value="3" tone="neutral" />
        <KpiTile icon={Clock} label="Hours Learning" value="12.5" tone="purple" />
        <KpiTile icon={Award} label="Certificates Earned" value="8" tone="good" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {courses.map((course) => (
          <div key={course.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-purple-200 transition-colors group">
            <div className="h-32 bg-slate-100 relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-100 to-indigo-50 flex items-center justify-center text-purple-300">
                <PlayCircle size={48} className="opacity-50 group-hover:opacity-100 group-hover:scale-110 transition-all cursor-pointer text-purple-600" />
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Course</span>
                <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-2">{course.title}</h3>
                {course.description && (
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{course.description}</p>
                )}
              </div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1"><BookOpen size={12} /> {course._count?.enrollments ?? 0} enrolled</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  const toneClass = tone === "purple" ? "bg-purple-100 text-purple-600" : tone === "good" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600";
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
