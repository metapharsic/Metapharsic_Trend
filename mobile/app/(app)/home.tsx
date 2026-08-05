import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView 
} from 'react-native';
import { 
  MapPin, 
  Users, 
  ClipboardCheck, 
  Clock, 
  ChevronRight,
  Stethoscope,
  Store,
  Package
} from 'lucide-react-native';

const TODAY_PLAN = [
  { id: '1', name: 'Dr. Ananya Sharma', type: 'Doctor', specialty: 'Cardiologist', time: '10:00 AM', status: 'PENDING' },
  { id: '2', name: 'Apollo Pharmacy', type: 'Chemist', specialty: 'Retail', time: '11:30 AM', status: 'COMPLETED' },
  { id: '3', name: 'Dr. Vikram Singh', type: 'Doctor', specialty: 'General', time: '02:00 PM', status: 'PENDING' },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Good Morning,</Text>
            <Text style={styles.userName}>Rahul Desai</Text>
            <View style={styles.locationBadge}>
              <MapPin size={12} color="#10b981" />
              <Text style={styles.locationText}>Hauz Khas Territory, Delhi</Text>
            </View>
          </View>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>RD</Text>
          </View>
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Users size={20} color="#3b82f6" />
            <Text style={styles.statValue}>1/8</Text>
            <Text style={styles.statLabel}>Visits Done</Text>
          </View>
          <View style={styles.statCard}>
            <ClipboardCheck size={20} color="#10b981" />
            <Text style={styles.statValue}>100%</Text>
            <Text style={styles.statLabel}>DCR Sync</Text>
          </View>
          <View style={styles.statCard}>
            <Clock size={20} color="#f59e0b" />
            <Text style={styles.statValue}>2.4h</Text>
            <Text style={styles.statLabel}>Field Time</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIconBg, { backgroundColor: '#eff6ff' }]}>
                <Stethoscope size={24} color="#3b82f6" />
              </View>
              <Text style={styles.actionText}>Check In</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIconBg, { backgroundColor: '#ecfdf5' }]}>
                <Package size={24} color="#10b981" />
              </View>
              <Text style={styles.actionText}>New Order</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionButton}>
              <View style={[styles.actionIconBg, { backgroundColor: '#fef3c7' }]}>
                <Store size={24} color="#f59e0b" />
              </View>
              <Text style={styles.actionText}>Stock Audit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Today's Tour Plan */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Tour Plan</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.planList}>
            {TODAY_PLAN.map((item) => (
              <TouchableOpacity key={item.id} style={styles.planCard}>
                <View style={styles.planIcon}>
                  {item.type === 'Doctor' ? (
                    <Stethoscope size={20} color="#64748b" />
                  ) : (
                    <Store size={20} color="#64748b" />
                  )}
                </View>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{item.name}</Text>
                  <Text style={styles.planSpecialty}>{item.specialty} • {item.time}</Text>
                </View>
                {item.status === 'COMPLETED' ? (
                  <View style={styles.completedBadge}>
                    <Text style={styles.completedText}>Done</Text>
                  </View>
                ) : (
                  <ChevronRight size={20} color="#cbd5e1" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc', // slate-50
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 32,
    marginTop: 24, // extra padding for safe area on some devices
  },
  greeting: {
    fontSize: 14,
    color: '#64748b', // slate-500
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a', // slate-900
    marginTop: 2,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5', // emerald-50
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#d1fae5',
  },
  locationText: {
    fontSize: 12,
    color: '#059669', // emerald-600
    fontWeight: '600',
    marginLeft: 4,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9', // slate-100
    shadowColor: '#94a3b8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 12,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
  },
  actionIconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  planList: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    overflow: 'hidden',
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  planIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  planSpecialty: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  completedBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completedText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#10b981',
  },
});
