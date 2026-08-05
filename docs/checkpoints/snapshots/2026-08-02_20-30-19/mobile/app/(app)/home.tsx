import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import { useAuthStore } from "@/store/auth.store";
import { visitService } from "@/services/visit.service";
import { attendanceService } from "@/services/attendance.service";
import { Colors } from "@/theme/colors";
import { formatDate } from "@/utils/formatters";
import type { Visit } from "@/types";

export default function HomeScreen() {
  const user = useAuthStore((s) => s.user);
  const [summary, setSummary] = useState({ totalVisits: 0, thisWeek: 0, thisMonth: 0 });
  const [recentVisits, setRecentVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);

  // Attendance states
  const [attendance, setAttendance] = useState({
    checkedIn: false,
    checkedOut: false,
    checkInTime: "",
    checkOutTime: "",
  });
  const [attLoading, setAttLoading] = useState(true);

  const fetchAttendance = async () => {
    try {
      const status = await attendanceService.getTodayStatus();
      setAttendance({
        checkedIn: status.checkedIn,
        checkedOut: status.checkedOut,
        checkInTime: status.checkInTime ? new Date(status.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
        checkOutTime: status.checkOutTime ? new Date(status.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "",
      });
    } catch {
      // ignore
    } finally {
      setAttLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await visitService.getMyVisits({ limit: 5 });
        setRecentVisits(res.visits);
        setSummary(res.summary);
      } catch { /* handled silently */ }
      finally { setLoading(false); }
    })();
    fetchAttendance();
  }, []);

  const handleCheckIn = async () => {
    setAttLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required for attendance check-in.");
        setAttLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await attendanceService.checkIn(loc.coords.latitude, loc.coords.longitude);
      Alert.alert("Success", "Checked in successfully!");
      fetchAttendance();
    } catch (err: any) {
      Alert.alert("Check-In Failed", err?.response?.data?.error?.message || err?.message || "Something went wrong.");
      setAttLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setAttLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location access is required for attendance check-out.");
        setAttLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await attendanceService.checkOut(loc.coords.latitude, loc.coords.longitude);
      Alert.alert("Success", "Checked out successfully!");
      fetchAttendance();
    } catch (err: any) {
      Alert.alert("Check-Out Failed", err?.response?.data?.error?.message || err?.message || "Something went wrong.");
      setAttLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Greeting */}
      <Text style={styles.greeting}>Hello, {user?.name?.split(" ")[0]} 👋</Text>
      <Text style={styles.territory}>{user?.territory || "North Delhi Central"}</Text>

      {/* Attendance Panel */}
      <View style={styles.attendanceCard}>
        <Text style={styles.attendanceTitle}>Daily Attendance</Text>
        {attLoading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginVertical: 12 }} />
        ) : !attendance.checkedIn ? (
          <View>
            <Text style={styles.attendanceStatus}>Status: Not Started</Text>
            <TouchableOpacity style={styles.checkBtn} onPress={handleCheckIn}>
              <Text style={styles.checkBtnText}>Check In (Selfie & Coordinates)</Text>
            </TouchableOpacity>
          </View>
        ) : !attendance.checkedOut ? (
          <View>
            <Text style={styles.attendanceStatus}>Checked In at {attendance.checkInTime}</Text>
            <TouchableOpacity style={[styles.checkBtn, { backgroundColor: "#EF4444" }]} onPress={handleCheckOut}>
              <Text style={styles.checkBtnText}>Check Out</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={[styles.attendanceStatus, { color: "#10B981", fontWeight: "600" }]}>
              Completed (In: {attendance.checkInTime} | Out: {attendance.checkOutTime})
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Total", value: summary.totalVisits },
          { label: "This Week", value: summary.thisWeek },
          { label: "This Month", value: summary.thisMonth },
        ].map(({ label, value }) => (
          <View key={label} style={styles.statCard}>
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      {/* New Visit CTA */}
      <TouchableOpacity
        style={styles.newVisitBtn}
        onPress={() => router.push("/(app)/new-visit")}
        accessibilityRole="button"
        accessibilityLabel="Log a new visit"
      >
        <Text style={styles.newVisitBtnText}>+ Log New Visit</Text>
      </TouchableOpacity>

      {/* Recent visits */}
      <Text style={styles.sectionTitle}>Recent Visits</Text>
      {loading ? (
        <ActivityIndicator color={Colors.primary} />
      ) : recentVisits.length === 0 ? (
        <Text style={styles.emptyText}>No visits yet. Tap above to log your first visit.</Text>
      ) : (
        recentVisits.map((v) => (
          <TouchableOpacity
            key={v.id}
            style={styles.visitCard}
            onPress={() => router.push({ pathname: "/(app)/history/[id]", params: { id: v.id } })}
          >
            <Text style={styles.visitEntity}>{(v as any).doctor?.fullName || (v as any).chemist?.name || "Target Entity"}</Text>
            <Text style={styles.visitMeta}>{formatDate(v.createdAt)} • {v.doctor ? "DOCTOR" : "CHEMIST"}</Text>
            {v.anomalyFlag && (
              <Text style={styles.anomalyBadge}>⚠️ Flagged</Text>
            )}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  content: { padding: 20 },
  greeting: { fontSize: 24, fontWeight: "700", color: "#111827", marginTop: 12 },
  territory: { fontSize: 14, color: "#6B7280", marginBottom: 20 },
  attendanceCard: { backgroundColor: "#fff", borderRadius: 12, padding: 18, marginBottom: 20, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  attendanceTitle: { fontSize: 16, fontWeight: "700", color: "#111827", marginBottom: 8 },
  attendanceStatus: { fontSize: 14, color: "#6B7280", marginBottom: 12 },
  checkBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  checkBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 16, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  statValue: { fontSize: 28, fontWeight: "700", color: Colors.primary },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 4 },
  newVisitBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 28 },
  newVisitBtnText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  sectionTitle: { fontSize: 17, fontWeight: "600", color: "#111827", marginBottom: 12 },
  visitCard: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  visitEntity: { fontSize: 15, fontWeight: "600", color: "#111827" },
  visitMeta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  anomalyBadge: { fontSize: 12, color: "#D97706", marginTop: 4 },
  emptyText: { color: "#9CA3AF", textAlign: "center", marginTop: 24 },
});
