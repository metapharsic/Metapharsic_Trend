"use client";

import React, { useEffect, useState } from "react";
import { apiClient } from "@/lib/api-client";

interface Course {
  id: string;
  title: string;
  description: string | null;
  _count: { enrollments: number };
}

interface Enrollment {
  id: string;
  progressPercent: number;
  quizScore: number | null;
  completed: boolean;
  completedAt: string | null;
  course: { id: string; title: string; description: string | null };
  employee: { id: string; firstName: string; lastName: string };
}

export default function LmsPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiClient.get("/api/lms/courses"), apiClient.get("/api/lms/enrollments")])
      .then(([c, e]) => {
        setCourses(c.data.data.courses || []);
        setEnrollments(e.data.data.enrollments || []);
      })
      .catch((err) => console.error("Failed to fetch LMS data:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h1 className="text-2xl font-display font-bold text-gray-900">Training (LMS)</h1>
        <p className="text-sm text-gray-500 mt-1">
          Course catalogue and field-force training progress. Completion requires full progress and a
          passing quiz score.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Courses</h2>
        {courses.length === 0 ? (
          <EmptyCard message="No courses published." />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {courses.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800">{c.title}</h3>
                {c.description && <p className="text-xs text-gray-500 mt-1">{c.description}</p>}
                <p className="text-xs text-gray-400 mt-3">
                  {c._count.enrollments} enrolled
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Enrollments</h2>
        {enrollments.length === 0 ? (
          <EmptyCard message="No employees enrolled yet." />
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <div key={e.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <p className="font-bold text-gray-800">
                      {e.employee.firstName} {e.employee.lastName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{e.course.title}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                      e.completed ? "bg-primary-50 text-primary-700" : "bg-amber-50 text-amber-600"
                    }`}
                  >
                    {e.completed ? "Completed" : "In progress"}
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>
                      {e.progressPercent}%
                      {e.quizScore !== null ? ` · quiz ${e.quizScore}` : " · quiz not taken"}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all"
                      style={{ width: `${Math.min(Math.max(e.progressPercent, 0), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
