import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Image, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { visitService } from "@/services/visit.service";
import { Colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/formatters";
import { RECEPTIVENESS_LABELS } from "@/utils/constants";

export default function VisitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [visit, setVisit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    visitService.getVisitById(id).then((res) => setVisit(res.visit)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <View style={s.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  if (!visit) return <View style={s.centered}><Text>Visit not found.</Text></View>;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={s.title}>{visit.doctor?.fullName || visit.chemist?.name || "Target Entity"}</Text>
      <Text style={s.sub}>{(visit.doctor ? "DOCTOR" : "CHEMIST")} • {visit.doctor?.clinicAddress || visit.chemist?.address || "—"}</Text>
      <Text style={s.meta}>Logged: {formatDateTime(visit.createdAt)}</Text>

      {/* Photo */}
      {visit.photoUrl && (
        <Image source={{ uri: visit.photoUrl }} style={s.photo} resizeMode="cover" />
      )}

      {/* Location */}
      <Row label="GPS" value={
        visit.locationUnavailable
          ? "⚠️ Location unavailable (flagged)"
          : visit.latitude
          ? `${visit.latitude.toFixed(5)}, ${visit.longitude.toFixed(5)}`
          : "—"
      } />

      {/* Activity */}
      <Text style={s.sectionTitle}>Activity Notes</Text>
      <Text style={s.notes}>{visit.activityNotes}</Text>

      {/* Details */}
      <Row label="Materials left" value={visit.materialsLeft ?? "—"} />
      <Row label="Receptiveness" value={visit.receptiveness ? RECEPTIVENESS_LABELS[visit.receptiveness] : "—"} />
      <Row label="Notes" value={visit.notes ?? "—"} />
      <Row label="Follow-up date" value={visit.followUpDate ? formatDateTime(visit.followUpDate) : "—"} />

      {/* Anomaly */}
      {visit.anomalyFlag && (
        <View style={s.anomalyBox}>
          <Text style={s.anomalyTitle}>⚠️ Visit Flagged for Manager Review</Text>
          {visit.anomalyDetails && (
            <Text style={s.anomalyDetail}>
              Reason: {visit.anomalyDetails.reason?.replace(/_/g, " ")}
              {visit.anomalyDetails.calculatedSpeed
                ? ` (${visit.anomalyDetails.calculatedSpeed} km/h)`
                : ""}
            </Text>
          )}
        </View>
      )}

      <Text style={s.immutable}>
        🔒 This visit record is locked and cannot be edited.
      </Text>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  sub: { fontSize: 14, color: Colors.primary, marginBottom: 4 },
  meta: { fontSize: 13, color: "#6B7280", marginBottom: 16 },
  photo: { width: "100%", height: 220, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginTop: 16, marginBottom: 6 },
  notes: { fontSize: 15, color: "#374151", lineHeight: 22 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  rowLabel: { fontSize: 14, color: "#6B7280" },
  rowValue: { fontSize: 14, color: "#111827", flex: 1, textAlign: "right" },
  anomalyBox: { backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FCD34D", borderRadius: 10, padding: 14, marginTop: 20 },
  anomalyTitle: { fontSize: 14, fontWeight: "600", color: "#D97706" },
  anomalyDetail: { fontSize: 13, color: "#92400E", marginTop: 4 },
  immutable: { textAlign: "center", color: "#9CA3AF", fontSize: 12, marginTop: 24 },
});
