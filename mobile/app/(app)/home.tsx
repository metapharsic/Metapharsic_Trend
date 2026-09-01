import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { 
  MapPin, 
  Users, 
  ClipboardCheck, 
  Clock, 
  ChevronRight,
  Stethoscope,
  Store,
  Package,
  CheckCircle,
  LogOut,
  RefreshCw
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { authService, LoginResponse } from '../../services/auth.service';
import { attendanceService } from '../../services/attendance.service';
import { visitService } from '../../services/visit.service';
import { storageService } from '../../services/storage.service';
import { api } from '../../services/api';

interface DashboardData {
  employee?: { firstName?: string; lastName?: string };
  coverageSummary?: { visited?: number; target?: number; percent?: number };
  gpsTracking?: { distanceKm?: number; status?: string };
  plannedStops?: Array<{
    id: string;
    type: 'Doctor' | 'Chemist' | 'Hospital';
    name: string;
    specialty?: string;
    time?: string;
    isCompleted?: boolean;
    targetId: string;
  }>;
}

export default function HomeScreen() {
  const router = useRouter();
  const [session, setSession] = useState<LoginResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [attendance, setAttendance] = useState<{ checkedIn: boolean; checkedOut: boolean }>({ checkedIn: false, checkedOut: false });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const activeSession = await authService.getSession();
      if (!activeSession) {
        router.replace('/(auth)/login');
        return;
      }
      setSession(activeSession);

      // Load attendance status
      const att = await attendanceService.getTodayStatus();
      setAttendance(att);

      // Load live dashboard
      const res = await api.get('/mr/dashboard').catch(() => null);
      if (res?.data?.data) {
        setDashboard(res.data.data);
      }

      // Check pending offline queue
      const queuedVisits = await storageService.getQueuedVisits();
      const queuedOrders = await storageService.getQueuedOrders();
      setPendingSyncCount(queuedVisits.length + queuedOrders.length);
    } catch (err) {
      console.warn("Failed to load dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAttendanceToggle = async () => {
    setActionLoading(true);
    try {
      if (!attendance.checkedIn) {
        await attendanceService.checkIn();
        Alert.alert("Success", "Checked in successfully! Have a productive field day.");
      } else if (!attendance.checkedOut) {
        await attendanceService.checkOut();
        Alert.alert("Success", "Checked out successfully. Day summary synced.");
      }
      await loadData();
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      Alert.alert("Attendance Error", errorObj?.response?.data?.error?.message || "Failed to update attendance");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFlushOffline = async () => {
    setActionLoading(true);
    try {
      const syncedVisits = await visitService.flushOfflineVisits();
      Alert.alert("Sync Complete", `Synced ${syncedVisits} offline visits to server.`);
      await loadData();
    } catch {
      Alert.alert("Sync Notice", "Offline queue sync will retry automatically when connection stabilizes.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  const mrName = session?.user?.name || `${dashboard?.employee?.firstName || 'Rajesh'} ${dashboard?.employee?.lastName || 'Kumar'}`;
  const visitsDone = dashboard?.coverageSummary?.visited ?? 0;
  const targetVisits = dashboard?.coverageSummary?.target ?? 8;
  const distanceKm = dashboard?.gpsTracking?.distanceKm ?? 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Day,</Text>
            <Text style={styles.userName}>{mrName}</Text>
            <View style={styles.locationBadge}>
              <MapPin size={12} color="#10b981" />
              <Text style={styles.locationText}>Delhi Central Territory</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Offline Sync Banner if items are queued */}
        {pendingSyncCount > 0 && (
          <TouchableOpacity style={styles.syncBanner} onPress={handleFlushOffline}>
            <RefreshCw size={16} color="#0284c7" />
            <Text style={styles.syncBannerText}>{pendingSyncCount} offline record(s) queued. Tap to sync.</Text>
          </TouchableOpacity>
        )}

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Users size={20} color="#3b82f6" />
            <Text style={styles.statValue}>{visitsDone}/{targetVisits}</Text>
            <Text style={styles.statLabel}>Visits Done</Text>
          </View>
          <View style={styles.statCard}>
            <ClipboardCheck size={20} color="#10b981" />
            <Text style={styles.statValue}>{dashboard?.coverageSummary?.percent ?? 0}%</Text>
            <Text style={styles.statLabel}>Coverage</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={20} color="#f59e0b" />
            <Text style={styles.statValue}>{distanceKm} km</Text>
            <Text style={styles.statLabel}>Traveled</Text>
          </View>
        </View>

        {/* Attendance Action Box */}
        <View style={styles.attendanceBox}>
          <View style={styles.attendanceStatus}>
            <View style={[styles.statusDot, { backgroundColor: attendance.checkedIn && !attendance.checkedOut ? '#10b981' : '#f59e0b' }]} />
            <Text style={styles.attendanceStatusText}>
              {attendance.checkedOut ? "Checked Out (Shift Done)" : attendance.checkedIn ? "Checked In (Active Field Day)" : "Not Checked In"}
            </Text>
          </View>
          {!attendance.checkedOut && (
            <TouchableOpacity 
              style={[styles.attendanceButton, attendance.checkedIn ? styles.checkOutBtn : styles.checkInBtn]}
              onPress={handleAttendanceToggle}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.attendanceBtnText}>
                  {attendance.checkedIn ? "Check Out for Day" : "Start Day (Check In)"}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Quick Navigation Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Field Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(app)/route')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#eff6ff' }]}>
                <Stethoscope size={24} color="#3b82f6" />
              </View>
              <Text style={styles.actionText}>Route Map</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(app)/expense')}>
              <View style={[styles.actionIconBg, { backgroundColor: '#ecfdf5' }]}>
                <Package size={24} color="#10b981" />
              </View>
              <Text style={styles.actionText}>Expenses</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton} onPress={handleFlushOffline}>
              <View style={[styles.actionIconBg, { backgroundColor: '#fef3c7' }]}>
                <Store size={24} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>Sync Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Tour Plan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Target Schedule</Text>
          </View>

          <View style={styles.planList}>
            <TouchableOpacity style={styles.planCard} onPress={() => router.push('/(app)/route')}>
              <View style={styles.planIcon}>
                <Stethoscope size={20} color="#10b981" />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>Dr. Sandeep Sharma</Text>
                <Text style={styles.planSpecialty}>General Medicine • 10:00 AM</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.planCard} onPress={() => router.push('/(app)/route')}>
              <View style={styles.planIcon}>
                <Store size={20} color="#3b82f6" />
              </View>
              <View style={styles.planInfo}>
                <Text style={styles.planName}>Apollo Pharmacy</Text>
                <Text style={styles.planSpecialty}>Retail Chemist • 11:30 AM</Text>
              </View>
              <ChevronRight size={20} color="#cbd5e1" />
            </TouchableOpacity>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: 12,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 2,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  locationText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '600',
    marginLeft: 4,
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#38bdf8',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  syncBannerText: {
    color: '#0369a1',
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
  },
  attendanceBox: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  attendanceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  attendanceStatusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  attendanceButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInBtn: {
    backgroundColor: '#10b981',
  },
  checkOutBtn: {
    backgroundColor: '#ef4444',
  },
  attendanceBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  planList: {
    gap: 10,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  planIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  planSpecialty: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
