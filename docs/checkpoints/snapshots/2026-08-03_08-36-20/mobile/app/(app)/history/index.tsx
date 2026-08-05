import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { visitService } from "@/services/visit.service";
import { Colors } from "@/theme/colors";
import { formatDateTime } from "@/utils/formatters";
import { RECEPTIVENESS_LABELS } from "@/utils/constants";
import type { Visit } from "@/types";

export default function HistoryScreen() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadVisits = async (pageNum = 1) => {
    try {
      const res = await visitService.getMyVisits({ page: pageNum, limit: 20 });
      if (pageNum === 1) setVisits(res.visits);
      else setVisits((prev) => [...prev, ...res.visits]);
      setHasMore(res.pagination.page < res.pagination.totalPages);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { loadVisits(1); }, []);

  const loadMore = () => {
    if (!hasMore) return;
    const next = page + 1;
    setPage(next);
    loadVisits(next);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={Colors.primary} size="large" /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Visit History</Text>
      <FlatList
        data={visits}
        keyExtractor={(v) => v.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No visits yet. Log your first visit!</Text>
        }
        renderItem={({ item: v }) => {
          const name = v.doctor?.fullName || v.chemist?.name || "Target Entity";
          const type = v.doctor ? "DOCTOR" : "CHEMIST";
          return (
            <TouchableOpacity
              style={[styles.card, v.anomalyFlag && styles.cardFlagged]}
              onPress={() => router.push({ pathname: "/(app)/history/[id]", params: { id: v.id } })}
            >
              <Text style={styles.entityName}>{name}</Text>
              <Text style={styles.meta}>{formatDateTime(v.createdAt)}</Text>
              <Text style={styles.meta}>{type}</Text>
              {v.receptiveness && (
                <Text style={styles.receptiveness}>
                  {RECEPTIVENESS_LABELS[v.receptiveness] ?? v.receptiveness}
                </Text>
              )}
              {v.anomalyFlag && <Text style={styles.flagBadge}>⚠️ Flagged for review</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB", padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 },
  cardFlagged: { borderLeftWidth: 3, borderLeftColor: "#F59E0B" },
  entityName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  meta: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  receptiveness: { fontSize: 13, color: Colors.primary, marginTop: 4, fontWeight: "500" },
  flagBadge: { fontSize: 12, color: "#D97706", marginTop: 6 },
  emptyText: { color: "#9CA3AF", textAlign: "center", marginTop: 40 },
});
